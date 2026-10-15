# Die Kreatur (Tiergeist) – Gesamtkonzept

Die Kreatur ist neben der Hand die zweite „Hand“ des Spielers in der Welt: ein Tiergeist, der lernt, wächst,
Launen hat und durch die Erziehung gut oder böse wird – passend zu einem entspannten, handyfreundlichen Aufbauspiel.

Verwandt: `kreatur-lernen.md` (Lernen durch Vormachen), `nahrung.md` (Essen, Lieblingsessen je Art),
`gott-und-hand.md` (Hand, Wunder, Waage), `gut-und-boese.md`, `bewohner.md` (wie das Dorf auf die Kreatur reagiert).
Stand-Begriffe: siehe `README.md`.

## 1. Ist-Stand

- **Gestalten:** Fuchs (Fell-Modell, eigene Reaktionen), Wolf, Hirsch, Stier, Alpaka, Katze. Name und Geschlecht wählbar
  (Start: Fenja, weiblich). `S.creature`, `S.name`, `S.gender`.
- **Neigungen:** `S.w` mit `help` (Helfen), `play` (Spielen), `mischief` (Unfug); bestimmen, was sie aus eigenem Antrieb tut.
- **Tätigkeiten:** Baum fällen und ins Lager bringen (Helfen), Waren tragen (bis zu 3 Stück im Maul: von Hütten ins
  Lager, aus dem Lager zu Säge, Mühle, Bäckerei), mit dem Dorf spielen, Baum umwerfen (Unfug; Bewohner in der Nähe
  fliehen), dösen, eine Geste beim Wunder des Spielers (`foxCast`).
- **Erziehung:** Kreismenü an der Kreatur: Streicheln (Lob) und Klaps (Tadel) verstärken bzw. schwächen die zuletzt
  gezeigte Tätigkeit (`reinforce`). Fuchs reagiert sichtbar (Schwanz wedeln bzw. einklemmen).
- **Kamera:** „Folgen“ hält die Kreatur im Bild (nur Kamera, keine Leine).
- **Hand-Hilfen** (`handHelp`) als Grundlage für das spätere Lernen durch Vormachen.

## 2. Überblick: was dazukommt

| Bereich | Kurz | Abschnitt |
|---|---|---|
| Alter und Wachstum | Jungtier → ausgewachsen → altehrwürdig | 3.1 |
| Bedürfnisse und Launen | Hunger, Müdigkeit, Spieltrieb treiben die Laune | 3.2 |
| Ausrichtung | eigene Waage mit sichtbarer Veränderung | 3.3 |
| Eigenwille | zögern oder sich weigern | 3.4 |
| Leine | der Hand folgen, an einem Pfahl anbinden | 3.5 |
| Lernen und Wunder | Zuschauen → Fortschritt → selbst tun; Lob und Tadel je Fähigkeit und Ziel | 3.6–3.9, `kreatur-lernen.md` |
| Persönlichkeit je Gestalt | Startwerte, Lieblingsessen, Lieblingsspiel | 3.10 |

**Bewusst nicht vorgesehen** (passt nicht zum Ton des Spiels):

- Die Kreatur frisst keine Bewohner. Eine böse Kreatur erschreckt sie, stiehlt Essen und zertrampelt Felder.
- Keine Kämpfe gegen andere Kreaturen; allenfalls später freundliche Wettkämpfe.
- Keine Notdurft (höchstens humorvoll als Dünger auf Feldern).
- Nur eine Art Leine, keine Leinen für Freundlichkeit oder Angriff (3.5).

## 3. Konzepte im Detail

### 3.1 Alter und Wachstum

- **Lebensabschnitte:** Jungtier (klein, verspielt, lernt schnell, vergisst leicht) → ausgewachsen (volle Größe,
  stark, lernt normal) → altehrwürdig (etwas grau, weise: lernt langsamer, vergisst nichts, Wunder günstiger).
- Fortschritt über **Spielzeit** (Spieltage) und **Erfahrung** (ausgeführte Tätigkeiten).
- **Größe** wächst sanft (z. B. 0,7 → 1,0 → 1,1 der heutigen Größe); stärkere Kreaturen tragen größere Bäume,
  heben mehr auf einmal.
- Kein Tod; „altehrwürdig“ ist das Endstadium.

### 3.2 Bedürfnisse und Launen

- **Bedürfnisse** (0…1, steigen mit der Zeit): Hunger, Müdigkeit, Spieltrieb.
  - Hunger → frisst aus dem Lager (Lieblingsessen je Art), Fisch am Ufer, Obst von Obstbäumen.
  - Müdigkeit → schläft (nachts bevorzugt, nach viel Arbeit auch tagsüber).
  - Spieltrieb → spielt mit Bewohnern, jagt Vögel auf, tollt im Wasser.
