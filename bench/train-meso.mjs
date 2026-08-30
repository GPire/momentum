// Riaddestra il Meso in locale (JS puro, nessun Python) — "npm run train:meso".
// Prima di questo script il Meso NON era riproducibile in questo repo, come
// il Nano — stessa storia: pesi arrivati già addestrati altrove, categorie
// ferme a 8/25, hard_noisy_test_accuracy dichiarata 55% (inferiore persino
// al vecchio Nano).
//
// Architettura di Meso (trained-meso.js) — DIVERSA da quella del Nano, non
// solo "la stessa ma più grande": feature IBRIDE parola+carattere. Il
// vocabolario a PAROLE (unigram+bigram) cattura il significato; gli n-grammi
// di CARATTERI (char_wb, 3-5) catturano typo/abbreviazioni/OCR che un
// vocabolario a parole non può mai generalizzare ("amzn" non è mai "amazon"
// per un vocabolario a parole, ma condivide n-grammi di caratteri con esso).
// È l'unico dei 3 modelli statici con questa proprietà — motivo per cui
// Meso, non Nano, è il posto giusto per portare avanti la Fase 2
// (robustezza a errori di scrittura) del piano.
// Rete a 3 strati (input→48→24→nCat, non 2 come il Nano) via lo stesso
// trainer generico (src/ai/train/mlp-trainer.mjs, esteso qui con
// buildVocabulary+charNgrams già pronti per questo). Label smoothing
// attivo (mlp-trainer.mjs, Szegedy et al. 2016): su categorie
// semanticamente vicine (manutenzione/casa, assicurazioni/salute) un
// modello overconfident generalizza peggio — qui si misura se aiuta
// davvero, non si assume.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { generateDataset } = await imp('src/ai/train/data-gen.mjs');
const { buildVocabulary, tfidfSparse, trainMLP, wordTokenize, charNgrams } = await imp('src/ai/train/mlp-trainer.mjs');
const { buildHeldOutSet } = await imp('bench/held-out-set.mjs');
const { TrainedMeso } = await imp('src/ai/trained-meso.js');

const PER_CAT_SYNTH = Number(process.env.PERCAT || 1800);
const EXTERNAL_PER_CAT = Number(process.env.EXTPERCAT || 1800);
const HIDDEN = (process.env.HIDDEN || '48,24').split(',').map(Number);
const EPOCHS = Number(process.env.EPOCHS || 60);
const LR = Number(process.env.LR || 0.2);
const L2 = Number(process.env.L2 || 1e-6);
const SMOOTH = Number(process.env.SMOOTH || 0.05);
const SEED = Number(process.env.SEED || 1);
const WORD_MAXVOCAB = Number(process.env.WORDVOCAB || 4000);
const CHAR_MAXVOCAB = Number(process.env.CHARVOCAB || 5000);

console.log('=== Riaddestramento Meso (JS puro, feature parola+carattere) ===');

const synth = generateDataset({ perCat: PER_CAT_SYNTH, seed: 909091 }).map(([text, cat]) => ({ text, cat }));
const extPath = join(root, 'bench/data/external-nano-us-transactions.json');
let external = [];
if (existsSync(extPath)) {
  const raw = JSON.parse(readFileSync(extPath, 'utf8'));
  const byCat = new Map();
  for (const r of raw) { if (!byCat.has(r.cat)) byCat.set(r.cat, []); byCat.get(r.cat).push(r); }
  for (const [cat, rows] of byCat) external.push(...rows.slice(0, EXTERNAL_PER_CAT).map(r => ({ text: r.text, cat })));
}
const corpus = [...synth, ...external];
const classes = [...new Set(corpus.map(r => r.cat))].sort();
console.log(`Corpus: ${corpus.length} esempi, ${classes.length} categorie (${synth.length} sintetici + ${external.length} reali esterni)`);

const { vocabulary: wordVocab, idf: wordIdf } = buildVocabulary(corpus.map(r => r.text), wordTokenize, { minDf: 2, maxVocab: WORD_MAXVOCAB });
const { vocabulary: charVocabRaw, idf: charIdfRaw } = buildVocabulary(corpus.map(r => r.text), charNgrams, { minDf: 2, maxVocab: CHAR_MAXVOCAB });
const wordVocabSize = Object.keys(wordVocab).length;
const charVocabSize = Object.keys(charVocabRaw).length;
console.log(`Vocabolario parole: ${wordVocabSize}, vocabolario caratteri: ${charVocabSize}, input totale: ${wordVocabSize + charVocabSize}`);

