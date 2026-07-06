// Rilevatore di abbonamenti ricorrenti e aumenti di prezzo silenziosi
// (es. uno streaming che passa da 9,99€ a 14,99€ senza che l'utente se ne
// accorga). Motivo: è una delle cause più concrete per cui le persone
// smettono di fidarsi della propria gestione finanziaria — se non lo nota
// l'app, lo nota la banca a fine mese. Funzioni pure sui dati (stesso
// principio di deduplicator.js/dispatcher.js), nessuna dipendenza da DOM.
import { descriptionSimilarity } from '../core/deduplicator.js';

const DEFAULT_OPTS = {
  minOccurrences: 2,       // almeno 2 addebiti per parlare di "ricorrente"
  intervalDays: { min: 25, max: 35 }, // tolleranza attorno al mese
  similarityThreshold: 0.72, // stessa soglia del merge del deduplicatore
  hikeThreshold: 0.10,     // 10% di aumento rispetto alla media precedente
};

function flattenTx(allTx) {
  return Object.values(allTx || {}).flat().filter(t => t.type === 'uscita');
}

// Raggruppa le transazioni per descrizione simile (stesso giudice del
// deduplicatore) all'interno della stessa categoria, poi tiene solo i
// gruppi con cadenza plausibilmente mensile.
export function detectRecurring(allTx, opts = {}) {
  const { minOccurrences, intervalDays, similarityThreshold } = { ...DEFAULT_OPTS, ...opts };
  const txs = flattenTx(allTx).sort((a, b) => new Date(a.date) - new Date(b.date));

  const groups = [];
  for (const tx of txs) {
    let group = groups.find(g =>
      g.category === tx.category &&
      descriptionSimilarity(g.representative, tx.description) >= similarityThreshold
    );
    if (!group) {
      group = { representative: tx.description, category: tx.category, items: [] };
      groups.push(group);
    }
    group.items.push(tx);
  }

  return groups
    .filter(g => g.items.length >= minOccurrences)
    .map(g => {
      const intervals = [];
      for (let i = 1; i < g.items.length; i++) {
        const days = (new Date(g.items[i].date) - new Date(g.items[i - 1].date)) / 86_400_000;
        intervals.push(days);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / (intervals.length || 1);
      const isMonthly = intervals.every(d => d >= intervalDays.min && d <= intervalDays.max);
      return { ...g, avgInterval, isMonthly };
    })
    .filter(g => g.isMonthly);
}

// Per ogni serie ricorrente, confronta l'ultimo addebito con la media dei
// precedenti: se l'aumento supera la soglia, lo segnala con i numeri veri
// (mai un giudizio, solo il fatto misurato — coerente col resto del progetto).
export function detectPriceHikes(allTx, opts = {}) {
  const { hikeThreshold } = { ...DEFAULT_OPTS, ...opts };
  const recurring = detectRecurring(allTx, opts);
  const hikes = [];

  for (const group of recurring) {
    const items = group.items;
    const latest = items[items.length - 1];
    const previous = items.slice(0, -1);
    const avgPrevious = previous.reduce((a, t) => a + t.amount, 0) / previous.length;
    if (avgPrevious === 0) continue;

    const increase = (latest.amount - avgPrevious) / avgPrevious;
    if (increase > hikeThreshold) {
      hikes.push({
        description: group.representative,
        category: group.category,
        previousAmount: +avgPrevious.toFixed(2),
        newAmount: latest.amount,
        increasePct: +(increase * 100).toFixed(1),
        occurrences: items.length,
        latestDate: latest.date,
      });
    }
  }
  return hikes.sort((a, b) => b.increasePct - a.increasePct);
}
