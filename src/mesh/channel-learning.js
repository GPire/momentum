// ============================================================
// LA RETE CHE IMPARA QUALE CANALE FUNZIONA, QUI E ADESSO
// ============================================================
// nat-matrix.js dice cosa dovrebbe succedere, secondo la fisica nota dei NAT.
// È corretto, ma è un modello generale: non sa che l'operatore mobile del tuo
// paese chiude le porte UDP dopo 15 secondi, che una particolare accoppiata
// router+ISP si comporta in modo più permissivo del previsto, o che un ponte
// specifico è quasi sempre affidabile mentre un altro cade spesso.
//
// Questo modulo non sostituisce la fisica: la usa come PUNTO DI PARTENZA e la
// CORREGGE con quello che succede davvero, dispositivo per dispositivo e poi
// — federato — mesh per mesh. È il pezzo che rende vero "la rete impara
// invece di riprovare sempre uguale", riusando un primitivo proprietario già
// scritto per un altro dominio (categorizzazione degli esercenti in
// `hierarchical-bandit.js`) invece di inventarne uno nuovo: stessa matematica
// di pooling gerarchico con k adattivo, stesso meccanismo di federazione
// anti-poisoning, stesso decadimento nel tempo.
//
// IL CONTESTO è una gerarchia dal generale allo specifico:
//   [tipoRete]  →  [tipoRete, miaClasseNat]  →  [tipoRete, miaClasseNat, classeNatAltrui]
// Così un contesto MAI visto ("4g, variabile, bloccato") eredita da quello
// che si conosce di più generale ("4g, variabile"), esattamente come un
// esercente mai visto eredita dalla sua catena — stesso principio, dominio
// diverso.
//
// L'ETICHETTA osservata è il canale che ha DAVVERO funzionato in quel
// contesto: 'diretto' | 'ponte' | 'differito'. Non registriamo tentativi
// falliti come eventi negativi (la matematica del pooling non ne ha bisogno:
// un contesto dove 'diretto' non compare mai finisce naturalmente con
// probabilità bassa per costruzione).
'use strict';

import {
  initHierarchical, observeHierarchical, scoreHierarchical, mergeHierarchical, pruneHierarchical,
} from '../ai/hierarchical-bandit.js';
import { probabilitaDiretta } from './nat-matrix.js';

// Sotto questa evidenza il dato osservato non basta a correggere la fisica:
// un paio di tentativi non devono ribaltare un modello verificato. Da qui in
// su il peso del dato osservato cresce con continuità (mai una soglia netta,
// che produrrebbe un salto innaturale nella stima).
const EVIDENZA_PIENA = 12;

export function initChannelLearning(opts = {}) {
  return initHierarchical({ halfLifeMs: opts.halfLifeMs ?? 30 * 86_400_000 });
}

// Il tipo di rete, in una parola stabile: usa navigator.connection quando
// c'è, altrimenti dichiara 'sconosciuta' invece di indovinare — un contesto
// sbagliato inquinerebbe l'apprendimento più di un contesto assente.
export function tipoRete(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  const eff = nav?.connection?.effectiveType || nav?.connection?.type;
  return eff || 'sconosciuta';
}

function percorso(reteTipo, miaNat, altruiNat) {
  const mia = miaNat?.kind || miaNat || 'incerto';
  const p = [reteTipo, mia];
  const altrui = altruiNat?.kind || altruiNat;
  if (altrui) p.push(altrui);
  return p;
}

// Registra l'esito reale di UN collegamento riuscito. Va chiamato nel punto
// in cui il canale è VERAMENTE aperto (channel.onopen per il diretto,
// consegna confermata per il ponte, apertura del pacchetto per il differito)
// — mai a un tentativo, solo a un successo, per la ragione spiegata sopra.
export function recordOutcome(model, { reteTipo, miaNat, altruiNat, canale, now = Date.now(), weight = 1 } = {}) {
  if (!model || !canale) return model;
  const path = percorso(reteTipo || 'sconosciuta', miaNat, altruiNat);
  return observeHierarchical(model, path, canale, now, weight);
}

// La stima FUSA: fisica nota + quello che questo dispositivo (e la sua mesh,
// dopo la federazione) ha osservato davvero. Con poca evidenza vince quasi
// del tutto la fisica — un dato non ancora affidabile non deve muovere nulla.
// Con molta evidenza vince quello che si è osservato — è il punto in cui la
// rete ha imparato qualcosa che il modello generale non sapeva.
export function probabilitaAppresa(model, { reteTipo, miaNat, altruiNat, now = Date.now() } = {}) {
  const fisica = probabilitaDiretta(miaNat, altruiNat);
  if (!model) return { p: fisica, fonte: 'fisica', evidenza: 0 };
  const path = percorso(reteTipo || 'sconosciuta', miaNat, altruiNat);
  const r = scoreHierarchical(model, path, now);
  if (!r.support) return { p: fisica, fonte: 'fisica', evidenza: 0 };
  const osservata = r.dist['diretto'] || 0;
  const peso = Math.min(1, r.support / EVIDENZA_PIENA);
  const fusa = fisica * (1 - peso) + osservata * peso;
  return {
    p: fusa, fonte: peso > 0.5 ? 'osservata' : 'mista', evidenza: r.support,
    fisica, osservata,
  };
}

// Tra i canali di ripiego ('ponte' vs 'differito'), quale ha funzionato più
// spesso in QUESTO contesto? Senza dati si segue l'ordine di privacy già
// deciso in relay-election.js (mai un'inversione basata sul nulla).
export function preferenzaRipiego(model, { reteTipo, miaNat, altruiNat, now = Date.now() } = {}) {
  if (!model) return { canale: null, fonte: 'nessun dato' };
  const path = percorso(reteTipo || 'sconosciuta', miaNat, altruiNat);
  const r = scoreHierarchical(model, path, now);
  if (r.support < 3) return { canale: null, fonte: 'evidenza insufficiente', evidenza: r.support };
  const ponte = r.dist['ponte'] || 0, differito = r.dist['differito'] || 0;
  if (ponte === 0 && differito === 0) return { canale: null, fonte: 'nessun ripiego osservato qui' };
  return { canale: ponte >= differito ? 'ponte' : 'differito', evidenza: r.support, ponte, differito };
}

// Federazione: si uniscono i CONTEGGI del contesto, mai i dati grezzi di
// nessuna sessione — stesso meccanismo anti-poisoning già in
// hierarchical-bandit.js (contributo di un singolo peer limitato,
// impossibile creare da soli un ramo dominante).
export function mergeChannelLearning(local, remote, opts = {}) {
  return mergeHierarchical(local, remote, opts);
}

export function pruneChannelLearning(model, opts = {}) {
  return pruneHierarchical(model, opts);
}
