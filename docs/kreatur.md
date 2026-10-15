# Die Kreatur (Tiergeist) – Gesamtkonzept

Die Kreatur ist neben der Hand die zweite „Hand“ des Spielers in der Welt: ein Tiergeist, der lernt, wächst,
Launen hat und durch die Erziehung gut oder böse wird. Vorbild ist das Spielprinzip von *Black & White*
(Lionhead, 2001), angepasst an ein entspanntes, handyfreundliches Aufbauspiel.

Verwandte Dokumente: `kreatur-lernen.md` (Lernen durch Vormachen), `nahrung.md` (Essen).

---

## 1. Ist-Stand in Weltenkeim

- **Gestalten:** Fuchs (Fell-Modell, eigene Reaktionen), Wolf, Hirsch, Stier, Alpaka, Katze. Name und Geschlecht wählbar
  (Start: Fenja, weiblich). `S.creature`, `S.name`, `S.gender`.
- **Neigungen:** `S.w` mit `help` (Helfen), `play` (Spielen), `mischief` (Unfug); bestimmen, was sie aus eigenem Antrieb tut.
- **Tätigkeiten:** Baum fällen und ins Lager bringen (Helfen), mit dem Dorf spielen, Baum umwerfen (Unfug), dösen,
  eine Geste beim Wunder des Spielers (`foxCast`).
- **Erziehung:** Kreismenü an der Kreatur: Streicheln (Lob) und Klaps (Tadel) verstärken bzw. schwächen die zuletzt
  gezeigte Tätigkeit (`reinforce`). Fuchs reagiert sichtbar (Schwanz wedeln bzw. einklemmen).
- **Kamera:** „Folgen“ hält die Kreatur im Bild.
- **Hand-Hilfen** (`handHelp`) als Grundlage für das spätere Lernen durch Vormachen.

---

## 2. Black & White in Kürze

- Der Spieler ist ein Gott; Macht kommt aus dem Glauben der Dorfbewohner.
- Eine **Kreatur** (Affe, Kuh, Tiger, Wolf …) wird vom Spieler erzogen:
  - **Lernen durch Beobachten:** Sie sieht zu, was die Hand tut (Bäume holen, Wunder wirken …), und ahmt es nach.
  - **Belohnen und Bestrafen:** Streicheln und Schlagen nach einer Tat steuern, ob sie es wieder tut („Essen von
    Dorfbewohnern“ abgewöhnen, „Regen auf Felder“ angewöhnen).
  - **Leinen:** Lern-Leine (sie schaut genau zu), Freundlichkeits- und Aggressions-Leine; an der Leine führt man sie
    irgendwohin oder bindet sie an einen Ort.
  - **Bedürfnisse:** Hunger, Müdigkeit, Spieltrieb, Langeweile, auch Notdurft – sie kümmert sich selbst darum,
    wenn man sie lässt.
  - **Wachstum:** Sie wird mit der Zeit größer und stärker.
  - **Gut/Böse:** Taten und Erziehung verschieben ihre Ausrichtung; das Aussehen verändert sich deutlich
    (gut: hell, freundlich, Leuchten; böse: dunkel, Hörner/Krallen, glühende Augen). Auch die Welt des Gottes
    selbst verändert sich je nach Ausrichtung.
  - **Wunder:** Sie lernt, Wunder zu wirken, und kann es selbstständig (kostet Glauben).
  - **Eigenwille:** Sie gehorcht nicht immer, besonders wenn ihre Bedürfnisse drängen.

---

## 3. Abgleich: Black & White ↔ Weltenkeim

| Black & White | Weltenkeim heute | Vorschlag für Weltenkeim |
|---|---|---|
| Lernen durch Beobachten | – (Hand-Hilfen existieren) | Zuschauen + Fortschritt je Fähigkeit, siehe `kreatur-lernen.md` |
| Belohnen/Bestrafen | Streicheln/Klaps auf help/play/mischief | Pro Fähigkeit und pro Ziel (z. B. „Regen aufs Feld“ gut, „Regen ins Dorf“ schlecht) |
| Leinen | Folgen-Kamera | **Leine anlegen**: führen, an einen Ort binden, „schau zu“ (Lern-Leine) – siehe 4.5 |
| Bedürfnisse | Dösen ab und zu | Hunger, Müdigkeit, Spieltrieb – treiben die Launen, siehe 4.2 |
| Wachstum | feste Größe | **Alter**: Jungtier → ausgewachsen → altehrwürdig, siehe 4.1 |
| Gut/Böse mit Aussehen | Unfug-Neigung ohne Folgen fürs Aussehen | **Ausrichtung** mit sichtbarer Veränderung, siehe 4.3 |
| Wunder wirken | Geste beim Wunder | eigene Wunder (Regen, Eile …), kostet Glaube, erlaubbar |
| Eigenwille | – | **Verweigern** bei schlechter Laune oder gegen die Ausrichtung, siehe 4.4 |
| Bewohner fressen | – | **nicht übernehmen** (Ton des Spiels); böse Variante: erschreckt Bewohner, stiehlt Essen, zertrampelt Felder |
| Kämpfe gegen andere Kreaturen | – | eher nicht; allenfalls später freundliche „Wettkämpfe“ |
| Notdurft | – | weglassen (oder als Dünger auf Feldern, falls gewünscht humorvoll) |
| Welt ändert sich mit Gut/Böse | – | optional: Schrein und Hand ändern ihr Aussehen leicht mit der Ausrichtung |

