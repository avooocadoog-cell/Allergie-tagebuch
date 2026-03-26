/**
 * MODULE: statistik.js  (v3 – konfigurierbarer Chart)
 *
 * Ein konfigurierbarer Chart statt fester Diagramme.
 * Der Nutzer wählt welche Parameter gleichzeitig angezeigt werden.
 *
 * Y-Links  (y):  Temperatur °C, Luftfeuchtigkeit %, Gewicht kg
 * Y-Rechts (y2): Schweregrad 0–5, Pollen-Stufe 0–5
 */

import { getSheet, invalidateAll, getAge } from './cache.js';
import { getHunde }                         from './store.js';
import { esc }                              from './ui.js';

const C = {
  blue:'#3b82f6',   blueL:'rgba(59,130,246,.15)',
  orange:'#f97316', orangeL:'rgba(249,115,22,.15)',
  amber:'#f59e0b',  amberL:'rgba(245,158,11,.15)',
  green:'#22c55e',  greenL:'rgba(34,197,94,.15)',
  red:'#ef4444',    redL:'rgba(239,68,68,.15)',
  purple:'#a855f7', purpleL:'rgba(168,85,247,.15)',
  teal:'#14b8a6',   tealL:'rgba(20,184,166,.15)',
  sky:'#0ea5e9',    skyL:'rgba(14,165,233,.15)',
};

let _chart      = null;
let _selected   = new Set(['temp_max','symptome']);
let _cachedData = null;

const PARAM_DEFS = [
  {
    key:'temp_max', label:'Temp. Max (°C)', emoji:'🌡',
    color:C.orange, colorL:C.orangeL, yAxis:'y',
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,3)),Math.max),
  },
  {
    key:'temp_min', label:'Temp. Min (°C)', emoji:'🌡',
    color:C.blue, colorL:C.blueL, yAxis:'y', dashed:true,
    extract:({umw})=>_byDate(umw,1,r=>parseFloat(g(r,2)),Math.min),
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
    key:'symptome', label:'Schweregrad (0–5)', emoji:'🔍',
    color:C.red, colorL:C.redL, yAxis:'y2',
    extract:({sym})=>_byDate(sym,1,r=>parseInt(g(r,4)),Math.max),
  },
  {
    key:'pollen', label:'Pollen-Stufe (0–5)', emoji:'🌿',
    color:C.green, colorL:C.greenL, yAxis:'y2',
    extract:({pol,umw})=>{
      if(pol?.length) return _byDate(pol,2,r=>parseInt(g(r,4)),Math.max);
      const m={};
      umw.forEach(r=>{
        const iso=_toISO(g(r,1)); if(!iso) return;
        const p=g(r,6);
        if(p&&p!=='keine erhöhte Belastung'&&p.trim()) m[iso]=1;
      });
      return m;
    },
  },
  {
    key:'gewicht', label:'Gewicht (kg)', emoji:'⚖️',
    color:C.purple, colorL:C.purpleL, yAxis:'y',
    extract:({gew})=>_byDate(gew||[],2,r=>parseFloat(String(g(r,3)).replace(',','.'))),
  },
];

// ════════════════════════════════════════════════════════════════
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
    const [rSym,rUmw,rFut,rAus,rAll,rMed] = await Promise.all([
      getSheet('Symptomtagebuch',   'tagebuch',forceRefresh),
      getSheet('Umweltagebuch',     'tagebuch',forceRefresh),
      getSheet('Futtertagebuch',    'tagebuch',forceRefresh),
      getSheet('Ausschlussdiät',    'tagebuch',forceRefresh),
      getSheet('Bekannte Allergene','tagebuch',forceRefresh),
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

    const cutoff  = rangeDays>0 ? new Date(Date.now()-rangeDays*86_400_000) : new Date(0);
    const notDel  = idx=>r=>String(r[idx]??'').toUpperCase()!=='TRUE';

    const _pr = (raw,skip)=>_parseRows(raw,skip);
    const allSym=_pr(rSym,2); const allUmw=_pr(rUmw,2);
    const allFut=_pr(rFut,2); const allAus=_pr(rAus,2);
    const allAll=_pr(rAll,2); const allMed=_pr(rMed,2);
    const allGew=_pr(rGew,2); const allPol=_pr(rPol,2);

    const sym=allSym.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(9)(r));
    const umw=allUmw.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(13)(r));
    const fut=allFut.filter(r=>_matchH(r,hundId)&&_inRange(g(r,1),cutoff)&&notDel(11)(r));
    const aus=allAus.filter(r=>_matchH(r,hundId)&&notDel(10)(r));
    const all=allAll.filter(r=>_matchH(r,hundId)&&notDel(8)(r));
    const med=allMed.filter(r=>_matchH(r,hundId)&&notDel(11)(r));
    const gew=allGew.filter(r=>g(r,1)===String(hundId)&&_inRange(g(r,2),cutoff));
    const pol=allPol.filter(r=>g(r,1)===String(hundId)&&_inRange(g(r,2),cutoff));

    _cachedData={sym,umw,fut,aus,all,med,gew,pol};

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
      ${_box('⚠️ Bekannte Allergene','<div id="st-allergene"></div>')}
      ${_box('📋 Ausschlussdiät','<div id="st-aus-badges"></div>')}
      ${_box('🥩 Futter-Reaktionen','<div id="st-futter"></div>')}
      ${_box('💊 Medikamente','<div id="st-medis"></div>')}
    `;

    await _buildChart(_cachedData);
    _renderAllergene(all);
    _renderAusschluss(aus);
    _renderFutter(fut);
    _renderMedis(med);

  } catch(e) {
    content.innerHTML=`<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export function forceRefresh() {
  invalidateAll(); _cachedData=null; refresh(true);
}

