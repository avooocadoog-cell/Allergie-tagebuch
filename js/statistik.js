/**
 * MODULE: statistik.js
 * Statistik & Korrelationsanalyse – nutzt cache.js für alle Reads.
 *
 * Spalten-Mapping (positional, Daten ab Zeile 3):
 *   Symptomtagebuch:  [0]hund_id [1]datum [2]kategorie [3]beschreibung [4]schweregrad [5]koerper [6]notizen
 *   Umweltagebuch:    [0]hund_id [1]datum [2]tempMin [3]tempMax [4]feuchtig [5]regen [6]pollen [7]raumtemp [8]raumfeuchtig [9]bett [10]notizen
 *   Futtertagebuch:   [0]hund_id [1]datum [2]futter [3]produkt [4]erstegabe [5]zweiwo [6]provokation [7]beschreibung [8]notizen
 *   Ausschlussdiät:   [0]hund_id [1]zutat [2]verdacht [3]kategorie [4]status [5]datum [6]reaktion [7]notizen
 *   Bekannte Allergene:[0]hund_id [1]allergen [2]kategorie [3]reaktion [4]symptome [5]notizen
 *   Medikamente:      [0]hund_id [1]name [2]typ [3]dosierung [4]haeufigkeit [5]von [6]bis [7]verordnet [8]notizen
 */

import { getSheet, preloadAll, invalidateAll, isCached, getAge } from './cache.js';
import { getHunde } from './store.js';
import { esc }      from './ui.js';

const _charts = {};
const C = {
  green:'#40916c', greenL:'rgba(64,145,108,.2)',
  orange:'#e76f51', orangeL:'rgba(231,111,81,.2)',
  amber:'#f59e0b',  amberL:'rgba(245,158,11,.2)',
  blue:'#3b82f6',   blueL:'rgba(59,130,246,.2)',
  purple:'#8b5cf6', purpleL:'rgba(139,92,246,.2)',
  gray:'#9ca3af',
};

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

export async function load() {
  const panel = document.getElementById('panel-statistik');
  if (!panel) return;

  panel.innerHTML = `
    <div style="padding:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div class="section-title" style="margin-bottom:0">📊 Statistik</div>
        <button onclick="STATISTIK.forceRefresh()"
          style="padding:7px 12px;font-size:12px;border:1px solid var(--border);
            border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);
            cursor:pointer;font-family:inherit" title="Cache leeren und neu laden">
          ↺ Aktualisieren
        </button>
      </div>

      <!-- Hund + Zeitraum -->
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <select id="stat-hund" onchange="STATISTIK.refresh()"
          style="flex:1;padding:10px 12px;font-size:14px;border:1px solid var(--border);
            border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit">
        </select>
        <select id="stat-range" onchange="STATISTIK.refresh()"
          style="width:110px;padding:10px 12px;font-size:14px;border:1px solid var(--border);
            border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:inherit">
          <option value="30">30 Tage</option>
          <option value="90" selected>90 Tage</option>
          <option value="180">6 Monate</option>
          <option value="365">1 Jahr</option>
          <option value="0">Alles</option>
        </select>
      </div>

      <!-- Cache-Status -->
      <div id="stat-cache-status"
        style="font-size:11px;color:var(--sub);margin-bottom:1rem;padding:6px 10px;
          background:var(--bg2);border-radius:var(--radius-sm);border:1px solid var(--border)">
        Wird geladen…
      </div>

      <div id="stat-content">
        <div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>
      </div>
    </div>
  `;

  // Hunde befüllen
  const hundSel = document.getElementById('stat-hund');
  getHunde().forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.hund_id; opt.textContent = h.name;
    hundSel.appendChild(opt);
  });

  refresh();
}

