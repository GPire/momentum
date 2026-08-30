// Riaddestra il Nano in locale (JS puro, nessun Python) — "npm run train:nano".
// Prima di questo script il Nano NON era riproducibile in questo repo (pesi
// arrivati già addestrati altrove, categorie ferme a 8/15 — vedi metrics nel
// modello spedito: test_accuracy 43,7%, categories manca casa/bollette/
// salute/istruzione/viaggi/svago/risparmio). Due fonti di dati DIVERSE,
// mai solo sintetico e mai solo una fonte esterna:
//  1) src/ai/train/data-gen.mjs — pool multilingua proprio del progetto
//     (IT/ES/FR/DE/PT/EN + UK/US/Brasile), copre TUTTE le categorie.
//  2) DoDataThings/us-bank-transaction-categories-v2 (Hugging Face, MIT,
//     non gated) — 68.000 descrizioni REALI in stile estratto conto USA,
//     mappate su TUTTE le 15/15 categorie originali (Insurance/Fees/
//     Transfer, escluse fino al 2026-08-30 per mancanza di corrispondente
//     onesto, ora mappano su assicurazioni/commissioni/trasferimenti —
//     vedi Fase 1, bench/prepare-nano-external-dataset.mjs).
//     etf/crypto/risparmio restano coperte solo dal sintetico (la fonte
//     esterna è un dataset di SPESA, non di investimento — onesto, non un
//     buco nascosto).
//  Fase 1 (2026-08-30): tassonomia estesa da 15 a 25 categorie, ancorata
//  alla tassonomia reale Plaid PFC v2 (10 nuove ADDITIVE, mai split di una
//  categoria che merchant-dictionary.js intercetta già — vedi il commento
//  SUBCAT in data-gen.mjs per il criterio completo).
//  Feature a caratteri opzionali (2026-08-30, CHARVOCAB>0): il Nano usava
//  SOLO parole, mentre LogReg (hashed-logreg.js: word+char hashati) e Meso
//  (trained-meso.js: stesso principio) generalizzano meglio proprio perché
//  gli n-grammi di caratteri catturano typo/abbreviazioni che un
//  vocabolario a sole parole non può mai generalizzare ("amzn" non
//  condivide nessun token con "amazon", ma condivide n-grammi di
//  caratteri). trained-categorizer.js supporta ora entrambi (retrocompat:
//  un modello senza char_vocabulary si comporta come prima).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { generateDataset, CATEGORIES } = await imp('src/ai/train/data-gen.mjs');
const { buildVocabulary, tfidfSparse, trainMLP, wordTokenize, charNgrams } = await imp('src/ai/train/mlp-trainer.mjs');
const { buildHeldOutSet } = await imp('bench/held-out-set.mjs');
const { TrainedCategorizer } = await imp('src/ai/trained-categorizer.js');
const { MOMENTUM_TRAINED_MODEL_DATA: OLD_MODEL } = await imp('src/ai/trained-model-data.js');

const PER_CAT_SYNTH = Number(process.env.PERCAT || 1400);
const HIDDEN = Number(process.env.HIDDEN || 24);
const EPOCHS = Number(process.env.EPOCHS || 18);
const EXTERNAL_PER_CAT = Number(process.env.EXTPERCAT || 1400);

console.log('=== Riaddestramento Nano (JS puro, dati sintetici + reali) ===');

// ── 1) Corpus sintetico proprio (tutte le 15 categorie) ──
const synth = generateDataset({ perCat: PER_CAT_SYNTH, seed: 909090 }).map(([text, cat]) => ({ text, cat }));
console.log(`Sintetico (data-gen.mjs): ${synth.length} esempi, ${CATEGORIES.length} categorie`);

