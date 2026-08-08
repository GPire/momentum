'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMessage, contestExpense, resolveExpense, isDisputed, disputedExpenseIds,
  settleableExpenses, groupForSettlement, messagesFor, unreadCount, mergeChat,
  chatStatus, MAX_TESTO, MAX_MESSAGGI,
} from './group-chat.js';
import { createGroup, addSharedExpense, mergeGroups, computeBalances } from './split-engine.js';

function conSpese() {
  let g = createGroup({ name: 'Weekend', members: ['Io', 'Marco', 'Sara'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 120, description: 'Cena' });
  g = addSharedExpense(g, { payer: 'm1', amount: 40, description: 'Taxi' });
  return g;
}
const idTaxi = (g) => g.expenses.find((e) => e.description === 'Taxi').id;

test('un messaggio si ancora a una spesa precisa', () => {
  const g0 = conSpese();
  const g = addMessage(g0, { autore: 'dev-io', testo: 'Questo taxi chi l\'ha preso?', expenseId: idTaxi(g0) });
  assert.equal(messagesFor(g, idTaxi(g0)).length, 1);
  assert.equal(messagesFor(g, null).length, 0, 'un messaggio ancorato non e\' un messaggio al gruppo');
});

test('un messaggio ancorato a una spesa INESISTENTE viene rifiutato', () => {
  const g = conSpese();
  assert.equal(addMessage(g, { autore: 'x', testo: 'ciao', expenseId: 'non-esiste' }).chat, undefined);
});

test('messaggi vuoti, senza autore o di tipo sconosciuto non entrano', () => {
  const g = conSpese();
  for (const bad of [{ autore: 'x', testo: '' }, { autore: 'x', testo: '   ' }, { testo: 'ciao' }, { autore: 'x', testo: 'ciao', tipo: 'strano' }]) {
    assert.equal(addMessage(g, bad).chat, undefined, JSON.stringify(bad));
  }
});

test('il testo si taglia: questo non e\' un messaggero', () => {
  const g = addMessage(conSpese(), { autore: 'x', testo: 'a'.repeat(MAX_TESTO + 500) });
  assert.equal(g.chat[0].testo.length, MAX_TESTO);
});

// ══ IL PEZZO CHE NON E' UNA CHAT: la conversazione cambia i conti ══

test('IL PUNTO: una spesa contestata ESCE dai saldi finche\' non e\' chiarita', () => {
  const g0 = conSpese();
  const saldiPieni = computeBalances(g0);
  const g = contestExpense(g0, { autore: 'dev-sara', expenseId: idTaxi(g0), motivo: 'Io non c\'ero' });

  assert.equal(isDisputed(g, idTaxi(g0)), true);
  assert.equal(settleableExpenses(g).length, 1, 'resta solo la cena');
  const saldiRidotti = computeBalances(groupForSettlement(g));
  assert.notDeepEqual(saldiRidotti, saldiPieni,
    'se contestare non cambiasse i conti sarebbe un commento, non uno strumento');
});

test('chiarita la discussione, la spesa RIENTRA nei conti', () => {
  const g0 = conSpese();
  let g = contestExpense(g0, { autore: 'dev-sara', expenseId: idTaxi(g0) });
  g = resolveExpense(g, { autore: 'dev-marco', expenseId: idTaxi(g0), nota: 'Era il taxi di tutti e tre' });
  assert.equal(isDisputed(g, idTaxi(g0)), false);
  assert.deepEqual(computeBalances(groupForSettlement(g)), computeBalances(g0));
});

test('contestare, chiarire e RICONTESTARE deve funzionare (vince l\'ultimo evento)', () => {
  const g0 = conSpese(); const id = idTaxi(g0);
  let g = contestExpense(g0, { autore: 'a', expenseId: id, now: 1000 });
  g = resolveExpense(g, { autore: 'b', expenseId: id, now: 2000 });
  g = contestExpense(g, { autore: 'a', expenseId: id, now: 3000 });
  assert.equal(isDisputed(g, id), true);
});

test('chiunque puo\' chiudere la discussione, non solo chi l\'ha aperta', () => {
  const g0 = conSpese(); const id = idTaxi(g0);
  let g = contestExpense(g0, { autore: 'dev-sara', expenseId: id });
  g = resolveExpense(g, { autore: 'dev-marco', expenseId: id });
  assert.equal(isDisputed(g, id), false,
    'aspettare chi ha contestato — che magari non apre l\'app da una settimana — bloccherebbe tutti');
});

test('la storia non si cancella: contestazione e chiarimento restano scritti', () => {
  const g0 = conSpese(); const id = idTaxi(g0);
  let g = contestExpense(g0, { autore: 'a', expenseId: id, motivo: 'Non c\'ero', now: 1 });
  g = resolveExpense(g, { autore: 'b', expenseId: id, nota: 'Hai ragione', now: 2 });
  const storia = messagesFor(g, id);
  assert.equal(storia.length, 2);
  assert.deepEqual(storia.map((m) => m.tipo), ['contestazione', 'risolto']);
  assert.deepEqual(storia.map((m) => m.autore), ['a', 'b']);
});

test('contestare una spesa inesistente non fa niente', () => {
  const g = conSpese();
  assert.equal(contestExpense(g, { autore: 'a', expenseId: 'boh' }), g);
});

test('chiarire una spesa NON contestata non inventa un evento', () => {
  const g0 = conSpese();
  assert.equal(resolveExpense(g0, { autore: 'a', expenseId: idTaxi(g0) }), g0);
});

// ══ P2P: la conversazione viaggia con la spesa ══

test('la chat si fonde fra dispositivi, senza duplicati e in ordine', () => {
  const g0 = conSpese(); const id = idTaxi(g0);
  const suA = addMessage(g0, { autore: 'a', testo: 'Chi ha preso il taxi?', expenseId: id, now: 100 });
  const suB = addMessage(g0, { autore: 'b', testo: 'Io e Sara', expenseId: id, now: 200 });
  const fuso = mergeGroups(suA, suB);
  assert.equal(fuso.chat.length, 2);
  assert.deepEqual(fuso.chat.map((m) => m.autore), ['a', 'b']);
  // Idempotente e commutativo: rifondere non duplica, e l'ordine non conta.
  assert.equal(mergeGroups(fuso, suA).chat.length, 2);
  assert.deepEqual(mergeGroups(suB, suA).chat.map((m) => m.at), [100, 200]);
});

test('UNA CONTESTAZIONE ARRIVATA VIA SYNC toglie la spesa dai conti anche qui', () => {
  const g0 = conSpese(); const id = idTaxi(g0);
  const daSara = contestExpense(g0, { autore: 'dev-sara', expenseId: id });
  const mio = mergeGroups(g0, daSara);
  assert.equal(isDisputed(mio, id), true,
    'e\' questo che rende la discussione utile: cambia i conti su OGNI dispositivo, offline');
});

test('la chat non fa crescere il vault all\'infinito', () => {
  let g = conSpese();
  for (let i = 0; i < MAX_MESSAGGI + 120; i++) g = addMessage(g, { autore: 'a', testo: `m${i}`, now: i });
  assert.equal(g.chat.length, MAX_MESSAGGI);
  assert.equal(mergeChat(g.chat, g.chat).length, MAX_MESSAGGI);
});

test('un gruppo senza chat resta identico dopo il merge (nessun campo inventato)', () => {
  const g = conSpese();
  assert.equal(mergeGroups(g, g).chat, undefined);
});

// ══ Cosa si dice all'utente ══

test('il riassunto dice QUANTI SOLDI sono in discussione, non un pallino', () => {
  const g0 = conSpese();
  const g = contestExpense(g0, { autore: 'a', expenseId: idTaxi(g0) });
  const s = chatStatus(g);
  assert.equal(s.discussioniAperte, 1);
  assert.equal(s.importoInDiscussione, 40);
  assert.match(s.testo, /40,00 €/);
  assert.match(s.testo, /restano fuori dai conti|resta fuori dai conti/);
});

test('senza discussioni aperte non si dice niente', () => {
  assert.equal(chatStatus(conSpese()).testo, null);
});

test('i non letti non contano i propri messaggi', () => {
  let g = addMessage(conSpese(), { autore: 'dev-io', testo: 'mio', now: 10 });
  g = addMessage(g, { autore: 'dev-altro', testo: 'suo', now: 20 });
  assert.equal(unreadCount(g, 'dev-io', 0), 1);
  assert.equal(unreadCount(g, 'dev-io', 20), 0);
});
