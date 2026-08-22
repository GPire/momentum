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

// ── Starling Bank (UK): formato CSV verificato con fonte reale (GitHub
// mafonso/starling2freeagent, deadsimpleaccounting.co.uk) — "Amount (GBP)"
// firmato in un'unica colonna, PIÙ una variante PDF a "Money In"/"Money Out"
// separate (accounter.co.za). ──────────────────────────────────────────

test('Starling Bank: formato verificato "Amount (GBP)" con segno, colonna unica', () => {
  const csv = [
    'Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP)',
    '01/03/2026,TESCO STORES,Card payment,FASTER PAYMENT,-45.20,1200.00',
    '02/03/2026,ACME LTD,Salary,FASTER PAYMENT,1500.00,2700.00',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 2);
  assert.equal(txs[0].amount, 45.20);
  assert.equal(txs[0].type, 'uscita');
  assert.equal(txs[1].amount, 1500);
  assert.equal(txs[1].type, 'entrata');
});

test('BUG REALE CORRETTO — "Money In"/"Money Out" (variante PDF Starling): il verso non deve dipendere dalla POSIZIONE delle colonne', () => {
  // Prima di questo fix: nessuna delle due intestazioni matchava i pattern
  // debito/credito, e l'euristica di riserva assegnava "debito" alla colonna
  // più a sinistra per POSIZIONE — qui "Money In" precede "Money Out",
  // quindi un'entrata (Money In) veniva scambiata per un'uscita e viceversa.
  const csv = [
    'Date,Description,Money In,Money Out,Balance',
    '01/03/2026,TESCO STORES,,45.20,1200.00',
    '02/03/2026,SALARY ACME LTD,1500.00,,2700.00',
  ].join('\n');
  const txs = parseGenericCsv(csv);
  assert.equal(txs.length, 2);
  assert.equal(txs[0].type, 'uscita', 'importo in "Money Out" -> uscita, non entrata');
  assert.equal(txs[0].amount, 45.20);
  assert.equal(txs[1].type, 'entrata', 'importo in "Money In" -> entrata, non uscita');
  assert.equal(txs[1].amount, 1500);
});
