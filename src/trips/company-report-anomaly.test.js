import test from 'node:test';
import assert from 'node:assert/strict';
import { companyReportAnomaly } from './company-report-anomaly.js';

test('nessun segnale sotto il tetto matematico (con 4 storici + attuale = 5 campioni, sqrt(4)=2.0 non è mai superabile)', () => {
  const historical = [100, 105, 98, 102];
  assert.equal(companyReportAnomaly(900, historical), null);
});

test('un resoconto estremo scatta con 5+ campioni storici coerenti (6 totali, sopra il tetto matematico di sqrt(5)≈2.24)', () => {
  const historical = [100, 105, 98, 102, 101];
  const result = companyReportAnomaly(900, historical);
  assert.ok(result);
  assert.ok(result.zScore > 2);
  assert.equal(result.sampleSize, 6);
});

test('mai un\'accusa: un totale nella norma non produce alcun segnale', () => {
  const historical = [100, 105, 98, 102, 101, 99];
  assert.equal(companyReportAnomaly(103, historical), null);
});

test('deviazione standard zero (tutti i totali, storico e attuale, identici) non genera mai una divisione per zero', () => {
  const historical = [100, 100, 100, 100, 100, 100];
  assert.equal(companyReportAnomaly(100, historical), null);
});

test('storico identico ma resoconto attuale diverso: la deviazione non è più zero, il segnale può scattare', () => {
  const historical = [100, 100, 100, 100, 100, 100];
  const result = companyReportAnomaly(500, historical);
  assert.ok(result);
  assert.ok(result.zScore > 2);
});

test('input non numerico o negativo è ignorato, mai un crash', () => {
  assert.equal(companyReportAnomaly(NaN, [100, 100, 100, 100, 100, 100]), null);
  assert.equal(companyReportAnomaly(-50, [100, 100, 100, 100, 100, 100]), null);
  assert.equal(companyReportAnomaly(900, [100, 105, 'x', null, 99]), null);
});

test('soglia e minSamples personalizzabili', () => {
  const historical = [100, 105, 98, 102, 101];
  const result = companyReportAnomaly(900, historical, { minSamples: 5, zThreshold: 1 });
  assert.ok(result);
});
