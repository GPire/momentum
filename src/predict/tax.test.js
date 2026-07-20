import test from 'node:test';
import assert from 'node:assert/strict';
const { taxSetAside, taxSetAsideForPeriod, classifyIncome, REGIMI } = await import('./tax.js');

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

test('periodo: entrate ambigue NON tassate d\'ufficio (default prudente), solo segnalate', () => {
  const txs = [
    { type: 'entrata', amount: 2000 },
    { type: 'entrata', amount: 1000 },
    { type: 'uscita', amount: 500 },
  ];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  assert.equal(r.count, 0);            // nessuna fattura chiara → niente tasse a caso
  assert.equal(r.daAccantonare, 0);
  assert.equal(r.uncertainCount, 2);   // segnalate per conferma
});

test('periodo: modalità cautelativa taxUncertain=true tassa anche le ambigue', () => {
  const txs = [{ type: 'entrata', amount: 1000 }];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario', taxUncertain: true });
  assert.equal(r.count, 1);
  assert.ok(r.daAccantonare > 0);
});

test('classifyIncome: distingue fattura / stipendio / personale / ambigua', () => {
  assert.equal(classifyIncome({ description: 'Fattura n.12 cliente Rossi', type: 'entrata' }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Compenso prestazione consulenza', type: 'entrata' }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Stipendio mensile', category: 'stipendio', type: 'entrata' }).kind, 'salary');
  assert.equal(classifyIncome({ description: 'Rimborso spese viaggio', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Bonifico da Mario', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'accredito', type: 'entrata' }).kind, 'uncertain');
});

test('classifyIncome: flag esplicito taxable ha la precedenza sull\'inferenza', () => {
  assert.equal(classifyIncome({ description: 'Stipendio', taxable: true }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Fattura cliente', taxable: false }).kind, 'personal');
});

test('periodo: lo STIPENDIO non viene tassato come P.IVA (fix "messe a caso")', () => {
  const txs = [
    { type: 'entrata', amount: 3000, description: 'Fattura cliente Rossi' },
    { type: 'entrata', amount: 1500, description: 'Stipendio mensile', category: 'stipendio' },
    { type: 'entrata', amount: 200, description: 'Rimborso benzina' },
  ];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  assert.equal(r.incassato, 3000, 'solo la fattura è imponibile');
  assert.equal(r.count, 1);
  assert.equal(r.excludedCount, 2, 'stipendio + rimborso esclusi');
  assert.equal(r.excludedGross, 1700);
});

test('interessi/dividendi/bonus bancari NON sono fatture P.IVA (fix reale su dati Revolut)', () => {
  assert.equal(classifyIncome({ description: 'Interessi', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Dividendo ASML', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Bonus Revolut', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Personal loan', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Refund Amazon', type: 'entrata' }).kind, 'personal');
});

test('overrides: aliquote personalizzabili dall\'utente', () => {
  const r = taxSetAside(1000, { regime: 'forfettario', overrides: { impostaSostitutiva: 0.05 } });
  const base = taxSetAside(1000, { regime: 'forfettario' });
  assert.ok(r.setAside < base.setAside);
});
