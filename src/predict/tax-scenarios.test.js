// Batteria di SCENARI P.IVA reali (v10): ogni casistica di regime, coefficiente
// ATECO, ritenuta, cassa, IVA, bollo, tetto — con valori calcolati a mano e
// verificati. È la "simulazione di ogni casistica" fatta come validazione
// rigorosa: se un calcolo fiscale è sbagliato, un test qui lo cattura.
import test from 'node:test';
import assert from 'node:assert/strict';
const { taxSetAside, projectAnnualTax, suggestRegime, ATECO_COEFFICIENTI, FORFETTARIO_CEILING } = await import('./tax.js');
const { computeInvoice } = await import('../invoice/invoice-engine.js');

const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `atteso ~${b}, avuto ${a}`);

// ── ACCANTONAMENTO: forfettario per coefficiente ATECO ──
test('scenario forfettario servizi (coeff 78%) su 30.000€', () => {
  const r = taxSetAside(30000, { regime: 'forfettario', overrides: { coeffRedditivita: 0.78 } });
  // reddito 23400; INPS 23400*0.2607=6100.38; imposta (23400-6100.38)*0.15=2594.94
  near(r.setAside, 6100.38 + 2594.94);
});

test('scenario forfettario commercio (coeff 40%) su 30.000€: molta meno tassa', () => {
  const servizi = taxSetAside(30000, { regime: 'forfettario', overrides: { coeffRedditivita: 0.78 } });
  const commercio = taxSetAside(30000, { regime: 'forfettario', overrides: { coeffRedditivita: 0.40 } });
  assert.ok(commercio.setAside < servizi.setAside, 'coeff più basso = meno reddito imponibile = meno tasse');
  // reddito 12000; INPS 3128.40; imposta (12000-3128.40)*0.15=1330.74
  near(commercio.setAside, 3128.40 + 1330.74);
});

test('scenario forfettario startup (imposta 5%) su 30.000€ vs standard 15%', () => {
  const startup = taxSetAside(30000, { regime: 'forfettario_startup' });
  const standard = taxSetAside(30000, { regime: 'forfettario' });
  assert.ok(startup.setAside < standard.setAside);
});

test('tutti i coefficienti ATECO producono un accantonamento coerente e crescente col coeff', () => {
  const coeffs = [...new Set(Object.values(ATECO_COEFFICIENTI).map(a => a.coeff))].sort((a, b) => a - b);
  let prev = -1;
  for (const c of coeffs) {
    const r = taxSetAside(50000, { regime: 'forfettario', overrides: { coeffRedditivita: c } });
    assert.ok(r.setAside > prev, `coeff ${c} deve dare accantonamento crescente`);
    prev = r.setAside;
  }
});

// ── ORDINARIO: IVA + INPS ──
test('scenario ordinario su 50.000€: include IVA e accantona di più del forfettario', () => {
  const ord = taxSetAside(50000, { regime: 'ordinario' });
  const forf = taxSetAside(50000, { regime: 'forfettario' });
  assert.ok(ord.breakdown.some(b => /IVA/.test(b.voce)));
  assert.ok(ord.setAside > forf.setAside);
});

// ── TETTO FORFETTARIO: le casistiche di superamento ──
test('scenario vicino al tetto (80.000€): forfettario ma vicino al limite', () => {
  const r = suggestRegime(80000);
  assert.equal(r.suggested, 'forfettario');
  assert.ok(r.pctOfCeiling >= 90);
});

test('scenario oltre il tetto (90.000€): scatta l\'ordinario', () => {
  const r = suggestRegime(90000);
  assert.equal(r.suggested, 'ordinario');
  assert.equal(r.overCeiling, true);
});

test('scenario esattamente al tetto (85.000€): ancora forfettario', () => {
  const r = suggestRegime(FORFETTARIO_CEILING);
  assert.equal(r.suggested, 'forfettario');
});

// ── PROIEZIONE ANNUALE: casistiche di ritmo ──
test('scenario proiezione: fatturazione costante a inizio anno → annualizzazione corretta', () => {
  const txs = [{ type: 'entrata', amount: 5000, description: 'Fattura cliente A', date: '2026-01-15' }];
  const r = projectAnnualTax(txs, { regime: 'forfettario', referenceDate: new Date(2026, 0, 31) });
  // 1 mese trascorso, 5000 fatturato → ~60.000 annualizzato
  assert.ok(r.annualizedRevenue > 45000 && r.annualizedRevenue < 75000, `annualizzato ${r.annualizedRevenue}`);
});

test('scenario proiezione: fatture che porterebbero oltre il tetto → avviso ordinario', () => {
  const txs = [{ type: 'entrata', amount: 30000, description: 'Fattura maxi cliente', date: '2026-01-15' }];
  const r = projectAnnualTax(txs, { regime: 'forfettario', referenceDate: new Date(2026, 2, 31) });
  // ~30000 in 3 mesi → ~120.000 annualizzato → oltre tetto
  assert.equal(r.regimeSuggestion.overCeiling, true);
});

// ── FATTURA: ogni combinazione ──
test('scenario fattura forfettario piccola (50€): niente bollo, totale = imponibile', () => {
  const r = computeInvoice({ imponibile: 50, regime: 'forfettario' });
  assert.equal(r.totaleFattura, 50);
});

test('scenario fattura forfettario media (500€): bollo 2€', () => {
  const r = computeInvoice({ imponibile: 500, regime: 'forfettario' });
  assert.equal(r.totaleFattura, 502);
});

test('scenario fattura ordinario con ritenuta e cassa (2000€)', () => {
  const r = computeInvoice({ imponibile: 2000, regime: 'ordinario' });
  // cassa 80; IVA 22% su 2080 = 457.60; ritenuta 20% su 2000 = 400
  near(r.cassaImporto, 80);
  near(r.ivaImporto, 457.60);
  near(r.ritenutaImporto, 400);
  near(r.totaleFattura, 2000 + 80 + 457.60);
  near(r.nettoARicevere, 2537.60 - 400);
});

test('scenario fattura ordinario SENZA ritenuta (cliente privato non sostituto)', () => {
  const r = computeInvoice({ imponibile: 2000, regime: 'ordinario', ritenutaPct: 0 });
  assert.equal(r.ritenutaImporto, 0);
  assert.equal(r.nettoARicevere, r.totaleFattura); // niente ritenuta trattenuta
});

test('scenario fattura IVA agevolata 10% + cassa personalizzata 2%', () => {
  const r = computeInvoice({ imponibile: 1000, regime: 'ordinario', ivaPct: 0.10, cassaPct: 0.02, ritenutaPct: 0 });
  near(r.cassaImporto, 20);
  near(r.ivaImporto, 102); // 10% di 1020
  near(r.totaleFattura, 1122);
});

test('scenario fattura importi grandi: nessun errore di arrotondamento a cascata', () => {
  const r = computeInvoice({ imponibile: 123456.78, regime: 'ordinario' });
  // il totale deve essere la somma esatta delle righe (entro 1 cent)
  const sommaRighe = r.righe.reduce((s, x) => s + x.importo, 0);
  near(r.nettoARicevere, sommaRighe, 0.02);
});
