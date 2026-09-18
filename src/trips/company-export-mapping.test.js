'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOMENTUM_EXPORT_FIELDS, defaultMapping, validateMapping, transactionToExportRecord,
  applyMappingToRecord, buildMappedExportPreview, mappedExportToCsv,
} from './company-export-mapping.js';

const TRIP = { id: 't1', receiptPolicy: { currency: 'EUR' } };
const TX_OK = { id: 'tx1', date: '2026-09-10', tripCategory: 'trasporto', description: 'Taxi aeroporto', amount: 42.5, currency: 'EUR', receiptImage: 'data:image/jpeg;base64,xx' };
const TX_NO_DATE = { id: 'tx2', date: '', tripCategory: 'vitto', description: 'Pranzo', amount: 18 };

test('defaultMapping: date/amount/category richiesti di default, il resto no', () => {
  const m = defaultMapping();
  assert.equal(m.date.required, true);
  assert.equal(m.amount.required, true);
  assert.equal(m.category.required, true);
  assert.equal(m.mealType.required, false);
  for (const f of MOMENTUM_EXPORT_FIELDS) assert.equal(m[f].column, '');
});

test('validateMapping: campo richiesto senza colonna è un errore di configurazione', () => {
  const m = defaultMapping();
  m.date.column = 'Data';
  m.amount.column = ''; // richiesto ma vuoto
  m.category.column = 'Categoria';
  const errors = validateMapping(m);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'amount');
  assert.equal(errors[0].code, 'missing_column');
});

test('validateMapping: due campi sulla stessa colonna sono un errore (l\'ultimo scriverebbe sopra il primo)', () => {
  const m = defaultMapping();
  m.date.column = 'Colonna A';
  m.amount.column = 'Colonna A';
  m.category.column = 'Categoria';
  const errors = validateMapping(m);
  assert.ok(errors.some(e => e.code === 'duplicate_column'));
});

test('validateMapping: mappatura valida non produce errori', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria';
  assert.deepEqual(validateMapping(m), []);
});

test('transactionToExportRecord: contratto piatto con valuta di fallback dalla policy', () => {
  const r = transactionToExportRecord({ id: 'x', date: '2026-09-10', amount: 10 }, TRIP);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.localId, 'x');
  assert.equal(r.provenance, 'momentum-app');
});

test('transactionToExportRecord: nome allegato solo se c\'è un giustificativo', () => {
  assert.equal(transactionToExportRecord(TX_OK, TRIP).attachmentName, 'scontrino-2026-09-10-tx1.jpg');
  assert.equal(transactionToExportRecord({ ...TX_OK, receiptImage: null }, TRIP).attachmentName, null);
});

test('transactionToExportRecord: revisionFlag riflette un conflitto di revisione', () => {
  assert.equal(transactionToExportRecord({ ...TX_OK, tripRevisionConflict: true }, TRIP).revisionFlag, 'conflict');
  assert.equal(transactionToExportRecord(TX_OK, TRIP).revisionFlag, 'clean');
});

test('applyMappingToRecord: campo non mappato è escluso di proposito, mai un errore', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria';
  const record = transactionToExportRecord(TX_OK, TRIP);
  const { row, errors } = applyMappingToRecord(record, m);
  assert.deepEqual(Object.keys(row).sort(), ['Categoria', 'Data', 'Importo']);
  assert.equal(errors.length, 0);
});

test('applyMappingToRecord: campo richiesto vuoto nella riga è un errore per riga', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria';
  const record = transactionToExportRecord(TX_NO_DATE, TRIP);
  const { errors } = applyMappingToRecord(record, m);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'date');
  assert.equal(errors[0].code, 'missing_value');
});

test('buildMappedExportPreview: ogni riga sorgente resta visibile, pronta o con errori — mai sparita', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria';
  const records = [TX_OK, TX_NO_DATE].map(tx => transactionToExportRecord(tx, TRIP));
  const preview = buildMappedExportPreview(records, m);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.readyCount, 1);
  assert.equal(preview.errorCount, 1);
});

test('mappedExportToCsv: solo le righe pronte finiscono nel file, mai un campo obbligatorio mancante spacciato per completo', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria';
  const records = [TX_OK, TX_NO_DATE].map(tx => transactionToExportRecord(tx, TRIP));
  const preview = buildMappedExportPreview(records, m);
  const csv = mappedExportToCsv(preview, m);
  const righe = csv.trim().split('\r\n');
  assert.equal(righe.length, 2); // intestazione + 1 riga pronta
  assert.match(righe[0], /Data,Categoria,Importo/);
  assert.match(righe[1], /42\.5/);
});

test('mappedExportToCsv: torna null se la mappatura stessa non è valida — mai un file parziale silenzioso', () => {
  const m = defaultMapping(); // amount richiesto ma senza colonna
  m.date.column = 'Data';
  const preview = buildMappedExportPreview([transactionToExportRecord(TX_OK, TRIP)], m);
  assert.equal(mappedExportToCsv(preview, m), null);
});

test('mappedExportToCsv: valori con virgola/virgolette/a-capo restano un solo campo CSV valido', () => {
  const m = defaultMapping();
  m.date.column = 'Data'; m.amount.column = 'Importo'; m.category.column = 'Categoria'; m.description.column = 'Descrizione';
  const tx = { ...TX_OK, description: 'Cena, "ottima" location' };
  const preview = buildMappedExportPreview([transactionToExportRecord(tx, TRIP)], m);
  const csv = mappedExportToCsv(preview, m);
  assert.match(csv, /"Cena, ""ottima"" location"/);
});
