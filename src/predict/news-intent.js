// Rilevatore per "dammi le notizie di X" / "grafico/andamento di X" / "news
// about X" — BUG REALE trovato dall'utente: senza questo, "Chiedi a
// Momentum" girava la domanda alla chat generica (Gemini), che non ha
// accesso a notizie/prezzi veri e rispondeva con frasi educative generiche
// invece di dati reali, costringendo l'utente a uscire dall'app per
// informarsi davvero. Copre anche richieste di grafico esplicite, perché
// un grafico va disegnato SEMPRE che l'asset abbia un prezzo reale
// misurabile — mai un grafico finto per domande senza dati veri dietro.
// Funzione pura: solo estrae l'asset dal testo, non fa fetch.
'use strict';

const PATTERNS = [
  /\b(notizie|news)\b.*?\b(?:di|su|riguardo a?|about|on)\b\s+(.+)/i,
  /\b(?:cosa\s+dice|cosa\s+sta\s+succedendo)\b.*?\b(?:di|su|con)\b\s+(.+)/i,
  /\b(?:grafico|andamento|storico|prezzo|quotazione|chart|price)\b.*?\b(?:di|su|about|of)\b\s+(.+)/i,
  /\b(?:come\s+(?:è|sta|è\s+andat[ao]|va))\b.*?\b(?:di|su|con)\b\s+(.+)/i,
  // Settori senza connettivo prima del nome ("come va il mercato
  // immobiliare?"): niente "di/su/con" da estrarre, cattura direttamente
  // la frase dopo il verbo.
  /\b(?:come\s+(?:è|sta|è\s+andat[ao]|va))\b\s+(?:il\s+|lo\s+|la\s+)?(mercato\s+immobiliare|settore\s+immobiliare|immobiliare)\b/i,
];

// Rumore comune da ripulire dalla coda estratta ("...di oggi", "?", ecc.) —
// consuma anche la preposizione che precede la parola temporale ("di oggi",
// non solo "oggi"), altrimenti resta un "di" penzolante a fine stringa.
const TRAILING_NOISE = /\s*\b(?:di|su|per)?\s*\b(oggi|adesso|ora|today|now)\b\s*\??\.?$/i;

export function detectNewsIntent(question) {
  const q = String(question || '').trim();
  if (!q) return null;
  for (const re of PATTERNS) {
    const m = q.match(re);
    if (m) {
      let asset = (m[2] || m[1] || '').trim();
      asset = asset.replace(TRAILING_NOISE, '').replace(/[?!.]+$/, '').trim();
      if (asset.length >= 2) return { asset };
    }
  }
  return null;
}
