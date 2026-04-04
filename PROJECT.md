# Hund Manager – Projektbeschreibung (v1.1.0)

> **Dieses Dokument als Kontext in jeden Prompt einfügen, wenn nur einzelne Module geteilt werden.**
> Letzte Aktualisierung: 2026-04-04 · Status: v1.1.0 – USDA-Import, UI-Bereinigungen (Statistik, Nav-Bug)

> **Coding-Konvention:** Module werden gezielt angepasst – kein komplettes Neuschreiben ganzer Dateien.
> Änderungen immer als minimale, chirurgische Eingriffe in die relevanten Funktionen.

---

## Überblick

**Hund Manager** ist eine mobile Web-App (PWA) zur Ernährungs- und Gesundheitsverwaltung für Hunde. Sie läuft vollständig im Browser, wird auf **GitHub Pages** gehostet und nutzt **Google Sheets als Datenbank** via der Google Sheets REST API v4. Kein Backend, kein Build-Tool – alles statisch.

**Zielgruppe:** Hundebesitzer, die BARF-Ernährung betreiben und Symptome / Allergien systematisch dokumentieren wollen.

---

## Tech-Stack

| Bereich              | Technologie                                                       |
|----------------------|-------------------------------------------------------------------|
| Hosting              | GitHub Pages (statisch)                                           |
| Datenbank            | Google Sheets API v4 (REST)                                       |
| Auth                 | Google OAuth2 (Google Identity Services / `gsi/client`)           |
| Frontend             | Vanilla HTML + CSS + ES Modules (kein Framework, kein npm)        |
| Charts               | Chart.js 4.x via CDN (nur in statistik.js)                        |
| Offline-Daten        | `localStorage` (Config, Token, E-Mail), `sessionStorage` (Cache)  |
| Wetter               | BrightSky API (DWD-Daten)                                         |
| Pollen               | DWD OpenData + Open-Meteo Air Quality API                         |
| Nährstoffberechnung  | NRC 2006 Bedarfswerte (39 Nährstoffe), ergänzt durch AAFCO/FEDIAF |

---

## Modulstruktur

```
/
├── index.html              ← HTML-Gerüst + <script type="module" src="main.js">
├── PROJECT.md              ← Dieses Dokument – Architektur, Konventionen, Implementierungsstand
├── FEATURE.md              ← Vollständige Feature-Übersicht (für Nutzer + als Kontext)
├── FAQ.md                  ← Häufige Fragen & Antworten (für Nutzer + als Kontext)
├── VALIDATION.md           ← Manuelle Testszenarien & Regressionstests
├── README.md               ← Kurzbeschreibung für GitHub
├── css/
│   └── styles.css          ← Design System (CSS Custom Properties, Dark Mode, Mobile-first)
├── js/
├── main.js                 ← App-Einstieg, globale window-Exports, APP-Objekt, i18n-Init
├── config.js               ← localStorage-Konfiguration + setupAllSheets() + usdaApiKey
├── sheets.js               ← Alle Google Sheets API Calls + createSheetWithHeaders()
├── auth.js                 ← Google OAuth2 Login/Logout, Token-Verwaltung
├── cache.js                ← Tagebuch-Lese-Cache (sessionStorage, TTL 10 Min)
├── store.js                ← In-Memory Cache Stammdaten + recommended_pct in Toleranzen
├── ui.js                   ← UI-Hilfsfunktionen + erweitertes Nährstoff-Popup (AAFCO/FEDIAF)
├── form.js                 ← Toggle-Button-Zustand für alle Tagebuch-Formulare
├── wetter.js               ← Wetter & Pollen + Pollen_Log schreiben + Skala 0–5 + erweiterbare Custom-Pollen (localStorage)
├── rechner.js              ← Futterrechner + Rezept-Mix + recommended_pct Marker
├── tagebuch.js             ← Submit-Handler 7 Typen + Multi-Futter mit Kcal-Berechnung
├── ansicht.js              ← Entry-Cards + Soft-Delete + Edit-Modal + Undo-Banner
├── stammdaten.js           ← CRUD Hunde/Zutaten/Toleranzen + Kcal-Bedarf + Gewicht + Nährwerte im Zutat-Modal + USDA/OFF-Import
├── statistik.js            ← Konfigurierbarer Chart: Temp-Band, Symptome-Flächenband (rot), Pollen-Popup-Dialog
└── i18n.js                 ← Mehrsprachigkeit: t(), setLang(), applyAll(), loadDefaults()
```

---

## Modul-Abhängigkeiten

```
config.js       → ui.js, sheets.js
auth.js         → (kein Import)
sheets.js       → auth.js
store.js        → sheets.js, config.js
cache.js        → sheets.js, config.js
ui.js           → (dynamisch: store.js, auth.js)
form.js         → (kein Import)
i18n.js         → sheets.js, config.js
wetter.js       → config.js, sheets.js
rechner.js      → store.js, sheets.js, config.js, ui.js
tagebuch.js     → sheets.js, config.js, ui.js, form.js, store.js
ansicht.js      → cache.js, config.js, ui.js, sheets.js
stammdaten.js   → sheets.js, config.js, ui.js, store.js
statistik.js    → cache.js, store.js, ui.js
main.js         → alle Module inkl. i18n.js
```

