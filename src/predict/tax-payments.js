// ============================================================
// TAX-PAYMENTS — il salvadanaio fiscale è VIRTUALE, mai un trasferimento
// ============================================================
// Correzione esplicita dell'utente durante questa sessione: Momentum non ha
// accesso al conto bancario né a un'API di pagamento — non può "mettere da
// parte" soldi veri. Quello che PUÒ fare: calcolare quanto andrebbe
// accantonato (tax.js: taxSetAsideForPeriod, già esistente, applicato a
// TUTTE le fatture invece che a un periodo — nessun nuovo motore di calcolo
// serve qui) e lasciare che l'utente registri i versamenti REALI che ha
// fatto (F24, acconto, saldo) — l'unica cosa che Momentum non può dedurre
// da sola dai dati che ha. La differenza tra i due è "quanto ti manca
// ancora da mettere via", mai un numero che finge di sapere cosa è successo
// fuori dall'app. Funzioni pure, stato additivo (stesso stile di
// backup-health.js/recovery-shares.js): mai mutato in place.
'use strict';

export function recordTaxPayment(payments, amount, { note = '', date = new Date().toISOString() } = {}) {
  const importo = Math.max(0, +amount || 0);
  if (importo === 0) return payments || [];
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount: +importo.toFixed(2), note, date };
  return [...(payments || []), entry];
}

export function removeTaxPayment(payments, id) {
  return (payments || []).filter((p) => p.id !== id);
}

// totalSetAside = quanto risulta dovuto in totale (tax.js:taxSetAsideForPeriod
// su tutte le fatture). Ritorna la situazione completa e leggibile: mai un
// solo numero senza la sua scomposizione.
export function taxReserveStatus(totalSetAside, payments) {
  // BUG REALE trovato dal test: senza questa normalizzazione, un totale
  // assente/NaN (es. calcolo fiscale non ancora disponibile al primo avvio)
  // propagava NaN fino alla UI — un "NaN €" mostrato dove l'utente si
  // aspetta dei soldi è il tipo di errore che fa perdere fiducia all'istante.
  const dovuto = Number.isFinite(+totalSetAside) ? +totalSetAside : 0;
  const versato = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const daAccantonare = Math.max(0, +(dovuto - versato).toFixed(2));
  return {
    totaleDovuto: +dovuto.toFixed(2),
    versato: +versato.toFixed(2),
    daAccantonare,
    inPari: daAccantonare <= 0.01,
  };
}
