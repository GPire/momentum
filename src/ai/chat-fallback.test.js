import test from 'node:test';
import assert from 'node:assert/strict';
import { askCloudFallback, askCloudFallbackChain, buildFinancialContextSummary } from './chat-fallback.js';

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

test('askCloudFallback: risposta senza testo -> errore, mai un vuoto camuffato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
  await assert.rejects(() => askCloudFallback('ciao', { apiKey: 'k', fetchImpl }));
});

test('askCloudFallbackChain: nessuna chiave configurata -> errore onesto', async () => {
  await assert.rejects(() => askCloudFallbackChain('ciao', { keys: {} }), /Nessuna chiave/i);
});

test('askCloudFallbackChain: prova nell\'ordine, si ferma al primo che risponde', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('generativelanguage')) throw new TypeError('Failed to fetch'); // gemini giù
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'risposta da groq' } }] }) };
  };
  const r = await askCloudFallbackChain('ciao', { keys: { gemini: 'g', groq: 'q' }, fetchImpl });
  assert.equal(r.provider, 'groq');
  assert.equal(r.answer, 'risposta da groq');
  assert.equal(calls.length, 2); // ha provato gemini, poi groq
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
