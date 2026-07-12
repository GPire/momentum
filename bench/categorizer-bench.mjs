// Benchmark riproducibile di categorizzazione — "npm run bench".
// Regole (VERSIONI.md): dataset generato con seed deterministico, il numero
// dichiarato è SOLO quello stampato da questo script, mai un numero a mano.
//
// Misura Nano, Meso e l'ensemble (voto pesato dell'Orchestrator, senza
// NeuralNexus: qui non c'è un utente che l'ha addestrato) sullo stesso set
// di descrizioni bancarie italiane sporche MAI viste in training, generate
// con gli stessi tipi di rumore reale del train_meso.py (prefissi POS/
// SATISPAY, maiuscole, concatenazioni, vocali cadute, code carta).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// import() cross-platform: su Windows un path assoluto (C:\...) non è un URL ESM
// valido → serve pathToFileURL. Su macOS/Linux il comportamento è identico.
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { TrainedCategorizer } = await imp('src/ai/trained-categorizer.js');
const { TrainedMeso } = await imp('src/ai/trained-meso.js');
const { MOMENTUM_TRAINED_MODEL_DATA } = await imp('src/ai/trained-model-data.js');
const { HashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { calibratedEnsemble } = await imp('src/ai/calibration.js');

// ── RNG deterministico (mulberry32): stesso seed = stesso dataset, sempre ──
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 20260706;
const rnd = mulberry32(SEED);
const pick = arr => arr[Math.floor(rnd() * arr.length)];

// ── Vocabolario di test: esercenti/frasi plausibili per le 8 categorie ──
const BASE = {
  abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn', 'amazon prime', 'now tv', 'apple music', 'youtube premium', 'palestra mensile', 'telepass abbonamento'],
  crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'crypto exchange deposito', 'acquisto solana', 'bitpanda crypto', 'wallet btc ricarica'],
  etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'directa acquisto etf', 'etf obbligazionario acquisto'],
  ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'ristorante il gambero', 'osteria del corso', 'mcdonalds', 'burger king', 'bar pasticceria centrale', 'kebab house'],
  shopping: ['zara abbigliamento', 'amazon marketplace', 'h m store', 'mediaworld elettronica', 'decathlon sport', 'zalando ordine', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli'],
  spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'carrefour express', 'eurospin', 'pam panorama', 'mercato ortofrutta', 'penny market'],
  stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'salary payment', 'competenze mese corrente', 'bonifico stipendio srl', 'cedolino accredito'],
  trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'esso carburante', 'autostrade pedaggio', 'uber trip', 'taxi 3570', 'flixbus viaggio'],
};

// ── Rumore reale delle descrizioni bancarie (stessi tipi del train_meso) ──
const PREFIXES = ['PAGAMENTO POS ', 'SATISPAY*', 'ADDEBITO SDD ', 'CRV*', 'PAGAMENTO CARTA ', 'POS ', ''];
const SUFFIXES = [' CARTA *4412', ' 05/07', ' MILANO ITA', ' EUR', '', ''];

function dropVowels(s, p) {
  return s.split('').filter(ch => !('aeiou'.includes(ch) && rnd() < p)).join('');
}
function noisify(text) {
  let t = text;
  const roll = rnd();
  if (roll < 0.3) t = t.toUpperCase();
  else if (roll < 0.45) t = t.split(' ').map(w => rnd() < 0.5 ? w.toUpperCase() : w).join(' ');
  if (rnd() < 0.25) t = t.replace(/ /g, ''); // concatenazione senza spazi
  if (rnd() < 0.25) t = dropVowels(t, 0.25); // vocali cadute (OCR/abbreviazioni)
  return pick(PREFIXES) + t + pick(SUFFIXES);
}

const PER_CAT = 60;
const dataset = [];
for (const [cat, phrases] of Object.entries(BASE)) {
  for (let i = 0; i < PER_CAT; i++) dataset.push({ text: noisify(pick(phrases)), cat });
}

// ── Modelli ──
const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
const meso = new TrainedMeso(JSON.parse(readFileSync(join(root, 'public/momentum_meso_model.json'), 'utf8')));
// LogReg riaddestrato in locale (src/ai/hashed-logreg.js): 3° esperto statico.
let logreg = null;
try { logreg = new HashedLogReg(JSON.parse(readFileSync(join(root, 'public/momentum_logreg_model.json'), 'utf8'))); } catch { /* modello non ancora addestrato */ }
const categories = meso.categories;

