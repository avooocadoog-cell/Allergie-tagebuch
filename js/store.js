/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: store.js                                            ║
 * ║  Hund Manager – In-Memory Stammdaten Cache                   ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Alle Stammdaten aus Hund_Stammdaten beim Start laden      ║
 * ║  - In-Memory Cache für alle anderen Module bereitstellen     ║
 * ║  - parseRows: string[][] → Object[] konvertieren             ║
 * ║  - Nährstoff-Lookups (per ID oder Name)                      ║
 * ║  - Toleranzberechnung (individuell oder Standard-Fallback)   ║
 * ║  - Cache nach Writes lokal aktualisieren (kein Re-Load nötig)║
 * ║                                                              ║
 * ║  Sheet-Struktur: Header in Zeile 1+2, Daten ab Zeile 3       ║
 * ║                                                              ║
 * ║  Abhängigkeiten: sheets.js, config.js                        ║
 * ║  Wird importiert von: ui.js, rechner.js, tagebuch.js,        ║
 * ║    ansicht.js, stammdaten.js, main.js                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { readSheet }  from './sheets.js';
import { get as getCfg } from './config.js';


// ── Hilfsfunktion: robuste Zahl-Konvertierung (unterstützt dt. Dezimalkomma) ──
const _float = v => {
  const s = String(v ?? '').trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// ── Cache-Objekte ────────────────────────────────────────────────
let hunde          = [];  // [{hund_id, name, rasse, geburtsdatum, geschlecht, kastriert, aktiv, notizen}]
let parameter      = {};  // {key: value}  (Key-Value Map)
let naehrstoffe    = [];  // [{naehrstoff_id, name, einheit, gruppe, beschreibung, ...}]
let toleranzen     = [];  // [{hund_id, naehrstoff_id, naehrstoff_name, min_pct, max_pct, anmerkung}]
let bedarf         = [];  // [{naehrstoff_id, name, einheit, bedarf_pro_mkg, quelle, gruppe}]
let zutaten        = [];  // [{zutaten_id, name, hersteller, kategorie, aktiv}]
let zutatNutr      = [];  // [{zutaten_id, naehrstoff_id, naehrstoff_name, wert_pro_100g}]
let rezepte        = [];  // [{rezept_id, hund_id, name, erstellt, notizen}]
let rezeptZutaten  = [];  // [{rezept_id, zutaten_id, zutat_name, gramm, gekocht}]
let kalorienbedarf = [];  // [{hund_id, faktor_typ, wert, beschreibung}]
let rezeptKomp     = [];  // [{id, rezept_id, komponenten_typ, ref_id, gramm, notizen}]

// ════════════════════════════════════════════════════════════════
//  LADEN
// ════════════════════════════════════════════════════════════════

/**
 * Alle Stammdaten aus Hund_Stammdaten Spreadsheet laden.
 * Wird einmalig nach dem Login aufgerufen.
 * Alle 10 Blätter werden parallel geladen.
 */
export async function loadAll() {
  const sid = getCfg().stammdatenId;

  const [
    rHunde, rParam, rNaehr, rTol, rBedarf,
    rZutaten, rZutatNutr, rRezepte, rRezZut, rKal,
  ] = await Promise.all([
    readSheet('Hunde',               sid),
    readSheet('Parameter',           sid),
    readSheet('Naehrstoffe',         sid),
    readSheet('Toleranzen',          sid),
    readSheet('Bedarf',              sid),
    readSheet('Zutaten',             sid),
    readSheet('Zutaten_Naehrstoffe', sid),
    readSheet('Rezepte',             sid),
    readSheet('Rezept_Zutaten',      sid),
    readSheet('Hund_Kalorienbedarf', sid),
  ]);

  // Rezept_Komponenten laden (optional – Sheet existiert erst nach Migration)
  let rKomp = [];
  try {
    rKomp = await readSheet('Rezept_Komponenten', sid);
  } catch (e) {
    console.info('STORE: Rezept_Komponenten noch nicht vorhanden (vor Migration).');
  }

  // ── Hunde (Header Zeile 2, Daten ab Zeile 3) ──────────────────
  hunde = parseRows(rHunde,
    ['hund_id','name','rasse','geburtsdatum','geschlecht','kastriert','aktiv','notizen'], 2)
    .map(r => ({ ...r, hund_id: parseInt(r.hund_id) || 0 }))
    .filter(r => r.name);

  // ── Parameter als Key-Value Map ────────────────────────────────
  parameter = {};
  parseRows(rParam, ['parameter','wert','einheit','beschreibung'], 2)
    .filter(r => r.parameter)
    .forEach(r => { parameter[r.parameter] = parseFloat(r.wert) || r.wert; });

  // ── Nährstoffe ────────────────────────────────────────────────
  naehrstoffe = parseRows(rNaehr,
    ['naehrstoff_id','name','einheit','gruppe',
     'beschreibung','funktion','mangel_symptome','quellen','obergrenze_info',
     // v2-Spalten J–N (leer wenn Sheet noch nicht migriert):
     'nrc_min_per_mkg','aafco_min_pct_dm','fediaf_min','upper_safe_limit','quelle_ref'], 2)
    .map(r => ({ ...r, naehrstoff_id: parseInt(r.naehrstoff_id) || 0 }))
    .filter(r => r.name);

  // ── Toleranzen ────────────────────────────────────────────────
  toleranzen = parseRows(rTol,
    ['hund_id','naehrstoff_id','naehrstoff_name','min_pct','max_pct','anmerkung','recommended_pct'], 2)
    .map(r => ({
      hund_id:         parseInt(r.hund_id)         || 0,
      naehrstoff_id:   parseInt(r.naehrstoff_id)   || 0,
      naehrstoff_name: r.naehrstoff_name,
      min_pct:         _float(r.min_pct),
      max_pct:         _float(r.max_pct) || 999,
      anmerkung:       r.anmerkung || '',
      recommended_pct: r.recommended_pct || '',
    }))
    .filter(r => r.hund_id && r.naehrstoff_id);

  // ── Bedarf (Gruppe per Join aus Naehrstoffe ergänzen) ─────────
  bedarf = parseRows(rBedarf,
    ['naehrstoff_id','naehrstoff_name','einheit','bedarf_pro_mkg','quelle'], 2)
    .map(r => {
      const nutrInfo = naehrstoffe.find(n => n.naehrstoff_id === (parseInt(r.naehrstoff_id) || 0));
      return {
        naehrstoff_id:  parseInt(r.naehrstoff_id) || 0,
        name:           r.naehrstoff_name,
        einheit:        r.einheit,
        bedarf_pro_mkg: _float(r.bedarf_pro_mkg),
        quelle:         r.quelle,
        gruppe:         nutrInfo?.gruppe || 'Sonstiges',
      };
    })
    .filter(r => r.name);

  // ── Zutaten ───────────────────────────────────────────────────
  zutaten = parseRows(rZutaten,
    ['zutaten_id','name','hersteller','kategorie','aktiv'], 2)
    .map(r => ({ ...r, zutaten_id: parseInt(r.zutaten_id) || 0 }))
    .filter(r => r.name);

  // ── Zutaten × Nährstoffe ──────────────────────────────────────
  zutatNutr = parseRows(rZutatNutr,
    ['zutaten_id','naehrstoff_id','naehrstoff_name','wert_pro_100g'], 2)
    .map(r => ({
      zutaten_id:      parseInt(r.zutaten_id)      || 0,
      naehrstoff_id:   parseInt(r.naehrstoff_id)   || 0,
      naehrstoff_name: r.naehrstoff_name,
      wert_pro_100g:   _float(r.wert_pro_100g),
    }))
    .filter(r => r.zutaten_id && r.naehrstoff_id);

  // ── Rezepte ───────────────────────────────────────────────────
  rezepte = parseRows(rRezepte,
    ['rezept_id','hund_id','name','erstellt','notizen'], 2)
    .map(r => ({
      ...r,
      rezept_id: parseInt(r.rezept_id) || 0,
      hund_id:   parseInt(r.hund_id)   || 0,
    }))
    .filter(r => r.name);

  // ── Rezept-Zutaten ────────────────────────────────────────────
  rezeptZutaten = parseRows(rRezZut,
    ['rezept_id','zutaten_id','zutat_name','gramm','gekocht'], 2)
    .map(r => ({
      rezept_id:  parseInt(r.rezept_id)  || 0,
      zutaten_id: parseInt(r.zutaten_id) || 0,
      zutat_name: r.zutat_name,
      gramm:      _float(r.gramm),
      gekocht:    r.gekocht?.toLowerCase() === 'ja',
    }))
    .filter(r => r.rezept_id && r.zutat_name);

  // ── Kalorienbedarf ────────────────────────────────────────────
  kalorienbedarf = parseRows(rKal,
    ['hund_id','faktor_typ','wert','beschreibung'], 2)
    .map(r => ({ ...r, hund_id: parseInt(r.hund_id) || 0, wert: parseFloat(r.wert) || 0 }))
    .filter(r => r.hund_id && r.faktor_typ);

  // ── Rezept-Komponenten (für Rezept-Mixing) ────────────────────
  rezeptKomp = parseRows(rKomp,
    ['id','rezept_id','komponenten_typ','ref_id','gramm','notizen'], 2)
    .map(r => ({
      id:              parseInt(r.id)        || 0,
      rezept_id:       parseInt(r.rezept_id) || 0,
      komponenten_typ: r.komponenten_typ,    // 'zutat' | 'rezept'
      ref_id:          parseInt(r.ref_id)    || 0,
      gramm:           _float(r.gramm),
      notizen:         r.notizen || '',
    }))
    .filter(r => r.rezept_id && r.komponenten_typ && r.gramm > 0);

  console.log(
    `STORE geladen: ${hunde.length} Hunde · ${zutaten.length} Zutaten · ` +
    `${naehrstoffe.length} Nährstoffe · ${rezepte.length} Rezepte`
  );
}

// ════════════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

/**
 * Sheets-Rohdaten (string[][]) in Object-Array umwandeln.
 * Überspringt die ersten `skipRows` Zeilen (Header).
 * Leere Zeilen werden gefiltert.
 *
 * @param {string[][]} rawRows
 * @param {string[]}   cols      - Spaltennamen in Reihenfolge
 * @param {number}     skipRows  - Anzahl Header-Zeilen (meist 2)
 * @returns {Object[]}
 */
function parseRows(rawRows, cols, skipRows) {
  return rawRows
    .slice(skipRows)
    .filter(row => row?.some(v => v !== null && v !== undefined && String(v).trim() !== ''))
    .map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        obj[col] = (row[i] != null) ? String(row[i]).trim() : '';
      });
      return obj;
    });
}

