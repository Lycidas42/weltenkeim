# Die Bewohner

Zentrales Konzept für die Menschen der Insel: wer sie sind, was sie brauchen, wie sie fühlen und es zeigen, wie sie
arbeiten, ausruhen und ihre freie Zeit verbringen und wie der Spieler einen einzelnen Bewohner in den Blick nimmt.

Verwandt: `nahrung.md` (Essen, Hunger, Dorffest), `gott-und-hand.md` (Hand, Wunder, Waage, Taten),
`gut-und-boese.md` (Welt und Schrein je Ausrichtung), `kreatur.md` (die Kreatur spielt mit dem Dorf und erschreckt es),
`jahreszeiten.md` (Winter, Sommer, Kalender), `assets.md` (Bewohner austauschbar machen, Abschnitt 4.2),
`spielstaende.md` (Bewohner gehören zur Welt).

Stand der Features: siehe `README.md`.

## 1. Ist-Stand

- **Aussehen:** Jeder Bewohner besteht aus instanzierten Einzelteilen (Beine, Rumpf, Arme, Kopf mit Nase, zwei
  Punktaugen, Frisur, Bart), die der Code direkt stellt (`src/village/villagers.js`, `src/village/render.js`). Haut,
  Haar, Frisur, Kleidung und Größe werden je Platz deterministisch gewürfelt (`dressVillager(i)`); ein Hut zeigt den
  Beruf. Es gibt **keinen Mund und keine Augenbrauen**, also keine Mimik.
- **Identität:** Bewohner haben keinen Namen und keine Eigenschaften. Gespeichert wird nur ihre Anzahl (`S.pop`),
  beim Laden entstehen sie neu. Höchstens 40 (`MAX_POP`).
- **Tagesablauf** (`src/village/ai.js`): Arbeit je Beruf, **Mittagspause** auf dem Dorfplatz unter der Dorflinde
  (sitzen, ins Brot beißen), **Feierabend und Schlaf** in der Hütte (unsichtbar, „Zzz“ über dem Haus). Freie Bewohner
  ohne Beruf beten am Schrein.
- **Zustände** (`v.state`): `idle`, `walk`, `chop`, `plant`, `sow`, `harvest`, `tend`, `saw`, `proc`, `aim`, `fish`,
  `pray`, `beg`, `lunch`, `sleep`, `flee`, `grabbed`, `falling`, `dizzy`. Je Zustand gibt es **genau eine Pose**
  (prozedural, z. B. `chopPose`, `digPose`, `prayPose`); Übergänge nur beim Knien und Sitzen weich (`v.kn`, `v.st`).
- **Ausdruck heute:** Jubel mit erhobenen Armen nach einer erfüllten Bitte (`v.cheer`), Flucht vor der Kreatur und
  vor einem fallenden Baum (`flee`), „Uff!“ und Schwindel nach hartem Wurf (`dizzy`), Laterne ab der Dämmerung,
  Schwebetexte wie „Treffer!“ oder „Weizen geerntet“.
- **Ton:** Das Spiel hat bisher **keinerlei Ton**.
- **Bedürfnisse:** keine. Die Mittagspause ist eine feste Uhrzeit, kein Hunger; das Brot wird nicht verbraucht
  (`nahrung.md`).

## 2. Leitbild

Die Bewohner sind das, worum es dem Gott geht: Sie glauben an ihn, und von ihrem Glück hängt sein Glaube ab. Bisher
sind sie fleißige Figuren ohne Innenleben. Ziel ist ein Dorf, dem man gern zusieht, wie einem Wimmelbild: Jeder
Bewohner ist erkennbar jemand, hat Launen, macht Pausen, feiert, fährt im Winter Ski, und man sieht ihm an, wie es
ihm geht.

Leitlinien:

- **Ablesbar aus der Ferne:** Der Zustand eines Bewohners muss auf dem Handy aus der normalen Kamerahöhe erkennbar
  sein, über Symbol und Körperhaltung. Mimik und Sprechblasen sind die Nahansicht.
- **Sparsam:** Nicht jeder Bewohner zeigt ständig etwas. Ausdruck ist ein Ereignis, kein Dauerzustand (Abschnitt 4.6).
- **Gemütlich, kein Verwaltungsspiel:** Bedürfnisse regeln sich weitgehend selbst. Der Spieler soll hinsehen und
  helfen können, aber nicht müssen. Schlechte Laune bremst, sie bestraft nicht hart.
- **Glaube als Spiegel:** Zufriedene Bewohner beten gern und mehr. Das ist die wichtigste Verbindung zur Spielmechanik.

## 3. Identität und Bedürfnisse

