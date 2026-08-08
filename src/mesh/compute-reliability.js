// ============================================================
// CHI TI RIDÀ IL RISULTATO — il calcolo condiviso che prevede gli abbandoni
// ============================================================
// `assignWork` (compute-market.js) distribuisce il lavoro in base alla POTENZA
// del dispositivo. È la cosa ovvia, ed è anche il modo classico di far
// fallire un calcolo distribuito: il telefono più potente del gruppo, se è al
// 12% di batteria o se la persona sta per chiudere l'app, prende la fetta più
// grossa e non restituisce niente. Tutto resta fermo ad aspettarlo.
// È il problema dello "straggler", e in un sistema senza server è più grave
// che altrove: non c'è nessuno che rischedula al posto tuo.
//
// LA DOMANDA GIUSTA non è "quanto è potente" ma **"quanto vale il lavoro che
// mi tornerà indietro"** — cioè potenza × probabilità di riceverlo. Un laptop
// modesto attaccato alla corrente batte un telefono veloce al 12%, e oggi
// vince il telefono.
//
// SU COSA SI BASA LA PREVISIONE, tutto già in casa e niente di inventato:
//  - la STORIA: questo dispositivo ha restituito i risultati, le volte scorse?
//  - i SEGNALI DI ADESSO: batteria, in carica, schermo acceso (deviceCapability)
//  - da QUANTO è connesso: chi è collegato da un minuto sparisce più spesso di
//    chi è collegato da mezz'ora (è il `connessoDa` già registrato in
//    mesh-signaling.js)
// I segnali di adesso pesano più della storia: un dispositivo che ha sempre
// consegnato ma ora è al 10% è una scommessa cattiva OGGI, e la storia non lo
// sa.
//
// SCELTA ESPLICITA: qui si usa una media con lisciatura di Laplace, non il
// bandit gerarchico usato altrove. Con poche decine di osservazioni per peer
// un modello più ricco non ha di che imparare — sarebbe complessità che
// somiglia a intelligenza senza esserlo.
'use strict';

// Un peer nuovo non ha storia: parte a metà strada, né promosso né escluso.
// Stessa disciplina di calibration-gate.js — escludere chi non si può ancora
// giudicare significa non dargli mai modo di dimostrarsi.
export const PRIOR_CONSEGNE = 1;
export const PRIOR_TOTALI = 2;
// Oltre questo tempo rispetto al previsto, un'unità si considera persa e si
// riassegna. Non si aspetta all'infinito: aspettare è la scelta che costa di
// più, perché blocca tutto senza produrre niente.
export const FATTORE_SCADENZA = 3;
export const FINESTRA = 50;

export function initReliabilityState() { return { peer: {} }; }

// Registra com'è andata: il risultato è tornato? e in quanto tempo?
export function recordComputeOutcome(state, peerId, { consegnato, ms = null } = {}) {
  const s = state || initReliabilityState();
  if (!peerId) return s;
  const prec = s.peer[peerId] || { esiti: [], tempi: [] };
  const esiti = [...prec.esiti, !!consegnato].slice(-FINESTRA);
  const tempi = consegnato && Number.isFinite(+ms) ? [...prec.tempi, +ms].slice(-FINESTRA) : prec.tempi;
  return { ...s, peer: { ...s.peer, [peerId]: { esiti, tempi } } };
}

// Quanto spesso questo dispositivo ha restituito il risultato. Con la
// lisciatura, zero osservazioni danno 0.5 — un'ipotesi, non una certezza, e
// dichiarata come tale.
export function deliveryHistory(state, peerId) {
  const p = state?.peer?.[peerId];
  const consegne = (p?.esiti || []).filter(Boolean).length;
  const totali = (p?.esiti || []).length;
  return {
    consegne, totali,
    tasso: (consegne + PRIOR_CONSEGNE) / (totali + PRIOR_TOTALI),
    giudicabile: totali >= 5,
  };
}

// Il tempo tipico di risposta di questo peer: la MEDIANA, non la media — un
// solo episodio lentissimo (rete che cade e torna) sposterebbe la media e
// renderebbe la scadenza inutilmente larga per tutti gli altri casi.
export function typicalTime(state, peerId, fallbackMs = 4000) {
  const t = [...(state?.peer?.[peerId]?.tempi || [])].sort((a, b) => a - b);
  if (!t.length) return { ms: fallbackMs, misurato: false };
  return { ms: t[Math.floor(t.length / 2)], misurato: true, campioni: t.length };
}

