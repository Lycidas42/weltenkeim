# Modelle und Themes – Vorgaben für Designer

Weltenkeim trennt **was** im Spiel steht (Spiellogik) von **wie es aussieht** (Theme). Die Spiellogik fragt Modelle
nur über Schlüssel ab, etwa `hut.sawyer` oder `prop.sack`. Welche Datei dahinter liegt und wie sie ins Spiel passt,
steht im Theme. So lässt sich ein einzelnes Modell austauschen, ohne Code anzufassen, und später kann es ganze
Themes mit eigenem Stil geben.

- Grund-Theme „Gemütlich“: `src/themes/cozy.js` (comichaft und niedlich, KayKit, Quaternius, eigene Hand)
- Auswahl des Themes: `src/assets/theme.js` (Spielstand `S.theme`)
- Modellverzeichnis: `src/assets/models.js` (`model(key)`, `modelInfo(key)`, `findPart(obj, key, part)`)
- Dateien: `assets/models/`, Blender-Quellen: `assets/source/`

## 1. Ein Modell austauschen

1. Neue Datei nach `assets/models/` legen (glTF `.gltf` + `.bin` oder `.glb`).
2. Im Theme beim passenden Schlüssel `file` ändern; falls nötig `scale`, `anchors`, `foot` und `parts` anpassen
   (siehe 3).
3. Die Datei in die Offline-Liste `APP` in `sw.js` eintragen. Der Pages-Workflow bricht sonst ab.
4. Lizenz in `assets/CREDITS.md` und im Info-Panel (`#sheetInfo` in `index.html`) nennen.
5. Im Spiel prüfen: lokaler Server, dann das Modell im Spiel ansehen (Licht, Schatten, Tag/Nacht, Schnee).

## 2. Maße und Ausrichtung

| Vorgabe | Wert |
|---|---|
| Einheit | 1 = eine Welteinheit (die Insel ist 64 Einheiten breit) |
| Oben | +Y (glTF-Standard) |
| Vorne | +Z: Türen und Gesichter zeigen nach +Z |
| Ursprung | auf dem Boden, mittig unter dem Modell |
| Bezugsgrößen in der Welt | Bewohner etwa 0,45 hoch; Wohnhaus etwa 1,4 hoch und 1,2 breit; Baum etwa 1,4 hoch |

- Gebäude werden im Spiel mit einem festen Faktor aufgestellt (Wohnhäuser und Hütten 1,5, Säge 1,2, Windmühle 1,6).
  Ein Modell im KayKit-Maßstab (Haus etwa 0,93 hoch, 0,8 breit) passt ohne Anpassung.
- Passt ein neues Modell nicht in diesen Maßstab, im Theme `scale` setzen statt das Modell umzurechnen.
- Kreaturen werden beim Laden auf ihre Spielhöhe skaliert (`h` in `src/creature/kinds.js`). Die Kopfrichtung
  bestimmt, wo vorne ist.

## 3. Angaben im Theme (je Schlüssel)

| Angabe | Bedeutung |
|---|---|
| `file` | Datei unter `assets/models/` |
| `scale` | Anpassung an den Maßstab (Standard 1) |
| `anchors` | Punkte im Modellraum `{ x, z }`: `door` (vor der Tür, dorthin gehen Bewohner), `work` (Arbeitsplatz neben dem Gebäude, dort liegen Waren) |
| `foot` | Grundriss für die Wegfindung im Modellraum: `[Mitte x, Mitte z, halbe Breite, halbe Tiefe]` |
| `parts` | Teile, die das Spiel bewegt: Knotenname (Text) oder Muster (RegExp), z. B. `saw` (Sägeblatt dreht beim Sägen), `fan` (Windrad) |
| Kreatur: `hd` | höher aufgelöstes Modell mit Fell fürs Porträt im Charakter-Blatt |
| Kreatur: `head` | Name des Kopfknochens (Blickrichtung, Tragen im Maul, Augen) |
| Kreatur: `eyes` | Augen am Kopfknochen ergänzen, falls das Modell keine hat |
| Kreatur: `rest` | Liegepose (nur für Tiere mit dem Quaternius-Skelett „AnimalArmature“) |
| Kreatur: `react` | eigene Animationen für Lob und Tadel (bisher nur der Fuchs) |
| Kreatur: `ws` | Tempo der Laufanimation |
| Hand: `materials` | Rolle → Materialname im Modell und Oberfläche; die Farben wählt der Spieler (Haut, Nägel, Ärmel, Saum) |

