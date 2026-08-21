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

// ── Le sei categorie nuove (core/constants.js): casa, bollette, salute,
// istruzione, viaggi, svago. Prima di questo lavoro 'bollette'/'salute'/
// 'casa'/'svago' esistevano solo come regole morte in core/lexicon.js — un
// classificatore che sapeva rispondere ma la cui risposta cadeva sempre nel
// fallback "Altro" perché nessuna categoria con quell'id esisteva davvero.
test('lookup: le sei categorie nuove sono raggiungibili', () => {
  assert.equal(lookupMerchant('PAGAMENTO AFFITTO GENNAIO').category, 'casa');
  assert.equal(lookupMerchant('BOLLETTA ENEL ENERGIA').category, 'bollette');
  assert.equal(lookupMerchant('FARMACIA CENTRALE').category, 'salute');
  assert.equal(lookupMerchant('TASSE UNIVERSITA BOLOGNA').category, 'istruzione');
  assert.equal(lookupMerchant('RYANAIR VOLO ANDATA').category, 'viaggi');
  assert.equal(lookupMerchant('CINEMA MULTISALA').category, 'svago');
});

test('lookup: le chiavi con spazio trailing (es. "tim ") servono solo se c\'è altro dopo', () => {
  // Stesso pattern gia' in uso per 'md ' (spesa): un token "tim" isolato
  // (es. il nome proprio "Tim") non deve far scattare "bollette".
  assert.equal(lookupMerchant('TIM RICARICA FIBRA').category, 'bollette');
  assert.equal(lookupMerchant('bonifico a favore di Tim'), null);
});

test('lookup: eni resta trasporti (carburante) — non e\' stato disambiguato con la bolletta', () => {
  // ENI e' sia un distributore di carburante sia un fornitore di luce/gas.
  // Serve il contesto dell'importo per distinguerli, che qui non c'e':
  // onesto lasciarla dov'era piuttosto che indovinare.
  assert.equal(lookupMerchant('ENI STATION').category, 'trasporti');
});

test('lookup: nessuna categoria nuova ruba una chiave gia\' esistente', () => {
  // 'palestra' resta abbonamenti (abbonamento ricorrente), non e' stata
  // spostata a 'svago' per errore di duplicazione della chiave.
  assert.equal(lookupMerchant('PALESTRA MENSILE').category, 'abbonamenti');
});
