# Kreatur lernt durch Vormachen

Kernidee: Alles, was die Hand des Spielers kann, kann die Kreatur durch Zuschauen lernen und später selbst tun –
bis hin zum Wirken von Wundern (z. B. ein Feld beregnen). Umsetzung erst nach dem Thema Nahrung (siehe `nahrung.md`).

## Grundlage im Code

- `handHelp()` in `game.js`: alle Hilfen der Hand als einzelne, abgegrenzte Handlungen
  – säen, gießen, ernten (Felder), Vieh füttern, Fisch greifen, Wild bannen, erlegtes Wild aufheben,
  Setzling pflanzen, Waren einer Hütte ins Lager bringen, eine Ladung in Säge/Mühle/Bäckerei verarbeiten.
- Wunder: `tryMiracle()` / `castRain()` / `castHaste()`; die Kreatur zeigt heute nur eine Geste (`foxCast()`).
- Neigungen der Kreatur: `S.w` (help / play / mischief), Lob und Tadel über `reinforce()`.

## 1. Zuschauen und lernen

- Hilft die Hand und die Kreatur ist in der Nähe (Sichtweite etwa 8 Einheiten) und nicht beschäftigt, dreht sie den Kopf
  zur Hand und schaut zu („Fenja schaut zu“).
- Jede gesehene Vorführung bringt Fortschritt bei genau dieser Fähigkeit; nach etwa 5 Vorführungen ist sie gelernt
  („Fenja hat Gießen gelernt!“).
- Ungesehene Vorführungen zählen nicht: Der Spieler muss die Kreatur mitnehmen oder zu sich rufen.

## 2. Selbst anwenden

- Gelernte Fähigkeiten kommen zu den bisherigen Tätigkeiten (Baum bringen, spielen, Unfug) hinzu.
- Je hilfsbereiter die Kreatur ist, desto öfter sucht sie sich passende Arbeit: ein trockenes Feld zum Gießen,
  ein reifes Feld zum Ernten, ein Fischschwarm am Ufer, eine Hütte mit wartenden Waren …
- Lob und Tadel wirken auf die einzelne Fähigkeit (nicht nur auf help/play/mischief): Wer nach dem Gießen gelobt wird,
  gießt öfter.

## 3. Wunder wirken

- Regen und Eile lernt sie ebenso durch Zuschauen beim Wirken.
- Wirken kostet Glaube aus dem Vorrat des Spielers.
- Nur bei genug Glaube; im Kreatur-Panel erlauben oder verbieten.
- Lob und Tadel bringen ihr bei, wann es passt: Regen auf ein trockenes Feld = gut, mitten ins Dorf = eher nicht.

## 4. Anzeige und Spielstand

- Kreatur-Panel: Abschnitt „Fähigkeiten“ mit Fortschrittsbalken je Fähigkeit (ungelernt / im Lernen / gelernt).
- Spielstand: neues Feld `S.skills` (z. B. `{ water: 0.6, harvest: 1, … }`), abwärtskompatibel.

## 5. Später möglich

- Sie lernt auch Falsches, wenn man es vormacht (z. B. unreife Felder abernten).
- Bei hoher Unfug-Neigung wendet sie Gelerntes ungeschickt an.

## Vorgeschlagene Reihenfolge

1. Zuschauen + Fortschritt + Panel-Anzeige (alle Fähigkeiten zählen mit).
2. Anwenden der Feldarbeiten (säen, gießen, ernten) als erste Fähigkeiten.
3. Weitere Fähigkeiten (füttern, Fische, Wild, pflanzen, tragen, Werkstätten).
4. Wunder wirken mit Erlaubnis-Schalter und Glaubenskosten.
