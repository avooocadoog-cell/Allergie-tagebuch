# Hund Manager – Feature-Ideen & Implementierungsprompts (v1.3.2)

> Letzte Aktualisierung: 2026-04-04
> Status: Ideen – noch nicht implementiert
> Jede Idee ist als eigenständiger Prompt formuliert und kann einzeln beauftragt werden.
> Vor jeder Implementierung: PROJECT.md als Kontext einfügen + das betreffende Modul mitliefern.

---

## ✅ Idee 1 – Kleinere Optimierungen (implementiert in v1.1.0)

### Beschreibung
Drei unabhängige UI-Bereinigungen, die zusammen als ein Arbeitspaket erledigt werden können:

- **Bekannte Allergene aus Statistik entfernen** – die Sektion ist im Tagebuch → Allergen-Tab vollständiger und besser gepflegt; doppelte Darstellung erzeugt Verwirrung
- **Ausschlussdiät aus Statistik entfernen** – aus gleichem Grund; die Ansicht im Tagebuch → Ausschluss-Tab ist die führende Stelle
- **Doppeltes Einstellungs-Symbol beheben** – in der Navigation erscheint aktuell zweimal „⚙ Einst" (Zahnrad + Text doppelt gerendert)

### Betroffene Module
- `statistik.js` – Allergene-Sektion und Ausschlussdiät-Sektion entfernen
- `index.html` – Einstellungs-Navigationselement bereinigen

### Neues Sheet
Keines.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js und index.html. Bitte führe drei chirurgische Bereinigungen durch.
Keine anderen Bereiche verändern.

Änderung 1 – Bekannte Allergene aus Statistik entfernen (statistik.js):
- Entferne die Render-Funktion und den zugehörigen HTML-Block für „Bekannte Allergene"
  in der Statistik-Sektion vollständig
- Den Sheet-Load für „Bekannte Allergene" in statistik.js ebenfalls entfernen
- Die Sektion im Tagebuch (ansicht.js) bleibt unberührt

Änderung 2 – Ausschlussdiät aus Statistik entfernen (statistik.js):
- Entferne die Render-Funktion und den zugehörigen HTML-Block für „Ausschlussdiät"
  in der Statistik-Sektion vollständig
- Den Sheet-Load für „Ausschlussdiät" in statistik.js ebenfalls entfernen
- Die Sektion im Tagebuch (ansicht.js) bleibt unberührt

Änderung 3 – Doppeltes Einstellungs-Symbol beheben (index.html):
- Prüfe das Navigationselement für Einstellungen
- Entferne die doppelte Ausgabe von Symbol und/oder Text sodass nur einmal „⚙️ Einst"
  oder ein äquivalentes Label erscheint

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## ✅ Idee 2 – Zutat-Datenbank-Import (USDA / Open Food Facts) (implementiert in v1.1.0)

### Beschreibung
Nährstoffwerte automatisch aus öffentlichen APIs laden statt manuell eintippen. Die USDA FoodData Central API ist kostenlos nutzbar (API-Key erforderlich, kostenlose Registrierung). Open Food Facts ist vollständig offen ohne Key. Besonders zeitsparend für Gemüse, Öle und Nahrungsergänzungsmittel.

### Betroffene Module
- `stammdaten.js` – Such-UI und Import-Logik im Zutat-Modal
- `config.js` – USDA API-Key in localStorage speichern
- `index.html` – Such-Feld + Treffer-Liste im Zutat-Modal

### Neues Sheet
Keines – Werte landen in `Zutaten_Naehrstoffe` (bereits vorhanden).

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt stammdaten.js, config.js und index.html.
Bitte füge im Zutat-Modal (Anlegen / Bearbeiten) einen „🔍 Aus Datenbank importieren"-Bereich
oberhalb des manuellen Nährwert-Abschnitts ein. Chirurgische Eingriffe.

Anforderungen:

1. In config.js: neuer Konfig-Key `usda_api_key` (localStorage, editierbar in Einstellungen)

2. In index.html / Zutat-Modal: neuer einklappbarer Abschnitt „Nährwerte importieren":
   - Suchfeld + „Suchen"-Button
   - Ergebnis-Liste (max. 8 Treffer) mit Klick zum Übernehmen
   - Quelle wählen: USDA FoodData Central | Open Food Facts (Radio-Button)
   - Hinweis: „Werte werden als Vorschlag geladen – bitte prüfen und ggf. anpassen"

