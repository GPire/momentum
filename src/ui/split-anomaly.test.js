import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAnomalyMessage, splitShapeSuggestion } from './split-anomaly.js';

const group = { baseCurrency: 'EUR', expenses: [10, 10, 11, 9].map((amount, index) => ({ id: String(index), description: 'Taxi', amount })) };

test('warns only with enough similar history and leaves the expense editable', () => {
  assert.equal(splitAnomalyMessage(group, { description: 'Taxi', amount: 10 }, 'it'), null);
  const message = splitAnomalyMessage(group, { description: 'taxi', amount: 80 }, 'it');
  assert.match(message, /4 spese simili/);
  assert.match(message, /puoi comunque aggiungerlo/);
  assert.equal(group.expenses.length, 4);
  assert.equal(splitAnomalyMessage(group, { description: 'Train', amount: 80 }, 'it'), null);
});

test('abstains for unconverted foreign amounts and translates all seven languages', () => {
  assert.equal(splitAnomalyMessage(group, { description: 'Taxi', amount: 80, inputCurrency: 'CHF' }, 'it'), null);
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    const message = splitAnomalyMessage(group, { description: 'Taxi', amount: 80 }, lang);
    assert.ok(message?.length > 40);
    assert.ok(!message.includes('undefined'));
  }
});

test('learned group suggestion uses only matching history and known member IDs', () => {
  const withPeople = {
    members: [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bea' }],
    expenses: [1, 2, 3].map(n => ({ id: String(n), description: 'Taxi', payer: 'a', amount: 10, owed: { a: 5, b: 5 } })),
  };
  const suggestion = splitShapeSuggestion(withPeople, 'taxi', { a: 'Anna', b: 'Bea' }, 'it');
  assert.equal(suggestion.payer, 'a');
  assert.deepEqual(suggestion.involved, ['a', 'b']);
  assert.match(suggestion.message, /3 spese simili/);
  assert.equal(splitShapeSuggestion(withPeople, 'Hotel', { a: 'Anna', b: 'Bea' }, 'it'), null);
  assert.equal(splitShapeSuggestion({ ...withPeople, expenses: withPeople.expenses.slice(0, 1) }, 'Taxi', { a: 'Anna' }, 'it'), null);
});
