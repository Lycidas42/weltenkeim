# Kreatur-Modelle: Zweibeiner bauen, einbauen, ausprobieren

Arbeitsnotiz zu `kreatur.md` 3.12 (zweibeinige Gestalt), damit wir nahtlos weitermachen können. Stand: 16.10.2026,
Branch `claude/zweibeiner-test` (alles zu neuen Gestalten bleibt dort, bis entschieden ist, was ins Spiel kommt).

## 1. Stand

| Gestalt | Datei | Herkunft | Stand |
|---|---|---|---|
| Fuchsmensch (`foxfolk`) | `assets/models/animals/Foxfolk.glb` | Körper selbst gebaut (`assets/source/build_tiermensch.py`), Skelett und Animationen Quaternius Universal Animation Library 1+2 (CC0) | ✅ im Test, 7.000 Dreiecke, 1,4 MB, 18 Animationen |
| Mensch (Test) (`mage`) | `assets/models/animals/Mage.glb` | KayKit Adventurers „Mage“ (CC0), ohne Stab und Buch | ✅ im Test, 19 von 76 Animationen, 1 MB |

Verworfen: Quaternius „Ultimate Monsters“ (zu grob), Fell-Fuchs in der Nahsicht (200.000 Dreiecke, `kreatur.md` 3.11 F 6),
die freien „Universal Base Characters“ (nur muskulöse Superhelden).

## 2. Nächste Runde (vereinbart)

1. Die drei übrigen KayKit-Figuren als Gestalten: Barbar (Bärenkopf-Mütze), Schurkin, Ritter. Gleiches Skelett und
   dieselben 76 Animationen wie der Magier, Waffen entfernen (Schritte wie in 4.2).
2. Ein zweiter eigener Tiermensch über `build_tiermensch.py` (neuer Eintrag in `ART`, z. B. Bär oder Hase).
3. 100Avatars (Polygonal Mind): Eichhörnchen, Teddy, Katze, Hase. Lizenz an der Quelle prüfen (die Registry
   `github.com/ToxSam/open-source-avatars` nennt CC0, nicht bestätigt). Format VRM mit menschenähnlichem Skelett;
   Animationen der Universal Animation Library müssten übertragen werden.

Weitere Kandidaten aus der Recherche: Detective Bunny (OpenGameArt, CC0, eigene Animationen), Chibi Sloth (Sketchfab,
CC BY, nur 3 Animationen), Styloo „Chibi Characters“ (itch.io). Animationen lassen sich leichter ergänzen als Modelle:
Bei gleichem Skelett ist eine neue Animation nur ein weiterer Eintrag beim Export.

## 3. Rohdaten und Werkzeuge

- **Rohdaten** liegen nur lokal in `dev/assets-raw/` (in `.gitignore`): die Zips der Universal Animation Library 1+2
  und der Universal Base Characters (Standard, von itch.io; der Download per Skript scheitert an itch.io, der Nutzer lädt
  sie selbst herunter), entpackt daneben; `kaykit/` mit den vier Adventurers-GLBs (direkt von GitHub:
  `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`); Blender-Zwischenstände `tiergeist_entwurf*.blend`.
- **Dev-Server** ohne Browser-Cache: `python dev/serve.py [port] [bind]` (in `.claude/launch.json`). Mit Pythons
  `http.server` hielt der Browser alte Module fest; neue Gestalten fehlten dann am Schrein.
- **Blender 5.2** per MCP. Fallen:
  - Der glTF-Import legt jede Animation als NLA-Spur an, die alle gleichzeitig wirken: Spuren stumm schalten
    (`track.mute = True`), sonst steht die Figur in einer Mischpose.
  - Aktionen haben Slots: nach `ad.action = a` auch `ad.action_slot = a.slots[0]` setzen, bei NLA-Streifen ebenso.
  - Vor dem Export in allen Szenen alles abwählen; sonst kommen versteckte, aber ausgewählte Objekte mit.
  - Nach `arm.location = …` erst `view_layer.update()`, sonst stimmt `matrix_world` nicht.

