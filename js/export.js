/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: export.js  (v2.0.0)                                 ║
 * ║  Hund Manager – Tierarzt-Bericht PDF Export                  ║
 * ║                                                              ║
 * ║  Individuell konfigurierbarer Bericht:                       ║
 * ║  - Frei wählbarer Zeitraum (Start + End Datum)               ║
 * ║  - Sektionen einzeln ein-/ausblendbar (wie Statistik-Params) ║
 * ║  - Optional: Reaktionsscore, Korrelationsanalyse             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { getHunde }        from './store.js';
import { getSheet }        from './cache.js';
import { get as getCfg }   from './config.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Datums-Helfer ─────────────────────────────────────────────────
function _parseDE(str) {
  if (!str) return null;
  const [d,m,y] = String(str).split('.');
  const date = new Date(+y,+m-1,+d);
  return isNaN(date.getTime()) ? null : date;
}
function _toTS(str)    { const d=_parseDE(str); return d ? d.getTime() : 0; }
function _fmtDE(date)  { if (!date) return ''; const d=date.getDate(),m=date.getMonth()+1,y=date.getFullYear(); return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`; }
function _toISO(str)   { if (!str) return null; const d=_parseDE(str); return d ? d.toISOString().slice(0,10) : null; }
function _isoToDE(iso) { if (!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}`; }
function _fmtToday()   { return _fmtDE(new Date()); }

// ── Sektion-Definitionen ──────────────────────────────────────────
const SECTIONS = [
  { key:'deckblatt',    label:'📋 Deckblatt',            default:true  },
  { key:'symptome',     label:'🔍 Symptomverlauf',        default:true  },
  { key:'allergene',    label:'⚠️ Bekannte Allergene',    default:true  },
  { key:'ausschluss',   label:'📋 Ausschlussdiät',        default:true  },
  { key:'phasen',       label:'📅 Phasen-Timeline',       default:true  },
  { key:'medikamente',  label:'💊 Medikamente',           default:true  },
  { key:'futter',       label:'🥩 Letzte Futtereinträge', default:true  },
  { key:'reaktion',     label:'🧪 Reaktionsscore',        default:false },
  { key:'korrelation',  label:'🔗 Korrelationsanalyse',   default:false },
];

// Aktiver Sektionszustand (initialisiert beim Dialog)
let _activeSections = new Set(SECTIONS.filter(s=>s.default).map(s=>s.key));

// ════════════════════════════════════════════════════════════════
//  DIALOG
// ════════════════════════════════════════════════════════════════

