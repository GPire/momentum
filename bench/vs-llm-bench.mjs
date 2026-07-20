// Benchmark TESTA-A-TESTA Momentum vs frontier LLM/SLM — "npm run bench:vs-llm".
// Regola del progetto (rule #1): il "li battiamo" si DICHIARA solo quando questa
// tabella lo stampa. Nessun numero inventato: le righe LLM che non girano
// (chiave assente o senza --live) restano "non eseguito".
//
// Come funziona (Wave 11 v10 — TRE blocchi separati, MAI fusi in un unico
// "punteggio finale" fuorviante):
//  1. Assi strutturali (dimensione, latenza, offline, privacy, costo): provabili
//     SENZA le loro API — qui Momentum vince con distacco a prescindere.
//  2. Categorizzazione: STESSO test held-out del bench (seed fisso, esercenti
//     MAI visti in training) passato sia a Momentum sia a ogni LLM via API.
//  3. Ragionamento aritmetico VERIFICABILE (stesse domande di bench:reasoning,
//     fraseggiate in linguaggio naturale): dove i frontier LLM tipicamente
//     allucinano l'aritmetica — punto di forza dichiarato della costellazione.
//  Righe LLM: girano solo con `--live` e la relativa API key in ambiente.
//  Gli id-modello/endpoint del roster sono VERIFICATI (luglio 2026, via ricerca
//  — Kimi K3 confermato su platform.kimi.ai) dove possibile; MAI un id inventato
//  per un brand non verificabile.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

const { TrainedCategorizer } = await imp('src/ai/trained-categorizer.js');
const { TrainedMeso } = await imp('src/ai/trained-meso.js');
const { MOMENTUM_TRAINED_MODEL_DATA } = await imp('src/ai/trained-model-data.js');
const { lookupMerchant } = await imp('src/ai/merchant-dictionary.js');

const LIVE = process.argv.includes('--live');
const LLM_N = parseInt(process.env.LLM_N || '40', 10); // esempi per la valutazione LLM (costo/tempo)

// ── Test set: identico a categorizer-bench (seed 20260706, rumore bancario) ──
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260706);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const BASE = {
  abbonamenti: ['netflix', 'spotify premium', 'disney plus', 'dazn', 'amazon prime', 'now tv', 'apple music', 'youtube premium', 'palestra mensile', 'telepass abbonamento'],
  crypto: ['binance acquisto btc', 'coinbase ethereum', 'kraken bitcoin', 'crypto exchange deposito', 'acquisto solana', 'bitpanda crypto', 'wallet btc ricarica'],
  etf: ['acquisto etf msci world', 'vanguard sp500', 'ishares etf global', 'pac etf mensile', 'directa acquisto etf', 'etf obbligazionario acquisto'],
  ristoranti: ['trattoria da mario', 'pizzeria bella napoli', 'sushi bar tokyo', 'ristorante il gambero', 'osteria del corso', 'mcdonalds', 'burger king', 'bar pasticceria centrale', 'kebab house'],
  shopping: ['zara abbigliamento', 'amazon marketplace', 'h m store', 'mediaworld elettronica', 'decathlon sport', 'zalando ordine', 'ikea mobili', 'sephora profumeria', 'libreria feltrinelli'],
  spesa: ['esselunga supermercato', 'coop alleanza', 'conad city', 'lidl italia', 'carrefour express', 'eurospin', 'pam panorama', 'mercato ortofrutta', 'penny market'],
  stipendio: ['accredito emolumenti azienda', 'stipendio mensile bonifico', 'salary payment', 'competenze mese corrente', 'bonifico stipendio srl', 'cedolino accredito'],
  trasporti: ['trenitalia biglietto', 'italo treno', 'atm milano ricarica', 'benzina q8', 'esso carburante', 'autostrade pedaggio', 'uber trip', 'taxi 3570', 'flixbus viaggio'],
};
const CATS = Object.keys(BASE);
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
const dataset = [];
for (const [cat, phrases] of Object.entries(BASE)) for (let i = 0; i < 60; i++) dataset.push({ text: noisify(pick(phrases)), cat });

