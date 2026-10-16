# Kreatur-Modelle: Zweibeiner bauen, einbauen, ausprobieren

Arbeitsnotiz zu `kreatur.md` 3.12 (zweibeinige Gestalt), damit wir nahtlos weitermachen können. Stand: 16.10.2026,
Branch `claude/zweibeiner-test` (alles zu neuen Gestalten bleibt dort, bis entschieden ist, was ins Spiel kommt).

## 1. Stand

| Gestalt | Datei | Herkunft | Stand |
|---|---|---|---|
| Fuchsmensch (`foxfolk`) | `assets/models/animals/Foxfolk.glb` | Körper selbst gebaut (`assets/source/build_tiermensch.py`), Skelett und Animationen Quaternius Universal Animation Library 1+2 (CC0) | ✅ im Test, Detailstufe 40.000 Dreiecke, 2,9 MB, 21 Animationen, Gesicht mit Mimik (5a) |
| Bärenmensch (`bearfolk`) | `assets/models/animals/Bearfolk.glb` | wie Fuchsmensch, Art `bear` (runde Ohren, kurze Schnauze, Stummelschwanz, kräftiger) | ✅ im Test |
| Magier, Barbar, Schurkin, Ritter (`mage`, `barbarian`, `rogue`, `knight`) | `assets/models/animals/<Name>.glb` | KayKit Adventurers (CC0), Waffen entfernt (`assets/source/prep_kaykit.py`) | ✅ im Test, je 19 von 76 Animationen, je 1 MB |

Verworfen: Quaternius „Ultimate Monsters“ (zu grob), Fell-Fuchs in der Nahsicht (200.000 Dreiecke, `kreatur.md` 3.11 F 6),
die freien „Universal Base Characters“ (nur muskulöse Superhelden).

## 2. Nächste Runde (vereinbart)

1. ✅ Die drei übrigen KayKit-Figuren (Barbar, Schurkin, Ritter).
2. ✅ Zweiter eigener Tiermensch: Bär (`ART['bear']`; Parameter `belly`, `limbs`, `legs`, `head`, runde Ohren, Stummelschwanz).
3. 100Avatars (Polygonal Mind), z. B. Eichhörnchen, Teddy, Katze, Hase. Lizenz an der Quelle geprüft: Das Original-Repo
   `github.com/PolygonalMind/100Avatars` (Runde 1) steht unter **CC BY 4.0** (Datei `CCLicense.md`; README: frei nutzbar,
   nur nicht unverändert verkaufen). Die Sammelseite opensourceavatars.com nennt CC0, das gilt dafür nicht. Also nutzbar
   mit Nennung in `assets/CREDITS.md` und im Info-Panel. Dateien je Avatar als FBX und VRM, Skelett von Mixamo
   (passt zur Universal Animation Library). Noch nicht geladen; welche Avatare Tiere sind, im Repo nachsehen.

Weitere Kandidaten aus der Recherche: Detective Bunny (OpenGameArt, CC0, eigene Animationen), Chibi Sloth (Sketchfab,
CC BY, nur 3 Animationen), Styloo „Chibi Characters“ (itch.io). Animationen lassen sich leichter ergänzen als Modelle:
Bei gleichem Skelett ist eine neue Animation nur ein weiterer Eintrag beim Export.

**Vergleichen:** Im Schrein-Panel unter „Test: Gestalten auf der Insel“ schaltet „Alle Gestalten“ alle übrigen
Gestalten als Statisten dazu (`src/creature/parade.js`, `S.testParade`). Sie wandern, stehen, machen Gesten, arbeiten
aber nicht. 11 Statisten: rund 4 s Laden, etwa 2 ms Rechenzeit pro Bild am Rechner.

**Fuchsmensch, Stand 16.10.:** Gesicht nach Vorlagen (dreieckig mit hellem Wangenfell, breiter Schnauzenansatz, längere
Schnauze mit Unterkiefer, bernsteinfarbene Augen mit Pupille flach im Kopf, größere Ohren, helle Kehle); Beine getrennt
(Bauch endet höher, schmales Becken); eigene Bewegungen per Pose im Bauskript (`posen()`): `Curl_Down`/`Curl_Idle`
(eingerollt auf der Seite schlafen, Augen zu), `Lift_Ground` (bücken, Baum mit beiden Händen greifen, aufrichten),
`Hold_Idle`. Im Spiel wechselt der gefällte Baum beim Greifen in die Hände (`LIFT_GRAB` in `creature/ai.js`).

**Ideen für weitere Arten:** Löwenmensch (große, dunklere goldbraune Mähne als Ring um Kopf und Hals, kurze breite
Schnauze mit breiter Nase, kleine runde Ohren, Quaste am Schwanzende). Erst nachdem der Fuchsmensch richtig gut ist.

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

