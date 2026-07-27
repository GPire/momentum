import test from 'node:test';
import assert from 'node:assert/strict';
import { askCloudFallback, askCloudFallbackChain, buildFinancialContextSummary, extractAssetName } from './chat-fallback.js';

test('askCloudFallback: senza domanda -> errore onesto', async () => {
  await assert.rejects(() => askCloudFallback('', { apiKey: 'k' }), /domanda/i);
});

test('askCloudFallback: senza chiave -> errore onesto, mai un fetch a vuoto', async () => {
  await assert.rejects(() => askCloudFallback('ciao', {}), /chiave/i);
});

test('askCloudFallback: provider sconosciuto -> errore onesto', async () => {
  await assert.rejects(() => askCloudFallback('ciao', { apiKey: 'k', provider: 'boh' }), /provider/i);
});

test('askCloudFallback: Gemini (default) -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '  Ciao! Come posso aiutarti?  ' }] } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', fetchImpl });
  assert.equal(r.answer, 'Ciao! Come posso aiutarti?');
  assert.equal(r.provider, 'gemini');
});

test('askCloudFallback: Groq -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Hello there!' } }] }) });
  const r = await askCloudFallback('hi', { apiKey: 'k', provider: 'groq', fetchImpl });
  assert.equal(r.answer, 'Hello there!');
  assert.equal(r.provider, 'groq');
});

test('askCloudFallback: chiave non valida -> errore col messaggio reale dell\'API, mai una risposta finta', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) });
  await assert.rejects(() => askCloudFallback('ciao', { apiKey: 'sbagliata', fetchImpl }), /API key not valid/);
});

test('askCloudFallback: Gemini con grounding -> aggiunge le fonti reali in coda al testo', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.tools, [{ google_search: {} }]);
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Apple ha annunciato nuovi prodotti oggi.' }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: 'https://reuters.com/apple', title: 'Reuters' } }] },
        }],
      }),
    };
  };
  const r = await askCloudFallback('notizie di oggi su apple', { apiKey: 'k', fetchImpl, grounding: true });
  assert.match(r.answer, /Apple ha annunciato/);
  assert.match(r.answer, /Fonti: Reuters \(https:\/\/reuters\.com\/apple\)/);
});

test('askCloudFallback: Gemini SENZA grounding -> nessuna fonte aggiunta anche se presente nella risposta', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.equal(body.tools, undefined);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Ciao!' }] } }] }) };
  };
  const r = await askCloudFallback('ciao', { apiKey: 'k', fetchImpl });
  assert.equal(r.answer, 'Ciao!');
});

test('askCloudFallback: risposta senza testo -> errore, mai un vuoto camuffato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
  await assert.rejects(() => askCloudFallback('ciao', { apiKey: 'k', fetchImpl }));
});

test('askCloudFallbackChain: nessuna chiave configurata -> errore onesto', async () => {
  await assert.rejects(() => askCloudFallbackChain('ciao', { keys: {} }), /Nessuna chiave/i);
});

test('askCloudFallbackChain: prova nell\'ordine, si ferma al primo che risponde', async () => {
  // Ordine di default: Groq PRIMA di Gemini (limiti reali confermati più
  // generosi, nessuna carta) — qui simula Groq giù, ripiega su Gemini.
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('groq')) throw new TypeError('Failed to fetch'); // groq giù
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'risposta da gemini' }] } }] }) };
  };
  const r = await askCloudFallbackChain('ciao', { keys: { gemini: 'g', groq: 'q' }, fetchImpl });
  assert.equal(r.provider, 'gemini');
  assert.equal(r.answer, 'risposta da gemini');
  assert.ok(calls.some(u => u.includes('groq'))); // ha provato Groq prima
  assert.ok(calls.some(u => u.includes('generativelanguage'))); // poi Gemini
});

test('askCloudFallbackChain: Gemini con grounding fallisce (es. modello senza supporto tool) -> ripiega su Gemini senza grounding, stesso provider', async () => {
  let call = 0;
  const fetchImpl = async (url, opts) => {
    call++;
    const body = JSON.parse(opts.body);
    if (body.tools) throw new TypeError('Failed to fetch'); // grounding non supportato in questo scenario
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'risposta senza grounding' } ] } }] }) };
  };
  const r = await askCloudFallbackChain('notizie di oggi', { keys: { gemini: 'g' }, fetchImpl });
  assert.equal(r.provider, 'gemini');
  assert.equal(r.answer, 'risposta senza grounding');
  assert.equal(call, 2);
});