- **Laune** ergibt sich daraus plus jüngstem Lob/Tadel: fröhlich, zufrieden, mürrisch, erschöpft, übermütig.
- Laune wird sichtbar: Haltung (Kopf/Schwanz), Tempo, kleine Symbole in der Einblendung, Text „Fenja ist mürrisch“.
- Laune wirkt auf: Lerntempo, Gehorsam, Wahl der Tätigkeiten (mürrisch → mehr Unfug, übermütig → mehr Spiel).

### 3.3 Gut und Böse (Ausrichtung)

- **Ausrichtung** `-1 … +1`, bewegt sich langsam durch:
  - ihre Taten: helfen, ernten, Bewohner schützen (+); Bäume umwerfen, Felder zertrampeln, Bewohner
    erschrecken, Essen stehlen (−);
  - die Erziehung: Lob für gute Taten (+), Lob für Unfug (−), Tadel ohne Anlass (leicht −, sie wird verbittert);
  - das Vorbild des Gottes: Sieht sie böse Taten der Hand, lernt sie diese (`gut-und-boese.md`).
- **Veränderung des Aussehens** (stufenweise, gut sichtbar):
  - gut: helleres, weicheres Fell, sanfter Lichtschein, Blüten/Glühwürmchen um sie, freundliche Augen;
  - böse: dunkleres, struppiges Fell, glühende Augen, Schatten-Schleier, Pfotenabdrücke welken das Gras.
  - Technisch: Material-Tönung, Emissive, Partikel; beim Fell-Modell Farbverlauf und Struppigkeit.
- **Veränderung des Verhaltens:** gute Kreatur hilft unaufgefordert, Bewohner winken ihr zu und spielen mit ihr;
  böse Kreatur wird gefürchtet, Bewohner weichen ihr aus (Gefühle und Glaube der Bewohner: `bewohner.md` 9).
- Beide Wege sind spielbar, keiner ist „falsch“.

### 3.4 Verweigern (Eigenwille)

- Befiehlt der Spieler etwas (Kreismenü, Leine), kann sie **zögern oder sich weigern**:
  - wenn ein Bedürfnis drängt (zu hungrig, zu müde),
  - wenn die Laune schlecht ist (kurz zuvor oft getadelt),
  - wenn die Tat ihrer Ausrichtung widerspricht (gute Kreatur verweigert Unfug, böse verweigert Mühe ohne Lohn).
- Sichtbar: schüttelt den Kopf, setzt sich hin, dreht sich weg, Text „Fenja will nicht“.
- Wiederholtes freundliches Bitten oder Erfüllen des Bedürfnisses (füttern, ausruhen lassen) löst es.
- Seltenes Verweigern macht sie lebendig; zu häufiges frustriert – Wahrscheinlichkeit gering halten.

### 3.5 Leine

Einziger Ort für die Leine; die anderen Dokumente verweisen hierher.

**Entschieden (geplant):**

- **Anlegen:** Eintrag „Leine“ im Kreismenü der Kreatur. Ein leuchtendes Band verbindet Hand und Kreatur.
- **Führen:** Die Kreatur folgt der Hand, solange die Leine angelegt ist – auch wenn die Kamera bewegt wird oder die
  Hand gleichzeitig etwas trägt. So bringt man sie zu einem Feld, ans Ufer oder dorthin, wo sie zusehen soll.
- **Anbinden:** Die Hand legt die Leine an einem Punkt der Welt ab; dort entsteht ein Pfahl. Die Kreatur bleibt in
  seiner Nähe (Umkreis einige Einheiten) und sucht sich Arbeit, Spiel und Ruhe nur dort, z. B. am Bauernhof.
- **Lösen:** im Kreismenü oder durch Antippen des Pfahls. Ohne Leine lebt sie frei nach Bedürfnissen und Neigungen.
- **Eigenwille gilt auch an der Leine** (3.4): Sie zieht, bleibt stehen oder legt sich hin, wenn sie nicht will.
- **Nur eine Art Leine.** Keine Leinen, die Freundlichkeit oder Angriff steuern; das Verhalten bestimmen Erziehung
  und Ausrichtung.

**Noch zu klären:**

- Bedienung am Handy zusammen mit „Halten als Zustand“ (`gott-und-hand.md` 3.2): Die Leine wäre etwas, das die Hand
  hält; Anbinden = Leine an einer Stelle absetzen.
