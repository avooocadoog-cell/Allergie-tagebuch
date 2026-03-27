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
         updateHund, addZutat, getNaehrstoffe, addZutatNutr } from './store.js';

// ── Aktuell geöffneter Tab ───────────────────────────────────────
let currentTab = 'hunde';

export function loadCurrentTab() { loadTab(currentTab); }

export function loadTab(tab) {
  currentTab = tab;
  if (tab === 'hunde')      loadHunde();
  if (tab === 'zutaten')    loadZutaten();
  if (tab === 'parameter')  loadParameter();
  if (tab === 'toleranzen') loadToleranzTab();
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
          <button class="edit-btn" style="background:var(--c4);border-color:var(--c2)"
            onclick="STAMMDATEN.showGewichtModal(${h.hund_id},'${esc(h.name)}')">⚖️ Gewicht</button>
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

  // Aktuellen kcal_manuell Wert laden (aus Hund_Kalorienbedarf cache)
  let existingKcal = '';
  if (hundId) {
    import('./store.js').then(({ getKalorienParam }) => {
      const kp = getKalorienParam(hundId);
      if (kp.kcalManual > 0) {
        const el = document.getElementById('hund-kcal');
        if (el) el.value = kp.kcalManual;
      }
    });
  }

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
    <div class="field" style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
      <label>⚡ Kcal-Bedarf/Tag (überschreibt RER-Berechnung)</label>
      <input type="number" id="hund-kcal" value="${esc(String(existingKcal || ''))}"
        placeholder="leer = automatisch berechnen" min="0" max="9999" step="1"
        style="text-align:center">
      <div style="font-size:11px;color:var(--sub);margin-top:4px">
        Leer lassen = App berechnet Bedarf automatisch (RER × Faktor).
        Eingetragener Wert ersetzt die Berechnung komplett.
      </div>
    </div>
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
    // Kcal-Bedarf speichern (in Hund_Kalorienbedarf)
    const kcalVal = parseInt(document.getElementById('hund-kcal')?.value) || 0;
    await _saveKcalManuell(existingId || newId, kcalVal, sid);

    setStatus('status-hund', 'ok', '✓ Gespeichert!');
    syncHundSelects();
    setTimeout(() => { closeModal(); loadHunde(); }, 900);
  } catch (e) { setStatus('status-hund', 'err', 'Fehler: ' + e.message); }
}

