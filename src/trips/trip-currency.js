// ============================================================
// TRIP CURRENCY — conversione reale per uno scontrino di trasferta in una
// valuta diversa da quella base del viaggio.
// ============================================================
// Gap reale (richiesta esplicita 2026-09-19, "anche multi currency"): fino
// ad ora receipt-ocr-transparency.js si limitava ad AVVISARE di un cambio
// valuta diverso ("verifica il cambio"), mai a convertire — un dipendente
// con uno scontrino in CHF durante una trasferta in EUR doveva fare il
// calcolo a mano. Stessa fonte e stessa disciplina già in produzione per le
// spese di gruppo multi-valuta (src/split/exchange-rate.js, src/split/
// split-engine.js:addSharedExpense): tasso del GIORNO della spesa (mai
// "oggi" — uno scontrino è un fatto passato, un tasso che cambia nel tempo
// tradirebbe la cifra rimborsata), mai un importo convertito senza un tasso
// dichiarato che lo spieghi. Funzione pura, nessuna rete qui: chi chiama
// (main.js) recupera il tasso PRIMA, questa valida solo la coerenza.
'use strict';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

export function canChangeTripCurrency(trip, nextCurrency, transactions) {
  return (trip.receiptPolicy?.currency || 'EUR') === nextCurrency
    || (!(trip.offeredItems || []).length && !transactions.some(tx => tx.businessTripId === trip.id));
}

// Ritorna i campi {originalAmount, originalCurrency, exchangeRate} da unire
// alla transazione, o {} se non c'è nessuna valuta originale dichiarata
// (caso comune: scontrino già nella valuta del viaggio). Lancia se i numeri
// non si spiegano a vicenda — stesso principio delle quote che devono
// sommare esatte altrove nel progetto.
export function buildOriginalCurrencyFields({ amount, originalAmount, originalCurrency, exchangeRate, tripCurrency }) {
  if (!originalCurrency || originalCurrency === tripCurrency) return {};
  if (![amount, originalAmount, exchangeRate].every(value => Number.isFinite(value) && value > 0)) throw new Error('valuta originale senza importo o tasso di cambio');
  const atteso = round2(originalAmount * exchangeRate);
  if (Math.abs(atteso - round2(amount)) > 0.02) throw new Error('l\'importo convertito non coincide col tasso di cambio dichiarato');
  return { originalAmount: round2(originalAmount), originalCurrency, exchangeRate };
}
