# Konzepte und Vorgaben – Überblick

Hier liegen die Konzepte für Weltenkeim und die Vorgaben für Designer. Die Dateien bleiben im Repo und werden nicht
ausgeliefert. Regeln für den Code stehen in `CLAUDE.md` im Wurzelordner.

## Dokumente

| Datei | Inhalt |
|---|---|
| `gott-und-hand.md` | der Spieler als Gott: Werkzeuge, Wunder, Greifen und Tragen, Formen, Hand stärken, Waage und Taten, Aussehen der Hand |
| `gut-und-boese.md` | wie Welt, Schrein und Kreatur auf die Waage reagieren |
| `bewohner.md` | die Bewohner: Identität, Bedürfnisse, Gefühle und Ausdruck, Pausen und Urlaub, Freizeit und Sport, Animationen, Fokus auf einen Bewohner |
| `kreatur.md` | die Kreatur (Tiergeist): Abgleich mit *Black & White*, Alter, Bedürfnisse, Ausrichtung, Leine, Eigenwille |
| `kreatur-lernen.md` | die Kreatur lernt durch Zusehen, was die Hand vormacht, bis hin zu Wundern |
| `nahrung.md` | wofür die Lebensmittel da sind: Essen, Wachstum, Gaben, Kreatur füttern, Verarbeitung |
| `jahreszeiten.md` | Frühling bis Winter: Verfärben, Laubfall, Wiesen, Felder; Kalender und Technik |
| `spielstaende.md` | mehrere Welten, Export und Import, Cloud-Sicherung mit Supabase |
| `online-funktionen.md` | Profil, Bestenlisten, Präsenz, Feedback, Umfragen, Neuigkeiten, Verwaltung |
| `assets.md` | Vorgaben für Designer: Modelle und Themes, Maße, Farbrollen, Grenzen fürs Handy |
| `blender-mcp-setup.md` | Blender mit Claude verbinden (Werkzeug, kein Konzept) |

Jedes Thema hat genau ein Zuhause. Berührt ein Dokument ein fremdes Thema, verweist es mit Datei und Abschnitt
dorthin, statt es zu wiederholen (z. B. die Waage steht nur in `gott-und-hand.md` 7, die Gefühle der Bewohner nur in
`bewohner.md`).

## Stand-Begriffe

In Tabellen und Listen der Konzepte:

| Begriff | Bedeutung |
|---|---|
| **vorhanden** | im Spiel |
| **teilweise** | angelegt, aber unvollständig |
| **geplant** | beschlossene Richtung, noch nicht gebaut |
| **Idee** | Vorschlag zur Auswahl, noch nicht entschieden |

## Abhängigkeiten zwischen den Vorhaben

Jedes Dokument hat seine eigene Reihenfolge. Diese Punkte verbinden sie:

- **Nahrung** (`nahrung.md` 1) ist Voraussetzung für den Hunger der Bewohner (`bewohner.md` 3.2) und der Kreatur
  (`kreatur.md` 4.2).
- **Waage** (`gott-und-hand.md` 7) ist Voraussetzung für alles in `gut-und-boese.md`, für die Reaktionen der Bewohner
  (`bewohner.md` 9), die Veränderung der Hand und die Bestenlisten „Gütigster/Finsterster Gott“.
- **Halten als Zustand** (`gott-und-hand.md` 3.2) entscheidet mit, wie man einen Bewohner auswählt
  (`bewohner.md` 8.1).
- **Kalender** (`jahreszeiten.md` 3, Punkt 1) ist Voraussetzung für Ernte im Herbst, Winter mit Vorräten (`nahrung.md`) und
  Freizeit je Jahreszeit (`bewohner.md` 6).
- **Speichermodul und Spielzustand an einem Ort** (`spielstaende.md` 2.2) ist Voraussetzung für mehrere Welten und
  alles Online.
- **Ton** gibt es noch nicht; Stimmen der Bewohner (`bewohner.md` 4.5) setzen ein Tonsystem voraus.
