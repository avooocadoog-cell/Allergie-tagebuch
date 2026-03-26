/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: wetter.js                                           ║
 * ║  Hund Manager – Wetter & Pollen                              ║
 * ║                                                              ║
 * ║  Pollen-Quellen:                                             ║
 * ║  1. DWD OpenData (Deutschland, 18 Regionen, via CORS-Proxy) ║
 * ║  2. Open-Meteo Air Quality (Europa, koordinatenbasiert,      ║
 * ║     kein Key, kein CORS-Problem)                             ║
 * ║                                                              ║
 * ║  Nach dem Laden erscheint eine Auswahl-UI. Der Nutzer        ║
 * ║  wählt welche Pollenarten + Stärke übernommen werden.        ║
 * ║                                                              ║
 * ║  Abhängigkeiten: config.js, sheets.js                        ║
 * ║  Optional: schreibt in Pollen_Log (Tagebuch-Spreadsheet)     ║
 * ╚══════════════════════════════════════════════════════════════╝

 */

import { get as getCfg } from './config.js';
import { appendRow }     from './sheets.js';

// ── DWD Konstanten ───────────────────────────────────────────────
const DWD_POLLEN_NAMES = {
  Graeser: 'Gräser', Roggen: 'Roggen', Hasel: 'Hasel',
  Beifuss: 'Beifuß', Esche: 'Esche',  Birke: 'Birke',
  Erle:    'Erle',   Ambrosia: 'Ambrosia',
};
/**
 * Spec-konforme Skala (Spec Punkt 7):
 *   0 = keine
 *   1 = gering
 *   2 = gering–mittel  (Zwischenstufe als eigener Wert)
 *   3 = mittel
 *   4 = mittel–stark   (Zwischenstufe als eigener Wert)
 *   5 = stark / sehr stark
 */
const DWD_LEVEL_LABELS = {
  '-1':'keine Daten', '0':'keine', '0-1':'gering–mittel',
  '1':'gering', '1-2':'gering–mittel', '2':'mittel',
  '2-3':'mittel–stark', '3':'stark',
};
const DWD_LEVEL_NUM = {
  '-1': -1, '0': 0, '0-1': 2, '1': 1, '1-2': 2, '2': 3, '2-3': 4, '3': 5,
};

// ── Open-Meteo Konstanten ────────────────────────────────────────
const OM_POLLEN_FIELDS = [
  { key:'alder_pollen',   name:'Erle'    },
  { key:'birch_pollen',   name:'Birke'   },
  { key:'grass_pollen',   name:'Gräser'  },
  { key:'mugwort_pollen', name:'Beifuß'  },
  { key:'olive_pollen',   name:'Olive'   },
  { key:'ragweed_pollen', name:'Ragweed' },
];

// ── Benutzerdefinierte Pollen (erweiterbar via localStorage) ─────
const CUSTOM_POLLEN_KEY = 'hundapp_custom_pollen';

function getCustomPollen() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_POLLEN_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomPollen(list) {
  localStorage.setItem(CUSTOM_POLLEN_KEY, JSON.stringify(list));
}

/**
 * Öffentliche Funktion: Pollen-Verwaltungs-Modal öffnen.
 * Zeigt alle benutzerdefinierten Pollen + Formular zum Hinzufügen/Löschen.
 */