3. In stammdaten.js:
   a) Funktion searchUSDA(query):
      - API: https://api.nal.usda.gov/fdc/v1/foods/search?query={q}&api_key={key}&pageSize=8
      - Parst nutrients[] und mappt auf die 39 NRC-Nährstoffnamen (Mapping-Tabelle nötig,
        da USDA-Namen von NRC-Namen abweichen – z.B. „Protein" → „Rohprotein")
      - Gibt { name, nährstoffe: { [nrcName]: wert_pro_100g } } zurück

   b) Funktion searchOpenFoodFacts(query):
      - API: https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&json=1&page_size=8
      - Parst nutriments{} und mappt analog
      - Kein API-Key nötig

   c) Funktion importNutrValues(nährstoffe):
      - Befüllt die bestehenden Nährwert-Eingabefelder im Modal mit den importierten Werten
      - Überschreibt nur Felder die einen Wert > 0 haben
      - Setzt source-Feld auf „usda" bzw. „open_food_facts"

4. Fehlerbehandlung: API nicht erreichbar → Fehlermeldung, manueller Eintrag bleibt möglich
   USDA-Key fehlt → Hinweis „USDA API-Key in Einstellungen eintragen", Open Food Facts weiter nutzbar

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine. Neue Konfiguration: usda_api_key in localStorage.
```

---

## ✅ Idee 3 – Symptom-Muster-Erkennung (Wochentag / Monat) (implementiert in v1.2.0)

### Beschreibung
Einfache Heatmap-Auswertung: An welchen Wochentagen und in welchen Monaten sind die Symptome im Schnitt stärker? Könnte z.B. einen Zusammenhang mit wiederkehrenden Aktivitäten (Hundesport dienstags, Waldspaziergänge am Wochenende) sichtbar machen. Rein aus Symptomtagebuch-Daten – kein neues Sheet.

### Betroffene Module
- `statistik.js` – neue Sektion „📅 Symptom-Muster" unterhalb des Charts

### Neues Sheet
Keines.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js.
Bitte füge eine neue ein-/ausklappbare Sektion „📅 Symptom-Muster" in statistik.js ein –
unterhalb der Chart-Sektion. Keine anderen Sektionen verändern.

Anforderungen:

1. Wochentag-Heatmap:
   - 7 Zellen (Mo–So) als farbige Kacheln
   - Farbe = Ø Schweregrad des Wochentags (0 = weiß/grau, 5 = dunkelrot)
   - Tooltip/Label: „Di · Ø 2.4 · 12 Einträge"
   - Wochentage mit weniger als 2 Einträgen: grau + „zu wenig Daten"

2. Monats-Heatmap:
   - 12 Zellen (Jan–Dez) als farbige Kacheln, gleiche Farbskala
   - Nur Monate mit tatsächlichen Daten einfärben
   - Darunter: Hinweis welcher Monat den höchsten Ø Schweregrad hat

3. Farbskala: linearer Gradient 0→5:
   - 0: var(--bg-card)
   - 1–2: var(--bar-ok) mit Transparenz
   - 3: var(--bar-low) (gelb)
   - 4–5: var(--danger-text) (rot)

4. Datenquelle: Symptomtagebuch aus Cache, gefiltert auf currentHundId und gewählten Zeitraum.
   Datum parsen aus DD.MM.YYYY → JS Date → getDay() / getMonth().
   Schweregrad aus Spalte E (Index 4).

5. Sektion nur anzeigen wenn mindestens 14 Symptomeinträge vorhanden sind.

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## ✅ Idee 4 – Verdachts-Korrelationsanalyse (implementiert in v1.3.0)

### Beschreibung
Automatische statistische Auswertung des Zusammenhangs zwischen Umweltfaktoren (Pollen, Temperatur, Feuchtigkeit) und Symptomschweregraden. Beispiel: „An Tagen mit Birken-Pollen ≥ 3 hatte Milow im Schnitt Schweregrad 2.8". Die Rohdaten liegen bereits vollständig in den Sheets vor – es fehlt nur die Auswertungslogik.

### Betroffene Module
- `statistik.js` – neue Sektion unterhalb der Symptom-Muster-Sektion
- `cache.js` – Daten werden bereits gecacht, kein neues Sheet nötig

### Neues Sheet
Keines – alle benötigten Daten sind in `Umweltagebuch`, `Symptomtagebuch` und `Pollen_Log` vorhanden.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js. Bitte füge eine neue Sektion „🔗 Korrelationsanalyse" unterhalb
der Symptom-Muster-Sektion (falls vorhanden) bzw. unterhalb des Charts ein.
Keine anderen Sektionen verändern.

Anforderungen:
- Lies Umweltagebuch, Symptomtagebuch und Pollen_Log aus dem Cache (cache.js getSheet())
- Verknüpfe Einträge über das Datum (Format DD.MM.YYYY) und hund_id
- Berechne für jeden Umweltfaktor den durchschnittlichen Symptom-Schweregrad:
  - Pollenarten (aus Pollen_Log, Stufe 0–5): gruppiere in „keine (0)", „gering (1–2)", „mittel (3)", „stark (4–5)"
  - Außentemperatur (temp_max): gruppiere in <5°C, 5–15°C, 15–25°C, >25°C
  - Luftfeuchtigkeit außen: gruppiere in <40%, 40–60%, 60–80%, >80%
- Zeige pro Faktor eine kompakte Tabelle: Gruppe | Tage mit Daten | Ø Schweregrad | Max Schweregrad
- Hebe Gruppen mit Ø Schweregrad > 2.0 orange hervor (CSS-Klasse badge-warn)
- Mindestens 3 Datenpunkte pro Gruppe erforderlich, sonst „zu wenig Daten"
- Nur Faktoren anzeigen für die überhaupt Daten im gewählten Zeitraum vorhanden sind
- Sektion ist ein-/ausklappbar (gleiche Logik wie bestehende Akkordeons)
- Kein neues Sheet, kein neuer API-Call – ausschließlich aus dem bestehenden Cache lesen

Aktualisiere nach der Implementierung PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Melde Sheet-Änderungen explizit (erwartet: keine).
```

