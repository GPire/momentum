// ============================================================
// PONTI FRA PARI — il 2% che resta, senza un server che veda i dati
// ============================================================
// Corretta la matrice (nat-matrix.js), il caso davvero senza uscita non è
// piu' "il 10-20% degli utenti": e' la coppia in cui ENTRAMBI i lati sono
// dietro un NAT simmetrico. Con un 15% di dispositivi simmetrici sono circa
// il 2% delle coppie. Piccolo, ma per quelle persone e' totale.
//
// La risposta del settore e' un server TURN: un computer di qualcuno che
// inoltra il traffico. Funziona, e costa due cose — infrastruttura che cresce
// con gli utenti, e un punto in cui i dati transitano.
//
// LA VIA DIVERSA: il ponte lo fa un altro dispositivo con Momentum. Il
// dettaglio che lo rende possibile e' sempre lo stesso della matrice — un
// dispositivo simmetrico RIESCE a collegarsi a uno non simmetrico. Quindi due
// simmetrici che non si vedono fra loro vedono entrambi un terzo qualsiasi con
// rete normale. E i dispositivi con rete normale sono la stragrande maggioranza.
//
// La conseguenza economica va detta perche' e' il vero argomento: con un TURN
// il costo CRESCE con gli utenti; qui la copertura CRESCE con gli utenti,
// perche' ogni nuovo dispositivo con rete normale e' un ponte in piu'. Le due
// curve vanno in direzioni opposte.
//
// COSA VEDE UN PONTE, detto senza sconti: NON puo' leggere il contenuto, che
// viaggia gia' sigillato da un capo all'altro (store-forward.js). Ma vede i
// METADATI — chi parla con chi, quando, quanti byte. Non e' niente, ed e'
// esattamente il tipo di costo che di solito viene taciuto. Per questo la
// scelta del ponte segue un ordine che parte da dove quel costo e' ZERO.
'use strict';

import { puoBucare, puoFareDaPonte } from './nat-matrix.js';

// Quante conversazioni un dispositivo accetta di portare avanti insieme.
// Basso di proposito: un ponte e' il telefono di qualcuno, non un server.
export const MAX_SESSIONI_PONTE = 4;

// Ordine di preferenza. Non e' un dettaglio di implementazione: e' una scala
// di costo per la privacy, e va rispettata in quest'ordine.
//  0. un TUO altro dispositivo   -> il ponte sei tu: nessun metadato esce
//  1. un dispositivo del gruppo  -> chi gia' sa che vi parlate
//  2. uno sconosciuto della rete -> impara che due chiavi si parlano
export const LIVELLI_FIDUCIA = ['mio', 'gruppo', 'rete'];

const livelloDi = (peer) => (peer?.mio ? 'mio' : peer?.stessoGruppo ? 'gruppo' : 'rete');
const rango = (peer) => LIVELLI_FIDUCIA.indexOf(livelloDi(peer));

