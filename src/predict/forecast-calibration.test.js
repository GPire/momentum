'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotForecast, evaluateSnapshot, evaluateAllSnapshots, calibrationSummary } from './forecast-calibration.js';

const DAY_MS = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function fakeForecast({ now, startBalance = 0, relative = true, days = 30 }) {
  const path = [];
  for (let i = 1; i <= days; i++) {
    const t = now + i * DAY_MS;
    path.push({ date: iso(t), inDays: i, p50: -10 * i, p10: -10 * i - 50, p90: -10 * i + 50 });
  }
  return { known: true, relative, startBalance, path };
}

test('snapshotForecast: forecast non calcolabile -> null, mai un checkpoint inventato', () => {
  assert.equal(snapshotForecast(null), null);
  assert.equal(snapshotForecast({ known: false }), null);
});

test('snapshotForecast: orizzonte troppo corto per i checkpoint richiesti -> null', () => {
  const f = fakeForecast({ now: Date.now(), days: 3 });
  assert.equal(snapshotForecast(f, { checkpoints: [7, 14, 30] }), null);
});

test('snapshotForecast: cattura i checkpoint 7/14/30 dal path esistente, nessun ricalcolo', () => {
  const now = Date.UTC(2026, 0, 1);
  const f = fakeForecast({ now, days: 30 });
  const snap = snapshotForecast(f, { now, checkpoints: [7, 14, 30] });
  assert.equal(snap.targets.length, 3);
  assert.equal(snap.targets[0].daysAhead, 7);
  assert.equal(snap.targets[0].p50, -70);
  assert.equal(snap.takenAt, '2026-01-01');
});

test('evaluateSnapshot: checkpoint futuro (non ancora passato) -> escluso, mai un confronto anticipato', () => {
  const now = Date.UTC(2026, 0, 1);
  const f = fakeForecast({ now, days: 30 });
  const snap = snapshotForecast(f, { now, checkpoints: [7, 14, 30] });
  // Valutato lo stesso giorno in cui è stata presa l'istantanea: nessun checkpoint è ancora passato.
  const evals = evaluateSnapshot(snap, {}, { now });
  assert.equal(evals.length, 0);
});

test('evaluateSnapshot: previsione relativa, il flusso reale cade dentro la banda -> withinBand true', () => {
  const now = Date.UTC(2026, 0, 1);
  const f = fakeForecast({ now, days: 30, relative: true, startBalance: 0 });
  const snap = snapshotForecast(f, { now, checkpoints: [7] });
  // Predetto al giorno 7: p50=-70, banda [-120,-20]. Flusso reale nei 7 giorni: -80 (dentro banda).
  const allTx = { '2026-01': [
    { type: 'uscita', amount: 100, date: '2026-01-03' },
    { type: 'entrata', amount: 20, date: '2026-01-05' },
  ] };
  const evaluatedNow = now + 10 * DAY_MS; // dopo il giorno 7
  const evals = evaluateSnapshot(snap, allTx, { now: evaluatedNow });
  assert.equal(evals.length, 1);
  assert.equal(evals[0].actual, -80);
  assert.equal(evals[0].withinBand, true);
});

test('evaluateSnapshot: flusso reale FUORI dalla banda -> withinBand false, errore calcolato correttamente', () => {
  const now = Date.UTC(2026, 0, 1);
  const f = fakeForecast({ now, days: 30, relative: true, startBalance: 0 });
  const snap = snapshotForecast(f, { now, checkpoints: [7] });
  // Predetto al giorno 7: banda [-120,-20]. Una spesa imprevista di 500 la fa uscire.
  const allTx = { '2026-01': [{ type: 'uscita', amount: 500, date: '2026-01-03' }] };
  const evals = evaluateSnapshot(snap, allTx, { now: now + 10 * DAY_MS });
  assert.equal(evals[0].actual, -500);
  assert.equal(evals[0].withinBand, false);
  assert.equal(evals[0].errorP50, -500 - (-70)); // actual - p50
});

test('evaluateSnapshot: previsione ASSOLUTA (startBalance dichiarato) -> il confronto parte da quel saldo, non da zero', () => {
  const now = Date.UTC(2026, 0, 1);
  const f = fakeForecast({ now, days: 30, relative: false, startBalance: 1000 });
  const snap = snapshotForecast(f, { now, checkpoints: [7] });
  assert.equal(snap.startBalance, 1000);
  const allTx = { '2026-01': [{ type: 'uscita', amount: 100, date: '2026-01-03' }] };
  const evals = evaluateSnapshot(snap, allTx, { now: now + 10 * DAY_MS });
  assert.equal(evals[0].actual, 900); // 1000 - 100
});

test('evaluateAllSnapshots: filtra via le istantanee senza nessun checkpoint ancora passato', () => {
  const now = Date.UTC(2026, 0, 1);
  // "vecchia": presa 20 giorni fa, il suo checkpoint a 7 giorni (oggi-13) è già passato.
  const fVecchia = fakeForecast({ now: now - 20 * DAY_MS, days: 30 });
  const vecchia = snapshotForecast(fVecchia, { now: now - 20 * DAY_MS, checkpoints: [7] });
  // "recente": presa oggi, il suo checkpoint a 7 giorni è nel futuro.
  const fRecente = fakeForecast({ now, days: 30 });
  const recente = snapshotForecast(fRecente, { now, checkpoints: [7] });
  const out = evaluateAllSnapshots([vecchia, recente], {}, { now });
  assert.equal(out.length, 1); // solo "vecchia" ha un checkpoint già passato
});

test('calibrationSummary: meno del minimo di osservazioni -> known false, mai un verdetto su troppo poco', () => {
  const s = calibrationSummary([[{ withinBand: true }]], { minObservations: 5 });
  assert.equal(s.known, false);
});

test('calibrationSummary: calcola la percentuale reale dentro banda e lo scostamento dall\'80% dichiarato', () => {
  const evals = [
    { withinBand: true }, { withinBand: true }, { withinBand: true },
    { withinBand: true }, { withinBand: false },
  ];
  const s = calibrationSummary([evals], { minObservations: 5 });
  assert.equal(s.known, true);
  assert.equal(s.count, 5);
  assert.equal(s.withinBandPct, 80);
  assert.equal(s.declaredTargetPct, 80);
  assert.equal(s.deltaFromDeclared, 0);
});
