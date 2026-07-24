import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSalary, nextPayday, daysToNextPayday, resolveSalary } from './income-model.js';

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
