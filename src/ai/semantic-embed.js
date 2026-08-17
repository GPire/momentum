// ============================================================
// COMPRENSIONE SEMANTICA LOCALE — la fondazione dell'SLM Momentum
// ============================================================
// Onestà tecnica (stesso principio di momentum_real_ai_engine.js): questo
// NON è un modello linguistico generativo, non scrive testo libero. È un
// modello di EMBEDDING — trasforma una frase in un vettore che cattura il
// SIGNIFICATO, non le parole esatte.
//
// MODELLO: EmbeddingGemma (Google DeepMind, onnx-community/embeddinggemma-300m-ONNX,
// verificato su Hugging Face il 2026-08-17) — il modello di embedding
// multilingue open più performante sotto i 500M di parametri su MTEB al
// momento della scelta, addestrato su 100+ lingue, pensato apposta per
// on-device. NON è un repository con licenza bloccata (verificato: gated=false,
// nessun account/token richiesto — coerente con "mai un login per usare
// Momentum"). ~197MB in quantizzazione q4 (fp16 non supportato da questo
// modello: unica scelta reale è fp32/q8/q4 — usiamo q4, il compromesso
// dimensione/qualità raccomandato da Google per uso on-device).
//
// PERCHÉ un embedding e non un LLM generativo: un generativo utile (anche
// piccolo, 0,5-1,5 miliardi di parametri) pesa 300MB-2GB e richiede WebGPU
// (~85% di copertura globale nel 2026, non 100%). Un modello di embedding fa
// QUESTO compito specifico (riconoscere che due domande hanno lo stesso
// significato) in ~197MB, gira via WASM anche senza WebGPU — nessun utente
// escluso fra quelli che possono comunque eseguire WebAssembly (che resta un
// requisito hardware reale: un iPhone 4/iOS 7 non supporta WASM, punto — su
// quei dispositivi Momentum resta sul confronto a parole, mai un crash).
//
// COSA DIVENTA PROPRIETARIO DI MOMENTUM (non il modello base, che è aperto e
// uguale per chiunque lo usi — nessuno allena un embedding da zero, nemmeno
// le aziende che parlano di "modello proprietario"): lo strato sopra, cioè
// LE CORREZIONI CONFERMATE DALL'UTENTE (qa-learning.js) confrontate con
// questo modello — dati che non lasciano mai il dispositivo, mai condivisi.
//
// OPT-IN ESPLICITO, mai automatico: il modello si scarica SOLO quando
// l'utente attiva l'impostazione, una volta sola (poi resta in cache nel
// browser tramite l'IndexedDB di transformers.js, funziona offline). Se il
// download fallisce o il dispositivo non supporta WASM, si fallisce in
// silenzio: il QA continua a funzionare con Jaccard (qa-learning.js), mai
// un errore bloccante per una funzionalità opzionale.
'use strict';

const MODEL_ID = 'onnx-community/embeddinggemma-300m-ONNX';
// Prefisso ufficiale per confronto di SIMILARITÀ (non retrieval query↔documento
// asimmetrico): documentato nel model card come "task: sentence similarity",
// applicato in modo SIMMETRICO a entrambi i testi confrontati, perché qui si
// confrontano due domande fra loro, non una domanda con un documento.
const PREFISSO_SIMILARITA = 'task: sentence similarity | query: ';

let modelPromise = null;
// Cache embedding per testo — evita di ricalcolare il vettore di una
// domanda già imparata a ogni nuovo confronto (qa-learning.js può avere
// fino a 100 correzioni imparate: ricalcolarle tutte a ogni domanda nuova
// sarebbe lavoro sprecato, l'unica cosa che cambia è la domanda nuova).
const embedCache = new Map();
const MAX_CACHE = 300;

