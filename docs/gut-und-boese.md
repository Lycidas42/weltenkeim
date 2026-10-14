# Gut und Böse – der Spieler als Gott

Bisher ist der Spieler immer ein guter Gott: Er hilft, wirkt segensreiche Wunder, die Bewohner beten aus Liebe.
Wie in *Black & White* soll er auch böse sein können. Eine **Waage aus Gut und Böse** zeigt, wohin er sich entwickelt,
und Welt, Hand, Bewohner und Kreatur verändern sich sichtbar mit.

Verwandt: `kreatur.md` (Ausrichtung der Kreatur), `hand-und-wunder.md` (Hand vs. Wunder).

## 1. Die Waage

- Ausrichtung des Gottes `S.align` von −1 (böse) bis +1 (gut), Start 0 oder leicht gut.
- Jede Tat verschiebt die Waage ein wenig; große Taten mehr. Ältere Taten verblassen langsam (die Waage pendelt
  nicht dauerhaft am Rand fest, außer man bleibt dabei).
- **Anzeige:** kleine Waage im Kopfbereich (z. B. im Glaube-Feld oder am Schrein): zwei Schalen, links hell (Gut),
  rechts dunkel (Böse), Zeiger dazwischen. Beim Ausschlag kurze Animation („Die Waage neigt sich zum Guten“).
- Im Schrein-Panel: Verlauf der letzten Taten mit ihrem Gewicht.

## 2. Gute und böse Taten des Gottes

| gut | böse |
|---|---|
| Bewohnern bei der Arbeit helfen (ernten, tragen, säen …) | Bewohner packen und hart werfen („Uff!“), ins Wasser werfen |
| Regen auf Felder und Wald, Eile für Arbeiter | Felder zertrampeln oder abernten, bevor sie reif sind (Ernte verdirbt) |
| Bitten der Bewohner erfüllen (Regen, Eile …) | Bitten ignorieren bzw. verstreichen lassen (leicht), das Gegenteil tun (stark) |
| Setzlinge pflanzen, Wald heilen | Bäume ausreißen ohne Not (wenn kein Holz gebraucht wird), Wald abholzen |
| Kreatur loben für gute Taten | Kreatur loben für Unfug, grundlos schlagen |
| Wild schonen, Fische nachwachsen lassen | Wild ausrotten, alle Fische greifen |
| | **böse Wunder** (neu): Blitz/Feuer auf Gebäude, Dürre, Plage (Schädlinge auf Feldern), Sturm |

- Böse Taten sind nicht „verboten“, sondern ein anderer Spielweg: Bewohner gehorchen aus Furcht, Glaube kommt aus Angst.
- Werfen von Bewohnern ist heute schon möglich und sollte künftig gegen die Waage zählen (wiederholt, hart, ins Wasser).

## 3. Was sich mit der Waage verändert

- **Bewohner:** gut → beten aus Liebe, winken, singen, arbeiten zufrieden; böse → ducken sich, wenn die Hand naht,
  beten aus Furcht (Glaube kommt trotzdem, evtl. schneller, aber unregelmäßiger), arbeiten schneller unter Angst,
  fliehen vor der Hand.
- **Welt:** gut → kräftige Farben, Blumen, Sonnenschein häufiger; böse → fahlere Farben, kahle Bäume am Schrein,
  häufiger Gewitter, dunkle Wolken über dem Schrein.
- **Schrein:** gut → hell, Blüten, goldenes Leuchten; böse → dunkler Stein, rote Glut, Dornen.
- **Hand:** siehe 4.
- **Kreatur:** hat ihre eigene Ausrichtung (`kreatur.md`), wird aber vom Vorbild des Gottes beeinflusst
  (sieht sie böse Taten, lernt sie diese).
- **Wunder:** gute Wunder werden bei guter Ausrichtung günstiger, böse bei böser.

## 4. Die Hand: Styling und Veränderung durch Gut/Böse

### 4.1 Styling durch den Spieler (vorhanden, ausbauen)

- Heute: `S.handStyle` mit Hautfarbe, Nägeln, Ärmel und Saum (Farben im Hand-Panel).
- Ausbau: Ärmelmuster, Ringe/Armreif, Tätowierungen bzw. Bemalung, Leuchten der Fingerspitzen, Handschuh.
- Freischaltbar über Glaube oder Meilensteine (z. B. Tempelstufe).

### 4.2 Veränderung durch die Waage (automatisch, über dem Styling)

- Das Styling des Spielers bleibt die Grundlage; die Ausrichtung legt sich stufenweise darüber:
  - **gut:** weichere, hellere Haut, sanfter goldener Schimmer, Blütenblätter oder Funken bei Berührung,
    runde gepflegte Nägel, Saum golden.
  - **neutral:** wie gestaltet.
  - **böse:** dunklere, aschfahle Haut mit roten Adern, lange spitze Krallen, rauchiger Schleier, glühende
    Fingerspitzen, Saum dunkelrot; Berührung lässt Gras welken.
- Technisch: Material-Tönung und Emissive je Stufe, Nägel als eigenes Material (vorhanden) mit Morph/Skalierung
  zu Krallen, Partikel (Funken bzw. Rauch) an der Hand; Haltungen bleiben gleich.
- Rückweg möglich: Wer wieder gut handelt, dessen Hand wird langsam wieder hell.

## 5. Spielstand (Vorschlag)

- `S.align` – Waage −1 … +1.
- `S.deeds` – letzte Taten (kurze Liste für den Verlauf im Schrein-Panel).
- `S.handStyle` – erweitert um Muster/Schmuck (abwärtskompatibel).

## 6. Vorgeschlagene Reihenfolge

1. Waage (`S.align`) + Anzeige + Zählen der vorhandenen Taten (Werfen, Helfen, Bitten erfüllen/ignorieren, Regen).
2. Hand verändert sich mit der Waage (Tönung, Schimmer/Rauch, Krallen).
3. Bewohner reagieren (Furcht vs. Freude), Glaube aus Liebe/Furcht.
4. Böse Wunder (Blitz, Dürre, Plage).
5. Welt und Schrein verändern sich.
6. Styling der Hand erweitern.
