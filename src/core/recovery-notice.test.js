import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryPromptKey, shouldAutoOpenRecoveryPrompt } from './recovery-notice.js';

test('nessun candidato → nessun avviso automatico, anche a installazione appena fatta', () => {
  assert.equal(shouldAutoOpenRecoveryPrompt({}, null), false);
});

test('un avviso già visto resta chiuso tra riavvii, ordine diverso e righe di log duplicate', () => {
  const key = recoveryPromptKey({ mese: [{ id: 'a' }, { id: 'b' }] });
  const persistito = JSON.parse(JSON.stringify({ recoveryPromptSeenKey: key }));
  assert.equal(shouldAutoOpenRecoveryPrompt({ altro: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }, persistito.recoveryPromptSeenKey), false);
});

test('un insieme di recupero genuinamente diverso può aprirsi una volta, senza modificare i dati', () => {
  const vecchio = { mese: [{ id: 'a', amount: 5 }] };
  const key = recoveryPromptKey(vecchio);
  assert.equal(shouldAutoOpenRecoveryPrompt({ mese: [...vecchio.mese, { id: 'c' }] }, key), true);
  assert.deepEqual(vecchio, { mese: [{ id: 'a', amount: 5 }] });
});

test('chiudere o rifiutare il primo avviso sopprime gli avvisi automatici futuri', () => {
  assert.equal(shouldAutoOpenRecoveryPrompt({ mese: [{ id: 'nuovo' }] }, '["vecchio"]', true), false);
});
