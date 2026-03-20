/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: stammdaten.js                                       ║
 * ║  Hund Manager – CRUD für Stammdaten                          ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Hunde: Anzeigen, Anlegen, Bearbeiten, De-/Aktivieren      ║
 * ║  - Zutaten: Anzeigen, Anlegen                                ║
 * ║  - Parameter: Anzeigen, Bearbeiten (direkt im Sheet)         ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js, ui.js, store.js       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet, writeRange, appendRow } from './sheets.js';
import { get as getCfg }                    from './config.js';
import { openModal, closeModal, setStatus,
         syncHundSelects, esc }             from './ui.js';
import { getHunde, getZutaten, addHund,
         updateHund, addZutat }             from './store.js';

// ── Aktuell geöffneter Tab ───────────────────────────────────────
let currentTab = 'hunde';

export function loadCurrentTab() { loadTab(currentTab); }

export function loadTab(tab) {
  currentTab = tab;
  if (tab === 'hunde')     loadHunde();
  if (tab === 'zutaten')   loadZutaten();
  if (tab === 'parameter') loadParameter();
}

// ════════════════════════════════════════════════════════════════
//  HUNDE
// ════════════════════════════════════════════════════════════════

export function loadHunde() {
  const el    = document.getElementById('sd-hunde-list');
  const hunde = getHunde();
  if (!hunde.length) {
    el.innerHTML = '<div class="view-empty"><div class="icon">🐕</div>Noch keine Hunde angelegt.</div>';
    return;
  }
  el.innerHTML = hunde.map(h => `
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div class="card-title" style="margin-bottom:6px">
            ${esc(h.name)}
            ${h.aktiv === 'nein'
              ? ' <span class="badge badge-warn" style="font-size:11px">inaktiv</span>'
              : ' <span class="badge badge-ok"  style="font-size:11px">aktiv</span>'}
          </div>
          <div style="font-size:13px;color:var(--sub);line-height:1.9">
            ${h.rasse        ? '🐾 ' + esc(h.rasse)        + '<br>' : ''}
            ${h.geburtsdatum ? '🎂 ' + esc(h.geburtsdatum) + '<br>' : ''}
            ${h.geschlecht   ? (h.geschlecht === 'm' ? '♂ männlich' : '♀ weiblich')
                               + (h.kastriert === 'ja' ? ' · kastriert' : '') + '<br>' : ''}
            ${h.notizen      ? '📝 ' + esc(h.notizen) : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="edit-btn" onclick="STAMMDATEN.showHundModal(${h.hund_id})">✏️ Bearbeiten</button>
          <button class="del-small-btn"
            onclick="STAMMDATEN.toggleHundAktiv(${h.hund_id},'${esc(h.name)}','${h.aktiv || 'ja'}')">
            ${h.aktiv === 'nein' ? '✅ Aktivieren' : '🚫 Deaktivieren'}
          </button>
        </div>
      </div>
    </div>`).join('');
}