### 3.1 Wer ein Bewohner ist

**Stand:** 🔵 geplant

- **Name:** aus einer Liste deutscher, märchenhafter Vornamen (Mira, Jorin, Ilse, Bent …), beim Entstehen gewürfelt.
- **Wesenszug** (einer, selten zwei): fleißig, verträumt, gesellig, ängstlich, fromm, abenteuerlustig, gemütlich,
  neugierig. Er verschiebt Bedürfnisse und Vorlieben leicht (der Gesellige plaudert öfter, der Abenteuerlustige
  fährt lieber Ski, der Fromme betet länger) und wählt Varianten der Animationen (Abschnitt 7).
- **Vorliebe:** eine Lieblingsbeschäftigung in der Freizeit (Abschnitt 6) und ein Lieblingsessen (`nahrung.md`).
- **Alter:** Kind, Erwachsener, Alter (heute sind 15 % grauhaarig, sonst gleich). Kinder arbeiten nicht, spielen
  und gehen nur mit; das ist **Idee**, weil es Nachwuchs voraussetzt. Die Modell-Varianten Frau, Mann, Kind, Alte
  aus `assets.md` 4.2 passen dazu.
- Aussehen bleibt wie heute gewürfelt, aber mit festem Saatwert je Bewohner statt je Platz, damit es beim Wegfallen
  eines Bewohners nicht auf die anderen überspringt.

### 3.2 Bedürfnisse

**Stand:** 🔵 geplant

Drei Werte von 0 bis 1, bewusst wenige:

| Bedürfnis | steigt durch | wird gestillt durch | Folge, wenn hoch |
|---|---|---|---|
| **Müdigkeit** | Arbeit, Wunder Eile, langer Tag | Schlaf, Pausen, Urlaub | langsamer, gähnt, macht sich selbst eine Pause |
| **Hunger** | Zeit | Mittagessen aus dem Lager (`nahrung.md` 1) | langsamer, bittet am Schrein um Nahrung |
| **Freude** (sinkt) | Arbeit ohne Abwechslung, Angst, Wurf durch die Hand | Freizeit, Plaudern, Feste, erfüllte Bitten, Lob der Kreatur | mürrisch, betet weniger |

- **Laune** ergibt sich aus den drei Werten und den letzten Erlebnissen: *fröhlich, zufrieden, müde, hungrig,
  mürrisch, ängstlich*. Sie ist das, was der Spieler sieht (Abschnitt 4 und 8).
- **Wirkung:** Laune ändert Arbeitstempo (etwa ±20 %) und Gebetsertrag (`prayYield`). Kein Bewohner hört ganz auf zu
  arbeiten oder verlässt die Insel.
- **Dorfstimmung:** Durchschnitt der Laune aller Bewohner, als ein Wert für Anzeige und Bestenliste.

## 4. Emotionen und Ausdruck

**Stand:** 🟡 teilweise – Jubel, Flucht, „Uff!“ und „Zzz“ vorhanden, alles Weitere geplant

### 4.1 Gefühle

| Gefühl | Auslöser (Beispiele) | Symbol | Mimik | Körper | Ton |
|---|---|---|---|---|---|
| Freude | erfüllte Bitte, Feierabend, Fest, Regen nach Dürre | Herz, Note | Lächeln, Augen zu Bögen | Jubel, Hüpfer | Jauchzer, Summen |
| Zufriedenheit | Arbeit erledigt, satt | kleines Häkchen oder keins | leichtes Lächeln | ruhiges Gehen, Strecken | zufriedenes „Hm“ |
| Müdigkeit | langer Tag, nach Eile | „Zzz“, Schweißtropfen | halb geschlossene Augen | Gähnen, Schlurfen | Gähnen, Seufzer |
| Hunger | leeres Lager, Mittag verpasst | Brot mit Fragezeichen | Mund schief | Hand auf den Bauch | Magenknurren |
| Ärger / Frust | Baum vor der Nase weggerissen, Feld zertrampelt, Kreatur stiehlt | Gewitterwölkchen, Kringel | Brauen zusammen | Fuß aufstampfen, Faust schütteln | Grummeln |
| Angst | finstere Hand naht, böse Kreatur, Gewitter, Wirbelsturm | Ausrufezeichen, Zitterlinien | Augen groß, Mund rund | ducken, fliehen (`flee`) | kurzer Schrei |
| Staunen / Ehrfurcht | Wunder in der Nähe, Hand sanft abgesetzt | Sternchen | Augen groß, Mund offen | Arme hoch, auf die Knie | „Oooh“ |
| Trauer | Haus zerstört, Freund weg (später) | Träne | Mundwinkel unten | Kopf gesenkt | Schniefen |
| Dank / Liebe zum Gott | gute Tat, Rettung, sanft abgesetzt | Herz zum Schrein hin | Lächeln | winken zur Hand, Verbeugung | Ruf „Danke!“ in Brabbelsprache |