/**
 * Nährstoff-Map für eine Zutat.
 * Primär-Suche per zutaten_id, Fallback per Zutat-Name.
 * Gibt { [naehrstoff_name]: wert_pro_100g } zurück.
 *
 * @param {number} zutatId   - zutaten_id
 * @param {string} zutatName - Fallback-Suche per Name
 * @returns {Object}
 */
/**
 * Gibt { naehrstoff_id: wert_pro_100g } zurück – ID-basiert, 100% zuverlässig.
 * Primär-Lookup für recalc(), unabhängig von Namenskonventionen.
 */
export function getNutrMapById(zutatId, zutatName) {
  let entries = zutatNutr.filter(r => r.zutaten_id === zutatId);
  if (!entries.length && zutatName) {
    const z = zutaten.find(z => z.name === zutatName);
    if (z?.zutaten_id) entries = zutatNutr.filter(r => r.zutaten_id === z.zutaten_id);
  }
  const map = {};
  entries.forEach(r => {
    if (r.naehrstoff_id) map[r.naehrstoff_id] = r.wert_pro_100g;
  });
  return map;
}

export function getNutrMap(zutatId, zutatName) {
  let entries = zutatNutr.filter(r => r.zutaten_id === zutatId);

  // Fallback: kein Treffer per ID → per Name suchen
  if (!entries.length && zutatName) {
    const z = zutaten.find(z => z.name === zutatName);
    if (z?.zutaten_id) {
      entries = zutatNutr.filter(r => r.zutaten_id === z.zutaten_id);
    }
  }

  const map = {};
  entries.forEach(r => {
    const orig = r.naehrstoff_name;
    const wert = r.wert_pro_100g;
    // Original-Name eintragen
    map[orig] = wert;
    // Kurzname ohne Klammer: "Vitamin B1 (Thiamin)" → "Vitamin B1"
    const short = orig.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (short && short !== orig) map[short] = wert;
    // Langname-Varianten: falls kurz gespeichert, Aliases für bekannte Langformen
    const ALIASES = {
      'Vitamin B1': 'Vitamin B1 (Thiamin)',
      'Vitamin B2': 'Vitamin B2 (Riboflavin)',
      'Vitamin B3': 'Vitamin B3 (Niacin)',
      'Vitamin B5': 'Vitamin B5 (Pantothensäure)',
      'Vitamin B6': 'Vitamin B6 (Pyridoxin)',
      'Vitamin B9': 'Vitamin B9 (Folsäure)',
      'Vitamin B12': 'Vitamin B12 (Cobalamin)',
      'Vitamin E':  'Vitamin E (a-Tocopherol)',
      'Vitamin C':  'Vitamin C (Ascorbinsäure)',
    };
    if (ALIASES[orig]) map[ALIASES[orig]] = wert;
    if (ALIASES[short]) map[ALIASES[short]] = wert;
  });
  return map;
}

