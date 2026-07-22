// Benchmark della GERARCHIA ESERCENTI — "npm run bench:hierarchy".
//
// LA DOMANDA, posta onestamente: quando l'utente incontra un punto vendita MAI
// VISTO di una catena che ha già categorizzato, il sistema indovina?
//
// È lo scenario reale che il progetto ha misurato come limite n.1 (copertura
// vocabolario, VERSIONI.md): Nano/Meso/LogReg lì sono fuori vocabolario.
//
// PROTOCOLLO (nessuna scorciatoia che gonfi il numero):
// - Le catene e le varianti sono generate con seed deterministico.
// - Si ADDESTRA su alcune varianti di ogni catena (= la storia dell'utente).
// - Si TESTA su varianti DIVERSE, mai viste in addestramento: held-out vero.
// - Baseline = chiave piatta (esattamente ciò che il sistema faceva prima:
//   riconosce solo la stringa identica). Confronto a parità di dati.
// - Si misura anche il caso AVVERSO (catene ambigue) per vedere se il sistema
//   sbaglia con sicurezza o se giustamente si astiene.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initMerchantHierarchy, observeMerchant, predictMerchant, merchantPath } =
  await imp('src/ai/merchant-hierarchy.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260721);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Catene reali italiane + la categoria attesa. Le VARIANTI (indirizzi, civici,
// prefissi POS) sono ciò che cambia da uno scontrino all'altro.
const CHAINS = [
  ['ESSELUNGA', 'spesa'], ['CONAD', 'spesa'], ['CARREFOUR', 'spesa'],
  ['LIDL', 'spesa'], ['COOP', 'spesa'], ['PENNY MARKET', 'spesa'],
  ['Q8', 'trasporti'], ['ENI STATION', 'trasporti'], ['AUTOSTRADE PER LITALIA', 'trasporti'],
  ['TRENITALIA', 'trasporti'], ['ATM MILANO', 'trasporti'],
  ['FARMACIA COMUNALE', 'salute'], ['MCDONALDS', 'svago'], ['OLD WILD WEST', 'svago'],
  ['CINEMA UCI', 'svago'], ['DECATHLON', 'shopping'], ['ZARA', 'shopping'],
  ['MEDIAWORLD', 'shopping'], ['IKEA', 'casa'], ['LEROY MERLIN', 'casa'],
];
const STREETS = ['VIA ROMA', 'VIA RIZZOLI', 'CORSO BUENOS AIRES', 'VIALE CERTOSA',
  'PIAZZA DUOMO', 'VIA TORINO', 'STATALE 16', 'TANGENZIALE OVEST', 'CENTRO COMMERUCIALE',
  'VIA GARIBALDI', 'VIA MAZZINI', 'LARGO AUGUSTO'];
const PREFIX = ['', 'POS ', 'PAGAMENTO ', 'CARTA *1234 ', 'SATISPAY* '];

function variant(chain) {
  const s = pick(STREETS);
  const civ = Math.floor(rnd() * 200);
  const suffix = rnd() < 0.5 ? ` ${civ}` : '';
  return `${pick(PREFIX)}${chain} ${s}${suffix}`;
}

// ── Baseline: chiave piatta (il comportamento PRIMA della gerarchia) ────────
function flatLearn(map, desc, cat) {
  const k = merchantPath(desc).join(' | '); // chiave completa, nessuna gerarchia
  map.set(k, cat);
}
function flatPredict(map, desc) {
  return map.get(merchantPath(desc).join(' | ')) ?? null;
}

// ── Esperimento principale ──────────────────────────────────────────────────
const TRAIN_PER_CHAIN = 4;
const TEST_PER_CHAIN = 6;

const hier = initMerchantHierarchy();
const flat = new Map();
const seen = new Set();

for (const [chain, cat] of CHAINS) {
  for (let i = 0; i < TRAIN_PER_CHAIN; i++) {
    let d; do { d = variant(chain); } while (seen.has(d));
    seen.add(d);
    observeMerchant(hier, d, cat, Date.now());
    flatLearn(flat, d, cat);
  }
}

let hOk = 0, fOk = 0, n = 0, hAbstain = 0, fMiss = 0;
for (const [chain, cat] of CHAINS) {
  for (let i = 0; i < TEST_PER_CHAIN; i++) {
    let d; do { d = variant(chain); } while (seen.has(d));
    seen.add(d); // MAI vista in addestramento
    n++;
    const p = predictMerchant(hier, d);
    if (!p) hAbstain++; else if (p.category === cat) hOk++;
    const f = flatPredict(flat, d);
    if (f === null) fMiss++; else if (f === cat) fOk++;
  }
}

// ── CONDIZIONE 2: catene MISTE (il caso vero) ───────────────────────────────
// Esselunga vende anche carburante, Coop ha il bar: una catena NON e' sempre
// una sola categoria. Qui il 30% delle transazioni della catena e' un'altra
// categoria. Un sistema onesto deve prendere la maggioranza e perdere il resto,
// non fingere il 100%.
const mixed = initMerchantHierarchy();
const MIXED = [['ESSELUNGA', 'spesa', 'trasporti'], ['COOP', 'spesa', 'svago'],
               ['Q8', 'trasporti', 'spesa'], ['IKEA', 'casa', 'svago']];
const mixedTruth = [];
for (const [chain, main, alt] of MIXED) {
  for (let i = 0; i < 10; i++) {
    const cat = rnd() < 0.3 ? alt : main;
    observeMerchant(mixed, variant(chain), cat, Date.now());
  }
  for (let i = 0; i < 15; i++) {
    const cat = rnd() < 0.3 ? alt : main;
    mixedTruth.push([variant(chain), cat, main]);
  }
}
let mixOk = 0, mixMajority = 0;
for (const [d, truth, main] of mixedTruth) {
  const p = predictMerchant(mixed, d);
  if (p && p.category === truth) mixOk++;
  if (p && p.category === main) mixMajority++;
}

// ── CONDIZIONE 3: catene MAI VISTE → deve TACERE ────────────────────────────
// Il rischio peggiore non e' sbagliare, e' sbagliare con sicurezza su un
// esercente di cui non sa nulla.
let ghostSpoke = 0;
const GHOSTS = ['NEGOZIO BIANCHI', 'BOTTEGA VERDE SRL', 'PANIFICIO ROSSI',
  'OFFICINA MECCANICA SUD', 'STUDIO DENTISTICO ALBA'];
for (const g of GHOSTS) {
  for (let i = 0; i < 8; i++) if (predictMerchant(hier, variant(g))) ghostSpoke++;
}

// ── Caso avverso: catena il cui nome NON determina la categoria ─────────────
// L'utente ha lo stesso primo token su categorie diverse. Il sistema deve
// diventare INCERTO, non sbagliare con sicurezza.
const amb = initMerchantHierarchy();
for (const [c, cat] of [['ALFA NORD', 'casa'], ['ALFA SUD', 'svago'],
                        ['ALFA EST', 'trasporti'], ['ALFA OVEST', 'spesa']]) {
  for (let i = 0; i < 4; i++) observeMerchant(amb, `${c} ${pick(STREETS)}`, cat, Date.now());
}
let ambConfident = 0;
for (let i = 0; i < 40; i++) {
  const p = predictMerchant(amb, `ALFA ${pick(['CENTRO', 'NUOVO', 'PORTA'])} ${pick(STREETS)}`);
  if (p && p.margin > 0.5) ambConfident++;
}

const pct = (x, tot) => ((100 * x) / tot).toFixed(1);
console.log('\n=== BENCH GERARCHIA ESERCENTI (seed 20260721) ===');
console.log(`Catene: ${CHAINS.length} · addestramento ${TRAIN_PER_CHAIN}/catena · test ${TEST_PER_CHAIN}/catena`);
console.log(`Casi di test (varianti MAI viste): ${n}\n`);
console.log(`  Baseline chiave piatta : ${pct(fOk, n)}%  (non riconosce nulla: ${pct(fMiss, n)}% di buchi)`);
console.log(`  Gerarchia adattiva     : ${pct(hOk, n)}%  (astensioni: ${pct(hAbstain, n)}%)`);
console.log(`  Guadagno assoluto      : +${(100 * (hOk - fOk) / n).toFixed(1)} punti\n`);
console.log('CONDIZIONE 2 — catene MISTE (30% delle tx in un\'altra categoria):');
console.log(`  accuratezza reale      : ${pct(mixOk, mixedTruth.length)}%  (tetto teorico ~70%: la catena non determina la categoria)`);
console.log(`  quota data alla maggioranza: ${pct(mixMajority, mixedTruth.length)}%\n`);
console.log('CONDIZIONE 3 — catene MAI VISTE (deve tacere):');
console.log(`  ha parlato quando non sapeva: ${pct(ghostSpoke, GHOSTS.length * 8)}%  (0% = corretto)\n`);
console.log('Caso avverso (stesso primo token, categorie diverse):');
console.log(`  predizioni CONFIDENTI su ramo ambiguo: ${pct(ambConfident, 40)}%  (piu' basso = meglio)`);
console.log('\nOnesta\': misura la generalizzazione a punti vendita nuovi di catene NOTE.');
console.log('NON dice nulla su esercenti di catene mai incontrate: li la gerarchia tace.\n');
