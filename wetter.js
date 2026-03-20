/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: wetter.js                                           ║
 * ║  Hund Manager – Wetter & Pollen Automatik-Laden              ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Wetter-Daten von BrightSky API (DWD-Daten) laden          ║
 * ║  - Pollen-Daten von DWD OpenData laden (via CORS-Proxy)      ║
 * ║  - Formularfelder im Umwelt-Tab automatisch befüllen         ║
 * ║  - Status-Meldung während / nach dem Laden anzeigen          ║
 * ║                                                              ║
 * ║  APIs:                                                       ║
 * ║  - Wetter: https://api.brightsky.dev/weather                 ║
 * ║  - Pollen: https://opendata.dwd.de/.../s31fg.json            ║
 * ║    (via CORS-Proxy: allorigins.win oder corsproxy.io)        ║
 * ║                                                              ║
 * ║  Abhängigkeiten: config.js                                   ║
 * ║  Wird aufgerufen von: main.js (nach Login, setTimeout 500ms) ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { get as getCfg } from './config.js';

// ── Pollen-Konstanten ────────────────────────────────────────────

/** DWD API-Key → Anzeigename */
const POLLEN_NAMES = {
  Graeser: 'Gräser',
  Roggen:  'Roggen',
  Hasel:   'Hasel',
  Beifuss: 'Beifuß',
  Esche:   'Esche',
  Birke:   'Birke',
  Erle:    'Erle',
  Ambrosia:'Ambrosia',
};

/** Mindest-Belastungsstufe für Anzeige (0=keine, 1=gering, 2=mittel, 3=stark) */
const POLLEN_MIN_LEVEL = 2.0;

/** DWD Pollen JSON URL */
const DWD_POLLEN_URL = 'https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json';

/** CORS-Proxies (werden der Reihe nach probiert) */
const CORS_PROXIES = [
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
];

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

/**
 * Wetter und Pollen parallel laden.
 * Zeigt Status-Banner im Umwelt-Tab während des Ladens.
 * Fehler werden im Banner angezeigt (kein Throw).
 */
export async function loadAll() {
  const bar = document.getElementById('autoload-status');
  if (!bar) return;
  bar.style.display = 'block';
  bar.textContent   = '⏳ Lade Wetter und Pollen…';

  const [wetter, pollen] = await Promise.allSettled([
    loadWetter(),
    loadPollen(),
  ]);

  const msgs = [];
  msgs.push(wetter.status === 'fulfilled' ? '✅ Wetter geladen' : '⚠️ Wetter: ' + wetter.reason);
  msgs.push(pollen.status === 'fulfilled' ? '✅ Pollen geladen' : '⚠️ Pollen: ' + pollen.reason);
  bar.textContent = msgs.join('  ·  ');

  // Banner nach 6 Sekunden ausblenden
  setTimeout(() => { bar.style.display = 'none'; }, 6_000);
}

// ════════════════════════════════════════════════════════════════
//  WETTER (BrightSky / DWD)
// ════════════════════════════════════════════════════════════════

/**
 * Tagesdaten von BrightSky laden und in Formularfelder schreiben.
 * Berechnet Tagesmin/-max aus Stunden-Daten.
 *
 * Befüllt: u-temp-min, u-temp-max, u-regen, u-luftfeuchtig
 * @throws {string} Fehlermeldung
 */
async function loadWetter() {
  const cfg   = getCfg();
  const today = new Date().toISOString().slice(0, 10);
  const url   = `https://api.brightsky.dev/weather` +
                `?lat=${cfg.lat}&lon=${cfg.lon}&date=${today}&tz=Europe/Berlin`;

  const res = await fetch(url);
  if (!res.ok) throw `HTTP ${res.status}`;

  const data    = await res.json();
  const records = data.weather || [];
  if (!records.length) throw 'Keine Wetterdaten für heute';

  const temps  = records.map(r => r.temperature).filter(t => t != null);
  const precip = records.map(r => r.precipitation ?? 0);
  const humids = records.map(r => r.relative_humidity).filter(h => h != null);

  setValue('u-temp-min',    Math.round(Math.min(...temps)));
  setValue('u-temp-max',    Math.round(Math.max(...temps)));
  setValue('u-regen',       sumPrecip(precip));
  if (humids.length) setValue('u-luftfeuchtig', Math.round(avg(humids)));

  const src = document.getElementById('wetter-source');
  if (src) src.textContent = '(DWD via BrightSky)';
}

