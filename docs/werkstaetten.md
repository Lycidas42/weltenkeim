# Werkstätten und Rohstoffe

Neue Werkstätten des Dorfes und die Rohstoffe, die sie verarbeiten. Bestehende Werkstätten (Sägemühle, Mühle,
Bäckerei) stehen im Code (`village/workshops.js`, `PROC` in `core/state.js`). Die Sattlerei für die Ausrüstung der
Kreatur steht in `kreatur.md` 3.13 B, die Kreatur selbst in `kreatur.md`.

## 1. Steinmetz und Steine

**Stand:** 🔵 geplant – Umsetzung später

### A. Warum

- Felsen haben heute keinen Zweck: Sie liegen nur außerhalb des Dorfes. Die Kreatur kann sie schon bewegen (Stier
  schiebt sie mit dem Kopf, Fuchs hebt sie mit Lichtranken, `kreatur.md` 3.13), und ihre Lage wird gespeichert
  (`S.rocks`).
- Ein Steinmetz macht aus Felsen **Steine**, eine neue Ware für spätere Bauten. So bekommt das Felsenschieben einen
  Sinn, und Kreatur und Dorf arbeiten zusammen.

### B. Ablauf

- **Hütte und Beruf:** Steinmetz (Steinmetzhütte) wie die übrigen Werkstätten, mit Arbeitsplatz und sichtbarer Arbeit
  (Meißel, Splitter, Staub).
- **Felsen zum Steinmetz:**
  - Die Kreatur bringt einen Felsen zur Hütte: der Stier schiebt ihn, der Fuchs trägt ihn mit Lichtranken (kostet
    Glaube). Dort zerlegt der Steinmetz ihn nach und nach; die Menge Steine hängt von der Größe ab.
  - Ohne Kreatur geht der Steinmetz selbst zu einem Felsen in der Nähe und schlägt dort Steine ab (langsamer);
    der Felsen wird dabei kleiner und verschwindet zuletzt. Träger bringen die Steine ins Lager.
- **Ware Steine:** im Lager (`S.stone`, Feldname vorher prüfen), mit Anzeige in der Leiste wie Stämme und Bretter.

### C. Wofür Steine (offen, zur Auswahl)

- Brunnen und Fundamente, später Steinhäuser oder Häuser mit Steinsockel.
- Wege pflastern (schneller gehen, weniger Abnutzung).
- Ausbau des Schreins (Stufe, Mauer).
- Steinbrücke über den Bach.

### D. Felsen werden weniger

- Felsen sind endlich. Offen: ob neue Felsen auftauchen (z. B. wenn die Hand beim Formen tief gräbt oder Berge
  anhebt) oder ob Steine knapp bleiben sollen.

## 2. Bauplätze freiräumen

**Stand:** 🔵 geplant – Umsetzung später, zusammen mit dem Steinmetz

🟡 Erster Teil im Prototyp (Branch `claude/vierbeiner-test`): Neue Felder des Stiers liegen oft auf Felsen; er
schiebt sie vorher weg (`kreatur.md` 3.13).

- Heute halten die Felsen Abstand zu Dorf, Bauplätzen und Feldern (`keepFree` in `world/nature.js`). Künftig dürfen
  am Dorfrand Felsen auch auf Plätzen liegen, die das Dorf erst später braucht (neue Häuser, Hütten, Felder).
- Ein Bauplatz mit Felsen ist **blockiert** und so markiert. Gebaut wird erst, wenn er frei ist.
- **Die Kreatur räumt ihn:** als Hilfe aus eigenem Antrieb (Neigung Helfen), wenn ein blockierter Platz gebraucht
  wird. Der Felsen geht zum Steinmetz, sobald es einen gibt, sonst an den Rand des Dorfes.
- Später denkbar: Die Hand kann kleine Felsen greifen und werfen wie Bäume (`gott-und-hand.md`).

## 3. Reihenfolge

1. Steinmetz und Ware Steine (1 A, B), mit dem Abschlagen am Felsen ohne Kreatur.
2. Die Kreatur bringt Felsen zum Steinmetz (Stier schiebt, Fuchs mit Lichtranken).
3. Felsen auf späteren Bauplätzen, Freiräumen durch die Kreatur (2).
4. Verwendung der Steine (1 C), je nach Wahl.
