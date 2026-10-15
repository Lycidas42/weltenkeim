# Der Gott und seine Hand

Zentrales Konzept für den Spieler als Gott: was er kann, wie er sich in der Welt zeigt und wie Gut und Böse
ihn verändern.

Verwandt: `gut-und-boese.md` (Folgen der Waage für Welt und Schrein), `bewohner.md` (wie die Bewohner auf Hand und
Waage reagieren), `kreatur.md` und `kreatur-lernen.md` (die Kreatur lernt von der Hand), `spielstaende.md` (Hand und
Waage gehören zur Welt). Stand der Features: siehe `README.md`.

## 1. Der Gott

- Der Spieler ist ein unsichtbarer Gott über einer kleinen Insel. In der Welt zeigt er sich auf drei Wegen:
  - **die Hand** – sein Körper in der Welt, mit ihr greift er direkt ein (Abschnitt 3–6);
  - **Wunder** – übernatürliche Macht aus Glaube (Abschnitt 2);
  - **die Kreatur** – sein Tiergeist, der von der Hand lernt und auch handelt, wenn der Spieler nicht hinsieht
    (`kreatur.md`).
- **Glaube** ist seine Kraft: Die Bewohner beten am Schrein, Glaube bezahlt Wunder und den Ausbau von Hand und Tempel.
- Der Gott ist weder gut noch böse vorgegeben. Seine Taten bestimmen, wohin die **Waage** ausschlägt (Abschnitt 7),
  und die Hand zeigt es sichtbar (Abschnitt 9).
- Name und Zeichen des Gottes gehören zum Profil (`online-funktionen.md`), Waage und Hand zur einzelnen Welt
  (`spielstaende.md`): Ein Spieler kann eine gute und eine böse Welt haben.

### Werkzeuge

| Werkzeug | Zweck | Stand |
|---|---|---|
| Blick | Kamera drehen, verschieben, zoomen; die Hand ist ausgeblendet | ✅ vorhanden |
| Hand | greifen, halten, absetzen, werfen, helfen, Bäume ausreißen, Kreatur antippen | ✅ vorhanden |
| Formen | Land heben und senken | ✅ vorhanden |
| Wunder | Wunder wählen und auf die Welt tippen | ✅ vorhanden |

## 2. Wunder

**Grundregel (Abgrenzung zur Hand):** Die Hand tut, was auch ein Bewohner mit Werkzeug und Muskelkraft könnte –
ein Ziel, sofort, kostenlos; ihr Preis ist die Aufmerksamkeit des Spielers. **Wunder tun, was kein Bewohner kann** –
Wetter, Zeit, Geist, Natur; sie wirken auf eine Fläche oder viele Ziele und kosten Glaube.

Prüffrage für jede neue Aktion: *Könnte ein Dorfbewohner das?* Ja → Hand. Nein → Wunder.

| Wunder | Wirkung | Kosten | Richtung | Stand |
|---|---|---|---|---|
| Regen | Fläche: Bäume wachsen, Setzlinge sprießen, Felder wachsen bis zur nächsten Stufe und danach eine Weile schneller, Pfützen | 20 Glaube | gut | ✅ vorhanden (`castRain`) |
| Eile | Fläche: Bewohner gehen und arbeiten schneller, auch in Werkstätten | 12 Glaube | gut | ✅ vorhanden (`castHaste`) |
| Bann | Fläche: Wild erstarrt eine Weile, Jäger treffen sicher | ca. 10 | neutral | 🔵 geplant (heute Hand-Hilfe „Bannen“) |
| Wirbelsturm | Ein Wirbel zieht über eine kurze Bahn: reißt Bäume aus, wirbelt Waren und Bewohner durch die Luft, deckt Dächer ab. Spielerisch nutzbar zum Roden. Bahn per Wischgeste | teuer | böse (im Dorf), neutral (im leeren Wald) | 🔵 geplant |
| Blitz / Feuer | ein Ziel: Gebäude brennt, Baum wird zu Asche | mittel | böse | 🔵 geplant |
| Dürre | Fläche: Felder welken, Bäume wachsen nicht | mittel | böse | 🔵 geplant |
| Plage | Schädlinge auf Feldern, Ernte halbiert | mittel | böse | 🔵 geplant |
| Segen der Ernte | Fläche: Felder reifen ein Stück weiter / Ertrag +50 % | teuer | gut | 💡 Idee |
| Fischzug | ruft einen Schwarm an eine Küstenstelle | mittel | gut | 💡 Idee |
| Wildlocken | lockt Wild an einen Ort | mittel | neutral | 💡 Idee |

