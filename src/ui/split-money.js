// A group amount is already in its base currency: formatting must never convert it.
export function formatSplitMoney(amount, group = {}, locale = 'it-IT') {
  const currency = String(group?.baseCurrency || 'EUR').trim().toUpperCase();
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
