import test from 'node:test';
import assert from 'node:assert/strict';
import { askCloudFallback, askCloudFallbackChain } from './chat-fallback.js';

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

test('askCloudFallbackChain: usa SOLO i provider per cui esiste una chiave', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }; };
  const r = await askCloudFallbackChain('ciao', { keys: { deepseek: 'd' }, fetchImpl });
  assert.equal(r.provider, 'deepseek');
  assert.equal(calls.length, 1);
});