---

## 4. Konzepte im Detail

### 4.1 Alter und Wachstum

- **Lebensabschnitte:** Jungtier (klein, verspielt, lernt schnell, vergisst leicht) → ausgewachsen (volle Größe,
  stark, lernt normal) → altehrwürdig (etwas grau, weise: lernt langsamer, vergisst nichts, Wunder günstiger).
- Fortschritt über **Spielzeit** (z. B. Spieltage `S.hour`-Wechsel) und **Erfahrung** (ausgeführte Tätigkeiten).
- **Größe** wächst sanft (z. B. 0,7 → 1,0 → 1,1 der heutigen Größe); stärkere Kreaturen tragen größere Bäume,
  heben mehr auf einmal.
- Kein Tod; „altehrwürdig“ ist das Endstadium.

### 4.2 Bedürfnisse und Launen

- **Bedürfnisse** (0…1, steigen mit der Zeit): Hunger, Müdigkeit, Spieltrieb.
  - Hunger → frisst aus dem Lager (Lieblingsessen je Art), Fisch am Ufer, Obst von Obstbäumen.
  - Müdigkeit → schläft (nachts bevorzugt, nach viel Arbeit auch tagsüber).
  - Spieltrieb → spielt mit Bewohnern, jagt Vögel auf, tollt im Wasser.
- **Laune** ergibt sich daraus plus jüngstem Lob/Tadel: fröhlich, zufrieden, mürrisch, erschöpft, übermütig.
- Laune wird sichtbar: Haltung (Kopf/Schwanz), Tempo, kleine Symbole in der Einblendung, Text „Fenja ist mürrisch“.
- Laune wirkt auf: Lerntempo, Gehorsam, Wahl der Tätigkeiten (mürrisch → mehr Unfug, übermütig → mehr Spiel).

### 4.3 Gut und Böse (Ausrichtung)

- **Ausrichtung** `-1 … +1`, bewegt sich langsam durch:
  - ihre Taten: helfen, gießen, ernten, Bewohner schützen (+); Bäume umwerfen, Felder zertrampeln, Bewohner
    erschrecken, Essen stehlen (−);
  - die Erziehung: Lob für gute Taten (+), Lob für Unfug (−), Tadel ohne Anlass (leicht −, sie wird verbittert).
- **Veränderung des Aussehens** (stufenweise, gut sichtbar):
  - gut: helleres, weicheres Fell, sanfter Lichtschein, Blüten/Glühwürmchen um sie, freundliche Augen;
  - böse: dunkleres, struppiges Fell, glühende Augen, Schatten-Schleier, Pfotenabdrücke welken das Gras.
  - Technisch: Material-Tönung, Emissive, Partikel; beim Fell-Modell Farbverlauf und Struppigkeit.
- **Veränderung des Verhaltens:** gute Kreatur hilft unaufgefordert, Bewohner winken ihr zu und beten mehr;
  böse Kreatur wird gefürchtet – Bewohner weichen aus, arbeiten aus Angst schneller, aber beten weniger aus Liebe
  (Glaube aus Furcht statt aus Freude: beides möglich, unterschiedliche Spielweise).
- Beide Wege sind spielbar, nicht „falsch“ – wie in Black & White.

### 4.4 Verweigern (Eigenwille)

- Befiehlt der Spieler etwas (über Kreismenü oder Leine), kann sie **zögern oder sich weigern**:
  - wenn ein Bedürfnis drängt (zu hungrig, zu müde),
  - wenn die Laune schlecht ist (kurz zuvor oft getadelt),
  - wenn die Tat ihrer Ausrichtung widerspricht (gute Kreatur verweigert Unfug, böse verweigert Mühe ohne Lohn).
- Sichtbar: schüttelt den Kopf, setzt sich hin, dreht sich weg, Text „Fenja will nicht“.
- Wiederholtes freundliches Bitten oder Erfüllen des Bedürfnisses (füttern, ausruhen lassen) löst es.
- Seltenes Verweigern macht sie lebendig; zu häufiges frustriert – Wahrscheinlichkeit gering halten.

### 4.5 Leine anlegen

