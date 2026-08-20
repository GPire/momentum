'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quanteScommesse, testoScommesse, elencoTop, scaricaStorie, STABILI, MIN_MONETE } from './cripto-diversificazione.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;

test('meno di tre monete: nessun conto inventato', () => {
  const r = quanteScommesse({ BTC: new Array(100).fill(0.01) });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 3 monete/);
});

test('MONETE QUASI IDENTICHE: molte righe, poche scommesse', () => {
  // Il caso che il modulo esiste per riconoscere: chi ne possiede cinque
  // crede di avere cinque posizioni, e nei giorni che contano ne ha una.
  const rng = seme(1);
  const base = Array.from({ length: 200 }, () => rumore(rng) * 0.05);
  const serie = {};
  for (const s of ['BTC', 'ETH', 'SOL', 'ADA', 'DOT']) {
    serie[s] = base.map((x) => x + rumore(rng) * 0.002);
  }
  const r = quanteScommesse(serie);
  assert.equal(r.monete, 5);
  // Il metodo di Li e Ji conta anche le direzioni minuscole del rumore: con
  // cinque copie quasi identiche restituisce 2, non 1. Il messaggio resta
  // quello giusto — cinque righe, due scommesse — e pretendere 1 esatto
  // sarebbe chiedere alla misura una precisione che non ha.
  assert.ok(r.scommesseVere <= 2.5, `${r.scommesseVere} direzioni su 5 monete`);
  assert.ok(r.correlazioneMedia > 0.9);
  assert.ok(r.illusione >= 3);
  assert.match(testoScommesse(r), /stanno ripetendo/);
});

test('monete DAVVERO indipendenti: la diversificazione è reale, e lo si dice', () => {
  const rng = seme(2);
  const serie = {};
  for (const s of ['A', 'B', 'C', 'D']) serie[s] = Array.from({ length: 200 }, () => rumore(rng) * 0.05);
  const r = quanteScommesse(serie);
  assert.ok(r.scommesseVere > 3, `${r.scommesseVere}`);
  assert.ok(r.correlazioneMedia < 0.2);
  assert.match(testoScommesse(r), /quasi reale/);
});

test('la coppia PIÙ LEGATA viene nominata, non solo la media', () => {
  // La media nasconde il caso peggiore: due monete al 95% dentro un paniere
  // con media 60% sono la cosa che conta.
  const rng = seme(3);
  const a = Array.from({ length: 150 }, () => rumore(rng) * 0.05);
  const serie = {
    BTC: a,
    ETH: a.map((x) => x + rumore(rng) * 0.001),
    XRP: Array.from({ length: 150 }, () => rumore(rng) * 0.05),
  };
  const r = quanteScommesse(serie);
  assert.ok(r.piuLegate);
  assert.ok(['BTC', 'ETH'].includes(r.piuLegate.a) && ['BTC', 'ETH'].includes(r.piuLegate.b));
  assert.ok(r.piuLegate.correlazione > 0.9);
  assert.match(testoScommesse(r), /piu' legate/);
});

test('LE MONETE ANCORATE AL DOLLARO sono escluse: è il modo più facile di ingannarsi', () => {
  // Una stablecoin ha rendimenti quasi nulli e correlazione ~0 con tutto:
  // tenerla dentro farebbe sembrare il paniere molto più vario di quanto sia.
  assert.ok(STABILI.has('tether'));
  assert.ok(STABILI.has('usd-coin'));
  assert.ok(STABILI.has('dai'));
});

test('le monete NON arrivate vengono dichiarate nel referto', () => {
  // Senza, il referto parlerebbe di un paniere diverso da quello che l'utente
  // ha in mente — e la fonte gratuita ne perde davvero metà.
  const rng = seme(4);
  const serie = {};
  for (const s of ['BTC', 'ETH', 'SOL']) serie[s] = Array.from({ length: 120 }, () => rumore(rng) * 0.04);
  const r = quanteScommesse(serie, { mancate: ['XRP', 'DOGE'] });
  assert.deepEqual(r.mancate, ['XRP', 'DOGE']);
  assert.match(testoScommesse(r), /limita le richieste/);
});

test('il referto dichiara SEMPRE il limite dell\'anno singolo', () => {
  const rng = seme(5);
  const serie = {};
  for (const s of ['A', 'B', 'C']) serie[s] = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const t = testoScommesse(quanteScommesse(serie));
  assert.match(t, /non un ciclo/);
  assert.match(t, /cicli pluriennali/);
});

test('il testo non consiglia mosse', () => {
  const rng = seme(6);
  const serie = {};
  for (const s of ['A', 'B', 'C', 'D']) serie[s] = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const t = testoScommesse(quanteScommesse(serie));
  assert.ok(!/\b(vendi|compra|dovresti|ti consiglio|conviene)\b/i.test(t), t);
  assert.match(t, /Non e' un consiglio/);
});
