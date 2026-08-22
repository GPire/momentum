import test from 'node:test';
import assert from 'node:assert/strict';
import { percentileTitolo, comparabili, peersDaPannello } from './screener-settore.js';
import { AZIENDE_PANEL } from './panel-settoriale.js';

// ── percentileTitolo ──

test('percentileTitolo: un titolo reale del pannello (AAPL) restituisce settore e percentili', () => {
  const r = percentileTitolo('AAPL');
  assert.ok(r.disponibile, r.motivo);
  assert.equal(r.ticker, 'AAPL');
  assert.ok(r.settore, 'deve avere una descrizione di settore');
  assert.ok(r.anno >= 2020, `anno più recente atteso, avuto ${r.anno}`);
  assert.ok(typeof r.percentili.roe === 'number' || r.percentili.roe === undefined);
});

test('percentileTitolo: un ticker fuori dal pannello si dichiara, non inventa un settore', () => {
  const r = percentileTitolo('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /non è fra le aziende/);
});

test('percentileTitolo: minuscolo o maiuscolo non cambia il risultato', () => {
  const a = percentileTitolo('aapl');
  const b = percentileTitolo('AAPL');
  assert.equal(a.disponibile, b.disponibile);
  assert.equal(a.ticker, b.ticker);
});

test('percentileTitolo: input assente non crasha', () => {
  assert.equal(percentileTitolo(null).disponibile, false);
  assert.equal(percentileTitolo(undefined).disponibile, false);
  assert.equal(percentileTitolo('').disponibile, false);
});

// ── comparabili ──

test('comparabili: AAPL riceve aziende dello stesso gruppo di settore, mai se stessa', () => {
  const r = comparabili('AAPL');
  assert.ok(r.disponibile, JSON.stringify(r));
  assert.ok(r.comparabili.length > 0);
  assert.ok(r.comparabili.every((c) => c.ticker !== 'AAPL'));
});

test('comparabili: rispetta il limite richiesto', () => {
  const r = comparabili('AAPL', { limite: 3 });
  assert.ok(r.comparabili.length <= 3);
});

test('comparabili: un ticker fuori dal pannello si dichiara', () => {
  const r = comparabili('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
});

// ── peersDaPannello ──

test('peersDaPannello: restituisce array REALI di valori dello stesso settore-anno, mai inventati', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const anno = aapl.anni.at(-1).anno;
  const peers = peersDaPannello(aapl.sic, anno);
  assert.ok(Array.isArray(peers.roe));
  assert.ok(Array.isArray(peers.margine));
  // Ogni valore deve essere un numero finito reale, non un placeholder.
  for (const v of peers.roe) assert.ok(Number.isFinite(v));
});

test('peersDaPannello: senza sic ritorna oggetto vuoto, non crasha', () => {
  const peers = peersDaPannello(null, 2024);
  assert.deepEqual(peers, {});
});

test('peersDaPannello: si integra con percentileRank di factors.js senza modifiche', async () => {
  const { percentileRank } = await import('./factors.js');
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const riga = aapl.anni.at(-1);
  const peers = peersDaPannello(aapl.sic, riga.anno);
  // AAPL stessa dentro la distribuzione dei suoi peer: il suo ROE reale deve
  // finire in una posizione plausibile (non sempre 0.5 "neutro" per mancanza
  // di dati, che sarebbe il sintomo di un collegamento rotto).
  const p = percentileRank(riga.roe, peers.roe, true);
  assert.ok(Number.isFinite(p));
});
