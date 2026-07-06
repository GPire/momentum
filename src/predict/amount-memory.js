// Memoria intelligente degli importi: per gli acquisti abituali la cifra è
// quasi sempre la stessa (sigarette, caffè, abbonamento palestra) — farla
// ridigitare ogni volta è la frizione che fa abbandonare queste app.
// Due funzioni pure:
// - predictAmount: dato categoria (e descrizione se c'è), l'importo tipico
//   con confidenza dichiarata — MAI un numero se il pattern non è stabile.
// - getQuickAddSuggestions: gli acquisti ricorrenti più frequenti degli
//   ultimi 90 giorni, per i tasti rapidi one-tap nel form.
// Stesso principio di tutto il progetto: fatti misurati, niente invenzioni.
import { descriptionSimilarity } from '../core/deduplicator.js';

const DAY_MS = 86_400_000;

function flatten(allTx) {
  return Object.values(allTx || {}).flat();
}

// Importo "modale" di un insieme di transazioni: il valore esatto più
// frequente e la sua quota. Cifra stabile = stesso importo al centesimo.
function modalAmount(txs) {
  const counts = new Map();
  for (const t of txs) {
    const key = t.amount.toFixed(2);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  for (const [amt, n] of counts) {
    if (!best || n > best.n) best = { amount: parseFloat(amt), n };
  }
  if (!best) return null;
  return { amount: best.amount, occurrences: best.n, share: best.n / txs.length };
}

// Importo previsto per (categoria, descrizione). La descrizione, se
// presente, è il segnale più forte (fuzzy match come il deduplicatore);
// altrimenti si usa la sola categoria. Confidenza:
// - 'alta': ≥3 occorrenze dello stesso importo e ≥60% dei casi
// - 'media': ≥2 occorrenze e ≥50%
// - null: pattern non stabile → nessun suggerimento (mai indovinare).
export function predictAmount(catId, description, allTx, opts = {}) {
  const threshold = opts.similarityThreshold ?? 0.72;
  const all = flatten(allTx);

  let pool = [];
  if (description && description.trim().length >= 3) {
    pool = all.filter(t => descriptionSimilarity(t.description || '', description) >= threshold);
  }
  if (pool.length < 2 && catId) {
    pool = all.filter(t => t.category === catId);
  }
  if (pool.length < 2) return null;

  const modal = modalAmount(pool);
  if (!modal) return null;

  if (modal.occurrences >= 3 && modal.share >= 0.6) return { amount: modal.amount, confidence: 'alta', occurrences: modal.occurrences };
  if (modal.occurrences >= 2 && modal.share >= 0.5) return { amount: modal.amount, confidence: 'media', occurrences: modal.occurrences };
  return null;
}

// Tasti rapidi: gruppi di spese con descrizione simile, frequenti negli
// ultimi `windowDays` giorni e con importo stabile (quota modale ≥60%).
// Ordinati per frequenza: il caffè quotidiano prima dell'acquisto mensile.
export function getQuickAddSuggestions(allTx, referenceDate = new Date(), limit = 4, windowDays = 90) {
  const cutoff = new Date(referenceDate.getTime() - windowDays * DAY_MS);
  const recent = flatten(allTx).filter(t => t.type === 'uscita' && new Date(t.date) >= cutoff && (t.description || '').trim());

  const groups = [];
  for (const t of recent) {
    let g = groups.find(g => g.category === t.category && descriptionSimilarity(g.representative, t.description) >= 0.72);
    if (!g) { g = { representative: t.description, category: t.category, items: [] }; groups.push(g); }
    g.items.push(t);
  }

  return groups
    .filter(g => g.items.length >= 3)
    .map(g => {
      const modal = modalAmount(g.items);
      return modal && modal.share >= 0.6
        ? { description: g.representative, category: g.category, amount: modal.amount, type: 'uscita', occurrences: g.items.length }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);
}
