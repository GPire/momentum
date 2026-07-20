import test from 'node:test';
import assert from 'node:assert/strict';
const { inferLifestyle } = await import('./lifestyle.js');

// helper: costruisce N transazioni uscita in un mese per categoria
function txs(cat, n, amount = 20, month = '2026-07') {
  return Array.from({ length: n }, (_, i) => ({ date: `${month}-${String((i % 27) + 1).padStart(2, '0')}`, amount, type: cat === 'etf' || cat === 'crypto' || cat === 'risparmio' ? 'invest' : 'uscita', category: cat }));
}

test('baseline insufficiente (0 mesi precedenti) -> nessun pattern inventato', () => {
  const allTx = { '2026-07': txs('ristoranti', 10) };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.monthsAvailable, 0);
  assert.deepEqual(r.patterns, []);
});

test('vita sociale intensa: molte cene questo mese vs la norma personale', () => {
  const allTx = {
    '2026-04': txs('ristoranti', 6), '2026-05': txs('ristoranti', 6), '2026-06': txs('ristoranti', 5),
    '2026-07': txs('ristoranti', 15),
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  const p = r.patterns.find(x => x.id === 'social-active');
  assert.ok(p, 'deve rilevare vita sociale intensa');
  assert.ok(/15 volte/.test(p.evidence));
  assert.ok(p.confidence > 0.4);
});

test('più serate a casa: poche uscite vs la norma', () => {
  const allTx = {
    '2026-04': txs('ristoranti', 10), '2026-05': txs('ristoranti', 10), '2026-06': txs('ristoranti', 10),
    '2026-07': txs('ristoranti', 2),
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  assert.ok(r.patterns.find(x => x.id === 'social-quiet'), 'deve rilevare mese casalingo');
});

test('cucini di più: spesa su, ristoranti giù', () => {
  const allTx = {
    '2026-04': [...txs('spesa', 6), ...txs('ristoranti', 8)],
    '2026-05': [...txs('spesa', 6), ...txs('ristoranti', 8)],
    '2026-07': [...txs('spesa', 12), ...txs('ristoranti', 3)],
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  assert.ok(r.patterns.find(x => x.id === 'home-cooking'), 'deve rilevare più cucina a casa');
});

test('mese di shopping: importo shopping molto sopra la norma', () => {
  const allTx = {
    '2026-04': txs('shopping', 2, 50), '2026-05': txs('shopping', 2, 50), '2026-06': txs('shopping', 2, 50),
    '2026-07': txs('shopping', 4, 120),
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  const p = r.patterns.find(x => x.id === 'shopping-surge');
  assert.ok(p, 'deve rilevare mese di shopping');
  assert.ok(/€/.test(p.evidence));
});

test('nessun giudizio morale nei testi (mai "spreco/sbagliato/troppo")', () => {
  const allTx = {
    '2026-04': txs('ristoranti', 5), '2026-05': txs('ristoranti', 5),
    '2026-07': txs('ristoranti', 20),
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  for (const p of r.patterns) {
    assert.ok(!/spreco|sbagli|troppo|male|dovresti/i.test(p.label + ' ' + p.evidence), `testo giudicante: ${p.evidence}`);
  }
});

test('abitudine di investimento costante rispecchiata come segnale positivo', () => {
  const allTx = {
    '2026-05': txs('etf', 1, 200), '2026-06': txs('etf', 1, 200),
    '2026-07': txs('etf', 1, 200),
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  assert.ok(r.patterns.find(x => x.id === 'investor-habit'), 'deve rispecchiare la regolarità d\'investimento');
});

test('patterns ordinati per confidenza decrescente', () => {
  const allTx = {
    '2026-04': [...txs('ristoranti', 5), ...txs('shopping', 2, 50)],
    '2026-05': [...txs('ristoranti', 5), ...txs('shopping', 2, 50)],
    '2026-07': [...txs('ristoranti', 18), ...txs('shopping', 5, 200)],
  };
  const r = inferLifestyle({ allTx, referenceDate: new Date(2026, 6, 15) });
  for (let i = 1; i < r.patterns.length; i++) {
    assert.ok(r.patterns[i - 1].confidence >= r.patterns[i].confidence);
  }
});