// Stesso pianificatore di calcolo adattivo già usato dal resto di Momentum
// (device/compute-planner.js, basato su window.momentumDeviceProfile —
// core/GPU/NPU MISURATI, non nomi di chip indovinati): senza questo,
// l'inferenza cadeva sempre su CPU/WASM anche su un dispositivo con GPU
// vera disponibile — un solo embedding poteva impiegare oltre un minuto.
// Bug reale trovato testando dal vivo (2026-08-17): il primo tentativo di
// embed() restava bloccato ben oltre 45 secondi su un dispositivo con
// webgpu:true nel profilo, perché il backend non veniva mai scelto.
async function backendPreferito() {
  try {
    const { planInferenceBackend } = await import('../device/compute-planner.js');
    const piano = planInferenceBackend(window.momentumDeviceProfile || {});
    return piano.backend === 'webgpu' ? 'webgpu' : undefined; // undefined = default (wasm) di transformers.js
  } catch (_) { return undefined; }
}

// Lazy: la libreria (~9,5MB) e il modello (~197MB in q4) si caricano SOLO
// alla prima chiamata reale, mai all'avvio dell'app — coerente con ogni
// altro "Piano B" opt-in del progetto (chiavi API, chat cloud).
async function getModel() {
  if (!modelPromise) {
    modelPromise = import('@huggingface/transformers').then(async ({ AutoModel, AutoTokenizer, env }) => {
      env.allowLocalModels = false;
      const device = await backendPreferito();
      const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
      const model = await AutoModel.from_pretrained(MODEL_ID, { dtype: 'q4', ...(device ? { device } : {}) });
      return { tokenizer, model };
    });
  }
  return modelPromise;
}

// true se il download+caricamento del modello è già avvenuto in questa
// sessione — utile alla UI per non promettere "comprensione semantica
// attiva" mentre il modello sta ancora scaricando.
export function semanticModelPronto() {
  return modelPromise !== null;
}

// Avvia (o attende) il caricamento; non lancia mai eccezioni verso il
// chiamante — onestà: se fallisce, il resto del QA deve continuare a
// funzionare con Jaccard, non bloccarsi.
export async function caricaModelloSemantico() {
  try {
    await getModel();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'caricamento non riuscito' };
  }
}

// Vettore embedding (Float32Array) per un testo — mai per testo vuoto, che
// non ha significato da vettorizzare. Il modello produce già il vettore
// pooled e normalizzato (sentence_embedding): nessun pooling manuale qui,
// a differenza di modelli più vecchi che restituiscono solo i token embedding.
export async function embed(testo) {
  const chiave = String(testo || '').trim().toLowerCase();
  if (!chiave) return null;
  if (embedCache.has(chiave)) return embedCache.get(chiave);
  const { tokenizer, model } = await getModel();
  const inputs = await tokenizer([PREFISSO_SIMILARITA + chiave], { padding: true });
  const { sentence_embedding } = await model(inputs);
  const vec = Float32Array.from(sentence_embedding.tolist()[0]);
  if (embedCache.size >= MAX_CACHE) {
    // FIFO semplice: la prima chiave inserita è la più probabile da non
    // servire più (le domande recenti sono quelle rilevanti ora).
    embedCache.delete(embedCache.keys().next().value);
  }
  embedCache.set(chiave, vec);
  return vec;
}

// Coseno fra due vettori (il modello li restituisce già normalizzati L2,
// ma si normalizza comunque qui per sicurezza — costo trascurabile, mai
// un risultato > 1 per un arrotondamento numerico).
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return Math.max(-1, Math.min(1, dot / denom));
}

// Funzione di similarità SINCRONA pronta per suggestLearnedIntent
// (qa-learning.js): gli embedding dei testi passati devono essere GIÀ in
// cache (embed() li ha già calcolati prima, in modo asincrono, dal
// chiamante) — qa-learning.js resta puro/sincrono, questo file fa tutto il
// lavoro pesante prima, non durante il confronto.
export function similaritaSincrona(a, b) {
  const va = embedCache.get(String(a || '').trim().toLowerCase());
  const vb = embedCache.get(String(b || '').trim().toLowerCase());
  if (!va || !vb) return 0; // non ancora in cache: nessun confronto forzato, mai un errore
  return (cosineSim(va, vb) + 1) / 2; // da [-1,1] a [0,1], stessa scala di Jaccard
}
