# Jahreszeiten – Konzept

Frühling, Sommer, Herbst und Winter verändern das Aussehen der Insel und später auch das Spiel (Ernte, Wachstum,
Nahrung). Dieses Dokument sammelt die Wünsche und die technische Grundlage.

Verwandt: `assets.md` 4.1 (Farbrollen), `nahrung.md` (Vorräte für den Winter), `bewohner.md` (Wintersport,
Strand, Kleidung je Jahreszeit). Stand der Features: siehe `README.md`.

## 1. Was sich mit der Jahreszeit ändert

**Stand:** 🔵 geplant

- **Laubbäume:** im Herbst erst verfärben (Eiche orange, Birke gelb, Obstbaum rot), dann nach und nach das Laub
  verlieren, im Winter kahl, im Frühling neu austreiben (helles Grün, Obstbäume blühen). Nadelbäume bleiben grün.
- **Fallendes Laub:**
  - Blätter lösen sich aus den Kronen und trudeln im Wind zu Boden.
  - Am Boden bleiben sie liegen und werden vom Wind weitergeweht (Richtung und Stärke aus dem Wetter).
  - Nach einer Weile verblassen sie.
  - Unter Laubbäumen färbt sich der Boden zeitweise herbstlich.
- **Wiesen:** Gras und Gelände im Sommer satt grün, im Herbst goldbraun, im Winter fahl bzw. verschneit.
  Blumen nur im Frühling und Sommer.
- **Felder und Gärten:** Pflanzen verfärben sich zum Herbst. Im Winter liegen die Felder brach (Spiellogik: keine
  Aussaat), im Frühling wird neu gesät.
- **Büsche:** Blüten im Frühling, Beeren im Spätsommer, braunes Laub im Herbst.
- **Bewohner:** Freizeit je Jahreszeit (Skifahren und Schneemann im Winter, Strand und Surfen im Sommer, Laubhaufen
  im Herbst), im Winter Mütze und Schal, bei Kälte kürzere Abende draußen (`bewohner.md` 6).
- **Wetter:** Häufigkeit der Wetterlagen je Jahreszeit (Schnee nur im Winter; heute hat `schnee` in WEATHER noch
  p = 0 und ist nur von Hand wählbar).

## 2. Technische Grundlage

**Stand:** ✅ vorhanden

- **Farbrollen** (`src/core/colors.js`): Alle im Code gebauten Pflanzen, Felsen, Felder und Gärten tragen je Fläche eine
  Rolle mit Grundfarbe aus dem Theme. `setSlot(rolle, farbe, anteil)` färbt eine Rolle zur Laufzeit fließend um.
  Test in der Konsole:

  ```js
  __wk.setSlot('leaf.oak', 0xd9752b, 1)
  ```

  Damit wird das Laub der Eichen orange.
- **Geländefarben** (`src/world/paths.js`): `setTerrainColor('g1', farbe)` usw. Das Gelände wird schrittweise neu gefärbt.
- Eine Jahreszeit ist damit zunächst eine Tabelle von Zielfarben je Rolle und Geländefarbe, zwischen denen über
  Spieltage überblendet wird.
- **Schnee** (Wetter `schnee`, `src/world/sky.js`): Schneedecke auf allem, was nach oben zeigt; bei Schneefall
  fahler, grauweißer Himmel mit wenig Licht und Dunst.
  - **Fußspuren** (`src/wildlife/tracks.js`): Bewohner, Kreatur, Wild und Vieh hinterlassen Abdrücke, solange Schnee
    liegt. Sie rieseln bei Schneefall schneller zu und verschwinden mit der Schneedecke.
  - **Schmelzwasser:** Taut der Schnee, schwillt der Bach an (`weather.flood`): höher, breiter, trüb, mehr Schaum.
    Nach ein, zwei Minuten fällt er wieder. Regen lässt ihn leicht anschwellen.

## 3. Noch zu bauen

**Stand:** 🔵 geplant

1. **Kalender:** Spieltag und Jahreszeit im Spielstand (z. B. `S.day`); Länge eines Jahres festlegen (etwa 4 × 7
   Spieltage). Anzeige in der Uhrzeit-Kachel (✅ der Spieltag steht dort schon als „Tag 3“, aus `S.day`; die Jahreszeit
   kommt dazu).
2. **Überblenden:** Ein Modul `src/world/seasons.js` berechnet aus Tag und Uhrzeit die Mischung der Jahreszeiten und
   setzt Farbrollen und Geländefarben, z. B. mehrmals pro Spielstunde, damit es fließend wirkt.
3. **Laub lichten:**
   - Ein weiterer Shader-Wert je Farbrolle (Anteil „ausgedünnt“) lässt Teile der Krone verschwinden, in Büscheln statt
     Punkt für Punkt (Muster aus Position im Modell und Lage des Baums, damit nicht alle Bäume gleich lichten).
   - Die Schatten müssen mit ausdünnen (eigenes Tiefenmaterial für die Bäume).
   - Laubbäume brauchen dafür mehr sichtbare Äste, sonst stehen im Winter nur Stöcke da.
4. **Fallendes Laub:** ein Partikelsystem (instanzierte kleine Blätter, ein bis zwei Tausend). Die Blätter starten in
   den Kronen, solange die Rolle ausdünnt, trudeln mit Wind, landen auf dem Gelände (`surfaceAt`), werden vom Wind
   weitergeschoben und verblassen. Farbe aus der aktuellen Laubfarbe des Baums.
5. **Blumen und Blüten:** je Jahreszeit ein- und ausblenden (Größe der Instanzen), Obstblüte im Frühling als eigene
   Farbrolle.
6. **Spiellogik:** Wachstum der Felder und Bäume je Jahreszeit; Ernte im Herbst; Winter mit Vorräten (siehe
   `nahrung.md`).
