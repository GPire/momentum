// Quantizzazione int8 dei pesi del modello — ottimizzazione per hardware
// debole (CPU come l'Intel i5, poca RAM). I pesi float64 diventano int8
// (1 byte invece di 8): 8× più piccoli in memoria, meno banda di memoria da
// leggere nei loop caldi dell'inferenza → più veloce su CPU lente.
//
// Schema onesto: quantizzazione simmetrica per-matrice. Ogni matrice di pesi
// W ha un fattore di scala s = max(|W|)/127; il peso quantizzato è
// round(W/s) in [-127,127]; alla dequantizzazione W ≈ q*s. L'errore è
// piccolo e MISURATO (vedi bench): l'accuratezza non deve calare oltre
// ~1 punto, altrimenti si resta in float. Nessuna magia, nessun "25x":
// un uso migliore della memoria reale.

// Quantizza una matrice 2D → { q: Int8Array piatto, scale, rows, cols }.
export function quantizeMatrix(W) {
  const rows = W.length, cols = W[0].length;
  let maxAbs = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = Math.abs(W[i][j]);
    if (a > maxAbs) maxAbs = a;
  }
  const scale = maxAbs / 127 || 1e-8;
  const q = new Int8Array(rows * cols);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    q[i * cols + j] = Math.max(-127, Math.min(127, Math.round(W[i][j] / scale)));
  }
  return { q, scale, rows, cols };
}

// Quantizza tutti gli strati di pesi di un modello (coefs). Gli intercept
// restano float (piccoli e sensibili). Ritorna la struttura quantizzata.
export function quantizeModel(coefs) {
  return coefs.map(quantizeMatrix);
}

// Prodotto vettore×matrice quantizzata con dequantizzazione al volo:
// out[k] = scale * Σ_i (input[i] * q[i][k]). L'input resta float; solo i
// pesi (la parte grossa in memoria) sono int8. Equivalente numerico al
// prodotto float a meno dell'errore di quantizzazione dei pesi.
export function matmulQuantized(input, qMatrix) {
  const { q, scale, rows, cols } = qMatrix;
  const out = new Float64Array(cols);
  for (let i = 0; i < rows; i++) {
    const xi = input[i];
    if (xi === 0) continue;
    const base = i * cols;
    for (let k = 0; k < cols; k++) out[k] += xi * q[base + k];
  }
  for (let k = 0; k < cols; k++) out[k] *= scale;
  return out;
}
