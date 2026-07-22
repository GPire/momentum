import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextExpenseNudge, splitReminder } from './command-center.js';
import { createGroup, addSharedExpense } from '../split/split-engine.js';

// Helper: costruisce N transazioni di una categoria in una data/ora fissa.
function tx(category, amount, dateISO) {
  return { id: Math.random(), type: 'uscita', category, amount, description: category, date: dateISO };
}

// Genera uno storico "caffè ogni mattina alle 8" abbastanza forte da far
// emergere un topPick con importo tipico stabile.
function morningCoffeeHistory(n = 30) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const day = String((i % 27) + 1).padStart(2, '0');
    const month = String((i % 6) + 1).padStart(2, '0');
    const t = tx('bar', 1.5, `2026-${month}-${day}T08:00:00`);
    const key = `2026-${month}`;
    (out[key] = out[key] || []).push(t);
  }
  return out;
}

test('nessun dato → show:false (mai inventare)', () => {
  const r = nextExpenseNudge({}, new Date('2026-07-22T08:00:00'));
  assert.equal(r.show, false);
});

test('storico debole (poche tx) → show:false', () => {
  const allTx = { '2026-07': [tx('bar', 1.5, '2026-07-01T08:00:00'), tx('bar', 1.5, '2026-07-02T08:00:00')] };
  const r = nextExpenseNudge(allTx, new Date('2026-07-22T08:00:00'));
  assert.equal(r.show, false);
});

test('pattern mattutino netto → propone la categoria con importo tipico', () => {
  const allTx = morningCoffeeHistory(30);
  const r = nextExpenseNudge(allTx, new Date('2026-07-22T08:15:00'));
  assert.equal(r.show, true);
  assert.equal(r.category, 'bar');
  assert.equal(r.typicalAmount, 1.5);
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
});

test('fuori fascia (sera) → non forza la spesa mattutina', () => {
  const allTx = morningCoffeeHistory(30);
  const r = nextExpenseNudge(allTx, new Date('2026-07-22T22:00:00'));
  // Alle 22 il pattern mattutino non è "il tuo momento": nessun nudge falso.
  assert.equal(r.show, false);
});

test('anti-ripetizione: se già registrata oggi nella stessa fascia → show:false', () => {
  const allTx = morningCoffeeHistory(30);
  // Aggiungo il caffè di OGGI stamattina.
  allTx['2026-07'] = allTx['2026-07'] || [];
  allTx['2026-07'].push(tx('bar', 1.5, '2026-07-22T08:05:00'));
  const r = nextExpenseNudge(allTx, new Date('2026-07-22T08:30:00'));
  assert.equal(r.show, false);
});

test('la stessa spesa in un altro giorno non conta come "già fatta oggi"', () => {
  const allTx = morningCoffeeHistory(30);
  // Caffè di IERI: non deve sopprimere il nudge di oggi.
  allTx['2026-07'] = allTx['2026-07'] || [];
  allTx['2026-07'].push(tx('bar', 1.5, '2026-07-21T08:05:00'));
  const r = nextExpenseNudge(allTx, new Date('2026-07-22T08:30:00'));
  assert.equal(r.show, true);
});

// ── splitReminder ──
test('splitReminder: nessun gruppo → show:false', () => {
  assert.equal(splitReminder([]).show, false);
  assert.equal(splitReminder(undefined).show, false);
});

test('splitReminder: gruppo senza spese → show:false', () => {
  const g = createGroup({ name: 'Cena', members: ['Io', 'Anna'] });
  assert.equal(splitReminder([g]).show, false);
});

test('splitReminder: se PAGO io e dividiamo, gli altri devono a me (owed)', () => {
  let g = createGroup({ name: 'Cena', members: ['Io', 'Anna'] });
  const ioId = g.members.find(m => m.name === 'Io').id;
  g = addSharedExpense(g, { payer: ioId, amount: 40 }); // 20 a testa, Anna deve 20 a Io
  const r = splitReminder([g]);
  assert.equal(r.show, true);
  assert.equal(r.direction, 'owed');
  assert.equal(r.amount, 20);
  assert.equal(r.groupName, 'Cena');
});

test('splitReminder: se paga un altro, IO devo (owe)', () => {
  let g = createGroup({ name: 'Vacanza', members: ['Io', 'Anna'] });
  const annaId = g.members.find(m => m.name === 'Anna').id;
  g = addSharedExpense(g, { payer: annaId, amount: 100 }); // 50 a testa, Io devo 50
  const r = splitReminder([g]);
  assert.equal(r.show, true);
  assert.equal(r.direction, 'owe');
  assert.equal(r.amount, 50);
});

test('splitReminder: sceglie il gruppo con importo più rilevante', () => {
  let g1 = createGroup({ name: 'Caffè', members: ['Io', 'Bea'] });
  let g2 = createGroup({ name: 'Affitto', members: ['Io', 'Bea'] });
  const io1 = g1.members.find(m => m.name === 'Io').id;
  const io2 = g2.members.find(m => m.name === 'Io').id;
  g1 = addSharedExpense(g1, { payer: io1, amount: 6 });    // owed 3
  g2 = addSharedExpense(g2, { payer: io2, amount: 800 });  // owed 400
  const r = splitReminder([g1, g2]);
  assert.equal(r.show, true);
  assert.equal(r.groupName, 'Affitto');
  assert.equal(r.amount, 400);
  assert.equal(r.groups, 2);
});