## 5. Nächster Schwerpunkt: Lebendigkeit, Mimik, Fell (Wunsch 16.10.)

Ziel: Der Spieler soll sich mit dem Tier verbinden und identifizieren; heute wirkt der Fuchsmensch noch flach und steif.

1. **Kopf und Blick** (im Code, über den Animationen): Kopf und Nacken drehen sich zu Hand, Kamera, Bewohnern oder dem
   Arbeitsziel, die Augen (Pupillen) folgen, regelmäßiges Blinzeln.
2. **Ohren** mit eigenen Knochen: aufstellen, anlegen, zucken (neugierig, ängstlich, beleidigt).
3. **Maul**: Kieferknochen (öffnen/schließen: Gähnen, Bellen, Fressen, zu Geräuschen); Formziele (Shape Keys) für Lächeln,
   Schmollen, Zähnezeigen; Platz für ein angedeutetes Gebiss.
4. **Augenlider und Brauen** als eigene Formen statt flach gedrückter Augen: Freude, Ärger, Trauer, Müdigkeit.
5. **Gefühle verknüpfen** mit Lob, Tadel, Hunger, Müdigkeit, Laune (und dem „Warum“ aus `mind.js`).
6. **Geräusche**: kurze Fuchslaute (Fiepen, Keckern, Bellen), freie Lizenz (CC0), synchron zum Maul.
7. **Fell in der Nahsicht**: Schalen-Fell wie beim alten Fell-Fuchs (`addFur`, Maske `_FUR`), aber nur 4–6 Schalen
   (etwa 30.000–40.000 Dreiecke) und nur zugeschaltet, wenn die Kamera nah ist; Fellmaske: buschig an Schwanz,
   Wangen, Brust, kurz an Schnauze und Pfoten. Auf dem Handy messen. **Erste Stufe: Fell nur im Gesicht** (Wangen,
   Stirn, Ohren, Kehle) – kostet einen Bruchteil und wirkt dort, wo man hinschaut; der ganze Körper nur, wenn es reicht.

## 5a. Stand Gesicht (16.10., Nachmittag)

Nach Fotos echter Rotfüchse überarbeitet (Bauskript, nur Art `fox`):

- **Form:** Kopf oben breit, läuft als Dreieck zur Schnauze; Schnauze als flacher Keil (als runder Kegel sah sie von
  oben wie ein Rohr aus); Augen in Höhlen unter einem Stirnwulst, Höhle leicht abgedunkelt; Wangenfell mit Büscheln als
  weichem Wulst (Büschel-Kegel nur ohne Schalenfell, sonst wirken sie wie Finger); dunkle Tränenlinie.
- **Teile am Kopfknochen:** Mandelaugen (`EyeL/R`, schräg), dunkler Rand (`EyeRimL/R`), schmale Pupille (`EyePupilL/R`),
  Nase, dunkler Mundraum (`Mouth`); Unterkiefer (`Jaw`) am Knochen `jaw`.
- **Ohren:** flach wie echte Ohren, innen dunkle Muschel mit hellen Haarbüscheln (`EarTuft…`, am Ohrknochen), Rücken
  dunkel; Knochen `ear_l`/`ear_r` (vor/zurück, zur Seite, um die Längsachse drehen wie eine Katze).
- **Detailstufe:** `TM_TRIS` (Standard 40.000) und `TM_VOXEL` (0,009); fürs Handy später z. B. 7.000 / 0,018 oder das
  Detailmodell nur in der Nahsicht laden.
- **Fallen beim Gewichten:** Ohr- und Kieferknochen nehmen an der automatischen Gewichtung nicht teil (sie liegen im
  Kopf und zogen Stirn und Schnauze an sich; nach dem Löschen blieben Punkte ohne Knochen, das Gesicht riss in jeder
  Animation auf). Kleine Inseln nach dem Verschmelzen entfernen, sonst scheitert die Gewichtung ganz. Immer auch in
  einer Animation ansehen, nicht nur in der Grundpose.
- **Im Spiel (`src/creature/face.js`):** Lider im Shader auf dem Auge (ragen nie über den Rand; Höhe, Schräge,
  Biegung frei), Blinzeln, Pupillen folgen dem Blick mit kleinen Sprüngen, Brauen, Ohren mit Zucken, Kiefer, Kopf und
  Nacken drehen sich zum Ziel (Hand, im Test die Kamera). Ausdrücke in `EXPR` (Ruhig, Neugierig, Fröhlich, Übermütig,
  Stolz, Müde, Traurig, Beleidigt, Wütend, Ängstlich, Schläft). Ansehen: Charakterbogen → „Animationen testen“ → Mimik,
  „Gesicht nah“ (Tele, sonst verzerrt der Weitwinkel die Schnauze). Zweibeiner empfangen keine Schatten mehr (eckige
  Flecken im Gesicht).
