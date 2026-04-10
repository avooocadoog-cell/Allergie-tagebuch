/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: export.js                                           ║
 * ║  Hund Manager – Tierarzt-Bericht PDF Export                  ║
 * ║                                                              ║
 * ║  Generiert einen druckbaren Bericht via window.print()       ║
 * ║  + CSS @media print. Kein externes PDF-Tool nötig.           ║
 * ║                                                              ║
 * ║  Abhängigkeiten: store.js, cache.js, config.js               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { getHunde }            from './store.js';
import { getSheet }            from './cache.js';
import { get as getCfg }       from './config.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Datumshelfer ─────────────────────────────────────────────────
function _parseDE(str) {
  if (!str) return null;
  const [d,m,y] = String(str).split('.');
  const date = new Date(+y, +m-1, +d);
  return isNaN(date.getTime()) ? null : date;
}
function _toTS(str) { const d=_parseDE(str); return d ? d.getTime() : 0; }
function _fmtToday() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,'0')}.${String(n.getMonth()+1).padStart(2,'0')}.${n.getFullYear()}`;
}

// ════════════════════════════════════════════════════════════════
//  HAUPTFUNKTION
// ════════════════════════════════════════════════════════════════

/**
 * Bericht erstellen und window.print() aufrufen.
 * @param {number} hundId
 * @param {number} zeitraumTage  – 30 / 60 / 90 / 180
 */
export async function exportTierarztPDF(hundId, zeitraumTage = 90) {
  const btn = document.getElementById('export-pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Wird erstellt…'; }

  try {
    // ── Daten laden ─────────────────────────────────────────────
    const hund = getHunde().find(h => h.hund_id === hundId);
    if (!hund) throw new Error('Hund nicht gefunden.');

    const cutoff = zeitraumTage > 0
      ? new Date(Date.now() - zeitraumTage * 86_400_000)
      : new Date(0);

    const inRange = str => { const d=_parseDE(str); return d && d >= cutoff; };
    const notDel  = (r, idx) => String(r[idx]??'').toUpperCase() !== 'TRUE';
    const g       = (r,i)    => String(r[i]??'').trim();

    const [rSym, rFut, rMed, rAll, rAus, rGew, rPhas] = await Promise.all([
      getSheet('Symptomtagebuch',  'tagebuch', false).catch(()=>[]),
      getSheet('Futtertagebuch',   'tagebuch', false).catch(()=>[]),
      getSheet('Medikamente',      'tagebuch', false).catch(()=>[]),
      getSheet('Bekannte Allergene','tagebuch',false).catch(()=>[]),
      getSheet('Ausschlussdiät',   'tagebuch', false).catch(()=>[]),
      getSheet('Hund_Gewicht',     'tagebuch', false).catch(()=>[]),
      getSheet('Ausschluss_Phasen','tagebuch', false).catch(()=>[]),
    ]);

    const _rows = (raw, skip=2) =>
      (raw||[]).slice(skip).filter(r=>r?.some(v=>String(v).trim()));

    const sym  = _rows(rSym) .filter(r=>g(r,0)===String(hundId)&&inRange(g(r,1))&&notDel(r,9));
    const fut  = _rows(rFut) .filter(r=>g(r,0)===String(hundId)&&inRange(g(r,1))&&notDel(r,11))
                             .sort((a,b)=>_toTS(g(b,1))-_toTS(g(a,1))).slice(0,10);
    const med  = _rows(rMed) .filter(r=>g(r,0)===String(hundId)&&notDel(r,11));
    const all  = _rows(rAll) .filter(r=>g(r,0)===String(hundId)&&notDel(r,8));
    const aus  = _rows(rAus) .filter(r=>g(r,0)===String(hundId)&&notDel(r,10));
    const gew  = _rows(rGew) .filter(r=>g(r,1)===String(hundId))
                             .sort((a,b)=>_toTS(g(b,2))-_toTS(g(a,2)));
    const phas = _rows(rPhas).filter(r=>g(r,1)===String(hundId)&&notDel(r,9))
                             .sort((a,b)=>_toTS(g(b,4))-_toTS(g(a,4)));

    const letzesGewicht = gew[0] ? `${parseFloat(g(gew[0],3)).toFixed(1)} kg (${g(gew[0],2)})` : '–';

    // ── HTML bauen ──────────────────────────────────────────────
    const html = `
