'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildItalianTaxPosition } from './tax-position.js';
import { projectAnnualTax } from './tax.js';

const invoice = (number, client, imponibile, date) => ({
  number, year: Number(date.slice(0, 4)), client, imponibile, date, description: 'consulenza',
});
const payment = (id, date, amount, description) => ({ id, type: 'entrata', date, amount, description });

test('posizione IT: separa fatturato e incassato e usa gli incassi abbinati per la stima forfettaria', () => {
  const result = buildItalianTaxPosition({
    invoices: [invoice(1, 'Studio Rossi', 1000, '2026-02-10')],
    transactions: { '2026-03': [payment('p1', '2026-03-05', 1000, 'bonifico Studio Rossi')] },
    regime: 'forfettario',
    ateco: 'professionisti',
    forfettarioAnswers: { residente: true },
    now: new Date('2026-03-31T12:00:00Z'),
  });

  assert.equal(result.countryCode, 'IT');
  assert.equal(result.cashBasis.fatturato, 1000);
  assert.equal(result.cashBasis.incassato, 1000);
  assert.equal(result.matching.matched, 1);
  assert.equal(result.estimate.basis, 'incassi-abbinati-alle-fatture');
  assert.equal(result.estimate.period.incassato, 1000);
  assert.ok(result.estimate.projection.estimatedAnnualTax > 0);
  assert.equal(result.inputs.atecoInfo.coeff, 0.78);
  assert.equal(result.rules.appliedYear, 2026);
});

test('posizione IT: un incasso di una fattura dell’anno precedente conta nella cassa dell’anno corrente', () => {
  const result = buildItalianTaxPosition({
    invoices: [invoice(8, 'Cliente storico', 2400, '2025-12-20')],
    transactions: { '2026-01': [payment('p8', '2026-01-10', 2400, 'bonifico Cliente storico')] },
    regime: 'forfettario',
    now: new Date('2026-02-01T12:00:00Z'),
  });

  assert.equal(result.cashBasis.fatturato, 0);
  assert.equal(result.cashBasis.incassato, 2400);
  assert.equal(result.matching.matched, 1);
  assert.equal(result.estimate.basis, 'incassi-abbinati-alle-fatture');
  assert.ok(result.estimate.projection.annualizedRevenue >= 14000);
});

test('posizione IT: tetto misurato sugli incassi e fatture aperte restano visibili', () => {
  const result = buildItalianTaxPosition({
    invoices: [
      invoice(1, 'Alfa', 70000, '2026-01-10'),
      invoice(2, 'Beta', 20000, '2026-02-10'),
    ],
    transactions: { '2026-02': [payment('pa', '2026-01-20', 70000, 'bonifico Alfa')] },
    regime: 'forfettario',
    ateco: 'professionisti',
    forfettarioAnswers: { residente: true },
    now: new Date('2026-03-01T12:00:00Z'),
  });

  assert.equal(result.cashBasis.fatturato, 90000);
  assert.equal(result.cashBasis.incassato, 70000);
  assert.equal(result.cashBasis.ceiling.livello, 'attenzione');
  assert.equal(result.matching.unmatchedCurrentYear, 1);
  assert.equal(result.cashBasis.unpaid.numero, 1);
});

test('posizione IT: nessun regime o dati malformati produce stato esplicito, mai NaN', () => {
  const result = buildItalianTaxPosition({
    transactions: { '2026-01': [
      { type: 'entrata', amount: 'non-numero', date: '2026-01-02', description: 'fattura' },
      { type: 'entrata', amount: 500, date: 'data-rotta', description: 'fattura' },
    ] },
    invoices: [{ number: 1, imponibile: 'rotto', date: '2026-01-01' }],
    now: new Date('2026-01-31T12:00:00Z'),
  });

  assert.equal(result.status, 'needs-regime');
  assert.equal(result.estimate, null);
  assert.ok(result.missingInputs.includes('regime'));
  assert.ok(result.missingInputs.includes('clean_invalid_data'));
  assert.equal(result.classification.invalidCount, 1);
  assert.equal(result.matching.invalidInvoiceCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /NaN/);
});