/**
 * Toleranzbereich für einen Hund × Nährstoff.
 * Fällt auf globale Standard-Parameter zurück wenn keine individuelle Toleranz hinterlegt.
 * Gibt zusätzlich recommended_pct zurück wenn vorhanden (Spec 12).
 *
 * @param {number} hundId   - hund_id
 * @param {string} nutrName - Nährstoff-Name
 * @returns {{ min: number, max: number, recommended: number|null }}
 */
export function getTolerance(hundId, nutrName) {
  const found = toleranzen.find(t => t.hund_id === hundId && t.naehrstoff_name === nutrName);
  if (found) return {
    min:         found.min_pct,
    max:         found.max_pct,
    recommended: found.recommended_pct ? parseFloat(found.recommended_pct) : null,
  };
  return {
    min:         parameter['toleranz_default_min_pct'] || 80,
    max:         parameter['toleranz_default_max_pct'] || 150,
    recommended: null,
  };
}

/**
 * Kalorienbedarfs-Parameter für einen Hund.
 * Gibt strukturiertes Objekt mit Fallback-Werten zurück.
 *
 * @param {number} hundId
 * @returns {{ rerFaktor: number, kcalManual: number, rerExponent: number, rerFaktor70: number }}
 */
export function getKalorienParam(hundId) {
  const params = kalorienbedarf.filter(k => k.hund_id === hundId);
  const toObj  = {};
  params.forEach(p => { toObj[p.faktor_typ] = p.wert; });
  return {
    rerFaktor:   toObj['RER_faktor']    || 1.6,
    kcalManual:  toObj['kcal_manuell']  || 0,
    rerExponent: toObj['rer_exponent']  || 0.75,
    rerFaktor70: toObj['rer_faktor_70'] || 70,
  };
}

