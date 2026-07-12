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

test('explain: mappa a 5 strati onesta', () => {
  const e = Omega.explain();
  assert.equal(e.architecture.length, 5);
  assert.ok(/auto-verifica|self-check/i.test(e.honesty));
});
