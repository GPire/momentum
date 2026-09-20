import { VALUTE_ISO4217 } from '../core/iso4217.js';
import { reimbursementLinkState } from './reimbursement-links.js';

// Read-only reconciliation of explicitly linked movements, never inferred from
// a merchant name or date. Expenses are a request, not evidence of approval.
export function reimbursementBalance(trip, transactions = []) {
  const currency = trip.receiptPolicy?.currency || 'EUR';
  if (!VALUTE_ISO4217.has(currency)) throw new TypeError('Invalid trip currency');
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const scale = 10 ** digits;
  const issues = [], accepted = [], groups = new Map();
  let requested = 0, received = 0;
  for (const tx of transactions) {
    if (!tx) continue;
    const link = tx.type === 'entrata' ? reimbursementLinkState(tx) : { tripId: tx.businessTripId };
    if (link.conflict && (tx.reimbursementLinks || []).some(event => event.tripId === trip.id)) {
      issues.push({ id: String(tx.id), reason: 'link_conflict' }); continue;
    }
    if (link.tripId !== trip.id) continue;
    if (!['entrata', 'uscita'].includes(tx.type)) continue;
    if (tx.id === undefined || tx.id === null || String(tx.id).trim() === '') {
      issues.push({ id: null, reason: 'missing_id' }); continue;
    }
    const id = String(tx.id);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(tx);
  }
  for (const [id, copies] of groups) {
    const tx = copies[0];
    const evidence = row => JSON.stringify([row.type, row.amount, row.currency, row.date,
      row.originalAmount, row.originalCurrency, row.exchangeRate, !!row.tripRevisionConflict, !!row.tripPersonal]);
    if (copies.some(copy => evidence(copy) !== evidence(tx))) {
      issues.push({ id, reason: 'conflicting_duplicate' }); continue;
    }
    if (tx.tripPersonal) continue;
    if (tx.tripRevisionConflict) { issues.push({ id, reason: 'revision_conflict' }); continue; }
    if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !Number.isSafeInteger(Math.round(tx.amount * scale))) {
      issues.push({ id, reason: 'invalid_amount' }); continue;
    }
    // Missing legacy currency is not proof of the trip's currency.
    if (tx.currency !== currency) { issues.push({ id, reason: 'currency_unresolved' }); continue; }
    if (tx.originalCurrency && tx.originalCurrency !== currency) {
      if (!VALUTE_ISO4217.has(tx.originalCurrency) || !Number.isFinite(tx.originalAmount)
        || tx.originalAmount <= 0 || !Number.isFinite(tx.exchangeRate) || tx.exchangeRate <= 0
        || Math.abs(Math.round(tx.originalAmount * tx.exchangeRate * scale) - Math.round(tx.amount * scale)) > 1) {
        issues.push({ id, reason: 'exchange_unresolved' }); continue;
      }
    }
    const units = Math.round(tx.amount * scale);
    if (!Number.isSafeInteger((tx.type === 'entrata' ? received : requested) + units)) {
      issues.push({ id, reason: 'invalid_amount' }); continue;
    }
    if (tx.type === 'entrata') received += units; else requested += units;
    accepted.push({ id, type: tx.type, amount: units / scale, currency,
      originalAmount: tx.originalAmount ?? null, originalCurrency: tx.originalCurrency ?? null,
      exchangeRate: tx.exchangeRate ?? null, date: tx.date });
  }
  const difference = requested - received;
  return { currency, requested: requested / scale, received: received / scale,
    remaining: issues.length ? null : Math.max(0, difference) / scale,
    excess: issues.length ? null : Math.max(0, -difference) / scale,
    status: issues.length ? 'review' : received === 0 ? 'waiting' : difference > 0 ? 'partial' : difference < 0 ? 'excess' : 'balanced',
    accepted, issues };
}