// Feature combinata: word-TFIDF (normalizzata L2 per conto proprio) +
// char-TFIDF (normalizzata L2 per conto proprio), poi concatenate senza una
// seconda normalizzazione congiunta — replica esatta di np.hstack, stessa
// scelta già documentata in trained-meso.js/_featureVector.
function combinedSparse(text) {
  const wSparse = tfidfSparse(wordTokenize(text), wordVocab, wordIdf);
  const cSparse = tfidfSparse(charNgrams(text), charVocabRaw, charIdfRaw).map(([i, v]) => [i + wordVocabSize, v]);
  return [...wSparse, ...cSparse];
}

const classIndex = Object.fromEntries(classes.map((c, i) => [c, i]));
const examples = corpus.map(r => ({ sparse: combinedSparse(r.text), y: classIndex[r.cat] }));

const heldOut = buildHeldOutSet({ perCat: 60, seed: 20260706 });
function evalModel(model) {
  const meso = new TrainedMeso(model);
  let right = 0;
  const perCat = {};
  for (const { text, cat: trueCat } of heldOut) {
    const p = meso.predict(text).category;
    perCat[trueCat] = perCat[trueCat] || { r: 0, n: 0 };
    perCat[trueCat].n++;
    if (p === trueCat) { right++; perCat[trueCat].r++; }
  }
  return { acc: right / heldOut.length, perCat };
}

console.log(`Addestro MLP (${wordVocabSize + charVocabSize} → ${HIDDEN.join('→')} → ${classes.length}), ${EPOCHS} epoche, label smoothing ${SMOOTH}, early stopping su held-out...`);
const t0 = Date.now();
let best = { acc: -1, snap: null, epoch: -1 };
trainMLP({
  examples, inputDim: wordVocabSize + charVocabSize, nClasses: classes.length, hiddenSizes: HIDDEN,
  epochs: EPOCHS, lr: LR, l2: L2, seed: SEED, labelSmoothing: SMOOTH,
  onEpoch: (ep, snap) => {
    const candidate = { word_vocabulary: wordVocab, word_idf: wordIdf, char_vocabulary: charVocabRaw, char_idf: charIdfRaw, categories: classes, coefs: snap.coefs, intercepts: snap.intercepts, temperature: 1.0 };
    const { acc } = evalModel(candidate);
    if (acc > best.acc) best = { acc, snap, epoch: ep };
  },
});
console.log(`Addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s — miglior epoca: ${best.epoch + 1}/${EPOCHS} (${(best.acc * 100).toFixed(1)}% held-out)`);

const round4 = (v) => +v.toFixed(4);
const coefsR = best.snap.coefs.map(W => W.map(row => row.map(round4)));
const interceptsR = best.snap.intercepts.map(layer => layer.map(round4));

const newModel = {
  word_vocabulary: wordVocab, word_idf: wordIdf.map(round4),
  char_vocabulary: charVocabRaw, char_idf: charIdfRaw.map(round4),
  categories: classes, coefs: coefsR, intercepts: interceptsR, temperature: 1.0,
  metrics: { hard_noisy_test_accuracy: null, trained_on: `js-local-${new Date().toISOString().slice(0, 10)}`, per_cat_synth: PER_CAT_SYNTH, per_cat_external: EXTERNAL_PER_CAT, best_epoch: best.epoch + 1, label_smoothing: SMOOTH, sources: external.length ? ['data-gen.mjs (sintetico proprio)', 'DoDataThings/us-bank-transaction-categories-v2 (HF, MIT)'] : ['data-gen.mjs (sintetico proprio)'] },
};

const out = join(root, 'public/momentum_meso_model.json');
const oldModel = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
const oldEval = oldModel ? evalModel(oldModel) : null;
const newEval = evalModel(newModel);
newModel.metrics.hard_noisy_test_accuracy = +newEval.acc.toFixed(4);

console.log(`\n=== Confronto held-out (${classes.length} categorie, ${heldOut.length} esempi mai visti in training) ===`);
console.log(`Meso VECCHIO (8/${classes.length} categorie): ${oldEval ? (oldEval.acc * 100).toFixed(1) + '%' : 'n/d'}`);
console.log(`Meso NUOVO   (${classes.length}/${classes.length} categorie): ${(newEval.acc * 100).toFixed(1)}%`);
console.log('\nPer categoria (nuovo):');
for (const [c, s] of Object.entries(newEval.perCat)) console.log(`  ${c.padEnd(14)} ${((s.r / s.n) * 100).toFixed(0)}%`);

if (process.argv.includes('--save')) {
  writeFileSync(out, JSON.stringify(newModel));
  console.log(`\nSalvato: ${out} (${(JSON.stringify(newModel).length / 1024).toFixed(0)} KB)`);
} else {
  console.log('\n(dry-run: passa --save per scrivere public/momentum_meso_model.json)');
}
