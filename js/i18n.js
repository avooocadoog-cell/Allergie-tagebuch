/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: i18n.js                                             ║
 * ║  Hund Manager – Mehrsprachigkeit / Übersetzungen             ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Übersetzungen aus der Translations-Tabelle laden          ║
 * ║  - t(key, lang?) → übersetzten Text liefern                  ║
 * ║  - Fallback: erst Deutsch, dann key selbst                   ║
 * ║  - Aktive Sprache speichern (localStorage)                   ║
 * ║  - Dynamisches DOM-Update (data-i18n Attribut)               ║
 * ║                                                              ║
 * ║  Sheet-Struktur (Translations):                              ║
 * ║    Zeile 1: Anzeige-Header (deutsch)                         ║
 * ║    Zeile 2: API-Header (key | lang | value | context)        ║
 * ║    Daten ab Zeile 3                                          ║
 * ║                                                              ║
 * ║  Nutzung im HTML:                                            ║
 * ║    <span data-i18n="symptom_juckreiz">Juckreiz</span>        ║
 * ║    → I18N.applyAll() ersetzt alle data-i18n Texte            ║
 * ║                                                              ║
 * ║  Nutzung im JS:                                              ║
 * ║    import { t } from './i18n.js';                            ║
 * ║    t('symptom_juckreiz')       → 'Juckreiz' (aktive Sprache) ║
 * ║    t('symptom_juckreiz', 'en') → 'itching'                  ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js                        ║
 * ║  Wird importiert von: main.js (optional), ui.js (optional)   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet }     from './sheets.js';
import { get as getCfg } from './config.js';

// ── Interner State ───────────────────────────────────────────────
/** Map: key → { lang → value }  Beispiel: 'symptom_itching' → { de: 'Juckreiz', en: 'itching' } */
const _store  = {};

/** Aktuell aktive Sprache */
let _lang = 'de';

/** Ob Translations-Sheet bereits geladen wurde */
let _loaded = false;

// ── localStorage Key ─────────────────────────────────────────────
const KEY_LANG = 'hundapp_lang';

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

/**
 * Übersetzungen aus dem Translations-Sheet laden.
 * Graceful: wenn Sheet nicht existiert, bleibt _store leer und t() gibt key zurück.
 * Idempotent: zweimaliger Aufruf lädt nicht neu.
 *
 * @param {boolean} [force=false] - Auch bei bereits geladenem Store neu laden
 * @returns {Promise<number>} Anzahl geladener Einträge
 */
export async function load(force = false) {
  if (_loaded && !force) return Object.keys(_store).length;

  // Gespeicherte Sprache laden
  try { _lang = localStorage.getItem(KEY_LANG) || 'de'; } catch { _lang = 'de'; }

  const cfg = getCfg();
  if (!cfg.stammdatenId) return 0;

  try {
    const rows = await readSheet('Translations', cfg.stammdatenId);
    const data = rows.slice(2).filter(r =>
      r?.some(v => v !== null && v !== undefined && String(v).trim() !== '')
    );

    data.forEach(r => {
      const key  = String(r[0] ?? '').trim();
      const lang = String(r[1] ?? '').trim().toLowerCase();
      const val  = String(r[2] ?? '').trim();
      if (!key || !lang || !val) return;
      if (!_store[key]) _store[key] = {};
      _store[key][lang] = val;
    });

    _loaded = true;
    console.info(`i18n: ${data.length} Einträge geladen für ${Object.keys(_store).length} Keys.`);
    return Object.keys(_store).length;
  } catch (e) {
    // Sheet existiert noch nicht → kein Fehler
    console.info('i18n: Translations-Sheet noch nicht vorhanden, Fallback auf Keys.');
    _loaded = true;
    return 0;
  }
}

/**
 * Einen Schlüssel übersetzen.
 *
 * Fallback-Kette:
 *   1. Gewünschte Sprache (lang oder aktive Sprache)
 *   2. Deutsch ('de')
 *   3. Der Schlüssel selbst (als lesbarer Fallback)
 *
 * @param {string}  key  - Übersetzungsschlüssel, z.B. 'symptom_juckreiz'
 * @param {string}  [lang] - Sprache (Standard: aktive Sprache)
 * @returns {string}
 */
export function t(key, lang) {
  const l = (lang || _lang).toLowerCase();
  const entry = _store[key];
  if (!entry) return _humanize(key);
  return entry[l] || entry['de'] || _humanize(key);
}

/**
 * Aktive Sprache wechseln und im localStorage speichern.
 * Ruft danach applyAll() auf.
 *
 * @param {string} lang - z.B. 'de', 'en'
 */
export function setLang(lang) {
  _lang = lang.toLowerCase();
  try { localStorage.setItem(KEY_LANG, _lang); } catch { /* ignore */ }
  applyAll();
}

/**
 * Aktive Sprache abfragen.
 * @returns {string}
 */
export function getLang() { return _lang; }

/**
 * Alle DOM-Elemente mit data-i18n="key" übersetzen.
 * textContent wird ersetzt, title-Attribut wenn gesetzt.
 *
 * Beispiel HTML:  <span data-i18n="nav_diary">Tagebuch</span>
 */
export function applyAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return;
    // Nur ersetzen wenn eine echte Übersetzung im Store vorhanden ist.
    // Kein Eintrag → bestehenden DOM-Text behalten (kein Fallback auf key-name).
    const entry = _store[key];
    if (!entry) return;
    const translated = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
    if (el.hasAttribute('data-i18n-title')) {
      el.title = t(el.dataset.i18nTitle);
    }
  });
}

/**
 * Alle verfügbaren Sprachen aus dem Store ermitteln.
 * @returns {string[]} z.B. ['de', 'en']
 */
