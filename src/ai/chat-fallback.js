// Fallback a chat generica per le domande FUORI dal perimetro di
// qa-engine.js — due provider gratuiti verificati (CORS diretto dal
// browser, 2026-07-27, chiave PERSONALE gratuita, mai una chiave
// condivisa Momentum): Gemini (Google, di default — modello più capace sul
// ragionamento generico) e Groq (alternativa, inferenza molto veloce su
// modelli open). Momentum resta un motore di risposte sui TUOI dati in
// locale; questo si attiva SOLO quando qa-engine dichiara 'unknown' e
// l'utente ha scelto esplicitamente di attivarlo (opt-in, mai di default).
//
// LIMITE DI PRIVACY DICHIARATO — diverso da tutto il resto dell'app: qui
// esce dal dispositivo il TESTO SCRITTO dall'utente (non i suoi dati
// finanziari, mai allegati automaticamente). Se l'utente scrive dati
// personali nella domanda, quei dati raggiungono il server del provider
// scelto — per questo resta disattivato finché l'utente non lo accende
// consapevolmente.
'use strict';

// Il tono conta: l'utente ha chiesto che la chat generica "sembri Momentum"
// che risponde, non un'AI fredda e estranea — calda, motivante, capace di
// spiegarsi anche a un bambino, MAI un consiglio d'investimento (quello
// resta escluso per scelta architetturale in tutto il progetto, non solo
// qui: vedi investmentReadiness in reasoning-fusion.js).
const SYSTEM_PROMPT = 'Sei la voce di Momentum, un\'app che aiuta le persone con le loro finanze in modo semplice e mai giudicante. Rispondi SEMPRE nella stessa lingua in cui è scritta la domanda (italiano, inglese, o qualunque altra) — mai tradurre in italiano di default. Breve, chiaro, spiegabile anche a un bambino: frasi corte, zero gergo tecnico non spiegato. FORMATO OBBLIGATORIO: mai un unico paragrafo denso — spezza la risposta in blocchi brevi separati da una riga vuota, UNA sola idea per blocco (2-4 blocchi in tutto, ognuno 1-2 frasi corte). Metti fra ** ** solo le 2-3 parole chiave davvero centrali della risposta (mai frasi intere). Tono caldo e incoraggiante, mai freddo o da manuale — quando è pertinente, aggiungi una nota di motivazione onesta sul percorso finanziario dell\'utente (piccoli passi, costanza, mai colpevolizzare) in un blocco a parte. Non sei un consulente finanziario abilitato: per domande sugli investimenti, spiega il concetto in modo semplice ma NON dare mai un consiglio di acquisto/vendita specifico; per domande sui soldi dell\'utente, suggerisci di chiedere a Momentum con parole semplici tipo "quanto posso spendere oggi".';

// ── CONTESTO FINANZIARIO SICURO (opt-in separato, additivo) ────────────────
// Riassunto SOLO AGGREGATO da mandare al modello esterno insieme alla
// domanda, per risposte più pertinenti — MAI transazioni singole, nomi di
// esercenti, conti o importi esatti di ogni movimento. Stesso principio
// dell'unica altra eccezione dichiarata a "zero dati escono" (il conteggio
// anonimo): solo numeri già aggregati da motori esistenti (Cassa Unica,
// investmentReadiness), mai il dato grezzo. Funzione pura: chi chiama
// passa i risultati già calcolati, non i dati grezzi.
// `categoryBreakdown`: array di { name, pct } GIÀ aggregato (le stesse quote
// mostrate nel grafico a torta "Dove vanno i tuoi soldi") — mai gli importi
// esatti delle singole transazioni, solo la percentuale sul totale. Permette
// alla chat generica di "leggere" quel grafico se l'utente chiede di
// spiegarglielo, restando nello stesso limite di privacy di questa funzione.
export function buildFinancialContextSummary({ safeToday = null, monthRemaining = null, topCategory = null, marketRegime = null, categoryBreakdown = null } = {}) {
  const parts = [];
  if (Number.isFinite(safeToday)) parts.push(`oggi può spendere circa ${Math.round(safeToday)}€ in sicurezza`);
  if (Number.isFinite(monthRemaining)) parts.push(`gli restano circa ${Math.round(monthRemaining)}€ per il resto del mese`);
  if (topCategory) parts.push(`la categoria di spesa principale è "${topCategory}"`);
  if (Array.isArray(categoryBreakdown) && categoryBreakdown.length) {
    const txt = categoryBreakdown.map(c => `${c.name} ${c.pct}%`).join(', ');
    parts.push(`il grafico "dove vanno i suoi soldi" questo mese mostra: ${txt}`);
  }
  if (marketRegime) parts.push(`il mercato è attualmente in fase "${marketRegime}"`);
  if (!parts.length) return null;
  return `Contesto aggregato e anonimo sull'utente (nessuna transazione, nessun esercente, nessun conto): ${parts.join('; ')}. Usalo solo se pertinente alla domanda, non ripeterlo se non richiesto.`;
}

