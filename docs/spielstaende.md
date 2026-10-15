# Spielstände: lokal, online und mehrere Welten

Stand 0.2.8: Jedes Gerät hat genau eine Welt. Sie liegt in `localStorage['weltenkeim-save']`, das Objekt `S` wird
alle 5 s und beim Verlassen der Seite gesichert. Der Offline-Fortschritt wird beim Laden aus `S.ts` nachgerechnet.
Ziel: Ein Spieler kann **mehrere Welten** haben (z. B. eine gute und eine böse, siehe `gut-und-boese.md`), sie
**lokal** sichern und laden und sie **online** (Supabase) sichern, um sie auf anderen Geräten weiterzuspielen.

Vorbild ist die Online-Anbindung in Kernwacht (`kernwacht/online.js`, `kernwacht/supabase/migrations/`).
Was davon übernommen wird, steht in Abschnitt 5.
Stand der Features: siehe `README.md`.

## 1. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Spieler** | eine Person, online über einen geheimen Geräteschlüssel erkannt (kein Passwort, keine E-Mail) |
| **Gerät** | ein Browser/eine installierte PWA; jedes hat seinen eigenen Schlüssel, mehrere Geräte können zum selben Spieler gehören |
| **Welt** | ein Spielstand: Insel, Bewohner, Kreatur, Waage (`S.align`), Hand. Ein Spieler kann mehrere Welten haben |
| **Profil** | was für den Spieler über alle Welten gilt (Einstellungen, später Freischaltungen und Statistik) |

Wichtig ist die Trennung **Welt ↔ Profil**: Alles, was heute in `S` steht, gehört zur Welt. Auch `S.handStyle` und
die Kreatur gehören dazu, denn beides soll sich mit Gut/Böse je Welt verändern. Das Profil ist neu und klein.

## 2. Lokale Spielstände (ohne Online-Dienst)

**Stand:** 🔵 geplant – heute eine Welt je Gerät

### 2.1 Ablage

```
localStorage['weltenkeim-worlds']   → { v: 1, active: '<id>', list: [ { id, name, created, ts, meta } ] }
localStorage['weltenkeim-world:<id>'] → das bisherige Objekt S
localStorage['weltenkeim-profile']  → { v: 1, settings: {…}, cloud: {…} }   (siehe 4.)
```

- `id`: zufällige UUID (`crypto.randomUUID()`), entsteht auf dem Gerät und gilt später auch online. So muss keine
  Welt beim ersten Hochladen umbenannt werden.
- `meta`: kleine Zusammenfassung für die Weltenliste, ohne die ganze Welt laden zu müssen: Weltname, Kreatur
  (Gestalt + Name), Waage, Bewohner, Glaube, Tempelstufe, Spielzeit, `v`, Spielversion. Wird bei jedem `save()`
  mit aktualisiert.
- **Umstellung:** Gibt es beim Start `weltenkeim-save`, aber noch keinen Index, wird daraus die erste Welt
  („Meine Welt“). Den alten Schlüssel zunächst stehen lassen (Rückweg bei Fehlern) und erst eine Version später löschen.
- Platz: `localStorage` hat ca. 5 MB je Herkunft. Eine Welt hat heute geschätzt 10 bis 100 KB (Gelände- und
  Wegedaten sind die größten Teile). Vor der Umsetzung echte Größen messen. Begrenzung vorerst auf **5 Welten je Gerät**.
- GitHub Pages: Alle Projekte unter derselben `*.github.io`-Adresse teilen sich eine Herkunft und damit
  `localStorage` (Kernwacht und Weltenkeim, falls beide dort liegen). Deshalb immer mit dem Präfix `weltenkeim-`
  arbeiten und niemals `localStorage.clear()` aufrufen.

### 2.2 Welt wechseln

Der Code liegt inzwischen als ES-Module unter `src/`. Der Spielzustand steckt aber weiter in Modul-Variablen
(z. B. `villagers`, `huts`, `trees`) und wird beim Laden einmal aufgebaut. Für mehrere Welten ohne Neuladen braucht
es noch Folgendes:

