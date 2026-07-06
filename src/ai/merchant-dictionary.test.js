import test from 'node:test';
import assert from 'node:assert/strict';

const { lookupMerchant, normalizeMerchant } = await import('./merchant-dictionary.js');

test('normalizeMerchant: toglie prefissi bancari, code carta, accenti', () => {
  assert.equal(normalizeMerchant('PAGAMENTO POS ESSELUNGA MILANO CARTA *4412'), 'esselunga milano');
  assert.equal(normalizeMerchant('SATISPAY*Caffè'), 'caffe');
});

test('lookup: esercenti noti riconosciuti ad alta confidenza', () => {
  assert.equal(lookupMerchant('esselunga milano').category, 'spesa');
  assert.equal(lookupMerchant('NETFLIX.COM').category, 'abbonamenti');
  assert.equal(lookupMerchant('trenitalia biglietto').category, 'trasporti');
  assert.equal(lookupMerchant('binance acquisto').category, 'crypto');
  assert.ok(lookupMerchant('esselunga').confidence >= 0.9);
});

test('lookup: disambiguazione multi-parola (amazon prime ≠ amazon)', () => {
  assert.equal(lookupMerchant('amazon prime').category, 'abbonamenti');
  assert.equal(lookupMerchant('amazon marketplace ordine').category, 'shopping');
  assert.equal(lookupMerchant('apple music').category, 'abbonamenti');
});

test('lookup: robusto al rumore (esercente concatenato)', () => {
  assert.equal(lookupMerchant('PAGAMENTOPOSESSELUNGAROMA').category, 'spesa');
});

test('lookup: esercente sconosciuto → null (cede al modello ML, non inventa)', () => {
  assert.equal(lookupMerchant('bottega qwerty zzz'), null);
  assert.equal(lookupMerchant(''), null);
});

test('lookup: stipendio riconosciuto da parole-contesto', () => {
  assert.equal(lookupMerchant('ACCREDITO STIPENDIO MESE').category, 'stipendio');
});
