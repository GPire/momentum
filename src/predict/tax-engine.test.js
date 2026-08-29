import test from 'node:test';
import assert from 'node:assert/strict';

const { registerTaxModule, getTaxModule, listTaxModules, computeLiabilityIT, computeLiabilityES, computeLiabilityCH, entrateAnnualizzate } = await import('./tax-engine.js');
const { taxSetAsideForPeriod } = await import('./tax.js');
const { retaIrpfPeriodo } = await import('./tax-es.js');
const { computeAvsIndipendente } = await import('./tax-ch.js');

// ── Registro: i 3 moduli esistenti si registrano al carico del file ──
test('i 3 moduli esistenti (IT/CH/ES) sono registrati al carico del modulo', () => {
  const paesi = listTaxModules();
  assert.ok(paesi.includes('IT'));
  assert.ok(paesi.includes('CH'));
  assert.ok(paesi.includes('ES'));
});

test('getTaxModule: ritorna null per un paese mai registrato, mai un errore', () => {
  assert.equal(getTaxModule('FR'), null);
});

test('registerTaxModule: mai sovrascrivere in silenzio un paese già registrato', () => {
  assert.throws(() => registerTaxModule('IT', { computeLiability: () => ({}) }), /già registrato/);
});

test('registerTaxModule: rifiuta un modulo senza computeLiability', () => {
  assert.throws(() => registerTaxModule('XX', {}), /computeLiability/);
});

// ── Adattatori: devono essere involucri PURI — stessi numeri della
// funzione reale sottostante, mai una seconda formula. ──
test('computeLiabilityIT: incassato/count coincidono ESATTAMENTE con taxSetAsideForPeriod (stesso input)', () => {
  const transactions = [
    { type: 'entrata', amount: 1200, description: 'fattura cliente Rossi' },
    { type: 'entrata', amount: 800, description: 'fattura cliente Bianchi' },
  ];
  const diretto = taxSetAsideForPeriod(transactions);
  const via = computeLiabilityIT(transactions);
  assert.equal(via.incassato, diretto.incassato);
  assert.equal(via.count, diretto.count);
  assert.equal(via.daAccantonare, diretto.daAccantonare);
  assert.equal(via.disponibileReale, diretto.disponibileReale);
  assert.equal(via.note, diretto.note);
  assert.deepEqual(via.dettaglio, diretto, 'dettaglio deve essere l\'oggetto originale intatto, non un sottoinsieme');
});

test('computeLiabilityES: coincide esattamente con retaIrpfPeriodo sullo stesso input', () => {
  const transactions = [{ type: 'entrata', amount: 2000, description: 'factura cliente' }];
  const diretto = retaIrpfPeriodo(transactions);
  const via = computeLiabilityES(transactions);
  assert.equal(via.incassato, diretto.incassato);
  assert.equal(via.count, diretto.count);
  assert.equal(via.disponibileReale, diretto.disponibleReal);
  assert.deepEqual(via.dettaglio, diretto);
});

test('computeLiabilityCH: annualizza le entrate del periodo e chiama computeAvsIndipendente sul valore derivato — mai una formula AVS reinventata', () => {
  const transactions = [
    { type: 'entrata', amount: 6000 },  // annualizzato: 72.000 CHF, sopra soglia piena (60.500)
    { type: 'uscita', amount: 500 },    // non deve contare: solo 'entrata'
  ];
  const { annualizzato } = entrateAnnualizzate(transactions);
  const avsAtteso = computeAvsIndipendente(annualizzato);
  const via = computeLiabilityCH(transactions);
  assert.equal(via.incassato, 6000);
  assert.equal(via.daAccantonare, +(avsAtteso.contributo / 12).toFixed(2));
  assert.deepEqual(via.dettaglio, avsAtteso, 'il dettaglio deve essere esattamente l\'output di computeAvsIndipendente, invariato');
});

test('computeLiabilityCH: sotto la soglia degressiva, contributo è null — l\'adattatore NON lo trasforma mai in zero silenzioso', () => {
  const transactions = [{ type: 'entrata', amount: 2000 }]; // annualizzato 24.000, sotto soglia 60.500
  const via = computeLiabilityCH(transactions);
  assert.equal(via.daAccantonare, null, 'mai uno zero inventato dove computeAvsIndipendente dichiara onestamente "non lo stimiamo"');
  assert.equal(via.disponibileReale, null);
  assert.ok(via.note.includes('ahv-iv.ch'), 'la nota onesta di tax-ch.js deve propagarsi, non sparire nell\'adattamento');
});

test('entrateAnnualizzate: somma solo le transazioni "entrata", ignora le uscite', () => {
  const r = entrateAnnualizzate([
    { type: 'entrata', amount: 1000 },
    { type: 'uscita', amount: 5000 },
    { type: 'entrata', amount: 500 },
  ]);
  assert.equal(r.totale, 1500);
  assert.equal(r.count, 2);
  assert.equal(r.annualizzato, 18000);
});

test('entrateAnnualizzate: lista vuota o assente non fa crashare', () => {
  assert.deepEqual(entrateAnnualizzate([]), { totale: 0, count: 0, annualizzato: 0 });
  assert.deepEqual(entrateAnnualizzate(undefined), { totale: 0, count: 0, annualizzato: 0 });
});

// ── Uso realistico del registro: un consumatore generico che non conosce
// la forma specifica di ogni paese, solo l'interfaccia comune. ──
test('uso realistico: un chiamante generico può calcolare la liability per qualunque paese registrato senza conoscerne la forma specifica', () => {
  const transactions = [{ type: 'entrata', amount: 1000, description: 'fattura' }];
  for (const paese of ['IT', 'CH', 'ES']) {
    const modulo = getTaxModule(paese);
    assert.ok(modulo, `modulo ${paese} deve essere registrato`);
    const r = modulo.computeLiability(transactions);
    assert.equal(r.countryCode, paese);
    assert.ok('incassato' in r && 'daAccantonare' in r && 'disponibileReale' in r && 'note' in r && 'dettaglio' in r, `${paese}: forma comune rispettata`);
  }
});

test('regimeOptions: Italia espone i regimi reali esistenti (REGIMI), CH/ES dichiarano onestamente di non averne (obbligatori, non una scelta)', () => {
  const it = getTaxModule('IT');
  assert.ok(it.regimeOptions.includes('forfettario'));
  assert.ok(it.regimeOptions.includes('ordinario'));
  assert.deepEqual(getTaxModule('CH').regimeOptions, []);
  assert.deepEqual(getTaxModule('ES').regimeOptions, []);
});
