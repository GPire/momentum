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

// ── Test set HELD-OUT: identico al bench ufficiale (stesso seed, stessi BASE) ──
function mulberry32(seed){return function(){seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const SEED=20260706; const rnd=mulberry32(SEED); const pick=a=>a[Math.floor(rnd()*a.length)];
const BASE={abbonamenti:['netflix','spotify premium','disney plus','dazn','amazon prime','now tv','apple music','youtube premium','palestra mensile','telepass abbonamento'],crypto:['binance acquisto btc','coinbase ethereum','kraken bitcoin','crypto exchange deposito','acquisto solana','bitpanda crypto','wallet btc ricarica'],etf:['acquisto etf msci world','vanguard sp500','ishares etf global','pac etf mensile','directa acquisto etf','etf obbligazionario acquisto'],ristoranti:['trattoria da mario','pizzeria bella napoli','sushi bar tokyo','ristorante il gambero','osteria del corso','mcdonalds','burger king','bar pasticceria centrale','kebab house'],shopping:['zara abbigliamento','amazon marketplace','h m store','mediaworld elettronica','decathlon sport','zalando ordine','ikea mobili','sephora profumeria','libreria feltrinelli'],spesa:['esselunga supermercato','coop alleanza','conad city','lidl italia','carrefour express','eurospin','pam panorama','mercato ortofrutta','penny market'],stipendio:['accredito emolumenti azienda','stipendio mensile bonifico','salary payment','competenze mese corrente','bonifico stipendio srl','cedolino accredito'],trasporti:['trenitalia biglietto','italo treno','atm milano ricarica','benzina q8','esso carburante','autostrade pedaggio','uber trip','taxi 3570','flixbus viaggio']};
const PREFIXES=['PAGAMENTO POS ','SATISPAY*','ADDEBITO SDD ','CRV*','PAGAMENTO CARTA ','POS ',''];
const SUFFIXES=[' CARTA *4412',' 05/07',' MILANO ITA',' EUR','',''];
function dropVowels(s,p){return s.split('').filter(ch=>!('aeiou'.includes(ch)&&rnd()<p)).join('');}
function noisify(text){let t=text;const roll=rnd();if(roll<0.3)t=t.toUpperCase();else if(roll<0.45)t=t.split(' ').map(w=>rnd()<0.5?w.toUpperCase():w).join(' ');if(rnd()<0.25)t=t.replace(/ /g,'');if(rnd()<0.25)t=dropVowels(t,0.25);return pick(PREFIXES)+t+pick(SUFFIXES);}
const PER_CAT=60; const testSet=[];
for(const [cat,phrases] of Object.entries(BASE)) for(let i=0;i<PER_CAT;i++) testSet.push({text:noisify(pick(phrases)),cat});

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
const model = trainHashedLogReg(train, { dim, epochs, lr: 0.5, l2: 1e-6, seed: 1 });
console.log(`  addestrato in ${((Date.now()-t0)/1000).toFixed(1)}s`);
const logreg = new HashedLogReg(model);

// ── Valutazione held-out ──
console.log('\n=== RISULTATI su 240 esempi HELD-OUT (mai visti in training) ===');
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
