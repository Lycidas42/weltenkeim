# Weltenkeim

Idle-Gottspiel im Browser. Eine Insel, ein Dorf und deine Hand: Bewohner fällen Holz, beten am Tempel und bauen neue Häuser. Ihr Glaube ist deine Währung, und er wächst weiter, während du fort bist. Dazu streift Ruun über die Insel, ein Fuchsgeist, der selbstständig handelt und aus deinem Lob und Tadel lernt.

Inspiriert von „Idling to Rule the Gods“ (Idle-Anteil) und „Black & White“ (Gotteshand, lernende Kreatur).

**Spielen:** https://lycidas42.github.io/weltenkeim/

## Steuerung

| Werkzeug | Wirkung |
| --- | --- |
| Hand | Bewohner packen und werfen. Ruun antippen, um ihn zu erziehen. |
| Formen | Gedrückt halten: Land heben oder senken. |
| Wunder | Regen lässt den Wald wachsen und Setzlinge sprießen. Eile beschleunigt Bewohner im Umkreis. |
| Blick | Ziehen dreht die Welt. Zwei Finger oder Mausrad: verschieben und zoomen. Rechte Maustaste dreht immer. |

Im Schrein gibt es Ausbauten für Glauben: Tempel weihen, Seele rufen, Hand stärken.

## Aufs Handy installieren

- **Android (Chrome):** Seite öffnen → Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Seite öffnen → Teilen → „Zum Home-Bildschirm“.

Danach startet Weltenkeim wie eine App im Vollbild und läuft auch offline. Der Spielstand liegt lokal auf dem Gerät.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Markup und Styles |
| `game.js` | Gesamter Spielcode: Terrain, Dorf, Bewohner, Ruun, Werkzeuge, Wunder, Ökonomie, Speichern |
| `sw.js` | Service Worker (Offline-Cache). Bei jeder Veröffentlichung `VERSION` erhöhen. |
| `manifest.webmanifest`, `icons/` | PWA-Daten |
| `assets/models/` | 3D-Modelle (glTF), siehe `assets/CREDITS.md` |
| `vendor/three-0.170.0/` | Three.js r170 und die genutzten Add-ons, lokal für den Offline-Betrieb |

Kein Build-Schritt. Lokal starten mit einem beliebigen statischen Server im Repo-Ordner, z. B. `npx serve` oder `python -m http.server`, dann `http://localhost:8000` öffnen.

## Spielstand und Online

Der Spielstand liegt unter dem Schlüssel `weltenkeim-save` im `localStorage` und trägt ein Versionsfeld (`v`) sowie einen Zeitstempel (`ts`). Beim Start wird die Zeit seit `ts` nachgerechnet: bis 8 Stunden, zur halben Rate.

Supabase ist noch nicht angebunden. Geplant ist es wie bei Kernwacht für Cloud-Spielstand über mehrere Geräte, Serverzeit für den Offline-Fortschritt und Bestenlisten.

## Veröffentlichen

GitHub Pages aus dem Branch `main`, Ordner `/` (Root). Jeder Push auf `main` geht nach ein bis zwei Minuten live.