---

## Idee 5 – Reaktions-Score pro Zutat

Optimierung 
in den stammdaten für Hundefutter vergleiche ob es bereits einen identisch eitnrag gib
in der Korrelationsanalyse eine sortierung einfügen die es nsch Häufigkeit und Korrelation sortieren kann


### Beschreibung
Automatisch aus den Tagebuchdaten berechnen: Wie oft folgte auf einen Futtertageintrag mit Zutat X innerhalb von 48 Stunden ein Symptomeintrag mit Schweregrad > 2? Das ergibt einen datenbasierten Verdachtsscore unabhängig von manuellen Einschätzungen. Wird als sortierte Liste mit Score-Balken in der Statistik angezeigt.

### Betroffene Module
- `statistik.js` – neue Sektion „🧪 Zutaten-Reaktionsscores"
- `store.js` – `getZutatenNamen()` Hilfsfunktion (falls noch nicht vorhanden)

### Neues Sheet
Keines – Berechnung aus `Futtertagebuch` + `Symptomtagebuch`.

### Hinweis zur Datenqualität
Der Score funktioniert nur wenn im Futtertagebuch tatsächlich Zutaten oder Rezeptnamen eingetragen sind (Freitextfeld `futter`). Je strukturierter die Einträge, desto aussagekräftiger der Score.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js, store.js und cache.js.
Bitte füge eine neue ein-/ausklappbare Sektion „🧪 Zutaten-Reaktionsscores" in statistik.js
unterhalb der Korrelationsanalyse-Sektion (falls vorhanden) ein. Keine anderen Sektionen verändern.

Anforderungen:

1. Algorithmus in statistik.js (Funktion calcReaktionsScore(hundId, tage)):
   a) Lade Futtertagebuch und Symptomtagebuch aus Cache für hundId
   b) Extrahiere aus Futtereinträgen alle vorkommenden Zutaten-/Rezeptnamen
      (Spalte C = futter-Freitext; split auf Komma + bekannte Rezeptnamen aus store.getRezepte())
   c) Für jede Zutat/Rezept: prüfe alle Tage wo sie gegessen wurde
      → Zähle Folgetage (Tag +1 und +2) mit Symptom-Schweregrad > 2
      → Score = (Anzahl Reaktionstage) / (Anzahl Futtertage mit dieser Zutat) × 100
   d) Nur Zutaten auswerten die mindestens 3× im Zeitraum vorkommen
   e) Sortiere absteigend nach Score

