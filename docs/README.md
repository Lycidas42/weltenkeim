# Konzepte und Vorgaben – Überblick

Hier liegen die Konzepte für Weltenkeim und die Vorgaben für Designer. Die Dateien bleiben im Repo und werden nicht
ausgeliefert. Regeln für den Code stehen in `CLAUDE.md` im Wurzelordner.

## Dokumente

| Datei | Inhalt |
|---|---|
| `gott-und-hand.md` | der Spieler als Gott: Werkzeuge, Wunder, Greifen und Tragen, Formen, Hand stärken, Waage und Taten, Aussehen der Hand |
| `gut-und-boese.md` | wie Welt, Schrein und Kreatur auf die Waage reagieren |
| `bewohner.md` | die Bewohner: Identität, Bedürfnisse, Gefühle und Ausdruck, Pausen und Urlaub, Freizeit und Sport, Animationen, Fokus auf einen Bewohner |
| `kreatur.md` | die Kreatur (Tiergeist): Alter, Bedürfnisse, Ausrichtung, Eigenwille, Leine, Persönlichkeit, Erleben in der Welt und „Warum?“, zweibeinige Gestalt, Handeln als Tier |
| `kreatur-lernen.md` | die Kreatur lernt durch Zusehen, was die Hand vormacht, bis hin zu Wundern |
| `werkstaetten.md` | neue Werkstätten und Rohstoffe: Steinmetz und Steine, Bauplätze von Felsen freiräumen |
| `nahrung.md` | wofür die Lebensmittel da sind: Essen, Wachstum, Gaben, Kreatur füttern, Verarbeitung |
| `jahreszeiten.md` | Frühling bis Winter: Verfärben, Laubfall, Wiesen, Felder; Kalender und Technik |
| `spielstaende.md` | mehrere Welten, Export und Import, Cloud-Sicherung mit Supabase |
| `online-funktionen.md` | Profil, Bestenlisten, Präsenz, Feedback, Umfragen, Neuigkeiten, Verwaltung |
| `assets.md` | Vorgaben für Designer: Modelle und Themes, Maße, Farbrollen, Grenzen fürs Handy |
| `blender-mcp-setup.md` | Blender mit Claude verbinden (Werkzeug, kein Konzept) |

Jedes Thema hat genau ein Zuhause. Berührt ein Dokument ein fremdes Thema, verweist es mit Datei und Abschnitt
dorthin, statt es zu wiederholen (z. B. die Waage steht nur in `gott-und-hand.md` 7, die Gefühle der Bewohner nur in
`bewohner.md`).

## Stand der Features

Jedes Feature in den Konzepten trägt seinen Stand, damit die Docs zugleich Planungsgrundlage sind:

| Marke | Bedeutung |
|---|---|
| ✅ vorhanden | im Spiel |
| 🟡 teilweise | angelegt, aber unvollständig |
| 🔵 geplant | beschlossen, noch nicht gebaut |
| 💡 Idee | Vorschlag, noch nicht entschieden |
| ⏸️ zurückgestellt | beschlossen, aber bewusst auf später verschoben |
| ⛔ verworfen | bewusst nicht vorgesehen (bleibt notiert, damit die Frage nicht wiederkommt) |

**So wird markiert:**

- Unter der Überschrift eines Feature-Abschnitts steht eine Zeile `**Stand:** 🔵 geplant`, bei Bedarf mit kurzer
  Erläuterung („– setzt die Waage voraus“). Unterabschnitte erben den Stand, solange sie keinen eigenen haben.
- Tabellen mit mehreren Features haben eine Spalte „Stand“ mit denselben Marken.
- Einzelne Punkte in Listen bekommen die Marke vorn (`- 💡 Lern-Leine: …`), wenn sie vom Abschnitt abweichen.
- Abschnitte „Ist-Stand“ beschreiben, was heute im Spiel ist, und brauchen keine Marke.
- Gibt es für ein Feature ein Issue, steht der Link hinter der Marke:
  `**Stand:** 🔵 geplant · [#12](https://github.com/Lycidas42/weltenkeim/issues/12)`.

**Pflege:** Wird ein Feature gebaut, die Marke im Konzept auf ✅ bzw. 🟡 setzen (das gehört in denselben Pull Request
wie das Feature). Wird eine Idee entschieden, wird sie 🔵 oder ⛔.

**Überblick in der Konsole:**

```sh
grep -rn "🔵" docs/    # alles Geplante
grep -rn "🟡" docs/    # Angefangenes
grep -rn "💡" docs/    # offene Ideen, die eine Entscheidung brauchen
```

