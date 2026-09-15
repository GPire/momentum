// ============================================================
// POSIZIONE FISCALE ITALIANA — una sola vista, nessuna formula nuova
// ============================================================
// Questo modulo compone i motori fiscali già verificati in una posizione
// leggibile e auditabile. Non decide se una spesa è deducibile, non invia F24
// e non sostituisce il commercialista: espone invece la differenza tra
// fatturato, incassato, stima, versamenti e dati ancora da confermare.
//
// Il problema che risolve è di prodotto, non di matematica: prima fatture,
// movimenti, scadenze e versamenti vivevano in card separate e potevano
// usare basi diverse. Qui ogni numero porta la propria base e la propria
// copertura. Funzioni pure, nessun DOM e nessuna scrittura nel Vault.
'use strict';

import {
  classifyIncome,
  coefficienteAteco,
  projectAnnualTax,
  taxAdvice,
  taxSetAsideForPeriod,
  taxSetAside,
  verificaEsclusioneForfettario,
} from './tax.js';
import {
  accrualRevenue,
  cashBasisRevenue,
  ceilingStatusByCash,
  matchInvoicePayments,
  unpaidExposure,
} from './tax-cash-basis.js';
import { taxReserveStatus } from './tax-payments.js';
import { overdueTaxDeadlines, taxCashWarning, upcomingTaxDeadlines } from './tax-deadlines.js';
import { TAX_RULES_VERSION, getActiveTaxRules, rulesForYear, taxRulesFreshness } from './tax-rules.js';

export const ITALIAN_TAX_POSITION_VERSION = '2026-09-15';

const INVOICE_KINDS = new Set(['invoice']);

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asDate(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function yearOf(value) {
  const d = asDate(value);
  return d ? d.getFullYear() : null;
}

function flattenTransactions(transactions) {
  if (Array.isArray(transactions)) return transactions.filter(Boolean);
  if (!transactions || typeof transactions !== 'object') return [];
  return Object.values(transactions).flatMap((list) => Array.isArray(list) ? list.filter(Boolean) : []);
}

function validInvoice(invoice) {
  return !!invoice && asDate(invoice.date) && finitePositive(invoice.imponibile);
}

function money(value) {
  return +(Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(2);
}

function taxOptions(input, year, atecoInfo) {
  const atecoOverride = atecoInfo ? { coeffRedditivita: atecoInfo.coeff } : {};
  return {
    regime: input.regime || 'forfettario',
    year,
    rulesOverride: input.rulesOverride || null,
    learned: input.learned || null,
    model: input.model || null,
    cassaPropria: input.cassaPropria,
    altraCoperturaPrevidenziale: input.altraCoperturaPrevidenziale,
    taxUncertain: input.taxUncertain === true,
    // Un override esplicito dell'utente ha sempre precedenza sull'ATECO
    // suggerito; non si sovrascrive una scelta già confermata.
    overrides: { ...atecoOverride, ...(input.overrides || {}) },
  };
}

function syntheticMatchedTransactions(matches) {
  return (matches || []).map((match, index) => ({
    id: match.fattura?.number != null
      ? `invoice-payment-${match.fattura.number}-${match.fattura.year || ''}-${index}`
      : `invoice-payment-${index}`,
    type: 'entrata',
    amount: Number(match.importoIncassato),
    date: match.incassoData,
    // "fattura" è un segnale semantico già riconosciuto da classifyIncome;
    // non viene mostrato né salvato come movimento dell'utente.
    description: 'fattura incassata',
    source: 'invoice-payment-match',
  }));
}

function aggregateBreakdown(resultList) {
  const totals = {};
  for (const result of resultList || []) {
    for (const row of result?.breakdown || []) {
      totals[row.voce] = (totals[row.voce] || 0) + (Number(row.importo) || 0);
    }
  }
  return Object.entries(totals)
    .map(([voce, importo]) => ({ voce, importo: money(importo) }))
    .filter((row) => row.importo > 0)
    .sort((a, b) => b.importo - a.importo);
}

function cashTaxEstimate(matches, fallbackTransactions, options, useMatches) {
  if (!useMatches || !matches.length) {
    return {
      ...taxSetAsideForPeriod(fallbackTransactions, options),
      basis: 'movimenti-classificati',
    };
  }
  const synthetic = syntheticMatchedTransactions(matches);
  return {
    ...taxSetAsideForPeriod(synthetic, options),
    basis: 'incassi-abbinati-alle-fatture',
    matchedCount: synthetic.length,
  };
}

function paymentsForYear(payments, year) {
  return (payments || []).filter((payment) => yearOf(payment?.date) === year);
}

function classifyYearTransactions(transactions, input) {
  const counts = { invoice: 0, salary: 0, personal: 0, uncertain: 0 };
  const amounts = { invoice: 0, salary: 0, personal: 0, uncertain: 0 };
  let invalidCount = 0;
  let invalidAmount = 0;
  for (const tx of transactions) {
    const amount = finitePositive(tx?.amount);
    if (!asDate(tx?.date) || !amount) {
      invalidCount++;
      invalidAmount += Number.isFinite(Number(tx?.amount)) ? Math.max(0, Number(tx.amount)) : 0;
      continue;
    }
    const kind = classifyIncome(tx, input.learned || null, input.model || null).kind;
    const normalized = counts[kind] != null ? kind : 'uncertain';
    counts[normalized]++;
    amounts[normalized] += amount;
  }
  return {
    counts,
    amounts: Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, money(value)])),
    invalidCount,
    invalidAmount: money(invalidAmount),
  };
}

