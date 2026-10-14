# Weltenkeim – Hinweise für Claude

- Statische PWA ohne Build-Schritt: `index.html` (Markup, Styles), `game.js` (ES-Modul, gesamter Spielcode), `sw.js`, `manifest.webmanifest`. Three.js r170 liegt lokal unter `vendor/three-0.170.0/` und wird per Import-Map als `three` bzw. `three/addons/` geladen. Keine CDN-Abhängigkeiten außer Google Fonts.
- Hosting: GitHub Pages aus `main`, Root-Ordner. Jeder Push auf `main` ist sofort öffentlich.
- Bei jeder Veröffentlichung `VERSION` in `sw.js` erhöhen (Schema 0.x.y). Neue Dateien, die offline verfügbar sein sollen, in die `APP`-Liste in `sw.js` eintragen.
- Spieltexte und UI auf Deutsch. Zahlen mit Komma als Dezimaltrennzeichen (`fmt`, `fmt1` in `game.js`).
- Spielstand: `localStorage['weltenkeim-save']`, Objekt `S` mit Versionsfeld `v` und Zeitstempel `ts`. Neue Felder abwärtskompatibel ergänzen (Standardwert in `S`, geladene Werte werden darübergelegt). Das Format soll später per Supabase synchronisierbar bleiben.
- Neue Assets nur mit freier Lizenz (CC0 bevorzugt) und immer in `assets/CREDITS.md` sowie im Info-Panel (`#sheetInfo` in `index.html`) nennen.
- Zielgerät ist das Handy: Touch-Bedienung, Safe-Area-Abstände, Performance im Blick behalten (Instancing für viele gleiche Objekte, Schattenauflösung mobil 1024).
- Lokal testen: im Repo-Ordner `npx serve` oder `python -m http.server` starten.
