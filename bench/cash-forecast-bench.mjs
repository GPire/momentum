// Benchmark della CASSA UNICA — "node bench/cash-forecast-bench.mjs".
//
// LA DOMANDA, onesta: fondere eventi certi (stipendio, impegni, abbonamenti) con
// il ritmo di spesa misurato per giorno della settimana prevede il denaro dei
// prossimi 14 giorni MEGLIO delle due baseline che userebbe chiunque?
//   (a) RUN-RATE: media giornaliera degli ultimi 30 giorni × orizzonte;
//   (b) MESE SCORSO: quello che è successo nello stesso periodo del mese prima.
// E la BANDA prudente/fortunato è calibrata (l'80% dei casi ci cade dentro) o è
// un ornamento?
//
// ⚠️ ONESTÀ SUI DATI (regola n.2 del progetto): questo bench gira su famiglie
// SINTETICHE generate con seed fisso — NON su dati bancari reali, che non
// possiedo. Misura quindi la qualità RELATIVA dei modelli su un processo noto,
// non l'accuratezza assoluta sul mondo. Il generatore NON conosce il modello:
// mette stipendio, rate, abbonamenti, un ritmo settimanale, rumore forte e
// shock rari. Con un export reale: `node bench/cash-forecast-bench.mjs --vault
// percorso.json` (transazioni + impegni + stipendio) per un backtest vero.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { cashForecast } = await imp('src/predict/cash-forecast.js');

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const mk = (ms) => iso(ms).slice(0, 7);
const r2 = (n) => Math.round(n * 100) / 100;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── generatore di famiglie sintetiche ───────────────────────────────────────
// Il processo VERO (che il modello non conosce): ritmo settimanale + rumore
// log-normale + shock rari + rate/abbonamenti a giorno fisso + stipendio.
function makeHousehold(seed) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const salary = { dayOfMonth: pick([25, 26, 27, 1]), amount: r2(1200 + rnd() * 1600) };
  const commitments = [
    { id: 'c1', name: 'Affitto', merchant: 'Affitto', amount: r2(400 + rnd() * 400), dayOfMonth: pick([1, 2, 5]), kind: 'affitto' },
  ];
  if (rnd() < 0.5) commitments.push({ id: 'c2', name: 'Prestito auto', merchant: 'Prestito', amount: r2(120 + rnd() * 200),
    dayOfMonth: pick([8, 10, 15]), kind: 'prestito', startDate: '2025-01-10', termMonths: 48 });
  if (rnd() < 0.7) commitments.push({ id: 'c3', name: 'Luce', merchant: 'Enel', amount: r2(50 + rnd() * 60),
    dayOfMonth: pick([12, 18]), kind: 'bolletta', variable: true });
  const subs = [
    { name: 'Streaming', amount: r2(8 + rnd() * 8), dayOfMonth: pick([3, 14, 21]) },
    { name: 'Palestra', amount: r2(25 + rnd() * 25), dayOfMonth: pick([6, 20]) },
  ].filter(() => rnd() < 0.8);
  // ritmo settimanale reale: weekend più caro
  const base = 8 + rnd() * 22;
  const dow = [1.0, 0.7, 0.7, 0.8, 0.9, 1.4, 1.8].map(f => f * (0.85 + rnd() * 0.3));
  return { rnd, salary, commitments, subs, base, dow };
}