2. Darstellung:
   - Liste aller Zutaten mit Score-Balken (0–100%)
   - Farbgebung: <20% grün, 20–50% gelb, >50% rot
   - Pro Zutat: „X von Y Mal gefolgt von Symptomen (≥48h-Fenster)"
   - Hinweis-Box oben: „Dieser Score ist ein statistischer Hinweis, kein medizinischer Befund.
     Mindestens 3 Beobachtungen erforderlich."
   - Wenn keine auswertbaren Daten: „Zu wenig strukturierte Futterdaten für eine Auswertung."

3. Keine neuen API-Calls – ausschließlich Cache nutzen.

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## Idee 6 – Ausschlussdiät-Zeitplan / Phasentracker

### Beschreibung
Strukturierter Ablauf für die klassische Ausschlussdiät: Eliminationsphase (typisch 6–8 Wochen mit einer einzigen Proteinquelle) → Provokationsphase (je Zutat 2 Wochen, systematisch testen) → Ergebnis-Auswertung. Ein Fortschrittsbalken zeigt wo man steht, und das geplante Enddatum der aktuellen Phase wird berechnet.

### Betroffene Module
- `tagebuch.js` – neuer Submit-Handler `submitAusschlussPhasen()`
- `ansicht.js` – Phasen-Banner oberhalb der Ausschluss-Einträge
- `statistik.js` – Phasen-Timeline als neue Sektion
- `index.html` – neuer Tab im Ausschluss-Bereich

### Neues Sheet
`Ausschluss_Phasen` im Tagebuch-Spreadsheet:

| # | Spalte      | Typ      | Beschreibung                                      |
|---|-------------|----------|---------------------------------------------------|
| A | entry_id    | string   | UUID                                              |
| B | hund_id     | int      | Foreign Key → Hunde                               |
| C | phase_typ   | enum     | `elimination` / `provokation` / `ergebnis`        |
| D | zutat       | string   | Getestete Zutat (leer bei Elimination)            |
| E | start_datum | date     | DD.MM.YYYY                                        |
| F | end_datum   | date     | DD.MM.YYYY (geplant)                              |
| G | ergebnis    | enum     | `offen` / `verträglich` / `reaktion`              |
| H | notizen     | string   | Freitext                                          |
| I | created_at  | datetime | ISO 8601                                          |
| J | deleted     | boolean  | TRUE / FALSE                                      |
| K | deleted_at  | datetime | ISO 8601                                          |

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt tagebuch.js, ansicht.js, statistik.js und index.html.
Bitte implementiere einen Ausschlussdiät-Phasentracker. Chirurgische Eingriffe – kein Neuschreiben.

Anforderungen:

1. Neues Sheet `Ausschluss_Phasen` (Struktur siehe Ideas.md):
   - In config.js / setupAllSheets() registrieren
   - Header-Zeilen anlegen (Zeile 1 deutsch, Zeile 2 snake_case, Daten ab Zeile 3)

2. Neuer Tab „📅 Phasen" im Tagebuch → Ausschluss-Bereich (index.html):
   - Felder: Phase-Typ (Elimination / Provokation / Ergebnis), Zutat (nur bei Provokation),
     Startdatum, geplantes Enddatum, Ergebnis (offen / verträglich / Reaktion), Notizen
   - Speichern-Button ruft neuen submitAusschlussPhasen() in tagebuch.js auf

3. Phasen-Banner in ansicht.js (Ausschluss-Tab):
   - Zeige aktive Phase (end_datum in der Zukunft, ergebnis=offen) als farbigen Banner ganz oben
   - Format: „📅 Aktive Phase: Elimination · noch X Tage (bis DD.MM.YYYY)"
   - Fortschrittsbalken: vergangene Tage / Gesamtdauer der Phase
   - Farbe: blau für Elimination, gelb für Provokation, grün für Ergebnis

