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

// ── IL MODELLO NON È PIÙ SCRITTO QUI DENTRO ──
// Identificativo, quantizzazione, prefisso di input e modo di ridurre l'uscita
// a un vettore vivono in `embed-models.js`, insieme alla LICENZA di ciascun
// modello. Il motivo non è eleganza: EmbeddingGemma non è Apache 2.0 ma sotto
// i "Gemma Terms of Use" — non OSI, con la possibilità per Google di limitare
// l'uso da remoto e l'obbligo di propagare le restrizioni a valle. Per un'app
// che promette di funzionare offline e per sempre sul dispositivo dell'utente,
// dipendere da un permesso revocabile è una contraddizione. Il modello deve
// quindi essere sostituibile in una riga, senza riscrivere questo file.
// Il prefisso resta applicato in modo SIMMETRICO ai due testi confrontati,
// perché qui si confrontano due domande fra loro, non una domanda con un
// documento.
import { modelloAttivo, preparaTesto, riduci, normalizza, modelloPerDispositivo, scegliModello } from './embed-models.js';

let modelPromise = null;
// Il modello con cui è stata riempita la cache: se si cambia modello i vettori
// vecchi non sono più confrontabili con i nuovi (spazi diversi), e mescolarli
// produrrebbe somiglianze senza senso invece di un errore.
let modelloInCache = null;
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
    // IL MODELLO SI SCEGLIE DAL DISPOSITIVO, non da una costante. Lo stesso
    // profilo MISURATO che governa il budget di esperti (device/profiler.js)
    // decide anche quale modello linguistico scaricare: su un telefono modesto
    // 113MB si scaricano, 600MB spesso no — e un download che non finisce e'
    // una funzione che non esiste. Se il profilo non c'e', si resta leggeri:
    // mai indovinare dal nome del chip.
    try { scegliModello(modelloPerDispositivo(globalThis.window?.momentumDeviceProfile || null)); } catch (_) { /* si tiene il predefinito */ }
    const cfg = modelloAttivo();
    modelPromise = import('@huggingface/transformers').then(async ({ AutoModel, AutoTokenizer, env }) => {
      env.allowLocalModels = false;
      // Il backend lo decide la CONFIGURAZIONE DEL MODELLO, non solo
      // l'hardware: `backend: 'wasm'` significa "questo modello, con questa
      // quantizzazione, gira solo qui" — chiedergli WebGPU lo lascia appeso
      // per sempre senza mai fallire. Solo con 'auto' si torna a scegliere
      // dal profilo del dispositivo.
      const device = cfg.backend === 'wasm' ? undefined : await backendPreferito();
      const tokenizer = await AutoTokenizer.from_pretrained(cfg.id);
      const model = await AutoModel.from_pretrained(cfg.id, { dtype: cfg.dtype || 'q4', ...(device ? { device } : {}) });
      return { tokenizer, model, cfg };
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
  const { tokenizer, model, cfg } = await getModel();

  // Cambiare modello invalida la cache: due modelli producono vettori in spazi
  // diversi, e confrontarli darebbe somiglianze plausibili e prive di senso —
  // il guasto silenzioso, senza nessun errore a segnalarlo.
  if (modelloInCache && modelloInCache !== cfg.id) embedCache.clear();
  modelloInCache = cfg.id;

  const inputs = await tokenizer([preparaTesto(chiave)], { padding: true });
  const uscita = await model(inputs);

  let vec;
  if (cfg.pooling === 'frase') {
    // Il modello dà già il vettore della frase (EmbeddingGemma).
    vec = Float32Array.from(uscita.sentence_embedding.tolist()[0]);
  } else {
    // Il modello dà un vettore per token: la riduzione la facciamo noi, con la
    // maschera di attenzione, perché il riempimento non deve entrare nella
    // media (vedi embed-models.js).
    const tokens = (uscita.last_hidden_state || uscita.token_embeddings).tolist()[0];
    const maschera = inputs.attention_mask ? inputs.attention_mask.tolist()[0] : null;
    vec = normalizza(riduci(tokens, maschera, cfg.pooling));
  }
  if (!vec) return null;

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

// ── DIAGNOSTICA DI CALIBRAZIONE ──
// Serve a rispondere a una domanda che non si puo' indovinare: quali valori
// produce DAVVERO questo modello su frasi imparentate e su frasi estranee?
// Senza questa misura le soglie si scelgono a occhio, ed e' esattamente
// l'errore che ha prodotto il guasto del 2026-08-19 (vedi `similaritaSincrona`).
export async function distribuzioneSomiglianze(coppie = []) {
  const out = [];
  for (const [a, b] of coppie) {
    await embed(a); await embed(b);
    out.push({ a, b, sim: +similaritaSincrona(a, b).toFixed(4) });
  }
  return out;
}
