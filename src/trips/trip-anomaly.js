// Spese di trasferta insolite rispetto alla PROPRIA media storica —
// stessa metodologia già in produzione per le spese personali (vedi
// src/predict/anomaly.js: z-score, soglia 2.0 di default), qui applicata
// al bucket di trasferta (trasporto/vitto/alloggio/altro) invece della
// categoria reale, perché è quello che un revisore aziendale confronta
// davvero — mai un secondo algoritmo inventato per lo stesso problema.
//
// Richiede lo storico di TUTTE le trasferte della persona (non solo quella
// aperta): con poche spese in una singola trasferta la deviazione standard
// non è mai statisticamente significativa — servono almeno 4 spese passate
// nella STESSA categoria di trasferta E valuta (confrontare 40€ di pranzo
// con 40$ sarebbe un confronto inventato, non un dato).
//
// Limite matematico dichiarato (trovato scrivendo i test, non un bug): lo
// z-score qui è "auto-inclusivo" (il punto sospetto entra anche nel calcolo
// di media/deviazione standard, stessa scelta del motore personale) — per
// costruzione, il valore massimo raggiungibile da un SOLO outlier su n
// punti è sqrt(n-1). Con n=4 (il minimo richiesto) il tetto è esattamente
// 2.0: nessun importo, per quanto estremo, può mai superare la soglia di
// default. Servono almeno ~6 spese storiche nella stessa categoria+valuta
// perché il segnale possa davvero scattare — coerente con l'onestà del
// resto del progetto: con troppo pochi dati, "anomalo" non è un giudizio
// difendibile, non un limite da nascondere.
//
// Onestà del segnale: uno z-score alto NON è una prova di frode, è un
// fatto statistico ("questa spesa esce dalla tua norma") — il revisore
// decide, mai un blocco automatico, stesso principio già seguito per
// policy_daily/policy_limit/duplicate_receipt.
export function detectTripAmountAnomalies(allTripExpenses, { zThreshold = 2.0 } = {}) {
  const byGroup = new Map();
  for (const tx of allTripExpenses || []) {
    if (!tx?.businessTripId || !(tx.amount > 0)) continue;
    const key = `${tx.tripCategory || 'altro'}|${tx.currency || 'EUR'}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(tx);
  }
  const anomalies = [];
  for (const txs of byGroup.values()) {
    if (txs.length < 4) continue;
    const amounts = txs.map(t => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, v) => acc + (v - avg) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;
    for (const tx of txs) {
      const zScore = (tx.amount - avg) / stdDev;
      if (zScore > zThreshold) anomalies.push({ tx, zScore, average: avg });
    }
  }
  return anomalies;
}
