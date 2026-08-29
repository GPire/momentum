// Addestra il HashedLogReg con la config bloccata e SALVA i pesi in
// public/momentum_logreg_model.json — "npm run train:logreg".
// Deterministico (seed fisso) → il modello è riproducibile bit-per-bit.
//
// Esteso il 2026-08-30: oltre al pool sintetico proprio (data-gen.mjs),
// il training include ora anche il dataset reale esterno usato per il
// Nano (DoDataThings/us-bank-transaction-categories-v2, HF, MIT, 56.000
// descrizioni USA reali mappate su 12/15 categorie Momentum — vedi
// bench/train-nano.mjs per la motivazione completa della mappatura e delle
// 3 categorie escluse). HashedLogReg non ha un vocabolario esplicito
// (hashFeatures usa FNV1a), quindi l'integrazione è diretta: bastano coppie
// [testo, categoria] in più, nessuna costruzione di vocabolario da rifare.
// Valutato SEMPRE sullo stesso held-out condiviso (bench/held-out-set.mjs,
// 15 categorie) usato anche dal Nano — mai salvato se non genuinamente
// migliore del modello già spedito, mai un numero dichiarato a mano.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { trainHashedLogReg, HashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { generateDataset } = await imp('src/ai/train/data-gen.mjs');
const { buildHeldOutSet } = await imp('bench/held-out-set.mjs');

const CONFIG = { perCat: 800, epochs: 40, dim: 16384, lr: 0.5, l2: 1e-6, seed: 1, dataSeed: 777, useIdf: true };
console.log('Addestro HashedLogReg (locale, JS):', JSON.stringify(CONFIG));
const synth = generateDataset({ perCat: CONFIG.perCat, seed: CONFIG.dataSeed });

const EXTPERCAT = Number(process.env.EXTPERCAT || 800);
const extPath = join(root, 'bench/data/external-nano-us-transactions.json');
let external = [];
if (existsSync(extPath)) {
  const raw = JSON.parse(readFileSync(extPath, 'utf8'));
  const byCat = new Map();
  for (const r of raw) { if (!byCat.has(r.cat)) byCat.set(r.cat, []); byCat.get(r.cat).push(r); }
  for (const [, rows] of byCat) external.push(...rows.slice(0, EXTPERCAT).map(r => [r.text, r.cat]));
  console.log(`+ dataset reale esterno (DoDataThings, MIT): ${external.length} esempi, ${byCat.size} categorie`);
}
const train = [...synth, ...external];

const t0 = Date.now();
const model = trainHashedLogReg(train, CONFIG);
console.log(`Addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s su ${train.length} esempi.`);

// pesi come Float32 arrotondati a 4 decimali per compattezza (accuratezza invariata)
model.W = model.W.map(v => +v.toFixed(4));
model.b = model.b.map(v => +v.toFixed(4));

// ── Valutazione onesta sul held-out condiviso (mai salvato a scatola chiusa) ──
const heldOut = buildHeldOutSet({ perCat: 60, seed: 20260706 });
function evalLogreg(m) {
  const lr = new HashedLogReg(m);
  let right = 0;
  for (const { text, cat } of heldOut) if (lr.predict(text).category === cat) right++;
  return right / heldOut.length;
}
const out = join(root, 'public/momentum_logreg_model.json');
const oldModel = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
const oldAcc = oldModel ? evalLogreg(oldModel) : null;
const newAcc = evalLogreg(model);
console.log(`\nHeld-out (15 categorie, ${heldOut.length} esempi): vecchio ${oldAcc !== null ? (oldAcc * 100).toFixed(1) + '%' : 'n/d'} → nuovo ${(newAcc * 100).toFixed(1)}%`);

model.meta = { config: CONFIG, trainedAt: new Date().toISOString().slice(0, 10), heldOutAcc: +(newAcc * 100).toFixed(2), sources: external.length ? ['data-gen.mjs (sintetico proprio)', 'DoDataThings/us-bank-transaction-categories-v2 (HF, MIT)'] : ['data-gen.mjs (sintetico proprio)'], note: 'ML generalizzazione held-out; ensemble con Meso' };

if (process.argv.includes('--force') || oldAcc === null || newAcc >= oldAcc) {
  writeFileSync(out, JSON.stringify(model));
  console.log('Salvato:', out, `(${(JSON.stringify(model).length / 1024).toFixed(0)} KB)`);
} else {
  console.log(`NON salvato: il nuovo modello (${(newAcc * 100).toFixed(1)}%) non batte quello già spedito (${(oldAcc * 100).toFixed(1)}%). Passa --force per sovrascrivere comunque.`);
}
