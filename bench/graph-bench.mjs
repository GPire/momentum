// Benchmark riproducibile del substrato DCGN — "npm run bench:graph".
// Misura la GENERALIZZAZIONE del grafo (spreading activation su token
// subword) su esercenti MAI visti: si addestra su un vocabolario di
// esercenti e si testa su un vocabolario DISGIUNTO (nomi diversi, stesse 8
// categorie), con lo stesso rumore bancario reale del train_meso/bench.
// Regola del progetto (VERSIONI.md): il numero dichiarato è SOLO quello
// stampato da questo script; nessun claim non misurabile ("batte GPT" ecc.).
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { createGraph, observe, classify } = await import(pathToFileURL(join(root, 'src/graph/dcgn.js')).href);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260707);
const pick = arr => arr[Math.floor(rnd() * arr.length)];

// Vocabolario di TRAINING (esercenti che il grafo "vede").
const TRAIN = {
  abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn abbonamento', 'now tv', 'apple music', 'youtube premium', 'palestra mensile'],
  crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'bitpanda crypto', 'acquisto solana', 'wallet btc ricarica'],
  etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'etf obbligazionario'],
  ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'osteria del corso', 'mcdonalds', 'kebab house'],
  shopping: ['zara abbigliamento', 'mediaworld elettronica', 'decathlon sport', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli'],
  spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'eurospin', 'pam panorama'],
  stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'competenze mese corrente', 'cedolino accredito'],
  trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'autostrade pedaggio', 'flixbus viaggio'],
};

// Vocabolario di TEST — esercenti DIVERSI, stesse categorie (held-out reale).
const TEST = {
  abbonamenti: ['prime video', 'sky abbonamento', 'mubi cinema', 'audible abbonamento', 'canva pro', 'nintendo online'],
  crypto: ['bitstamp acquisto btc', 'crypto com ethereum', 'gemini bitcoin', 'okx exchange deposito', 'acquisto cardano'],
  etf: ['acquisto etf nasdaq', 'lyxor etf europe', 'amundi world etf', 'pac etf settimanale', 'etf emerging markets'],
  ristoranti: ['locanda del ponte', 'paninoteca centrale', 'ramen shop milano', 'braceria da luca', 'poke house', 'gelateria fiorello'],
  shopping: ['ovs abbigliamento', 'unieuro elettronica', 'cisalfa sport', 'maisons du monde', 'douglas profumeria', 'mondadori store'],
  spesa: ['bennet ipermercato', 'md discount', 'crai market', 'tuodi spesa', 'famila super', 'in s mercato'],
  stipendio: ['retribuzione mensile accredito', 'bonifico salario azienda', 'paga netto mese', 'accredito stipendio spa'],
  trasporti: ['italobus viaggio', 'gtt torino ricarica', 'benzina eni station', 'parcheggio saba', 'blablacar tratta'],
};

const PREFIXES = ['PAGAMENTO POS ', 'SATISPAY*', 'ADDEBITO SDD ', 'CRV*', 'PAGAMENTO CARTA ', 'POS ', ''];
const SUFFIXES = [' CARTA *4412', ' 05/07', ' MILANO ITA', ' EUR', '', ''];
const dropVowels = (s, p) => s.split('').filter(ch => !('aeiou'.includes(ch) && rnd() < p)).join('');
function noisify(text) {
  let t = text;
  const roll = rnd();
  if (roll < 0.3) t = t.toUpperCase();
  else if (roll < 0.45) t = t.split(' ').map(w => rnd() < 0.5 ? w.toUpperCase() : w).join(' ');
  if (rnd() < 0.25) t = t.replace(/ /g, '');
  if (rnd() < 0.25) t = dropVowels(t, 0.25);
  return pick(PREFIXES) + t + pick(SUFFIXES);
}

function buildSet(vocab, perCat) {
  const out = [];
  for (const [cat, phrases] of Object.entries(vocab)) {
    for (let i = 0; i < perCat; i++) out.push({ text: noisify(pick(phrases)), category: cat });
  }
  return out;
}

const trainSet = buildSet(TRAIN, 120);
const testSet = buildSet(TEST, 60);

// ── Addestramento online (ogni esempio è un update, come nell'app) ──
const g = createGraph();
const tTrain0 = performance.now();
for (const ex of trainSet) observe(g, ex.text, ex.category);
const tTrain1 = performance.now();

// ── Valutazione held-out ──
let right = 0;
const perCat = {};
const tPred0 = performance.now();
for (const { text, category } of testSet) {
  const pred = classify(g, text).category;
  const ok = pred === category;
  if (ok) right++;
  const s = perCat[category] || (perCat[category] = { right: 0, n: 0 });
  s.n++; if (ok) s.right++;
}
const tPred1 = performance.now();

const acc = (right / testSet.length) * 100;
const msPer = (tPred1 - tPred0) / testSet.length;

console.log(`\nMomentum DCGN bench — seed 20260707, train ${trainSet.length} / test held-out ${testSet.length}, 8 categorie`);
console.log('(esercenti di TEST disgiunti dal TRAINING: misura la generalizzazione subword del grafo)\n');
console.log(`  DCGN spreading-activation   ${acc.toFixed(1)}%   (${msPer.toFixed(3)} ms/predizione)`);
console.log(`  Apprendimento online        ${((tTrain1 - tTrain0) / trainSet.length).toFixed(3)} ms/esempio`);
console.log('\nPer categoria:');
for (const [cat, s] of Object.entries(perCat)) {
  console.log(`  ${cat.padEnd(12)} ${((s.right / s.n) * 100).toFixed(0)}%`);
}
console.log('\nRegola: numero riproducibile del substrato DCGN. È la GENERALIZZAZIONE ML pura del');
console.log('grafo (senza dizionario esercenti): il prodotto reale userà anche il dizionario.');
