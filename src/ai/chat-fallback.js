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
// Grounding con Google Search (verificato dal vivo 2026-07-27, richiesta
// esplicita: "anche se non è su Alpha Vantage o simili, può usare AI
// generica e fare lo stesso" — per le NOTIZIE, non per i dati numerici):
// con `grounding: true`, Gemini cerca sul web reale invece di rispondere
// solo dalla sua conoscenza generica, e cita le fonti trovate. Non
// sostituisce mai i grafici/serie storiche (quelli restano da Alpha
// Vantage/Twelve Data/FMP, mai testo generico spacciato per un numero
// reale) — solo testo con fonti, appeso in coda alla risposta.
async function askGemini(question, { apiKey, fetchImpl, model = 'gemini-flash-latest', systemPrompt = SYSTEM_PROMPT, grounding = false }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: question }] }],
  };
  if (grounding) body.tools = [{ google_search: {} }];
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Gemini: HTTP ${res.status}`);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Risposta vuota da Gemini.');
  const chunks = json?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map(c => c.web?.uri ? `${c.web.title || c.web.uri} (${c.web.uri})` : null).filter(Boolean);
  return sources.length ? `${text.trim()}\n\nFonti: ${sources.join(', ')}` : text.trim();
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
    // Alcuni provider "OpenAI-compatibili" non lo sono fino in fondo:
    // xAI, per esempio, a volte restituisce `error` come STRINGA diretta
    // (es. "team senza crediti"), non `{ message }` come OpenAI/Groq —
    // verificato dal vivo. Entrambe le forme vanno lette, mai un generico
    // "HTTP 403" che nasconde il motivo reale.
    if (!res.ok) throw new Error(json?.error?.message || (typeof json?.error === 'string' ? json.error : null) || `${label}: HTTP ${res.status}`);
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Risposta vuota da ${label}.`);
    return text.trim();
  };
}

const askGroq = makeOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', 'Groq');
// xAI (Grok): CORS verificato dal vivo (2026-07-27, access-control-allow-
// origin: *), formato OpenAI-compatibile confermato. A PAGAMENTO A CONSUMO,
// nessun livello gratuito (verificato: un account nuovo senza crediti dà
// "permission-denied", non un errore di formato) — solo per chi ha già
// credito attivo su console.x.ai. BUG REALE trovato dall'utente: una chiave
// che inizia con "xai-" (xAI) era stata salvata nel campo "Groq" per
// l'omonimia dei nomi — le due API sono completamente diverse (endpoint,
// account, fatturazione), da qui le richieste sempre fallite in silenzio.
const askXai = makeOpenAiCompatible('https://api.x.ai/v1/chat/completions', 'grok-4-fast', 'xAI');
// DeepSeek: CORS verificato (2026-07-27), MA a differenza di Gemini/Groq non
// ho conferma che il livello gratuito sia sempre disponibile — dichiarato,
// l'utente verifica i costi sul proprio account prima di usarlo con continuità.
const askDeepseek = makeOpenAiCompatible('https://api.deepseek.com/chat/completions', 'deepseek-chat', 'DeepSeek');
// Mistral AI: CORS verificato dal vivo (2026-07-27, access-control-allow-
// origin: *), formato OpenAI-compatibile. Ha un livello gratuito dichiarato
// (La Plateforme, con limiti di frequenza) — come DeepSeek, non verificato
// end-to-end con una chiave reale stasera: l'utente controlla i limiti sul
// proprio account prima di usarlo con continuità.
const askMistral = makeOpenAiCompatible('https://api.mistral.ai/v1/chat/completions', 'mistral-small-latest', 'Mistral');
// OpenRouter: CORS verificato dal vivo (2026-07-27). Non è un solo modello ma
// un AGGREGATORE: una sola chiave dà accesso a decine di modelli di provider
// diversi, inclusi alcuni modelli marcati ":free" (gratuiti, con un limite di
// richieste/minuto). Utile in cascata proprio perché una singola chiave copre
// più modelli — se un modello free è sovraccarico, l'utente può cambiarlo
// dal proprio account senza cambiare provider in Momentum.
const askOpenRouter = makeOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions', 'meta-llama/llama-3.3-70b-instruct:free', 'OpenRouter');
// Cerebras: CORS verificato dal vivo (2026-07-27). Inferenza molto veloce
// (hardware dedicato, non GPU condivise), piano gratuito dichiarato generoso
// per chi ha solo bisogno di risposte testuali occasionali — non verificato
// end-to-end con una chiave reale stasera.
const askCerebras = makeOpenAiCompatible('https://api.cerebras.ai/v1/chat/completions', 'llama3.1-8b', 'Cerebras');
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

export const CLOUD_CHAT_PROVIDERS = { gemini: askGemini, groq: askGroq, deepseek: askDeepseek, mistral: askMistral, openrouter: askOpenRouter, cerebras: askCerebras, openai: askOpenAI, anthropic: askAnthropic, xai: askXai };
const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq', deepseek: 'DeepSeek', mistral: 'Mistral', openrouter: 'OpenRouter', cerebras: 'Cerebras', openai: 'OpenAI', anthropic: 'Anthropic', xai: 'xAI' };

