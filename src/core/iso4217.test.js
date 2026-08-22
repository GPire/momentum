import test from 'node:test';
import assert from 'node:assert/strict';
import { VALUTE_ISO4217, SIMBOLO_VALUTA, LOCALE_PER_VALUTA } from './iso4217.js';

test('VALUTE_ISO4217: copertura globale reale, non solo Europa/Nord America (>100 valute)', () => {
  assert.ok(VALUTE_ISO4217.size > 100, `attese oltre 100 valute, trovate ${VALUTE_ISO4217.size}`);
});

test('VALUTE_ISO4217: ogni codice è una stringa di ESATTAMENTE 3 lettere maiuscole (formato ISO 4217)', () => {
  for (const code of VALUTE_ISO4217) {
    assert.match(code, /^[A-Z]{3}$/, `"${code}" non è un codice ISO 4217 valido nel formato`);
  }
});

test('VALUTE_ISO4217: presenti valute di ogni continente abitato (non un elenco euro-centrico)', () => {
  const attese = {
    'Europa': 'EUR', 'Nord America': 'USD', 'Sud America': 'BRL',
    'Africa': 'NGN', 'Asia orientale': 'JPY', 'Asia meridionale': 'INR',
    'Sud-est asiatico': 'IDR', 'Medio Oriente': 'AED', 'Oceania': 'AUD',
  };
  for (const [continente, code] of Object.entries(attese)) {
    assert.ok(VALUTE_ISO4217.has(code), `manca una valuta rappresentativa per ${continente} (${code})`);
  }
});

test('SIMBOLO_VALUTA: ogni simbolo mappa a un codice presente in VALUTE_ISO4217 (nessuna incoerenza fra le due tabelle)', () => {
  for (const [simbolo, code] of Object.entries(SIMBOLO_VALUTA)) {
    assert.ok(VALUTE_ISO4217.has(code), `${simbolo} punta a ${code}, assente da VALUTE_ISO4217`);
  }
});

test('LOCALE_PER_VALUTA: ogni valuta con una locale dedicata è un codice reale presente in VALUTE_ISO4217', () => {
  for (const code of Object.keys(LOCALE_PER_VALUTA)) {
    assert.ok(VALUTE_ISO4217.has(code), `${code} ha una locale ma non è in VALUTE_ISO4217`);
  }
});

test('LOCALE_PER_VALUTA: EUR resta ancorata a it-IT (comportamento di sempre di formatMoney)', () => {
  assert.equal(LOCALE_PER_VALUTA.EUR, 'it-IT');
});
