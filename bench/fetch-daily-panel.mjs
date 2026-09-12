// Rigenera il pannello breve usato dalle analisi quotidiane.
// I prezzi sono letti in fase di sviluppo: l'app pubblicata non interroga Yahoo.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DA = '2021-08-01';
const SERIE = {
  azioniUsa: ['SPY', 'Azioni USA (S&P 500)'],
  tecnologia: ['QQQ', 'Tecnologia (Nasdaq 100)'],
  energia: ['XLE', 'Energia'],
  beniPrimari: ['XLP', 'Beni di prima necessita'],
  finanza: ['XLF', 'Finanza'],
  oro: ['GLD', 'Oro'],
  titoliStato: ['TLT', 'Titoli di Stato USA lunghi'],
  dollaro: ['UUP', 'Dollaro'],
  bitcoin: ['BTC-USD', 'Bitcoin'],
  ethereum: ['ETH-USD', 'Ethereum'],
  vix: ['^VIX', 'Indice della paura (VIX)'],
};

async function scarica(simbolo) {
  const p1 = Math.floor(new Date(DA).getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?period1=${p1}&period2=${p2}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${simbolo}: HTTP ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r) throw new Error(`${simbolo}: risposta senza serie`);
  const close = r.indicators?.quote?.[0]?.close || [];
  return new Map(r.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i]])
    .filter(([, valore]) => Number.isFinite(valore) && valore > 0));
}

const round = (n) => Math.round(n * 1e8) / 1e8;
const fmt = (values) => values.map((n) => String(round(n))).join(', ');

const dati = {};
for (const [chiave, [simbolo]] of Object.entries(SERIE)) {
  dati[chiave] = await scarica(simbolo);
  console.log(`${chiave}: ${dati[chiave].size} osservazioni`);
}

// Il calendario comune impedisce confronti fra giorni diversi. Le crypto hanno
// anche weekend, ma qui restano solo i giorni in cui tutti i mercati quotavano.
const date = [...dati.azioniUsa.keys()].filter((d) => Object.values(dati).every((m) => m.has(d)));
if (date.length < 200) throw new Error(`calendario comune troppo corto: ${date.length}`);

const valori = {};
for (const chiave of Object.keys(SERIE)) {
  const prezzi = date.map((d) => dati[chiave].get(d));
  valori[chiave] = chiave === 'vix'
    ? prezzi.map(round)
    : prezzi.map((p, i) => round(i ? p / prezzi[i - 1] - 1 : 0));
}

const nomi = Object.fromEntries(Object.entries(SERIE).map(([k, [, nome]]) => [k, nome]));
const righe = Object.entries(valori).map(([k, v]) => `  ${k}: [${fmt(v)}],`).join('\n');
const out = `// GENERATO da bench/fetch-daily-panel.mjs — non modificare a mano.\n// Pannello di prezzi giornalieri Yahoo Finance su calendario comune.\n'use strict';\n\nexport const GIORNI_DA = '${date[0]}';\nexport const GIORNI_A = '${date.at(-1)}';\nexport const N_GIORNI = ${date.length};\nexport const GIORNI_FONTE = 'Yahoo Finance (SPY, QQQ, XLE, XLP, XLF, GLD, TLT, UUP, BTC-USD, ETH-USD, ^VIX)';\n\nexport const NOMI_GIORNALIERI = ${JSON.stringify(nomi, null, 2)};\n\nexport const DATE_GIORNI = ${JSON.stringify(date)};\n\nexport const GIORNALIERO = {\n${righe}\n};\n`;
writeFileSync(join(root, 'src/alpha/daily-panel.js'), out);
console.log(`Aggiornato daily-panel: ${date.length} giorni fino al ${date.at(-1)}`);
