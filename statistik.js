/**
 * MODULE: statistik.js  (v7 – Korrelationsanalyse Umweltfaktoren vs. Schweregrad)
 *
 * Konfigurierbarer Mixed-Chart.
 * Y-Links  (y):  Temperatur °C, Luftfeuchtigkeit %, Gewicht kg
 * Y-Rechts (y2): Schweregrad 0–5 (rotes Flächenband), Pollen-Stufe 0–5
 *
 * Neu in v7:
 * - Sektion "🔗 Korrelationsanalyse": Verknüpft Umweltagebuch + Pollen_Log mit
 *   Symptomtagebuch über das Datum; berechnet Avg/Max Schweregrad je Faktorgruppe.
 *   Faktoren: Pollenarten (0/gering/mittel/stark), Aussentemp (4 Gruppen),
 *   Luftfeuchte (4 Gruppen). Min. 3 Datenpunkte/Gruppe; Gruppen mit Avg > 2.0 orange.
 *   Ein-/ausklappbar; nur wenn mind. 1 Faktor mit auswertbaren Daten vorhanden.
 */

import { getSheet, invalidateAll, getAge } from './cache.js';
import { getHunde }                         from './store.js';
import { esc }                              from './ui.js';

const C = {
  blue:'#3b82f6',   blueL:'rgba(59,130,246,.15)',
  orange:'#f97316', orangeL:'rgba(249,115,22,.15)',
  amber:'#f59e0b',  amberL:'rgba(245,158,11,.15)',
  green:'#22c55e',  greenL:'rgba(34,197,94,.15)',
  red:'#ef4444',    redL:'rgba(239,68,68,.18)',
  purple:'#a855f7', purpleL:'rgba(168,85,247,.15)',
  teal:'#14b8a6',   tealL:'rgba(20,184,166,.15)',
  sky:'#0ea5e9',    skyL:'rgba(14,165,233,.15)',
};

let _chart      = null;
let _selected   = new Set(['temp_band','symptome']);
let _cachedData = null;
const POLLEN_COLORS = [C.green,C.amber,C.teal,C.sky,C.orange,C.purple,'#10b981','#6366f1'];
let _pollenTypes    = [];
let _selPollenTypes = new Set();

function _getCustomPollen() {
  try { return JSON.parse(localStorage.getItem('hundapp_custom_pollen') || '[]'); }
  catch { return []; }
}
function _getAllPollenTypes() {
  return [...new Set([..._pollenTypes, ..._getCustomPollen()])].sort();
}

const PARAM_DEFS = [
  {
    key:'temp_band', label:'Temp. Band (Min–Max)', emoji:'🌡',
    color:C.orange, colorL:'rgba(249,115,22,.12)', yAxis:'y', chartType:'band',
    extract:({umw})=>({
      max:_byDate(umw,1,r=>parseFloat(g(r,3)),Math.max),
      min:_byDate(umw,1,r=>parseFloat(g(r,2)),Math.min),
    }),
  },
  {
    key:'temp_in', label:'Temp. innen (°C)', emoji:'🏠',
    color:C.amber, colorL:C.amberL, yAxis:'y',
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,7))),
  },
  {
    key:'feuchte_aus', label:'Feuchte außen (%)', emoji:'💧',
    color:C.sky, colorL:C.skyL, yAxis:'y', dashed:true,
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,4))),
  },
  {
    key:'feuchte_in', label:'Feuchte innen (%)', emoji:'🏠',
    color:C.teal, colorL:C.tealL, yAxis:'y', dashed:true,
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,8))),
  },
  {
    key:'regen', label:'Niederschlag (mm)', emoji:'🌧',
    color:'#3b82f6', colorL:'rgba(59,130,246,.18)', yAxis:'y', chartType:'bar_param',
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,5)),((a,b)=>a+b)),
  },
  {
    key:'symptome', label:'Schweregrad Symptome (0–5)', emoji:'🔍',
    color:C.red, colorL:'rgba(239,68,68,.22)', yAxis:'y2', chartType:'area',
    extract:({sym})=>_byDate(sym,1,r=>parseInt(g(r,4)),Math.max),
  },
  {
    key:'gewicht', label:'Gewicht (kg)', emoji:'⚖️',
    color:C.purple, colorL:C.purpleL, yAxis:'y',
    extract:({gew})=>_byDate(gew||[],2,r=>parseFloat(String(g(r,3)).replace(',','.'))),
  },
];

export async function load() {
  const panel = document.getElementById('panel-statistik');
  if (!panel) return;
  panel.innerHTML = _buildShell();
  const hundSel = document.getElementById('stat-hund');
  getHunde().forEach(h=>{
    const opt=document.createElement('option');
    opt.value=h.hund_id; opt.textContent=h.name;
    hundSel?.appendChild(opt);
  });
  _buildParamButtons();
  refresh();
}

