# Hund Manager – Softwarevalidierung (v1.3.1)

> **Zweck:** Manuelle und automatisierte Testszenarien zur Verifikation aller implementierten Features.
> Letzte Aktualisierung: 2026-04-04
> Version: v1.3.1

---

## Testkonventionen

| Symbol | Bedeutung |
|--------|-----------|
| ✅ PASS | Test bestanden |
| ❌ FAIL | Test fehlgeschlagen |
| 🔄 SKIP | Nicht anwendbar (z.B. Sheet nicht vorhanden) |
| ⚠️ WARN | Ergebnis abweichend aber tolerierbar |

**Vorbedingungen für alle Tests:**
- App ist eingeloggt (Google OAuth2)
- Stammdaten-Sheet und Tagebuch-Sheet sind vorhanden und konfiguriert
- Hund "Milow" (hund_id=1, Gewicht=27kg) ist angelegt

---

## Modul 1: Authentifizierung (auth.js)

### T-AUTH-01 – Login-Flow
**Schritte:**
1. App öffnen ohne aktiven Token
2. Auf „Mit Google anmelden" tippen

**Erwartetes Ergebnis:** Google OAuth2-Popup öffnet sich, nach Bestätigung wird App-Dashboard geladen.

### T-AUTH-02 – Token-Ablauf
**Schritte:**
1. Token in localStorage manuell löschen
2. API-Aufruf triggern (z.B. Tagebuch-Laden)

**Erwartetes Ergebnis:** App fordert erneut Login an, kein Absturz.

### T-AUTH-03 – Logout
**Schritte:**
1. Einstellungen öffnen → Abmelden

**Erwartetes Ergebnis:** Token wird gelöscht, Login-Screen erscheint.

---

## Modul 2: Futterrechner – Kcal-Berechnung (rechner.js)

### T-RECHN-01 – Kcal-Berechnung korrekt (Referenzrezept)
**Testvorbedingung:** Rezept „Känguru und Optimix" mit:
- Känguru (Muskelfleisch, Keule): 350g, gekocht=ja
- Reis (gekocht): 100g, gekocht=ja
- Vitamin Optimix Cani Cooking: 9g
- Walnussöl: 9g
- Algenöl: 1g

**Schritte:**
1. Rechner → Rezept öffnen
2. Nährstoffanalyse prüfen

**Erwartetes Ergebnis:**
- Kcal-Ist liegt zwischen 600–800 kcal (nicht um 50% reduziert durch Kochverlust)
- Kochverlustfaktor 0.75 gilt NICHT für Protein/Fett in Kcal-Berechnung

### T-RECHN-02 – Ca:P-Verhältnis
**Erwartetes Ergebnis:** Anzeige im Format `X.XX : 1` mit Zielangabe `1.2–1.5 : 1`

### T-RECHN-03 – Omega 6:3-Verhältnis
**Erwartetes Ergebnis:** Anzeige im Format `X.X : 1` mit Ziel `max. 6 : 1`

### T-RECHN-06 – EPA+DHA-Namenskonvention (**NEU v1.0.0**)
**Hintergrund:** Die App summiert Omega-3 als `α-Linolensäure` + `EPA + DHA` (kombinierter Eintrag). Separate Einträge `EPA` und `DHA` werden **nicht** erkannt.

**Schritte:**
1. Sheet `Bedarf` öffnen → prüfen ob Nährstoff exakt `EPA + DHA` heißt (nicht `EPA` + `DHA` getrennt)
2. Sheet `Zutaten_Naehrstoffe` für eine Zutat mit EPA/DHA-Gehalt prüfen → gleiche Schreibweise sicherstellen
3. Rechner → Rezept mit einer EPA/DHA-haltigen Zutat (z.B. Algenöl, Lachsöl) öffnen

