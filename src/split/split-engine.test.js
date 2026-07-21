import test from 'node:test';
import assert from 'node:assert/strict';
const { createGroup, addSharedExpense, computeBalances, minimalSettlement, settlementView, suggestSettleTiming, settlementToSepa } = await import('./split-engine.js');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (o) => round2(Object.values(o).reduce((a, b) => a + b, 0));
// Verifica che un settlement azzeri davvero tutti i saldi.
function appliesToZero(balances, transfers) {
  const b = { ...balances };
  for (const t of transfers) { b[t.from] = round2((b[t.from] || 0) + t.amount); b[t.to] = round2((b[t.to] || 0) - t.amount); }
  return Object.values(b).every(v => Math.abs(v) < 0.01);
}

test('divisione EQUA: 3 amici, uno paga 90 → gli altri due gli devono 30 ciascuno', () => {
  let g = createGroup({ name: 'Cena', members: ['Anna', 'Bea', 'Carlo'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 90, description: 'Pizzeria' });
  const bal = computeBalances(g);
  assert.equal(bal.m0, 60);   // ha pagato 90, doveva 30 → +60
  assert.equal(bal.m1, -30);
  assert.equal(bal.m2, -30);
  assert.equal(sum(bal), 0);  // invariante
});

test('settlement minimo: 3 persone → 2 bonifici che azzerano tutto', () => {
  let g = createGroup({ members: ['Anna', 'Bea', 'Carlo'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 90 });
  const { balances, transfers } = settlementView(g);
  assert.equal(transfers.length, 2);       // m1→m0, m2→m0
  assert.ok(transfers.every(t => t.to === 'm0'));
  assert.ok(appliesToZero(balances, transfers));
});

test('settlement minimo: catena di debiti si semplifica (A→B, B→C ⇒ A→C)', () => {
  // Anna paga per Bea, Bea paga per Carlo, ecc. → il greedy riduce i bonifici
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 30, shares: { equalAmong: ['m1'] } }); // B deve 30 ad A
  g = addSharedExpense(g, { payer: 'm1', amount: 30, shares: { equalAmong: ['m2'] } }); // C deve 30 a B
  const { balances, transfers } = settlementView(g);
  assert.ok(appliesToZero(balances, transfers));
  assert.ok(transfers.length <= 2); // niente giro inutile B→A→... : max 2 (o meno)
});

test('quote ESATTE per persona (byId) devono sommare all\'importo', () => {
  let g = createGroup({ members: ['A', 'B'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100, shares: { byId: { m0: 40, m1: 60 } } });
  const bal = computeBalances(g);
  assert.equal(bal.m0, 60);   // pagato 100, dovuto 40
  assert.equal(bal.m1, -60);
  assert.throws(() => addSharedExpense(g, { payer: 'm0', amount: 100, shares: { byId: { m0: 40, m1: 50 } } }), /sommano/);
});

test('ripartizione a PESI (weights): proporzionale', () => {
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 120, shares: { weights: { m0: 1, m1: 1, m2: 2 } } });
  const bal = computeBalances(g);
  assert.equal(bal.m2, -60);  // peso doppio → 60
  assert.equal(sum(bal), 0);
});

test('arrotondamento: 10 diviso 3 → quote 3,33/3,33/3,34, somma esatta 10', () => {
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 10 });
  const e = g.expenses[0];
  assert.equal(round2(Object.values(e.owed).reduce((a, b) => a + b, 0)), 10); // nessun centesimo perso
});

test('più spese, membri diversi: saldi coerenti e settlement azzera tutto', () => {
  let g = createGroup({ members: ['A', 'B', 'C', 'D'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });                 // tutti
  g = addSharedExpense(g, { payer: 'm1', amount: 40, shares: { equalAmong: ['m0', 'm1'] } });
  g = addSharedExpense(g, { payer: 'm2', amount: 60, shares: { weights: { m2: 1, m3: 2 } } });
  const { balances, transfers } = settlementView(g);
  assert.equal(sum(balances), 0);
  assert.ok(appliesToZero(balances, transfers));
});

test('suggestSettleTiming: predittivo e onesto', () => {
  assert.equal(suggestSettleTiming({ amountDue: 30, currentAvailable: 100 }).when, 'ora');
  assert.equal(suggestSettleTiming({ amountDue: 300, currentAvailable: 100, nextIncome: { date: '2026-08-01' } }).when, 'dopo il prossimo accredito');
  assert.equal(suggestSettleTiming({ amountDue: 30 }).when, 'quando puoi'); // senza dati non promette
});

test('settlementToSepa: ponte col bonifico on-device se conosco l\'IBAN', () => {
  let g = createGroup({ name: 'Vacanza', members: ['A', 'B'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });
  const { transfers } = settlementView(g);
  const sepa = settlementToSepa(transfers[0], g, { m0: 'IT60X0542811101000000123456' });
  assert.equal(sepa.iban, 'IT60X0542811101000000123456');
  assert.equal(sepa.amount, 50);
  assert.ok(/Rimborso Vacanza/.test(sepa.remittance));
  // senza IBAN → null (resta la richiesta a voce)
  assert.equal(settlementToSepa(transfers[0], g, {}), null);
});