// ════════════════════════════════════════════════════════════════
//  POLLEN (DWD OpenData)
// ════════════════════════════════════════════════════════════════

/**
 * DWD Pollen-Daten laden und in Formularfeld schreiben.
 * Probiert CORS-Proxies der Reihe nach.
 *
 * Befüllt: u-pollen
 * @throws {string} Fehlermeldung
 */
async function loadPollen() {
  const cfg  = getCfg();
  const data = await fetchWithProxies(DWD_POLLEN_URL);

  const region = (data.content || []).find(r => r.region_id === cfg.pollenRegion);
  if (!region) throw `Region ${cfg.pollenRegion} nicht gefunden`;

  const pollenData  = region.Pollen || {};
  const highPollen  = [];

  for (const [key, displayName] of Object.entries(POLLEN_NAMES)) {
    if (!pollenData[key]) continue;
    const level = parsePollenLevel(pollenData[key].today);
    if (level >= POLLEN_MIN_LEVEL) {
      highPollen.push(`${displayName} (${formatPollenLevel(pollenData[key].today)})`);
    }
  }

  setValue('u-pollen',
    highPollen.length > 0 ? highPollen.join(', ') : 'keine erhöhte Belastung'
  );

  const src = document.getElementById('pollen-source');
  if (src) src.textContent = '(DWD)';
}

/**
 * JSON von einer URL via CORS-Proxies abrufen.
 * Probiert Proxies sequenziell bis einer funktioniert.
 *
 * @param {string} targetUrl - Ziel-URL (ohne Proxy)
 * @returns {Promise<Object>} Geparstes JSON-Objekt
 * @throws {string} Wenn alle Proxies scheitern
 */
async function fetchWithProxies(targetUrl) {
  for (const buildUrl of CORS_PROXIES) {
    try {
      const res = await fetch(buildUrl(targetUrl), {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;

      const text   = await res.text();
      const parsed = JSON.parse(text);

      // allorigins.win wraps in { contents: "..." }
      const data = parsed.contents ? JSON.parse(parsed.contents) : parsed;
      if (data?.content) return data;
    } catch (e) {
      // Nächsten Proxy versuchen
    }
  }
  throw 'Kein CORS-Proxy erreichbar (Pollen-Daten)';
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sumPrecip(arr) {
  const total = arr.reduce((a, b) => a + b, 0);
  return total > 0.1 ? Math.round(total * 10) / 10 : 0;
}

/**
 * Pollen-Rohwert ('0', '1', '1-2', '2-3', '3', '-1') in Zahl umwandeln.
 * Bei Bereich (z.B. '1-2') wird der niedrigere Wert genommen.
 * @param {string} raw
 * @returns {number}
 */
function parsePollenLevel(raw) {
  if (!raw || raw === '-1') return -1;
  if (raw.includes('-')) {
    const parts = raw.split('-').map(Number);
    return Math.min(...parts);
  }
  return parseFloat(raw) || 0;
}

/**
 * Pollen-Rohwert in lesbaren deutschen Text umwandeln.
 * @param {string} raw
 * @returns {string}
 */
function formatPollenLevel(raw) {
  const map = {
    '0':   'keine',
    '0-1': 'keine–gering',
    '1':   'gering',
    '1-2': 'gering–mittel',
    '2':   'mittel',
    '2-3': 'stark',
    '3':   'sehr stark',
  };
  return map[raw] || raw;
}