---

## Google Sheets Struktur

Die App liest und schreibt in **zwei separate Spreadsheets**.

### WICHTIGE KONVENTION

- **Zeile 1:** Anzeige-Header (deutsch, für menschliche Lesbarkeit im Sheet)
- **Zeile 2:** API-Header (englisch, snake_case – für zukünftige Mehrsprachigkeit)
- **Daten ab Zeile 3**
- **Neue Pflichtfelder** (am Ende jeder Tabelle): `created_at`, `deleted`, `deleted_at`
- JS-Code liest per **Spaltenindex** (positional), neue Spalten IMMER ANS ENDE anfügen

---

### Spreadsheet 1: Stammdaten (`Hund_Stammdaten`)

#### `Hunde`

| # | Spalte         | Typ     | Beschreibung                        |
|---|----------------|---------|-------------------------------------|
| A | hund_id        | int     | Primary Key, auto-increment         |
| B | name           | string  | Rufname                             |
| C | rasse          | string  | Rasse oder Mix-Beschreibung         |
| D | geburtsdatum   | date    | Format DD.MM.YYYY                   |
| E | geschlecht     | enum    | m / w                               |
| F | kastriert      | enum    | ja / nein                           |
| G | aktiv          | enum    | ja / nein (Soft-Disable)            |
| H | notizen        | string  | Freitext                            |
| I | created_at     | datetime| ISO 8601                            |
| J | deleted        | boolean | TRUE / FALSE                        |
| K | deleted_at     | datetime| ISO 8601, leer wenn nicht gelöscht  |

#### `Parameter`

| # | Spalte      | Typ    | Beschreibung                              |
|---|-------------|--------|-------------------------------------------|
| A | parameter   | string | Key (z.B. `toleranz_default_min_pct`)     |
| B | wert        | mixed  | Wert                                      |
| C | einheit     | string | z.B. `%`, `g`, `kcal`                    |
| D | beschreibung| string | Erklärung                                 |

Wichtige Parameter-Keys:
- `toleranz_default_min_pct` (Standard: 80)
- `toleranz_default_max_pct` (Standard: 150)
- `rer_faktor_default` (Standard: 1.6)
- `rer_exponent` (Standard: 0.75)
- `rer_faktor_70` (Standard: 70)

#### `Naehrstoffe`

| # | Spalte           | Typ    | Beschreibung                              |
|---|------------------|--------|-------------------------------------------|
| A | naehrstoff_id    | int    | Primary Key                               |
| B | name             | string | Name (z.B. "Rohprotein", "Kalzium")       |
| C | einheit          | string | g / mg / µg / IE                          |
| D | gruppe           | string | Makros / Mineralstoffe / Vitamine / etc.  |
| E | beschreibung     | string | Was ist das?                              |
| F | funktion         | string | Funktion im Körper                        |
| G | mangel_symptome  | string | Mangelzeichen                             |
| H | quellen          | string | Vorkommen in Lebensmitteln                |
| I | obergrenze_info  | string | Hinweise zur Obergrenze (NRC/AAFCO)       |
| J | nrc_min_per_mkg  | float  | NRC 2006 Mindestbedarf pro kg^0.75        |
| K | aafco_min_pct_dm | float  | AAFCO Minimum (% Trockensubstanz)         |
| L | fediaf_min       | float  | FEDIAF Minimum (falls abweichend)         |
| M | upper_safe_limit | float  | Sicherer Höchstwert (NRC/AAFCO)          |
| N | quelle           | string | Quellenangabe (NRC 2006, AAFCO 2022, etc.)|

> **Hinweis:** 39 Nährstoffe nach NRC 2006 sind bereits in der Tabelle enthalten.
> Spalten J–N wurden mit der v2-Migration neu hinzugefügt (ans Ende der Originalspalten).

#### `Toleranzen`

| # | Spalte          | Typ   | Beschreibung                            |
|---|-----------------|-------|-----------------------------------------|
| A | hund_id         | int   | Foreign Key → Hunde                     |
| B | naehrstoff_id   | int   | Foreign Key → Naehrstoffe               |
| C | naehrstoff_name | string| Denormalisiert (für Lesbarkeit)         |
| D | min_pct         | float | Minimum als % des Bedarfs (z.B. 80)     |
| E | max_pct         | float | Maximum als % des Bedarfs (z.B. 150)    |
| F | anmerkung       | string| Freitext                                |
| G | recommended_pct | float | Empfehlung (optional, z.B. 100)         |

#### `Bedarf`

| # | Spalte           | Typ   | Beschreibung                            |
|---|------------------|-------|-----------------------------------------|
| A | naehrstoff_id    | int   | Foreign Key → Naehrstoffe               |
| B | naehrstoff_name  | string| Denormalisiert                          |
| C | einheit          | string|                                         |
| D | bedarf_pro_mkg   | float | Bedarf pro kg^0.75 (NRC 2006)           |
| E | quelle           | string| NRC 2006 / AAFCO / FEDIAF               |

#### `Zutaten`

