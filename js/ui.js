/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: ui.js                                               ║
 * ║  Hund Manager – UI Hilfsfunktionen                           ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Top-Panel / Tab Wechsel                                   ║
 * ║  - Eingabe- / Ansicht-Modus Toggle                           ║
 * ║  - Loader anzeigen / verstecken                              ║
 * ║  - Status-Meldungen (.status Elemente)                       ║
 * ║  - Datum-Hilfsfunktionen (today, formatDate)                 ║
 * ║  - Modal öffnen / schließen                                  ║
 * ║  - Nährstoff-Info Popup                                      ║
 * ║  - Hunde-Dropdowns synchronisieren                           ║
 * ║  - HTML-Escape Utility                                       ║
 * ║                                                              ║
 * ║  Abhängigkeiten: keine                                       ║
 * ║  Wird importiert von: fast allen Modulen                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════════════════════════════════
//  PANEL / TAB NAVIGATION
// ════════════════════════════════════════════════════════════════

/**
 * Top-Level Panel wechseln (Rechner / Tagebuch / Stammdaten / Einstellungen).
 * @param {'rechner'|'tagebuch'|'stammdaten'|'einst'} panel
 */
export function switchTopPanel(panel) {
  ['rechner', 'tagebuch', 'stammdaten', 'einst', 'statistik'].forEach(p => {
    document.getElementById('panel-' + p)?.classList.toggle('active', p === panel);
    document.getElementById('tnav-' + p)?.classList.toggle('active', p === panel);
  });
  // Stammdaten-Tab beim Öffnen aktualisieren
  if (panel === 'statistik') {
    import('./statistik.js').then(m => m.load());
  }
  if (panel === 'stammdaten') {
    import('./stammdaten.js').then(m => m.loadCurrentTab());
  }
}

/**
 * Eingabe-Tabs im Tagebuch-Panel wechseln.
 * @param {'umwelt'|'symptom'|'futter'|'ausschluss'|'allergen'|'tierarzt'|'medikamente'} tab
 */
export function switchTab(tab) {
  const tabs = ['umwelt','symptom','futter','ausschluss','allergen','tierarzt','medikamente'];
  const btns = document.querySelectorAll('#eingabe-tabs .tab');

  tabs.forEach((t, i) => {
    btns[i]?.classList.toggle('active', t === tab);
    const el = document.getElementById('tab-' + t);
    if (el) {
      el.classList.toggle('active', t === tab);
      el.style.display = t === tab ? 'block' : 'none';
    }
  });

  // Rezepte laden wenn Futter-Tab geöffnet wird
  if (tab === 'futter') {
    const sel = document.getElementById('f-rezept-select');
    if (sel && sel.options.length <= 1) {
      import('./tagebuch.js').then(m => m.loadRezepteDropdown());
    }
  }
}

/**
 * Ansicht-Tabs (Ansicht-Modus) wechseln.
 * @param {string} tab - z.B. 'v-umwelt'
 */
export function switchViewTab(tab) {
  const tabs = ['v-umwelt','v-symptom','v-futter','v-ausschluss','v-allergen','v-tierarzt','v-medikamente'];
  const btns = document.querySelectorAll('#mode-ansicht-panel .tab');

  tabs.forEach((t, i) => {
    btns[i]?.classList.toggle('active', t === tab);
    const el = document.getElementById(t);
    if (el) {
      el.classList.toggle('active', t === tab);
      el.style.display = t === tab ? 'block' : 'none';
    }
  });
}

/**
 * Stammdaten-Tabs wechseln.
 * @param {'hunde'|'zutaten'|'parameter'} tab
 */
export function switchStammdatenTab(tab) {
  ['hunde', 'zutaten', 'toleranzen', 'parameter'].forEach(t => {
    const el = document.getElementById('sd-' + t);
    if (el) {
      el.classList.toggle('active', t === tab);
      el.style.display = t === tab ? 'block' : 'none';
    }
  });
  const btns = document.querySelectorAll('#panel-stammdaten .tab');
  ['hunde', 'zutaten', 'toleranzen', 'parameter'].forEach((t, i) => btns[i]?.classList.toggle('active', t === tab));
  import('./stammdaten.js').then(m => m.loadTab(tab));
}

/**
 * Eingabe ↔ Ansicht Modus umschalten.
 * @param {'eingabe'|'ansicht'} mode
 */
export function switchMode(mode) {
  document.getElementById('mode-eingabe')?.classList.toggle('active', mode === 'eingabe');
  document.getElementById('mode-ansicht')?.classList.toggle('active', mode === 'ansicht');
  document.getElementById('mode-eingabe-panel').style.display = mode === 'eingabe' ? 'block' : 'none';
  document.getElementById('mode-ansicht-panel').style.display = mode === 'ansicht'  ? 'block' : 'none';
}

