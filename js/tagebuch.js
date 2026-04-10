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
import { getRezepte, getRezeptZutaten, getNutrMap,
         getParameter, getZutaten }        from './store.js';

// ── Futter-Tab Zustand ────────────────────────────────────────────
// Jede Position: { rezeptId, rezeptName, gramm, kcal, components }
let _futterItems = [];

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

/**
 * Erzeugt die 4 Pflicht-Metafelder die jede neue Tagebuchzeile bekommt.
 * Reihenfolge: entry_id, created_at, deleted, deleted_at
 *
 * entry_id: YYYYMMDDHHmmSS_xxxx  (Zeitstempel + 4 Zufallszeichen)
 *           Eindeutig genug für Soft-Delete / Undo ohne echte UUID-Bibliothek.
 *
 * @returns {[string, string, string, string]}
 */
function _meta() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts  = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}` +
              `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const eid = ts + '_' + Math.random().toString(36).slice(2, 6);
  const iso = now.toISOString().slice(0, 19);
  return [eid, iso, 'FALSE', ''];
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten L–O)
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten H–K)
    ], getCfg().tagebuchId);

    setStatus('status-s', 'ok', '✓ Gespeichert!');
    clear('s-beschreibung','s-notizen','s-kat-extra','s-koerper-extra');
    resetAll();
    setToday('s-datum');
  } catch (e) { setStatus('status-s', 'err', 'Fehler: ' + e.message); }
  unlock('btn-s');
}

/** 🥩 Futter-Position hinzufügen (UI-Aktion) */
export function addFutterItem() {
  _futterItems.push({ rezeptId: null, rezeptName: '', gramm: 0, kcal: 0, portionen: 1, components: [] });
  renderFutterItems();
}

/** Futter-Position entfernen */
export function removeFutterItem(idx) {
  _futterItems.splice(idx, 1);
  renderFutterItems();
}

/** Rezept für eine Position wechseln */
export function futterItemRezeptChanged(idx) {
  const sel = document.getElementById(`fi-rezept-${idx}`);
  const val = parseInt(sel?.value);
  if (!val) {
    _futterItems[idx] = { rezeptId: null, rezeptName: '', gramm: _futterItems[idx]?.gramm||0, kcal: 0, portionen: 1, components: [] };
  } else {
    const zutaten = getRezeptZutaten(val);
    const rzp = getRezepte().find(r => r.rezept_id === val);
    const baseGramm = zutaten.reduce((s, c) => s + (c.gramm || 0), 0);
    const portionen = _futterItems[idx]?.portionen || 1;
    _futterItems[idx] = {
      rezeptId: val,
      rezeptName: rzp?.name || '',
      gramm: Math.round(baseGramm * portionen),
      kcal: 0,
      portionen,
      components: zutaten,
      baseGramm,
    };
  }
  // Gramm-Input synchronisieren
  const grammInp = document.getElementById(`fi-gramm-${idx}`);
  if (grammInp) grammInp.value = _futterItems[idx].gramm || '';
  futterItemGrammChanged(idx);
}

/** Portionen für eine Position ändern → Gramm automatisch berechnen */
export function futterItemPortionenChanged(idx) {
  const inp = document.getElementById(`fi-portionen-${idx}`);
  const portionen = parseFloat(inp?.value) || 1;
  const item = _futterItems[idx];
  if (!item) return;
  item.portionen = portionen;
  if (item.rezeptId && item.baseGramm > 0) {
    item.gramm = Math.round(item.baseGramm * portionen);
    const grammInp = document.getElementById(`fi-gramm-${idx}`);
    if (grammInp) grammInp.value = item.gramm;
  }
  futterItemGrammChanged(idx);
}

