// ============================================================
// RICONCILIAZIONE ESTRATTO CONTO CARTA AZIENDALE
// ============================================================
// Gap reale trovato in ricerca (Ramp/Bill.com/ExpensePoint, 2026-09-19):
// le aziende passano in media 30-45 minuti al mese per persona a
// incrociare a mano l'estratto conto della carta con le note spese —
// gli errori più comuni sono addebiti doppi, scontrini mancanti,
// esercenti non riconosciuti, importi che non coincidono con la
// documentazione. Momentum ha già un parser CSV bank-agnostico
// (src/import/csv-parser.js, parseGenericCsv) — questo modulo NON ne
// scrive un secondo, riusa quello per leggere l'estratto conto.
//
// Formula pura: nessun accesso al Vault, nessuna rete, nessuna
// dipendenza dal formato specifico di una banca — chi chiama fornisce
// già le transazioni normalizzate (stesso principio "la tariffa/il dato
// la fornisce chi chiama" di trip-period.js/trip-mileage.js).
'use strict';

// Tolleranza di 3 giorni: un addebito carta appare quasi sempre 1-3
// giorni dopo la spesa reale (tempo di "settlement" del sistema di
// pagamento) — un match esatto sulla data perderebbe la maggioranza dei
// casi reali. 1 centesimo di tolleranza sull'importo: arrotondamenti di
// visualizzazione, mai una differenza di valuta vera (quella resta un
// mancato abbinamento dichiarato, non nascosto da una tolleranza larga).
const TOLLERANZA_GIORNI_DEFAULT = 3;
const TOLLERANZA_IMPORTO_DEFAULT = 0.01;

export function reconcileCardStatement(cardTransactions, expenseTransactions, opts = {}) {
  const toleranzaGiorni = opts.toleranzaGiorni ?? TOLLERANZA_GIORNI_DEFAULT;
  const toleranzaImporto = opts.toleranzaImporto ?? TOLLERANZA_IMPORTO_DEFAULT;
  // Solo le spese pagate con carta sono candidate: una spesa in contanti
  // non può comparire su un estratto conto carta, per costruzione — mai
  // un abbinamento falso solo perché importo e data coincidono per caso.
  const candidateExpenses = (expenseTransactions || []).filter(tx => tx?.type === 'uscita' && tx.paymentMethod !== 'contanti');
  const usedIndex = new Set();
  const cardCharges = (cardTransactions || []).filter(c => c?.type === 'uscita');

  const matched = [];
  const unmatchedCharges = [];
  for (const carta of cardCharges) {
    const cartaData = new Date(carta.date).getTime();
    // Candidati ordinati per vicinanza (giorni, poi importo): il più
    // vicino vince, mai il primo trovato — un addebito del 15 non deve
    // abbinarsi per caso a una spesa del 2 solo perché appare prima
    // nell'elenco.
    const candidati = candidateExpenses
      .map((spesa, index) => {
        if (usedIndex.has(index)) return null;
        const diffGiorni = Math.abs((cartaData - new Date(spesa.date).getTime()) / 86400000);
        const diffImporto = Math.abs(carta.amount - spesa.amount);
        if (diffGiorni > toleranzaGiorni || diffImporto > toleranzaImporto) return null;
        return { spesa, index, diffGiorni, diffImporto };
      })
      .filter(Boolean)
      .sort((a, b) => a.diffGiorni - b.diffGiorni || a.diffImporto - b.diffImporto);
    if (!candidati.length) {
      // Nessuna spesa corrispondente: o manca la nota spese, o è un
      // secondo addebito duplicato per lo stesso acquisto (l'errore più
      // comune trovato in ricerca) — mai un'ipotesi qui, solo il fatto.
      unmatchedCharges.push({ carta, motivo: 'nessuna_spesa_corrispondente' });
      continue;
    }
    usedIndex.add(candidati[0].index);
    matched.push({ carta, spesa: candidati[0].spesa, diffGiorni: candidati[0].diffGiorni, diffImporto: candidati[0].diffImporto, altriCandidati: candidati.length - 1 });
  }
  // Spese pagate con carta senza un addebito corrispondente sull'estratto
  // conto: può essere un rimborso richiesto due volte, un pagamento
  // dichiarato "carta" per errore (era contanti), o l'estratto conto non
  // copre ancora quel periodo — dichiarato come fatto, mai un'accusa.
  const expensesWithoutCharge = candidateExpenses.filter((_, index) => !usedIndex.has(index));

  return { matched, unmatchedCharges, expensesWithoutCharge };
}
