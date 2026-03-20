# Hund Manager – Projektbeschreibung
> **Dieses Dokument als Kontext in jeden Prompt einfügen, wenn nur einzelne Module geteilt werden.**

---

## Überblick

**Hund Manager** ist eine mobile Web-App (PWA) zur Ernährungs- und Gesundheitsverwaltung für Hunde. Sie läuft vollständig im Browser, wird auf **GitHub Pages** gehostet und nutzt **Google Sheets als Datenbank** via der Google Sheets REST API v4. Kein Backend, kein Build-Tool – alles statisch.

**Zielgruppe:** Hundebesitzer die BARF-Ernährung betreiben und Symptome / Allergien dokumentieren wollen.

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Hosting | GitHub Pages (statisch) |
| Datenbank | Google Sheets API v4 (REST) |
| Auth | Google OAuth2 (Google Identity Services / `gsi/client`) |
| Frontend | Vanilla HTML + CSS + ES Modules (kein Framework, kein npm) |
| Offline-Daten | `localStorage` (Config, Token, E-Mail) |
| Wetter | BrightSky API (DWD) |
| Pollen | DWD OpenData API |
| Nährstoffberechnung | NRC 2006 Bedarfswerte |

---

## Google Sheets Struktur

Die App liest und schreibt in **zwei separate Spreadsheets**:

### Spreadsheet 1: `Hund_Stammdaten`
Enthält alle Stamm- und Konfigurationsdaten.

| Tabellenblatt | Inhalt |
|---|---|
| `Hunde` | Hundeprofile (hund_id, name, rasse, geburtsdatum, …) |
| `Parameter` | App-weite Konfigurationswerte (Key-Value) |
| `Naehrstoffe` | Nährstoffliste mit Beschreibungen, Gruppen, Symptomen |
| `Toleranzen` | Pro-Hund-Toleranzbereiche für Nährstoffe (min_pct / max_pct) |
| `Bedarf` | Nährstoffbedarf pro metabolischem Körpergewicht (NRC 2006) |
| `Zutaten` | Futterzutaten (zutaten_id, name, hersteller, kategorie) |
| `Zutaten_Naehrstoffe` | Nährstoffe pro 100g je Zutat |
| `Rezepte` | Gespeicherte Futterrezepte (rezept_id, hund_id, name) |
| `Rezept_Zutaten` | Zutaten je Rezept mit Gramm und Kochverlust-Flag |
| `Hund_Kalorienbedarf` | Kalorienbedarfsfaktoren je Hund |

### Spreadsheet 2: `Hund_Tagebuch`
Enthält alle Tagebucheinträge. Jeder Hund bekommt eigene Tabellenblätter nach dem Muster `{hund_id}_{Typ}`, z.B. `1_Umwelt`, `1_Symptom`, `2_Futter`.

| Tabellenblatt-Schema | Inhalt |
|---|---|
| `{id}_Umwelt` | Wettertagebuch (Temperatur, Luftfeuchtigkeit, Pollen, Raumklima, Bett) |
| `{id}_Symptom` | Symptomtagebuch (Kategorie, Schweregrad, Körperstelle, Beschreibung) |
| `{id}_Futter` | Futtertagebuch (Rezept, Produkt, Ausschlussdiät-Protokoll) |
| `{id}_Ausschluss` | Ausschlussdiät-Zutaten (Verdachtstufe, Status, Reaktion) |
| `{id}_Allergen` | Bestätigte Allergene (Kategorie, Reaktionsstärke) |
| `{id}_Tierarzt` | Tierarztbesuche (Diagnose, Befund, Therapie, Folgebesuch) |
| `{id}_Medikamente` | Medikamente & Supplements (Dosierung, Zeitraum) |

---

## Modulstruktur (Ziel-Architektur)

```
/
├── index.html              ← Nur HTML-Gerüst + <script type="module" src="js/main.js">
├── css/
│   └── styles.css          ← Gesamtes CSS (Design System, Dark Mode, alle Komponenten)
└── js/
    ├── main.js             ← App-Einstieg, initialisiert alle Module, APP-Objekt
    ├── config.js           ← localStorage Konfiguration (IDs, Standort, Pollen-Region)
    ├── sheets.js           ← Alle Google Sheets API Calls (appendRow, readSheet, writeRange, …)
    ├── auth.js             ← Google OAuth2 Login/Logout, Token-Verwaltung
    ├── store.js            ← In-Memory Cache für alle Stammdaten (Hunde, Zutaten, Nährstoffe, …)
    ├── ui.js               ← UI-Hilfsfunktionen (Panel-Wechsel, Tabs, Modals, Status-Meldungen)
    ├── form.js             ← Toggle-Button Logik für alle Formulare
    ├── wetter.js           ← BrightSky / DWD Wetter & Pollen API
    ├── rechner.js          ← Futterrechner (Rezepte, Nährstoffanalyse, Kalorien, Verhältnisse)
    ├── tagebuch.js         ← Formular-Submit-Logik für alle 7 Tagebuch-Typen
    ├── ansicht.js          ← Ansicht-Modus: Einträge aus Sheets laden & als Karten rendern
    └── stammdaten.js       ← CRUD für Hunde, Zutaten, Parameter (Modals, Tabellen)
```

