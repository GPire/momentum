import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextExpenseNudge, splitReminder, amountEntryImpact, amountVsTypical, monthTrajectoryFocus, splitCandidate } from './command-center.js';
import { createGroup, addSharedExpense, claimMember } from '../split/split-engine.js';
import { addMessage, contestExpense } from '../split/group-chat.js';

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

// ── splitReminder con opts.deviceId — BUG REALE trovato beta-testando
// (2026-08-27): senza deviceId, 'Io' era la stringa fissa confrontata coi
// nomi del gruppo — corretta SOLO per chi ha creato il gruppo (il cui slot
// si chiama davvero "Io"). Un dispositivo che si è unito a un gruppo altrui
// ha il proprio nome vero (es. "Marco"), mai "Io" — con deviceId, l'identità
// si risolve per SLOT RIVENDICATO, corretta per chiunque. ──
test('splitReminder con deviceId: chi si è unito a un gruppo (non lo ha creato) vede la direzione giusta, non invertita', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm1', 'device-marco');
  g = addSharedExpense(g, { payer: 'm0', amount: 100, description: 'Affitto', shares: { equalAmong: ['m0', 'm1'] } });
  // Dal punto di vista del dispositivo di Marco: lui DEVE 50€ (non li riceve).
  const r = splitReminder([g], { deviceId: 'device-marco' });
  assert.equal(r.show, true);
  assert.equal(r.direction, 'owe', 'Marco deve pagare, non deve ricevere — la vecchia versione lo segnava "owed" per errore');
  assert.equal(r.amount, 50);
});

test('splitReminder con deviceId: un dispositivo senza slot rivendicato in un gruppo lo ignora, mai un nome indovinato', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100, shares: { equalAmong: ['m0', 'm1'] } });
  // Nessuno slot rivendicato da 'device-sconosciuto': il gruppo non deve
  // contribuire al promemoria (mai un fallback silenzioso su 'Io').
  const r = splitReminder([g], { deviceId: 'device-sconosciuto' });
  assert.equal(r.show, false);
});

test('splitReminder con deviceId: il creatore del gruppo (slot "Io" rivendicato dal proprio device) continua a funzionare come prima', () => {
  let g = createGroup({ name: 'Cena', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Anna' }] });
  g = claimMember(g, 'm0', 'device-creatore');
  g = addSharedExpense(g, { payer: 'm0', amount: 40, shares: { equalAmong: ['m0', 'm1'] } });
  const r = splitReminder([g], { deviceId: 'device-creatore' });
  assert.equal(r.show, true);
  assert.equal(r.direction, 'owed');
  assert.equal(r.amount, 20);
});

// ── splitReminder → attività chat non vista (2026-08-27): quando NON c'è
// nessun saldo aperto ma qualcuno ha scritto in un gruppo, il promemoria
// segnala comunque — "un solo focus, mai rumore", ma un messaggio mai visto
// è un pending reale quanto un debito. ──
test('splitReminder: nessun saldo ma un messaggio mai visto → mostra "messages"', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addMessage(g, { autore: 'Marco', testo: 'Ci vediamo alle 9?', now: 1000 });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.show, true);
  assert.equal(r.direction, 'messages');
  assert.equal(r.groupId, g.id);
  assert.equal(r.count, 1);
});

test('splitReminder: un messaggio già visto (chatSeenAt aggiornato) non segnala più nulla', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addMessage(g, { autore: 'Marco', testo: 'Ci vediamo alle 9?', now: 1000 });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: { [g.id]: 2000 } });
  assert.equal(r.show, false);
});

test('splitReminder: il PROPRIO messaggio non conta mai come "non letto"', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addMessage(g, { autore: 'Io', testo: 'ho pagato io il taxi', now: 1000 });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.show, false, 'un messaggio scritto da me stesso non deve mai risultare "non letto"');
});

