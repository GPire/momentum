'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchInvoicePayments, cashBasisRevenue, accrualRevenue, ceilingStatusByCash, unpaidExposure,
} from './tax-cash-basis.js';

const fattura = (n, client, imponibile, date) => ({ number: n, year: +date.slice(0, 4), client, imponibile, date, description: 'consulenza' });
const entrata = (date, amount, description, id) => ({ id, type: 'entrata', date, amount, description, category: 'stipendio' });

test('abbina una fattura al suo incasso: nome cliente presente → confidenza alta', () => {
  const invoices = [fattura(1, 'Studio Rossi Srl', 1000, '2026-03-10')];
  const allTx = { '2026-03': [entrata('2026-03-25', 1000, 'bonifico Studio Rossi', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 1);
  assert.equal(m.nonIncassate.length, 0);
  assert.equal(m.incassate[0].confidenza, 'alta');
  assert.equal(m.incassate[0].giorniPerIncassare, 15);
});

test('importo giusto ma nessun nome nella descrizione → abbinata, confidenza MEDIA (mai spacciata per certa)', () => {
  const invoices = [fattura(1, 'Studio Rossi Srl', 1000, '2026-03-10')];
  const allTx = { '2026-03': [entrata('2026-03-25', 1000, 'bonifico ricevuto', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 1);
  assert.equal(m.incassate[0].confidenza, 'media');
});

test('nessun incasso compatibile → fattura NON incassata, mai un abbinamento forzato', () => {
  const invoices = [fattura(1, 'Studio Rossi', 1000, '2026-03-10')];
  const allTx = { '2026-03': [entrata('2026-03-25', 250, 'altro bonifico', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 0);
  assert.equal(m.nonIncassate.length, 1);
});

test('un incasso ARRIVATO PRIMA dell\'emissione non può pagare quella fattura', () => {
  const invoices = [fattura(1, 'Studio Rossi', 1000, '2026-03-10')];
  const allTx = { '2026-02': [entrata('2026-02-20', 1000, 'bonifico Studio Rossi', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.nonIncassate.length, 1, 'un movimento precedente all\'emissione è un\'altra cosa');
});

test('lo stesso incasso non può pagare DUE fatture (nessun doppio conteggio)', () => {
  const invoices = [
    fattura(1, 'Studio Rossi', 1000, '2026-03-01'),
    fattura(2, 'Studio Rossi', 1000, '2026-03-02'),
  ];
  const allTx = { '2026-03': [entrata('2026-03-20', 1000, 'bonifico Studio Rossi', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 1);
  assert.equal(m.nonIncassate.length, 1);
  assert.equal(m.incassate[0].fattura.number, 1, 'la fattura più vecchia si prende l\'incasso');
});

test('piccole differenze (bollo, arrotondamenti) restano abbinate entro la tolleranza', () => {
  const invoices = [fattura(1, 'Studio Rossi', 1000, '2026-03-10')];
  const allTx = { '2026-03': [entrata('2026-03-25', 1002, 'bonifico Studio Rossi', 'a')] }; // +2 € di bollo
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 1);
});

test('una differenza grande NON viene abbinata (non è quella fattura)', () => {
  const invoices = [fattura(1, 'Studio Rossi', 1000, '2026-03-10')];
  const allTx = { '2026-03': [entrata('2026-03-25', 1400, 'bonifico Studio Rossi', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.nonIncassate.length, 1);
});

test('dati assenti o malformati → nessun crash, nessun abbinamento inventato', () => {
  assert.deepEqual(matchInvoicePayments(undefined, undefined).incassate, []);
  assert.deepEqual(matchInvoicePayments([], {}).nonIncassate, []);
  const m = matchInvoicePayments([{ client: 'X', imponibile: 0, date: 'non-una-data' }], { '2026-01': [entrata('2026-01-01', 100, 'x', 'a')] });
  assert.equal(m.incassate.length + m.nonIncassate.length, 0, 'una fattura senza importo o data valida viene ignorata');
});

// ============================================================
// IL PRINCIPIO DI CASSA — quello su cui il forfettario paga davvero
// ============================================================

test('PRINCIPIO DI CASSA: una fattura di dicembre incassata a gennaio conta nell\'anno DOPO', () => {
  const invoices = [fattura(1, 'Studio Rossi', 5000, '2026-12-15')];
  const allTx = { '2027-01': [entrata('2027-01-20', 5000, 'bonifico Studio Rossi', 'a')] };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(cashBasisRevenue(m, 2026), 0, 'nel 2026 non è entrato nulla');
  assert.equal(cashBasisRevenue(m, 2027), 5000, 'conta nel 2027, quando i soldi sono arrivati');
  assert.equal(accrualRevenue(invoices, 2026), 5000, 'per competenza sarebbe stato 2026 — ed è la differenza da spiegare');
});

test('IL CASO CHE VALE TUTTO: fatturato SOPRA il tetto ma incassato SOTTO → NON hai superato', () => {
  const s = ceilingStatusByCash(78000, 90000, 85000);
  assert.equal(s.superato, false);
  assert.equal(s.livello, 'attenzione');
  assert.match(s.messaggio, /conta quello che INCASSI/);
  assert.match(s.messaggio, /Non l'hai superato/);
  assert.equal(s.differenza, 12000);
});

test('incassato oltre il tetto → superato davvero, con l\'avviso di parlarne SUBITO', () => {
  const s = ceilingStatusByCash(88000, 95000, 85000);
  assert.equal(s.superato, true);
  assert.equal(s.livello, 'superato');
  assert.match(s.messaggio, /regime ordinario/);
  assert.match(s.messaggio, /non a dicembre/);
});

test('vicino al tetto (≥80%) → avviso utile con il suggerimento pratico (farsi pagare a gennaio)', () => {
  const s = ceilingStatusByCash(70000, 72000, 85000);
  assert.equal(s.livello, 'vicino');
  assert.equal(s.pct, 82);
  assert.match(s.messaggio, /gennaio/);
});

test('lontano dal tetto → messaggio tranquillo, nessun allarme inutile', () => {
  const s = ceilingStatusByCash(20000, 22000, 85000);
  assert.equal(s.livello, 'ok');
  assert.match(s.messaggio, /Nessun problema/);
});

test('tetto assente o zero → null, mai una percentuale su un tetto inventato', () => {
  assert.equal(ceilingStatusByCash(20000, 20000, 0), null);
  assert.equal(ceilingStatusByCash(20000, 20000, undefined), null);
});

// ============================================================
// CHI NON TI PAGA — il problema numero uno di chi lavora in proprio
// ============================================================

test('nessuna fattura aperta → messaggio positivo, nessun allarme inventato', () => {
  const e = unpaidExposure({ incassate: [], nonIncassate: [] });
  assert.equal(e.totale, 0);
  assert.match(e.messaggio, /tutti in pari/);
});

test('fatture aperte ma recenti → totale dichiarato, nessun allarme di ritardo', () => {
  const now = Date.UTC(2026, 2, 20);
  const invoices = [fattura(1, 'Studio Rossi', 1000, '2026-03-15')];
  const m = matchInvoicePayments(invoices, {});
  const e = unpaidExposure(m, { now });
  assert.equal(e.totale, 1000);
  assert.equal(e.inRitardo, 0);
  assert.match(e.messaggio, /ancora nei tempi/);
});

test('fattura vecchia non pagata → segnalata con nome e giorni di ritardo', () => {
  const now = Date.UTC(2026, 5, 20);
  const invoices = [
    fattura(1, 'Studio Rossi', 1000, '2026-03-01'),
    fattura(2, 'Bianchi Srl', 500, '2026-06-15'),
  ];
  const m = matchInvoicePayments(invoices, {});
  const e = unpaidExposure(m, { now });
  assert.equal(e.totale, 1500);
  assert.equal(e.inRitardo, 1, 'solo quella di marzo è in ritardo');
  assert.equal(e.piuVecchia.fattura.client, 'Studio Rossi');
  assert.match(e.messaggio, /Studio Rossi/);
  assert.match(e.messaggio, /giorni/);
});

// ============================================================
// SCENARIO COMPLETO: un anno vero di un forfettario
// ============================================================

test('SCENARIO: forfettario che sfiora il tetto — fatturato 92k, incassato 79k, due clienti in ritardo', () => {
  const invoices = [
    fattura(1, 'Alfa Spa', 30000, '2026-02-10'),
    fattura(2, 'Beta Srl', 25000, '2026-04-10'),
    fattura(3, 'Gamma Snc', 24000, '2026-06-10'),
    fattura(4, 'Delta Srl', 13000, '2026-11-10'), // non ancora pagata
  ];
  const allTx = {
    '2026-03': [entrata('2026-03-05', 30000, 'bonifico Alfa', 'a')],
    '2026-05': [entrata('2026-05-05', 25000, 'bonifico Beta', 'b')],
    '2026-07': [entrata('2026-07-05', 24000, 'bonifico Gamma', 'c')],
  };
  const m = matchInvoicePayments(invoices, allTx);
  assert.equal(m.incassate.length, 3);
  assert.equal(m.nonIncassate.length, 1);

  const incassato = cashBasisRevenue(m, 2026);
  const fatturato = accrualRevenue(invoices, 2026);
  assert.equal(incassato, 79000);
  assert.equal(fatturato, 92000);

  // Il punto: fatturato sopra il tetto, incassato sotto → NON superato.
  const s = ceilingStatusByCash(incassato, fatturato, 85000);
  assert.equal(s.superato, false);
  assert.equal(s.livello, 'attenzione');
  // ...ma se Delta paga entro dicembre, il tetto salta: va detto adesso.
  assert.match(s.messaggio, /se i .* che ti devono arrivano entro dicembre/);

  const e = unpaidExposure(m, { now: Date.UTC(2026, 11, 20) });
  assert.equal(e.totale, 13000);
  assert.match(e.messaggio, /Delta/);
});
