// ============================================================
// QUANDO RIPROPORRE IL RECUPERO DA tx_log — mai ad ogni avvio
// ============================================================
// BUG REALE trovato (integrato da un branch parallelo dopo revisione
// mirata, 2026-09-11): il modale di recupero (main.js, checkTxLogRecovery)
// aveva come unico cancello `addedCount > 0` — nessuna memoria di "l'ho già
// mostrato". Un utente che chiudeva con "Non ora" se lo ritrovava IDENTICO
// ad ogni riavvio dell'app, per sempre, finché non toccava "Ripristina".
// Qui un'unica decisione pura, testata: un solo avviso automatico per QUESTO
// insieme di candidati (indipendente dall'ordine/dal mese), mai più di uno.
// Registrarlo non cancella né modifica nessuna transazione o riga di log.
'use strict';

export function recoveryPromptKey(recovered = {}) {
  const ids = [...new Set(Object.values(recovered).flat().filter(tx => tx?.id != null).map(tx => String(tx.id)))].sort();
  return ids.length ? JSON.stringify(ids) : null;
}

export function shouldAutoOpenRecoveryPrompt(recovered, seenKey, suppressed = false) {
  const key = recoveryPromptKey(recovered);
  return !suppressed && key !== null && key !== seenKey;
}