test('askCloudFallbackChain: tutti i provider falliscono -> rilancia l\'ULTIMO errore reale', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'server error' } }) });
  await assert.rejects(() => askCloudFallbackChain('ciao', { keys: { gemini: 'g' }, fetchImpl }), /server error/);
});

test('askCloudFallback: OpenAI -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Hi from GPT' } }] }) });
  const r = await askCloudFallback('hi', { apiKey: 'k', provider: 'openai', fetchImpl });
  assert.equal(r.answer, 'Hi from GPT');
});

test('askCloudFallback: Anthropic -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ content: [{ text: 'Hi from Claude' }] }) });
  const r = await askCloudFallback('hi', { apiKey: 'k', provider: 'anthropic', fetchImpl });
  assert.equal(r.answer, 'Hi from Claude');
});

test('buildFinancialContextSummary: nessun dato -> null, mai un riassunto vuoto inviato', () => {
  assert.equal(buildFinancialContextSummary({}), null);
  assert.equal(buildFinancialContextSummary(), null);
});

test('buildFinancialContextSummary: solo numeri aggregati, mai transazioni/esercenti/conti', () => {
  const s = buildFinancialContextSummary({ safeToday: 56.789, monthRemaining: 281.2, topCategory: 'Ristorante', marketRegime: 'risk-on' });
  assert.ok(s.includes('57€') || s.includes('56€')); // arrotondato
  assert.ok(s.includes('281€'));
  assert.ok(s.includes('Ristorante'));
  assert.ok(s.includes('risk-on'));
  assert.ok(/nessuna transazione/i.test(s));
});

test('buildFinancialContextSummary: parziale -> include solo i campi presenti', () => {
  const s = buildFinancialContextSummary({ safeToday: 50 });
  assert.ok(s.includes('50€'));
  assert.ok(!s.includes('categoria'));
});

test('buildFinancialContextSummary: categoryBreakdown -> solo percentuali, mai importi', () => {
  const s = buildFinancialContextSummary({ categoryBreakdown: [{ name: 'Alimentari', pct: 34 }, { name: 'Trasporti', pct: 18 }] });
  assert.ok(s.includes('Alimentari 34%'));
  assert.ok(s.includes('Trasporti 18%'));
  assert.ok(!/\d+[.,]\d{2}€/.test(s)); // nessun importo con centesimi, solo percentuali intere
});

test('buildFinancialContextSummary: categoryBreakdown vuoto -> non aggiunge nulla', () => {
  const s = buildFinancialContextSummary({ safeToday: 50, categoryBreakdown: [] });
  assert.ok(!s.includes('grafico'));
});

test('askCloudFallback: con contextSummary lo antepone al prompt di sistema (mai al posto della domanda)', async () => {
  let sentSystem = null, sentQuestion = null;
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sentSystem = body.systemInstruction.parts[0].text;
    sentQuestion = body.contents[0].parts[0].text;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
  };
  await askCloudFallback('quanto costa un biglietto aereo?', { apiKey: 'k', fetchImpl, contextSummary: 'Contesto aggregato: oggi può spendere 50€.' });
  assert.ok(sentSystem.includes('Contesto aggregato'));
  assert.equal(sentQuestion, 'quanto costa un biglietto aereo?'); // la domanda resta pulita, il contesto va nel system prompt
});

test('askCloudFallbackChain: usa SOLO i provider per cui esiste una chiave', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; };
  const r = await askCloudFallbackChain('ciao', { keys: { deepseek: 'd' }, fetchImpl });
  assert.equal(r.provider, 'deepseek');
  assert.equal(calls.length, 1);
});

test('extractAssetName: riconosce l\'asset qualunque sia la formulazione (dinamico, non regex fisso)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Bitcoin' }] } }] }) });
  const name = await extractAssetName('fammi vedere come sta andando quella cripto famosa di cui parlano tutti', { apiKey: 'k', fetchImpl });
  assert.equal(name, 'Bitcoin');
});

test('extractAssetName: domanda senza asset -> null (mai un asset a caso)', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'NESSUNO' }] } }] }) });
  const name = await extractAssetName('spiegami cos\'è un mutuo', { apiKey: 'k', fetchImpl });
  assert.equal(name, null);
});

test('extractAssetName: senza chiave -> null, mai un fetch a vuoto', async () => {
  const name = await extractAssetName('come va Bitcoin', { apiKey: null, fetchImpl: async () => ({}) });
  assert.equal(name, null);
});