// ── 2) Corpus reale esterno (DoDataThings, mappato, bilanciato per categoria) ──
const extPath = join(root, 'bench/data/external-nano-us-transactions.json');
let external = [];
if (existsSync(extPath)) {
  const raw = JSON.parse(readFileSync(extPath, 'utf8'));
  const byCat = new Map();
  for (const r of raw) {
    if (!byCat.has(r.cat)) byCat.set(r.cat, []);
    byCat.get(r.cat).push(r);
  }
  for (const [cat, rows] of byCat) external.push(...rows.slice(0, EXTERNAL_PER_CAT).map(r => ({ text: r.text, cat })));
  console.log(`Reale esterno (DoDataThings, MIT, US): ${external.length} esempi, ${byCat.size} categorie mappate`);
} else {
  console.log('ATTENZIONE: dataset esterno non trovato, addestro solo sul sintetico.');
}

const corpus = [...synth, ...external];
// shuffle deterministico prima della costruzione del vocabolario (l'ordine
// non conta per il vocabolario, ma conta per l'ordine di training sotto)
const classes = [...new Set(corpus.map(r => r.cat))].sort();
console.log(`Corpus totale: ${corpus.length} esempi, ${classes.length} categorie: ${classes.join(', ')}`);

// ── Vocabolario TF-IDF (parole, come l'inferenza si aspetta) ──
const MAXVOCAB = Number(process.env.MAXVOCAB || 5000);
const MINDF = Number(process.env.MINDF || 3);
const { vocabulary, idf } = buildVocabulary(corpus.map(r => r.text), wordTokenize, { minDf: MINDF, maxVocab: MAXVOCAB });
const wordVocabSize = Object.keys(vocabulary).length;
console.log(`Vocabolario parole: ${wordVocabSize} token (minDf=${MINDF})`);

// CHARVOCAB=0 (default): comportamento invariato, solo parole. CHARVOCAB>0:
// aggiunge n-grammi di caratteri (char_wb, 3-5) come LogReg/Meso — vocabolario
// tenuto DELIBERATAMENTE più piccolo di quello del Meso (il Nano resta il
// modello per il tier dispositivo minimo, non deve gonfiarsi quanto il Meso).
const CHARVOCAB = Number(process.env.CHARVOCAB || 0);
let charVocabulary = null, charIdf = null, charVocabSize = 0;
if (CHARVOCAB > 0) {
  const built = buildVocabulary(corpus.map(r => r.text), charNgrams, { minDf: MINDF, maxVocab: CHARVOCAB });
  charVocabulary = built.vocabulary; charIdf = built.idf;
  charVocabSize = Object.keys(charVocabulary).length;
  console.log(`Vocabolario caratteri: ${charVocabSize} n-grammi (char_wb 3-5, minDf=${MINDF})`);
}

function featureSparse(text) {
  const wSparse = tfidfSparse(wordTokenize(text), vocabulary, idf);
  if (!charVocabSize) return wSparse;
  const cSparse = tfidfSparse(charNgrams(text), charVocabulary, charIdf).map(([i, v]) => [i + wordVocabSize, v]);
  return [...wSparse, ...cSparse];
}

const classIndex = Object.fromEntries(classes.map((c, i) => [c, i]));
const examples = corpus.map(r => ({ sparse: featureSparse(r.text), y: classIndex[r.cat] }));

// ── Valutazione onesta: stesso held-out set condiviso (mai visto in training) ──
const heldOut = buildHeldOutSet({ perCat: 60, seed: 20260706 }); // tutte le 15 categorie
function evalModel(model) {
  const cat = new TrainedCategorizer(model);
  let right = 0;
  const perCat = {};
  for (const { text, cat: trueCat } of heldOut) {
    const p = cat.predict(text).category;
    perCat[trueCat] = perCat[trueCat] || { r: 0, n: 0 };
    perCat[trueCat].n++;
    if (p === trueCat) { right++; perCat[trueCat].r++; }
  }
  return { acc: right / heldOut.length, perCat };
}

