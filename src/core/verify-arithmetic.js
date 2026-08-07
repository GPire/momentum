// ============================================================
// VERIFICA ARITMETICA — nessun numero in euro senza un secondo conto
// ============================================================
// La difesa strutturale che il piano chiede: ogni cifra mostrata all'utente
// dovrebbe essere confermata da un ricalcolo INDIPENDENTE, non solo prodotta
// da una formula. Se i due conti non coincidono, il numero non è affidabile
// e va detto — mai mostrato come se fosse certo.
//
// Perché vive qui e non in ai/omega.js, dov'era: omega.js importa l'intera
// pila di ragionamento (grafo causale, calibrazione, fusione). Un motore di
// fatturazione che vuole solo controllare una somma non deve tirarsi dentro
// una rete neurale. Questa funzione è pura e senza dipendenze: è il posto
// giusto perché possa usarla chiunque, ed è il motivo per cui finora non la
// usava nessuno.
'use strict';

// Confronta un valore DICHIARATO con un RICALCOLO indipendente.
// Tolleranza RELATIVA (1% di default): adatta all'aritmetica di una stima,
// dove un punto percentuale non cambia la sostanza della risposta.
export function verifyArithmetic(claimed, recomputed, tol = 0.01) {
  if (claimed == null || recomputed == null) return { ok: false, reason: 'valore mancante' };
  const diff = Math.abs(claimed - recomputed);
  const scale = Math.max(1, Math.abs(recomputed));
  const ok = diff / scale <= tol;
  return { ok, claimed, recomputed, diff: +diff.toFixed(4), reason: ok ? 'coerente' : 'incoerenza aritmetica' };
}

// PER IL DENARO la tolleranza relativa è sbagliata, e non di poco: l'1% su
// una fattura da 10.000 € lascerebbe passare 100 € di errore. Trovato da un
// test che sporcava un totale di 7 € su 1.220 e NON veniva intercettato.
// Sui soldi l'unico scarto ammissibile è l'arrotondamento al centesimo delle
// righe che si sommano: qui la tolleranza è ASSOLUTA e minuscola.
export const MONEY_TOL = 0.02; // due centesimi: copre l'arrotondamento di più righe

export function verifyMoney(claimed, recomputed, absTol = MONEY_TOL) {
  if (claimed == null || recomputed == null) return { ok: false, reason: 'valore mancante' };
  const diff = Math.abs(claimed - recomputed);
  const ok = diff <= absTol;
  return {
    ok, claimed, recomputed, diff: +diff.toFixed(4),
    reason: ok ? 'coerente' : `incoerenza di ${diff.toFixed(2)} € tra il totale e le sue righe`,
  };
}

// Caso ricorrente: un totale deve essere la somma delle righe che l'utente
// VEDE. Non verifica la formula contro sé stessa (sarebbe inutile), ma il
// numero grande contro la scomposizione mostrata: se le due cose divergono,
// l'utente sta guardando un totale che non corrisponde al dettaglio sotto.
// Usa la tolleranza del DENARO, non quella relativa: un totale mostrato deve
// tornare col dettaglio mostrato al centesimo, non "circa".
export function verifySum(claimedTotal, addends, absTol = MONEY_TOL) {
  const somma = (addends || []).reduce((s, x) => s + (Number(x) || 0), 0);
  return verifyMoney(claimedTotal, +somma.toFixed(2), absTol);
}
