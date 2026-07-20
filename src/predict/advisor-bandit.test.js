import test from 'node:test';
import assert from 'node:assert/strict';
const {
  initBandit, banditContext, banditObserve, armMean,
  makeRng, thompsonScore, rankNudges,
  phaseOfMonth, dailySeed, makeImpressions, settleImpressions, mergePendingSameDay,
} = await import('./advisor-bandit.js');

const CTX = banditContext({ overBudget: false, phase: 'mid' });

test('prior neutro: senza dati ogni braccio ha media 0,5', () => {
  const s = initBandit();
  assert.equal(armMean(s, { context: CTX, kind: 'sweep' }), 0.5);
  assert.equal(armMean(s, { context: CTX, kind: 'month-end' }), 0.5);
});

test('greedy senza dati preserva l\'ordine d\'ingresso (0 effetto)', () => {
  const s = initBandit();
  const insights = [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }];
  const ranked = rankNudges(insights, s, { context: CTX, explore: false });
  assert.deepEqual(ranked.map(i => i.kind), ['a', 'b', 'c']);
});

test('apprendimento: reward positivi alzano la media, negativi la abbassano', () => {
  let s = initBandit();
  for (let i = 0; i < 20; i++) s = banditObserve(s, { context: CTX, kind: 'sweep', reward: 1 });
  for (let i = 0; i < 20; i++) s = banditObserve(s, { context: CTX, kind: 'price-hike', reward: 0 });
  const good = armMean(s, { context: CTX, kind: 'sweep' });
  const bad = armMean(s, { context: CTX, kind: 'price-hike' });
  assert.ok(good > 0.8, `sweep atteso >0.8, avuto ${good}`);
  assert.ok(bad < 0.2, `price-hike atteso <0.2, avuto ${bad}`);
  assert.ok(good > bad);
});

test('greedy con dati: il nudge che funziona sale in cima', () => {
  let s = initBandit();
  for (let i = 0; i < 15; i++) s = banditObserve(s, { context: CTX, kind: 'month-end', reward: 1 });
  const insights = [{ kind: 'sweep' }, { kind: 'month-end' }, { kind: 'safe-to-spend' }];
  const ranked = rankNudges(insights, s, { context: CTX, explore: false });
  assert.equal(ranked[0].kind, 'month-end');
});

test('contextual: lo stesso nudge puo\' valere in un contesto e non nell\'altro', () => {
  const over = banditContext({ overBudget: true, phase: 'mid' });
  const ok = banditContext({ overBudget: false, phase: 'mid' });
  let s = initBandit();
  for (let i = 0; i < 15; i++) s = banditObserve(s, { context: over, kind: 'safe-to-spend', reward: 1 });
  for (let i = 0; i < 15; i++) s = banditObserve(s, { context: ok, kind: 'safe-to-spend', reward: 0 });
  assert.ok(armMean(s, { context: over, kind: 'safe-to-spend' }) > 0.8);
  assert.ok(armMean(s, { context: ok, kind: 'safe-to-spend' }) < 0.2);
});

test('Thompson seedato e\' deterministico e in [0,1]', () => {
  const s = initBandit();
  const rng = makeRng(42);
  const a = thompsonScore(s, { context: CTX, kind: 'x', rng });
  assert.ok(a >= 0 && a <= 1);
  // stessa seed -> stessa sequenza
  const r1 = makeRng(7), r2 = makeRng(7);
  assert.equal(thompsonScore(s, { context: CTX, kind: 'x', rng: r1 }),
               thompsonScore(s, { context: CTX, kind: 'x', rng: r2 }));
});

test('Thompson esplora ma converge: con dati forti il braccio buono vince quasi sempre', () => {
  let s = initBandit();
  for (let i = 0; i < 40; i++) s = banditObserve(s, { context: CTX, kind: 'good', reward: 1 });
  for (let i = 0; i < 40; i++) s = banditObserve(s, { context: CTX, kind: 'bad', reward: 0 });
  let goodWins = 0; const N = 200;
  for (let seed = 1; seed <= N; seed++) {
    const rng = makeRng(seed * 2654435761 >>> 0);
    const ranked = rankNudges([{ kind: 'bad' }, { kind: 'good' }], s, { context: CTX, explore: true, rng });
    if (ranked[0].kind === 'good') goodWins++;
  }
  assert.ok(goodWins / N > 0.95, `good vince ${goodWins}/${N}`);
});