export async function refresh(forceRefresh=false) {
  const hundId    = parseInt(document.getElementById('stat-hund')?.value)||1;
  const rangeDays = parseInt(document.getElementById('stat-range')?.value)||90;
  const content   = document.getElementById('stat-content');
  const cacheEl   = document.getElementById('stat-cache-status');
  if(!content) return;
  content.innerHTML='<div class="view-loading"><div class="spinner"></div>Lade Daten…</div>';
  try {
    const [rSym,rUmw,rFut,rMed] = await Promise.all([
      getSheet('Symptomtagebuch',   'tagebuch',forceRefresh),
      getSheet('Umweltagebuch',     'tagebuch',forceRefresh),
      getSheet('Futtertagebuch',    'tagebuch',forceRefresh),
      getSheet('Medikamente',       'tagebuch',forceRefresh),
    ]);
    const rGew=await getSheet('Hund_Gewicht','tagebuch',forceRefresh).catch(()=>[]);
    const rPol=await getSheet('Pollen_Log',  'tagebuch',forceRefresh).catch(()=>[]);

    const age=getAge('Symptomtagebuch');
    if(cacheEl) cacheEl.textContent = age!==null&&age<30
      ? `✅ Gerade geladen · Aktualisierung in ~${Math.round((600-age)/60)} Min`
      : age!==null
      ? `📦 Cache vor ${age<60?age+'s':Math.round(age/60)+' Min'} · ↺ für neue Daten`
      : '✅ Frisch geladen';

    const cutoff = rangeDays>0 ? new Date(Date.now()-rangeDays*86_400_000) : new Date(0);
    const notDel = idx=>r=>String(r[idx]??'').toUpperCase()!=='TRUE';

    const _pr=(raw,skip)=>_parseRows(raw,skip);
    const allSym=_pr(rSym,2); const allUmw=_pr(rUmw,2);
    const allFut=_pr(rFut,2);
    const allMed=_pr(rMed,2);
    const allGew=_pr(rGew,2); const allPol=_pr(rPol,2);

    const sym=allSym.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(9)(r));
    const umw=allUmw.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(13)(r));
    const fut=allFut.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(11)(r));
    const med=allMed.filter(r=>_matchH(r,hundId)&&notDel(11)(r));
    const gew=allGew.filter(r=>g(r,1)===String(hundId)&&_inRange(g(r,2),cutoff));
    const pol=allPol.filter(r=>g(r,1)===String(hundId)&&_inRange(g(r,2),cutoff));

    _cachedData={sym,umw,fut,med,gew,pol};

    const discoveredPollen=[...new Set(pol.map(r=>g(r,3)).filter(Boolean))].sort();
    _pollenTypes=discoveredPollen;
    const allPollenTypes=_getAllPollenTypes();

    // Pollen-Vorauswahl: alle verfügbaren Pollenarten beim ersten Laden aktivieren.
    if(_selPollenTypes.size === 0) {
      allPollenTypes.forEach(t => _selPollenTypes.add(t));
    }
    _buildParamButtons();

    const schweList=sym.map(r=>parseInt(g(r,4))||0).filter(v=>v>0);
    const avgSchw=schweList.length?(schweList.reduce((a,b)=>a+b,0)/schweList.length).toFixed(1):'–';
    const symDays=new Set(sym.map(r=>g(r,1))).size;
    const polDays=pol.length
      ? new Set(pol.map(r=>g(r,2))).size
      : umw.filter(r=>{const p=g(r,6);return p&&p!=='keine erhöhte Belastung'&&p.trim();}).length;

    content.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1rem">
        ${_kpi('Symptomtage',symDays,C.red)}
        ${_kpi('Ø Schweregrad',avgSchw,parseFloat(avgSchw)>=3?C.red:C.green)}
        ${_kpi('Pollentage',polDays,C.amber)}
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
        padding:14px;margin-bottom:1rem">
        <canvas id="ch-konfig" height="240"></canvas>
      </div>
      <div id="st-muster"></div>
      <div id="st-korrelation"></div>
      <div id="st-reaktion"></div>
      ${_box('🥩 Futter-Reaktionen','<div id="st-futter"></div>')}
      ${_box('💊 Medikamente','<div id="st-medis"></div>')}
    `;

    await _buildChart(_cachedData);
    _renderSymptomMuster(sym);
    _renderKorrelation(_cachedData);
    _renderReaktionsscore(fut, sym);
    _renderFutter(fut);
    _renderMedis(med);

  } catch(e) {
    content.innerHTML=`<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export function forceRefresh() { invalidateAll(); _cachedData=null; refresh(true); }

export async function toggleParam(key) {
  _selected.has(key)?_selected.delete(key):_selected.add(key);
  document.querySelectorAll('.stat-param-btn[data-group="param"]').forEach(btn=>{
    btn.classList.toggle('sel',_selected.has(btn.dataset.key));
  });
  if(_cachedData) await _buildChart(_cachedData);
}

