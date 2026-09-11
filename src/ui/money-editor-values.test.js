import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalaryDraft } from './money-editor-values.js';
import { t, UI_LANGS } from '../i18n/ui-strings.js';

test('salary accepts decimal comma or point, with no forced amount', () => {
  assert.deepEqual(parseSalaryDraft('27','1500,50'),{day:27,amount:1500.5});
  assert.deepEqual(parseSalaryDraft('01','1500.50'),{day:1,amount:1500.5});
  assert.equal(parseSalaryDraft('27','').error,'amount');
});
test('salary rejects malformed days and partial numeric amounts', () => {
  for (const day of ['','0','32','2.5','2e1','abc27']) assert.equal(parseSalaryDraft(day,'1500').error,'day');
  for (const amount of ['0','-12','12oops','Infinity','1e3','1.234,56','1.234']) assert.equal(parseSalaryDraft('27',amount).error,'amount');
});
test('every money editor text exists in all seven languages', () => {
  for (const lang of UI_LANGS) for (const key of ['moneyBudgetTitle','moneyBudgetHint','moneyUseSuggestion','moneyBudgetSaved','moneySalaryTitle','moneySalaryHint','moneySalaryAuto','moneyDay','moneyNet','moneyReset','moneyLocalHint','moneySalaryInvalid','moneySalarySaved','moneySalaryReset','moneySalaryLabel']) {
    assert.notEqual(t(key,lang),key,`${lang}: ${key}`);
  }
});

test('reminder accepts optional amounts and decimal comma, rejects invalid dates and partial numbers', async () => {
  const { parseReminderDraft } = await import('./money-editor-values.js');
  assert.deepEqual(parseReminderDraft({title:' Dentista ',date:'2026-09-12'}),{title:'Dentista',date:'2026-09-12',amount:0});
  assert.equal(parseReminderDraft({title:'Dentista',date:'2026-09-12',amount:'25,50'}).amount,25.5);
  for (const date of ['2026-02-30','2026-13-02','bad','']) assert.equal(parseReminderDraft({title:'X',date}).error,'required');
  for (const amount of ['12abc','-1','0','1.234','Infinity']) assert.equal(parseReminderDraft({title:'X',date:'2026-09-12',amount}).error,'amount');
});