| # | Spalte      | Typ     | Beschreibung                            |
|---|-------------|---------|-----------------------------------------|
| A | zutaten_id  | int     | Primary Key                             |
| B | name        | string  | z.B. "Pferd (Muskelfleisch)"            |
| C | hersteller  | string  | Hersteller / Marke                      |
| D | kategorie   | string  | Fleisch / Innereien / Gemüse / etc.     |
| E | aktiv       | enum    | ja / nein                               |
| F | created_at  | datetime| ISO 8601                                |
| G | deleted     | boolean | TRUE / FALSE                            |
| H | deleted_at  | datetime| leer wenn nicht gelöscht                |

#### `Zutaten_Naehrstoffe`

| # | Spalte          | Typ   | Beschreibung                            |
|---|-----------------|-------|-----------------------------------------|
| A | zutaten_id      | int   | Foreign Key → Zutaten                   |
| B | naehrstoff_id   | int   | Foreign Key → Naehrstoffe               |
| C | naehrstoff_name | string| Denormalisiert                          |
| D | wert_pro_100g   | float | Nährstoffgehalt pro 100g Frischgewicht  |
| E | source          | string| Quelle: manual / import / usda          |

#### `Rezepte`

| # | Spalte     | Typ     | Beschreibung                            |
|---|------------|---------|-----------------------------------------|
| A | rezept_id  | int     | Primary Key                             |
| B | hund_id    | int     | Foreign Key → Hunde                     |
| C | name       | string  | Rezeptname                              |
| D | erstellt   | date    | DD.MM.YYYY                              |
| E | notizen    | string  | Freitext                                |
| F | deleted    | boolean | TRUE / FALSE                            |
| G | deleted_at | datetime|                                         |

#### `Rezept_Zutaten`

| # | Spalte      | Typ     | Beschreibung                            |
|---|-------------|---------|-----------------------------------------|
| A | rezept_id   | int     | Foreign Key → Rezepte                   |
| B | zutaten_id  | int     | Foreign Key → Zutaten                   |
| C | zutat_name  | string  | Denormalisiert                          |
| D | gramm       | float   | Menge in Gramm                          |
| E | gekocht     | enum    | ja / nein (Kochverlustkorrekturfaktor)  |

#### `Rezept_Komponenten` *(NEU – für Rezept-Mixing)*

| # | Spalte         | Typ   | Beschreibung                                   |
|---|----------------|-------|------------------------------------------------|
| A | id             | int   | Primary Key                                    |
| B | rezept_id      | int   | Das Ziel-Rezept (Foreign Key → Rezepte)        |
| C | komponenten_typ| enum  | `zutat` oder `rezept`                          |
| D | ref_id         | int   | zutaten_id ODER rezept_id (je nach Typ)        |
| E | gramm          | float | Menge in Gramm                                 |
| F | notizen        | string| Freitext                                       |

> Erlaubt Mischungen wie "200g Rezept A + 150g Rezept B + 50g Zutat X".
> Rekursive Auflösung: `rechner.js` muss Zyklen erkennen (max. 5 Ebenen tief).

#### `Hund_Kalorienbedarf`

| # | Spalte      | Typ   | Beschreibung                            |
|---|-------------|-------|-----------------------------------------|
| A | hund_id     | int   | Foreign Key → Hunde                     |
| B | faktor_typ  | string| RER_faktor / kcal_manuell / rer_exponent|
| C | wert        | float | Wert                                    |
| D | beschreibung| string| Erklärung                               |

#### `Translations` *(NEU – Mehrsprachigkeit)*

| # | Spalte  | Typ    | Beschreibung                                |
|---|---------|--------|---------------------------------------------|
| A | key     | string | z.B. `symptom_itching`, `category_skin`     |
| B | lang    | string | `de`, `en`, `fr`, etc.                      |
| C | value   | string | Übersetzter Text                            |
| D | context | string | Modul / Bereich (für Filterung)             |

Beispieldaten:
```
symptom_juckreiz | de | Juckreiz
symptom_juckreiz | en | itching
category_haut    | de | Haut
category_haut    | en | skin
```

---

### Spreadsheet 2: Tagebuch (`Hund_Tagebuch`)

> **Hinweis zur Sheet-Benennung:**
> Aktuell: einheitliche Sheets (`Umweltagebuch`, `Symptomtagebuch`, …)
> Ziel (Phase 2): Pro-Hund-Sheets (`1_Umwelt`, `2_Umwelt`, …) via automatischer Erstellung
> → Bis dahin bleibt die aktuelle Struktur bestehen und wird per `hund_id`-Spalte gefiltert.

#### `Umweltagebuch`