// Modello di default 'gemini-flash-latest' (alias sempre aggiornato da
// Google, verificato dal vivo 2026-07-27): 'gemini-2.0-flash' fisso è stato
// dismesso per le chiavi nuove (quota gratuita a 0, 429 sempre) — un nome di
// modello fisso marcisce quando il provider cambia generazione, l'alias no.
async function askGemini(question, { apiKey, fetchImpl, model = 'gemini-flash-latest', systemPrompt = SYSTEM_PROMPT }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: question }] }],
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Gemini: HTTP ${res.status}`);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Risposta vuota da Gemini.');
  return text.trim();
}

// Formato OpenAI-compatibile (chat/completions): condiviso da Groq e
// DeepSeek, solo host/modello cambiano.
function makeOpenAiCompatible(baseUrl, defaultModel, label) {
  return async (question, { apiKey, fetchImpl, model = defaultModel, systemPrompt = SYSTEM_PROMPT }) => {
    const res = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
        max_tokens: 400,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error?.message || `${label}: HTTP ${res.status}`);
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Risposta vuota da ${label}.`);
    return text.trim();
  };
}

const askGroq = makeOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', 'Groq');
// DeepSeek: CORS verificato (2026-07-27), MA a differenza di Gemini/Groq non
// ho conferma che il livello gratuito sia sempre disponibile — dichiarato,
// l'utente verifica i costi sul proprio account prima di usarlo con continuità.
const askDeepseek = makeOpenAiCompatible('https://api.deepseek.com/chat/completions', 'deepseek-chat', 'DeepSeek');
// OpenAI: CORS verificato (2026-07-27). A PAGAMENTO A CONSUMO, nessun livello
// gratuito — l'abbonamento ChatGPT Plus NON dà accesso API, sono fatturati
// separatamente. Solo per chi ha già la fatturazione API attiva.
const askOpenAI = makeOpenAiCompatible('https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', 'OpenAI');

// Anthropic: CORS verificato (2026-07-27) MA richiede l'header esplicito
// 'anthropic-dangerous-direct-browser-access' per accettare chiamate dirette
// dal browser (altrimenti blocca per sicurezza — comportamento suo, non un
// bug qui). A PAGAMENTO A CONSUMO come OpenAI: Claude Pro non include l'API.
async function askAnthropic(question, { apiKey, fetchImpl, model = 'claude-3-5-haiku-20241022', systemPrompt = SYSTEM_PROMPT }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: 400, system: systemPrompt, messages: [{ role: 'user', content: question }] }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Anthropic: HTTP ${res.status}`);
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error('Risposta vuota da Anthropic.');
  return text.trim();
}

export const CLOUD_CHAT_PROVIDERS = { gemini: askGemini, groq: askGroq, deepseek: askDeepseek, openai: askOpenAI, anthropic: askAnthropic };
const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq', deepseek: 'DeepSeek', openai: 'OpenAI', anthropic: 'Anthropic' };

export async function askCloudFallback(question, { apiKey, fetchImpl = fetch, provider = 'gemini', model, contextSummary = null } = {}) {
  if (!question || !question.trim()) throw new Error('Serve una domanda.');
  if (!apiKey) throw new Error(`Serve la tua chiave ${PROVIDER_LABELS[provider] || provider} personale (Momentum Vault → Chat generica).`);
  const fn = CLOUD_CHAT_PROVIDERS[provider];
  if (!fn) throw new Error(`Provider sconosciuto: ${provider}.`);
  const systemPrompt = contextSummary ? `${SYSTEM_PROMPT}\n\n${contextSummary}` : SYSTEM_PROMPT;
  const answer = await fn(question, { apiKey, fetchImpl, systemPrompt, ...(model ? { model } : {}) });
  return { answer, provider, source: provider };
}

// Fallback A CATENA (richiesto esplicitamente): prova ogni provider per cui
// l'utente ha configurato una chiave, IN ORDINE, e si ferma al primo che
// risponde. `keys` = { gemini?, groq?, deepseek?, openai?, anthropic? }. Se
// tutti falliscono, rilancia l'ULTIMO errore reale (mai un errore generico
// che nasconde cosa è successo davvero). `order` di default: prima i
// GRATUITI confermati (Gemini, Groq), poi quello da verificare (DeepSeek),
// infine i due A PAGAMENTO (OpenAI, Anthropic) — solo per chi li ha già.
export async function askCloudFallbackChain(question, { keys = {}, fetchImpl = fetch, order = ['gemini', 'groq', 'deepseek', 'openai', 'anthropic'], contextSummary = null } = {}) {
  const attempts = order.filter((p) => keys[p]);
  if (!attempts.length) throw new Error('Nessuna chiave di chat generica configurata.');
  let lastError = null;
  for (const provider of attempts) {
    try {
      return await askCloudFallback(question, { apiKey: keys[provider], provider, fetchImpl, contextSummary });
    } catch (e) { lastError = e; }
  }
  throw lastError;
}