// Riconoscimento DINAMICO dell'asset (richiesta esplicita dell'utente: un
// elenco fisso di frasi/regex è troppo rigido — "grafico di Bitcoin",
// "come va Tesla", "che mi dici su Apple" sono tutte formulazioni diverse
// della stessa cosa). Qui l'AI esterna già configurata capisce la frase
// QUALUNQUE sia la formulazione — ma resta SOLO un estrattore di nome: il
// prezzo/grafico/notizie restano sempre dati reali presi dopo da CoinGecko/
// Alpha Vantage, mai inventati da questa chiamata. Se non è una domanda su
// un asset, o l'AI non è sicura, ritorna null — mai un asset a caso.
const ASSET_EXTRACTION_PROMPT = 'Rispondi SOLO con il nome dell\'azienda/criptovaluta/ETF di cui parla la domanda (es. "Nvidia", "Bitcoin", "Tesla") — una sola parola o nome proprio, niente altro testo, nessuna spiegazione. Se la domanda NON riguarda un asset finanziario specifico, rispondi esattamente con la parola NESSUNO.';

export async function extractAssetName(question, { apiKey, fetchImpl = fetch, provider = 'gemini' } = {}) {
  if (!question || !apiKey) return null;
  const fn = CLOUD_CHAT_PROVIDERS[provider];
  if (!fn) return null;
  try {
    const raw = await fn(question, { apiKey, fetchImpl, systemPrompt: ASSET_EXTRACTION_PROMPT });
    const name = raw.trim().replace(/^["'.]+|["'.]+$/g, '');
    if (!name || /^nessuno$/i.test(name) || name.length > 40) return null;
    return name;
  } catch (_) { return null; }
}

export async function askCloudFallback(question, { apiKey, fetchImpl = fetch, provider = 'gemini', model, contextSummary = null, grounding = false } = {}) {
  if (!question || !question.trim()) throw new Error('Serve una domanda.');
  if (!apiKey) throw new Error(`Serve la tua chiave ${PROVIDER_LABELS[provider] || provider} personale (Momentum Vault → Chat generica).`);
  const fn = CLOUD_CHAT_PROVIDERS[provider];
  if (!fn) throw new Error(`Provider sconosciuto: ${provider}.`);
  const systemPrompt = contextSummary ? `${SYSTEM_PROMPT}\n\n${contextSummary}` : SYSTEM_PROMPT;
  const answer = await fn(question, { apiKey, fetchImpl, systemPrompt, ...(model ? { model } : {}), ...(provider === 'gemini' ? { grounding } : {}) });
  return { answer, provider, source: provider };
}

// Fallback A CATENA (richiesto esplicitamente): prova ogni provider per cui
// l'utente ha configurato una chiave, IN ORDINE, e si ferma al primo che
// risponde. `keys` = { gemini?, groq?, deepseek?, openai?, anthropic? }. Se
// tutti falliscono, rilancia l'ULTIMO errore reale (mai un errore generico
// che nasconde cosa è successo davvero). `order` di default: prima i
// GRATUITI confermati (Gemini, Groq), poi quello da verificare (DeepSeek),
// infine i due A PAGAMENTO (OpenAI, Anthropic) — solo per chi li ha già.
// Ordine di default per generosità REALE del piano gratuito (dalla
// documentazione ufficiale di ciascun provider, 2026-07-27 — non un numero
// esatto verificato dal vivo per ognuno stasera, i limiti cambiano nel
// tempo): Groq e Gemini restano i più generosi e veloci; Cerebras ha un
// piano gratuito ampio ma più giovane; Mistral è più limitato (pochi
// token/minuto); OpenRouter dipende dal modello ":free" scelto (limiti
// spesso più stretti, variabili per modello); DeepSeek è a consumo senza
// livello gratuito confermato; xAI/OpenAI/Anthropic sono sempre a pagamento.
export async function askCloudFallbackChain(question, { keys = {}, fetchImpl = fetch, order = ['gemini', 'groq', 'cerebras', 'mistral', 'openrouter', 'deepseek', 'xai', 'openai', 'anthropic'], contextSummary = null } = {}) {
  const attempts = order.filter((p) => keys[p]);
  if (!attempts.length) throw new Error('Nessuna chiave di chat generica configurata.');
  let lastError = null;
  for (const provider of attempts) {
    // Gemini: prova PRIMA con grounding (ricerca web reale, notizie vere con
    // fonti citate) — a CASCATA, come ogni altra fonte dati di questa
    // sessione: se fallisce (es. errore momentaneo, modello che non supporta
    // i tool), ripiega sulla stessa chiamata SENZA grounding prima di passare
    // al provider successivo. Mai un secondo motore isolato.
    if (provider === 'gemini') {
      try {
        return await askCloudFallback(question, { apiKey: keys.gemini, provider, fetchImpl, contextSummary, grounding: true });
      } catch (e) { lastError = e; }
    }
    try {
      return await askCloudFallback(question, { apiKey: keys[provider], provider, fetchImpl, contextSummary });
    } catch (e) { lastError = e; }
  }
  throw lastError;
}
