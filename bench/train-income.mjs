// Addestra il MODELLO FISCALE delle entrate (HashedLogReg, 3 classi) e salva i
// pesi in public/momentum_income_model.json — "npm run train:income".
// Misura l'accuratezza su un HELD-OUT generato con seed DIVERSO (esercenti/
// clienti in buona parte mai visti) → numero onesto, non gonfiato.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { trainHashedLogReg, HashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { generateIncomeDataset, INCOME_CLASSES } = await imp('src/ai/train/income-data-gen.mjs');

const CONFIG = { perClass: 500, epochs: 40, dim: 8192, lr: 0.5, l2: 1e-6, seed: 7, dataSeed: 4242 };
console.log('Addestro il modello fiscale entrate (HashedLogReg, JS):', JSON.stringify(CONFIG));
const train = generateIncomeDataset({ perClass: CONFIG.perClass, seed: CONFIG.dataSeed });
const t0 = Date.now();
const model = trainHashedLogReg(train, CONFIG);
console.log(`Addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s su ${train.length} esempi (${INCOME_CLASSES.join('/')}).`);

// Held-out: seed diverso → frasi/clienti in buona parte nuovi
const test = generateIncomeDataset({ perClass: 120, seed: 999999 });
const clf = new HashedLogReg(model);
const perClass = {};
let right = 0;
for (const [text, label] of test) {
  const pred = clf.predict(text).category;
  const b = perClass[label] = perClass[label] || { right: 0, total: 0 };
  b.total++; if (pred === label) { b.right++; right++; }
}
console.log(`\nAccuratezza held-out: ${(100 * right / test.length).toFixed(1)}% su ${test.length} esempi.`);
for (const [c, b] of Object.entries(perClass)) console.log(`  ${c}: ${(100 * b.right / b.total).toFixed(1)}%`);

model.W = model.W.map(v => +v.toFixed(4));
model.b = model.b.map(v => +v.toFixed(4));
model.meta = { config: CONFIG, trainedAt: new Date().toISOString().slice(0, 7), heldOutAcc: +(100 * right / test.length).toFixed(1), classes: INCOME_CLASSES, note: 'Classificatore fiscale entrate: fattura/stipendio/personale. Dati sintetici dichiarati.' };
const outPath = join(root, 'public/momentum_income_model.json');
writeFileSync(outPath, JSON.stringify(model));
console.log('\nSalvato:', outPath, `(${(JSON.stringify(model).length / 1024).toFixed(0)} KB)`);
