import test from 'node:test';
import assert from 'node:assert/strict';
const { rulesForYear, TAX_RULES, TAX_RULES_VERSION } = await import('./tax-rules.js');
const { taxAdvice } = await import('./tax.js');

test('rulesForYear: applica il tetto forfettario dell\'anno giusto', () => {
  assert.equal(rulesForYear(2021).forfettarioCeiling, 65000); // regole pre-2023
  assert.equal(rulesForYear(2023).forfettarioCeiling, 85000); // dal 2023
  assert.equal(rulesForYear(2026).forfettarioCeiling, 85000); // eredita l'ultima nota
});

test('rulesForYear: un anno futuro senza entry eredita l\'ultima regola nota (prudente)', () => {
  const r = rulesForYear(2030);
  assert.equal(r.forfettarioCeiling, 85000);
  assert.equal(r.requestedYear, 2030);
});

test('TAX_RULES_VERSION esiste (tracciabilità aggiornamenti normativi)', () => {
  assert.ok(typeof TAX_RULES_VERSION === 'string' && TAX_RULES_VERSION.length >= 4);
});

test('taxAdvice: avvisa quando si supera il tetto forfettario', () => {
  const { advice } = taxAdvice({ regime: 'forfettario', annualizedRevenue: 95000, year: 2026 });
  assert.ok(advice.some(a => a.priority === 'high' && /superi il tetto/.test(a.text)));
});

test('taxAdvice: avviso all\'80% del tetto (medium)', () => {
  const { advice } = taxAdvice({ regime: 'forfettario', annualizedRevenue: 70000, year: 2026 });
  assert.ok(advice.some(a => a.priority === 'medium' && /del tetto/.test(a.text)));
});

test('taxAdvice: accantonamento INDIETRO → consiglio ad alta priorità', () => {
  const { advice } = taxAdvice({
    regime: 'forfettario', annualizedRevenue: 40000, invoicedYTD: 20000,
    estimatedAnnualTax: 8000, currentSetAside: 1000, year: 2026,
  });
  // dovuto ora ~ 8000 * (20000/40000) = 4000; ne ha 1000 → deve avvisare
  assert.ok(advice.some(a => a.priority === 'high' && /Accantona la differenza/.test(a.text)));
});

test('taxAdvice: accantonamento IN PARI → rinforzo positivo', () => {
  const { advice } = taxAdvice({
    regime: 'forfettario', annualizedRevenue: 40000, invoicedYTD: 20000,
    estimatedAnnualTax: 8000, currentSetAside: 5000, year: 2026,
  });
  assert.ok(advice.some(a => /in pari/.test(a.text)));
});

test('taxAdvice: aliquota startup → ricorda il salto futuro', () => {
  const { advice } = taxAdvice({ regime: 'forfettario_startup', startupYearsLeft: 2, annualizedRevenue: 0, year: 2026 });
  assert.ok(advice.some(a => /startup/.test(a.text) && /2 anni/.test(a.text)));
});

test('taxAdvice: nessun dato rilevante → nessun consiglio inventato', () => {
  const { advice } = taxAdvice({ year: 2026 });
  assert.deepEqual(advice, []);
});

test('taxAdvice: consigli ordinati per priorità (high prima)', () => {
  const { advice } = taxAdvice({
    regime: 'forfettario', annualizedRevenue: 95000, invoicedYTD: 50000,
    estimatedAnnualTax: 20000, currentSetAside: 0, year: 2026,
  });
  for (let i = 1; i < advice.length; i++) {
    const rank = { high: 0, medium: 1, info: 2 };
    assert.ok(rank[advice[i - 1].priority] <= rank[advice[i].priority]);
  }
});
