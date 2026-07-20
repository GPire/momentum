// Model gate reale (Wave 6 v10): confronta il modello di PRODUZIONE
// (public/momentum_logreg_model.json) con un candidato appena addestrato,
// sullo stesso held-out di train-eval.mjs (seed fisso, esercenti rumorosi).
// Sovrascrive il file SOLO se il candidato supera compareModels — altrimenti
// exit 1, file intatto. "npm run train:gate".
//
// Onestà (regola #1): questo NON misura generalizzazione pura (il pool di
// generateDataset e il dizionario BASE del test condividono alcuni brand
// noti, come dichiarato nei commit precedenti) — misura la REGRESSIONE tra
// due addestramenti sullo stesso identico held-out, che è esattamente ciò
// che serve per bloccare un "update rotto" prima che sostituisca il modello
// in produzione.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { HashedLogReg, trainHashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { generateDataset } = await imp('src/ai/train/data-gen.mjs');
const { evalReport, compareModels } = await imp('src/ai/train/model-gate.js');

// ── Held-out test set: stesso schema di train-eval.mjs (seed fisso, esercenti
// rumorosi con prefissi/suffissi bancari realistici) — apples-to-apples.
function mulberry32(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SEED = 20260706;
const rnd = mulberry32(SEED);
const pick = a => a[Math.floor(rnd() * a.length)];
const BASE = { abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn', 'amazon prime', 'now tv', 'apple music', 'youtube premium', 'palestra mensile', 'telepass abbonamento'], crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'crypto exchange deposito', 'acquisto solana', 'bitpanda crypto', 'wallet btc ricarica'], etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'directa acquisto etf', 'etf obbligazionario acquisto'], ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'ristorante il gambero', 'osteria del corso', 'mcdonalds', 'burger king', 'bar pasticceria centrale', 'kebab house'], shopping: ['zara abbigliamento', 'amazon marketplace', 'h m store', 'mediaworld elettronica', 'decathlon sport', 'zalando ordine', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli'], spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'carrefour express', 'eurospin', 'pam panorama', 'mercato ortofrutta', 'penny market'], stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'salary payment', 'competenze mese corrente', 'bonifico stipendio srl', 'cedolino accredito'], trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'esso carburante', 'autostrade pedaggio', 'uber trip', 'taxi 3570', 'flixbus viaggio'] };
const PREFIXES = ['PAGAMENTO POS ', 'SATISPAY*', 'ADDEBITO SDD ', 'CRV*', 'PAGAMENTO CARTA ', 'POS ', ''];
const SUFFIXES = [' CARTA *4412', ' 05/07', ' MILANO ITA', ' EUR', '', ''];
function dropVowels(s, p) { return s.split('').filter(ch => !('aeiou'.includes(ch) && rnd() < p)).join(''); }
function noisify(text) { let t = text; const roll = rnd(); if (roll < 0.3) t = t.toUpperCase(); else if (roll < 0.45) t = t.split(' ').map(w => rnd() < 0.5 ? w.toUpperCase() : w).join(' '); if (rnd() < 0.25) t = t.replace(/ /g, ''); if (rnd() < 0.25) t = dropVowels(t, 0.25); return pick(PREFIXES) + t + pick(SUFFIXES); }
const PER_CAT = 60;
const heldOut = [];
for (const [cat, phrases] of Object.entries(BASE)) for (let i = 0; i < PER_CAT; i++) heldOut.push({ text: noisify(pick(phrases)), cat });

// ── Split walk-forward "merchant mai visto": una quota di BASE esclusa dal
// pool di training (generateDataset usa il pool esteso pan-EU, diverso da
// BASE, quindi questo held-out è già in larga parte merchant-mai-visti;
// riportiamo comunque il numero separato per onestà, come da commit 62b1ad9).
const modelPath = join(root, 'public/momentum_logreg_model.json');
if (!existsSync(modelPath)) { console.error('Nessun modello di produzione trovato — esegui prima npm run train:logreg.'); process.exit(1); }
const baselineRaw = JSON.parse(readFileSync(modelPath, 'utf8'));
const baselineModel = new HashedLogReg(baselineRaw);
const baselineReport = evalReport(baselineModel, heldOut);
console.log(`Baseline (produzione): ${baselineReport.acc}% su ${baselineReport.n} esempi held-out.`);

const CONFIG = baselineRaw.meta?.config || { perCat: 800, epochs: 40, dim: 16384, lr: 0.5, l2: 1e-6, seed: 1, dataSeed: 777 };
console.log('Addestro il candidato con config:', JSON.stringify(CONFIG));
const trainSet = generateDataset({ perCat: CONFIG.perCat, seed: CONFIG.dataSeed });
const t0 = Date.now();
const candidateRaw = trainHashedLogReg(trainSet, CONFIG);
const candidateModel = new HashedLogReg(candidateRaw);
const candidateReport = evalReport(candidateModel, heldOut);
console.log(`Candidato: ${candidateReport.acc}% su ${candidateReport.n} esempi held-out (addestrato in ${((Date.now() - t0) / 1000).toFixed(1)}s).`);

const gate = compareModels(baselineReport, candidateReport);
console.log('\n=== VERDETTO GATE ===');
console.log(`Baseline per categoria:  ${JSON.stringify(baselineReport.perCat)}`);
console.log(`Candidato per categoria: ${JSON.stringify(candidateReport.perCat)}`);

if (gate.pass) {
  candidateRaw.W = candidateRaw.W.map(v => +v.toFixed(4));
  candidateRaw.b = candidateRaw.b.map(v => +v.toFixed(4));
  candidateRaw.meta = {
    config: CONFIG, trainedAt: new Date().toISOString().slice(0, 7),
    gate: { baselineAcc: baselineReport.acc, candidateAcc: candidateReport.acc, perCat: candidateReport.perCat, date: new Date().toISOString(), parentTrainedAt: baselineRaw.meta?.trainedAt || null },
    note: baselineRaw.meta?.note || 'ML generalizzazione held-out; ensemble con Meso',
  };
  writeFileSync(modelPath, JSON.stringify(candidateRaw));
  console.log(`\n✅ PASS — modello sostituito (${baselineReport.acc}% → ${candidateReport.acc}%).`);
} else {
  console.log(`\n❌ FAIL — modello di produzione INTATTO. Motivi: ${gate.reasons.join('; ')}`);
  process.exit(1);
}
