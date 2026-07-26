// ============================================================
// MERCHANT MORPHOLOGY — transfer per TIPO di esercente, indipendente dalla
// posizione del token (v1). Il secondo strato proprietario di Momentum Core.
// ============================================================
// IL PUNTO CIECO che questo strato copre (misurato, non teorico):
// la gerarchia esercenti (merchant-hierarchy.js) generalizza SOLO lungo il
// prefisso, ancorata al PRIMO token. "ESSELUNGA VIA A" e "ESSELUNGA VIA B"
// condividono il genitore 'esselunga' → transfer. Ma un piccolo esercente
// locale mai visto il cui TIPO è scritto in mezzo o in coda —
//   "DA MARIO PIZZERIA"   (primo token: 'da')
//   "PIZZERIA NAPOLI"     (primo token: 'pizzeria')
// non crea nessun genitore condiviso: la gerarchia tace (corretto per lei) e
// l'utente resta senza categoria. È ESATTAMENTE il cold-start sui piccoli
// esercenti locali dove le banche e i neobank (Revolut, ecc.) sbagliano o
// lasciano "non categorizzato".
//
// L'IDEA, onesta e auto-addestrante:
// alcune parole non sono insegne, sono TIPI ("pizzeria", "farmacia",
// "officina", "hotel", "bar"). Le si riconosce da un segnale statistico, non
// da una lista scritta a mano: un TIPO ricorre su PIÙ insegne diverse (più
// "ancore" = primi token diversi), mentre un'insegna resta legata a sé. Se una
// parola compare su ≥2 insegne diverse e le sue transazioni si concentrano su
// una categoria, allora quella parola TRASFERISCE quella categoria a un
// esercente nuovo che la contiene — ovunque essa sia nella stringa.
//
// GARANZIE (regola #1 — mai inventare, meglio tacere):
//  - impara SOLO dai dati confermati dall'utente; a freddo non esiste;
//  - una parola trasferisce solo se è GENERICA (≥2 ancore distinte): così
//    un'insegna ("esselunga") non contamina esercenti scorrelati;
//  - richiede concentrazione (margine) e supporto minimi: sotto soglia, tace;
//  - il tempo decade la confidenza (stesso emivita della gerarchia): il
//    vecchio non diventa falso, diventa meno vincolante.
//
// Funzioni pure, nessun DOM, nessuna rete, serializzabile nel vault.
'use strict';

import { normalizeMerchant } from './merchant-dictionary.js';

const DAY = 86_400_000;
const DEFAULT_HALF_LIFE = 45 * DAY;
const MIN_TYPE_LEN = 3;     // 'da', 'il' non sono tipi; 'bar' sì
const MAX_TOKENS = 6;       // oltre, è rumore di coda (civici, codici)

export function initMorphology(opts = {}) {
  return {
    // token -> { c:{cat:count}, n, last, anchors:{firstToken:{cat:count}} }
    // anchors NON è più un semplice contatore: per ogni insegna teniamo la sua
    // distribuzione di categorie. Serve a distinguere un TIPO (concorde su tutte
    // le insegne) da un NOME proprio (discorde) — vedi typeStats/anchorAgreement.
    tokens: {},
    version: 2,
    halfLifeMs: opts.halfLifeMs ?? DEFAULT_HALF_LIFE,
  };
}

// Token informativi di una descrizione (senza numeri/rumore, deduplicati,
// lunghezza minima). Il PRIMO token è "l'ancora" (tipicamente l'insegna): serve
// a misurare quante insegne diverse hanno usato un certo tipo.
export function typeTokens(description) {
  const norm = normalizeMerchant(description);
  if (!norm) return { anchor: '', tokens: [] };
  const all = norm.split(' ').filter(Boolean).slice(0, MAX_TOKENS);
  const anchor = all[0] || '';
  const tokens = [...new Set(all.filter(t => t.length >= MIN_TYPE_LEN))];
  return { anchor, tokens };
}

function decayNode(node, halfLifeMs, now) {
  if (!node.last || halfLifeMs <= 0) return node;
  const dt = now - node.last;
  if (dt <= 0) return node;
  const factor = Math.pow(0.5, dt / halfLifeMs);
  if (factor >= 0.999) return node;
  const c = {};
  for (const [k, v] of Object.entries(node.c)) c[k] = v * factor;
  return { ...node, c, n: node.n * factor };
}

// Apprendimento: una transazione confermata/corretta dall'utente alimenta OGNI
// suo token informativo, registrando anche da quale insegna (ancora) proviene.
export function observeMorphology(model, description, category, now = Date.now(), weight = 1) {
  if (!category || weight <= 0) return model;
  const { anchor, tokens } = typeTokens(description);
  for (const t of tokens) {
    let node = model.tokens[t];
    if (!node) { node = { c: {}, n: 0, last: now, anchors: {} }; model.tokens[t] = node; }
    else node = decayNode(node, model.halfLifeMs, now);
    node.c[category] = (node.c[category] || 0) + weight;
    node.n += weight;
    node.last = now;
    if (anchor) {
      // per ogni insegna, la SUA distribuzione di categorie (non un solo flag):
      // ci dice se quel tipo si comporta uguale ovunque o cambia insegna per insegna.
      const a = node.anchors[anchor] || (node.anchors[anchor] = {});
      a[category] = (a[category] || 0) + weight;
    }
    model.tokens[t] = node;
  }
  return model;
}

