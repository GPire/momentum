import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestExportTemplate } from './export-template.js';

test('recognizes company headers without changing column names', () => {
  const result = suggestExportTemplate('Expense Date;Category;Amount;Currency;Merchant');
  assert.deepEqual(result.issues, []);
  assert.equal(result.mapping.date.column, 'Expense Date');
  assert.equal(result.mapping.description.column, 'Merchant');
});
test('recognizes international headers and quoted delimiters', () => {
  for (const header of ['Data,Categoria,Importo', 'Datum,Kategorie,Betrag', 'Fecha,Categoria,Importe', 'Date,Catégorie,Montant', 'Datum,Categorie,Bedrag', 'Data,Categoria,Valor']) assert.equal(suggestExportTemplate(header).issues.length, 0);
  assert.equal(suggestExportTemplate('"Expense Date",Category,Amount').issues.length, 0);
});
test('unknown, repeated or competing columns require review', () => {
  assert.ok(suggestExportTemplate('Date,Category,Amount,Cost center').issues.some(x => x.code === 'unknown'));
  assert.ok(suggestExportTemplate('Date,Category,Amount,Importo').issues.some(x => x.code === 'ambiguous'));
  assert.ok(suggestExportTemplate('Date,Category,Amount,AMOUNT').issues.some(x => x.code === 'duplicate'));
});
test('missing mandatory columns, multiple rows and excessive input do not auto-apply', () => {
  assert.ok(suggestExportTemplate('Date,Amount').issues.some(x => x.code === 'required'));
  for (const header of ['', 'Date,Amount\n2026-09-20,15', 'x'.repeat(5000), null]) assert.ok(suggestExportTemplate(header).issues.length);
});
