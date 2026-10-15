# Die Kreatur (Tiergeist) – Gesamtkonzept

Die Kreatur ist neben der Hand die zweite „Hand“ des Spielers in der Welt: ein Tiergeist, der lernt, wächst,
Launen hat und durch die Erziehung gut oder böse wird – passend zu einem entspannten, handyfreundlichen Aufbauspiel.

Verwandt: `kreatur-lernen.md` (Lernen durch Vormachen), `nahrung.md` (Essen, Lieblingsessen je Art),
`gott-und-hand.md` (Hand, Wunder, Waage), `gut-und-boese.md`, `bewohner.md` (wie das Dorf auf die Kreatur reagiert).
Stand der Features: siehe `README.md`.

## Leitbild: Bindung

Der Spieler soll sich mit seiner Kreatur verbinden, sich mit ihr identifizieren und sich um sie sorgen – wie in
Black & White oder bei einem Tamagotchi. Daran misst sich jedes Feature der Kreatur:

- **Sie lebt sichtbar:** Kopf und Blick folgen dem, was sie interessiert, sie blinzelt, Ohren und Schwanz zeigen ihre
  Stimmung, das Gesicht zeigt Gefühle (Freude, Ärger, Trauer, Müdigkeit), kurze Laute statt Text.
- **Zuschauen macht Spaß:** wie bei den Bewohnern (schlicht, aber niedlich), nur noch mehr: kleine, gut lesbare
  Handlungen zwischendurch – schnuppern, sich strecken, gähnen, Schmetterlingen nachspringen, mit Bewohnern spielen,
  neugierig etwas untersuchen, sich über einen gefällten Baum freuen. Übertrieben und weich animiert statt steif.
- **Sie bemerkt den Spieler:** schaut zur Hand, freut sich über Zuwendung, begrüßt ihn nach einer Pause, vermisst ihn
  (sichtbar, nicht als Strafe).
- **Sie braucht ihn:** Hunger, Müdigkeit, Spieltrieb und Laune (3.2) sind an ihr ablesbar; Fürsorge zeigt Wirkung.
- **Sie wird zu seiner:** lernt erkennbar aus seiner Erziehung (3.11, „Warum?“), wächst (3.1), behält Erinnerungen.
- Nahe Ansicht mit Detail (Fell, Mimik) dort, wo man hinschaut: zuerst das Gesicht.
- **Alles kommt aus der Stimmung:** Ein gemeinsamer Zustand (z. B. fröhlich, neugierig, müde, hungrig, beleidigt,
  ängstlich, stolz), gespeist aus Bedürfnissen (3.2), Lob/Tadel, Ereignissen und Ausrichtung (3.3), steuert alles
  zugleich: Gesicht (Augen, Lider, Brauen, Maul), Ohren, Schwanz, Haltung, Gangart, welche Zwischenhandlungen sie wählt
  und welche Laute sie macht. So passen Ausdruck und Handlung immer zusammen, und das „Warum?“ (3.11) kann die
  Stimmung als Grund nennen.

## 1. Ist-Stand

- **Gestalten:** Fuchs (eigene Reaktionen; Fell-Modell vorhanden, derzeit nicht geladen), Wolf, Hirsch, Stier, Alpaka,
  Katze; gewählt am Schrein (die Kreatur läuft hin und verwandelt sich). Name und Geschlecht im Charakterbogen
  (Start: Fenja, weiblich). `S.creature`, `S.name`, `S.gender`.
- **Neigungen:** `S.w` mit `help` (Helfen), `play` (Spielen), `mischief` (Unfug); bestimmen, was sie aus eigenem Antrieb tut.
- **Tätigkeiten:** Baum fällen und ins Lager bringen (Helfen), Waren tragen (bis zu 3 Stück im Maul: von Hütten ins
  Lager, aus dem Lager zu Säge, Mühle, Bäckerei), mit dem Dorf spielen, Baum umwerfen (Unfug; Bewohner in der Nähe
  fliehen), dösen, eine Geste beim Wunder des Spielers (`foxCast`).