4. Phasen-Timeline in statistik.js (neue Sektion):
   - Liste aller Phasen chronologisch mit Status-Badge
   - Abgeschlossene Phasen mit Ergebnis-Badge (verträglich = grün, Reaktion = rot)

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderung melden: neues Sheet Ausschluss_Phasen im Tagebuch-Spreadsheet erforderlich.
```

---

## Idee 7 – Tierarzt-Export als PDF

### Beschreibung
Kompakten, druckbaren Bericht als PDF direkt im Browser generieren – ohne Backend, ohne externe API. Enthält: Deckblatt mit Hund-Stammdaten, Symptomverlauf der letzten 90 Tage, aktuelle Medikamente, bekannte Allergene, Ausschlussdiät-Status. Alle Daten liegen bereits vor.

### Betroffene Module
- Neues Modul `js/export.js` – PDF-Generierung via `window.print()` + CSS `@media print`
- `statistik.js` – Export-Button ergänzen
- `main.js` – export.js importieren und als `window.EXPORT` exportieren
- `css/styles.css` – Print-Stylesheet ergänzen

### Neues Sheet
Keines.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js, store.js, cache.js, main.js und styles.css.
Bitte implementiere einen Tierarzt-Export als druckbares PDF – ohne externe Bibliotheken,
ausschließlich mit window.print() und CSS @media print. Chirurgische Eingriffe.

Anforderungen:

1. Neues Modul js/export.js mit Funktion exportTierarztPDF(hundId, zeitraumTage=90):
   - Baut eine versteckte <div id="print-report"> Struktur im DOM auf
   - Ruft Daten aus store.js (Stammdaten, Allergene, Ausschluss) und
     cache.js (Symptomtagebuch, Futtertagebuch, Medikamente) ab
   - Inhalt:
     a) Deckblatt: Name, Rasse, Geburtsdatum, Gewicht (letzter Eintrag), Exportdatum
     b) Symptomübersicht: Tabelle der letzten 90 Tage mit Datum, Kategorie, Schweregrad
     c) Bekannte Allergene: Liste mit Reaktionsstärke
     d) Ausschlussdiät-Status: Liste mit Status-Badge
     e) Aktuelle Medikamente: Name, Dosierung, Von–Bis
     f) Letzte 5 Futtereinträge
   - Ruft anschließend window.print() auf
   - Räumt #print-report danach wieder aus dem DOM

2. In styles.css: @media print Block
   - Alles außer #print-report ausblenden
   - Seitenumbrüche zwischen Sektionen (page-break-before: always)
   - Schwarz-Weiß-freundliche Farben (keine CSS Custom Properties im Print)

3. In statistik.js: Button „📄 Tierarzt-Export" oben rechts (neben Aktualisieren-Button)
   - Ruft window.EXPORT.exportTierarztPDF(currentHundId) auf

4. In main.js: export.js importieren und als window.EXPORT exportieren

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## Idee 8 – Rezept-Nährstoffvergleich (A vs. B)

### Beschreibung
Zwei Rezepte direkt nebeneinander vergleichen. Der Nutzer wählt zwei Rezepte aus, gibt jeweils ein Gewicht ein, und sieht alle 39 Nährstoffe mit Ist-Wert, Bedarf und Ampelfarbe in einer zweispaltigen Tabelle. Hilfreich um Optimierungen am Rezept zu bewerten.

### Betroffene Module
- `rechner.js` – neue Funktion `calcVergleich()` + `renderVergleich()`
- `index.html` – Vergleichs-Panel HTML als neuer Tab im Rechner
- `css/styles.css` – Zweispalten-Layout für Vergleichstabelle

### Neues Sheet
Keines.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt rechner.js, index.html und styles.css.
Bitte füge im Futterrechner einen „⚖️ Vergleich"-Tab neben der bestehenden Rezeptliste ein.
Chirurgische Eingriffe – bestehende Logik nicht anfassen.

Anforderungen:

1. Vergleichs-Panel in index.html (neuer Tab im Rechner-Bereich):
   - Zwei Spalten nebeneinander (auf Mobile: untereinander)
   - Je Spalte: Rezept-Dropdown (alle Rezepte des aktuellen Hundes), Gramm-Eingabe, Hund-Gewicht
   - Button „Vergleichen"

2. In rechner.js neue Funktion calcVergleich():
   - Nutzt bestehende resolveRezept() und getNutrMap() / getBedarf() aus store.js
   - Berechnet Nährstoffsummen für beide Rezepte unabhängig (analog zu recalc())
   - Gibt für jeden Nährstoff zurück: { name, einheit, istA, istB, bedarf, pctA, pctB, clsA, clsB }

3. Vergleichstabelle rendern (renderVergleich()):
   - Kopfzeile: „Nährstoff | Bedarf | Rezept A (Name) | Rezept B (Name)"
   - Je Zeile: Nährstoffname, Bedarfswert, Ist-Wert A mit Ampelfarbe, Ist-Wert B mit Ampelfarbe
   - Zeilen wo A und B deutlich abweichen (Delta > 20% des Bedarfs) fett hervorheben
   - Darunter: Zusammenfassung Kcal A vs. B, Ca:P A vs. B, Omega 6:3 A vs. B
   - Gruppenheader (Makros / Aminosäuren / Fettsäuren / …) wie im Rechner

4. In styles.css: .fr-compare-grid (CSS Grid 4 Spalten, responsive auf 2 Spalten bei <400px)

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## Idee 9 – Mehrere Hunde – Statistik-Vergleich

### Beschreibung
Die Datenbankstruktur unterstützt bereits mehrere Hunde via `hund_id`. Die Statistik filtert auch bereits nach Hund. Was fehlt: Ein Side-by-Side-Vergleich zweier Hunde im selben Chart – z.B. für Geschwisterhunde mit ähnlicher Diät oder um festzustellen ob Symptome hundeindividuell oder umweltbedingt sind.

### Betroffene Module
- `statistik.js` – Zweiter Hund-Select + Overlay-Logik im Chart
- `index.html` – zweites Hund-Dropdown in der Statistik-Navigation

### Neues Sheet
Keines.

### Implementierungsprompt

```
Kontext: Hund Manager v1.0.0 – Web-App auf GitHub Pages, Google Sheets als Datenbank,
Vanilla ES Modules, kein Framework. Vollständige Projektbeschreibung: [PROJECT.md einfügen]

