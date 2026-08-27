// ============================================================
// PARLARSI DENTRO IL GRUPPO — ma non un messaggero in più
// ============================================================
// LA COSA ONESTA, DETTA PRIMA DI TUTTO: questo NON batte Signal, e non ci
// prova. Signal fa una cosa diversa e la fa benissimo — identità verificata,
// consegna garantita da un'infrastruttura vera, gruppi da migliaia di persone,
// chiamate, allegati. Momentum non ha niente di tutto questo e non deve
// fingere di averlo: senza server, un messaggio arriva quando i due
// dispositivi si incontrano o quando qualcuno lo porta a staffetta. Su quel
// terreno perderemmo, e prometterlo sarebbe la facciata che questo progetto
// vieta.
//
// QUELLO CHE INVECE NESSUNO PUÒ FARE, ed è il motivo per cui questo esiste:
// **la conversazione vive attaccata ai soldi**.
// La discussione vera in un gruppo di spese non è "ciao come stai": è
//    "questo taxi da 40 € chi l'ha preso?"
//    "il conto era 120 non 100, ho aggiunto la mancia"
//    "io quella sera non c'ero"
// Sono messaggi che hanno senso SOLO accanto a una riga di spesa precisa.
// Oggi quella conversazione avviene su WhatsApp, staccata dai numeri, e tre
// giorni dopo nessuno ricorda a quale spesa si riferisse. Splitwise ha i
// commenti, ma stanno sul suo server: chi li ospita li legge.
//
// Qui un messaggio è ANCORATO (`expenseId`) e viaggia nello stesso CRDT del
// gruppo — quindi arriva ovunque arrivi la spesa, funziona offline, e non
// passa da nessun server. È l'unico posto dove la frase e il numero di cui
// parla stanno insieme, per sempre, senza che nessun altro li veda.
//
// PIÙ UTILE DI UNA CHAT, e questo è il pezzo davvero nuovo: una contestazione
// non è solo testo. `tipo: 'contestazione'` su una spesa la marca come
// **in discussione**, e una spesa in discussione NON entra nel saldo finché
// non è risolta. Cioè la conversazione cambia i conti, invece di correre a
// fianco dei conti. È la differenza tra un commento e uno strumento.
'use strict';

export const TIPI = ['messaggio', 'contestazione', 'risolto'];
// Limite volutamente basso: questo non è un messaggero. Un testo lungo qui è
// il segnale che la conversazione vera va fatta altrove.
export const MAX_TESTO = 500;
// Quanti messaggi si conservano per gruppo. Il vault non deve diventare un
// archivio di chat: oltre, i più vecchi cadono (i più recenti sono quelli che
// servono a capire una spesa aperta).
export const MAX_MESSAGGI = 300;

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Aggiunge un messaggio. Puro e immutabile, come tutto il resto dello split.
// `expenseId` opzionale: senza, è un messaggio al gruppo; con, è ancorato a
// quella spesa — ed è il caso che conta.
export function addMessage(group, { autore, testo, expenseId = null, tipo = 'messaggio', now = Date.now() } = {}) {
  if (!group) return group;
  const t = String(testo ?? '').trim().slice(0, MAX_TESTO);
  if (!t || !autore) return group;
  if (!TIPI.includes(tipo)) return group;
  if (expenseId && !(group.expenses || []).some((e) => e.id === expenseId)) return group;
  const msg = { id: genId(), autore, testo: t, expenseId, tipo, at: now };
  const chat = [...(group.chat || []), msg].slice(-MAX_MESSAGGI);
  return { ...group, chat };
}

// Contestare una spesa: un messaggio con un effetto. Da qui in poi quella
// spesa è "in discussione" e resta fuori dai saldi.
export function contestExpense(group, { autore, expenseId, motivo, now = Date.now() } = {}) {
  if (!expenseId || !(group?.expenses || []).some((e) => e.id === expenseId)) return group;
  return addMessage(group, { autore, testo: motivo || 'Questa spesa non mi torna', expenseId, tipo: 'contestazione', now });
}

// Chiudere la discussione. Chiunque nel gruppo può farlo: se una persona
// contesta e un'altra chiarisce, il conto deve poter ripartire senza dover
// aspettare chi ha contestato — che magari non apre l'app da una settimana.
// Resta scritto CHI ha risolto e quando: la storia non si cancella.
export function resolveExpense(group, { autore, expenseId, nota, now = Date.now() } = {}) {
  if (!expenseId || !isDisputed(group, expenseId)) return group;
  return addMessage(group, { autore, testo: nota || 'Chiarito', expenseId, tipo: 'risolto', now });
}

