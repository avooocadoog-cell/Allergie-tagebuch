# Hund Manager – FAQ (v1.3.1)

> Letzte Aktualisierung: 2026-04-04

---

## 🔑 Einrichtung & Login

**Q: Wie melde ich mich an?**
A: Öffne die App → Einstellungen → „Mit Google anmelden". Du benötigst ein Google-Konto mit Zugriff auf Google Sheets.

**Q: Was muss ich in den Einstellungen eintragen?**
A: Mindestens:
- **Stammdaten-Spreadsheet-ID** (aus der URL deines Google Sheets: `.../spreadsheets/d/DIESE_ID/...`)
- **Tagebuch-Spreadsheet-ID** (zweites Sheet für Tageseinträge)
- **Breitengrad & Längengrad** für automatischen Wetter-Abruf
- **DWD-Pollen-Region** (1–18, für deutsche Regionen)

**Q: Woher bekomme ich die Spreadsheet-ID?**
A: Öffne das Google Sheet in deinem Browser. Die ID steht in der URL zwischen `/d/` und `/edit`.

**Q: Warum erscheint der Login-Screen immer wieder?**
A: Der OAuth2-Token läuft nach ~1 Stunde ab. Beim nächsten Laden der App wird er automatisch erneuert. Falls das nicht klappt, einmal abmelden und neu anmelden.

---

## 📋 Google Sheets Struktur

**Q: Welche Sheets muss ich anlegen?**
A: Nach dem Login kannst du in den Einstellungen auf „Neue Sheets anlegen" klicken. Die App erstellt automatisch alle benötigten Sheets inkl. Kopfzeilen.

**Q: Was bedeuten die zwei Header-Zeilen?**
A: Zeile 1 = Anzeige-Header (deutsch, für dich lesbar). Zeile 2 = API-Header (englisch/snake_case, für die App). Daten beginnen ab Zeile 3.

**Q: Kann ich die Sheets manuell bearbeiten?**
A: Ja, aber nur ab Zeile 3. Zeilen 1–2 (Header) nicht verändern. Neue Spalten immer ans Ende anhängen.

**Q: Warum gibt es zwei separate Spreadsheets?**
A: `Hund_Stammdaten` enthält unveränderliche Grunddaten (Hunde, Zutaten, Nährstoffe, Rezepte). `Hund_Tagebuch` enthält täglich wachsende Einträge. Getrennt für bessere Performance und Übersichtlichkeit.

---

## 🐕 Hunde & Gewicht

**Q: Wie trage ich ein Gewicht ein?**
A: Stammdaten → Hunde → „⚖️ Gewicht" beim jeweiligen Hund. Das Gewicht wird in der Statistik als Verlaufskurve angezeigt.

**Q: Kann ich den Kalorienbedarf manuell festlegen?**
A: Ja. Stammdaten → Hund bearbeiten → Feld „⚡ Kcal-Bedarf/Tag". Leer lassen = App berechnet automatisch (RER × Faktor). Ein eingetragener Wert überschreibt die Berechnung komplett.

**Q: Wie wird der Kalorienbedarf automatisch berechnet?**
A: `Kcal = 70 × (Gewicht in kg)^0.75 × RER-Faktor`. Den RER-Faktor kannst du in den Parametern anpassen (Standard: 1.6).

---

## 🥩 Zutaten & Nährstoffe

**Q: Wie gebe ich Nährwerte für eine Zutat ein?**
A: Stammdaten → Zutaten → Zutat anlegen oder bearbeiten → Abschnitt „🧪 Nährwerte pro 100g Frischgewicht" aufklappen. Alle 39 NRC-Nährstoffe können direkt eingetragen werden.

**Q: Was passiert wenn ich ein Nährstoff-Feld leer lasse?**
A: Der Wert wird nicht gespeichert und gilt als „nicht erfasst". Im Futterrechner erscheint dieser Nährstoff dann als 0 (roter Balken, wenn ein Bedarfswert hinterlegt ist).