Ich teile jetzt statistik.js und index.html.
Bitte füge in der Statistik einen optionalen zweiten Hund-Select hinzu, dessen Schweregrad-Verlauf
als zweites Flächenband (blau, halbtransparent) über den bestehenden Chart gelegt wird.
Chirurgische Eingriffe – bestehende Hund-1-Logik nicht verändern.

Anforderungen:

1. In index.html (Statistik-Panel):
   - Zweites Hund-Dropdown „Vergleich mit:" direkt neben dem bestehenden Hund-Select
   - Option „– kein Vergleich –" als Standard (deaktiviert den Overlay)
   - Nur aktive Hunde anzeigen, aktuell gewählter Hund ausschließen

2. In statistik.js:
   a) Zweiten Hund-Select mit verfügbaren Hunden befüllen (analog zu bestehendem Select)
   b) Wenn Vergleichshund gewählt: Symptomtagebuch für Hund 2 aus Cache laden
      (separater getSheet()-Call mit hund_id-Filter)
   c) Zweiten Datensatz als zusätzliches Chart.js-Dataset eintragen:
      - Label: Name des zweiten Hundes
      - Farbe: rgba(59, 130, 246, 0.35) (blau, halbtransparent)
      - chartType: 'area', fill: 'origin' – analog zu bestehendem Symptom-Band
      - Y-Achse: dieselbe rechte Y2-Achse (0–5)
   d) Bei Hund-2-Wechsel: Chart neu rendern, kein Full-Reload

3. Legende im Chart automatisch aktualisieren (Hund-1-Name + Hund-2-Name)

4. KPI-Kacheln bleiben auf Hund 1 – kein Vergleich der KPIs (zu unübersichtlich)

Aktualisiere PROJECT.md, FEATURE.md, FAQ.md und VALIDATION.md.
Sheet-Änderungen: keine.
```

---

## Umsetzungsreihenfolge

| # | Idee | Aufwand | Betroffene Module | Neues Sheet |
|---|------|---------|-------------------|-------------|
| ~~1~~ | ~~Kleinere Optimierungen~~ | ✅ umgesetzt in v1.1.0 | statistik.js, index.html | Nein |
| ~~2~~ | ~~USDA-Import~~ | ✅ umgesetzt in v1.1.0 | stammdaten.js, config.js, index.html | Nein |
| ~~3~~ | ~~Symptom-Muster~~ | ✅ umgesetzt in v1.2.0 | statistik.js | Nein |
| ~~4~~ | ~~Korrelationsanalyse~~ | ✅ umgesetzt in v1.3.0 | statistik.js | Nein |
| 5 | Reaktions-Score | Mittel | statistik.js, store.js | Nein |
| 6 | Phasentracker | Hoch | tagebuch.js, ansicht.js, statistik.js, index.html | Ja – Ausschluss_Phasen |
| 7 | Tierarzt-PDF | Mittel | Neues export.js, statistik.js, main.js, styles.css | Nein |
| 8 | Rezept-Vergleich | Mittel | rechner.js, index.html, styles.css | Nein |
| 9 | Mehrere Hunde | Mittel | statistik.js, index.html | Nein |
