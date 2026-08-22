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
// Le 6 categorie sotto (casa/bollette/salute/istruzione/viaggi/svago) sono
// state aggiunte all'app DOPO che Nano/Meso/LogReg erano stati addestrati
// (vedi CAT_INDICES_SEME in neural-nexus.js, stesso buco) — questo held-out
// prima non le copriva affatto, quindi il cancello non poteva MAI dire se un
// candidato le riconoscesse. Esempi qui DIVERSI da quelli in
// src/ai/train/data-gen.mjs (POOL/MORE/EURO): un held-out che condivide le
// frasi col training non misura generalizzazione, misura memoria.
const BASE = { abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn', 'amazon prime', 'now tv', 'apple music', 'youtube premium', 'palestra mensile', 'telepass abbonamento', 'sky broadband uk', 'peacock premium us', 'virgin mobile uk plan', 'disney plus brasil'], crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'crypto exchange deposito', 'acquisto solana', 'bitpanda crypto', 'wallet btc ricarica', 'etoro crypto trade', 'bitso brasil'], etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'directa acquisto etf', 'etf obbligazionario acquisto', 'etrade brokerage account', 'clear corretora'], ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'ristorante il gambero', 'osteria del corso', 'mcdonalds', 'burger king', 'bar pasticceria centrale', 'kebab house', 'wendys drive thru', 'subway sandwich shop', 'burger king brasil'], shopping: ['zara abbigliamento', 'amazon marketplace', 'h m store', 'mediaworld elettronica', 'decathlon sport', 'zalando ordine', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli', 'ebay purchase online', 'sears department store', 'submarino loja virtual'], spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'carrefour express', 'eurospin', 'pam panorama', 'mercato ortofrutta', 'penny market', 'wegmans grocery store', 'iceland foods uk', 'atacadao supermercado'], stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'salary payment', 'competenze mese corrente', 'bonifico stipendio srl', 'cedolino accredito', 'direct deposit paycheck', 'pagamento salario clt'], trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'esso carburante', 'autostrade pedaggio', 'uber trip', 'taxi 3570', 'flixbus viaggio', 'megabus coach ticket', 'ipiranga posto combustivel'],
  casa: ['affitto bilocale centro', 'mutuo prima casa', 'spese condominio scala b', 'agenzia immobiliare toscana', 'idraulico intervento urgente', 'imbianchino preventivo salotto', 'assicurazione abitazione annuale', 'spese notarili acquisto casa', 'zillow rent payment', 'estate agent fee uk', 'imovel aluguel quintoandar'],
  bollette: ['bolletta enel casa', 'fattura fibra vodafone', 'bolletta gas metano', 'ricarica tim mobile', 'bolletta acqua comunale', 'fattura windtre fisso', 'canone rai televisione', 'bolletta riscaldamento centralizzato', 'npower energy bill', 'duke energy bill us', 'octopus energy bill', 'light conta energia'],
  salute: ['farmacia san marco', 'visita dentistica privata', 'analisi del sangue laboratorio', 'fisioterapia post infortunio', 'visita veterinaria cane', 'ottico nuovi occhiali', 'ticket ambulatorio asl', 'clinica dentale controllo', 'rite aid pharmacy us', 'superdrug pharmacy uk', 'well pharmacy uk', 'drogaria sao paulo'],
  istruzione: ['tasse universita bologna', 'corso inglese online', 'retta asilo nido', 'libri universitari acquisto', 'ripetizioni matematica liceo', 'iscrizione master specialistico', 'corso coursera certificazione', 'scuola guida lezioni pratiche', 'fafsa student aid us', 'pearson course fee', 'anhanguera faculdade'],
  viaggi: ['hotel booking weekend', 'airbnb appartamento vacanza', 'assicurazione viaggio annullamento', 'escursione guidata montagna', 'crociera mediterraneo cabina', 'pacchetto vacanza tutto incluso', 'soggiorno resort mare', 'visto turistico ambasciata', 'delta airlines flight ticket', 'expedia flight booking us', 'cvc viagens pacote'],
  svago: ['cinema multisala biglietto', 'concerto arena biglietto', 'museo egizio ingresso', 'piscina comunale abbonamento', 'bowling serata amici', 'playstation store gioco', 'parco divertimenti gardaland', 'teatro alla scala biglietto', 'six flags theme park', 'cineworld cinema ticket', 'kinoplex cinema brasil'],
};
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