// ════════════════════════════════════════════════════════════════
//  GETTER
// ════════════════════════════════════════════════════════════════

export function getHunde()       { return hunde; }
export function getParameter()   { return parameter; }
export function getNaehrstoffe() { return naehrstoffe; }
export function getBedarf()      { return bedarf; }
export function getZutaten()     { return zutaten; }
export function getToleranz()    { return toleranzen; }

/**
 * Rezepte abrufen, optional nach hund_id filtern.
 * @param {number} [hundId]
 */
export function getRezepte(hundId) {
  return hundId ? rezepte.filter(r => r.hund_id === hundId) : rezepte;
}

/**
 * Zutaten eines Rezepts aus dem Cache.
 * @param {number} rezeptId
 */
export function getRezeptZutaten(rezeptId) {
  return rezeptZutaten.filter(r => r.rezept_id === rezeptId);
}

/**
 * Setzt (ersetzt) die gecachten Rezept-Zutaten für ein bestimmtes Rezept.
 * Wird nach saveRecipe aufgerufen damit resolveRezept() sofort aktuelle Daten nutzt.
 * @param {number} rezeptId
 * @param {{ rezept_id, zutaten_id, zutat_name, gramm, gekocht }[]} rows
 */
export function setRezeptZutaten(rezeptId, rows) {
  // Alte Einträge für dieses Rezept entfernen
  rezeptZutaten = rezeptZutaten.filter(r => r.rezept_id !== rezeptId);
  // Neue Einträge hinzufügen
  rezeptZutaten.push(...rows);
}

/**
 * Rezept-Komponenten für Rezept-Mixing.
 * Gibt alle Komponenten eines Rezepts zurück.
 * @param {number} rezeptId
 * @returns {Array<{id, rezept_id, komponenten_typ, ref_id, gramm, notizen}>}
 */
export function getRezeptKomponenten(rezeptId) {
  return rezeptKomp.filter(k => k.rezept_id === rezeptId);
}

/**
 * Prüft ob Rezept_Komponenten geladen sind (Sheet existiert bereits).
 * @returns {boolean}
 */
export function hasRezeptKomponenten() {
  return rezeptKomp.length > 0;
}

/**
 * Nährstoff-Info-Objekt per Name (für Info-Popup).
 * @param {string} name
 * @returns {Object|null}
 */
export function getNaehrstoffInfo(name) {
  return naehrstoffe.find(n => n.name === name) || null;
}

/**
 * Bedarf-Objekt per Nährstoff-Name.
 * @param {string} name
 * @returns {Object|null}
 */
export function getBedarfByName(name) {
  return bedarf.find(b => b.name === name) || null;
}

// ════════════════════════════════════════════════════════════════
//  CACHE-UPDATES (nach Writes, kein Re-Load nötig)
// ════════════════════════════════════════════════════════════════

/** Neuen Hund dem Cache hinzufügen. */
export function addHund(h)  { hunde.push(h); }

/** Hund-Felder im Cache aktualisieren (nach writeRange). */
export function updateHund(id, fields) {
  const h = hunde.find(x => x.hund_id === id);
  if (h) Object.assign(h, fields);
}

/** Neue Zutat dem Cache hinzufügen. */
export function addZutat(z) { zutaten.push(z); }

/** Nährstoff-Einträge einer neuen Zutat dem Cache hinzufügen. */
export function addZutatNutr(entries) { zutatNutr.push(...entries); }

/** Neue Rezept-Komponente dem Cache hinzufügen. */
export function addRezeptKomp(k) { rezeptKomp.push(k); }