- **Erziehung:** direkt an der Kreatur langsam darüberstreichen (Lob) oder schnell wischen (Tadel), alternativ im
  Kreismenü; verstärkt bzw. schwächt die zuletzt gezeigte Tätigkeit (`reinforce`). Fuchs reagiert sichtbar (Schwanz
  wedeln bzw. einklemmen). Die Änderung steht danach über der Kreatur und in der Lernchronik (3.11).
- **Nachvollziehen:** Jede Entscheidung hat Gründe (`src/creature/mind.js`), sichtbar als Gedankenblase, Zeile „Warum“
  und im Charakterbogen (Erfahrung, Lernchronik, letzte Entscheidungen).
- **Kamera:** Nahsicht (Tipp auf den Namen) zeigt die Kreatur aus der Nähe in der Welt; „Folgen“ im Kreismenü hält sie
  nur im Bild (keine Leine).
- **Hand-Hilfen** (`handHelp`) als Grundlage für das spätere Lernen durch Vormachen.

## 2. Überblick: was dazukommt

| Bereich | Kurz | Abschnitt | Stand |
|---|---|---|---|
| Alter und Wachstum | Jungtier → ausgewachsen → altehrwürdig | 3.1 | 🔵 geplant |
| Bedürfnisse und Launen | Hunger, Müdigkeit, Spieltrieb treiben die Laune | 3.2 | 🔵 geplant |
| Ausrichtung | eigene Waage mit sichtbarer Veränderung | 3.3 | 🔵 geplant |
| Eigenwille | zögern oder sich weigern | 3.4 | 🔵 geplant |
| Leine | der Hand folgen, an einem Pfahl anbinden | 3.5 | 🔵 geplant |
| Lernen und Wunder | Zuschauen → Fortschritt → selbst tun; Lob und Tadel je Fähigkeit und Ziel | 3.6–3.9, `kreatur-lernen.md` | 🔵 geplant |
| Persönlichkeit je Gestalt | Startwerte, Lieblingsessen, Lieblingsspiel | 3.10 | 🟡 teilweise |
| Erleben in der Welt | Nahsicht statt Porträt, Erziehen per Geste, „Warum?“, Charakterbogen mit Erfahrung und Lernchronik | 3.11 | ✅ vorhanden |
| Zweibeinige Gestalt | aufrechtes Tier, das mit den Händen arbeitet und trägt | 3.12 | 🔵 geplant |

**Bewusst nicht vorgesehen** (⛔ verworfen, passt nicht zum Ton des Spiels):

- Die Kreatur frisst keine Bewohner. Eine böse Kreatur erschreckt sie, stiehlt Essen und zertrampelt Felder.
- Keine Kämpfe gegen andere Kreaturen; allenfalls später freundliche Wettkämpfe.
- Keine Notdurft (höchstens humorvoll als Dünger auf Feldern).
- Nur eine Art Leine, keine Leinen für Freundlichkeit oder Angriff (3.5).

## 3. Konzepte im Detail

### 3.1 Alter und Wachstum

**Stand:** 🔵 geplant

- **Lebensabschnitte:** Jungtier (klein, verspielt, lernt schnell, vergisst leicht) → ausgewachsen (volle Größe,
  stark, lernt normal) → altehrwürdig (etwas grau, weise: lernt langsamer, vergisst nichts, Wunder günstiger).
- Fortschritt über **Spielzeit** (Spieltage) und **Erfahrung** (ausgeführte Tätigkeiten).
- **Größe** wächst sanft (z. B. 0,7 → 1,0 → 1,1 der heutigen Größe); stärkere Kreaturen tragen größere Bäume,
  heben mehr auf einmal.
- Kein Tod; „altehrwürdig“ ist das Endstadium.

### 3.2 Bedürfnisse und Launen

**Stand:** 🔵 geplant – heute nur gelegentliches Dösen

- **Bedürfnisse** (0…1, steigen mit der Zeit): Hunger, Müdigkeit, Spieltrieb.
  - Hunger → frisst aus dem Lager (Lieblingsessen je Art), Fisch am Ufer, Obst von Obstbäumen.
  - Müdigkeit → schläft (nachts bevorzugt, nach viel Arbeit auch tagsüber).
  - Spieltrieb → spielt mit Bewohnern, jagt Vögel auf, tollt im Wasser.
