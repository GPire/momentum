'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { determinaPeriodicitaIva, computeIvaLiquidazione, upcomingIvaLiquidazioni, previsioneSuperamentoSogliaTrimestrale } from './iva-liquidazione.js';

const fattura = (n, imponibile, date) => ({ number: n, year: +date.slice(0, 4), client: 'X', imponibile, date, description: 'consulenza' });

test('determinaPeriodicitaIva: sotto la soglia -> trimestrale ammesso, sopra -> mensile obbligatorio', () => {
  assert.equal(determinaPeriodicitaIva(200000).periodicita, 'trimestrale');
  assert.equal(determinaPeriodicitaIva(500000).periodicita, 'trimestrale'); // al limite compreso
  assert.equal(determinaPeriodicitaIva(600000).periodicita, 'mensile');
  assert.equal(determinaPeriodicitaIva(0).periodicita, 'trimestrale');
});

test('computeIvaLiquidazione mensile: IVA al 22% sulle fatture del mese, scadenza il 16 del mese dopo', () => {
  const invoices = [fattura(1, 10000, '2026-03-10')];
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile');
  assert.equal(periodi.length, 12);
  const marzo = periodi.find(p => p.mese === 3);
  assert.equal(marzo.ivaDebito, 2200); // 22% di 10000
  assert.equal(marzo.scadenza, '2026-04-16');
  assert.equal(marzo.maggiorazione, 0);
});

test('computeIvaLiquidazione mensile: dicembre scade il 16 gennaio dell\'anno DOPO', () => {
  const invoices = [fattura(1, 1000, '2026-12-15')];
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile');
  const dicembre = periodi.find(p => p.mese === 12);
  assert.equal(dicembre.scadenza, '2027-01-16');
});

test('computeIvaLiquidazione trimestrale: 4 periodi, maggiorazione 1% sui primi 3, mai sul conguaglio', () => {
  const invoices = [fattura(1, 10000, '2026-02-01'), fattura(2, 5000, '2026-11-01')];
  const periodi = computeIvaLiquidazione(invoices, 2026, 'trimestrale');
  assert.equal(periodi.length, 4);
  const t1 = periodi.find(p => p.trimestre === 1);
  assert.equal(t1.ivaDebito, 2200);
  assert.equal(t1.maggiorazione, 22); // 1% di 2200
  assert.equal(t1.totaleDaVersare, 2222);
  assert.equal(t1.scadenza, '2026-05-16');
  const t2 = periodi.find(p => p.trimestre === 2);
  assert.equal(t2.scadenza, '2026-08-20');
  const t3 = periodi.find(p => p.trimestre === 3);
  assert.equal(t3.scadenza, '2026-11-16');
  const t4 = periodi.find(p => p.trimestre === 4);
  assert.equal(t4.ivaDebito, 1100); // 22% di 5000
  assert.equal(t4.maggiorazione, 0, 'il conguaglio annuale non ha la maggiorazione dell\'1%');
  assert.equal(t4.scadenza, '2027-03-16');
});

test('computeIvaLiquidazione: senza acquisti dichiarati, dice onestamente che il dovuto reale potrebbe essere più basso', () => {
  const periodi = computeIvaLiquidazione([fattura(1, 1000, '2026-01-01')], 2026, 'mensile');
  assert.ok(periodi.every(p => /[Nn]essun acquisto/.test(p.ivaCreditoNota)));
});

test('computeIvaLiquidazione: nessuna fattura -> tutti i periodi a zero, mai un crash', () => {
  const periodi = computeIvaLiquidazione([], 2026, 'mensile');
  assert.ok(periodi.every(p => p.totaleDaVersare === 0));
});

test('upcomingIvaLiquidazioni: solo i periodi con qualcosa da versare e non ancora scaduti, ordinati per data', () => {
  const invoices = [fattura(1, 10000, '2026-01-10'), fattura(2, 5000, '2026-06-10')];
  const now = new Date('2026-03-01');
  const up = upcomingIvaLiquidazioni(invoices, 2026, 'mensile', { now });
  assert.ok(up.length >= 1);
  assert.ok(up.every(p => p.totaleDaVersare > 0));
  assert.ok(up.every((p, i) => i === 0 || new Date(p.scadenza) >= new Date(up[i - 1].scadenza)));
});

