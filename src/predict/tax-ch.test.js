'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAvsIndipendente, ivaObbligatoriaCh,
  AVS_ALIQUOTA_PIENA, AVS_SOGLIA_ALIQUOTA_PIENA, AVS_CONTRIBUTO_MINIMO_ANNUO,
  AVS_SOGLIA_ACCESSORIA_OBBLIGO, AVS_SOGLIA_ACCESSORIA_FACOLTATIVA,
  IVA_CH, IVA_CH_SOGLIA_OBBLIGO,
} from './tax-ch.js';

test('costanti verificate: AVS 10% da CHF 60.500, IVA 8,1%/2,6%/3,8%, soglia obbligo CHF 100.000', () => {
  assert.equal(AVS_ALIQUOTA_PIENA, 0.10);
  assert.equal(AVS_SOGLIA_ALIQUOTA_PIENA, 60500);
  assert.equal(AVS_CONTRIBUTO_MINIMO_ANNUO, 530);
  assert.equal(IVA_CH.standard, 0.081);
  assert.equal(IVA_CH.ridotta, 0.026);
  assert.equal(IVA_CH.speciale, 0.038);
  assert.equal(IVA_CH_SOGLIA_OBBLIGO, 100000);
});

test('computeAvsIndipendente: sopra CHF 60.500 -> aliquota piena 10%, calcolo reale', () => {
  const r = computeAvsIndipendente(80000);
  assert.equal(r.fasciaPiena, true);
  assert.equal(r.contributo, 8000); // 80000 * 0.10
  assert.equal(r.aliquota, 0.10);
});

test('computeAvsIndipendente: esattamente alla soglia -> conta come fascia piena', () => {
  const r = computeAvsIndipendente(60500);
  assert.equal(r.fasciaPiena, true);
  assert.equal(r.contributo, 6050);
});

test('computeAvsIndipendente: sotto soglia -> MAI un contributo stimato, solo il minimo verificato e il rimando ufficiale', () => {
  const r = computeAvsIndipendente(30000);
  assert.equal(r.fasciaPiena, false);
  assert.equal(r.contributo, null, 'nessuna stima inventata sulla scala degressiva');
  assert.equal(r.contributoMinimoAnnuo, 530);
  assert.match(r.nota, /scala degressiva/);
  assert.match(r.nota, /ahv-iv\.ch/);
});

test('computeAvsIndipendente: reddito zero o negativo -> zero, nessun crash', () => {
  assert.equal(computeAvsIndipendente(0).contributo, 0);
  assert.equal(computeAvsIndipendente(-100).contributo, 0);
  assert.equal(computeAvsIndipendente(NaN).contributo, 0);
});

// ── ATTIVITÀ ACCESSORIA (2026-09-06) — BUG REALE trovato analizzando un
// audit esterno: la funzione presumeva sempre "attività principale"
// (contributi dal 1° franco). Per un'attività accessoria la soglia
// d'obbligo è CHF 2.500, verificato su fonte primaria/fonti concordanti
// (ahv-iv.ch, medisuisse.ch, raiffeisen.ch, swisslife.ch). ──

test('computeAvsIndipendente: default (nessun opts) → si comporta come attività PRINCIPALE, retrocompatibile con ogni chiamante esistente', () => {
  const r = computeAvsIndipendente(1500);
  assert.equal(r.contributoMinimoAnnuo, 530, 'senza specificare, resta la scelta prudente: dal 1° franco');
  assert.equal(r.sottoSogliaAccessoria, undefined);
});

test('computeAvsIndipendente: attività accessoria SOTTO CHF 2.500 → nessun contributo presunto, MAI il minimo di 530 spacciato per dovuto', () => {
  const r = computeAvsIndipendente(1500, { attivitaAccessoria: true });
  assert.equal(r.contributo, null);
  assert.equal(r.sottoSogliaAccessoria, true);
  assert.match(r.nota, /ACCESSORIA/);
  // 'it-CH'.toLocaleString() non aggiunge separatore di migliaia sotto le
  // 5 cifre (verificato: 2500->"2500", 60500->"60'500") — stesso comportamento
  // già in uso in questo file per AVS_SOGLIA_ALIQUOTA_PIENA, non un bug.
  assert.match(r.nota, /2500/);
  assert.match(r.nota, /2300/, 'deve citare anche la soglia di facoltatività, non solo quella di obbligo');
});

test('computeAvsIndipendente: attività accessoria DA CHF 2.500 in su → stesso trattamento della principale (minimo 530)', () => {
  const r = computeAvsIndipendente(3000, { attivitaAccessoria: true });
  assert.equal(r.sottoSogliaAccessoria, undefined);
  assert.equal(r.contributoMinimoAnnuo, 530);
});

test('computeAvsIndipendente: attività accessoria SOPRA la soglia piena (CHF 60.500) → aliquota piena come chiunque altro', () => {
  const r = computeAvsIndipendente(80000, { attivitaAccessoria: true });
  assert.equal(r.fasciaPiena, true);
  assert.equal(r.contributo, 8000);
});

test('costanti soglie attività accessoria verificate', () => {
  assert.equal(AVS_SOGLIA_ACCESSORIA_OBBLIGO, 2500);
  assert.equal(AVS_SOGLIA_ACCESSORIA_FACOLTATIVA, 2300);
});

test('ivaObbligatoriaCh: sopra CHF 100.000 -> obbligatoria', () => {
  const r = ivaObbligatoriaCh(150000);
  assert.equal(r.obbligatoria, true);
  assert.match(r.messaggio, /obbligatoria/);
});

test('ivaObbligatoriaCh: sotto soglia -> NON obbligatoria, dichiarato esplicitamente (a differenza dell\'Italia)', () => {
  const r = ivaObbligatoriaCh(40000);
  assert.equal(r.obbligatoria, false);
  assert.match(r.messaggio, /NON sei obbligato/);
});

test('ivaObbligatoriaCh: esattamente alla soglia -> obbligatoria (>=, non >)', () => {
  assert.equal(ivaObbligatoriaCh(100000).obbligatoria, true);
});