/** Gramm für eine Position ändern */
export function futterItemGrammChanged(idx) {
  const inp = document.getElementById(`fi-gramm-${idx}`);
  const gramm = parseFloat(inp?.value) || 0;
  const item = _futterItems[idx];
  if (!item) return;
  item.gramm = gramm;

  // Kcal berechnen wenn Rezept gewählt
  // Priorität: gespeicherter Energie-Nährwert > Makro-Formel (konsistent mit rechner.js)
  // Kochverlustfaktor NICHT auf Makronährstoffe anwenden.
  if (item.rezeptId && item.components.length) {
    const params    = getParameter();
    const kProt     = parseFloat(String(params['kcal_faktor_protein'] || '3.5').replace(',','.')) || 3.5;
    const kFett     = parseFloat(String(params['kcal_faktor_fett']    || '8.5').replace(',','.')) || 8.5;
    const totalBase = item.components.reduce((s, c) => s + c.gramm, 0);
    let kcalBase = 0;
    let hasEnergie = false;
    item.components.forEach(c => {
      const nm = getNutrMap(c.zutaten_id, c.zutat_name);
      if ((nm['Energie'] || 0) > 0) {
        kcalBase += nm['Energie'] * c.gramm / 100;
        hasEnergie = true;
      } else {
        kcalBase += ((nm['Rohprotein']||0) * kProt + (nm['Fett']||0) * kFett) * c.gramm / 100;
      }
    });
    const scale = totalBase > 0 ? gramm / totalBase : 0;
    item.kcal   = Math.round(kcalBase * scale);
  } else {
    item.kcal = 0;
  }

  renderFutterItems();
}

/** Futter-Positionen-Liste neu rendern */
export function renderFutterItems() {
  const container = document.getElementById('f-items-container');
  if (!container) return;

  const rezepte = getRezepte(getHundId());
  const totalKcal = _futterItems.reduce((s, i) => s + i.kcal, 0);
  const totalG    = _futterItems.reduce((s, i) => s + i.gramm, 0);

  let html = '';
  _futterItems.forEach((item, idx) => {
    const baseGramm = item.baseGramm || (item.components.reduce((s,c)=>s+c.gramm,0)) || 0;
    html += `<div style="background:var(--bg2);border:1px solid var(--border);
      border-radius:var(--radius);padding:10px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px">
        <select id="fi-rezept-${idx}" onchange="TAGEBUCH.futterItemRezeptChanged(${idx})"
          style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);
            background:var(--bg);color:var(--text);font-family:inherit;font-size:13px">
          <option value="">— Rezept wählen —</option>
          ${rezepte.map(r => `<option value="${r.rezept_id}" ${item.rezeptId===r.rezept_id?'selected':''}>${r.name}</option>`).join('')}
        </select>
        <button onclick="TAGEBUCH.removeFutterItem(${idx})"
          style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);
            background:var(--bg);color:var(--danger-text,#e76f51);cursor:pointer;font-size:14px">✕</button>
      </div>
      ${item.rezeptId ? `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--sub);margin-bottom:3px">Portionen</div>
          <input type="number" id="fi-portionen-${idx}" value="${item.portionen||1}" placeholder="1"
            min="0.25" step="0.25" inputmode="decimal"
            onchange="TAGEBUCH.futterItemPortionenChanged(${idx})"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);
              background:var(--bg);color:var(--text);font-family:inherit;font-size:13px;text-align:center">
        </div>
        <div style="flex:1">
          <div style="font-size:11px;color:var(--sub);margin-bottom:3px">Gramm${baseGramm>0?` (Basis: ${baseGramm}g)`:''}</div>
          <input type="number" id="fi-gramm-${idx}" value="${item.gramm||''}" placeholder="g"
            min="0" step="1" inputmode="decimal"
            onchange="TAGEBUCH.futterItemGrammChanged(${idx})"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);
              background:var(--bg);color:var(--text);font-family:inherit;font-size:13px;text-align:center">
        </div>
      </div>` : `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--sub);margin-bottom:3px">Gramm</div>
          <input type="number" id="fi-gramm-${idx}" value="${item.gramm||''}" placeholder="g"
            min="0" step="1" inputmode="decimal"
            onchange="TAGEBUCH.futterItemGrammChanged(${idx})"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);
              background:var(--bg);color:var(--text);font-family:inherit;font-size:13px;text-align:center">
        </div>
      </div>`}
      ${item.rezeptId && item.gramm > 0 ? `
        <div style="font-size:12px;color:var(--sub);margin-bottom:4px">
          ⚡ ${item.kcal} kcal
          ${item.components.length ? '· ' + item.components
            .filter(c => c.gramm > 0)
            .map(c => {
              const totalBase = item.components.reduce((s,x)=>s+x.gramm,0);
              const scaled = totalBase>0 ? Math.round(c.gramm * item.gramm / totalBase) : 0;
              return `${c.zutat_name}: ${scaled}g`;
            }).join(', ') : ''}
        </div>` : ''}
    </div>`;
  });

  html += `<button onclick="TAGEBUCH.addFutterItem()"
    style="width:100%;padding:9px;border:1px dashed var(--border);border-radius:var(--radius-sm);
      background:transparent;color:var(--sub);cursor:pointer;font-family:inherit;font-size:13px">
    + Futter / Rezept hinzufügen
  </button>`;

  if (_futterItems.length > 0) {
    html += `<div style="margin-top:8px;padding:8px 10px;background:var(--bg);
      border:1px solid var(--border);border-radius:var(--radius-sm);
      font-size:13px;font-weight:600">
      Gesamt: ${totalG}g · ${totalKcal} kcal
    </div>`;
  }

  container.innerHTML = html;
}

