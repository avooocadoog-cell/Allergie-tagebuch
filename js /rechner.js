/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: rechner.js                                          ║
 * ║  Hund Manager – Futterrechner                                ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Rezeptliste laden & anzeigen                              ║
 * ║  - Rezept öffnen, neu erstellen, speichern                   ║
 * ║  - Zutaten hinzufügen, Gramm ändern, entfernen               ║
 * ║  - Kochverlust-Toggle                                        ║
 * ║  - Nährstoffberechnung (NRC 2006, individuelle Toleranzen)   ║
 * ║  - Kalorien, Ca:P, Omega 6:3 Verhältnisse                   ║
 * ║  - Neue Zutat manuell erfassen & in Sheets speichern         ║
 * ║  - Skalierungsfaktor anwenden                                ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js, store.js, ui.js       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet, appendRow, writeRange } from './sheets.js';
import { get as getCfg }                    from './config.js';
import { getZutaten, getBedarf, getParameter, getKalorienParam,
         getTolerance, getNutrMap, getRezepte,
         getNaehrstoffInfo, getBedarfByName,
         addZutat, addZutatNutr }           from './store.js';
import { esc, showNutrPopup }               from './ui.js';

// ── Zustand ──────────────────────────────────────────────────────
let currentRecipe   = null;  // {rezept_id, hund_id, name, ingredients:[]}
let baseIngredients = [];    // Basismengen vor Skalierung
let scaleFactor     = 1.0;
let currentHundId   = 1;

// B-Vitamine verlieren beim Kochen ~30%
const COOKING_LOSS_NUTR = new Set([
  'Vitamin B1 (Thiamin)','Vitamin B2 (Riboflavin)','Vitamin B6 (Pyridoxin)',
  'Vitamin B12 (Cobalamin)','Vitamin B3 (Niacin)',
  'Vitamin B5 (Pantothensäure)','Vitamin B9 (Folsäure)',
]);

// ════════════════════════════════════════════════════════════════
//  GEWICHT & HUND
// ════════════════════════════════════════════════════════════════

function calcMkg(kg) {
  const exp = getParameter()['metabolisches_kg_exponent'] || 0.75;
  return Math.pow(kg, exp);
}

export function onHundChanged() {
  currentHundId = parseInt(document.getElementById('fr-hund-select')?.value) || 1;
  updateWeight();
}

export function updateWeight() {
  const kg  = parseFloat(document.getElementById('fr-dog-weight')?.value) || 27;
  const mkg = calcMkg(kg);
  _setMkg(mkg);
  _syncWeightInputs(kg);
  _updateKcalBedarfInfo(kg);
  recalc();
}

export function updateWeight2() {
  const kg = parseFloat(document.getElementById('fr-dog-weight2')?.value) || 27;
  const w1 = document.getElementById('fr-dog-weight');
  if (w1) w1.value = kg;
  _setMkg(calcMkg(kg));
  recalc();
}

function _setMkg(mkg) {
  ['fr-mkg','fr-mkg2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = mkg.toFixed(2);
  });
}

function _syncWeightInputs(kg) {
  const w2 = document.getElementById('fr-dog-weight2');
  if (w2) w2.value = kg;
}

function _updateKcalBedarfInfo(kg) {
  const kp       = getKalorienParam(currentHundId);
  const kcal     = kp.kcalManual || kp.rerFaktor70 * Math.pow(kg, kp.rerExponent) * kp.rerFaktor;
  const el       = document.getElementById('fr-kcal-bedarf-info');
  if (el) el.textContent = `Kcal-Bedarf: ~${Math.round(kcal)} kcal/Tag`;
}

// ════════════════════════════════════════════════════════════════
//  SKALIERUNG
// ════════════════════════════════════════════════════════════════

export function setScale(factor) {
  scaleFactor = factor;
  const inp = document.getElementById('fr-scale-input');
  if (inp) inp.value = factor;
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
  applyScale();
}

export function applyScale() {
  const factor = parseFloat(document.getElementById('fr-scale-input')?.value) || 1;
  scaleFactor  = factor;
  if (!currentRecipe || !baseIngredients.length) return;
  currentRecipe.ingredients = baseIngredients.map(ing => ({
    ...ing, grams: Math.round(ing.grams * factor * 10) / 10,
  }));
  renderIngredients();
  recalc();
}

// ════════════════════════════════════════════════════════════════
//  REZEPTLISTE
// ════════════════════════════════════════════════════════════════

