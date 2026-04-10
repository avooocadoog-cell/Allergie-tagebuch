/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: form.js                                             ║
 * ║  Hund Manager – Toggle-Button Zustand (Tagebuch-Formulare)   ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Zustand aller .tog-btn Gruppen im Tagebuch               ║
 * ║  - Einzelauswahl (Schweregrad, Allergen-Reaktion, Verdacht)  ║
 * ║  - Mehrfachauswahl (Symptom-Kategorie, Körperstelle)         ║
 * ║  - Einfache Binär-Toggles (Bett, Erste Gabe, Provokation)   ║
 * ║  - Getter für alle Submit-Handler in tagebuch.js             ║
 * ║  - Globaler Reset nach erfolgreichem Speichern               ║
 * ║                                                              ║
 * ║  Abhängigkeiten: keine                                       ║
 * ║  Wird importiert von: tagebuch.js, main.js (für resetAll)    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Interner State ───────────────────────────────────────────────
let bettState      = 'Unverändert';
let ersteGabeState = '';
let zweiWoState    = '';
let provState      = '';
let aVerdState     = '';
let selectedSymKat = [];
let selectedKoerper= [];
let schweregradVal = '';
let alReaktVal     = '';

// ════════════════════════════════════════════════════════════════
//  TOGGLE-HANDLER (werden direkt von HTML onclick aufgerufen)
// ════════════════════════════════════════════════════════════════

/**
 * Bett-Status umschalten (Unverändert / Gewechselt).
 * @param {'Unverändert'|'Gewechselt'} val
 */
export function toggleBett(val) {
  bettState = val;
  document.getElementById('bett-unchanged')?.classList.toggle('sel', val === 'Unverändert');
  document.getElementById('bett-changed')?.classList.toggle('sel',   val === 'Gewechselt');
}

/**
 * Symptom-Kategorie: Mehrfachauswahl.
 * @param {HTMLElement} el - Das angeklickte .tog-btn Element
 */
export function toggleSymKat(el) {
  el.classList.toggle('sel');
  selectedSymKat = Array.from(
    document.querySelectorAll('#sym-kat-grid .tog-btn.sel')
  ).map(b => b.textContent.trim());
}

/**
 * Schweregrad: Einzelauswahl (1–5).
 * @param {HTMLElement} el
 */
export function toggleSchwere(el) {
  document.querySelectorAll('#tab-symptom .tog-btn[data-val]')
    .forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  schweregradVal = el.dataset.val;
}

/**
 * Körperstelle: Mehrfachauswahl.
 * Selector angepasst um robust zu bleiben (5. .field im Symptom-Tab).
 * @param {HTMLElement} el
 */
export function toggleKoerper(el) {
  el.classList.toggle('sel');
  // Alle selektierten Körperstellen im Symptom-Tab sammeln
  selectedKoerper = Array.from(
    document.querySelectorAll('#tab-symptom .field:nth-child(5) .tog-btn.sel')
  ).map(b => b.textContent.trim());
}

/**
 * Allergen-Reaktionsstärke: Einzelauswahl (1–5).
 * @param {HTMLElement} el
 */
export function toggleAlReakt(el) {
  document.querySelectorAll('#tab-allergen .tog-btn[data-val]')
    .forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  alReaktVal = el.dataset.val;
}

/**
 * Erste Gabe (Toggle – zweites Klicken hebt Auswahl auf).
 * @param {'ja'|'nein'} val
 */
export function toggleErsteGabe(val) {
  ersteGabeState = ersteGabeState === val ? '' : val;
  document.getElementById('erstegabe-ja')?.classList.toggle('sel',  ersteGabeState === 'ja');
  document.getElementById('erstegabe-nein')?.classList.toggle('sel', ersteGabeState === 'nein');
}

/**
 * Zwei-Wochen-Fütterung abgeschlossen (Toggle).
 * @param {'ja'|'nein'} val
 */
export function toggleZweiWo(val) {
  zweiWoState = zweiWoState === val ? '' : val;
  document.getElementById('zweiwo-ja')?.classList.toggle('sel',  zweiWoState === 'ja');
  document.getElementById('zweiwo-nein')?.classList.toggle('sel', zweiWoState === 'nein');
}

/**
 * Provokation (Toggle).
 * @param {'ja'|'nein'} val
 */
export function toggleProv(val) {
  provState = provState === val ? '' : val;
  document.getElementById('prov-ja')?.classList.toggle('sel',  provState === 'ja');
  document.getElementById('prov-nein')?.classList.toggle('sel', provState === 'nein');
}

/**
 * Ausschluss-Verdacht (Einzelauswahl 0–3, zweites Klicken hebt auf).
 * 0 = keine Symptome / sicher
 * 1 = leichter Verdacht
 * 2 = mittlere Reaktion
 * 3 = starke Reaktion
 * @param {'0'|'1'|'2'|'3'} val
 */
export function toggleAVerd(val) {
  aVerdState = aVerdState === val ? '' : val;
  ['0','1','2','3'].forEach(v => {
    document.getElementById('averd-' + v)?.classList.toggle('sel', aVerdState === v);
  });
}

// ════════════════════════════════════════════════════════════════
//  RESET
// ════════════════════════════════════════════════════════════════

/**
 * Alle Toggle-Zustände zurücksetzen.
 * Wird nach erfolgreichem Speichern aufgerufen.
 * DOM-Klassen werden ebenfalls bereinigt.
 */
export function resetAll() {
  bettState       = 'Unverändert';
  ersteGabeState  = '';
  zweiWoState     = '';
  provState       = '';
  aVerdState      = '';
  selectedSymKat  = [];
  selectedKoerper = [];
  schweregradVal  = '';
  alReaktVal      = '';

  document.querySelectorAll('.tog-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('bett-unchanged')?.classList.add('sel');
}

// ════════════════════════════════════════════════════════════════
//  GETTER (für tagebuch.js Submit-Handler)
// ════════════════════════════════════════════════════════════════

/** @returns {'Unverändert'|'Gewechselt'} */
export function getBett()        { return bettState; }

/** @returns {'Ja'|'Nein'} */
export function getErsteGabe()   { return ersteGabeState === 'ja' ? 'Ja' : 'Nein'; }

/** @returns {'Ja'|'Nein'} */
export function getZweiWo()      { return zweiWoState   === 'ja' ? 'Ja' : 'Nein'; }

/** @returns {'Ja'|'Nein'} */
export function getProv()        { return provState      === 'ja' ? 'Ja' : 'Nein'; }

/** @returns {number|''} */
export function getAVerd()       { return aVerdState ? parseInt(aVerdState) : ''; }

/**
 * Symptom-Kategorien als kommaseparierter String.
 * @param {string} extra - Freitextfeld-Wert
 */
export function getSymKat(extra) {
  return [...selectedSymKat, extra].filter(Boolean).join(', ');
}

/**
 * Körperstellen als kommaseparierter String.
 * @param {string} extra - Freitextfeld-Wert
 */
export function getKoerper(extra) {
  return [...selectedKoerper, extra].filter(Boolean).join(', ');
}

/** @returns {string} Schweregrad-Wert '1'–'5' oder '' */
export function getSchwere()    { return schweregradVal; }

/** @returns {string} Reaktionsstärke '1'–'5' oder '' */
export function getAlReakt()    { return alReaktVal; }
