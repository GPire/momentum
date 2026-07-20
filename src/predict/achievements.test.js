import test from 'node:test';
import assert from 'node:assert/strict';
const { ACHIEVEMENTS, computeStats, evaluateAchievements, nextMilestone } = await import('./achievements.js');

function stateWith({ tx = [], budget = 0, engagement = {}, goals = [] } = {}) {
  const transactions = {};
  for (const t of tx) { const mk = t.date.slice(0, 7); (transactions[mk] = transactions[mk] || []).push(t); }
  return { transactions, monthlyBudget: budget, engagement, savingsGoals: goals };
}

test('computeStats: conta transazioni, risparmi e mesi tracciati', () => {
  const s = computeStats(stateWith({ tx: [
    { date: '2026-05-01', amount: 100, type: 'uscita' },
    { date: '2026-06-01', amount: 200, type: 'invest' },
  ] }), new Date(2026, 6, 15));
  assert.equal(s.txCount, 2);
  assert.equal(s.totalSaved, 200);
  assert.equal(s.monthsTracked, 2);
});

test('computeStats: mese CORRENTE parziale escluso da monthsUnderBudget', () => {
  const s = computeStats(stateWith({
    budget: 1000,
    tx: [{ date: '2026-07-02', amount: 50, type: 'uscita' }], // luglio = mese corrente
  }), new Date(2026, 6, 15));
  assert.equal(s.monthsUnderBudget, 0, 'il mese in corso non conta (parziale)');
});

test('computeStats: mese PASSATO sotto budget conta', () => {
  const s = computeStats(stateWith({
    budget: 1000,
    tx: [{ date: '2026-05-10', amount: 800, type: 'uscita' }],
  }), new Date(2026, 6, 15));
  assert.equal(s.monthsUnderBudget, 1);
});

test('evaluateAchievements: sblocca primo passo alla prima transazione', () => {
  const stats = computeStats(stateWith({ tx: [{ date: '2026-07-01', amount: 10, type: 'uscita' }] }), new Date(2026, 6, 15));
  const r = evaluateAchievements({}, stats, new Date(2026, 6, 15));
  assert.ok(r.newly.includes('first-step'));
  assert.ok(r.unlocked['first-step']);
});

test('evaluateAchievements: idempotente — al secondo giro newly è vuoto', () => {
  const stats = computeStats(stateWith({ tx: [{ date: '2026-07-01', amount: 10, type: 'uscita' }] }), new Date(2026, 6, 15));
  const r1 = evaluateAchievements({}, stats);
  const r2 = evaluateAchievements(r1.unlocked, stats);
  assert.deepEqual(r2.newly, []);
  assert.equal(r2.unlocked['first-step'], r1.unlocked['first-step']); // data invariata
});

test('evaluateAchievements: streak sblocca le soglie raggiunte', () => {
  const stats = computeStats(stateWith({ engagement: { bestStreak: 8 } }), new Date());
  const r = evaluateAchievements({}, stats);
  assert.ok(r.newly.includes('streak-3'));
  assert.ok(r.newly.includes('streak-7'));
  assert.ok(!r.newly.includes('streak-30'));
});

test('evaluateAchievements: nessun traguardo regalato a vault vuoto', () => {
  const stats = computeStats(stateWith({}), new Date());
  const r = evaluateAchievements({}, stats);
  assert.deepEqual(r.newly, []);
});

test('nextMilestone: mostra il progressivo più vicino con progress corretto', () => {
  const stats = computeStats(stateWith({ engagement: { bestStreak: 5 } }), new Date());
  const r = evaluateAchievements({}, stats);
  const nm = nextMilestone(r.unlocked, stats); // streak-3/7 sbloccati a 5? no: 5>=3 sì, 5>=7 no
  // streak-3 sbloccato (5>=3), streak-7 no -> next dovrebbe puntare a streak-7 (5/7) tra i progressivi
  assert.ok(nm);
  assert.equal(nm.id, 'streak-7');
  assert.equal(nm.current, 5);
  assert.equal(nm.target, 7);
});

test('nextMilestone: null se non ci sono progressivi in corso', () => {
  // tutti i progressivi già sbloccati con numeri altissimi
  const stats = { txCount: 1000, bestStreak: 200, monthsTracked: 10, totalSaved: 1, monthsUnderBudget: 1, goalsDone: 1, streak: 200 };
  const r = evaluateAchievements({}, stats);
  assert.equal(nextMilestone(r.unlocked, stats), null);
});