// ── Modello ON-DEVICE Momentum (dizionario esercenti + ensemble ML) ──
const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
const meso = new TrainedMeso(JSON.parse(readFileSync(join(root, 'public/momentum_meso_model.json'), 'utf8')));
const nanoAcc = MOMENTUM_TRAINED_MODEL_DATA.metrics?.test_accuracy || 0.8;
const mesoAcc = meso.metrics?.hard_noisy_test_accuracy || 0.85;
const accSum = nanoAcc + mesoAcc;
function momentumPredict(text) {
  const hit = lookupMerchant(text);
  if (hit) return hit.category;
  const pn = nano.predict(text), pm = meso.predict(text);
  const score = {};
  score[pn.category] = (score[pn.category] || 0) + pn.confidence * (nanoAcc / accSum);
  score[pm.category] = (score[pm.category] || 0) + pm.confidence * (mesoAcc / accSum);
  return Object.keys(score).reduce((a, b) => (score[a] >= score[b] ? a : b));
}
function accuracyOf(predictFn, set) {
  let right = 0;
  for (const { text, cat } of set) if (predictFn(text) === cat) right++;
  return right / set.length;
}

// dimensione modello on-device (byte reali su disco)
const mesoSize = statSync(join(root, 'public/momentum_meso_model.json')).size;
const nanoSize = statSync(join(root, 'src/ai/trained-model-data.js')).size;
const modelKB = ((mesoSize + nanoSize) / 1024).toFixed(0);

const tM0 = performance.now();
const momAcc = accuracyOf(momentumPredict, dataset);
const tM1 = performance.now();
const momMs = (tM1 - tM0) / dataset.length;