### 4.2 Symbole über dem Kopf

**Stand:** 🟡 teilweise – Symbole für vorhandene Ereignisse da (Herz bei Jubel, Ausrufezeichen bei Flucht, Sternchen bei
Schwindel, Wunsch-Symbol bei der Bitte, Funkeln nach sanftem Absetzen; `src/village/emotes.js`), Gefühle und
Bedürfnisse noch nicht · [#3](https://github.com/Lycidas42/weltenkeim/issues/3)

- Kleines Bild über dem Kopf, sitzt etwa 0,25 über dem Kopf, steigt kurz auf und verblasst nach 2 bis 4 s.
- **Technik:** ein Sprite-Atlas (eine Textur, wenige Dutzend Bilder) und **eine** `InstancedMesh` aus Flächen, die
  zur Kamera zeigen. So bleiben 40 Bewohner mit Symbol ein einziger Draw-Call. Die Bilder als SVG entwerfen und zur
  Ladezeit in eine Canvas-Textur zeichnen (keine neue Bilddatei nötig, passt zum Stil der UI-Symbole).
- Wiederkehrende Zustände (hungrig, müde) zeigen das Symbol in Abständen, nicht dauerhaft.
- Ersetzt den heutigen Schwebetext „Zzz“ über dem Haus nicht, ergänzt ihn.

### 4.3 Mimik

**Stand:** 🔵 geplant

- Der Kopf bekommt **Mund** und **Augenbrauen** als weitere instanzierte Teile. Je Gefühl eine Form: Mund als
  kleiner Bogen (lächeln, schief, rund, nach unten), Brauen als zwei flache Kästchen mit Neigung. Augen schließen
  über Skalierung in Y (Blinzeln alle paar Sekunden, Müdigkeit halb, Freude als Bogen).
- Mehrere Mundformen = mehrere `InstancedMesh`, von denen je Bewohner eine sichtbar ist (wie heute die Frisuren).
- Erst ab mittlerer Zoomstufe sichtbar sinnvoll; aus der Ferne reicht die Körperhaltung. Ab großer Entfernung die
  Gesichtsteile ganz abschalten (Leistung).

### 4.4 Sprechblasen

**Stand:** 🔵 geplant

- Kurze deutsche Sätze in einer Blase über dem Kopf, als DOM-Element über dem Canvas (wie die Schwebetexte), höchstens
  **drei gleichzeitig**, und nur für Bewohner im Bild und nahe genug.
- Inhalt: Gedanken zur Lage („Das Lager ist leer …“, „Endlich Feierabend!“, „Schnee! Wer kommt mit auf den Berg?“),
  Reaktionen auf den Gott („Die Hand! Sie hilft uns!“, „Nicht schon wieder werfen …“), Bitten in eigenen Worten.
- Ein Bewohner im Fokus (Abschnitt 8) spricht häufiger; seine letzten Sätze erscheinen in seiner Karte.
- Satzvorlagen mit Platzhaltern (Name, Beruf, Ware), je Wesenszug eigene Färbung. Sprechblasen ersetzen nicht die
  Hinweise (`toast`), die dem Spieler Spielregeln erklären.

### 4.5 Ton

**Stand:** 🔵 geplant – eigenes Vorhaben, im Spiel gibt es noch keinen Ton

- Es gibt noch kein Tonsystem. Vorschlag: ein kleines Modul `src/core/audio.js` mit Web Audio, das erst nach der
  ersten Berührung startet (Vorgabe der Mobilbrowser), mit Lautstärke für Musik, Umgebung und Stimmen und einem
  Schalter „Ton aus“ (gehört zum Profil, `spielstaende.md` 4).
- **Stimmen als Brabbelsprache** (wie *Animal Crossing* oder *Die Sims*): kurze Silben, je Bewohner leicht
  andere Tonhöhe, je Gefühl andere Melodie (Frage steigt, Freude hüpft, Ärger brummt). Wenige Grundlaute reichen;
  Tonhöhe und Tempo werden im Code variiert.
- Daneben Geräusche je Tätigkeit (Axthieb, Säge, Spaten, Angelschnur), Umgebung (Wind, Wellen, Regen, Vögel) und
  Musik je Tageszeit. Das ist ein eigenes Thema; hier zählt, dass Gefühle einen Laut bekommen können.
- Räumlich: Lautstärke nach Abstand zur Kamera, höchstens wenige Stimmen gleichzeitig.
- Tondateien nur mit freier Lizenz (CC0), in `assets/CREDITS.md` und im Info-Panel nennen, in die `APP`-Liste.

### 4.6 Regeln gegen Gewimmel

**Stand:** 🔵 geplant

- Je Bewohner höchstens ein Ausdruck zur Zeit; ein neuer verdrängt einen älteren nur mit höherer Wichtigkeit
  (Angst > Dank > Ärger > Hunger > Müdigkeit > Freude).
- Höchstzahl gleichzeitiger Symbole (etwa 8) und Sprechblasen (3); Bewohner nahe der Bildmitte und im Fokus zuerst.
- Gruppenreaktionen (alle jubeln nach einer erfüllten Bitte) sind erlaubt, dann aber nur Körperhaltung und ein
  Symbol bei wenigen.

## 5. Pausen, Feierabend und Urlaub

### 5.1 Pausen am Tag

| Pause | Wann | Was | Stand |
|---|---|---|---|
| Mittagspause | feste Zeit (`LUNCH`) | sitzen auf dem Dorfplatz, essen | 🟡 teilweise – feste Zeit vorhanden, echtes Essen fehlt (`nahrung.md`) |
| Verschnaufen | Müdigkeit hoch | stehen bleiben, Schweiß abwischen, strecken, auf einen Baumstumpf setzen | 🔵 geplant |
| Trinken | ab und zu, im Sommer öfter | zum Brunnen, Schöpfen, trinken | 🔵 geplant |
| Plausch | zwei Bewohner begegnen sich, einer davon gesellig | stehen bleiben, Sprechblasen hin und her, lachen | 🔵 geplant |
| Nickerchen | nach dem Mittag bei großer Müdigkeit | im Schatten eines Baums dösen (sichtbar, nicht in der Hütte) | 💡 Idee |

- Pausen kosten kurz Arbeitszeit und bringen Freude und Erholung; unter dem Strich arbeitet ein ausgeruhtes Dorf
  schneller (Abschnitt 3.2).
- Wunder **Eile** macht schnell, aber müde: Danach folgt eine längere Pause. So wird Eile eine Abwägung statt immer
  richtig.

### 5.2 Feierabend

**Stand:** 🔵 geplant

- Zwischen Arbeitsende und Schlafenszeit (`BED`) eine **freie Stunde**: Bewohner gehen nicht sofort heim, sondern
  sitzen am Lagerfeuer auf dem Dorfplatz, musizieren, spazieren am Ufer, schauen Sterne oder gehen ihrer Vorliebe
  nach (Abschnitt 6).
- Laternen wie heute; das Lagerfeuer ist zugleich Lichtquelle (`src/village/night.js`).

### 5.3 Urlaub

**Stand:** 🔵 geplant

- Jeder Bewohner hat in regelmäßigen Abständen einen **freien Tag** (Vorschlag: alle 6 bis 8 Spieltage, nach
  Wesenszug etwas früher oder später). Nicht alle gleichzeitig: höchstens etwa ein Zehntel des Dorfes hat frei.
- Am freien Tag schläft er länger, geht seiner Lieblingsbeschäftigung nach (Abschnitt 6) und füllt Freude und
  Erholung kräftig auf. Ein Symbol (Sonnenschirm) und ein Satz zeigen es an („Jorin hat heute frei.“).
- **Vertretung:** Fehlt jemand in einem Beruf, springt ein freier Bewohner ein, sonst arbeitet die Werkstatt
  langsamer. Das Arbeit-Panel zeigt, wer gerade frei hat.
- **Urlaub schenken:** In der Karte eines Bewohners (Abschnitt 8) kann der Gott einem erschöpften oder mürrischen
  Bewohner frei geben. Zählt als kleine gute Tat (`gott-und-hand.md` 7.2).
- **Urlaubsreise (Idee):** Ein Bewohner fährt für einen Tag mit dem Boot hinaus und kommt mit einem Andenken zurück
  (Muschel, Fisch, Geschichte als Sprechblase). Setzt ein Boot am Steg voraus.
- **Offline:** Die nachgerechnete Abwesenheit (`S.ts`, höchstens 8 h) rechnet mit dem Durchschnitt aus Arbeit,
  Pausen und freien Tagen, ohne einzelne Pausen nachzuspielen.

## 6. Freizeit und Sport

**Stand:** 🔵 geplant – Thema beschlossen, einzelne Beschäftigungen siehe Tabelle

Was die Bewohner in Pausen, am Feierabend und im Urlaub tun. Jede Beschäftigung braucht einen Ort, oft ein Wetter
oder eine Jahreszeit, manchmal Ausrüstung, und sie hat eigene Animationen (Abschnitt 7).

| Beschäftigung | Bedingung | Ort | Ausrüstung | Stand |
|---|---|---|---|---|
| **Skifahren** | Winter, Schneedecke (`weather.snowCover`) | Hang mit Gefälle; hoch gelegenes Land ist ohnehin verschneit | Ski und Stöcke (im Code gebaut) | 💡 Idee, Wunsch des Spielers |
| Rodeln | Winter, Schneedecke | flacher Hang nahe dem Dorf | Schlitten | 💡 Idee |
| Schneemann bauen, Schneeballschlacht | Winter, Schneedecke | Dorfplatz, Wiese | – | 💡 Idee |
| **Surfen** | Wind (`weather.wind`), tagsüber, kein Gewitter | Strand an der Küste | Brett | 💡 Idee, Wunsch des Spielers |
| Schwimmen, Planschen | Sommer, sonnig | flaches Ufer | – | 💡 Idee |
| Sandburg bauen | Sommer, sonnig | Strand | – | 💡 Idee |
| Drachen steigen lassen | Herbst, Wind | Wiese, Hügel | Drachen | 💡 Idee |
| Angeln zum Vergnügen | jederzeit | Steg, Ufer | Angel (wie der Fischer) | 💡 Idee |
| Musizieren, Tanzen | Feierabend, Fest | Lagerfeuer am Dorfplatz | Laute, Flöte | 💡 Idee |
| Laub zusammenrechen, in Laubhaufen springen | Herbst, Laub am Boden (`jahreszeiten.md` 3, Punkt 4) | unter Laubbäumen | Rechen | 💡 Idee |
| Blumen pflücken, Kränze binden | Frühling, Blumen | Wiese | – | 💡 Idee |
| Ballspiel | tagsüber, trocken | Wiese am Dorf | Ball | 💡 Idee |
| Mit der Kreatur spielen | Kreatur in der Nähe und spielfreudig | wo sie ist | – | 🟡 teilweise (die Kreatur spielt heute mit dem Dorf, `kreatur.md` 1) |
| Sterne schauen | klare Nacht, Feierabend | Hügel am Schrein | – | 💡 Idee |

- **Skifahren im Detail:** Bewohner stapfen mit geschulterten Ski den Hang hinauf, schnallen an, fahren in Bögen
  bergab (Pfad aus der Wegfindung entlang der Falllinie, Körper in die Kurve geneigt), stürzen ab und zu lachend in
  den Schnee. Die Spur bleibt eine Weile im Schnee. Der Gott kann mit **Formen** (`gott-und-hand.md` 4) einen
  Skihang anlegen: Ein Berg am Dorf macht den Winter fröhlicher.
- **Surfen im Detail:** Brett unter dem Arm zum Strand, hinauspaddeln (liegend, Arme im Wechsel), auf einer Welle
  aufstehen und Richtung Ufer gleiten, ins Wasser fallen. Dafür braucht das Wasser sichtbare Wellen an einer
  Küstenstelle (`src/world/water.js`); ohne Wellen nur Paddeln. Haie (`src/wildlife/sea.js`) halten sich von
  Surfern fern oder sorgen bei böser Ausrichtung für einen Schreck.
- **Jahreszeiten** (`jahreszeiten.md`): Sie bestimmen, welche Beschäftigungen anstehen – Wintersport im Winter,
  Strand im Sommer. Bis der Kalender kommt, gibt es Schnee nur von Hand (Wetter „Schnee“); Wintersport ist dann bei
  Schneewetter spielbar.
- **Kleidung je Jahreszeit:** Im Winter Mütze und Schal (weitere instanzierte Teile, Farben aus `theme.palette`), im
  Sommer Strohhut für manche. Berufshüte haben Vorrang.
- Pausen und Feierabend draußen richten sich nach dem Wetter: Bei Regen oder Kälte sitzen sie kürzer am Lagerfeuer
  und gehen früher heim.
- Ausrüstung entsteht im Code (wie Axt und Angel) und bekommt Farben aus `theme.palette`; später per Schlüssel im
  Theme austauschbar (`assets.md` 4).
- Freizeit bringt Freude; Lieblingsbeschäftigung bringt doppelt so viel. Die Kreatur kann mitmachen (Fuchs im
  Schnee, Hund-ähnliches Apportieren beim Ballspiel), wenn ihr Spieltrieb hoch ist.

## 7. Animationen je Tätigkeit

**Stand:** 🟡 teilweise – je Tätigkeit eine Pose vorhanden, Varianten und Einschübe geplant

### 7.1 Ziel

Heute hat jeder Zustand genau eine Pose. Künftig hat jede Tätigkeit **mehrere Varianten** und **kleine Einschübe**,
damit 40 Bewohner bei derselben Arbeit nicht wie Klone wirken:

- **Grundbewegung** in Varianten: Der Wesenszug und ein Zufallswert je Bewohner wählen Tempo, Ausholweite und Haltung.
- **Einschübe** (selten, kurz): zwischen zwei Arbeitsschritten Schweiß abwischen, Rücken strecken, Werkzeug prüfen,
  zum Nachbarn winken.
- **Stimmung färbt die Bewegung:** fröhlich = federnd und schneller, müde = schlurfend und gebeugt, ängstlich =
  geduckt und mit Blick zur Hand.
- **Übergänge** zwischen Zuständen weich überblenden (wie heute Knien und Sitzen), etwa Werkzeug abnehmen, bevor
  es losgeht.

### 7.2 Liste der Tätigkeiten und Varianten

| Tätigkeit | Varianten der Grundbewegung | Einschübe | Stand |
|---|---|---|---|
| Gehen | normal, schlendern, eilig (Eile), schlurfend (müde), hüpfend (fröhlich), geduckt (Angst, Anpirschen) | umschauen, winken, stolpern | 🟡 teilweise – eine Gangart + Anpirschen + Flucht |
| Stehen | gerade, Gewicht auf einem Bein, Arme verschränkt | umschauen, strecken, gähnen, Kopf kratzen | 🟡 teilweise – eine Pose |
| Holz fällen | weit ausholen, kurze schnelle Hiebe | Schweiß abwischen, in die Hände spucken, „Baum fällt!“ rufen | 🟡 teilweise – ein Hieb (`chopPose`) |
| Säen, Pflanzen, Ernten | Spaten, Körner werfen, bücken und pflücken | Rücken strecken | 🟡 teilweise – eine Grabpose (`digPose`) |
| Sägen | ziehen und schieben, Brett prüfen | Sägemehl abklopfen | 🟡 teilweise – eine Pose |
| Mahlen, Backen | Korn schütten, kneten, Teig formen, Brot aus dem Ofen ziehen | Mehl von der Schürze klopfen | 🟡 teilweise – je Beruf eine Pose |
| Vieh versorgen | Futter streuen, Eimer tragen, Tier streicheln | – | 🟡 teilweise – eine Pose (`tend`) |
| Jagen | anpirschen, zielen, Treffer bzw. Daneben mit Reaktion | Pfeil holen | 🟡 teilweise – ohne Reaktion auf Treffer |
| Fischen | auswerfen, warten, Biss, einholen | warten: gähnen, Beine baumeln lassen, pfeifen; Fang hochhalten | 🟡 teilweise – ohne Einschübe |
| Tragen | vor dem Bauch, auf der Schulter, schwer (gebeugt) | absetzen und durchschnaufen | 🟡 teilweise – eine Haltung |
| Beten | knien, Arme heben, verbeugen, stehend mit gefalteten Händen | – | 🟡 teilweise – eine Abfolge (`prayPose`) |
| Bitten | kniend mit erhobenen Armen | aufstehen und zum Himmel zeigen | 🟡 teilweise – eine Pose |
| Essen | ins Brot beißen, trinken, mit Nachbarn reden | Brot teilen | 🟡 teilweise – eine Pose |
| Schlafen | in der Hütte (unsichtbar); Nickerchen im Freien | – | 🟡 teilweise – nur unsichtbar in der Hütte |
| Gegriffen werden | zappeln (heute), bei guter Hand still staunen, bei finsterer Hand strampeln | – | 🟡 teilweise – eine Pose |
| Landen | auf den Füßen, auf dem Hosenboden, Purzelbaum | Staub abklopfen, Faust schütteln | 🟡 teilweise – Schwindel |
| Freizeit (Abschnitt 6) | je Beschäftigung eigene Abfolge | – | 💡 Idee |

### 7.3 Technik

- **Weiter prozedural**, solange die Bewohner aus Code-Teilen bestehen: Posen-Funktionen wie `chopPose`, die eine
  Phase 0…1 in Winkel für Arme, Rumpf, Beine umrechnen. Für Varianten bekommt jede Tätigkeit eine kleine Liste solcher
  Funktionen; ein Einschub ist eine weitere Funktion, die für eine Weile Vorrang hat.
- Die Posen-Funktionen gehören in ein eigenes Modul (z. B. `src/village/poses.js`), damit `render.js` übersichtlich
  bleibt. Auswahl der Variante und Einschübe in `render.js` bzw. `ai.js`.
- Heute kennt `render.js` nur Arm-, Bein- und Rumpfwinkel. Für Gesten wie „Kopf kratzen“ oder „winken“ fehlen
  Ellbogen und Kopfneigung; das sind zusätzliche Freiheitsgrade, aber keine neuen Meshes (Kopf neigen) bzw. ein
  geteilter Arm (Ellbogen), der doppelt so viele Arm-Instanzen kostet.
- **Austauschbare Bewohner** (`assets.md` 4.2): Beim geplanten Teile-Modell (Weg A) bleibt die Bewegung im Code;
  alles hier gilt unverändert. Neue Freiheitsgrade (Kopf neigen, Ellbogen) und neue Teile (Mund, Brauen, Mütze,
  Sportgerät) müssen dann auch in der Teileliste für Designer stehen. Beim Skelett-Modell (Weg B) ist die Tabelle
  in 7.2 die Liste der Animationen, die ein Designer liefern muss (Namen wie `Walk`, `Walk_Tired`, `Chop`,
  `Chop_Wipe`, `Ski`), festgelegt im Theme.
- Leistung: Varianten kosten kaum etwas (nur Rechnung je Bewohner). Gesichtsteile und Ausrüstung kosten Instanzen;
  bei 40 Bewohnern unkritisch, Teile ohne Nutzen (Ski im Sommer) bleiben bei `count = 0` bzw. Nullmatrix.

## 8. Fokus auf einen Bewohner

**Stand:** 🔵 geplant

### 8.1 Auswählen

- **Blick-Werkzeug:** Tippen auf einen Bewohner wählt ihn aus (die Hand ist dort ausgeblendet, es gibt also keinen
  Konflikt mit dem Greifen).
- **Hand-Werkzeug:** kurzes Tippen (bzw. Klick) ohne Ziehen auf einen Bewohner wählt ihn aus; Drücken und kurz
  Halten oder Ziehen packt ihn. Das Packen ist mit „Halten als Zustand“ (`gott-und-hand.md` 3.2,
  [#6](https://github.com/Lycidas42/weltenkeim/issues/6)) so umgestellt; bis das Auswählen kommt, zeigt ein Tipp nur
  „Halten zum Aufnehmen“.
- Ausgewählt: dezenter Ring am Boden unter dem Bewohner, die Kamera folgt ihm wie heute der Kreatur („Folgen“,
  `setFollow` wird dafür auf ein beliebiges Ziel erweitert). Wischen löst das Folgen, die Karte bleibt offen.

### 8.2 Bewohner-Karte

Ein kleines Blatt (wie das Kreatur-Blatt, am Handy unten, halbe Höhe, Spielwelt bleibt sichtbar):

- Kopf: **Porträt** (kleine 3D-Ansicht wie `src/ui/portrait.js` für die Kreatur, Kopf und Oberkörper mit Mimik),
  Name, Beruf mit Hut-Symbol, Wesenszug.
- **Jetzt:** Tätigkeit als Satz („Mira sägt einen Stamm“, „Jorin hat frei und fährt Ski“), Laune als Symbol und Wort.
- **Bedürfnisse:** drei kurze Balken (Müdigkeit, Hunger, Freude) mit Symbolen statt Zahlen.
- **Gedanken:** die letzten zwei, drei Sprechblasen.
- **Tag:** Zeitleiste des Tages (Arbeit, Mittag, Feierabend, Schlaf), nächster freier Tag.
- **Aktionen:** Folgen an/aus, Urlaub schenken (5.3), Beruf ändern (springt ins Arbeit-Panel), später Segnen bzw.
  bei böser Ausrichtung Erschrecken (`gut-und-boese.md`).
- Wechsel zum nächsten Bewohner per Wischen auf der Karte oder Pfeilen; Reihenfolge nach Beruf.

### 8.3 Überblick über alle

- **Arbeit-Panel:** je Bewohner eine Zeile oder Kachel mit Name, Beruf, Laune-Symbol, Urlaub; Tippen öffnet die Karte
  und springt hin. Sortierbar nach Laune, damit der Spieler sieht, wem es schlecht geht.
- **Kopfzeile:** neben der Bewohnerzahl ein Symbol der Dorfstimmung (Sonne, Wolke, Gewitterwolke). Tippen öffnet
  den Überblick.
- **Hinweise:** Bei auffälligen Zuständen ein ruhiger Hinweis („Ilse ist erschöpft“), höchstens einer alle paar
  Minuten, mit Sprung zur Karte.

## 9. Gut und Böse aus Sicht der Bewohner

**Stand:** 🔵 geplant – setzt die Waage voraus (`gott-und-hand.md` 7)

Die Waage (`gott-und-hand.md` 7) bestimmt, wie die Bewohner zu ihrem Gott stehen. Wie Welt und Schrein sich
verändern, steht in `gut-und-boese.md`.

| | guter Gott | böser Gott |
|---|---|---|
| Grundgefühl | Liebe, Dank | Furcht, Ehrfurcht |
| Beten | aus Liebe: gleichmäßig, Freude erhöht den Ertrag | aus Furcht: in Schüben nach Schrecken, insgesamt etwa gleich viel, aber unregelmäßiger |
| Arbeit | zufrieden, normales Tempo mit Pausen | schneller unter Angst, kürzere Pausen, kein freier Tag ohne Erlaubnis |
| Hand kommt näher | winken, lächeln, Herz | ducken, fliehen, Ausrufezeichen (`gott-und-hand.md` 9) |
| Kreatur | winken, mit ihr spielen | ausweichen, fliehen (`kreatur.md` 3.3) |
| Freizeit | Feste, Sport, Musik | selten, leise, in Grüppchen |
| Sprechblasen | „Gesegnet sei die Hand!“ | „Pst, er sieht uns …“ |

- Beide Wege sind spielbar und bringen Glaube, nur auf andere Art. Ein böser Gott hat ein fleißigeres, aber
  freudloseres Dorf.
- Taten an einzelnen Bewohnern (sanft absetzen, werfen, Urlaub schenken) wirken zusätzlich auf deren eigene Laune
  und auf die Nachbarn, die zusehen.

## 10. Spielstand

| Feld | Inhalt | Stand |
|---|---|---|
| `S.pop` | Anzahl der Bewohner | ✅ vorhanden |
| `S.folk` | Liste je Bewohner: `{ id, name, seed, trait, like, needs: { tired, hunger, joy }, off }` (`off` = nächster freier Tag) | 🔵 geplant |

- `S.folk` ist im Spielstand noch frei. Beim Laden alter Stände ohne `S.folk` werden für `S.pop` Bewohner Namen und
  Eigenschaften gewürfelt; der Saatwert ist dann der bisherige Platz, damit sich das Aussehen nicht ändert.
- Was ein Bewohner gerade tut, wird nicht gespeichert (wie heute); Bedürfnisse und Urlaub schon.
- Bewohner gehören zur Welt, nicht zum Profil (`spielstaende.md` 1). Der Ton-Schalter gehört zum Profil.
- Neue Felder abwärtskompatibel mit Standardwert in `S`; Größe bei 40 Bewohnern etwa 4 KB.

## 11. Vorgeschlagene Reihenfolge

1. **Identität:** Namen, Wesenszug, `S.folk`; Bewohner antippen, Karte mit Name, Beruf und Tätigkeit, Folgen.
2. **Symbole über dem Kopf** für die vorhandenen Ereignisse (Jubel, Flucht, Wurf, Schlaf, Bitte).
3. **Bedürfnisse und Laune** mit Wirkung auf Tempo und Gebet; zusammen mit dem Essen aus `nahrung.md` 1.
4. **Pausen** (Verschnaufen, Trinken, Plausch) und Feierabend am Lagerfeuer.
5. **Animationsvarianten** und Einschübe für die häufigsten Tätigkeiten (Gehen, Stehen, Holz fällen, Tragen).
6. **Mimik** (Mund, Brauen, Blinzeln) und Sprechblasen.
7. **Urlaub** mit Vertretung und „Urlaub schenken“.
8. **Freizeit und Sport:** zuerst Schneespaß und Skifahren (Schnee gibt es schon), dann Strand und Surfen
   (braucht Wellen). Mit dem Kalender aus `jahreszeiten.md` wechseln sie sich übers Jahr ab.
9. **Ton:** eigenes Vorhaben, danach Stimmen der Bewohner.

## 12. Offene Fragen

- Wie werden Bewohner im Hand-Werkzeug ausgewählt, ohne das Greifen zu stören (kurzes Tippen, langes Drücken, nur im
  Blick-Werkzeug)?
- Sollen Bewohner altern, Kinder bekommen und die Insel verlassen können, oder bleibt die Zahl rein über
  „Seele rufen“ gesteuert?
- Brabbelsprache oder gar keine Stimmen, nur Geräusche?
- Wie oft sollen Sprechblasen erscheinen, ohne zu nerven? Schalter „gesprächig / ruhig“ in den Einstellungen?
- Darf ein böser Gott Urlaub streichen (böse Tat), oder ist Urlaub immer frei?