- **Ein Ort für den Spielzustand:** Alles, was zur Welt gehört, hängt an einem Weltobjekt (bzw. an Modulen mit
  `init(state)`/`dispose()`), nicht an verstreuten Variablen auf oberster Ebene.
- **Eigenes Speichermodul** (z. B. `src/core/save.js`; heute liegen `save`, `onSave` und `SAVE_KEY` in
  `src/core/state.js`) mit `load(id)`, `save()`, `migrate(S)`, `exportWorld()`, `importWorld()`
  und dem Weltenindex. Kein anderes Modul greift direkt auf `localStorage` zu. Später hängt sich die Cloud-Sicherung
  genau hier ein.
- **Trennung Szene ↔ Welt:** Renderer, Kamera, Licht, Wetter-Shader und geladene Modelle gehören nicht zur Welt und
  bleiben beim Wechsel erhalten. Bewohner, Gebäude, Felder, Gelände und Kreatur werden aus dem Weltzustand aufgebaut
  und beim Wechsel abgebaut (Geometrien/Materialien freigeben, Instanzen zurücksetzen).

Für die erste Fassung bleibt der Wechsel trotzdem **sichern, `active` setzen, Seite neu laden**. Das ist robust und
braucht kein vollständiges `dispose()`. Ist der Umbau so weit, dass sich eine Welt sauber ab- und aufbauen
lässt, kann der Wechsel ohne Neuladen kommen, mit Überblendung und ohne erneutes Laden der Modelle.

### 2.3 Sichern und Laden als Datei

- **Exportieren:** eine Welt als Datei `weltenkeim-<name>-<datum>.json` (Download bzw. Teilen-Menü auf dem Handy über
  `navigator.share` mit Datei). Optional zusätzlich als kopierbarer Text wie in Kernwacht.
- **Importieren:** Datei wählen → Zusammenfassung zeigen → **als neue Welt anlegen** (Standard) oder eine
  vorhandene ersetzen (zweimal tippen, wie beim Zurücksetzen).
- Dateiformat: `{ format: 'weltenkeim-world', v, game: '0.x.y', id, name, meta, data: S }`.
  Beim Import eine neue `id` vergeben, sofern die Welt auf dem Gerät schon existiert.

## 3. Mehrere Welten (gut/böse ausprobieren)

**Stand:** 🔵 geplant

- **Neue Welt:** Name der Welt, Kreatur wählen (wie heute), Rest Standardstart. Keine feste Wahl „gut“ oder
  „böse“: Die Ausrichtung entsteht durch das Spielen. Optional kann der Spieler beim Anlegen einen „Vorsatz“ angeben,
  der nur als Etikett in der Liste dient.
- **Welt verzweigen:** Kopie der aktuellen Welt mit neuer `id` („Fenjas Welt – böser Weg“). Ideal, um ab einem
  Stand beide Wege auszuprobieren, ohne von vorn anzufangen.
- **Löschen:** zweimal tippen. Online landet eine gelöschte Welt zunächst im Papierkorb (30 Tage, siehe 5.2),
  lokal ist sie sofort weg.
- **Weltenliste** (neues Panel „Welten“, erreichbar aus dem Info-/Einstellungspanel und beim Start, wenn es mehr als
  eine Welt gibt): Karten mit Weltname, Kreaturbild, Mini-Waage, Bewohnern, „zuletzt gespielt vor …“ und einem
  Speicherort-Zeichen: *nur auf diesem Gerät* / *in der Cloud gesichert* / *in der Cloud neuer* / *Konflikt*.
  Aktionen: Spielen, Umbenennen, Verzweigen, Exportieren, Löschen.
- **Offline-Fortschritt** gilt je Welt (eigenes `S.ts`). Eine lange nicht gespielte Welt bekommt beim Öffnen wie
  heute höchstens 8 h gutgeschrieben.

## 4. Profil (welt-übergreifend)

**Stand:** 🔵 geplant

Klein halten. Vorerst nur:

