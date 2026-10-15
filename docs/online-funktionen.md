# Online-Funktionen: Profil, Bestenlisten, Präsenz, Feedback, Umfragen

Baut auf `spielstaende.md` auf: Identität über den geheimen Geräteschlüssel, Supabase-Anbindung, Weltenmodell.
Vorbild ist Kernwacht. Dort laufen bereits: Anzeige „N online“, Profil (Name, Profilbild), Highscores in mehreren
Kategorien, Tageslauf mit Tagesliste, Feedback, Umfragen und eine Verwaltungsseite (`admin.html`).
Hier steht, was davon für Weltenkeim passt, was angepasst werden muss und was neu dazukommt.
Weltenkeim bekommt ein **eigenes Supabase-Projekt** (siehe `spielstaende.md`, 5.1). Code und Datenbankaufbau werden
aus Kernwacht übernommen, aber nicht mit Kernwacht geteilt.

## 0. Grundsätze (aus Kernwacht übernommen)

- **Alles optional:** Ohne Zugangsdaten in `config.js` oder ohne Netz läuft das Spiel vollständig lokal. Jede
  Online-Funktion zeigt dann einen ruhigen Hinweis („gerade nicht erreichbar“), aber nie einen Fehler, der das Spiel stört.
- Die Bibliothek `supabase-js` liegt in `vendor/` und wird **erst bei Bedarf** nachgeladen, nicht beim Start, weil
  das Handy schnell starten soll.
- **Schreiben nur über Funktionen** (`wk_*`, `security definer`), die den Geräteschlüssel prüfen. Öffentlich lesbar sind
  nur ausgewählte Spalten (Profilname, Profilbild, Bestenlistenwerte).
- **Verwaltung** über eigene Funktionen `wk_admin_*` mit einem Verwaltungsschlüssel, von dem nur der Hash in der
  Migration steht.
- Datenbankänderungen als Migration in `supabase/migrations/`, eingespielt über die GitHub-Integration bei Push auf
  `main`. Die Veröffentlichung bleibt damit an die Freigabe gebunden.

## 1. Profil

- **Göttername** (1 bis 16 Zeichen, optional) und **Zeichen** (Profilbild): kleine SVG-Symbole passend zum Spiel
  (Sonne, Mond, Blatt, Flamme, Hand, Auge, Waage …) und eine Farbe. In Kernwacht genauso gelöst (`avatar`, `color` als
  Zahl).
- Ohne Namen bleibt man unsichtbar: Man zählt bei „online“ mit, erscheint aber nicht in Listen.
- Das Profil gilt für den Spieler, nicht je Welt. In Bestenlisten steht trotzdem die **Welt** dabei
  („Lumina · Fenjas Tal“), denn ein Spieler kann eine gute und eine böse Welt haben.
- Namen sind öffentlich. Deshalb gibt es eine einfache Wortsperrliste in der Funktion. Außerdem kann die Verwaltung
  einen Namen ausblenden (`hidden`-Spalte), ohne den Spieler zu löschen.

## 2. Bestenlisten

Weltenkeim ist ein Aufbau- und Idle-Spiel ohne „Welle“. Ranglisten sollen daher **Spielweisen** zeigen, nicht nur
Fleiß. Je Kategorie zählt die beste Welt eines Spielers.

| Kategorie | Wert | Bemerkung |
|---|---|---|
| **Größtes Volk** | Bewohner (heute max. 40, später mehr) | erst sinnvoll, wenn die Höchstzahl steigt |
| **Höchster Tempel** | Tempelstufe | einfach, gut vergleichbar |
| **Gesammelter Glaube** | Glaube insgesamt verdient (neues Feld, nicht der aktuelle Vorrat) | Langzeitwert |
| **Gütigster Gott** / **Finsterster Gott** | `S.align` nahe +1 bzw. −1, gewichtet mit der Dauer | passt zu `gut-und-boese.md`; zwei Listen, beide gleichwertig |
| **Klügste Kreatur** | Anzahl gelernter Fertigkeiten | sobald `kreatur-lernen.md` umgesetzt ist |
| **Älteste Welt** | gespielte Tage (Spieltage, nicht Kalendertage) | |

