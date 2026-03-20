/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: statistik.js                                        ║
 * ║  Hund Manager – Statistik & Korrelationsanalyse              ║
 * ║                                                              ║
 * ║  Sektionen:                                                  ║
 * ║  1. Übersicht – Symptomhäufigkeit, Schweregrad-Verlauf       ║
 * ║  2. Allergene & Reaktionen                                   ║
 * ║  3. Klima-Korrelation – Pollen/Wetter vs Symptome            ║
 * ║  4. Raumklima-Trends                                         ║
 * ║  5. Zusammenhänge – Futter/Medikamente vs Symptome           ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js, store.js, ui.js       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet }     from './sheets.js';
import { get as getCfg } from './config.js';
import { getHunde }      from './store.js';
import { esc }           from './ui.js';

// ── Chart.js Instanzen (für destroy bei Re-Render) ───────────────
const _charts = {};

// ── Farbpalette ──────────────────────────────────────────────────
const C = {
  green:  '#40916c', greenLight: 'rgba(64,145,108,.15)',
  orange: '#e76f51', orangeLight:'rgba(231,111,81,.15)',
  amber:  '#f59e0b', amberLight: 'rgba(245,158,11,.15)',
  blue:   '#3b82f6', blueLight:  'rgba(59,130,246,.15)',
  purple: '#8b5cf6', purpleLight:'rgba(139,92,246,.15)',
  gray:   '#9ca3af',
};

// ════════════════════════════════════════════════════════════════
//  ÖFFENTLICHE API
// ════════════════════════════════════════════════════════════════

export async function load() {
  const panel = document.getElementById('panel-statistik');
  if (!panel) return;

  panel.innerHTML = `
    <div style="padding:1rem">
      <div class="section-title">📊 Statistik</div>

      <!-- Hund + Zeitraum -->
      <div style="display:flex;gap:8px;margin-bottom:1rem;align-items:center">
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

      <div id="stat-content">
        <div class="view-loading"><div class="spinner"></div>Daten werden geladen…</div>
      </div>
    </div>
  `;

  // Hunde befüllen
  const hundSel = document.getElementById('stat-hund');
  getHunde().forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.hund_id;
    opt.textContent = h.name;
    hundSel.appendChild(opt);
  });

  refresh();
}