**Erwartetes Ergebnis:**
- Omega 6:3-Verhältnis wird als `X.X : 1` angezeigt (nicht als `–`)
- Wenn `–` angezeigt wird: Nährstoffname im Sheet auf exakt `EPA + DHA` korrigieren

### T-RECHN-04 – Skalierungsfaktor
**Schritte:**
1. Rezept öffnen
2. Skalierungsfaktor auf 0.5 setzen

**Erwartetes Ergebnis:** Alle Gramm-Werte halbiert, Kcal halbiert

### T-RECHN-05 – NaN-Schutz bei fehlendem Gewicht
**Schritte:**
1. Gewichtsfeld leeren
2. Rechner neu berechnen

**Erwartetes Ergebnis:** Fallback auf 27kg, keine NaN-Anzeigen

---

## Modul 3: Tagebuch – Futter (tagebuch.js)

### T-TAG-FUTTER-01 – Kcal-Konsistenz Rechner ↔ Tagebuch (**BUGFIX v1.0.0**)
**Schritte:**
1. Rezept im Rechner berechnen → Kcal notieren (Referenzwert)
2. Gleiches Rezept im Tagebuch → Futter-Eintrag anlegen mit identischem Gewicht
3. Tagebuch-Eintrag gespeicherter Kcal-Wert prüfen

**Erwartetes Ergebnis:**
- Kcal im Tagebuch entspricht dem Kcal-Wert aus dem Rechner (±5%)
- **NICHT** 25% weniger als Rechner (alter Bug: fakt=0.75 auf Makros)

### T-TAG-FUTTER-02 – Multi-Futter mit zwei Rezepten
**Schritte:**
1. Tagebuch → Futter → „+ Futter / Rezept hinzufügen"
2. Rezept 1 auswählen (z.B. Hauptmahlzeit)
3. Gramm eingeben
4. Zweites Futter hinzufügen (z.B. Leckerlies)
5. Speichern

**Erwartetes Ergebnis:**
- Gesamt-Kcal = Summe beider Positionen
- Gesamt-Gramm korrekt
- Tagebuch-Text enthält „Futter 1: …" und „Futter 2: …"

### T-TAG-FUTTER-03 – Portionen-Auswahl (**NEU v1.0.0**)
**Schritte:**
1. Tagebuch → Futter → Rezept auswählen (z.B. 469g Basis-Rezept)
2. Portionen-Eingabe auf 0.5 setzen

**Erwartetes Ergebnis:**
- Gramm-Feld wechselt automatisch auf 234–235g (0.5 × 469g)
- Kcal entsprechend reduziert
- Portionen-Feld zeigt 0.5

**Schritte (manuelle Gramm-Override):**
1. Nach Portionen=0.5 → Gramm-Feld manuell auf 300g setzen
2. `futterItemGrammChanged` triggern

**Erwartetes Ergebnis:** Gramm-Wert ist 300g (manuell überschrieben), Kcal wird neu auf Basis 300g berechnet

### T-TAG-FUTTER-04 – Speichern Futter-Eintrag
**Schritte:**
1. Futter-Eintrag mit Rezept + Gramm anlegen → Speichern
2. Tagebuch-Ansicht → Aktualisieren

**Erwartetes Ergebnis:**
- Eintrag erscheint mit Datum, Gesamt-Gramm, Gesamt-Kcal
- Komponentenaufschlüsselung sichtbar

---

## Modul 4: Ausschlussdiät (tagebuch.js / ansicht.js)