export async function showList() {
  document.getElementById('fr-list').style.display = 'block';
  document.getElementById('fr-editor').classList.remove('active');
  currentRecipe = null;
  loadRecipeList();
}

export async function loadRecipeList() {
  const el = document.getElementById('fr-recipe-cards');
  el.innerHTML = '<div class="view-loading"><div class="spinner"></div>Rezepte werden geladen…</div>';
  try {
    const rows    = await readSheet('Rezepte', getCfg().stammdatenId);
    const rezepte = rows.slice(2)
      .filter(r => r?.[2] && String(r[2]).trim())
      .map(r => ({
        rezept_id: parseInt(r[0]) || 0,
        hund_id:   parseInt(r[1]) || 0,
        name:      String(r[2] || '').trim(),
        erstellt:  String(r[3] || '').trim(),
        notizen:   String(r[4] || '').trim(),
      }))
      .filter(r => !currentHundId || r.hund_id === currentHundId);

    if (!rezepte.length) {
      el.innerHTML = '<div class="view-empty"><div class="icon">📋</div>Noch keine Rezepte.<br>Erstelle dein erstes Rezept!</div>';
      return;
    }
    el.innerHTML = rezepte.map(r => `
      <div class="fr-recipe-card">
        <div class="rc-info" onclick="RECHNER.openRecipe(${r.rezept_id},'${esc(r.name)}')">
          <h3>${esc(r.name)}</h3>
          <p>${r.erstellt ? 'Erstellt: ' + esc(r.erstellt) : ''}${r.notizen ? ' · ' + esc(r.notizen) : ''}</p>
        </div>
        <button onclick="RECHNER.deleteRecipe(${r.rezept_id},'${esc(r.name)}')"
          style="background:none;border:none;padding:8px 10px;cursor:pointer;color:var(--danger-text);font-size:18px">🗑</button>
        <span class="rc-arrow" onclick="RECHNER.openRecipe(${r.rezept_id},'${esc(r.name)}')">›</span>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="status err" style="display:block">Fehler: ${esc(e.message)}</div>`;
  }
}

export async function openRecipe(rezeptId, name) {
  const statusEl = document.getElementById('fr-save-status');
  statusEl.className   = 'fr-save-status loading';
  statusEl.textContent = 'Rezept wird geladen…';
  statusEl.style.display = 'block';
  _showEditor();
  document.getElementById('fr-recipe-name').value = name;
  scaleFactor = 1;
  document.getElementById('fr-scale-input').value = 1;

  try {
    const rows    = await readSheet('Rezept_Zutaten', getCfg().stammdatenId);
    const zutaten = rows.slice(2)
      .filter(r => r && parseInt(r[0]) === rezeptId && r[2])
      .map(r => ({
        rezept_id:  parseInt(r[0]) || 0,
        zutaten_id: parseInt(r[1]) || 0,
        name:       String(r[2] || '').trim(),
        grams:      parseFloat(r[3]) || 0,
        cooked:     String(r[4] || '').toLowerCase() === 'ja',
      }));

    currentRecipe   = { rezept_id: rezeptId, hund_id: currentHundId, name, ingredients: zutaten };
    baseIngredients = zutaten.map(i => ({ ...i }));
    renderIngredients();
    recalc();
    statusEl.style.display = 'none';
  } catch (e) {
    statusEl.className   = 'fr-save-status err';
    statusEl.textContent = 'Fehler beim Laden: ' + e.message;
  }
}

export function newRecipe() {
  currentRecipe   = { rezept_id: null, hund_id: currentHundId, name: '', ingredients: [] };
  baseIngredients = [];
  scaleFactor     = 1;
  document.getElementById('fr-scale-input').value = 1;
  document.getElementById('fr-recipe-name').value = '';
  renderIngredients();
  recalc();
  _showEditor();
}

export function deleteRecipe(rezeptId, name) {
  alert(`Rezept "${name}" bitte direkt in Google Sheets löschen:\n` +
        `Tabelle "Rezepte" und "Rezept_Zutaten" in Hund_Stammdaten.`);
}

function _showEditor() {
  document.getElementById('fr-list').style.display = 'none';
  document.getElementById('fr-editor').classList.add('active');
}

// ════════════════════════════════════════════════════════════════
//  ZUTATEN VERWALTEN
// ════════════════════════════════════════════════════════════════

export function initIngredientSelect() {
  const katSel = document.getElementById('fr-filter-kat');
  const herSel = document.getElementById('fr-filter-her');

  if (katSel) {
    katSel.innerHTML = '<option value="">🏷 Alle Kategorien</option>';
    [...new Set(getZutaten().map(z => z.kategorie).filter(Boolean))].sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c; katSel.appendChild(opt);
    });
  }
  if (herSel) {
    herSel.innerHTML = '<option value="">🏭 Alle Hersteller</option>';
    [...new Set(getZutaten().map(z => z.hersteller).filter(Boolean))].sort().forEach(h => {
      const opt = document.createElement('option');
      opt.value = h; opt.textContent = h; herSel.appendChild(opt);
    });
  }
  filterIngredients();
}

