/**
 * MODULE: ansicht.js  (Cache-Version)
 * Liest aus cache.js statt direkt von Sheets.
 */

import { getSheet, invalidate } from './cache.js';
import { get as getCfg }        from './config.js';
import { esc, openModal,
         closeModal, setStatus } from './ui.js';
import { writeRange }            from './sheets.js';

const SHEET_MAP = {
  umwelt:      'Umweltagebuch',
  symptom:     'Symptomtagebuch',
  futter:      'Futtertagebuch',
  ausschluss:  'Ausschlussdiät',
  allergen:    'Bekannte Allergene',
  tierarzt:    'Tierarztbesuche',
  medikamente: 'Medikamente',
};

/**
 * 0-basierter Spaltenindex der "deleted"-Spalte je Sheet.
 * Wird erst nach der Sheet-Migration relevant (vorher leer = nicht TRUE = nicht gefiltert).
 */
const DELETED_COL = {
  umwelt:      13,  // Spalte N
  symptom:     9,   // Spalte J
  futter:      11,  // Spalte L
  ausschluss:  10,  // Spalte K
  allergen:    8,   // Spalte I
  tierarzt:    10,  // Spalte K
  medikamente: 11,  // Spalte L
};

/**
 * 0-basierter Spaltenindex der "entry_id"-Spalte je Sheet.
 * Für Undo / Soft-Delete benötigt.
 */
const ENTRY_ID_COL = {
  umwelt:      11,  // Spalte L
  symptom:     7,   // Spalte H
  futter:      9,   // Spalte J
  ausschluss:  8,   // Spalte I
  allergen:    6,   // Spalte G
  tierarzt:    8,   // Spalte I
  medikamente: 9,   // Spalte J
};

/**
 * Letzter 0-basierter Index der beschreibenden Datenspalten (exkl. Metaspalten).
 * writeRange beim Edit schreibt von Spalte A bis einschl. dieser Spalte.
 * Metaspalten (entry_id, created_at, deleted, deleted_at) bleiben unberührt.
 */
const DATA_END_COL = {
  umwelt:      10,  // Spalten A–K  (hund_id…notizen)
  symptom:     6,   // Spalten A–G  (hund_id…notizen)
  futter:      8,   // Spalten A–I  (hund_id…notizen)
  ausschluss:  7,   // Spalten A–H  (hund_id…notizen)
  allergen:    5,   // Spalten A–F  (hund_id…notizen)
  tierarzt:    7,   // Spalten A–H  (hund_id…folge)
  medikamente: 8,   // Spalten A–I  (hund_id…notizen)
};

/**
 * Wird beim Reload geleert. Max. 10 Einträge.
 * Format: { sheetName, rowIndex (1-basiert), originalRow }
 */
const _undoStack = [];
const MAX_UNDO = 10;