export async function toggleParam(key) {
  _selected.has(key) ? _selected.delete(key) : _selected.add(key);
  document.querySelectorAll('.stat-param-btn').forEach(btn=>{
    btn.classList.toggle('sel',_selected.has(btn.dataset.key));
  });
  if(_cachedData) await _buildChart(_cachedData);
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
  c.innerHTML=PARAM_DEFS.map(p=>`
    <button class="stat-param-btn tog-btn${_selected.has(p.key)?' sel':''}"
      data-key="${p.key}"
      onclick="STATISTIK.toggleParam('${p.key}')"
      style="font-size:12px;padding:6px 10px;border-color:${p.color}">
      ${p.emoji} ${p.label}
    </button>`).join('');
}

async function _buildChart(data) {
  if(!window.Chart) await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');
  const canvas=document.getElementById('ch-konfig'); if(!canvas) return;
  if(_chart){try{_chart.destroy();}catch(e){} _chart=null;}

  const active=PARAM_DEFS.filter(p=>_selected.has(p.key));
  if(!active.length){
    canvas.style.display='none';
    if(!canvas.nextElementSibling?.classList?.contains('stat-no-data'))
      canvas.insertAdjacentHTML('afterend','<p class="stat-no-data" style="text-align:center;color:var(--sub);font-size:13px;margin-top:8px">Bitte oben mindestens einen Parameter auswählen.</p>');
    return;
  }
  canvas.style.display='';
  document.querySelector('.stat-no-data')?.remove();

  const maps=active.map(p=>({...p,map:p.extract(data)}));
  const allDates=[...new Set(maps.flatMap(m=>Object.keys(m.map)))].sort();

  if(!allDates.length){
    canvas.style.display='none';
    canvas.insertAdjacentHTML('afterend','<p class="stat-no-data" style="text-align:center;color:var(--sub);font-size:13px">Keine Daten im gewählten Zeitraum.</p>');
    return;
  }

  const datasets=maps.map(p=>({
    label:p.label,
    data:allDates.map(d=>{const v=p.map[d]; return(v!==undefined&&!isNaN(v))?v:null;}),
    borderColor:p.color,
    backgroundColor:p.colorL,
    borderWidth:2,
    pointRadius:allDates.length>60?0:3,
    pointHoverRadius:5,
    tension:0.3,
    fill:false,
    borderDash:p.dashed?[4,4]:undefined,
    yAxisID:p.yAxis,
    spanGaps:true,
  }));

  const hasY  = active.some(p=>p.yAxis==='y');
  const hasY2 = active.some(p=>p.yAxis==='y2');
  const scales={};
  if(hasY)  scales.y  ={type:'linear',position:'left', ticks:{font:{size:10},maxTicksLimit:6},grid:{color:'rgba(150,150,150,.1)'}};
  if(hasY2) scales.y2 ={type:'linear',position:'right',min:0,max:5,
    ticks:{font:{size:10},stepSize:1,callback:v=>['–','●','●●','●●●','●●●●','●●●●●'][v]||v},
    grid:{drawOnChartArea:false}};
  scales.x={ticks:{font:{size:10},maxTicksLimit:allDates.length>30?8:allDates.length,callback:(_,i)=>_fmtLabel(allDates[i])},grid:{color:'rgba(150,150,150,.05)'}};

  _chart=new window.Chart(canvas.getContext('2d'),{
    type:'line',
    data:{labels:allDates,datasets},
    options:{
      responsive:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,labels:{boxWidth:10,font:{size:11},padding:8}},
        tooltip:{callbacks:{
          title:items=>_fmtLabel(items[0]?.label||''),
          label:item=>{
            const v=item.raw; if(v===null) return null;
            const p=active[item.datasetIndex];
            return ` ${p?.emoji||''} ${item.dataset.label}: ${typeof v==='number'?v.toFixed(v<10?1:0):v}`;
          },
        }},
      },
      scales,
    },
  });
}

