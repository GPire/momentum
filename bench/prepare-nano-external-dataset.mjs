// Prepara bench/data/external-nano-us-transactions.json — "npm run prepare:nano-data".
// bench/data/ è gitignored (vedi .gitignore, stessa convenzione già in uso
// per banking77/clinc150/hwu64 — bench/public-bench.mjs): questo script
// RIGENERA il file localmente, non lo scarica da git.
//
// Fonte: DoDataThings/us-bank-transaction-categories-v2 su Hugging Face
// (https://huggingface.co/datasets/DoDataThings/us-bank-transaction-categories-v2)
// — licenza MIT, NON gated (verificato via API pubblica prima di usarlo),
// 68.000 descrizioni bancarie SINTETICHE ma "modellate sul formato reale
// degli estratti conto USA" (dichiarazione della dataset card stessa), 17
// categorie, 4.000 esempi ciascuna.
//
// Perché questa fonte e non altre: Kaggle richiede credenziali API che
// questa macchina non ha configurate (bloccante, non aggirato); un secondo
// dataset Hugging Face più grande (mitulshah/transaction-categorization,
// 4,5M righe) è "gated" — richiede login HF, stesso tipo di blocco; un
// dataset su GitHub (Wells Fargo Campus Analytics Challenge, via
// utribedi/Bank_transaction_category_predictor) non dichiara una licenza
// di riuso chiara — scartato per prudenza, non per pigrizia.
//
// Mappatura sulle 15 categorie Momentum (src/core/constants.js): 3 delle
// 17 categorie originali (Insurance, Fees, Transfer) NON hanno un
// corrispondente onesto in Momentum — escluse, mai forzate su una
// categoria sbagliata solo per usare tutta la riga. etf/crypto/risparmio
// restano scoperte da questa fonte (è un dataset di SPESA, non di
// investimento) — coperte solo dal pool sintetico proprio (data-gen.mjs).
'use strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARQUET_URL = 'https://huggingface.co/api/datasets/DoDataThings/us-bank-transaction-categories-v2/parquet/default/train/0.parquet';

const MAP = {
  Mortgage: 'casa', Rent: 'casa',
  Entertainment: 'svago',
  Utilities: 'bollette',
  Groceries: 'spesa',
  'Personal Care': 'shopping', Shopping: 'shopping',
  Subscription: 'abbonamenti',
  Healthcare: 'salute',
  Income: 'stipendio',
  Transportation: 'trasporti',
  Education: 'istruzione',
  Restaurants: 'ristoranti',
  Travel: 'viaggi',
  // Recuperate il 2026-08-30 (Fase 1): prima escluse per mancanza di una
  // categoria Momentum corrispondente onesta — ora esiste (vedi SUBCAT in
  // src/ai/train/data-gen.mjs), quindi questi 12.000 esempi reali tornano
  // utili invece di essere scartati.
  Insurance: 'assicurazioni',
  Fees: 'commissioni',
  Transfer: 'trasferimenti',
};

console.log('Scarico il parquet da Hugging Face (MIT, non gated)...');
const res = await fetch(PARQUET_URL);
if (!res.ok) throw new Error(`Download fallito: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const tmpParquet = join(root, 'bench/data/.dodatathings-tmp.parquet');
writeFileSync(tmpParquet, buf);
console.log(`Scaricato: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

// Lettura del parquet: nessuna dipendenza npm per il parsing in questo repo,
// quindi si delega a un one-liner Python (pyarrow) — SOLO in questo script
// di preparazione dati, mai in produzione o nei test (che restano JS puro).
console.log('Leggo e mappo le righe (richiede: pip install pyarrow)...');
const { execFileSync } = await import('node:child_process');
const py = `
import pyarrow.parquet as pq, json, random
t = pq.read_table(${JSON.stringify(tmpParquet)})
descs = t.column('description').to_pylist()
cats = t.column('category').to_pylist()
MAP = ${JSON.stringify(MAP)}
rows = []
for d, c in zip(descs, cats):
    mc = MAP.get(c)
    if mc:
        text = d.replace('[debit]', '').replace('[credit]', '').strip()
        rows.append({'text': text, 'cat': mc})
random.Random(42).shuffle(rows)
print(json.dumps(rows, ensure_ascii=False))
`;
const jsonOut = execFileSync('python3', ['-c', py], { maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const rows = JSON.parse(jsonOut);

const outPath = join(root, 'bench/data/external-nano-us-transactions.json');
writeFileSync(outPath, JSON.stringify(rows));
const { unlinkSync } = await import('node:fs');
unlinkSync(tmpParquet);

const byCat = {};
for (const r of rows) byCat[r.cat] = (byCat[r.cat] || 0) + 1;
console.log(`\nSalvato: ${outPath} (${rows.length} righe, ${(JSON.stringify(rows).length / 1024 / 1024).toFixed(1)} MB)`);
console.log('Per categoria Momentum:', byCat);