- **Brauen:** keine eigenen Teile (wirkten aufgeklebt), sondern ein heller Fleck im Fell über dem inneren Augenwinkel;
  den Ausdruck tragen die Lider.
- **Maul:** Unterkiefer als Keil (`Jaw`, vorn schmal, mit kurzem Schalenfell), dunkler Mundraum (`Mouth`), Zunge (`Tongue`, am Kiefer),
  zwei Eckzähne (`FangL/R`).
- **Schalenfell im Gesicht:** Fellmaske `_FUR` aus dem Bauskript (Export mit `export_attributes`): lang an den Wangen,
  mittel auf Stirn und Kehle, kurz auf der Schnauze, frei an Augen und Nase. Im Spiel (`face.js`, `FACE_FUR`) nur die
  Dreiecke mit Fell als 7 (Handy) bzw. 14 Schichten mit gleichmäßigen, an der Wurzel dicken Strähnen, gekämmt nach hinten, sichtbar wenn die Kamera näher als 11 ist.
  Haare hängen an der Ruhelage der Haut. Auf dem Handy noch messen.
- **Körper (16.10., Abend):** Gliedmaßen als Profile entlang der Knochen (`loft` im Bauskript) statt Röhren:
  kräftige Schulter, Unterarm mit Fellbausch, Pfote mit Fingern an den Fingerknochen; Oberschenkel massig, schlankes
  Knie, Wade, Sprunggelenk, lange Hinterpfote mit Zehenballen. Schwarzbraune „Strümpfe“ mit weichem Verlauf (Arme ab
  dem Ellbogen, Beine ab dem Knie) statt Handschuhen. Rumpf ebenfalls als Profil entlang der Wirbelsäule (Becken, schlanke Taille, gewölbte
  Brust mit Fellbausch, Schultern, Hals); weißer Brustlatz, nach unten schmaler; Schalenfell auch an Hals und Brustlatz;
  Schwanz als durchgehendes Profil statt Kugelkette.
- **Kopf von der Seite:** Schädel flacher und kürzer nach hinten, Übergang Stirn–Schnauze, Kinn und Kehle unter dem
  kräftigeren Unterkiefer; Schnauze kürzer (0,25); Kinnfell. Falle: Animationen ohne Spur für Kopf/Hals (beim Export
  weggefallen, weil unverändert) setzen den Knochen nicht neu, Zusatzdrehungen in `face.js` summierten sich dann auf
  (Kopf drehte sich beim Dösen); jetzt wird vom Stand vor der letzten Zusatzdrehung gerechnet.
- **Noch offen:** Stimmungsgerüst (Ausdruck aus Stimmung und Alter statt fest), Fell auf der Stirn noch körnig,
  Geräusche.
- **Lokal testen:** Läuft kein Server, zeigt der Service Worker den letzten Stand aus dem Cache (sieht aus wie „alt“).
  Fürs Handy `weltenkeim-lan` (Port 8000) starten.
- **Vorlage für echte Vierbeiner** (falls wir umschwenken): „Fox“ von AIUM2 auf Sketchfab (CC BY 4.0, bearbeitbar);
  „Fox Idle“ von kenchoo ist CC BY-NC-ND (nicht nutzbar, nur Vorbild). Die Gesichtssteuerung hängt nur an benannten
  Teilen und ließe sich übertragen.

## 6. Offene Punkte (Stand Ende 16.10.)

Vereinbart: **vorerst nur am Fuchsmenschen arbeiten**, bis er richtig gut ist; erst dann auf andere Arten (Bär, Löwe …)
übertragen.

- Werkzeuge zum Ansehen im Spiel: Charakterbogen → „Animationen testen“ (Kreatur hält an, jede Animation einzeln,
  `src/ui/animtest.js`); Schrein → „Nur gewählte Gestalt“ / „Alle Gestalten“ (Statisten, `src/creature/parade.js`).
- Dösen: Rumpf liegt jetzt auf, die untere Hand ragt noch etwas in den Boden; im Spiel nachprüfen.
- Übergang Stehen → Einrollen kippt eher seitlich um; schöner wäre: erst hinsetzen, dann einrollen.
- Aufheben: Hände reichen noch nicht ganz bis zum Boden; Baum wechselt beim Greifen in die Hände.
- Weitere eigene Bewegungen per Pose im Bauskript (`posen()`): z. B. Jubeln, Springen, beleidigt wegdrehen, wütend
  aufstampfen. Tanzen gibt es fertig (`Dance_Loop` in UAL1, noch nicht exportiert).
- Gesicht: ohne Mimik; Hände ohne Finger-Form; Tragkraft und Werfen noch wie beim Fuchs (3.12 G 3).
- Fuchs-Reaktion auf Lob/Tadel (Schwanz wedeln) gibt es für Zweibeiner nicht; dort `Yes`/`Idle_No_Loop`.
