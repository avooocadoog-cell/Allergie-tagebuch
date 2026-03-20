/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: tagebuch.js                                         ║
 * ║  Hund Manager – Tagebuch Schreib-Operationen                 ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Submit-Handler für alle 7 Tagebuch-Typen                  ║
 * ║  - Schreibt in Hund_Tagebuch Spreadsheet                     ║
 * ║  - Rezept-Dropdown im Futter-Tab laden                       ║
 * ║                                                              ║
 * ║  Sheet-Spalten (je Typ):                                     ║
 * ║  Umwelt:      hund_id, datum, temp_min, temp_max,            ║
 * ║               luftfeuchtig, regen, pollen, raumtemp,         ║
 * ║               raumfeuchtig, bett, notizen                    ║
 * ║  Symptome:    hund_id, datum, kategorie, beschreibung,       ║
 * ║               schweregrad, koerperstelle, notizen            ║
 * ║  Futter:      hund_id, datum, futter, produkt,               ║
 * ║               erstegabe, zweiwo, provokation,                ║
 * ║               beschreibung, notizen                          ║
 * ║  Ausschluss:  hund_id, zutat, verdacht, kategorie,           ║
 * ║               status, datum, reaktion, notizen               ║
 * ║  Allergene:   hund_id, allergen, kategorie, reaktion,        ║
 * ║               symptome, notizen                              ║
 * ║  Tierarzt:    hund_id, datum, arzt, anlass,                  ║
 * ║               untersuchungen, ergebnis, therapie, folge      ║
 * ║  Medikamente: hund_id, name, typ, dosierung, haeufigkeit,    ║
 * ║               von, bis, verordnet, notizen                   ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js, ui.js, form.js,       ║
 * ║    store.js                                                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { appendRow }       from './sheets.js';
import { get as getCfg }   from './config.js';
import { setStatus, formatDate, setToday } from './ui.js';
import { getBett, getErsteGabe, getZweiWo, getProv,
         getAVerd, getSymKat, getKoerper, getSchwere,
         getAlReakt, resetAll }  from './form.js';
import { getRezepte, getRezeptZutaten } from './store.js';

// ── Hilfsfunktionen ──────────────────────────────────────────────

/** Aktuell gewählte Hund-ID aus Dropdown */
function getHundId() {
  return parseInt(document.getElementById('tb-hund-select')?.value) || 1;
}

/** ISO-Datum → DD.MM.YYYY */
const fd = formatDate;

/** Button deaktivieren während Speichern */
function lock(btnId)   { const b = document.getElementById(btnId); if (b) b.disabled = true; }
function unlock(btnId) { const b = document.getElementById(btnId); if (b) b.disabled = false; }