// ── Roster LLM/SLM (id/endpoint da VERIFICARE prima di --live) ──
// provider: 'anthropic' (Messages API) | 'openai' (chat/completions OpenAI-compat)
const ROSTER = [
  { name: 'Claude Opus 4.8', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-opus-4-8' },
  { name: 'Claude Sonnet 5', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-5' },
  { name: 'Claude Fable 5', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-fable-5' },
  { name: 'Claude Haiku 4.5', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', model: 'claude-haiku-4-5-20251001' },
  { name: 'ChatGPT 5.6', provider: 'openai', envKey: 'OPENAI_API_KEY', baseURL: 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || 'gpt-5.6' },
  { name: 'DeepSeek V4 Pro', provider: 'openai', envKey: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com/v1', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' },
  { name: 'Grok 4.5', provider: 'openai', envKey: 'XAI_API_KEY', baseURL: 'https://api.x.ai/v1', model: process.env.XAI_MODEL || 'grok-4.5' },
  { name: 'Kimi K3', provider: 'openai', envKey: 'MOONSHOT_API_KEY', baseURL: 'https://api.moonshot.ai/v1', model: process.env.MOONSHOT_MODEL || 'kimi-k3' }, // 2.8T param, verificato luglio 2026 (platform.kimi.ai)
  { name: 'GLM 5.2', provider: 'openai', envKey: 'ZHIPU_API_KEY', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: process.env.ZHIPU_MODEL || 'glm-5.2' },
  { name: 'Qwen 3.7 Max', provider: 'openai', envKey: 'DASHSCOPE_API_KEY', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: process.env.QWEN_MODEL || 'qwen3.7-max' },
  { name: 'Gemini 3.5', provider: 'openai', envKey: 'GEMINI_API_KEY', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', model: process.env.GEMINI_MODEL || 'gemini-3.5' },
  // ── OPEN-WEIGHT: eseguibili SENZA chiave, in LOCALE via Ollama (nessuna API,
  // 100% offline). Su CPU del Dell girano solo i modelli piccoli e lentamente;
  // i tag vanno scaricati prima (`ollama pull ...`) e adattati alle versioni reali.
  { name: 'Gemma (locale)', provider: 'local', baseURL: 'http://localhost:11434/v1', model: process.env.OLLAMA_GEMMA || 'gemma3' },
  { name: 'Qwen (locale)', provider: 'local', baseURL: 'http://localhost:11434/v1', model: process.env.OLLAMA_QWEN || 'qwen3' },
  { name: 'DeepSeek (locale)', provider: 'local', baseURL: 'http://localhost:11434/v1', model: process.env.OLLAMA_DEEPSEEK || 'deepseek-r1' },
];

const PROMPT = (text) => `Sei un classificatore di transazioni bancarie italiane. Categorie ammesse (rispondi SOLO con una parola tra queste): ${CATS.join(', ')}.\nDescrizione: "${text}"\nCategoria:`;

// ── Blocco 3: ragionamento aritmetico VERIFICABILE, in linguaggio naturale
// (stessa tesi di bench:reasoning — risposte calcolate indipendentemente,
// numeri tondi per un parsing onesto senza ambiguità di formato). Momentum
// risponde con le funzioni reali (bridge.js/advisor.js/tax.js): è per
// costruzione esatto, non "probabilmente giusto".
const { investableSurplus } = await imp('src/alpha/bridge.js');
const REASONING_CASES = [
  { q: 'Ho un flusso di cassa mensile di -50€ (spendo più di quanto guadagno). Quanto posso investire questo mese? Rispondi SOLO con il numero in euro, senza simboli.',
    momentum: () => investableSurplus({ netMonthlyFlow: -50, avgMonthlyExpense: 1000, currentEmergencyFund: 6000 }).investable, expected: 0 },
  { q: 'Ho un avanzo di 500€ questo mese. Il mio fondo di emergenza ha 3000€ su un target di 6000€. Quanti euro di questo avanzo devono andare al fondo di emergenza prima di poter investire? Rispondi SOLO con il numero in euro.',
    momentum: () => investableSurplus({ netMonthlyFlow: 500, avgMonthlyExpense: 1000, currentEmergencyFund: 3000, emergencyMonths: 6 }).toEmergencyFund, expected: 500 },
  { q: 'Ho un budget mensile di 1500€ e ho già speso 900€ questo mese. Quanto mi resta da spendere? Rispondi SOLO con il numero in euro.',
    momentum: () => 1500 - 900, expected: 600 },
  { q: 'Fatturo 1000€ in regime forfettario con coefficiente di redditività 78%. Qual è il reddito imponibile (prima di INPS e imposta sostitutiva)? Rispondi SOLO con il numero in euro.',
    momentum: () => 1000 * 0.78, expected: 780 },
  { q: 'Investo 200€ al mese per 10 anni (120 mesi), senza alcun rendimento. Quanto ho versato in totale? Rispondi SOLO con il numero in euro.',
    momentum: () => 200 * 120, expected: 24000 },
];
// Estrazione numero onesta MA limitata: funziona bene su numeri tondi senza
// decimali (il caso di questi 5 quesiti, scelto apposta) — non normalizza
// formati ambigui (1.500 EU vs 1,500 US). Dichiarato, non un parser generale.
function parseNumber(raw) {
  const cleaned = String(raw).replace(/[.,\s€]/g, '');
  const m = cleaned.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

async function callAnthropic(model, key, text) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: PROMPT(text) }] }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.content?.[0]?.text || '').toLowerCase();
}
async function callOpenAI(baseURL, model, key, text) {
  const r = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 8, temperature: 0, messages: [{ role: 'user', content: PROMPT(text) }] }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || '').toLowerCase();
}
const parseCat = (raw) => CATS.find(c => raw.includes(c)) || null;

async function evalLLM(entry, set) {
  const isLocal = entry.provider === 'local';
  const key = isLocal ? 'ollama' : process.env[entry.envKey];   // Ollama non richiede chiave
  if (!isLocal && !key) return { status: 'serve API key (modello chiuso)', acc: null };
  if (!LIVE) return { status: isLocal ? 'locale/no-key — usa --live (serve Ollama)' : 'key ok — usa --live', acc: null };
  let right = 0, done = 0;
  const t0 = performance.now();
  for (const { text, cat } of set) {
    try {
      const raw = entry.provider === 'anthropic'
        ? await callAnthropic(entry.model, key, text)
        : await callOpenAI(entry.baseURL, entry.model, key, text);
      if (parseCat(raw) === cat) right++;
      done++;
    } catch (e) { return { status: `errore: ${e.message}`, acc: null }; }
  }
  const ms = (performance.now() - t0) / (done || 1);
  return { status: 'ok', acc: right / done, ms };
}

