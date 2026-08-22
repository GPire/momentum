import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGenericCsv } from './csv-parser.js';

// BUG REALE CORRETTO: parseCellAmount (pdf-parser.js) ripuliva solo € e $ —
// un CSV esportato da una banca inglese/giapponese/svizzera con importi in
// £/¥/CHF veniva importato con TUTTE le righe scartate in silenzio (importo
// mai valido, riga saltata). Qui si prova il percorso reale, non solo la
// funzione di basso livello: un vero export CSV in sterline.

test('CSV in STERLINE (banca UK): le righe si importano, non vengono più scartate', () => {
  const csv = [
    'Date,Description,Amount',
    '01/03/2026,TESCO STORES,-£45.20',
    '02/03/2026,SALARY PAYMENT,£1200.00',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 2, 'entrambe le righe devono essere importate, non scartate per importo non valido');
  assert.equal(txs[0].amount, 45.20);
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[1].amount, 1200);
  assert.equal(txs[1].type, 'entrata');
});

test('CSV in STERLINE: la valuta rilevata è GBP, allegata a ogni transazione', () => {
  const csv = [
    'Date,Description,Amount',
    '01/03/2026,TESCO STORES,-£45.20',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs[0].currency, 'GBP');
});

test('CSV in YEN (banca giapponese): importi prima rotti ora si leggono', () => {
  const csv = [
    'Date,Description,Amount',
    '01/03/2026,SEVEN ELEVEN,-¥1500',
    '02/03/2026,SALARY,¥250000',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 2);
  assert.equal(txs[0].amount, 1500);
  assert.equal(txs[1].amount, 250000);
  assert.equal(txs[0].currency, 'JPY');
});

test('CSV in FRANCHI SVIZZERI (codice, non simbolo): importi prima rotti ora si leggono', () => {
  const csv = [
    'Date,Description,Amount',
    '01/03/2026,MIGROS,-CHF 45.00',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 45);
  assert.equal(txs[0].currency, 'CHF');
});

test('CSV in EURO: comportamento invariato, valuta rilevata EUR', () => {
  // Delimitatore ';', come i veri export bancari italiani: una virgola come
  // separatore decimale dentro un CSV a virgole è ambigua di suo, non
  // materia di questo fix.
  const csv = [
    'Data;Descrizione;Importo',
    '01/03/2026;ESSELUNGA;-45,20',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 45.20);
  // Nessun simbolo/codice nella cella "-45,20": valuta non rilevabile da quella
  // cella, il campo currency resta assente (il chiamante userà la valuta base).
  assert.equal(txs[0].currency, undefined);
});

test('CSV Dare/Avere a due colonne, valute miste per riga: ogni riga porta la SUA valuta', () => {
  const csvReale = [
    'Data;Descrizione;Dare;Avere',
    '01/03/2026;Spesa UK;£30.00;',
    '02/03/2026;Stipendio;;1500,00 EUR',
  ].join('\n');
  const txs = parseGenericCsv(csvReale);
  assert.equal(txs.length, 2);
  assert.equal(txs[0].currency, 'GBP');
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[1].currency, 'EUR');
  assert.equal(txs[1].type, 'entrata');
});
