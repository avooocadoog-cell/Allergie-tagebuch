/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: config.js                                           ║
 * ║  Hund Manager – Konfiguration                                ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Laden/Speichern der Konfiguration aus localStorage        ║
 * ║  - Google Client-ID, Spreadsheet-IDs, Standort              ║
 * ║  - Default-Werte (Berlin)                                    ║
 * ║  - Verbindungstest zu beiden Spreadsheets                    ║
 * ║                                                              ║
 * ║  Abhängigkeiten: keine                                       ║
 * ║  Wird importiert von: sheets.js, store.js, wetter.js,       ║
 * ║    rechner.js, tagebuch.js, ansicht.js, stammdaten.js,      ║
 * ║    main.js                                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { setStatus }    from './ui.js';
import { getSheetsList, createSheetWithHeaders } from './sheets.js';

// ── Default-Konfiguration ────────────────────────────────────────
// Neue Nutzer ersetzen diese IDs durch ihre eigenen Google Sheets IDs
const DEFAULTS = {
  clientId:     '691155115903-q69fuj564d7kaag2vk3fg2nffk2lhpnf.apps.googleusercontent.com',
  stammdatenId: '1rGujROHowGeK47fAyXbgAk8VyFOKBILfpImi6WKdfPY',
  tagebuchId:   '1k__ZEMOOTjxvKnGC0gyIrIZDNvLG7TPXAgm0-HZEOS8',
  lat:          52.4,   // Berlin
  lon:          13.4,   // Berlin
  pollenRegion: 50,     // Berlin DWD Region
};

// ── Interner State ───────────────────────────────────────────────
let cfg = { ...DEFAULTS };

// ── Mapping: DOM-Element-ID → Config-Key ────────────────────────
const FIELD_MAP = {
  'cfg-client-id':     'clientId',
  'cfg-stammdaten-id': 'stammdatenId',
  'cfg-tagebuch-id':   'tagebuchId',
  'cfg-lat':           'lat',
  'cfg-lon':           'lon',
  'cfg-pollen-region': 'pollenRegion',
};

/**
 * Konfiguration aus localStorage laden und Felder befüllen.
 * Wird beim App-Start aufgerufen (vor dem Login-Check).
 */
export function load() {
  try {
    const saved = localStorage.getItem('hundapp_config');
    if (saved) cfg = { ...DEFAULTS, ...JSON.parse(saved) };
  } catch (e) {
    console.warn('Config konnte nicht geladen werden:', e);
  }

  // DOM-Felder befüllen (nur wenn bereits im DOM vorhanden)
  Object.entries(FIELD_MAP).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = cfg[key] ?? '';
  });
}

/**
 * Aktuelle Formular-Werte in localStorage speichern.
 * Wird bei jedem `oninput` auf den Konfigurationsfeldern aufgerufen.
 */
export function save() {
  cfg.clientId     = document.getElementById('cfg-client-id')?.value.trim()      ?? '';
  cfg.stammdatenId = document.getElementById('cfg-stammdaten-id')?.value.trim()  ?? '';
  cfg.tagebuchId   = document.getElementById('cfg-tagebuch-id')?.value.trim()    ?? '';
  cfg.lat          = parseFloat(document.getElementById('cfg-lat')?.value)       || 52.4;
  cfg.lon          = parseFloat(document.getElementById('cfg-lon')?.value)       || 13.4;
  cfg.pollenRegion = parseInt(document.getElementById('cfg-pollen-region')?.value) || 50;

  try {
    localStorage.setItem('hundapp_config', JSON.stringify(cfg));
  } catch (e) {
    console.warn('Config konnte nicht gespeichert werden:', e);
  }
}

/**
 * Verbindungstest zu beiden Spreadsheets.
 * Importiert SHEETS dynamisch um Zirkel-Importe zu vermeiden.
 * Zeigt Ergebnis über UI.setStatus an.
 */
export async function testConnection() {
  setStatus('status-conn', 'loading', 'Verbindung wird getestet…');
  try {
    const [r1, r2] = await Promise.all([
      getSheetsList(cfg.stammdatenId),
      getSheetsList(cfg.tagebuchId),
    ]);
    setStatus('status-conn', 'ok',
      `✓ Verbunden!\nStammdaten: ${r1.join(', ')}\nTagebuch: ${r2.join(', ')}`);
  } catch (e) {
    setStatus('status-conn', 'err', 'Fehler: ' + e.message);
  }
}

/**
 * Aktuelle Konfiguration zurückgeben (read-only Referenz).
 * @returns {{ clientId: string, stammdatenId: string, tagebuchId: string,
 *             lat: number, lon: number, pollenRegion: number }}
 */
export function get() {
  return cfg;
}

/**
 * Prüft ob alle drei Pflicht-IDs vorhanden sind.
 * Wird beim Start verwendet um den Setup-Hinweis anzuzeigen.
 * @returns {boolean}
 */
export function isConfigured() {
  return !!(cfg.clientId && cfg.stammdatenId && cfg.tagebuchId);
}

/**
 * Alle neuen v2-Sheets in beiden Spreadsheets anlegen (idempotent).
 * Bereits vorhandene Sheets werden übersprungen.
 * Status wird im DOM-Element 'setup-sheets-status' angezeigt.
 */
export async function setupAllSheets() {
  const el = document.getElementById('setup-sheets-status');
  const setMsg = (msg) => { if (el) el.textContent = msg; };

  if (!cfg.stammdatenId || !cfg.tagebuchId) {
    setMsg('⚠️ Bitte erst Spreadsheet-IDs eintragen und speichern.');
    return;
  }

  setMsg('⏳ Wird eingerichtet…');

  // Definition aller neuen Sheets
  // Format: [sheetName, [Anzeige-Header Zeile 1], [API-Header Zeile 2], spreadsheetId]
  const sid = cfg.stammdatenId;
  const tid = cfg.tagebuchId;

  const sheets = [
    // ── Stammdaten ──────────────────────────────────────────────
    [
      'Rezept_Komponenten',
      ['ID','Rezept ID','Typ','Referenz ID','Gramm','Notizen'],
      ['id','rezept_id','komponenten_typ','ref_id','gramm','notizen'],
      sid,
    ],
    [
      'Translations',
      ['Schlüssel','Sprache','Wert','Kontext'],
      ['key','lang','value','context'],
      sid,
    ],
    // ── Tagebuch ─────────────────────────────────────────────────
    [
      'Hund_Gewicht',
      ['ID','Hund ID','Datum','Gewicht (kg)','Notizen','Erstellt am'],
      ['entry_id','hund_id','datum','gewicht_kg','notizen','created_at'],
      tid,
    ],
    [
      'Pollen_Log',
      ['ID','Hund ID','Datum','Pollenart','Stufe (0–5)','Quelle','Erstellt am'],
      ['entry_id','hund_id','datum','pollenart','stufe','source','created_at'],
      tid,
    ],
  ];

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [name, display, api, spreadsheetId] of sheets) {
    try {
      const wasCreated = await createSheetWithHeaders(name, display, api, spreadsheetId);
      if (wasCreated) { created++; }
      else            { skipped++;  }
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }

  if (errors.length) {
    setMsg(`⚠️ ${created} angelegt · ${skipped} vorhanden · Fehler: ${errors.join(' | ')}`);
  } else {
    setMsg(`✅ Fertig: ${created} Sheet${created !== 1 ? 's' : ''} angelegt · ${skipped} bereits vorhanden.`);
  }
}