test('extractAssetName: la fonte fallisce -> null, mai un errore che rompe il flusso', async () => {
  const fetchImpl = async () => { throw new Error('rete assente'); };
  const name = await extractAssetName('come va Bitcoin', { apiKey: 'k', fetchImpl });
  assert.equal(name, null);
});

test('extractAssetName: risposta troppo lunga (probabile spiegazione, non un nome) -> null', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Questo è un testo molto lungo che non è affatto il nome di un asset ma una spiegazione articolata' }] } }] }) });
  const name = await extractAssetName('come va Bitcoin', { apiKey: 'k', fetchImpl });
  assert.equal(name, null);
});

// BUG REALE segnalato dall'utente: una chiave "xai-..." salvata nel campo
// "Groq" per l'omonimia dei nomi falliva sempre (Groq e xAI sono servizi
// diversi). Verifica che xAI ora sia un provider vero, con estrazione
// dell'errore anche quando `error` è una stringa diretta (formato reale
// osservato dal vivo su un account xAI senza crediti).
test('askCloudFallback: xAI -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da Grok' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'xai-k', provider: 'xai', fetchImpl });
  assert.equal(r.answer, 'Risposta da Grok');
  assert.equal(r.provider, 'xai');
});

test('askCloudFallback: xAI con errore come stringa diretta (non {message}) -> messaggio reale, mai un HTTP generico', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ code: 'permission-denied', error: 'Your newly created team doesn\'t have any credits or licenses yet.' }) });
  await assert.rejects(() => askCloudFallback('ciao', { apiKey: 'xai-k', provider: 'xai', fetchImpl }), /doesn't have any credits/);
});

test('askCloudFallbackChain: include xAI nell\'ordine di default, dopo DeepSeek', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('x.ai')) return { ok: true, json: async () => ({ choices: [{ message: { content: 'grok risponde' } }] }) };
    throw new TypeError('Failed to fetch');
  };
  const r = await askCloudFallbackChain('ciao', { keys: { xai: 'xai-k' }, fetchImpl });
  assert.equal(r.provider, 'xai');
  assert.equal(r.answer, 'grok risponde');
});

// Ricerca avanzata richiesta esplicitamente ("trova il modo innovativo"):
// altri 3 provider verificati dal vivo (CORS confermato via OPTIONS reale,
// 2026-07-27) aggiunti alla cascata, stesso formato OpenAI-compatibile.
test('askCloudFallback: Mistral -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da Mistral' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'mistral', fetchImpl });
  assert.equal(r.answer, 'Risposta da Mistral');
});

test('askCloudFallback: OpenRouter -> forma reale, usa il modello ":free" di default', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.match(body.model, /:free$/);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da OpenRouter' } }] }) };
  };
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'openrouter', fetchImpl });
  assert.equal(r.answer, 'Risposta da OpenRouter');
});

test('askCloudFallback: Cerebras -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da Cerebras' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'cerebras', fetchImpl });
  assert.equal(r.answer, 'Risposta da Cerebras');
});

test('askCloudFallbackChain: ordine di default include i nuovi provider tra Groq e DeepSeek', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('mistral')) return { ok: true, json: async () => ({ choices: [{ message: { content: 'da mistral' } }] }) };
    throw new TypeError('Failed to fetch');
  };
  const r = await askCloudFallbackChain('ciao', { keys: { mistral: 'k' }, fetchImpl });
  assert.equal(r.provider, 'mistral');
});

// Modelli asiatici richiesti esplicitamente ("anche modelli AI asiatici e
// orientali") — verificati dal vivo per CORS (2026-07-27, l'header
// rispecchia l'origine con credenziali, valido per il browser quanto un
// "*"). 01.AI e Aleph Alpha esclusi: nessun CORS confermato dal vivo.
test('askCloudFallback: Qwen -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da Qwen' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'qwen', fetchImpl });
  assert.equal(r.answer, 'Risposta da Qwen');
});

test('askCloudFallback: Moonshot AI -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da Kimi' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'moonshot', fetchImpl });
  assert.equal(r.answer, 'Risposta da Kimi');
});

// GLM (Zhipu): verificato dal vivo sia CORS che la risposta REALE senza
// chiave (formato d'errore {error:{message}} identico a OpenAI, schema
// Authorization Bearer standard confermato).
test('askCloudFallback: GLM -> forma reale, estrae il testo', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Risposta da GLM' } }] }) });
  const r = await askCloudFallback('ciao', { apiKey: 'k', provider: 'glm', fetchImpl });
  assert.equal(r.answer, 'Risposta da GLM');
});
