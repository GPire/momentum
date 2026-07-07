import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executiveCascade } from './executive.js';

// Stadio-spia: conta quante volte viene chiamato (verifica il COSTO reale).
function spy(result) {
  const fn = (_text) => { fn.calls++; return result; };
  fn.calls = 0;
  return fn;
}

test('caso facile: Nano molto sicuro → chiude da solo, Meso/DCGN NON eseguiti (costo 1)', () => {
  const nano = spy({ category: 'spesa', confidence: 0.92 });
  const meso = spy({ category: 'ristoranti', confidence: 0.9 });
  const dcgn = spy({ category: 'shopping', confidence: 0.9 });
  const r = executiveCascade('lidl italia', { nano, meso, dcgn });
  assert.equal(r.category, 'spesa');
  assert.deepEqual(r.ran, ['nano']);
  assert.equal(meso.calls, 0, 'Meso non svegliato');
  assert.equal(dcgn.calls, 0, 'DCGN non svegliato');
  assert.equal(r.abstain, false);
});

test('Nano incerto → escalation a Meso; se concordano chiude (costo 2, DCGN non eseguito)', () => {
  const nano = spy({ category: 'crypto', confidence: 0.55 });
  const meso = spy({ category: 'crypto', confidence: 0.7 });
  const dcgn = spy({ category: 'etf', confidence: 0.8 });
  const r = executiveCascade('binance', { nano, meso, dcgn });
  assert.equal(r.category, 'crypto');
  assert.deepEqual(r.ran, ['nano', 'meso']);
  assert.equal(dcgn.calls, 0, 'DCGN non serve: Nano e Meso concordano');
  assert.equal(r.agreement, true);
});

test('Nano e Meso in disaccordo ma confidenza combinata alta → chiude senza DCGN', () => {
  const nano = spy({ category: 'ristoranti', confidence: 0.5 });
  const meso = spy({ category: 'spesa', confidence: 0.95 });
  const dcgn = spy({ category: 'shopping', confidence: 0.9 });
  const r = executiveCascade('mercato', { nano, meso, dcgn }, { midConf: 0.6 });
  assert.equal(r.category, 'spesa'); // vince Meso per confidenza
  assert.deepEqual(r.ran, ['nano', 'meso']);
  assert.equal(dcgn.calls, 0);
});

test('tutto ambiguo e in disaccordo → DCGN eseguito, poi ASTENSIONE (costo 3)', () => {
  const nano = spy({ category: 'ristoranti', confidence: 0.4 });
  const meso = spy({ category: 'spesa', confidence: 0.42 });
  const dcgn = spy({ category: 'shopping', confidence: 0.41 });
  const r = executiveCascade('xyz sconosciuto', { nano, meso, dcgn });
  assert.deepEqual(r.ran, ['nano', 'meso', 'dcgn']);
  assert.equal(dcgn.calls, 1);
  assert.equal(r.abstain, true, 'incerto + disaccordo → non lo so');
});

test('senza Meso disponibile: solo Nano; astensione se sotto soglia', () => {
  const nano = spy({ category: 'spesa', confidence: 0.3 });
  const r = executiveCascade('boh', { nano });
  assert.deepEqual(r.ran, ['nano']);
  assert.equal(r.abstain, true);
});

test('la competenza per-categoria (reliability) può ribaltare il vincitore', () => {
  const nano = spy({ category: 'ristoranti', confidence: 0.6 });
  const meso = spy({ category: 'spesa', confidence: 0.6 });
  // Meso storicamente inaffidabile su "spesa", Nano affidabile su "ristoranti"
  const reliability = (src, cat) => (src === 'meso' && cat === 'spesa') ? 0.2 : 1.0;
  const r = executiveCascade('ambiguo', { nano, meso }, { reliability, midConf: 0.5 });
  assert.equal(r.category, 'ristoranti', 'la competenza misurata pesa il voto');
});

test('determinismo: stessi input → stesso esito', () => {
  const mk = () => ({ nano: spy({ category: 'etf', confidence: 0.5 }), meso: spy({ category: 'etf', confidence: 0.65 }) });
  const a = executiveCascade('pac etf', mk());
  const b = executiveCascade('pac etf', mk());
  assert.deepEqual(a, b);
});
