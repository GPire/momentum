import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSequenceModel, predictNext } from './sequence.js';

// Costruisce transazioni con date crescenti da una sequenza di categorie.
function txFromSeq(cats) {
  const base = new Date('2026-01-01T09:00:00');
  return { all: cats.map((c, i) => ({ category: c, type: 'uscita', date: new Date(base.getTime() + i * 86400000).toISOString() })) };
}

test('impara una sequenza ripetuta: dopo A di solito arriva B', () => {
  const seq = [];
  for (let i = 0; i < 8; i++) seq.push('spesa', 'trasporti'); // spesa→trasporti ricorrente
  const model = buildSequenceModel(txFromSeq(seq).all.reduce((o, t, i) => ((o[i] = [t]), o), {}));
  const r = predictNext(model, 'spesa');
  assert.equal(r.top, 'trasporti');
  assert.equal(r.fromSequence, true);
  assert.ok(r.confidence > 0.5, `confidenza alta su pattern netto (${r.confidence})`);
});

test('neutro senza dati: distribuzione vuota', () => {
  const model = buildSequenceModel({});
  const r = predictNext(model, 'spesa');
  assert.equal(r.top, null);
  assert.equal(r.confidence, 0);
});

test('categoria-predecessore mai vista → ricade sul prior (neutro dichiarato)', () => {
  const model = buildSequenceModel({ 0: [{ category: 'spesa', type: 'uscita', date: '2026-01-01T09:00:00' }],
                                     1: [{ category: 'spesa', type: 'uscita', date: '2026-01-02T09:00:00' }] });
  const r = predictNext(model, 'crypto'); // 'crypto' non è mai stato un predecessore
  assert.equal(r.fromSequence, false, 'usa il prior, non la sequenza');
  assert.equal(r.top, 'spesa');
});

test('le entrate spezzano la sequenza di spesa (type filtrato)', () => {
  const tx = {
    0: [{ category: 'spesa', type: 'uscita', date: '2026-01-01T09:00:00' }],
    1: [{ category: 'stipendio', type: 'entrata', date: '2026-01-02T09:00:00' }],
    2: [{ category: 'trasporti', type: 'uscita', date: '2026-01-03T09:00:00' }],
  };
  const model = buildSequenceModel(tx);
  // solo uscite: spesa→trasporti (lo stipendio entrata è escluso)
  assert.ok(!model.cats.includes('stipendio'));
  assert.equal(predictNext(model, 'spesa').top, 'trasporti');
});

test('determinismo: stesse transazioni → stesso modello e stessa predizione', () => {
  const seq = ['spesa', 'ristoranti', 'spesa', 'trasporti', 'spesa', 'ristoranti'];
  const build = () => buildSequenceModel(seq.reduce((o, c, i) => ((o[i] = [{ category: c, type: 'uscita', date: new Date(2026, 0, 1 + i).toISOString() }]), o), {}));
  assert.deepEqual(build(), build());
  assert.deepEqual(predictNext(build(), 'spesa'), predictNext(build(), 'spesa'));
});
