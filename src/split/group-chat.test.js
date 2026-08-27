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

// `autore` è sempre il NOME visualizzato di chi scrive (mai un deviceId —
// vedi il commento su unreadCount in group-chat.js), quindi i test usano
// nomi reali ('Io'/'Marco'), non etichette generiche che mascondano il vero
// contratto della funzione (stessa lezione della mesh: mai testare con
// etichette che combaciano per costruzione se la produzione usa spazi
// diversi).
test('i non letti non contano i propri messaggi', () => {
  let g = addMessage(conSpese(), { autore: 'Io', testo: 'mio', now: 10 });
  g = addMessage(g, { autore: 'Marco', testo: 'suo', now: 20 });
  assert.equal(unreadCount(g, 'Io', 0), 1);
  assert.equal(unreadCount(g, 'Io', 20), 0);
});

test('BUG REALE (mai innescato, mai collegato a UI): un deviceId al posto del nome non troverebbe mai un match, contando ANCHE i propri messaggi come non letti', () => {
  let g = addMessage(conSpese(), { autore: 'Io', testo: 'mio', now: 10 });
  g = addMessage(g, { autore: 'Marco', testo: 'suo', now: 20 });
  // Un vero deviceId (UUID) non combacia mai con un `autore` (nome) — il
  // conteggio "sbagliato" salirebbe a 2 invece di 1, includendo il proprio
  // messaggio. Documenta perché il parametro DEVE essere il nome risolto.
  const finoDeviceIdFinto = unreadCount(g, 'a1b2c3d4-uuid-non-un-nome', 0);
  assert.equal(finoDeviceIdFinto, 2);
});

// SECONDO BUG REALE, trovato in test dal vivo (2026-08-27) con dati reali di
// un dispositivo in un gruppo con DUE membri chiamati "Marco": displayNames
// (split-engine.js) disambigua "Marco #1"/"Marco #2" solo al momento del
// render, in base all'ordine corrente dei membri — non è un'etichetta scritta
// una volta. Un messaggio mandato PRIMA della collisione porta `autore:
// "Marco"` (grezzo); uno mandato DOPO porta già "Marco #1" (disambiguato).
// Un solo nome "attuale" passato a unreadCount ne perde sempre uno dei due.
test('unreadCount accetta PIÙ nomi validi per "sono io" (nome grezzo + disambiguato): un messaggio proprio scritto prima di una collisione di nomi non risulta più "non letto"', () => {
  // Messaggio scritto quando "Marco" era ancora l'unico nel gruppo (autore grezzo).
  let g = addMessage(conSpese(), { autore: 'Marco', testo: 'prima della collisione', now: 10 });
  // Un secondo "Marco" si è unito dopo: da qui in poi main.js scrive autore
  // già disambiguato per i messaggi nuovi.
  g = addMessage(g, { autore: 'Marco #1', testo: 'dopo la collisione, ancora io', now: 20 });
  g = addMessage(g, { autore: 'Marco #2', testo: 'questo è davvero un altro', now: 30 });
  // Passando SOLO il nome disambiguato attuale, il primo messaggio (autore
  // grezzo "Marco") risulterebbe erroneamente non letto — bug reale trovato
  // dal vivo. Passando ENTRAMBI i candidati, si riconoscono correttamente
  // come propri sia il messaggio vecchio che quello nuovo.
  assert.equal(unreadCount(g, ['Marco', 'Marco #1'], 0), 1, 'solo il messaggio del vero altro membro (Marco #2) deve contare');
});

// Generalizza a N persone con lo STESSO nome (non solo 2): displayNames
// (split-engine.js) numera in ordine "#1".."#N" in base all'ordine dei
// membri, mai un numero fisso — il fix sopra passa il nome disambiguato
// RISOLTO PER QUESTO membro specifico (displayNames(g.members)[myId]), non
// un "#1"/"#2" scritto a mano: funziona identico con 2, 3 o 10 omonimi.
test('unreadCount con TRE persone chiamate "Marco" (non solo due): ognuna riconosce solo i propri messaggi come "letti"', () => {
  const g0 = createGroup({ name: 'Trasferta', members: ['Marco', 'Marco', 'Marco', 'Sara'] });
  // displayNames assegna "Marco #1"/"Marco #2"/"Marco #3" in ordine d'array.
  // Io sono il secondo "Marco" nell'array — sarà "Marco #2".
  let g = addMessage(g0, { autore: 'Marco #1', testo: 'msg del primo Marco', now: 10 });
  g = addMessage(g, { autore: 'Marco #2', testo: 'msg mio (secondo Marco)', now: 20 });
  g = addMessage(g, { autore: 'Marco #3', testo: 'msg del terzo Marco', now: 30 });
  g = addMessage(g, { autore: 'Sara', testo: 'msg di Sara', now: 40 });
  // Io sono "Marco #2": solo il MIO messaggio va escluso, gli altri 3 contano.
  assert.equal(unreadCount(g, ['Marco', 'Marco #2'], 0), 3);
});
