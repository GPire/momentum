// Portable evidence package, not a vendor-specific API payload or Vault backup.
import { needsReceipt } from './trip-engine.js';
import { isTripAttachment } from './attachment-format.js';

export function isTripDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = value.slice(0, 10);
  return Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}

export function inspectTripArchive(transactions, policy) {
  const ids = new Map();
  for (const tx of transactions) { const id = String(tx?.id ?? '').trim(); if (id) ids.set(id, (ids.get(id) || 0) + 1); }
  const issues = [];
  const daily = new Map();
  for (const tx of transactions) {
    if (!tx || !isTripDate(tx.date) || !Number.isFinite(tx.amount) || tx.amount < 0 || (tx.currency || 'EUR') !== (policy?.currency || 'EUR')) continue;
    const key = JSON.stringify([tx.date.slice(0, 10), tx.tripCategory]);
    daily.set(key, (daily.get(key) || 0) + Math.round(tx.amount * 100));
  }
  transactions.forEach((tx, index) => {
    tx = tx || {};
    const issue = (code, severity = 'blocking') => issues.push({ index, transactionId: tx.id ?? null, code, severity });
    if (tx.tripRevisionConflict) issue('revision_conflict');
    const id = String(tx.id ?? '').trim();
    if (!id) issue('missing_id');
    else if (ids.get(id) > 1) issue('duplicate_id');
    if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount < 0 || !Number.isSafeInteger(Math.round(tx.amount * 100))) issue('invalid_amount');
    if (!isTripDate(tx.date)) issue('invalid_date');
    const dayLimit = policy?.dailyLimits?.[tx.tripCategory];
    if (dayLimit !== undefined && dayLimit !== null) {
      if (typeof dayLimit !== 'number' || !Number.isFinite(dayLimit) || dayLimit < 0 || !Number.isSafeInteger(Math.round(dayLimit * 100))) issue('invalid_policy');
      else if ((tx.currency || 'EUR') !== (policy.currency || 'EUR')) issue('policy_currency', 'warning');
      else if (isTripDate(tx.date) && daily.get(JSON.stringify([tx.date.slice(0, 10), tx.tripCategory])) > Math.round(dayLimit * 100)) issue('policy_daily', 'warning');
    }
    const limit = policy?.expenseLimits?.[tx.tripCategory];
    if (limit !== undefined && limit !== null) {
      if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0 || !Number.isSafeInteger(Math.round(limit * 100))) issue('invalid_policy');
      else if ((tx.currency || 'EUR') !== (policy.currency || 'EUR')) issue('policy_currency', 'warning');
      else if (Math.round(tx.amount * 100) > Math.round(limit * 100)) issue('policy_limit', 'warning');
    }
    if (!tx.receiptImage) issue('missing_attachment', needsReceipt(tx, policy) ? 'warning' : 'info');
    else if (!isTripAttachment(tx.receiptImage)) issue('invalid_attachment');
  });
  return { transactionCount: transactions.length, attachmentCount: transactions.filter(tx => tx?.receiptImage).length,
    blockingCount: new Set(issues.filter(issue => issue.severity === 'blocking').map(issue => issue.index)).size,
    warningCount: new Set(issues.filter(issue => issue.severity === 'warning').map(issue => issue.index)).size,
    reviewCount: new Set(issues.map(issue => issue.index)).size, issues };
}

export function buildTripArchive(trip, transactions, exportedAt = new Date().toISOString()) {
  if (!trip?.id || !Array.isArray(transactions)) throw new TypeError('Invalid trip archive');
  const selected = transactions.filter(tx => tx?.businessTripId === trip.id);
  return JSON.parse(JSON.stringify({
    format: 'momentum-trip-archive', version: 1, exportedAt,
    trip,
    transactions: selected,
    checks: inspectTripArchive(selected, trip.receiptPolicy),
  }));
}