export async function refresh(forceRefresh = false) {
  const hundId    = parseInt(document.getElementById('stat-hund')?.value)  || 1;
  const rangeDays = parseInt(document.getElementById('stat-range')?.value) || 90;
  const content   = document.getElementById('stat-content');
  const cacheEl   = document.getElementById('stat-cache-status');
  if (!content) return;

  _destroyCharts();
  content.innerHTML = '<div class="view-loading"><div class="spinner"></div>Lade Daten…</div>';

  try {
    // Alle 6 Sheets über Cache laden
    const [rSym, rUmw, rFut, rAus, rAll, rMed] = await Promise.all([
      getSheet('Symptomtagebuch',  'tagebuch', forceRefresh),
      getSheet('Umweltagebuch',    'tagebuch', forceRefresh),
      getSheet('Futtertagebuch',   'tagebuch', forceRefresh),
      getSheet('Ausschlussdiät',   'tagebuch', forceRefresh),
      getSheet('Bekannte Allergene','tagebuch', forceRefresh),
      getSheet('Medikamente',      'tagebuch', forceRefresh),
    ]);

    // Cache-Status anzeigen
    const age = getAge('Symptomtagebuch');
    if (cacheEl) {
      cacheEl.textContent = age !== null && age < 30
        ? `✅ Daten gerade geladen · nächste Aktualisierung in ~${Math.round((600-age)/60)} Min`
        : age !== null
        ? `📦 Cache vom vor ${age < 60 ? age + ' Sek' : Math.round(age/60) + ' Min'} · ↺ für neue Daten`
        : '✅ Frisch geladen';
    }

    // Zeitraum-Filter
    const cutoff = rangeDays > 0 ? new Date(Date.now() - rangeDays*86_400_000) : new Date(0);

    // Positionales Parsen (ab Zeile 3, Index 2)
    const allSym = parseRows(rSym,  2);
    const allUmw = parseRows(rUmw,  2);
    const allFut = parseRows(rFut,  2);
    const allAus = parseRows(rAus,  2);
    const allAll = parseRows(rAll,  2);
    const allMed = parseRows(rMed,  2);

    const sym = allSym.filter(r => matchHund(r,hundId) && inRange(col(r,1), cutoff));
    const umw = allUmw.filter(r => matchHund(r,hundId) && inRange(col(r,1), cutoff));
    const fut = allFut.filter(r => matchHund(r,hundId) && inRange(col(r,1), cutoff));
    const aus = allAus.filter(r => matchHund(r,hundId));
    const all = allAll.filter(r => matchHund(r,hundId));
    const med = allMed.filter(r => matchHund(r,hundId));

    content.innerHTML = buildHTML();
    await renderCharts({ sym, umw, fut, aus, all, med });

  } catch(e) {
    content.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export function forceRefresh() {
  invalidateAll();
  refresh(true);
}

// ════════════════════════════════════════════════════════════════
//  HTML GERÜST
// ════════════════════════════════════════════════════════════════

function buildHTML() {
  return `
    <div id="stat-kpis" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem"></div>
    ${box('📈 Symptom-Schweregrad Verlauf',  '<canvas id="ch-verlauf"  height="200"></canvas>')}
    ${box('🔍 Häufigste Symptome',           '<canvas id="ch-haeufig" height="220"></canvas>')}
    ${box('⚠️ Bekannte Allergene',           '<div id="st-allergene"></div>')}
    ${box('📋 Ausschlussdiät',
      `<div id="st-aus-badges" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
       <canvas id="ch-aus" height="160"></canvas>`)}
    ${box('🌿 Pollen & Symptome (wöchentlich)',
      `<p style="font-size:12px;color:var(--sub);margin-bottom:8px">Pollentage vs Symptomtage vs Schweregrad</p>
       <canvas id="ch-pollen" height="200"></canvas>`)}
    ${box('🌡️ Außenklima & Symptome',        '<canvas id="ch-wetter"  height="200"></canvas>')}
    ${box('🏠 Raumklima',                    '<canvas id="ch-raumklima" height="180"></canvas>')}
    ${box('🥩 Futter-Reaktionen',            '<div id="st-futter"></div>')}
    ${box('💊 Medikamente',                  '<div id="st-medis"></div>')}
  `;
}

function box(title, body) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);
    border-radius:var(--radius);padding:14px;margin-bottom:1rem">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">${title}</div>
    ${body}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  CHARTS
// ════════════════════════════════════════════════════════════════

async function renderCharts({ sym, umw, fut, aus, all, med }) {
  if (!window.Chart) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');
  }

  // ── KPIs ────────────────────────────────────────────────────
  const schweList = sym.map(r => parseInt(col(r,4))||0).filter(v=>v>0);
  const avgSchw   = schweList.length ? (schweList.reduce((a,b)=>a+b,0)/schweList.length).toFixed(1) : '–';
  const symDays   = new Set(sym.map(r=>col(r,1))).size;
  const polDays   = umw.filter(r => col(r,6) && col(r,6) !== 'keine erhöhte Belastung').length;
  document.getElementById('stat-kpis').innerHTML =
    kpi('Symptomtage', symDays, C.orange) +
    kpi('Ø Schweregrad', avgSchw, parseFloat(avgSchw)>=3 ? C.orange : C.green) +
    kpi('Pollentage', polDays, C.amber);

  // ── Verlauf ──────────────────────────────────────────────────
  {
    const byDate = {};
    sym.forEach(r => {
      const d = col(r,1); if(!d) return;
      const iso = toISO(d);
      byDate[iso] = Math.max(byDate[iso]||0, parseInt(col(r,4))||0);
    });
    const dates = Object.keys(byDate).sort();
    mkChart('ch-verlauf','line',{
      labels: dates.map(fmtLabel),
      datasets:[{
        label:'Max. Schweregrad',
        data: dates.map(d=>byDate[d]),
        borderColor:C.orange, backgroundColor:C.orangeL,
        fill:true, tension:0.3, pointRadius:3,
      }]
    }, baseOpts({max:5, stepSize:1}));
  }

  // ── Häufigste Symptome ───────────────────────────────────────
  {
    const cnt = {};
    sym.forEach(r => {
      (col(r,2)||'').split(',').map(s=>s.trim()).filter(Boolean)
        .forEach(k => { cnt[k]=(cnt[k]||0)+1; });
    });
    const sorted = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (sorted.length) {
      mkChart('ch-haeufig','bar',{
        labels: sorted.map(([k])=>k),
        datasets:[{ label:'Häufigkeit', data:sorted.map(([,v])=>v),
          backgroundColor:sorted.map((_,i)=>i===0?C.orange:i<3?C.amber:C.green) }]
      }, {...baseOpts(), indexAxis:'y'});
    } else {
      setText('ch-haeufig', 'Keine Symptome im Zeitraum.');
    }
  }

  // ── Allergene ────────────────────────────────────────────────
  {
    const el = document.getElementById('st-allergene');
    el.innerHTML = all.length ? all.map(r => {
      const reakt = parseInt(col(r,3))||0;
      const col2  = reakt>=4?C.orange:reakt>=3?C.amber:C.green;
      return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:600">${esc(col(r,1))}</div>
          <div style="font-size:12px;color:var(--sub)">${esc(col(r,2))} · ${esc(col(r,4))}</div>
        </div>
        <div style="font-size:18px;color:${col2};letter-spacing:2px">
          ${'●'.repeat(reakt)}${'○'.repeat(5-reakt)}
        </div>
      </div>`;
    }).join('') : '<p style="color:var(--sub);font-size:13px">Keine Allergene erfasst.</p>';
  }

  // ── Ausschluss ───────────────────────────────────────────────
  {
    const badges = document.getElementById('st-aus-badges');
    const groups = {};
    aus.forEach(r => { const s=col(r,4)||'Unbekannt'; (groups[s]=groups[s]||[]).push(col(r,1)); });
    badges.innerHTML = Object.entries(groups).map(([s,items]) => {
      const c = s.includes('vertr')?C.green:s.includes('Reaktion')||s.includes('Gesperrt')?C.orange:C.amber;
      return `<div style="width:100%;margin-bottom:4px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${c};margin-bottom:3px">${esc(s)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${items.map(z=>`<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${esc(z)}</span>`).join('')}
        </div>
      </div>`;
    }).join('') || '<p style="color:var(--sub);font-size:13px">Keine Ausschlussdiät-Einträge.</p>';

    if (aus.length) {
      const cnt = {}; aus.forEach(r=>{const s=col(r,4)||'Unbekannt';cnt[s]=(cnt[s]||0)+1;});
      mkChart('ch-aus','doughnut',{
        labels: Object.keys(cnt),
        datasets:[{ data:Object.values(cnt),
          backgroundColor:Object.keys(cnt).map(s=>
            s.includes('vertr')?C.green:s.includes('Reaktion')||s.includes('Gesperrt')?C.orange:s.includes('Test')?C.amber:C.blue)
        }]
      },{plugins:{legend:{position:'right'}},cutout:'60%'});
    }
  }

  // ── Pollen-Korrelation ───────────────────────────────────────
  {
    const weeks = {};
    umw.forEach(r => {
      const d=parseDate(col(r,1)); if(!d) return;
      const w=weekKey(d);
      if(!weeks[w]) weeks[w]={pollen:0,symDays:0,maxSchw:0};
      if(col(r,6)&&col(r,6)!=='keine erhöhte Belastung'&&col(r,6)!=='') weeks[w].pollen++;
    });
    sym.forEach(r => {
      const d=parseDate(col(r,1)); if(!d) return;
      const w=weekKey(d);
      if(!weeks[w]) weeks[w]={pollen:0,symDays:0,maxSchw:0};
      weeks[w].symDays++;
      weeks[w].maxSchw=Math.max(weeks[w].maxSchw,parseInt(col(r,4))||0);
    });
    const wks = Object.keys(weeks).sort();
    if (wks.length) {
      mkChart('ch-pollen','bar',{
        labels:wks.map(w=>'KW'+w.split('-W')[1]+'/'+w.split('-W')[0].slice(2)),
        datasets:[
          {label:'Pollentage',    data:wks.map(w=>weeks[w].pollen),  backgroundColor:C.amberL,  borderColor:C.amber,  borderWidth:1, yAxisID:'y'},
          {label:'Symptomtage',   data:wks.map(w=>weeks[w].symDays), backgroundColor:C.orangeL, borderColor:C.orange, borderWidth:1, yAxisID:'y'},
          {label:'Max. Schweregrad',data:wks.map(w=>weeks[w].maxSchw),type:'line',
           borderColor:C.purple,backgroundColor:'transparent',borderWidth:2,pointRadius:3,yAxisID:'y2'},
        ]
      },{
        ...baseOpts(),
        scales:{
          y: {beginAtZero:true,position:'left', title:{display:true,text:'Tage'}},
          y2:{beginAtZero:true,max:5,position:'right',title:{display:true,text:'Schweregrad'},grid:{drawOnChartArea:false}},
        }
      });
    } else { setText('ch-pollen','Keine Daten im Zeitraum.'); }
  }

  // ── Wetter + Symptome ────────────────────────────────────────
  {
    const byDate = {};
    umw.forEach(r => {
      const iso = toISO(col(r,1)); if(!iso) return;
      byDate[iso]={...byDate[iso], tMax:parseFloat(col(r,3))||null, feuchtig:parseFloat(col(r,4))||null};
    });
    sym.forEach(r => {
      const iso = toISO(col(r,1)); if(!iso) return;
      if(!byDate[iso]) byDate[iso]={};
      byDate[iso].schw = Math.max(byDate[iso].schw||0, parseInt(col(r,4))||0);
    });
    const dates = Object.keys(byDate).sort();
    if (dates.length) {
      mkChart('ch-wetter','line',{
        labels:dates.map(fmtLabel),
        datasets:[
          {label:'Temp. Max (°C)',    data:dates.map(d=>byDate[d].tMax),    borderColor:C.orange, backgroundColor:'transparent',tension:0.3,pointRadius:0,yAxisID:'y'},
          {label:'Luftfeuchtig. (%)', data:dates.map(d=>byDate[d].feuchtig),borderColor:C.blue,   backgroundColor:'transparent',tension:0.3,pointRadius:0,yAxisID:'y'},
          {label:'Schweregrad',       data:dates.map(d=>byDate[d].schw||null),borderColor:C.purple,backgroundColor:C.purpleL,
           fill:true,tension:0.3,pointRadius:3,yAxisID:'y2'},
        ]
      },{
        ...baseOpts(),
        scales:{
          y: {beginAtZero:false,position:'left'},
          y2:{beginAtZero:true,max:5,position:'right',grid:{drawOnChartArea:false}},
        }
      });
    } else { setText('ch-wetter','Keine Wetterdaten im Zeitraum.'); }
  }

  // ── Raumklima ────────────────────────────────────────────────
  {
    const rData = umw
      .filter(r=>col(r,7)||col(r,8))
      .map(r=>({iso:toISO(col(r,1)), temp:parseFloat(col(r,7))||null, feuchtig:parseFloat(col(r,8))||null}))
      .filter(r=>r.iso).sort((a,b)=>a.iso.localeCompare(b.iso));
    if (rData.length) {
      mkChart('ch-raumklima','line',{
        labels:rData.map(r=>fmtLabel(r.iso)),
        datasets:[
          {label:'Raumtemperatur (°C)',  data:rData.map(r=>r.temp),    borderColor:C.orange,backgroundColor:'transparent',tension:0.3,pointRadius:2},
          {label:'Raumluftfeucht. (%)',  data:rData.map(r=>r.feuchtig),borderColor:C.blue,  backgroundColor:'transparent',tension:0.3,pointRadius:2},
        ]
      }, baseOpts());
    } else { setText('ch-raumklima','Keine Raumklima-Daten im Zeitraum.'); }
  }

  // ── Futter-Reaktionen ────────────────────────────────────────
  {
    const el = document.getElementById('st-futter');
    const reakt = fut.filter(r=>col(r,7)||col(r,6)==='Ja');
    el.innerHTML = reakt.length ? reakt.map(r=>`
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:13px;font-weight:600">${esc(col(r,1))}</div>
          ${col(r,6)==='Ja'?'<span class="badge badge-warn">⚠️ Provokation</span>':col(r,4)==='Ja'?'<span class="badge badge-ok">Erste Gabe</span>':''}
        </div>
        ${col(r,3)?`<div style="font-size:12px;color:var(--sub)">${esc(col(r,3))}</div>`:''}
        ${col(r,7)?`<div style="font-size:13px;margin-top:4px">${esc(col(r,7))}</div>`:''}
      </div>`).join('')
      : '<p style="color:var(--sub);font-size:13px">Keine Reaktionen im Zeitraum.</p>';
  }

  // ── Medikamente ──────────────────────────────────────────────
  {
    const el = document.getElementById('st-medis');
    el.innerHTML = med.length ? med.map(r=>`
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:600">${esc(col(r,1))}</div>
          <div style="font-size:12px;color:var(--sub)">${esc(col(r,2))} · ${esc(col(r,3))}</div>
        </div>
        <div style="font-size:12px;color:var(--sub);text-align:right">
          ${esc(col(r,5)||'?')}<br>bis ${esc(col(r,6)||'laufend')}
        </div>
      </div>`).join('')
      : '<p style="color:var(--sub);font-size:13px">Keine Medikamente erfasst.</p>';
  }
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

// Positionale Zeilen-Zugriff
const col = (row, i) => (row[i] ?? '').toString().trim();

// Zeilen ab skipRows parsen (kein Header-Mapping, roh)
function parseRows(rawRows, skipRows) {
  if (!rawRows?.length) return [];
  return rawRows.slice(skipRows)
    .filter(r => r?.some(v => v !== null && v !== undefined && String(v).trim() !== ''));
}

function matchHund(row, hundId) {
  return !col(row,0) || col(row,0) === String(hundId);
}

// DD.MM.YYYY → Date
function parseDate(str) {
  if (!str) return null;
  if (str.includes('.')) {
    const [d,m,y] = str.split('.');
    const yr = y?.length===2 ? '20'+y : y;
    const date = new Date(parseInt(yr), parseInt(m)-1, parseInt(d));
    return isNaN(date.getTime()) ? null : date;
  }
  if (str.includes('-')) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toISO(str) {
  const d = parseDate(str);
  return d ? d.toISOString().slice(0,10) : null;
}

function inRange(datum, cutoff) {
  const d = parseDate(datum);
  return d && d >= cutoff;
}

function fmtLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}

function weekKey(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  const w1 = new Date(d.getFullYear(),0,4);
  const wn = 1+Math.round(((d-w1)/86400000-3+(w1.getDay()+6)%7)/7);
  return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`;
}

function kpi(label, value, color) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    padding:12px;text-align:center">
    <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${label}</div>
  </div>`;
}

function baseOpts({max,stepSize}={}) {
  return {
    responsive:true,
    plugins:{legend:{display:true,labels:{boxWidth:12,font:{size:11}}}},
    scales:{
      x:{ticks:{font:{size:10},maxTicksLimit:8}},
      y:{beginAtZero:true,...(max?{max}:{}),ticks:{stepSize:stepSize||undefined,font:{size:10}}},
    }
  };
}

function mkChart(id, type, data, options) {
  const el = document.getElementById(id);
  if (!el) return;
  _destroyChart(id);
  _charts[id] = new window.Chart(el.getContext('2d'), {type, data, options});
}

function setText(id, msg) {
  const el = document.getElementById(id);
  if (el) el.insertAdjacentHTML('afterend',
    `<p style="color:var(--sub);font-size:13px;text-align:center;padding:.75rem">${msg}</p>`);
}

function _destroyChart(id) {
  if (_charts[id]) { try { _charts[id].destroy(); } catch(e){} delete _charts[id]; }
}

function _destroyCharts() {
  Object.keys(_charts).forEach(_destroyChart);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src=src; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}