/** Futter-Eintrag als formatierten Text zusammenbauen */
function _buildFutterText() {
  if (!_futterItems.length) return '';
  const totalKcal = _futterItems.reduce((s,i) => s + i.kcal, 0);
  const totalG    = _futterItems.reduce((s,i) => s + i.gramm, 0);
  const lines = [`Gesamt: ${totalG}g, ${totalKcal} kcal`];
  _futterItems.forEach((item, idx) => {
    if (!item.rezeptName && !item.gramm) return;
    let line = `Futter ${idx+1}: ${item.rezeptName || 'Freitext'} (${item.gramm}g, ${item.kcal} kcal)`;
    if (item.components.length) {
      const totalBase = item.components.reduce((s,c)=>s+c.gramm, 0);
      const parts = item.components
        .filter(c => c.gramm > 0)
        .map(c => {
          const scaled = totalBase>0 ? Math.round(c.gramm * item.gramm / totalBase) : 0;
          return `${c.zutat_name}: ${scaled}g`;
        });
      if (parts.length) line += ' | ' + parts.join(', ');
    }
    lines.push(line);
  });
  // Freitext anhängen falls vorhanden
  const freitext = document.getElementById('f-futter-text')?.value.trim();
  if (freitext) lines.push(freitext);
  return lines.join('\n');
}

/** 🥩 Futter-Eintrag speichern */
export async function submitFutter() {
  const datum = document.getElementById('f-datum').value;
  if (!datum) { setStatus('status-f', 'err', 'Bitte Datum auswählen.'); return; }

  const futterText = _buildFutterText();
  const freitext   = document.getElementById('f-futter-text')?.value.trim();
  const futter     = futterText || freitext;
  if (!futter) { setStatus('status-f', 'err', 'Bitte mindestens ein Futter hinzufügen.'); return; }

  lock('btn-f');
  setStatus('status-f', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Futtertagebuch', [
      getHundId(), fd(datum), futter,
      document.getElementById('f-produkt').value,
      getErsteGabe(), getZweiWo(), getProv(),
      document.getElementById('f-beschreibung').value,
      document.getElementById('f-notizen').value,
      ..._meta(),
    ], getCfg().tagebuchId);

    setStatus('status-f', 'ok', '✓ Gespeichert!');
    _futterItems = [];
    renderFutterItems();
    clear('f-beschreibung','f-notizen','f-futter-text','f-produkt');
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten I–L)
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten G–J)
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten I–L)
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
      ..._meta(),  // entry_id, created_at, deleted, deleted_at  (Spalten J–M)
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
  // Futter-Items-Container initialisieren wenn noch nicht geschehen
  renderFutterItems();
}

/** Alias für Hund-Wechsel */
export function onHundChangedFutter() {
  _futterItems = [];
  renderFutterItems();
}

/** Legacy - nicht mehr genutzt, bleibt für Kompatibilität */
export function futterRezeptChanged() {}

// ════════════════════════════════════════════════════════════════
//  AUSSCHLUSS-PHASEN (Idee 6 – v1.5.0)
// ════════════════════════════════════════════════════════════════

/** Standard-Laufzeiten je Phasentyp in Tagen */
const PHASEN_DEFAULTS = { elimination: 42, provokation: 14, ergebnis: 7 };