### T-AUSSCHL-01 – Verdacht-Skala 0–3 (**NEU v1.0.0**)
**Schritte:**
1. Tagebuch → Ausschlussdiät
2. Zutat eingeben (z.B. „Rind")
3. Verdacht-Stufen alle vier testen: 0, 1, 2, 3

**Erwartetes Ergebnis:**
- Vier Buttons sichtbar: „0 – Sicher", „1 – Leichter Verdacht", „2 – Mittlere Reaktion", „3 – Starke Reaktion"
- Auswahl wird korrekt gespeichert (Spalte B = verdacht im Sheet)
- Zweimal klicken hebt Auswahl auf

### T-AUSSCHL-02 – Kein Übersichts-Block in Ansicht (**ENTFERNT v1.0.0**)
**Schritte:**
1. Tagebuch → Ansicht → 📋 Ausschl. → Aktualisieren

**Erwartetes Ergebnis:**
- Kein Badge-Übersichts-Block oberhalb der Einträge
- Direkt: „Alle Einträge (N)"-Divider, dann Entry-Cards

### T-AUSSCHL-03 – Edit-Modal mit Verdacht-Dropdown (**NEU v1.0.0**)
**Schritte:**
1. Ausschluss-Eintrag in Ansicht öffnen
2. ✏️ Edit-Button tippen

**Erwartetes Ergebnis:**
- Edit-Modal zeigt Dropdown für „Verdacht / Reaktion" mit Optionen 0–3
- Bestehender Wert ist vorausgewählt
- Nach Speichern ist der neue Wert im Sheet aktualisiert

### T-AUSSCHL-04 – Anzeige Verdacht-Badge in Entry-Card
**Erwartetes Ergebnis:**
- Stufe 0: grünes Badge „✅ Sicher"
- Stufe 1: gelbes Badge „🟡 Leichter Verdacht"
- Stufe 2: gelbes Badge „🟠 Mittlere Reaktion"
- Stufe 3: rotes Badge „🔴 Starke Reaktion"

### T-AUSSCHL-05 – Soft-Delete Ausschluss-Eintrag
**Schritte:**
1. Ausschluss-Eintrag in Ansicht öffnen
2. 🗑️ Löschen → bestätigen

**Erwartetes Ergebnis:**
- Eintrag verschwindet aus der Liste
- Undo-Banner erscheint
- Im Sheet: deleted=TRUE, deleted_at gesetzt

---

## Modul 5: Stammdaten (stammdaten.js)

### T-STAMM-01 – Zutat anlegen
**Schritte:**
1. Stammdaten → Zutaten → Neue Zutat
2. Name + Kategorie eingeben
3. Nährstoffwerte aufklappen, 2–3 Werte eintragen
4. Speichern

**Erwartetes Ergebnis:**
- Zutat erscheint in der Liste
- Nährstoffwerte in `Zutaten_Naehrstoffe` gespeichert

### T-STAMM-02 – Kcal-Bedarf manuell
**Schritte:**
1. Stammdaten → Hunde → Hund bearbeiten
2. Kcal-Bedarf manuell auf 1200 setzen

**Erwartetes Ergebnis:**
- Rechner zeigt Bedarf = 1200 kcal (RER-Berechnung deaktiviert)

---

## Modul 6: Wetter & Pollen (wetter.js)

### T-WETTER-01 – Pollen-Skala 0–5
**Schritte:**
1. Umwelt-Tab → Wetter laden

**Erwartetes Ergebnis:** Pollen-Werte sind ganzzahlig 0–5

### T-WETTER-02 – Custom-Pollen anlegen
**Schritte:**
1. Wetter-Tab → Pollen-Manager öffnen
2. Neuen Pollen-Typ hinzufügen (z.B. „Schimmelpilz")

**Erwartetes Ergebnis:**
- Erscheint im Pollen-Selector
- In `localStorage['hundapp_custom_pollen']` gespeichert

---

## Modul 7: Statistik (statistik.js)

### T-STAT-01 – Symptom-Flächenband rot
**Erwartetes Ergebnis:** Schweregrad-Linie ist rotes gefülltes Flächenband (area-Chart)

### T-STAT-02 – Pollen-Popup
**Schritte:**
1. Statistik → „🌿 Pollen (X/Y)"-Button tippen

**Erwartetes Ergebnis:** Bottom-Sheet öffnet sich mit allen Pollen-Typen, Alle/Keine-Buttons, Übernehmen-Button

### T-STAT-03 – Ausschlussdiät-Liste in Statistik
**Voraussetzung:** Ausschlussdiät-Einträge für den Hund vorhanden

**Erwartetes Ergebnis:** Box mit Ausschluss-Einträgen erscheint, mit Status-Badges

---

## Modul 8: Soft-Delete & Undo (ansicht.js)

### T-UNDO-01 – Undo nach Löschen
**Schritte:**
1. Beliebigen Eintrag löschen
2. Undo-Banner-Button tippen

**Erwartetes Ergebnis:** Eintrag wieder sichtbar, deleted=FALSE im Sheet

### T-UNDO-02 – Undo-Stack max. 10
**Schritte:**
1. 11 Einträge nacheinander löschen

**Erwartetes Ergebnis:** Ältester Undo-Eintrag wird verworfen (kein Absturz)

---

## Modul 9: Sheets-Setup (config.js / sheets.js)

### T-SETUP-01 – Neue Sheets anlegen
**Schritte:**
1. Einstellungen → „Neue Sheets anlegen"

**Erwartetes Ergebnis:**
- Alle fehlenden Sheets werden angelegt (Rezept_Komponenten, Translations, Hund_Gewicht, Pollen_Log)
- Keine Duplikate bei vorhandenen Sheets

---

### T-IMPORT-07 – Bugfix: Neue Zutat mit Nährwerten speichern
**Schritte:**
1. Stammdaten → Zutaten → Neue Zutat
2. Name eingeben
3. Nährstoff-Abschnitt aufklappen → mind. 1 Wert eintragen
4. Speichern

**Erwartetes Ergebnis:** Kein Fehler „newId is not defined". Zutat und Nährwerte werden korrekt gespeichert.

### T-IMPORT-08 – Parallele Suche USDA + OFF
**Schritte:**
1. Zutat-Modal öffnen → Import-Abschnitt aufklappen
2. Suchbegriff eingeben → Suchen

**Erwartetes Ergebnis:**
- Zwei Spalten werden gleichzeitig befüllt (USDA links blau, OFF rechts grün)
- Fehler in einer Quelle (z.B. kein USDA-Key) blockieren die andere nicht
- Status zeigt „X USDA · Y OFF Treffer"

### T-IMPORT-09 – Vorschau über Feldern
**Schritte:**
1. Nach Suche ein USDA-Ergebnis antippen → blaue Vorschau erscheint über Feldern
2. Ein OFF-Ergebnis antippen → grüne Vorschau ergänzt sich nebeneinander

**Erwartetes Ergebnis:** Über Feldern mit Werten steht z.B. „USDA: 21.3 | OFF: 20.8". Felder ohne Wert aus keiner Quelle zeigen keine Vorschau.

### T-IMPORT-10 – Keine Überschreibung vorhandener Werte
**Schritte:**
1. Zutat bearbeiten die bereits Rohprotein = 18.0 hat
2. Import-Suche durchführen → Import-Ergebnis auswählen
3. „Leere Felder befüllen" tippen

**Erwartetes Ergebnis:** Rohprotein bleibt bei 18.0. Nur wirklich leere Felder werden befüllt. Status: „X leere Felder befüllt – bestehende Werte unverändert."

### T-CFG-01 – Einstellungen Speichern-Button
**Schritte:**
1. Einstellungen → beliebiges Feld ändern
2. „💾 Einstellungen speichern" tippen

**Erwartetes Ergebnis:** Kurze Meldung „✅ Einstellungen gespeichert!" erscheint und verschwindet nach 2,5s.


## Modul 12: Korrelationsanalyse (statistik.js)

### T-KORR-01 – Sektion nur mit ausreichend Daten
**Schritte:**
1. Hund wählen ohne Umwelt- oder Pollen-Daten im Zeitraum

**Erwartetes Ergebnis:** Kein „🔗 Korrelationsanalyse"-Block sichtbar.

### T-KORR-02 – Standardmäßig eingeklappt
**Voraussetzung:** Ausreichend Daten vorhanden

**Erwartetes Ergebnis:**
- Sektion wird angezeigt, ist aber standardmäßig **eingeklappt** (▶)
- Erst nach Antippen des Headers klappt der Inhalt auf (▼)

### T-KORR-03 – Temperatur-Gruppen korrekt
**Schritte:**
1. Korrelationsanalyse aufklappen → Abschnitt „🌡️ Außentemperatur (Max)" prüfen

**Erwartetes Ergebnis:**
- 4 Zeilen: < 5°C, 5–15°C, 15–25°C, > 25°C
- Anzahl Tage pro Gruppe plausibel (Summe ≈ Anzahl Symptomtage mit Umweltdaten)
- Gruppen mit < 3 Einträgen: „zu wenig Daten"
- Gruppen mit Ø > 2.0: orange hervorgehoben

### T-KORR-04 – Pollen-Gruppen korrekt
**Voraussetzung:** Pollen_Log-Daten für mind. eine Pollenart vorhanden

**Erwartetes Ergebnis:**
- Je Pollenart ein Block mit 4 Gruppen: keine (0), gering (1–2), mittel (3), stark (4–5)
- Korrekte Zuordnung der Pollen-Stufen

### T-KORR-05 – Kein zusätzlicher API-Call
**Schritte:**
1. Netzwerk-Tab im Browser öffnen
2. Statistik laden (↺ Aktualisieren)
3. Korrelationsanalyse aufklappen

**Erwartetes Ergebnis:** Kein neuer API-Request beim Aufklappen – Daten kommen aus bestehendem Cache.


## Modul 11: Symptom-Muster-Heatmap (statistik.js)

### T-MUSTER-01 – Sektion erscheint erst ab 14 Einträgen
**Schritte:**
1. Hund wählen der weniger als 14 Symptomeinträge im Zeitraum hat
2. Statistik-Panel laden

**Erwartetes Ergebnis:** Kein „📅 Symptom-Muster"-Block sichtbar.

### T-MUSTER-02 – Wochentag-Heatmap korrekt
**Voraussetzung:** Mindestens 14 Symptomeinträge vorhanden, darunter mehrere Dienstage mit Schweregrad 3–4

**Schritte:**
1. Statistik-Panel → „📅 Symptom-Muster" ist sichtbar
2. Wochentag-Reihe prüfen

**Erwartetes Ergebnis:**
- 7 Kacheln (Mo bis So) angezeigt
- Kacheln mit <2 Einträgen: grau + „–"
- Kacheln mit Daten: Farbkodierung grün/gelb/orange/rot je nach Ø Schweregrad
- Tooltip (title) enthält: Wochentag · Ø X.X · N Einträge

### T-MUSTER-03 – Monats-Heatmap korrekt
**Erwartetes Ergebnis:**
- 12 Kacheln (Jan–Dez), 2 Spalten mit je 6 Kacheln
- Monate ohne Daten: grau + „–"
- Hinweis unter der Monats-Heatmap: Monat mit höchstem Ø (z.B. „📌 Höchster Ø Schweregrad: Mai")

### T-MUSTER-04 – Ein-/Ausklappen
**Schritte:**
1. Auf „📅 Symptom-Muster" Header tippen

**Erwartetes Ergebnis:** Inhalt klappt ein; Pfeil wechselt von ▼ zu ▶. Erneutes Tippen klappt wieder auf.

### T-MUSTER-05 – Farbskala
**Erwartetes Ergebnis:**
- Ø < 1: sehr helles Grün / neutral
- Ø ≈ 2: grün
- Ø ≈ 3: gelb/amber
- Ø ≈ 4: orange/rot
- Ø ≥ 4.5: kräftiges Rot


## Modul 10: USDA / Open Food Facts Import (stammdaten.js)

### T-IMPORT-01 – USDA Suche mit gültigem Key
**Vorbedingung:** USDA API-Key in Einstellungen eingetragen

**Schritte:**
1. Stammdaten → Zutaten → Neue Zutat
2. „🔍 Nährwerte importieren" aufklappen
3. Quelle: USDA · Suchbegriff: „chicken breast raw"
4. Suchen → Ergebnis antippen

**Erwartetes Ergebnis:**
- Ergebnisliste mit bis zu 8 Treffern erscheint
- Nach Antippen werden Nährstoff-Inputs befüllt (z.B. Rohprotein, Rohfett)
- Nährstoff-Abschnitt öffnet sich automatisch
- Statusmeldung: „X Nährstoffe übernommen"

### T-IMPORT-02 – USDA ohne API-Key
**Schritte:**
1. USDA API-Key in Einstellungen leer lassen
2. Zutat-Modal → Import-Abschnitt → Suchen

**Erwartetes Ergebnis:**
- Fehlermeldung: „USDA API-Key fehlt. Bitte in Einstellungen eintragen."
- Kein API-Call wird gemacht

### T-IMPORT-03 – Open Food Facts Suche (ohne Key)
**Schritte:**
1. Quelle auf „Open Food Facts" wechseln
2. Suchbegriff: „Rindfleisch"
3. Suchen → Ergebnis antippen

**Erwartetes Ergebnis:**
- Ergebnisse erscheinen ohne API-Key
- Nährstoffe werden in Inputs übernommen
- Manuelle Anpassung danach möglich

### T-IMPORT-04 – EPA + DHA Zusammenführung (USDA)
**Schritte:**
1. USDA Suche nach „salmon raw"
2. Ergebnis übernehmen

**Erwartetes Ergebnis:**
- Nährstoff-Input für „EPA + DHA" ist befüllt (Summe aus EPA + DHA)
- Kein separater EPA- oder DHA-Input bleibt leer durch falsche Zuweisung

### T-IMPORT-05 – Doppeltes Einstellungs-Symbol
**Schritte:**
1. App öffnen → Top-Navigation prüfen

**Erwartetes Ergebnis:**
- Einstellungs-Button zeigt genau einmal „⚙️ Einst." – kein doppeltes Symbol

### T-IMPORT-06 – Statistik ohne Bekannte Allergene / Ausschlussdiät
**Schritte:**
1. Statistik-Panel öffnen

**Erwartetes Ergebnis:**
- Kein „⚠️ Bekannte Allergene"-Block sichtbar
- Kein „🍽️ Ausschlussdiät"-Block sichtbar
- Futter-Reaktionen und Medikamente weiterhin sichtbar
- Chart + KPIs unverändert funktional


## Regressionstests nach v1.3.1

Folgende Tests müssen nach jedem Release mindestens einmal durchgeführt werden:

1. T-TAG-FUTTER-01 (Kcal-Konsistenz)
2. T-TAG-FUTTER-03 (Portionen)
3. T-AUSSCHL-01 (Verdacht 0–3)
4. T-AUSSCHL-02 (Kein Übersichts-Block)
5. T-AUSSCHL-03 (Edit-Modal)
6. T-UNDO-01 (Undo)
7. T-AUTH-02 (Token-Ablauf)
8. T-RECHN-02 (Ca:P-Verhältnis)
9. T-RECHN-06 (EPA+DHA-Namenskonvention – Sheet-Prüfung)

---

## Bekannte Einschränkungen / Out-of-Scope

- Kein automatisiertes Test-Framework (kein Jest/Vitest) – alle Tests sind manuell
- Google Sheets API-Calls können nicht ohne gültigen OAuth-Token getestet werden
- Offline-Verhalten (kein Service Worker) nicht validiert
- Keine Browser-Kompatibilitätstests (Zielplattform: Mobile Chrome/Safari)