<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8">
<title>Tierarzt-Bericht – ${esc(hund.name)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background:#fff; padding:20mm 15mm; }
  h1 { font-size:18pt; margin-bottom:4px; }
  h2 { font-size:13pt; margin:18px 0 6px; padding-bottom:4px; border-bottom:2px solid #111; }
  h3 { font-size:11pt; margin:12px 0 4px; }
  p, li { line-height:1.5; margin-bottom:3px; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:10pt; }
  th { background:#111; color:#fff; padding:5px 8px; text-align:left; font-size:9pt; }
  td { padding:4px 8px; border-bottom:1px solid #ccc; vertical-align:top; }
  tr:nth-child(even) td { background:#f5f5f5; }
  .badge { display:inline-block; padding:1px 6px; border-radius:3px; font-size:9pt; font-weight:bold; }
  .badge-ok   { background:#d4edda; color:#155724; border:1px solid #c3e6cb; }
  .badge-warn { background:#fff3cd; color:#856404; border:1px solid #ffc107; }
  .badge-bad  { background:#f8d7da; color:#721c24; border:1px solid #f5c6cb; }
  .deckblatt  { margin-bottom:24px; padding-bottom:16px; border-bottom:3px double #111; }
  .meta-grid  { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; margin-top:10px; font-size:10pt; }
  .meta-grid span { color:#555; }
  .empty { color:#777; font-style:italic; font-size:10pt; }
  .sw-bar { display:inline-block; width:80px; height:8px; background:#ddd; border-radius:3px; vertical-align:middle; margin-right:4px; }
  .sw-fill { height:100%; border-radius:3px; background:#111; }
  .disclaimer { margin-top:24px; padding:8px 12px; border:1px solid #ccc; font-size:9pt; color:#555; }
  .footer { margin-top:16px; font-size:9pt; color:#777; text-align:right; border-top:1px solid #ccc; padding-top:6px; }
  @media print {
    body { padding:10mm 12mm; }
    h2 { page-break-before: auto; }
    .no-break { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head><body>

<!-- DECKBLATT -->
<div class="deckblatt no-break">
  <h1>🐾 Tierarzt-Bericht</h1>
  <div style="font-size:15pt;font-weight:bold;margin:4px 0">${esc(hund.name)}</div>
  <div class="meta-grid">
    <div><span>Rasse:</span> ${esc(hund.rasse||'–')}</div>
    <div><span>Geschlecht:</span> ${hund.geschlecht==='m'?'♂ männlich':'♀ weiblich'}${hund.kastriert==='ja'?' · kastriert':''}</div>
    <div><span>Geburtsdatum:</span> ${esc(hund.geburtsdatum||'–')}</div>
    <div><span>Letztes Gewicht:</span> ${esc(letzesGewicht)}</div>
    <div><span>Zeitraum:</span> ${zeitraumTage>0?'letzte '+zeitraumTage+' Tage':'Alle Daten'}</div>
    <div><span>Erstellt am:</span> ${_fmtToday()}</div>
  </div>
</div>

<!-- SYMPTOMVERLAUF -->
<h2>📋 Symptomverlauf</h2>
${sym.length ? `
<table>
  <thead><tr><th>Datum</th><th>Kategorie</th><th>Schweregrad</th><th>Körperstelle</th><th>Beschreibung</th></tr></thead>
  <tbody>
  ${sym.sort((a,b)=>_toTS(g(b,1))-_toTS(g(a,1))).map(r=>`
    <tr class="no-break">
      <td style="white-space:nowrap">${esc(g(r,1))}</td>
      <td>${esc(g(r,2))}</td>
      <td>
        <div class="sw-bar"><div class="sw-fill" style="width:${Math.min(parseInt(g(r,4))||0,5)/5*100}%"></div></div>
        ${g(r,4)||'0'}/5
      </td>
      <td>${esc(g(r,5))}</td>
      <td>${esc(g(r,3))}</td>
    </tr>`).join('')}
  </tbody>
</table>
<p style="font-size:9pt;color:#555">Schweregrad: 0=keine, 1=sehr leicht, 2=leicht, 3=mittel, 4=stark, 5=sehr stark</p>
` : '<p class="empty">Keine Symptome im gewählten Zeitraum.</p>'}

<!-- BEKANNTE ALLERGENE -->
<h2>⚠️ Bekannte Allergene</h2>
${all.length ? `
<table>
  <thead><tr><th>Allergen</th><th>Kategorie</th><th>Reaktionsstärke</th><th>Symptome</th></tr></thead>
  <tbody>
  ${all.map(r=>`
    <tr class="no-break">
      <td><strong>${esc(g(r,1))}</strong></td>
      <td>${esc(g(r,2))}</td>
      <td>${g(r,3)||'–'}/5</td>
      <td>${esc(g(r,4))}</td>
    </tr>`).join('')}
  </tbody>
</table>` : '<p class="empty">Keine bekannten Allergene erfasst.</p>'}

<!-- AUSSCHLUSSDIÄT -->
<h2>📋 Ausschlussdiät-Status</h2>
${aus.length ? `
<table>
  <thead><tr><th>Zutat</th><th>Status</th><th>Verdacht</th><th>Reaktion</th><th>Datum</th></tr></thead>
  <tbody>
  ${aus.map(r=>{
    const status=g(r,4);
    const badgeCls=status.includes('verträglich')||status.includes('Verträglich')?'badge-ok':status.includes('Reaktion')?'badge-bad':'badge-warn';
    return `<tr class="no-break">
      <td><strong>${esc(g(r,1))}</strong></td>
      <td><span class="badge ${badgeCls}">${esc(status||'–')}</span></td>
      <td>${g(r,2)||'0'}/3</td>
      <td>${esc(g(r,6))}</td>
      <td>${esc(g(r,5))}</td>
    </tr>`;
  }).join('')}
  </tbody>
</table>` : '<p class="empty">Keine Ausschlussdiät-Einträge vorhanden.</p>'}

${phas.length ? `
<h3>Phasen-Timeline</h3>
<table>
  <thead><tr><th>Typ</th><th>Zutat</th><th>Zeitraum</th><th>Ergebnis</th></tr></thead>
  <tbody>
  ${phas.map(r=>{
    const erg=g(r,6)||'offen';
    const bc=erg==='verträglich'?'badge-ok':erg==='reaktion'?'badge-bad':'badge-warn';
    const typ={'elimination':'Elimination','provokation':'Provokation','ergebnis':'Ergebnis'}[g(r,2)]||g(r,2);
    return `<tr class="no-break">
      <td>${esc(typ)}</td>
      <td>${esc(g(r,3)||'–')}</td>
      <td style="white-space:nowrap">${esc(g(r,4))} → ${esc(g(r,5))}</td>
      <td><span class="badge ${bc}">${esc(erg)}</span></td>
    </tr>`;
  }).join('')}
  </tbody>
</table>` : ''}

<!-- MEDIKAMENTE -->
<h2>💊 Medikamente</h2>
${med.length ? `
<table>
  <thead><tr><th>Medikament</th><th>Typ</th><th>Dosierung</th><th>Häufigkeit</th><th>Von</th><th>Bis</th><th>Verordnet</th></tr></thead>
  <tbody>
  ${med.map(r=>`
    <tr class="no-break">
      <td><strong>${esc(g(r,1))}</strong></td>
      <td>${esc(g(r,2))}</td>
      <td>${esc(g(r,3))}</td>
      <td>${esc(g(r,4))}</td>
      <td style="white-space:nowrap">${esc(g(r,5))}</td>
      <td style="white-space:nowrap">${esc(g(r,6))}</td>
      <td>${esc(g(r,7))}</td>
    </tr>`).join('')}
  </tbody>
</table>` : '<p class="empty">Keine Medikamente erfasst.</p>'}

<!-- LETZTE FUTTEREINTRÄGE -->
<h2>🥩 Letzte Futtereinträge (max. 10)</h2>
${fut.length ? `
<table>
  <thead><tr><th>Datum</th><th>Futter / Rezept</th><th>Erstgabe</th><th>Provokation</th><th>Reaktion</th></tr></thead>
  <tbody>
  ${fut.map(r=>`
    <tr class="no-break">
      <td style="white-space:nowrap">${esc(g(r,1))}</td>
      <td>${esc(g(r,2))} ${g(r,3)?'<span style="color:#555;font-size:9pt">('+esc(g(r,3))+')</span>':''}</td>
      <td>${g(r,4)==='Ja'?'✓':''}</td>
      <td>${g(r,6)==='Ja'?'⚠️ Ja':''}</td>
      <td>${esc(g(r,7))}</td>
    </tr>`).join('')}
  </tbody>
</table>` : '<p class="empty">Keine Futtereinträge im Zeitraum.</p>'}

<div class="disclaimer">
  ⚠️ Dieser Bericht wurde automatisch aus den Tagebuchdaten der Hund-Manager-App generiert.
  Er ersetzt keine tierärztliche Diagnose. Alle Angaben wurden vom Hundebesitzer selbst erfasst
  und sind ohne Gewähr. Exportiert am ${_fmtToday()}.
</div>

<div class="footer">
  Hund Manager v1.6.0 · Exportiert am ${_fmtToday()} · ${zeitraumTage>0?'Zeitraum: letzte '+zeitraumTage+' Tage':'Alle verfügbaren Daten'}
</div>

</body></html>`;

    // ── Druckfenster öffnen ─────────────────────────────────────
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Popup wurde blockiert. Bitte Popups für diese Seite erlauben und erneut versuchen.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };

  } catch(e) {
    alert('Fehler beim Erstellen des Berichts: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Tierarzt-Export'; }
  }
}

/**
 * Öffnet den Export-Dialog (Zeitraum wählen) als Modal.
 * @param {number} hundId
 */
export function showExportDialog(hundId) {
  // Bestehendes Overlay entfernen
  document.getElementById('export-dialog-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'export-dialog-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;
    display:flex;align-items:center;justify-content:center;padding:1rem`;
  overlay.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius);padding:1.5rem;
      width:100%;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div style="font-size:15px;font-weight:700">📄 Tierarzt-Export</div>
        <button onclick="document.getElementById('export-dialog-overlay').remove()"
          style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--sub)">✕</button>
      </div>
      <div style="font-size:12px;color:var(--sub);margin-bottom:12px;line-height:1.5">
        Erzeugt einen druckbaren Bericht mit Symptomen, Allergenen,
        Ausschlussdiät, Medikamenten und Futtereinträgen.
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:12px;color:var(--sub);display:block;margin-bottom:6px">Zeitraum</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[['30','30 Tage'],['60','60 Tage'],['90','90 Tage (Standard)'],['180','6 Monate']].map(([v,l])=>`
            <button onclick="window._exportZeitraum=${v};
              document.querySelectorAll('.exp-range-btn').forEach(b=>b.classList.remove('active'));
              this.classList.add('active')"
              class="exp-range-btn${v==='90'?' active':''}"
              style="padding:10px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius-sm);
                background:var(--bg2);color:var(--text);cursor:pointer;font-family:inherit;font-weight:500;
                transition:all .15s"
              data-val="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <button id="export-pdf-btn" onclick="EXPORT.exportTierarztPDF(${hundId}, window._exportZeitraum||90); document.getElementById('export-dialog-overlay').remove();"
        style="width:100%;padding:12px;font-size:14px;font-weight:700;border:none;
          border-radius:var(--radius-sm);background:var(--c2);color:#fff;cursor:pointer;
          font-family:inherit">
        📄 Bericht erstellen &amp; drucken
      </button>
      <div style="font-size:10px;color:var(--sub);margin-top:8px;text-align:center">
        Öffnet einen neuen Tab zum Drucken / Speichern als PDF
      </div>
    </div>`;

  // Aktive Button-Farbe via Style-Injection (einmalig)
  if (!document.getElementById('exp-btn-style')) {
    const s = document.createElement('style');
    s.id = 'exp-btn-style';
    s.textContent = '.exp-range-btn.active{background:var(--c2)!important;color:#fff!important;border-color:var(--c2)!important;font-weight:700!important}';
    document.head.appendChild(s);
  }

  window._exportZeitraum = 90;
  document.body.appendChild(overlay);
}