- **Laune** ergibt sich daraus plus jüngstem Lob/Tadel: fröhlich, zufrieden, mürrisch, erschöpft, übermütig.
- Laune wird sichtbar: Haltung (Kopf/Schwanz), Tempo, kleine Symbole in der Einblendung, Text „Fenja ist mürrisch“.
- Laune wirkt auf: Lerntempo, Gehorsam, Wahl der Tätigkeiten (mürrisch → mehr Unfug, übermütig → mehr Spiel).

### 3.3 Gut und Böse (Ausrichtung)

**Stand:** 🔵 geplant

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

**Stand:** 🔵 geplant

- Befiehlt der Spieler etwas (Kreismenü, Leine), kann sie **zögern oder sich weigern**:
  - wenn ein Bedürfnis drängt (zu hungrig, zu müde),
  - wenn die Laune schlecht ist (kurz zuvor oft getadelt),
  - wenn die Tat ihrer Ausrichtung widerspricht (gute Kreatur verweigert Unfug, böse verweigert Mühe ohne Lohn).
- Sichtbar: schüttelt den Kopf, setzt sich hin, dreht sich weg, Text „Fenja will nicht“.
- Wiederholtes freundliches Bitten oder Erfüllen des Bedürfnisses (füttern, ausruhen lassen) löst es.
- Seltenes Verweigern macht sie lebendig; zu häufiges frustriert – Wahrscheinlichkeit gering halten.

### 3.5 Leine

**Stand:** 🔵 geplant – Entscheidungen unten; Lern-Leine und Ziel zeigen sind 💡 Idee

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
- 💡 Lern-Leine: Solange sie angelegt ist, schaut die Kreatur besonders genau zu und Vorführungen zählen
  doppelt (`kreatur-lernen.md` 1). Oder reicht es, sie zum Zusehen mitzunehmen?
- 💡 Ziel zeigen: An der Leine auf ein Feld oder einen Baum tippen, und sie tut dort, was sie kann.

### 3.6 Was die Kreatur von Anfang an kann

**Stand:** 💡 Idee – Vorschlag zur Aufteilung

Offen zu entscheiden: Was ist angeboren, was muss gelernt werden? Vorschlag:

- **Angeboren** (Tierverhalten, ohne Vormachen): einen Baum fällen und ins Lager bringen, Waren tragen (bis zu
  3 Stück), spielen, dösen, Unfug – alles heute schon vorhanden (1).
- **Zu lernen** (durch Vormachen der Hand): Feldarbeit, Füttern, Fischen, Pflanzen, große Transporte (3.7),
  Bewohner tragen (3.8), Wunder.
- Denkbar: Jungtiere können anfangs weniger (nur 1 Stück tragen), Ausgewachsene mehr.

### 3.7 Große Transporte

**Stand:** 🔵 geplant

- Wie die Hand Stapel packt, trägt und absetzt, steht in `gott-und-hand.md` 5.2.
- **Die Kreatur schaut zu** und lernt so, selbst größere Mengen gezielt zu verteilen (z. B. Stämme zur Säge,
  Bretter zur Baustelle, Korn zur Mühle), statt nur 3 Stück.

### 3.8 Bewohner vorsichtig tragen

**Stand:** 🔵 geplant

- Die Kreatur kann Bewohner behutsam im Maul (am Kragen) tragen und an einem Ort absetzen – z. B. einen Holzfäller
  zum Wald, einen Bauern zum Hof, einen Erschöpften nach Hause.
- Lernbar durch Vormachen: Die Hand setzt einen Bewohner **sanft** an seinem Arbeitsplatz ab (gute Tat,
  `gott-und-hand.md` 3.3); Werfen bleibt eine böse Tat.
- Eine böse Kreatur trägt Bewohner dagegen weg und setzt sie irgendwo aus oder lässt sie fallen.

### 3.9 Lernen, Fähigkeiten, Wunder

**Stand:** 🔵 geplant

- Siehe `kreatur-lernen.md`: Zuschauen → Fortschritt → gelernt → selbst anwenden → Lob/Tadel je Fähigkeit und je Ziel
  (z. B. „Regen aufs Feld“ gut, „Regen ins Dorf“ schlecht).