- `settings`: Ton, Grafikqualität, Hinweise gesehen. Was davon heute in `S` steht, bleibt zunächst dort, damit nichts
  bricht. Verschieben nur, wenn es stört.
- `cloud`: Geräteschlüssel, „automatisch sichern an/aus“, letzter Abgleich je Welt (siehe 6.).
- später: Freischaltungen (z. B. Kreaturgestalten, die in einer Welt verdient wurden und in allen gelten), Statistik
  über alle Welten, Erfolge.

## 5. Online mit Supabase

**Stand:** 🔵 geplant – eigenes Supabase-Projekt ist entschieden, im Code noch nichts

### 5.1 Identität: Kernwacht-Modell übernehmen

In Kernwacht ist das Modell schon erprobt:

- Jedes Gerät erzeugt einen **geheimen Geräteschlüssel** (≥ 20 Zeichen). Die Datenbank speichert nur dessen
  SHA-256-Hash.
- **Kein direkter Tabellenzugriff:** Geschrieben wird ausschließlich über `security definer`-Funktionen, die den
  Schlüssel prüfen. Gelesen wird ebenfalls über Funktionen, denn Welten sind privat.
- **Geräte koppeln:** Gerät A erzeugt einen Kurzcode (6 Zeichen, 10 Minuten gültig, QR-Code). Gerät B löst ihn mit
  seinem eigenen neuen Schlüssel ein (`player_keys`). Mit einer Sperre gegen Durchprobieren.
- Supabase-JS liegt lokal in `vendor/` und wird erst geladen, wenn Online genutzt wird. Ohne Konfiguration bleibt
  alles lokal.

Vorteil gegenüber Supabase Auth (anonyme Anmeldung, E-Mail-Link): keine Sitzungen, die ablaufen, keine personenbezogenen
Daten, gleicher Code wie Kernwacht. Nachteil: Wer alle Geräte verliert und keinen Export hat, verliert den Zugang.
Abhilfe: Im Profil einen **Wiederherstellungscode** anzeigen, den man sich notieren kann. Später ist optional ein
E-Mail-Konto möglich.

**Entschieden: eigenes Supabase-Projekt** für Weltenkeim (Region Frankfurt). Es ist über die GitHub-Integration mit
diesem Repo verbunden, Produktionszweig `main`, keine Preview-Branches. Ein gemeinsames Konto mit Kernwacht gibt es
damit nicht. Code und Datenbankaufbau werden aus Kernwacht übernommen und angepasst, nicht geteilt.
Das Präfix `wk_` bei Tabellen und Funktionen bleibt trotzdem, denn es trennt eigene Objekte im Dashboard von denen
von Supabase.
Zu beachten: Der kostenlose Tarif erlaubt 2 aktive Projekte je Organisation (Kernwacht + Weltenkeim belegen beide)
und pausiert ein Projekt nach ca. 7 Tagen ohne Zugriff. Das Spiel muss ein pausiertes Projekt wie „offline“ behandeln.

### 5.2 Datenmodell (Entwurf)

```sql
wk_players     (id uuid pk, secret_hash text unique, created_at, updated_at)
wk_player_keys (hash text pk, player_id → wk_players, created_at, last_seen)      -- ein Eintrag je Gerät
wk_pair_codes  (code text pk, player_id, expires_at)                               -- wie Kernwacht
wk_profiles    (player_id pk, data jsonb, updated_at)                              -- Profil aus 4.
wk_worlds      (id uuid pk,            -- dieselbe id wie lokal
                player_id → wk_players,
                name text,
                meta jsonb,            -- Zusammenfassung für die Liste
                data jsonb,            -- das Objekt S
                rev  integer,          -- wird bei jedem Sichern um 1 erhöht (Konflikterkennung)
                save_v integer,        -- S.v
                game_version text,     -- z. B. '0.3.0'
                device text,           -- welches Gerät zuletzt gesichert hat (Hash-Präfix, für die Anzeige)
                updated_at, deleted_at)  -- deleted_at ≠ null: Papierkorb
wk_world_backups (world_id, rev, data jsonb, created_at)  -- optional: die letzten 3 Stände je Welt
```

