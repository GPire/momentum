import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshness, freshnessSummary, scheduleChecks, nextBackoff, stalenessNote } from './data-freshness.js';

const NOW = new Date('2026-08-05T12:00:00Z').getTime();
const giorniFa = (n) => new Date(NOW - n * 86_400_000).toISOString();

// ── Età ──

test('una fonte recente non è vecchia', () => {
  const [a] = assessFreshness([{ id: 'x', label: 'Regole fiscali', generatedAt: giorniFa(10), maxAgeDays: 90 }], NOW);
  assert.equal(a.stale, false);
  assert.equal(a.ageDays, 10);
  assert.match(a.messaggio, /aggiornamento/);
});

test('una fonte oltre il limite dichiarato è vecchia, e lo dice in giorni', () => {
  const [a] = assessFreshness([{ id: 'x', label: 'Parametri di mercato', generatedAt: giorniFa(120), maxAgeDays: 90 }], NOW);
  assert.equal(a.stale, true);
  assert.equal(a.ageDays, 120);
  assert.match(a.messaggio, /non si aggiorna da 120 giorni/);
});

test('molto oltre il limite (2x) viene segnalato con enfasi maggiore', () => {
  const [a] = assessFreshness([{ id: 'x', label: 'Tracciato XML', generatedAt: giorniFa(400), maxAgeDays: 90 }], NOW);
  assert.match(a.messaggio, /parecchio oltre il normale/);
});

test('senza una data leggibile non si inventa un\'età', () => {
  const [a] = assessFreshness([{ id: 'x', label: 'Boh', generatedAt: 'non-una-data', maxAgeDays: 90 }], NOW);
  assert.equal(a.ageDays, null);
  assert.equal(a.stale, null);
  assert.match(a.messaggio, /sconosciuta/);
});

test('freshnessSummary distingue tutto aggiornato da qualcosa vecchio', () => {
  const tutto = assessFreshness([
    { id: 'a', label: 'A', generatedAt: giorniFa(5), maxAgeDays: 90 },
    { id: 'b', label: 'B', generatedAt: giorniFa(3), maxAgeDays: 90 },
  ], NOW);
  assert.equal(freshnessSummary(tutto), 'Tutti i dati sono aggiornati.');

  const qualcosa = assessFreshness([
    { id: 'a', label: 'A', generatedAt: giorniFa(5), maxAgeDays: 90 },
    { id: 'b', label: 'B', generatedAt: giorniFa(200), maxAgeDays: 90 },
  ], NOW);
  assert.match(freshnessSummary(qualcosa), /B non si aggiorna da 200 giorni/);
});

test('freshnessSummary con più fonti vecchie riporta la peggiore', () => {
  const varie = assessFreshness([
    { id: 'a', label: 'A', generatedAt: giorniFa(150), maxAgeDays: 90 },
    { id: 'b', label: 'B', generatedAt: giorniFa(300), maxAgeDays: 90 },
  ], NOW);
  const s = freshnessSummary(varie);
  assert.match(s, /2 fonti su 2/);
  assert.match(s, /B, 300 giorni/);
});

test('senza fonti non si inventa niente', () => {
  assert.equal(freshnessSummary([]), 'Nessuna fonte dati da controllare.');
});

// ── Priorità di controllo ──

test('una scadenza fiscale vicina alza la priorità, non l\'età da sola', () => {
  const sources = [
    { id: 'mercato', label: 'Parametri di mercato', generatedAt: giorniFa(200), maxAgeDays: 90, priority: 0.5 },
    { id: 'fisco', label: 'Regole fiscali', generatedAt: giorniFa(30), maxAgeDays: 180, priority: 0.5, dueInDays: 5 },
  ];
  const piano = scheduleChecks(sources, { now: NOW, budget: 2 });
  assert.equal(piano[0].id, 'fisco', `atteso il fisco per primo per la scadenza vicina, ottenuto: ${JSON.stringify(piano)}`);
  assert.equal(piano[0].motivo, 'scadenza vicina');
});

test('senza scadenze vicine, decide l\'età relativa al proprio limite', () => {
  const sources = [
    { id: 'a', label: 'A', generatedAt: giorniFa(10), maxAgeDays: 90, priority: 0.5 },
    { id: 'b', label: 'B', generatedAt: giorniFa(180), maxAgeDays: 90, priority: 0.5 },
  ];
  const piano = scheduleChecks(sources, { now: NOW, budget: 2 });
  assert.equal(piano[0].id, 'b');
});

test('il budget limita quante fonti si controllano insieme', () => {
  const sources = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, generatedAt: giorniFa(100 + i), maxAgeDays: 90 }));
  const piano = scheduleChecks(sources, { now: NOW, budget: 3 });
  assert.equal(piano.length, 3);
});

test('una priorità alta dichiarata dal chiamante pesa più di una bassa a parità di età', () => {
  const sources = [
    { id: 'basso', label: 'Poco importante', generatedAt: giorniFa(150), maxAgeDays: 90, priority: 0.1 },
    { id: 'alto', label: 'Molto importante', generatedAt: giorniFa(150), maxAgeDays: 90, priority: 0.9 },
  ];
  const piano = scheduleChecks(sources, { now: NOW, budget: 2 });
  assert.equal(piano[0].id, 'alto');
});

// ── Backoff ──

test('il backoff cresce ad ogni tentativo fallito, con un tetto', () => {
  const r = (n) => nextBackoff(n, { baseMs: 1000, maxMs: 10_000, randomFn: () => 0.5 }); // jitter neutro (0.75+0.5*0.5=1.0)
  assert.equal(r(1), 1000);
  assert.equal(r(2), 2000);
  assert.equal(r(3), 4000);
  assert.equal(r(10), 10_000, 'non deve mai superare il tetto');
});

test('il backoff non è mai identico a zero tentativi o negativo', () => {
  assert.ok(nextBackoff(0, { randomFn: () => 0.5 }) > 0);
  assert.ok(nextBackoff(-3, { randomFn: () => 0.5 }) > 0);
});

// ── Nota di vecchiezza per un numero mostrato ──

test('stalenessNote è null se i dati sono ancora freschi', () => {
  assert.equal(stalenessNote(giorniFa(10), { now: NOW, maxAgeDays: 90 }), null);
});

test('stalenessNote dice da quando i dati sono fermi', () => {
  const nota = stalenessNote(giorniFa(200), { now: NOW, maxAgeDays: 90, label: 'Questi rendimenti storici' });
  assert.match(nota, /Questi rendimenti storici non si aggiorna da 200 giorni/);
});

test('nessun testo contiene gergo tecnico', () => {
  const assessed = assessFreshness([{ id: 'x', label: 'Parametri', generatedAt: giorniFa(200), maxAgeDays: 90 }], NOW);
  const testo = assessed[0].messaggio + ' ' + freshnessSummary(assessed);
  assert.ok(!/timestamp|epoch|manifest|payload|scheduler/i.test(testo), `gergo trovato: ${testo}`);
});
