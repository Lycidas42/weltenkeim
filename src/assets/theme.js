// Aktives Theme: welche Modelle und Farben das Spiel benutzt (S.theme). Weitere Themes kommen nach src/themes/
// und hier in THEMES. Was ein Theme nicht selbst festlegt (Modelle, Farben), kommt aus dem Grund-Theme „Gemütlich“.
import { S } from '../core/state.js';
import cozy from '../themes/cozy.js';

const THEMES = { cozy };
const chosen = THEMES[S.theme] || cozy;
const theme = chosen === cozy ? cozy : { ...chosen, models: { ...cozy.models, ...chosen.models }, palette: { ...cozy.palette, ...chosen.palette } };

export { THEMES, theme };