export async function load(which, forceRefresh = false) {
  const contentId = `v-${which}-content`;
  const el = document.getElementById(contentId);
  if (!el) return;

  el.innerHTML = '<div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>';

  try {
    const sheet = SHEET_MAP[which];
    const rows  = await getSheet(sheet, 'tagebuch', forceRefresh);
    const delIdx = DELETED_COL[which] ?? -1;

    const dataRows = rows.slice(2).filter(r => {
      if (!r?.some(v => v !== null && v !== undefined && String(v).trim() !== '')) return false;
      // Soft-Delete Filter: Zeile überspringen wenn deleted === 'TRUE'
      // Leere Zelle (alte Einträge vor Migration) = NICHT gelöscht
      if (delIdx >= 0 && String(r[delIdx] ?? '').toUpperCase() === 'TRUE') return false;
      return true;
    });

    if (!dataRows.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📭</div>Noch keine Einträge.</div>';
      return;
    }

    const hundId   = String(parseInt(document.getElementById('tb-hund-select')?.value) || 1);
    const filtered = dataRows.filter(r => !r[0] || String(r[0]) === hundId);

    if (!filtered.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📭</div>Keine Einträge für diesen Hund.</div>';
      return;
    }

    // Cache-Alter anzeigen
    import('./cache.js').then(({ getAge }) => {
      const age = getAge(sheet);
      const ageEl = document.getElementById(`v-${which}-age`);
      if (ageEl && age !== null) {
        ageEl.textContent = age < 60 ? 'gerade geladen' : `vor ${Math.round(age/60)} Min geladen`;
      }
    });

    el.innerHTML = renderRows(which, filtered);
  } catch (e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

const g = (row, i) => (row[i] ?? '').toString().trim();

/**
 * Synthetischen Schlüssel für Zeilen ohne entry_id erzeugen.
 * Format: _SYN_ + encodeURIComponent-Felder getrennt durch ~
 * Für Ausschlussdiät: hund_id|zutat|verdacht|kategorie
 */
function _synKey(r) {
  return '_SYN_' + [g(r,0), g(r,1), g(r,2), g(r,3)].map(encodeURIComponent).join('~');
}

/**
 * Zeile in rows-Array anhand entry_id ODER synthetischem Schlüssel finden.
 * @param {Array[]} rows    - Rohzeilen ab Index 0 (Daten ab Index 2)
 * @param {string}  eid     - entry_id oder _SYN_-Schlüssel
 * @param {number}  eidIdx  - 0-basierter Index der entry_id-Spalte
 */
function _findRow(rows, eid, eidIdx) {
  if (eid.startsWith('_SYN_')) {
    const parts = eid.slice(5).split('~').map(decodeURIComponent);
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (r && g(r,0) === parts[0] && g(r,1) === parts[1] && g(r,2) === parts[2] && g(r,3) === parts[3]) return i;
    }
    return -1;
  }
  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i]?.[eidIdx] ?? '').trim() === eid) return i;
  }
  return -1;
}

function renderRows(which, rows) {
  if (which === 'ausschluss') return renderAusschluss(rows);
  const fns = {
    umwelt: renderUmwelt, symptom: renderSymptom, futter: renderFutter,
    allergen: renderAllergen, tierarzt: renderTierarzt, medikamente: renderMedikamente,
  };
  const fn = fns[which];
  if (!fn) return '';
  // rows sind bereits gefiltert; wir übergeben auch den which-Key für den Delete-Button
  return [...rows].reverse().map(r => fn(r, which)).join('');
}

function row(key, val) {
  return `<div class="ec-row"><span class="ec-key">${key}</span><span class="ec-val">${val}</span></div>`;
}

/** Kleiner "Bearbeiten"-Button für jede Entry-Card */
function editBtn(which, entryId) {
  if (!entryId) return '';
  return `<button
    onclick="ANSICHT.editEntry('${esc(which)}','${esc(entryId)}')"
    title="Eintrag bearbeiten"
    style="float:right;margin-left:4px;padding:3px 8px;font-size:11px;
      border:1px solid var(--border);border-radius:var(--radius-sm);
      background:var(--bg);color:var(--sub);cursor:pointer;font-family:inherit">
    ✏️
  </button>`;
}

/** Kleiner "Löschen"-Button für jede Entry-Card */
function deleteBtn(which, entryId) {
  if (!entryId) return '';
  return `<button
    onclick="ANSICHT.softDelete('${esc(which)}','${esc(entryId)}')"
    title="Eintrag löschen (wiederherstellbar)"
    style="float:right;margin-left:8px;padding:3px 8px;font-size:11px;
      border:1px solid var(--border);border-radius:var(--radius-sm);
      background:var(--bg);color:var(--sub);cursor:pointer;font-family:inherit">
    🗑
  </button>`;
}

