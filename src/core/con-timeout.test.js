import test from 'node:test';
import assert from 'node:assert/strict';
import { conTimeout } from './con-timeout.js';

test('se la promise vince in tempo, il risultato passa invariato', async () => {
  const r = await conTimeout(Promise.resolve(42), 100);
  assert.equal(r, 42);
});

test('se la promise NON si risolve mai (il caso reale trovato dal vivo: CDN "pending" per sempre), scade con un errore chiaro', async () => {
  const cheNonFiniscePiu = new Promise(() => {}); // mai risolta né rifiutata, come la richiesta Xet osservata dal vivo
  await assert.rejects(
    () => conTimeout(cheNonFiniscePiu, 20, 'download bloccato'),
    /download bloccato/,
  );
});

test('se la promise originale si rifiuta prima del timeout, l\'errore originale passa, non quello del timeout', async () => {
  await assert.rejects(
    () => conTimeout(Promise.reject(new Error('errore vero')), 1000),
    /errore vero/,
  );
});
