import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSplitMoney } from './split-money.js';

test('split amounts preserve their group currency and the interface locale', () => {
  assert.equal(formatSplitMoney(14, {baseCurrency:'USD'}, 'it-IT'), '14,00\u00a0USD');
  assert.equal(formatSplitMoney(14, {baseCurrency:'USD'}, 'en-US'), '$14.00');
  assert.equal(formatSplitMoney(1200, {baseCurrency:'JPY'}, 'en-US'), '¥1,200');
  assert.equal(formatSplitMoney(-14, {baseCurrency:'GBP'}, 'en-GB'), '-£14.00');
  assert.equal(formatSplitMoney(14), '14,00\u00a0€');
});

test('invalid group amounts or currency do not become a zero balance or euros', () => {
  for (const value of [undefined, null, NaN, Infinity, '14']) assert.equal(formatSplitMoney(value), '—');
  assert.equal(formatSplitMoney(14, {baseCurrency:'<USD>'}), '—');
  assert.equal(formatSplitMoney(0, {baseCurrency:'usd'}, 'en-US'), '$0.00');
});