Funktionen (alle mit Geräteschlüssel als erstem Argument):

| Funktion | Zweck |
|---|---|
| `wk_register(code)` | Spieler anlegen/finden |
| `wk_worlds_list(code)` | alle Welten: `id, name, meta, rev, updated_at, deleted_at` (ohne `data`) |
| `wk_world_load(code, id)` | eine Welt komplett |
| `wk_world_save(code, id, base_rev, name, meta, data)` | sichern, **nur wenn `base_rev` = aktuelle `rev`**, sonst Antwort „Konflikt“ mit dem Server-Stand (`meta`, `rev`, `updated_at`) |
| `wk_world_delete(code, id)` / `wk_world_restore` | in den Papierkorb bzw. zurück |
| `wk_profile_save/load` | Profil |
| `wk_pair_create`, `wk_pair_redeem`, `wk_unlink` | Geräte koppeln, wie Kernwacht |
| `wk_account_delete(code)` | alles des Spielers löschen (Datenschutz) |

Grenzen in den Funktionen: höchstens **10 Welten** je Spieler (Papierkorb nicht mitgezählt), höchstens ca. 500 KB je Welt,
einfache Ratenbremse (z. B. höchstens 1 Sicherung je Welt alle 20 s). Papierkorb nach 30 Tagen endgültig löschen
(per `pg_cron` oder beim nächsten `wk_worlds_list` aufräumen).

Die Migrationen kommen wie in Kernwacht unter `supabase/migrations/` und werden über die GitHub-Integration eingespielt.

## 6. Abgleich zwischen Gerät und Cloud

**Stand:** 🔵 geplant

Grundsatz: **Lokal zuerst.** Das Spiel läuft immer auf der lokalen Kopie, auch offline. Die Cloud ist eine Sicherung und
dient zum Gerätewechsel. Es gibt kein gleichzeitiges Spielen derselben Welt auf zwei Geräten und keine Zusammenführung
von Ständen. Eine Welt ist ein Ganzes: Es gewinnt immer ein Stand.

Je Welt merkt sich das Gerät `cloud: { rev, syncedAt, dirty }`:

- **Hochladen:** automatisch beim Verlassen der Seite (`visibilitychange` → hidden), alle ca. 2 Minuten während des
  Spielens (nicht alle 5 s wie lokal) und auf Knopfdruck. Mitgeschickt wird `base_rev = cloud.rev`. Bei Erfolg
  gibt der Server die neue `rev` zurück.
- **Beim Start / beim Öffnen einer Welt:** `wk_worlds_list` abfragen (klein, ohne `data`). Drei Fälle:
  - Server-`rev` = lokale `rev`: alles gut, lokal weiterspielen.
  - Server neuer und lokal nichts Neues (`dirty = false`): Server-Stand still laden.
  - **Beide verändert (Konflikt):** Auswahl anzeigen mit beiden Zusammenfassungen: „Auf diesem Gerät: 18 Bewohner,
    Tempel 3, gespielt bis heute 14:20 / In der Cloud (vom Handy): 21 Bewohner, Tempel 3, gestern 22:05“. Möglich sind:
    *diesen behalten* (überschreibt die Cloud), *Cloud-Stand laden* oder **beide behalten** (der lokale Stand wird als
    neue Welt verzweigt). Der Standardknopf ist „beide behalten“, damit nie etwas verloren geht.
- Welten, die es nur in der Cloud gibt, erscheinen in der Weltenliste mit „herunterladen“. Welten, die es nur lokal
  gibt, haben „in die Cloud“ oder werden bei aktivem Auto-Sichern automatisch hochgeladen.
- **Offline-Fortschritt und Gerätewechsel:** `S.ts` reist mit dem Stand mit. Gerät B rechnet den Fortschritt seit der
  letzten Sicherung auf A nach. Damit es nicht doppelt zählt, muss A beim Verlassen zuverlässig hochladen. Gelingt das
  nicht (kein Netz), entsteht beim nächsten Mal ein Konflikt, und der Spieler entscheidet. Das ist gewollt.