### Animationen der Kreaturen

Erkannt werden diese Namen (wie im Quaternius-Pack):

| Name | Zweck |
|---|---|
| `Idle` | Stehen (Pflicht) |
| `Walk` | Gehen (Pflicht) |
| `Idle_2` | zweites Stehen |
| `Eating` | Fressen und Aufnehmen |
| `Gallop` | Rennen |
| `Attack…` | Angriff |
| `Idle_HitReact…` | Treffer |
| `Jump…` | Sprung |

Fehlt eine Animation, nutzt das Spiel eine vorhandene mit anderem Tempo.

### Benannte Teile in Gebäuden

Die Namen gelten fürs Grund-Theme. Ein neues Modell kann andere Namen haben; dann im Theme unter `parts` eintragen.

| Gebäude | Teil |
|---|---|
| Sägemühle | `building_lumbermill_saw_blue` dreht sich beim Sägen |
| Windmühle | Knoten mit „fan“ im Namen ist das Windrad |

## 4. Was heute noch im Code gebaut wird

Diese Modelle entstehen im Code und lassen sich noch nicht per Datei ersetzen:
- Bewohner
- Bäume, Felsen, Büsche, Gras und Blumen
- Felder und Feldfrüchte
- Vieh, Wild, Fische, Vögel, Haie
- Wolken
- Schrein
- Ofen, Lager, Steg

Ihre Grundfarben für Gelände, Himmel und Bewohner stehen aber schon in der Palette des Themes (`palette`).
Schritt für Schritt können weitere Farben in die Palette wandern. Einzelne Modelle können auch durch Dateien ersetzt
werden: Dafür bekommen sie einen Schlüssel im Theme, und der Code-Baustein wird zur Rückfallebene.

Die Bewohner sind ein Sonderfall. Sie bestehen aus Einzelteilen (Beine, Arme, Kopf, Werkzeuge), die der Code direkt
bewegt (`src/village/render.js`). Ein Ersatz per Datei bräuchte entweder genau diese Teile als getrennte Meshes oder
ein Skelett mit festgelegten Animationen. Das wird festgelegt, sobald es einen Designer dafür gibt.

## 5. Grenzen fürs Handy

- Möglichst wenige Materialien je Modell. KayKit nutzt eine gemeinsame Textur (`hexagons_medieval.png`); neue Modelle
  sollten ebenfalls eine Atlas-Textur oder Vertexfarben nutzen.
- Gebäude bis etwa 2.000 Dreiecke, Requisiten bis etwa 500, Kreaturen bis etwa 10.000 (Fell-Modell fürs Porträt darf
  mehr haben).
- Texturen höchstens 1024 × 1024.
- Schatten werfen alle Meshes; sehr dünne Teile flimmern im Schatten, besser etwas kräftiger bauen.

## 6. Ein neues Theme anlegen

1. `src/themes/<name>.js` nach dem Vorbild von `cozy.js` anlegen. Was es nicht selbst festlegt, kommt aus „Gemütlich“.
2. In `src/assets/theme.js` in `THEMES` eintragen.
3. Datei in die Offline-Liste `APP` in `sw.js` aufnehmen.
4. Zum Ausprobieren `S.theme` setzen (Konsole: `__wk.S.theme = '<name>'`, speichern, neu laden). Eine Auswahl in der
   Oberfläche gibt es noch nicht.