- **Woher die Werte kommen:** Wer Cloud-Sicherung nutzt, schickt die Werte mit `meta` sowieso mit. Die Bestenliste
  kann dann **serverseitig aus `wk_worlds.meta`** erzeugt werden (Sicht oder Funktion), ohne eigenen Meldeweg. Wer
  keine Cloud-Sicherung nutzt, meldet nur die Zahlen (`wk_stats`, wie in Kernwacht).
- **Plausibilität:** Lokale Spielstände lassen sich im Browser beliebig ändern (`window.__wk` ist bewusst offen).
  Für einen Freundeskreis genügt das Kernwacht-Niveau: Die Server-Funktion begrenzt Werte (z. B. Tempelstufe
  höchstens +1 je Stunde seit der letzten Meldung, Glaube höchstens das Erreichbare bei Höchstausbau). Welten mit
  Debug-Eingriffen werden markiert (`S.tainted`, sobald über `__wk` geschrieben wird) und nicht eingetragen.
- Anzeige: neues Panel „Ruhmeshalle“ mit Reitern je Kategorie, eigene Zeile hervorgehoben, Top 25.

### 2.1 Gegenstück zum Tageslauf: Wochenwunsch (optional, später)

Kernwacht hat einen Tageslauf mit Tagesliste. Für ein ruhiges Aufbauspiel passt eher ein **Wochenwunsch**: Jede Woche
äußert „die Welt“ einen Wunsch für alle Spieler, z. B. „Backt 200 Brote“, „Pflanzt 50 Setzlinge“ oder „Wirkt 30 Regenwunder“.

- **Gemeinsam statt gegeneinander:** Alle Beiträge zählen zu einem Gemeinschaftsbalken. Ist er voll, bekommen alle
  Teilnehmer eine kleine Belohnung (Glaube, später ein Schmuckstück für den Schrein).
- Daneben die Liste der fleißigsten Beiträger der Woche.
- Der Wunsch ergibt sich wie in Kernwacht aus dem Datum (`C.dailyOf(day)`), braucht also keine Pflege. Die Verwaltung
  kann ihn überschreiben.
- Tabellen: `wk_weekly (week, player_id, amount)`, Ziel und Fortschritt per Funktion.

## 3. Präsenz („Götter wachen“)

- Wie in Kernwacht über **Supabase Realtime Presence**: Kanal `weltenkeim-lobby`, Schlüssel = öffentliche Spieler-ID.
  Oben eine kleine Pille „3 Götter wachen“.
- Mitgeschickt wird (höchstens alle 15 s): Göttername, Zeichen, aktuelle Welt (Name, Kreatur, Waage, Bewohner).
- Ein Tipp auf die Pille zeigt die Liste der gerade Anwesenden mit Namen. Anwesende ohne Namen erscheinen als
  „ein namenloser Gott“.
- **Akku und Kosten:** Präsenz nur, solange die Seite sichtbar ist. Bei `visibilitychange` → hidden `untrack()` und
  Kanal schließen, bei Rückkehr wieder öffnen. Der kostenlose Tarif erlaubt ca. 200 gleichzeitige Verbindungen, das
  reicht.
- Später denkbar: **Besuch** einer anderen Welt als Ansicht ohne Eingriff. Dafür lädt das Spiel deren letzten
  Cloud-Stand nur zum Anschauen und kann nichts sichern. Setzt voraus, dass der Besitzer seine Welt freigibt (`public`
  je Welt). Erst nach den Spielständen.

## 4. Feedback