// Genera i movimenti reali di `days` giorni terminando a `endMs`.
function generateTx(h, startMs, days) {
  const { rnd, salary, commitments, subs, base, dow } = h;
  const allTx = {};
  const push = (t, tx) => { (allTx[mk(t)] ||= []).push(tx); };
  for (let i = 0; i < days; i++) {
    const t = startMs + i * DAY;
    const d = new Date(t);
    const dom = d.getUTCDate();
    // spesa libera: rumore log-normale attorno al ritmo del giorno + shock raro
    const lam = base * dow[d.getUTCDay()];
    let spend = lam * Math.exp((rnd() + rnd() + rnd() - 1.5) * 0.9);
    if (rnd() < 0.03) spend += 60 + rnd() * 240;   // shock (bar/regalo/riparazione)
    if (rnd() < 0.25) spend = 0;                   // giorni senza spese
    if (spend > 0) push(t, { type: 'uscita', amount: r2(spend), date: iso(t), description: 'spesa', category: 'varie' });
    for (const c of commitments) {
      if (dom !== c.dayOfMonth) continue;
      const amt = c.variable ? c.amount * (0.6 + rnd() * 1.6) : c.amount;   // bolletta molto variabile
      push(t, { type: 'uscita', amount: r2(amt), date: iso(t), description: c.merchant, category: 'casa' });
    }
    for (const s of subs) {
      if (dom === s.dayOfMonth) push(t, { type: 'uscita', amount: s.amount, date: iso(t), description: s.name, category: 'abbonamenti' });
    }
    if (dom === salary.dayOfMonth) {
      push(t, { type: 'entrata', amount: r2(salary.amount * (0.97 + rnd() * 0.06)), date: iso(t), description: 'Stipendio ACME', category: 'stipendio' });
    }
  }
  return allTx;
}

// Netto realizzato (entrate − uscite) in una finestra.
function realizedNet(allTx, fromMs, toMs) {
  let net = 0;
  for (const txs of Object.values(allTx)) {
    for (const t of txs) {
      const ms = Date.parse(t.date);
      if (ms < fromMs || ms > toMs) continue;
      net += (t.type === 'entrata' ? 1 : -1) * Math.abs(+t.amount || 0);
    }
  }
  return r2(net);
}

// Solo i mesi fino a `cutoff` (nessuna fuga di informazione dal futuro).
function sliceUntil(allTx, cutoffMs) {
  const out = {};
  for (const [k, txs] of Object.entries(allTx)) {
    const kept = txs.filter(t => Date.parse(t.date) <= cutoffMs);
    if (kept.length) out[k] = kept;
  }
  return out;
}

// ── baseline ────────────────────────────────────────────────────────────────
// (a) run-rate: media netta giornaliera degli ultimi 30 giorni × orizzonte.
function runRate(history, nowMs, horizon) {
  const net = realizedNet(history, nowMs - 30 * DAY, nowMs);
  return r2((net / 30) * horizon);
}
// (b) mese scorso: lo stesso periodo, 30 giorni prima.
function lastMonth(history, nowMs, horizon) {
  return realizedNet(history, nowMs - 30 * DAY, nowMs - 30 * DAY + horizon * DAY);
}

// ── esperimento walk-forward ────────────────────────────────────────────────
const args = process.argv.slice(2);
const vaultArg = args.indexOf('--vault');
const HORIZON = 14;
const HOUSEHOLDS = 120;
const HISTORY_DAYS = 150;

let cases = [];
if (vaultArg >= 0) {
  // Backtest su un export reale: { transactions, fixedCommitments, salaryProfile }
  const v = JSON.parse(readFileSync(args[vaultArg + 1], 'utf8'));
  const allTx = v.transactions || v.state?.transactions || {};
  const commitments = v.fixedCommitments || v.state?.fixedCommitments || [];
  const salary = v.salaryProfile || v.state?.salaryProfile || null;
  const stamps = Object.values(allTx).flat().map(t => Date.parse(t.date)).filter(Number.isFinite);
  const first = Math.min(...stamps), last = Math.max(...stamps);
  for (let now = first + 60 * DAY; now + HORIZON * DAY <= last; now += 7 * DAY) {
    cases.push({ allTx, commitments, salary, now });
  }
  console.log(`Dati REALI da ${args[vaultArg + 1]} — ${cases.length} punti di valutazione\n`);
} else {
  for (let s = 1; s <= HOUSEHOLDS; s++) {
    const h = makeHousehold(s * 7919);
    const start = Date.UTC(2025, 0, 1);
    const allTx = generateTx(h, start, HISTORY_DAYS + HORIZON);
    // 3 punti di valutazione per famiglia, in fasi diverse del mese
    for (const offset of [95, 112, 130]) {
      cases.push({ allTx, commitments: h.commitments, salary: h.salary, now: start + offset * DAY });
    }
  }
  console.log(`⚠️  Dati SINTETICI (seed fisso, ${HOUSEHOLDS} famiglie, ${cases.length} punti) — non dati bancari reali.\n`);
}

