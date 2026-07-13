import test from 'node:test';
import assert from 'node:assert/strict';

// Shim ambiente browser PRIMA di importare (constants.js usa window/navigator).
const learned = [];
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.document = { querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
globalThis.window = {
  momentumOrchestrator: { learn: (d, c) => learned.push([d, c]) },
  requestIdleCallback: (fn) => setTimeout(() => fn({ timeRemaining: () => 10 }), 0),
};
const { learnInBackground } = await import('./multi-import.js');

test('learnInBackground: addestra i modelli da OGNI operazione importata (idle-chunked)', async () => {
  learned.length = 0;
  const pairs = Array.from({ length: 95 }, (_, i) => ({ description: 'tx ' + i, category: 'spesa', amount: 10, date: new Date() }));
  learnInBackground(pairs, 40); // 95 in chunk da 40 → 3 giri idle
  await new Promise(r => setTimeout(r, 120));
  assert.equal(learned.length, 95); // TUTTE le operazioni addestrano i modelli
  assert.equal(learned[0][0], 'tx 0');
});