- Panel „Rückmeldung“ (im Info-Panel und im Pausenmenü), Art wählen: **Fehler**, **Idee**, **Sonstiges**, Freitext (3 bis 2000 Zeichen).
- Automatisch mitgeschickt (`ctx`, für den Spieler sichtbar aufgelistet): Spielversion (`wk-version`), Gerät und
  Bildschirmgröße, Browser-Kennung (gekürzt), aktuelle Welt-`meta`, Tageszeit und Wetter im Spiel, Kamera-Position.
- **Neu gegenüber Kernwacht, optional:** „Bildschirmfoto anhängen“. Das Canvas wird verkleinert (z. B. 640 px breit,
  JPEG) und in einen Supabase-Storage-Bucket `feedback` hochgeladen (nur Schreiben über signierte Upload-URL aus einer
  Funktion, Lesen nur für die Verwaltung). Sehr hilfreich bei Darstellungsfehlern (z. B. springende Schatten).
  Dafür braucht der Renderer `preserveDrawingBuffer` nicht. Es reicht, das Foto direkt nach einem `render()` zu ziehen.
- **Optional:** „Spielstand mitschicken“. Die aktuelle Welt wird angehängt, damit sich ein Fehler nachstellen lässt. Das
  ist standardmäßig aus und wird ausdrücklich angehakt.
- Bremse: höchstens 10 Meldungen je Stunde und Spieler (wie Kernwacht).

## 5. Umfragen

- Wie in Kernwacht: Die Verwaltung legt eine Frage mit 2 bis 8 Antworten an. Im Spiel erscheint ein dezenter Hinweis
  („Neue Umfrage“), ein Tipp öffnet sie, nach dem Abstimmen erscheint das Ergebnis in Prozent. Die eigene Antwort lässt
  sich ändern.
- Weltenkeim hat viele offene Gestaltungsfragen in `docs/`. Umfragen eignen sich gut, um Spieler mitentscheiden zu
  lassen, z. B. welche Tiergeist-Gestalt als Nächstes Reaktionen bekommt, welcher Nahrungsvorschlag aus `nahrung.md`
  kommt oder ob böse Wunder sichtbar grausam oder eher märchenhaft sein sollen.
- Neu: optional **mehrere Antworten** erlaubt (`multi`), da es bei Ideensammlungen oft mehr als eine Vorliebe gibt.
- Neu: optional eine **Laufzeit** (`closes_at`). Danach ist die Umfrage geschlossen und zeigt nur noch das Ergebnis.

## 6. Neuigkeiten (neu)

- Kurze Meldungen der Entwicklung im Spiel („Neu in 0.3: mehrere Welten“), gepflegt über die Verwaltung statt per
  Code. Erscheinen einmal als Hinweis und dann im Info-Panel.
- Ergänzt den vorhandenen Update-Hinweis: Dieser sagt, *dass* es eine neue Version gibt, die Neuigkeiten sagen, *was*
  neu ist.
- Tabelle `wk_news (id, title, body, min_version, created_at, active)`, öffentlich lesbar, wenn `active`.

## 7. Verwaltung

- `admin.html` nach Kernwacht-Vorbild, Reiter: **Feedback** (Status neu/gesehen/erledigt/verworfen, Notiz,
  Bildschirmfoto ansehen, mitgeschickten Spielstand als Datei herunterladen), **Umfragen**, **Neuigkeiten**,
  **Spieler** (Anzahl, aktiv in 1/7 Tagen, Namen ausblenden), **Wochenwunsch**.
- Ausgeliefert wird sie mit GitHub Pages, sie kommt aber **nicht** in die `APP`-Liste des Service Workers.
  Sie muss im Pages-Workflow ergänzt werden.
- Alternative ohne eigene Seite: alles über das Supabase-Dashboard. Das ist für den Anfang ausreichend, aber am
  Handy umständlich.

## 8. Datenmodell (Überblick)

Ergänzt die Tabellen aus `spielstaende.md` (`wk_players`, `wk_player_keys`, `wk_worlds` …):

