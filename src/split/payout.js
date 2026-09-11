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
import { tPayout } from '../i18n/payout.js';

export const PAYOUT_METHODS = ['iban', 'paypal', 'revolut', 'satispay', 'other'];
export const PAYOUT_LABELS = { iban: 'IBAN (bonifico)', paypal: 'PayPal', revolut: 'Revolut', satispay: 'Satispay', other: 'Altro / link' };

// Costruisce, dove esiste, un LINK di pagamento toccabile con l'importo già
// dentro (l'amico apre e paga). Per IBAN/Satispay non c'è un link universale →
// null (si usa il testo). Tollerante: accetta username, @handle o URL completo.
export function buildPayoutLink(method, value, amount, currency = 'EUR') {
  const v = String(value || '').trim();
  if (!v) return null;
  currency = String(currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Number(amount)) || Number(amount) < 0) return null;
  const amt = (Math.round((+amount || 0) * 100) / 100).toFixed(2);
  if (method === 'paypal' || method === 'revolut') {
    const host = method === 'paypal' ? 'paypal.me' : 'revolut.me';
    let user = v.replace(/^@/, '');
    if (/^https?:\/\//i.test(v) || v.toLowerCase().startsWith(host + '/')) {
      try {
        const url = new URL(/^https?:/i.test(v) ? v : `https://${v}`);
        if (url.protocol !== 'https:' || ![host, `www.${host}`].includes(url.hostname) || url.username || url.password || url.port) return null;
        user = url.pathname.split('/').filter(Boolean)[0] || '';
      } catch { return null; }
    }
    if (!/^[a-z\d._-]+$/i.test(user)) return null;
    return `https://${host}/${user}${method === 'paypal' && amount > 0 ? `/${amt}${currency}` : ''}`;
  }
  if (method === 'other') {
    try { const url = new URL(v); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch { }
  }
  return null;
}

// Firma di brand SOBRIA per il messaggio di richiesta. Scelta neuro-copy: chiedere
// soldi a un amico è un momento sociale delicato → niente brand gridato (sembra
// spam, aggiunge frizione). Una riga in coda che fa DOPPIO lavoro: marca Momentum
// e incornicia l'equità ("l'ha diviso l'app, non sono io a essere tirchio") →
// riduce la frizione psicologica. Se c'è il link alla divisione (momentumLink),
// una seconda riga ETICHETTATA e separata invita a vederla su Momentum (loop di
// scoperta/crescita) — mai in competizione col link "paga qui" (etichette chiare).
export const PAYOUT_BRAND_SIGNATURE = '— conto diviso con Momentum, giusto per tutti';

// Messaggio di richiesta pronto (WhatsApp/copia), gentile e chiaro, con l'importo
// e IL MODO per pagare (payLink) e, opzionale, il link alla divisione su Momentum
// (momentumLink) per l'amico. `brand` (default true) aggiunge la firma sobria.
// Ritorna { message, link (=payLink), momentumLink, amount }.
export function buildPayoutRequest({ method = 'iban', value = '', holder = '', amount = 0, note = '', fromName = '', brand = true, momentumLink = '', currency = 'EUR', lang = 'it' } = {}) {
  currency = String(currency).toUpperCase();
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !Number.isSafeInteger(Math.round(Number(amount) * 100)) || !/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid repayment amount or currency');
  const tr = (key, ...values) => tPayout(key, lang, ...values);
  const money = new Intl.NumberFormat(lang, { style: 'currency', currency }).format(Number(amount)).replace(/[\u00a0\u202f]/g, ' ');
  const payLink = buildPayoutLink(method, value, amount, currency);
  let how;
  if (method === 'iban') how = value ? `${tr('bank')}\nIBAN ${value}${holder ? `\n${tr('holder', holder)}` : ''}` : tr('fallback');
  else if (payLink) how = `${tr('pay')}\n${payLink}`;
  else if (method === 'satispay') how = tr('satispay', value ? ` (${value})` : '');
  else how = tr('fallback');
  const mLine = brand ? `\n\n${tr('signature')}${momentumLink ? `\n${tr('details')}\n${momentumLink}` : ''}` : '';
  const message = `${tr('request', fromName ? ` ${fromName}` : '', money, note ? tr('for', note) : '')}\n\n${how}\n${tr('thanks')}${mLine}`;
  return { message, link: payLink, momentumLink: momentumLink || null, amount: Math.round(Number(amount) * 100) / 100, currency };
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