- Wunder: Regen, Eile, später weitere; kosten Glaube; Erlaubnis-Schalter im Kreatur-Panel.
- Böse Kreatur kann Wunder auch böswillig einsetzen (Regen aufs Fest), wenn so erzogen.

### 3.10 Persönlichkeit je Gestalt

**Stand:** 🟡 teilweise – nur der Fuchs hat eigene Reaktionen auf Lob und Tadel

- Startwerte je Art, z. B.: Fuchs (verspielt, schlau, lernt schnell), Wolf (treu, kräftig, neigt zu Jagd),
  Hirsch (sanft, groß, langsam), Stier (stark, stur – verweigert öfter), Alpaka (freundlich, eigensinnig),
  Katze (eigenwillig, neugierig, liebt Fisch).
- Lieblingsessen (`nahrung.md` 4) und Lieblingsspiel je Art.
- Eigene Reaktionen auf Lob/Tadel je Art (Fuchs erledigt, übrige offen).

### 3.11 Erleben in der Welt, Charakterbogen und „Warum?“

**Stand:** ✅ vorhanden (F 1–5); Fell-Fuchs in der Nahsicht (F 6) ⏸️ zurückgestellt

Leitgedanke: **Beobachten und Erziehen passieren in der Welt**, nicht in einem Fenster mit eigenem Modell. Dort sieht
man, wie die Kreatur einen Baum umwirft, wie das Dorf reagiert, was sie umgibt. Der **Charakterbogen** bleibt, aber als
echter Bogen zum Nachschlagen: wer die Kreatur ist, was sie kann, was sie gelernt hat und **warum sie tut, was sie
tut**. Genau das fehlte in Black & White: nachvollziehen zu können, was die Kreatur gerade gelernt hat und woher ihr
Verhalten kommt. Je mehr Tätigkeiten, Bedürfnisse und Fähigkeiten dazukommen (3.1–3.9), desto wichtiger wird das.

#### A. Nahsicht in der Welt statt Porträt

- **Tipp auf den Namen** oben (`#btnFox`): Die Kamera gleitet in etwa 1 s zur Kreatur (Abstand etwa 9, schräg von
  oben) und folgt ihr (`setFollow`). Unten erscheint eine schmale Karte mit Name, Tätigkeit, Motiv (C) und dem Knopf
  „Bogen“. Ein zweiter Tipp auf den Namen öffnet den Charakterbogen.
- Die Nahsicht endet beim Herauszoomen über etwa Abstand 16, mit „Nicht folgen“ im
  Kreismenü oder mit dem × der Karte. Die Kamera bleibt in der Nahsicht frei dreh- und zoombar.
- Das **Porträt** (`src/ui/portrait.js`, eigener WebGL-Renderer im Bogen) entfällt. Das spart auf dem Handy einen
  zweiten WebGL-Kontext.
- Der **Fell-Fuchs** (`Fox_HD`) wird heute nur im Porträt gezeigt. Ob er in der Nahsicht das Modell in der Welt ersetzt,
  entscheidet eine Messung auf dem Handy (Schritt 6). Bis dahin wird er nicht mehr geladen.

#### B. Erziehen per Geste an der Kreatur

- **Leere Hand**, Druck beginnt auf der Kreatur (`foxUnder`):
  - **Tipp** (kurz, kaum bewegt): Kreismenü wie heute. Neu öffnet es erst beim Loslassen, nicht schon beim Druck.
  - **Streicheln:** langsam über die Kreatur streichen (mindestens etwa 0,4 s und 40 px, langsamer als ein Wurf, der
    Finger bleibt auf oder dicht an der Kreatur). Löst die vorhandene Streichel-Geste der Hand aus (`playHand('pet')`).
  - **Klaps:** schnelles Wischen, das auf der Kreatur beginnt (schneller als 700 px/s, wie beim Werfen).
- **Volle Hand:** nur Tipp öffnet das Kreismenü, kein Streicheln und kein Klaps (Wischen wirft das Gehaltene).
- Streicheln und Klaps bleiben im Kreismenü als Abkürzung. Am Rechner gelten dieselben Gesten mit der Maus.

#### C. Gedanken und „Warum?“