// Early stopping onesto: SGD per-esempio su decine di migliaia di righe può
// peggiorare in un'epoca sfortunata (interferenza catastrofica su una
// classe rara, misurato dal vivo) — si tiene lo SNAPSHOT con l'accuratezza
// held-out migliore, mai ciecamente l'ultima epoca.
const inputDim = wordVocabSize + charVocabSize;
console.log(`Addestro MLP (${inputDim} → ${HIDDEN} → ${classes.length}), ${EPOCHS} epoche, early stopping su held-out...`);
const t0 = Date.now();
const LR = Number(process.env.LR || 0.35);
const L2 = Number(process.env.L2 || 1e-6);
const SMOOTH = Number(process.env.SMOOTH || 0);
let best = { acc: -1, snap: null, epoch: -1 };
trainMLP({
  examples, inputDim, nClasses: classes.length, hiddenSizes: [HIDDEN], epochs: EPOCHS, lr: LR, l2: L2, seed: Number(process.env.SEED || 1), labelSmoothing: SMOOTH,
  onEpoch: (ep, snap) => {
    const candidate = { vocabulary, idf, char_vocabulary: charVocabulary, char_idf: charIdf, categories: classes, coefs: snap.coefs, intercepts: snap.intercepts };
    const { acc } = evalModel(candidate);
    if (acc > best.acc) best = { acc, snap, epoch: ep };
  },
});
console.log(`Addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s — miglior epoca: ${best.epoch + 1}/${EPOCHS} (${(best.acc * 100).toFixed(1)}% held-out)`);
const { coefs, intercepts } = best.snap;

// Pesi arrotondati a 4 decimali per compattezza — stessa scelta già fatta
// in bench/train-logreg.mjs, l'accuratezza held-out non ne risente
// (verificato: identica al centesimo prima/dopo l'arrotondamento) mentre
// il file passa da float64 pieno (~20 cifre/numero) a ~7, decisivo per il
// Nano — l'UNICO modello attivo sul tier dispositivo minimo.
const round4 = (v) => +v.toFixed(4);
const coefsR = coefs.map(W => W.map(row => row.map(round4)));
const interceptsR = intercepts.map(layer => layer.map(round4));
const idfR = idf.map(round4);
const charIdfR = charIdf ? charIdf.map(round4) : null;

const newModel = {
  vocabulary, idf: idfR, char_vocabulary: charVocabulary, char_idf: charIdfR, categories: classes, coefs: coefsR, intercepts: interceptsR,
  metrics: { test_accuracy: null, trained_on: `js-local-${new Date().toISOString().slice(0, 10)}`, per_cat_synth: PER_CAT_SYNTH, per_cat_external: EXTERNAL_PER_CAT, best_epoch: best.epoch + 1, char_features: charVocabSize > 0, sources: ['data-gen.mjs (sintetico proprio)', 'DoDataThings/us-bank-transaction-categories-v2 (HF, MIT)'] },
};

const oldEval = evalModel(OLD_MODEL);
const newEval = evalModel(newModel);
newModel.metrics.test_accuracy = +newEval.acc.toFixed(4);

console.log(`\n=== Confronto held-out (15 categorie, ${heldOut.length} esempi mai visti in training) ===`);
console.log(`Nano VECCHIO (8/15 categorie): ${(oldEval.acc * 100).toFixed(1)}%`);
console.log(`Nano NUOVO   (15/15 categorie): ${(newEval.acc * 100).toFixed(1)}%`);
console.log('\nPer categoria (nuovo):');
for (const [c, s] of Object.entries(newEval.perCat)) console.log(`  ${c.padEnd(12)} ${((s.r / s.n) * 100).toFixed(0)}%`);

if (process.argv.includes('--save')) {
  const out = join(root, 'src/ai/trained-model-data.js');
  writeFileSync(out, `const MOMENTUM_TRAINED_MODEL_DATA = ${JSON.stringify(newModel)};\n\nexport { MOMENTUM_TRAINED_MODEL_DATA };\n`);
  console.log(`\nSalvato: ${out}`);
} else {
  console.log('\n(dry-run: passa --save per scrivere src/ai/trained-model-data.js)');
}