| # | Spalte       | Typ   | Alt | Beschreibung                            |
|---|--------------|-------|-----|-----------------------------------------|
| A | hund_id      | int   | ✓   | Foreign Key → Hunde                     |
| B | datum        | date  | ✓   | DD.MM.YYYY                              |
| C | temp_min     | float | ✓   | Außentemp. Minimum (°C)                 |
| D | temp_max     | float | ✓   | Außentemp. Maximum (°C)                 |
| E | luftfeuchtig | int   | ✓   | Außenluftfeuchte (%)                    |
| F | regen        | float | ✓   | Niederschlag (mm)                       |
| G | pollen       | string| ✓   | Freitext: "Birke (mittel), Gräser (stark)" |
| H | raumtemp     | float | ✓   | Raumtemperatur (°C)                     |
| I | raumfeuchtig | int   | ✓   | Raumluftfeuchte (%)                     |
| J | bett         | enum  | ✓   | Unverändert / Gewechselt                |
| K | notizen      | string| ✓   | Freitext                                |
| L | entry_id     | string| NEU | UUID oder Zeitstempel (für Undo)        |
| M | created_at   | datetime|NEU| ISO 8601                                |
| N | deleted      | boolean|NEU| TRUE / FALSE                            |
| O | deleted_at   | datetime|NEU| ISO 8601, leer wenn aktiv               |

#### `Symptomtagebuch`

| # | Spalte        | Typ   | Beschreibung                            |
|---|---------------|-------|-----------------------------------------|
| A | hund_id       | int   |                                         |
| B | datum         | date  |                                         |
| C | kategorie     | string| Kommasepariert: "Haut, Pfoten"          |
| D | beschreibung  | string|                                         |
| E | schweregrad   | int   | 0–5 (0 = keine Symptome)               |
| F | koerperstelle | string| Kommasepariert                          |
| G | notizen       | string|                                         |
| H | entry_id      | string| UUID                                    |
| I | created_at    | datetime|                                         |
| J | deleted       | boolean|                                         |
| K | deleted_at    | datetime|                                         |

> **Schweregrad-Skala:** 0 = keine Symptome, 1 = sehr leicht, 2 = leicht, 3 = mittel, 4 = stark, 5 = sehr stark

#### `Futtertagebuch`

| # | Spalte        | Typ    | Alt | Beschreibung                           |
|---|---------------|--------|-----|----------------------------------------|
| A | hund_id       | int    | ✓   |                                        |
| B | datum         | date   | ✓   |                                        |
| C | futter        | string | ✓   | Freitext oder Rezeptname               |
| D | produkt       | string | ✓   | Produkt / Marke                        |
| E | erstegabe     | enum   | ✓   | Ja / Nein                              |
| F | zweiwo        | enum   | ✓   | Ja / Nein (2-Wochen-Phase abgeschlossen)|
| G | provokation   | enum   | ✓   | Ja / Nein                              |
| H | beschreibung  | string | ✓   | Reaktion                               |
| I | notizen       | string | ✓   |                                        |
| J | entry_id      | string | NEU | UUID                                   |
| K | created_at    | datetime|NEU |                                        |
| L | deleted       | boolean|NEU |                                        |
| M | deleted_at    | datetime|NEU |                                        |

#### `Ausschlussdiät`

| # | Spalte   | Typ    | Alt | Beschreibung                           |
|---|----------|--------|-----|----------------------------------------|
| A | hund_id  | int    | ✓   |                                        |
| B | zutat    | string | ✓   |                                        |
| C | verdacht | int    | ✓   | Verdachtstufe 0–3 (0=sicher, 1=leicht, 2=mittel, 3=stark) |
| D | kategorie| string | ✓   |                                        |
| E | status   | string | ✓   | verträglich / Reaktion / Gesperrt / Test|
| F | datum    | date   | ✓   |                                        |
| G | reaktion | string | ✓   |                                        |
| H | notizen  | string | ✓   |                                        |
| I | entry_id | string | NEU |                                        |
| J | created_at|datetime|NEU |                                        |
| K | deleted  | boolean|NEU |                                        |
| L | deleted_at|datetime|NEU|                                        |

#### `Bekannte Allergene`

| # | Spalte   | Typ    | Beschreibung                           |
|---|----------|--------|----------------------------------------|
| A | hund_id  | int    |                                        |
| B | allergen | string |                                        |
| C | kategorie| string |                                        |
| D | reaktion | int    | Reaktionsstärke 1–5                    |
| E | symptome | string |                                        |
| F | notizen  | string |                                        |
| G | entry_id | string |                                        |
| H | created_at|datetime|                                        |
| I | deleted  | boolean|                                        |
| J | deleted_at|datetime|                                        |

#### `Tierarztbesuche`

| # | Spalte        | Typ    | Alt | Beschreibung                           |
|---|---------------|--------|-----|----------------------------------------|
| A | hund_id       | int    | ✓   |                                        |
| B | datum         | date   | ✓   |                                        |
| C | arzt          | string | ✓   | Praxisname / Tierarzt                  |
| D | anlass        | string | ✓   |                                        |
| E | untersuchungen| string | ✓   |                                        |
| F | ergebnis      | string | ✓   | Befund                                 |
| G | therapie      | string | ✓   |                                        |
| H | folge         | date   | ✓   | Folgebesuch DD.MM.YYYY                 |
| I | entry_id      | string | NEU |                                        |
| J | created_at    | datetime|NEU|                                        |
| K | deleted       | boolean|NEU|                                        |
| L | deleted_at    | datetime|NEU|                                        |

#### `Medikamente`

