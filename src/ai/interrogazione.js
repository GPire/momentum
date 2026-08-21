// ============================================================
// L'INTERROGAZIONE — la domanda diventa un oggetto tipizzato
// ============================================================
// Perché esiste. Oggi una domanda arriva come STRINGA e viene fatta scorrere
// contro decine di pattern scritti a mano (qa-engine.js: 15 famiglie regex;
// mercato-qa.js: 34 intenti a cascata) — aggiungere una domanda in più
// significa aggiungere un altro ramo if/else. Qui la domanda diventa una
// struttura con CAMPI: cosa si vuole fare (operazione), su cosa (soggetti),
// quale numero (misura), in quale intervallo (finestra), con quali vincoli.
// Il pianificatore (pianificatore.js) cerca chi sa rispondere a QUELLA
// combinazione: 7 operazioni × N misure × M soggetti danno migliaia di
// domande rispondibili con la stessa quantità di codice — ogni capacità
// registrata moltiplica invece di aggiungere un ramo.
//
// Questo file NON capisce linguaggio naturale: costruisce e valida la
// struttura. Chi trasforma una frase in un'interrogazione (un intent parser)
// è un pezzo a parte, più avanti — qui si mette in piedi la forma che quel
// pezzo dovrà produrre, e la si convalida seriamente fin da subito.
// Funzioni PURE.
'use strict';

// Le 7 operazioni del piano: cosa si può chiedere di fare a un dato.
// 'consiglia' NON è fra queste apposta — un'operazione che non esiste non
// può mai essere pianificata, che è più forte di un pattern che la rifiuta
// (qa-engine.js/mercato-qa.js fanno anche quello, per le domande che non
// passano mai da qui). Vedi rifiuto-strutturale.js per il resto del confine.
export const OPERAZIONI = Object.freeze([
  'descrivi', 'confronta', 'classifica', 'condiziona', 'spiega', 'simula', 'attribuisci',
]);

// Costruisce e CONVALIDA un'interrogazione. Fallisce rumorosamente (lancia)
// su una struttura malformata: un'interrogazione invalida che passasse al
// pianificatore in silenzio produrrebbe un "non trovato" fuorviante invece
// di dire subito cosa non va nella domanda stessa.
export function creaInterrogazione({ operazione, soggetti = [], misura, finestra = null, vincoli = {} } = {}) {
  if (!OPERAZIONI.includes(operazione)) {
    throw new Error(`operazione sconosciuta: "${operazione}" (valide: ${OPERAZIONI.join(', ')})`);
  }
  if (typeof misura !== 'string' || !misura.trim()) {
    throw new Error('serve una "misura" (stringa non vuota): cosa si vuole sapere, non come lo si formula.');
  }
  if (!Array.isArray(soggetti)) {
    throw new Error('"soggetti" deve essere un array (vuoto per le domande senza un soggetto specifico, es. un archivio intero).');
  }
  soggetti.forEach((s, i) => {
    if (!s || typeof s.tipo !== 'string' || !s.tipo.trim() || s.id === undefined || s.id === null) {
      throw new Error(`soggetto #${i}: serve { tipo: stringa, id: valore } — ricevuto ${JSON.stringify(s)}.`);
    }
  });
  if (finestra !== null && (typeof finestra !== 'object' || Array.isArray(finestra))) {
    throw new Error('"finestra" deve essere un oggetto o null.');
  }
  if (vincoli !== null && (typeof vincoli !== 'object' || Array.isArray(vincoli))) {
    throw new Error('"vincoli" deve essere un oggetto.');
  }

  return Object.freeze({
    operazione,
    soggetti: Object.freeze(soggetti.map((s) => Object.freeze({ ...s }))),
    misura: misura.trim(),
    finestra: finestra ? Object.freeze({ ...finestra }) : null,
    vincoli: Object.freeze({ ...(vincoli || {}) }),
  });
}

// Descrizione leggibile, utile per log/test/messaggi di "cosa manca" — non
// per l'utente finale (quello lo scrive chi chiama, in lingua e in tono).
export function descriviInterrogazione(q) {
  const soggetti = q.soggetti.length
    ? q.soggetti.map((s) => `${s.tipo}:${s.id}`).join(', ')
    : 'nessun soggetto specifico';
  return `${q.operazione}/${q.misura} su [${soggetti}]`;
}
