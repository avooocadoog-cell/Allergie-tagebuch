# Hund Manager – Softwarevalidierung (v2.5)

> **Zweck:** Manuelle und automatisierte Testszenarien zur Verifikation aller implementierten Features.
> Letzte Aktualisierung: 2026-03-29
> Version: v2.5

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

### T-TAG-FUTTER-01 – Kcal-Konsistenz Rechner ↔ Tagebuch (**BUGFIX v2.5**)
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

### T-TAG-FUTTER-03 – Portionen-Auswahl (**NEU v2.5**)
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

### T-AUSSCHL-01 – Verdacht-Skala 0–3 (**NEU v2.5**)
**Schritte:**
1. Tagebuch → Ausschlussdiät
2. Zutat eingeben (z.B. „Rind")
3. Verdacht-Stufen alle vier testen: 0, 1, 2, 3

**Erwartetes Ergebnis:**
- Vier Buttons sichtbar: „0 – Sicher", „1 – Leichter Verdacht", „2 – Mittlere Reaktion", „3 – Starke Reaktion"
- Auswahl wird korrekt gespeichert (Spalte B = verdacht im Sheet)
- Zweimal klicken hebt Auswahl auf

### T-AUSSCHL-02 – Kein Übersichts-Block in Ansicht (**ENTFERNT v2.5**)
**Schritte:**
1. Tagebuch → Ansicht → 📋 Ausschl. → Aktualisieren

**Erwartetes Ergebnis:**
- Kein Badge-Übersichts-Block oberhalb der Einträge
- Direkt: „Alle Einträge (N)"-Divider, dann Entry-Cards

### T-AUSSCHL-03 – Edit-Modal mit Verdacht-Dropdown (**NEU v2.5**)
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

## Regressionstests nach v2.5

Folgende Tests müssen nach jedem Release mindestens einmal durchgeführt werden:

1. T-TAG-FUTTER-01 (Kcal-Konsistenz)
2. T-TAG-FUTTER-03 (Portionen)
3. T-AUSSCHL-01 (Verdacht 0–3)
4. T-AUSSCHL-02 (Kein Übersichts-Block)
5. T-AUSSCHL-03 (Edit-Modal)
6. T-UNDO-01 (Undo)
7. T-AUTH-02 (Token-Ablauf)

---

## Bekannte Einschränkungen / Out-of-Scope

- Kein automatisiertes Test-Framework (kein Jest/Vitest) – alle Tests sind manuell
- Google Sheets API-Calls können nicht ohne gültigen OAuth-Token getestet werden
- Offline-Verhalten (kein Service Worker) nicht validiert
- Keine Browser-Kompatibilitätstests (Zielplattform: Mobile Chrome/Safari)