| # | Spalte      | Typ    | Beschreibung                           |
|---|-------------|--------|----------------------------------------|
| A | hund_id     | int     |                                        |
| B | name        | string | Medikamentenname                       |
| C | typ         | string | Antibiotikum / Antihistaminikum / etc. |
| D | dosierung   | string | z.B. "5mg/kg"                          |
| E | haeufigkeit | string | z.B. "2x täglich"                      |
| F | von         | date   | DD.MM.YYYY                             |
| G | bis         | date   | DD.MM.YYYY                             |
| H | verordnet   | string | Tierarzt / Selbst                      |
| I | notizen     | string |                                        |
| J | entry_id    | string  |                                        |
| K | created_at  | datetime|                                        |
| L | deleted     | boolean|                                        |
| M | deleted_at  | datetime                                        |

#### `Hund_Gewicht` *(NEU – für Statistik-Gewichtsverlauf)*

| # | Spalte     | Typ   | Beschreibung                            |
|---|------------|-------|-----------------------------------------|
| A | entry_id   | int   | Primary Key / Auto-increment            |
| B | hund_id    | int   | Foreign Key → Hunde                     |
| C | datum      | date  | DD.MM.YYYY                              |
| D | gewicht_kg | float | Körpergewicht in kg                     |
| E | notizen    | string| Freitext                                |
| F | created_at | datetime| ISO 8601                              |

#### `Pollen_Log` *(NEU – separate Pollenarten pro Tag)*

| # | Spalte     | Typ   | Beschreibung                            |
|---|------------|-------|-----------------------------------------|
| A | entry_id   | int   | Primary Key                             |
| B | hund_id    | int   | Foreign Key → Hunde                     |
| C | datum      | date  | DD.MM.YYYY                              |
| D | pollenart  | string| Birke / Gräser / Erle / Beifuß / etc.  |
| E | stufe      | int   | 0–5 (0=keine, 5=sehr stark)             |
| F | quelle     | string| DWD / Open-Meteo / manuell              |
| G | created_at | datetime|                                       |

> Die Pollen-Skala: 0=keine, 1=gering, 2=gering–mittel, 3=mittel, 4=mittel–stark, 5=stark
> Das bisherige Freitextfeld `pollen` in Umweltagebuch bleibt bestehen (Rückwärtskompatibilität).
> `Pollen_Log` ermöglicht zusätzlich die Trennung nach Pollenart in der Statistik.

---

## Nährstoffe (NRC 2006 – vollständige Liste)

Die App implementiert alle **39 Nährstoffe** des NRC 2006 für Hunde:

| Gruppe           | Nährstoffe                                                                 |
|------------------|----------------------------------------------------------------------------|
| Makronährstoffe  | Rohprotein, Rohfett, Rohfaser, Feuchtigkeit, Asche                        |
| Aminosäuren      | Arginin, Histidin, Isoleucin, Leucin, Lysin, Methionin, Phenylalanin,     |
|                  | Threonin, Tryptophan, Valin, Cystein, Tyrosin, Taurin                     |
| Fettsäuren       | Linolsäure (LA), α-Linolensäure (ALA), EPA, DHA                           |
| Mineralstoffe    | Kalzium, Phosphor, Magnesium, Natrium, Kalium, Chlorid,                   |
|                  | Eisen, Zink, Kupfer, Mangan, Selen, Jod                                   |
| Vitamine         | Vitamin A, D3, E, K, B1, B2, B3, B5, B6, B9, B12, Cholin, Biotin         |

**Quellen:**
- NRC (2006): *Nutrient Requirements of Dogs and Cats*. National Academies Press.
- AAFCO (2022): Dog Food Nutrient Profiles
- FEDIAF (2021): Nutritional Guidelines for Complete and Complementary Pet Food

---

## Wichtige Konventionen

### Sheets API Layer (`sheets.js`)
- Alle API-Calls laufen ausschließlich über `sheets.js`
- `appendRow(sheet, values, spreadsheetId)` – Zeile anhängen
- `readSheet(sheet, spreadsheetId)` → `string[][]`
- `writeRange(sheet, range, values, spreadsheetId)` – Bereich überschreiben
- `createSheet(sheetName, headers, spreadsheetId)` – Blatt + Header erstellen *(v2)*
- **HTTP 401** → `handleExpired()` → Login-Screen

### Stammdaten-Cache (`store.js`)
- `STORE.loadAll()` lädt alle Stammdaten beim Start parallel
- Alle anderen Module lesen aus dem In-Memory-Cache
- `parseRows(raw, headers, startRow)` → `Object[]`
- Nach Write: Cache lokal aktualisieren (`addHund`, `updateHund`, `addZutat`, …)

### Tagebuch-Cache (`cache.js`)
- TTL: 10 Minuten (sessionStorage)
- `getSheet(name, which, forceRefresh)` → aus Cache oder Sheets-API
- `preloadAll()` – alle 7 Tagebuch-Sheets parallel beim Start
- `appendCached(name, row)` – nach Write lokal aktualisieren
- `invalidate(name)` / `invalidateAll()` – Cache leeren