const errs = { momentum: [], runrate: [], lastmonth: [] };
let inBand = 0, banded = 0, silent = 0;
const signed = [], widths = [];

for (const c of cases) {
  const history = sliceUntil(c.allTx, c.now);
  const actual = realizedNet(c.allTx, c.now + DAY, c.now + HORIZON * DAY);

  const f = cashForecast({
    allTx: history, commitments: c.commitments, salary: c.salary,
    startBalance: 0, monthTx: history[mk(c.now)] || [], now: c.now, horizonDays: HORIZON,
  });
  if (!f.known) { silent++; continue; }

  errs.momentum.push(Math.abs(f.end.p50 - actual));
  errs.runrate.push(Math.abs(runRate(history, c.now, HORIZON) - actual));
  errs.lastmonth.push(Math.abs(lastMonth(history, c.now, HORIZON) - actual));
  banded++;
  signed.push(f.end.p50 - actual);
  widths.push(f.end.p90 - f.end.p10);
  if (actual >= f.end.p10 && actual <= f.end.p90) inBand++;
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
// t appaiato (stesso test usato negli altri bench del progetto): il confronto è
// sugli STESSI punti, quindi la varianza tra famiglie non deve inquinare il test.
function pairedT(a, b) {
  const d = a.map((v, i) => v - b[i]);
  const m = mean(d);
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / (d.length - 1));
  return { diff: m, t: m / (sd / Math.sqrt(d.length)) };
}

console.log(`Punti valutati: ${errs.momentum.length}   (motore in silenzio: ${silent})`);
console.log(`Orizzonte: ${HORIZON} giorni · metrica: errore assoluto sul netto di cassa (€)\n`);
const row = (name, a) => console.log(`  ${name.padEnd(22)} MAE ${mean(a).toFixed(2).padStart(8)} €   mediana ${med(a).toFixed(2).padStart(8)} €`);
row('MOMENTUM (cassa unica)', errs.momentum);
row('baseline run-rate 30g', errs.runrate);
row('baseline mese scorso', errs.lastmonth);

for (const [name, base] of [['run-rate', errs.runrate], ['mese scorso', errs.lastmonth]]) {
  const { diff, t } = pairedT(base, errs.momentum);
  const verdict = Math.abs(t) < 2 ? 'PAREGGIO (non significativo)' : diff > 0 ? 'MOMENTUM MEGLIO' : 'MOMENTUM PEGGIO';
  console.log(`\n  vs ${name}: Δ MAE ${diff >= 0 ? '−' : '+'}${Math.abs(diff).toFixed(2)} € a favore di ${diff >= 0 ? 'Momentum' : 'baseline'}   (t appaiato = ${t.toFixed(2)}) → ${verdict}`);
  console.log(`     miglioramento relativo: ${((diff / mean(base)) * 100).toFixed(1)}%`);
}

if (process.env.DIAG) {
  const mn = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sdv = (a) => { const m = mn(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
  console.log(`\n  [diag] bias medio ${mn(signed).toFixed(2)} €, sd errore ${sdv(signed).toFixed(2)} €, ampiezza banda media ${mn(widths).toFixed(2)} € (attesa ≈ ${(2 * 1.2816 * sdv(signed)).toFixed(2)})`);
}
const cal = banded ? (inBand / banded) * 100 : 0;
console.log(`\n  CALIBRAZIONE della banda p10–p90: ${cal.toFixed(1)}% dei casi dentro (atteso ~80%).`);
console.log(cal >= 70 && cal <= 92
  ? '     → la banda dice il vero: è un intervallo, non un ornamento.'
  : cal < 70 ? '     → banda TROPPO STRETTA: promette più precisione di quanta ne abbia.'
    : '     → banda troppo larga: onesta ma poco informativa.');
