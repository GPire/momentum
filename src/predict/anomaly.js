import { VaultDAO } from '../core/vault.js';

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
