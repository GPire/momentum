'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSwissQrPayload, validateSwissQrData } from './swiss-qr-bill.js';

// ESEMPIO UFFICIALE 1 — estratto letteralmente dalla Tabella 17 delle
// "Swiss Implementation Guidelines for the QR-bill", SIX Group,
// Version 2.3 – 20.11.2023, Annex A (pagine 49-50 del PDF ufficiale).
const ESEMPIO_1 = {
  creditor: {
    iban: 'CH6431961000004421557',
    name: 'Max Muster & Söhne (sample company)',
    street: 'Musterstrasse', buildingNo: '123',
    postalCode: '8000', town: 'Seldwyla', country: 'CH',
  },
  amount: 50.00, currency: 'CHF',
  debtor: {
    name: 'Simon Muster', street: 'Musterstrasse', buildingNo: '1',
    postalCode: '8000', town: 'Seldwyla', country: 'CH',
  },
  referenceType: 'QRR', reference: '000008207791225857421286694',
  unstructuredMessage: 'Payment of travel',
};

const ESEMPIO_1_PAYLOAD_ATTESO = [
  'SPC', '0200', '1',
  'CH6431961000004421557',
  'S', 'Max Muster & Söhne (sample company)', 'Musterstrasse', '123', '8000', 'Seldwyla', 'CH',
  '', '', '', '', '', '', '',
  '50.00', 'CHF',
  'S', 'Simon Muster', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH',
  'QRR', '000008207791225857421286694', 'Payment of travel', 'EPD',
].join('\r\n');

test('buildSwissQrPayload: ESEMPIO UFFICIALE 1 — payload identico riga per riga al documento SIX', () => {
  const r = buildSwissQrPayload(ESEMPIO_1);
  assert.equal(r.ok, true, JSON.stringify(r.errori));
  assert.equal(r.payload, ESEMPIO_1_PAYLOAD_ATTESO);
});

test('buildSwissQrPayload: 31 righe esatte per l\'esempio ufficiale, separate da CR+LF, nessun a capo finale', () => {
  const r = buildSwissQrPayload(ESEMPIO_1);
  const righe = r.payload.split('\r\n');
  assert.equal(righe.length, 31);
  assert.equal(righe[0], 'SPC');
  assert.equal(righe[30], 'EPD');
  assert.ok(!r.payload.endsWith('\r\n'), 'nessun separatore dopo l\'ultimo elemento');
});

test('buildSwissQrPayload: header fisso SPC/0200/1 sempre uguale, mai variabile', () => {
  const r = buildSwissQrPayload(ESEMPIO_1);
  const righe = r.payload.split('\r\n');
  assert.deepEqual(righe.slice(0, 3), ['SPC', '0200', '1']);
});

test('buildSwissQrPayload: il gruppo Ultimo Creditore (UCR) è SEMPRE 7 righe vuote, mai compilato', () => {
  const r = buildSwissQrPayload(ESEMPIO_1);
  const righe = r.payload.split('\r\n');
  assert.deepEqual(righe.slice(11, 18), ['', '', '', '', '', '', '']);
});

test('buildSwissQrPayload: senza debitore -> 7 righe vuote al suo posto, struttura mai accorciata', () => {
  const { debtor, ...senzaDebitore } = ESEMPIO_1;
  const r = buildSwissQrPayload(senzaDebitore);
  const righe = r.payload.split('\r\n');
  assert.equal(righe.length, 31, 'stessa lunghezza: le righe del debitore restano, solo vuote');
  assert.deepEqual(righe.slice(20, 27), ['', '', '', '', '', '', '']);
});

test('buildSwissQrPayload: billing information e procedure alternative si aggiungono SOLO se usate (campi "A")', () => {
  const conBilling = buildSwissQrPayload({ ...ESEMPIO_1, billingInfo: '//S1/10/1234' });
  const righeConBilling = conBilling.payload.split('\r\n');
  assert.equal(righeConBilling.length, 32);
  assert.equal(righeConBilling[31], '//S1/10/1234');

  const senzaBilling = buildSwissQrPayload(ESEMPIO_1);
  assert.equal(senzaBilling.payload.split('\r\n').length, 31, 'senza billing info il payload finisce a EPD, nessuna riga vuota extra');
});

test('validateSwissQrData: IBAN non svizzero/liechtensteinese -> respinto', () => {
  const v = validateSwissQrData({ ...ESEMPIO_1, creditor: { ...ESEMPIO_1.creditor, iban: 'DE89370400440532013000' } });
  assert.equal(v.ok, false);
  assert.ok(v.errori.some((e) => /IBAN/.test(e)));
});

test('validateSwissQrData: valuta diversa da CHF/EUR -> respinta', () => {
  const v = validateSwissQrData({ ...ESEMPIO_1, currency: 'USD' });
  assert.equal(v.ok, false);
});

