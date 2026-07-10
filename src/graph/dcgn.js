// ============================================================
// DCGN — Dynamic Causal Graph Network (substrato "un cervello")
// ============================================================
// Onestà tecnica (regola #1 del progetto): questo NON è un LLM e non
// "batte GPT". È un grafo tipizzato, pesato e serializzabile che fa
// ragionamento finanziario STRUTTURATO su dati personali. Un'unica
// struttura dati che è al tempo stesso: memoria (archi token→categoria),
// classificatore (spreading activation), e — nelle fasi successive —
// ragionatore causale (archi categoria→categoria) e substrato degli
// investimenti (nodi asset/fattore). Funzioni PURE, nessun DOM, nessun
// VaultDAO: gira identica nei test, nel worker e nel main thread
// (stesso pattern di engines.js / causal-graph.js).
//
// Perché "un cervello e non un ensemble": i modelli specialisti
// (Nano/Meso) restano, ma condividono QUESTO substrato — memoria,
// rappresentazioni (token subword) e un'unica legge di apprendimento
// online. L'orchestratore-esecutivo (v4, altrove) instrada verso lo
// specialista giusto; qui vive lo stato condiviso e la sua evoluzione.
//
// Generalizzazione onesta sugli esercenti MAI visti (il nemico misurato
// nel bench): i nodi TOKEN includono n-grammi di CARATTERI (subword), non
// solo parole — così "pizzeria da gino" attiva gli stessi sub-token di
// "pizzeria bella napoli" anche se il nome è nuovo. Nessuna magia: è
// morfologia misurata.
// ============================================================
'use strict';

const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da',
  'in', 'con', 'su', 'per', 'tra', 'fra', 'and', 'the', 'for', 'del', 'della',
]);

// ── Tokenizzazione subword: parole (namespace "w:") + n-grammi di
// caratteri 3-4 (namespace "c:", con marcatori ^…$ di bordo-parola).
// Ritorna token UNICI (un token conta una volta per transazione).
export function tokenize(text) {
  const clean = String(text ?? '').toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  const tokens = new Set();
  for (const w of words) {
    tokens.add('w:' + w);
    const s = '^' + w + '$';
    // n-grammi di caratteri 3..5: i 5-grammi catturano stem più lunghi e
    // discriminanti ("cquis", "istor", "izzer") → migliore generalizzazione
    // sugli esercenti mai visti (misurata in bench:graph, non dichiarata).
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= s.length; i++) tokens.add('c:' + s.slice(i, i + n));
    }
  }
  return [...tokens];
}

// ── Grafo vuoto. Struttura interamente serializzabile (JSON) → si salva
// in IndexedDB e si scambia nella mesh senza trasformazioni.
export function createGraph() {
  return { version: 'dcgn-1', edges: {}, cats: {}, df: {}, docs: 0 };
}

function cloneGraph(g) {
  return JSON.parse(JSON.stringify(g));
}

// ── Apprendimento ONLINE (Hebbian): ogni transazione confermata è un
// update. Rinforza gli archi token→categoria coinvolti; aggiorna i conteggi
// di categoria (prior) e la document-frequency dei token (per la
// specificità in inferenza). Niente ritraining: la transazione È il training.
export function observe(graph, text, category, weight = 1) {
  const toks = tokenize(text);
  if (!toks.length || !category) return graph;
  graph.cats[category] = (graph.cats[category] || 0) + 1;
  graph.docs += 1;
  for (const t of toks) {
    const row = graph.edges[t] || (graph.edges[t] = {});
    const cell = row[category] || (row[category] = { w: 0, n: 0 });
    cell.w += weight;
    cell.n += 1;
    graph.df[t] = (graph.df[t] || 0) + 1;
  }
  return graph;
}

// Comodità: apprende un batch { text, category }[] (usato dal bench).
export function train(graph, examples) {
  for (const ex of examples) observe(graph, ex.text, ex.category);
  return graph;
}

// ── Inferenza = SPREADING ACTIVATION (una sola meccanica per molti compiti).
// I token attivi diffondono attivazione ai nodi-categoria lungo gli archi,
// pesata da:
//  - normalizzazione per-token: il voto di un token si divide tra le
//    categorie a cui punta (un token che va SEMPRE in una categoria vota
//    forte per quella; uno ubiquo vota debole ovunque);
//  - specificità (IDF-like): un token raro è più informativo di uno comune.
// Più un prior di categoria smorzato. Output: categoria + confidenza
// calibrata via softmax + il PERCORSO che la spiega (mai un numero orfano).
export function classify(graph, text, opts = {}) {
  const cats = Object.keys(graph.cats);
  if (!cats.length) return { category: null, confidence: 0, scores: {}, path: [] };
  const priorWeight = opts.priorWeight ?? 0.3;
  const docs = graph.docs || 1;
  let toks = tokenize(text);

  // ── Adattività al dispositivo: lo STESSO grafo modula il proprio costo
  // di calcolo. `maxTokens` (dal compute-planner via l'orchestratore) limita
  // la spreading activation ai token PIÙ SPECIFICI (IDF più alto) — quelli
  // che portano più segnale. Su hardware debole meno token = più veloce, con
  // perdita minima; su hardware potente si usano tutti. Il substrato si
  // "plasma" al device senza cambiare struttura né dati. Onesto: è potatura
  // per specificità, non magia.
  if (opts.maxTokens && toks.length > opts.maxTokens) {
    toks = toks
      .map(t => ({ t, spec: Math.log((docs + 1) / ((graph.df[t] || 0) + 1)) }))
      .sort((a, b) => b.spec - a.spec)
      .slice(0, opts.maxTokens)
      .map(x => x.t);
  }

  const scores = {};
  for (const c of cats) scores[c] = priorWeight * Math.log((graph.cats[c] + 1) / (docs + cats.length));

  const contrib = [];
  for (const t of toks) {
    const row = graph.edges[t];
    if (!row) continue;
    let rowSum = 0;
    for (const c in row) rowSum += row[c].w;
    if (rowSum <= 0) continue;
    const spec = Math.log((docs + 1) / ((graph.df[t] || 0) + 1)) + 1e-6; // >0
    for (const c in row) {
      const vote = spec * (row[c].w / rowSum);
      scores[c] = (scores[c] || 0) + vote;
      contrib.push({ token: t, cat: c, vote });
    }
  }

  // softmax stabile → probabilità
  let mx = -Infinity;
  for (const c of cats) if (scores[c] > mx) mx = scores[c];
  let sum = 0;
  const exps = {};
  for (const c of cats) { const e = Math.exp(scores[c] - mx); exps[c] = e; sum += e; }
  const probs = {};
  for (const c of cats) probs[c] = exps[c] / (sum || 1);

  let best = cats[0];
  for (const c of cats) if (probs[c] > probs[best]) best = c;

  const path = contrib
    .filter(x => x.cat === best)
    .sort((a, b) => b.vote - a.vote)
    .slice(0, 5)
    .map(x => x.token);

  return { category: best, confidence: Math.round(probs[best] * 100), scores: probs, path };
}

