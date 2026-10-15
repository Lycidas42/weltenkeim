# Kreatur lernt durch Vormachen

Kernidee: Alles, was die Hand des Spielers kann, kann die Kreatur durch Zuschauen lernen und später selbst tun –
bis hin zum Wirken von Wundern (z. B. ein Feld beregnen). Umsetzung erst nach dem Thema Nahrung (siehe `nahrung.md`).

Verwandt: `kreatur.md` (Gesamtkonzept), `gott-und-hand.md` (was Hand und was Wunder ist, Abschnitt 2 und 5). Stand der Features: siehe `README.md`.

## Grundlage im Code

**Stand:** ✅ vorhanden

- `handHelp()` / `helpAt()` in `src/hand/input.js`: alle Hilfen der Hand als einzelne, abgegrenzte Handlungen
  – säen, gießen, ernten (Felder), Vieh füttern, Fisch greifen, Wild bannen, erlegtes Wild aufheben,
  Setzling pflanzen, Waren einer Hütte ins Lager bringen, eine Ladung in Säge/Mühle/Bäckerei verarbeiten.
  Nach `gott-und-hand.md` 5.1 werden Gießen und Bannen zu Wundern (Regen, Bann) und die Sofort-Verarbeitung
  entfällt. Lernbare Hand-Fähigkeiten sind also: säen, ernten, füttern, Fisch greifen, Wild aufheben, pflanzen,
  Waren tragen.
- Wunder: `tryMiracle()` / `castRain()` / `castHaste()` in `src/hand/miracles.js`; die Kreatur zeigt heute nur eine
  Geste (`foxCast()` in `src/creature/ai.js`).
- Neigungen der Kreatur: `S.w` (help / play / mischief), Lob und Tadel über `reinforce()` (`src/creature/ai.js`).

## 1. Zuschauen und lernen

**Stand:** 🔵 geplant

- Hilft die Hand und die Kreatur ist in der Nähe (Sichtweite etwa 8 Einheiten) und nicht beschäftigt, dreht sie den Kopf
  zur Hand und schaut zu („Fenja schaut zu“).
- Jede gesehene Vorführung bringt Fortschritt bei genau dieser Fähigkeit; nach etwa 5 Vorführungen ist sie gelernt
  („Fenja hat Säen gelernt!“).
- Ungesehene Vorführungen zählen nicht: Der Spieler muss die Kreatur mitnehmen oder zu sich rufen.

## 2. Selbst anwenden

**Stand:** 🔵 geplant

- Gelernte Fähigkeiten kommen zu den bisherigen Tätigkeiten (Baum bringen, spielen, Unfug) hinzu.
- Je hilfsbereiter die Kreatur ist, desto öfter sucht sie sich passende Arbeit: ein leeres Feld zum Säen,
  ein reifes Feld zum Ernten, ein Fischschwarm am Ufer, eine Hütte mit wartenden Waren …
- Lob und Tadel wirken auf die einzelne Fähigkeit (nicht nur auf help/play/mischief): Wer nach dem Ernten gelobt wird,
  erntet öfter.

## 3. Wunder wirken

**Stand:** 🔵 geplant

- Regen und Eile lernt sie ebenso durch Zuschauen beim Wirken.
- Wirken kostet Glaube aus dem Vorrat des Spielers.
- Nur bei genug Glaube; im Kreatur-Panel erlauben oder verbieten.
- Lob und Tadel bringen ihr bei, wann es passt: Regen auf ein trockenes Feld = gut, mitten ins Dorf = eher nicht.

## 4. Anzeige und Spielstand

**Stand:** 🔵 geplant

- Kreatur-Panel: Abschnitt „Fähigkeiten“ mit Fortschrittsbalken je Fähigkeit (ungelernt / im Lernen / gelernt).
- Spielstand: neues Feld `S.skills` (z. B. `{ sow: 0.6, harvest: 1, rain: 0.2, … }`), abwärtskompatibel.

## 5. Später möglich

**Stand:** 💡 Idee

- Sie lernt auch Falsches, wenn man es vormacht (z. B. unreife Felder abernten).
- Bei hoher Unfug-Neigung wendet sie Gelerntes ungeschickt an.

## Vorgeschlagene Reihenfolge

1. Zuschauen + Fortschritt + Panel-Anzeige (alle Fähigkeiten zählen mit).
2. Anwenden der Feldarbeiten (säen, ernten) als erste Fähigkeiten.
3. Weitere Fähigkeiten (füttern, Fische, Wild, pflanzen, große Transporte).
4. Wunder wirken mit Erlaubnis-Schalter und Glaubenskosten.