- **Entscheidungen mit Begründung:** `foxChoose` hält jede Wahl fest: Tätigkeit, Ziel, Uhrzeit und eine Liste von
  Gründen `{ key, label, weight }`, heute die Anteile der Neigungen (z. B. Helfen 48 %) und ob die Wahl gegen die
  stärkste Neigung fiel („aus einer Laune heraus“). Später kommen weitere Gründe hinzu: Hunger, Müdigkeit, Spieltrieb
  (3.2), Ausrichtung (3.3), Eigenwille (3.4), gelernte Fähigkeit und Lob für genau dieses Ziel (3.9). Die Datenform
  bleibt gleich, damit der Bogen jede neue Ursache ohne Umbau zeigen kann.
- **In der Welt:** Beim Losgehen zeigt eine kleine Gedankenblase über der Kreatur die Absicht für einige Sekunden
  (Baum mit Herz: Holz fürs Dorf, Kiste: Waren tragen, Ball: spielen, Baum mit Blitz: Unfug). In der Nahsicht bleibt
  sie klein stehen. Genutzt wird dieselbe Technik wie bei den Symbolen über den Bewohnern.
- **Einblendung an der Kreatur** (`#foxBadge`) und Karte der Nahsicht zeigen eine Zeile „Warum“, z. B. „Helfen ist ihre
  stärkste Neigung (48 %)“ oder „Aus einer Laune heraus: Unfug liegt nur bei 20 %“.
- **Lob und Tadel sichtbar machen:** Nach Lob oder Tadel steht über der Kreatur kurz, was sich geändert hat, z. B.
  „Helfen 34 % → 48 %“. Die Tat, auf die es sich bezog, steht im Toast („Lob für: Baum fürs Lager gebracht“).
  Kam das Lob zu spät oder ohne Tat, heißt es „weiß nicht, wofür“ wie heute.

#### D. Charakterbogen

Ohne Porträt, als Bogen zum Nachschlagen, von oben nach unten:

1. **Kopf:** Name (änderbar), Geschlecht, Gestalt, später Lebensabschnitt (3.1) und Ausrichtung (3.3). Knopf
   „Beobachten“ startet die Nahsicht (A).
2. **Neigungen:** Balken für Helfen, Spielen und Unfug mit der Veränderung seit Tagesbeginn (▲ +14 / ▼ −6).
3. **Erfahrung:** je Tätigkeit, wie oft sie es getan hat (Bäume ins Lager gebracht, Waren getragen, gespielt, Bäume
   umgeworfen). Grundlage für Alter und Wachstum (3.1). Später kommen hier die Fähigkeiten aus `kreatur-lernen.md` 4
   mit Fortschritt dazu (ungelernt, im Lernen, gelernt).
4. **Gelernt:** Chronik der letzten Lernereignisse, neueste oben, z. B. „Tag 3, 14 Uhr – Lob für ‚Baum fürs Lager
   gebracht‘: Helfen 34 % → 48 %“. Später auch „hat Säen gelernt“.
5. **Zuletzt entschieden:** die letzten Entscheidungen mit ihren Gründen (C), z. B. „14:20 Uhr – Baum umgeworfen.
   Warum: aus einer Laune heraus, Unfug 20 %“.

- Streicheln, Klaps und Folgen verschwinden aus dem Bogen (Erziehen in der Welt, B).
- Die Wahl der Gestalt steht nicht im Bogen, sondern im Schrein-Panel: Die Kreatur läuft zum Schrein und nimmt dort im
  Licht die neue Gestalt an (`foxToShrine`). Der Bogen nennt nur die aktuelle Gestalt.

#### E. Spielstand

- `S.cXp` – Erfahrung je Tätigkeit `{ tree, haul, play, mischief }` (Zahlen, Standard 0).
- `S.cLearn` – Liste der letzten 30 Lernereignisse `{ day, hour, kind: 'pet' | 'slap', act, desc, from, to }`.
- `S.cDay` – Neigungen zu Tagesbeginn (für ▲/▼ im Bogen), Standard `null`.
- Entscheidungen nur zur Laufzeit (`fox.log`, die letzten 10), nicht im Spielstand.

#### F. Reihenfolge der Umsetzung

Je Schritt ein Commit auf `develop`, im Spiel geprüft (`__wk`, eigene Prüfung `dev/checks/kreatur.mjs`).