// ── Decadimento temporale (il grafo "dimentica" ciò che non viene più
// confermato → resta rilevante e limitato, NON "memoria infinita").
// Smorza i pesi degli archi e pota quelli sotto soglia. I conteggi
// strutturali (cats/df) restano: il decay riguarda l'evidenza discriminante.
export function decay(graph, factor = 0.98, eps = 0.05) {
  for (const t in graph.edges) {
    const row = graph.edges[t];
    for (const c in row) {
      row[c].w *= factor;
      if (row[c].w < eps) delete row[c];
    }
    if (Object.keys(row).length === 0) delete graph.edges[t];
  }
  return graph;
}

// ============================================================
// FEDERAZIONE A COMPETENZA PER-ARGOMENTO (l'idea "gruppo di esperti")
// ============================================================
// Analogia dell'utente: in un gruppo, su un dato ARGOMENTO una persona è
// l'esperta; assorbo molto da lei su quell'argomento e un po' da tutti;
// cambiando argomento, l'esperto cambia. Formalizzazione onesta e
// RESISTENTE ALL'AVVELENAMENTO: la competenza di un peer su una categoria
// non è auto-dichiarata (falsificabile) — è MISURATA sul MIO validation
// set locale (dati che il peer non ha visto). Un peer che mente non può
// fingere competenza sui miei dati.

// Competenza per-categoria di un grafo-peer, validata su esempi LOCALI.
// Ritorna { categoria: accuratezza∈(0,1) } con lisciatura.
export function measureCompetence(peerGraph, validationSet) {
  const byCat = {};
  for (const { text, category } of validationSet) {
    const s = byCat[category] || (byCat[category] = { right: 0, n: 0 });
    s.n += 1;
    if (classify(peerGraph, text).category === category) s.right += 1;
  }
  const comp = {};
  for (const c in byCat) comp[c] = (byCat[c].right + 0.5) / (byCat[c].n + 1);
  return comp;
}

// Fusione a competenza: per ogni token→categoria, il peso del peer entra
// scalato da α = floor + competenza_del_peer_su_quella_categoria.
//  - floor > 0  → assorbo SEMPRE un po' da tutti (l'informazione del gruppo);
//  - competenza → assorbo MOLTO dall'esperto di QUELL'argomento;
//  - categorie fuori dal validation set → solo floor (non so giudicare → prudenza).
// Cambiando categoria, domina un peer diverso: emerge dai pesi per-categoria.
export function mergeExpertWeighted(localGraph, peerGraphs, opts = {}) {
  const floor = opts.floor ?? 0.15;
  const validationSet = opts.validationSet || [];
  const merged = cloneGraph(localGraph);
  const competences = [];

  for (const peer of peerGraphs) {
    const comp = validationSet.length ? measureCompetence(peer, validationSet) : {};
    competences.push(comp);
    const compVals = Object.values(comp);
    const avgComp = compVals.length ? compVals.reduce((a, b) => a + b, 0) / compVals.length : 0;

    for (const t in peer.edges) {
      const prow = peer.edges[t];
      for (const c in prow) {
        const alpha = floor + (comp[c] ?? 0); // esperto→~1, ignoto/poison→~floor
        const row = merged.edges[t] || (merged.edges[t] = {});
        const cell = row[c] || (row[c] = { w: 0, n: 0 });
        cell.w += alpha * prow[c].w;
        cell.n += prow[c].n;
      }
    }
    for (const c in peer.cats) merged.cats[c] = (merged.cats[c] || 0) + (floor + (comp[c] ?? avgComp)) * peer.cats[c];
    for (const t in peer.df) merged.df[t] = (merged.df[t] || 0) + peer.df[t];
    merged.docs += (floor + avgComp) * peer.docs;
  }

  return { graph: merged, competence: competences };
}

// Sotto-grafo condivisibile nella mesh (già serializzabile così com'è).
// NOTA privacy: i token sono parole/n-grammi di descrizioni — nella mesh a
// consenso esplicito tra PROPRI device è accettabile; per la federazione
// con terzi andranno hashati (roadmap, coerente coi vincoli del progetto).
export function extractSubgraph(graph) {
  return cloneGraph(graph);
}
