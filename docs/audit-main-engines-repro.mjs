// Diagnostic fixtures for main d92a5dc. These reproduce defects; they are NOT
// passing regression tests or release gates. Run against an isolated snapshot:
// node docs/audit-main-engines-repro.mjs /absolute/path/to/main-snapshot
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide the isolated main snapshot directory.');
const root = resolve(process.argv[2]);
const from = (name) => import(pathToFileURL(resolve(root, 'src', name)).href);
const { snapshotForecast, evaluateSnapshot } = await from('predict/forecast-calibration.js');
const { buildAccountantReport } = await from('predict/accountant-export.js');
const { accountantReportToCsv } = await from('predict/accountant-export-structured.js');
const { upcomingModelo130Deadlines } = await from('predict/tax-deadlines-es.js');
const now = Date.parse('2026-01-01T12:00:00Z');
const snapshot = snapshotForecast({
  known: true, startBalance: 1000, relative: false,
  path: [{ inDays: 7, date: '2026-01-08', p10: 800, p50: 1000, p90: 1200 }],
}, { now, checkpoints: [7] });
const later = { now: Date.parse('2026-01-09T12:00:00Z') };
const evaluate = (date) => evaluateSnapshot(snapshot, {
  '2026-01': [{ type: 'uscita', amount: 100, date }],
}, later)[0].actual;

const earlierSameDay = evaluate('2026-01-01T09:00:00Z');
assert.equal(earlierSameDay, 900);
const dateOnly = evaluate('2026-01-08');
const timestamp = evaluate('2026-01-08T09:00:00Z');
assert.equal(dateOnly, 900);
assert.equal(timestamp, 1000);
const early = evaluateSnapshot(snapshot, {}, { now: Date.parse('2026-01-08T00:01:00Z') });
assert.equal(early.length, 1);

const report = buildAccountantReport([
  { number: 1, year: 2026, client: '=1+1', imponibile: 100,
    date: '2026-02-10', description: 'Synthetic audit fixture' },
], {}, 2026, 'forfettario', { now: new Date('2026-08-01T00:00:00Z') });
const csv = accountantReportToCsv(report, { emitter: 'Test\n=1+1' });
assert.match(csv, /,=1\+1,/);
assert.match(csv, /Test\n=1\+1/);

const dueBefore = upcomingModelo130Deadlines(100, { now: new Date('2026-04-19T12:00:00Z') });
const dueToday = upcomingModelo130Deadlines(100, { now: new Date('2026-04-20T12:00:00Z') });
assert.equal(dueBefore[0].date, '2026-04-20');
assert.equal(dueToday.some((entry) => entry.date === '2026-04-20'), false);

console.log(JSON.stringify({
  auditedRef: 'd92a5dcd9a5a9dae7649ce4c74fd6e836adb124f',
  kind: 'defect-reproduction-not-release-validation',
  observations: [
    { id: 'forecast-origin', observed: earlierSameDay, expectedIfBalanceAlreadyIncludesEarlierSpending: 1000 },
    { id: 'forecast-target-format', dateOnly, timestamp, expectedSameCalendarDay: 900 },
    { id: 'forecast-premature', evaluatedAtFirstMinuteOfTargetDay: early.length, expectedUntilDayCloses: 0 },
    { id: 'csv-text-boundary', formulaLikeClientPreservedAsRawCell: true, emitterNewlineEscapesHeader: true },
    { id: 'deadline-today', visiblePreviousDay: true, visibleOnDueDay: false, expectedOnDueDay: true },
  ],
}, null, 2));
