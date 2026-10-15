# Nahrung: wofür Fleisch, Fisch, Gemüse, Milch, Eier und Brot?

Die Produktion ist komplett, die Waren landen im Lager. Seit [#8](https://github.com/Lycidas42/weltenkeim/issues/8)
essen die Bewohner mittags davon, das Dorf wächst nur mit Vorrat, und gut versorgte Bewohner bringen Gaben zum Schrein
(Abschnitte 1–3). Die übrigen Abschnitte sind Vorschläge zur Auswahl; sie lassen sich kombinieren.

Verwandt: `bewohner.md` (Hunger als Bedürfnis, Mittagspause, Feierabend), `kreatur.md` (Hunger der Kreatur),
`jahreszeiten.md` (Ernte im Herbst, Winter mit Vorräten). Stand der Features: siehe `README.md`.

## 1. Bewohner essen (Grundversorgung)

**Stand:** ✅ vorhanden ([#8](https://github.com/Lycidas42/weltenkeim/issues/8), `src/village/food.js`) – Bitte um
Nahrung und Wunder „Segen der Ernte“ noch offen

- Jeder Bewohner nimmt sich zur Mittagspause auf dem Dorfplatz einmal am Tag eine **Portion** aus dem Lager: Brot,
  Fisch, Fleisch, Gemüse je 1 Stück, Milch und Eier zählen halb (2 Stück = 1 Portion). Korn und Mehl sind keine Mahlzeit.
- Er nimmt die Sorte, von der am meisten im Lager liegt; so verteilt sich der Verbrauch von selbst. Was er isst, hält
  er in der Hand (Farbe je Sorte, `theme.palette.food`); ohne Essen sitzt er mit leeren Händen da.
- Versorgung je Bewohner als einfacher Tageswert (nur zur Laufzeit): **satt** oder **hungrig**, gilt bis zur nächsten
  Mittagspause. Das Dorf ist **abwechslungsreich** versorgt, wenn in den letzten 3 Tagen mindestens 3 Sorten gegessen
  wurden.
- **Wirkung:** satt und abwechslungsreich: Arbeitstempo +10 %, Gebetsertrag +20 %. Nur satt: wie bisher. Hungrig:
  Gebetsertrag −30 %, Arbeitstempo unverändert. Niemand verhungert, hört auf zu arbeiten oder verlässt die Insel.
- Beim ersten Hunger (einmal je Spielstand) ein Hinweis mit Tipp (Fischerhütte, Jagd, Bauernhof).
- **Anzeige:** im Lager „Vorrat reicht für etwa X Tage“ (Portionen ÷ Bewohner), unter einem Tag hervorgehoben; das
  Arbeit-Panel (Tippen aufs Lager) nennt dazu Portionen, Wachstum und Versorgung.
- **Startvorrat:** Neue Spiele beginnen mit 30 Portionen (12 Brot, 10 Fisch, 8 Gemüse), alte Spielstände nicht.
- **Spielstand:** Spieltag `S.day`, gegessene Sorten der letzten Tage `S.meals`, letzte Gabe `S.offer`, gezeigte
  Hinweise `S.foodHints`.
- Noch offen: **Hunger** als Bitte am Schrein um Nahrung („Wunder: Segen der Ernte“ als neue Bitte, analog
  Regen/Eile).

## 2. Bevölkerungswachstum

**Stand:** ✅ vorhanden ([#8](https://github.com/Lycidas42/weltenkeim/issues/8)) – zweite Siedlungsstufe noch Idee

- Von selbst kommt alle 9 s ein Bewohner dazu, solange in den Häusern Platz ist **und** der Vorrat für mindestens
  **2 Tage** für alle Bewohner reicht. Jeder neue Bewohner verbraucht **3 Portionen**.
- Häuser und Hütten werden weiter aus Brettern gebaut; sie bleiben nur leer, solange die Nahrung fehlt.
- **„Seele rufen“** am Schrein (Glaube) geht weiter ohne Nahrung; das Schrein-Panel sagt das, wenn das Wachstum stockt.
- **Sichtbar:** im Lager „Wachstum: Das Dorf wächst“, „Wachstum stockt: zu wenig Nahrung“ oder „Kein Platz in den
  Häusern“; über dem neuesten Haus das Schild „Wartet auf Nahrung“; beim ersten Stocken (einmal je Spielstand) ein
  Hinweis mit Tipp.
- „Während du fort warst“ rechnet Wachstum und Verbrauch nicht nach.
- 💡 Höchstzahl (heute 40) könnte mit einer zweiten Siedlungsstufe steigen, wenn die Versorgung stimmt.

## 3. Feste und Opfergaben am Schrein

**Stand:** 🟡 teilweise – Gaben vorhanden ([#8](https://github.com/Lycidas42/weltenkeim/issues/8)), Dorffest noch Idee

- **Gaben:** Ist das Dorf abwechslungsreich versorgt, holt nachmittags ein freier Bewohner eine Portion aus dem Lager
  und legt sie auf den Altar (höchstens eine Gabe je Tag). Sie liegt dort bis zum Abend und bringt einmalig 8 Glaube
  (Schwebetext „Gabe“).
- 💡 Gelegentliches **Dorffest** auf dem Dorfplatz (Tische, Lagerfeuer, Musik), verbraucht viele Waren, bringt einen großen Glaubensschub und gute Laune für eine Weile. Das Lagerfeuer am Feierabend (`bewohner.md` 5.2) ist die kleine, tägliche Form davon.

## 4. Die Kreatur füttern

**Stand:** 💡 Idee

- Die Kreatur frisst Lieblingsessen (Fuchs: Eier und Fleisch, Wolf: Fleisch, Katze: Fisch, Hirsch, Stier und Alpaka: Gemüse und Brot). Füttern mit der Hand verschiebt ihre Neigung Richtung „hilfsbereit“ – eine zusätzliche Erziehungsmöglichkeit neben Lob und Tadel.
- Füttern direkt nach einer Tat wirkt wie Lob für diese Tat (`kreatur-lernen.md` 2). Gelernt wird aber durch Zuschauen, nicht durch Füttern.

## 5. Verarbeitung

**Stand:** 💡 Idee

- **Metzgerei**: Fleisch → Wurst/Schinken (hält länger, zählt doppelt als Portion).
- **Räucherei** an der Küste: Fisch → Räucherfisch.
- **Käserei**: Milch → Käse.
- Die Bäckerei könnte mit Milch und Eiern zusätzlich Kuchen backen (für Feste).

## 6. Verderb

**Stand:** 💡 Idee – eher später

- Frische Waren (Fisch, Milch) verderben langsam, wenn zu viel im Lager liegt; verarbeitete halten länger. Das gibt der Verarbeitung einen Sinn, macht das Spiel aber anspruchsvoller – für ein entspanntes Aufbauspiel eventuell weglassen.
- Mit Jahreszeiten (`jahreszeiten.md`) bekommt Vorratshaltung ohnehin einen Sinn: Im Winter wächst auf den Feldern nichts, das Dorf lebt von Ernte, Fisch, Jagd und Verarbeitetem.

## Empfehlung für die nächsten Schritte

Der erste Schritt ist umgesetzt: 1 (Mittagessen mit Versorgungsbonus), 2 (Wachstum nur mit Vorrat) und die Gaben aus 3,
Hunger nur sanft (weniger Glaube statt Stillstand). Als Nächstes bieten sich an: die Bitte um Nahrung am Schrein mit dem
Wunder „Segen der Ernte“ (1), die Kreatur füttern (4) und das Dorffest (3), sobald es Feierabend und Laune gibt
(`bewohner.md` 3.2, 5.2).
