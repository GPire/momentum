'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaRavvedimento, ravvedimentoPerScadenza, SANZIONE_BASE, TASSO_INTERESSE_LEGALE_2026 } from './ravvedimento.js';

test('calcolaRavvedimento: nessun ritardo -> tutto a zero, totale = importo dovuto', () => {
  const r = calcolaRavvedimento(1000, 0);
  assert.equal(r.sanzioneRidotta, 0);
  assert.equal(r.interessi, 0);
  assert.equal(r.totale, 1000);
  assert.equal(r.fascia, null);
});

test('calcolaRavvedimento: entro 30 giorni -> sanzione 1/10 del 25% = 2,5%, fascia corretta', () => {
  const r = calcolaRavvedimento(1000, 15);
  assert.equal(r.sanzioneRidotta, 25); // 1000 * 0.25 * (1/10)
  assert.equal(r.fascia, 'entro 30 giorni');
  assert.ok(r.interessi > 0);
  assert.equal(r.totale, +(1000 + r.sanzioneRidotta + r.interessi).toFixed(2));
});

test('calcolaRavvedimento: interessi = importo × tasso × giorni / 36500', () => {
  const r = calcolaRavvedimento(10000, 100, { tassoInteresse: 0.016 });
  assert.equal(r.interessi, +(10000 * 0.016 * 100 / 36500).toFixed(2));
});

test('calcolaRavvedimento: le fasce di riduzione crescono col ritardo (sanzione più alta più tardi si ravvede)', () => {
  const entro30 = calcolaRavvedimento(1000, 20);
  const entro90 = calcolaRavvedimento(1000, 60);
  const entro1anno = calcolaRavvedimento(1000, 200);
  const entro2anni = calcolaRavvedimento(1000, 500);
  const oltre2anni = calcolaRavvedimento(1000, 900);
  assert.ok(entro30.sanzioneRidotta < entro90.sanzioneRidotta);
  assert.ok(entro90.sanzioneRidotta < entro1anno.sanzioneRidotta);
  assert.ok(entro1anno.sanzioneRidotta < entro2anni.sanzioneRidotta);
  assert.ok(entro2anni.sanzioneRidotta < oltre2anni.sanzioneRidotta);
});

test('calcolaRavvedimento: mai un ritardo o importo negativo, nessun crash su input strani', () => {
  assert.equal(calcolaRavvedimento(-500, 10).importoDovuto, 0);
  assert.equal(calcolaRavvedimento(1000, -10).giorniRitardo, 0);
  assert.equal(calcolaRavvedimento(NaN, 10).importoDovuto, 0);
  assert.equal(calcolaRavvedimento(1000, NaN).giorniRitardo, 0);
});

test('SANZIONE_BASE e TASSO_INTERESSE_LEGALE_2026: valori verificati', () => {
  assert.equal(SANZIONE_BASE, 0.25);
  assert.equal(TASSO_INTERESSE_LEGALE_2026, 0.016);
});

test('ravvedimentoPerScadenza: scadenza futura -> null, nessun ravvedimento da calcolare', () => {
  const scadenza = { id: 'x', label: 'Test', date: '2099-01-01', importo: 500 };
  assert.equal(ravvedimentoPerScadenza(scadenza, { now: new Date('2026-01-01') }), null);
});

test('ravvedimentoPerScadenza: scadenza passata -> ravvedimento calcolato sui giorni reali di ritardo', () => {
  const scadenza = { id: 'saldo-2026', label: 'Saldo', date: '2026-06-30', importo: 1000 };
  const r = ravvedimentoPerScadenza(scadenza, { now: new Date('2026-07-15') });
  assert.equal(r.ravvedimento.giorniRitardo, 15);
  assert.ok(r.ravvedimento.sanzioneRidotta > 0);
  assert.equal(r.id, 'saldo-2026'); // i campi originali della scadenza restano
});