export function showHundModal(hundId) {
  const hunde  = getHunde();
  const h      = hundId ? (hunde.find(x => x.hund_id === hundId) || {}) : {};
  const isEdit = !!hundId;

  // DD.MM.YYYY → YYYY-MM-DD für input[type=date]
  let gebVal = h.geburtsdatum || '';
  if (gebVal.includes('.')) {
    const [d, m, y] = gebVal.split('.');
    gebVal = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`;
  }

  openModal(isEdit ? `🐕 ${esc(h.name || '')} bearbeiten` : 'Neuen Hund anlegen', `
    <div class="field"><label>Name *</label>
      <input type="text" id="hund-name" value="${esc(h.name || '')}" placeholder="z.B. Milow"></div>
    <div class="field"><label>Rasse</label>
      <input type="text" id="hund-rasse" value="${esc(h.rasse || '')}" placeholder="z.B. Labrador-Mix"></div>
    <div class="field"><label>Geburtsdatum</label>
      <input type="date" id="hund-geb" value="${esc(gebVal)}"></div>
    <div class="field"><label>Geschlecht</label>
      <select id="hund-geschlecht">
        <option value="">– wählen –</option>
        <option value="m" ${h.geschlecht === 'm' ? 'selected' : ''}>♂ männlich</option>
        <option value="w" ${h.geschlecht === 'w' ? 'selected' : ''}>♀ weiblich</option>
      </select></div>
    <div class="field"><label>Kastriert</label>
      <select id="hund-kastriert">
        <option value="nein" ${(h.kastriert || 'nein') === 'nein' ? 'selected' : ''}>Nein</option>
        <option value="ja"   ${h.kastriert === 'ja' ? 'selected' : ''}>Ja</option>
      </select></div>
    <div class="field"><label>Status</label>
      <select id="hund-aktiv">
        <option value="ja"   ${(h.aktiv || 'ja') === 'ja' ? 'selected' : ''}>✅ Aktiv</option>
        <option value="nein" ${h.aktiv === 'nein' ? 'selected' : ''}>🚫 Inaktiv</option>
      </select></div>
    <div class="field"><label>Notizen</label>
      <textarea id="hund-notizen" placeholder="z.B. Besonderheiten…">${esc(h.notizen || '')}</textarea></div>
    <button class="btn-primary" onclick="STAMMDATEN.saveHund(${hundId || 'null'})">
      ${isEdit ? '💾 Änderungen speichern' : '+ Hund anlegen'}
    </button>
    <div class="status" id="status-hund"></div>
  `);
}

export async function saveHund(existingId) {
  const name = document.getElementById('hund-name')?.value.trim();
  if (!name) { setStatus('status-hund', 'err', 'Bitte Name eingeben.'); return; }

  const sid    = getCfg().stammdatenId;
  const gebRaw = document.getElementById('hund-geb')?.value || '';
  let gebFmt   = gebRaw;
  if (gebRaw.includes('-')) {
    const [y, m, d] = gebRaw.split('-');
    gebFmt = `${d}.${m}.${y}`;
  }

  const aktiv  = document.getElementById('hund-aktiv')?.value      || 'ja';
  const rasse  = document.getElementById('hund-rasse')?.value.trim()     || '';
  const gesch  = document.getElementById('hund-geschlecht')?.value        || '';
  const kastr  = document.getElementById('hund-kastriert')?.value         || 'nein';
  const notizen= document.getElementById('hund-notizen')?.value.trim()    || '';

  setStatus('status-hund', 'loading', 'Wird gespeichert…');
  try {
    if (existingId) {
      const rows = await readSheet('Hunde', sid);
      const idx  = rows.findIndex(r => String(r[0]).trim() === String(existingId));
      if (idx < 0) throw new Error('Zeile für Hund ' + existingId + ' nicht gefunden.');
      await writeRange('Hunde', `A${idx + 1}:H${idx + 1}`,
        [[existingId, name, rasse, gebFmt, gesch, kastr, aktiv, notizen]], sid);
      updateHund(existingId, { name, rasse, geburtsdatum: gebFmt, geschlecht: gesch, kastriert: kastr, aktiv, notizen });
    } else {
      const hunde = getHunde();
      const newId = Math.max(0, ...hunde.map(h => h.hund_id)) + 1;
      await appendRow('Hunde', [newId, name, rasse, gebFmt, gesch, kastr, aktiv, notizen], sid);
      addHund({ hund_id: newId, name, rasse, geburtsdatum: gebFmt, geschlecht: gesch, kastriert: kastr, aktiv, notizen });
    }
    setStatus('status-hund', 'ok', '✓ Gespeichert!');
    syncHundSelects();
    setTimeout(() => { closeModal(); loadHunde(); }, 900);
  } catch (e) { setStatus('status-hund', 'err', 'Fehler: ' + e.message); }
}

export async function toggleHundAktiv(hundId, name, aktuell) {
  const neuAktiv = aktuell === 'nein' ? 'ja' : 'nein';
  const verb     = neuAktiv === 'nein' ? 'deaktivieren' : 'aktivieren';
  if (!confirm(`"${name}" wirklich ${verb}?`)) return;

  const sid = getCfg().stammdatenId;
  try {
    const rows = await readSheet('Hunde', sid);
    const idx  = rows.findIndex(r => String(r[0]).trim() === String(hundId));
    if (idx < 0) throw new Error('Hund nicht gefunden');
    await writeRange('Hunde', `G${idx + 1}`, [[neuAktiv]], sid);
    updateHund(hundId, { aktiv: neuAktiv });
    syncHundSelects();
    loadHunde();
  } catch (e) { alert('Fehler: ' + e.message); }
}

// ════════════════════════════════════════════════════════════════
//  ZUTATEN
// ════════════════════════════════════════════════════════════════

export function loadZutaten() {
  const el      = document.getElementById('sd-zutaten-list');
  const zutaten = getZutaten();
  if (!zutaten.length) {
    el.innerHTML = '<div class="view-empty"><div class="icon">🥩</div>Noch keine Zutaten.</div>';
    return;
  }
  const sorted = [...zutaten].sort(
    (a, b) => (a.kategorie || '').localeCompare(b.kategorie || '') || a.name.localeCompare(b.name, 'de')
  );
  el.innerHTML = `<table class="crud-table">
    <thead><tr><th>ID</th><th>Name</th><th>Hersteller</th><th>Kategorie</th></tr></thead>
    <tbody>
    ${sorted.map(z => `
      <tr>
        <td style="color:var(--sub);font-size:11px">${esc(String(z.zutaten_id))}</td>
        <td style="font-weight:500">${esc(z.name)}</td>
        <td style="color:var(--sub)">${esc(z.hersteller || '–')}</td>
        <td><span class="badge badge-ok" style="font-size:10px">${esc(z.kategorie || '–')}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

export function showZutatModal() {
  const cats = [...new Set(getZutaten().map(z => z.kategorie).filter(Boolean))].sort();
  openModal('Neue Zutat', `
    <div class="field"><label>Name</label>
      <input type="text" id="zutat-name" placeholder="z.B. Pferd (Muskelfleisch)"></div>
    <div class="field"><label>Hersteller</label>
      <input type="text" id="zutat-hersteller" placeholder="z.B. barfers"></div>
    <div class="field"><label>Kategorie</label>
      <select id="zutat-kat">
        <option value="">– wählen –</option>
        ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select></div>
    <p style="font-size:12px;color:var(--sub);margin-bottom:.5rem">
      Nährstoffe können danach im Futterrechner über „Neue Zutat manuell erfassen" hinzugefügt werden.</p>
    <button class="btn-primary" onclick="STAMMDATEN.saveZutat()">Speichern</button>
    <div class="status" id="status-zutat"></div>
  `);
}

export async function saveZutat() {
  const name = document.getElementById('zutat-name')?.value.trim();
  if (!name) { setStatus('status-zutat', 'err', 'Bitte Name eingeben.'); return; }

  const sid        = getCfg().stammdatenId;
  const zutaten    = getZutaten();
  const newId      = Math.max(0, ...zutaten.map(z => z.zutaten_id)) + 1;
  const hersteller = document.getElementById('zutat-hersteller')?.value.trim() || '';
  const kategorie  = document.getElementById('zutat-kat')?.value || 'Sonstiges';

  try {
    await appendRow('Zutaten', [newId, name, hersteller, kategorie, 'ja'], sid);
    addZutat({ zutaten_id: newId, name, hersteller, kategorie, aktiv: 'ja' });
    setStatus('status-zutat', 'ok', '✓ Gespeichert!');
    // Futterrechner-Dropdown aktualisieren
    const { initIngredientSelect } = await import('./rechner.js');
    initIngredientSelect();
    setTimeout(() => { closeModal(); loadZutaten(); }, 1_000);
  } catch (e) { setStatus('status-zutat', 'err', 'Fehler: ' + e.message); }
}

// ════════════════════════════════════════════════════════════════
//  PARAMETER
// ════════════════════════════════════════════════════════════════

export async function loadParameter() {
  const el = document.getElementById('sd-parameter-list');
  el.innerHTML = '<div class="view-loading"><div class="spinner"></div></div>';
  try {
    const rows   = await readSheet('Parameter', getCfg().stammdatenId);
    const params = rows.slice(2).filter(r => r && r[0]);

    el.innerHTML = params.map((r, i) => `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${esc(r[0] || '')}</div>
            <div style="font-size:11px;color:var(--sub);margin-top:2px">${esc(r[3] || '')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <input type="text" id="param-val-${i}" value="${esc(r[1] || '')}"
              style="width:90px;padding:6px 10px;font-size:14px;font-weight:600;
                border:1px solid var(--border);border-radius:var(--radius-sm);
                background:var(--bg);color:var(--text);text-align:center">
            <span style="font-size:12px;color:var(--sub)">${esc(r[2] || '')}</span>
          </div>
        </div>
      </div>`).join('') +
      `<button class="btn-primary" onclick="STAMMDATEN.saveParameter(${params.length})">
        💾 Parameter speichern
      </button>
      <div class="status" id="status-param"></div>`;
  } catch (e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export async function saveParameter(count) {
  setStatus('status-param', 'loading', 'Wird gespeichert…');
  try {
    const sid = getCfg().stammdatenId;
    for (let i = 0; i < count; i++) {
      const val = document.getElementById(`param-val-${i}`)?.value;
      if (val !== undefined) {
        await writeRange('Parameter', `B${i + 3}`, [[val]], sid);
      }
    }
    setStatus('status-param', 'ok', '✓ Gespeichert! Seite neu laden um Änderungen zu übernehmen.');
  } catch (e) { setStatus('status-param', 'err', 'Fehler: ' + e.message); }
}
