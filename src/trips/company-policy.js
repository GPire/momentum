const categories = ['trasporto', 'vitto', 'alloggio', 'altro'];
const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export async function loadCompanyPolicy(companyId, fetcher = fetch) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(companyId)) throw new Error('invalid_company');
  const response = await fetcher(`/v1/companies/${encodeURIComponent(companyId)}/policies`, { credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('company_unavailable');
  const policy = await response.json();
  const rules = policy?.rules;
  if (policy?.companyId !== companyId || !Number.isSafeInteger(policy.version) || policy.version < 1 || !rules || rules.currency !== 'EUR' || !amount(rules.receiptThreshold) ||
      !['expenseLimits', 'dailyLimits'].every(key => rules[key] && typeof rules[key] === 'object' && !Array.isArray(rules[key]) && Object.entries(rules[key]).every(([category, value]) => categories.includes(category) && amount(value)))) throw new Error('invalid_policy');
  return { companyId, companyName: typeof policy.companyName === 'string' ? policy.companyName : companyId, version: policy.version,
    rules: { currency: 'EUR', receiptThreshold: rules.receiptThreshold, expenseLimits: { ...rules.expenseLimits }, dailyLimits: { ...rules.dailyLimits } } };
}
export function applyCompanyPolicy(trip, policy) {
  return { ...trip, companyPolicy: { companyId: policy.companyId, version: policy.version, companyName: policy.companyName }, receiptPolicy: JSON.parse(JSON.stringify(policy.rules)) };
}
