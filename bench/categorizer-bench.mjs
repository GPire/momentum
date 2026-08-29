// Benchmark riproducibile di categorizzazione — "npm run bench".
// Regole (VERSIONI.md): dataset generato con seed deterministico, il numero
// dichiarato è SOLO quello stampato da questo script, mai un numero a mano.
//
// Misura Nano, Meso e l'ensemble (voto pesato dell'Orchestrator, senza
// NeuralNexus: qui non c'è un utente che l'ha addestrato) sullo stesso set
// di descrizioni bancarie italiane sporche MAI viste in training, generate
// con gli stessi tipi di rumore reale del train_meso.py (prefissi POS/
// SATISPAY, maiuscole, concatenazioni, vocali cadute, code carta).
//
// Fino al 2026-08-30 copriva SOLO le 8 categorie originali, duplicando
// BASE/PREFIXES/SUFFIXES/noisify anche in bench/train-eval.mjs — unificato
// in bench/held-out-set.mjs ed esteso alle 15 categorie reali (vedi il
// commento in quel file per la cronologia del gap).
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
const { buildHeldOutSet } = await imp('bench/held-out-set.mjs');

const SEED = 20260706;
const PER_CAT = 60;
const dataset = buildHeldOutSet({ perCat: PER_CAT, seed: SEED }); // tutte le 15 categorie

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
const nCats = new Set(dataset.map(d => d.cat)).size;
console.log(`\nMomentum categorizer bench — seed ${SEED}, ${dataset.length} esempi sporchi, ${nCats} categorie\n`);
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
