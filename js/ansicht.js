/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: ansicht.js                                          ║
 * ║  Hund Manager – Tagebuch Ansicht (Lesen & Rendern)           ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Einträge aus Hund_Tagebuch lesen                          ║
 * ║  - Nach Hund-ID filtern                                      ║
 * ║  - Einträge als Entry-Cards rendern (HTML)                   ║
 * ║  - Ausschluss-Tab: Kategorieübersicht + Detailliste          ║
 * ║                                                              ║
 * ║  Spalten-Reihenfolge: siehe tagebuch.js                      ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js, ui.js                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet }     from './sheets.js';
import { get as getCfg } from './config.js';
import { esc }           from './ui.js';

// ── Sheet-Name Mapping ───────────────────────────────────────────
// Namen müssen exakt mit den Tabellenblatt-Namen in Hund_Tagebuch übereinstimmen
const SHEET_MAP = {
  umwelt:      'Umweltagebuch',
  symptom:     'Symptomtagebuch',
  futter:      'Futtertagebuch',
  ausschluss:  'Ausschlussdiät',
  allergen:    'Bekannte Allergene',
  tierarzt:    'Tierarztbesuche',
  medikamente: 'Medikamente',
};

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

/**
 * Einträge laden und in Ansicht-Tab rendern.
 * @param {'umwelt'|'symptom'|'futter'|'ausschluss'|'allergen'|'tierarzt'|'medikamente'} which
 */
