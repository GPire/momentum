'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcomingModelo130Deadlines, nextModelo130Deadline } from './tax-deadlines-es.js';

test('nextModelo130Deadline: nessun IRPF stimato -> null, mai un numero inventato', () => {
  assert.equal(nextModelo130Deadline(0), null);
  assert.equal(nextModelo130Deadline(null), null);
});

test('nextModelo130Deadline: 10 marzo 2026 -> prossima scadenza è il 20 aprile 2026 (1er trimestre)', () => {
  const d = nextModelo130Deadline(300, { now: new Date(Date.UTC(2026, 2, 10)) });
  assert.ok(d);
  assert.equal(d.date, '2026-04-20');
  assert.match(d.label, /1er trimestre/);
});

test('nextModelo130Deadline: 25 aprile 2026 (dopo la scadenza T1) -> passa a luglio, mai una scadenza già passata', () => {
  const d = nextModelo130Deadline(300, { now: new Date(Date.UTC(2026, 3, 25)) });
  assert.equal(d.date, '2026-07-20');
});

test('nextModelo130Deadline: dicembre 2026 -> la 4a scadenza (30 gennaio) cade nell\'anno successivo', () => {
  const d = nextModelo130Deadline(300, { now: new Date(Date.UTC(2026, 11, 1)) });
  // Il 30 gennaio 2027 è un sabato: slittaSeFestivo la sposta al lunedì
  // 1 febbraio — comportamento corretto (verificato: Sat, 30 Jan 2027).
  assert.equal(d.date, '2027-02-01');
  assert.match(d.label, /4º trimestre/);
});

test('importoStimato: sempre dichiarato come proiezione (flag stimato/approssimato), mai il calcolo ufficiale del 20% cumulato', () => {
  const d = nextModelo130Deadline(500, { now: new Date(Date.UTC(2026, 2, 1)) });
  assert.equal(d.importoStimato, 1500); // 500 * 3, non il 20% cumulato reale
  assert.equal(d.stimato, true);
  assert.equal(d.approssimato, true);
});

test('upcomingModelo130Deadlines: ordine cronologico su una finestra ampia, nessun duplicato', () => {
  const list = upcomingModelo130Deadlines(200, { now: new Date(Date.UTC(2026, 0, 1)), orizzonteGiorni: 400 });
  const dates = list.map(d => d.date);
  const sorted = [...dates].sort();
  assert.deepEqual(dates, sorted);
  assert.equal(new Set(dates).size, dates.length);
});

test('slittaSeFestivo riusato: una scadenza che cade di sabato/domenica slitta al lunedì (stessa disciplina IT)', () => {
  // 20 giugno 2026 non è nel calendario Modelo 130 — verifichiamo invece che
  // il meccanismo di rollback sia lo stesso già testato in tax-deadlines.js
  // controllando che nessuna data prodotta cada mai di sabato o domenica.
  const list = upcomingModelo130Deadlines(200, { now: new Date(Date.UTC(2026, 0, 1)), orizzonteGiorni: 800 });
  for (const d of list) {
    const day = new Date(d.date + 'T00:00:00Z').getUTCDay();
    assert.notEqual(day, 0, `${d.date} è una domenica`);
    assert.notEqual(day, 6, `${d.date} è un sabato`);
  }
});