// ── Pollen-Popup ─────────────────────────────────────────────────
export function showPollenPopup() {
  document.getElementById('pollen-select-popup')?.remove();
  const allTypes=_getAllPollenTypes();
  if(!allTypes.length){
    alert('Keine Pollen-Daten vorhanden.\nZuerst Pollen im Tagebuch eintragen oder im Wetter-Bereich eigene Pollenarten anlegen (⚙️ Verwalten).');
    return;
  }
  const overlay=document.createElement('div');
  overlay.id='pollen-select-popup';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:8000;display:flex;align-items:flex-end;justify-content:center;';
  const sheet=document.createElement('div');
  sheet.style.cssText='background:var(--bg);border-radius:var(--radius) var(--radius) 0 0;padding:20px 16px 32px;width:100%;max-width:540px;max-height:75vh;overflow-y:auto;box-shadow:0 -4px 24px rgba(0,0,0,.3);';
  const customLS=_getCustomPollen();
  const rows=allTypes.map((t,i)=>{
    const isData=_pollenTypes.includes(t);
    const col=POLLEN_COLORS[i%POLLEN_COLORS.length];
    const badge=isData
      ?`<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:${col}22;color:${col};border:1px solid ${col}44">Daten</span>`
      :`<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:var(--bg2);color:var(--sub);border:1px solid var(--border)">Manuell</span>`;
    const checked=_selPollenTypes.has(t)?'checked':'';
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" data-pollen="${esc(t)}" ${checked} style="width:18px;height:18px;accent-color:${col};cursor:pointer;flex-shrink:0">
      <span style="flex:1;font-size:14px;font-weight:500">🌿 ${esc(t)}</span>${badge}</label>`;
  }).join('');
  sheet.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:700">🌿 Pollen im Chart anzeigen</div>
      <button id="ppc-close" style="padding:6px 12px;font-size:13px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);cursor:pointer;font-family:inherit">✕</button>
    </div>
    <div style="font-size:12px;color:var(--sub);margin-bottom:12px">„Daten" = im Pollen_Log gefunden · „Manuell" = eigene Pollenart aus Wetter-Tab</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button id="ppc-all" style="flex:1;padding:7px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);cursor:pointer;font-family:inherit">✓ Alle</button>
      <button id="ppc-none" style="flex:1;padding:7px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);cursor:pointer;font-family:inherit">✗ Keine</button>
    </div>
    <div id="ppc-rows">${rows}</div>
    <button id="ppc-apply" style="width:100%;margin-top:16px;padding:12px;font-size:14px;font-weight:700;border:none;border-radius:var(--radius-sm);background:var(--c2);color:#fff;cursor:pointer;font-family:inherit">✓ Übernehmen & Chart aktualisieren</button>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  const close=()=>document.getElementById('pollen-select-popup')?.remove();
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.getElementById('ppc-close').addEventListener('click',close);
  document.getElementById('ppc-all').addEventListener('click',()=>{
    sheet.querySelectorAll('input[data-pollen]').forEach(cb=>cb.checked=true);
  });
  document.getElementById('ppc-none').addEventListener('click',()=>{
    sheet.querySelectorAll('input[data-pollen]').forEach(cb=>cb.checked=false);
  });
  document.getElementById('ppc-apply').addEventListener('click',async()=>{
    _selPollenTypes.clear();
    sheet.querySelectorAll('input[data-pollen]:checked').forEach(cb=>_selPollenTypes.add(cb.dataset.pollen));
    _updatePollenBtnLabel();
    close();
    if(_cachedData) await _buildChart(_cachedData);
  });
}

function _updatePollenBtnLabel() {
  const btn=document.getElementById('stat-pollen-btn'); if(!btn) return;
  const all=_getAllPollenTypes();
  const active=[..._selPollenTypes].filter(t=>all.includes(t)).length;
  btn.textContent=`🌿 Pollen (${active}/${all.length})`;
  btn.classList.toggle('sel',active>0);
}

// ════════════════════════════════════════════════════════════════
function _buildShell() {
  return `
  <div style="padding:1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <div class="section-title" style="margin-bottom:0">📊 Statistik</div>
      <button onclick="STATISTIK.forceRefresh()"
        style="padding:7px 12px;font-size:12px;border:1px solid var(--border);
          border-radius:var(--radius-sm);background:var(--bg2);color:var(--sub);
          cursor:pointer;font-family:inherit">↺ Aktualisieren</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
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
    <div id="stat-cache-status"
      style="font-size:11px;color:var(--sub);margin-bottom:1rem;padding:6px 10px;
        background:var(--bg2);border-radius:var(--radius-sm);border:1px solid var(--border)">
      Wird geladen…
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
      padding:12px;margin-bottom:1rem">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
        color:var(--c2);margin-bottom:10px">Parameter auswählen</div>
      <div id="stat-param-btns" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
    <div id="stat-content">
      <div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>
    </div>
  </div>`;
}

function _buildParamButtons() {
  const c=document.getElementById('stat-param-btns'); if(!c) return;
  let html=PARAM_DEFS.map(p=>`
    <button class="stat-param-btn tog-btn${_selected.has(p.key)?' sel':''}"
      data-key="${p.key}" data-group="param"
      onclick="STATISTIK.toggleParam('${p.key}')"
      style="font-size:12px;padding:6px 10px;border-color:${p.color}">
      ${p.emoji} ${p.label}
    </button>`).join('');
  const all=_getAllPollenTypes();
  const active=[..._selPollenTypes].filter(t=>all.includes(t)).length;
  html+=`
    <div style="width:100%;height:1px;background:var(--border);margin:4px 0"></div>
    <button id="stat-pollen-btn"
      class="stat-param-btn tog-btn${active>0?' sel':''}"
      onclick="STATISTIK.showPollenPopup()"
      style="font-size:12px;padding:6px 10px;border-color:${C.green}">
      🌿 Pollen (${active}/${all.length})
    </button>`;
  c.innerHTML=html;
}

async function _buildChart(data) {
  if(!window.Chart) await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');
  const canvas=document.getElementById('ch-konfig'); if(!canvas) return;
  if(_chart){try{_chart.destroy();}catch(e){} _chart=null;}

  const active=PARAM_DEFS.filter(p=>_selected.has(p.key));
  const allPolTypes=_getAllPollenTypes();
  const activePoll=allPolTypes.filter(t=>_selPollenTypes.has(t));

  if(!active.length&&!activePoll.length){
    canvas.style.display='none';
    if(!canvas.nextElementSibling?.classList?.contains('stat-no-data'))
      canvas.insertAdjacentHTML('afterend','<p class="stat-no-data" style="text-align:center;color:var(--sub);font-size:13px;margin-top:8px">Bitte oben mindestens einen Parameter auswählen.</p>');
    return;
  }
  canvas.style.display='';
  document.querySelector('.stat-no-data')?.remove();

  const datasets=[];

  // Pollen-Balken (y2)
  activePoll.forEach((t,i)=>{
    const col=POLLEN_COLORS[(allPolTypes.indexOf(t))%POLLEN_COLORS.length];
    const polMap=_byDate(data.pol.filter(r=>g(r,3)===t),2,r=>parseInt(g(r,4)),Math.max);
    datasets.push({
      label:`🌿 ${t}`,data:null,_map:polMap,type:'bar',
      backgroundColor:col+'aa',borderColor:col,borderWidth:1,yAxisID:'y2',
    });
  });

  // Standard-Parameter
  for(const p of active){
    if(p.chartType==='band'){
      const maps=p.extract(data);
      datasets.push({
        label:'🌡 Temp. Max',data:null,_map:maps.max,type:'line',
        borderColor:C.orange,backgroundColor:'rgba(249,115,22,.12)',
        borderWidth:1.5,pointRadius:0,tension:0.3,fill:'+1',yAxisID:'y',spanGaps:true,
      });
      datasets.push({
        label:'🌡 Temp. Min',data:null,_map:maps.min,type:'line',
        borderColor:C.blue,backgroundColor:'transparent',
        borderWidth:1.5,pointRadius:0,tension:0.3,fill:false,
        borderDash:[3,3],yAxisID:'y',spanGaps:true,
      });
    } else if(p.chartType==='area'){
      // Rotes gefülltes Band: fill von y=0 bis zur Linie
      const map=p.extract(data);
      datasets.push({
        label:`${p.emoji} ${p.label}`,data:null,_map:map,type:'line',
        borderColor:p.color,backgroundColor:p.colorL,
        borderWidth:2,pointRadius:3,pointHoverRadius:5,
        pointBackgroundColor:p.color,
        tension:0.1,fill:'origin',
        yAxisID:p.yAxis,spanGaps:false,
      });
    } else if(p.chartType==='bar_param'){
      const map=p.extract(data);
      datasets.push({
        label:`${p.emoji} ${p.label}`,data:null,_map:map,type:'bar',
        backgroundColor:p.colorL,borderColor:p.color,borderWidth:1,
        yAxisID:p.yAxis,spanGaps:false,
      });
    } else {
      const map=p.extract(data);
      datasets.push({
        label:`${p.emoji} ${p.label}`,data:null,_map:map,type:'line',
        borderColor:p.color,backgroundColor:p.colorL,
        borderWidth:2,pointRadius:undefined,pointHoverRadius:5,
        tension:0.3,fill:false,
        borderDash:p.dashed?[4,4]:undefined,
        yAxisID:p.yAxis,spanGaps:true,
      });
    }
  }

  const allDates=[...new Set(datasets.flatMap(d=>Object.keys(d._map||{})))].sort();
  if(!allDates.length){
    canvas.style.display='none';
    canvas.insertAdjacentHTML('afterend','<p class="stat-no-data" style="text-align:center;color:var(--sub);font-size:13px">Keine Daten im gewählten Zeitraum.</p>');
    return;
  }
  datasets.forEach(d=>{
    d.data=allDates.map(date=>{const v=d._map?.[date];return(v!==undefined&&!isNaN(v))?v:null;});
    if(allDates.length>60&&d.type==='line') d.pointRadius=0;
    delete d._map;
  });

  const hasY=datasets.some(d=>d.yAxisID==='y');
  const hasY2=datasets.some(d=>d.yAxisID==='y2');
  const scales={};
  if(hasY)  scales.y ={type:'linear',position:'left',ticks:{font:{size:10},maxTicksLimit:6},grid:{color:'rgba(150,150,150,.1)'}};
  if(hasY2) scales.y2={type:'linear',position:'right',min:0,max:5,
    ticks:{font:{size:10},stepSize:1,callback:v=>(['–','gering','gering–m.','mittel','m.–stark','stark'][v]||v)},
    grid:{drawOnChartArea:false}};
  scales.x={
    ticks:{font:{size:10},maxTicksLimit:allDates.length>30?8:allDates.length,callback:(_,i)=>_fmtLabel(allDates[i])},
    grid:{color:'rgba(150,150,150,.05)'},
  };

  _chart=new window.Chart(canvas.getContext('2d'),{
    type:'bar',
    data:{labels:allDates,datasets},
    options:{
      responsive:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,labels:{boxWidth:10,font:{size:11},padding:8}},
        tooltip:{callbacks:{
          title:items=>_fmtLabel(items[0]?.label||''),
          label:item=>{const v=item.raw;if(v===null||v===undefined)return null;
            return ` ${item.dataset.label}: ${typeof v==='number'?v.toFixed(v<10?1:0):v}`;}
        }},
      },
      scales,
    },
  });
}


// ── Reaktionsscore ────────────────────────────────────────────────
// State: welche Zutaten angezeigt werden (null = alle)
let _reaktionFilter = null; // Set<string> oder null

function _renderReaktionsscore(fut, sym) {
  const el = document.getElementById('st-reaktion');
  if (!el) return;

  // Mind. 5 Futter- und 3 Symptomeinträge nötig
  if (!fut?.length || !sym?.length || fut.length < 5) {
    el.innerHTML = '';
    return;
  }

  // Symptome nach ISO-Datum indizieren
  const symByDate = {};
  sym.forEach(r => {
    const iso = _toISO(g(r, 1));
    if (!iso) return;
    const sw = parseInt(g(r, 4)) || 0;
    if (!symByDate[iso] || sw > symByDate[iso]) symByDate[iso] = sw;
  });

  // Futtereinträge: alle Zutaten-Namen extrahieren (split by comma)
  const futEntries = fut.map(r => ({
    iso:    _toISO(g(r, 1)),
    namen:  g(r, 2).split(/[,;]+/).map(s => s.trim()).filter(Boolean),
  })).filter(e => e.iso && e.namen.length);

  // Score pro Zutat berechnen
  const scoreMap = {}; // name → { total, reactions }
  futEntries.forEach(entry => {
    // Prüfe Symptome in den 2 Folgetagen
    let hasReaction = false;
    for (let d = 1; d <= 2; d++) {
      const nextDate = new Date(entry.iso);
      nextDate.setDate(nextDate.getDate() + d);
      const nextISO = nextDate.toISOString().slice(0, 10);
      if ((symByDate[nextISO] || 0) > 2) { hasReaction = true; break; }
    }
    entry.namen.forEach(name => {
      if (!scoreMap[name]) scoreMap[name] = { total: 0, reactions: 0 };
      scoreMap[name].total++;
      if (hasReaction) scoreMap[name].reactions++;
    });
  });

  // Nur Zutaten mit mind. 3 Vorkommen
  const allScores = Object.entries(scoreMap)
    .filter(([, v]) => v.total >= 3)
    .map(([name, v]) => ({
      name,
      total:     v.total,
      reactions: v.reactions,
      score:     Math.round(v.reactions / v.total * 100),
    }))
    .sort((a, b) => b.score - a.score);

  if (!allScores.length) {
    el.innerHTML = '';
    return;
  }

  // Filter initialisieren: beim ersten Render alle aktivieren
  if (!_reaktionFilter) _reaktionFilter = new Set(allScores.map(s => s.name));

  const visible = allScores.filter(s => _reaktionFilter.has(s.name));

  // Chip-Buttons für Alle/Keine + individuelle Zutaten
  const chipHtml = allScores.map(s => {
    const sel = _reaktionFilter.has(s.name);
    return `<button
      style="padding:4px 9px;font-size:10px;border-radius:12px;border:1px solid var(--border);
        cursor:pointer;font-family:inherit;font-weight:${sel?'700':'400'};
        background:${sel?'var(--c2)':'var(--bg2)'};color:${sel?'#fff':'var(--text)'};
        margin:2px;transition:all .15s"
      onclick="window._STAT_toggleReak(${JSON.stringify(s.name)})">${esc(s.name)}</button>`;
  }).join('');

  // Score-Zeilen
  const rowHtml = visible.length ? visible.map(s => {
    const barColor = s.score < 20 ? 'var(--bar-ok)' : s.score < 50 ? 'var(--bar-low)' : 'var(--danger-text)';
    const badgeCls = s.score < 20 ? 'badge-ok' : s.score < 50 ? 'badge-warn' : 'badge-bad';
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:13px;font-weight:600">${esc(s.name)}</span>
        <span class="badge ${badgeCls}" style="font-size:11px">${s.score}%</span>
      </div>
      <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden;margin-bottom:3px">
        <div style="height:100%;width:${s.score}%;background:${barColor};border-radius:4px;transition:width .3s"></div>
      </div>
      <div style="font-size:10px;color:var(--sub)">${s.reactions} von ${s.total} Mal → Symptome (Schw. &gt; 2) in 48h</div>
    </div>`;
  }).join('') : '<p style="color:var(--sub);font-size:13px">Keine Zutaten ausgewählt.</p>';

  el.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
      <div id="st-reak-header"
        style="display:flex;justify-content:space-between;align-items:center;
          padding:12px 14px;cursor:pointer;background:var(--bg2);user-select:none"
        onclick="const b=document.getElementById('st-reak-body');
                 const open=b.style.display!=='none';
                 b.style.display=open?'none':'block';
                 document.getElementById('st-reak-arrow').textContent=open?'▶':'▼'">
        <div style="font-size:14px;font-weight:700">🧪 Zutaten-Reaktionsscore</div>
        <span id="st-reak-arrow" style="font-size:11px;color:var(--sub)">▶</span>
      </div>
      <div id="st-reak-body" style="display:none;padding:14px">
        <div style="font-size:11px;color:var(--sub);margin-bottom:12px;padding:8px 10px;
          background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
          ⚠️ Statistischer Hinweis – kein medizinischer Befund.
          Score = Anteil der Tage mit Symptom-Schweregrad &gt; 2 in den 48h nach dem Futtereintrag.
          Mind. 3 Beobachtungen pro Zutat erforderlich.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:12px;align-items:center">
          <button onclick="window._STAT_reaktionAlle()"
            style="padding:4px 9px;font-size:10px;border-radius:12px;border:1px solid var(--c2);
              cursor:pointer;font-family:inherit;font-weight:700;background:var(--c4);
              color:var(--c2);margin:2px">Alle</button>
          <button onclick="window._STAT_reaktionKeine()"
            style="padding:4px 9px;font-size:10px;border-radius:12px;border:1px solid var(--border);
              cursor:pointer;font-family:inherit;font-weight:400;background:var(--bg2);
              color:var(--text);margin:2px">Keine</button>
          ${chipHtml}
        </div>
        <div id="st-reak-rows">${rowHtml}</div>
      </div>
    </div>`;

  // Globale Hilfsfunktionen für Chip-Interaktion
  window._STAT_toggleReak = name => {
    if (_reaktionFilter.has(name)) _reaktionFilter.delete(name);
    else _reaktionFilter.add(name);
    _renderReaktionsscore(fut, sym);
    document.getElementById('st-reak-body').style.display = 'block';
    document.getElementById('st-reak-arrow').textContent = '▼';
  };
  window._STAT_reaktionAlle  = () => { _reaktionFilter = new Set(allScores.map(s => s.name)); _renderReaktionsscore(fut, sym); document.getElementById('st-reak-body').style.display='block'; document.getElementById('st-reak-arrow').textContent='▼'; };
  window._STAT_reaktionKeine = () => { _reaktionFilter = new Set(); _renderReaktionsscore(fut, sym); document.getElementById('st-reak-body').style.display='block'; document.getElementById('st-reak-arrow').textContent='▼'; };
}


function _renderFutter(fut) {
  const el=document.getElementById('st-futter'); if(!el) return;
  const reakt=fut.filter(r=>g(r,7)||g(r,6)==='Ja');
  el.innerHTML=reakt.length?reakt.map(r=>`
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="font-size:13px;font-weight:600">${esc(g(r,1))}</div>
        ${g(r,6)==='Ja'?'<span class="badge badge-warn">⚠️ Provokation</span>':g(r,4)==='Ja'?'<span class="badge badge-ok">Erste Gabe</span>':''}
      </div>
      ${g(r,3)?`<div style="font-size:12px;color:var(--sub)">${esc(g(r,3))}</div>`:''}
      ${g(r,7)?`<div style="font-size:13px;margin-top:4px">${esc(g(r,7))}</div>`:''}
    </div>`).join(''):'<p style="color:var(--sub);font-size:13px">Keine Reaktionen im Zeitraum.</p>';
}

function _renderMedis(med) {
  const el=document.getElementById('st-medis'); if(!el) return;
  el.innerHTML=med.length?med.map(r=>`
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:14px;font-weight:600">${esc(g(r,1))}</div>
        <div style="font-size:12px;color:var(--sub)">${esc(g(r,2))} · ${esc(g(r,3))}</div>
        ${g(r,4)?`<div style="font-size:12px;color:var(--sub)">${esc(g(r,4))}</div>`:''}
      </div>
      <div style="font-size:12px;color:var(--sub);text-align:right">
        ${esc(g(r,5)||'?')}<br>bis ${esc(g(r,6)||'laufend')}</div>
    </div>`).join(''):'<p style="color:var(--sub);font-size:13px">Keine Medikamente erfasst.</p>';
}

// ── Symptom-Muster (Wochentag / Monat) ──────────────────────────

/**
 * Rendert ein- / ausklappbare Heatmap-Sektionen für Wochentag- und
 * Monatsmuster des Symptom-Schweregrads.
 * Nur anzeigen wenn >= 14 Symptomeinträge vorhanden sind.
 */
function _renderSymptomMuster(sym) {
  const el = document.getElementById('st-muster');
  if (!el) return;

  // Nur Einträge mit Schweregrad > 0
  const entries = sym
    .map(r => ({ date: _parseDate(g(r,1)), schwere: parseInt(g(r,4)) || 0 }))
    .filter(e => e.date && e.schwere > 0);

  if (entries.length < 14) { el.innerHTML = ''; return; }

  // ── Aggregation Wochentag (0=So…6=Sa → umordnen auf Mo=0…So=6) ─
  const wdData = Array.from({length:7}, () => ({sum:0, count:0}));
  entries.forEach(e => {
    // getDay(): 0=Sun,1=Mon…6=Sat → Mo=0…So=6
    const wd = (e.date.getDay() + 6) % 7;
    wdData[wd].sum   += e.schwere;
    wdData[wd].count += 1;
  });

  // ── Aggregation Monat ────────────────────────────────────────────
  const moData = Array.from({length:12}, () => ({sum:0, count:0}));
  entries.forEach(e => {
    moData[e.date.getMonth()].sum   += e.schwere;
    moData[e.date.getMonth()].count += 1;
  });

  const WD_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  const MO_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  // Höchsten Ø Monat ermitteln
  let maxMoAvg = 0, maxMoIdx = -1;
  moData.forEach((m,i) => {
    if (m.count >= 2) {
      const avg = m.sum / m.count;
      if (avg > maxMoAvg) { maxMoAvg = avg; maxMoIdx = i; }
    }
  });

  const wdHtml  = _heatmapRow(wdData, WD_LABELS);
  const moHtml  = _heatmapRow(moData, MO_LABELS);
  const moHint  = maxMoIdx >= 0
    ? `<div style="font-size:11px;color:var(--sub);margin-top:8px">
        📌 Höchster Ø Schweregrad: <strong>${MO_LABELS[maxMoIdx]}</strong>
        (Ø ${(maxMoAvg).toFixed(1)} · ${moData[maxMoIdx].count} Einträge)
       </div>`
    : '';

  el.innerHTML = `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    margin-bottom:1rem;overflow:hidden">
    <div id="st-muster-header"
      style="display:flex;justify-content:space-between;align-items:center;
        padding:14px;cursor:pointer;user-select:none"
      onclick="const b=document.getElementById('st-muster-body');
               const open=b.style.display!=='none';
               b.style.display=open?'none':'block';
               document.getElementById('st-muster-arrow').textContent=open?'▶':'▼'">
      <div style="font-size:14px;font-weight:700">📅 Symptom-Muster</div>
      <span id="st-muster-arrow" style="font-size:11px;color:var(--sub)">▼</span>
    </div>
    <div id="st-muster-body" style="padding:0 14px 14px">
      <div style="font-size:11px;color:var(--sub);margin-bottom:12px">
        Ø Schweregrad pro Wochentag / Monat · ${entries.length} Einträge ausgewertet
      </div>

      <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--sub);
        text-transform:uppercase;letter-spacing:.04em">Wochentag</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px">
        ${wdHtml}
      </div>

      <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--sub);
        text-transform:uppercase;letter-spacing:.04em">Monat</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">
        ${moHtml}
      </div>
      ${moHint}
    </div>
  </div>`;
}

/**
 * Gibt HTML für eine Heatmap-Zeile zurück.
 * @param {Array<{sum:number,count:number}>} data
 * @param {string[]} labels
 */
function _heatmapRow(data, labels) {
  return data.map((d, i) => {
    const label = labels[i];
    if (d.count < 2) {
      return `<div style="border-radius:6px;padding:6px 2px;text-align:center;
          background:var(--bg2);border:1px solid var(--border)" title="${label} · zu wenig Daten">
        <div style="font-size:11px;font-weight:700;color:var(--sub)">${label}</div>
        <div style="font-size:10px;color:var(--sub);margin-top:2px">–</div>
      </div>`;
    }
    const avg  = d.sum / d.count;
    const col  = _heatColor(avg);
    const textCol = avg >= 3 ? '#fff' : 'var(--text)';
    return `<div style="border-radius:6px;padding:6px 2px;text-align:center;
        background:${col};border:1px solid ${col}"
        title="${label} · Ø ${avg.toFixed(1)} · ${d.count} Einträge">
      <div style="font-size:11px;font-weight:700;color:${textCol}">${label}</div>
      <div style="font-size:11px;font-weight:700;color:${textCol};margin-top:2px">${avg.toFixed(1)}</div>
      <div style="font-size:9px;color:${avg>=3?'rgba(255,255,255,.7)':'var(--sub)'};margin-top:1px">${d.count}×</div>
    </div>`;
  }).join('');
}

/**
 * Farbskala Schweregrad 0–5:
 * 0   → var(--bg2) neutral
 * 0–2 → grün (bar-ok) mit Transparenz gestaffelt
 * 3   → gelb (bar-low / amber)
 * 4–5 → rot (danger / red)
 */
function _heatColor(avg) {
  if (avg <= 0)   return 'var(--bg2)';
  if (avg < 1)    return 'rgba(34,197,94,.25)';
  if (avg < 2)    return 'rgba(34,197,94,.50)';
  if (avg < 2.5)  return 'rgba(34,197,94,.75)';
  if (avg < 3)    return C.green;
  if (avg < 3.5)  return C.amber;
  if (avg < 4)    return '#f97316'; // orange
  if (avg < 4.5)  return 'rgba(239,68,68,.80)';
  return C.red;
}

// ── Korrelationsanalyse ──────────────────────────────────────────

/**
 * Rendert die Korrelationsanalyse-Sektion.
 * Liest sym, umw, pol aus _cachedData (kein neuer API-Call).
 * Verknüpft über ISO-Datum; berechnet Avg/Max Schweregrad je Faktorgruppe.
 */
function _renderKorrelation(data) {
  const el = document.getElementById('st-korrelation');
  if (!el) return;

  const { sym, umw, pol } = data;

  // Symptom-Schweregrad-Map: ISO-Datum → max. Schweregrad des Tages
  const schwereMap = {};
  sym.forEach(r => {
    const iso = _toISO(g(r,1)); if (!iso) return;
    const s = parseInt(g(r,4)) || 0; if (s <= 0) return;
    schwereMap[iso] = Math.max(schwereMap[iso] || 0, s);
  });

  if (!Object.keys(schwereMap).length) { el.innerHTML = ''; return; }

  // Hilfsfunktion: Gruppen aggregieren
  function _aggregate(groups) {
    // groups: { label: string, dates: Set<iso> }[]
    // → { label, count, avg, max }[]
    return groups.map(gr => {
      const vals = [...gr.dates]
        .map(d => schwereMap[d])
        .filter(v => v !== undefined);
      if (vals.length < 3) return { label: gr.label, count: vals.length, avg: null, max: null };
      const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
      const max = Math.max(...vals);
      return { label: gr.label, count: vals.length, avg, max };
    });
  }

  const sections = [];

  // ── 1. Pollenarten ──────────────────────────────────────────────
  const polTypes = [...new Set(pol.map(r => g(r,3)).filter(Boolean))].sort();
  polTypes.forEach(art => {
    const groups = [
      { label: 'keine (0)',     dates: new Set() },
      { label: 'gering (1–2)', dates: new Set() },
      { label: 'mittel (3)',   dates: new Set() },
      { label: 'stark (4–5)', dates: new Set() },
    ];
    // Tage MIT Pollen-Eintrag für diese Art
    const polDayMap = {};
    pol.filter(r => g(r,3) === art).forEach(r => {
      const iso = _toISO(g(r,2)); if (!iso) return;
      const stufe = parseInt(g(r,4)) || 0;
      polDayMap[iso] = Math.max(polDayMap[iso] || 0, stufe);
    });
    // Alle Tage mit Symptomen einteilen
    Object.keys(schwereMap).forEach(iso => {
      const stufe = polDayMap[iso]; // undefined = kein Eintrag = keine Belastung
      if (stufe === undefined || stufe === 0) groups[0].dates.add(iso);
      else if (stufe <= 2)                    groups[1].dates.add(iso);
      else if (stufe === 3)                   groups[2].dates.add(iso);
      else                                    groups[3].dates.add(iso);
    });
    const rows = _aggregate(groups);
    if (rows.some(r => r.avg !== null)) {
      sections.push({ title: `🌿 Pollen: ${art}`, rows });
    }
  });

  // ── 2. Außentemperatur (temp_max, Spalte 3) ──────────────────────
  {
    const groups = [
      { label: '< 5 °C',    dates: new Set() },
      { label: '5–15 °C',  dates: new Set() },
      { label: '15–25 °C', dates: new Set() },
      { label: '> 25 °C',  dates: new Set() },
    ];
    umw.forEach(r => {
      const iso = _toISO(g(r,1)); if (!iso || !schwereMap[iso]) return;
      const t = parseFloat(g(r,3)); if (isNaN(t)) return;
      if (t < 5)       groups[0].dates.add(iso);
      else if (t < 15) groups[1].dates.add(iso);
      else if (t < 25) groups[2].dates.add(iso);
      else             groups[3].dates.add(iso);
    });
    const rows = _aggregate(groups);
    if (rows.some(r => r.avg !== null)) {
      sections.push({ title: '🌡️ Außentemperatur (Max)', rows });
    }
  }

  // ── 3. Luftfeuchtigkeit außen (Spalte 4) ────────────────────────
  {
    const groups = [
      { label: '< 40 %',   dates: new Set() },
      { label: '40–60 %', dates: new Set() },
      { label: '60–80 %', dates: new Set() },
      { label: '> 80 %',  dates: new Set() },
    ];
    umw.forEach(r => {
      const iso = _toISO(g(r,1)); if (!iso || !schwereMap[iso]) return;
      const h = parseFloat(g(r,4)); if (isNaN(h)) return;
      if (h < 40)       groups[0].dates.add(iso);
      else if (h < 60)  groups[1].dates.add(iso);
      else if (h < 80)  groups[2].dates.add(iso);
      else              groups[3].dates.add(iso);
    });
    const rows = _aggregate(groups);
    if (rows.some(r => r.avg !== null)) {
      sections.push({ title: '💧 Luftfeuchtigkeit außen', rows });
    }
  }

  if (!sections.length) { el.innerHTML = ''; return; }

  // ── Render ────────────────────────────────────────────────────────
  const tableHtml = sections.map(sec => {
    const rowsHtml = sec.rows.map(r => {
      if (r.avg === null) {
        return `<tr>
          <td style="padding:6px 4px;font-size:12px">${esc(r.label)}</td>
          <td style="padding:6px 4px;font-size:12px;color:var(--sub);text-align:center">${r.count}</td>
          <td style="padding:6px 4px;font-size:12px;color:var(--sub);text-align:center"
              colspan="2">zu wenig Daten</td>
        </tr>`;
      }
      const highlight = r.avg > 2.0;
      const avgCol = highlight ? C.amber : 'var(--text)';
      const bgRow  = highlight ? `background:rgba(245,158,11,.08)` : '';
      return `<tr style="${bgRow}">
        <td style="padding:6px 4px;font-size:12px;font-weight:${highlight?'700':'400'}">${esc(r.label)}</td>
        <td style="padding:6px 4px;font-size:12px;text-align:center">${r.count}</td>
        <td style="padding:6px 4px;font-size:13px;font-weight:700;text-align:center;color:${avgCol}">${r.avg.toFixed(1)}</td>
        <td style="padding:6px 4px;font-size:12px;text-align:center;color:var(--sub)">${r.max}</td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">${esc(sec.title)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:4px 4px;font-size:10px;font-weight:600;
                color:var(--sub);text-transform:uppercase">Gruppe</th>
              <th style="text-align:center;padding:4px 4px;font-size:10px;font-weight:600;
                color:var(--sub);text-transform:uppercase;width:40px">Tage</th>
              <th style="text-align:center;padding:4px 4px;font-size:10px;font-weight:600;
                color:var(--sub);text-transform:uppercase;width:48px">Ø</th>
              <th style="text-align:center;padding:4px 4px;font-size:10px;font-weight:600;
                color:var(--sub);text-transform:uppercase;width:40px">Max</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('<div style="height:1px;background:var(--border);margin:4px 0 14px"></div>');

  el.innerHTML = `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    margin-bottom:1rem;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;
        padding:14px;cursor:pointer;user-select:none"
      onclick="const b=document.getElementById('st-korr-body');
               const open=b.style.display!=='none';
               b.style.display=open?'none':'block';
               document.getElementById('st-korr-arrow').textContent=open?'▶':'▼'">
      <div style="font-size:14px;font-weight:700">🔗 Korrelationsanalyse</div>
      <span id="st-korr-arrow" style="font-size:11px;color:var(--sub)">▶</span>
    </div>
    <div id="st-korr-body" style="display:none;padding:0 14px 14px">
      <div style="font-size:11px;color:var(--sub);margin-bottom:12px;padding:8px 10px;
        background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
        ℹ️ Statistischer Hinweis – kein medizinischer Befund.
        Ø Schweregrad an Tagen in der jeweiligen Gruppe. Orange = Ø &gt; 2.0.
        Mindestens 3 Datenpunkte pro Gruppe erforderlich.
      </div>
      ${tableHtml}
    </div>
  </div>`;
}

