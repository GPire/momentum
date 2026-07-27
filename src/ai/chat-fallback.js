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

const SYSTEM_PROMPT = 'Rispondi SEMPRE nella stessa lingua in cui è scritta la domanda dell\'utente (italiano, inglese, o qualunque altra lingua) — mai tradurre in italiano di default. Breve e chiaro. Non sei un consulente finanziario: per domande sui soldi dell\'utente, suggerisci di chiedere a Momentum con parole semplici tipo "quanto posso spendere oggi".';

async function askGemini(question, { apiKey, fetchImpl, model = 'gemini-2.0-flash' }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
  return async (question, { apiKey, fetchImpl, model = defaultModel }) => {
    const res = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: question }],
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

export const CLOUD_CHAT_PROVIDERS = { gemini: askGemini, groq: askGroq, deepseek: askDeepseek };
const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq', deepseek: 'DeepSeek' };

export async function askCloudFallback(question, { apiKey, fetchImpl = fetch, provider = 'gemini', model } = {}) {
  if (!question || !question.trim()) throw new Error('Serve una domanda.');
  if (!apiKey) throw new Error(`Serve la tua chiave ${PROVIDER_LABELS[provider] || provider} personale (Momentum Vault → Chat generica).`);
  const fn = CLOUD_CHAT_PROVIDERS[provider];
  if (!fn) throw new Error(`Provider sconosciuto: ${provider}.`);
  const answer = await fn(question, { apiKey, fetchImpl, ...(model ? { model } : {}) });
  return { answer, provider, source: provider };
}

// Fallback A CATENA (richiesto esplicitamente): prova ogni provider per cui
// l'utente ha configurato una chiave, IN ORDINE, e si ferma al primo che
// risponde. `keys` = { gemini?, groq?, deepseek? }. Se tutti falliscono,
// rilancia l'ULTIMO errore reale (mai un errore generico che nasconde cosa
// è successo davvero). `order` di default privilegia i provider con
// livello gratuito CONFERMATO (Gemini, Groq) su quello da verificare (DeepSeek).
export async function askCloudFallbackChain(question, { keys = {}, fetchImpl = fetch, order = ['gemini', 'groq', 'deepseek'] } = {}) {
  const attempts = order.filter((p) => keys[p]);
  if (!attempts.length) throw new Error('Nessuna chiave di chat generica configurata (Gemini/Groq/DeepSeek).');
  let lastError = null;
  for (const provider of attempts) {
    try {
      return await askCloudFallback(question, { apiKey: keys[provider], provider, fetchImpl });
    } catch (e) { lastError = e; }
  }
  throw lastError;
}
