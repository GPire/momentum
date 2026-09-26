import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICES } from './stripe-setup.mjs';
import { PRICE_PRO_MONTHLY_EUR, PRICE_PRO_YEARLY_EUR, PRICE_PRO_INVESTOR_MONTHLY_EUR, PRICE_PRO_INVESTOR_YEARLY_EUR } from '../src/core/subscription.js';

test('i prezzi creati su Stripe sono quelli mostrati in app', () => {
  const c = Object.fromEntries(PRICES.map((p) => [p.env, p.cents]));
  assert.equal(c.STRIPE_PRICE_PRO_MONTH, Math.round(PRICE_PRO_MONTHLY_EUR * 100));
  assert.equal(c.STRIPE_PRICE_PRO_YEAR, Math.round(PRICE_PRO_YEARLY_EUR * 100));
  assert.equal(c.STRIPE_PRICE_INVESTOR_MONTH, Math.round(PRICE_PRO_INVESTOR_MONTHLY_EUR * 100));
  assert.equal(c.STRIPE_PRICE_INVESTOR_YEAR, Math.round(PRICE_PRO_INVESTOR_YEARLY_EUR * 100));
});