test('upcomingIvaLiquidazioni: PREDITTIVO — dice quanto mettere via a settimana, non solo il totale dovuto', () => {
  const invoices = [fattura(1, 10000, '2026-06-10')];
  const now = new Date('2026-06-15');
  const up = upcomingIvaLiquidazioni(invoices, 2026, 'mensile', { now });
  const giugno = up.find(p => p.mese === 6);
  assert.ok(giugno.giorniAllaScadenza > 0);
  assert.ok(giugno.daMettereViaASettimana > 0);
  assert.equal(+(giugno.daMettereViaASettimana * Math.round(giugno.giorniAllaScadenza / 7)).toFixed(0), +giugno.totaleDaVersare.toFixed(0));
});

test('previsioneSuperamentoSogliaTrimestrale: ritmo sotto soglia -> nessun avviso', () => {
  const invoices = [fattura(1, 10000, '2026-01-15')];
  const now = new Date('2026-02-01'); // 32 giorni trascorsi, proiezione ~114k
  const p = previsioneSuperamentoSogliaTrimestrale(invoices, 2026, { now });
  assert.equal(p.supera, false);
  assert.equal(p.messaggio, null);
});

test('previsioneSuperamentoSogliaTrimestrale: ritmo che sfonda la soglia -> avviso predittivo chiaro', () => {
  const invoices = [fattura(1, 100000, '2026-01-15')];
  const now = new Date('2026-02-01'); // proiezione ~1.14M, ben sopra 500k
  const p = previsioneSuperamentoSogliaTrimestrale(invoices, 2026, { now });
  assert.equal(p.supera, true);
  assert.match(p.messaggio, /mensile invece che trimestrale/);
});

// ── REGISTRO ACQUISTI: la lacuna dichiarata (IVA a credito) ora colmabile ──
test('computeIvaLiquidazione: senza acquisti dichiarati, nota onesta invariata', () => {
  const periodi = computeIvaLiquidazione([fattura(1, 1000, '2026-01-10')], 2026, 'mensile');
  const gennaio = periodi.find(p => p.mese === 1);
  assert.equal(gennaio.ivaCredito, 0);
  assert.match(gennaio.ivaCreditoNota, /[Nn]essun acquisto/);
  assert.equal(gennaio.ivaDebito, 220); // invariato, nessun credito da sottrarre
});

test('computeIvaLiquidazione: un acquisto con IVA detraibile riduce il dovuto dello stesso periodo', () => {
  const invoices = [fattura(1, 1000, '2026-03-10')]; // IVA debito 220
  const acquisti = [{ data: '2026-03-05', imponibile: 500, aliquotaIva: 0.22, descrizione: 'Materiale' }]; // IVA credito 110
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile', acquisti);
  const marzo = periodi.find(p => p.mese === 3);
  assert.equal(marzo.ivaDebitoLordo, 220);
  assert.equal(marzo.ivaCredito, 110);
  assert.equal(marzo.ivaDebito, 110); // netto = debito - credito
  assert.match(marzo.ivaCreditoNota, /1 acquisto dichiarato/);
});

test('computeIvaLiquidazione: acquisti fuori periodo non influenzano il mese sbagliato', () => {
  const invoices = [fattura(1, 1000, '2026-03-10')];
  const acquisti = [{ data: '2026-04-01', imponibile: 500, aliquotaIva: 0.22 }]; // aprile, non marzo
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile', acquisti);
  const marzo = periodi.find(p => p.mese === 3);
  assert.equal(marzo.ivaCredito, 0);
  assert.equal(marzo.ivaDebito, 220);
});

test('computeIvaLiquidazione: credito maggiore del debito -> netto MAI negativo (credito riportabile onesto)', () => {
  const invoices = [fattura(1, 100, '2026-05-10')]; // IVA debito 22
  const acquisti = [{ data: '2026-05-02', imponibile: 1000, aliquotaIva: 0.22 }]; // IVA credito 220, ben oltre il debito
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile', acquisti);
  const maggio = periodi.find(p => p.mese === 5);
  assert.equal(maggio.ivaDebito, 0); // mai un dovuto negativo
  assert.equal(maggio.totaleDaVersare, 0);
});

test('computeIvaLiquidazione: aliquota diversa dal 22% sull\'acquisto viene rispettata, non forzata', () => {
  const invoices = [fattura(1, 1000, '2026-06-10')];
  const acquisti = [{ data: '2026-06-01', imponibile: 100, aliquotaIva: 0.04 }]; // aliquota 4%, non 22%
  const periodi = computeIvaLiquidazione(invoices, 2026, 'mensile', acquisti);
  const giugno = periodi.find(p => p.mese === 6);
  assert.equal(giugno.ivaCredito, 4); // 100 * 4%, non 100 * 22%
});