// ════════════════════════════════════════════════════════════════
function _renderAllergene(all) {
  const el=document.getElementById('st-allergene'); if(!el) return;
  el.innerHTML=all.length?all.map(r=>{
    const reakt=parseInt(g(r,3))||0;
    const color=reakt>=4?C.red:reakt>=3?C.amber:C.green;
    return `<div style="display:flex;justify-content:space-between;align-items:center;
      padding:10px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:14px;font-weight:600">${esc(g(r,1))}</div>
        <div style="font-size:12px;color:var(--sub)">${esc(g(r,2))} · ${esc(g(r,4))}</div></div>
      <div style="font-size:18px;color:${color};letter-spacing:2px">
        ${'●'.repeat(reakt)}${'○'.repeat(5-reakt)}</div></div>`;
  }).join(''):'<p style="color:var(--sub);font-size:13px">Keine Allergene erfasst.</p>';
}

function _renderAusschluss(aus) {
  const el=document.getElementById('st-aus-badges'); if(!el) return;
  const groups={};
  aus.forEach(r=>{const s=g(r,4)||'Unbekannt';(groups[s]=groups[s]||[]).push(g(r,1));});
  el.innerHTML=Object.entries(groups).map(([s,items])=>{
    const c=s.includes('vertr')?C.green:s.includes('Reaktion')||s.includes('Gesperrt')?C.red:C.amber;
    return `<div style="width:100%;margin-bottom:6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${c};margin-bottom:3px">${esc(s)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${items.map(z=>`<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${esc(z)}</span>`).join('')}
      </div></div>`;
  }).join('')||'<p style="color:var(--sub);font-size:13px">Keine Ausschlussdiät-Einträge.</p>';
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
      <div><div style="font-size:14px;font-weight:600">${esc(g(r,1))}</div>
        <div style="font-size:12px;color:var(--sub)">${esc(g(r,2))} · ${esc(g(r,3))}</div></div>
      <div style="font-size:12px;color:var(--sub);text-align:right">
        ${esc(g(r,5)||'?')}<br>bis ${esc(g(r,6)||'laufend')}</div>
    </div>`).join(''):'<p style="color:var(--sub);font-size:13px">Keine Medikamente erfasst.</p>';
}

// ════════════════════════════════════════════════════════════════
const g=(row,i)=>(row[i]??'').toString().trim();

function _parseRows(rawRows,skipRows) {
  if(!rawRows?.length) return [];
  return rawRows.slice(skipRows).filter(r=>r?.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''));
}
function _matchH(row,hundId) { return !g(row,0)||g(row,0)===String(hundId); }
function _parseDate(str) {
  if(!str) return null;
  if(str.includes('.')){const[d,m,y]=str.split('.');const yr=y?.length===2?'20'+y:y;const date=new Date(parseInt(yr),parseInt(m)-1,parseInt(d));return isNaN(date.getTime())?null:date;}
  if(str.includes('-')){const date=new Date(str);return isNaN(date.getTime())?null:date;}
  return null;
}
function _toISO(str){const d=_parseDate(str);return d?d.toISOString().slice(0,10):null;}
function _inRange(datum,cutoff){const d=_parseDate(datum);return d&&d>=cutoff;}
function _fmtLabel(iso){if(!iso)return'';const d=new Date(iso);return`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;}

function _byDate(rows,dateCol,valFn,aggFn) {
  const map={};
  rows.forEach(r=>{
    const iso=_toISO(g(r,dateCol)); if(!iso) return;
    const v=valFn(r); if(v===undefined||v===null||isNaN(v)) return;
    if(map[iso]===undefined) map[iso]=v;
    else if(aggFn) map[iso]=aggFn(map[iso],v);
    else map[iso]=v;
  });
  return map;
}

function _kpi(label,value,color) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
    padding:12px;text-align:center">
    <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${label}</div>
  </div>`;
}

function _box(title,body) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);
    border-radius:var(--radius);padding:14px;margin-bottom:1rem">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">${title}</div>${body}</div>`;
}

function _loadScript(src) {
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
    const s=document.createElement('script');
    s.src=src;s.onload=resolve;s.onerror=reject;
    document.head.appendChild(s);
  });
}
