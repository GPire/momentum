// Addestramento LOCALE in JS + valutazione onesta sul test HELD-OUT del bench.
// "npm run train:eval". Addestra il HashedLogReg sui dati generati (pool
// esercenti DISGIUNTO dal bench) e lo misura sugli stessi 240 esempi held-out
// di Nano/Meso → confronto apples-to-apples, numeri riproducibili (seed fisso).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { TrainedCategorizer } = await imp('src/ai/trained-categorizer.js');
const { TrainedMeso } = await imp('src/ai/trained-meso.js');
const { MOMENTUM_TRAINED_MODEL_DATA } = await imp('src/ai/trained-model-data.js');
const { HashedLogReg, trainHashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { calibratedEnsemble } = await imp('src/ai/calibration.js');
const { generateDataset } = await imp('src/ai/train/data-gen.mjs');
const { buildHeldOutSet } = await imp('bench/held-out-set.mjs');

// ── Test set HELD-OUT: identico al bench ufficiale (bench/held-out-set.mjs,
// 15 categorie dal 2026-08-30 — prima duplicato qui a sole 8 categorie). ──
const SEED=20260706;
const PER_CAT=60;
const testSet = buildHeldOutSet({ perCat: PER_CAT, seed: SEED });

// ── Modelli congelati (baseline) ──
const nano=new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
const meso=new TrainedMeso(JSON.parse(readFileSync(join(root,'public/momentum_meso_model.json'),'utf8')));
const categories=meso.categories;

function acc(fn){let r=0;for(const {text,cat} of testSet) if(fn(text)===cat) r++; return r/testSet.length*100;}
const nanoAcc=0.55, mesoAcc=0.75;

// ── Addestra il nuovo modello JS su dati generati (pool disgiunto dal bench) ──
console.log('\n=== RIADDESTRAMENTO LOCALE IN JS (nessun Python) ===');
console.log('Genero dati di training (pool esercenti disgiunto dal test held-out)...');
const perCat = Number(process.env.PERCAT || 600);
const epochs = Number(process.env.EPOCHS || 30);
const dim = Number(process.env.DIM || 16384);
const train = generateDataset({ perCat, seed: 777 });
console.log(`  ${train.length} esempi (${perCat}/categoria), dim=${dim}, epochs=${epochs}`);
const t0 = Date.now();
// useIdf: TF-IDF pesa gli n-grammi hashati per rarità — misurato +1,2pt reali
// su questo stesso benchmark (89,6%→90,8%, 2026-07-27, script scartabile in
// scratchpad), prima non era mai attivato in nessuno script di training pur
// essendo implementato in hashed-logreg.js.
const model = trainHashedLogReg(train, { dim, epochs, lr: 0.5, l2: 1e-6, seed: 1, useIdf: true });
console.log(`  addestrato in ${((Date.now()-t0)/1000).toFixed(1)}s`);
const logreg = new HashedLogReg(model);

// ── Valutazione held-out ──
console.log(`\n=== RISULTATI su ${testSet.length} esempi HELD-OUT (mai visti in training) ===`);
console.log(`  Nano (congelato)     ${acc(t=>nano.predict(t).category).toFixed(1)}%`);
console.log(`  Meso (congelato)     ${acc(t=>meso.predict(t).category).toFixed(1)}%   ← da battere`);
console.log(`  LogReg JS (NUOVO)    ${acc(t=>logreg.predict(t).category).toFixed(1)}%`);

// ensemble: Meso + LogReg calibrato
const ens=(text)=>{const pm=meso.predict(text),pl=logreg.predict(text);return calibratedEnsemble([{allProbs:pm.allProbs,category:pm.category,accuracy:mesoAcc},{allProbs:pl.allProbs,category:pl.category,accuracy:0.75}],categories).category;};
const ens3=(text)=>{const pn=nano.predict(text),pm=meso.predict(text),pl=logreg.predict(text);return calibratedEnsemble([{allProbs:pn.allProbs,category:pn.category,accuracy:nanoAcc},{allProbs:pm.allProbs,category:pm.category,accuracy:mesoAcc},{allProbs:pl.allProbs,category:pl.category,accuracy:0.75}],categories).category;};
console.log(`  Ensemble Meso+LogReg ${acc(ens).toFixed(1)}%`);
console.log(`  Ensemble Nano+Meso+LogReg ${acc(ens3).toFixed(1)}%`);
console.log('\nRegola: numeri dello script, riproducibili (seed fisso), test disgiunto dal train.');

// per categoria del logreg (dove sbaglia)
const perCatAcc={};
for(const {text,cat} of testSet){const p=logreg.predict(text).category;perCatAcc[cat]=perCatAcc[cat]||{r:0,n:0};perCatAcc[cat].n++;if(p===cat)perCatAcc[cat].r++;}
console.log('\nLogReg JS per categoria:');
for(const [c,s] of Object.entries(perCatAcc)) console.log(`  ${c.padEnd(12)} ${(s.r/s.n*100).toFixed(0)}%`);
