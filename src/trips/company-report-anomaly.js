// Resoconto insolitamente alto rispetto alla media storica DELL'AZIENDA —
// stessa metodologia già in produzione per lo z-score personale
// (src/predict/anomaly.js) e per trip-anomaly.js (spese vs propria norma),
// qui applicata al TOTALE di un resoconto vs gli altri resoconti della
// stessa azienda (stessa valuta di policy, quindi confronto sempre lecito
// senza conversione). Mai un secondo algoritmo inventato per lo stesso
// problema statistico.
//
// Limite matematico dichiarato (stesso di trip-anomaly.js): con lo z-score
// auto-inclusivo, il tetto raggiungibile da un solo outlier su n punti è
// sqrt(n-1). Con meno di 6 campioni storici nessun importo può mai superare
// la soglia di default 2.0 — minSamples=6 non è arbitrario, è il minimo
// perché il segnale possa scattare davvero.
//
// Onestà del segnale: uno z-score alto è un fatto statistico ("insolito
// rispetto alla storia dell'azienda"), MAI una prova o un'accusa — il
// revisore decide, nessun blocco automatico, stesso principio già seguito
// per policy_daily/policy_limit/duplicate_receipt/checks.
export function companyReportAnomaly(currentTotal, historicalTotals, { zThreshold = 2.0, minSamples = 6 } = {}) {
  const amounts = (historicalTotals || []).filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (!(typeof currentTotal === 'number' && Number.isFinite(currentTotal) && currentTotal >= 0)) return null;
  if (amounts.length < minSamples - 1) return null;
  const all = [...amounts, currentTotal];
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  const variance = all.reduce((acc, v) => acc + (v - avg) ** 2, 0) / all.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return null;
  const zScore = (currentTotal - avg) / stdDev;
  return zScore > zThreshold ? { zScore, average: avg, sampleSize: all.length } : null;
}
