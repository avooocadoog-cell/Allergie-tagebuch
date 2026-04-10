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

---

## Tests v1.4.0 – Bugfixes & Reaktionsscore

### T-STORE-01 – Nährwert-Dezimalstellen (Komma-Separator)
**Schritte:**
1. Google Sheet `Zutaten_Naehrstoffe` enthält Einträge mit Komma als Dezimaltrennzeichen (z.B. „0,5")
2. App laden → Stammdaten → Zutat bearbeiten → Nährwert-Abschnitt öffnen

**Erwartetes Ergebnis:**
- Nährwert-Felder zeigen korrekte Dezimalwerte (z.B. 0.5), nicht 0
- Futterrechner berechnet Nährwerte korrekt (nicht als 0)

**Regression-Check:** Werte mit Punkt als Trennzeichen (z.B. „0.5") funktionieren weiterhin korrekt.

---

### T-RECHN-07 – Rezept-Mix: Auswahl bleibt erhalten
**Schritte:**
1. Futterrechner öffnen → Rezept öffnen oder neu anlegen
2. Akkordeon-Sektion „Rezept mischen" öffnen (auf Header klicken)
3. Rezept aus Dropdown wählen

**Erwartetes Ergebnis:**
- Dropdown zeigt alle verfügbaren Rezepte nach dem Öffnen der Sektion
- Gewähltes Rezept bleibt nach der Auswahl sichtbar (kein automatisches Zurücksetzen)
- Gramm-Eingabe und „+ Einmischen"-Button funktionieren

**Negativtest:** Dropdown NICHT öffnen, wenn man nur auf den Pfeiltoggle klickt – initMixSelect wird immer beim Toggle aufgerufen.

---

### T-RECHN-08 – Kein Doppel-Speichern von Zutaten
**Schritte:**
1. Futterrechner → Rezept anlegen oder öffnen mit 2–3 Zutaten
2. Rezept speichern (Button „💾 Rezept speichern")
3. Eine Zutat ändern oder Gramm-Wert anpassen
4. Rezept erneut speichern

**Erwartetes Ergebnis:**
- Sheet `Rezept_Zutaten` enthält für das Rezept genau N Zeilen (N = Anzahl Zutaten), nicht 2N oder 3N
- Beim Öffnen des Rezepts erscheinen keine doppelten Zutaten
- Leere Zeilen (durch das Glätten) werden beim Laden herausgefiltert

**Regression-Check:** Neues Rezept (noch nicht gespeichert) → erstes Speichern funktioniert weiterhin.

---

### T-STAT-REAK-01 – Reaktionsscore: Grundfunktion
**Vorbedingung:** Mind. 5 Futtereinträge im gewählten Zeitraum, mind. 3 Symptomeinträge mit Schweregrad > 2

**Schritte:**
1. Statistik-Panel öffnen → Hund + Zeitraum wählen
2. Sektion „🧪 Zutaten-Reaktionsscore" suchen und aufklappen

**Erwartetes Ergebnis:**
- Sektion erscheint zwischen Korrelationsanalyse und Futter-Reaktionen
- Score-Balken mit Prozentwert pro Zutat
- Farben: grün < 20%, gelb < 50%, rot ≥ 50%
- Hinweis-Box: „Statistischer Hinweis – kein medizinischer Befund"

---

### T-STAT-REAK-02 – Reaktionsscore: Filter-Chips
**Schritte:**
1. Reaktionsscore-Sektion öffnen
2. Button „Keine" klicken
3. Button „Alle" klicken
4. Einzelne Zutat-Chip an- und abwählen

**Erwartetes Ergebnis:**
- „Keine": Alle Chips deselektiert, Anzeige zeigt „Keine Zutaten ausgewählt"
- „Alle": Alle Chips selektiert, alle Zutaten sichtbar
- Einzelner Chip: Toggle zwischen blau (selektiert) / grau (deselektiert)
- Sektion bleibt nach Chip-Klick aufgeklappt

---

### T-STAT-REAK-03 – Reaktionsscore: Mindestanzahl
**Vorbedingung:** Futtertagebuch mit < 5 Einträgen oder alle Zutaten < 3 Vorkommen

**Erwartetes Ergebnis:**
- Sektion wird nicht angezeigt (kein leerer Container)

---

### T-STAT-REAK-04 – Reaktionsscore: Freitext-Parsing
**Schritte:**
1. Futtertagebuch → Futter-Eintrag anlegen mit mehreren Zutaten, Komma-getrennt (z.B. „Pferd, Zucchini, Lachsöl")

**Erwartetes Ergebnis:**
- Jede Zutat erscheint separat im Reaktionsscore (wenn mind. 3 Einträge vorhanden)
- Leerzeichen werden korrekt getrimmt

---

## Regressionstests nach v1.4.0

Folgende Tests müssen nach jedem Release mindestens einmal durchgeführt werden:

1. T-STORE-01 (Dezimal-Nachkommastellen)
2. T-RECHN-07 (Rezept-Mix Auswahl)
3. T-RECHN-08 (Kein Doppel-Speichern)
4. T-STAT-REAK-01 (Reaktionsscore Grundfunktion)
5. T-STAT-REAK-02 (Filter-Chips)
6. T-TAG-FUTTER-01 (Kcal-Konsistenz)
7. T-UNDO-01 (Undo)
8. T-RECHN-02 (Ca:P-Verhältnis)
9. T-RECHN-06 (EPA+DHA-Namenskonvention)

---

## Tests v1.5.0 – Phasentracker

### T-PHAS-01 – Sheet anlegen
**Schritte:**
1. Einstellungen → „⚙️ Neue Sheets anlegen" tippen

**Erwartetes Ergebnis:**
- Meldung „Ausschluss_Phasen" angelegt oder bereits vorhanden
- Sheet erscheint im Tagebuch-Spreadsheet mit 2 Header-Zeilen (DE + snake_case) und 11 Spalten

---

### T-PHAS-02 – Phase anlegen
**Schritte:**
1. Tagebuch → Tab „📅 Phasen"
2. Phasentyp „Elimination" wählen → Enddatum-Vorschlag prüfen (+42 Tage)
3. Phasentyp „Provokation" wählen → Zutat-Feld erscheint + Enddatum +14 Tage
4. Startdatum ändern → Enddatum passt sich automatisch an
5. Pflichtfelder ausfüllen → „📅 Phase speichern"

**Erwartetes Ergebnis:**
- Zutat-Feld nur bei Provokation sichtbar
- Enddatum-Vorschlag je Typ korrekt
- Zeile in `Ausschluss_Phasen` mit `deleted=FALSE`
- Statusmeldung „✓ Phase gespeichert!"

---

### T-PHAS-03 – Aktiver-Phase-Banner
**Vorbedingung:** Phase mit Ergebnis=„offen" und Enddatum in der Zukunft vorhanden

**Erwartetes Ergebnis:**
- Farbiger Banner mit Phasentyp-Label (blau/gelb/grün)
- Fortschrittsbalken zeigt verstrichene vs. Gesamtdauer
- „noch X Tage" korrekt berechnet
- Letzter abgeschlossener Phasenstatus (falls vorhanden) unterhalb angezeigt

**Negativtest:** Enddatum in der Vergangenheit oder Ergebnis ≠ „offen" → kein Banner

---

### T-PHAS-04 – Soft-Delete + Undo
**Schritte:**
1. Phase in der Phasenliste über 🗑 löschen
2. Undo-Banner erscheint → „↺ Rückgängig" tippen

**Erwartetes Ergebnis:**
- Phase verschwindet aus der Liste
- Sheet: `deleted=TRUE`, `deleted_at` gesetzt
- Nach Undo: Phase wieder sichtbar, `deleted=FALSE`, `deleted_at` leer
- Undo-Banner verschwindet nach 8 Sekunden automatisch

---

### T-PHAS-05 – Phasen-Timeline in Statistik
**Vorbedingung:** Mind. 1 Phase für den gewählten Hund vorhanden

**Schritte:**
1. Statistik-Panel → Hund wählen
2. Sektion „📅 Phasen-Timeline" suchen und aufklappen

**Erwartetes Ergebnis:**
- Sektion erscheint zwischen Reaktionsscore-Sektion und Futter-Reaktionen
- Alle Phasen des Hundes chronologisch (neueste zuerst)
- Typ-Badge (blau/gelb/grün) + Ergebnis-Badge korrekt
- Gelöschte Phasen werden nicht angezeigt

---

### T-PHAS-06 – Validierung Pflichtfelder
**Schritte:**
1. Formular ohne Phasentyp speichern
2. Formular ohne Startdatum speichern
3. Provokation ohne Zutat speichern

**Erwartetes Ergebnis:**
- Fehlermeldung bei fehlendem Phasentyp: „Bitte Phasentyp wählen."
- Fehlermeldung bei fehlendem Startdatum: „Bitte Startdatum angeben."
- Fehlermeldung bei fehlender Zutat (Provokation): „Bitte Zutat für Provokation angeben."

---

## Tests v1.6.0 – Tierarzt-PDF-Export

### T-EXPORT-01 – Dialog öffnen
**Schritte:**
1. Statistik-Panel öffnen → Hund wählen
2. Button „📄 Tierarzt-Export" oben rechts tippen

**Erwartetes Ergebnis:**
- Modal-Dialog öffnet sich mit 4 Zeitraum-Buttons (30 / 60 / 90 / 180 Tage)
- Standard „90 Tage" ist vorausgewählt (blau hervorgehoben)
- „✕"-Button schließt Dialog ohne Export

---

### T-EXPORT-02 – Zeitraum wählen
**Schritte:**
1. Dialog öffnen → „30 Tage" auswählen → anderen Button wählen

**Erwartetes Ergebnis:**
- Nur ein Button aktiv (blau) – vorherige Auswahl wird deselektiert
- Ausgewählter Zeitraum wird beim Export übergeben

---

### T-EXPORT-03 – Bericht erstellen
**Vorbedingung:** Popup-Erlaubnis im Browser erteilt, mind. ein Datensatz vorhanden

**Schritte:**
1. Dialog → Zeitraum wählen → „Bericht erstellen & drucken"

**Erwartetes Ergebnis:**
- Neuer Browser-Tab öffnet sich mit vollständigem HTML-Bericht
- Druckdialog startet automatisch
- Bericht enthält: Deckblatt, Symptomtabelle, Allergene, Ausschlussdiät, Medikamente, Futtereinträge
- Disclaimer und Footer mit Exportdatum vorhanden

---

### T-EXPORT-04 – Leere Sektionen
**Vorbedingung:** Hund ohne Symptome oder Medikamente

**Erwartetes Ergebnis:**
- Leere Sektionen zeigen „Keine … erfasst." in kursiv
- Keine JavaScript-Fehler, Bericht wird trotzdem vollständig erstellt

---

### T-EXPORT-05 – Popup blockiert
**Schritte:**
1. Popups im Browser blockieren → Export versuchen

**Erwartetes Ergebnis:**
- Alert-Meldung: „Popup wurde blockiert. Bitte Popups für diese Seite erlauben…"
- Export-Button wird wieder aktiviert

---

### T-EXPORT-06 – Deckblatt-Daten
**Erwartetes Ergebnis:**
- Name, Rasse, Geschlecht, Geburtsdatum korrekt aus Stammdaten
- Letztes Gewicht mit Datum (aus Hund_Gewicht)
- Gewählter Zeitraum und Exportdatum korrekt

---

## Tests v1.7.0 – Rezept-Nährstoffvergleich

### T-CMP-01 – Panel öffnen
**Schritte:**
1. Futterrechner → Rezeptliste → Button „⚖️ Vergleich" tippen

**Erwartetes Ergebnis:**
- Rezeptliste verschwindet, Vergleichs-Panel erscheint
- Beide Dropdowns gefüllt mit Rezepten des aktuellen Hundes
- Gewichtsfeld übernimmt Wert aus Hauptrechner
- „← Zurück" führt zur Rezeptliste

---

### T-CMP-02 – Validierung: gleiche Rezepte
**Schritte:**
1. Beide Dropdowns auf dasselbe Rezept setzen → „Vergleichen"

**Erwartetes Ergebnis:**
- Fehlermeldung: „Bitte zwei verschiedene Rezepte wählen."
- Kein Absturz, kein leeres Ergebnis

---

### T-CMP-03 – Vergleich berechnen
**Vorbedingung:** Zwei Rezepte mit Nährwert-Daten vorhanden

**Schritte:**
1. Rezept A und B wählen → optional Gramm eintragen → „Vergleichen"

**Erwartetes Ergebnis:**
- Kennzahlen-Header: Gesamtmenge, Kcal, Ca:P, Omega 6:3 für beide Rezepte nebeneinander
- Ca:P und Omega 6:3 mit Ampel-Badge (ok/warn)
- Alle 39 Nährstoffe in Gruppenstruktur
- Ampelfarben korrekt (grün=ok, gelb=zu niedrig, orange=zu hoch)
- Delta-Spalte: Differenz A–B in %, farbcodiert

---

### T-CMP-04 – Gramm-Eingabe
**Schritte:**
1. Gramm-Felder für A und B unterschiedlich befüllen → Vergleichen

**Erwartetes Ergebnis:**
- Nährstoffe skalieren entsprechend der eingegebenen Grammzahl
- Gesamtmenge in Kennzahlen korrekt

---

### T-CMP-05 – Rezepte ohne Nährwerte
**Vorbedingung:** Rezept mit Zutaten ohne Nährwert-Einträge

**Erwartetes Ergebnis:**
- Nährstoffe dieser Zutat werden als 0 dargestellt
- Kein JavaScript-Fehler
- Delta-Spalte zeigt „–" wenn kein Bedarf definiert

---

## Tests v1.8.0 – Mehrere Hunde Statistik-Vergleich

### T-H2-01 – Zweites Dropdown befüllt
**Vorbedingung:** Mind. 2 Hunde im System

**Schritte:**
1. Statistik-Panel öffnen
2. „↕ Vergleich mit:"-Dropdown prüfen

**Erwartetes Ergebnis:**
- Dropdown enthält alle Hunde außer dem aktuell gewählten Hund 1
- Standard-Option „– kein Vergleich –" ist vorausgewählt
- Bei Wechsel von Hund 1 verschwindet der neue Hund 1 aus der Vergleichsliste

---

### T-H2-02 – Vergleichsband erscheint
**Vorbedingung:** Parameter „Schweregrad Symptome" aktiv, Hund 2 hat Symptomeinträge im Zeitraum

**Schritte:**
1. Hund 2 wählen → Chart prüfen

**Erwartetes Ergebnis:**
- Blaues Flächenband (rgba 59,130,246) für Hund 2 im Chart sichtbar
- Legende zeigt „🔵 [Hund-2-Name] (Schweregrad)" zusätzlich
- Rotes Band von Hund 1 bleibt unverändert

---

### T-H2-03 – Kein Vergleich = kein zweites Dataset
**Schritte:**
1. Hund 2 wählen → zurück auf „– kein Vergleich –" setzen

**Erwartetes Ergebnis:**
- Blaues Band verschwindet sofort
- Chart enthält nur noch Hund-1-Daten
- Kein Performanceproblem / kein unnötiger API-Call

---

### T-H2-04 – Nur ein Hund im System
**Vorbedingung:** Nur ein Hund angelegt

**Erwartetes Ergebnis:**
- „↕ Vergleich mit:"-Dropdown zeigt nur „– kein Vergleich –"
- Kein Fehler, normale Statistik-Funktion unberührt

---

### T-H2-05 – Hund 2 ohne Symptome im Zeitraum
**Vorbedingung:** Hund 2 hat keine Symptomeinträge im gewählten Zeitraum

**Erwartetes Ergebnis:**
- Kein blaues Band (leeres Dataset)
- Kein JavaScript-Fehler
- KPI-Kacheln zeigen weiterhin Hund-1-Daten
