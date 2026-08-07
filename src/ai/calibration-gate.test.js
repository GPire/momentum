'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initCalibrationState, recordExpertOutcome, expertCalibration, calibrationGate,
  recordAbstention, abstentionQuality, calibrationSummary,
  MIN_CAMPIONI, ECE_SOSPENSIONE, FINESTRA,
} from './calibration-gate.js';

// Costruisce N esiti per un esperto con una data confidenza dichiarata e una
// data percentuale reale di successi. È il modo per fabbricare uno "spavaldo"
// (dice 95%, indovina 50%) e un "onesto" (dice 80%, indovina 80%).
function esperto(state, source, { dichiara, indovina, n }) {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = recordExpertOutcome(s, source, dichiara, (i % 100) < indovina * 100);
  }
  return s;
}

test('sotto il minimo di campioni NON si giudica — e NON si esclude', () => {
  let s = esperto(initCalibrationState(), 'nano', { dichiara: 0.95, indovina: 0.1, n: 5 });
  const cal = expertCalibration(s, 'nano');
  assert.equal(cal.giudicabile, false);
  assert.equal(cal.ece, null);
  const gate = calibrationGate(s, 'nano');
  assert.equal(gate.fattore, 1,
    'escludere un esperto non ancora giudicabile zittirebbe ogni esperto nuovo per sempre');
  assert.equal(gate.ammesso, true);
});

test('LA DIFFERENZA DELIBERATA da merge-gate: li si RIFIUTA, qui si resta neutri', () => {
  // merge-gate giudica un modello che arriva da FUORI: rifiutare non costa
  // niente, si tiene il proprio. Qui si giudica un esperto NOSTRO: rifiutarlo
  // significa restare senza risposta.
  const s = initCalibrationState();
  assert.equal(calibrationGate(s, 'mai-visto').fattore, 1);
  assert.equal(calibrationGate(s, 'mai-visto').ammesso, true);
});

test('IL PUNTO: un esperto SPAVALDO (dice 95%, indovina 50%) smette di poter decidere da solo', () => {
  const s = esperto(initCalibrationState(), 'spavaldo', { dichiara: 0.95, indovina: 0.5, n: 100 });
  const cal = expertCalibration(s, 'spavaldo');
  assert.equal(cal.giudicabile, true);
  assert.ok(cal.ece > ECE_SOSPENSIONE, `ECE ${cal.ece} deve superare la soglia`);
  assert.equal(cal.affidabile, false);
  const gate = calibrationGate(s, 'spavaldo');
  assert.ok(gate.fattore < 1, 'un esperto la cui sicurezza non vale niente non deve pesare come gli altri');
  assert.equal(gate.ammesso, false);
});

test('un esperto ONESTO (dice 80%, indovina 80%) passa senza penalita\'', () => {
  const s = esperto(initCalibrationState(), 'onesto', { dichiara: 0.8, indovina: 0.8, n: 100 });
  const cal = expertCalibration(s, 'onesto');
  assert.equal(cal.affidabile, true);
  assert.ok(cal.ece <= ECE_SOSPENSIONE);
  assert.equal(calibrationGate(s, 'onesto').fattore, 1);
});

test('anche il PAURO SO e\' mal calibrato: dire 20% e indovinare sempre non e\' una virtu\'', () => {
  const s = esperto(initCalibrationState(), 'pauroso', { dichiara: 0.2, indovina: 1.0, n: 100 });
  const cal = expertCalibration(s, 'pauroso');
  assert.equal(cal.affidabile, false,
    'una sicurezza scollegata dalla realta\' e\' un problema in entrambe le direzioni');
});

test('un esperto scalibrato NON viene azzerato: potrebbe non ricalibrarsi mai piu\'', () => {
  const s = esperto(initCalibrationState(), 'spavaldo', { dichiara: 0.95, indovina: 0.3, n: 100 });
  const gate = calibrationGate(s, 'spavaldo');
  assert.ok(gate.fattore > 0,
    'a peso zero non voterebbe mai piu\', quindi non produrrebbe esiti, quindi non potrebbe mai migliorare: una trappola senza uscita');
});

