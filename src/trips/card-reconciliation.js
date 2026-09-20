// ============================================================
// RICONCILIAZIONE ESTRATTO CONTO CARTA AZIENDALE
// ============================================================
// Confronto puro e non distruttivo di movimenti già normalizzati dal parser CSV.
'use strict';

// Finestre configurabili di confronto, non garanzie sui tempi di contabilizzazione.
const TOLLERANZA_GIORNI_DEFAULT = 3;
const TOLLERANZA_IMPORTO_DEFAULT = 0.01;

function comparablePayment(tx) {
  const amount = typeof tx.amount === 'number' || typeof tx.amount === 'string' ? Number(tx.amount) : NaN;
  const date = tx.date == null || tx.date === '' ? NaN : new Date(tx.date).getTime();
  const currency = typeof tx.currency === 'string' ? tx.currency.trim().toUpperCase() : '';
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(date)) return null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) return null;
  return { amount, date, currency };
}

export function reconcileCardStatement(cardTransactions, expenseTransactions, opts = {}) {
  const toleranzaGiorni = opts.toleranzaGiorni ?? TOLLERANZA_GIORNI_DEFAULT;
  const toleranzaImporto = opts.toleranzaImporto ?? TOLLERANZA_IMPORTO_DEFAULT;
  if (![toleranzaGiorni, toleranzaImporto].every(value => Number.isFinite(value) && value >= 0)) throw new TypeError('Invalid reconciliation tolerance');
  // Solo le spese pagate con carta sono candidate: una spesa in contanti
  // non può comparire su un estratto conto carta, per costruzione — mai
  // un abbinamento falso solo perché importo e data coincidono per caso.
  const candidateExpenses = (expenseTransactions || []).filter(tx => tx?.type === 'uscita' && tx.paymentMethod !== 'contanti');
  const usedIndex = new Set();
  const cardCharges = (cardTransactions || []).filter(c => c?.type === 'uscita');

  const matched = [];
  const unmatchedCharges = [];
  const compare = (a, b) => a.diffGiorni - b.diffGiorni || a.diffImporto - b.diffImporto;
  const byExpense = new Map();
  const options = cardCharges.map((carta, chargeIndex) => {
    const charge = comparablePayment(carta);
    // Candidati ordinati per vicinanza (giorni, poi importo): il più
    // vicino vince, mai il primo trovato — un addebito del 15 non deve
    // abbinarsi per caso a una spesa del 2 solo perché appare prima
    // nell'elenco.
    const candidati = candidateExpenses
      .map((spesa, index) => {
        const expense = comparablePayment(spesa);
        // Nessun cambio implicito: una valuta assente non prova EUR/USD.
        // Archivi legacy senza valuta su entrambi i lati restano confrontabili.
        if (!charge || !expense || charge.currency !== expense.currency) return null;
        const diffGiorni = Math.abs((charge.date - expense.date) / 86400000);
        const diffImporto = Math.abs(charge.amount - expense.amount);
        if (diffGiorni > toleranzaGiorni || diffImporto > toleranzaImporto) return null;
        const candidate = { spesa, index, chargeIndex, diffGiorni, diffImporto };
        if (!byExpense.has(index)) byExpense.set(index, []);
        byExpense.get(index).push(candidate);
        return candidate;
      })
      .filter(Boolean)
      .sort(compare);
    return candidati;
  });
  for (const candidates of byExpense.values()) candidates.sort(compare);
  for (const [chargeIndex, carta] of cardCharges.entries()) {
    const candidati = options[chargeIndex];
    if (!candidati.length) {
      // Nessuna spesa corrispondente: o manca la nota spese, o è un
      // secondo addebito duplicato per lo stesso acquisto (da verificare) — mai un'ipotesi qui, solo il fatto.
      unmatchedCharges.push({ carta, motivo: 'nessuna_spesa_corrispondente' });
      continue;
    }
    const best = candidati[0], competitors = byExpense.get(best.index);
    // A pair must be uniquely closest from both sides. Ties are evidence to
    // review, never a reason to consume whichever row appeared first.
    if ((candidati[1] && compare(best, candidati[1]) === 0)
      || competitors[0].chargeIndex !== chargeIndex
      || (competitors[1] && compare(competitors[0], competitors[1]) === 0)) {
      unmatchedCharges.push({ carta, motivo: 'corrispondenza_ambigua', candidati: candidati.map(row => row.spesa) });
      continue;
    }
    usedIndex.add(best.index);
    matched.push({ carta, spesa: candidati[0].spesa, diffGiorni: candidati[0].diffGiorni, diffImporto: candidati[0].diffImporto, altriCandidati: candidati.length - 1 });
  }
  // Spese pagate con carta senza un addebito corrispondente sull'estratto
  // conto: può essere un rimborso richiesto due volte, un pagamento
  // dichiarato "carta" per errore (era contanti), o l'estratto conto non
  // copre ancora quel periodo — dichiarato come fatto, mai un'accusa.
  const expensesWithoutCharge = candidateExpenses.filter((_, index) => !usedIndex.has(index));

  return { matched, unmatchedCharges, expensesWithoutCharge };
}
