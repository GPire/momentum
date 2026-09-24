import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroup, claimMember, addSharedExpense, computeBalances } from './split-engine.js';
import { contestExpense } from './group-chat.js';
import { confirmedSplitLiability } from './split-liability.js';

function group(name, currency = 'EUR') {
  let g = createGroup({ name, members: ['Io', 'Marco'], baseCurrency: currency });
  g = claimMember(g, 'm0', 'my-device');
  return g;
}

test('same name in different groups never erases a confirmed debt', () => {
  const a = addSharedExpense(group('Casa'), { payer: 'm1', amount: 100 });
  const b = addSharedExpense(group('Viaggio'), { payer: 'm0', amount: 100 });
  assert.deepEqual(confirmedSplitLiability([a, b], { deviceId: 'my-device' }), {
    owed: 50, complete: true, excluded: [],
  });
});

test('foreign currency, uncertain identity, dispute and broken cents never enter a cash scenario', () => {
  const foreign = addSharedExpense(group('USA', 'USD'), { payer: 'm1', amount: 20 });
  const unknown = addSharedExpense(createGroup({ name: 'Old', members: ['Io', 'Marco'] }), { payer: 'm1', amount: 20 });
  const beforeDispute = addSharedExpense(group('Discussione'), { payer: 'm1', amount: 20 });
  const disputed = contestExpense(beforeDispute, { autore: 'Marco', expenseId: beforeDispute.expenses[0].id });
  const broken = addSharedExpense(group('Broken'), { payer: 'm1', amount: 20 });
  broken.expenses[0].owed.m0 = 10.01;
  const result = confirmedSplitLiability([foreign, unknown, disputed, broken], { deviceId: 'my-device' });
  assert.equal(result.owed, 0);
  assert.equal(result.complete, false);
  assert.deepEqual(result.excluded.map(item => item.reason), ['currency', 'identity', 'disputed', 'ledger']);
});

test('empty groups and exact small amounts remain valid', () => {
  const g = addSharedExpense(group('Centesimi'), { payer: 'm1', amount: .03 });
  const owed = Math.max(0, -computeBalances(g).m0);
  assert.deepEqual(confirmedSplitLiability([group('Vuoto'), g], { deviceId: 'my-device' }), {
    owed, complete: true, excluded: [],
  });
  assert.equal(Object.values(g.expenses[0].owed).reduce((sum, value) => sum + Math.round(value * 100), 0), 3);
});

test('two member slots claimed by one device cannot produce a confirmed liability', () => {
  const g = addSharedExpense(group('Ambiguous'), { payer: 'm1', amount: 20 });
  g.members[1].claimedBy = 'my-device';
  const result = confirmedSplitLiability([g], { deviceId: 'my-device' });
  assert.equal(result.complete, false);
  assert.equal(result.excluded[0].reason, 'identity');
});

test('a missing device identity cannot silently claim an unclaimed participant', () => {
  const g = addSharedExpense(group('Missing identity'), { payer: 'm1', amount: 20 });
  assert.equal(confirmedSplitLiability([g]).complete, false);
});

test('repeated group or expense IDs suspend a cash liability instead of counting twice', () => {
  const g = addSharedExpense(group('Duplicate'), { payer: 'm1', amount: 20 });
  const repeatedGroup = confirmedSplitLiability([g, g], { deviceId: 'my-device' });
  assert.equal(repeatedGroup.complete, false);
  assert.deepEqual(repeatedGroup.excluded.map(row => row.reason), ['duplicate']);
  const repeatedExpense = { ...g, expenses: [g.expenses[0], { ...g.expenses[0] }] };
  const result = confirmedSplitLiability([repeatedExpense], { deviceId: 'my-device' });
  assert.equal(result.complete, false);
  assert.deepEqual(result.excluded.map(row => row.reason), ['ledger']);
});
