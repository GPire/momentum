// Anti-duplicate matching per transazioni che arrivano da fonti diverse
// (scraping notifiche push, import PDF/CSV, Open Banking) e possono descrivere
// lo stesso acquisto con testo diverso (es. "SATISPAY*BAR ROMA" vs "Bar Roma").

export function normalizeStr(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove accenti
    .replace(/[^a-z0-9]+/g, " ")     // "SATISPAY*BAR" -> "satispay bar"
    .trim();
}

// Distanza di Levenshtein classica, O(n*m) — accettabile per lunghezza di descrizioni transazione.
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

// Similarità in [0,1]: 1 = identiche, 0 = completamente diverse.
export function descriptionSimilarity(a, b) {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

const DEFAULT_OPTS = {
  windowHours: 48,
  amountTolerance: 0.01,
  descriptionThreshold: 0.72,
};

// Restituisce la transazione esistente che fa match, o null.
// Le transazioni di questa app hanno forma: { date, amount, type, description, category }
export function findDuplicate(newTx, existingTxs, opts = {}) {
  const { windowHours, amountTolerance, descriptionThreshold } = { ...DEFAULT_OPTS, ...opts };
  const newDate = new Date(newTx.date).getTime();

  let best = null;
  let bestScore = 0;

  for (const tx of existingTxs) {
    const timeDiffHours = Math.abs(new Date(tx.date).getTime() - newDate) / 3_600_000;
    if (timeDiffHours > windowHours) continue;

    const sameAmount = Math.abs(tx.amount - newTx.amount) <= amountTolerance;
    if (!sameAmount) continue;

    if (newTx.type && tx.type && newTx.type !== tx.type) continue;

    // MOVIMENTO AUTO-AVVIATO (bonifico SEPA/sweep registrato da Momentum): quando
    // poi arriva il rigo della banca (CSV) con una descrizione MOLTO diversa, la
    // similarità testo fallirebbe. Ma sai di averlo fatto tu: stesso importo,
    // stesso tipo, stessa finestra su una tx flaggata selfTransfer non ancora
    // riconciliata = è lo stesso movimento. Match forte a prescindere dal testo.
    if (tx.selfTransfer && !tx.reconciledBank) {
      return tx; // riconciliazione certa, nessun rischio di doppio conteggio
    }

    const score = descriptionSimilarity(tx.description, newTx.description);
    if (score >= descriptionThreshold && score > bestScore) {
      best = tx;
      bestScore = score;
    }
  }

  return best;
}

export function isDuplicate(newTx, existingTxs, opts = {}) {
  return findDuplicate(newTx, existingTxs, opts) !== null;
}

// Arricchisce la transazione esistente coi campi che la nuova fonte aggiunge
// (es. la categoria di un estratto conto PDF, mancante nel log da notifica push),
// senza sovrascrivere campi già presenti.
export function mergeTransaction(existingTx, newTx) {
  const merged = { ...existingTx };
  for (const [key, value] of Object.entries(newTx)) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = value;
    }
  }
  merged.sources = Array.from(
    new Set([...(existingTx.sources || [existingTx.source].filter(Boolean)), newTx.source].filter(Boolean))
  );
  return merged;
}

// Punto d'ingresso per la pipeline di import: concilia una nuova transazione
// contro il log esistente di un mese, restituendo insert o merge.
export function reconcileTransaction(newTx, existingTxs, opts = {}) {
  const match = findDuplicate(newTx, existingTxs, opts);
  if (!match) {
    return { action: "insert", transaction: newTx };
  }
  return { action: "merge", targetId: match.id, transaction: mergeTransaction(match, newTx) };
}