// Categoria dominante di una singola insegna per questo token.
function dominantCat(catCounts) {
  let best = null, bestV = -Infinity;
  for (const [cat, v] of Object.entries(catCounts)) if (v > bestV) { best = cat; bestV = v; }
  return best;
}

// Un token è un "tipo" trasferibile se è GENERICO (≥ minAnchors insegne
// distinte), ha abbastanza evidenza, ED è CONCORDE tra le insegne: la frazione
// di insegne la cui categoria dominante coincide con quella aggregata. Questo è
// il discriminante vero tra un TIPO ("pizzeria" → svago su OGNI insegna) e un
// NOME proprio ("rossi" → categorie diverse a seconda dell'insegna): il nome ha
// accordo basso e viene scartato anche se per caso la sua media concentra.
function typeStats(model, token, now, minAnchors) {
  const raw = model.tokens[token];
  if (!raw) return null;
  const anchorEntries = Object.entries(raw.anchors || {});
  if (anchorEntries.length < minAnchors) return null; // è un'insegna, non un tipo
  const node = decayNode(raw, model.halfLifeMs, now);
  if (node.n <= 0) return null;
  let best = null, bestV = 0, second = 0, total = 0;
  for (const [cat, v] of Object.entries(node.c)) {
    total += v;
    if (v > bestV) { second = bestV; best = cat; bestV = v; }
    else if (v > second) second = v;
  }
  if (!best) return null;
  // accordo tra insegne: quante insegne hanno QUESTA categoria come dominante.
  let agree = 0;
  for (const [, catCounts] of anchorEntries) if (dominantCat(catCounts) === best) agree++;
  const agreement = agree / anchorEntries.length;
  return {
    category: best, support: node.n, p: bestV / total,
    margin: (bestV - second) / total, anchors: anchorEntries.length, agreement,
  };
}

// Predizione per TRANSFER: cerca nei token della descrizione il "tipo" con
// l'evidenza migliore e lo trasferisce. Tace (null) se nessun token è un tipo
// abbastanza generico, concentrato e supportato — mai inventa su un vero
// sconosciuto. Pensata come FALLBACK di merchant-hierarchy quando lei si astiene.
export function predictMorphology(model, description, now = Date.now(), opts = {}) {
  // Soglie tarate sul PRINCIPIO, non sul benchmark: il vero discriminante tra un
  // TIPO ("pizzeria" → sempre svago) e un NOME proprio ("napoli", che compare su
  // insegne diverse ma in categorie casuali) è la CONCENTRAZIONE. Un tipo ha
  // margine alto; un nome si sparge → margine basso. Quindi: ≥3 insegne distinte
  // (genuinamente generico) e margine ≥0.5 (nettamente concentrato) o tace. È la
  // guardia che tiene basso il "parla sui veri sconosciuti" (vedi TEST-B).
  const minAnchors = opts.minAnchors ?? 3;
  const minSupport = opts.minSupport ?? 3;
  const minMargin = opts.minMargin ?? 0.5;   // concentrazione: la top stacca nettamente
  const minAgreement = opts.minAgreement ?? 0.67; // accordo tra insegne: il vero anti-nome
  const { tokens } = typeTokens(description);
  let best = null;
  for (const t of tokens) {
    const s = typeStats(model, t, now, minAnchors);
    if (!s || s.support < minSupport || s.margin < minMargin || s.agreement < minAgreement) continue;
    // sceglie il tipo migliore per accordo × concentrazione × supporto
    const score = s.agreement * s.margin * Math.min(1, s.support / 4);
    if (!best || score > best._score) best = { ...s, via: t, _score: score };
  }
  if (!best) return null;
  return {
    category: best.category,
    confidence: best.p,
    margin: best.margin,
    support: best.support,
    via: best.via,           // la parola-tipo che ha fatto scattare il transfer
    anchors: best.anchors,   // su quante insegne diverse quel tipo è stato visto
    transferred: true,       // sempre true: è un esercente mai visto categorizzato per tipo
  };
}

// Spiegazione in italiano per la UI/audit (mai un numero senza il perché).
export function explainMorphology(model, description, now = Date.now(), opts = {}) {
  const p = predictMorphology(model, description, now, opts);
  if (!p) return { category: null, reason: 'nessun tipo di esercente riconoscibile qui' };
  return {
    ...p,
    reason: `mai visto, ma "${p.via}" per te è di solito ${p.category} (visto su ${p.anchors} insegne diverse)`,
  };
}

// Potatura: elimina i token diventati poco informativi (evidenza decaduta o
// mai diventati generici) per tenere il modello leggero nel vault.
export function pruneMorphology(model, opts = {}) {
  const now = opts.now ?? Date.now();
  const minSupport = opts.minSupport ?? 0.5;
  const kept = {};
  for (const [t, raw] of Object.entries(model.tokens)) {
    const node = decayNode(raw, model.halfLifeMs, now);
    if (node.n >= minSupport) kept[t] = { ...node, anchors: raw.anchors };
  }
  return { ...model, tokens: kept };
}
