/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: main.js                                             ║
 * ║  Hund Manager – App-Einstieg & Globale Exports               ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - App initialisieren (CONFIG laden, Login prüfen)           ║
 * ║  - Nach Login: STORE laden, UI aufbauen                      ║
 * ║  - Alle Module als window.* exportieren (für HTML onclick=)  ║
 * ║                                                              ║
 * ║  HINWEIS: window-Exports sind bewusste Entscheidung damit    ║
 * ║  das HTML nicht umgeschrieben werden muss. Bei einer         ║
 * ║  späteren Überarbeitung können onclick= durch                ║
 * ║  addEventListener ersetzt und die window-Exports entfernt    ║
 * ║  werden.                                                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import * as CONFIG     from './config.js';
import * as AUTH       from './auth.js';
import * as STORE      from './store.js';
import * as UI         from './ui.js';
import * as FORM       from './form.js';
import * as WETTER     from './wetter.js';
import * as TAGEBUCH   from './tagebuch.js';
import * as ANSICHT    from './ansicht.js';
import * as RECHNER    from './rechner.js';
import * as STAMMDATEN from './stammdaten.js';
import * as STATISTIK  from './statistik.js';
import * as CACHE      from './cache.js';
import * as I18N       from './i18n.js';

// Callback registrieren damit auth.js nach Login onLogin() aufrufen kann
// ohne main.js zirkular zu importieren
AUTH.setOnLoginCallback(() => onLogin());

// ════════════════════════════════════════════════════════════════
//  GLOBALE EXPORTS (für HTML onclick= Handler)
// ════════════════════════════════════════════════════════════════

window.CONFIG     = CONFIG;
window.AUTH       = AUTH;
window.UI         = UI;
window.FORM       = FORM;
window.WETTER     = WETTER;
window.TAGEBUCH   = TAGEBUCH;
window.ANSICHT    = ANSICHT;
window.RECHNER    = RECHNER;
window.STAMMDATEN = STAMMDATEN;
window.STATISTIK  = STATISTIK;
window.CACHE      = CACHE;
window.I18N       = I18N;

// APP-Objekt (für APP.currentHundId in HTML)
window.APP = {
  get currentHundId() { return _currentHundId; },
  set currentHundId(v) { _currentHundId = v; },
  onLogin,
};

// ════════════════════════════════════════════════════════════════
//  GLOBALER ZUSTAND
// ════════════════════════════════════════════════════════════════

let _currentHundId = 1;

// ════════════════════════════════════════════════════════════════
//  INITIALISIERUNG
// ════════════════════════════════════════════════════════════════

async function init() {
  UI.showLoader('Hund Manager wird gestartet…');
  CONFIG.load();

  // Setup-Warnung zeigen wenn IDs fehlen
  if (!CONFIG.isConfigured()) {
    document.getElementById('setup-warning').style.display = 'block';
  }

  // Gespeicherten Token prüfen
  if (AUTH.loadSaved()) {
    try {
      await onLogin();
    } catch (e) {
      // Token abgelaufen oder ungültig
      UI.hideLoader();
      document.getElementById('login-screen').style.display = 'flex';
    }
  } else {
    UI.hideLoader();
    document.getElementById('login-screen').style.display = 'flex';
  }
}

// ════════════════════════════════════════════════════════════════
//  NACH LOGIN
// ════════════════════════════════════════════════════════════════

export async function onLogin() {
  UI.showLoader('Stammdaten werden geladen…');

  try {
    await STORE.loadAll();
  } catch (e) {
    console.warn('Stammdaten-Ladefehler:', e.message);
    // Wenn Token abgelaufen: handleExpired() hat bereits Login-Screen gezeigt
    if (!AUTH.isLoggedIn()) return;
  }

  // UI aufbauen
  UI.syncHundSelects();
  RECHNER.initIngredientSelect();
  RECHNER.initCustomNutrGrid();
  UI.populateCategorySelect();

  // i18n: Standard-Übersetzungen laden + Sheet-Daten im Hintergrund
  I18N.loadDefaults();
  I18N.load().then(() => {
    I18N.applyAll();
    // Sprachanzeige in Einstellungen aktualisieren
    const cur = document.getElementById('lang-current');
    const avail = document.getElementById('lang-available');
    if (cur)   cur.textContent   = I18N.getLang();
    if (avail) avail.textContent = `Verfügbar: ${I18N.getAvailableLangs().join(', ') || 'de'}`;
  }).catch(() => {/* Sheet noch nicht vorhanden – kein Fehler */});

  // Ersten Hund vorauswählen
  const hunde = STORE.getHunde();
  if (hunde.length) {
    _currentHundId = hunde[0].hund_id;
    const frSel = document.getElementById('fr-hund-select');
    const tbSel = document.getElementById('tb-hund-select');
    if (frSel) frSel.value = _currentHundId;
    if (tbSel) tbSel.value = _currentHundId;
  }

  // Gewicht & Kalorienbedarf initialisieren
  RECHNER.updateWeight();

  // Standarddaten setzen
  ['u-datum','s-datum','f-datum','t-datum','m-von'].forEach(id => UI.setToday(id));

  // Gespeichertes Raumklima wiederherstellen
  try {
    const rk = localStorage.getItem('hundapp_raumklima');
    if (rk) {
      const [t, h] = rk.split('|');
      const rt = document.getElementById('u-raumtemp');
      const rh = document.getElementById('u-raumfeuchtig');
      if (rt) rt.value = t || '';
      if (rh) rh.value = h || '';
    }
  } catch (e) { /* ignore */ }

  // Bett-Standard setzen
  document.getElementById('bett-unchanged')?.classList.add('sel');

  // Wetter & Pollen laden (leicht verzögert damit UI sichtbar ist)
  setTimeout(() => WETTER.loadAll(), 500);

  // Rezeptliste laden
  setTimeout(() => RECHNER.loadRecipeList(), 800);

  // Tagebuch-Cache im Hintergrund vorladen (nach 2s damit Login-UI zuerst reagiert)
  setTimeout(() => CACHE.preloadAll(), 2000);

  // App einblenden
  UI.hideLoader();
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('main-screen').style.display   = 'block';
  document.getElementById('top-nav').style.display       = 'flex';
}

// ════════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════════

window.addEventListener('load', init);
