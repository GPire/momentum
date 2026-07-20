import test from 'node:test';
import assert from 'node:assert/strict';
const { drawdownEpisodes, recoveryBaseRates, currentDrawdownContext, monthlySeasonality } = await import('./market-cycles.js');

test('drawdownEpisodes: un calo con recupero completo -> episodio recuperato con mesi corretti', () => {
  // picco a idx0 (100), minimo a idx2 (70, -30%), recupero a idx4 (100)
  const closes = [100, 85, 70, 85, 100];
  const eps = drawdownEpisodes(closes, { minDepthPct: 10 });
  assert.equal(eps.length, 1);
  assert.equal(eps[0].recovered, true);
  assert.equal(eps[0].depthPct, 30);
  assert.equal(eps[0].declineMonths, 2);   // idx0 -> idx2
  assert.equal(eps[0].recoveryMonths, 2);  // idx2 -> idx4
});

test('drawdownEpisodes: calo ancora in corso a fine serie -> recovered false, recoveryMonths null', () => {
  const closes = [100, 90, 75]; // -25%, mai recuperato
  const eps = drawdownEpisodes(closes, { minDepthPct: 10 });
  assert.equal(eps.length, 1);
  assert.equal(eps[0].recovered, false);
  assert.equal(eps[0].recoveryMonths, null);
});

test('drawdownEpisodes: cali sotto la soglia minima non contano', () => {
  const closes = [100, 95, 100, 98, 100]; // max -5%
  assert.deepEqual(drawdownEpisodes(closes, { minDepthPct: 10 }), []);
});

test('recoveryBaseRates: raggruppa per fascia e calcola la mediana solo sui recuperati', () => {
  // due cali -30% (fascia 20-35%): recuperi 2 e 3 mesi -> mediana 2.5
  const closes = [100, 70, 85, 100, 100, 70, 85, 90, 100];
  const r = recoveryBaseRates(closes, { minDepthPct: 10 });
  const band = r.rows.find(x => x.band === '20-35%');
  assert.equal(band.count, 2);
  assert.equal(band.medianRecoveryMonths, 2.5);
});

test('currentDrawdownContext: vicino ai massimi -> inDrawdown false, nessuna stima azzardata', () => {
  const closes = Array.from({ length: 20 }, (_, i) => 100 + i); // sempre crescente, al massimo ora
  const ctx = currentDrawdownContext(closes, { minDepthPct: 10 });
  assert.equal(ctx.inDrawdown, false);
});

test('currentDrawdownContext: in calo con episodi comparabili -> base-rate con caveat esplicito', () => {
  // storia (>=12 punti): due cali -30% recuperati, poi calo -30% in corso alla fine
  const closes = [100, 70, 100, 100, 70, 100, 100, 100, 100, 100, 100, 70];
  const ctx = currentDrawdownContext(closes, { minDepthPct: 10 });
  assert.equal(ctx.inDrawdown, true);
  assert.ok(ctx.depthPct >= 25);
  assert.ok(ctx.comparableEpisodes >= 1);
  assert.ok(/NON una garanzia/.test(ctx.note), 'il caveat sul non-garantito deve essere sempre presente');
});

test('currentDrawdownContext: storico insufficiente -> nota esplicita, nessun numero inventato', () => {
  const ctx = currentDrawdownContext([100, 90], { minDepthPct: 10 });
  assert.equal(ctx.inDrawdown, false);
  assert.ok(/insufficiente/.test(ctx.note));
});

test('monthlySeasonality: rendimento medio per mese di calendario', () => {
  const dates = ['2020-01', '2020-02', '2021-01', '2021-02'];
  const closes = [100, 110, 100, 90]; // feb: +10% e -10% -> media 0
  const s = monthlySeasonality(dates, closes);
  const feb = s.find(x => x.month === 2);
  assert.equal(feb.count, 2);
  assert.ok(Math.abs(feb.avgReturnPct) < 0.01);
  assert.equal(feb.positiveRatePct, 50);
});

test('monthlySeasonality: mese senza dati -> avgReturnPct null, non 0 finto', () => {
  const s = monthlySeasonality(['2020-01', '2020-02'], [100, 110]);
  const mar = s.find(x => x.month === 3);
  assert.equal(mar.avgReturnPct, null);
  assert.equal(mar.count, 0);
});