- Lern-Leine (Idee): Solange sie angelegt ist, schaut die Kreatur besonders genau zu und Vorführungen zählen
  doppelt (`kreatur-lernen.md` 1). Oder reicht es, sie zum Zusehen mitzunehmen?
- Ziel zeigen (Idee): An der Leine auf ein Feld oder einen Baum tippen, und sie tut dort, was sie kann.

### 3.6 Was die Kreatur von Anfang an kann

Offen zu entscheiden: Was ist angeboren, was muss gelernt werden? Vorschlag:

- **Angeboren** (Tierverhalten, ohne Vormachen): einen Baum fällen und ins Lager bringen, Waren tragen (bis zu
  3 Stück), spielen, dösen, Unfug – alles heute schon vorhanden (1).
- **Zu lernen** (durch Vormachen der Hand): Feldarbeit, Füttern, Fischen, Pflanzen, große Transporte (3.7),
  Bewohner tragen (3.8), Wunder.
- Denkbar: Jungtiere können anfangs weniger (nur 1 Stück tragen), Ausgewachsene mehr.

### 3.7 Große Transporte

- Wie die Hand Stapel packt, trägt und absetzt, steht in `gott-und-hand.md` 5.2.
- **Die Kreatur schaut zu** und lernt so, selbst größere Mengen gezielt zu verteilen (z. B. Stämme zur Säge,
  Bretter zur Baustelle, Korn zur Mühle), statt nur 3 Stück.

### 3.8 Bewohner vorsichtig tragen

- Die Kreatur kann Bewohner behutsam im Maul (am Kragen) tragen und an einem Ort absetzen – z. B. einen Holzfäller
  zum Wald, einen Bauern zum Hof, einen Erschöpften nach Hause.
- Lernbar durch Vormachen: Die Hand setzt einen Bewohner **sanft** an seinem Arbeitsplatz ab (gute Tat,
  `gott-und-hand.md` 3.3); Werfen bleibt eine böse Tat.
- Eine böse Kreatur trägt Bewohner dagegen weg und setzt sie irgendwo aus oder lässt sie fallen.

### 3.9 Lernen, Fähigkeiten, Wunder

- Siehe `kreatur-lernen.md`: Zuschauen → Fortschritt → gelernt → selbst anwenden → Lob/Tadel je Fähigkeit und je Ziel
  (z. B. „Regen aufs Feld“ gut, „Regen ins Dorf“ schlecht).
- Wunder: Regen, Eile, später weitere; kosten Glaube; Erlaubnis-Schalter im Kreatur-Panel.
- Böse Kreatur kann Wunder auch böswillig einsetzen (Regen aufs Fest), wenn so erzogen.

### 3.10 Persönlichkeit je Gestalt

- Startwerte je Art, z. B.: Fuchs (verspielt, schlau, lernt schnell), Wolf (treu, kräftig, neigt zu Jagd),
  Hirsch (sanft, groß, langsam), Stier (stark, stur – verweigert öfter), Alpaka (freundlich, eigensinnig),
  Katze (eigenwillig, neugierig, liebt Fisch).
- Lieblingsessen (`nahrung.md` 4) und Lieblingsspiel je Art.
- Eigene Reaktionen auf Lob/Tadel je Art (Fuchs erledigt, übrige offen).

## 4. Spielstand (Vorschlag, abwärtskompatibel)

- `S.cAge` – Erfahrung/Alter (Zahl), daraus Lebensabschnitt und Größe.
- `S.cAlign` – Ausrichtung −1 … +1.
- `S.cNeeds` – `{ hunger, tired, play }` 0 … 1.
- `S.cLeash` – Pfahl `{ x, z }`, an dem die Kreatur angebunden ist, sonst `null`. Geführt wird nicht gespeichert
  (nach dem Laden ist die Leine von der Hand gelöst).
- `S.skills` – Fähigkeiten (siehe `kreatur-lernen.md`).
- `S.cMiracles` – Erlaubnis Wunder (bool).
- Bestehendes `S.w` bleibt als Grundneigung.

## 5. Vorgeschlagene Reihenfolge

1. Nahrung (Lager hat Zweck) – Voraussetzung für Hunger der Kreatur.
2. Lernen durch Vormachen + Fähigkeiten (Felder zuerst).
3. Bedürfnisse und Launen, Fressen aus dem Lager, Schlafen.
4. Ausrichtung Gut/Böse mit sichtbarer Veränderung.
5. Leine (3.5).
6. Verweigern.
7. Alter und Wachstum.
8. Wunder wirken durch die Kreatur.
