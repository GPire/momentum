import test from 'node:test';
import assert from 'node:assert/strict';
const { createGroup, addSharedExpense, computeBalances, minimalSettlement, settlementView, suggestSettleTiming, settlementToSepa, quickSplit, frequentCoSplitters, mergeGroups, mergeIntoGroups, encodeGroupShare, decodeGroupShare, settlementCounts } = await import('./split-engine.js');

test('SEMPLIFICAZIONE: due coppie a somma-zero → 2 bonifici (non 4)', () => {
  const bal = { A: 10, B: -10, C: 10, D: -10 };
  const tx = minimalSettlement(bal);
  assert.equal(tx.length, 2, 'partiziona in 2 sottogruppi → 2 pagamenti');
  // azzera tutto
  const b = { ...bal }; for (const t of tx) { b[t.from] += t.amount; b[t.to] -= t.amount; }
  assert.ok(Object.values(b).every(v => Math.abs(v) < 0.01));
});

test('SEMPLIFICAZIONE: scenario reale (10/89/0 in 3) → 2 pagamenti minimi', () => {
  let g = createGroup({ members: ['Io', 'Anna', 'Bea'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 10 });
  g = addSharedExpense(g, { payer: 'm1', amount: 89 });
  const tx = minimalSettlement(computeBalances(g));
  assert.equal(tx.length, 2);
  const b = computeBalances(g); for (const t of tx) { b[t.from] += t.amount; b[t.to] -= t.amount; }
  assert.ok(Object.values(b).every(v => Math.abs(v) < 0.01));
});

test('settlementCounts: mostra il risparmio di pagamenti (raw > simplified)', () => {
  // catena: ognuno paga a turno per tutti → tanti debiti grezzi, pochi semplificati
  let g = createGroup({ members: ['A', 'B', 'C', 'D'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });   // tutti devono ad A
  g = addSharedExpense(g, { payer: 'm1', amount: 20 });    // tutti devono a B
  const c = settlementCounts(g);
  assert.ok(c.raw >= c.simplified);
  assert.equal(typeof c.saved, 'number');
});

// Simula: creo il gruppo, lo condivido (encode) e l'amico lo riceve (decode).
function shareRoundTrip(g) { return decodeGroupShare(encodeGroupShare(g)); }

test('CONDIVISIONE: codice round-trip (encode→decode) preserva il gruppo', () => {
  let g = createGroup({ name: 'Vacanza', members: ['Io', 'Anna'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100, description: 'Hotel' });
  const back = shareRoundTrip(g);
  assert.equal(back.id, g.id);
  assert.equal(back.name, 'Vacanza');
  assert.equal(back.expenses.length, 1);
  assert.equal(back.expenses[0].amount, 100);
});

test('CONDIVISIONE: due persone aggiungono spese indipendenti → merge = UNIONE', () => {
  // base creata da me e condivisa all'amico
  let base = createGroup({ name: 'Casa', members: ['Io', 'Bea'] });
  let mine = addSharedExpense(base, { payer: 'm0', amount: 60, description: 'Spesa' });      // io aggiungo
  let theirs = addSharedExpense(shareRoundTrip(base), { payer: 'm1', amount: 40, description: 'Bollette' }); // l'amico parte dalla base e aggiunge
  const merged = mergeGroups(mine, theirs);
  assert.equal(merged.expenses.length, 2, 'le due spese indipendenti si uniscono');
  const bal = computeBalances(merged);
  assert.equal(Math.round(Object.values(bal).reduce((a, b) => a + b, 0)), 0);
});

test('CONDIVISIONE: merge COMMUTATIVO e IDEMPOTENTE (converge sempre)', () => {
  let base = createGroup({ name: 'G', members: ['A', 'B'] });
  const a = addSharedExpense(base, { payer: 'm0', amount: 30 });
  const b = addSharedExpense(shareRoundTrip(base), { payer: 'm1', amount: 50 });
  const ab = mergeGroups(a, b), ba = mergeGroups(b, a);
  assert.equal(ab.expenses.length, ba.expenses.length);                 // commutativo
  assert.equal(mergeGroups(ab, b).expenses.length, ab.expenses.length); // idempotente (re-merge = no-op)
  assert.equal(mergeGroups(ab, ab).expenses.length, ab.expenses.length);
});

test('CONDIVISIONE: gruppi con id DIVERSI non si fondono (restano distinti)', () => {
  const g1 = createGroup({ name: 'X', members: ['A'] });
  const g2 = createGroup({ name: 'Y', members: ['B'] });
  assert.equal(mergeGroups(g1, g2).id, g1.id); // nessuna fusione tra gruppi diversi
  assert.equal(mergeIntoGroups([g1], g2).length, 2);
  assert.equal(mergeIntoGroups([g1], shareRoundTrip(g1)).length, 1); // stesso id → resta 1
});

test('CONDIVISIONE: N dispositivi (10/20/30) convergono — ordine-indipendente e idempotente', () => {
  for (const N of [10, 20, 30]) {
    const members = Array.from({ length: N }, (_, i) => 'P' + i);
    const base = createGroup({ name: 'G' + N, members });
    const baseCode = encodeGroupShare(base);
    // ogni dispositivo parte dalla base e aggiunge la sua spesa
    const codes = [];
    for (let d = 0; d < N; d++) {
      let g = decodeGroupShare(baseCode);
      g = addSharedExpense(g, { payer: 'm' + d, amount: (d + 1) * 10, description: 'sp' + d });
      codes.push(encodeGroupShare(g));
    }
    // merge in due ordini diversi → stesso risultato (commutativo); poi re-merge (idempotente)
    let a = decodeGroupShare(baseCode); for (const c of codes) a = mergeGroups(a, decodeGroupShare(c));
    let b = decodeGroupShare(baseCode); for (const c of codes.slice().reverse()) b = mergeGroups(b, decodeGroupShare(c));
    for (const c of codes) a = mergeGroups(a, decodeGroupShare(c));
    assert.equal(a.expenses.length, N, `N=${N}: tutte le ${N} spese unite`);
    assert.equal(a.expenses.length, b.expenses.length, `N=${N}: convergenza ordine-indipendente`);
    const bal = computeBalances(a);
    assert.ok(Math.abs(Object.values(bal).reduce((x, y) => x + y, 0)) < 0.02, `N=${N}: saldi a somma zero`);
  }
});

test('CONDIVISIONE: codice non valido → null (mai crash)', () => {
  assert.equal(decodeGroupShare('spazzatura'), null);
  assert.equal(decodeGroupShare(''), null);
  assert.equal(decodeGroupShare('MSPLIT1:@@@'), null);
});

test('quickSplit: divisione istantanea al centesimo esatto (30 in 4 → 7,50)', () => {
  const r = quickSplit({ amount: 30, people: 4 });
  assert.equal(r.perPerson, 7.5);
  assert.equal(r.shares.reduce((a, b) => a + b, 0), 30); // somma esatta
});

test('quickSplit: resto distribuito senza centesimi persi (10 in 3)', () => {
  const r = quickSplit({ amount: 10, people: 3 });
  assert.equal(Math.round(r.shares.reduce((a, b) => a + b, 0) * 100) / 100, 10);
  assert.deepEqual(r.shares.map(x => Math.round(x * 100) / 100), [3.34, 3.33, 3.33]);
});

test('quickSplit: tip round-up all\'euro per comodità', () => {
  const r = quickSplit({ amount: 29, people: 4, tipRoundUp: true });
  // 29/4 = 7,25 → arrotonda a 8 a testa → totale 32
  assert.equal(r.perPerson, 8);
  assert.equal(r.roundedTotal, 32);
});

test('frequentCoSplitters: ricorda chi divide più spesso, esclude "io"', () => {
  const past = [
    { members: [{ name: 'io' }, { name: 'Anna' }, { name: 'Bea' }] },
    { members: [{ name: 'io' }, { name: 'Anna' }] },
  ];
  const f = frequentCoSplitters(past);
  assert.equal(f[0].name, 'Anna');
  assert.equal(f[0].count, 2);
  assert.ok(!f.some(x => x.name === 'io'));
});

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
