import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotForecast, evaluateSnapshot } from './forecast-calibration.js';
import { upcomingTaxDeadlines, overdueTaxDeadlines } from './tax-deadlines.js';
import { upcomingModelo130Deadlines } from './tax-deadlines-es.js';
import { buildAccountantReport } from './accountant-export.js';
import { accountantReportToCsv } from './accountant-export-structured.js';
import { episodiPattern } from '../alpha/pattern-storico.js';
import { tIntegration, formatPatternResult } from '../i18n/integration-copy.js';
import { shouldSuggestTaxSetup } from './profilo-feature.js';
import { recommendPlan, currentTier } from '../core/subscription.js';

test('forecast observation matches the engine day window for relative and absolute snapshots', () => {
  for (const startBalance of [0, 1000]) {
    const snapshot = snapshotForecast({ known: true, startBalance, relative: !startBalance,
      path: [{ inDays: 7, date: '2026-01-08', p10: -500, p50: 0, p90: 1500 }],
    }, { now: Date.parse('2026-01-01T12:00:00Z'), checkpoints: [7] });
    for (const date of ['2026-01-08', '2026-01-08T09:00:00Z', '2026-01-08T23:59:59Z']) {
      const tx = { '2026-01': [
        { date: '2026-01-01T09:00:00Z', type: 'uscita', amount: 200 },
        { date, type: 'uscita', amount: 100 },
        { date: '2026-01-09T00:00:00Z', type: 'uscita', amount: 500 },
      ] };
      assert.deepEqual(evaluateSnapshot(snapshot, tx, { now: Date.parse('2026-01-08T23:59:59Z') }), []);
      assert.equal(evaluateSnapshot(snapshot, tx, { now: Date.parse('2026-01-09T00:00:00Z') })[0].actual, startBalance - 100);
    }
  }
});

test('due today remains visible in ES and IT, with no premature overdue warning', () => {
  const es = upcomingModelo130Deadlines(100, { now: new Date('2026-04-20T12:00:00Z') });
  assert.equal(es[0].date, '2026-04-20'); assert.equal(es[0].giorniMancanti, 0);
  const now = new Date('2026-06-30T23:59:00Z');
  assert.equal(upcomingTaxDeadlines(1000, { now })[0].date, '2026-06-30');
  assert.ok(overdueTaxDeadlines(1000, { now }).every(d => d.date !== '2026-06-30'));
  assert.ok(overdueTaxDeadlines(1000, { now: new Date('2026-07-01T00:00:00Z') }).some(d => d.date === '2026-06-30'));
});

test('CSV confines emitter lines and neutralizes formula-like text without changing numeric amounts', () => {
  for (const text of ['=1+1', '+1+1', '-1+1', '@SUM(1)', '\t=1+1', '\r=1+1']) {
    const report = buildAccountantReport([{ number: 1, year: 2026, client: text, imponibile: 100, date: '2026-02-10' }], {}, 2026, 'forfettario');
    report.accantonamento.scomposizione = [{ voce: text, importo: -12.5 }];
    const csv = accountantReportToCsv(report, { emitter: 'Test\n=1+1,"quoted"' });
    assert.ok(csv.startsWith('"# Momentum'));
    assert.ok(csv.includes('""quoted""'));
    assert.ok(csv.includes("'" + text));
    assert.ok(csv.includes(',-12.5\n'));
  }
});

test('invalid historical-pattern controls cannot start a non-advancing loop', () => {
  for (const invalid of [0, -1, 1.5, NaN, Infinity, '20']) {
    assert.equal(episodiPattern('azioniUsa', { orizzonteGiorni: invalid }).trovato, false);
    assert.equal(episodiPattern('azioniUsa', { finestraGiorni: invalid }).trovato, false);
  }
  for (const soglia of [NaN, Infinity, '0.1']) assert.equal(episodiPattern('azioniUsa', { soglia }).trovato, false);
  assert.equal(episodiPattern('azioniUsa', { direzione: 'unknown' }).trovato, false);
});

test('Swiss main profile suppresses setup suggestions but never activates a plan', () => {
  for (const chAttivitaTipo of ['principale', 'accessoria']) {
    const state = { chAttivitaTipo, onboardingProfile: { hasPartitaIva: true } };
    assert.equal(shouldSuggestTaxSetup(state), false);
    assert.deepEqual(recommendPlan(state).reasons, ['professional_tax']);
    assert.equal(currentTier(state), 'FREE');
  }
});

test('integration feedback has seven complete languages and localized result values', () => {
  const result = { trovato: true, chiave: 'azioniUsa', criterio: { direzione: 'caduta', soglia: 0.1, finestraGiorni: 20, orizzonteGiorni: 20 },
    riassunto: { abbastanza: true, casi: 12, primaData: '2000-01-01', ultimaData: '2026-01-01', mediano: 0.15, quotaInGuadagno: 0.75, peggioreDecile: -0.1, miglioreDecile: 0.3 } };
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const key of ['forecastInside', 'forecastOutside', 'checkpoint', 'checkpointMissing', 'checkpointWarning', 'patternMissing']) assert.notEqual(tIntegration(key, lang), key);
    const forecast = tIntegration('forecastBody', lang, '11/09', 7, '100', '200', '150');
    assert.ok(forecast.includes('150')); assert.doesNotMatch(forecast, /\{\d+\}/);
    const answer = formatPatternResult(result, lang);
    assert.ok(answer.includes('S&P 500')); assert.doesNotMatch(answer, /undefined|NaN|\{\d+\}/);
  }
});