/** Formular-Datum vorbelegen + Enddatum-Vorschlag berechnen */
export function onPhasTypChanged() {
  const typ     = document.getElementById('ph-typ')?.value;
  const startEl = document.getElementById('ph-start');
  const endEl   = document.getElementById('ph-end');
  if (!typ || !startEl || !endEl) return;

  const days = PHASEN_DEFAULTS[typ] || 14;
  const start = startEl.value ? new Date(startEl.value) : new Date();
  const end   = new Date(start);
  end.setDate(end.getDate() + days);
  endEl.value = end.toISOString().slice(0, 10);

  // Zutat-Feld nur bei Provokation einblenden
  const zutatRow = document.getElementById('ph-zutat-row');
  if (zutatRow) zutatRow.style.display = typ === 'provokation' ? '' : 'none';
}

/** Startdatum geändert → Enddatum neu vorschlagen */
export function onPhasStartChanged() {
  const typ   = document.getElementById('ph-typ')?.value;
  const start = document.getElementById('ph-start')?.value;
  const endEl = document.getElementById('ph-end');
  if (!start || !endEl) return;
  const days  = PHASEN_DEFAULTS[typ] || 14;
  const end   = new Date(start);
  end.setDate(end.getDate() + days);
  endEl.value = end.toISOString().slice(0, 10);
}

