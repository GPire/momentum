// BENCHMARK PUBBLICO — Banking77 (PolyAI, 77 intent bancari). "npm run bench:public".
// Scopo ONESTO: dimostrare che il nostro trainer LOCALE in JS (HashedLogReg,
// nessun Python/server) è competitivo su un dataset STANDARD e riconosciuto,
// addestrando sul train e valutando sul test ufficiale. NON confondiamo questo
// con la categorizzazione di spesa di Momentum (label diverse) — è una prova
// di qualità dell'ARCHITETTURA del modello riaddestrabile in locale.
//
// Numeri pubblicati (fonti citate, mai inventati): su Banking77 i modelli
// fine-tuned di grande dimensione (BERT/RoBERTa) stanno ~93-94%; USE+ConveRT
// (PolyAI, il paper originale) ~85-93%; baseline semplici (BoW/SVM) ~80-85%.
// Un modello LINEARE su feature hashing, che si addestra in SECONDI on-device,
// gioca in quest'ultima fascia — il valore è: locale, minuscolo, istantaneo.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { trainHashedLogReg, HashedLogReg } = await imp('src/ai/hashed-logreg.js');

const TRAIN = join(root, 'bench/data/banking77_train.csv');
const TEST = join(root, 'bench/data/banking77_test.csv');
if (!existsSync(TRAIN) || !existsSync(TEST)) {
  console.log('Dataset Banking77 non trovato in bench/data/. Scaricalo con:');
  console.log('  curl -sSL https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/master/banking_data/train.csv -o bench/data/banking77_train.csv');
  console.log('  curl -sSL https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/master/banking_data/test.csv  -o bench/data/banking77_test.csv');
  process.exit(0);
}

// La categoria è l'ULTIMO campo (snake_case, senza virgole); il testo può avere
// virgole → split sull'ultima virgola. Salta l'header.
function load(path) {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]; const c = l.lastIndexOf(',');
    if (c < 0) continue;
    out.push([l.slice(0, c).replace(/^"|"$/g, ''), l.slice(c + 1).trim()]);
  }
  return out;
}

const DIM = Number(process.env.DIM || 32768);
const EPOCHS = Number(process.env.EPOCHS || 25);

// Addestra il HashedLogReg in locale sul train e valuta sul test ufficiale.
function runBenchmark(name, train, test, references) {
  const classes = [...new Set(train.map(r => r[1]))];
  console.log(`\n=== ${name} — ${train.length} train, ${test.length} test, ${classes.length} intent ===`);
  const t0 = Date.now();
  const model = trainHashedLogReg(train, { dim: DIM, epochs: EPOCHS, lr: 0.5, l2: 1e-6, seed: 1, useIdf: process.env.IDF !== '0' });
  const trainMs = Date.now() - t0;
  const clf = new HashedLogReg(model);
  let correct = 0; const t1 = Date.now();
  for (const [text, cat] of test) if (clf.predict(text).category === cat) correct++;
  const inferMs = (Date.now() - t1) / test.length;
  console.log(`  HashedLogReg (locale, JS)   ${(correct / test.length * 100).toFixed(1)}%   (train ${(trainMs / 1000).toFixed(1)}s, ${inferMs.toFixed(3)} ms/pred)`);
  for (const r of references) console.log(`    ${r}`);
}

runBenchmark('Banking77 (PolyAI)', load(TRAIN), load(TEST), [
  'rif. pubblicati: BERT/RoBERTa fine-tuned ~93-94% (grande, cloud, GPU); USE+ConveRT ~85-93%; BoW/SVM ~80-85%',
]);

// CLINC150 (clinc/oos-eval): 150 intent, più ampio. Formato JSON {train,test:[[testo,intent]]}.
const CLINC = join(root, 'bench/data/clinc150.json');
if (existsSync(CLINC)) {
  const j = JSON.parse(readFileSync(CLINC, 'utf8'));
  runBenchmark('CLINC150 (in-scope)', j.train, j.test, [
    'rif. pubblicati: BERT ~96%; USE ~95%; il set è più ampio (150 classi)',
  ]);
}

// HWU64 (NLU benchmark, 64 intent): TSV "testo\tlabel".
const HWU_TR = join(root, 'bench/data/hwu64_train.tsv'), HWU_TE = join(root, 'bench/data/hwu64_test.tsv');
if (existsSync(HWU_TR) && existsSync(HWU_TE)) {
  const loadTsv = (p) => readFileSync(p, 'utf8').trim().split(/\r?\n/).map(l => { const i = l.lastIndexOf('\t'); return [l.slice(0, i), l.slice(i + 1).trim()]; });
  runBenchmark('HWU64 (NLU)', loadTsv(HWU_TR), loadTsv(HWU_TE), ['rif. pubblicati: BERT ~92%; USE+ConveRT ~90-91%']);
}

console.log(`\nOnestà: un modello LINEARE che si addestra in ~1 minuto ON-DEVICE (no Python/GPU/cloud)`);
console.log(`non batte un BERT fine-tuned; il valore è locale+minuscolo+istantaneo+privato. Numeri = questo script.`);
