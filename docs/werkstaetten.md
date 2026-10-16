# Werkstätten und Rohstoffe

Neue Werkstätten des Dorfes und die Rohstoffe, die sie verarbeiten. Bestehende Werkstätten (Sägemühle, Mühle,
Bäckerei) stehen im Code (`village/workshops.js`, `PROC` in `core/state.js`). Die Sattlerei für die Ausrüstung der
Kreatur steht in `kreatur.md` 3.13 B, die Kreatur selbst in `kreatur.md`.

## 1. Steinbruch, Steinmine und Steine

**Stand:** ✅ vorhanden – Steinbruch, Mine, Ware Steine; die Kreatur bringt Felsen zum Steinmetz

### A. Warum

- Felsen hatten keinen Zweck. Die Kreatur kann sie schon bewegen (Stier schiebt sie, Fuchs hebt sie mit Lichtranken,
  `kreatur.md` 3.13), ihre Lage steht im Spielstand (`S.rocks`).
- Steine sind eine neue Ware für gepflasterte Wege (3) und Steinhäuser (4).

### B. Steinbruch (Steinmetz) ✅

- Arbeitsstätte **Steinbruch**, Beruf **Steinmetz** (`mason`), Hütte **Steinmetzhütte** (KayKit-Schmiede,
  `hut.mason`) auf einem der Hüttenplätze am Waldrand, mit Steinhaufen davor.
- Der Steinmetz sucht den nächsten freien Felsen (bis 22 Einheiten von der Hütte), stellt sich daneben und schlägt
  mit der Spitzhacke Steine ab (graue Splitter). Jede Runde bringt einen Stein, der Felsen wird kleiner
  (`ROCK_STEP`), er rückt nach. Unter einer Mindestgröße ist der Felsen **abgebaut** und verschwindet
  („Felsen abgebaut“). Je zwei Steine legt er an der Hütte ab, Träger bringen sie ins Lager.
- Felsen sind damit endlich: Ein großer Findling gibt etwa 15 bis 20 Steine.

### C. Steinmine am Berg ✅

- Arbeitsstätte **Steinmine**, Beruf **Bergmann** (Mehrzahl Bergleute, `miner`), Modell KayKit-Mine (`hut.mine`).
- Es gibt **eine** Mine: am felsigen Hang (Höhe 2,5 bis 4,4), mindestens 10,5 Einheiten vom Dorfplatz, mit Abstand
  zu Häusern samt Gärten, Hütten und Höfen, Eingang talwärts. Der Platz wird beim ersten Mal gewählt und gespeichert
  (`S.mineAt`), weil das Einebnen beim Bau den Hang verändert.
- Bergleute gehen in den Stollen (unsichtbar, am Eingang staubt es), kommen nach 7 bis 10 Sekunden mit zwei Steinen
  heraus und legen sie am Steinhaufen ab. Die Mine geht nie zur Neige, liegt aber weit draußen.

### D. Ware Steine ✅

- `S.stone`, im Lager angezeigt (eigenes Symbol, sichtbar ab Steinbruch oder Mine), hinter der Lagerhalle wachsen
  Steinstapel mit dem Vorrat. Bewohner tragen Steine in den Armen (`carry` 11).

### E. Die Kreatur bringt Felsen ✅

- Gibt es eine Steinmetzhütte, liegt neben ihr ein **Ablageplatz** für Felsen (`masonYard` in `village/ai.js`, vier
  Plätze seitlich der Hütte).
- **Stier:** Felsenschieben ist dann öfter seine Hilfe aus eigenem Antrieb. Er sucht einen mittelgroßen Felsen (bis
  18 Einheiten entfernt, höchstens 24 vom Ablageplatz), stellt sich dahinter und schiebt ihn mit gesenktem Kopf den
  **ganzen Weg** bis zur Hütte: Er folgt der Wegfindung um Häuser und Bäume herum, der Felsen bleibt vor seiner Stirn,
  rollt ein wenig und wirbelt Staub auf („Felsen beim Steinmetz“). Bleibt er hängen, lässt er den Felsen liegen.
- **Fuchs:** Das Ritual „Felsen versetzen“ trägt den Felsen mit Lichtranken zum Ablageplatz statt nur ein Stück vom
  Dorf weg; die Flugzeit wächst mit der Entfernung.