/** Felder leeren */
function clear(...ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ════════════════════════════════════════════════════════════════
//  SUBMIT HANDLER
// ════════════════════════════════════════════════════════════════

/** 🌿 Umwelt-Eintrag speichern */
export async function submitUmwelt() {
  const datum = document.getElementById('u-datum').value;
  if (!datum) { setStatus('status-u', 'err', 'Bitte Datum auswählen.'); return; }
  lock('btn-u');
  setStatus('status-u', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Umweltagebuch', [
      getHundId(), fd(datum),
      document.getElementById('u-temp-min').value,
      document.getElementById('u-temp-max').value,
      document.getElementById('u-luftfeuchtig').value,
      document.getElementById('u-regen').value,
      document.getElementById('u-pollen').value,
      document.getElementById('u-raumtemp').value,
      document.getElementById('u-raumfeuchtig').value,
      getBett(),
      document.getElementById('u-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-u', 'ok', '✓ Gespeichert!');
    // Raumklima für nächsten Start merken
    try {
      localStorage.setItem('hundapp_raumklima',
        document.getElementById('u-raumtemp').value + '|' +
        document.getElementById('u-raumfeuchtig').value);
    } catch (e) { /* ignore */ }
    clear('u-temp-min','u-temp-max','u-luftfeuchtig','u-regen','u-pollen','u-notizen');
  } catch (e) { setStatus('status-u', 'err', 'Fehler: ' + e.message); }
  unlock('btn-u');
}

/** 🔍 Symptom-Eintrag speichern */
export async function submitSymptom() {
  const datum = document.getElementById('s-datum').value;
  if (!datum) { setStatus('status-s', 'err', 'Bitte Datum auswählen.'); return; }
  lock('btn-s');
  setStatus('status-s', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Symptomtagebuch', [
      getHundId(), fd(datum),
      getSymKat(document.getElementById('s-kat-extra').value),
      document.getElementById('s-beschreibung').value,
      getSchwere(),
      getKoerper(document.getElementById('s-koerper-extra').value),
      document.getElementById('s-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-s', 'ok', '✓ Gespeichert!');
    clear('s-beschreibung','s-notizen','s-kat-extra','s-koerper-extra');
    resetAll();
    setToday('s-datum');
  } catch (e) { setStatus('status-s', 'err', 'Fehler: ' + e.message); }
  unlock('btn-s');
}

/** 🥩 Futter-Eintrag speichern */
export async function submitFutter() {
  const datum  = document.getElementById('f-datum').value;
  const futter = document.getElementById('f-futter').value.trim();
  if (!datum)  { setStatus('status-f', 'err', 'Bitte Datum auswählen.'); return; }
  if (!futter) { setStatus('status-f', 'err', 'Bitte Futter eintragen.'); return; }
  lock('btn-f');
  setStatus('status-f', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Futtertagebuch', [
      getHundId(), fd(datum), futter,
      document.getElementById('f-produkt').value,
      getErsteGabe(), getZweiWo(), getProv(),
      document.getElementById('f-beschreibung').value,
      document.getElementById('f-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-f', 'ok', '✓ Gespeichert!');
    clear('f-beschreibung','f-notizen','f-futter','f-produkt');
    resetAll();
  } catch (e) { setStatus('status-f', 'err', 'Fehler: ' + e.message); }
  unlock('btn-f');
}

/** 📋 Ausschluss-Eintrag speichern */
export async function submitAusschluss() {
  const zutat = document.getElementById('a-zutat').value.trim();
  if (!zutat) { setStatus('status-a', 'err', 'Bitte Zutat eingeben.'); return; }
  lock('btn-a');
  setStatus('status-a', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Ausschlussdiät', [
      getHundId(), zutat, getAVerd(),
      document.getElementById('a-kategorie').value,
      document.getElementById('a-status').value,
      fd(document.getElementById('a-datum').value),
      document.getElementById('a-reaktion').value,
      document.getElementById('a-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-a', 'ok', '✓ Gespeichert!');
    clear('a-zutat','a-reaktion','a-notizen');
    resetAll();
  } catch (e) { setStatus('status-a', 'err', 'Fehler: ' + e.message); }
  unlock('btn-a');
}

/** ⚠️ Allergen-Eintrag speichern */
export async function submitAllergen() {
  const allergen = document.getElementById('al-allergen').value.trim();
  if (!allergen) { setStatus('status-al', 'err', 'Bitte Allergen eingeben.'); return; }
  lock('btn-al');
  setStatus('status-al', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Bekannte Allergene', [
      getHundId(), allergen,
      document.getElementById('al-kategorie').value,
      getAlReakt(),
      document.getElementById('al-symptome').value,
      document.getElementById('al-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-al', 'ok', '✓ Gespeichert!');
    clear('al-allergen','al-symptome','al-notizen');
    resetAll();
  } catch (e) { setStatus('status-al', 'err', 'Fehler: ' + e.message); }
  unlock('btn-al');
}

/** 🏥 Tierarzt-Eintrag speichern */
export async function submitTierarzt() {
  const datum = document.getElementById('t-datum').value;
  if (!datum) { setStatus('status-t', 'err', 'Bitte Datum auswählen.'); return; }
  lock('btn-t');
  setStatus('status-t', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Tierarztbesuche', [
      getHundId(), fd(datum),
      document.getElementById('t-arzt').value,
      document.getElementById('t-anlass').value,
      document.getElementById('t-untersuchungen').value,
      document.getElementById('t-ergebnis').value,
      document.getElementById('t-therapie').value,
      fd(document.getElementById('t-folge').value),
    ], getCfg().tagebuchId);

    setStatus('status-t', 'ok', '✓ Gespeichert!');
    clear('t-arzt','t-anlass','t-untersuchungen','t-ergebnis','t-therapie');
    document.getElementById('t-folge').value = '';
  } catch (e) { setStatus('status-t', 'err', 'Fehler: ' + e.message); }
  unlock('btn-t');
}

/** 💊 Medikament-Eintrag speichern */
export async function submitMedikament() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { setStatus('status-m', 'err', 'Bitte Medikament eingeben.'); return; }
  lock('btn-m');
  setStatus('status-m', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Medikamente', [
      getHundId(), name,
      document.getElementById('m-typ').value,
      document.getElementById('m-dosierung').value,
      document.getElementById('m-haeufigkeit').value,
      fd(document.getElementById('m-von').value),
      fd(document.getElementById('m-bis').value),
      document.getElementById('m-verordnet').value,
      document.getElementById('m-notizen').value,
    ], getCfg().tagebuchId);

    setStatus('status-m', 'ok', '✓ Gespeichert!');
    clear('m-name','m-dosierung','m-haeufigkeit','m-verordnet','m-notizen');
    document.getElementById('m-bis').value = '';
  } catch (e) { setStatus('status-m', 'err', 'Fehler: ' + e.message); }
  unlock('btn-m');
}

// ════════════════════════════════════════════════════════════════
//  REZEPT-DROPDOWN (Futter-Tab)
// ════════════════════════════════════════════════════════════════

/** Rezept-Dropdown im Futter-Tab aus STORE befüllen */
export async function loadRezepteDropdown() {
  const sel = document.getElementById('f-rezept-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">⏳ Wird geladen…</option>';
  try {
    const hundId  = getHundId();
    const rezepte = getRezepte(hundId);
    sel.innerHTML = '<option value="">— Gespeichertes Rezept wählen —</option>';
    rezepte.forEach(r => {
      const opt = document.createElement('option');
      opt.value       = r.rezept_id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
    if (!rezepte.length) {
      sel.innerHTML = '<option value="">Noch keine Rezepte gespeichert</option>';
    }
  } catch (e) {
    sel.innerHTML = `<option value="">Fehler: ${e.message}</option>`;
  }
}

/** Rezept auswählen → Zusammensetzung als Text in Futter-Textarea einfügen */
export function futterRezeptChanged() {
  const val = document.getElementById('f-rezept-select')?.value;
  if (!val) return;
  const rezeptId = parseInt(val);
  const textarea = document.getElementById('f-futter');
  const zutaten  = getRezeptZutaten(rezeptId);
  if (zutaten.length) {
    textarea.value = zutaten
      .filter(z => z.gramm > 0)
      .map(z => `${parseFloat(z.gramm.toFixed(1))} g ${z.zutat_name}`)
      .join(', ');
  } else {
    const rezept = getRezepte().find(r => r.rezept_id === rezeptId);
    if (rezept) textarea.value = rezept.name;
  }
}
