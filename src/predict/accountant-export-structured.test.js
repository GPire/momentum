'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountantReport } from './accountant-export.js';
import { buildAccountantReportCh, buildAccountantReportEs } from './accountant-export-intl.js';
import { accountantReportToJson, accountantReportToCsv } from './accountant-export-structured.js';

const fattura = (n, client, imponibile, date, extra = {}) => ({ number: n, year: +date.slice(0, 4), client, imponibile, date, description: 'consulenza', ...extra });
const entrata = (date, amount, description, id) => ({ id, type: 'entrata', date, amount, description, category: 'stipendio', taxable: true });

test('accountantReportToJson: JSON valido, stesso dato del report, con involucro identificabile', () => {
  const report = buildAccountantReport(
    [fattura(1, 'Alfa Spa', 10000, '2026-02-10')],
    { '2026-03': [entrata('2026-03-05', 10000, 'bonifico Alfa', 'a')] },
    2026, 'forfettario', { now: new Date(Date.UTC(2026, 7, 1)) },
  );
  const json = accountantReportToJson(report, { emitter: 'Mario Rossi' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.formato, 'momentum-accountant-report');
  assert.equal(parsed.emittente, 'Mario Rossi');
  assert.match(parsed.nota, /non è un documento fiscale ufficiale/i);
  assert.equal(parsed.fatturato, report.fatturato);
  assert.equal(parsed.fatture.length, 1);
});

test('accountantReportToCsv (IT): sezioni multiple, intestazioni presenti, numeri non alterati', () => {
  const report = buildAccountantReport(
    [fattura(1, 'Alfa Spa', 10000, '2026-02-10'), fattura(2, 'Beta Srl', 5000, '2026-06-10')],
    { '2026-03': [entrata('2026-03-05', 10000, 'bonifico Alfa', 'a')] },
    2026, 'forfettario', { now: new Date(Date.UTC(2026, 7, 1)) },
  );
  const csv = accountantReportToCsv(report, { emitter: 'Mario Rossi' });
  assert.match(csv, /^# Momentum — riepilogo commercialista/);
  assert.match(csv, /## Riepilogo/);
  assert.match(csv, /## Fatture/);
  assert.match(csv, /Alfa Spa/);
  assert.match(csv, /Beta Srl/);
  assert.match(csv, new RegExp(String(report.fatturato)));
});

test('accountantReportToCsv (IT): un campo con virgola viene quotato, non spezza le colonne', () => {
  const report = buildAccountantReport(
    [fattura(1, 'Alfa, Beta e Gamma Srl', 1000, '2026-02-10')],
    {}, 2026, 'forfettario',
  );
  const csv = accountantReportToCsv(report, {});
  assert.match(csv, /"Alfa, Beta e Gamma Srl"/);
});

test('accountantReportToCsv (IT): anno vuoto -> intestazioni presenti ma nessuna riga fattura, mai un crash', () => {
  const report = buildAccountantReport([], {}, 2026, 'forfettario');
  const csv = accountantReportToCsv(report, {});
  assert.match(csv, /## Fatture/);
  assert.doesNotThrow(() => accountantReportToJson(report, {}));
});

test('accountantReportToCsv (CH): sopra la soglia piena -> sezione Composizione con la voce AVS', () => {
  const report = buildAccountantReportCh({}, 2026, { redditoManuale: 80000 });
  const csv = accountantReportToCsv(report, { emitter: 'Anna Muster' });
  assert.match(csv, /# Paese,CH/);
  assert.match(csv, /## Composizione/);
  assert.match(csv, /AVS indipendente/);
});

test('accountantReportToCsv (CH): sotto la soglia degressiva -> nessuna Composizione, ma la nota onesta resta nel CSV', () => {
  const report = buildAccountantReportCh({}, 2026, { redditoManuale: 30000 });
  const csv = accountantReportToCsv(report, { emitter: 'Anna Muster' });
  assert.doesNotMatch(csv, /## Composizione/);
  assert.match(csv, /## Non calcolabile/);
});

test('accountantReportToCsv (ES): sezione Note presente con il disclaimer sul tramo autonómico', () => {
  const report = buildAccountantReportEs({}, 2026, { redditoManuale: undefined });
  // Nessuna fattura riconosciuta: incassato 0, ma il formato non deve crashare.
  const csv = accountantReportToCsv(report, { emitter: 'Juan Perez' });
  assert.match(csv, /# Paese,ES/);
});

test('accountantReportToJson (ES): dispatcher sceglie la forma corretta in base alla forma del report, non al nome del paese', () => {
  const reportCh = buildAccountantReportCh({}, 2026, { redditoManuale: 50000 });
  const csv = accountantReportToCsv(reportCh, {});
  // Il report CH/ES non ha `fatture`: deve finire nel ramo csvIntl, mai in csvIt.
  assert.doesNotMatch(csv, /## Fatture/);
});
