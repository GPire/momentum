import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryPromptKey, shouldAutoOpenRecoveryPrompt } from './recovery-notice.js';

test('no candidates means no automatic prompt, including on a fresh installation', () => {
  assert.equal(shouldAutoOpenRecoveryPrompt({}, null), false);
});
test('a prompt already seen stays closed across reloads, ordering and duplicate log rows', () => {
  const key = recoveryPromptKey({ month: [{ id: 'a' }, { id: 'b' }] });
  const persisted = JSON.parse(JSON.stringify({ recoveryPromptSeenKey: key }));
  assert.equal(shouldAutoOpenRecoveryPrompt({ other: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }, persisted.recoveryPromptSeenKey), false);
});
test('a genuinely different recovery set can open once without changing the data', () => {
  const old = { month: [{ id: 'a', amount: 5 }] };
  const key = recoveryPromptKey(old);
  assert.equal(shouldAutoOpenRecoveryPrompt({ month: [...old.month, { id: 'c' }] }, key), true);
  assert.deepEqual(old, { month: [{ id: 'a', amount: 5 }] });
});
test('closing or refusing the first prompt suppresses future automatic prompts', () => {
  assert.equal(shouldAutoOpenRecoveryPrompt({ month: [{ id: 'new' }] }, '["old"]', true), false);
});
