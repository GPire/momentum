// ============================================================
// STAFFETTA DELLA CONOSCENZA — dati pubblici verificati, condivisi via mesh
// ============================================================
// Quando UN dispositivo riesce a raggiungere una fonte primaria (FRED, BCE,
// un listino azionario) e la verifica con `fetchVerified` (sources.js), oggi
// quel lavoro resta suo. Un altro dispositivo della stessa mesh — dietro un
// firewall aziendale che blocca le API, senza la chiave dell'utente, con la
// fonte in rate-limit proprio in quel momento — riparte da zero, anche se un
// altro dispositivo ha ESATTAMENTE il dato che gli serve. La distanza fisica
// non conta: che sia lo stesso tavolo o l'altro capo del mondo, il percorso è
// lo stesso — diretto se possibile, altrimenti a ponte (relay-election.js) o
// a staffetta differita (store-forward.js), esattamente come per ogni altro
// dato che viaggia sulla mesh. Questo modulo non apre un canale nuovo: decide
// SOLO cosa è lecito far viaggiare su quelli che già esistono, e con quale
// fiducia trattarlo una volta arrivato.
//
// QUESTO MODULO condivide SOLO dati che sono già pubblici per natura e già
// passati dal cancello di verifica all'origine (`trainingEligible`): serie di
// mercato, tassi macro, aliquote firmate. MAI risposte del QA, MAI ragionamenti
// su transazioni personali, MAI nulla che sia legato ai dati dell'utente — non
// per prudenza generica, ma perché quei dati sono di UNA persona sola e non
// hanno niente a che fare con "cosa dice il mercato oggi", che è uguale per
// tutti. La stessa distinzione già tracciata in federated-distillation.js
// (L0 mai, L3 pubblico sempre) si applica qui in modo ancora più netto: qui
// non c'è nemmeno un livello intermedio da proteggere, il dato è pubblico o
// non si condivide affatto.
//
// L'ANTI-AVVELENAMENTO NON SI FIDA DELL'ETICHETTA DEL MITTENTE. Un peer può
// dichiarare "confirmed" qualunque cosa: quella dichiarazione è un indizio,
// mai una prova. Ogni dato ricevuto passa DI NUOVO dal controllo di
// plausibilità LOCALE (la stessa funzione che sources.js usa sui propri
// fetch) prima di essere anche solo considerato. E un singolo peer non può
// mai da solo rendere un dato "affidabile quanto verificato da due fonti":
// serve o (a) un secondo peer INDIPENDENTE che porti un dato compatibile
// (cross-check, esattamente come fra due fonti dirette), o (b) che il
// mittente stesso dichiari di averlo già incrociato a monte — e in quel caso
// la sua REPUTAZIONE nella mesh (update-ledger.js, lo stesso registro già
// usato per l'apprendimento federato) decide se quella dichiarazione basta.
// Un peer con una storia di dati scartati non ottiene un lasciapassare.
'use strict';

import { crossCheck, plausibility } from '../alpha/sources.js';
import { peerReputation, appendUpdate } from './update-ledger.js';

// Payload tenuto piccolo di proposito: la mesh porta questo su un canale
// dati WebRTC o dentro un pacchetto a staffetta, non un allegato.
export const MAX_PUNTI_RELAY = 90;
// Sotto questa reputazione, la sola parola del peer non basta: serve un
// secondo peer indipendente anche se il mittente dichiara "confirmed".
export const REPUTAZIONE_MINIMA_FIDATA = 0.5;
// Oltre questa età il dato non vale la pena di essere propagato: un tasso
// BCE di tre mesi fa non aiuta nessuno, e propagarlo sposterebbe le stime
// di freschezza di chi lo riceve in modo fuorviante.
export const ETA_MASSIMA_RELAY_MS = 14 * 24 * 3600 * 1000;

function chiave(symbol, kind) { return `${kind}:${symbol}`; }