export function showPollenManager() {
  const { openModal, closeModal, esc: escHtml } = window.UI || {};
  if (!openModal) { alert('UI nicht geladen.'); return; }

  const _esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const builtIn = [
    ...Object.values(DWD_POLLEN_NAMES),
    ...OM_POLLEN_FIELDS.map(f => f.name),
  ];
  const uniqueBuiltIn = [...new Set(builtIn)].sort();
  const custom = getCustomPollen();

  const renderList = () => {
    const allCustom = getCustomPollen();
    const el = document.getElementById('pollen-mgr-list');
    if (!el) return;
    if (!allCustom.length) {
      el.innerHTML = '<p style="color:var(--sub);font-size:13px">Keine eigenen Pollen angelegt.</p>';
      return;
    }
    el.innerHTML = allCustom.map((name, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:14px">🌿 ${_esc(name)}</span>
        <button onclick="WETTER._removeCustomPollen(${i})"
          style="padding:4px 10px;font-size:12px;border:1px solid var(--c3);
            border-radius:4px;background:transparent;color:var(--c3);
            cursor:pointer;font-family:inherit">✕ Entfernen</button>
      </div>`).join('');
  };

  openModal('🌿 Pollen verwalten', `
    <div style="font-size:12px;color:var(--sub);margin-bottom:12px">
      Eingebaute Pollenarten (DWD + Open-Meteo): <br>
      <span style="font-size:11px">${uniqueBuiltIn.join(' · ')}</span>
    </div>

    <div style="font-size:13px;font-weight:600;margin-bottom:8px">Eigene Pollen hinzufügen</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input type="text" id="pollen-new-name" placeholder="z.B. Platane, Wegerich…"
        style="flex:1;padding:9px 12px;font-size:14px;border:1px solid var(--border);
          border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit">
      <button onclick="WETTER._addCustomPollen()"
        style="padding:9px 14px;font-size:14px;font-weight:600;border:none;
          border-radius:var(--radius-sm);background:var(--c2);color:#fff;
          cursor:pointer;font-family:inherit">+ Hinzufügen</button>
    </div>

    <div style="font-size:13px;font-weight:600;margin-bottom:8px">Eigene Pollenarten</div>
    <div id="pollen-mgr-list"></div>
    <div class="status" id="status-pollen-mgr"></div>
  `);

  renderList();
  // Enter-Taste im Input
  setTimeout(() => {
    document.getElementById('pollen-new-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') WETTER._addCustomPollen();
    });
  }, 50);
}

/** Intern: Neuen Custom-Pollen hinzufügen */
export function _addCustomPollen() {
  const inp  = document.getElementById('pollen-new-name');
  const name = inp?.value.trim();
  if (!name) return;
  const list = getCustomPollen();
  if (list.includes(name)) {
    document.getElementById('status-pollen-mgr').textContent = '⚠️ Pollenart bereits vorhanden.';
    return;
  }
  list.push(name);
  saveCustomPollen(list);
  inp.value = '';
  // Liste neu rendern
  const allCustom = getCustomPollen();
  const el = document.getElementById('pollen-mgr-list');
  if (el) {
    el.innerHTML = allCustom.map((n, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:14px">🌿 ${n}</span>
        <button onclick="WETTER._removeCustomPollen(${i})"
          style="padding:4px 10px;font-size:12px;border:1px solid var(--c3);
            border-radius:4px;background:transparent;color:var(--c3);
            cursor:pointer;font-family:inherit">✕ Entfernen</button>
      </div>`).join('');
  }
  document.getElementById('status-pollen-mgr').textContent = `✓ „${name}" hinzugefügt.`;
}

/** Intern: Custom-Pollen per Index entfernen */
export function _removeCustomPollen(idx) {
  const list = getCustomPollen();
  const name = list[idx];
  if (!confirm(`„${name}" wirklich entfernen?`)) return;
  list.splice(idx, 1);
  saveCustomPollen(list);
  // Neu rendern
  const allCustom = getCustomPollen();
  const el = document.getElementById('pollen-mgr-list');
  if (el) {
    if (!allCustom.length) {
      el.innerHTML = '<p style="color:var(--sub);font-size:13px">Keine eigenen Pollen angelegt.</p>';
    } else {
      el.innerHTML = allCustom.map((n, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:14px">🌿 ${n}</span>
          <button onclick="WETTER._removeCustomPollen(${i})"
            style="padding:4px 10px;font-size:12px;border:1px solid var(--c3);
              border-radius:4px;background:transparent;color:var(--c3);
              cursor:pointer;font-family:inherit">✕ Entfernen</button>
        </div>`).join('');
    }
  }
}


function omLevelLabel(val) {
  if (val === null || val === undefined) return null;
  if (val < 10)  return 'keine';
  if (val < 50)  return 'gering';
  if (val < 100) return 'gering–mittel';
  if (val < 150) return 'mittel';
  if (val < 350) return 'mittel–stark';
  return 'stark';
}
function omLevelNum(val) {
  if (!val)      return -1;
  if (val < 10)  return 0;
  if (val < 50)  return 1;
  if (val < 100) return 2;
  if (val < 150) return 3;
  if (val < 350) return 4;
  return 5;
}

// ── CORS-Proxies ─────────────────────────────────────────────────
const DWD_URL = 'https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json';
const PROXIES = [
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
];

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

export async function loadAll() {
  const bar = document.getElementById('autoload-status');
  if (!bar) return;
  bar.style.display = 'block';
  bar.textContent   = '⏳ Lade Wetter und Pollen…';

  const [wetter, dwdRes, omRes] = await Promise.allSettled([
    loadWetter(),
    loadPollenDWD(),
    loadPollenOpenMeteo(),
  ]);

  const msgs = [
    wetter.status === 'fulfilled' ? '✅ Wetter'       : '⚠️ Wetter: '       + wetter.reason,
    dwdRes.status === 'fulfilled' ? '✅ Pollen DWD'   : '⚠️ Pollen DWD: '   + dwdRes.reason,
    omRes.status  === 'fulfilled' ? '✅ Open-Meteo'   : '⚠️ Open-Meteo: '   + omRes.reason,
  ];
  bar.textContent = msgs.join('  ·  ');
  setTimeout(() => { bar.style.display = 'none'; }, 4_000);

  const dwdData = dwdRes.status === 'fulfilled' ? dwdRes.value : [];
  const omData  = omRes.status  === 'fulfilled' ? omRes.value  : [];
  renderPollenSelector(dwdData, omData);
}

// ════════════════════════════════════════════════════════════════
//  WETTER
// ════════════════════════════════════════════════════════════════

async function loadWetter() {
  const cfg   = getCfg();
  const today = new Date().toISOString().slice(0, 10);
  const res   = await fetch(
    `https://api.brightsky.dev/weather?lat=${cfg.lat}&lon=${cfg.lon}&date=${today}&tz=Europe/Berlin`
  );
  if (!res.ok) throw `HTTP ${res.status}`;
  const records = (await res.json()).weather || [];
  if (!records.length) throw 'Keine Daten';

  const temps  = records.map(r => r.temperature).filter(t => t != null);
  const precip = records.map(r => r.precipitation ?? 0);
  const humids = records.map(r => r.relative_humidity).filter(h => h != null);

  setValue('u-temp-min',    Math.round(Math.min(...temps)));
  setValue('u-temp-max',    Math.round(Math.max(...temps)));
  setValue('u-regen',       precip.reduce((a,b)=>a+b,0) > 0.1
    ? Math.round(precip.reduce((a,b)=>a+b,0) * 10) / 10 : 0);
  if (humids.length) setValue('u-luftfeuchtig',
    Math.round(humids.reduce((a,b)=>a+b,0) / humids.length));

  const src = document.getElementById('wetter-source');
  if (src) src.textContent = '(DWD via BrightSky)';
}

// ════════════════════════════════════════════════════════════════
//  POLLEN DWD
// ════════════════════════════════════════════════════════════════

async function loadPollenDWD() {
  const cfg  = getCfg();
  const data = await fetchWithProxies(DWD_URL);
  const region = (data.content || []).find(r => r.region_id === cfg.pollenRegion);
  if (!region) throw `Region ${cfg.pollenRegion} nicht gefunden`;

  const results = [];
  for (const [key, displayName] of Object.entries(DWD_POLLEN_NAMES)) {
    const raw      = region.Pollen?.[key]?.today;
    const levelNum = DWD_LEVEL_NUM[raw] ?? -1;
    if (levelNum < 0) continue;
    results.push({
      name: displayName, source: 'DWD',
      level: DWD_LEVEL_LABELS[raw] || raw,
      levelNum, rawLevel: raw,
    });
  }
  return results;
}

// ════════════════════════════════════════════════════════════════
//  POLLEN OPEN-METEO
// ════════════════════════════════════════════════════════════════

async function loadPollenOpenMeteo() {
  const cfg    = getCfg();
  const fields = OM_POLLEN_FIELDS.map(f => f.key).join(',');
  const res    = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${cfg.lat}&longitude=${cfg.lon}` +
    `&hourly=${fields}&timezone=Europe%2FBerlin&forecast_days=1`
  );
  if (!res.ok) throw `HTTP ${res.status}`;
  const data = await res.json();

  const results = [];
  for (const field of OM_POLLEN_FIELDS) {
    const hourly   = data.hourly?.[field.key] || [];
    const maxVal   = Math.max(...hourly.filter(v => v !== null));
    const levelNum = omLevelNum(isFinite(maxVal) ? maxVal : 0);
    if (levelNum <= 0) continue;
    results.push({
      name: field.name, source: 'Open-Meteo',
      level: omLevelLabel(maxVal),
      levelNum, rawVal: Math.round(maxVal),
    });
  }
  return results;
}

// ════════════════════════════════════════════════════════════════
//  POLLEN AUSWAHL-UI
// ════════════════════════════════════════════════════════════════

function levelColor(num) {
  if (num >= 3)  return '#e76f51';
  if (num >= 2)  return '#f59e0b';
  if (num >= 1)  return '#40916c';
  return 'var(--sub)';
}

function renderPollenSelector(dwdData, omData) {
  // Alte UI entfernen
  document.getElementById('pollen-selector')?.remove();

  // Alle Pollen-Namen vereinigen (DWD + Open-Meteo + Custom)
  const customPollen = getCustomPollen();
  const allNames = [...new Set([
    ...dwdData.map(p => p.name),
    ...omData.map(p => p.name),
  ])].sort();

  // Custom-Pollen die noch nicht in allNames sind separat
  const customOnly = customPollen.filter(n => !allNames.includes(n));

  if (!allNames.length && !customOnly.length) {
    setValue('u-pollen', 'keine erhöhte Belastung');
    const src = document.getElementById('pollen-source');
    if (src) src.textContent = '(DWD + Open-Meteo)';
    return;
  }

  const pollenField = document.getElementById('u-pollen')?.closest('.field');
  if (!pollenField) return;

  const container = document.createElement('div');
  container.id = 'pollen-selector';
  container.style.cssText = `
    background:var(--bg2);border:1px solid var(--border);
    border-radius:var(--radius);padding:12px;margin-bottom:1.25rem;
  `;

  // Buttons für API-Pollenarten
  const btnsHtml = allNames.map(name => {
    const dwd  = dwdData.find(p => p.name === name);
    const om   = omData.find(p  => p.name === name);
    const best = dwd || om;
    const col  = levelColor(best.levelNum);

    return `<button
      class="pollen-select-btn"
      data-name="${name}"
      data-level="${best.level}"
      data-levelnum="${best.levelNum}"
      style="padding:10px 8px;border-radius:var(--radius-sm);border:2px solid ${col};
        background:var(--bg);color:var(--text);cursor:pointer;text-align:left;
        font-family:inherit;transition:all .15s;">
      <div style="font-size:13px;font-weight:600;margin-bottom:3px">${name}</div>
      ${dwd ? `<div style="font-size:10px;color:${levelColor(dwd.levelNum)}">
        DWD: ${dwd.level}</div>` : ''}
      ${om  ? `<div style="font-size:10px;color:${levelColor(om.levelNum)}">
        Open-Meteo: ${om.level} (${om.rawVal} gr/m³)</div>` : ''}
    </button>`;
  }).join('');

  // Buttons für Custom-Pollen (manuelle Stufenwahl)
  const customBtnsHtml = customOnly.length ? `
    <div style="grid-column:1/-1;font-size:10px;font-weight:700;text-transform:uppercase;
      letter-spacing:.04em;color:var(--sub);margin-top:8px;margin-bottom:2px">
      Eigene Pollenarten (manuell)
    </div>
    ${customOnly.map(name => `
      <div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;
        padding:8px;border-radius:var(--radius-sm);border:2px solid var(--border);
        background:var(--bg)">
        <span style="flex:1;font-size:13px;font-weight:600">🌿 ${name}</span>
        <select class="pollen-custom-level" data-name="${name}"
          style="padding:5px 8px;font-size:12px;border:1px solid var(--border);
            border-radius:4px;background:var(--bg);color:var(--text);font-family:inherit">
          <option value="-1">– nicht erfassen</option>
          <option value="1">1 – gering</option>
          <option value="2">2 – gering–mittel</option>
          <option value="3">3 – mittel</option>
          <option value="4">4 – mittel–stark</option>
          <option value="5">5 – stark</option>
        </select>
      </div>`).join('')}` : '';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;
        letter-spacing:.05em;color:var(--c2)">
        🌿 Pollen auswählen
      </div>
      <button onclick="WETTER.showPollenManager()"
        style="padding:4px 10px;font-size:11px;border:1px solid var(--border);
          border-radius:4px;background:var(--bg);color:var(--sub);
          cursor:pointer;font-family:inherit">⚙️ Verwalten</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      ${btnsHtml}
      ${customBtnsHtml}
    </div>
    <div style="display:flex;gap:8px">
      <button id="pollen-all"
        style="flex:1;padding:8px;font-size:12px;border:1px solid var(--border);
          border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);
          cursor:pointer;font-family:inherit">✓ Alle</button>
      <button id="pollen-none"
        style="flex:1;padding:8px;font-size:12px;border:1px solid var(--border);
          border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);
          cursor:pointer;font-family:inherit">✗ Keine</button>
      <button id="pollen-apply"
        style="flex:2;padding:8px;font-size:13px;font-weight:600;border:none;
          border-radius:var(--radius-sm);background:var(--c2);color:#fff;
          cursor:pointer;font-family:inherit">↓ Übernehmen</button>
    </div>
  `;

  pollenField.after(container);

  // Event-Listener API-Pollen
  container.querySelectorAll('.pollen-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = btn.dataset.selected === '1';
      active ? deactivateBtn(btn) : activateBtn(btn);
    });
    // Vorauswahl: alles mit Stärke ≥ mittel
    if (parseInt(btn.dataset.levelnum) >= 2) activateBtn(btn);
  });

  document.getElementById('pollen-all').addEventListener('click', () => {
    container.querySelectorAll('.pollen-select-btn').forEach(activateBtn);
    container.querySelectorAll('.pollen-custom-level').forEach(sel => {
      if (sel.value === '-1') sel.value = '3'; // mittel als Standard
    });
  });
  document.getElementById('pollen-none').addEventListener('click', () => {
    container.querySelectorAll('.pollen-select-btn').forEach(deactivateBtn);
    container.querySelectorAll('.pollen-custom-level').forEach(sel => { sel.value = '-1'; });
  });
  document.getElementById('pollen-apply').addEventListener('click', async () => {
    const selected = [...container.querySelectorAll('.pollen-select-btn[data-selected="1"]')];

    // Custom-Pollen mit gewählter Stufe sammeln
    const customSelected = [...container.querySelectorAll('.pollen-custom-level')]
      .filter(sel => parseInt(sel.value) > 0)
      .map(sel => ({
        dataset: { name: sel.dataset.name, level: ['','gering','gering–mittel','mittel','mittel–stark','stark'][parseInt(sel.value)] || sel.value, levelnum: sel.value, source: 'manuell' },
      }));

    const allSelected = [...selected, ...customSelected];

    setValue('u-pollen', allSelected.length
      ? allSelected.map(b => `${b.dataset.name} (${b.dataset.level})`).join(', ')
      : 'keine erhöhte Belastung'
    );
    const src = document.getElementById('pollen-source');
    if (src) src.textContent = '(DWD + Open-Meteo)';
    container.remove();

    // ── Pollen_Log schreiben (optional – Sheet muss existieren) ─
    if (allSelected.length) {
      _writePollenLog(allSelected).catch(e =>
        console.warn('Pollen_Log write failed (Sheet noch nicht angelegt?):', e.message)
      );
    }
  });
}

function activateBtn(btn) {
  btn.dataset.selected = '1';
  btn.style.background = 'var(--c4)';
}
function deactivateBtn(btn) {
  btn.dataset.selected = '0';
  btn.style.background = 'var(--bg)';
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

async function fetchWithProxies(targetUrl) {
  for (const buildUrl of PROXIES) {
    try {
      const res    = await fetch(buildUrl(targetUrl), { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const text   = await res.text();
      const parsed = JSON.parse(text);
      const data   = parsed.contents ? JSON.parse(parsed.contents) : parsed;
      if (data?.content) return data;
    } catch (e) { /* nächsten Proxy */ }
  }
  throw 'CORS-Proxy nicht erreichbar';
}

// ════════════════════════════════════════════════════════════════
//  POLLEN_LOG SCHREIBEN
// ════════════════════════════════════════════════════════════════

/**
 * Ausgewählte Pollen-Einträge in die Pollen_Log Tabelle schreiben.
 * Jede Pollenart bekommt eine eigene Zeile.
 *
 * Mapping DWD/Open-Meteo levelNum → Pollen_Log-Stufe (0–5):
 *   DWD:        0=keine, 0.5=keine–gering, 1=gering, 1.5=gering–mittel,
 *               2=mittel, 2.5=stark, 3=sehr stark
 *   Open-Meteo: 0=keine, 1=gering, 2=mittel, 3=stark, 4=sehr stark
 * → Wir runden auf ganzzahlige 0–5 Stufe.
 *
 * Wird still aufgerufen – Fehler werden nur geloggt, nicht angezeigt.
 * Sheet muss bereits existieren (Pollen_Log in Hund_Tagebuch).
 *
 * @param {HTMLElement[]} selectedBtns - Ausgewählte .pollen-select-btn Elemente
 */
async function _writePollenLog(selectedBtns) {
  const cfg    = getCfg();
  const tid    = cfg.tagebuchId;
  if (!tid) return;

  // Hund-ID aus dem Tagebuch-Select lesen
  const hundId = parseInt(document.getElementById('tb-hund-select')?.value) || 1;

  // Heutiges Datum in DD.MM.YYYY
  const now  = new Date();
  const pad  = n => String(n).padStart(2, '0');
  const datum = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  const iso   = now.toISOString().slice(0, 19);

  // Für jede ausgewählte Pollenart eine Zeile schreiben
  for (const btn of selectedBtns) {
    const pollenart = btn.dataset.name  || '';
    const levelNum  = parseFloat(btn.dataset.levelnum ?? -1);
    const source    = btn.dataset.source || 'DWD + Open-Meteo';

    // levelNum → ganzzahlige Stufe 0–5
    // DWD-Stufen können 0.5-Schritte haben → aufrunden
    const stufe = levelNum < 0 ? 0 : Math.min(5, Math.ceil(levelNum));

    if (!pollenart || stufe <= 0) continue;

    await appendRow('Pollen_Log', [
      '',        // entry_id – wird leer gelassen (auto-increment wäre nice-to-have)
      hundId,    // hund_id
      datum,     // datum DD.MM.YYYY
      pollenart, // pollenart
      stufe,     // stufe 0–5
      source,    // source
      iso,       // created_at
    ], tid);
  }
}