// Dispersione deterministica: senza, tutte le coppie sceglierebbero lo stesso
// "miglior" ponte e quel dispositivo verrebbe schiacciato mentre gli altri
// restano fermi. A parita' di merito il ponte cambia con la coppia.
function mescola(idA, idB, idPonte) {
  const s = `${[idA, idB].sort().join('|')}>${idPonte}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Chi puo' fare da ponte per QUESTA coppia. Non basta avere una buona rete:
// deve essere raggiungibile da entrambi i capi, avere capienza, e non essere
// un telefono che stiamo per lasciare a secco.
export function candidatiPonte(a, b, peers = [], { max = MAX_SESSIONI_PONTE } = {}) {
  return (peers || []).filter((p) => {
    if (!p || p.id === a?.id || p.id === b?.id) return false;
    if (p.disponibile === false) return false;
    if (!puoFareDaPonte(p.nat)) return false;
    if ((p.sessioniAttive || 0) >= max) return false;
    // Deve poter parlare con TUTTI E DUE: e' l'intero senso del ponte.
    return puoBucare(a?.nat, p.nat).ok && puoBucare(b?.nat, p.nat).ok;
  });
}

// Elegge il ponte migliore: prima il costo per la privacy, poi il carico, poi
// la stabilita' dichiarata, e solo alla fine la dispersione deterministica.
export function eleggiPonte(a, b, peers = [], opts = {}) {
  const cands = candidatiPonte(a, b, peers, opts);
  if (!cands.length) return null;
  const punteggio = (p) => {
    const carico = (p.sessioniAttive || 0) / (opts.max || MAX_SESSIONI_PONTE);
    const stabilita = Math.min(1, (p.minutiOnline || 0) / 30); // oltre mezz'ora vale 1
    const apertura = p.nat?.kind === 'aperto' || p.nat === 'aperto' ? 1 : 0.8;
    return (1 - carico) * 2 + stabilita + apertura + mescola(a?.id, b?.id, p.id) * 0.5;
  };
  const ordinati = [...cands].sort((x, y) => {
    const dr = rango(x) - rango(y);
    if (dr !== 0) return dr;              // la fiducia viene prima di tutto
    return punteggio(y) - punteggio(x);
  });
  const scelto = ordinati[0];
  return {
    ponte: scelto,
    fiducia: livelloDi(scelto),
    alternativi: ordinati.length - 1,
    costoPrivacy: costoPrivacyPonte(livelloDi(scelto)),
  };
}

// Quello che il ponte impara, in italiano e senza attenuazioni.
export function costoPrivacyPonte(livello) {
  if (livello === 'mio') {
    return { vedeContenuto: false, vedeMetadati: false, testo: 'Il ponte e\' un tuo dispositivo: non esce niente da te.' };
  }
  if (livello === 'gruppo') {
    return { vedeContenuto: false, vedeMetadati: true, testo: 'Passa da un dispositivo del tuo gruppo: non puo\' leggere niente, e sa gia\' che vi scrivete.' };
  }
  return {
    vedeContenuto: false, vedeMetadati: true,
    testo: 'Passa da un altro dispositivo con Momentum: non puo\' leggere niente di quello che mandi, ma vede che due dispositivi si stanno parlando.',
  };
}

// La decisione completa per una coppia, in ordine di preferenza reale.
// Ritorna sempre qualcosa: anche "nessuna strada adesso" e' una risposta utile,
// perche' permette all'interfaccia di dire la verita' invece di girare a vuoto.
export function scegliStrada(a, b, peers = [], opts = {}) {
  const diretto = puoBucare(a?.nat, b?.nat);
  if (diretto.ok) {
    return { tipo: 'diretto', motivo: diretto.motivo, testo: 'Collegamento diretto fra i due dispositivi.' };
  }
  const elezione = eleggiPonte(a, b, peers, opts);
  if (elezione) {
    return {
      tipo: 'ponte',
      via: elezione.ponte,
      fiducia: elezione.fiducia,
      costoPrivacy: elezione.costoPrivacy,
      alternativi: elezione.alternativi,
      motivo: diretto.motivo,
      testo: `Le vostre due reti non si parlano direttamente. ${elezione.costoPrivacy.testo}`,
    };
  }
  // Nessun ponte ADESSO non vuol dire mai: il pacchetto sigillato puo'
  // aspettare, e partire appena passa qualcuno. E' il canale a consegna
  // differita, che ora sopravvive davvero ai riavvii (exchange-identity.js).
  return {
    tipo: 'differito',
    motivo: diretto.motivo,
    testo: 'Nessuna strada aperta in questo momento. Prepariamo l\'invio: parte da solo appena uno dei vostri dispositivi incontra qualcun altro.',
  };
}

// ── Il numero, invece dell'impressione ──
// Data una distribuzione di classi di rete e una dimensione di rete, quante
// coppie restano davvero senza strada? Deterministico e ripetibile: serve a
// poter scrivere un numero in un documento senza inventarlo.
export function coperturaStimata({ distribuzione = {}, nPeers = 20, max = MAX_SESSIONI_PONTE } = {}) {
  const classi = [];
  for (const [k, n] of Object.entries(distribuzione)) for (let i = 0; i < n; i++) classi.push(k);
  if (!classi.length) return { coppie: 0, dirette: 0, viaPonte: 0, senzaStrada: 0 };
  const peers = classi.slice(0, nPeers).map((k, i) => ({
    id: `p${i}`, nat: { kind: k }, sessioniAttive: 0, minutiOnline: 60, disponibile: true,
  }));
  let dirette = 0, viaPonte = 0, senza = 0;
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      const s = scegliStrada(peers[i], peers[j], peers, { max });
      if (s.tipo === 'diretto') dirette++;
      else if (s.tipo === 'ponte') {
        viaPonte++;
        // La capienza si CONSUMA. Senza questo un solo dispositivo sembrerebbe
        // servire infinite coppie e la copertura uscirebbe sempre 100% —
        // un numero comodo e falso.
        const via = peers.find((p) => p.id === s.via.id);
        if (via) via.sessioniAttive = (via.sessioniAttive || 0) + 1;
      } else senza++;
    }
  }
  const coppie = dirette + viaPonte + senza;
  return {
    coppie, dirette, viaPonte, senzaStrada: senza,
    quotaRaggiungibile: coppie ? (dirette + viaPonte) / coppie : 0,
  };
}
