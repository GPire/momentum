// ============================================================
// MODELLO ENTRATE — capisce lo stipendio dai movimenti (giorno + importo)
// ============================================================
// Nessuna app di divisione spese sa QUANDO ti arriva lo stipendio. Momentum sì,
// e lo capisce da solo dai movimenti: quale entrata è ricorrente e mensile, in
// che GIORNO del mese arriva, e di che IMPORTO tipico. Serve a molte previsioni
// (su tutte: "questo debito puoi saldarlo dopo il ~27, quando ti arriva
// l'accredito" — senza mai lasciarti a secco). Proprietario e onesto: statistica
// trasparente (mediana + consistenza), TACE se non ci sono almeno 2 accrediti
// mensili coerenti (non inventa un giorno), ed è sempre MODIFICABILE dall'utente
// (override manuale che vince sul rilevato). Funzioni pure, nessun DOM.
'use strict';

import { descriptionSimilarity } from '../core/deduplicator.js';

const DAY_MS = 86_400_000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Rileva lo stipendio: la serie di ENTRATE con cadenza ~mensile più plausibile.
// Tra i candidati sceglie quello con importo tipico più alto (di norma lo
// stipendio è l'entrata ricorrente maggiore). Ritorna null se nessuna serie ha
// ≥minOccurrences accrediti mensili. `dayOfMonth` = mediana dei giorni; `amount`
// = mediana degli importi (robusti agli straordinari/una-tantum).
export function detectSalary(allTx, { minOccurrences = 2, similarityThreshold = 0.6 } = {}) {
  const incomes = Object.values(allTx || {}).flat()
    .filter(t => t && t.type === 'entrata' && +t.amount > 0 && t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (incomes.length < minOccurrences) return null;

  // Raggruppa per descrizione simile (stesso giudice del deduplicatore): così
  // "Stipendio ACME" e "STIPENDIO ACME SRL" finiscono insieme, un bonifico
  // sporadico di un amico no.
  const groups = [];
  for (const t of incomes) {
    let g = groups.find(g => descriptionSimilarity(g.rep, t.description || '') >= similarityThreshold);
    if (!g) { g = { rep: t.description || '', items: [] }; groups.push(g); }
    g.items.push(t);
  }

  const cands = [];
  for (const g of groups) {
    if (g.items.length < minOccurrences) continue;
    const dates = g.items.map(t => new Date(t.date));
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
    const monthly = gaps.length > 0 && gaps.every(d => d >= 20 && d <= 40);
    if (!monthly) continue;
    const days = dates.map(d => d.getDate());
    const amts = g.items.map(t => +t.amount);
    const dayMed = Math.round(median(days));
    // Consistenza del giorno: tutti entro ±4 dal mediano (o wrap di fine mese).
    const dayConsistent = days.every(d => Math.abs(d - dayMed) <= 4 || Math.abs(d - dayMed) >= 24);
    cands.push({ label: g.rep || 'Stipendio', dayOfMonth: dayMed, amount: Math.round(median(amts) * 100) / 100, monthsSeen: g.items.length, dayConsistent });
  }
  if (!cands.length) return null;

  cands.sort((a, b) => b.amount - a.amount || b.monthsSeen - a.monthsSeen);
  const best = cands[0];
  const confidence = Math.round(Math.min(1, best.monthsSeen / 4) * (best.dayConsistent ? 1 : 0.6) * 100) / 100;
  return { dayOfMonth: best.dayOfMonth, amount: best.amount, monthsSeen: best.monthsSeen, label: best.label, confidence, source: 'auto' };
}

// Prossimo giorno di paga a partire da una data: questo mese se il giorno non è
// ancora passato, altrimenti il mese prossimo. Il giorno è "clampato" alla
// lunghezza reale del mese (il 31 a febbraio → ultimo giorno).
export function nextPayday(salary, fromDate = new Date()) {
  if (!salary || !salary.dayOfMonth) return null;
  const from = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const day = salary.dayOfMonth;
  const clampDay = (y, m) => Math.min(day, new Date(y, m + 1, 0).getDate());
  let y = from.getFullYear(), m = from.getMonth();
  let d = new Date(y, m, clampDay(y, m));
  if (d < startOfDay(from)) { m++; if (m > 11) { m = 0; y++; } d = new Date(y, m, clampDay(y, m)); }
  return d;
}

// Giorni da `fromDate` al prossimo accredito (0 = oggi). null se ignoto.
export function daysToNextPayday(salary, fromDate = new Date()) {
  const nd = nextPayday(salary, fromDate);
  if (!nd) return null;
  return Math.round((startOfDay(nd) - startOfDay(fromDate instanceof Date ? fromDate : new Date(fromDate))) / DAY_MS);
}

// Lo stipendio EFFETTIVO da usare: l'override manuale dell'utente se presente
// (sempre modificabile, richiesta esplicita), altrimenti quello rilevato dai
// movimenti. `state.salaryProfile` = { dayOfMonth, amount, label } opzionale.
export function resolveSalary(state, allTx) {
  const ov = state && state.salaryProfile;
  if (ov && +ov.dayOfMonth >= 1 && +ov.dayOfMonth <= 31 && +ov.amount > 0) {
    return { dayOfMonth: +ov.dayOfMonth, amount: +ov.amount, label: ov.label || 'Stipendio', source: 'manual' };
  }
  return detectSalary(allTx);
}