test('Thompson e\' equo senza dati: nessun braccio domina (esplorazione uniforme)', () => {
  const s = initBandit();
  let aWins = 0; const N = 400;
  for (let seed = 1; seed <= N; seed++) {
    const rng = makeRng(seed * 40503 >>> 0);
    const ranked = rankNudges([{ kind: 'a' }, { kind: 'b' }], s, { context: CTX, explore: true, rng });
    if (ranked[0].kind === 'a') aWins++;
  }
  const frac = aWins / N;
  assert.ok(frac > 0.4 && frac < 0.6, `atteso ~0.5, avuto ${frac}`);
});

test('phaseOfMonth: confini early/mid/late', () => {
  assert.equal(phaseOfMonth(new Date(2026, 6, 1)), 'early');
  assert.equal(phaseOfMonth(new Date(2026, 6, 10)), 'early');
  assert.equal(phaseOfMonth(new Date(2026, 6, 11)), 'mid');
  assert.equal(phaseOfMonth(new Date(2026, 6, 20)), 'mid');
  assert.equal(phaseOfMonth(new Date(2026, 6, 21)), 'late');
  assert.equal(phaseOfMonth(new Date(2026, 6, 31)), 'late');
});

test('dailySeed: stabile nello stesso giorno, diverso tra giorni', () => {
  const a = dailySeed(new Date(2026, 6, 20, 9, 0));
  const b = dailySeed(new Date(2026, 6, 20, 23, 59));
  const c = dailySeed(new Date(2026, 6, 21, 0, 0));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('settleImpressions: flush a reward 0 dei non-agiti al cambio giorno', () => {
  let s = initBandit();
  const pending = makeImpressions({ dayKey: '2026-07-19', context: CTX, kinds: ['sweep', 'month-end'] });
  pending.acted.push('sweep'); // sweep e' stato toccato ieri, month-end no
  const r = settleImpressions(s, pending, '2026-07-20');
  assert.equal(r.pending, null);
  assert.equal(armMean(r.state, { context: CTX, kind: 'sweep' }), 0.5); // agito: reward gia' dato al tap (altrove), settle non lo tocca -> resta al prior in questo test isolato
  assert.ok(armMean(r.state, { context: CTX, kind: 'month-end' }) < 0.5); // ignorato tutto il giorno -> reward 0
});

test('settleImpressions: no-op nello stesso giorno', () => {
  const s = initBandit();
  const pending = makeImpressions({ dayKey: '2026-07-20', context: CTX, kinds: ['sweep'] });
  const r = settleImpressions(s, pending, '2026-07-20');
  assert.equal(r.pending, pending);
  assert.equal(r.state, s);
});

test('settleImpressions: idempotente su pending null', () => {
  const s = initBandit();
  const r = settleImpressions(s, null, '2026-07-20');
  assert.equal(r.pending, null);
  assert.equal(r.state, s);
});

// Bug reale trovato verificando in browser: renderAnalysis() gira più volte
// nello stesso giorno (init, forecast worker, sync). mergePendingSameDay deve
// PRESERVARE i tap già registrati tra un render e l'altro, non ripartire da acted:[].
test('mergePendingSameDay: nessun pending -> ne crea uno nuovo', () => {
  const p = mergePendingSameDay(null, '2026-07-20', CTX, ['sweep', 'month-end']);
  assert.deepEqual(p, { dayKey: '2026-07-20', context: CTX, kinds: ['sweep', 'month-end'], acted: [] });
});

test('mergePendingSameDay: pending di ieri -> ricreato da zero (non unito)', () => {
  const yesterday = makeImpressions({ dayKey: '2026-07-19', context: CTX, kinds: ['sweep'] });
  const p = mergePendingSameDay(yesterday, '2026-07-20', CTX, ['month-end']);
  assert.equal(p.dayKey, '2026-07-20');
  assert.deepEqual(p.kinds, ['month-end']);
  assert.deepEqual(p.acted, []);
});

test('mergePendingSameDay: stesso giorno -> preserva acted e unisce i kind (fix del bug reale)', () => {
  const today = makeImpressions({ dayKey: '2026-07-20', context: CTX, kinds: ['sweep', 'month-end'] });
  today.acted.push('sweep'); // l'utente ha toccato "sweep" tra un render e l'altro
  // un secondo renderAnalysis() nello stesso giorno propone kind leggermente diversi
  const p = mergePendingSameDay(today, '2026-07-20', CTX, ['month-end', 'price-hike']);
  assert.deepEqual(p.acted, ['sweep']); // NON perso
  assert.deepEqual([...p.kinds].sort(), ['month-end', 'price-hike', 'sweep']); // unione, no duplicati
});
