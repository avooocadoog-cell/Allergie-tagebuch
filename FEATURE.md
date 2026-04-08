# Hund Manager – Feature-Übersicht (v1.4.0)

> Letzte Aktualisierung: 2026-04-08

---

## 🐕 Hundverwaltung (Stammdaten → Hunde)

| Feature | Beschreibung |
|---------|-------------|
| Hund anlegen / bearbeiten | Name, Rasse, Geburtsdatum, Geschlecht, Kastration, Notizen |
| Soft-Aktivierung | Hund deaktivieren statt löschen |
| Kcal-Bedarf manuell | Überschreibt die automatische RER-Berechnung (Stammdaten → Hund bearbeiten) |
| Gewicht erfassen | Eigenes Modal mit Verlaufstabelle (letzte 15 Einträge) |

---

## 🥩 Zutaten & Nährstoffe (Stammdaten → Zutaten)

| Feature | Beschreibung |
|---------|-------------|
| Zutat anlegen / bearbeiten | Name, Hersteller, Kategorie, Status |
| Nährwerte direkt im Modal | Alle 39 NRC-Nährstoffe eingeben (einklappbarer Abschnitt, gruppiert nach Makros / Aminosäuren / Fettsäuren / Mineralstoffe / Vitamine) |
| Zutat soft-löschen | Soft-Delete mit Undo-Banner (8 Sek.) |
| Undo letzter Löschung | Bis zu 5 Löschungen rückgängig machbar |
| Automatischer Futterrechner-Sync | Dropdown im Rechner wird nach Speichern sofort aktualisiert |
| **Nährstoff-Import USDA + OFF parallel** | Beide Quellen gleichzeitig abgerufen · Zwei-Spalten-Ergebnisliste · Werte pro Quelle über jedem Feld sichtbar |
| **Einheitenkonvertierung Import** | Automatische Umrechnung USDA/OFF-Einheiten → DB-Einheiten (g/mg/µg/IE); Vorschau zeigt Quell- und Zielwert |
| **Import überschreibt keine Werte** | Nur leere Felder werden befüllt – vorhandene Einträge bleiben erhalten |

---

## 🧮 Futterrechner

| Feature | Beschreibung |
|---------|-------------|
| Rezepte erstellen & bearbeiten | Für jeden Hund separat |
| Nährstoffanalyse | Alle 39 NRC-Nährstoffe, Balken mit Ampelfarben (ok/low/high/zero) |
| Toleranzbalken | Individuelle Min/Max/Empfehlung je Hund (%) |
| Rezept-Mix | Verschachtelte Rezepte (max. 5 Ebenen, Zykluserkennung) |
| Kcal-Berechnung | Automatisch aus Gramm + Zutaten-Nährwerten |
| Gekocht-Flag | Kochverlustfaktor 0.75 je Zutat |
| Nährstoff-Popup | Detailinfos (NRC/AAFCO/FEDIAF) per Tap |
| Soft-Delete Rezepte | Mit Undo |

---

## 📓 Tagebuch

| Tab | Felder |
|-----|--------|
| 🌤 Umwelt | Außentemp min/max, Luftfeuchte, Niederschlag, Pollen, Raumtemp/-feuchte, Bett, Notizen |
| 🔍 Symptom | Kategorie, Beschreibung, Schweregrad (0–5), Körperstelle, Notizen |
| 🥩 Futter | Rezept/Futter-Name, Produkt, Erstgabe, 2-Wochen-Phase, Provokation, Reaktion |
| 🚫 Ausschluss | Zutat, Verdachtsstufe 1–3, Kategorie, Status, Reaktion |
| ⚠️ Allergen | Allergen, Kategorie, Reaktionsstärke 1–5, Symptome |
| 🏥 Tierarzt | Datum, Praxis, Anlass, Untersuchungen, Ergebnis, Therapie, Folgebesuch |
| 💊 Medikament | Name, Typ, Dosierung, Häufigkeit, Von–Bis, Verordnet von |

**Alle Tabs:**
- Soft-Delete mit Undo-Banner
- Edit-Modal für bestehende Einträge
- Cache-Anzeige (TTL 10 Min)

---

## 🌿 Wetter & Pollen (Tagebuch → Umwelt-Tab)