export async function load(which) {
  const contentId = `v-${which}-content`;
  const el = document.getElementById(contentId);
  if (!el) return;

  el.innerHTML = '<div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>';

  try {
    const sheet = SHEET_MAP[which];
    const rows  = await readSheet(sheet, getCfg().tagebuchId);

    // Header in Zeile 1+2, Daten ab Zeile 3
    const dataRows = rows.slice(2).filter(r =>
      r?.some(v => v !== null && v !== undefined && String(v).trim() !== '')
    );

    if (!dataRows.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📭</div>Noch keine Einträge.</div>';
      return;
    }

    // Nach aktuellem Hund filtern (Spalte 0 = hund_id)
    const hundId   = String(parseInt(document.getElementById('tb-hund-select')?.value) || 1);
    const filtered = dataRows.filter(r => !r[0] || String(r[0]) === hundId);

    if (!filtered.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📭</div>Keine Einträge für diesen Hund.</div>';
      return;
    }

    el.innerHTML = renderRows(which, filtered);
  } catch (e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
//  RENDER-DISPATCHER
// ════════════════════════════════════════════════════════════════

function renderRows(which, rows) {
  if (which === 'ausschluss') return renderAusschluss(rows);

  const fns = {
    umwelt:      renderUmwelt,
    symptom:     renderSymptom,
    futter:      renderFutter,
    allergen:    renderAllergen,
    tierarzt:    renderTierarzt,
    medikamente: renderMedikamente,
  };

  const fn = fns[which];
  return fn ? [...rows].reverse().map(fn).join('') : '';
}

// ── Zelle sicher lesen ───────────────────────────────────────────
const g = (row, i) => (row[i] ?? '').toString().trim();

// ════════════════════════════════════════════════════════════════
//  RENDER-FUNKTIONEN (eine pro Tab-Typ)
// ════════════════════════════════════════════════════════════════

// Spalten: hund_id(0), datum(1), temp_min(2), temp_max(3),
//          luftfeuchtig(4), regen(5), pollen(6),
//          raumtemp(7), raumfeuchtig(8), bett(9), notizen(10)
function renderUmwelt(r) {
  return `<div class="entry-card">
    <div class="ec-date">📅 ${esc(g(r,1))}</div>
    ${g(r,2)||g(r,3) ? row('Temperatur', `${esc(g(r,2))}–${esc(g(r,3))} °C`) : ''}
    ${g(r,4) ? row('Luftfeuchtig.', `${esc(g(r,4))} %`) : ''}
    ${g(r,5) ? row('Regen', `${esc(g(r,5))} mm`) : ''}
    ${g(r,6) ? row('Pollen', esc(g(r,6))) : ''}
    ${g(r,7)||g(r,8) ? row('Raumklima', `${esc(g(r,7))} °C, ${esc(g(r,8))} %`) : ''}
    ${g(r,9) ? row('Bett', esc(g(r,9))) : ''}
    ${g(r,10) ? row('Notizen', esc(g(r,10))) : ''}
  </div>`;
}

// Spalten: hund_id(0), datum(1), kategorie(2), beschreibung(3),
//          schweregrad(4), koerperstelle(5), notizen(6)
function renderSymptom(r) {
  const schwere = parseInt(g(r,4)) || 0;
  const dots = Array.from({length: 5}, (_, i) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
      background:${i < schwere ? 'var(--c2)' : 'var(--border)'};margin-right:2px"></span>`
  ).join('');

  return `<div class="entry-card">
    <div class="ec-date">📅 ${esc(g(r,1))}</div>
    ${g(r,2) ? `<div class="ec-row"><span class="ec-key">Symptom</span>
      <span class="ec-val badge badge-warn">${esc(g(r,2))}</span></div>` : ''}
    ${g(r,3) ? row('Beschreibung', esc(g(r,3))) : ''}
    ${schwere ? `<div class="ec-row"><span class="ec-key">Schweregrad</span>
      <span class="ec-val">${dots} ${schwere}/5</span></div>` : ''}
    ${g(r,5) ? row('Körperstelle', esc(g(r,5))) : ''}
    ${g(r,6) ? row('Notizen', esc(g(r,6))) : ''}
  </div>`;
}

// Spalten: hund_id(0), datum(1), futter(2), produkt(3),
//          erstegabe(4), zweiwo(5), provokation(6), beschreibung(7), notizen(8)
function renderFutter(r) {
  return `<div class="entry-card">
    <div class="ec-date">📅 ${esc(g(r,1))}${
      g(r,4) === 'Ja'
        ? ' <span class="badge badge-ok" style="margin-left:6px;font-size:11px">Erste Gabe</span>'
        : ''}</div>
    ${g(r,2) ? row('Futter', esc(g(r,2))) : ''}
    ${g(r,3) ? row('Produkt', esc(g(r,3))) : ''}
    ${g(r,6) === 'Ja' ? `<div class="ec-row"><span class="ec-key">Provokation</span>
      <span class="ec-val badge badge-warn">⚠️ Ja</span></div>` : ''}
    ${g(r,7) ? row('Reaktion', esc(g(r,7))) : ''}
    ${g(r,8) ? row('Notizen', esc(g(r,8))) : ''}
  </div>`;
}

// Ausschluss: Übersicht nach Kategorien + Detailliste
// Spalten: hund_id(0), zutat(1), verdacht(2), kategorie(3),
//          status(4), datum(5), reaktion(6), notizen(7)
function renderAusschluss(rows) {
  // Kategoriegruppen bauen
  const cats = {};
  rows.forEach(r => {
    const kat = g(r,3) || 'Sonstiges';
    if (!cats[kat]) cats[kat] = [];
    cats[kat].push(r);
  });

  let html = '<div class="divider"><span>Übersicht</span></div>';
  Object.keys(cats).sort().forEach(kat => {
    html += `<div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--sub);text-transform:uppercase;margin-bottom:5px">${esc(kat)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">`;
    cats[kat].forEach(r => {
      const status = g(r,4);
      const cls = statusBadgeClass(status);
      html += `<span class="badge ${cls}">${esc(g(r,1))}</span>`;
    });
    html += '</div></div>';
  });

  html += `<div class="divider"><span>Alle Einträge (${rows.length})</span></div>`;
  rows.forEach(r => { html += renderAusschlussRow(r); });
  return html;
}

function renderAusschlussRow(r) {
  const status = g(r,4);
  const cls    = statusBadgeClass(status);
  return `<div class="entry-card">
    <div class="ec-date">${esc(g(r,1))}${g(r,5) ? ' – seit ' + esc(g(r,5)) : ''}</div>
    ${status ? `<div class="ec-row"><span class="ec-key">Status</span>
      <span class="ec-val badge ${cls}">${esc(status)}</span></div>` : ''}
    ${g(r,2) ? `<div class="ec-row"><span class="ec-key">Verdacht</span>
      <span class="ec-val badge badge-warn">⚠️ Stufe ${esc(g(r,2))}</span></div>` : ''}
    ${g(r,6) ? row('Reaktion', esc(g(r,6))) : ''}
  </div>`;
}

// Spalten: hund_id(0), allergen(1), kategorie(2), reaktion(3),
//          symptome(4), notizen(5)
function renderAllergen(r) {
  const reakt = parseInt(g(r,3)) || 0;
  return `<div class="entry-card">
    <div class="ec-date">⚠️ ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Kategorie', esc(g(r,2))) : ''}
    ${reakt   ? row('Reaktion', '●'.repeat(reakt) + ` ${reakt}/5`) : ''}
    ${g(r,4) ? row('Symptome', esc(g(r,4))) : ''}
    ${g(r,5) ? row('Notizen', esc(g(r,5))) : ''}
  </div>`;
}

// Spalten: hund_id(0), datum(1), arzt(2), anlass(3),
//          untersuchungen(4), ergebnis(5), therapie(6), folge(7)
function renderTierarzt(r) {
  return `<div class="entry-card">
    <div class="ec-date">📅 ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Praxis',     esc(g(r,2))) : ''}
    ${g(r,3) ? row('Anlass',     esc(g(r,3))) : ''}
    ${g(r,4) ? row('Untersuch.', esc(g(r,4))) : ''}
    ${g(r,5) ? row('Befund',     esc(g(r,5))) : ''}
    ${g(r,6) ? row('Therapie',   esc(g(r,6))) : ''}
    ${g(r,7) ? `<div class="ec-row"><span class="ec-key">Folgebesuch</span>
      <span class="ec-val badge badge-ok">${esc(g(r,7))}</span></div>` : ''}
  </div>`;
}

// Spalten: hund_id(0), name(1), typ(2), dosierung(3), haeufigkeit(4),
//          von(5), bis(6), verordnet(7), notizen(8)
function renderMedikamente(r) {
  return `<div class="entry-card">
    <div class="ec-date">💊 ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Typ',        esc(g(r,2))) : ''}
    ${g(r,3) ? row('Dosierung',  esc(g(r,3))) : ''}
    ${g(r,4) ? row('Häufigkeit', esc(g(r,4))) : ''}
    ${g(r,5)||g(r,6) ? row('Zeitraum', `${esc(g(r,5))} – ${esc(g(r,6))}`) : ''}
    ${g(r,7) ? row('Verordnet',  esc(g(r,7))) : ''}
    ${g(r,8) ? row('Wirkung',    esc(g(r,8))) : ''}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

/** Schlüssel-Wert Zeile in Entry-Card */
function row(key, val) {
  return `<div class="ec-row">
    <span class="ec-key">${key}</span>
    <span class="ec-val">${val}</span>
  </div>`;
}

/** CSS-Klasse für Status-Badge (Ausschluss) */
function statusBadgeClass(status) {
  if (status.includes('vertr'))   return 'badge-ok';
  if (status.includes('Reaktion') || status.toLowerCase().includes('gesperrt')) return 'badge-bad';
  return 'badge-warn';
}