// Una spesa è in discussione se l'ULTIMO evento su di essa è una
// contestazione. Contestare, chiarire e ricontestare deve funzionare.
export function isDisputed(group, expenseId) {
  const eventi = (group?.chat || [])
    .filter((m) => m.expenseId === expenseId && (m.tipo === 'contestazione' || m.tipo === 'risolto'))
    .sort((a, b) => a.at - b.at);
  return eventi.length > 0 && eventi[eventi.length - 1].tipo === 'contestazione';
}

export function disputedExpenseIds(group) {
  return (group?.expenses || []).map((e) => e.id).filter((id) => isDisputed(group, id));
}

// Le spese che entrano nei conti: quelle non in discussione. È il ponte fra
// la conversazione e i numeri — l'unico motivo per cui questa non è una chat.
export function settleableExpenses(group) {
  return (group?.expenses || []).filter((e) => !isDisputed(group, e.id));
}

// Il gruppo "come se" le spese contestate non ci fossero, da passare ai
// calcoli di saldo esistenti senza toccarli.
export function groupForSettlement(group) {
  if (!group) return group;
  const aperte = disputedExpenseIds(group);
  if (!aperte.length) return group;
  return { ...group, expenses: settleableExpenses(group) };
}

export function messagesFor(group, expenseId = null) {
  return (group?.chat || []).filter((m) => m.expenseId === expenseId).sort((a, b) => a.at - b.at);
}

// BUG REALE trovato (2026-08-27), mai innescato in produzione perché la
// funzione non era ancora collegata a nessuna UI: `autore` in ogni messaggio
// è il NOME visualizzato di chi scrive (`addMessage(g, { autore: myName,
// ... })` in main.js — "Io"/"Marco"/ecc.), MAI un deviceId. Confrontare
// `m.autore !== deviceId` con un vero deviceId (una UUID) non avrebbe MAI
// combaciato, per costruzione — ogni messaggio, compresi i propri, sarebbe
// contato come "non letto da qualcun altro". Stessa classe di bug già
// trovata e corretta per il nodeId della mesh (main.js): due spazi di
// identità indipendenti che sembrano equivalenti solo nei test con etichette
// scelte a mano. Fix: il terzo parametro è ora il NOME risolto di questo
// dispositivo in QUESTO gruppo (es. via myMemberId+displayNames), non un
// deviceId grezzo — coerente con come `autore` è scritto davvero.
// SECONDO BUG REALE trovato (2026-08-27), in test dal vivo con dati reali di
// un dispositivo con due membri chiamati "Marco" nello stesso gruppo:
// `displayNames()` (split-engine.js) disambigua i nomi duplicati SOLO al
// momento del render ("Marco #1"/"Marco #2"), in base all'ordine corrente
// dei membri — non è un'etichetta scritta una volta e stabile. Un messaggio
// mandato PRIMA che esistesse la collisione ha `autore:"Marco"` (nome
// grezzo); uno mandato DOPO ha `autore:"Marco #1"` (già disambiguato, da
// main.js). Confrontare con UN SOLO nome "attuale" perde sempre l'altro
// caso — gli stessi messaggi di chi scrive risultavano "non letti da un
// altro". Fix: si accettano PIÙ nomi validi per "sono io" (il nome grezzo
// del proprio membro E la sua versione disambiguata corrente) — copre
// entrambi gli stati possibili senza dover riscrivere la chat esistente.
export function unreadCount(group, meNames, lastSeenAt = 0) {
  const mine = new Set(Array.isArray(meNames) ? meNames : [meNames]);
  return (group?.chat || []).filter((m) => m.at > lastSeenAt && !mine.has(m.autore)).length;
}

// ── Il merge, che è la parte che rende la chat P2P invece che locale ──
// Un messaggio è immutabile e ha un id univoco: unione per id, ordinata nel
// tempo. Non serve last-writer-wins — non esiste "modificare" un messaggio,
// e non doverlo gestire elimina un'intera classe di conflitti.
export function mergeChat(a = [], b = []) {
  const byId = new Map();
  for (const m of [...(a || []), ...(b || [])]) if (m && m.id) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.at - y.at).slice(-MAX_MESSAGGI);
}

// Riassunto per l'interfaccia: quante discussioni aperte e su quanti soldi.
// Un numero che cambia una decisione ("prima di saldare, chiarite questi
// 40 €") vale più di un pallino con un conteggio.
export function chatStatus(group) {
  const aperte = disputedExpenseIds(group);
  const importo = (group?.expenses || [])
    .filter((e) => aperte.includes(e.id))
    .reduce((s, e) => s + (+e.amount || 0), 0);
  return {
    discussioniAperte: aperte.length,
    importoInDiscussione: +importo.toFixed(2),
    messaggi: (group?.chat || []).length,
    testo: aperte.length
      ? `${aperte.length === 1 ? 'Una spesa è' : aperte.length + ' spese sono'} in discussione (${importo.toFixed(2).replace('.', ',')} €): ${aperte.length === 1 ? 'resta' : 'restano'} fuori dai conti finché non chiarite.`
      : null,
  };
}