test('FINESTRA SCORREVOLE: un esperto che MIGLIORA se ne accorge', () => {
  let s = esperto(initCalibrationState(), 'redento', { dichiara: 0.95, indovina: 0.2, n: 150 });
  assert.equal(expertCalibration(s, 'redento').affidabile, false, 'premessa: parte male');
  // Da qui in poi si comporta bene, abbastanza a lungo da riempire la finestra.
  s = esperto(s, 'redento', { dichiara: 0.85, indovina: 0.85, n: FINESTRA });
  assert.equal(expertCalibration(s, 'redento').affidabile, true,
    'senza finestra scorrevole resterebbe marchiato a vita dai suoi errori iniziali');
});

test('la finestra limita la memoria: il vault non cresce all\'infinito', () => {
  const s = esperto(initCalibrationState(), 'x', { dichiara: 0.8, indovina: 0.8, n: FINESTRA * 3 });
  assert.equal(s.esperti.x.length, FINESTRA);
});

test('esiti malformati non sporcano lo stato', () => {
  const base = initCalibrationState();
  for (const bad of [[null, 0.5], ['x', NaN], ['x', undefined], ['', 0.5]]) {
    const s = recordExpertOutcome(base, bad[0], bad[1], true);
    assert.deepEqual(s.esperti, {}, `accettato ${JSON.stringify(bad)}`);
  }
});

// ── L'ASTENSIONE, MISURATA ──

test('ASTENSIONE: sotto il minimo non si giudica se tacere serva', () => {
  let s = initCalibrationState();
  for (let i = 0; i < 5; i++) s = recordAbstention(s, { astenuto: true, ipotesiMigliore: 'a', categoriaVera: 'b' });
  const q = abstentionQuality(s);
  assert.equal(q.giudicabile, false);
  assert.equal(q.precisione, null);
});

test('IL PEZZO CHE MANCAVA: "aveva ragione a tacere?" e\' misurato, non dichiarato', () => {
  let s = initCalibrationState();
  // 30 volte tace e la sua ipotesi era davvero sbagliata -> tacere serviva.
  for (let i = 0; i < 30; i++) s = recordAbstention(s, { astenuto: true, ipotesiMigliore: 'alimentari', categoriaVera: 'trasporti' });
  const q = abstentionQuality(s);
  assert.equal(q.giudicabile, true);
  assert.equal(q.precisione, 1);
  assert.equal(q.utile, true);
  assert.match(q.motivo, /chiedere conviene/);
});

test('ASTENSIONE INUTILE: se tacendo avrebbe azzeccato, sta creando attrito e si dice', () => {
  let s = initCalibrationState();
  for (let i = 0; i < 30; i++) s = recordAbstention(s, { astenuto: true, ipotesiMigliore: 'alimentari', categoriaVera: 'alimentari' });
  const q = abstentionQuality(s);
  assert.equal(q.utile, false);
  assert.equal(q.precisione, 0);
  assert.match(q.motivo, /sta chiedendo troppo/,
    'senza questa misura l\'astensione e\' pigrizia travestita da prudenza');
});

test('quando NON si astiene, non si conta niente', () => {
  const s = recordAbstention(initCalibrationState(), { astenuto: false, ipotesiMigliore: 'a', categoriaVera: 'b' });
  assert.equal(s.astensioni.totale, 0);
});

test('senza la categoria vera non si puo\' giudicare, e non si finge di poterlo fare', () => {
  const s = recordAbstention(initCalibrationState(), { astenuto: true, ipotesiMigliore: 'a' });
  assert.equal(s.astensioni.totale, 0);
});

test('il riassunto per l\'interfaccia non contiene mai un numero senza il suo significato', () => {
  let s = esperto(initCalibrationState(), 'nano', { dichiara: 0.95, indovina: 0.4, n: 60 });
  const r = calibrationSummary(s, ['nano', 'mai-visto']);
  assert.equal(r.esperti.length, 2);
  for (const e of r.esperti) assert.ok(typeof e.motivo === 'string' && e.motivo.length > 10, e.motivo);
  assert.ok(typeof r.astensione.motivo === 'string');
  // Niente gergo verso chi legge.
  const tutto = [...r.esperti.map((e) => e.motivo), r.astensione.motivo].join(' ');
  assert.ok(!/ECE|calibration|bins|entropy/i.test(tutto), tutto);
});