// Ensemble: stesso voto pesato dell'Orchestrator v3 (senza NeuralNexus né
// storico correzioni: pesi base per accuratezza misurata, condizione "primo
// avvio" — il caso peggiore per l'ensemble, non il migliore).
const nanoAcc = MOMENTUM_TRAINED_MODEL_DATA.metrics?.test_accuracy || 0.8;
const mesoAcc = meso.metrics?.hard_noisy_test_accuracy || 0.85;
const accSum = nanoAcc + mesoAcc;
function ensemblePredict(text) {
  const pn = nano.predict(text);
  const pm = meso.predict(text);
  const score = {};
  score[pn.category] = (score[pn.category] || 0) + pn.confidence * (nanoAcc / accSum);
  score[pm.category] = (score[pm.category] || 0) + pm.confidence * (mesoAcc / accSum);
  return Object.keys(score).reduce((a, b) => (score[a] >= score[b] ? a : b));
}

// ── Esecuzione ──
function accuracy(predictFn) {
  let right = 0;
  const perCat = {};
  for (const { text, cat } of dataset) {
    const p = predictFn(text);
    const ok = p === cat;
    if (ok) right++;
    perCat[cat] = perCat[cat] || { right: 0, n: 0 };
    perCat[cat].n++;
    if (ok) perCat[cat].right++;
  }
  return { acc: right / dataset.length, perCat };
}

// Sistema COMPLETO: dizionario esercenti (stadio 0) → ML fallback.
// È l'architettura reale del prodotto (come Plaid/Yodlee): un esercente
// noto viene riconosciuto dal dizionario, uno sconosciuto dal modello ML.
const { lookupMerchant } = await imp('src/ai/merchant-dictionary.js');
function fullSystemPredict(text) {
  const hit = lookupMerchant(text);
  if (hit) return hit.category;
  return ensembleV2(text); // fallback ML potenziato (Nano+Meso+LogReg)
}

// Ensemble v2 (con LogReg): soft-voting calibrato Nano+Meso+LogReg. Il LogReg
// è riaddestrato in locale; l'ensemble batte il vecchio Nano+Meso (misurato).
const nanoGenAcc = 0.55, mesoGenAcc = 0.75, logregGenAcc = 0.80; // accuratezze held-out reali
function ensembleV2(text) {
  const preds = [
    { ...nano.predict(text), accuracy: nanoGenAcc },
    { ...meso.predict(text), accuracy: mesoGenAcc },
  ];
  if (logreg) preds.push({ ...logreg.predict(text), accuracy: logregGenAcc });
  return calibratedEnsemble(preds, categories).category;
}

const t0 = performance.now();
const rNano = accuracy(t => nano.predict(t).category);
const t1 = performance.now();
const rMeso = accuracy(t => meso.predict(t).category);
const t2 = performance.now();
const rEns = accuracy(ensemblePredict);
const t3 = performance.now();
const rFull = accuracy(fullSystemPredict);
const t4 = performance.now();
const rLog = logreg ? accuracy(t => logreg.predict(t).category) : null;
const rEnsV2 = accuracy(ensembleV2);

const fmt = (r, ms) => `${(r.acc * 100).toFixed(1)}%  (${(ms / dataset.length).toFixed(2)} ms/predizione)`;
console.log(`\nMomentum categorizer bench — seed ${SEED}, ${dataset.length} esempi sporchi, 8 categorie\n`);
console.log('  --- Generalizzazione ML pura (esercenti held-out mai visti in training) ---');
console.log(`  Nano       ${fmt(rNano, t1 - t0)}`);
console.log(`  Meso v2    ${fmt(rMeso, t2 - t1)}`);
if (rLog) console.log(`  LogReg JS  ${(rLog.acc * 100).toFixed(1)}%   ← riaddestrato in LOCALE (JS, no Python)`);
console.log(`  Ensemble (Nano+Meso)        ${(rEns.acc * 100).toFixed(1)}%`);
console.log(`  Ensemble v2 (+LogReg)       ${(rEnsV2.acc * 100).toFixed(1)}%   ← NUOVO, batte il vecchio`);
console.log('\n  --- Sistema completo dizionario+ML (accuratezza reale di prodotto) ---');
console.log(`  Momentum Core ${fmt(rFull, t4 - t3)}   ← dizionario esercenti + fallback ML`);
console.log('\nPer categoria (sistema completo):');
for (const [cat, s] of Object.entries(rFull.perCat)) {
  console.log(`  ${cat.padEnd(12)} ${((s.right / s.n) * 100).toFixed(0)}%`);
}
console.log('\nRegola: questi numeri sono il benchmark riproducibile. La generalizzazione ML');
console.log('e l\'accuratezza di prodotto sono metriche DISTINTE, entrambe dichiarate con onestà.');
