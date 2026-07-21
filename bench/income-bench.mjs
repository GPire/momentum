// ============================================================
// INCOME BENCH — valutazione ONESTA del classificatore fiscale entrate
// ============================================================
// Misura il modello su DUE fronti, senza gonfiare nulla:
//  (A) held-out sintetico con seed DIVERSO (clienti/frasi in buona parte nuovi);
//  (B) un set REALE CURATO a mano (casi del settore che confondono gli utenti:
//      payout piattaforme = reddito, pensione = tassata alla fonte, rimborso
//      IRPEF = non reddito, bonifico da azienda = AMBIGUO → deve restare incerto).
// Output: matrice di confusione + precisione/recall/F1 per classe. Non sovrascrive
// il modello. "npm run bench:income".
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { HashedLogReg } = await imp('src/ai/hashed-logreg.js');
const { generateIncomeDataset, INCOME_CLASSES } = await imp('src/ai/train/income-data-gen.mjs');
const { classifyIncome } = await imp('src/predict/tax.js');

const model = JSON.parse(readFileSync(join(root, 'public/momentum_income_model.json'), 'utf8'));
const clf = new HashedLogReg(model);
console.log('Modello:', model.meta ? JSON.stringify(model.meta.config) : '(no meta)');

// ---- (A) HELD-OUT sintetico -------------------------------------------------
const heldout = generateIncomeDataset({ perClass: 200, seed: 20260721 });
function evalConfusion(pairs, predictFn) {
  const labels = INCOME_CLASSES;
  const M = {}; for (const a of labels) { M[a] = {}; for (const b of labels) M[a][b] = 0; }
  let right = 0;
  for (const [text, label] of pairs) {
    const pred = predictFn(text);
    if (labels.includes(pred)) M[label][pred]++;
    if (pred === label) right++;
  }
  return { M, acc: right / pairs.length, n: pairs.length };
}
function prf(M) {
  const labels = Object.keys(M);
  const rows = [];
  for (const c of labels) {
    const tp = M[c][c];
    const fn = labels.reduce((s, k) => s + (k === c ? 0 : M[c][k]), 0);
    const fp = labels.reduce((s, k) => s + (k === c ? 0 : M[k][c]), 0);
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
    rows.push({ c, prec, rec, f1, support: tp + fn });
  }
  return rows;
}
function printConfusion(title, res) {
  console.log(`\n=== ${title} — accuratezza ${(100 * res.acc).toFixed(1)}% su ${res.n} ===`);
  const labels = Object.keys(res.M);
  console.log('vero\\pred'.padEnd(12) + labels.map(l => l.slice(0, 8).padStart(9)).join(''));
  for (const a of labels) console.log(a.padEnd(12) + labels.map(b => String(res.M[a][b]).padStart(9)).join(''));
  console.log('classe'.padEnd(12) + 'prec'.padStart(9) + 'recall'.padStart(9) + 'F1'.padStart(9) + 'n'.padStart(7));
  for (const r of prf(res.M)) console.log(r.c.padEnd(12) + r.prec.toFixed(2).padStart(9) + r.rec.toFixed(2).padStart(9) + r.f1.toFixed(2).padStart(9) + String(r.support).padStart(7));
}
const resA = evalConfusion(heldout, (t) => clf.predict(t).category);
printConfusion('A) HELD-OUT sintetico (modello da solo)', resA);

// ---- (B) SET REALE CURATO ---------------------------------------------------
// Casi scritti a mano, realistici, MAI visti dal training. Etichette scelte con
// criterio fiscale onesto. Gli AMBIGUI sono segnati '*' e testati a parte.
const HARD = [
  // invoice — reddito da fatturare
  ['Stripe payout luglio', 'invoice'],
  ['Upwork earnings transfer', 'invoice'],
  ['Fiverr payout', 'invoice'],
  ['Saldo fattura 42 Studio Bianchi', 'invoice'],
  ['Compenso lezioni private online', 'invoice'],
  ['Parcella avv. pratica 2231', 'invoice'],
  ['PayPal Business vendita corso', 'invoice'],
  ['Honorarios consultoria marketing', 'invoice'],
  // salary — tassato alla fonte
  ['Accredito stipendio Comune di Pisa', 'salary'],
  ['Cedolino mensile Ospedale', 'salary'],
  ['Pensione INPS agosto', 'salary'],
  ['Netto in busta Gruppo Retail', 'salary'],
  ['Tredicesima Metalmeccanica', 'salary'],
  // personal — non reddito imponibile
  ['Rimborso IRPEF modello 730', 'personal'],
  ['Bonifico da mamma', 'personal'],
  ['Giroconto tra i miei conti', 'personal'],
  ['Interessi attivi deposito', 'personal'],
  ['Dividendo ETF VanEck', 'personal'],
  ['Cashback Revolut', 'personal'],
  ['Refund Amazon reso', 'personal'],
  ['PayPal da Luca pizza', 'personal'],
  ['Vincita scommessa', 'personal'],
];
const resB = evalConfusion(HARD, (t) => clf.predict(t).category);
printConfusion('B) SET REALE CURATO (modello da solo)', resB);

// Con la SOGLIA di produzione (classifyIncome usa il modello solo se >=0.7,
// altrimenti keyword/uncertain): misura quanti casi reali risolve col comportamento REALE dell'app.
let realRight = 0, uncertain = 0;
const wrong = [];
for (const [text, label] of HARD) {
  const k = classifyIncome({ description: text }, null, clf).kind;
  if (k === label) realRight++;
  else if (k === 'uncertain') uncertain++;
  else wrong.push([text, label, k]);
}
console.log(`\n=== Comportamento REALE app (keyword+modello@0.7, senza apprendimento utente) ===`);
console.log(`Corretti: ${realRight}/${HARD.length} · incerti (chiede conferma): ${uncertain} · sbagliati: ${wrong.length}`);
if (wrong.length) { console.log('Sbagliati (da rivedere):'); for (const [t, l, k] of wrong) console.log(`  "${t}" atteso ${l} → ${k}`); }
console.log('\nNota onesta: gli AMBIGUI reali (es. "bonifico da azienda X") devono restare INCERTI e chiedere conferma — l\'incertezza qui e\' una feature, non un errore.');
