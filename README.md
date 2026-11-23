# MoveDaily 🧘‍♂️🔥

Tägliche Kurz-Workouts (1–15 Minuten) für **Mobility** (Hüfte, Rücken, Knie), **Kräftigung** (Po, Beine, Rumpf), **Dehnen** und **Entspannung** – nur mit Matte.
Läuft als installierbare Web-App (PWA) auf dem Handy, offline, ohne Anmeldung. Alle Daten bleiben lokal auf dem Gerät.

## Features

1. **Zeitwahl** – 1 / 3 / 5 / 10 / 15 Minuten, das Workout wird automatisch zusammengestellt
2. **Fokuswahl** – Mix, Mobility, Kräftigung, Dehnen, Entspannung
3. **Workout-Player** – Kreis-Timer, Vorbereitungszeit mit Vorschau, Pause / Weiter / Zurück
4. **Zeit- oder Wiederholungs-Übungen** – inkl. automatischem Seitenwechsel bei einseitigen Übungen
5. **Animierte Figuren** – jede Übung als animierte Strichfigur mit Bewegungspfeilen und Anleitung
6. **Favoriten ❤️ & Ausblenden 🚫** – Favoriten kommen öfter dran, ausgeblendete nie wieder
7. **Übungsbibliothek** – 51 Übungen, filterbar nach Kategorie, Körperbereich, Favoriten
8. **Tägliche Routine** – Workout des Tages (Thema je Wochentag), Serie 🔥 und Kalender
9. **Signale** – Countdown-Töne, Vibration, Display bleibt an
10. **Offline & installierbar** – PWA mit App-Icon
11. **Sprachansage** – sagt die nächste Übung an, Seitenwechsel, Halbzeit, Atemrhythmus

## Auf GitHub Pages veröffentlichen (einmalig)

1. Auf [github.com/new](https://github.com/new) ein neues Repository anlegen, z. B. `movedaily` (öffentlich – GitHub Pages ist für private Repos nur mit bezahltem Plan verfügbar).
2. Diesen Ordner hochladen – entweder per Git:
   ```powershell
   git init
   git add .
   git commit -m "MoveDaily: erste Version"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/movedaily.git
   git push -u origin main
   ```
   … oder im Browser über **„uploading an existing file“** alle Dateien und Ordner hineinziehen.
3. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch **`main`**, Ordner **`/ (root)`** → **Save**.
4. Nach ca. 1 Minute ist die App erreichbar unter `https://DEIN-NAME.github.io/movedaily/`.

## Auf dem Handy installieren

- **Android (Chrome):** Link öffnen → Menü ⋮ → **„App installieren“** bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Link öffnen → **Teilen** → **„Zum Home-Bildschirm“**.

Danach startet MoveDaily wie eine normale App – auch ohne Internet.

## Updates veröffentlichen

Nach Änderungen in `sw.js` die Zeile `const VERSION = 'movedaily-v1';` hochzählen (z. B. `v2`), dann committen und pushen. Die Handys laden die neue Version beim nächsten Öffnen.

## Lokal starten

```powershell
python -m http.server 5173
```
Dann `http://localhost:5173` öffnen. (Direktes Öffnen der `index.html` per Doppelklick funktioniert nicht, da JavaScript-Module einen Server brauchen.)

## Projektstruktur

| Datei | Inhalt |
|---|---|
| `index.html` | Einstiegspunkt |
| `css/app.css` | Design (Navy `#001f3f`, Rot `#FF4136`, Orange `#FF851B`) |
| `js/exercises.js` | Übungsdatenbank inkl. Posen für die Animation |
| `js/figure.js` | Figuren-Engine (Gelenkwinkel → animierte SVG-Figur) |
| `js/generator.js` | Workout-Generator (Zeit, Fokus, Favoriten, Abwechslung) |
| `js/player.js` | Workout-Player (Timer, Ablauf, Ansagen) |
| `js/signals.js` | Töne, Vibration, Sprachausgabe, Wake Lock |
| `js/storage.js` | Lokale Speicherung (Favoriten, Verlauf, Einstellungen) |
| `js/app.js`, `js/ui.js` | Ansichten & UI-Helfer |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, installierbar) |
| `tools/gallery.html` | Entwicklungs-Galerie aller Figuren (`/tools/gallery.html`) |
| `tools/make_icons.py` | Erzeugt die App-Icons neu |

### Neue Übung hinzufügen

In `js/exercises.js` einen Eintrag in `EXERCISES` ergänzen. Posen werden über Gelenkwinkel beschrieben
(0° = nach unten, 90° = nach vorn/rechts, 180° = nach oben). Am einfachsten eine ähnliche Übung kopieren
und in `tools/gallery.html?only=deine-id&cols=1` live anpassen.

---

*Hinweis: Die Übungen ersetzen keine ärztliche oder physiotherapeutische Beratung. Bei Schmerzen abbrechen.*