| Feature | Beschreibung |
|---------|-------------|
| Wetter-Auto-Load | BrightSky API (DWD) – Temp, Feuchte, Niederschlag |
| Pollen DWD | 8 Pollenarten, 18 Regionen, via CORS-Proxy |
| Pollen Open-Meteo | Koordinatenbasiert, kein API-Key nötig |
| Pollen-Auswahl UI | Toggle-Buttons mit Stärke-Anzeige, Vorauswahl ab „mittel" |
| Eigene Pollenarten | Via „⚙️ Verwalten" beliebig erweiterbar (localStorage) |
| Pollen_Log | Jede Pollenart wird als eigene Zeile geschrieben → für Statistik-Auswertung |
| Skala 0–5 | 0=keine, 1=gering, 2=gering–mittel, 3=mittel, 4=mittel–stark, 5=stark |

---

## 📊 Statistik

| Feature | Beschreibung |
|---------|-------------|
| Hund-Filter | Auswahl per Dropdown |
| Zeitraum-Filter | 30 / 90 / 180 Tage / 1 Jahr / Alles |
| KPI-Kacheln | Symptomtage, Ø Schweregrad, Pollentage |
| Konfigurierbarer Chart | Beliebige Kombination aus Parametern |
| Temp-Band | Gefülltes oranges Band Min–Max |
| Temp. innen | Linie |
| Feuchte außen/innen | Gestrichelte Linien |
| **Schweregrad Symptome** | **Rotes gefülltes Band** · Tage ohne Eintrag als 0 dargestellt · echte Einträge mit sichtbarem Punkt |
| Gewicht | Linie (nur wenn Hund_Gewicht-Daten vorhanden) |
| Pollen-Popup | **Popup-Dialog** mit allen Pollen-Typen aus Pollen_Log + eigenen Pollen; alle standardmäßig aktiviert |
| **Symptom-Muster** | **Heatmap Wochentag (Mo–So) + Monat (Jan–Dez)** · Ø Schweregrad als farbige Kacheln · ab 14 Einträgen |
| **Korrelationsanalyse** | Alle Pollenarten, 7 Klimafaktoren, Futtermittel frei auswählbar · Gruppen mit Ø > 2.0 orange · min. 3 Datenpunkte |
| **Zutaten-Reaktionsscores** | **🧪 Score = Anteil der Gaben mit Symptomen (Schweregrad > 2) innerhalb 48h** · Score-Balken grün/gelb/rot · Rezept-Badge · min. 3 Beobachtungen · eingeklappt |
| Futter-Reaktionen | Liste (nur Einträge mit Reaktion oder Provokation) |
| Medikamente | Liste mit Zeitraum |
| Cache-Status | Anzeige ob Daten aus Cache oder frisch geladen |

---

## ⚙️ Einstellungen

| Feature | Beschreibung |
|---------|-------------|
| Google OAuth2 | Login/Logout |
| Spreadsheet IDs | Stammdaten-ID, Tagebuch-ID konfigurierbar |
| Standort | Lat/Lon für Wetter-API |
| DWD-Region | Pollen-Region aus 18 deutschen Regionen |
| Neue Sheets anlegen | Automatisch via Knopf (Rezept_Komponenten, Translations, Hund_Gewicht, Pollen_Log) |
| USDA API-Key | Key für automatischen Nährstoff-Import aus USDA FoodData Central |
| **💾 Einstellungen speichern** | Expliziter Speichern-Button mit Bestätigungs-Feedback (zusätzlich zum Auto-Save) |
| Sprache | Deutsch / Englisch (i18n) |
| Verbindungstest | Prüft Sheets-API-Zugang |

---

## 🏗️ Technische Features

| Feature | Beschreibung |
|---------|-------------|
| PWA | Progressive Web App (Offline-fähig, installierbar) |
| Kein Backend | 100% statisch auf GitHub Pages |
| Google Sheets als DB | Dual-Spreadsheet (Stammdaten + Tagebuch) |
| In-Memory-Cache | Stammdaten per STORE.loadAll() |
| Session-Cache | Tagebuch-Daten TTL 10 Min (sessionStorage) |
| Soft-Delete überall | deleted/deleted_at statt hartem Löschen |
| NaN-Schutz | calcMkg() mit Fallback, alle Float-Parsing via _float() |
| Dark Mode | prefers-color-scheme: dark |
| Mobile-first | max-width 540px |