### Auth (`auth.js`)
- Token: `localStorage['hundapp_token']`
- E-Mail: `localStorage['hundapp_email']`
- Bei Token-Ablauf → `handleExpired()` → Login-Screen

### Soft Delete (v2)
- Löschen setzt `deleted = TRUE` und `deleted_at = ISO-Timestamp`
- Lesecode filtert `deleted === TRUE` Zeilen heraus
- Undo: `deleted = FALSE`, `deleted_at = ''` (via `writeRange`)
- Maximale Undo-History: letzte 10 Löschungen (in-memory, geht beim Reload verloren)

### Rezept-Mixing (v2)
- `Rezept_Komponenten`-Tabelle erlaubt verschachtelte Rezepte
- Rekursive Auflösung in `rechner.js` (max. 5 Ebenen, Zykluserkennung via Set)
- Ergebnis-Nährwerte = Summe aller aufgelösten Einzelzutaten

---

## UI-Struktur

```
Top-Navigation: [Rechner] [Tagebuch] [Statistik] [Stammdaten] [Einstellungen]

Rechner-Panel:
  └── Rezeptliste → Rezept-Editor (Akkordeon: Zutaten / Nährstoffe / Verhältnisse / Rezept-Mix)

Tagebuch-Panel:
  ├── [Eingabe] / [Ansicht] Toggle
  ├── Eingabe: 7 Tabs (Umwelt / Symptom / Futter / Ausschluss / Allergen / Tierarzt / Medikament)
  └── Ansicht: 7 Tabs (gleiche Struktur, Entry-Cards aus Cache)

Statistik-Panel:
  ├── Hund-Select + Zeitraum-Select
  ├── KPI-Kacheln (Symptomtage, Ø Schweregrad, Pollentage)
  ├── Parameter-Auswahl (Toggle-Buttons): Temp-Band, Temp innen, Feuchte außen/innen,
  │   Schweregrad Symptome, Gewicht
  ├── 🌿 Pollen-Button → öffnet Bottom-Sheet-Popup zur Auswahl (Pollen_Log + Custom-Pollen)
  ├── Konfigurierbarer Mixed Chart:
  │   - Temp-Band: oranges Flächenband (fill zwischen Min/Max)
  │   - Schweregrad Symptome: ROTES FLÄCHENBAND (fill:'origin', von 0 bis Wert)
  │   - Pollen: Balken (y2-Achse, 0–5)
  │   - Sonstige: Linien
  ├── Futter-Reaktionen (Liste, nur Einträge mit Reaktion/Provokation)
  └── Medikamente (Liste mit Von–Bis)

Stammdaten-Panel: 4 Tabs (Hunde / Zutaten [Edit + Undo + Nährwerte] / Parameter / Toleranzen) + Modals
  └── Zutat-Modal: Basisfelder + einklappbarer Nährwert-Abschnitt (alle 39 NRC-Nährstoffe, 2-spaltig nach Gruppe)
Einstellungen-Panel: Google-Config + USDA-API-Key + Sprache (i18n) + Sheet-Setup + Verbindungstest
```

---

## CSS Design System

- CSS Custom Properties in `:root` (Farben, Border-Radii, Status-Farben)
- Dark Mode via `prefers-color-scheme: dark`
- Mobile-first, `max-width: 540px`
- Klassen-Präfixe: `.fr-` (Futterrechner), `.ec-` (Entry Cards), `.sd-` (Stammdaten)
- Status-Klassen: `.badge-ok` (grün), `.badge-warn` (gelb), `.badge-bad` (rot)

---

## Nährstoffberechnung

- **Metabolisches Körpergewicht (mKG):** `Gewicht^0.75`
- **Bedarf:** `bedarf_pro_mkg × mKG`
- **Ist-Wert (Nährstoffe):** `Σ (gramm × wert_pro_100g / 100)` – Kochverlust wird selektiv angewendet (siehe unten)
- **Kochverlustkorrekturfaktor:** 0.75 (pauschal) – gilt **ausschließlich für B-Vitamine** (B1, B2, B3, B5, B6, B9, B12), konfigurierbar via Parameter `kochverlust_b_vitamine` (Standard: 0.30 Verlust → Faktor 0.70). Protein, Fett und alle anderen Nährstoffe werden **nicht** durch den Kochverlust reduziert. Die Kcal-Berechnung basiert daher auf den vollen Makro-Werten.
- **Kalorienbedarf (RER):** `70 × mKG × RER_faktor`
- **Ca:P-Verhältnis:** Ziel 1,2–1,5 : 1
- **Omega 6:3-Verhältnis:** Ziel max. 6 : 1 – Omega-3 = ALA + `EPA + DHA` (kombinierter Nährstoffeintrag). **Wichtig:** Der Nährstoff muss im Sheet `Bedarf` und `Zutaten_Naehrstoffe` exakt als `EPA + DHA` benannt sein; separate Einträge `EPA` und `DHA` werden in der Verhältnisberechnung **nicht** berücksichtigt.
- **Toleranzbalken-Farben:** ok (grün 80–150%), low (gelb <80%), high (orange >150%), zero (rot 0%)
- **recommended_pct:** optionaler Empfehlungswert je Toleranz-Eintrag → zeigt grüne Markierungslinie im Balken
- **Kcal-Bedarf manuell:** `kcal_manuell`-Eintrag in `Hund_Kalorienbedarf` überschreibt RER-Berechnung komplett → einstellbar im Hunde-Edit-Modal (Stammdaten)
- **NaN-Schutz:** `calcMkg()` prüft ob Eingabe positiv + finite ist; Fallback auf Milow-Default (27kg)