/** Phase speichern → Ausschluss_Phasen Sheet */
export async function submitPhase() {
  const { get: getCfg } = await import('./config.js');
  const { readSheet, appendRow } = await import('./sheets.js');
  const hundId  = getHundId();
  const typ     = document.getElementById('ph-typ')?.value;
  const zutat   = document.getElementById('ph-zutat')?.value.trim() || '';
  const start   = document.getElementById('ph-start')?.value;
  const end     = document.getElementById('ph-end')?.value;
  const ergebnis= document.getElementById('ph-ergebnis')?.value || 'offen';
  const notizen = document.getElementById('ph-notizen')?.value.trim() || '';

  if (!typ)   { setStatus('status-ph', 'err', 'Bitte Phasentyp wählen.'); return; }
  if (!start) { setStatus('status-ph', 'err', 'Bitte Startdatum angeben.'); return; }
  if (!end)   { setStatus('status-ph', 'err', 'Bitte Enddatum angeben.'); return; }
  if (typ === 'provokation' && !zutat) { setStatus('status-ph', 'err', 'Bitte Zutat für Provokation angeben.'); return; }

  const fmt = iso => { if (!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}`; };
  const now = new Date().toISOString().slice(0,19);
  const tid = getCfg().tagebuchId;
  lock('btn-ph');
  setStatus('status-ph', 'loading', 'Wird gespeichert…');
  try {
    const rows = await readSheet('Ausschluss_Phasen', tid);
    const ids  = rows.slice(2).map(r => parseInt(r[0])||0).filter(Boolean);
    const newId = ids.length ? Math.max(...ids)+1 : 1;
    await appendRow('Ausschluss_Phasen', [
      newId, hundId, typ, zutat, fmt(start), fmt(end), ergebnis, notizen, now, 'FALSE', ''
    ], tid);
    setStatus('status-ph', 'ok', '✓ Phase gespeichert!');
    clear('ph-zutat','ph-notizen');
    setTimeout(() => { renderPhasenBanner(); }, 800);
  } catch(e) { setStatus('status-ph', 'err', 'Fehler: '+e.message); }
  unlock('btn-ph');
}

/** Undo-Stack für Phasen-Löschungen */
const _phasUndoStack = [];

/** Phase soft-löschen */
export async function deletePhase(entryId, label) {
  if (!confirm(`Phase „${label}" löschen?\n\nKann über Rückgängig wiederhergestellt werden.`)) return;
  const { get: getCfg } = await import('./config.js');
  const { readSheet, writeRange } = await import('./sheets.js');
  const tid = getCfg().tagebuchId;
  try {
    const rows = await readSheet('Ausschluss_Phasen', tid);
    const idx  = rows.findIndex(r => String(r[0]).trim() === String(entryId));
    if (idx < 0) { alert('Phase nicht gefunden.'); return; }
    const now = new Date().toISOString().slice(0,19);
    await writeRange('Ausschluss_Phasen', `J${idx+1}:K${idx+1}`, [['TRUE', now]], tid);
    _phasUndoStack.unshift({ entryId, sheetRow: idx+1, label, deleted_at: now });
    if (_phasUndoStack.length > 5) _phasUndoStack.pop();
    _showPhasUndoBanner(label);
    renderPhasenBanner();
    loadPhasenListe();
  } catch(e) { alert('Fehler: '+e.message); }
}

/** Phase-Löschung rückgängig */
export async function undoDeletePhase() {
  const entry = _phasUndoStack[0]; if (!entry) return;
  const { get: getCfg } = await import('./config.js');
  const { writeRange }  = await import('./sheets.js');
  const tid = getCfg().tagebuchId;
  try {
    await writeRange('Ausschluss_Phasen', `J${entry.sheetRow}:K${entry.sheetRow}`, [['FALSE','']], tid);
    _phasUndoStack.shift();
    document.getElementById('phas-undo-banner')?.remove();
    renderPhasenBanner();
    loadPhasenListe();
  } catch(e) { alert('Fehler: '+e.message); }
}

function _showPhasUndoBanner(label) {
  document.getElementById('phas-undo-banner')?.remove();
  const el = document.createElement('div');
  el.id = 'phas-undo-banner';
  el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--text);color:var(--bg);padding:10px 16px;border-radius:var(--radius);
    font-size:13px;font-weight:600;z-index:9999;display:flex;align-items:center;gap:12px;
    box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap;`;
  el.innerHTML = `<span>„${label}" gelöscht</span>
    <button onclick="TAGEBUCH.undoDeletePhase()"
      style="padding:5px 10px;font-size:12px;border:none;border-radius:4px;
        background:var(--c2);color:#fff;cursor:pointer;font-family:inherit;font-weight:700">
      ↺ Rückgängig
    </button>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

/** Aktive-Phase-Banner oberhalb der Ausschluss-Ansicht rendern */
export async function renderPhasenBanner() {
  const el = document.getElementById('phasen-banner');
  if (!el) return;
  const { get: getCfg } = await import('./config.js');
  const { readSheet }   = await import('./sheets.js');
  const hundId = getHundId();
  try {
    const rows   = await readSheet('Ausschluss_Phasen', getCfg().tagebuchId);
    const phasen = rows.slice(2)
      .filter(r => r?.some(v => String(v).trim()))
      .filter(r => String(r[9]).toUpperCase() !== 'TRUE')
      .filter(r => String(r[1]).trim() === String(hundId))
      .map(r => ({
        id:      String(r[0]).trim(),
        typ:     String(r[2]||'').trim(),
        zutat:   String(r[3]||'').trim(),
        start:   String(r[4]||'').trim(),
        end:     String(r[5]||'').trim(),
        ergebnis:String(r[6]||'offen').trim(),
        notizen: String(r[7]||'').trim(),
      }));

    const parseDE = s => { if(!s) return null; const[d,m,y]=s.split('.'); return new Date(+y,+m-1,+d); };
    const today   = new Date(); today.setHours(0,0,0,0);

    // Aktive Phase = Enddatum in der Zukunft + Ergebnis = offen
    const active = phasen.find(p => {
      const end = parseDE(p.end);
      return end && end >= today && p.ergebnis === 'offen';
    });

    if (!active) { el.innerHTML = ''; return; }

    const startD    = parseDE(active.start);
    const endD      = parseDE(active.end);
    const total     = Math.max(1, Math.round((endD - startD) / 86400000));
    const elapsed   = Math.max(0, Math.round((today - startD) / 86400000));
    const remaining = Math.max(0, Math.round((endD - today) / 86400000));
    const pct       = Math.min(100, Math.round(elapsed / total * 100));

    const COLORS = { elimination:'var(--c2)', provokation:'#f59e0b', ergebnis:'var(--bar-ok)' };
    const LABELS = { elimination:'🔵 Elimination', provokation:'🟡 Provokation', ergebnis:'✅ Ergebnis' };
    const color  = COLORS[active.typ] || 'var(--c2)';
    const label  = LABELS[active.typ] || active.typ;
    const zutatStr = active.zutat ? ` · ${active.zutat}` : '';

    // Letzter Ausschluss-Status
    const lastStatus = phasen.filter(p => p.ergebnis !== 'offen').slice(-1)[0];
    const lastHtml   = lastStatus
      ? `<div style="font-size:11px;color:var(--sub);margin-top:6px">
           Letzte abgeschlossene Phase: <strong>${LABELS[lastStatus.typ]||lastStatus.typ}</strong>
           – ${lastStatus.ergebnis === 'verträglich'
               ? '<span style="color:var(--bar-ok)">✅ verträglich</span>'
               : lastStatus.ergebnis === 'reaktion'
               ? '<span style="color:var(--danger-text)">❌ Reaktion</span>'
               : lastStatus.ergebnis}
           ${lastStatus.zutat ? '(' + lastStatus.zutat + ')' : ''}
         </div>`
      : '';

    el.innerHTML = `
      <div style="background:var(--bg2);border:2px solid ${color};border-radius:var(--radius);
        padding:12px 14px;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:${color}">${label}${zutatStr}</div>
          <div style="font-size:12px;color:var(--sub)">noch <strong>${remaining}</strong> Tage</div>
        </div>
        <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden;margin-bottom:4px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .3s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--sub)">
          <span>${active.start}</span>
          <span>${elapsed} / ${total} Tage (${pct}%)</span>
          <span>${active.end}</span>
        </div>
        ${lastHtml}
      </div>`;
  } catch(e) { el.innerHTML = ''; }
}

/** Phasenliste (unter dem Formular) rendern */
export async function loadPhasenListe() {
  const el = document.getElementById('phasen-liste');
  if (!el) return;
  el.innerHTML = '<div class="view-loading"><div class="spinner"></div></div>';
  const { get: getCfg } = await import('./config.js');
  const { readSheet }   = await import('./sheets.js');
  const hundId = getHundId();
  try {
    const rows   = await readSheet('Ausschluss_Phasen', getCfg().tagebuchId);
    const phasen = rows.slice(2)
      .filter(r => r?.some(v => String(v).trim()))
      .filter(r => String(r[9]).toUpperCase() !== 'TRUE')
      .filter(r => String(r[1]).trim() === String(hundId))
      .map(r => ({
        id:      String(r[0]).trim(),
        typ:     String(r[2]||'').trim(),
        zutat:   String(r[3]||'').trim(),
        start:   String(r[4]||'').trim(),
        end:     String(r[5]||'').trim(),
        ergebnis:String(r[6]||'offen').trim(),
        notizen: String(r[7]||'').trim(),
      }))
      .reverse();

    if (!phasen.length) {
      el.innerHTML = '<div class="view-empty" style="padding:1rem"><div class="icon">📅</div>Noch keine Phasen eingetragen.</div>';
      return;
    }
    const BADGE = {
      offen:        '<span class="badge badge-warn">offen</span>',
      verträglich:  '<span class="badge badge-ok">✅ verträglich</span>',
      reaktion:     '<span class="badge badge-bad">❌ Reaktion</span>',
    };
    const TYPBADGE = {
      elimination:  '<span class="badge" style="background:var(--c2);color:#fff;font-size:10px">Elimination</span>',
      provokation:  '<span class="badge" style="background:#f59e0b;color:#fff;font-size:10px">Provokation</span>',
      ergebnis:     '<span class="badge badge-ok" style="font-size:10px">Ergebnis</span>',
    };
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    el.innerHTML = phasen.map(p => `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
              ${TYPBADGE[p.typ]||''}
              ${p.zutat ? `<span style="font-size:13px;font-weight:600">${esc(p.zutat)}</span>` : ''}
              ${BADGE[p.ergebnis]||'<span class="badge">'+esc(p.ergebnis)+'</span>'}
            </div>
            <div style="font-size:12px;color:var(--sub)">
              📅 ${esc(p.start)} → ${esc(p.end)}
              ${p.notizen ? '<br>📝 '+esc(p.notizen) : ''}
            </div>
          </div>
          <button class="del-small-btn" style="flex-shrink:0"
            onclick="TAGEBUCH.deletePhase('${esc(p.id)}','${esc(p.typ+(p.zutat?' – '+p.zutat:''))}')">🗑</button>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${e.message}<br><small>Neues Sheet „Ausschluss_Phasen" noch nicht angelegt? → Einstellungen → „Neue Sheets anlegen"</small></div>`;
  }
}