1. **Gedächtnis:** Entscheidungen mit Gründen (`fox.log`), Lernchronik (`S.cLearn`), Erfahrung (`S.cXp`),
   Neigungen zu Tagesbeginn (`S.cDay`); in `__wk` sichtbar.
2. **Charakterbogen neu** (D) ohne Porträt, `portrait.js` und das Laden von `Fox_HD` aus dem Bogen entfernen.
3. **Nahsicht** (A) mit Karte, „Warum“ in Einblendung und Karte, Gedankenblase und Anzeige der Änderung nach Lob und
   Tadel (C).
4. **Gesten** Streicheln und Klaps (B), Kreismenü öffnet beim Loslassen.
5. **Doku und Hinweise:** Stand-Marken, Info-Panel (`#sheetInfo`), Hinweistexte.
6. **Fell-Fuchs in der Nahsicht** ⏸️ zurückgestellt. Gemessen: Das Fell-Modell hat mit 16 Fellschichten rund
   200.000 Dreiecke in 21 animierten Meshes, der Fuchs in der Welt 1.848 (Vorgabe für Kreaturen: bis etwa 10.000).
   Mit Schattendurchgang ist das auf dem Handy zu schwer. Denkbar später: in Blender auf etwa 5.000 Dreiecke
   reduzieren und nur 4 bis 6 Fellschichten, erst dann auf dem Handy messen.
7. **Zweibeinige Gestalt** (3.12), in eigenen Schritten (3.12 G).

### 3.12 Zweibeinige Gestalt

**Stand:** 🔵 geplant – welches Tier und welches Modell ist noch offen

Wie in Black & White eine aufrechte Kreatur, die mit den Händen arbeitet: als weitere Gestalt neben den Vierbeinern,
nicht als Ersatz.

#### A. Warum

- Was die Kreatur durch Zuschauen lernt (`kreatur-lernen.md`: säen, ernten, füttern, pflanzen, Waren tragen, Wunder
  wirken), wirkt mit Händen glaubwürdig. Ein Vierbeiner trägt alles im Maul, heute höchstens 3 Waren.
- Sie kann der Hand ähnlicher handeln: aufheben, tragen, werfen, Bewohner vorsichtig in den Arm nehmen (3.8), winken.

#### B. Gestalt

- Ein **aufrecht gehendes Tier** (z. B. Affe, Bär oder ein Fantasiewesen), kein Mensch: Die Kreatur bleibt ein
  Tiergeist und lässt sich auf einen Blick von den Bewohnern unterscheiden.
- Deutlich größer als die Bewohner (Spielhöhe etwa 2 bis 2,5), freundlich und rund im Stil der übrigen Modelle.
- Wird wie heute im Bogen als Gestalt gewählt (`kinds.js`, Theme-Schlüssel `creature.<id>`), später als Ritual am
  Schrein (3.11 D).

#### C. Modell und Animationen

- **Lizenz:** frei, CC0 bevorzugt, Eintrag in `assets/CREDITS.md` und im Info-Panel. Bis etwa 10.000 Dreiecke
  (`docs/assets.md`).
- **Skelett:** menschenähnlich (Arme, Hände mit Knochen, Kopf), damit sich Animationen aus freien Bibliotheken mit
  demselben Skelettaufbau in Blender übertragen lassen (Retargeting).