- So gebrachte Felsen merkt sich der Spielstand (`S.rocks`, neuntes Feld), und der Steinmetz baut sie **zuerst** ab.

### F. Offen

- Neue Felsen: ob sie auftauchen (z. B. wenn die Hand tief gräbt oder Berge anhebt) oder knapp bleiben.
- Weitere Verwendungen: Brunnen, Ausbau des Schreins, Steinbrücke über den Bach.

## 2. Bauplätze freiräumen

**Stand:** 🔵 geplant – Umsetzung später

🟡 Erster Teil im Prototyp (Branch `claude/vierbeiner-test`): Neue Felder des Stiers liegen oft auf Felsen; er
schiebt sie vorher weg (`kreatur.md` 3.13).

- Heute halten die Felsen Abstand zu Dorf, Bauplätzen und Feldern (`keepFree` in `world/nature.js`). Künftig dürfen
  am Dorfrand Felsen auch auf Plätzen liegen, die das Dorf erst später braucht (neue Häuser, Hütten, Felder).
- Ein Bauplatz mit Felsen ist **blockiert** und so markiert. Gebaut wird erst, wenn er frei ist.
- **Die Kreatur räumt ihn:** als Hilfe aus eigenem Antrieb (Neigung Helfen), wenn ein blockierter Platz gebraucht
  wird. Der Felsen geht zum Steinmetz, sobald es einen gibt (1), sonst an den Rand des Dorfes.
- Später denkbar: Die Hand kann kleine Felsen greifen und werfen wie Bäume (`gott-und-hand.md`).

## 3. Gepflasterte Wege

**Stand:** ✅ vorhanden

- Grundlage sind die Trampelpfade (`WEAR` in `world/paths.js`): Wo Bewohner oft gehen, wird das Gras zu Erde.
- Liegen Steine im Lager, holen **freie Bewohner** (Träger) einzeln einen Stein und pflastern damit eine gut
  ausgetretene Stelle (`paveSpot`): nah am Dorf, bevorzugt neben schon gepflasterten Stellen, so wachsen die Straßen
  vom Dorf aus weiter. Sie knien und klopfen den Stein fest („Weg gepflastert“). Ein Stein pflastert die
  ausgetretenen Punkte im Umkreis von 0,8 Einheiten.
- Gepflastert ist dauerhaft wie bei einer Römerstraße: je Geländepunkt vier flache, leicht unregelmäßige Steine, die
  der Neigung folgen, mit dunklen Fugen dazwischen (`palette.terrain.pave`, `pave2`, `paveJoint`; ein InstancedMesh,
  höchstens 16 000 Steine, alle zwei Sekunden der Geländehöhe nachgeführt). Der Weg wächst nicht mehr zu, auf
  Pflaster gehen Bewohner um ein Drittel schneller.
- Spielstand: `S.paved` (Liste der gepflasterten Geländepunkte, gilt nur bei gleicher Rastergröße `S.pathsN`).

## 4. Steinhäuser

**Stand:** ✅ vorhanden

- Wird der Platz knapp (Bewohner höchstens 3 unter der Höchstzahl) und liegen genug Steine im Lager, baut das Dorf
  ein Holzhaus zum **Steinhaus** aus: 6 Bretter und 8 Steine, Bauzeit wie ein Haus (Gerüst).
- Ein Steinhaus bietet **2 Seelen mehr** Platz und hebt die Höchstzahl der Bewohner um 2 (`cap()` in
  `core/state.js`). Ohne Steinhäuser bleibt es bei 40 Bewohnern.
- Aussehen: halbhoher Sockel aus Bruchsteinen rund um das Haus, vorn mit Lücke für die Tür (Grundfläche `base` im
  Theme je Hausform).
- Spielstand: `S.stoneHouses` (Nummern der ausgebauten Häuser).
- Offen: ein eigenes, größeres Hausmodell aus Stein statt des Sockels.

## 5. Reihenfolge

1. ✅ Steinbruch, Steinmine und Ware Steine (1).
2. ✅ Verwendung: gepflasterte Wege (3) und Steinhäuser (4).
3. ✅ Die Kreatur bringt Felsen zum Steinmetz (Stier schiebt, Fuchs mit Lichtranken).
4. Felsen auf späteren Bauplätzen, Freiräumen durch die Kreatur (2).
