import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { Omega, verifyArithmetic } = await import('./omega.js');

test('verifyArithmetic: coerente entro tolleranza, incoerente fuori', () => {
  assert.equal(verifyArithmetic(100, 100).ok, true);
  assert.equal(verifyArithmetic(100, 100.5).ok, true);   // <1% scala
  assert.equal(verifyArithmetic(100, 130).ok, false);    // 30% → incoerente
});

test('reason: fonda il consiglio su una regola con fonte + chain-of-thought', () => {
  const r = Omega.reason('posso investire?', { wantsToInvest: true, emergencyMonths: 0 });
  assert.ok(/Fonte:/.test(r.advice));                    // consiglio citato
  assert.ok(r.chainOfThought.length >= 1);               // catena di pensiero
  assert.ok(r.citations.some(c => c.id === 'emergency-fund-first'));
  assert.ok(/Non è consulenza/.test(r.disclaimer));
});

test('reason: debito ad alto interesse prevale nel ragionamento', () => {
  const r = Omega.reason('investire o pagare debiti?', { wantsToInvest: true, hasHighInterestDebt: true, emergencyMonths: 6 });
  assert.ok(r.citations[0].id === 'high-interest-debt-first');
});

test('reason: self-check segnala incoerenza aritmetica', () => {
  const r = Omega.reason('quanto ho speso', { numericClaim: 500, numericRecompute: 420 });
  assert.equal(r.selfCheck.ok, false);
  assert.ok(r.chainOfThought.some(s => /incoerenza/.test(s)));
});

test('reason: catena causale integrata quando richiesta', () => {
  const links = [
    { from: 'Ristorante', to: 'Trasporti', lagWeeks: 0, r: 0.85, samples: 20, direction: 'insieme' },
  ];
  const r = Omega.reason('se esco di più?', { wantsToInvest: false, causalLinks: links, allTx: {}, causalQuery: { category: 'Ristorante', deltaPct: 40 } });
  assert.ok(r.causal && /Trasporti/.test(r.causal.text));
});

// ---- Wave 12 (NeuroSym v2, Financial Reasoning Layer): fusione cross-dominio ----

const allTxReal = {
  '2026-04': [{ date: '2026-04-05', amount: 300, type: 'uscita', category: 'ristorazione' }],
  '2026-05': [{ date: '2026-05-05', amount: 320, type: 'uscita', category: 'ristorazione' }],
  '2026-06': [{ date: '2026-06-05', amount: 310, type: 'uscita', category: 'ristorazione' }],
};

test('reason: crossDomain combina cashflow (what-if) e patrimonio (Twin) quando c\'è storico reale', () => {
  const r = Omega.reason('e se taglio i ristoranti?', {
    wantsToInvest: false, allTx: allTxReal, referenceDate: new Date(2026, 6, 15),
    causalQuery: { category: 'ristorazione', deltaPct: -20 },
  });
  assert.ok(r.crossDomain, 'crossDomain deve essere popolato');
  assert.ok(r.crossDomain.whatIf.totalMonthly > 0, 'tagliare libera cashflow positivo');
  assert.ok(r.crossDomain.twin, 'il twin patrimoniale deve calcolarsi con un impatto reale');
  assert.ok(r.chainOfThought.some(s => /Impatto cashflow/.test(s)));
  assert.ok(r.chainOfThought.some(s => /Patrimonio Twin/.test(s)));
});

test('reason: senza causalQuery crossDomain resta null (nessun requisito nuovo per i chiamanti esistenti)', () => {
  const r = Omega.reason('posso investire?', { wantsToInvest: true, emergencyMonths: 6 });
  assert.equal(r.crossDomain, null);
});

test('reason: crossDomain degrada senza rompere il resto quando manca storico per la categoria', () => {
  const r = Omega.reason('e se taglio X?', {
    wantsToInvest: false, allTx: {}, causalQuery: { category: 'mai-vista', deltaPct: -20 },
  });
  assert.equal(r.crossDomain.whatIf, null);
  assert.equal(r.crossDomain.twin, null);
  assert.ok(r.advice !== undefined); // il resto del ragionamento non si rompe
});

test('explain: mappa a 5 strati onesta', () => {
  const e = Omega.explain();
  assert.equal(e.architecture.length, 5);
  assert.ok(/auto-verifica|self-check/i.test(e.honesty));
});
