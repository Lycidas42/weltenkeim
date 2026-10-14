# Asset-Credits

## KayKit Medieval Hexagon Pack 1.0

Gebäude, Bäume, Baumstumpf, Felsen und Wolken in `models/` (alle Dateien außer `Fox.glb`).

- Von Kay Lousberg, https://www.kaylousberg.com
- Lizenz: Creative Commons Zero (CC0 1.0)
- Quelle: https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0

## Tiere für Ruun (`models/animals/`)

Fuchs, Wolf, Hirsch, Stier und Alpaka (`Fox.glb`, `Wolf.glb`, `Stag.glb`, `Bull.glb`, `Alpaca.glb`):

- Animated Animal Pack von Quaternius, https://quaternius.com
- Lizenz: Creative Commons Zero (CC0 1.0)
- Quelle: https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS
- Bearbeitung: doppelte und ungenutzte Animationen entfernt (gltf-transform), um die Dateigröße zu halbieren.

Fell-Prototyp (`Fox_HD.glb`, Quelle `../source/Fox_HD.blend`):

- Abgeleitet aus dem Quaternius-Fuchs (CC0): Vertices verschmolzen, einmal unterteilt, glatt schattiert, UV-Koordinaten und Fellmaske (`_FUR`) ergänzt, in Blender 5.2.
- Im Spiel als Fell-Modell in der Nahansicht (Ruun-Panel), außerdem in der Vorschau `dev/fur.html`.

Katze (`Cat.glb`):

- Animal Pack Vol.2 von Quaternius, https://quaternius.com
- Lizenz: Creative Commons Zero (CC0 1.0)
- Quelle: https://opengameart.org/content/animated-animales-low-poly
- Bearbeitung: von FBX nach glTF konvertiert (FBX2glTF), Materialfarben neu gesetzt, Animationen umbenannt. Augen werden im Spielcode ergänzt.

## Gotteshand (`models/hand/GodHand.glb`, Quelle `source/GodHand.blend`)

Für Weltenkeim selbst gebaut in Blender 5.2 (Metaballs, jeder Finger als eigene Gruppe, Voxel-Remesh, eigenes Skelett mit 17 Knochen, Ärmel mit Saum; Haut, Nägel, Ärmel und Saum als eigene Materialien). Gehört zum Projekt, keine fremde Lizenz. Aufbau-Skript: `source/build_godhand.py`.

## Three.js

`vendor/three-0.170.0/`, MIT-Lizenz, siehe `vendor/three-0.170.0/LICENSE`.