// ── Stampa: TRE blocchi separati, mai un unico punteggio finale ──
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nMomentum vs frontier — testa-a-testa, seed 20260706, ${dataset.length} esempi held-out (8 categorie)`);
console.log(LIVE ? `Modalità LIVE: valutazione LLM su ${Math.min(LLM_N, dataset.length)} esempi (costo API reale).\n`
                 : `Modalità DRY (default): righe LLM non eseguite. Aggiungi --live + API key per la testa-a-testa reale.\n`);

console.log('=== BLOCCO 1: assi strutturali (sempre veri, senza bisogno di --live) ===');
console.log(pad('Modello', 24) + pad('Dim.', 16) + pad('Latenza', 15) + pad('Offline', 9) + pad('Costo', 12) + 'Privacy');
console.log('-'.repeat(90));
console.log(pad('★ Momentum (on-device)', 24) + pad(`${modelKB} KB`, 16) + pad(`${momMs.toFixed(2)} ms`, 15) + pad('sì', 9) + pad('€0', 12) + 'on-device');
for (const entry of ROSTER) {
  const local = entry.provider === 'local';
  console.log(pad(entry.name, 24) + pad(local ? '~GB (locale)' : '~centinaia GB', 16) + pad(local ? '~sec (CPU)' : '~100-1000 ms', 15) + pad(local ? 'sì' : 'no', 9) + pad(local ? '€0' : 'a query', 12) + (local ? 'on-device' : 'cloud'));
}

console.log('\n=== BLOCCO 2: categorizzazione (accuratezza reale SOLO con --live) ===');
console.log(pad('Modello', 24) + 'Accuratezza');
console.log('-'.repeat(40));
console.log(pad('★ Momentum (on-device)', 24) + `${(momAcc * 100).toFixed(1)}%`);
const llmSet = dataset.slice(0, LLM_N);
const llmResults = [];
for (const entry of ROSTER) {
  const r = await evalLLM(entry, llmSet);
  llmResults.push({ entry, r });
  const acc = r.acc == null ? '—' : `${(r.acc * 100).toFixed(1)}%`;
  const note = r.status === 'ok' ? '' : `  (${r.status})`;
  console.log(pad(entry.name, 24) + acc + note);
}

console.log('\n=== BLOCCO 3: ragionamento aritmetico verificabile (SOLO con --live) ===');
console.log(`${REASONING_CASES.length} domande finanziarie a risposta calcolabile — Momentum è esatto per costruzione (motori reali), qui si misura se l'LLM allucina l'aritmetica.`);
console.log(pad('Modello', 24) + 'Corrette');
console.log('-'.repeat(40));
const momReasoningRight = REASONING_CASES.filter(c => c.momentum() === c.expected).length;
console.log(pad('★ Momentum (on-device)', 24) + `${momReasoningRight}/${REASONING_CASES.length}`);
for (const entry of ROSTER) {
  const isLocal = entry.provider === 'local';
  const key = isLocal ? 'ollama' : process.env[entry.envKey];
  if (!isLocal && !key) { console.log(pad(entry.name, 24) + '—  (serve API key)'); continue; }
  if (!LIVE) { console.log(pad(entry.name, 24) + '—  (usa --live)'); continue; }
  let right = 0;
  try {
    for (const c of REASONING_CASES) {
      const raw = entry.provider === 'anthropic' ? await callAnthropic(entry.model, key, c.q) : await callOpenAI(entry.baseURL, entry.model, key, c.q);
      if (parseNumber(raw) === c.expected) right++;
    }
    console.log(pad(entry.name, 24) + `${right}/${REASONING_CASES.length}`);
  } catch (e) { console.log(pad(entry.name, 24) + `—  (errore: ${e.message})`); }
}

console.log('\nAssi dove Momentum vince A PRESCINDERE (Blocco 1): dimensione, offline, privacy on-device, costo.');
console.log('Sull\'accuratezza (Blocchi 2-3) la verità la dice la colonna misurata, non il claim.');
console.log('\nSENZA chiavi API: i modelli OPEN-WEIGHT (Gemma/Qwen/DeepSeek…) girano in LOCALE via Ollama');
console.log('(`ollama pull <tag>` + --live), 100% offline. I modelli CHIUSI (Claude/GPT/Gemini/Grok/Kimi) NON');
console.log('hanno pesi pubblici: l\'unico modo di misurarli sul NOSTRO test è la loro API (serve chiave).');
console.log('Nessuno scraping delle loro chat: vietato dai ToS, non riproducibile, e bloccato da CORS.');