test('validateSwissQrData: l\'IBAN dell\'esempio ufficiale (IID 31961) è riconosciuto correttamente come QR-IBAN', () => {
  // BUG REALE trovato qui: un controllo precedente riconosceva come
  // QR-IBAN solo un IID che iniziasse per "30", escludendo l'intero
  // intervallo 31000-31999 — l'esempio ufficiale SIX stesso (IID 31961)
  // veniva respinto come "non QR-IBAN" pur essendolo.
  const v = validateSwissQrData(ESEMPIO_1);
  assert.equal(v.ok, true, JSON.stringify(v.errori));
});

test('validateSwissQrData: riferimento QRR con un IBAN NON QR (IID fuori 30000-31999) -> incoerenza intercettata', () => {
  const v = validateSwissQrData({ ...ESEMPIO_1, creditor: { ...ESEMPIO_1.creditor, iban: 'CH9300762011623852957' } }); // IID 00762, non QR-IBAN
  assert.equal(v.ok, false);
  assert.ok(v.errori.some((e) => /QR-IBAN/.test(e)));
});

test('validateSwissQrData: dati completi e coerenti (IBAN normale + riferimento NON) -> valido', () => {
  const v = validateSwissQrData({
    creditor: { iban: 'CH9300762011623852957', name: 'Test', postalCode: '8000', town: 'Zurigo', country: 'CH' }, // IID 00762, non QR-IBAN
    currency: 'CHF', amount: 100, referenceType: 'NON',
  });
  assert.equal(v.ok, true, JSON.stringify(v.errori));
});

test('buildSwissQrPayload: importo assente -> riga vuota, mai un numero inventato', () => {
  const { amount, ...senzaImporto } = ESEMPIO_1;
  const r = buildSwissQrPayload(senzaImporto);
  const righe = r.payload.split('\r\n');
  assert.equal(righe[18], ''); // riga Amount
});

// ESEMPIO UFFICIALE 2 — con billing information e procedura alternativa
// (Tabella 18, pagine 51-52 del PDF ufficiale). Stesso riferimento QRR già
// verificato indipendentemente in swiss-qr-reference.test.js.
const ESEMPIO_2 = {
  creditor: {
    iban: 'CH4431999123000889012',
    name: 'Max Muster & Söhne (sample company)',
    street: 'Musterstrasse', buildingNo: '123',
    postalCode: '8000', town: 'Seldwyla', country: 'CH',
  },
  amount: 1949.75, currency: 'CHF',
  debtor: {
    name: 'Simon Muster', street: 'Musterstrasse', buildingNo: '1',
    postalCode: '8000', town: 'Seldwyla', country: 'CH',
  },
  referenceType: 'QRR', reference: '210000000003139471430009017',
  unstructuredMessage: 'Order from 15.10.2020',
  billingInfo: '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30',
  alternativeProcedures: ['eBill/B/simon.muster@example.com'],
};

test('buildSwissQrPayload: ESEMPIO UFFICIALE 2 — con billing info e procedura alternativa, identico al documento SIX', () => {
  const r = buildSwissQrPayload(ESEMPIO_2);
  assert.equal(r.ok, true, JSON.stringify(r.errori));
  const righe = r.payload.split('\r\n');
  assert.equal(righe.length, 33); // 31 + billing info + 1 procedura alternativa
  assert.equal(righe[18], '1949.75');
  assert.equal(righe[28], '210000000003139471430009017');
  assert.equal(righe[29], 'Order from 15.10.2020');
  assert.equal(righe[31], '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30');
  assert.equal(righe[32], 'eBill/B/simon.muster@example.com');
});

// ESEMPIO UFFICIALE 3 — donazione: nessun importo, nessun debitore, nessun
// riferimento (Tabella 19, pagine 53-54 del PDF ufficiale). Il caso limite
// opposto all'esempio 1: quasi tutto vuoto, ma la struttura a 31 righe resta.
const ESEMPIO_3 = {
  creditor: {
    iban: 'CH5204835012345671000',
    name: 'Muster Stiftung (sample foundation)',
    street: 'P.O. Box', buildingNo: '',
    postalCode: '3001', town: 'Bern', country: 'CH',
  },
  currency: 'CHF',
  referenceType: 'NON',
};

test('buildSwissQrPayload: ESEMPIO UFFICIALE 3 — donazione senza importo, senza debitore, senza riferimento', () => {
  const r = buildSwissQrPayload(ESEMPIO_3);
  assert.equal(r.ok, true, JSON.stringify(r.errori));
  const righe = r.payload.split('\r\n');
  assert.equal(righe.length, 31, 'anche senza quasi nulla, la struttura a righe fisse non si accorcia');
  assert.equal(righe[18], '', 'importo vuoto per una donazione a importo libero');
  assert.equal(righe[27], 'NON');
  assert.equal(righe[28], '');
  assert.equal(righe[30], 'EPD');
});

test('validateSwissQrData: riferimento NON con reference vuoto -> valido (nessun riferimento richiesto)', () => {
  const v = validateSwissQrData(ESEMPIO_3);
  assert.equal(v.ok, true, JSON.stringify(v.errori));
});
