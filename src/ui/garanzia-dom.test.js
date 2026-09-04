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

// ── #safe-to-spend-card: da fantasma a regressione vera ──
// Sparita in un redesign dell'11 agosto 2026 e reinserita il 2026-09-05, dopo
// aver verificato nel codice che NON duplicava niente. Questi tre test la
// tengono viva: se risparisce, si rompe qualcosa, subito.

test('GARANZIA DOM: #safe-to-spend-card esiste davvero (non è più un fantasma)', () => {
  assert.ok(/id=["']safe-to-spend-card["']/.test(html),
    'la card è sparita di nuovo: il blocco `if (stsCard)` in main.js tornerebbe codice morto e settimana/impegnato/traiettoria non si disegnerebbero per nessuno');
});

test('GARANZIA DOM: #safe-to-spend-card nasce nascosta', () => {
  // Non deve mai lampeggiare vuota al primo render: la riempie renderDashboard
  // solo quando getDailySafeToSpend restituisce un numero.
  const tag = html.match(/<div[^>]*id=["']safe-to-spend-card["'][^>]*>/)[0];
  assert.ok(/\bhidden\b/.test(tag), `deve nascere con class hidden, invece: ${tag}`);
});

test('GARANZIA DOM: #safe-to-spend-card sta PRIMA della Cassa Unica, e non possono comparire insieme', () => {
  // Ordine: è la risposta di riserva a "quanto posso spendere" per chi non ha
  // dichiarato lo stipendio. Se la Cassa Unica c'è, vince lei e sta sotto.
  const sts = html.indexOf('id="safe-to-spend-card"');
  const ghost = html.indexOf('id="ghost-forecast"');
  assert.ok(sts > 0 && ghost > 0 && sts < ghost,
    'la card deve precedere #ghost-forecast, come nella posizione originale');
  // La garanzia che non si sovrappongano non è nel layout ma nel dato: il
  // numero che riempie la card è calcolato SOLO quando la Cassa Unica è spenta.
  assert.ok(/!cassaUnicaAttiva[\s\S]{0,220}?getDailySafeToSpend/.test(js),
    'stsPerOrb deve restare calcolato solo con `!cassaUnicaAttiva`: è ciò che impedisce due risposte alla stessa domanda');
});

test('GARANZIA DOM: ogni card che il riordino per rilevanza pretende di spostare esiste davvero', async () => {
  // Stessa classe di bug della card fantasma, ma peggiore: rilevanza-card.js
  // calcolerebbe felicemente una priorità per un id inesistente e nessuno se
  // ne accorgerebbe — l'ordine risulterebbe giusto nei test e sbagliato sullo
  // schermo, perché una delle card non riceve mai il suo `order`.
  const { ORDINE_BASE } = await import('../predict/rilevanza-card.js');
  const idHtml = new Set();
  for (const m of html.matchAll(/id=["']([\w-]+)["']/g)) idHtml.add(m[1]);
  const mancanti = Object.keys(ORDINE_BASE).filter(i => !idHtml.has(i));
  assert.deepEqual(mancanti, [], `rilevanza-card.js ordina card che non esistono in index.html: ${mancanti.join(', ')}`);
});

test('GARANZIA DOM: il riordino agisce su un contenitore flex, altrimenti `order` non fa niente', () => {
  // `order` è ignorato da CSS fuori da un contesto flex o grid: senza questa
  // classe il riordino sarebbe codice che gira, non sbaglia e non fa nulla.
  const tag = html.match(/<div[^>]*id=["']dashboard-view["'][^>]*>/)[0];
  assert.ok(/\bflex\b/.test(tag) && /\bflex-col\b/.test(tag),
    `#dashboard-view deve restare flex-col perché style.order abbia effetto: ${tag}`);
});

test('GARANZIA DOM: la traiettoria di fine mese non ha altre case oltre a questa card', () => {
  // monthTrajectoryFocus è l unico sguardo in avanti sul mese. Se un giorno
  // viene usato anche altrove, questo test va aggiornato di proposito — ma
  // finché è uno solo, perdere la card significa perdere la traiettoria.
  const usi = (js.match(/monthTrajectoryFocus\s*\(/g) || []).length;
  assert.equal(usi, 1, 'monthTrajectoryFocus è usato in più punti: verificare che la traiettoria non sia duplicata');
});
