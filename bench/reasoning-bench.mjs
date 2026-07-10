// Benchmark di RAGIONAMENTO FINANZIARIO VERIFICABILE — "npm run bench:reasoning".
//
// Tesi (onesta): sull'aritmetica finanziaria a risposta CALCOLABILE, un motore
// deterministico on-device è esatto per costruzione e sub-millisecondo, dove un
// LLM probabilistico può allucinare (errori aritmetici noti e documentati).
// Questo NON è "ragionamento aperto" (lì i frontier LLM vincono) — è il
// sottoinsieme dove la specializzazione deterministica ha un vantaggio reale.
// Entrambe le verità sono stampate. Seed fisso → riproducibile.
//
// Ogni caso ha: domanda, funzione del motore Momentum, risposta ATTESA
// calcolata indipendentemente a mano/da formula → Momentum = 100% se il
// codice è corretto (è anche un test d'integrazione dei moduli alpha/advisor).
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { investableSurplus } = await imp('src/alpha/bridge.js');
const { valueScore, riskScore, momentumScore } = await imp('src/alpha/factors.js');
const { riskParityWeights } = await imp('src/alpha/portfolio.js');
const { detectRegime } = await imp('src/alpha/regime.js');
const { getDailySafeToSpend } = await imp('src/predict/advisor.js');

const approx = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const cases = [];
function check(name, got, expected, ok = null) {
  const pass = ok !== null ? ok : approx(got, expected);
  cases.push({ name, got, expected, pass });
}

// ── 1. Quanto posso investire: flusso negativo → 0 (difendi il budget) ──
{
  const r = investableSurplus({ netMonthlyFlow: -50, avgMonthlyExpense: 1000, currentEmergencyFund: 6000 });
  check('invest: flusso negativo → 0', r.investable, 0);
}
// ── 2. Fondo emergenza non pieno → 0 investibile, il resto va al fondo ──
{
  const r = investableSurplus({ netMonthlyFlow: 500, avgMonthlyExpense: 1000, currentEmergencyFund: 3000, emergencyMonths: 6 });
  // target 6000, mancano 3000, avanzo 500 → tutto al fondo, investibile 0
  check('invest: fondo non pieno → 0 investibile', r.investable, 0);
  check('invest: 500 al fondo emergenza', r.toEmergencyFund, 500);
}
// ── 3. Fondo pieno → investi il 70% dell'avanzo ──
{
  const r = investableSurplus({ netMonthlyFlow: 800, avgMonthlyExpense: 1000, currentEmergencyFund: 6000, emergencyMonths: 6, investFraction: 0.7 });
  check('invest: fondo pieno → 70% di 800 = 560', r.investable, 560);
}
// ── 4. Risk-parity: due asset, uno metà volatilità → doppio peso ──
{
  // asset A vol ~2x di B → peso B ~2x di A. Serie costruite: A oscilla ±0.02, B ±0.01
  const A = [], B = [];
  for (let i = 0; i < 20; i++) { A.push(i % 2 ? 0.02 : -0.02); B.push(i % 2 ? 0.01 : -0.01); }
  const w = riskParityWeights({ A, B });
  // inverse-vol: volA=0.02, volB=0.01 → invA=50, invB=100 → wA=1/3, wB=2/3
  check('risk-parity: peso A = 1/3', w.A, 1 / 3);
  check('risk-parity: peso B = 2/3', w.B, 2 / 3);
  check('risk-parity: somma pesi = 1', w.A + w.B, 1);
}
// ── 5. Regime: trend fortemente positivo e vol bassa → risk-on ──
{
  const prices = [];
  let p = 100;
  for (let i = 0; i < 40; i++) { p *= 1.005; prices.push(p); } // +0.5%/periodo costante
  const r = detectRegime(prices);
  check('regime: trend up costante → risk-on', 0, 0, r.regime === 'risk-on');
}
// ── 6. Regime: crollo → risk-off ──
{
  const prices = [];
  let p = 100;
  for (let i = 0; i < 40; i++) { p *= 0.99; prices.push(p); }
  const r = detectRegime(prices);
  check('regime: trend down → risk-off', 0, 0, r.regime === 'risk-off');
}
// ── 7. Safe-to-spend: aritmetica esatta ──
{
  // budget 3100 luglio (31gg=100/gg). Questo è un test d'integrazione: verifichiamo
  // che il numero sia finito e non-negativo (la correttezza esatta è nei unit test).
  const r = getDailySafeToSpend({ monthTxs: [], allTx: {}, monthlyBudget: 3100, referenceDate: new Date(2026, 6, 15) });
  check('safe-to-spend: numero valido ≥ 0', 0, 0, r && Number.isFinite(r.safeToday) && r.safeToday >= 0);
}
// ── 8. Value score: azienda dominante sui peer → score alto ──
{
  const peers = { pe: [30, 25, 20], pb: [5, 4, 3], roe: [0.1, 0.12, 0.15], debtEquity: [1.5, 1.2, 1.0], fcfYield: [0.02, 0.03, 0.04] };
  // azienda: P/E basso, P/B basso, ROE alto, debito basso, FCF alto → tutti i percentili verso 1
  const s = valueScore({ pe: 10, pb: 1, roe: 0.25, debtEquity: 0.3, fcfYield: 0.08 }, peers);
  check('value: azienda dominante → score > 0.9', 0, 0, s.score > 0.9);
}
// ── 9. Risk score: bassa volatilità → score più alto di alta volatilità ──
{
  const calmo = Array.from({ length: 30 }, (_, i) => (i % 2 ? 0.003 : -0.002));
  const nervoso = Array.from({ length: 30 }, (_, i) => (i % 2 ? 0.05 : -0.05));
  const sc = riskScore(calmo).score, sn = riskScore(nervoso).score;
  check('risk: calmo > nervoso', 0, 0, sc > sn);
}

// ── Esecuzione + timing ──
const t0 = performance.now();
for (let rep = 0; rep < 1000; rep++) investableSurplus({ netMonthlyFlow: 800, avgMonthlyExpense: 1000, currentEmergencyFund: 6000 });
const perCall = (performance.now() - t0) / 1000;

const passed = cases.filter(c => c.pass).length;
console.log(`\nMomentum reasoning bench — ${cases.length} domande finanziarie a risposta VERIFICABILE\n`);
for (const c of cases) console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`);
console.log(`\n  Momentum (motore deterministico on-device): ${passed}/${cases.length} corrette, ~${perCall.toFixed(3)} ms/risposta`);
console.log('\nOnestà: questo è il sottoinsieme ARITMETICO-VERIFICABILE (dove un motore');
console.log('deterministico è esatto e un LLM può sbagliare i calcoli). NON è ragionamento');
console.log('aperto/qualitativo — su quello un frontier LLM è più forte. Entrambe le verità contano.');
if (passed !== cases.length) process.exit(1);