---

## Implementierungsstand v1.1.0 (aktuell)

Versionierung X.Y.Z
X wird nur durch den Nutzer freigegeben
Y neue Features
Z Bugfixes


### ✅ Code – vollständig implementiert

**v0.7.0 Basis:**
- `_meta()` in alle 7 tagebuch.js Submit-Handler (entry_id, created_at, deleted, deleted_at)
- Soft-Delete-Filter in ansicht.js, statistik.js
- Edit-Modal für alle 7 Tagebuch-Typen (ansicht.js `editEntry` / `saveEdit`)
- Undo-Banner für Tagebuch-Einträge und Zutaten
- Rezept Soft-Delete (rechner.js)
- Zutaten Edit + Delete + Undo (stammdaten.js)
- Rezept-Mix: `resolveRezept()` mit Zykluserkennung, max. 5 Ebenen (rechner.js)
- Nährstoff-Popup mit AAFCO/FEDIAF-Tabelle (ui.js)
- recommended_pct Marker im Nährstoff-Balken (rechner.js)
- Pollen-Skala 0–5 ganzzahlig (wetter.js)
- Pollen_Log schreiben beim Übernehmen (wetter.js)
- Gewichtsverlauf-Chart + Pollen-nach-Typ-Chart (statistik.js)
- createSheetWithHeaders() + setupAllSheets() (sheets.js / config.js)
- i18n-Modul mit 35 Standard-Übersetzungen + Sheet-Integration (i18n.js)
- Sprachschalter in Einstellungen + data-i18n Attribute (index.html)

**v0.8.0:**
- Kcal-Bedarf pro Hund manuell eintragbar (Stammdaten → Hund bearbeiten)
- Multi-Futter Tagebuch: mehrere Rezepte mit g-Angaben, automatische Kcal-Berechnung und Komponentenaufschlüsselung
- Statistik konfigurierbarer Chart mit Temperaturband, Schweregrad-Balken, individuelle Pollen-Typen (Toggle)
- NaN-Schutz in `calcMkg()` und `renderNutrTable()` (rechner.js)
- German-Decimal-Fix: `_float()` in store.js für alle Nährstoff- und Toleranzwerte

**v0.9.0:**
- **Nährwerte im Zutat-Modal** (stammdaten.js): Alle 39 NRC-Nährstoffe direkt beim Anlegen/Bearbeiten einer Zutat einpflegbar. Eingaben werden in `Zutaten_Naehrstoffe` geschrieben (Update oder Append). Bestehende Werte werden beim Öffnen aus Store geladen. Abschnitt ist ein-/ausklappbar.
- **Erweiterbare Pollen** (wetter.js): Custom-Pollen per `localStorage` (`hundapp_custom_pollen`). `showPollenManager()` für Anlegen/Löschen. Eigene Pollen erscheinen im Pollen-Selector mit manueller Stufenwahl und werden in Pollen_Log geschrieben → sichtbar in Tagebuch und Statistik.
- **Statistik bereinigt** (statistik.js): Ausschlussdiät-Sektion entfernt, PARAM_DEF-Label: „Schweregrad (0–5)" → „Schweregrad Symptome (0–5)".

**v1.0.0:**
- **Pollen-Popup** (statistik.js): Statt Inline-Toggle-Buttons öffnet ein „🌿 Pollen (X/Y)"-Button einen Bottom-Sheet-Popup-Dialog. Zeigt alle Pollen-Typen aus Pollen_Log UND Custom-Pollen aus localStorage. Badge „Daten" vs. „Manuell". Alle/Keine + Übernehmen-Button.
- **Schweregrad Symptome als rotes Flächenband** (statistik.js): `chartType:'area'` mit `fill:'origin'` – gefüllte rote Fläche von 0 bis zum Tageswert. Deutliche visuelle Hervorhebung von Symptomtagen.
- **Ausschlussdiät in Statistik zurück** (statistik.js): Wird als Liste angezeigt (wie Medikamente), mit Status-Badges (verträglich/Reaktion/Gesperrt/Test). Box erscheint nur wenn Daten für den Hund vorhanden sind.
- **FEATURE.md + FAQ.md** erstellt: Vollständige Feature-Dokumentation und FAQ als eigenständige Dateien im Repo.
- **Dokumentations-Fixes:** `verdacht`-Skala korrigiert (0–3), styles.css-Duplikat entfernt, Kochverlust präzisiert (nur B-Vitamine), EPA+DHA-Namenskonvention dokumentiert, VALIDATION.md um T-RECHN-06 erweitert.


