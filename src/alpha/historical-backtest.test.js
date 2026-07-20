import test from 'node:test';
import assert from 'node:assert/strict';
const { computeReturns, walkForwardMomentumBacktest, detectKnownCrashes } = await import('./historical-backtest.js');

test('computeReturns: calcola rendimenti percentuali corretti', () => {
  const r = computeReturns([100, 110, 99]);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1] - (-0.1)) < 1e-9);
});

test('computeReturns: salta coppie con valori non finiti', () => {
  const r = computeReturns([100, NaN, 110]);
  assert.equal(r.length, 0); // nessuna coppia consecutiva entrambe finite
});

test('computeReturns: array vuoto o singolo elemento -> []', () => {
  assert.deepEqual(computeReturns([]), []);
  assert.deepEqual(computeReturns([100]), []);
});

test('walkForwardMomentumBacktest: dati insufficienti -> null, mai un numero inventato', () => {
  assert.equal(walkForwardMomentumBacktest([1, 2, 3]), null);
});

test('walkForwardMomentumBacktest: mai look-ahead — su una serie in trend rialzista pulito produce risultati coerenti', () => {
  const closes = Array.from({ length: 40 }, (_, i) => 100 * Math.pow(1.01, i));
  const r = walkForwardMomentumBacktest(closes, { lookback: 15, periodsPerYear: 12 });
  assert.ok(r);
  assert.ok(r.buyHold.annReturn > 0, 'trend rialzista pulito deve dare rendimento buy-hold positivo');
  assert.ok(r.n > 0);
  assert.ok(r.monthsInMarketPct >= 0 && r.monthsInMarketPct <= 100);
});

test('walkForwardMomentumBacktest: su un crollo puro, il timing riduce l\'esposizione rispetto al buy&hold', () => {
  const closes = Array.from({ length: 40 }, (_, i) => 100 * Math.pow(0.98, i)); // trend ribassista pulito
  const r = walkForwardMomentumBacktest(closes, { lookback: 15, periodsPerYear: 12 });
  assert.ok(r.monthsInMarketPct < 50, 'un trend ribassista pulito deve tenere il timing perlopiù fuori mercato');
});

test('detectKnownCrashes: rileva un drawdown reale sopra soglia', () => {
  const dates = ['2020-01', '2020-02', '2020-03', '2020-04'];
  const closes = [100, 100, 65, 90]; // -35% poi recupero parziale
  const crashes = detectKnownCrashes(dates, closes, { minDrawdownPct: 15 });
  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].year, '2020');
  assert.ok(crashes[0].drawdownPct >= 15);
});

test('detectKnownCrashes: nessun drawdown significativo -> nessun crash rilevato', () => {
  const dates = ['2020-01', '2020-02', '2020-03'];
  const closes = [100, 102, 104];
  assert.deepEqual(detectKnownCrashes(dates, closes), []);
});

test('detectKnownCrashes: due crolli SEPARATI da un recupero -> due voci', () => {
  const dates = ['2000-01', '2000-06', '2000-12', '2008-01', '2008-09', '2009-03'];
  const closes = [100, 70, 100, 100, 65, 40]; // crollo 2000 (-30%), RECUPERO al vecchio picco, crollo 2008-09 (-60%)
  const crashes = detectKnownCrashes(dates, closes, { minDrawdownPct: 15 });
  assert.equal(crashes.length, 2);
  assert.equal(crashes[0].year, '2000');
  assert.equal(crashes[1].year, '2008');
});

test('detectKnownCrashes: un crollo che attraversa il cambio d\'anno resta UN episodio (bug reale trovato)', () => {
  // crisi 2008→2009: nessun recupero tra dicembre e gennaio, drawdown continuo
  const dates = ['2008-01', '2008-09', '2008-12', '2009-03'];
  const closes = [100, 65, 55, 40]; // drawdown crescente ininterrotto, mai un nuovo massimo
  const crashes = detectKnownCrashes(dates, closes, { minDrawdownPct: 15 });
  assert.equal(crashes.length, 1, 'un crollo continuo su due anni solari deve restare UN episodio, non due');
  assert.equal(crashes[0].year, '2008'); // inizia quando supera la soglia
  assert.equal(crashes[0].toDate, '2009-03'); // ma si estende fino alla fine reale dell'episodio
  assert.ok(crashes[0].drawdownPct >= 59); // il minimo (40 da 100) = 60%
});
