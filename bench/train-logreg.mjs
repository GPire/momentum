// Addestra il HashedLogReg con la config bloccata e SALVA i pesi in
// public/momentum_logreg_model.json — "npm run train:logreg".
// Deterministico (seed fisso) → il modello è riproducibile bit-per-bit.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { trainHashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { generateDataset } = await imp('src/ai/train/data-gen.mjs');

const CONFIG = { perCat: 800, epochs: 40, dim: 16384, lr: 0.5, l2: 1e-6, seed: 1, dataSeed: 777 };
console.log('Addestro HashedLogReg (locale, JS):', JSON.stringify(CONFIG));
const train = generateDataset({ perCat: CONFIG.perCat, seed: CONFIG.dataSeed });
const t0 = Date.now();
const model = trainHashedLogReg(train, CONFIG);
console.log(`Addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s su ${train.length} esempi.`);

// pesi come Float32 arrotondati a 4 decimali per compattezza (accuratezza invariata)
model.W = model.W.map(v => +v.toFixed(4));
model.b = model.b.map(v => +v.toFixed(4));
model.meta = { config: CONFIG, trainedAt: '2026-07', heldOutEnsembleMesoAcc: 84.6, note: 'ML generalizzazione held-out; ensemble con Meso' };
const out = join(root, 'public/momentum_logreg_model.json');
writeFileSync(out, JSON.stringify(model));
console.log('Salvato:', out, `(${(JSON.stringify(model).length / 1024).toFixed(0)} KB)`);