export function getAvailableLangs() {
  const langs = new Set();
  Object.values(_store).forEach(entry => Object.keys(entry).forEach(l => langs.add(l)));
  return [...langs].sort();
}

/**
 * Alle Schlüssel eines Kontexts zurückgeben.
 * Nützlich um die Vollständigkeit einer Übersetzung zu prüfen.
 *
 * @param {string} context - z.B. 'symptom', 'zutat_kategorie'
 * @returns {string[]}
 */
export function getKeysByContext(context) {
  // Kontext ist in Spalte D (Index 3) im Sheet – wir speichern ihn nicht im Store.
  // Deshalb: Filterung per Key-Präfix als Konvention.
  // Schlüssel-Konvention: context_name, z.B. symptom_juckreiz
  return Object.keys(_store).filter(k => k.startsWith(context + '_'));
}

/**
 * Einzelnen Schlüssel + Übersetzungen direkt setzen (für Tests oder manuelle Ergänzungen).
 * @param {string} key
 * @param {Object} translations - z.B. { de: 'Juckreiz', en: 'itching' }
 */
export function set(key, translations) {
  _store[key] = { ...(_store[key] || {}), ...translations };
}

/**
 * Gibt den vollständigen Store zurück (für Debugging).
 * @returns {Object}
 */
export function dump() { return { ..._store }; }

// ════════════════════════════════════════════════════════════════
//  VORDEFINIERTE STANDARD-ÜBERSETZUNGEN
// ════════════════════════════════════════════════════════════════

/**
 * Standard-Übersetzungen für häufig verwendete Begriffe.
 * Werden beim Laden mit den Sheet-Daten zusammengeführt (Sheet hat Priorität).
 * So funktioniert die App auch ohne befülltes Translations-Sheet.
 */
export function loadDefaults() {
  const defaults = {
    // Navigation
    'nav_rechner':      { de: 'Rechner',     en: 'Calculator' },
    'nav_tagebuch':     { de: 'Tagebuch',    en: 'Diary' },
    'nav_statistik':    { de: 'Statistik',   en: 'Statistics' },
    'nav_stammdaten':   { de: 'Stammdaten',  en: 'Master Data' },
    'nav_einstellungen':{ de: 'Einstellungen',en: 'Settings' },
    // Symptom-Kategorien
    'symptom_juckreiz':   { de: 'Juckreiz',       en: 'Itching' },
    'symptom_hautrötung': { de: 'Hautrötung',      en: 'Skin Redness' },
    'symptom_pfoten':     { de: 'Pfoten lecken',   en: 'Paw licking' },
    'symptom_durchfall':  { de: 'Durchfall',       en: 'Diarrhea' },
    'symptom_erbrechen':  { de: 'Erbrechen',       en: 'Vomiting' },
    'symptom_ohr':        { de: 'Ohrentzündung',   en: 'Ear infection' },
    'symptom_schütteln':  { de: 'Schütteln',       en: 'Shaking' },
    'symptom_sonstiges':  { de: 'Sonstiges',       en: 'Other' },
    // Zutaten-Kategorien
    'kat_fleisch':        { de: 'Fleisch',          en: 'Meat' },
    'kat_innereien':      { de: 'Innereien',        en: 'Offal' },
    'kat_fisch':          { de: 'Fisch',            en: 'Fish' },
    'kat_gemüse':         { de: 'Gemüse',           en: 'Vegetables' },
    'kat_obst':           { de: 'Obst',             en: 'Fruit' },
    'kat_öl':             { de: 'Öle/Fette',        en: 'Oils/Fats' },
    'kat_supplement':     { de: 'Supplement',       en: 'Supplement' },
    'kat_sonstiges':      { de: 'Sonstiges',        en: 'Other' },
    // Status
    'status_verträglich': { de: 'Verträglich',      en: 'Tolerated' },
    'status_reaktion':    { de: 'Reaktion',         en: 'Reaction' },
    'status_gesperrt':    { de: 'Gesperrt',         en: 'Blocked' },
    'status_test':        { de: 'Im Test',          en: 'In Testing' },
    // UI-Begriffe
    'ui_save':            { de: 'Speichern',        en: 'Save' },
    'ui_cancel':          { de: 'Abbrechen',        en: 'Cancel' },
    'ui_delete':          { de: 'Löschen',          en: 'Delete' },
    'ui_edit':            { de: 'Bearbeiten',       en: 'Edit' },
    'ui_loading':         { de: 'Wird geladen…',    en: 'Loading…' },
    'ui_no_entries':      { de: 'Noch keine Einträge.', en: 'No entries yet.' },
    'ui_refresh':         { de: 'Aktualisieren',   en: 'Refresh' },
    // Nährstoff-Gruppen
    'nutr_makros':        { de: 'Makronährstoffe',  en: 'Macronutrients' },
    'nutr_aminosäuren':   { de: 'Aminosäuren',      en: 'Amino Acids' },
    'nutr_fettsäuren':    { de: 'Fettsäuren',       en: 'Fatty Acids' },
    'nutr_mineralstoffe': { de: 'Mineralstoffe',    en: 'Minerals' },
    'nutr_vitamine':      { de: 'Vitamine',         en: 'Vitamins' },
  };

  // Defaults eintragen ohne Sheet-Einträge zu überschreiben
  Object.entries(defaults).forEach(([key, langs]) => {
    if (!_store[key]) _store[key] = {};
    Object.entries(langs).forEach(([l, v]) => {
      if (!_store[key][l]) _store[key][l] = v;
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  PRIVATE HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

/**
 * Schlüssel ohne Übersetzung leserlich machen.
 * 'symptom_juckreiz' → 'symptom juckreiz'
 * @param {string} key
 * @returns {string}
 */
function _humanize(key) {
  return key.replace(/_/g, ' ');
}
