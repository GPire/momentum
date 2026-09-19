import { VALUTE_ISO4217 } from '../core/iso4217.js';
const categories = ['trasporto', 'vitto', 'alloggio', 'altro'];
const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
// Una tariffa al km/miglio non è un importo assoluto (vedi lo stesso
// commento in server/company/worker.js): l'IRS USA 2026 è $0,725/miglio,
// bocciata da amount() che vuole centesimi interi — 3 decimali, non 2.
const tariffaUnitaria = n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1000 && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;
export async function loadCompanyPolicy(companyId, fetcher = fetch) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(companyId)) throw new Error('invalid_company');
  const response = await fetcher(`/v1/companies/${encodeURIComponent(companyId)}/policies`, { credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('company_unavailable');
  const policy = await response.json();
  const rules = policy?.rules;
  // Qualunque valuta ISO 4217 reale è ammessa (fino al 2026-09-19 solo EUR:
  // l'editor non aveva un campo valuta — ora ce l'ha, vedi
  // server/company/workspace-page.js). Stessa disciplina di sempre: mai
  // fidarsi ciecamente del server, riverificata anche qui.
  if (policy?.companyId !== companyId || !Number.isSafeInteger(policy.version) || policy.version < 1 || !rules || typeof rules.currency !== 'string' || !VALUTE_ISO4217.has(rules.currency) || !amount(rules.receiptThreshold) ||
      !['expenseLimits', 'dailyLimits'].every(key => rules[key] && typeof rules[key] === 'object' && !Array.isArray(rules[key]) && Object.entries(rules[key]).every(([category, value]) => categories.includes(category) && amount(value)))) throw new Error('invalid_policy');
  // perDiem/mileage sono OPZIONALI (una policy pubblicata prima che
  // esistessero resta valida) — ma se presenti, mai propagati senza
  // riverificarli qui: il client non si fida ciecamente del server, stessa
  // disciplina già in uso per ogni altro dato remoto nel progetto.
  const perDiem = rules.perDiem && typeof rules.perDiem === 'object' && !Array.isArray(rules.perDiem) && amount(rules.perDiem.piena) && amount(rules.perDiem.ridotta) && rules.perDiem.ridotta <= rules.perDiem.piena
    ? { piena: rules.perDiem.piena, ridotta: rules.perDiem.ridotta } : null;
  const mileage = rules.mileage && typeof rules.mileage === 'object' && !Array.isArray(rules.mileage) && tariffaUnitaria(rules.mileage.tariffa) && ['km', 'mi'].includes(rules.mileage.unita)
    ? { tariffa: rules.mileage.tariffa, unita: rules.mileage.unita } : null;
  return { companyId, companyName: typeof policy.companyName === 'string' ? policy.companyName : companyId, version: policy.version,
    rules: { currency: rules.currency, receiptThreshold: rules.receiptThreshold, expenseLimits: { ...rules.expenseLimits }, dailyLimits: { ...rules.dailyLimits }, ...(perDiem ? { perDiem } : {}), ...(mileage ? { mileage } : {}) } };
}
export function applyCompanyPolicy(trip, policy) {
  return { ...trip, companyPolicy: { companyId: policy.companyId, version: policy.version, companyName: policy.companyName }, receiptPolicy: JSON.parse(JSON.stringify(policy.rules)) };
}
