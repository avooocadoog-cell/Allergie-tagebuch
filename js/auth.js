/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MODULE: auth.js                                             ║
 * ║  Hund Manager – Google OAuth2 Authentifizierung             ║
 * ║                                                              ║
 * ║  Verantwortlich für:                                         ║
 * ║  - Google Login / Logout über Google Identity Services       ║
 * ║  - Access Token Verwaltung (in-memory + localStorage)        ║
 * ║  - Session-Wiederherstellung beim App-Start                  ║
 * ║  - Abgelaufene Session behandeln (401 → Login-Screen)        ║
 * ║                                                              ║
 * ║  Abhängigkeiten: keine                                       ║
 * ║  Wird importiert von: sheets.js, main.js                     ║
 * ║                                                              ║
 * ║  Externes Script: https://accounts.google.com/gsi/client     ║
 * ║  (muss im HTML als <script async> eingebunden sein)          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── OAuth2 Scope ─────────────────────────────────────────────────
const SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// ── Interner State ───────────────────────────────────────────────
let tokenClient      = null;
let accessToken      = '';
let userEmail        = '';
let _onLoginCallback = null;

/**
 * Callback registrieren der nach erfolgreichem Login aufgerufen wird.
 * Wird von main.js gesetzt um Zirkelimport zu vermeiden.
 * @param {Function} fn
 */
export function setOnLoginCallback(fn) {
  _onLoginCallback = fn;
}

// ── localStorage Keys ────────────────────────────────────────────
const KEY_TOKEN = 'hundapp_token';
const KEY_EMAIL = 'hundapp_email';

/**
 * Gespeicherten Token aus localStorage laden.
 * Wird beim App-Start aufgerufen um einen Re-Login zu vermeiden.
 * @returns {boolean} true wenn Token + E-Mail vorhanden
 */
export function loadSaved() {
  try {
    accessToken = localStorage.getItem(KEY_TOKEN) || '';
    userEmail   = localStorage.getItem(KEY_EMAIL) || '';
  } catch (e) {
    console.warn('Auth: localStorage nicht verfügbar:', e);
  }
  return !!(accessToken && userEmail);
}

/**
 * Google Login initiieren.
 * Wartet bei Bedarf auf das google.accounts-Objekt (async Script-Load).
 * Ruft nach erfolgreichem Login APP.onLogin() auf.
 */
export function signIn() {
  // Google Identity Services noch nicht geladen → kurz warten
  if (!window.google?.accounts?.oauth2) {
    setTimeout(signIn, 500);
    return;
  }

  // Config lazy importieren um Zirkelabhängigkeit zu vermeiden
  import('./config.js').then(({ get: getCfg }) => {
    const cfg = getCfg();
    if (!cfg.clientId) {
      alert('Bitte zuerst die Google Client-ID in den Einstellungen eintragen.');
      import('./ui.js').then(({ switchTopPanel }) => switchTopPanel('einst'));
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope:     SCOPE,
      callback:  handleTokenResponse,
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Callback nach erfolgreichem Token-Erhalt.
 * Holt E-Mail via userinfo-Endpoint und startet App.
 * @param {Object} resp - Google OAuth2 Token Response
 */
async function handleTokenResponse(resp) {
  if (resp.error) {
    alert('Login fehlgeschlagen: ' + resp.error);
    return;
  }

  accessToken = resp.access_token;

  // E-Mail laden
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    const d  = await r.json();
    userEmail = d.email || 'Angemeldet';
  } catch (e) {
    userEmail = 'Angemeldet';
  }

  // Persistieren
  try {
    localStorage.setItem(KEY_TOKEN, accessToken);
    localStorage.setItem(KEY_EMAIL, userEmail);
  } catch (e) {
    console.warn('Auth: Token konnte nicht gespeichert werden:', e);
  }

  // App starten via registriertem Callback (kein Zirkelimport)
  if (_onLoginCallback) {
    try {
      await _onLoginCallback();
    } catch (e) {
      console.error('Auth: onLogin-Fehler:', e);
      // Loader verstecken und Login-Screen zeigen falls onLogin() fehlschlägt
      document.getElementById('app-loader').style.display   = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }
  }
}

/**
 * Abmelden: Token widerrufen, State leeren, Login-Screen zeigen.
 */
export function signOut() {
  if (window.google && accessToken) {
    google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = '';
  userEmail   = '';

  try {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_EMAIL);
  } catch (e) { /* ignore */ }

  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

/**
 * Aufgerufen wenn ein API-Call HTTP 401 zurückgibt.
 * Löscht Token, versteckt Loader und zeigt Login-Screen.
 */
export function handleExpired() {
  accessToken = '';
  try { localStorage.removeItem(KEY_TOKEN); } catch (e) { /* ignore */ }

  document.getElementById('app-loader').style.display  = 'none';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

/** @returns {string} Aktueller Access Token */
export function getToken()   { return accessToken; }

/** @returns {string} E-Mail des angemeldeten Nutzers */
export function getEmail()   { return userEmail; }

/** @returns {boolean} Ob ein Token vorhanden ist */
export function isLoggedIn() { return !!accessToken; }