function renderUmwelt(r, which) {
  const eid = g(r, 11);  // entry_id Spalte L
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
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

function renderSymptom(r, which) {
  const eid = g(r, 7);  // entry_id Spalte H
  const schwere = parseInt(g(r,4)) || 0;
  const dots = Array.from({length:5}, (_,i) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
      background:${i<schwere?'var(--c2)':'var(--border)'};margin-right:2px"></span>`).join('');
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
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

function renderFutter(r, which) {
  const eid = g(r, 9);  // entry_id Spalte J
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
    <div class="ec-date">📅 ${esc(g(r,1))}${g(r,4)==='Ja'
      ? ' <span class="badge badge-ok" style="margin-left:6px;font-size:11px">Erste Gabe</span>' : ''}</div>
    ${g(r,2) ? row('Futter', esc(g(r,2))) : ''}
    ${g(r,3) ? row('Produkt', esc(g(r,3))) : ''}
    ${g(r,6)==='Ja' ? `<div class="ec-row"><span class="ec-key">Provokation</span>
      <span class="ec-val badge badge-warn">⚠️ Ja</span></div>` : ''}
    ${g(r,7) ? row('Reaktion', esc(g(r,7))) : ''}
    ${g(r,8) ? row('Notizen', esc(g(r,8))) : ''}
  </div>`;
}

const AUSSCHLUSS_VERDACHT_LABEL = {
  '0': '✅ Sicher',
  '1': '🟡 Leichter Verdacht',
  '2': '🟠 Mittlerer Verdacht',
  '3': '🔴 Starke Reaktion',
};
const AUSSCHLUSS_VERDACHT_CLS = { '0':'badge-ok', '1':'badge-warn', '2':'badge-warn', '3':'badge-bad' };

/** Aktiver Verdacht-Filter für Ausschlussdiät (Modul-State) */
let _ausschlussFilter = '';

/** Filter setzen und Ansicht neu rendern (wird von HTML aufgerufen) */
export async function filterAusschluss(val) {
  _ausschlussFilter = val;
  load('ausschluss');
}

function renderAusschluss(rows) {
  const FILTER_OPTS = [
    { val: '', label: 'Alle' },
    { val: '0', label: '✅ Sicher' },
    { val: '1', label: '🟡 Leichter Verdacht' },
    { val: '2', label: '🟠 Mittlerer Verdacht' },
    { val: '3', label: '🔴 Starke Reaktion' },
  ];

  const filtered = _ausschlussFilter === ''
    ? rows
    : rows.filter(r => String(g(r, 2)) === _ausschlussFilter);

  // Filter-Chips
  let html = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">`;
  FILTER_OPTS.forEach(opt => {
    const active = opt.val === _ausschlussFilter;
    const count  = opt.val === '' ? rows.length : rows.filter(r => String(g(r,2)) === opt.val).length;
    html += `<button onclick="ANSICHT.filterAusschluss('${opt.val}')"
      style="padding:5px 11px;border-radius:20px;border:1px solid var(--border);
        font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap;
        background:${active ? 'var(--c2)' : 'var(--bg)'};
        color:${active ? '#fff' : 'var(--text)'};
        font-weight:${active ? '600' : '400'}">
      ${opt.label} <span style="opacity:.7">(${count})</span>
    </button>`;
  });
  html += `</div>`;

  html += `<div class="divider"><span>${filtered.length} Einträge</span></div>`;

  if (!filtered.length) {
    html += `<div style="padding:20px;text-align:center;color:var(--sub);font-size:13px">Keine Einträge für diesen Filter.</div>`;
    return html;
  }

  [...filtered].reverse().forEach(r => {
    const eid    = g(r, 8) || _synKey(r);
    const s      = g(r, 4);
    const sCls   = s.includes('vertr') ? 'badge-ok' : s.includes('Reaktion') || s.toLowerCase().includes('gesperrt') ? 'badge-bad' : 'badge-warn';
    const verd   = String(g(r, 2));
    const vLabel = AUSSCHLUSS_VERDACHT_LABEL[verd] || (verd ? `Stufe ${esc(verd)}` : '');
    const vCls   = AUSSCHLUSS_VERDACHT_CLS[verd] || 'badge-warn';
    html += `<div class="entry-card">
      ${editBtn('ausschluss', eid)}${deleteBtn('ausschluss', eid)}
      <div class="ec-date">${esc(g(r,1))}${g(r,5) ? ' – seit ' + esc(g(r,5)) : ''}</div>
      ${g(r,3) ? `<div class="ec-row"><span class="ec-key">Kategorie</span><span class="ec-val">${esc(g(r,3))}</span></div>` : ''}
      ${s ? `<div class="ec-row"><span class="ec-key">Status</span><span class="ec-val badge ${sCls}">${esc(s)}</span></div>` : ''}
      ${vLabel ? `<div class="ec-row"><span class="ec-key">Verdacht</span><span class="ec-val badge ${vCls}">${vLabel}</span></div>` : ''}
      ${g(r,6) ? row('Reaktion', esc(g(r,6))) : ''}
    </div>`;
  });
  return html;
}

function renderAllergen(r, which) {
  const eid = g(r, 6);  // entry_id Spalte G
  const reakt = parseInt(g(r,3)) || 0;
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
    <div class="ec-date">⚠️ ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Kategorie', esc(g(r,2))) : ''}
    ${reakt   ? row('Reaktion', '●'.repeat(reakt) + ` ${reakt}/5`) : ''}
    ${g(r,4) ? row('Symptome', esc(g(r,4))) : ''}
    ${g(r,5) ? row('Notizen', esc(g(r,5))) : ''}
  </div>`;
}

function renderTierarzt(r, which) {
  const eid = g(r, 8);  // entry_id Spalte I
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
    <div class="ec-date">📅 ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Praxis', esc(g(r,2))) : ''}
    ${g(r,3) ? row('Anlass', esc(g(r,3))) : ''}
    ${g(r,4) ? row('Untersuch.', esc(g(r,4))) : ''}
    ${g(r,5) ? row('Befund', esc(g(r,5))) : ''}
    ${g(r,6) ? row('Therapie', esc(g(r,6))) : ''}
    ${g(r,7) ? `<div class="ec-row"><span class="ec-key">Folgebesuch</span>
      <span class="ec-val badge badge-ok">${esc(g(r,7))}</span></div>` : ''}
  </div>`;
}

function renderMedikamente(r, which) {
  const eid = g(r, 9);  // entry_id Spalte J
  return `<div class="entry-card">
    ${editBtn(which, eid)}${deleteBtn(which, eid)}
    <div class="ec-date">💊 ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Typ', esc(g(r,2))) : ''}
    ${g(r,3) ? row('Dosierung', esc(g(r,3))) : ''}
    ${g(r,4) ? row('Häufigkeit', esc(g(r,4))) : ''}
    ${g(r,5)||g(r,6) ? row('Zeitraum', `${esc(g(r,5))} – ${esc(g(r,6))}`) : ''}
    ${g(r,7) ? row('Verordnet', esc(g(r,7))) : ''}
    ${g(r,8) ? row('Wirkung', esc(g(r,8))) : ''}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  SOFT DELETE & UNDO
// ════════════════════════════════════════════════════════════════

/**
 * Eintrag per Soft-Delete markieren.
 * Setzt deleted=TRUE und deleted_at=ISO-Timestamp in der entsprechenden Sheet-Zeile.
 * Legt Undo-Eintrag im Stack ab.
 *
 * @param {string} which    - Sheet-Key z.B. 'symptom'
 * @param {string} entryId  - entry_id der Zeile
 */
export async function softDelete(which, entryId) {
  if (!entryId) return;
  if (!confirm('Eintrag löschen? (Kann rückgängig gemacht werden)')) return;

  const sheetName = SHEET_MAP[which];
  if (!sheetName) return;

  const delIdx   = DELETED_COL[which];
  const eidIdx   = ENTRY_ID_COL[which];
  if (delIdx === undefined || eidIdx === undefined) {
    alert('Löschen für diesen Tab noch nicht verfügbar (Sheet-Migration ausstehend).');
    return;
  }

  try {
    const { getSheet, invalidate } = await import('./cache.js');
    const rows = await getSheet(sheetName, 'tagebuch', true);

    const rowIndex = _findRow(rows, entryId, eidIdx);

    if (rowIndex < 0) {
      alert('Eintrag nicht gefunden. Bitte Ansicht aktualisieren.');
      return;
    }

    const sheetRow = rowIndex + 1;  // 1-basierter Sheets-Index
    const nowIso   = new Date().toISOString().slice(0, 19);

    // deleted-Spalte und deleted_at-Spalte schreiben
    // Die beiden Spalten liegen nebeneinander: deleted, deleted_at
    const delColLetter = _colLetter(delIdx);
    await writeRange(sheetName, `${delColLetter}${sheetRow}:${_colLetter(delIdx + 1)}${sheetRow}`,
      [['TRUE', nowIso]],
      getCfg().tagebuchId
    );

    // Undo-Stack befüllen (originalRow vor dem Löschen)
    _undoStack.unshift({ which, sheetName, sheetRow, eidIdx, delIdx, entryId, originalRow: [...rows[rowIndex]] });
    if (_undoStack.length > MAX_UNDO) _undoStack.pop();

    // Cache invalidieren und Ansicht neu laden
    invalidate(sheetName, 'tagebuch');
    load(which);

    _showUndoBanner(which);

  } catch (e) {
    alert('Fehler beim Löschen: ' + e.message);
  }
}

/**
 * Letzten Löschvorgang rückgängig machen.
 * Setzt deleted=FALSE und deleted_at='' zurück.
 *
 * @param {string} which  - Sheet-Key (nur zum Neuladen der Ansicht)
 */
export async function undoDelete(which) {
  const entry = _undoStack.find(e => e.which === which) || _undoStack[0];
  if (!entry) return;

  try {
    const delColLetter = _colLetter(entry.delIdx);
    await writeRange(entry.sheetName,
      `${delColLetter}${entry.sheetRow}:${_colLetter(entry.delIdx + 1)}${entry.sheetRow}`,
      [['FALSE', '']],
      getCfg().tagebuchId
    );

    // Aus Stack entfernen
    const idx = _undoStack.indexOf(entry);
    if (idx >= 0) _undoStack.splice(idx, 1);

    // Cache invalidieren und Ansicht neu laden
    const { invalidate } = await import('./cache.js');
    invalidate(entry.sheetName, 'tagebuch');
    load(which || entry.which);

    // Undo-Banner entfernen
    document.getElementById('ansicht-undo-banner')?.remove();

  } catch (e) {
    alert('Fehler beim Wiederherstellen: ' + e.message);
  }
}

// ── Private Helpers ──────────────────────────────────────────────

/** 0-basierter Spaltenindex → Buchstabe (A, B, …, Z, AA, AB, …) */
function _colLetter(idx) {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Undo-Banner einblenden */
function _showUndoBanner(which) {
  document.getElementById('ansicht-undo-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'ansicht-undo-banner';
  banner.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--text);color:var(--bg);
    padding:10px 16px;border-radius:var(--radius);
    font-size:13px;font-weight:600;z-index:9999;
    display:flex;align-items:center;gap:12px;
    box-shadow:0 4px 20px rgba(0,0,0,.3);
  `;
  banner.innerHTML = `
    <span>Eintrag gelöscht</span>
    <button onclick="ANSICHT.undoDelete('${esc(which)}')"
      style="padding:5px 10px;font-size:12px;border:none;border-radius:4px;
        background:var(--c2);color:#fff;cursor:pointer;font-family:inherit;font-weight:700">
      ↺ Rückgängig
    </button>
  `;
  document.body.appendChild(banner);
  // Auto-hide nach 8 Sekunden
  setTimeout(() => banner.remove(), 8000);
}

// ════════════════════════════════════════════════════════════════
//  EINTRAG BEARBEITEN (Edit)
// ════════════════════════════════════════════════════════════════

/**
 * Edit-Modal für einen Tagebuch-Eintrag öffnen.
 * Liest die aktuelle Zeile aus dem Cache und befüllt ein Sheet-spezifisches Formular.
 *
 * @param {string} which    - Sheet-Key, z.B. 'symptom'
 * @param {string} entryId  - entry_id der zu bearbeitenden Zeile
 */
export async function editEntry(which, entryId) {
  if (!entryId) return;

  const sheetName = SHEET_MAP[which];
  const eidIdx    = ENTRY_ID_COL[which];
  if (!sheetName || eidIdx === undefined) return;

  try {
    const rows = await getSheet(sheetName, 'tagebuch', false);

    const rowIndex = _findRow(rows, entryId, eidIdx);

    if (rowIndex < 0) {
      openModal('⚠️ Bearbeiten nicht möglich',
        `<p style="color:var(--sub);font-size:13px">
          Eintrag nicht gefunden. Bitte Ansicht aktualisieren.
        </p>
        <button class="btn-primary" onclick="UI.closeModal()">OK</button>`
      );
      return;
    }

    const r = rows[rowIndex];
    openModal(`✏️ Eintrag bearbeiten`, _buildEditForm(which, r, rowIndex, entryId));

  } catch (e) {
    alert('Fehler beim Laden des Eintrags: ' + e.message);
  }
}

/**
 * Edit-Formular HTML für den jeweiligen Sheet-Typ erzeugen.
 * Befüllt Felder mit dem aktuellen Zeileninhalt.
 *
 * @param {string} which
 * @param {string[]} r        - Aktuelle Zeile (string[])
 * @param {number}   rowIndex - 0-basierter Cache-Index
 * @param {string}   entryId
 */
function _buildEditForm(which, r, rowIndex, entryId) {
  const field = (label, id, val, type = 'text', rows = null) => {
    if (rows) return `
      <div class="field"><label>${label}</label>
        <textarea id="ef-${id}" rows="${rows}" style="width:100%;padding:10px;border:1px solid var(--border);
          border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit;
          font-size:14px;resize:vertical">${esc(val)}</textarea></div>`;
    const isoVal = type === 'date' && val?.includes('.') ? _deDateToIso(val) : val;
    return `
      <div class="field"><label>${label}</label>
        <input type="${type}" id="ef-${id}" value="${esc(isoVal)}"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);
            border-radius:var(--radius-sm);background:var(--bg);color:var(--text);
            font-family:inherit;font-size:14px"></div>`;
  };

  let fields = '';

  if (which === 'umwelt') {
    fields = field('Datum', 'datum', g(r,1), 'date')
           + field('Temp. min (°C)', 'tmin', g(r,2), 'number')
           + field('Temp. max (°C)', 'tmax', g(r,3), 'number')
           + field('Luftfeuchtigkeit (%)', 'feuchtig', g(r,4), 'number')
           + field('Regen (mm)', 'regen', g(r,5), 'number')
           + field('Pollen', 'pollen', g(r,6))
           + field('Raumtemp. (°C)', 'raumtemp', g(r,7), 'number')
           + field('Raumfeuchtigkeit (%)', 'raumfeuchtig', g(r,8), 'number')
           + field('Notizen', 'notizen', g(r,10), 'text', 3);

  } else if (which === 'symptom') {
    fields = field('Datum', 'datum', g(r,1), 'date')
           + field('Kategorie (kommasepariert)', 'kategorie', g(r,2))
           + field('Beschreibung', 'beschreibung', g(r,3), 'text', 3)
           + field('Schweregrad (0–5)', 'schweregrad', g(r,4), 'number')
           + field('Körperstelle', 'koerperstelle', g(r,5))
           + field('Notizen', 'notizen', g(r,6), 'text', 3);

  } else if (which === 'futter') {
    fields = field('Datum', 'datum', g(r,1), 'date')
           + field('Futter', 'futter', g(r,2), 'text', 3)
           + field('Produkt', 'produkt', g(r,3))
           + field('Reaktion / Beschreibung', 'beschreibung', g(r,7), 'text', 3)
           + field('Notizen', 'notizen', g(r,8), 'text', 3);

  } else if (which === 'ausschluss') {
    const verdachtOpts = [
      ['','– wählen –'],['0','0 – Keine Symptome / Sicher'],
      ['1','1 – Leichter Verdacht / Geringe Symptome'],
      ['2','2 – Mittlerer Verdacht'],['3','3 – Starke Reaktion'],
    ].map(([v,l]) => `<option value="${v}" ${g(r,2)==v?'selected':''}>${l}</option>`).join('');

    const katOpts = ['','Fleisch','Fisch','Gemüse','Obst','Getreide','Milchprodukt','Öl / Fett','Supplement','Sonstiges']
      .map(v => `<option value="${v}" ${g(r,3)===v?'selected':''}>${v||'– wählen –'}</option>`).join('');

    const statOpts = ['','Getestet – verträglich','Getestet – Reaktion','In Test','Noch nicht getestet','Gesperrt']
      .map(v => `<option value="${v}" ${g(r,4)===v?'selected':''}>${v||'– wählen –'}</option>`).join('');

    const selStyle = `width:100%;padding:8px;border:1px solid var(--border);
      border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit;font-size:14px`;

    fields = field('Zutat', 'zutat', g(r,1))
           + `<div class="ef-field"><label>Kategorie</label>
               <select id="ef-kategorie" style="${selStyle}">${katOpts}</select></div>`
           + `<div class="ef-field"><label>Verdacht / Reaktion</label>
               <select id="ef-verdacht" style="${selStyle}">${verdachtOpts}</select></div>`
           + `<div class="ef-field"><label>Status</label>
               <select id="ef-status" style="${selStyle}">${statOpts}</select></div>`
           + field('Datum', 'datum', g(r,5), 'date')
           + field('Reaktion', 'reaktion', g(r,6), 'text', 3)
           + field('Notizen', 'notizen', g(r,7), 'text', 3);

  } else if (which === 'allergen') {
    fields = field('Allergen', 'allergen', g(r,1))
           + field('Kategorie', 'kategorie', g(r,2))
           + field('Reaktionsstärke (1–5)', 'reaktion', g(r,3), 'number')
           + field('Symptome', 'symptome', g(r,4), 'text', 3)
           + field('Notizen', 'notizen', g(r,5), 'text', 3);

  } else if (which === 'tierarzt') {
    fields = field('Datum', 'datum', g(r,1), 'date')
           + field('Praxis / Tierarzt', 'arzt', g(r,2))
           + field('Anlass', 'anlass', g(r,3))
           + field('Untersuchungen', 'untersuchungen', g(r,4), 'text', 3)
           + field('Befund / Ergebnis', 'ergebnis', g(r,5), 'text', 3)
           + field('Therapie', 'therapie', g(r,6), 'text', 3)
           + field('Folgebesuch', 'folge', g(r,7), 'date');

  } else if (which === 'medikamente') {
    fields = field('Medikament', 'name', g(r,1))
           + field('Typ', 'typ', g(r,2))
           + field('Dosierung', 'dosierung', g(r,3))
           + field('Häufigkeit', 'haeufigkeit', g(r,4))
           + field('Von', 'von', g(r,5), 'date')
           + field('Bis', 'bis', g(r,6), 'date')
           + field('Verordnet von', 'verordnet', g(r,7))
           + field('Notizen', 'notizen', g(r,8), 'text', 3);
  }

  return `
    ${fields}
    <button class="btn-primary"
      onclick="ANSICHT.saveEdit('${esc(which)}','${esc(entryId)}')">
      💾 Änderungen speichern
    </button>
    <div class="status" id="status-edit"></div>
  `;
}

/**
 * Geänderte Werte aus dem Edit-Formular in das Sheet zurückschreiben.
 * Überschreibt nur die Datenspalten; Metaspalten (entry_id, created_at, deleted, deleted_at)
 * bleiben vollständig unberührt.
 *
 * @param {string} which
 * @param {string} entryId
 */
export async function saveEdit(which, entryId) {
  const sheetName = SHEET_MAP[which];
  const eidIdx    = ENTRY_ID_COL[which];
  const dataEnd   = DATA_END_COL[which];
  if (!sheetName || eidIdx === undefined || dataEnd === undefined) return;

  setStatus('status-edit', 'loading', 'Wird gespeichert…');

  const v = (id) => document.getElementById(`ef-${id}`)?.value?.trim() ?? '';
  const fd = (id) => {  // ISO-Datum → DD.MM.YYYY
    const iso = v(id); if (!iso) return '';
    const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`;
  };

  // Neue Werte in Reihenfolge der Sheet-Spalten (A bis dataEnd, 0-basiert)
  let newValues = [];

  if (which === 'umwelt') {
    // hund_id bleibt – wir lesen aus Cache
    newValues = null; // wird unten befüllt
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const row  = rows.find((r,i) => i >= 2 && String(r[eidIdx]??'').trim() === entryId);
    if (!row) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    newValues = [
      g(row,0), fd('datum'),
      v('tmin'), v('tmax'), v('feuchtig'), v('regen'), v('pollen'),
      v('raumtemp'), v('raumfeuchtig'), g(row,9), v('notizen'),
    ];
  } else if (which === 'symptom') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    newValues = [ g(row,0), fd('datum'), v('kategorie'), v('beschreibung'), v('schweregrad'), v('koerperstelle'), v('notizen') ];
  } else if (which === 'futter') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    newValues = [ g(row,0), fd('datum'), v('futter'), v('produkt'), g(row,4), g(row,5), g(row,6), v('beschreibung'), v('notizen') ];
  } else if (which === 'ausschluss') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    const verdacht = document.getElementById('ef-verdacht')?.value ?? g(row,2);
    newValues = [ g(row,0), v('zutat'), verdacht, v('kategorie'), v('status'), fd('datum'), v('reaktion'), v('notizen') ];
  } else if (which === 'allergen') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    newValues = [ g(row,0), v('allergen'), v('kategorie'), v('reaktion'), v('symptome'), v('notizen') ];
  } else if (which === 'tierarzt') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    newValues = [ g(row,0), fd('datum'), v('arzt'), v('anlass'), v('untersuchungen'), v('ergebnis'), v('therapie'), fd('folge') ];
  } else if (which === 'medikamente') {
    const rows = await getSheet(sheetName, 'tagebuch', false);
    const ri = _findRow(rows, entryId, eidIdx);
    if (ri < 0) { setStatus('status-edit','err','Zeile nicht gefunden.'); return; }
    const row = rows[ri];
    newValues = [ g(row,0), v('name'), v('typ'), v('dosierung'), v('haeufigkeit'), fd('von'), fd('bis'), v('verordnet'), v('notizen') ];
  }

  if (!newValues) { setStatus('status-edit','err','Unbekannter Typ.'); return; }

  try {
    // Zeile im Sheet suchen (mit _findRow für synthetische Keys)
    const allRows = await getSheet(sheetName, 'tagebuch', true);
    const sheetRowIdx = _findRow(allRows, entryId, eidIdx);
    if (sheetRowIdx < 0) { setStatus('status-edit','err','Zeile nicht mehr im Sheet.'); return; }

    const sheetRow    = sheetRowIdx + 1;  // 1-basiert
    const endColLetter = _colLetter(dataEnd);

    // Nur Datenspalten A bis endColLetter schreiben
    await writeRange(sheetName, `A${sheetRow}:${endColLetter}${sheetRow}`,
      [newValues.slice(0, dataEnd + 1)], getCfg().tagebuchId);

    // Cache invalidieren und Ansicht neu laden
    invalidate(sheetName, 'tagebuch');
    setStatus('status-edit', 'ok', '✓ Gespeichert!');
    setTimeout(() => { closeModal(); load(which); }, 800);

  } catch (e) {
    setStatus('status-edit', 'err', 'Fehler: ' + e.message);
  }
}

// Hilfsfunktion: DE-Datum → ISO
function _deDateToIso(de) {
  if (!de || !de.includes('.')) return de;
  const [d, m, y] = de.split('.');
  return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`;
}