## 4. Abläufe

### 4.1 Eigener Tiermensch (`assets/source/build_tiermensch.py`)

In Blender: `exec(open(p, encoding='utf-8').read(), {'__file__': p, 'TM_KIND': 'fox'})` mit `p` = Pfad zum Skript,
optional `'TM_OUT': …` für eine Testausgabe. Das Skript:

1. übernimmt das Skelett der Schaufensterpuppe aus UAL2 (65 Knochen, Unreal-Schema: `pelvis`, `spine_01…03`,
   `Head`, `hand_l` …), die Figur blickt nach −Y, rund 2 m hoch;
2. baut den Körper aus Ellipsoiden, Kapseln und Kegeln an den Knochenpositionen, verschmilzt (Voxel-Remesh 0,018),
   glättet und reduziert auf 7.000 Dreiecke;
3. legt vier Schwanzknochen `tail_01…04` am Becken an und bindet mit automatischen Gewichten;
4. färbt über Vertexfarben mit weichen Masken (Bauch, Schnauze, Wangen, Schwanzspitze hell; Pfoten, Füße,
   Ohrspitzen dunkel);
5. setzt Augen und Nase an den Kopfknochen;
6. lädt UAL1 und UAL2 und legt die Animationen aus `ANIMS` als NLA-Spuren an;
7. exportiert Skelett, Körper, Augen und Nase nach `assets/models/animals/<ART.file>`.

Neue Art: Eintrag in `ART` (Farben, Schnauze, Ohren), bei Bedarf Formen in Schritt 2 je Art abwandeln.

### 4.2 Fertige Figur aufbereiten (z. B. KayKit)

GLB importieren, NLA-Spuren stumm, Zubehör an `handslot.*` entfernen (Waffen, Bücher), nur benötigte Animationen als
Spuren behalten, ausgewählt exportieren (`export_animation_mode='NLA_TRACKS'`). Zielgröße etwa 1 MB.

### 4.3 Ins Spiel einbauen

1. GLB nach `assets/models/animals/`, in die `APP`-Liste in `sw.js`.
2. Theme `src/themes/cozy.js`, Schlüssel `creature.<id>`: `file`, `head` (Kopfknochen), `body: 'biped'`, `face: 0`
   (Blickrichtung +Z), `hands` (zwei Handknochen fürs Tragen), optional `tail` (Knochen, die im Code schwingen) und
   `anims`: Zuordnung der Spielzustände zu Animationsnamen. Ein Eintrag ist ein Name oder `{ clip, reverse }` bzw.
   `{ clip, hold }` (ein Bild halten). Zustände: `idle`, `idle2`, `walk`, `run`, `carry` (Gehen mit Last), `attack`
   (am Baum arbeiten), `eat` (aufheben), `hit`, `cast`, `praise`, `scold`, `lieDown`, `lie`, `standUp`, dazu für später
   `harvest`, `plant`, `water`, `interact`, `throw`.
3. `src/creature/kinds.js`: Eintrag in `CREATURES` mit `label`, `spirit`, `h` (Spielhöhe, Zweibeiner etwa 2,1–2,3),
   `walk`, `run`. Die Gestalt erscheint dann automatisch am Schrein.
4. Credits in `assets/CREDITS.md` und im Info-Panel (`#sheetInfo`).
5. Prüfen: `__wk.setCreature('<id>')`, Zustände durchlaufen lassen (`__wk.step`), Tragen, Liegen, Lob/Tadel;
   `node dev/check.mjs kreatur zielen`.

## 5. Offene Punkte

- Fuchsmensch: Gesicht ohne Mimik, Hände ohne Finger-Form; beim Liegen hängt der Schwanz in den Boden.
- Tragkraft und Werfen der Zweibeiner noch wie beim Fuchs (3.12 G 3).
- Die vierbeinige Fuchs-Reaktion (Schwanz wedeln) gibt es für Zweibeiner nicht; dort Animationen `Yes`/`Idle_No_Loop`
  bzw. `Cheer`/`Hit_B`.