/**
 * Akkordeon-Section im Futterrechner ein-/ausklappen.
 * @param {string} id  - Section-ID-Suffix, z.B. 'zutaten' → 'fr-sec-zutaten'
 * @param {Element} el - Das Toggle-Element
 */
export function toggleSection(id, el) {
  el.classList.toggle('open');
  document.getElementById('fr-sec-' + id)?.classList.toggle('open');
}

/** Manuelle Zutaten-Eingabe-Formular im Futterrechner ein-/ausblenden. */
export function toggleCustomForm() {
  document.getElementById('fr-custom-form')?.classList.toggle('open');
}

/**
 * Setup-Panel direkt vom Login-Screen aus öffnen
 * (Navigation verstecken da nicht eingeloggt).
 */
export function showSetupFromLogin() {
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('main-screen').style.display   = 'block';
  document.getElementById('top-nav').style.display       = 'none';
  switchTopPanel('einst');
}

// ════════════════════════════════════════════════════════════════
//  LOADER
// ════════════════════════════════════════════════════════════════

/** Vollbild-Loader anzeigen. */
export function showLoader(msg) {
  document.getElementById('app-loader').style.display = 'flex';
  if (msg) document.getElementById('loader-msg').textContent = msg;
}

/** Vollbild-Loader verstecken. */
export function hideLoader() {
  document.getElementById('app-loader').style.display = 'none';
}

/** Loader-Nachricht aktualisieren ohne Sichtbarkeit zu ändern. */
export function setLoaderMsg(msg) {
  document.getElementById('loader-msg').textContent = msg;
}

// ════════════════════════════════════════════════════════════════
//  STATUS-MELDUNGEN
// ════════════════════════════════════════════════════════════════

/**
 * Status-Element (CSS-Klasse `.status`) befüllen und anzeigen.
 *
 * @param {string} id   - Element-ID, z.B. 'status-u'
 * @param {'ok'|'err'|'loading'} type
 * @param {string} msg  - Anzeigetext
 */
export function setStatus(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className    = 'status ' + type;
  el.textContent  = msg;
}

// ════════════════════════════════════════════════════════════════
//  DATUM-HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════════════

/**
 * Datum-Eingabefeld auf heute setzen.
 * @param {string} id - Element-ID des input[type=date]
 */
export function setToday(id) {
  const d  = new Date();
  const el = document.getElementById(id);
  if (!el) return;
  el.value = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * ISO-Datum (YYYY-MM-DD) in deutsches Format (DD.MM.YYYY) umwandeln.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ════════════════════════════════════════════════════════════════
//  SICHERHEIT
// ════════════════════════════════════════════════════════════════

/**
 * HTML-Sonderzeichen escapen (XSS-Schutz für innerHTML).
 * @param {*} s - Beliebiger Wert
 * @returns {string}
 */
export function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════════════

/**
 * Generisches Modal öffnen.
 * @param {string} title    - Titeltext
 * @param {string} bodyHtml - HTML-Inhalt
 */
export function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}

/**
 * Modal schließen.
 * Bei Klick auf Overlay nur schließen wenn Klick auf das Overlay selbst.
 * @param {Event} [event]
 */
export function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
//  NÄHRSTOFF-INFO POPUP
// ════════════════════════════════════════════════════════════════

/**
 * Nährstoff-Info Popup mit Details aus dem STORE anzeigen.
 * Zeigt NRC-Bedarf, AAFCO/FEDIAF Richtwerte und obere Grenzen wenn vorhanden.
 * @param {string} nutrName - Nährstoff-Name
 */