// Prepara un pacchetto da mandare in giro. Ritorna null (non un pacchetto
// vuoto) se il risultato non è già eleggibile: la staffetta non deve MAI
// far viaggiare un dato che l'origine stessa ha escluso dall'addestramento
// — altrimenti l'etichetta "esclusa" andrebbe persa proprio nel passaggio
// dove servirebbe di più.
export function packForRelay(result, { symbol, kind, now = Date.now() } = {}) {
  if (!result || !symbol || !kind) return null;
  if (result.verified !== 'confirmed' && result.verified !== 'single-source') return null;
  if (!Array.isArray(result.prices) || !result.prices.length) return null;
  const eta = now - new Date(result.asOf || 0).getTime();
  if (!Number.isFinite(eta) || eta < 0 || eta > ETA_MASSIMA_RELAY_MS) return null;
  return {
    v: 1, symbol, kind,
    prices: result.prices.slice(-MAX_PUNTI_RELAY),
    source: result.source, asOf: result.asOf, verified: result.verified,
  };
}

export function initKnowledgeStore() { return {}; }

// Riceve un pacchetto da UN peer. Pura: nessuna rete, nessun DOM — così la
// si può fuzzare con mille combinazioni senza un browser.
//
// `ledger` (opzionale) segue la STESSA convenzione immutabile già usata in
// tutto il progetto (update-ledger.js, vedi `onGradientReceived` in
// main.js): `appendUpdate` non muta l'array, ne ritorna uno nuovo. Per
// questo il risultato porta sempre `ledger` — anche quando non cambia nulla
// — così il chiamante può fare `VaultDAO.state.qualcosa = r.ledger` in modo
// uniforme, senza doversi ricordare caso per caso se è stato toccato.
export function receiveRelayed(store, msg, fromPeerId, { now = Date.now(), ledger = null } = {}) {
  if (!msg || msg.v !== 1 || !msg.symbol || !msg.kind || !fromPeerId) {
    return { accepted: false, reason: 'pacchetto malformato', ledger };
  }
  if (!Array.isArray(msg.prices) || !msg.prices.length) {
    return { accepted: false, reason: 'nessun dato dentro il pacchetto', ledger };
  }
  const eta = now - new Date(msg.asOf || 0).getTime();
  if (!Number.isFinite(eta) || eta < -60_000 || eta > ETA_MASSIMA_RELAY_MS) {
    // asOf nel futuro (oltre un piccolo scarto d'orologio) o troppo vecchio:
    // in entrambi i casi non è un dato su cui costruire qualcosa.
    return { accepted: false, reason: 'data non plausibile (nel futuro o troppo vecchia)', ledger };
  }

  // IL CANCELLO CHE CONTA: la plausibilità si ricontrolla QUI, in locale,
  // sui numeri veri — mai fidandosi che il mittente dica "confirmed".
  const pl = plausibility(msg.prices, { richiedePositivo: msg.kind !== 'macro' });
  if (!pl.plausible) {
    const nuovoLedger = ledger ? appendUpdate(ledger, { peerId: fromPeerId, accepted: false, reason: 'relay implausibile: ' + pl.reasons.join('; ') }) : ledger;
    return { accepted: false, reason: 'implausibile: ' + pl.reasons.join('; '), ledger: nuovoLedger };
  }

  const key = chiave(msg.symbol, msg.kind);
  const esistente = store[key];
  const eraGiaCorroboratoDaMe = !!esistente?.corroboratedBy?.includes(fromPeerId);

  // Se esiste già un dato per questa chiave, il nuovo arrivato deve essere
  // D'ACCORDO con quello che è già lì per contare qualcosa. Un dato in
  // disaccordo NON diventa mai corroborazione — altrimenti basterebbe
  // mandare QUALUNQUE numero per gonfiare il conteggio dei testimoni, che è
  // esattamente il buco che questo cancello esiste per chiudere.
  let concorda = true;
  if (esistente && esistente.prices?.length) {
    concorda = crossCheck(esistente.prices, msg.prices).confirmed;
  }

  if (esistente && !concorda) {
    // Disaccordo con un dato già presente: non si tocca lo store (un
    // secondo dato più fresco ma discorde non deve poter scalzare in
    // silenzio un valore su cui un altro dispositivo già contava), e non si
    // registra come corroborazione. Resta comunque un pacchetto "accettato"
    // dal punto di vista della plausibilità — la reputazione del peer non
    // crolla per essere in disaccordo, solo per mandare dati rotti.
    const nl = ledger ? appendUpdate(ledger, { peerId: fromPeerId, accepted: true, reason: 'in disaccordo con dato gia\' noto, non fuso' }) : ledger;
    return { accepted: true, corroborato: false, affidabile: !!esistente.trainingEligible, testimoni: esistente.corroboratedBy?.length || 0, ledger: nl };
  }

  const corroboratori = new Set(esistente?.corroboratedBy || []);
  corroboratori.add(fromPeerId);
  const corroboratoOra = !!esistente && !eraGiaCorroboratoDaMe;

  const reputazione = ledger ? peerReputation(ledger, fromPeerId).score : REPUTAZIONE_MINIMA_FIDATA;
  // Un mittente che dichiara "confirmed" (ha già incrociato due fonti lui
  // stesso) basta DA SOLO solo se la sua storia nella mesh lo giustifica.
  // Sotto la soglia, anche un "confirmed" dichiarato resta un solo indizio:
  // serve comunque un secondo peer indipendente per fidarsi davvero.
  const mittenteBastaDaSolo = msg.verified === 'confirmed' && reputazione >= REPUTAZIONE_MINIMA_FIDATA;
  const affidabile = corroboratori.size >= 2 || mittenteBastaDaSolo;

  // A parità di accordo, si tiene la serie più lunga o più fresca: non si
  // butta via un dato buono solo perché è arrivato per secondo, ma nemmeno
  // lo si sostituisce con uno peggiore solo perché è arrivato per ultimo.
  const megliore = !esistente
    || msg.prices.length > esistente.prices.length
    || new Date(msg.asOf) > new Date(esistente.asOf || 0);

  store[key] = megliore
    ? { symbol: msg.symbol, kind: msg.kind, prices: msg.prices, asOf: msg.asOf, source: msg.source, corroboratedBy: [...corroboratori], trainingEligible: affidabile }
    : { ...esistente, corroboratedBy: [...corroboratori], trainingEligible: affidabile };

  const nuovoLedger = ledger ? appendUpdate(ledger, { peerId: fromPeerId, accepted: true }) : ledger;
  return { accepted: true, corroborato: corroboratoOra, affidabile, testimoni: corroboratori.size, ledger: nuovoLedger };
}

// Il meglio che si conosce per una chiave, fondendo locale e relay. Mai
// silenzioso su DA DOVE viene: la provenienza resta leggibile fino in fondo.
export function bestKnown(store, symbol, kind) {
  const e = store[chiave(symbol, kind)];
  if (!e) return null;
  return {
    ...e,
    nota: e.trainingEligible
      ? (e.corroboratedBy.length >= 2
        ? `Confermato da ${e.corroboratedBy.length} dispositivi indipendenti nella mesh.`
        : 'Confermato dal dispositivo che l\'ha raccolto, con reputazione sufficiente nella mesh.')
      : 'Ricevuto da un solo dispositivo, non ancora confermato: mostrato con cautela, escluso dall\'addestramento.',
  };
}

// Pulizia: via le voci troppo vecchie per restare utili. Il vault non deve
// crescere all'infinito con serie che nessuno userebbe più.
export function pruneKnowledge(store, { now = Date.now(), maxAgeMs = ETA_MASSIMA_RELAY_MS } = {}) {
  for (const key of Object.keys(store)) {
    const eta = now - new Date(store[key].asOf || 0).getTime();
    if (!Number.isFinite(eta) || eta > maxAgeMs) delete store[key];
  }
  return store;
}