// ── Hilfsfunktionen ──────────────────────────────────────────────
const g=(row,i)=>(row[i]??'').toString().trim();
function _parseRows(rawRows,skipRows){
  if(!rawRows?.length) return [];
  return rawRows.slice(skipRows).filter(r=>r?.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''));
}
function _matchH(row,hundId){return !g(row,0)||g(row,0)===String(hundId);}
function _parseDate(str){
  if(!str) return null;
  if(str.includes('.')){const[d,m,y]=str.split('.');const yr=y?.length===2?'20'+y:y;const date=new Date(parseInt(yr),parseInt(m)-1,parseInt(d));return isNaN(date.getTime())?null:date;}
  if(str.includes('-')){const date=new Date(str);return isNaN(date.getTime())?null:date;}
  return null;
}
function _toISO(str){const d=_parseDate(str);return d?d.toISOString().slice(0,10):null;}
function _inRange(datum,cutoff){const d=_parseDate(datum);return d&&d>=cutoff;}
function _fmtLabel(iso){if(!iso)return'';const d=new Date(iso);return`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;}
function _byDate(rows,dateCol,valFn,aggFn){
  const map={};
  rows.forEach(r=>{
    const iso=_toISO(g(r,dateCol));if(!iso)return;
    const v=valFn(r);if(v===undefined||v===null||isNaN(v))return;
    if(map[iso]===undefined)map[iso]=v;
    else if(aggFn)map[iso]=aggFn(map[iso],v);
    else map[iso]=v;
  });
  return map;
}
function _kpi(label,value,color){
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    padding:12px;text-align:center">
    <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${label}</div>
  </div>`;
}
function _box(title,body){
  return `<div style="background:var(--bg2);border:1px solid var(--border);
    border-radius:var(--radius);padding:14px;margin-bottom:1rem">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">${title}</div>${body}</div>`;
}
function _loadScript(src){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
    const s=document.createElement('script');
    s.src=src;s.onload=resolve;s.onerror=reject;
    document.head.appendChild(s);
  });
}
