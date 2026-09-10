// User declarations override a prediction, never a historical transaction.
import { subscriptionSummary } from './subscriptions.js';
import { bnplExposure, detectBnplSeries } from './bnpl.js';
export function validPaymentDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function paymentKey(payment) {
  return payment.key || JSON.stringify([payment.category || '', String(payment.name || '').trim().toLowerCase()]);
}

export function paymentAgenda(summary, declarations = [], overrides = {}, today = new Date().toISOString().slice(0, 10)) {
  const predicted = (summary.subscriptions || []).map(sub => {
    const key = paymentKey(sub);
    const override = overrides[key];
    return { key, name: sub.name, amount: sub.amount, date: validPaymentDate(override?.date) ? override.date : sub.nextDate?.slice(0, 10), startDate: override?.startDate || '', endDate: override?.endDate || '', kind: sub.kind || 'recurring', source: validPaymentDate(override?.date) ? 'declared' : 'estimated', dismissed: override?.dismissed === true };
  });
  const declared = declarations.filter(validatePaymentDeclaration).flatMap(item => {
    const count = item.kind === 'installment' ? item.months || 1 : item.kind === 'recurring' ? 13 : 1;
    const anchor = new Date(item.date + 'T12:00:00Z');
    const current = new Date(today + 'T12:00:00Z');
    const dayStep = { weekly: 7, fortnightly: 14 }[item.cadence];
    const monthStep = { quarterly: 3, yearly: 12 }[item.cadence] || 1;
    const offset = item.kind !== 'recurring' ? 0 : Math.max(0, dayStep
      ? Math.floor((current - anchor) / (86400000 * dayStep))
      : Math.floor(((current.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + current.getUTCMonth() - anchor.getUTCMonth()) / monthStep));
    return Array.from({ length: count }, (_, position) => {
      const index = offset + position;
      const date = new Date(item.date + 'T12:00:00Z');
      const day = date.getUTCDate();
      if (item.kind === 'recurring' && ['weekly', 'fortnightly'].includes(item.cadence)) {
        date.setUTCDate(day + index * (item.cadence === 'weekly' ? 7 : 14));
      } else {
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + index * (item.kind === 'recurring' ? monthStep : 1));
        const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(day, end));
      }
      return { ...item, key: `${item.key}:${index}`, parentKey: item.key, date: date.toISOString().slice(0, 10), source: 'declared' };
    }).filter(row => item.kind !== 'recurring' || row.date >= today).slice(0, item.kind === 'recurring' ? 12 : count);
  });
  const replaced = new Set(declarations.filter(validatePaymentDeclaration).map(item => item.sourceKey).filter(Boolean));
  return [...predicted.filter(item => !replaced.has(item.key)), ...declared].filter(item => !item.dismissed && validPaymentDate(item.date)
    && (!validPaymentDate(item.startDate) || item.date >= item.startDate)
    && (!validPaymentDate(item.endDate) || item.date <= item.endDate)
    && (item.source === 'declared' || item.date >= today))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function validatePaymentDeclaration(value) {
  return value && typeof value.key === 'string' && value.key.startsWith('manual:') && typeof value.name === 'string' && value.name.trim().length > 0
    && value.name.length <= 120 && validPaymentDate(value.date)
    && ['trial', 'installment', 'payment', 'credit', 'recurring'].includes(value.kind)
    && (!value.startDate || (validPaymentDate(value.startDate) && value.startDate <= value.date))
    && (!value.endDate || (validPaymentDate(value.endDate) && value.endDate >= value.date))
    && (value.kind !== 'recurring' || ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'].includes(value.cadence))
    && (value.months === undefined || (Number.isInteger(value.months) && value.months >= 1 && value.months <= 120))
    && (value.kind !== 'installment' || (Number.isFinite(value.amount) && value.amount > 0))
    && (value.amount === null || (Number.isFinite(value.amount) && value.amount >= 0));
}

export function buildPaymentAgenda(state, now = new Date()) {
  const options = { now: +now, includeUnbranded: false, learned: state.mlData?.bnplLearned || {}, dismissed: state.mlData?.bnplDismissed || [] };
  const transactions = state.transactions || {};
  const series = detectBnplSeries(transactions, options);
  const installmentIds = new Set(series.flatMap(plan => plan.txIds));
  const remaining = Object.fromEntries(Object.entries(transactions).map(([key, values]) => [key, values.filter(tx => !installmentIds.has(tx.id))]));
  const summary = subscriptionSummary(remaining, now);
  const payments = bnplExposure(transactions, options).plans.flatMap(plan => plan.upcoming.map((item) => ({ key: `bnpl:${plan.id}:${item.date}`, name: plan.providerLabel, amount: item.amount, nextDate: item.date, kind: 'installment' })));
  return paymentAgenda({ subscriptions: [...summary.subscriptions, ...payments] }, state.paymentDeclarations || [], state.paymentOverrides || {}, now.toISOString().slice(0, 10));
}
