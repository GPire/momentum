import test from 'node:test';
import assert from 'node:assert/strict';

const tr = await import('./portfolio-tail-risk.js');

const pos = (ticker, quantity, avgPrice = 100, assetClass = 'stock') => ({ ticker, quantity, avgPrice, assetClass });

test('mappaPortafoglio: ETF settoriale → mappatura esatta, copertura piena', () => {
  const m = tr.mappaPortafoglio([pos('XLK', 10)]);
  assert.equal(m.pesi.XLK, 1);
  assert.equal(m.copertura, 1);
  assert.equal(m.nonCoperti.length, 0);
  assert.equal(m.sufficiente, true);
});

test('mappaPortafoglio: indice ampio → spalmato in parti uguali sui nove settori', () => {
  const m = tr.mappaPortafoglio([pos('SPY', 10)]);
  for (const s of tr.SETTORI) assert.ok(Math.abs(m.pesi[s] - 1 / 9) < 1e-5);
  assert.equal(m.copertura, 1);
});

test('mappaPortafoglio: QQQ NON è trattato come indice ampio (sbilanciato sulla tecnologia)', () => {
  const m = tr.mappaPortafoglio([pos('QQQ', 10, 100, 'etf')]);
  assert.equal(m.copertura, 0);
  assert.equal(m.nonCoperti[0].ticker, 'QQQ');
});

test('mappaPortafoglio: cripto e obbligazioni restano FUORI e vengono dichiarate, mai spacciate per azioni', () => {
  const m = tr.mappaPortafoglio([pos('XLK', 10), pos('BTC', 1, 50000, 'crypto')]);
  assert.equal(m.nonCoperti.length, 1);
  assert.equal(m.nonCoperti[0].ticker, 'BTC');
  assert.match(m.nonCoperti[0].motivo, /cripto/);
  assert.ok(m.copertura < 0.05); // 1000 su 51000
});

test('mappaPortafoglio: sotto la copertura minima → sufficiente=false (meglio tacere che misurare un terzo)', () => {
  const m = tr.mappaPortafoglio([pos('XLK', 1, 100), pos('BTC', 1, 50000, 'crypto')]);
  assert.equal(m.sufficiente, false);
});

test('mappaPortafoglio: settore noto dalla scheda azienda → collocato; sconosciuto → dichiarato', () => {
  const m = tr.mappaPortafoglio([pos('AAPL', 10), pos('XYZ', 10)], { sectorByTicker: { AAPL: 'TECHNOLOGY' } });
  assert.equal(m.pesi.XLK, 1);
  assert.equal(m.nonCoperti.length, 1);
  assert.equal(m.nonCoperti[0].ticker, 'XYZ');
});

test('settoriEquivalenti: tutto su un settore = 1, equipesato sui nove = 9', () => {
  const uno = Object.fromEntries(tr.SETTORI.map((s) => [s, s === 'XLK' ? 1 : 0]));
  const nove = Object.fromEntries(tr.SETTORI.map((s) => [s, 1 / 9]));
  assert.equal(tr.settoriEquivalenti(uno), 1);
  assert.ok(Math.abs(tr.settoriEquivalenti(nove) - 9) < 0.01);
});

test('tailRiskPortafoglio: rifiuta invece di rispondere male quando la copertura è insufficiente', () => {
  const r = tr.tailRiskPortafoglio([pos('BTC', 1, 50000, 'crypto')]);
  assert.equal(r.valutabile, false);
  assert.ok(r.motivo);
  assert.equal(tr.tailRiskText(r), null);
});

test('tailRiskPortafoglio: un settore solo è più fragile dell equipesato sugli STESSI scenari', () => {
  const concentrato = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 400, seed: 7 });
  assert.equal(concentrato.valutabile, true);
  assert.ok(concentrato.es < 0, 'la coda deve essere una perdita');
  // Un solo settore contro nove: deve perdere di più in coda.
  assert.ok(concentrato.es < concentrato.esDiversificato);
  assert.equal(concentrato.piuFragileDelMercato, true);
  assert.equal(concentrato.settoriEquivalenti, 1);
});

test('tailRiskPortafoglio: un portafoglio equipesato NON risulta più fragile di se stesso', () => {
  const equi = tr.tailRiskPortafoglio([pos('SPY', 10)], { percorsi: 400, seed: 7 });
  // Stessi pesi, stessi scenari, stesso seme → stesso ES, differenza nulla.
  assert.ok(Math.abs(equi.costoConcentrazione) < 1e-6);
  assert.equal(equi.piuFragileDelMercato, false);
});

test('tailRiskPortafoglio: deterministico a parità di seme (riproducibile, mai un numero che balla)', () => {
  const a = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 200, seed: 99 });
  const b = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 200, seed: 99 });
  assert.equal(a.es, b.es);
  assert.equal(a.esDiversificato, b.esDiversificato);
});

test('tailRiskPortafoglio: ES è più severo del VaR (è il motivo per cui Basilea III lo ha sostituito)', () => {
  const r = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 400, seed: 11 });
  assert.ok(r.es <= r.var, 'la perdita media oltre la soglia deve essere peggiore della soglia');
  assert.ok(r.quantoIlVarNonVede > 0, 'deve dichiarare quanto il VaR non vede');
});

test('tailRiskPortafoglio: il contributo alla coda indica DOVE, e le quote sommano a 1', () => {
  const r = tr.tailRiskPortafoglio([pos('XLK', 6), pos('XLE', 4)], { percorsi: 400, seed: 5 });
  assert.equal(r.contributi.length, 2);
  const somma = r.contributi.reduce((s, c) => s + c.quotaDellaPerdita, 0);
  assert.ok(Math.abs(somma - 1) < 0.01);
  assert.ok(r.dominante.quotaDellaPerdita >= r.contributi[1].quotaDellaPerdita);
});

test('tailRiskText: dichiara SEMPRE la copertura quando è parziale, mai un rischio spacciato per totale', () => {
  const r = tr.tailRiskPortafoglio([pos('XLK', 10), pos('BTC', 0.02, 50000, 'crypto')], { percorsi: 300, seed: 3 });
  assert.equal(r.valutabile, true);
  const t = tr.tailRiskText(r);
  assert.match(t, /BTC/);
  assert.match(t, /non e' in questo pannello|non è in questo pannello/);
});

test('tailRiskText: non contiene mai un suggerimento di acquisto/vendita', () => {
  const r = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 300, seed: 3 });
  const t = tr.tailRiskText(r);
  assert.doesNotMatch(t, /compra|vendi|dovresti|conviene comprare|ti consiglio/i);
});
