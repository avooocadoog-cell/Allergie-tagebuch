/**
 * MODULE: ansicht.js  (Cache-Version)
 * Liest aus cache.js statt direkt von Sheets.
 */

import { getSheet }      from './cache.js';
import { get as getCfg } from './config.js';
import { esc }           from './ui.js';

const SHEET_MAP = {
  umwelt:      'Umweltagebuch',
  symptom:     'Symptomtagebuch',
  futter:      'Futtertagebuch',
  ausschluss:  'Ausschlussdiät',
  allergen:    'Bekannte Allergene',
  tierarzt:    'Tierarztbesuche',
  medikamente: 'Medikamente',
};

export async function load(which, forceRefresh = false) {
  const contentId = `v-${which}-content`;
  const el = document.getElementById(contentId);
  if (!el) return;

  el.innerHTML = '<div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>';

  try {
    const sheet = SHEET_MAP[which];
    const rows  = await getSheet(sheet, 'tagebuch', forceRefresh);
    const dataRows = rows.slice(2).filter(r =>
      r?.some(v => v !== null && v !== undefined && String(v).trim() !== '')
    );

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

function renderRows(which, rows) {
  if (which === 'ausschluss') return renderAusschluss(rows);
  const fns = {
    umwelt: renderUmwelt, symptom: renderSymptom, futter: renderFutter,
    allergen: renderAllergen, tierarzt: renderTierarzt, medikamente: renderMedikamente,
  };
  const fn = fns[which];
  return fn ? [...rows].reverse().map(fn).join('') : '';
}

function row(key, val) {
  return `<div class="ec-row"><span class="ec-key">${key}</span><span class="ec-val">${val}</span></div>`;
}

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

function renderSymptom(r) {
  const schwere = parseInt(g(r,4)) || 0;
  const dots = Array.from({length:5}, (_,i) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
      background:${i<schwere?'var(--c2)':'var(--border)'};margin-right:2px"></span>`).join('');
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

function renderFutter(r) {
  return `<div class="entry-card">
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

function renderAusschluss(rows) {
  const cats = {};
  rows.forEach(r => { const k=g(r,3)||'Sonstiges'; (cats[k]=cats[k]||[]).push(r); });
  let html = '<div class="divider"><span>Übersicht</span></div>';
  Object.keys(cats).sort().forEach(kat => {
    html += `<div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--sub);text-transform:uppercase;margin-bottom:5px">${esc(kat)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">`;
    cats[kat].forEach(r => {
      const s=g(r,4); const cls=s.includes('vertr')?'badge-ok':s.includes('Reaktion')||s.toLowerCase().includes('gesperrt')?'badge-bad':'badge-warn';
      html += `<span class="badge ${cls}">${esc(g(r,1))}</span>`;
    });
    html += '</div></div>';
  });
  html += `<div class="divider"><span>Alle Einträge (${rows.length})</span></div>`;
  rows.forEach(r => {
    const s=g(r,4); const cls=s.includes('vertr')?'badge-ok':s.includes('Reaktion')||s.toLowerCase().includes('gesperrt')?'badge-bad':'badge-warn';
    html += `<div class="entry-card">
      <div class="ec-date">${esc(g(r,1))}${g(r,5)?' – seit '+esc(g(r,5)):''}</div>
      ${s?`<div class="ec-row"><span class="ec-key">Status</span><span class="ec-val badge ${cls}">${esc(s)}</span></div>`:''}
      ${g(r,2)?`<div class="ec-row"><span class="ec-key">Verdacht</span><span class="ec-val badge badge-warn">⚠️ Stufe ${esc(g(r,2))}</span></div>`:''}
      ${g(r,6)?row('Reaktion',esc(g(r,6))):''}
    </div>`;
  });
  return html;
}

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

function renderTierarzt(r) {
  return `<div class="entry-card">
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

function renderMedikamente(r) {
  return `<div class="entry-card">
    <div class="ec-date">💊 ${esc(g(r,1))}</div>
    ${g(r,2) ? row('Typ', esc(g(r,2))) : ''}
    ${g(r,3) ? row('Dosierung', esc(g(r,3))) : ''}
    ${g(r,4) ? row('Häufigkeit', esc(g(r,4))) : ''}
    ${g(r,5)||g(r,6) ? row('Zeitraum', `${esc(g(r,5))} – ${esc(g(r,6))}`) : ''}
    ${g(r,7) ? row('Verordnet', esc(g(r,7))) : ''}
    ${g(r,8) ? row('Wirkung', esc(g(r,8))) : ''}
  </div>`;
}