/** Kcal-Manuell-Wert in Hund_Kalorienbedarf schreiben oder aktualisieren */
async function _saveKcalManuell(hundId, kcal, sid) {
  try {
    const rows = await readSheet('Hund_Kalorienbedarf', sid);
    const idx  = rows.findIndex(r =>
      String(r[0]).trim() === String(hundId) &&
      String(r[1]).trim() === 'kcal_manuell'
    );
    if (idx >= 0) {
      await writeRange('Hund_Kalorienbedarf', `C${idx+1}`, [[kcal || '']], sid);
    } else if (kcal > 0) {
      await appendRow('Hund_Kalorienbedarf',
        [hundId, 'kcal_manuell', kcal, 'Manuell eingetragener Tagesbedarf'], sid);
    }
    // Store-Cache sofort aktualisieren
    const { getKalorienParam } = await import('./store.js');
    // Cache-Update über Store ist nicht direkt möglich – App-Reload holt neuen Wert
  } catch(e) { console.warn('kcal_manuell save:', e.message); }
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
  const zutaten = getZutaten().filter(z => String(z.deleted ?? '').toUpperCase() !== 'TRUE');
  if (!zutaten.length) {
    el.innerHTML = '<div class="view-empty"><div class="icon">🥩</div>Noch keine Zutaten.</div>';
    return;
  }
  const sorted = [...zutaten].sort(
    (a, b) => (a.kategorie || '').localeCompare(b.kategorie || '') || a.name.localeCompare(b.name, 'de')
  );
  el.innerHTML = `<table class="crud-table">
    <thead><tr><th>ID</th><th>Name</th><th>Hersteller</th><th>Kategorie</th><th></th></tr></thead>
    <tbody>
    ${sorted.map(z => `
      <tr>
        <td style="color:var(--sub);font-size:11px">${esc(String(z.zutaten_id))}</td>
        <td style="font-weight:500">${esc(z.name)}</td>
        <td style="color:var(--sub)">${esc(z.hersteller || '–')}</td>
        <td><span class="badge badge-ok" style="font-size:10px">${esc(z.kategorie || '–')}</span></td>
        <td style="white-space:nowrap">
          <button class="edit-btn" style="font-size:11px;padding:4px 8px"
            onclick="STAMMDATEN.showZutatModal(${z.zutaten_id})">✏️</button>
          <button class="del-small-btn" style="font-size:11px;padding:4px 8px;margin-left:4px"
            onclick="STAMMDATEN.deleteZutat(${z.zutaten_id},'${esc(z.name)}')">🗑</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

export function showZutatModal(zutatId) {
  const cats   = [...new Set(getZutaten().map(z => z.kategorie).filter(Boolean))].sort();
  const z      = zutatId ? (getZutaten().find(x => x.zutaten_id === zutatId) || {}) : {};
  const isEdit = !!zutatId;
  const naehr  = getNaehrstoffe();

  // Nährstoffe nach Gruppe sortiert
  const gruppenOrder = ['Makronährstoffe','Aminosäuren','Fettsäuren','Mineralstoffe','Vitamine'];
  const gruppen = {};
  naehr.forEach(n => {
    const gk = n.gruppe || 'Sonstiges';
    (gruppen[gk] = gruppen[gk] || []).push(n);
  });
  const sortedGruppen = [
    ...gruppenOrder.filter(g => gruppen[g]),
    ...Object.keys(gruppen).filter(g => !gruppenOrder.includes(g)),
  ];

  const nutrHtml = sortedGruppen.map(grp => {
    const items = gruppen[grp];
    if (!items?.length) return '';
    return `
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          color:var(--c2);margin:8px 0 6px;padding-top:6px;border-top:1px solid var(--border)">${esc(grp)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${items.map(n => `
            <div>
              <label style="font-size:10px;color:var(--sub);display:block;margin-bottom:2px">
                ${esc(n.name)}<span style="opacity:.6"> (${esc(n.einheit || 'g')})</span>
              </label>
              <input type="number" step="any" min="0"
                id="nutr-${n.naehrstoff_id}"
                data-nutr-id="${n.naehrstoff_id}"
                data-nutr-name="${esc(n.name)}"
                placeholder="–"
                style="width:100%;padding:5px 7px;font-size:12px;border:1px solid var(--border);
                  border-radius:4px;background:var(--bg);color:var(--text);
                  font-family:inherit;text-align:right;box-sizing:border-box">
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  openModal(isEdit ? `🥩 ${esc(z.name || '')} bearbeiten` : 'Neue Zutat', `
    <div class="field"><label>Name</label>
      <input type="text" id="zutat-name" value="${esc(z.name || '')}" placeholder="z.B. Pferd (Muskelfleisch)"></div>
    <div class="field"><label>Hersteller</label>
      <input type="text" id="zutat-hersteller" value="${esc(z.hersteller || '')}" placeholder="z.B. barfers"></div>
    <div class="field"><label>Kategorie</label>
      <select id="zutat-kat">
        <option value="">– wählen –</option>
        ${cats.map(c => `<option value="${esc(c)}" ${z.kategorie === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select></div>
    <div class="field"><label>Status</label>
      <select id="zutat-aktiv">
        <option value="ja"   ${(z.aktiv || 'ja') === 'ja'   ? 'selected' : ''}>✅ Aktiv</option>
        <option value="nein" ${z.aktiv === 'nein'            ? 'selected' : ''}>🚫 Inaktiv</option>
      </select></div>

    <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;
          cursor:pointer;user-select:none;margin-bottom:4px"
        onclick="const s=document.getElementById('nutr-section');
                 const open=s.style.display!=='none';
                 s.style.display=open?'none':'block';
                 document.getElementById('nutr-toggle-arrow').textContent=open?'▶':'▼'">
        <div style="font-size:13px;font-weight:600">🧪 Nährwerte pro 100g Frischgewicht</div>
        <span id="nutr-toggle-arrow" style="font-size:11px;color:var(--sub)">${isEdit ? '▼' : '▶'}</span>
      </div>
      <div id="nutr-section" style="display:${isEdit ? 'block' : 'none'}">
        <div style="font-size:11px;color:var(--sub);margin-bottom:8px">
          Felder leer lassen = nicht erfasst. Ausgefüllte Werte werden direkt im Futterrechner verwendet.
        </div>
        ${nutrHtml}
      </div>
    </div>

    <button class="btn-primary" style="margin-top:14px" onclick="STAMMDATEN.saveZutat(${zutatId || 'null'})">
      ${isEdit ? '💾 Änderungen speichern' : 'Speichern'}
    </button>
    <div class="status" id="status-zutat"></div>
  `);

  // Bei Bearbeitung bestehende Nährwerte eintragen
  if (isEdit) {
    import('./store.js').then(({ getNutrMap }) => {
      const map = getNutrMap(zutatId, z.name) || {};
      Object.entries(map).forEach(([nutrName, wert]) => {
        const n = naehr.find(n => n.name === nutrName);
        if (n) {
          const inp = document.getElementById(`nutr-${n.naehrstoff_id}`);
          if (inp && wert != null && wert !== '') inp.value = wert;
        }
      });
    });
  }
}

/** Füllt Nährstoff-Inputs aus einem {name: wert}-Map (für async-Nachladen) */
function _fillNutrInputs(map) {
  const naehr = getNaehrstoffe();
  Object.entries(map).forEach(([nutrName, wert]) => {
    const n = naehr.find(n => n.name === nutrName);
    if (n) {
      const inp = document.getElementById(`nutr-${n.naehrstoff_id}`);
      if (inp && wert != null && wert !== '') inp.value = wert;
    }
  });
}

export async function saveZutat(existingId) {
  const name = document.getElementById('zutat-name')?.value.trim();
  if (!name) { setStatus('status-zutat', 'err', 'Bitte Name eingeben.'); return; }

  const sid        = getCfg().stammdatenId;
  const hersteller = document.getElementById('zutat-hersteller')?.value.trim() || '';
  const kategorie  = document.getElementById('zutat-kat')?.value || 'Sonstiges';
  const aktiv      = document.getElementById('zutat-aktiv')?.value || 'ja';

  setStatus('status-zutat', 'loading', 'Wird gespeichert…');
  try {
    if (existingId) {
      // Bestehenede Zutat bearbeiten: Zeile im Sheet finden und überschreiben
      const rows = await readSheet('Zutaten', sid);
      const idx  = rows.findIndex(r => String(r[0]).trim() === String(existingId));
      if (idx < 0) throw new Error('Zutat ' + existingId + ' nicht gefunden.');
      // Spalten A–E überschreiben; Spalten F–H (created_at, deleted, deleted_at) bleiben unberührt
      await writeRange('Zutaten', `A${idx + 1}:E${idx + 1}`,
        [[existingId, name, hersteller, kategorie, aktiv]], sid);
      // Cache aktualisieren
      const z = getZutaten().find(x => x.zutaten_id === existingId);
      if (z) Object.assign(z, { name, hersteller, kategorie, aktiv });
    } else {
      // Neue Zutat anlegen
      const zutaten = getZutaten();
      const newId   = Math.max(0, ...zutaten.map(z => z.zutaten_id)) + 1;
      const now     = new Date().toISOString().slice(0, 19);
      await appendRow('Zutaten', [newId, name, hersteller, kategorie, aktiv, now, 'FALSE', ''], sid);
      addZutat({ zutaten_id: newId, name, hersteller, kategorie, aktiv });
    }

    // ── Nährwerte speichern ─────────────────────────────────────
    const zutatId = existingId || newId;
    await _saveZutatNaehrstoffe(zutatId, sid);

    setStatus('status-zutat', 'ok', '✓ Gespeichert!');
    // Futterrechner-Dropdown aktualisieren
    const { initIngredientSelect } = await import('./rechner.js');
    initIngredientSelect();
    setTimeout(() => { closeModal(); loadZutaten(); }, 900);
  } catch (e) { setStatus('status-zutat', 'err', 'Fehler: ' + e.message); }
}

/**
 * Liest alle ausgefüllten Nährstoff-Inputs aus dem Modal und schreibt
 * sie in Zutaten_Naehrstoffe. Bestehende Zeilen werden überschrieben,
 * neue angehängt. Leere Inputs werden übersprungen.
 */
async function _saveZutatNaehrstoffe(zutatId, sid) {
  const inputs = document.querySelectorAll('#nutr-section input[data-nutr-id]');
  if (!inputs.length) return;

  const rows = await readSheet('Zutaten_Naehrstoffe', sid);

  for (const inp of inputs) {
    const raw = inp.value.trim();
    if (raw === '' || raw === null) continue;
    const wert        = parseFloat(raw.replace(',', '.'));
    if (isNaN(wert))  continue;
    const nutrId      = parseInt(inp.dataset.nutrId);
    const nutrName    = inp.dataset.nutrName || '';

    // Vorhandene Zeile suchen (zutaten_id + naehrstoff_id)
    const idx = rows.findIndex(r =>
      String(r[0]).trim() === String(zutatId) &&
      String(r[1]).trim() === String(nutrId)
    );

    if (idx >= 0) {
      // Update wert_pro_100g (Spalte D)
      await writeRange('Zutaten_Naehrstoffe', `D${idx + 1}`, [[wert]], sid);
      rows[idx][3] = wert; // lokale Kopie aktuell halten
    } else {
      // Neu anlegen
      await appendRow('Zutaten_Naehrstoffe',
        [zutatId, nutrId, nutrName, wert, 'manual'], sid);
      rows.push([zutatId, nutrId, nutrName, wert, 'manual']);
    }
  }

  // Store-Cache aktualisieren (zutatNutr)
  const naehr = getNaehrstoffe();
  const newEntries = [];
  inputs.forEach(inp => {
    const raw = inp.value.trim();
    if (!raw) return;
    const wert = parseFloat(raw.replace(',', '.'));
    if (isNaN(wert)) return;
    newEntries.push({
      zutaten_id:   zutatId,
      naehrstoff_id: parseInt(inp.dataset.nutrId),
      naehrstoff_name: inp.dataset.nutrName || '',
      wert_pro_100g: wert,
    });
  });
  if (newEntries.length) addZutatNutr(newEntries);
}

// ── Undo-Stack für Zutaten-Löschungen ───────────────────────────
// Format: { zutatId, sheetRow, vorher: { aktiv, deleted, deleted_at } }
const _zutatUndoStack = [];
const _MAX_ZUTAT_UNDO = 5;

/**
 * Zutat per Soft-Delete deaktivieren.
 * Setzt deleted=TRUE in Spalte G (nach Migration) oder aktiv=nein als Fallback.
 * Legt Undo-Eintrag ab und zeigt Banner.
 *
 * @param {number} zutatId
 * @param {string} name
 */
export async function deleteZutat(zutatId, name) {
  if (!confirm(`Zutat "${name}" löschen?\n\nKann über den „Rückgängig"-Button wiederhergestellt werden.`)) return;

  const sid = getCfg().stammdatenId;
  try {
    const rows = await readSheet('Zutaten', sid);
    const idx  = rows.findIndex(r => String(r[0]).trim() === String(zutatId));
    if (idx < 0) { alert('Zutat nicht gefunden.'); return; }

    const sheetRow = idx + 1;
    const row      = rows[idx];
    const now      = new Date().toISOString().slice(0, 19);

    // Vorherigen Zustand für Undo merken
    const vorher = {
      aktiv:      String(row[4] ?? 'ja'),
      deleted:    String(row[6] ?? 'FALSE'),
      deleted_at: String(row[7] ?? ''),
    };

    if (row.length >= 7) {
      // Migrierte Tabelle: deleted=TRUE in G, deleted_at in H
      await writeRange('Zutaten', `G${sheetRow}:H${sheetRow}`, [['TRUE', now]], sid);
    } else {
      // Vor Migration: aktiv=nein setzen (Spalte E)
      await writeRange('Zutaten', `E${sheetRow}`, [['nein']], sid);
    }

    // Store-Cache aktualisieren
    const z = getZutaten().find(x => x.zutaten_id === zutatId);
    if (z) { z.aktiv = 'nein'; z.deleted = 'TRUE'; }

    // Undo-Stack befüllen
    _zutatUndoStack.unshift({ zutatId, zutatName: name, sheetRow, vorher, migriert: row.length >= 7 });
    if (_zutatUndoStack.length > _MAX_ZUTAT_UNDO) _zutatUndoStack.pop();

    // Futterrechner-Dropdown aktualisieren
    const { initIngredientSelect } = await import('./rechner.js');
    initIngredientSelect();

    loadZutaten();
    _showZutatUndoBanner(name);
  } catch (e) { alert('Fehler: ' + e.message); }
}

/**
 * Letzte Zutaten-Löschung rückgängig machen.
 */
export async function undoDeleteZutat() {
  const entry = _zutatUndoStack[0];
  if (!entry) return;

  const sid = getCfg().stammdatenId;
  try {
    if (entry.migriert) {
      await writeRange('Zutaten', `G${entry.sheetRow}:H${entry.sheetRow}`,
        [[entry.vorher.deleted, entry.vorher.deleted_at]], sid);
    } else {
      await writeRange('Zutaten', `E${entry.sheetRow}`, [[entry.vorher.aktiv]], sid);
    }

    // Store-Cache zurücksetzen
    const z = getZutaten().find(x => x.zutaten_id === entry.zutatId);
    if (z) { z.aktiv = entry.vorher.aktiv; z.deleted = entry.vorher.deleted; }

    _zutatUndoStack.shift();

    const { initIngredientSelect } = await import('./rechner.js');
    initIngredientSelect();

    document.getElementById('zutat-undo-banner')?.remove();
    loadZutaten();
  } catch (e) { alert('Fehler beim Wiederherstellen: ' + e.message); }
}

/** Undo-Banner für Zutaten-Löschung einblenden */
function _showZutatUndoBanner(name) {
  document.getElementById('zutat-undo-banner')?.remove();
  const el = document.createElement('div');
  el.id = 'zutat-undo-banner';
  el.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--text);color:var(--bg);
    padding:10px 16px;border-radius:var(--radius);
    font-size:13px;font-weight:600;z-index:9999;
    display:flex;align-items:center;gap:12px;
    box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap;
  `;
  el.innerHTML = `
    <span>„${name}" gelöscht</span>
    <button onclick="STAMMDATEN.undoDeleteZutat()"
      style="padding:5px 10px;font-size:12px;border:none;border-radius:4px;
        background:var(--c2);color:#fff;cursor:pointer;font-family:inherit;font-weight:700">
      ↺ Rückgängig
    </button>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
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

// ════════════════════════════════════════════════════════════════
//  GEWICHT EINTRAGEN
// ════════════════════════════════════════════════════════════════

/**
 * Gewichtsverlauf-Modal für einen Hund öffnen.
 * Zeigt letzte Einträge aus Hund_Gewicht + Formular für neuen Eintrag.
 */
export async function showGewichtModal(hundId, hundName) {
  openModal(`⚖️ Gewicht – ${esc(hundName)}`, `
    <div class="field"><label>Datum</label>
      <div class="date-row">
        <input type="date" id="gew-datum">
        <button class="btn-small" onclick="UI.setToday('gew-datum')">Heute</button>
      </div></div>
    <div class="field"><label>Gewicht (kg)</label>
      <input type="number" id="gew-kg" placeholder="z.B. 27.3" step="0.1" min="0" max="200"
        style="font-size:18px;font-weight:700;text-align:center"></div>
    <div class="field"><label>Notizen</label>
      <input type="text" id="gew-notizen" placeholder="z.B. nach Tierarztbesuch"></div>
    <button class="btn-primary" onclick="STAMMDATEN.saveGewicht(${hundId})">⚖️ Gewicht speichern</button>
    <div class="status" id="status-gew"></div>
    <div id="gew-history" style="margin-top:1rem">
      <div style="font-size:11px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Verlauf</div>
      <div class="view-loading"><div class="spinner"></div></div>
    </div>
  `);

  // Heute als Standard
  import('./ui.js').then(({ setToday }) => setToday('gew-datum'));

  // Verlauf laden
  _loadGewichtHistory(hundId);
}

async function _loadGewichtHistory(hundId) {
  const el = document.getElementById('gew-history');
  if (!el) return;
  try {
    const rows = await readSheet('Hund_Gewicht', getCfg().tagebuchId);
    const data = rows.slice(2)
      .filter(r => r?.some(v => String(v).trim()))
      .filter(r => String(r[1]).trim() === String(hundId))
      .map(r => ({
        datum:   String(r[2] ?? '').trim(),
        kg:      parseFloat(String(r[3]).replace(',', '.')) || 0,
        notizen: String(r[4] ?? '').trim(),
      }))
      .filter(r => r.kg > 0)
      .sort((a, b) => {
        const toTs = s => { if(!s) return 0; const [d,m,y]=s.split('.'); return new Date(`${y}-${m}-${d}`).getTime(); };
        return toTs(b.datum) - toTs(a.datum);
      })
      .slice(0, 15);

    const histEl = document.getElementById('gew-history');
    if (!histEl) return;
    const header = histEl.querySelector('div');

    if (!data.length) {
      histEl.innerHTML = '';
      if (header) histEl.appendChild(header);
      histEl.innerHTML += '<p style="color:var(--sub);font-size:13px">Noch keine Einträge.</p>';
      return;
    }

    let html = '<div style="font-size:11px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Verlauf</div>';
    html += '<table style="width:100%;font-size:13px;border-collapse:collapse">';
    data.forEach(r => {
      html += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 4px">${esc(r.datum)}</td>
        <td style="padding:7px 4px;font-weight:700;text-align:right">${r.kg.toFixed(1)} kg</td>
        <td style="padding:7px 4px;color:var(--sub);font-size:11px">${esc(r.notizen)}</td>
      </tr>`;
    });
    html += '</table>';
    histEl.innerHTML = html;
  } catch (e) {
    const histEl = document.getElementById('gew-history');
    if (histEl) histEl.innerHTML = `<p style="color:var(--sub);font-size:12px">Sheet „Hund_Gewicht" noch nicht angelegt.<br>Einstellungen → „Neue Sheets anlegen".</p>`;
  }
}

export async function saveGewicht(hundId) {
  const datum  = document.getElementById('gew-datum')?.value;
  const kgRaw  = document.getElementById('gew-kg')?.value;
  const kg     = parseFloat(String(kgRaw).replace(',', '.'));

  if (!datum) { setStatus('status-gew', 'err', 'Bitte Datum auswählen.'); return; }
  if (!kg || kg <= 0) { setStatus('status-gew', 'err', 'Bitte gültiges Gewicht eingeben.'); return; }

  const [y, m, d] = datum.split('-');
  const datumFmt  = `${d}.${m}.${y}`;
  const now       = new Date().toISOString().slice(0, 19);
  const notizen   = document.getElementById('gew-notizen')?.value.trim() || '';

  setStatus('status-gew', 'loading', 'Wird gespeichert…');
  try {
    await appendRow('Hund_Gewicht', [
      '', hundId, datumFmt, kg, notizen, now,
    ], getCfg().tagebuchId);

    setStatus('status-gew', 'ok', `✓ ${kg.toFixed(1)} kg am ${datumFmt} gespeichert!`);
    document.getElementById('gew-kg').value = '';
    document.getElementById('gew-notizen').value = '';
    _loadGewichtHistory(hundId);
  } catch (e) { setStatus('status-gew', 'err', 'Fehler: ' + e.message); }
}

// ════════════════════════════════════════════════════════════════
//  TOLERANZEN TAB
// ════════════════════════════════════════════════════════════════

export async function loadToleranzTab() {
  const el = document.getElementById('sd-toleranzen-list');
  if (!el) return;
  el.innerHTML = '<div class="view-loading"><div class="spinner"></div></div>';

  try {
    const { getBedarf, getHunde, getTolerance } = await import('./store.js');
    const bedarf = getBedarf();
    const hunde  = getHunde().filter(h => h.aktiv !== 'nein');

    if (!bedarf.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📊</div>Bedarfsdaten nicht geladen.<br><small>Prüfe das „Bedarf" Sheet.</small></div>';
      return;
    }

    // Hund-Selector
    let html = `
      <div style="margin-bottom:1rem">
        <label style="font-size:12px;color:var(--sub);display:block;margin-bottom:4px">Hund</label>
        <select id="tol-hund-sel" onchange="STAMMDATEN.loadToleranzTab()"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);
            border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit">
          ${hunde.map(h => `<option value="${h.hund_id}">${esc(h.name)}</option>`).join('')}
        </select>
      </div>`;

    const hundId = parseInt(document.getElementById('tol-hund-sel')?.value) || hunde[0]?.hund_id || 1;

    html += `<div style="font-size:12px;color:var(--sub);margin-bottom:10px;padding:8px 10px;
      background:var(--bg2);border-radius:var(--radius-sm);border:1px solid var(--border)">
      Werte in % des Tagesbedarfs. Standard: min=80%, max=150%, empf=100%
    </div>`;

    html += `<table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:8px 4px;color:var(--sub)">Nährstoff</th>
        <th style="text-align:center;padding:8px 4px;color:var(--sub);width:70px">Min %</th>
        <th style="text-align:center;padding:8px 4px;color:var(--sub);width:70px">Max %</th>
        <th style="text-align:center;padding:8px 4px;color:var(--sub);width:70px">Empf %</th>
      </tr></thead><tbody>`;

    const inputStyle = `style="width:100%;padding:5px 4px;border:1px solid var(--border);
      border-radius:4px;background:var(--bg);color:var(--text);font-family:inherit;
      font-size:12px;text-align:center"`;

    bedarf.forEach((b, i) => {
      const tol = getTolerance(hundId, b.name);
      const minVal  = tol.min  || 80;
      const maxVal  = tol.max  || 150;
      const recVal  = tol.recommended || '';
      const shade   = i % 2 === 0 ? 'background:var(--bg2)' : '';
      html += `<tr style="border-bottom:1px solid var(--border);${shade}">
        <td style="padding:7px 4px;font-weight:500">${esc(b.name)}</td>
        <td style="padding:4px 2px"><input type="number" id="tol-min-${i}" value="${minVal}" min="0" max="200" ${inputStyle}></td>
        <td style="padding:4px 2px"><input type="number" id="tol-max-${i}" value="${maxVal}" min="0" max="999" ${inputStyle}></td>
        <td style="padding:4px 2px"><input type="number" id="tol-rec-${i}" value="${recVal}" min="0" max="500" placeholder="–" ${inputStyle}></td>
      </tr>`;
    });

    html += `</tbody></table>
      <button class="btn-primary" style="margin-top:1rem;width:100%"
        onclick="STAMMDATEN.saveToleranz(${hundId},${bedarf.length})">
        💾 Toleranzen speichern
      </button>
      <div class="status" id="status-tol"></div>`;

    el.innerHTML = html;

    // Hund-Selektor auf gespeicherten Wert setzen
    const sel = document.getElementById('tol-hund-sel');
    if (sel) sel.value = hundId;

  } catch (e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export async function saveToleranz(hundId, count) {
  setStatus('status-tol', 'loading', 'Wird gespeichert…');
  try {
    const { getBedarf, getToleranz } = await import('./store.js');
    const bedarf     = getBedarf();
    const toleranzen = getToleranz();
    const sid        = getCfg().stammdatenId;

    // Bestehende Zeilen laden um Update vs. Append zu entscheiden
    const rows = await readSheet('Toleranzen', sid);

    for (let i = 0; i < count; i++) {
      const b   = bedarf[i]; if (!b) continue;
      const min = parseInt(document.getElementById(`tol-min-${i}`)?.value) || 80;
      const max = parseInt(document.getElementById(`tol-max-${i}`)?.value) || 150;
      const rec = document.getElementById(`tol-rec-${i}`)?.value.trim() || '';

      // Vorhandene Zeile für hund_id + naehrstoff_name suchen
      const idx = rows.findIndex(r =>
        String(r[0]).trim() === String(hundId) &&
        String(r[2]).trim() === b.name
      );

      if (idx >= 0) {
        // Update: min, max, recommended (Spalten D, E, G)
        await writeRange('Toleranzen', `D${idx+1}:G${idx+1}`,
          [[min, max, '', rec]], sid);
      } else {
        // Neuen Eintrag anlegen
        await appendRow('Toleranzen',
          [hundId, b.naehrstoff_id, b.name, min, max, '', rec], sid);
      }
    }

    setStatus('status-tol', 'ok', '✓ Toleranzen gespeichert! App neu laden um Änderungen zu übernehmen.');
  } catch (e) { setStatus('status-tol', 'err', 'Fehler: ' + e.message); }
}