test('posizione IT: importi numerici arrivati come stringhe vengono normalizzati prima del calcolo', () => {
  const result = buildItalianTaxPosition({
    transactions: { '2026-04': [{ type: 'entrata', amount: '750.50', date: '2026-04-04', taxable: true }] },
    regime: 'forfettario',
    now: new Date('2026-04-30T12:00:00Z'),
  });
  assert.equal(result.estimate.period.incassato, 750.5);
  assert.equal(result.estimate.period.count, 1);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
});

test('posizione IT: le rate collegate alla fattura entrano nella cassa e mostrano il residuo', () => {
  const result = buildItalianTaxPosition({
    invoices: [invoice(3, 'Studio Rate', 1000, '2026-03-10')],
    transactions: { '2026-03': [
      { type: 'entrata', amount: 300, date: '2026-03-25', invoiceNumber: 3, invoiceYear: 2026 },
      { type: 'entrata', amount: 400, date: '2026-04-25', invoiceNumber: 3, invoiceYear: 2026 },
    ] },
    regime: 'forfettario',
    ateco: 'professionisti',
    forfettarioAnswers: { residente: true },
    now: new Date('2026-05-01T12:00:00Z'),
  });

  assert.equal(result.cashBasis.incassato, 700);
  assert.equal(result.matching.matched, 1);
  assert.equal(result.matching.partial, 1);
  assert.equal(result.matching.paymentCount, 2);
  assert.equal(result.cashBasis.unpaid.totale, 300);
  assert.equal(result.estimate.period.incassato, 700);
});

test('posizione IT: vicino al tetto espone il confronto tra regimi già usati dal motore', () => {
  const result = buildItalianTaxPosition({
    transactions: { '2026-01': [{ type: 'entrata', amount: 70000, date: '2026-01-31', description: 'fattura consulenza' }] },
    regime: 'forfettario',
    ateco: 'professionisti',
    forfettarioAnswers: { residente: true },
    now: new Date('2026-01-31T12:00:00Z'),
  });

  assert.ok(result.estimate.comparison, 'il confronto compare solo quando la proiezione supera l’80% del tetto');
  assert.equal(result.estimate.comparison.sogliaAttivazione, 0.8);
  assert.ok(result.estimate.comparison.forfettario.daAccantonare > 0);
  assert.ok(result.estimate.comparison.ordinario.daAccantonare > 0);
  assert.match(result.estimate.comparison.notaKey, /estimate/);
});

test('projectAnnualTax: anno, ATECO/cassa e regole aggiornate arrivano davvero al calcolo', () => {
  const rulesOverride = {
    version: '2027-01',
    rules: {
      2025: {
        forfettarioCeiling: 80000,
        impostaStd: 0.12,
        impostaStartup: 0.04,
        startupAnni: 5,
        inpsGestioneSeparata: 0.2,
      },
    },
  };
  const result = projectAnnualTax(
    [payment('p', '2025-01-31', 1000, 'fattura cliente')],
    { regime: 'forfettario', year: 2025, referenceDate: new Date('2025-01-31T12:00:00Z'), rulesOverride },
  );

  assert.equal(result.year, 2025);
  assert.equal(result.regimeSuggestion.ceiling, 80000);
  assert.equal(result.estimatedAnnualTax, 2770.56);

  const posizione = buildItalianTaxPosition({
    transactions: { '2025-01': [payment('p', '2025-01-31', 1000, 'fattura cliente')] },
    regime: 'forfettario',
    year: 2025,
    referenceDate: new Date('2025-01-31T12:00:00Z'),
    rulesOverride,
  });
  assert.equal(posizione.rules.version, '2027-01', 'la posizione deve mostrare la versione delle regole effettivamente usata');
});