export function showNutrPopup(nutrName) {
  import('./store.js').then(({ getNaehrstoffInfo, getBedarfByName }) => {
    const info       = getNaehrstoffInfo(nutrName);
    const bedarfInfo = getBedarfByName(nutrName);
    if (!info && !bedarfInfo) return;

    document.getElementById('nutr-popup-name').textContent = info?.name || nutrName;
    document.getElementById('nutr-popup-meta').textContent =
      `${info?.einheit || ''} · ${info?.gruppe || ''} · ` +
      `NRC-Bedarf: ${bedarfInfo?.bedarf_pro_mkg || '–'} ${info?.einheit || ''}/kg^0,75`;

    let html = '';

    // ── Quellenvergleich (NRC / AAFCO / FEDIAF) ─────────────────
    const hasNrc   = bedarfInfo?.bedarf_pro_mkg > 0;
    const hasAafco = info?.aafco_min_pct_dm && String(info.aafco_min_pct_dm).trim() !== '';
    const hasFediaf= info?.fediaf_min        && String(info.fediaf_min).trim()        !== '';
    const hasUsl   = info?.upper_safe_limit  && String(info.upper_safe_limit).trim()  !== '';
    const hasNrcMin= info?.nrc_min_per_mkg   && String(info.nrc_min_per_mkg).trim()  !== '';

    if (hasNrc || hasAafco || hasFediaf || hasNrcMin || hasUsl) {
      html += `<div class="nutr-section-label">📊 Referenzwerte</div>`;
      html += `<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:8px">`;

      if (hasNrcMin || hasNrc) {
        const val = info?.nrc_min_per_mkg || bedarfInfo?.bedarf_pro_mkg || '–';
        html += `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 4px;color:var(--sub);width:55%">NRC 2006 Mindestbedarf</td>
          <td style="padding:5px 4px;font-weight:600;text-align:right">${esc(String(val))} ${esc(info?.einheit || '')} / kg<sup>0,75</sup></td>
        </tr>`;
      }
      if (hasAafco) {
        html += `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 4px;color:var(--sub)">AAFCO Minimum</td>
          <td style="padding:5px 4px;font-weight:600;text-align:right">${esc(String(info.aafco_min_pct_dm))} % TM</td>
        </tr>`;
      }
      if (hasFediaf) {
        html += `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 4px;color:var(--sub)">FEDIAF Minimum</td>
          <td style="padding:5px 4px;font-weight:600;text-align:right">${esc(String(info.fediaf_min))} ${esc(info?.einheit || '')}</td>
        </tr>`;
      }
      if (hasUsl) {
        html += `<tr>
          <td style="padding:5px 4px;color:var(--danger-text,#e76f51)">⚠️ Sicherer Höchstwert</td>
          <td style="padding:5px 4px;font-weight:600;text-align:right;color:var(--danger-text,#e76f51)">${esc(String(info.upper_safe_limit))} ${esc(info?.einheit || '')}</td>
        </tr>`;
      }
      html += `</table>`;

      if (info?.quelle_ref && String(info.quelle_ref).trim()) {
        html += `<p style="font-size:10px;color:var(--sub);margin-bottom:8px">Quelle: ${esc(info.quelle_ref)}</p>`;
      }
    }

    // ── Inhaltliche Felder ───────────────────────────────────────
    if (info?.beschreibung)    html += `<div class="nutr-section-label">Was ist das?</div><p>${esc(info.beschreibung)}</p>`;
    if (info?.funktion)        html += `<div class="nutr-section-label">Funktion</div><p>${esc(info.funktion)}</p>`;
    if (info?.mangel_symptome) html += `<div class="nutr-section-label">Mangel-Symptome</div><p>${esc(info.mangel_symptome)}</p>`;
    if (info?.quellen)         html += `<div class="nutr-section-label">Quellen (Lebensmittel)</div><p>${esc(info.quellen)}</p>`;
    if (info?.obergrenze_info) html += `<div class="nutr-section-label">⚠️ Obergrenze (Hinweise)</div><p>${esc(info.obergrenze_info)}</p>`;

    if (!html) html = `<p style="color:var(--sub);font-size:13px">Keine Detailinformationen verfügbar.</p>`;

    document.getElementById('nutr-popup-content').innerHTML = html;
    document.getElementById('nutr-popup').style.display = 'flex';
  });
}

/**
 * Nährstoff-Info Popup schließen.
 * @param {Event} [event]
 */
export function closeNutrPopup(event) {
  if (event && event.target !== document.getElementById('nutr-popup')) return;
  document.getElementById('nutr-popup').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
//  HUNDE-DROPDOWNS
// ════════════════════════════════════════════════════════════════

/**
 * Alle Hunde-Dropdowns synchronisieren (fr-hund-select + tb-hund-select).
 * Wird nach Login und nach Hund-CRUD aufgerufen.
 */
export function syncHundSelects() {
  import('./store.js').then(({ getHunde }) => {
    const hunde = getHunde();
    ['fr-hund-select', 'tb-hund-select'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '';
      hunde
        .filter(h => h.aktiv !== 'nein')
        .forEach(h => {
          const opt = document.createElement('option');
          opt.value       = h.hund_id;
          opt.textContent = h.name + (h.rasse ? ` (${h.rasse})` : '');
          sel.appendChild(opt);
        });
      if (cur) sel.value = cur;
    });

    // User-E-Mail anzeigen
    import('./auth.js').then(({ getEmail }) => {
      const email = getEmail();
      ['fr-user-info', 'tb-user-info'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = email;
      });
    });

    // Navigation einblenden
    document.getElementById('top-nav').style.display = 'flex';
  });
}

/**
 * Kategorie-Select für neue Zutat im Futterrechner befüllen.
 */
export function populateCategorySelect() {
  import('./store.js').then(({ getZutaten }) => {
    const sel = document.getElementById('fr-custom-kategorie');
    if (!sel) return;
    const cats = [...new Set(getZutaten().map(z => z.kategorie).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">— wählen —</option>';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  });
}
