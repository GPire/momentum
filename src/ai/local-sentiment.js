// ============================================================
// SENTIMENT ON-DEVICE — perché esiste, e cosa risolve DAVVERO
// ============================================================
// Il buco reale (non ipotetico, misurato leggendo src/alpha/news.js e
// src/ai/reasoning-fusion.js): `aggregateNewsSentiment()` — il layer che
// alimenta "posso permettermi di investire ora?" nella Dashboard — legge
// `sentimentScore` da ogni notizia, ma quel campo è `null` per TUTTE le
// fonti tranne Alpha Vantage NEWS_SENTIMENT, che richiede una chiave
// personale dell'utente (opt-in, non tutti la configurano). Per chiunque
// usi Momentum senza quella chiave — probabilmente la maggioranza — quel
// layer non ha mai avuto un solo punteggio da aggregare: zero notizie
// scored significa "sentiment": null in ogni verdetto, silenziosamente.
// Questo modulo calcola il punteggio ON-DEVICE (nessuna chiave, nessuna
// rete, nessun dato che lascia il dispositivo — solo il TITOLO, già
// scaricato per mostrarlo, passato a un modello locale) per QUALUNQUE
// fonte di notizie del cascade (Finnhub/NewsAPI/Hacker News/Federal
// Register/Fed/BCE), non solo Alpha Vantage. Un solo punto di aggancio
// (src/main.js: fetchAssetNewsCascade, la pipeline UNIFICATA già usata da
// "Cerca un asset", dalla Dashboard notizie-posizioni e dal QA) alimenta
// automaticamente ogni consumatore esistente — mai un secondo sistema di
// sentiment parallelo.
//
// Modello: src/ai/sentiment-model.js (registro, licenza, dimensione — la
// scelta e l'onestà su "non è davvero TinyFinBERT" vivono lì). Backend e
// lazy-loading: STESSO pattern a basso livello di src/ai/semantic-embed.js
// (AutoTokenizer + AutoModel, non la pipeline() di alto livello) — non per
// coerenza stilistica, per un bug REALE trovato dal vivo (2026-08-24,
// Chrome, non ipotizzato): la pipeline('text-classification', …) con
// `{top_k:null}` (necessario per leggere tutte e 3 le probabilità, non solo
// la più alta) passa dal topk() interno della libreria, che costruisce un
// SECONDO micro-grafo ONNX ed apre una SECONDA sessione onnxruntime-web
// solo per ordinare 3 numeri — misurato in questo progetto: oltre 160
// secondi prima di fallire silenziosamente (catturato dal try/catch qui
// sotto, mai un crash visibile, ma nemmeno mai un punteggio). Bypassato
// del tutto: si prende il modello grezzo (AutoModelForSequenceClassification,
// stessa libreria, stesso file .onnx) e si fa il softmax A MANO in JS puro
// su 3 numeri — nessuna sessione ONNX aggiuntiva, nessuna libreria in più.
// Opt-in esplicito, mai un download all'avvio, mai un'eccezione verso chi
// chiama — se il modello non c'è o fallisce, il resto dell'app continua con
// `sentimentScore:null` come faceva prima, non un errore bloccante.
'use strict';

import { modelloSentimentAttivo } from './sentiment-model.js';
import { labelFor } from '../alpha/news.js';
import { conTimeout } from '../core/con-timeout.js';
import { creaTracciatoreProgresso } from '../core/download-progress.js';

// 60s: vedi src/core/con-timeout.js per il perché di questo numero e per
// cosa ha rivelato dal vivo (CDN Xet di Hugging Face "pending" per sempre
// su alcune reti — senza questo limite, `modelPromise` resterebbe una
// promise mai risolta per sempre, e ogni chiamata futura la riuserebbe
// (stessa cache) restando bloccata insieme a lei).
const TIMEOUT_CARICAMENTO_MS = 60_000;

let modelPromise = null;
let modelloCfgId = null;
let tracciatore = null;

// Stato del download corrente per la UI (src/core/download-progress.js):
// `null` se nessun caricamento è mai partito in questa sessione, altrimenti
// `{ fase, pct, loaded, total }` — `pct` è `null` finché il server non
// dichiara una dimensione, mai un numero inventato.
export function progressoScaricamento() {
  return tracciatore ? tracciatore.stato() : null;
}

async function getModel() {
  if (!modelPromise) {
    const cfg = modelloSentimentAttivo();
    modelloCfgId = cfg.id;
    tracciatore = creaTracciatoreProgresso();
    const carica = import('@huggingface/transformers').then(async ({ AutoModelForSequenceClassification, AutoTokenizer, env }) => {
      env.allowLocalModels = false;
      const { backendPerModello } = await import('../device/compute-planner.js');
      const device = backendPerModello(cfg, globalThis.window?.momentumDeviceProfile || {});
      const tokenizer = await AutoTokenizer.from_pretrained(cfg.id, { progress_callback: tracciatore.callback });
      const model = await AutoModelForSequenceClassification.from_pretrained(cfg.id, {
        dtype: cfg.dtype || 'q8', progress_callback: tracciatore.callback, ...(device ? { device } : {}),
      });
      return { tokenizer, model, cfg };
    });
    modelPromise = conTimeout(carica, TIMEOUT_CARICAMENTO_MS, 'il download del modello di sentiment ha impiegato troppo (rete lenta o CDN bloccata)');
    // Un timeout NON deve restare in cache come fallimento permanente: se la
    // promise scade, la prossima chiamata deve poter riprovare da zero
    // (magari la rete nel frattempo si è sbloccata), non ripetere per
    // sempre lo stesso errore cacheato.
    modelPromise.catch(() => { modelPromise = null; });
  }
  return modelPromise;
}

