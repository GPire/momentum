import test from 'node:test';
import assert from 'node:assert/strict';
import { stimaCo2Kg, convertiInKm, modoAereoSuggerito, totaleCo2Trasferta, FATTORI_CO2_KG_PER_KM } from './trip-carbon.js';

test('stimaCo2Kg: auto, treno, aereo corto/lungo — ogni modo usa il proprio fattore', () => {
  assert.equal(stimaCo2Kg('auto', 100), 20.8);
  assert.equal(stimaCo2Kg('treno', 100), 4);
  assert.equal(stimaCo2Kg('aereo_corto', 1000), 126);
  assert.equal(stimaCo2Kg('aereo_lungo', 1000), 117);
});

test('stimaCo2Kg: modo sconosciuto (es. autobus, non coperto) o distanza non valida -> null, mai un numero indovinato', () => {
  assert.equal(stimaCo2Kg('autobus', 100), null);
  assert.equal(stimaCo2Kg('auto', 0), null);
  assert.equal(stimaCo2Kg('auto', -5), null);
  assert.equal(stimaCo2Kg('auto', null), null);
});

test('convertiInKm: miglia convertite, km passati invariati', () => {
  assert.equal(convertiInKm(100, 'mi'), 160.93);
  assert.equal(convertiInKm(100, 'km'), 100);
  assert.equal(convertiInKm(0, 'km'), null);
  assert.equal(convertiInKm(-1, 'mi'), null);
});

test('modoAereoSuggerito: soglia 3700km per corto/lungo raggio, come la fonte primaria', () => {
  assert.equal(modoAereoSuggerito(500), 'aereo_corto');
  assert.equal(modoAereoSuggerito(3699), 'aereo_corto');
  assert.equal(modoAereoSuggerito(3700), 'aereo_lungo');
  assert.equal(modoAereoSuggerito(9000), 'aereo_lungo');
});

test('totaleCo2Trasferta: somma le stime già congelate sulle spese, mai un ricalcolo con fattori nuovi', () => {
  const expenses = [
    { tripCategory: 'trasporto', co2: { modo: 'auto', distanzaKm: 100, kg: 20.8 } },
    { tripCategory: 'trasporto', co2: { modo: 'treno', distanzaKm: 200, kg: 8 } },
    { tripCategory: 'vitto', amount: 30 }, // spesa non di trasporto, mai contata
  ];
  const r = totaleCo2Trasferta(expenses);
  assert.equal(r.kg, 28.8);
  assert.equal(r.speseCoperte, 2);
  assert.equal(r.speseTrasportoNonCoperte, 0);
});

test('totaleCo2Trasferta: una spesa di trasporto SENZA stima (es. autobus, taxi in città) viene contata come "non coperta", mai ignorata in silenzio', () => {
  const expenses = [
    { tripCategory: 'trasporto', description: 'Autobus aeroporto' }, // nessuna stima possibile
    { tripCategory: 'trasporto', co2: { modo: 'auto', distanzaKm: 50, kg: 10.4 } },
  ];
  const r = totaleCo2Trasferta(expenses);
  assert.equal(r.kg, 10.4);
  assert.equal(r.speseCoperte, 1);
  assert.equal(r.speseTrasportoNonCoperte, 1);
});

test('totaleCo2Trasferta: nessuna spesa -> zero, mai un crash', () => {
  assert.deepEqual(totaleCo2Trasferta([]), { kg: 0, speseCoperte: 0, speseTrasportoNonCoperte: 0 });
  assert.deepEqual(totaleCo2Trasferta(undefined), { kg: 0, speseCoperte: 0, speseTrasportoNonCoperte: 0 });
});

test('FATTORI_CO2_KG_PER_KM: congelati (Object.freeze), un modulo a valle non può alterarli per errore', () => {
  assert.throws(() => { FATTORI_CO2_KG_PER_KM.auto = 999; }, TypeError);
});
