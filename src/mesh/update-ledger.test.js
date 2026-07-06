import test from 'node:test';
import assert from 'node:assert/strict';

const { appendUpdate, verifyLedger, peerReputation, reputationWeight, hashEntry } = await import('./update-ledger.js');

function buildLedger(events) {
  let l = [];
  let t = 1000;
  for (const e of events) l = appendUpdate(l, e, t++);
  return l;
}

test('catena hash: valida dopo append normali', () => {
  const l = buildLedger([
    { peerId: 'A', accepted: true, examplesBefore: 10, examplesAfter: 18 },
    { peerId: 'B', accepted: false, examplesBefore: 18, examplesAfter: 18, reason: 'anti-poisoning' },
  ]);
  const v = verifyLedger(l);
  assert.equal(v.valid, true);
  assert.equal(v.length, 2);
});

test('catena hash: manomettere una voce vecchia rompe la verifica', () => {
  const l = buildLedger([
    { peerId: 'A', accepted: true, examplesBefore: 10, examplesAfter: 18 },
    { peerId: 'A', accepted: true, examplesBefore: 18, examplesAfter: 26 },
  ]);
  l[0].examplesAfter = 9999; // manomissione
  assert.equal(verifyLedger(l).valid, false);
});

test('reputazione: peer sempre accettato → score alto; peer avvelenatore → basso', () => {
  const l = buildLedger([
    { peerId: 'buono', accepted: true, examplesBefore: 1, examplesAfter: 2 },
    { peerId: 'buono', accepted: true, examplesBefore: 2, examplesAfter: 3 },
    { peerId: 'buono', accepted: true, examplesBefore: 3, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
  ]);
  assert.ok(peerReputation(l, 'buono').score > 0.7);
  assert.ok(peerReputation(l, 'ostile').score < 0.3);
});

test('peer nuovo → reputazione neutra 0.5, mai colpevole a priori', () => {
  assert.equal(peerReputation([], 'sconosciuto').score, 0.5);
});

test('reputationWeight: l\'ostile viene quasi silenziato, il buono mantiene il peso', () => {
  const l = buildLedger([
    { peerId: 'buono', accepted: true, examplesBefore: 1, examplesAfter: 2 },
    { peerId: 'buono', accepted: true, examplesBefore: 2, examplesAfter: 3 },
    { peerId: 'buono', accepted: true, examplesBefore: 3, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
    { peerId: 'ostile', accepted: false, examplesBefore: 4, examplesAfter: 4 },
  ]);
  const wBuono = reputationWeight(l, 'buono', 1);
  const wOstile = reputationWeight(l, 'ostile', 1);
  assert.ok(wBuono > 0.7);
  assert.ok(wOstile < 0.1, `ostile schiacciato, trovato ${wOstile}`);
});

test('hashEntry: deterministico', () => {
  const a = hashEntry({ x: 1, y: 'ciao' });
  const b = hashEntry({ x: 1, y: 'ciao' });
  assert.equal(a, b);
  assert.notEqual(a, hashEntry({ x: 2, y: 'ciao' }));
});