// Softmax puro, JS semplice — 3 numeri, non serve un tensore ONNX per
// questo. `- max` prima di exp() è la stabilizzazione numerica standard
// (evita overflow su logit grandi), non un dettaglio stilistico.
function softmax3(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const somma = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / somma);
}

// true se il download+caricamento è già avvenuto in questa sessione —
// stesso ruolo di semanticModelPronto() per la card di Impostazioni: non
// promettere "sentiment on-device attivo" mentre sta ancora scaricando.
export function sentimentModelPronto() {
  return modelPromise !== null;
}

export async function caricaModelloSentiment() {
  try {
    await getModel();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'caricamento non riuscito' };
  }
}

// P(positive) − P(negative), in [-1,1] — STESSA scala di Alpha Vantage
// (src/alpha/news.js), mai 0..1 o due assi separati: aggregateNewsSentiment
// (reasoning-fusion.js) fa la media fra fonti diverse, e mescolare scale
// diverse nella stessa media produrrebbe un numero senza significato.
// La neutralità entra nel punteggio SOLO indirettamente (se P(neutral) è
// alta, sia P(pos) sia P(neg) sono basse e la differenza tende a 0 da
// sola) — non serve un termine esplicito.
// Esportata (pura, senza rete/modello): è la parte testabile di questo
// modulo senza scaricare 82MB a ogni run della suite.
export function punteggioDaEtichette(scores) {
  const per = {};
  for (const s of scores || []) per[String(s?.label || '').toLowerCase()] = s.score;
  const pos = Number.isFinite(per.positive) ? per.positive : 0;
  const neg = Number.isFinite(per.negative) ? per.negative : 0;
  return pos - neg;
}

const cache = new Map(); // testo → risultato, evita di ri-classificare lo stesso titolo
const MAX_CACHE = 500;

// `null` se il testo è vuoto o il modello non è disponibile/fallisce —
// MAI un punteggio inventato: stessa regola d'onestà di ogni altro modulo
// del progetto (Expected Shortfall, registro fonti, ecc).
// `classify` (opzionale, iniettabile come `fetchImpl` altrove nel
// progetto): `(testo) => Promise<[{label,score},...]>`. Senza, usa il
// modello ONNX reale via getPipeline() — con un'implementazione finta si
// testa TUTTA la logica attorno (mappatura punteggio, cache, invalidazione
// al cambio modello) senza scaricare 82MB a ogni run della suite.
export async function classificaSentiment(testo, { classify = null } = {}) {
  const chiave = String(testo || '').trim();
  if (!chiave) return null;
  if (cache.has(chiave)) return cache.get(chiave);
  let out;
  try {
    let arr, modelloId;
    if (classify) {
      arr = await classify(chiave);
      modelloId = 'iniettato-per-test';
    } else {
      const { tokenizer, model, cfg } = await getModel();
      // Cambiare modello invalida la cache: due modelli non condividono la
      // stessa calibrazione di probabilità, mescolarli darebbe punteggi
      // plausibili ma incoerenti fra loro — lo stesso principio già
      // applicato alla cache degli embedding in semantic-embed.js.
      if (modelloCfgId !== cfg.id) cache.clear();
      const inputs = await tokenizer(chiave, { padding: true, truncation: true });
      const { logits } = await model(inputs);
      const riga = logits.tolist()[0]; // un solo testo alla volta: prima (unica) riga
      const probs = softmax3(riga);
      const id2label = model.config?.id2label || cfg.etichette || {};
      arr = riga.map((_, i) => ({ label: String(id2label[i] ?? `LABEL_${i}`), score: probs[i] }));
      modelloId = cfg.id;
    }
    const score = +punteggioDaEtichette(arr).toFixed(3);
    out = { score, label: labelFor(score), modello: modelloId, grezzo: arr };
  } catch (_) {
    return null;
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(chiave, out);
  return out;
}

// ── Arricchimento in blocco di una lista di notizie ──
// Riempie `sentimentScore`/`sentimentLabel` SOLO dove sono `null` (mai
// sovrascrive un punteggio reale di Alpha Vantage — quello resta la fonte
// più autorevole quando c'è, questo è il ripiego per quando manca) e
// aggiunge `sentimentSource:'on-device'` per onestà — chi legge la UI deve
// poter distinguere "punteggio Alpha Vantage" da "stima locale di un
// modello da 82M parametri sul solo titolo", mai presentati come identici.
// Budget: al massimo `limite` classificazioni per chiamata (il costo è per
// titolo, non enorme, ma niente giustifica classificare 50 titoli quando
// la UI ne mostra 4).
export async function arricchisciConSentimentLocale(items, { limite = 6, classify = null } = {}) {
  if (!Array.isArray(items) || !items.length) return items || [];
  let fatti = 0;
  for (const item of items) {
    if (fatti >= limite) break;
    if (!item || Number.isFinite(item.sentimentScore)) continue; // già un punteggio vero, non toccarlo
    const testo = [item.title, item.summary].filter(Boolean).join('. ');
    if (!testo) continue;
    const r = await classificaSentiment(testo, { classify });
    fatti++;
    if (!r) continue; // modello non disponibile: la voce resta 'sconosciuto' come prima
    item.sentimentScore = r.score;
    item.sentimentLabel = r.label;
    item.sentimentSource = 'on-device';
  }
  return items;
}
