import test from 'node:test';
import assert from 'node:assert/strict';

const { buildProfiles, fuseSignals } = await import('./signal-fusion.js');

function tx(date, amount, category) {
  return { date, amount, category, type: 'uscita', description: category };
}

// Storia: ristoranti quasi sempre la sera con importi piccoli; spesa di
// giorno con importi medi. Abbastanza dati (>20) per attivare la fusione.
function history() {
  const allTx = { '2026-06': [], '2026-07': [] };
  for (let i = 0; i < 20; i++) allTx['2026-06'].push(tx(`2026-06-${String((i%28)+1).padStart(2,'0')}T21:00:00`, 8 + i % 5, 'ristoranti'));
  for (let i = 0; i < 20; i++) allTx['2026-07'].push(tx(`2026-07-${String((i%28)+1).padStart(2,'0')}T10:00:00`, 45 + i % 10, 'spesa'));
  return allTx;
}

test('buildProfiles: conta importi e fasce orarie per categoria', () => {
  const p = buildProfiles(history());
  assert.equal(p.ristoranti.n, 20);
  assert.equal(p.spesa.n, 20);
  assert.ok(p.ristoranti.slot[3] > 0); // sera
  assert.ok(p.spesa.slot[0] > 0);      // mattina
});

test('fusione: importo piccolo di sera spinge verso ristoranti quando il testo è incerto', () => {
  const mlProbs = { ristoranti: 0.45, spesa: 0.45, shopping: 0.10 };
  const sera = new Date(2026, 6, 15, 21, 30);
  const r = fuseSignals(mlProbs, { amount: 9, date: sera, allTx: history() });
  assert.equal(r.contextUsed, true);
  assert.equal(r.category, 'ristoranti'); // il contesto rompe il pareggio
  assert.ok(r.allProbs.ristoranti > r.allProbs.spesa);
});

test('fusione: importo medio di mattina spinge verso spesa', () => {
  const mlProbs = { ristoranti: 0.45, spesa: 0.45, shopping: 0.10 };
  const mattina = new Date(2026, 6, 15, 10, 0);
  const r = fuseSignals(mlProbs, { amount: 48, date: mattina, allTx: history() });
  assert.equal(r.category, 'spesa');
});

test('fusione: dati insufficienti → nessuna spinta, resta il modello testuale', () => {
  const mlProbs = { ristoranti: 0.6, spesa: 0.4 };
  const r = fuseSignals(mlProbs, { amount: 9, date: new Date(2026, 6, 15, 21), allTx: {} });
  assert.equal(r.contextUsed, false);
  assert.equal(r.category, 'ristoranti');
});

test('fusione: il testo resta dominante (contesto non ribalta una predizione forte)', () => {
  const mlProbs = { ristoranti: 0.05, spesa: 0.95 };
  const sera = new Date(2026, 6, 15, 21, 30);
  const r = fuseSignals(mlProbs, { amount: 9, date: sera, allTx: history() });
  assert.equal(r.category, 'spesa'); // 95% di testo non viene ribaltato dal contesto
});