**v1.1.0:**
- **USDA / Open Food Facts Import** (stammdaten.js + config.js + index.html): Neuer einklappbarer „🔍 Nährwerte importieren"-Abschnitt im Zutat-Modal oberhalb der manuellen Nährstoff-Eingabe. Radio-Button-Auswahl zwischen USDA FoodData Central (API-Key erforderlich) und Open Food Facts (kein Key). Suche liefert bis zu 8 Treffer, Klick übernimmt Nährstoffe in die Inputs. Mapping-Tabellen für USDA-Nutrient-Namen → NRC-Namen; EPA + DHA werden zusammengeführt. USDA API-Key in config.js (`usdaApiKey`) + neuem Einstellungs-Abschnitt in index.html.
- **Bekannte Allergene aus Statistik entfernt** (statistik.js): Sektion war doppelt; führende Stelle ist Tagebuch → Allergen-Tab. Sheet-Load, Render-Funktion und HTML-Box entfernt.
- **Ausschlussdiät aus Statistik entfernt** (statistik.js): Aus gleichem Grund; führende Stelle ist Tagebuch → Ausschluss-Tab. Sheet-Load, Render-Funktion und HTML-Box entfernt.
- **Pollen-Vorauswahl** (statistik.js): Standardmäßig werden jetzt alle verfügbaren Pollenarten aktiviert (vorher: nur Pollenarten aus Bekannten Allergenen).
- **Doppeltes Einstellungs-Symbol** (index.html): Dupliziertes `⚙️ Einst.` in der Top-Navigation entfernt.


## Typischer Prompt bei Einzelmodul-Arbeit

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md]

Ich teile jetzt [modul.js]. Bitte [Aufgabe beschreiben].
Andere relevante Module: [z.B. sheets.js, store.js, cache.js]
Aktualisiere PROJECT.md, FEATURE.md und FAQ.md als zukünftige Referenz.
Bei Umstrukturierung der hinterlegten Spreadsheets bitte informieren.
```

---

## Instruktionen für Claude bei jedem Code-Update

> Diese Regeln gelten für **jede** Session in der Code-Änderungen vorgenommen werden.

### ✅ Pflicht nach jeder Änderung

1. **PROJECT.md aktualisieren:**
   - Versionsnummer erhöhen 
   - Project.md immer aktualisieren
   - Datum auf aktuelles Datum setzen
   - Modul-Beschreibung in der Dateistruktur anpassen
   - UI-Struktur aktualisieren falls sich Panels/Tabs ändern
   - Implementierungsstand: neue Version als Block `**vX.X:**` mit Bullet-Points hinzufügen
   - „Wichtige Hinweise für neue Prompts" aktualisieren

2. **FEATURE.md aktualisieren:**
   - Neue Features in der passenden Kategorie ergänzen
   - Feature.md aktualiseren
   - Geänderte Features anpassen (z.B. Label-Änderungen, Verhalten)
   - Frage nach bevor Entfernte Features aus der Liste streichen
   - Versuche immer features zu erhalten wenn diese nicht explizit gestrichen wurden

3. **FAQ.md aktualisieren:**
   - Neue FAQs für neue Features hinzufügen
   - Antworten auf bestehende Fragen anpassen wenn sich Verhalten ändert
   - Neue Fehlerfälle oder typische Nutzer-Fragen ergänzen

4. **Sheet-Änderungen melden:**
   - Wenn neue Spalten, Sheets oder Spalten-Reihenfolgen geändert werden → explizit im Chat mitteilen mit genauer Anleitung was in Google Sheets manuell geändert werden muss

5. **Änderungsübersicht auf Englisch im Chat:**
   - Nach jeder Änderungssession eine kompakte Übersicht **auf Englisch** posten:
   ```
   ## Changes in vX.X
   **Modified:** [file] – [what changed]
   **Added:** [file/feature] – [description]
   **Removed:** [feature] – [reason]
   **Sheet changes required:** [yes/no + details]
   ```

 6. **Validatoin.md aktualisieren:**
  **Alte Validierungen nicht löschen
  **prüfen ob neue Validierungen und Evaluierungen erforderlich sind


### Wichtige Hinweise für neue Prompts

- `stammdaten.js` importiert `getNaehrstoffe` und `addZutatNutr` aus `store.js`
- `wetter.js` exportiert zusätzlich: `showPollenManager`, `_addCustomPollen`, `_removeCustomPollen`
- `statistik.js` exportiert zusätzlich: `showPollenPopup`
- Custom-Pollen werden in `localStorage['hundapp_custom_pollen']` als JSON-Array gespeichert
- `statistik.js` lädt `Ausschlussdiät`- und `Bekannte Allergene`-Sheets **nicht mehr** (seit v1.1.0)
- PARAM_DEF `symptome` hat `chartType:'area'` (rotes Flächenband, `fill:'origin'`)
- `stammdaten.js` exportiert zusätzlich: `runImportSearch`, `applyImportResult`
- USDA API-Key: `get().usdaApiKey` aus `config.js`, editierbar in Einstellungen
- Pollen-Auswahl in Statistik ist ein Popup-Dialog (`showPollenPopup()`), kein Inline-Toggle mehr
- Pollen-Vorauswahl: alle verfügbaren Pollenarten standardmäßig aktiv (kein Abgleich mit Allergenen mehr)