export async function refresh() {
  const hundId   = parseInt(document.getElementById('stat-hund')?.value)  || 1;
  const rangeDays= parseInt(document.getElementById('stat-range')?.value) || 90;
  const content  = document.getElementById('stat-content');
  if (!content) return;

  content.innerHTML = '<div class="view-loading"><div class="spinner"></div>Lade Daten…</div>';

  // Alle Charts destroyen
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e) {} });

  try {
    const cfg = getCfg();
    const tid = cfg.tagebuchId;

    // Alle relevanten Sheets parallel laden
    const [rSym, rUmw, rFut, rAus, rAll, rMed] = await Promise.all([
      readSheet('Symptomtagebuch', tid),
      readSheet('Umweltagebuch',   tid),
      readSheet('Futtertagebuch',  tid),
      readSheet('Ausschlussdiät',  tid),
      readSheet('Bekannte Allergene', tid),
      readSheet('Medikamente',     tid),
    ]);

    // Parsen & filtern
    const cutoff = rangeDays > 0
      ? new Date(Date.now() - rangeDays * 86_400_000)
      : new Date(0);

    const symptoms  = parseRows(rSym,  2).filter(r => matchHund(r, hundId) && inRange(r.datum, cutoff));
    const umwelt    = parseRows(rUmw,  2).filter(r => matchHund(r, hundId) && inRange(r.datum, cutoff));
    const futter    = parseRows(rFut,  2).filter(r => matchHund(r, hundId) && inRange(r.datum, cutoff));
    const ausschluss= parseRows(rAus,  2).filter(r => matchHund(r, hundId));
    const allergene = parseRows(rAll,  2).filter(r => matchHund(r, hundId));
    const medis     = parseRows(rMed,  2).filter(r => matchHund(r, hundId));

    content.innerHTML = renderSections();
    renderCharts({ symptoms, umwelt, futter, ausschluss, allergene, medis });

  } catch(e) {
    content.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
//  HTML GERÜST
// ════════════════════════════════════════════════════════════════

function renderSections() {
  return `
    <!-- ── Übersicht KPIs ── -->
    <div id="stat-kpis" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1.25rem"></div>

    <!-- ── Symptom Verlauf ── -->
    ${section('📈 Symptom-Schweregrad', `
      <canvas id="chart-verlauf" height="200"></canvas>
    `)}

    <!-- ── Symptom Häufigkeit ── -->
    ${section('🔍 Häufigste Symptome', `
      <canvas id="chart-haeufig" height="220"></canvas>
    `)}

    <!-- ── Allergene ── -->
    ${section('⚠️ Bekannte Allergene', `<div id="stat-allergene"></div>`)}

    <!-- ── Ausschluss-Status ── -->
    ${section('📋 Ausschlussdiät-Status', `
      <div id="stat-ausschluss-übersicht" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
      <canvas id="chart-ausschluss" height="180"></canvas>
    `)}

    <!-- ── Klima-Korrelation ── -->
    ${section('🌿 Pollen & Symptome', `
      <p style="font-size:12px;color:var(--sub);margin-bottom:8px">
        Vergleich: Pollen-Belastungstage vs Symptomtage im gleichen Zeitraum
      </p>
      <canvas id="chart-pollen-korr" height="200"></canvas>
    `)}

    <!-- ── Wetter ── -->
    ${section('🌡️ Temperatur & Symptome', `
      <canvas id="chart-wetter" height="200"></canvas>
    `)}

    <!-- ── Raumklima ── -->
    ${section('🏠 Raumklima', `
      <canvas id="chart-raumklima" height="180"></canvas>
    `)}

    <!-- ── Futter-Reaktionen ── -->
    ${section('🥩 Futter-Reaktionen', `
      <div id="stat-futter-reaktionen"></div>
    `)}

    <!-- ── Medikamente ── -->
    ${section('💊 Medikamenten-Zeiträume', `
      <div id="stat-medis"></div>
    `)}
  `;
}

function section(title, body) {
  return `
    <div style="background:var(--bg2);border:1px solid var(--border);
      border-radius:var(--radius);padding:14px;margin-bottom:1rem">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text)">${title}</div>
      ${body}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════
//  CHARTS & RENDER
// ════════════════════════════════════════════════════════════════

async function renderCharts({ symptoms, umwelt, futter, ausschluss, allergene, medis }) {
  // Chart.js laden falls nicht vorhanden
  if (!window.Chart) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');
  }
  const Chart = window.Chart;

  // ── KPIs ────────────────────────────────────────────────────
  const avgSchwere = symptoms.length
    ? (symptoms.reduce((s, r) => s + (parseInt(r.schweregrad) || 0), 0) / symptoms.filter(r => r.schweregrad).length).toFixed(1)
    : '–';
  const symDays   = new Set(symptoms.map(r => r.datum)).size;
  const pollenDays= umwelt.filter(r => r.pollen && r.pollen !== 'keine erhöhte Belastung').length;

  document.getElementById('stat-kpis').innerHTML = [
    kpi('Symptomtage', symDays, C.orange),
    kpi('Ø Schweregrad', avgSchwere, avgSchwere > 3 ? C.orange : C.green),
    kpi('Pollentage', pollenDays, C.amber),
  ].join('');

  // ── Symptom-Verlauf (Linie) ──────────────────────────────────
  {
    // Täglicher Max-Schweregrad
    const byDate = {};
    symptoms.forEach(r => {
      const d = parseDate(r.datum);
      if (!d) return;
      const key = d.toISOString().slice(0,10);
      byDate[key] = Math.max(byDate[key] || 0, parseInt(r.schweregrad) || 0);
    });
    const dates  = Object.keys(byDate).sort();
    const values = dates.map(d => byDate[d]);

    _charts.verlauf = new Chart(
      document.getElementById('chart-verlauf').getContext('2d'), {
        type: 'line',
        data: {
          labels: dates.map(formatLabel),
          datasets: [{
            label: 'Max. Schweregrad',
            data: values,
            borderColor: C.orange,
            backgroundColor: C.orangeLight,
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: values.map(v => v >= 4 ? C.orange : v >= 2 ? C.amber : C.green),
          }]
        },
        options: chartOpts({ max: 5, stepSize: 1, title: '' }),
      }
    );
  }

  // ── Symptom-Häufigkeit (Balken) ──────────────────────────────
  {
    const counts = {};
    symptoms.forEach(r => {
      if (!r.kategorie) return;
      r.kategorie.split(',').map(s => s.trim()).forEach(k => {
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);

    _charts.haeufig = new Chart(
      document.getElementById('chart-haeufig').getContext('2d'), {
        type: 'bar',
        data: {
          labels: sorted.map(([k]) => k),
          datasets: [{
            label: 'Häufigkeit',
            data: sorted.map(([,v]) => v),
            backgroundColor: sorted.map(([,v], i) =>
              i === 0 ? C.orange : i < 3 ? C.amber : C.green),
          }]
        },
        options: {
          ...chartOpts({ title: '' }),
          indexAxis: 'y',
        },
      }
    );
  }

  // ── Allergene ────────────────────────────────────────────────
  {
    const el = document.getElementById('stat-allergene');
    if (allergene.length) {
      el.innerHTML = allergene.map(a => {
        const reakt = parseInt(a.reaktion) || 0;
        const dots  = '●'.repeat(reakt) + '○'.repeat(5-reakt);
        const col   = reakt >= 4 ? C.orange : reakt >= 3 ? C.amber : C.green;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;
            padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:14px;font-weight:600">${esc(a.allergen)}</div>
              <div style="font-size:12px;color:var(--sub)">${esc(a.kategorie)} · ${esc(a.symptome)}</div>
            </div>
            <div style="font-size:16px;color:${col};letter-spacing:2px">${dots}</div>
          </div>`;
      }).join('') || '<div style="color:var(--sub);font-size:13px">Keine Allergene erfasst.</div>';
    } else {
      el.innerHTML = '<div style="color:var(--sub);font-size:13px">Keine Allergene erfasst.</div>';
    }
  }

  // ── Ausschluss-Status (Donut) ────────────────────────────────
  {
    const übersicht = document.getElementById('stat-ausschluss-übersicht');
    const statusGroups = {};
    ausschluss.forEach(r => {
      const s = r.status || 'Unbekannt';
      (statusGroups[s] = statusGroups[s] || []).push(r.zutat);
    });
    übersicht.innerHTML = Object.entries(statusGroups).map(([status, zutaten]) => {
      const col = status.includes('vertr') ? C.green
                : status.includes('Reaktion') || status.includes('Gesperrt') ? C.orange
                : C.amber;
      return `<div style="margin-bottom:6px;width:100%">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
          color:${col};margin-bottom:4px">${esc(status)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${zutaten.map(z => `<span class="badge" style="background:${col}22;color:${col};
            border:1px solid ${col}44">${esc(z)}</span>`).join('')}
        </div>
      </div>`;
    }).join('') || '<div style="color:var(--sub);font-size:13px">Keine Ausschlussdiät-Einträge.</div>';

    if (ausschluss.length) {
      const statusCount = {};
      ausschluss.forEach(r => { statusCount[r.status||'Unbekannt'] = (statusCount[r.status||'Unbekannt']||0)+1; });
      _charts.ausschluss = new Chart(
        document.getElementById('chart-ausschluss').getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: Object.keys(statusCount),
            datasets: [{
              data: Object.values(statusCount),
              backgroundColor: Object.keys(statusCount).map(s =>
                s.includes('vertr') ? C.green
                : s.includes('Reaktion') || s.includes('Gesperrt') ? C.orange
                : s.includes('Test') ? C.amber : C.blue),
            }]
          },
          options: { plugins: { legend: { position: 'right' } }, cutout: '60%' },
        }
      );
    }
  }

  // ── Pollen-Korrelation ───────────────────────────────────────
  {
    // Pro Woche: Pollen-Tage vs Symptom-Tage
    const weekData = {};
    umwelt.forEach(r => {
      const d = parseDate(r.datum);
      if (!d) return;
      const week = getWeekKey(d);
      if (!weekData[week]) weekData[week] = { pollen: 0, symptome: 0, schwere: 0 };
      if (r.pollen && r.pollen !== 'keine erhöhte Belastung' && r.pollen !== '') {
        weekData[week].pollen++;
      }
    });
    symptoms.forEach(r => {
      const d = parseDate(r.datum);
      if (!d) return;
      const week = getWeekKey(d);
      if (!weekData[week]) weekData[week] = { pollen: 0, symptome: 0, schwere: 0 };
      weekData[week].symptome++;
      weekData[week].schwere = Math.max(weekData[week].schwere, parseInt(r.schweregrad)||0);
    });

    const weeks  = Object.keys(weekData).sort();
    _charts.pollen = new Chart(
      document.getElementById('chart-pollen-korr').getContext('2d'), {
        type: 'bar',
        data: {
          labels: weeks.map(w => 'KW ' + w.split('-W')[1] + '/' + w.split('-W')[0].slice(2)),
          datasets: [
            {
              label: 'Pollentage',
              data: weeks.map(w => weekData[w].pollen),
              backgroundColor: C.amberLight,
              borderColor: C.amber,
              borderWidth: 1,
              yAxisID: 'y',
            },
            {
              label: 'Symptomtage',
              data: weeks.map(w => weekData[w].symptome),
              backgroundColor: C.orangeLight,
              borderColor: C.orange,
              borderWidth: 1,
              yAxisID: 'y',
            },
            {
              label: 'Max. Schweregrad',
              data: weeks.map(w => weekData[w].schwere),
              type: 'line',
              borderColor: C.purple,
              backgroundColor: 'transparent',
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: 'y2',
            },
          ]
        },
        options: {
          ...chartOpts({ title: '' }),
          scales: {
            y:  { beginAtZero:true, position:'left',  title:{display:true,text:'Tage'} },
            y2: { beginAtZero:true, position:'right', max:5,
                  title:{display:true,text:'Schweregrad'}, grid:{drawOnChartArea:false} },
          },
        },
      }
    );
  }

  // ── Wetter + Symptome ────────────────────────────────────────
  {
    const byDate = {};
    umwelt.forEach(r => {
      const d = parseDate(r.datum);
      if (!d) return;
      const key = d.toISOString().slice(0,10);
      byDate[key] = { ...byDate[key],
        tempMax: parseFloat(r.temp_max) || null,
        feuchtig: parseFloat(r.luftfeuchtig) || null,
      };
    });
    symptoms.forEach(r => {
      const d = parseDate(r.datum);
      if (!d) return;
      const key = d.toISOString().slice(0,10);
      if (!byDate[key]) byDate[key] = {};
      byDate[key].schwere = Math.max(byDate[key].schwere||0, parseInt(r.schweregrad)||0);
    });
    const dates = Object.keys(byDate).sort();

    _charts.wetter = new Chart(
      document.getElementById('chart-wetter').getContext('2d'), {
        type: 'line',
        data: {
          labels: dates.map(formatLabel),
          datasets: [
            {
              label: 'Temp. Max (°C)',
              data: dates.map(d => byDate[d].tempMax),
              borderColor: C.orange, backgroundColor: 'transparent',
              tension: 0.3, pointRadius: 0, yAxisID: 'y',
            },
            {
              label: 'Luftfeuchtig. (%)',
              data: dates.map(d => byDate[d].feuchtig),
              borderColor: C.blue, backgroundColor: 'transparent',
              tension: 0.3, pointRadius: 0, yAxisID: 'y',
            },
            {
              label: 'Schweregrad',
              data: dates.map(d => byDate[d].schwere || null),
              borderColor: C.purple, backgroundColor: C.purpleLight,
              fill: true, tension: 0.3,
              pointRadius: d => byDate[d]?.schwere ? 4 : 0,
              yAxisID: 'y2',
            },
          ]
        },
        options: {
          ...chartOpts({ title: '' }),
          scales: {
            y:  { beginAtZero:false, position:'left' },
            y2: { beginAtZero:true, max:5, position:'right', grid:{drawOnChartArea:false} },
          },
        },
      }
    );
  }

  // ── Raumklima ────────────────────────────────────────────────
  {
    const raumData = umwelt
      .filter(r => r.raumtemp || r.raumfeuchtig)
      .map(r => ({
        datum:   parseDate(r.datum),
        temp:    parseFloat(r.raumtemp)    || null,
        feuchtig:parseFloat(r.raumfeuchtig)|| null,
      }))
      .filter(r => r.datum)
      .sort((a,b) => a.datum - b.datum);

    if (raumData.length) {
      _charts.raumklima = new Chart(
        document.getElementById('chart-raumklima').getContext('2d'), {
          type: 'line',
          data: {
            labels: raumData.map(r => formatLabel(r.datum.toISOString().slice(0,10))),
            datasets: [
              {
                label: 'Raumtemperatur (°C)',
                data: raumData.map(r => r.temp),
                borderColor: C.orange, backgroundColor: 'transparent',
                tension: 0.3, pointRadius: 2,
              },
              {
                label: 'Raumluftfeucht. (%)',
                data: raumData.map(r => r.feuchtig),
                borderColor: C.blue, backgroundColor: 'transparent',
                tension: 0.3, pointRadius: 2,
              },
            ]
          },
          options: chartOpts({ title: '' }),
        }
      );
    } else {
      document.getElementById('chart-raumklima').closest('div').innerHTML +=
        '<p style="font-size:13px;color:var(--sub);text-align:center;padding:1rem">Keine Raumklima-Daten im Zeitraum.</p>';
    }
  }

  // ── Futter-Reaktionen ────────────────────────────────────────
  {
    const el = document.getElementById('stat-futter-reaktionen');
    const reaktionen = futter.filter(r => r.beschreibung || r.provokation === 'Ja');

    if (reaktionen.length) {
      el.innerHTML = reaktionen.map(r => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-size:13px;font-weight:600">${esc(r.datum)}</div>
            ${r.provokation === 'Ja'
              ? '<span class="badge badge-warn">⚠️ Provokation</span>'
              : r.erstegabe  === 'Ja'
              ? '<span class="badge badge-ok">Erste Gabe</span>' : ''}
          </div>
          ${r.produkt ? `<div style="font-size:12px;color:var(--sub)">${esc(r.produkt)}</div>` : ''}
          ${r.beschreibung ? `<div style="font-size:13px;margin-top:4px">${esc(r.beschreibung)}</div>` : ''}
        </div>`).join('');
    } else {
      el.innerHTML = '<div style="color:var(--sub);font-size:13px">Keine Reaktionen im Zeitraum erfasst.</div>';
    }
  }

  // ── Medikamente ──────────────────────────────────────────────
  {
    const el = document.getElementById('stat-medis');
    if (medis.length) {
      el.innerHTML = medis.map(m => {
        const von = m.von || '?';
        const bis = m.bis || 'laufend';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;
            padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:14px;font-weight:600">${esc(m.name)}</div>
              <div style="font-size:12px;color:var(--sub)">${esc(m.typ)} · ${esc(m.dosierung)}</div>
            </div>
            <div style="font-size:12px;color:var(--sub);text-align:right">
              ${esc(von)}<br>bis ${esc(bis)}
            </div>
          </div>`;
      }).join('');
    } else {
      el.innerHTML = '<div style="color:var(--sub);font-size:13px">Keine Medikamente im Zeitraum.</div>';
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

function kpi(label, value, color) {
  return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);
      padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
      <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${label}</div>
    </div>`;
}

function chartOpts({ max, stepSize, title } = {}) {
  return {
    responsive: true,
    plugins: {
      legend: { display: true, labels: { boxWidth: 12, font: { size: 11 } } },
      title:  { display: !!title, text: title },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
      y: {
        beginAtZero: true,
        ...(max ? { max } : {}),
        ticks: { stepSize: stepSize || undefined, font: { size: 10 } },
      },
    },
  };
}

// DD.MM.YYYY oder YYYY-MM-DD → Date
function parseDate(str) {
  if (!str) return null;
  if (str.includes('.')) {
    const [d, m, y] = str.split('.');
    return new Date(parseInt(y), parseInt(m)-1, parseInt(d));
  }
  if (str.includes('-')) return new Date(str);
  return null;
}

function formatLabel(isoDate) {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getWeekKey(date) {
  const d   = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay()+6)%7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d-week1)/86400000 - 3 + (week1.getDay()+6)%7)/7);
  return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`;
}

function inRange(datum, cutoff) {
  const d = parseDate(datum);
  return d && d >= cutoff;
}

function matchHund(row, hundId) {
  return !row.hund_id || String(row.hund_id) === String(hundId);
}

// Sheets-Zeilen parsen (ab skipRows, Spalten als Array)
function parseRows(rawRows, skipRows) {
  if (!rawRows?.length) return [];
  const header = rawRows[1] || rawRows[0]; // Zeile 2 als Spaltennamen
  return rawRows.slice(skipRows).filter(r => r?.some(v => v !== null && v !== undefined && String(v).trim() !== ''))
    .map(row => {
      const obj = { hund_id: row[0] };
      if (header) {
        header.forEach((col, i) => {
          const key = String(col||'').toLowerCase()
            .replace(/[äöü]/g, c => ({ä:'ae',ö:'oe',ü:'ue'}[c]))
            .replace(/[^a-z0-9]/g, '_').replace(/_+/g,'_').replace(/^_|_$/g,'');
          if (key) obj[key] = row[i] !== undefined ? String(row[i]).trim() : '';
        });
      } else {
        // Fallback: Spalten numerisch
        row.forEach((v, i) => { obj['col'+i] = v; });
      }
      // Immer datum aus Spalte 1
      obj.datum = row[1] !== undefined ? String(row[1]).trim() : '';
      return obj;
    });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