```sql
wk_players     + name, avatar, color, hidden, best_* (Bestenlistenwerte je Kategorie), tainted
wk_feedback    (id, player_id, kind, body, ctx jsonb, shot_path, save_attached jsonb, status, note, created_at)
wk_polls       (id, question, options jsonb, multi bool, active, closes_at, created_at)
wk_poll_votes  (poll_id, player_id, choices smallint[], created_at)
wk_news        (id, title, body, min_version, active, created_at)
wk_weekly      (week date, player_id, amount)            -- später
wk_admin_keys  (hash)
Storage-Bucket: feedback (privat)
```

Da Weltenkeim ein eigenes Projekt hat, sind alle Tabellen getrennt von Kernwacht. Feedback, Umfragen und Verwaltung
haben aber bewusst denselben Aufbau wie dort. So lassen sich Verbesserungen leicht in beide Richtungen übertragen.

## 9. Datenschutz

- Öffentlich: nur Göttername, Zeichen, Weltname und Bestenlistenwerte, und das nur, wenn ein Name gesetzt ist.
- Feedback-Kontext wird vor dem Senden angezeigt. Bildschirmfoto und Spielstand werden nur auf ausdrücklichen Wunsch angehängt.
- Info-Panel: Abschnitt „Online“ mit Hinweis auf Supabase (Region Frankfurt), was gespeichert wird und wie man alles
  löscht (`wk_account_delete` löscht Spieler, Welten, Stimmen; Feedback bleibt anonymisiert mit `player_id = null`).
- Ein Schalter „Online-Funktionen aus“ im Profil: Dann wird `supabase-js` gar nicht geladen.

## 10. Repo und Auslieferung

- Passend zum laufenden Modul-Umbau: ein eigenes Modul `online.js` (in Kernwacht ein globales Skript mit
  `window.KW_ONLINE`, hier ein ES-Modul mit `export`), das als Einziges mit Supabase spricht. Darüber schmale Module
  je Funktion (`feedback.js`, `polls.js`, `presence.js`, `board.js`), die nur `online.js` benutzen. Die
  Cloud-Sicherung hängt sich in das Speichermodul aus `spielstaende.md` ein.
- `online.js` lädt `supabase-js` per dynamischem `import()` erst bei Bedarf. Die Bibliothek muss dafür als ES-Modul
  in `vendor/` liegen (Kernwacht nutzt die UMD-Fassung über ein `<script>`-Tag). Alternativ kann der UMD-Weg bleiben.
- `config.js` (URL + Publishable Key des eigenen Projekts), `admin.html`. Alles außer `admin.html` in die
  `APP`-Liste von `sw.js`, alles im Pages-Workflow ergänzen.
- `window.__wk.online` für Tests in der Konsole (Verbindungsstatus, Präsenz, letzte Fehler).
- Neue Texte und Schaltflächen auf Deutsch, Zahlen mit `fmt`.

## 11. Reihenfolge

0. Voraussetzung: Modul-Umbau (läuft) und eigenes Supabase-Projekt anlegen.
1. Grundgerüst `online.js` + Identität (gemeinsam mit Etappe 2 aus `spielstaende.md`).
2. **Feedback** inkl. Kontext und Verwaltung: den größten Nutzen hat es schon in der Testphase.
3. **Präsenz** („Götter wachen“): klein und schnell gemacht.
4. **Umfragen** + **Neuigkeiten**.
5. **Profil** + **Bestenlisten** (erst wenn die Spielwerte, z. B. Waage und gesammelter Glaube, im Spiel existieren).
6. Später: Wochenwunsch, Bildschirmfoto im Feedback, Welt besuchen.

## 12. Offene Fragen

- Welche Bestenlisten wirklich, und soll Gut/Böse als Paar von Listen erscheinen?
- Wochenwunsch: gemeinsames Ziel (kooperativ) oder Wettbewerb oder beides?
- Soll man fremde Welten besuchen können, und wenn ja, nur auf Freigabe des Besitzers?
- Eigene `admin.html` oder vorerst nur das Supabase-Dashboard?
