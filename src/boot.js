// Weltenkeim – Gottspiel (Three.js). Einstieg: lädt alle Module über main.js.
// Schlägt ein Modul oder Modell fehl, steht der Grund im Ladebildschirm.
import('./main.js').catch(err => {
  const st = document.getElementById('loadSt');
  if (st) st.textContent = 'Die Welt konnte nicht geladen werden. ' + String(err.message).slice(0, 160);
  console.error(err);
});
