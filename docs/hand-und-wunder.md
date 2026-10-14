# Hand und Wunder – klare Trennung

Problem: Die Hilfen der Hand (`handHelp`/`helpAt` in `game.js`) machen Wunder fast überflüssig, z. B. ersetzt
„Gießen mit der Hand“ das Wunder Regen. Es braucht eine eindeutige Regel, was die Hand tut und was nur Wunder können.

## Grundregel

**Die Hand tut, was auch ein Bewohner mit seinen Händen tun könnte – nur eben als Gott: ein Ziel, sofort, kostenlos.**
Ihr Preis ist die Aufmerksamkeit des Spielers (immer nur eine Sache, Tipp für Tipp).

**Wunder tun, was kein Bewohner kann – übernatürlich, auf einer Fläche oder auf viele Ziele, kostet Glaube.**
Ihr Preis ist Glaube; dafür wirken sie groß und anhaltend.

Prüffrage für jede neue Aktion: *Könnte ein Dorfbewohner das mit Werkzeug und Muskelkraft?*
Ja → Hand. Nein (Wetter, Zeit, Geist, Natur beeinflussen) → Wunder.

## Einordnung der bisherigen Hand-Aktionen

| Aktion | heute | künftig | Begründung |
|---|---|---|---|
| Feld ernten | Hand | **Hand** | körperliche Arbeit |
| Feld säen | Hand | **Hand** | körperliche Arbeit |
| Feld gießen | Hand | **Wunder Regen** | Wasser vom Himmel ist Sache der Götter; Regen wirkt auf Fläche und alle Felder darin |
| Vieh füttern (Milch, Eier, Fleisch holen) | Hand | **Hand** | körperliche Arbeit |
| Fisch greifen | Hand | **Hand** (ein Fisch pro Tipp) | körperlich; ein Schwarm herbeirufen wäre ein Wunder |
| Wild bannen | Hand | **Wunder „Bann“** (neu) | übernatürlich: Tiere erstarren lassen |
| Erlegtes Wild aufheben | Hand | **Hand** | Tragen |
| Setzling pflanzen | Hand | **Hand** | körperliche Arbeit; viele Bäume auf einmal wachsen lassen = Regen/Wachstum |
| Waren der Hütte ins Lager | Hand | **Hand** | Tragen (Arbeit der Träger) |
| Säge/Mühle/Bäckerei sofort verarbeiten | Hand | **entfällt** → Wunder Eile | Sofort-Produktion ist übernatürlich; Eile beschleunigt die Arbeiter dort |
| Bäume ausreißen, Bewohner packen/werfen | Hand | **Hand** | Kraft der Hand, wie bisher |
| Große Mengen von A nach B tragen (Stapel packen, halten, abladen) | – | **Hand** (neu) | Transport; die Kreatur kann es durch Zusehen lernen (`kreatur.md` 4.7) |
| Bewohner sanft an einem Ort absetzen | (nur werfen) | **Hand** | gute Tat; Werfen bleibt böse (`gut-und-boese.md`) |

## Wunder (heute und Vorschläge)

| Wunder | Wirkung | Kosten |
|---|---|---|
| Regen (vorhanden) | Fläche: Bäume wachsen, Setzlinge sprießen, Felder werden gegossen (wachsen eine Weile doppelt so schnell), Pfützen | 20 Glaube |
| Eile (vorhanden) | Fläche: Bewohner arbeiten und gehen schneller – auch in Werkstätten | 12 Glaube |
| Bann (neu) | Fläche: Wild in der Nähe erstarrt eine Weile, Jäger treffen sicher | ca. 10 Glaube |
| Segen der Ernte (Idee) | Fläche: Felder reifen sofort ein Stück weiter / Ertrag +50 % | teuer |
| Fischzug (Idee) | ruft einen Schwarm an eine Küstenstelle | mittel |
| Wildlocken (Idee) | lockt Wild an einen Ort | mittel |

## Hand stärken (Schrein)

Heute erhöht „Hand stärken“ am Schrein (`S.hand`, Kosten `handCost`) nur Reichweite und Kraft beim Formen.
Künftig soll jede Stufe die **Hand insgesamt** stärker machen:

| Bereich | pro Stufe (Vorschlag) |
|---|---|
| Formen | Reichweite und Kraft +35 % (wie heute) |
| Tragen / große Transporte | mehr auf einmal (z. B. Stufe 1: 6 Stück, jede Stufe +4) |
| Waren von Hütten ins Lager | statt allem Wartenden bis zu einer Menge je Stufe; höhere Stufen leeren auch Nachbarhütten |
| Felder | Stufe 1: ein Feld je Tipp; ab Stufe 2 auch die angrenzenden Felder (säen/ernten in einem Zug) |
| Vieh füttern | ab höherer Stufe beide Koppeln und Hühner zugleich |
| Fische greifen | mehr Fische pro Griff (kleiner Schwarm) |
| Bäume ausreißen | schneller, auch große Bäume; ab hoher Stufe zwei auf einmal |
| Bewohner packen | mehrere Bewohner auf einmal tragen/absetzen |

- Der Beschreibungstext im Schrein-Panel (`desc` des Eintrags `hand`) nennt dann die konkreten Verbesserungen der nächsten Stufe.
- Die Kreatur lernt nur, was die Hand ihr vormacht – eine starke Hand zeigt ihr also auch größere Arbeit.

## Aussehen der Hand

- **Styling durch den Spieler:** heute Haut, Nägel, Ärmel, Saum (`S.handStyle`); ausbauen um Muster, Schmuck, Leuchten.
- **Veränderung mit Gut/Böse:** über dem Styling legt sich je nach Waage ein heller, goldener Schimmer (gut) oder
  aschfahle Haut, Krallen und Rauch (böse). Details in `gut-und-boese.md`.
- **Böse Taten mit der Hand** (Bewohner werfen, Felder zertrampeln, Bäume ohne Not ausreißen) zählen auf die Waage.

## Folgen für die Kreatur

- Hand-Aktionen lernt sie durch **Vormachen mit der Hand** (siehe `kreatur-lernen.md`).
- Wunder lernt sie durch **Zusehen beim Wirken** und wirkt sie mit Glaube aus dem Vorrat (erlaubbar).
- Dadurch bleibt die Trennung auch für die Kreatur klar: körperliche Arbeit vs. göttliche Macht.

## Umsetzung (wenn freigegeben)

1. Gießen aus `helpAt` entfernen; Hover-Anzeige über wachsenden Feldern zeigt nur den Reifegrad und den Hinweis „Regen lässt es schneller wachsen“.
2. Sofort-Verarbeitung in Werkstätten entfernen; Eile wirkt auf Säger, Müller, Bäcker (tun sie heute schon über `v.haste`).
3. Bannen als neues Wunder „Bann“ im Wunder-Menü (Fläche, Radius wie Eile), aus `helpAt` entfernen.
4. Weitere Wunder-Ideen nach Bedarf.