// ── splitReminder → spesa contestata non ancora chiarita (2026-08-27,
// segnalato dall'utente): groupForSettlement esclude le spese contestate dal
// saldo finché non sono risolte — un gruppo con SOLO una spesa contestata
// arriva qui con saldo zero, ma quei soldi non sono affatto "in pari". ──
test('splitReminder: nessun saldo pulito ma una spesa contestata → mostra "dispute", non silenzio', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addSharedExpense(g, { payer: 'm0', amount: 40, description: 'Taxi', shares: { equalAmong: ['m0', 'm1'] } });
  const expenseId = g.expenses[0].id;
  g = contestExpense(g, { autore: 'Marco', expenseId, motivo: 'non mi torna' });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.show, true);
  assert.equal(r.direction, 'dispute');
  assert.equal(r.groupId, g.id);
  assert.equal(r.amount, 40);
  assert.equal(r.count, 1);
});

test('splitReminder: una contestazione aperta ha priorità su un semplice messaggio (riguarda soldi)', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addSharedExpense(g, { payer: 'm0', amount: 40, shares: { equalAmong: ['m0', 'm1'] } });
  const expenseId = g.expenses[0].id;
  g = contestExpense(g, { autore: 'Marco', expenseId });
  g = addMessage(g, { autore: 'Marco', testo: 'ciao!', now: Date.now() });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.direction, 'dispute', 'i soldi in sospeso contano più di un messaggio generico');
});