- **Kandidaten** (gesichtet, noch nicht heruntergeladen und im Spiel geprüft):
  - **Quaternius „Ultimate Monsters“**: 50 animierte Monster, CC0 laut quaternius.com (auf Sketchfab widersprüchlich
    als CC BY angegeben, daher von quaternius.com bzw. itch.io laden). Darunter ein Yeti, ein Panda und weitere
    rundliche Wesen; im Schnitt etwa 4.000 Dreiecke je Figur. Animationen u. a. Gehen, Rennen, Angriff. Offen: ob das
    Skelett menschenähnlich genug für übertragene Animationen ist.
  - **Quaternius „Universal Animation Library“ 1 und 2**: CC0, menschenähnliches Standardskelett (auch zu Mixamo
    passend). Teil 1 frei mit etwa 45 Animationen (Gehen, Rennen, Sitzen, Schieben …), Teil 2 mit Landwirtschaft und
    Fischen, passend zum Lernen durch Vormachen. Liefert die Animationen, nicht die Figur.
  - **KayKit „Character Animations“**: CC0, 133 Animationen für menschenähnliche Skelette (Interagieren, Aufheben …).
    Eine Tierfigur gibt es bei KayKit nicht, am nächsten käme ein Werwolf (eigene Lizenz prüfen).
  - **Geprüft und verworfen (Optik):** drei Yetis, Monkroose und Tribal aus „Ultimate Monsters“ (über Poly Pizza
    geladen, CC0). Technisch geeignet: Yeti und Monkroose haben ein menschenähnliches Skelett mit 43 Knochen samt
    Fingern, 14 Animationen (u. a. Winken, Ja, Nein, Ducken) und etwa 6.000 Dreiecke. Sie wirken aber grob und passen
    nicht zum weichen Stil der Insel.
  - **Gewählter Ansatz, erster Entwurf ✅:** Skelett und Bewegungen menschlich, Körper tierisch. Das Skelett stammt von
    der Schaufensterpuppe aus der „Universal Animation Library 2“ (CC0, 65 Knochen im Unreal-Schema, auch für die
    „Universal Base Characters“). Den Körper eines aufrechten Fuchses habe ich in Blender aus runden Grundformen gebaut
    (dicker Bauch, großer Kopf, Schnauze, Ohren, buschiger Schwanz), zu einem Stück verschmolzen und auf 7.000 Dreiecke
    reduziert. Farben in drei Flächen (rotbraun, hell, dunkel), automatische Gewichte. Die 43 Animationen der freien
    „Universal Animation Library“ laufen ohne Umrechnen, u. a. Gehen, Rennen, Aufheben, Interagieren, Zaubern,
    Sitzen, Knien, Schieben, Tanzen; Teil 2 bringt Landwirtschaft und Fischen. Im Spiel geprüft: passt in Stil und
    Größe zu Insel, Fuchs und Bewohnern. Rohdaten nur lokal (`dev/assets-raw/`, nicht im Repo).
  - Noch offen: Schwanz schwingt nur mit dem Becken (eigene Schwanzknochen fehlen), Farbgrenzen gezackt, Gesicht
    schlicht (keine Mimik), Hände ohne Finger-Form. Die freien „Universal Base Characters“ enthalten nur zwei
    muskulöse Superhelden-Figuren, als Körper ungeeignet.
- **Benötigte Animationen:** Stehen, Gehen, Rennen, Aufheben, Gehen mit Last (vor dem Körper bzw. auf der Schulter),
  am Boden arbeiten (säen, ernten, pflanzen), Werfen, Wunder wirken, Sitzen bzw. Dösen, Freuen (Lob), Ducken (Tadel),
  später Winken. Die Namen kommen in `docs/assets.md` (Abschnitt „Animationen der Kreaturen“) dazu.
- **Detailmodell:** wie beim Fell-Fuchs in Blender verbessert (Fell, Gesicht, Mimik) und nur in der Nahsicht gezeigt,
  falls die Messung aus 3.11 F6 das erlaubt.

#### D. Was sich im Spiel ändert

- **Theme** (`src/themes/cozy.js`): neue Einträge je Kreatur `body: 'biped'` (Standard `'quad'`), `hands` (Knochen der
  linken und rechten Hand als Haltepunkte) und `carry` (wo eine Last sitzt: Baum auf der Schulter, Kiste vor dem
  Körper). Spielcode fragt nur diese Schlüssel ab, keine Knotennamen.
- **Tragen:** an den Händen statt im Maul (`updateMouthTree` und das Tragen von Waren); mehr Tragkraft, z. B. 6 Waren.
- **Treffen** (`foxUnder`, `src/ui/ring.js`): bei Zweibeinern die senkrechte Strecke über die ganze Höhe mit etwas
  breiterer Toleranz (Arme), keine Längsstrecke.
- **Streicheln** (`gestures.js`, heute über den Rücken eines Vierbeiners): beim Zweibeiner den Kopf tätscheln, Klaps
  auf die Schulter. Die Gesten an der Kreatur (3.11 B) bleiben gleich.
