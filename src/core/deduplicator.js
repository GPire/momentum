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

// PENDING → POSTED (2026-08-28): verificato via ricerca (non ipotizzato) —
// la causa più citata di duplicati sfuggiti in un tracker di spese multi-
// canale è proprio questa: una notifica bancaria/uno screenshot cattura
// l'addebito SUBITO con un importo ancora provvisorio ("pending" — es. un
// ristorante prima di aggiungere la mancia, o una valuta estera prima della
// conversione finale), mentre l'estratto conto (CSV/PDF) arriva DOPO con
// l'importo VERO ("posted") — a volte giorni dopo, se nel mezzo c'è un
// weekend o un festivo. Con la finestra stretta di sempre (48h, 1 centesimo)
// questi due arrivi della STESSA spesa reale rischiano di non incontrarsi
// mai e restare due righe duplicate. Qui si allarga la finestra SOLO per
// questo caso specifico — mai per il confronto generale, che resta quello
// stretto di sempre — e SOLO in una direzione: dalla transazione "immediata"
// già presente (source notifica/screenshot) verso quella "definitiva" che
// arriva dopo (CSV/PDF, senza quei source). L'importo che resta è quello
// GIÀ salvato (mai riscritto: fa parte della catena hash usata per la
// sincronizzazione, vedi VaultDAO.addTransaction) — questo risolve "vedo la
// spesa due volte", non "l'importo esatto al centesimo", che richiederebbe
// toccare quella catena e non vale il rischio per un problema di UX.
const PENDING_SOURCES = new Set(['notification', 'screenshot_ocr']);
const PENDING_WINDOW_HOURS = 120; // fino a 5 giorni: copre un weekend lungo
const PENDING_AMOUNT_TOLERANCE_PCT = 0.15; // fino al 15% (mance/conversioni valuta)

// ── MANUALE → ESTRATTO CONTO: il duplicato più comune di tutti ──────────────
// BUG REALE segnalato (2026-09-04): chi segna le spese a mano durante il mese
// e poi importa il CSV/PDF della banca (o uno screenshot) si ritrova TUTTO in
// doppio. Dimostrato con dati veri prima di scrivere una riga: la dedup
// esistente richiede una somiglianza di DESCRIZIONE ≥ 0,72, ma fra quello che
// scrive una persona e quello che scrive una banca non c'è quasi nulla in
// comune — misurato su casi reali:
//   "Benzina"     vs "PAGAMENTO POS CARTA 4832 Q8 SRL MILANO" → 0,105
//   "Spesa"       vs "PAGAMENTO POS 12345 ESSELUNGA SPA"      → 0,121
//   "Cena fuori"  vs "POS 998877 TRATTORIA DA MARIO"          → 0,138
//   ""            vs "ADDEBITO SEPA ENEL ENERGIA SPA"         → 0,000
// Nessuno arriva vicino alla soglia: il duplicato non era raro, era GARANTITO.
//
// Su una voce scritta a mano la descrizione non è un indizio utilizzabile, ma
// due indizi molto forti ci sono: una persona segna l'importo ESATTO che ha
// pagato, e lo segna quel giorno (la banca può contabilizzare dopo, anche
// dopo un weekend). Quindi qui si confronta senza descrizione, ma si stringe
// tutto il resto: importo identico al centesimo (mai una percentuale) e
// finestra breve. E si applica in UNA direzione sola — una riga che ARRIVA da
// un import può riconoscersi in una voce manuale già presente, mai il
// contrario — perché è quello lo scenario reale.
const MANUAL_WINDOW_HOURS = 72;   // la banca contabilizza anche 2-3 giorni dopo
const MANUAL_AMOUNT_TOLERANCE = 0.01;
// Una voce manuale può assorbire UNA sola riga importata: senza questo, due
// addebiti veri e identici (due caffè da 1,20 nello stesso giorno) verrebbero
// fusi entrambi nella stessa voce e uno sparirebbe.
function eManuale(tx) {
  return !tx.source || tx.source === 'manual';
}
function daImport(tx) {
  return !!tx.source && tx.source !== 'manual';
}