// LA PREVISIONE. Storia × condizioni di adesso. Il secondo fattore può
// azzerare il primo: un dispositivo storicamente affidabile ma quasi scarico
// non è una buona scommessa oggi.
export function deliveryOdds(state, peer, { now = Date.now() } = {}) {
  const storia = deliveryHistory(state, peer?.peerId);
  const cap = peer?.capability;
  if (!cap || cap.disponibile === false) {
    return { p: 0, storia, motivo: cap?.motivi?.[0] || 'dispositivo non disponibile' };
  }
  let adesso = 1;
  const perche = [];
  // Batteria: sotto il 40% e non in carica `deviceCapability` lo esclude già.
  // Qui si gradua la fascia intermedia, dove è utilizzabile ma incerto.
  const batt = peer.signals?.batteryLevel;
  if (peer.signals?.charging === true) { adesso *= 1.0; perche.push('in carica'); }
  else if (Number.isFinite(batt)) {
    if (batt < 0.55) { adesso *= 0.6; perche.push('batteria bassa'); }
    else if (batt < 0.8) { adesso *= 0.85; }
  } else { adesso *= 0.9; perche.push('stato batteria sconosciuto'); }
  // Schermo spento: il sistema può sospendere la scheda da un momento all'altro.
  if (peer.signals?.screenOn === false) { adesso *= 0.7; perche.push('schermo spento'); }
  // Da quanto è connesso: chi è appena arrivato sparisce più spesso di chi è
  // lì da mezz'ora. Non è una legge, è una regolarità osservabile — e infatti
  // pesa poco (fino a 0.8), non decide da sola.
  const minuti = +peer.minutiOnline || 0;
  adesso *= 0.8 + 0.2 * Math.min(1, minuti / 15);

  return {
    p: +(storia.tasso * adesso).toFixed(3),
    storia, adesso: +adesso.toFixed(3),
    motivo: perche.length ? perche.join(', ') : 'condizioni buone',
  };
}

// IL VALORE ATTESO: quanto lavoro mi torna indietro davvero. È questo che
// deve guidare l'assegnazione, non `capability.score` da solo.
export function expectedValue(state, peer, opts = {}) {
  const odds = deliveryOdds(state, peer, opts);
  const score = +peer?.capability?.score || 0;
  return { peerId: peer?.peerId, valore: +(score * odds.p).toFixed(3), score, odds };
}

// Ordina i peer per lavoro atteso invece che per potenza grezza. Ritorna anche
// il confronto con l'ordine "solo potenza", perché la differenza tra i due è
// esattamente ciò che questo modulo aggiunge — e va potuta mostrare.
export function rankByExpectedDelivery(state, peers = [], opts = {}) {
  const valutati = peers.map((p) => expectedValue(state, p, opts));
  const perValore = [...valutati].sort((a, b) => b.valore - a.valore);
  const perPotenza = [...valutati].sort((a, b) => b.score - a.score);
  return {
    ordine: perValore,
    cambiaQualcosa: perValore[0]?.peerId !== perPotenza[0]?.peerId,
    scartati: valutati.filter((v) => v.valore <= 0).map((v) => v.peerId),
  };
}

// QUANDO SMETTERE DI ASPETTARE. Dalla mediana misurata di quel peer, non da
// una costante scelta a mano: un dispositivo lento ma affidabile merita più
// tempo di uno veloce che sparisce.
export function stragglerDeadline(state, peerId, { unita = 1, now = Date.now(), fattore = FATTORE_SCADENZA } = {}) {
  const t = typicalTime(state, peerId);
  const attesa = t.ms * Math.max(1, unita) * fattore;
  return {
    scadeA: now + attesa,
    attesaMs: attesa,
    misurato: t.misurato,
    motivo: t.misurato
      ? `di solito risponde in ${Math.round(t.ms / 100) / 10}s`
      : 'non ho ancora misurato quanto ci mette: uso un\'attesa prudente',
  };
}

// Le unità da riassegnare adesso. Riassegnare non e' punire: e' finire il
// lavoro. Chi era in ritardo puo' comunque consegnare — il primo risultato
// valido vince, e il doppio calcolo di quell'unità non costa nulla di più
// della verifica che già si fa.
export function unitsToReassign(inFlight = [], { now = Date.now() } = {}) {
  return inFlight.filter((u) => u && u.scadeA && now > u.scadeA).map((u) => ({
    unit: u.unit, peerId: u.peerId, ritardoMs: now - u.scadeA,
  }));
}

// Cosa dire all'utente: mai gergo da sistemi distribuiti. La persona non deve
// sapere cosa sia uno straggler — deve sapere se il conto sta arrivando.
export function computeStatusText({ totali, tornate, riassegnate }) {
  if (!totali) return null;
  if (tornate >= totali) return 'Calcolo finito.';
  const quota = Math.round((tornate / totali) * 100);
  if (riassegnate > 0) {
    return `Calcolo al ${quota}%. Un dispositivo si è disconnesso: ho ridato la sua parte a un altro, non si ricomincia da capo.`;
  }
  return `Calcolo al ${quota}%, diviso tra più dispositivi.`;
}
