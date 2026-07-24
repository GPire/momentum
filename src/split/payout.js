// ============================================================
// PAYOUT — "come voglio essere pagato" (multi-rail, impostato una volta)
// ============================================================
// Il problema (feedback utente): chiedere un rimborso con solo l'IBAN è un vicolo
// cieco se l'IBAN non c'è (voce vuota) e comunque l'IBAN non è come i giovani si
// scambiano soldi (PayPal, Revolut, Satispay). Qui il metodo di pagamento è
// INTELLIGENTE e SEMPLICE: scegli una volta come vuoi essere pagato, Momentum lo
// ricorda e a ogni richiesta prepara il messaggio giusto — con un LINK toccabile
// dove possibile (PayPal/Revolut), così l'amico paga in un tocco. Onesto: nessun
// dato inventato, niente movimenti (Momentum non muove soldi). Funzioni pure.
'use strict';

export const PAYOUT_METHODS = ['iban', 'paypal', 'revolut', 'satispay', 'other'];
export const PAYOUT_LABELS = { iban: 'IBAN (bonifico)', paypal: 'PayPal', revolut: 'Revolut', satispay: 'Satispay', other: 'Altro / link' };

// Costruisce, dove esiste, un LINK di pagamento toccabile con l'importo già
// dentro (l'amico apre e paga). Per IBAN/Satispay non c'è un link universale →
// null (si usa il testo). Tollerante: accetta username, @handle o URL completo.
export function buildPayoutLink(method, value, amount) {
  const v = String(value || '').trim();
  if (!v) return null;
  const amt = (Math.round((+amount || 0) * 100) / 100).toFixed(2);
  if (method === 'paypal') {
    if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, '') + (amount > 0 ? `/${amt}EUR` : '');
    const user = v.replace(/^@/, '').replace(/^paypal\.me\//i, '').replace(/^https?:\/\//i, '');
    return `https://paypal.me/${user}${amount > 0 ? `/${amt}EUR` : ''}`;
  }
  if (method === 'revolut') {
    if (/^https?:\/\//i.test(v)) return v;
    const user = v.replace(/^@/, '').replace(/^revolut\.me\//i, '');
    return `https://revolut.me/${user}`;
  }
  if (method === 'other' && /^https?:\/\//i.test(v)) return v;
  return null;
}

// Messaggio di richiesta pronto (WhatsApp/copia), gentile e chiaro, con l'importo
// e IL MODO per pagare (link se c'è). Ritorna { message, link, amount }.
export function buildPayoutRequest({ method = 'iban', value = '', holder = '', amount = 0, note = '', fromName = '' } = {}) {
  const eur = `${(Math.round((+amount || 0) * 100) / 100).toFixed(2).replace('.', ',')} €`;
  const link = buildPayoutLink(method, value, amount);
  const hi = fromName ? `Ciao ${fromName}, ` : 'Ciao, ';
  const forWhat = note ? ` per ${note}` : '';
  let how;
  if (method === 'iban') how = value ? `Puoi farmi un bonifico:\nIBAN ${value}${holder ? `\nIntestato a ${holder}` : ''}` : 'Mandami tu come preferisci pagare.';
  else if (link) how = `Puoi pagarmi qui:\n${link}`;
  else if (method === 'satispay') how = `Puoi pagarmi su Satispay${value ? ` (${value})` : ''}.`;
  else how = value ? `Puoi pagarmi qui: ${value}` : 'Dimmi tu come preferisci pagare.';
  const message = `${hi}mi devi ${eur}${forWhat}. ${how}\nGrazie!`;
  return { message, link, amount: Math.round((+amount || 0) * 100) / 100 };
}

// Risolve il metodo di pagamento configurato: il profilo esplicito payout se
// c'è, altrimenti ripiega sull'IBAN dei dati fiscali (retro-compatibile), altrimenti
// null (→ la UI chiede di impostarlo una volta). Sempre modificabile a valle.
export function resolvePayout(state = {}) {
  const p = state.payoutProfile;
  if (p && p.method && String(p.value || '').trim()) return { method: p.method, value: String(p.value).trim(), holder: p.holder || '' };
  const iban = ((state.invoiceProfile || {}).fiscale || {}).iban;
  if (iban && String(iban).trim()) return { method: 'iban', value: String(iban).trim(), holder: ((state.invoiceProfile || {}).fiscale || {}).intestatario || '' };
  return null;
}