// Restituisce la transazione esistente che fa match, o null.
// Le transazioni di questa app hanno forma: { date, amount, type, description, category }
export function findDuplicate(newTx, existingTxs, opts = {}) {
  const { windowHours, amountTolerance, descriptionThreshold } = { ...DEFAULT_OPTS, ...opts };
  const newDate = new Date(newTx.date).getTime();

  let best = null;
  let bestScore = 0;
  let bestPending = null;
  let bestPendingScore = 0;
  let bestManuale = null;
  let bestManualeDist = Infinity;

  for (const tx of existingTxs) {
    const timeDiffHours = Math.abs(new Date(tx.date).getTime() - newDate) / 3_600_000;

    const sameType = !newTx.type || !tx.type || newTx.type === tx.type;

    // MOVIMENTO AUTO-AVVIATO (bonifico SEPA/sweep registrato da Momentum): quando
    // poi arriva il rigo della banca (CSV) con una descrizione MOLTO diversa, la
    // similarità testo fallirebbe. Ma sai di averlo fatto tu: stesso importo,
    // stesso tipo, stessa finestra su una tx flaggata selfTransfer non ancora
    // riconciliata = è lo stesso movimento. Match forte a prescindere dal testo.
    if (timeDiffHours <= windowHours && sameType && tx.selfTransfer && !tx.reconciledBank
      && Math.abs(tx.amount - newTx.amount) <= amountTolerance) {
      return tx; // riconciliazione certa, nessun rischio di doppio conteggio
    }

    if (timeDiffHours <= windowHours && sameType && Math.abs(tx.amount - newTx.amount) <= amountTolerance) {
      const score = descriptionSimilarity(tx.description, newTx.description);
      if (score >= descriptionThreshold && score > bestScore) {
        best = tx;
        bestScore = score;
      }
    }

    // Ramo MANUALE → import: la descrizione non si può confrontare (vedi il
    // commento esteso sopra), quindi si stringe tutto il resto. Solo verso una
    // voce manuale non ancora riconciliata con un import.
    if (sameType && daImport(newTx) && eManuale(tx) && !tx.reconciledImport
      && timeDiffHours <= MANUAL_WINDOW_HOURS
      && Math.abs(tx.amount - newTx.amount) <= MANUAL_AMOUNT_TOLERANCE) {
      // A parità di importo vince la più vicina nel tempo: se una persona ha
      // segnato due volte lo stesso importo in giorni diversi, la riga della
      // banca appartiene a quella del giorno giusto.
      if (timeDiffHours < bestManualeDist) {
        bestManuale = tx;
        bestManualeDist = timeDiffHours;
      }
    }

    // Ramo pending→posted: SOLO se la strict-match sopra non ha già trovato
    // nulla per questa tx, mai per allargare oltre quanto serve.
    if (sameType && PENDING_SOURCES.has(tx.source) && !PENDING_SOURCES.has(newTx.source || '')
      && timeDiffHours <= PENDING_WINDOW_HOURS) {
      const pctDiff = tx.amount > 0 ? Math.abs(tx.amount - newTx.amount) / tx.amount : 1;
      if (pctDiff <= PENDING_AMOUNT_TOLERANCE_PCT) {
        const score = descriptionSimilarity(tx.description, newTx.description);
        if (score >= descriptionThreshold && score > bestPendingScore) {
          bestPending = tx;
          bestPendingScore = score;
        }
      }
    }
  }

  // La strict-match (finestra e tolleranza di sempre) vince sempre quando
  // esiste: è il confronto più affidabile. Gli altri due rami intervengono
  // SOLO quando quello stretto non ha trovato niente — prima il manuale
  // (importo identico al centesimo, il segnale più forte dopo la descrizione),
  // poi il pending→posted (che accetta uno scarto d'importo).
  return best || bestManuale || bestPending;
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