- **Versionen:** Ein Stand mit höherem `S.v` als das Spiel kennt, wird **nicht** geladen, sondern mit „Bitte das Spiel
  aktualisieren“ beantwortet (der Update-Hinweis ist ja schon vorhanden). Ältere Stände laufen wie heute durch die
  Lade-Reparaturen. Diese Reparaturen in eine eigene Funktion `migrate(S)` auslagern, damit Import, Cloud und lokaler
  Start denselben Weg gehen.

## 7. Datenschutz und Sicherheit

- Gespeichert werden nur Spieldaten, der Weltname und der Name der Kreatur. Kein Konto, keine E-Mail, keine IP in eigenen Tabellen.
- Hinweis im Info-Panel (`#sheetInfo`): was online gespeichert wird, wo (Supabase, Region Frankfurt) und wie man es
  löscht („Online-Daten löschen“ im Profil → `wk_account_delete`).
- Schummeln ist bei einem Einzelspieler-Spiel egal. Für die geplanten Bestenlisten gelten dieselben Grenzen wie in
  Kernwacht (Plausibilitätsprüfung serverseitig, Stände mit Debug-Eingriffen ausschließen, `online-funktionen.md` 2).

## 8. Auswirkungen auf das Repo

- Neue Module (Speichermodul, Online-Module, `config.js`) unter `src/` anlegen: Der Pages-Workflow kopiert `src/`
  als Ganzes, sie müssen nur in die `APP`-Liste in `sw.js` (der Workflow prüft das). `vendor/supabase-js-*.js` ebenso
  in die `APP`-Liste.
- Speichermodul statt `SAVE_KEY`/`save()` in `src/core/state.js`. `save()` schreibt zusätzlich `meta`, die heutigen
  Lade-Reparaturen werden zu `migrate()`. Das Zurücksetzen (`btnReset`) betrifft nur die aktive Welt.
- `window.__wk` um die Weltenverwaltung und den Online-Zustand ergänzen (Tests in der Konsole).
- Neue Felder in `S` wie bisher abwärtskompatibel ergänzen. Für die Weltenverwaltung selbst sind **keine** neuen
  Felder in `S` nötig (Name und id stehen im Index).

## 9. Umsetzung in Etappen

0. **Umbau für Welten:** Code als Module unter `src/` (erledigt); Speichermodul, Spielzustand an einem Ort, Szene und
   Welt getrennt (offen, siehe 2.2).
1. **Lokale Welten:** Index und Umstellung des alten Stands, `migrate()`, Weltenliste, Neue Welt, Verzweigen, Löschen,
   Wechsel per Neuladen. Export und Import als Datei. *Bringt schon den Gut/Böse-Vergleich, ganz ohne Server.*
2. **Cloud-Sicherung:** Supabase-Tabellen und -Funktionen, Geräteschlüssel, Hoch- und Herunterladen je Welt,
   `rev`-Konflikterkennung mit der Auswahl aus 6., Auto-Sichern.
3. **Mehrere Geräte:** Koppeln per Kurzcode/QR, Wiederherstellungscode, Papierkorb, Backups der letzten Stände,
   „Online-Daten löschen“.
4. Später: Profil mit welt-übergreifenden Freischaltungen, eventuell E-Mail-Konto.

## 10. Offene Fragen

- Wie viele Welten je Spieler (Vorschlag 5 lokal, 10 online)?
- Soll eine neue Welt einen „Vorsatz“ (gut/böse) als Etikett bekommen oder nur einen frei wählbaren Namen?
- Gelten Freischaltungen (z. B. Kreaturgestalten) je Welt oder für den Spieler?
- Reicht „lokal zuerst + Konfliktauswahl“, oder soll eine Welt beim Öffnen auf einem Gerät für die anderen als
  „wird gerade gespielt“ markiert werden (Hinweis, keine Sperre)?
