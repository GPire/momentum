// Registro di integrità degli aggiornamenti federati.
// La versione ONESTA e realizzabile di ciò che il blueprint V7.5 chiama
// "blockchain audit trail + Byzantine Fault Tolerance + reputation-weighted
// FedAvg". Niente blockchain vera (servirebbe un consenso distribuito, non
// realizzabile né utile in una mesh a consenso esplicito): una CATENA HASH
// locale a prova di manomissione + un punteggio di REPUTAZIONE per peer.
//
// Cosa fa davvero, verificabile:
// 1. Ogni aggiornamento federato accettato/rifiutato viene registrato in una
//    catena hash (ogni voce include l'hash della precedente): alterare una
//    voce vecchia rompe la catena, esattamente come per le transazioni.
// 2. Ogni peer ha una reputazione (accettati vs rifiutati dall'anti-poisoning):
//    il peso del suo contributo cresce se è affidabile, crolla se prova a
//    avvelenare il modello. È la difesa "bizantina" reale: un nodo ostile
//    perde influenza da solo, senza un'autorità centrale.
// Funzioni pure (nessun DOM, nessun crypto async nel core testabile).

// FNV-1a: hash deterministico e veloce, sufficiente per una catena di
// integrità LOCALE (non è sicurezza crittografica contro un avversario con
// risorse illimitate — per quella servirebbe la firma ed25519 via Web Crypto,
// prevista come estensione; qui garantisce rilevamento di manomissione
// accidentale/semplice e ordinamento verificabile).
export function hashEntry(obj) {
  const str = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Aggiunge una voce alla catena. Ritorna la NUOVA catena (immutabile).
export function appendUpdate(ledger, { peerId, accepted, examplesBefore, examplesAfter, reason = null }, referenceTime = Date.now()) {
  const prevHash = ledger.length ? ledger[ledger.length - 1].hash : 'GENESIS';
  const body = { peerId, accepted, examplesBefore, examplesAfter, reason, ts: referenceTime, prevHash };
  return [...ledger, { ...body, hash: hashEntry(body) }];
}

// Verifica che la catena non sia stata manomessa: ogni voce deve puntare
// all'hash della precedente e il proprio hash deve tornare.
export function verifyLedger(ledger) {
  let prevHash = 'GENESIS';
  for (const entry of ledger) {
    if (entry.prevHash !== prevHash) return { valid: false, brokenAt: entry, reason: 'catena spezzata' };
    const { hash, ...body } = entry;
    if (hashEntry(body) !== hash) return { valid: false, brokenAt: entry, reason: 'voce alterata' };
    prevHash = hash;
  }
  return { valid: true, length: ledger.length };
}

// Reputazione di un peer dalla sua storia nella catena. Lisciatura di
// Laplace: un peer nuovo parte neutro (0.5), non colpevole né fidato.
export function peerReputation(ledger, peerId) {
  let accepted = 0, rejected = 0;
  for (const e of ledger) {
    if (e.peerId !== peerId) continue;
    if (e.accepted) accepted++; else rejected++;
  }
  return {
    peerId, accepted, rejected,
    score: +((accepted + 1) / (accepted + rejected + 2)).toFixed(3),
  };
}

// Peso da dare al contributo di un peer nell'aggregazione: la reputazione
// modula il peso base (per numero di esempi). Un peer che ha provato ad
// avvelenare più volte finisce vicino a 0 → smesso di ascoltare, senza
// bisogno di bandirlo a mano (Byzantine tolerance reale ed emergente).
export function reputationWeight(ledger, peerId, baseWeight = 1) {
  const rep = peerReputation(ledger, peerId);
  // sotto 0.5 = più rifiuti che accettazioni: peso schiacciato quadraticamente
  const factor = rep.score >= 0.5 ? rep.score : rep.score * rep.score * 2;
  return +(baseWeight * factor).toFixed(4);
}
