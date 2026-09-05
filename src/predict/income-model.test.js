import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSalary, nextPayday, daysToNextPayday, resolveSalary, suggestSalaryCompetenceMonth } from './income-model.js';

// Costruisce un mese di transazioni con un accredito stipendio.
function tx(date, amount, type = 'entrata', description = 'Stipendio ACME') {
  return { id: date + amount, date, amount, type, description, category: type === 'entrata' ? 'stipendio' : 'altro' };
}

test('detectSalary tace senza dati sufficienti', () => {
  assert.equal(detectSalary({}), null);
  assert.equal(detectSalary({ '2026-06': [tx('2026-06-27', 1500)] }), null); // un solo accredito
});

test('detectSalary trova giorno (27) e importo (1500) da accrediti mensili', () => {
  const all = {
    '2026-05': [tx('2026-05-27', 1500)],
    '2026-06': [tx('2026-06-27', 1500)],
    '2026-07': [tx('2026-07-27', 1520)],
  };
  const s = detectSalary(all);
  assert.equal(s.dayOfMonth, 27);
  assert.equal(s.amount, 1500); // mediana robusta all'importo diverso di luglio
  assert.equal(s.monthsSeen, 3);
  assert.ok(s.confidence > 0);
});

test('detectSalary sceglie lo stipendio (importo maggiore) tra più entrate ricorrenti', () => {
  const all = {
    '2026-05': [tx('2026-05-27', 1500, 'entrata', 'Stipendio'), tx('2026-05-15', 200, 'entrata', 'Affitto stanza')],
    '2026-06': [tx('2026-06-27', 1500, 'entrata', 'Stipendio'), tx('2026-06-15', 200, 'entrata', 'Affitto stanza')],
  };
  const s = detectSalary(all);
  assert.equal(s.amount, 1500);
  assert.equal(s.dayOfMonth, 27);
});

test('detectSalary ignora bonifici sporadici di amici (non mensili)', () => {
  const all = {
    '2026-06': [tx('2026-06-03', 40, 'entrata', 'Rimborso Marco'), tx('2026-06-20', 15, 'entrata', 'Regalo Anna')],
  };
  assert.equal(detectSalary(all), null);
});

test('nextPayday: se il giorno è passato → mese prossimo, clampato ai mesi corti', () => {
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sal = { dayOfMonth: 27 };
  assert.equal(ymd(nextPayday(sal, new Date(2026, 6, 10))), '2026-07-27');
  assert.equal(ymd(nextPayday(sal, new Date(2026, 6, 28))), '2026-08-27');
  // giorno 31 a febbraio → ultimo giorno
  assert.equal(ymd(nextPayday({ dayOfMonth: 31 }, new Date(2027, 1, 1))), '2027-02-28');
});

test('daysToNextPayday conta i giorni all\'accredito', () => {
  assert.equal(daysToNextPayday({ dayOfMonth: 27 }, new Date('2026-07-20')), 7);
  assert.equal(daysToNextPayday(null), null);
});

test('resolveSalary: override manuale vince sul rilevato (modificabile)', () => {
  const all = { '2026-06': [tx('2026-06-27', 1500)], '2026-07': [tx('2026-07-27', 1500)] };
  // senza override → rilevato
  assert.equal(resolveSalary({}, all).source, 'auto');
  assert.equal(resolveSalary({}, all).dayOfMonth, 27);
  // con override → manuale
  const r = resolveSalary({ salaryProfile: { dayOfMonth: 5, amount: 2000 } }, all);
  assert.equal(r.source, 'manual');
  assert.equal(r.dayOfMonth, 5);
  assert.equal(r.amount, 2000);
});

// ── suggestSalaryCompetenceMonth (2026-09-05, richiesto da feedback utenti reali) ──
test('suggestSalaryCompetenceMonth: pagato a inizio mese (1-15) → competenza del mese precedente', () => {
  const r = suggestSalaryCompetenceMonth(new Date(2026, 8, 3)); // 3 settembre
  assert.deepEqual(r, { year: 2026, month: 7 }); // agosto (0-based: 7)
});

test('suggestSalaryCompetenceMonth: pagato a fine mese (>=25) → nessuna correzione, il calendario è già giusto', () => {
  assert.equal(suggestSalaryCompetenceMonth(new Date(2026, 7, 27)), null); // 27 agosto
  assert.equal(suggestSalaryCompetenceMonth(new Date(2026, 7, 30)), null);
});

test('suggestSalaryCompetenceMonth: zona ambigua (16-24) → nessun suggerimento, onestà sui limiti', () => {
  assert.equal(suggestSalaryCompetenceMonth(new Date(2026, 8, 16)), null);
  assert.equal(suggestSalaryCompetenceMonth(new Date(2026, 8, 20)), null);
  assert.equal(suggestSalaryCompetenceMonth(new Date(2026, 8, 24)), null);
});

test('suggestSalaryCompetenceMonth: il 15 è ancora dentro "inizio mese" (confine incluso)', () => {
  const r = suggestSalaryCompetenceMonth(new Date(2026, 8, 15));
  assert.deepEqual(r, { year: 2026, month: 7 });
});

test('suggestSalaryCompetenceMonth: gennaio scavalca l\'anno all\'indietro correttamente', () => {
  const r = suggestSalaryCompetenceMonth(new Date(2026, 0, 5)); // 5 gennaio 2026
  assert.deepEqual(r, { year: 2025, month: 11 }); // dicembre 2025
});

test('suggestSalaryCompetenceMonth: data non valida → null, mai un\'eccezione', () => {
  assert.equal(suggestSalaryCompetenceMonth('non-una-data'), null);
  assert.equal(suggestSalaryCompetenceMonth(new Date('invalid')), null);
});
