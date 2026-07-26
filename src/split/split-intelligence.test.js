import test from 'node:test';
import assert from 'node:assert/strict';

const { detectRecurring, predictExpenseShape, flagAnomaly, forecastGroupBalances } =
  await import('./split-intelligence.js');
const { createGroup, addSharedExpense, computeBalances } = await import('./split-engine.js');

const DAY = 86_400_000;
// costruttore comodo: gruppo con membri nominati
function g3() { return createGroup({ id: 'g', name: 'casa', members: ['Io', 'Anna', 'Bea'] }); }
const idOf = (grp, name) => grp.members.find(m => m.name === name).id;
// aggiunge una spesa con data esplicita
function addOn(grp, payerName, amount, desc, isoDate) {
  return addSharedExpense(grp, { payer: idOf(grp, payerName), amount, description: desc, date: isoDate });
}

// ── 1. detectRecurring ──────────────────────────────────────────────────────
test('detectRecurring: riconosce una spesa mensile regolare e predice la prossima', () => {
  let g = g3();
  g = addOn(g, 'Io', 800, 'Affitto', '2026-04-01');
  g = addOn(g, 'Io', 800, 'affitto', '2026-05-02');   // maiuscole/minuscole indifferenti
  g = addOn(g, 'Io', 800, 'AFFITTO', '2026-06-01');
  const now = Date.parse('2026-06-05');
  const rec = detectRecurring(g, { now });
  assert.equal(rec.length, 1);
  assert.equal(rec[0].occurrences, 3);
  assert.ok(rec[0].cadenceDays >= 29 && rec[0].cadenceDays <= 31, 'cadenza ~mensile');
  assert.equal(rec[0].typicalAmount, 800);
  assert.ok(rec[0].nextExpectedDate >= '2026-06-30' && rec[0].nextExpectedDate <= '2026-07-02');
});

test('detectRecurring: ignora le spese sporadiche (sotto soglia occorrenze)', () => {
  let g = g3();
  g = addOn(g, 'Io', 40, 'Cena fuori', '2026-04-10');
  g = addOn(g, 'Anna', 55, 'Cena fuori', '2026-05-20');
  assert.equal(detectRecurring(g).length, 0, 'due sole occorrenze: non abbastanza per dire ricorrente');
});

test('detectRecurring: scarta cadenze IRREGOLARI (alta dispersione)', () => {
  let g = g3();
  g = addOn(g, 'Io', 30, 'Spesa varia', '2026-04-01');
  g = addOn(g, 'Io', 30, 'Spesa varia', '2026-04-03');   // +2 giorni
  g = addOn(g, 'Io', 30, 'Spesa varia', '2026-06-15');   // +73 giorni
  assert.equal(detectRecurring(g).length, 0, 'intervalli 2 e 73 giorni: troppo irregolari');
});

// ── 2. predictExpenseShape ───────────────────────────────────────────────────
test('predictExpenseShape: predice il pagatore abituale per una descrizione nota', () => {
  let g = g3();
  g = addOn(g, 'Anna', 800, 'Affitto', '2026-04-01');
  g = addOn(g, 'Anna', 800, 'Affitto', '2026-05-01');
  g = addOn(g, 'Io', 800, 'Affitto', '2026-06-01');
  const p = predictExpenseShape(g, 'Affitto');
  assert.equal(p.payer, idOf(g, 'Anna'), 'Anna paga 2 volte su 3');
  assert.ok(Math.abs(p.payerConfidence - 0.67) < 0.02);
  assert.equal(p.basis, 'descrizione');
  assert.equal(p.typicalAmount, 800);
});

test('predictExpenseShape: senza match sulla descrizione ripiega sullo storico', () => {
  let g = g3();
  g = addOn(g, 'Bea', 20, 'Caffè', '2026-04-01');
  g = addOn(g, 'Bea', 25, 'Benzina', '2026-04-02');
  const p = predictExpenseShape(g, 'Qualcosa di nuovo');
  assert.equal(p.basis, 'storico');
  assert.equal(p.payer, idOf(g, 'Bea'));
});

test('predictExpenseShape: tace se non ci sono abbastanza esempi', () => {
  const g = g3();
  assert.equal(predictExpenseShape(g, 'Affitto'), null);
});

// ── 3. flagAnomaly ────────────────────────────────────────────────────────────
test('flagAnomaly: una bolletta molto più alta del solito è segnalata', () => {
  let g = g3();
  for (const d of ['01', '02', '03', '04', '05']) g = addOn(g, 'Io', 60, 'Bolletta luce', `2026-0${d}-01`.replace('0', ''));
  const r = flagAnomaly(g, { description: 'Bolletta luce', amount: 210 });
  assert.equal(r.isAnomaly, true);
  assert.equal(r.direction, 'sopra');
  assert.equal(r.median, 60);
});

test('flagAnomaly: un importo nella norma NON è segnalato', () => {
  let g = g3();
  for (let i = 0; i < 5; i++) g = addOn(g, 'Io', 60 + i, 'Bolletta luce', `2026-0${i + 1}-01`);
  const r = flagAnomaly(g, { description: 'Bolletta luce', amount: 63 });
  assert.equal(r.isAnomaly, false);
});

test('flagAnomaly: tace senza storico sufficiente (nessun allarme inventato)', () => {
  let g = g3();
  g = addOn(g, 'Io', 60, 'Bolletta luce', '2026-04-01');
  const r = flagAnomaly(g, { description: 'Bolletta luce', amount: 500 });
  assert.equal(r.isAnomaly, false);
  assert.match(r.reason, /insufficiente/);
});

// ── 4. forecastGroupBalances ─────────────────────────────────────────────────
test('forecastGroupBalances: proietta i saldi includendo la ricorrente in arrivo', () => {
  let g = g3();
  // affitto mensile pagato da Io: nello storico crea credito verso gli altri
  g = addOn(g, 'Io', 900, 'Affitto', '2026-04-01');
  g = addOn(g, 'Io', 900, 'Affitto', '2026-05-01');
  g = addOn(g, 'Io', 900, 'Affitto', '2026-06-01');
  const now = Date.parse('2026-06-10');
  const f = forecastGroupBalances(g, computeBalances, { horizonDays: 30, now });
  assert.ok(f.upcoming.length >= 1, 'la prossima rata di affitto cade entro 30 giorni');
  assert.equal(f.upcoming[0].amount, 900);
  // Io paga: il suo saldo proiettato deve migliorare (più credito) rispetto ad ora
  const me = idOf(g, 'Io');
  assert.ok(f.projected[me] > f.current[me], 'chi paga la ricorrente aumenta il proprio credito proiettato');
});

test('forecastGroupBalances: senza ricorrenti i saldi proiettati = correnti', () => {
  let g = g3();
  g = addOn(g, 'Io', 40, 'Cena', '2026-06-01');
  const f = forecastGroupBalances(g, computeBalances, { horizonDays: 30, now: Date.parse('2026-06-10') });
  assert.equal(f.upcoming.length, 0);
  assert.deepEqual(f.projected, f.current);
});