- Bitten der Bewohner (Wunsch-Anzeige) verlangen bestimmte Wunder; Erfüllen zählt gut, Verstreichen leicht böse,
  das Gegenteil tun stark böse (Abschnitt 7).
- Die Waage macht Wunder ihrer Richtung günstiger: gute bei guter, böse bei böser Ausrichtung (z. B. bis −25 %).
- Wunder wirken immer auf einen Ort, nicht auf das Gehaltene: Was die Hand hält, bleibt beim Wirken in der Hand.
- Die Kreatur lernt Wunder durch Zusehen und wirkt sie mit Glaube aus dem Vorrat, wenn erlaubt (`kreatur-lernen.md`).

## 3. Greifen, Halten, Absetzen, Werfen

### 3.1 Frühere Bedienung

**Stand:** ⛔ abgelöst durch 3.2

Bis [#6](https://github.com/Lycidas42/weltenkeim/issues/6) galt das Halten nur, solange der Finger auf dem Bildschirm
lag: Beim Loslassen wurde das Gehaltene immer geworfen, ein zweiter Finger oder ein Werkzeugwechsel ließ es sofort
los. Bäume reißt man weiterhin aus, indem man sie gedrückt hält bzw. nach oben zieht (`uprootTree`).

### 3.2 Halten ist ein Zustand, kein gedrückter Finger

**Stand:** ✅ vorhanden · [#6](https://github.com/Lycidas42/weltenkeim/issues/6) – Bewohner und ausgerissene Bäume;
Waren kommen mit 5.2

Die Hand hält, was sie gegriffen hat, **so lange, bis der Spieler es bewusst absetzt oder wirft** – unabhängig davon,
ob der Finger noch auf dem Bildschirm ist.

- **Greifen:** drücken und kurz halten (0,25 s) oder gleich ziehen packt einen Bewohner; währenddessen schließt sich
  die Hand und er zuckt. Ein kurzer Tipp packt nicht – er bleibt frei für das Auswählen (`bewohner.md` 8.1) und
  zeigt bis dahin „Halten zum Aufnehmen“. Bäume reißt man wie bisher durch Halten bzw. nach oben Ziehen aus.
  Später auch Stapel und Waren (Abschnitt 5). Regel: Tippen = etwas an dieser Stelle tun, Halten = nehmen.
- **Halten:** Finger anheben lässt nichts fallen. Die Hand bleibt an ihrer Stelle auf dem Bildschirm und trägt das
  Gegriffene sichtbar (Haltung `hold`). Ein kleines Symbol am Werkzeugknopf „Hand“ zeigt, was gehalten wird
  (Bewohner bzw. Baum).
- **Kamera frei:** Während die Hand etwas hält, gehen alle Kamera-Aktionen: zwei Finger zoomen und verschieben, das
  Blick-Werkzeug ebenso, am Rechner Mausrad, rechte Maustaste, Leertaste/Strg. Die Hand bleibt dabei am selben
  Bildschirmpunkt und gleitet so mit über die Welt – so trägt man etwas weit über die Insel.
- **Bewegen:** Die Hand ist dort, wo der Zeiger ist – leer wie voll, damit sich beim Greifen nichts ändert. Am Handy
  geht sie beim Ziehen unter den Finger (ein Stück darüber) und bleibt nach dem Anheben dort; am Rechner folgt sie
  dem Mauszeiger. Loslassen nach langsamem Ziehen = weiter halten.
- **Absetzen (sanft):** nur per kurzem Tipp (bzw. Klick) auf einen Punkt der Welt – Boden, Gebäude, Feld. Die Hand
  gleitet dorthin, senkt sich und stellt das Gehaltene ab. Bewohner landen auf den Füßen, ohne Schwindel, und gehen
  weiter ihrer Arbeit nach; Bäume werden zu Stämmen. Im Wasser: Bewohner schwimmen an Land, Baum „Platsch!“.
  Es zählt der Punkt unter dem Finger, nicht die Hand, die am Handy darüber schwebt.
- **Tipp ins Leere** (Himmel, kein Bodenpunkt): Das Gehaltene fällt senkrecht unter der Hand herunter, ohne
  Wurfschwung (kann Absicht sein). Aus großer Höhe ist ein Bewohner danach schwindelig.
- **Werfen:** schnelles Wischen mit gehaltenem Finger und Loslassen in der Bewegung (über 700 px/s). Wurfweite wie
  bisher aus der Handgeschwindigkeit. Bäume und Waren dürfen geworfen werden, ohne dass es böse zählt; Bewohner zu
  werfen ist böse (Abschnitt 7).
- **Hand ist voll:** Solange sie etwas hält, hilft die Hand nicht (kein Säen, Ernten, Füttern …), packt nichts
  Weiteres und reißt keinen Baum aus. Ein Tipp auf ein Feld o. Ä. setzt das Gehaltene dort ab; das Schild unter dem
  Zeiger (Rechner) zeigt dann „Absetzen“.
- **Werkzeugwechsel** lässt nichts fallen. Im Wunder- und Formen-Werkzeug sind Hand und Gehaltenes ausgeblendet
  (Symbol am Knopf bleibt); zurück im Hand-Werkzeug ist beides wieder da. Gehaltene Bewohner arbeiten so lange nicht.
- **Kreismenü der Kreatur** bleibt erreichbar: Kreatur mit voller Hand antippen öffnet es, die Hand hält weiter.
  Später: Absetzen auf der Kreatur = ihr das Gehaltene geben (Futter, Holz zum Lernen; kommt mit `nahrung.md`).
- **Rechner:** dasselbe mit der Maus – die Hand folgt dem Zeiger, Klick = Absetzen bzw. Fallenlassen, Ziehen mit
  gedrückter Maustaste und schnelles Loslassen = Werfen.
- **Ereignisse:** `handDrop` (`{ kind, what, x, z, soft }`) und `handThrow` (`{ kind, what, x, z, vx, vz }`), damit
  die Waage sie später zählen kann.
- **Speichern/Neuladen:** Nach dem Neuladen ist die Hand leer (Bewohner zählen weiter über `S.pop`, ein gehaltener
  Baum ist weg). Gehaltene Waren stehen später in `S.held` und sind nach dem Laden wieder in der Hand.
- Mehrere Bewohner auf einmal tragen: ab einer höheren Ausbaustufe der Hand (Abschnitt 6).

### 3.3 Gut und böse beim Tragen

**Stand:** 🔵 geplant – setzt die Waage voraus (7)

- **Sanft absetzen** zählt gut, wenn es dem Bewohner nützt: am Arbeitsplatz, am eigenen Haus am Abend, aus dem
  Wasser oder aus einer Gefahr gerettet. Nur ein kleines Gewicht, und es nimmt ab, wenn man denselben Bewohner
  ständig hin und her trägt (kein Punkte-Sammeln).
- **Werfen** zählt böse, stärker je höher und weiter, ins Wasser oder gegen Gebäude, und bei Wiederholung.
- Die Kreatur sieht zu und lernt beides (`kreatur.md` 3.8).

## 4. Landschaft formen

**Stand:** 🟡 teilweise – Heben und Senken vorhanden, Rest geplant

- **Heute (vorhanden):** Werkzeug „Formen“, Richtung Heben oder Senken wählen, gedrückt halten: Das Land hebt bzw.
  senkt sich weich um den Finger (`sculpt`). Reichweite und Kraft wachsen mit der Stufe der Hand (+35 % je Stufe).
  Geänderte Höhen stehen im Spielstand (`S.terrain`). Haltung der Hand: flach (heben) bzw. Faust (senken).
- **Geplant:**
  - **Ebnen:** dritte Richtung, gleicht die Höhe an den Mittelpunkt an – für Bauplätze, Felder und Wege.
  - Formen unter Gebäuden und Feldern ist gesperrt oder stark gedämpft; wer trotzdem Felder zerstört, begeht eine
    böse Tat.
  - Inseln und Ufer gestalten: Senken unter Wasser schafft Buchten (Fische), Heben schafft Land für das Dorf.
  - Die Kreatur kann Formen nicht lernen (bleibt göttliches Werkzeug der Hand).

## 5. Mit Ressourcen helfen und Ressourcen tragen

### 5.1 Hilfe an Ort und Stelle (Tippen)

**Stand:** 🟡 teilweise – alle Hilfen vorhanden; die Spalte „künftig“ ist geplant

Die Hand nimmt den Bewohnern einen Arbeitsschritt ab – ein Ziel je Tipp (`handHelp`/`helpAt`). Am Rechner zeigt
ein Schild unter dem Zeiger, was ein Klick tut, und die Hand nimmt die passende Haltung an.

| Aktion | heute | künftig | Begründung |
|---|---|---|---|
| Feld säen / ernten | Hand | **Hand** | körperliche Arbeit |
| Feld gießen | ✅ Wunder Regen | **Wunder Regen** | Wasser vom Himmel ist Sache der Götter |
| Vieh füttern (Milch, Eier, Fleisch) | Hand | **Hand** | körperliche Arbeit |
| Fisch greifen | Hand | **Hand** (ein Fisch pro Tipp) | körperlich; ein Schwarm wäre ein Wunder |
| Wild bannen | Hand | **Wunder Bann** | übernatürlich |
| Erlegtes Wild aufheben | Hand | **Hand** | Tragen |
| Setzling pflanzen | Hand | **Hand** | körperliche Arbeit |
| Waren der Hütte ins Lager | Hand | **Hand** | Arbeit der Träger |
| Säge/Mühle/Bäckerei sofort verarbeiten | Hand | **entfällt** → Wunder Eile | Sofort-Produktion ist übernatürlich |
| Bäume ausreißen | Hand | **Hand** | Kraft der Hand |

### 5.2 Ressourcen aufnehmen und tragen

**Stand:** 🔵 geplant

- Am Lager, an einer Hütte oder an einem Holzstapel gedrückt halten: Die Hand packt einen Stapel – je länger, desto
  mehr, bis zur Tragkraft der Stufe. Sichtbar als Bündel, Sack oder Kiste in der Hand.
- Danach gilt das Halten aus 3.2: Kamera frei bewegen, an einer Säge, einem Bauplatz, einer Mühle oder der Kreatur
  **absetzen** – dort wird es als Eingang der Werkstatt bzw. Baumaterial verbucht. Auf freiem Boden abgesetzt,
  entsteht ein Stapel, den Träger später einsammeln.
- Werfen von Waren ist erlaubt (landen als Stapel), aber zerbrechliche Waren (Eier, Milch) gehen teilweise verloren.
- Tippen = kleine Arbeit an Ort und Stelle, Packen und Tragen = Transport. Die Kreatur lernt dadurch, größere
  Mengen gezielt zu verteilen (`kreatur.md` 3.7).
- Gehaltene Waren zählen nicht zum Lager, bis sie abgesetzt sind (Anzeige oben zeigt sie nicht doppelt).

## 6. Hand stärken (Schrein)

**Stand:** 🟡 teilweise – nur Formen wird stärker

Heute erhöht „Hand stärken“ (`S.hand`, Kosten `handCost`) nur Reichweite und Kraft beim Formen. Künftig macht jede
Stufe die Hand insgesamt stärker; der Text im Schrein-Panel nennt die Verbesserung der nächsten Stufe.

| Bereich | pro Stufe (Vorschlag) |
|---|---|
| Formen | Reichweite und Kraft +35 % (wie heute) |
| Tragen | Stufe 1: 6 Stück, jede Stufe +4 |
| Waren von Hütten ins Lager | Menge je Stufe; höhere Stufen leeren auch Nachbarhütten |
| Felder | ab Stufe 2 auch angrenzende Felder in einem Zug |
| Vieh füttern | ab höherer Stufe beide Koppeln und Hühner zugleich |
| Fische greifen | mehr Fische pro Griff |
| Bäume ausreißen | schneller, auch große Bäume; ab hoher Stufe zwei auf einmal |
| Bewohner tragen | mehrere auf einmal |

## 7. Die Waage

**Stand:** 🔵 geplant

- Ausrichtung des Gottes `S.align` von −1 (böse) bis +1 (gut), Start 0 oder leicht gut. **geplant**
- Jede Tat verschiebt die Waage ein wenig, große Taten mehr. Ältere Taten verblassen langsam, die Waage pendelt also
  nicht dauerhaft am Rand, außer man bleibt dabei.
- Böse Taten sind kein Fehler, sondern ein anderer Spielweg: Bewohner gehorchen aus Furcht, Glaube kommt aus Angst
  (Folgen für Welt und Bewohner in `gut-und-boese.md`).

### 7.1 Anzeige

- Kleine Waage im Kopfbereich neben dem Glaube-Feld: zwei Schalen, links hell (Gut), rechts dunkel (Böse), Balken
  neigt sich. Beim Ausschlag kurze Animation und Hinweis („Die Waage neigt sich zum Guten“).
- Im Schrein-Panel: größere Waage und Verlauf der letzten Taten mit ihrem Gewicht (`S.deeds`).
- Die Mini-Waage erscheint auch in der Weltauswahl (`spielstaende.md`) und im Profil/Bestenlisten
  (`online-funktionen.md`).

### 7.2 Taten

| gut | böse |
|---|---|
| Bewohnern bei der Arbeit helfen (ernten, tragen, säen …) | Bewohner hart werfen, ins Wasser werfen |
| erschöpften Bewohnern einen freien Tag schenken (`bewohner.md` 5.3) | Bewohner ohne Pause schuften lassen (Eile auf Eile) |
| Bewohner sanft an einen sinnvollen Ort setzen, retten | Bewohner irgendwo aussetzen, wiederholt herumschleudern |
| Regen auf Felder und Wald, Eile für Arbeiter | böse Wunder: Wirbelsturm im Dorf, Blitz, Dürre, Plage |
| Bitten der Bewohner erfüllen | Bitten verstreichen lassen (leicht), das Gegenteil tun (stark) |
| Setzlinge pflanzen, Wald heilen | Bäume ohne Not ausreißen, Wald kahlschlagen |
| Felder schonen | Felder zertrampeln, zuschütten oder unreif abernten |
| Kreatur für gute Taten loben | Kreatur für Unfug loben, grundlos schlagen |
| Wild schonen, Fische nachwachsen lassen | Wild ausrotten, alle Fische greifen |

## 8. Aussehen der Hand: Editor

**Stand:** 🟡 teilweise – Farben im Spielstand, kein Panel

- **Heute (vorhanden, ohne Oberfläche):** Modell `GodHand.blend` mit den Materialien `Skin`, `Nails`, `Sleeve`,
  `Trim`; `styleHand` färbt sie aus `S.handStyle` (`skin`, `nails`, `sleeve`, `trim`). Ein Panel zum Ändern gibt es
  noch nicht.
- **Editor (geplant):** eigenes Panel „Hand gestalten“, erreichbar im Schrein-Panel (und per langem Druck auf den
  Werkzeugknopf „Hand“). Oben eine große Vorschau der Hand, die sich langsam dreht und die Haltungen durchspielt;
  darunter Kategorien als Reiter:

| Kategorie | Auswahl | Technik |
|---|---|---|
| Haut | Farbfelder (helle bis dunkle Töne, dazu Fantasie: Stein, Gold, Blau) | Farbe `Skin` |
| Nägel | Farbe; Form rund, spitz, kurz; lackiert/matt | Farbe + Skalierung der Nagelknochen bzw. Morph |
| Ärmel | Stoff: Leinen, Samt, Seide, Leder, Kettenhemd, Fell; Farbe; Muster (uni, Streifen, Sterne, Ranken) | Material `Sleeve`: Farbe, Rauheit/Glanz, kleine Muster-Textur |
| Saum | Farbe, Borte (schlicht, gestickt, Gold) | Material `Trim` |
| Schmuck | Ringe (je Finger), Armreif, Siegelring mit Zeichen des Gottes | eigene kleine Meshes, an Fingerknochen gehängt |
| Zeichnung | Bemalung/Tätowierung auf dem Handrücken (Runen, Ranken) | Decal-Textur auf `Skin` |
| Leuchten | Fingerspitzen leuchten in einer Farbe | Emissive, nur Nägel/Spitzen |

- Handytauglich: große Farbfelder statt freier Farbwähler, „Eigene Farbe“ als letztes Feld; Änderungen sofort an der
  Vorschau und an der Hand im Spiel sichtbar; „Zurücksetzen“.
- Freischaltung: Grundfarben frei, Stoffe/Schmuck über Tempelstufe, Glaube oder Meilensteine. Einige Teile sind an
  die Waage gebunden (goldener Armreif nur bei guter, Dornenreif nur bei böser Ausrichtung).
- Neue Meshes und Texturen nur mit freier Lizenz (`assets/CREDITS.md`, Info-Panel).

## 9. Aussehen der Hand: Veränderung durch die Waage

**Stand:** 🔵 geplant

Das Styling des Spielers bleibt die Grundlage; die Ausrichtung legt sich automatisch und stufenweise darüber.
Die Veränderung ist langsam und weich (einige Minuten), damit sie wie Entwicklung wirkt und nicht wie ein Schalter.

| Stufe | Waage | Aussehen |
|---|---|---|
| strahlend | ab +0,6 | helle, weiche Haut, goldener Schimmer, Saum golden, Funken oder Blütenblätter bei Berührung, Licht um die Hand |
| hell | +0,2 … +0,6 | leicht aufgehellt, feiner Schimmer, runde gepflegte Nägel |
| neutral | −0,2 … +0,2 | wie gestaltet |
| dunkel | −0,6 … −0,2 | Haut fahler, Nägel länger und spitzer, Saum dunkler |
| finster | unter −0,6 | aschfahle Haut mit roten Adern, Krallen, glühende Fingerspitzen, Rauchschleier, Berührung lässt Gras welken |

- Technisch: Tönung und Emissive der Materialien je Stufe gemischt (zwischen den Stufen überblenden), Nägel als
  eigenes Material mit Skalierung/Morph zu Krallen, Partikel (Funken bzw. Rauch) an der Hand, Haltungen unverändert.
- Rückweg möglich: Wer wieder gut handelt, dessen Hand wird langsam wieder hell.
- Im Editor zeigt die Vorschau, wie die Hand **jetzt** aussieht (mit Waage); ein Schalter „ohne Waage“ zeigt das
  reine Styling.
- Die Bewohner reagieren auf die Hand: freundlich winken bei heller, ducken und fliehen bei finsterer Hand
  (`bewohner.md` 9).

## 10. Spielstand

| Feld | Inhalt | Stand |
|---|---|---|
| `S.hand` | Ausbaustufe der Hand (Zahl ab 1) | ✅ vorhanden |
| `S.handStyle` | `skin`, `nails`, `sleeve`, `trim`; künftig ergänzt um z. B. `nailShape`, `fabric`, `pattern`, `jewelry` (Liste), `paint`, `glow` | ✅ vorhanden, wird erweitert |
| `S.terrain`, `S.terrainN` | geformte Höhen | ✅ vorhanden |
| `S.align` | Waage −1 … +1 | 🔵 geplant |
| `S.deeds` | letzte Taten (kurze Liste für das Schrein-Panel) | 🔵 geplant |
| `S.held` | gehaltene Waren `{ kind, n }` oder `null` | 🔵 geplant |

Alle neuen Felder abwärtskompatibel mit Standardwert in `S`; `handStyle` wird beim Laden wie heute mit den
Standardwerten zusammengeführt. Hand und Waage gehören zur Welt, nicht zum Profil (`spielstaende.md`).

## 11. Vorgeschlagene Reihenfolge

1. **Halten als Zustand** (3.2) ✅: Absetzen per Tippen, Werfen per Wischen, Kamera frei beim Halten.
2. **Waage** (`S.align`, `S.deeds`) mit Anzeige; vorhandene Taten zählen (Werfen, sanft Absetzen, Helfen, Bitten,
   Regen, Bäume ausreißen).
3. **Abgrenzung Hand/Wunder** umsetzen: Gießen und Sofort-Verarbeitung aus `helpAt` entfernen, Bann als Wunder.
4. **Hand verändert sich mit der Waage** (Tönung, Schimmer/Rauch, Krallen).
5. **Ressourcen tragen** (5.2) und Hand-Stufen für alle Bereiche (6).
6. **Editor** „Hand gestalten“ mit Farben, dann Stoffe, Schmuck, Zeichnung.
7. **Böse Wunder** und Wirbelsturm; Formen um Ebnen erweitern.

## 12. Offene Fragen

- Wirbelsturm: rein böses Wunder oder auch gutes Werkzeug (Roden, Waren verteilen)? Gewicht auf der Waage abhängig
  davon, was er trifft?
- Wie sichtbar soll die Waage für Einsteiger sein – von Anfang an oder erst nach der ersten bösen Tat?
