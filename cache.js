/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: cache.js                                            ║
 * ║  Hund Manager – Tagebuch Lese-Cache                          ║
 * ║                                                              ║
 * ║  Problem: Jeder Ansicht-Tab + Statistik triggert Sheets-     ║
 * ║  Lesezugriffe → Quota wird schnell überschritten.            ║
 * ║                                                              ║
 * ║  Lösung: Alle Tagebuch-Sheets einmal laden, Ergebnis in      ║
 * ║  sessionStorage halten (TTL: 10 Min). Writes gehen weiter    ║
 * ║  direkt an Sheets, aktualisieren aber den Cache lokal.       ║
 * ║                                                              ║
 * ║  API:                                                        ║
 * ║  getSheet(name)   → Daten aus Cache oder Sheets-API          ║
 * ║  invalidate(name) → Cache für ein Sheet leeren               ║
 * ║  invalidateAll()  → Gesamten Cache leeren                    ║
 * ║  appendCached(name, row) → Zeile lokal anhängen nach Write   ║
 * ║  getAge(name)     → Alter des Cache-Eintrags in Sekunden     ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet }     from './sheets.js';
import { get as getCfg } from './config.js';

// ── Konfiguration ────────────────────────────────────────────────
const TTL_MS      = 10 * 60 * 1000;  // 10 Minuten
const STORE_KEY   = 'hundapp_cache';

// ── In-Memory Cache (schneller als sessionStorage für wiederholte Zugriffe)
const _mem = {};

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

/**
 * Sheet-Daten aus Cache lesen oder frisch von Sheets-API laden.
 * Gibt immer string[][] zurück (wie readSheet).
 *
 * @param {string} sheetName   - Tabellenblatt-Name, z.B. 'Symptomtagebuch'
 * @param {'tagebuch'|'stammdaten'} [which='tagebuch']
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<string[][]>}
 */
export async function getSheet(sheetName, which = 'tagebuch', forceRefresh = false) {
  const key = _cacheKey(sheetName, which);

  // 1. In-Memory prüfen
  if (!forceRefresh && _mem[key] && !_isExpired(_mem[key].ts)) {
    return _mem[key].data;
  }

  // 2. sessionStorage prüfen
  if (!forceRefresh) {
    const stored = _readStorage(key);
    if (stored && !_isExpired(stored.ts)) {
      _mem[key] = stored;
      return stored.data;
    }
  }

  // 3. Frisch von Sheets-API laden
  const cfg  = getCfg();
  const sid  = which === 'stammdaten' ? cfg.stammdatenId : cfg.tagebuchId;
  const data = await readSheet(sheetName, sid);

  _set(key, data);
  return data;
}

/**
 * Alle 7 Tagebuch-Sheets auf einmal laden (parallel).
 * Nützlich beim App-Start oder manuellem Refresh.
 * Zeigt Fortschritt im optionalen Status-Element.
 *
 * @param {string} [statusElId] - ID eines DOM-Elements für Statusmeldung
 */
export async function preloadAll(statusElId) {
  const sheets = [
    'Umweltagebuch', 'Symptomtagebuch', 'Futtertagebuch',
    'Ausschlussdiät', 'Bekannte Allergene', 'Tierarztbesuche', 'Medikamente',
  ];

  const setMsg = msg => {
    const el = statusElId ? document.getElementById(statusElId) : null;
    if (el) el.textContent = msg;
  };

  setMsg('⏳ Lade alle Tagebuch-Daten…');

  const cfg = getCfg();
  const tid = cfg.tagebuchId;

  try {
    const results = await Promise.allSettled(
      sheets.map(name => readSheet(name, tid))
    );

    let ok = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        _set(_cacheKey(sheets[i], 'tagebuch'), r.value);
        ok++;
      } else {
        console.warn(`Cache preload failed for ${sheets[i]}:`, r.reason);
      }
    });

    setMsg(`✅ ${ok}/${sheets.length} Sheets geladen · Cache gültig für 10 Min`);
    return ok;
  } catch(e) {
    setMsg('⚠️ Cache-Ladefehler: ' + e.message);
    throw e;
  }
}

/**
 * Cache für ein einzelnes Sheet leeren (erzwingt Re-Load beim nächsten Zugriff).
 * @param {string} sheetName
 * @param {'tagebuch'|'stammdaten'} [which='tagebuch']
 */
export function invalidate(sheetName, which = 'tagebuch') {
  const key = _cacheKey(sheetName, which);
  delete _mem[key];
  _deleteStorage(key);
}

/**
 * Gesamten Tagebuch-Cache leeren.
 */
export function invalidateAll() {
  Object.keys(_mem).forEach(k => delete _mem[k]);
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    Object.keys(all).forEach(k => delete all[k]);
    sessionStorage.setItem(STORE_KEY, JSON.stringify({}));
  } catch(e) { /* ignore */ }
}

/**
 * Nach einem appendRow-Write: Zeile lokal in den Cache anhängen
 * ohne einen neuen Read zu triggern.
 *
 * @param {string} sheetName
 * @param {Array}  row - Die geschriebene Zeile
 * @param {'tagebuch'|'stammdaten'} [which='tagebuch']
 */
export function appendCached(sheetName, row, which = 'tagebuch') {
  const key = _cacheKey(sheetName, which);
  if (_mem[key]) {
    _mem[key].data.push(row.map(v => String(v ?? '')));
    _writeStorage(key, _mem[key]);
  }
  // Falls kein Cache: kein Problem, nächster getSheet lädt frisch
}

/**
 * Alter des Cache-Eintrags in Sekunden (für UI-Anzeige).
 * @param {string} sheetName
 * @param {'tagebuch'|'stammdaten'} [which='tagebuch']
 * @returns {number|null} Sekunden oder null wenn kein Cache
 */
export function getAge(sheetName, which = 'tagebuch') {
  const key = _cacheKey(sheetName, which);
  const entry = _mem[key] || _readStorage(key);
  if (!entry) return null;
  return Math.round((Date.now() - entry.ts) / 1000);
}

/**
 * Prüft ob ein Sheet im Cache ist und noch gültig.
 * @param {string} sheetName
 * @param {'tagebuch'|'stammdaten'} [which='tagebuch']
 * @returns {boolean}
 */
export function isCached(sheetName, which = 'tagebuch') {
  const key = _cacheKey(sheetName, which);
  const entry = _mem[key] || _readStorage(key);
  return !!(entry && !_isExpired(entry.ts));
}

// ════════════════════════════════════════════════════════════════
//  PRIVATE HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

function _cacheKey(sheetName, which) {
  return `${which}::${sheetName}`;
}

function _isExpired(ts) {
  return Date.now() - ts > TTL_MS;
}

function _set(key, data) {
  const entry = { data, ts: Date.now() };
  _mem[key] = entry;
  _writeStorage(key, entry);
}

function _readStorage(key) {
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    return all[key] || null;
  } catch(e) { return null; }
}

function _writeStorage(key, entry) {
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    all[key]  = entry;
    sessionStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch(e) {
    // sessionStorage voll → nur In-Memory nutzen
    console.warn('Cache sessionStorage write failed:', e);
  }
}

function _deleteStorage(key) {
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    delete all[key];
    sessionStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch(e) { /* ignore */ }
}