test('splitReminder: un saldo aperto ha SEMPRE priorità anche su una contestazione altrove (un solo focus)', () => {
  let g1 = createGroup({ name: 'Affitto', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g1 = claimMember(g1, 'm0', 'device-io');
  g1 = addSharedExpense(g1, { payer: 'm0', amount: 800, shares: { equalAmong: ['m0', 'm1'] } });
  let g2 = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Sara' }] });
  g2 = claimMember(g2, 'm0', 'device-io');
  g2 = addSharedExpense(g2, { payer: 'm0', amount: 40, shares: { equalAmong: ['m0', 'm1'] } });
  g2 = contestExpense(g2, { autore: 'Sara', expenseId: g2.expenses[0].id });
  const r = splitReminder([g1, g2], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.direction, 'owed', 'il saldo vero (Affitto) vince sempre sulla contestazione di un altro gruppo');
});

test('splitReminder: un saldo aperto ha SEMPRE priorità su un messaggio non visto (un solo focus)', () => {
  let g = createGroup({ name: 'Weekend', members: [{ id: 'm0', name: 'Io' }, { id: 'm1', name: 'Marco' }] });
  g = claimMember(g, 'm0', 'device-io');
  g = addSharedExpense(g, { payer: 'm0', amount: 100, shares: { equalAmong: ['m0', 'm1'] } });
  g = addMessage(g, { autore: 'Marco', testo: 'grazie!', now: 1000 });
  const r = splitReminder([g], { deviceId: 'device-io', chatSeenAt: {} });
  assert.equal(r.direction, 'owed', 'il saldo da 50€ deve vincere sul semplice messaggio');
});

// ── amountEntryImpact (tastierino vivo) ──
test('amountEntryImpact: senza budget (safeToday null) → show:false', () => {
  assert.equal(amountEntryImpact({ safeToday: null, pendingAmount: 10 }).show, false);
});

test('amountEntryImpact: importo 0 → show:false', () => {
  assert.equal(amountEntryImpact({ safeToday: 50, pendingAmount: 0 }).show, false);
});

test('amountEntryImpact: spesa dentro il margine → ok con resto corretto', () => {
  const r = amountEntryImpact({ safeToday: 50, pendingAmount: 20 });
  assert.equal(r.show, true);
  assert.equal(r.level, 'ok');
  assert.equal(r.remaining, 30);
});

test('amountEntryImpact: quasi esaurito → warn (≤20% del margine)', () => {
  const r = amountEntryImpact({ safeToday: 50, pendingAmount: 45 }); // resta 5 = 10%
  assert.equal(r.level, 'warn');
  assert.equal(r.remaining, 5);
});

test('amountEntryImpact: sfora → over con overBy', () => {
  const r = amountEntryImpact({ safeToday: 50, pendingAmount: 70 });
  assert.equal(r.level, 'over');
  assert.equal(r.remaining, 0);
  assert.equal(r.overBy, 20);
});

test('amountEntryImpact: già oltre budget → qualunque spesa è over', () => {
  const r = amountEntryImpact({ safeToday: 0, isOverBudget: true, pendingAmount: 15 });
  assert.equal(r.level, 'over');
  assert.equal(r.overBy, 15);
});

// ── amountVsTypical (predittivo: più del solito?) ──
test('amountVsTypical: senza tipico affidabile → show:false', () => {
  assert.equal(amountVsTypical({ typicalAmount: null, pendingAmount: 40 }).show, false);
});

test('amountVsTypical: nella norma → non segnala', () => {
  assert.equal(amountVsTypical({ typicalAmount: 12, pendingAmount: 14 }).show, false);
});

test('amountVsTypical: molto sopra il solito → segnala high con ratio', () => {
  const r = amountVsTypical({ typicalAmount: 12, pendingAmount: 45 });
  assert.equal(r.show, true);
  assert.equal(r.level, 'high');
  assert.ok(r.ratio >= 1.8);
  assert.equal(r.typicalAmount, 12);
});

// ── monthTrajectoryFocus (traiettoria del mese) ──
const proj = (o) => ({ spentSoFar: 400, projectedTotal: 1200, projectedDelta: null, method: 'run-rate', daysRemaining: 15, ...o });

test('monthTrajectoryFocus: senza budget → show:false', () => {
  assert.equal(monthTrajectoryFocus({ projection: proj({ projectedDelta: 100 }), monthlyBudget: 0 }).show, false);
});

test('monthTrajectoryFocus: inizio mese (giorno < min) → show:false (niente rumore)', () => {
  const r = monthTrajectoryFocus({ projection: proj({ projectedDelta: 100 }), monthlyBudget: 1300, referenceDate: new Date('2026-07-02T12:00:00') });
  assert.equal(r.show, false);
});

test('monthTrajectoryFocus: rotta oltre budget → level over', () => {
  const r = monthTrajectoryFocus({ projection: proj({ projectedTotal: 1500, projectedDelta: -200 }), monthlyBudget: 1300, referenceDate: new Date('2026-07-15T12:00:00') });
  assert.equal(r.show, true);
  assert.equal(r.level, 'over');
  assert.equal(r.delta, -200);
});

test('monthTrajectoryFocus: margine risicato (≤10%) → tight', () => {
  const r = monthTrajectoryFocus({ projection: proj({ projectedTotal: 1250, projectedDelta: 50 }), monthlyBudget: 1300, referenceDate: new Date('2026-07-15T12:00:00') });
  assert.equal(r.level, 'tight');
});

test('monthTrajectoryFocus: sotto controllo → ok, e dichiara il metodo', () => {
  const r = monthTrajectoryFocus({ projection: proj({ projectedTotal: 900, projectedDelta: 400, method: 'holt-winters' }), monthlyBudget: 1300, referenceDate: new Date('2026-07-15T12:00:00') });
  assert.equal(r.level, 'ok');
  assert.equal(r.confident, true);
});

test('monthTrajectoryFocus: nulla speso ancora → show:false', () => {
  const r = monthTrajectoryFocus({ projection: proj({ spentSoFar: 0, projectedDelta: 500 }), monthlyBudget: 1300, referenceDate: new Date('2026-07-15T12:00:00') });
  assert.equal(r.show, false);
});

// ── splitCandidate ──
test('splitCandidate: mai per le entrate', () => {
  assert.equal(splitCandidate({ type: 'entrata', description: 'Cena', groups: [] }).show, false);
});

test('splitCandidate: nessun gruppo passato → generica, mai un nome inventato', () => {
  const r = splitCandidate({ type: 'uscita', description: 'Cena da Mario', groups: [] });
  assert.equal(r.show, true);
  assert.equal(r.confident, false);
  assert.equal(r.groupName, null);
});

test('splitCandidate: descrizione simile a una spesa già divisa → nomina il gruppo', () => {
  let g = createGroup({ name: 'Gita al mare', members: ['Io', 'Luca'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 60, description: 'Cena da Mario' });
  const r = splitCandidate({ type: 'uscita', description: 'Cena da Mario', groups: [g] });
  assert.equal(r.show, true);
  assert.equal(r.confident, true);
  assert.equal(r.groupName, 'Gita al mare');
});

test('splitCandidate: descrizione non correlata → resta generica', () => {
  let g = createGroup({ name: 'Gita al mare', members: ['Io', 'Luca'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 60, description: 'Benzina traghetto' });
  const r = splitCandidate({ type: 'uscita', description: 'Farmacia', groups: [g] });
  assert.equal(r.confident, false);
});
