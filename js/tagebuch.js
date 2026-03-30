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
