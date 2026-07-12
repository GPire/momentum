import test from 'node:test';
import assert from 'node:assert/strict';
const { taxSetAside, taxSetAsideForPeriod, REGIMI } = await import('./tax.js');

test('forfettario: scomposizione INPS + imposta, netto coerente', () => {
  const r = taxSetAside(1000, { regime: 'forfettario' });
  // imponibile=1000, reddito=780, inps=780*0.2607=203.35, imposta=(780-203.35)*0.15=86.50
  assert.ok(Math.abs(r.setAside - (203.35 + 86.50)) < 1, `setAside ${r.setAside}`);
  assert.equal(r.net, +(1000 - r.setAside).toFixed(2));
  assert.ok(r.breakdown.length === 2); // no IVA nel forfettario
  assert.ok(r.effectiveRate > 20 && r.effectiveRate < 40);
});

test('forfettario startup: imposta 5% → accantonamento minore', () => {
  const full = taxSetAside(1000, { regime: 'forfettario' });
  const startup = taxSetAside(1000, { regime: 'forfettario_startup' });
  assert.ok(startup.setAside < full.setAside);
});

test('ordinario: include IVA da versare', () => {
  const r = taxSetAside(1000, { regime: 'ordinario' });
  assert.ok(r.breakdown.some(b => /IVA/.test(b.voce)));
  assert.ok(r.setAside > taxSetAside(1000, { regime: 'forfettario' }).setAside);
});

test('importo zero → nessun accantonamento, mai NaN', () => {
  const r = taxSetAside(0);
  assert.equal(r.setAside, 0);
  assert.equal(r.net, 0);
});

test('periodo: somma solo le entrate, calcola disponibile reale', () => {
  const txs = [
    { type: 'entrata', amount: 2000 },
    { type: 'entrata', amount: 1000 },
    { type: 'uscita', amount: 500 },
  ];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  assert.equal(r.incassato, 3000);
  assert.equal(r.count, 2);
  assert.ok(r.daAccantonare > 0 && r.daAccantonare < 3000);
  assert.equal(r.disponibileReale, +(3000 - r.daAccantonare).toFixed(2));
});

test('overrides: aliquote personalizzabili dall\'utente', () => {
  const r = taxSetAside(1000, { regime: 'forfettario', overrides: { impostaSostitutiva: 0.05 } });
  const base = taxSetAside(1000, { regime: 'forfettario' });
  assert.ok(r.setAside < base.setAside);
});