function confidenceFor({ regime, invoices, matches, uncertainCount, invalidCount, missingInputs }) {
  if (!regime) return { level: 'low', score: 0, reasonKeys: ['regime_mancante'] };
  let score = 0.55;
  if (invoices > 0) score += 0.15;
  if (matches > 0) score += 0.15;
  if (uncertainCount > 0) score -= Math.min(0.2, uncertainCount * 0.04);
  if (invalidCount > 0) score -= Math.min(0.15, invalidCount * 0.03);
  if (missingInputs.includes('ateco')) score -= 0.08;
  if (missingInputs.includes('forfettario_eligibility')) score -= 0.05;
  score = Math.max(0, Math.min(1, score));
  const level = score >= 0.8 ? 'high' : score >= 0.55 ? 'medium' : 'low';
  const reasonKeys = [];
  if (uncertainCount > 0) reasonKeys.push('entrate_da_confermare');
  if (invalidCount > 0) reasonKeys.push('movimenti_da_correggere');
  if (missingInputs.includes('ateco')) reasonKeys.push('ateco_non_confermato');
  if (missingInputs.includes('forfettario_eligibility')) reasonKeys.push('eleggibilita_non_verificata');
  return { level, score: +score.toFixed(2), reasonKeys };
}

/**
 * Costruisce la posizione fiscale italiana a partire dai dati già presenti.
 *
 * `transactions` può essere l'oggetto Vault { 'YYYY-MM': Transaction[] } o un
 * array. `invoices` sono le fatture emesse, anche di anni diversi: questo è
 * necessario per abbinare un incasso di gennaio a una fattura di dicembre.
 * Tutti gli importi sono stime e tutte le liste ritornate sono copie nuove.
 */