---

## Modul-Abhängigkeiten

```
config.js       (kein Import)
auth.js         (kein Import)
sheets.js       ← auth.js
store.js        ← sheets.js, config.js
ui.js           (kein Import)
form.js         (kein Import)
wetter.js       ← config.js
rechner.js      ← store.js, sheets.js, config.js, ui.js
tagebuch.js     ← store.js, sheets.js, config.js, ui.js, form.js
ansicht.js      ← store.js, sheets.js, config.js, ui.js
stammdaten.js   ← store.js, sheets.js, config.js, ui.js
main.js         ← alle Module
```

---

## Wichtige Konventionen

### Sheets API
- Alle API-Calls laufen über `sheets.js` – kein Modul greift direkt auf die API zu
- `appendRow(sheet, values, spreadsheetId)` – Zeile anhängen
- `readSheet(sheet, spreadsheetId)` – gesamtes Blatt lesen, gibt `string[][]` zurück
- `writeRange(sheet, range, values, spreadsheetId)` – Bereich überschreiben
- Tabellenblatt-Header stehen in Zeile 1-2, Daten ab Zeile 3 (je nach Sheet)
- Zeilen werden als flache Arrays gespeichert (keine Objekte in Sheets)

### Datenbank-Layer (store.js)
- `STORE.loadAll()` lädt beim Start alle Stammdaten parallel aus `Hund_Stammdaten`
- Alle anderen Module lesen aus dem In-Memory-Cache, nicht direkt aus Sheets
- `parseRows(raw, headers, startRow)` konvertiert `string[][]` → `Object[]`

### Auth
- Token wird in `localStorage` als `hundapp_token` gespeichert
- E-Mail als `hundapp_email`
- Bei HTTP 401 → `AUTH.handleExpired()` → zurück zum Login

### Config
- Konfiguration in `localStorage` als `hundapp_config` (JSON)
- Felder: `clientId`, `stammdatenId`, `tagebuchId`, `lat`, `lon`, `pollenRegion`
- Default-Werte: Berlin (lat 52.4, lon 13.4, pollenRegion 50)

### UI-Struktur
- **Top-Navigation:** 4 Panels (`rechner`, `tagebuch`, `stammdaten`, `einst`)
- **Tagebuch:** Eingabe-Modus / Ansicht-Modus → je 7 Tabs
- **Rechner:** Rezeptliste → Rezept-Editor (mit Akkordeon-Sections)
- **Stammdaten:** 3 Tabs (Hunde, Zutaten, Parameter) mit CRUD-Modals
- **Einstellungen:** Google-Konfiguration + Anleitung

### CSS Design System
- CSS Custom Properties in `:root` (Farben, Radii, Status-Farben)
- Dark Mode via `prefers-color-scheme: dark`
- Mobile-first, max-width 540px
- Klassen-Präfixe: `.fr-` (Futterrechner), `.ec-` (Entry Card), `.sd-` (Stammdaten)

### Nährstoffberechnung
- Metabolisches Körpergewicht (mKG) = `Gewicht^0.75`
- Bedarf = `bedarf_pro_mkg × mKG`
- Ist-Wert = Summe `(gramm × (gekocht ? 0.75 : 1) × wert_pro_100g / 100)` über alle Zutaten
- Toleranzbalken-Farben: ok (grün), low (gelb), high (orange), zero (rot)
- Ca:P-Verhältnis: Ziel 1,2–1,5 : 1
- Omega 6:3-Verhältnis: Ziel max. 6 : 1

---

## Typischer Prompt wenn ein einzelnes Modul geteilt wird

```
Kontext: Hund Manager – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md]

Ich teile jetzt [modul.js]. Bitte [Aufgabe beschreiben].
Andere Module die importiert werden: [z.B. sheets.js, store.js]
```
