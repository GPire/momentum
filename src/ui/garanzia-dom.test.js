// ============================================================
// GARANZIA DOM — nessun pulsante morto, nessuna card fantasma
// ============================================================
// Perché esiste: senza un browser non si può "provare l'app", ma un'intera
// classe di bug da produzione è verificabile leggendo i file — ed è una
// classe che passa SEMPRE inosservata, perché non rompe niente:
//
//  · un `onclick="window.qualcosa()"` che punta a una funzione rinominata →
//    il pulsante non fa nulla, nessun errore in console finché non lo tocchi;
//  · un `$('#una-card')` su un elemento tolto dall'HTML durante un redesign →
//    la funzione è guardata da `if (el)`, quindi non esplode: semplicemente
//    quella parte di interfaccia non viene disegnata MAI, per nessuno.
//
// Il secondo caso è stato trovato davvero da questo test il 2026-09-05
// (#safe-to-spend-card, vedi l'elenco documentato più sotto): il codice che
// disegna il dettaglio "quanto resta questa settimana / la traiettoria del
// mese" c'era, era corretto, ed era irraggiungibile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(radice, 'index.html'), 'utf8');
const js = readFileSync(join(radice, 'src', 'main.js'), 'utf8');

// Funzioni realmente esposte su window da main.js.
const espostiSuWindow = new Set();
for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) espostiSuWindow.add(m[1]);

test('GARANZIA DOM: ogni handler inline di index.html punta a una funzione che esiste davvero', () => {
  const usati = new Set();
  for (const m of html.matchAll(/window\.([A-Za-z_$][\w$]*)\s*\(/g)) usati.add(m[1]);
  const orfani = [...usati].filter(f => !espostiSuWindow.has(f)).sort();
  assert.deepEqual(orfani, [], `pulsanti che non farebbero nulla: ${orfani.join(', ')}`);
  assert.ok(usati.size > 20, 'il rilevatore non sta più trovando gli handler: controllare il pattern');
});

test('GARANZIA DOM: anche gli handler GENERATI dentro main.js puntano a funzioni esistenti', () => {
  // Sono la maggioranza: quasi tutta l'interfaccia è disegnata da template
  // dentro main.js, non scritta a mano in index.html.
  const usati = new Set();
  for (const m of js.matchAll(/onclick=[\\'"`]*\s*window\.([A-Za-z_$][\w$]*)\s*\(/g)) usati.add(m[1]);
  const orfani = [...usati].filter(f => !espostiSuWindow.has(f)).sort();
  assert.deepEqual(orfani, [], `pulsanti generati che non farebbero nulla: ${orfani.join(', ')}`);
  assert.ok(usati.size > 40, 'il rilevatore non sta più trovando gli handler generati: controllare il pattern');
});

// ── Elementi cercati da main.js che non esistono da nessuna parte ──
// Ogni voce qui è un pezzo di interfaccia che NON verrà mai disegnato. La
// lista è esplicita apposta: un id nuovo che finisce qui dentro deve essere
// una decisione presa e scritta, non una scoperta fra sei mesi.
const ORFANI_NOTI = {
  // Rimosso deliberatamente il 2026-08-30 (decluttering): il suo contenuto
  // era già duplicato parola per parola dentro "Quadro di mercato". Il
  // riferimento in main.js è codice morto innocuo (guardato da `if`).
  'macro-causality-panel': 'rimosso di proposito, contenuto duplicato altrove',
  // TROVATO DA QUESTO TEST il 2026-09-05. In index.html restano NOVE regole
  // CSS che lo stilizzano (#safe-to-spend-card .hero-num, ::before, gli stati
  // [role="button"]…) ma l'elemento non esiste: `$('#safe-to-spend-card')`
  // torna sempre null, e tutto il blocco `if (stsCard)` non gira mai.
  // COSA SI PERDE davvero: NON il numero grande "Oggi puoi spendere" (quello
  // lo disegna l'orb, e funziona), ma il DETTAGLIO sotto — quanto resta nella
  // settimana, cosa è già impegnato, e la traiettoria di fine mese.
  // NON viene reinserito qui: dove vada nel layout è una decisione di design
  // che va vista in un browser, non indovinata da un test.
  'safe-to-spend-card': 'DA DECIDERE: elemento mai inserito, il dettaglio settimana/traiettoria non si disegna',
  // Verdetto del kit di recupero: la funzione che lo cerca è guardata e
  // l'elemento nasce solo dentro un flusso che oggi non lo crea.
  'rk-verdict': 'guardato, nessun effetto visibile',
  'genesis-canvas': 'residuo di una versione precedente dell onboarding',
  'inv-upload-steps': 'residuo, guardato',
  'tl1-cassa': 'residuo, guardato',
};

test('GARANZIA DOM: nessun NUOVO elemento fantasma oltre a quelli già documentati', () => {
  // Id dichiarati in index.html.
  const idHtml = new Set();
  for (const m of html.matchAll(/id=["']([\w-]+)["']/g)) idHtml.add(m[1]);
  // Id creati da main.js (template letterali, con o senza escape).
  const idJs = new Set();
  for (const m of js.matchAll(/id=[\\'"]([\w-]+)[\\'"]/g)) idJs.add(m[1]);
  // Id passati come PARAMETRO a un helper che li genera (es. tl1Select('x', …)):
  // l'elemento esiste, ma il suo id non appare mai come stringa `id="x"`.
  const idDaHelper = new Set();
  for (const m of js.matchAll(/\b\w+\(\s*['"]([\w-]+)['"]\s*,/g)) idDaHelper.add(m[1]);

  const cercati = new Set();
  for (const m of js.matchAll(/getElementById\(['"]([\w-]+)['"]\)/g)) cercati.add(m[1]);
  for (const m of js.matchAll(/\$\(['"]#([\w-]+)['"]\)/g)) cercati.add(m[1]);

  const fantasmi = [...cercati]
    .filter(i => !idHtml.has(i) && !idJs.has(i) && !idDaHelper.has(i))
    .filter(i => !(i in ORFANI_NOTI))
    .sort();

  assert.deepEqual(fantasmi, [],
    `main.js cerca elementi che non esistono da nessuna parte: ${fantasmi.join(', ')} — o li si crea, o si toglie il codice che li cerca, o si aggiungono a ORFANI_NOTI con il motivo`);
});

test('GARANZIA DOM: le regole CSS di #safe-to-spend-card restano, a memoria del pezzo mancante', () => {
  // Se un giorno si decide di NON reinserire mai quella card, queste nove
  // regole vanno tolte insieme al codice che la disegna: CSS che stilizza il
  // nulla è esattamente ciò che ha reso invisibile il problema per settimane.
  const regole = (html.match(/#safe-to-spend-card/g) || []).length;
  const esisteElemento = /id=["']safe-to-spend-card["']/.test(html) || /id=[\\'"]safe-to-spend-card[\\'"]/.test(js);
  if (esisteElemento) {
    assert.ok(true, 'la card è stata reinserita: questo test ha esaurito il suo scopo, si può togliere');
  } else {
    assert.ok(regole > 0, 'coerenza: senza elemento e senza CSS, togliere anche il blocco if (stsCard) in main.js');
  }
});