**Q: Kann ich Nährwerte nachträglich ändern?**
A: Ja. Zutat bearbeiten → Nährwert-Abschnitt öffnen → Wert ändern → Speichern. Bestehende Werte werden beim Öffnen automatisch geladen.

**Q: Wie werden Kochverluste berechnet?**
A: Wenn eine Zutat im Rezept als „gekocht" markiert ist, wird ein pauschaler Faktor von 0.75 auf alle Nährwerte angewendet.

---

## 🧮 Futterrechner

**Q: Was ist Rezept-Mixing?**
A: Ein Rezept kann aus anderen Rezepten zusammengesetzt werden (z.B. „Wochenmix = 60% Rezept A + 40% Rezept B"). Die Nährstoffe werden rekursiv aufgelöst (max. 5 Ebenen tief).

**Q: Was bedeuten die Balkenfarben bei Nährstoffen?**
A: Grün = ok (80–150% des Bedarfs), Gelb = zu wenig (<80%), Orange = zu viel (>150%), Rot = gar nicht vorhanden (0%).

**Q: Was ist die grüne Markierungslinie im Balken?**
A: Das ist der `recommended_pct`-Wert aus den Toleranzen – die persönliche Empfehlung. Einstellbar unter Stammdaten → Toleranzen.

**Q: Wie stelle ich individuelle Toleranzen ein?**
A: Stammdaten → Tab „Toleranzen" → Hund auswählen → Min%, Max%, Empf% je Nährstoff. Standard: Min=80%, Max=150%.

**Q: Warum wird das Omega 6:3-Verhältnis als „–" angezeigt, obwohl EPA/DHA eingetragen sind?**
A: Die App sucht exakt nach dem Nährstoff `EPA + DHA` (kombiniert). Wenn EPA und DHA im Sheet als separate Einträge (`EPA` und `DHA`) gespeichert sind, werden sie in der Verhältnisberechnung nicht erkannt. Bitte sicherstellen, dass der kombinierte Eintrag im Sheet `Bedarf` und in `Zutaten_Naehrstoffe` exakt `EPA + DHA` heißt.

**Q: Was gilt als „Kochverlust" – werden alle Nährstoffe reduziert?**
A: Nein. Der Kochverlust gilt **ausschließlich für B-Vitamine** (B1, B2, B3, B5, B6, B9, B12). Protein, Fett und alle anderen Nährstoffe werden nicht reduziert – die Kcal-Berechnung basiert daher auf den vollen Makro-Werten.

---

## 🌾 Nährstoff-Import (USDA / Open Food Facts)

**Q: Wie importiere ich Nährwerte automatisch?**
A: Stammdaten → Zutaten → Zutat anlegen oder bearbeiten → Abschnitt „🔍 Nährwerte importieren" aufklappen → Quelle wählen (USDA oder Open Food Facts) → Suchbegriff eingeben → Ergebnis antippen. Die Nährstoffe werden in die Eingabefelder übernommen.

**Q: Woher bekomme ich einen USDA API-Key?**
A: Kostenlose Registrierung unter [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup). Den Key in Einstellungen → „USDA API-Key" eintragen. Zum schnellen Testen funktioniert auch „DEMO_KEY" (stark limitiert).

**Q: Was ist der Unterschied zwischen USDA und Open Food Facts?**
A: USDA FoodData Central enthält sehr präzise Nährstoffdaten für Rohzutaten (Fleisch, Gemüse, Öle) – erfordert API-Key. Open Food Facts hat einen breiteren Produktkatalog (Fertigprodukte, Marken) und benötigt keinen Key. Für BARF-Zutaten ist USDA in der Regel genauer.

**Q: Werden beim Import vorhandene Nährwerte überschrieben?**
A: Nein. Ab v1.3.1 werden nur leere Felder befüllt. Felder die bereits einen Wert enthalten bleiben unverändert.

**Q: Wie sehe ich USDA und Open Food Facts Werte gleichzeitig?**
A: Nach dem Import-Abruf erscheinen die Werte beider Quellen als kleine Vorschau direkt über jedem Nährstoff-Eingabefeld (blau = USDA, grün = OFF). So kannst du die Quellen vergleichen bevor du auf „Leere Felder befüllen" tippst.

**Q: Kann ich aus USDA und OFF gleichzeitig importieren?**
A: Ja. Wähle je eine Trefferliste aus USDA und eine aus Open Food Facts aus. Beim Befüllen werden leere Felder bevorzugt mit USDA-Werten gefüllt; wo USDA keinen Wert hat, wird der OFF-Wert verwendet.

**Q: Ich sehe den Fehler „newId is not defined" beim Speichern einer Zutat.**
A: Dieser Bug ist in v1.3.1 behoben. Bitte die aktuellen Dateien auf GitHub deployen.

**Q: Werden die Einstellungen automatisch gespeichert?**
A: Ja – jedes Feld speichert beim Tippen automatisch (oninput). Der neue „💾 Einstellungen speichern"-Button bietet zusätzlich eine explizite Speicherbestätigung mit kurzer Meldung.


**Q: Werden alle 39 Nährstoffe importiert?**
A: Nein – nur Nährstoffe die von der jeweiligen API geliefert werden und einem NRC-Nährstoffnamen zugeordnet werden können. Fehlende Felder bleiben leer und können manuell ergänzt werden. EPA und DHA werden automatisch zum kombinierten Eintrag „EPA + DHA" zusammengefasst.

**Q: Kann ich importierte Werte noch anpassen?**
A: Ja. Nach dem Import werden die Werte in die normalen Eingabefelder eingetragen – du kannst sie beliebig ändern, bevor du auf „Speichern" tippst.


## 🌿 Pollen & Wetter

**Q: Warum lädt Wetter/Pollen manchmal nicht?**
A: Die DWD-Daten werden über CORS-Proxies abgerufen. Wenn beide Proxies nicht erreichbar sind, schlägt der Abruf fehl. Open-Meteo funktioniert direkt (kein Proxy nötig).

**Q: Wie füge ich eigene Pollenarten hinzu (z.B. Platane)?**
A: Tagebuch → Umwelt-Tab → Wetter laden → Im Pollen-Selector auf „⚙️ Verwalten" tippen → Neue Pollenart eingeben. Die Pollenart wird in `localStorage` gespeichert und erscheint ab sofort in der Auswahl.

**Q: Wie wähle ich eigene Pollen für den Chart?**
A: Statistik → „🌿 Pollen (X/Y)"-Button → Popup öffnet sich → Pollen auswählen → „Übernehmen". Eigene Pollen erscheinen mit dem Badge „Manuell", Pollen aus dem Pollen_Log mit „Daten".

**Q: Was ist der Unterschied zwischen `pollen` im Umweltagebuch und `Pollen_Log`?**
A: Das `pollen`-Feld im Umweltagebuch ist ein Freitext-Feld (Rückwärtskompatibilität). `Pollen_Log` speichert jede Pollenart als eigene Zeile mit Stärke-Wert und ermöglicht die detaillierte Auswertung in der Statistik.

---

## 📊 Statistik

**Q: Warum sehe ich das rote Band für Symptome im Chart?**
A: Das rote Band zeigt den täglichen maximalen Schweregrad (0–5) als gefüllte Fläche von 0 bis zum Wert. Je höher die Fläche, desto schlimmer der Symptomtag.

**Q: Wie zeige ich Pollen im Statistik-Chart an?**
A: Parameter-Bereich → „🌿 Pollen"-Button → Popup → gewünschte Pollenarten anhaken → „Übernehmen". Nur Pollenarten mit Daten im ausgewählten Zeitraum werden im Chart angezeigt.

**Q: Wo sehe ich die Ausschlussdiät und die Bekannten Allergene?**
A: Diese Informationen werden in der Statistik nicht mehr angezeigt – die führende Stelle ist das Tagebuch (Ansicht → 📋 Ausschl. bzw. ⚠️ Allergen). Dort sind alle Einträge mit Edit- und Lösch-Funktion vollständig verfügbar.

**Q: Wie aktualisiere ich die Statistik-Daten?**
A: „↺ Aktualisieren"-Button oben rechts. Der Cache-Status zeigt an, wann die Daten zuletzt geladen wurden (TTL: 10 Minuten).

**Q: Was bedeuten die Y-Achsen im Chart?**
A: Links (Y): Temperatur °C, Luftfeuchtigkeit %, Gewicht kg. Rechts (Y2): Schweregrad 0–5, Pollen-Stufe 0–5.

---

## 💾 Daten & Datenschutz

**Q: Wo werden meine Daten gespeichert?**
A: Ausschließlich in deinen eigenen Google Sheets. Die App hat keinen eigenen Server.

**Q: Was speichert die App im Browser?**
A: `localStorage`: Google OAuth-Token, E-Mail, App-Konfiguration (Spreadsheet-IDs, Standort), eigene Pollenarten. `sessionStorage`: Tagebuch-Cache (TTL 10 Min, wird beim Tab-Schließen gelöscht).

**Q: Kann ich gelöschte Einträge wiederherstellen?**
A: Ja, für kurze Zeit. Nach dem Löschen erscheint ein „↺ Rückgängig"-Banner (8 Sekunden für Zutaten, länger für Tagebuch-Einträge). Danach kann der Eintrag direkt im Google Sheet wiederhergestellt werden (`deleted`-Spalte auf `FALSE` setzen).

**Q: Werden Daten wirklich gelöscht?**
A: Nein – die App verwendet Soft-Delete. Einträge werden als `deleted=TRUE` markiert, bleiben aber im Sheet erhalten. Für echtes Löschen musst du die Zeile direkt in Google Sheets entfernen.

---

## 🔧 Technisch

**Q: Warum funktioniert die App nach einem Update nicht mehr?**
A: Hard-Refresh im Browser (Strg+Shift+R / Cmd+Shift+R) oder PWA deinstallieren und neu installieren.

**Q: Kann ich die App auf mehreren Geräten nutzen?**
A: Ja. Alle Daten liegen in Google Sheets und sind auf jedem Gerät über den Browser zugänglich. Eigene Pollenarten (localStorage) müssen auf jedem Gerät separat angelegt werden.

**Q: Was passiert wenn das Sheet-Sheet nicht existiert?**
A: Die App zeigt einen Hinweis „Sheet noch nicht angelegt". In Einstellungen → „Neue Sheets anlegen" erstellt die App alle fehlenden Sheets automatisch.

### Warum werden manche Nährstoffe im Futterrechner als 0 angezeigt, obwohl ich Werte eingetragen habe?
Wenn Google Sheets Dezimalzahlen mit Komma speichert (z.B. „0,5" statt „0.5"), wurde der Wert bisher als 0 eingelesen. Mit v1.4.0 ist das behoben – `_float()` wandelt beide Formate korrekt um. Bestehende Einträge müssen nicht korrigiert werden.

### Warum konnte ich im Futterrechner kein Rezept einmischen – die Auswahl blieb nicht erhalten?
Der Fehler lag daran, dass das Dropdown-Menü sich beim Klicken immer wieder zurückgesetzt hat. Mit v1.4.0 wird die Liste nur noch beim Öffnen der Sektion geladen, nicht bei jeder Auswahl.

### Warum wurden beim wiederholten Speichern eines Rezepts die Zutaten verdoppelt?
Beim Speichern wurden immer alle Zutaten neu angehängt, auch wenn das Rezept bereits existierte. Mit v1.4.0 werden bestehende Zutaten-Zeilen vor dem Speichern geleert und dann neu geschrieben.

### Was ist der Zutaten-Reaktionsscore?
Der Score zeigt statistisch, wie oft nach einem Futtereintrag innerhalb von 48h Symptome mit Schweregrad > 2 aufgetreten sind. Er ist ein Hinweis – kein medizinischer Befund. Zutaten mit weniger als 3 Beobachtungen werden nicht angezeigt. Die Namen stammen aus dem Freitextfeld „Futter" im Futtertagebuch (Komma-getrennt).


### Was ist der Phasentracker?
Der Phasentracker (Tagebuch → Tab „📅 Phasen") hilft, Ausschlussdiät-Phasen strukturiert zu dokumentieren. Du kannst Eliminations-, Provokations- und Ergebnisphasen anlegen, den Fortschritt verfolgen und das Ergebnis (verträglich / Reaktion) festhalten.

### Wie lege ich das Sheet „Ausschluss_Phasen" an?
Gehe zu Einstellungen → „⚙️ Neue Sheets anlegen". Das Sheet wird automatisch mit den korrekten Headern im Tagebuch-Spreadsheet erstellt.

### Warum wird kein Banner angezeigt, obwohl ich eine Phase eingetragen habe?
Der Banner erscheint nur für Phasen mit Ergebnis = „offen" und Enddatum in der Zukunft. Wenn das Enddatum bereits verstrichen ist oder das Ergebnis gesetzt wurde, erscheint kein aktiver Banner.

### Kann ich eine Phase nachträglich bearbeiten?
Aktuell nicht direkt in der App – lösche die Phase (Undo verfügbar) und lege sie neu an, oder bearbeite den Eintrag direkt im Google Sheet `Ausschluss_Phasen`.

### Wie erstelle ich einen Tierarzt-Bericht?
Gehe zu Statistik → tippe oben rechts auf „📄 Tierarzt-Export". Wähle den gewünschten Zeitraum (30–180 Tage) und tippe „Bericht erstellen & drucken". Ein neuer Tab öffnet sich – dort kannst du drucken oder als PDF speichern (im Browser-Druckdialog „Als PDF speichern" wählen).

### Der Export-Tab öffnet sich nicht?
Der Browser blockiert vermutlich Popups. Erlaube Popups für diese Seite (Hinweis in der Adresszeile) und versuche es erneut. In Safari: Einstellungen → Websites → Popups.

### Kann ich den Bericht farbig drucken?
Der Bericht ist bewusst schwarz-weiß gestaltet für bessere Druckkompatibilität. Schweregradbalken und Status-Badges sind als Text mit Umrandung erkennbar.

### Welche Daten werden NICHT im Export angezeigt?
Umweltdaten (Wetter, Pollen), Nährstoffauswertung und Rezepte sind nicht im Export enthalten – der Bericht fokussiert auf klinisch relevante Informationen für den Tierarztbesuch.

### Wie vergleiche ich zwei Rezepte?
Gehe zu Futterrechner → Rezeptliste → tippe „⚖️ Vergleich". Wähle Rezept A und B aus den Dropdowns, gib optional die Gramm-Menge ein und tippe „Vergleichen". Du siehst alle 39 Nährstoffe nebeneinander mit Ampelfarben und einer Delta-Spalte.

### Was bedeutet die Delta-Spalte im Vergleich?
Die Delta-Spalte (Δ A–B) zeigt die Differenz von Rezept A minus Rezept B als Prozent des Tagesbedarfs. Grau = kaum Unterschied (< 10%), Gelb = merkliche Abweichung (< 30%), Rot = große Abweichung (≥ 30%).

### Warum sind manche Nährstoffe im Vergleich 0?
Für diese Zutat wurden noch keine Nährstoffwerte in der Datenbank hinterlegt. Nährstoffe können in Stammdaten → Zutaten bearbeiten → Nährwert-Abschnitt eingetragen oder via USDA/Open Food Facts importiert werden.

### Wie vergleiche ich zwei Hunde in der Statistik?
Gehe zu Statistik → wähle Hund 1 im oberen Dropdown → wähle Hund 2 im „↕ Vergleich mit:"-Dropdown darunter. Das blaue Flächenband erscheint sobald der Parameter „Schweregrad Symptome" aktiv ist.

### Warum ist mein Hund im Vergleichs-Dropdown nicht sichtbar?
Der aktuell als Hund 1 gewählte Hund wird in der Vergleichsliste automatisch ausgeblendet, um Selbstvergleiche zu verhindern.

### Warum erscheint kein blaues Band für Hund 2?
Das Band erscheint nur wenn der Parameter „Schweregrad Symptome" im Statistik-Panel aktiviert ist (blauer Toggle-Button oben). Außerdem braucht Hund 2 mindestens einen Symptomeintrag im gewählten Zeitraum.
