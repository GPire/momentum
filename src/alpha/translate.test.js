import test from 'node:test';
import assert from 'node:assert/strict';
import { isItalianDevice, translateText } from './translate.js';

test('isItalianDevice: rileva it-IT tra le lingue del device', () => {
  assert.equal(isItalianDevice({ languages: ['it-IT', 'en-US'] }), true);
  assert.equal(isItalianDevice({ languages: ['en-US'] }), false);
  assert.equal(isItalianDevice({ language: 'it' }), true);
  assert.equal(isItalianDevice({}), false);
});

test('translateText: testo vuoto → stringa vuota, nessuna chiamata', async () => {
  assert.equal(await translateText(''), '');
});

test('translateText: forma reale MyMemory → testo tradotto', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ responseData: { translatedText: 'Bitcoin è una criptovaluta.' }, responseStatus: 200 }) });
  const r = await translateText('Bitcoin is a cryptocurrency.', { fetchImpl });
  assert.equal(r, 'Bitcoin è una criptovaluta.');
});

test('translateText: risposta senza traduzione → errore onesto, mai testo inventato', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ responseStatus: 403 }) });
  await assert.rejects(() => translateText('x', { fetchImpl }));
});

test('translateText: HTTP non ok → errore', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => translateText('x', { fetchImpl }), /500/);
});