export function filterIngredients() {
  const katFilter = document.getElementById('fr-filter-kat')?.value || '';
  const herFilter = document.getElementById('fr-filter-her')?.value || '';
  const sel       = document.getElementById('fr-ing-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Zutat wählen —</option>';

  const groups = {};
  getZutaten()
    .filter(z => z.aktiv !== 'nein')
    .filter(z => !katFilter || z.kategorie === katFilter)
    .filter(z => !herFilter || z.hersteller === herFilter)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .forEach(z => {
      const kat = z.kategorie || 'Sonstiges';
      (groups[kat] = groups[kat] || []).push(z);
    });

  let total = 0;
  Object.entries(groups).forEach(([kat, items]) => {
    const grp = document.createElement('optgroup');
    grp.label = `${kat} (${items.length})`;
    items.forEach(z => {
      const opt = document.createElement('option');
      opt.value       = z.zutaten_id;
      opt.textContent = z.name + (z.hersteller ? ' · ' + z.hersteller : '');
      grp.appendChild(opt);
      total++;
    });
    sel.appendChild(grp);
  });

  if (!total) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'Keine Zutaten für diese Filter';
    sel.appendChild(opt);
  }
}

export function addIngredient() {
  const sel     = document.getElementById('fr-ing-select');
  const zutatId = parseInt(sel.value);
  if (!zutatId) return;
  if (!currentRecipe) currentRecipe = { rezept_id: null, hund_id: currentHundId, name: '', ingredients: [] };

  const zutat = getZutaten().find(z => z.zutaten_id === zutatId);
  if (!zutat) return;

  if (currentRecipe.ingredients.find(i => i.zutaten_id === zutatId)) {
    alert(`${zutat.name} ist bereits im Rezept. Menge direkt in der Zeile ändern.`);
    return;
  }
  currentRecipe.ingredients.push({ zutaten_id: zutatId, name: zutat.name, grams: 100, cooked: false });
  baseIngredients = currentRecipe.ingredients.map(i => ({ ...i, grams: i.grams / scaleFactor }));
  renderIngredients();
  recalc();
  sel.value = '';
}

export function updateGrams(i, val) {
  if (!currentRecipe) return;
  currentRecipe.ingredients[i].grams = parseFloat(val) || 0;
  if (baseIngredients[i]) baseIngredients[i] = { ...currentRecipe.ingredients[i], grams: (parseFloat(val) || 0) / scaleFactor };
  recalc();
}

export function toggleCooked(i) {
  if (!currentRecipe) return;
  currentRecipe.ingredients[i].cooked = !currentRecipe.ingredients[i].cooked;
  if (baseIngredients[i]) baseIngredients[i].cooked = currentRecipe.ingredients[i].cooked;
  renderIngredients();
  recalc();
}

export function removeIngredient(i) {
  if (!currentRecipe) return;
  currentRecipe.ingredients.splice(i, 1);
  baseIngredients.splice(i, 1);
  renderIngredients();
  recalc();
}

