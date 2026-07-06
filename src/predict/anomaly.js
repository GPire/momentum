import { VaultDAO } from '../core/vault.js';
import { descriptionSimilarity } from '../core/deduplicator.js';

// Tra le anomalie (z-score alto), quali hanno un esercente MAI visto prima
// di quella transazione? Sono le più sospette: non solo un importo insolito,
// ma un venditore sconosciuto. Riusa descriptionSimilarity (stessa soglia
// del deduplicatore) contro tutte le transazioni PRECEDENTI alla data.
// Funzione pura testabile: prende anomalie + storico, nessuna dipendenza DOM.
export function findUnknownMerchants(anomalies, allTx, opts = {}) {
  const threshold = opts.similarityThreshold ?? 0.72;
  const all = Object.values(allTx || {}).flat();
  return anomalies.filter(a => {
    const aDate = new Date(a.tx.date);
    const priorSameMerchant = all.some(t =>
      t.id !== a.tx.id &&
      new Date(t.date) < aDate &&
      descriptionSimilarity(t.description || '', a.tx.description || '') >= threshold
    );
    return !priorSameMerchant; // nessuna tx precedente con esercente simile = sconosciuto
  });
}

const AnomalyDetector = {
  detectAll() {
    const anomalies = [];
    const dataByCategory = {};
    Object.keys(VaultDAO.state.transactions).forEach(m => {
      VaultDAO.state.transactions[m].forEach(t => {
        if (t.type === 'uscita') {
          if (!dataByCategory[t.category]) dataByCategory[t.category] = [];
          dataByCategory[t.category].push(t);
        }
      });
    });
    for (let cat in dataByCategory) {
      const txs = dataByCategory[cat];
      if (txs.length < 4) continue;
      const amounts = txs.map(t => t.amount);
      const avg = amounts.reduce((a,b)=>a+b, 0) / amounts.length;
      const variance = amounts.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;
      txs.forEach(t => {
        if ((t.amount - avg) / stdDev > 2.0) anomalies.push({ tx: t, zScore: (t.amount - avg)/stdDev });
      });
    }
    return anomalies;
  }
};


export { AnomalyDetector };