- Im Kreismenü: **Leine** – die Kreatur folgt der Hand, bis man loslässt (Spaziergang zum Feld, zum Ufer …).
- **Anbinden:** Leine an einen Ort legen (Pfahl), sie bleibt in der Nähe und arbeitet nur dort (z. B. am Bauernhof).
- **Lern-Leine** (statt drei Leinen wie in B&W nur eine Variante): solange angelegt, schaut sie besonders genau zu –
  Vorführungen zählen doppelt.
- Ohne Leine: freies Leben nach Bedürfnissen und Neigungen.

### 4.6 Was die Kreatur von Anfang an kann

Offen zu entscheiden: Was ist angeboren, was muss gelernt werden? Vorschlag:

- **Angeboren** (Tierverhalten, ohne Vormachen):
  - einen Baum fällen und ins Lager bringen (heute schon),
  - **Waren tragen** – bis zu 3 Stück im Maul (heute schon: von Hütten ins Lager, aus dem Lager zu Säge, Mühle, Bäckerei),
  - spielen, dösen, Unfug.
- **Zu lernen** (durch Vormachen der Hand): Feldarbeit, Füttern, Fischen, Pflanzen, große Transporte (siehe 4.7),
  Bewohner tragen (siehe 4.8), Wunder.
- Denkbar: Jungtiere können anfangs weniger (nur 1 Stück tragen), Ausgewachsene mehr.

### 4.7 Große Transporte mit der Hand (und Lernen dadurch)

- Die Hand soll auch **große Mengen** von A nach B bringen können: z. B. am Lager einen ganzen Stapel Stämme packen
  (gedrückt halten, je länger, desto mehr), in der Hand halten (sichtbar als Bündel/Kiste) und an einer Säge, einem
  Bauplatz oder einer anderen Hütte loslassen.
- Unterscheidung zur heutigen Tipp-Hilfe: Tippen = kleine Arbeit an Ort und Stelle; Packen und Tragen = Transport.
- **Die Kreatur schaut zu** und lernt so, selbst größere Mengen gezielt zu verteilen (z. B. Stämme zur Säge,
  Bretter zur Baustelle, Korn zur Mühle), statt nur 3 Stück.
- Gehört zur Hand, nicht zu den Wundern (körperliche Arbeit, siehe `gott-und-hand.md` Abschnitt 5).

### 4.8 Bewohner vorsichtig tragen

- Die Kreatur kann Bewohner behutsam im Maul (am Kragen) tragen und an einem Ort absetzen – z. B. einen Holzfäller
  zum Wald, einen Bauern zum Hof, einen Erschöpften nach Hause.
- Lernbar durch Vormachen: Die Hand packt einen Bewohner und setzt ihn **sanft** an seinem Arbeitsplatz ab
  (nicht werfen) – das zählt auf die Waage als gute Tat; Werfen bleibt eine böse Tat.
- Eine böse Kreatur trägt Bewohner dagegen weg und setzt sie irgendwo aus oder lässt sie fallen.

### 4.9 Lernen, Fähigkeiten, Wunder

- Siehe `kreatur-lernen.md`: Zuschauen → Fortschritt → gelernt → selbst anwenden → Lob/Tadel je Fähigkeit.
- Wunder: Regen, Eile, später weitere; kosten Glaube; Erlaubnis-Schalter im Kreatur-Panel.
- Böse Kreatur kann Wunder auch böswillig einsetzen (Regen aufs Fest), wenn so erzogen.

### 4.10 Persönlichkeit je Gestalt

- Startwerte je Art, z. B.: Fuchs (verspielt, schlau, lernt schnell), Wolf (treu, kräftig, neigt zu Jagd),
  Hirsch (sanft, groß, langsam), Stier (stark, stur – verweigert öfter), Alpaka (freundlich, eigensinnig),
  Katze (eigenwillig, neugierig, liebt Fisch).
- Lieblingsessen und Lieblingsspiel je Art.
- Eigene Reaktionen auf Lob/Tadel je Art (Fuchs erledigt, übrige offen).

---

## 5. Spielstand (Vorschlag, abwärtskompatibel)

- `S.cAge` – Erfahrung/Alter (Zahl), daraus Lebensabschnitt und Größe.
- `S.cAlign` – Ausrichtung −1 … +1.
- `S.cNeeds` – `{ hunger, tired, play }` 0 … 1.
- `S.skills` – Fähigkeiten (siehe `kreatur-lernen.md`).
- `S.cMiracles` – Erlaubnis Wunder (bool).
- Bestehendes `S.w` bleibt als Grundneigung.

## 6. Vorgeschlagene Reihenfolge

1. Nahrung (Lager hat Zweck) – Voraussetzung für Hunger der Kreatur.
2. Lernen durch Vormachen + Fähigkeiten (Felder zuerst).
3. Bedürfnisse und Launen, Fressen aus dem Lager, Schlafen.
4. Ausrichtung Gut/Böse mit sichtbarer Veränderung.
5. Leine (folgen, anbinden, Lern-Leine).
6. Verweigern.
7. Alter und Wachstum.
8. Wunder wirken durch die Kreatur.