## Umsetzung über GitHub-Issues

Die Docs beschreiben **was** und **warum**. Umgesetzt wird über GitHub-Issues: Ein Issue ist ein abgegrenzter Auftrag,
den eine Claude-Code-Sitzung in der Cloud selbstständig bis zum Pull Request bringen kann.

| Ort | Inhalt |
|---|---|
| `docs/` | Konzept, Stand-Marke, Link zum Issue |
| Issue (Vorlage „Feature umsetzen“) | Umfang, Nicht im Umfang, Entscheidungen, Akzeptanzkriterien |
| Fahrplan-Issue | Reihenfolge: die Feature-Issues als Unter-Issues, oben das nächste |
| Pull Request nach `develop` | die Umsetzung, schließt das Issue mit `Closes #n` |

**Ablauf:**

1. **Issue anlegen** mit der Vorlage „Feature umsetzen“ (`.github/ISSUE_TEMPLATE/feature.yml`), Link im Konzept eintragen.
2. **Klären:** Offene Fragen im Issue beantworten. Erst wenn nichts mehr offen ist, Label `bereit` setzen.
3. **Umsetzen lassen:** eine Cloud-Sitzung mit „Setze Issue #n um“ starten. Sie arbeitet auf einem eigenen Branch
   `claude/issue-<n>-<kurzname>`, prüft die Akzeptanzkriterien und öffnet einen Pull Request nach `develop`.
4. **Rückfragen:** Stößt die Sitzung auf eine Gestaltungsfrage, schreibt sie einen Kommentar ins Issue, setzt das
   Label `frage` und wartet, statt zu raten.
5. **Abnahme:** Pull Request ansehen (Screenshots im PR), am Handy ausprobieren, mergen. Das Issue schließt sich
   dabei, weil `develop` der Standard-Branch ist. Veröffentlicht wird weiterhin nur auf Freigabe nach `main`.

**Labels:** `feature` (setzt die Vorlage), `bereit` (kann an Claude), `frage` (wartet auf eine Antwort). Angelegt
werden sie vom Workflow `.github/workflows/labels.yml`; neue Labels dort eintragen.

**Screenshots** der Sitzungen liegen im Branch `screenshots` (je Issue ein Ordner) und sind im Pull Request verlinkt.

### Fahrplan

Die Reihenfolge steht im Issue [#1 Fahrplan](https://github.com/Lycidas42/weltenkeim/issues/1): Feature-Issues hängen
dort als Unter-Issues, Schritte ohne eigenes Issue stehen in seiner Beschreibung. Als Erstes kommt ein automatischer
Prüflauf, damit eine Sitzung selbst feststellen kann, ob sie fertig ist.

**Prüflauf:** ✅ vorhanden · [#2](https://github.com/Lycidas42/weltenkeim/issues/2) – `node dev/check.mjs` lädt das Spiel
in Chromium ohne Bildschirm (frischer Start und Spielstände aus `dev/saves/`), rechnet Spielzeit vor, meldet Fehler und
legt Screenshots in `dev/out/` ab; eigene Prüfungen unter `dev/checks/<name>.mjs`.

## Abhängigkeiten zwischen den Vorhaben

Jedes Dokument hat seine eigene Reihenfolge. Diese Punkte verbinden sie:

- **Nahrung** (`nahrung.md` 1) ist Voraussetzung für den Hunger der Bewohner (`bewohner.md` 3.2) und der Kreatur
  (`kreatur.md` 3.2).
- **Waage** (`gott-und-hand.md` 7) ist Voraussetzung für alles in `gut-und-boese.md`, für die Reaktionen der Bewohner
  (`bewohner.md` 9), die Veränderung der Hand und die Bestenlisten „Gütigster/Finsterster Gott“.
- **Halten als Zustand** (`gott-und-hand.md` 3.2) entscheidet mit, wie man einen Bewohner auswählt
  (`bewohner.md` 8.1).
- **Kalender** (`jahreszeiten.md` 3, Punkt 1) ist Voraussetzung für Ernte im Herbst, Winter mit Vorräten (`nahrung.md`) und
  Freizeit je Jahreszeit (`bewohner.md` 6).
- **Speichermodul und Spielzustand an einem Ort** (`spielstaende.md` 2.2) ist Voraussetzung für mehrere Welten und
  alles Online.
- **Ton** gibt es noch nicht; Stimmen der Bewohner (`bewohner.md` 4.5) setzen ein Tonsystem voraus.