- **Ruhen:** sitzen statt liegen (heute `rest` mit Liegepose `paw`/`hoof`).
- **Lernen:** dieselben Fähigkeiten wie bei Vierbeinern; der Zweibeiner führt sie sichtbar mit den Händen aus, der
  Vierbeiner mit Maul und Pfoten (einfachere Animation).

#### E. Offene Fragen

- Welches Tier? Vorschlag: zuerst ein Affe oder Bär, je nachdem, welches freie Modell die meisten passenden
  Animationen mitbringt.
- Soll der Zweibeiner Vorteile haben (Tragkraft), oder sollen alle Gestalten gleich stark sein und sich nur in
  Persönlichkeit unterscheiden (3.10)?

#### F. Spielstand

- Keine neuen Felder: Die Gestalt steht wie heute in `S.creature`.

#### G. Reihenfolge

1. **Modelle sichten:** zwei bis drei Kandidaten mit Lizenz, Dreiecken, Animationen und Screenshot im Spiel; Wahl
   gemeinsam mit dem Nutzer. ✅ Fertige Monster verworfen, eigener Entwurf (aufrechter Fuchs auf menschlichem Skelett) im Spiel geprüft (C).
2. **Einbauen** mit Stehen, Gehen, Rennen, Sitzen; Theme-Einträge `body`, `hands`, `carry`; Treffen und Streicheln
   angepasst. 🟡 Test auf Branch `claude/zweibeiner-test`: zwei Gestalten am Schrein, „Fuchsmensch“ (eigener Körper,
   Animationen der Universal Animation Library 1+2, vier Schwanzknochen, die im Code schwingen) und „Mensch (Test)“
   (KayKit „Mage“, CC0, 76 Animationen, davon 19 übernommen, inkl. Hinlegen und Liegen). Theme: `body`, `face`,
   `hands`, `tail`, `anims` (Zuordnung der Animationsnamen). Treffen nur über die senkrechte Strecke; Streicheln
   nutzt die vorhandene Messung des Rückens (bei Zweibeinern über Kopf und Schultern).
3. **Hände nutzen:** Bäume und Waren an den Händen tragen, höhere Tragkraft, Aufheben und Werfen. 🟡 Tragen in beiden
   Händen vor dem Bauch und eigene Trage-Animation (Fuchsmensch) vorhanden; Tragkraft und Werfen noch wie beim Fuchs.
4. **Arbeiten am Boden** zusammen mit dem Lernen durch Vormachen (`kreatur-lernen.md`).
5. **Detailmodell** in Blender für die Nahsicht (nach der Messung aus 3.11 F6).

## 4. Spielstand (Vorschlag, abwärtskompatibel)

- `S.cAge` – Erfahrung/Alter (Zahl), daraus Lebensabschnitt und Größe.
- `S.cAlign` – Ausrichtung −1 … +1.
- `S.cNeeds` – `{ hunger, tired, play }` 0 … 1.
- `S.cLeash` – Pfahl `{ x, z }`, an dem die Kreatur angebunden ist, sonst `null`. Geführt wird nicht gespeichert
  (nach dem Laden ist die Leine von der Hand gelöst).
- `S.skills` – Fähigkeiten (siehe `kreatur-lernen.md`).
- `S.cMiracles` – Erlaubnis Wunder (bool).
- Bestehendes `S.w` bleibt als Grundneigung.
- `S.cXp`, `S.cLearn`, `S.cDay` – Erfahrung, Lernchronik, Neigungen zu Tagesbeginn (3.11 E).

## 5. Vorgeschlagene Reihenfolge

0. Erleben in der Welt, Charakterbogen und „Warum?“ (3.11) – macht alle folgenden Schritte nachvollziehbar. ✅
1. Nahrung (Lager hat Zweck) – Voraussetzung für Hunger der Kreatur. ✅
2. Lernen durch Vormachen + Fähigkeiten (Felder zuerst). Davor die zweibeinige Gestalt (3.12 G 1–3), damit Arbeiten
   mit den Händen gleich mitgebaut werden kann.
3. Bedürfnisse und Launen, Fressen aus dem Lager, Schlafen.
4. Ausrichtung Gut/Böse mit sichtbarer Veränderung.
5. Leine (3.5).
6. Verweigern.
7. Alter und Wachstum.
8. Wunder wirken durch die Kreatur.