function renderIngredients() {
  const list = document.getElementById('fr-ing-list');
  if (!currentRecipe?.ingredients?.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--sub);font-size:13px">Noch keine Zutaten – füge unten eine hinzu.</div>';
    return;
  }
  list.innerHTML = currentRecipe.ingredients.map((ing, i) => {
    const zutat = getZutaten().find(z => z.zutaten_id === ing.zutaten_id) || {};
    return `<div class="fr-ing-row">
      <div class="ing-name">
        ${esc(ing.name)}
        <small>${zutat.kategorie ? `<span class="kat-badge">${esc(zutat.kategorie)}</span>` : ''}</small>
      </div>
      <input type="number" value="${ing.grams}" min="0" step="0.1" inputmode="decimal"
        onchange="RECHNER.updateGrams(${i},this.value)">
      <div style="display:flex;align-items:center;justify-content:center;gap:4px">
        <button class="cooked-toggle${ing.cooked ? ' on' : ''}"
          onclick="RECHNER.toggleCooked(${i})" title="${ing.cooked ? 'Gekocht' : 'Roh'}"></button>
        <span style="font-size:10px;color:var(--sub)">${ing.cooked ? '🔥' : '🥩'}</span>
      </div>
      <button class="del-btn" onclick="RECHNER.removeIngredient(${i})">✕</button>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  NEUE ZUTAT MANUELL
// ════════════════════════════════════════════════════════════════

export function initCustomNutrGrid() {
  const grid = document.getElementById('fr-custom-nutr-grid');
  if (!grid) return;
  const mainNutr = ['Rohprotein','Fett','Calcium','Phosphor','Magnesium','Natrium',
    'Eisen','Kupfer','Zink','Selen','Jod','Vitamin A','Vitamin D','Vitamin E',
    'Linolsäure','α-Linolensäure','EPA + DHA'];
  grid.innerHTML = mainNutr.map(name => {
    const b    = getBedarfByName(name);
    const unit = b?.einheit || '?';
    const id   = 'cfn-' + name.replace(/[^a-zA-Z0-9]/g, '_');
    return `<div class="cf-field">
      <label>${esc(name)} [${unit}/100g]</label>
      <input type="number" id="${id}" placeholder="0" step="any" min="0">
    </div>`;
  }).join('');
}

export async function saveCustomIngredient() {
  const name       = document.getElementById('fr-custom-name')?.value.trim();
  const hersteller = document.getElementById('fr-custom-hersteller')?.value.trim() || '';
  const kategorie  = document.getElementById('fr-custom-kategorie')?.value || 'Sonstiges';
  if (!name) { alert('Bitte Name eingeben.'); return; }

  const zutaten = getZutaten();
  const newId   = Math.max(0, ...zutaten.map(z => z.zutaten_id)) + 1;
  const sid     = getCfg().stammdatenId;

  try {
    await appendRow('Zutaten', [newId, name, hersteller, kategorie, 'ja'], sid);

    const mainNutr = ['Rohprotein','Fett','Calcium','Phosphor','Magnesium','Natrium',
      'Eisen','Kupfer','Zink','Selen','Jod','Vitamin A','Vitamin D','Vitamin E',
      'Linolsäure','α-Linolensäure','EPA + DHA'];
    const bedarf = getBedarf();
    for (const nutrName of mainNutr) {
      const el  = document.getElementById('cfn-' + nutrName.replace(/[^a-zA-Z0-9]/g, '_'));
      const val = parseFloat(el?.value) || 0;
      const b   = bedarf.find(bd => bd.name === nutrName);
      if (b) await appendRow('Zutaten_Naehrstoffe', [newId, b.naehrstoff_id || '', nutrName, val], sid);
    }

    addZutat({ zutaten_id: newId, name, hersteller, kategorie, aktiv: 'ja' });
    initIngredientSelect();

    document.getElementById('fr-custom-name').value = '';
    document.getElementById('fr-custom-hersteller').value = '';
    document.getElementById('fr-custom-form').classList.remove('open');
    alert(`✓ Zutat "${name}" gespeichert!`);

    if (currentRecipe) {
      currentRecipe.ingredients.push({ zutaten_id: newId, name, grams: 100, cooked: false });
      baseIngredients = currentRecipe.ingredients.map(i => ({ ...i, grams: i.grams / scaleFactor }));
      renderIngredients();
      recalc();
    }
  } catch (e) { alert('Fehler beim Speichern: ' + e.message); }
}

// ════════════════════════════════════════════════════════════════
//  REZEPT SPEICHERN
// ════════════════════════════════════════════════════════════════

export async function saveRecipe() {
  const name = document.getElementById('fr-recipe-name')?.value.trim();
  if (!name)                                { alert('Bitte Rezeptname eingeben.'); return; }
  if (!currentRecipe?.ingredients?.length)  { alert('Keine Zutaten vorhanden.'); return; }

  const btn      = document.getElementById('fr-save-btn');
  const statusEl = document.getElementById('fr-save-status');
  btn.disabled         = true;
  statusEl.className   = 'fr-save-status loading';
  statusEl.textContent = 'Wird gespeichert…';
  statusEl.style.display = 'block';

  const sid  = getCfg().stammdatenId;
  const kg   = parseFloat(document.getElementById('fr-dog-weight2')?.value) || 27;
  const heute = new Date().toLocaleDateString('de');

  try {
    let rezeptId = currentRecipe.rezept_id;
    if (!rezeptId) {
      const rows = await readSheet('Rezepte', sid);
      const ids  = rows.slice(2).map(r => parseInt(r[0]) || 0);
      rezeptId   = Math.max(0, ...ids) + 1;
      currentRecipe.rezept_id = rezeptId;
      await appendRow('Rezepte', [rezeptId, currentHundId, name, heute, ''], sid);
    }

    for (const ing of currentRecipe.ingredients) {
      const totalG = currentRecipe.ingredients.reduce((s, i) => s + i.grams, 0);
      const pct    = totalG > 0 ? (ing.grams / totalG * 100).toFixed(1) + '%' : '';
      await appendRow('Rezept_Zutaten',
        [rezeptId, ing.zutaten_id, ing.name, ing.grams, ing.cooked ? 'Ja' : 'Nein', pct, kg + 'kg'], sid);
    }

    currentRecipe.name   = name;
    statusEl.className   = 'fr-save-status ok';
    statusEl.textContent = `✓ Rezept "${name}" gespeichert!`;
    setTimeout(() => { statusEl.style.display = 'none'; }, 4_000);
  } catch (e) {
    statusEl.className   = 'fr-save-status err';
    statusEl.textContent = 'Fehler: ' + e.message;
  }
  btn.disabled = false;
}

// ════════════════════════════════════════════════════════════════
//  NÄHRSTOFFBERECHNUNG
// ════════════════════════════════════════════════════════════════

export function recalc() {
  if (!currentRecipe) return;
  const kg     = parseFloat(document.getElementById('fr-dog-weight2')?.value) || 27;
  const mkg    = calcMkg(kg);
  const params = getParameter();
  const cookFactor = 1 - (params['kochverlust_b_vitamine'] || 0.30);

  // Nährstoffsummen
  const totals    = {};
  let totalGrams  = 0;

  currentRecipe.ingredients.forEach(ing => {
    totalGrams += ing.grams;
    const nutrMap = getNutrMap(ing.zutaten_id, ing.name);
    Object.entries(nutrMap).forEach(([nutrName, val100g]) => {
      let val = val100g * ing.grams / 100;
      if (ing.cooked && COOKING_LOSS_NUTR.has(nutrName)) val *= cookFactor;
      totals[nutrName] = (totals[nutrName] || 0) + val;
    });
  });

  // Kalorien
  const kcalIst    = (totals['Rohprotein'] || 0) * (params['kcal_faktor_protein'] || 3.5)
                   + (totals['Fett'] || 0)        * (params['kcal_faktor_fett']    || 8.5);
  const kp         = getKalorienParam(currentHundId);
  const kcalBedarf = (kp.kcalManual > 0) ? kp.kcalManual
                   : kp.rerFaktor70 * Math.pow(kg, kp.rerExponent) * kp.rerFaktor;

  // Portionsinfo
  const portionen = params['portionen_pro_tag'] || 2;
  _setText('fr-total-g',    Math.round(totalGrams));
  _setText('fr-portion-g',  Math.round(totalGrams / portionen));
  _setText('fr-kcal-ist',   Math.round(kcalIst));
  _setText('fr-kcal-bedarf',Math.round(kcalBedarf));

  // Kalorien-Balken
  const kcalPct  = kcalBedarf > 0 ? kcalIst / kcalBedarf * 100 : 0;
  const kcalWrap = document.getElementById('fr-kcal-bar-wrap');
  const kcalBar  = document.getElementById('fr-kcal-bar');
  if (kcalWrap) kcalWrap.style.display = totalGrams > 0 ? 'block' : 'none';
  if (kcalBar) {
    kcalBar.style.width      = Math.min(kcalPct, 100) + '%';
    kcalBar.style.background = kcalPct >= 90 && kcalPct <= 120 ? 'var(--bar-ok)'
                             : kcalPct > 120 ? 'var(--bar-high)' : 'var(--bar-low)';
  }

  // Ca:P
  const ca       = totals['Calcium'] || 0;
  const p        = totals['Phosphor'] || 0;
  const capRatio = p > 0 ? ca / p : 0;
  const capMin   = params['cap_verhaeltnis_min'] || 1.2;
  const capMax   = params['cap_verhaeltnis_max'] || 1.5;
  const capCard  = document.getElementById('fr-ratio-cap');
  _setText('fr-cap-val',    p > 0 ? capRatio.toFixed(2) + ' : 1' : '–');
  _setText('fr-cap-target', `Ziel: ${capMin} – ${capMax} : 1`);
  if (capCard) capCard.className = 'fr-ratio-card ' + (p > 0 && capRatio >= capMin && capRatio <= capMax ? 'ok' : 'warn');

  // Omega 6:3
  const om6      = totals['Linolsäure'] || 0;
  const om3      = (totals['α-Linolensäure'] || 0) + (totals['EPA + DHA'] || 0);
  const omRatio  = om3 > 0 ? om6 / om3 : 0;
  const omMax    = params['omega6_3_ziel_max'] || 6;
  const omCard   = document.getElementById('fr-ratio-omega');
  _setText('fr-omega-val',    om3 > 0 ? omRatio.toFixed(1) + ' : 1' : '–');
  _setText('fr-omega-target', `Ziel: max. ${omMax} : 1`);
  if (omCard) omCard.className = 'fr-ratio-card ' + (om3 > 0 && omRatio <= omMax ? 'ok' : 'warn');

  renderNutrTable(totals, mkg);
}

function renderNutrTable(totals, mkg) {
  const rowsEl = document.getElementById('fr-nutr-rows');
  const bedarf = getBedarf();
  if (!bedarf?.length) {
    rowsEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--sub);font-size:13px">⚠️ Bedarfsdaten nicht geladen.</div>';
    return;
  }

  const groups = {};
  bedarf.forEach(b => { (groups[b.gruppe || 'Sonstiges'] = groups[b.gruppe || 'Sonstiges'] || []).push(b); });

  let html = '';
  Object.entries(groups).forEach(([gruppe, items]) => {
    html += `<div class="fr-nutr-group">${esc(gruppe)}</div>`;
    items.forEach(b => {
      const ist          = totals[b.name] || 0;
      const tagesBedarf  = b.bedarf_pro_mkg * mkg;
      const tol          = getTolerance(currentHundId, b.name);

      let pct = 0, barColor = 'var(--bar-zero)', pctStr = '?', cls = 'zero';
      if (tagesBedarf > 0) {
        pct    = ist / tagesBedarf * 100;
        pctStr = pct.toFixed(0) + '%';
        if (pct >= tol.min && pct <= tol.max) { cls = 'ok';   barColor = 'var(--bar-ok)'; }
        else if (pct < tol.min)               { cls = 'low';  barColor = 'var(--bar-low)'; }
        else                                  { cls = 'over'; barColor = 'var(--bar-high)'; }
      } else if (tagesBedarf === 0) {
        cls = 'ok'; pctStr = 'n/a';
      }

      const fmt = v => {
        if (v === 0)   return '0';
        if (v < 0.01)  return v.toExponential(1);
        if (v < 1)     return v.toFixed(3);
        if (v < 100)   return v.toFixed(1);
        return Math.round(v).toLocaleString('de');
      };

      const istStr    = fmt(ist) + ' ' + b.einheit;
      const bedarfStr = tagesBedarf > 0 ? fmt(tagesBedarf) + ' ' + b.einheit : '–';
      const barW      = tagesBedarf > 0 ? Math.min(pct / tol.max * 100, 100) : 0;
      const diffStr   = tagesBedarf > 0 ? (ist > tagesBedarf ? '+' : '') + fmt(ist - tagesBedarf) + ' ' + b.einheit : '';
      const tooltip   = `${pctStr} (${diffStr}) · Toleranz: ${tol.min}–${tol.max}%`;

      html += `<div class="fr-nutr-row ${cls}" onclick="UI.showNutrPopup('${esc(b.name)}')" title="${esc(tooltip)}">
        <span class="nr-name">${esc(b.name)}</span>
        <span class="nr-val">${esc(istStr)}</span>
        <span class="nr-bedarf">${esc(bedarfStr)}</span>
        <div class="nr-bar-wrap">
          <div class="nr-bar" style="width:${barW}%;background:${barColor}"></div>
          <span class="nr-pct">${esc(pctStr)}</span>
        </div>
      </div>`;
    });
  });

  rowsEl.innerHTML = html || '<div style="padding:14px;text-align:center;color:var(--sub);font-size:13px">Keine Bedarfsdaten.</div>';
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