export function buildItalianTaxPosition(input = {}) {
  const requestedNow = asDate(input.now || input.referenceDate) || new Date();
  const explicitYear = Number.isInteger(input.year) ? input.year : null;
  const year = explicitYear ?? requestedNow.getFullYear();
  // Se si chiede un anno storico ma si lascia `now` nel presente, usare la
  // fine dell'anno richiesto evita una proiezione con mesi trascorsi del 2026
  // applicati a un anno 2025. Per il caso normale non cambia nulla.
  const referenceDate = explicitYear != null && requestedNow.getFullYear() !== year
    ? new Date(year, 11, 31)
    : requestedNow;
  const regime = input.regime || null;
  const allTransactions = flattenTransactions(input.transactions);
  const yearTransactions = allTransactions.filter((tx) => yearOf(tx?.date) === year);
  // Importers and old Vault snapshots can carry numeric strings. Keep the
  // raw records for diagnostics, but feed only normalized numbers to the tax
  // engines: `taxSetAsideForPeriod` deliberately works with arithmetic
  // numbers and should never receive a value that turns `0 + "500"` into a
  // string (or a NaN that reaches the UI).
  const calculableYearTransactions = yearTransactions.flatMap((tx) => {
    const date = asDate(tx?.date);
    const amount = finitePositive(tx?.amount);
    return date && amount ? [{ ...tx, amount }] : [];
  });
  const rawInvoices = Array.isArray(input.invoices) ? input.invoices : [];
  const invoices = rawInvoices.filter(validInvoice).map((invoice) => ({ ...invoice, imponibile: Number(invoice.imponibile) }));
  const invoicesYear = invoices.filter((invoice) => yearOf(invoice.date) === year);
  const invalidInvoiceCount = rawInvoices.length - invoices.length;
  const classification = classifyYearTransactions(yearTransactions, input);
  const transactionSource = Array.isArray(input.transactions) ? { all: input.transactions } : (input.transactions || {});
  const match = matchInvoicePayments(invoices, transactionSource, input.matchOptions || {});
  const matchesYear = match.incassate.filter((item) => item.annoIncasso === year);
  const fatturato = accrualRevenue(invoices, year);
  const incassato = cashBasisRevenue(match, year);
  const rulesOverride = input.rulesOverride || null;
  const rules = rulesForYear(year, rulesOverride);
  const freshness = taxRulesFreshness(year, input.rulesOverride || null);
  const activeRules = rulesOverride || getActiveTaxRules();
  const rulesVersion = typeof activeRules?.version === 'string' ? activeRules.version : TAX_RULES_VERSION;
  const atecoInfo = input.ateco
    ? coefficienteAteco(input.ateco, { year, rulesOverride: input.rulesOverride || null })
    : null;
  const options = taxOptions(input, year, atecoInfo);
  const isForfettario = !!regime && String(regime).startsWith('forfettario');
  const periodTax = regime ? taxSetAsideForPeriod(calculableYearTransactions, options) : null;
  // Nel forfettario conta la cassa: quando abbiamo fatture importate, gli
  // abbinamenti sono la fonte più fedele e i movimenti non classificati non
  // vengono trasformati in reddito per magia. Senza fatture, resta il
  // percorso esistente basato sulle entrate confermate.
  const cashTax = regime
    ? cashTaxEstimate(matchesYear, calculableYearTransactions, options, isForfettario && invoices.length > 0)
    : null;
  const projectionInput = regime && isForfettario && invoices.length > 0
    ? syntheticMatchedTransactions(matchesYear)
    : calculableYearTransactions;
  const projection = regime
    ? projectAnnualTax(projectionInput, { ...options, referenceDate, basis: isForfettario && invoices.length > 0 ? 'cash' : undefined })
    : null;
  const payments = paymentsForYear(input.taxPayments, year);
  const reserve = projection
    ? taxReserveStatus(projection.estimatedAnnualTax, payments)
    : null;
  const deadlines = projection && projection.estimatedAnnualTax > 0
    ? upcomingTaxDeadlines(projection.estimatedAnnualTax, {
      now: referenceDate,
      giaVersato: reserve?.versato || 0,
      rulesOverride: input.rulesOverride || null,
    })
    : [];
  const overdue = projection && projection.estimatedAnnualTax > 0
    ? overdueTaxDeadlines(projection.estimatedAnnualTax, {
      now: referenceDate,
      giaVersato: reserve?.versato || 0,
      rulesOverride: input.rulesOverride || null,
    })
    : [];
  const exposure = unpaidExposure(match, { now: referenceDate.getTime() });
  const matchedCurrentInvoices = matchesYear.filter((item) => yearOf(item.fattura?.date) === year);
  const ceiling = isForfettario && invoices.length > 0
    ? ceilingStatusByCash(incassato, fatturato, rules.forfettarioCeiling)
    : null;
  const answers = input.forfettarioAnswers;
  const eligibility = isForfettario && answers && typeof answers === 'object'
    ? { checked: Object.keys(answers).length > 0, ...verificaEsclusioneForfettario(answers) }
    : { checked: false, escluso: false, cause: [] };
  const missingInputs = [];
  if (!regime) missingInputs.push('regime');
  if (regime && isForfettario && !input.ateco) missingInputs.push('ateco');
  if (classification.counts.uncertain > 0) missingInputs.push('classify_ambiguous_income');
  if (classification.invalidCount > 0 || invalidInvoiceCount > 0) missingInputs.push('clean_invalid_data');
  if (regime && isForfettario && !eligibility.checked) missingInputs.push('forfettario_eligibility');
  if (projection && payments.length === 0) missingInputs.push('record_tax_payments');
  if (regime && !calculableYearTransactions.length && !invoicesYear.length && !matchesYear.length) missingInputs.push('taxable_data');
  if (eligibility.escluso) missingInputs.push('regime_check');
  const confidence = confidenceFor({
    regime,
    invoices: invoicesYear.length,
    matches: matchesYear.length,
    uncertainCount: classification.counts.uncertain,
    invalidCount: classification.invalidCount + invalidInvoiceCount,
    missingInputs,
  });
  const advice = projection
    ? taxAdvice({
      regime,
      annualizedRevenue: projection.annualizedRevenue,
      invoicedYTD: projection.invoicedYTD,
      estimatedAnnualTax: projection.estimatedAnnualTax,
      currentSetAside: reserve?.versato,
      year,
      rulesOverride: input.rulesOverride || null,
      cassaPropria: input.cassaPropria,
      altraCoperturaPrevidenziale: input.altraCoperturaPrevidenziale,
      overrides: options.overrides,
    }).advice
    : [];
  const cashWarning = input.cashForecast && deadlines.length
    ? taxCashWarning(deadlines, input.cashForecast, { riservaGiaAccantonata: reserve?.versato || 0 })
    : null;
  const status = !regime
    ? 'needs-regime'
    : (!calculableYearTransactions.length && !invoicesYear.length && !matchesYear.length)
      ? 'needs-data'
      : (missingInputs.length ? 'needs-confirmation' : 'ready');

  return {
    version: ITALIAN_TAX_POSITION_VERSION,
    countryCode: 'IT',
    year,
    referenceDate: referenceDate.toISOString(),
    regime,
    status,
    rules: {
      version: rulesVersion,
      requestedYear: year,
      appliedYear: rules.year,
      freshness,
    },
    inputs: {
      transactions: yearTransactions.length,
      invoices: invoicesYear.length,
      taxPayments: payments.length,
      ateco: input.ateco || null,
      atecoInfo,
    },
    cashBasis: {
      fatturato,
      incassato,
      differenza: money(fatturato - incassato),
      invoiceMatchRate: invoicesYear.length ? +(matchedCurrentInvoices.length / invoicesYear.length).toFixed(3) : null,
      ceiling,
      unpaid: exposure,
    },
    classification,
    matching: {
      invoicesConsidered: invoices.length,
      invalidInvoiceCount,
      matched: matchesYear.length,
      unmatchedCurrentYear: match.nonIncassate.filter((item) => yearOf(item.fattura?.date) === year).length,
      confidence: {
        high: matchesYear.filter((item) => item.confidenza === 'alta').length,
        medium: matchesYear.filter((item) => item.confidenza === 'media').length,
      },
    },
    estimate: regime
      ? {
        basis: cashTax?.basis || 'movimenti-classificati',
        period: cashTax,
        periodClassified: periodTax,
        breakdown: aggregateBreakdown([cashTax]),
        projection,
        reserve,
        deadlines,
        overdue,
        cashWarning,
      }
      : null,
    eligibility,
    advice,
    confidence,
    missingInputs,
    // Chi consuma il motore può tradurre questi codici nella lingua attiva;
    // non inseriamo frasi italiane nella posizione per non forzare una lingua
    // nella UI internazionale.
    actionKeys: missingInputs.map((key) => ({
      regime: 'choose_regime',
      ateco: 'confirm_ateco',
      classify_ambiguous_income: 'confirm_income_type',
      clean_invalid_data: 'fix_invalid_data',
      forfettario_eligibility: 'check_forfettario_eligibility',
      record_tax_payments: 'record_tax_payment',
      taxable_data: 'add_invoice_or_income',
      regime_check: 'review_regime_with_accountant',
    }[key] || key)),
    disclaimerKey: 'estimate_not_official_filing',
  };
}