export function showExportDialog(hundId) {
  document.getElementById('export-dialog-overlay')?.remove();

  // Standard-Zeitraum: letzte 90 Tage
  const today = new Date();
  const vor90 = new Date(today); vor90.setDate(today.getDate()-90);
  const todayISO = today.toISOString().slice(0,10);
  const vor90ISO = vor90.toISOString().slice(0,10);

  const sectionHtml = SECTIONS.map(sec => `
    <button class="exp-sec-btn${_activeSections.has(sec.key)?' active':''}"
      data-key="${sec.key}"
      onclick="window._EXPORT_toggleSec('${sec.key}',this)"
      style="padding:6px 10px;font-size:11px;border-radius:var(--radius-sm);
        border:1px solid var(--border);cursor:pointer;font-family:inherit;
        background:${_activeSections.has(sec.key)?'var(--c2)':'var(--bg2)'};
        color:${_activeSections.has(sec.key)?'#fff':'var(--text)'};
        margin:2px;transition:all .15s;text-align:left">
      ${sec.label}
    </button>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'export-dialog-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;
    display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto`;

  overlay.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius);padding:1.5rem;
      width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.3);margin:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div style="font-size:15px;font-weight:700">📄 Tierarzt-Export</div>
        <button onclick="document.getElementById('export-dialog-overlay').remove()"
          style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--sub)">✕</button>
      </div>

      <!-- Zeitraum: Schnellauswahl -->
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--sub);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Zeitraum</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px">
          ${[['30','30 T'],['60','60 T'],['90','90 T'],['180','6 Mo']].map(([v,l])=>`
            <button onclick="window._EXPORT_setRange(${v})"
              class="exp-range-btn" data-days="${v}"
              style="padding:6px 4px;font-size:11px;border:1px solid var(--border);
                border-radius:var(--radius-sm);background:var(--bg2);color:var(--text);
                cursor:pointer;font-family:inherit">${l}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:10px;color:var(--sub);display:block;margin-bottom:3px">Von</label>
            <input type="date" id="exp-date-from" value="${vor90ISO}"
              style="width:100%;padding:7px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);
                background:var(--bg);color:var(--text);font-family:inherit;font-size:12px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--sub);display:block;margin-bottom:3px">Bis</label>
            <input type="date" id="exp-date-to" value="${todayISO}"
              style="width:100%;padding:7px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);
                background:var(--bg);color:var(--text);font-family:inherit;font-size:12px">
          </div>
        </div>
      </div>

      <!-- Sektionen -->
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:11px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Sektionen</div>
          <div style="display:flex;gap:6px">
            <button onclick="window._EXPORT_alleAuswahl(true)"
              style="font-size:10px;padding:3px 7px;border:1px solid var(--c2);border-radius:10px;
                background:var(--c4);color:var(--c2);cursor:pointer;font-family:inherit">Alle</button>
            <button onclick="window._EXPORT_alleAuswahl(false)"
              style="font-size:10px;padding:3px 7px;border:1px solid var(--border);border-radius:10px;
                background:var(--bg2);color:var(--text);cursor:pointer;font-family:inherit">Keine</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0">${sectionHtml}</div>
      </div>

      <!-- Export-Button -->
      <button id="export-pdf-btn"
        onclick="EXPORT.exportTierarztPDF(${hundId})"
        style="width:100%;padding:12px;font-size:14px;font-weight:700;border:none;
          border-radius:var(--radius-sm);background:var(--c2);color:#fff;cursor:pointer;font-family:inherit">
        📄 Bericht erstellen &amp; drucken
      </button>
      <div style="font-size:10px;color:var(--sub);margin-top:8px;text-align:center">
        Öffnet einen neuen Tab → drucken oder als PDF speichern
      </div>
    </div>`;

  // Stil für aktive Buttons
  if (!document.getElementById('exp-style')) {
    const st=document.createElement('style');
    st.id='exp-style';
    st.textContent=`
      .exp-range-btn.active{background:var(--c2)!important;color:#fff!important;border-color:var(--c2)!important;font-weight:700!important}
      .exp-sec-btn.active{background:var(--c2)!important;color:#fff!important;border-color:var(--c2)!important}
    `;
    document.head.appendChild(st);
  }

  document.body.appendChild(overlay);

  // Globale Helfer
  window._EXPORT_toggleSec = (key, btn) => {
    if (_activeSections.has(key)) _activeSections.delete(key);
    else _activeSections.add(key);
    btn.classList.toggle('active', _activeSections.has(key));
    btn.style.background = _activeSections.has(key) ? 'var(--c2)' : 'var(--bg2)';
    btn.style.color      = _activeSections.has(key) ? '#fff'      : 'var(--text)';
  };
  window._EXPORT_alleAuswahl = (alle) => {
    _activeSections = alle ? new Set(SECTIONS.map(s=>s.key)) : new Set();
    document.querySelectorAll('.exp-sec-btn').forEach(btn => {
      const active = _activeSections.has(btn.dataset.key);
      btn.classList.toggle('active', active);
      btn.style.background = active ? 'var(--c2)' : 'var(--bg2)';
      btn.style.color      = active ? '#fff'      : 'var(--text)';
    });
  };
  window._EXPORT_setRange = (days) => {
    const to   = new Date();
    const from = new Date(); from.setDate(to.getDate()-days);
    document.getElementById('exp-date-from').value = from.toISOString().slice(0,10);
    document.getElementById('exp-date-to').value   = to.toISOString().slice(0,10);
    document.querySelectorAll('.exp-range-btn').forEach(b=>{
      const active = parseInt(b.dataset.days)===days;
      b.classList.toggle('active',active);
      b.style.background = active?'var(--c2)':'var(--bg2)';
      b.style.color      = active?'#fff':'var(--text)';
    });
  };
}

// ════════════════════════════════════════════════════════════════
//  BERICHT ERSTELLEN
// ════════════════════════════════════════════════════════════════

export async function exportTierarztPDF(hundId) {
  const btn = document.getElementById('export-pdf-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Wird erstellt…'; }

  try {
    const hund = getHunde().find(h=>h.hund_id===hundId);
    if (!hund) throw new Error('Hund nicht gefunden.');

    // Zeitraum aus Dialog
    const fromISO = document.getElementById('exp-date-from')?.value;
    const toISO   = document.getElementById('exp-date-to')?.value;
    const fromDate = fromISO ? new Date(fromISO) : new Date(Date.now()-90*86400000);
    const toDate   = toISO   ? new Date(toISO)   : new Date();
    toDate.setHours(23,59,59,999);

    const inRange = str => {
      const d=_parseDE(str);
      return d && d>=fromDate && d<=toDate;
    };
    const notDel = (r,idx) => String(r[idx]??'').toUpperCase()!=='TRUE';
    const g = (r,i) => String(r[i]??'').trim();

    // Alle Sheets laden
    const [rSym,rFut,rMed,rAll,rAus,rGew,rPhas,rUmw,rPol] = await Promise.all([
      getSheet('Symptomtagebuch',   'tagebuch',false).catch(()=>[]),
      getSheet('Futtertagebuch',    'tagebuch',false).catch(()=>[]),
      getSheet('Medikamente',       'tagebuch',false).catch(()=>[]),
      getSheet('Bekannte Allergene','tagebuch',false).catch(()=>[]),
      getSheet('Ausschlussdiät',    'tagebuch',false).catch(()=>[]),
      getSheet('Hund_Gewicht',      'tagebuch',false).catch(()=>[]),
      getSheet('Ausschluss_Phasen', 'tagebuch',false).catch(()=>[]),
      getSheet('Umweltagebuch',     'tagebuch',false).catch(()=>[]),
      getSheet('Pollen_Log',        'tagebuch',false).catch(()=>[]),
    ]);

    const _rows=(raw,skip=2)=>(raw||[]).slice(skip).filter(r=>r?.some(v=>String(v).trim()));

    const sym  = _rows(rSym) .filter(r=>g(r,0)===String(hundId)&&inRange(g(r,1))&&notDel(r,9))
                             .sort((a,b)=>_toTS(g(b,1))-_toTS(g(a,1)));
    const fut  = _rows(rFut) .filter(r=>g(r,0)===String(hundId)&&inRange(g(r,1))&&notDel(r,11))
                             .sort((a,b)=>_toTS(g(b,1))-_toTS(g(a,1))).slice(0,10);
    const med  = _rows(rMed) .filter(r=>g(r,0)===String(hundId)&&notDel(r,11));
    const all  = _rows(rAll) .filter(r=>g(r,0)===String(hundId)&&notDel(r,8));
    const aus  = _rows(rAus) .filter(r=>g(r,0)===String(hundId)&&notDel(r,10));
    const gew  = _rows(rGew) .filter(r=>g(r,1)===String(hundId))
                             .sort((a,b)=>_toTS(g(b,2))-_toTS(g(a,2)));
    const phas = _rows(rPhas).filter(r=>g(r,1)===String(hundId)&&notDel(r,9))
                             .sort((a,b)=>_toTS(g(b,4))-_toTS(g(a,4)));
    const umw  = _rows(rUmw) .filter(r=>g(r,0)===String(hundId)&&inRange(g(r,1))&&notDel(r,13));
    const pol  = _rows(rPol) .filter(r=>g(r,1)===String(hundId)&&inRange(g(r,2)));

    const letzesGewicht = gew[0] ? `${parseFloat(g(gew[0],3)).toFixed(1)} kg (${g(gew[0],2)})` : '–';
    const zeitraumStr   = `${_isoToDE(fromISO)} – ${_isoToDE(toISO)}`;
    const sec           = key => _activeSections.has(key);

    // ── Reaktionsscore berechnen (optional) ────────────────────
    let reaktionHtml = '';
    if (sec('reaktion') && sym.length && fut.length) {
      const symByDate={};
      sym.forEach(r=>{ const iso=_toISO(g(r,1)); if(!iso) return; const sw=parseInt(g(r,4))||0; if(!symByDate[iso]||sw>symByDate[iso]) symByDate[iso]=sw; });
      function _parseFNamen(text) {
        const SKIP=/^(gesamt|freitext|futter\s*\d*)$/i;
        const names=new Set();
        function _cl(tok){return tok.replace(/:\s*\d+([.,]\d+)?\s*(g|kg|ml|l|gr|kcal)\b/gi,'').replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|l|gr|kcal)\b/gi,'').replace(/\b\d+([.,]\d+)?\s*kcal\b/gi,'').replace(/\b\d+\s*%/g,'').replace(/\(.*?\)/g,'').replace(/[|]/g,'').replace(/:\s*$/,'').replace(/\s{2,}/g,' ').trim();}
        text.split(/[\n]+/).forEach(rawLine=>{
          const line=rawLine.trim(); if(!line) return;
          if(/^gesamt:/i.test(line)) return;
          const fm=line.match(/^futter\s*\d+:\s*(.+?)(?:\s*\(|\s*\||$)/i);
          if(fm){const rn=_cl(fm[1]);if(rn.length>=2&&!SKIP.test(rn))names.add(rn);const pi=line.indexOf(' | ');if(pi>=0)line.slice(pi+3).split(',').forEach(t=>{const c=_cl(t);if(c.length>=2&&!SKIP.test(c)&&!/^\d+$/.test(c))names.add(c);});return;}
          line.split(/[,;]+/).forEach(tok=>{const c=_cl(tok);if(c.length>=2&&!SKIP.test(c)&&!/^\d+$/.test(c))names.add(c);});
        });
        return [...names];
      }
      const futEntries=fut.map(r=>({iso:_toISO(g(r,1)),namen:_parseFNamen(g(r,2))})).filter(e=>e.iso&&e.namen.length);
      const scoreMap={};
      futEntries.forEach(entry=>{
        let hasR=false;
        for(let d=1;d<=2;d++){const nd=new Date(entry.iso);nd.setDate(nd.getDate()+d);if((symByDate[nd.toISOString().slice(0,10)]||0)>2){hasR=true;break;}}
        entry.namen.forEach(name=>{if(!scoreMap[name])scoreMap[name]={total:0,reactions:0};scoreMap[name].total++;if(hasR)scoreMap[name].reactions++;});
      });
      const scores=Object.entries(scoreMap).filter(([,v])=>v.total>=3).map(([name,v])=>({name,total:v.total,reactions:v.reactions,score:Math.round(v.reactions/v.total*100)})).sort((a,b)=>b.score-a.score);
      if (scores.length) {
        reaktionHtml=`<table><thead><tr><th>Zutat</th><th>Beobachtungen</th><th>Mit Symptomen (48h)</th><th>Score</th></tr></thead><tbody>`
          +scores.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.total}</td><td>${s.reactions}</td><td><strong>${s.score}%</strong></td></tr>`).join('')
          +`</tbody></table><p style="font-size:9pt;color:#555">Score = Anteil Tage mit Symptom-Schweregrad &gt; 2 in 48h nach Futtereintrag. Statistischer Hinweis.</p>`;
      } else reaktionHtml='<p class="empty">Zu wenig Daten für Reaktionsscore (mind. 3 Beobachtungen pro Zutat).</p>';
    }

    // ── Korrelationsanalyse (optional) ─────────────────────────
    let korrHtml = '';
    if (sec('korrelation') && sym.length && (umw.length || pol.length)) {
      const symByDate2={};
      sym.forEach(r=>{const iso=_toISO(g(r,1));if(!iso)return;const sw=parseInt(g(r,4))||0;if(!symByDate2[iso]||sw>symByDate2[iso])symByDate2[iso]=sw;});
      function _group(label,groups){
        const rows=Object.entries(groups).map(([grpLabel,vals])=>{
          if(vals.length<3) return null;
          const avg=(vals.reduce((a,b)=>a+b,0)/vals.length);
          const max=Math.max(...vals);
          return `<tr${avg>2?' style="background:#fff3cd"':''}><td>${esc(grpLabel)}</td><td>${vals.length}</td><td>${avg.toFixed(1)}</td><td>${max}</td></tr>`;
        }).filter(Boolean);
        if(!rows.length) return '';
        return `<tr><td colspan="4" style="background:#eee;font-weight:bold;font-size:9pt">${esc(label)}</td></tr>`+rows.join('');
      }
      // Temperatur-Gruppen
      const tempGrps={'<5°C':[],'5–15°C':[],'15–25°C':[],'>25°C':[]};
      umw.forEach(r=>{const iso=_toISO(g(r,1));const sw=symByDate2[iso];if(sw===undefined)return;const t=parseFloat(g(r,3));if(isNaN(t))return;const grp=t<5?'<5°C':t<15?'5–15°C':t<25?'15–25°C':'>25°C';tempGrps[grp].push(sw);});
      // Feuchte-Gruppen
      const feuGrps={'<40%':[],'40–60%':[],'60–80%':[],'>80%':[]};
      umw.forEach(r=>{const iso=_toISO(g(r,1));const sw=symByDate2[iso];if(sw===undefined)return;const f=parseFloat(g(r,4));if(isNaN(f))return;const grp=f<40?'<40%':f<60?'40–60%':f<80?'60–80%':'>80%';feuGrps[grp].push(sw);});
      const korrRows=_group('Außentemperatur',tempGrps)+_group('Luftfeuchtigkeit',feuGrps);
      // Pollen-Gruppen
      const polArten=[...new Set(pol.map(r=>g(r,3)).filter(Boolean))].sort();
      polArten.forEach(art=>{
        const grps={'keine (0)':[],'gering (1–2)':[],'mittel (3)':[],'stark (4–5)':[]};
        pol.filter(r=>g(r,3)===art).forEach(r=>{const iso=_toISO(g(r,2));const sw=symByDate2[iso];if(sw===undefined)return;const st=parseInt(g(r,4));if(isNaN(st))return;const grp=st===0?'keine (0)':st<=2?'gering (1–2)':st===3?'mittel (3)':'stark (4–5)';grps[grp].push(sw);});
        korrHtml+=_group(`Pollen: ${art}`,grps);
      });
      if(korrRows||korrHtml){
        korrHtml=`<table><thead><tr><th>Gruppe</th><th>Datenpunkte</th><th>Ø Schweregrad</th><th>Max</th></tr></thead><tbody>${korrRows}${korrHtml}</tbody></table><p style="font-size:9pt;color:#555">Orange = Ø Schweregrad &gt; 2,0. Mind. 3 Datenpunkte erforderlich.</p>`;
      } else korrHtml='<p class="empty">Zu wenig Daten für Korrelationsanalyse.</p>';
    }

    // ── HTML-Bericht bauen ──────────────────────────────────────
    const sectionBlock = (cond, title, body) =>
      (!cond || !sec(cond)) ? '' : `<h2>${title}</h2>${body}`;

    const html = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<title>Tierarzt-Bericht – ${esc(hund.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;background:#fff;padding:18mm 14mm}
  h1{font-size:18pt;margin-bottom:4px}
  h2{font-size:13pt;margin:18px 0 6px;padding-bottom:4px;border-bottom:2px solid #111;page-break-before:auto}
  h3{font-size:11pt;margin:12px 0 4px}
  p,li{line-height:1.5;margin-bottom:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10pt}
  th{background:#111;color:#fff;padding:5px 8px;text-align:left;font-size:9pt}
  td{padding:4px 8px;border-bottom:1px solid #ccc;vertical-align:top}
  tr:nth-child(even) td{background:#f5f5f5}
  .badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9pt;font-weight:bold}
  .badge-ok{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
  .badge-warn{background:#fff3cd;color:#856404;border:1px solid #ffc107}
  .badge-bad{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
  .deckblatt{margin-bottom:24px;padding-bottom:16px;border-bottom:3px double #111}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-top:10px;font-size:10pt}
  .meta-grid span{color:#555}
  .sw-bar{display:inline-block;width:80px;height:8px;background:#ddd;border-radius:3px;vertical-align:middle;margin-right:4px}
  .sw-fill{height:100%;border-radius:3px;background:#111}
  .empty{color:#777;font-style:italic;font-size:10pt}
  .disclaimer{margin-top:24px;padding:8px 12px;border:1px solid #ccc;font-size:9pt;color:#555}
  .footer{margin-top:16px;font-size:9pt;color:#777;text-align:right;border-top:1px solid #ccc;padding-top:6px}
  .no-break{page-break-inside:avoid}
  @media print{body{padding:10mm 12mm}tr{page-break-inside:avoid}}
</style></head><body>

${sec('deckblatt')?`
<div class="deckblatt no-break">
  <h1>🐾 Tierarzt-Bericht</h1>
  <div style="font-size:15pt;font-weight:bold;margin:4px 0">${esc(hund.name)}</div>
  <div class="meta-grid">
    <div><span>Rasse:</span> ${esc(hund.rasse||'–')}</div>
    <div><span>Geschlecht:</span> ${hund.geschlecht==='m'?'♂ männlich':'♀ weiblich'}${hund.kastriert==='ja'?' · kastriert':''}</div>
    <div><span>Geburtsdatum:</span> ${esc(hund.geburtsdatum||'–')}</div>
    <div><span>Letztes Gewicht:</span> ${esc(letzesGewicht)}</div>
    <div><span>Zeitraum:</span> ${esc(zeitraumStr)}</div>
    <div><span>Erstellt am:</span> ${_fmtToday()}</div>
  </div>
</div>`:''}

${sectionBlock('symptome','📋 Symptomverlauf',sym.length?`
<table><thead><tr><th>Datum</th><th>Kategorie</th><th>Schweregrad</th><th>Körperstelle</th><th>Beschreibung</th></tr></thead>
<tbody>${sym.map(r=>`<tr class="no-break">
  <td style="white-space:nowrap">${esc(g(r,1))}</td>
  <td>${esc(g(r,2))}</td>
  <td><div class="sw-bar"><div class="sw-fill" style="width:${Math.min(parseInt(g(r,4))||0,5)/5*100}%"></div></div>${g(r,4)||'0'}/5</td>
  <td>${esc(g(r,5))}</td><td>${esc(g(r,3))}</td></tr>`).join('')}
</tbody></table>
<p style="font-size:9pt;color:#555">Schweregrad: 0=keine, 1=sehr leicht … 5=sehr stark</p>`
:'<p class="empty">Keine Symptome im Zeitraum.</p>')}

${sectionBlock('allergene','⚠️ Bekannte Allergene',all.length?`
<table><thead><tr><th>Allergen</th><th>Kategorie</th><th>Reaktionsstärke</th><th>Symptome</th></tr></thead>
<tbody>${all.map(r=>`<tr class="no-break"><td><strong>${esc(g(r,1))}</strong></td><td>${esc(g(r,2))}</td><td>${g(r,3)||'–'}/5</td><td>${esc(g(r,4))}</td></tr>`).join('')}
</tbody></table>`:'<p class="empty">Keine bekannten Allergene erfasst.</p>')}

${sectionBlock('ausschluss','📋 Ausschlussdiät-Status',aus.length?`
<table><thead><tr><th>Zutat</th><th>Status</th><th>Verdacht</th><th>Reaktion</th><th>Datum</th></tr></thead>
<tbody>${aus.map(r=>{const st=g(r,4);const bc=st.toLowerCase().includes('verträglich')?'badge-ok':st.toLowerCase().includes('reaktion')?'badge-bad':'badge-warn';return`<tr class="no-break"><td><strong>${esc(g(r,1))}</strong></td><td><span class="badge ${bc}">${esc(st||'–')}</span></td><td>${g(r,2)||'0'}/3</td><td>${esc(g(r,6))}</td><td>${esc(g(r,5))}</td></tr>`;}).join('')}
</tbody></table>`:'<p class="empty">Keine Ausschlussdiät-Einträge.</p>')}

${sectionBlock('phasen','📅 Phasen-Timeline',phas.length?`
<table><thead><tr><th>Typ</th><th>Zutat</th><th>Zeitraum</th><th>Ergebnis</th></tr></thead>
<tbody>${phas.map(r=>{const erg=g(r,6)||'offen';const bc=erg==='verträglich'?'badge-ok':erg==='reaktion'?'badge-bad':'badge-warn';const typ={'elimination':'Elimination','provokation':'Provokation','ergebnis':'Ergebnis'}[g(r,2)]||g(r,2);return`<tr class="no-break"><td>${esc(typ)}</td><td>${esc(g(r,3)||'–')}</td><td style="white-space:nowrap">${esc(g(r,4))} → ${esc(g(r,5))}</td><td><span class="badge ${bc}">${esc(erg)}</span></td></tr>`;}).join('')}
</tbody></table>`:'<p class="empty">Keine Phasen eingetragen.</p>')}

${sectionBlock('medikamente','💊 Medikamente',med.length?`
<table><thead><tr><th>Medikament</th><th>Typ</th><th>Dosierung</th><th>Häufigkeit</th><th>Von</th><th>Bis</th></tr></thead>
<tbody>${med.map(r=>`<tr class="no-break"><td><strong>${esc(g(r,1))}</strong></td><td>${esc(g(r,2))}</td><td>${esc(g(r,3))}</td><td>${esc(g(r,4))}</td><td style="white-space:nowrap">${esc(g(r,5))}</td><td style="white-space:nowrap">${esc(g(r,6))}</td></tr>`).join('')}
</tbody></table>`:'<p class="empty">Keine Medikamente erfasst.</p>')}

${sectionBlock('futter','🥩 Letzte Futtereinträge (max. 10)',fut.length?`
<table><thead><tr><th>Datum</th><th>Futter / Rezept</th><th>Erstgabe</th><th>Provokation</th><th>Reaktion</th></tr></thead>
<tbody>${fut.map(r=>`<tr class="no-break"><td style="white-space:nowrap">${esc(g(r,1))}</td><td>${esc(g(r,2))}${g(r,3)?` <span style="color:#555;font-size:9pt">(${esc(g(r,3))})</span>`:''}</td><td>${g(r,4)==='Ja'?'✓':''}</td><td>${g(r,6)==='Ja'?'⚠️ Ja':''}</td><td>${esc(g(r,7))}</td></tr>`).join('')}
</tbody></table>`:'<p class="empty">Keine Futtereinträge im Zeitraum.</p>')}

${sec('reaktion')&&reaktionHtml?`<h2>🧪 Zutaten-Reaktionsscore</h2>${reaktionHtml}`:''}
${sec('korrelation')&&korrHtml?`<h2>🔗 Korrelationsanalyse</h2>${korrHtml}`:''}

<div class="disclaimer">
  ⚠️ Dieser Bericht wurde automatisch aus den Tagebuchdaten der Hund-Manager-App generiert (v2.0.0).
  Er ersetzt keine tierärztliche Diagnose. Alle Angaben wurden vom Hundebesitzer selbst erfasst.
  Exportiert am ${_fmtToday()}.
</div>
<div class="footer">Hund Manager v2.0.0 · ${_fmtToday()} · Zeitraum: ${esc(zeitraumStr)}</div>
</body></html>`;

    const win = window.open('','_blank','width=920,height=750');
    if (!win) { alert('Popup blockiert. Bitte Popups erlauben und erneut versuchen.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    document.getElementById('export-dialog-overlay')?.remove();

  } catch(e) {
    alert('Fehler: ' + e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='📄 Bericht erstellen & drucken'; }
  }
}
