import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayoutLink, buildPayoutRequest, resolvePayout, PAYOUT_METHODS, PAYOUT_BRAND_SIGNATURE } from './payout.js';

test('buildPayoutLink: PayPal.me con importo, da username/@handle/URL', () => {
  assert.equal(buildPayoutLink('paypal', 'giorgio', 12.5), 'https://paypal.me/giorgio/12.50EUR');
  assert.equal(buildPayoutLink('paypal', '@giorgio', 12.5), 'https://paypal.me/giorgio/12.50EUR');
  assert.equal(buildPayoutLink('paypal', 'https://paypal.me/giorgio', 12.5), 'https://paypal.me/giorgio/12.50EUR');
});

test('buildPayoutLink: Revolut profile link (no importo nell\'URL)', () => {
  assert.equal(buildPayoutLink('revolut', 'giorgiop', 10), 'https://revolut.me/giorgiop');
  assert.equal(buildPayoutLink('revolut', '@giorgiop', 10), 'https://revolut.me/giorgiop');
});

test('buildPayoutLink: IBAN e Satispay non hanno link universale → null', () => {
  assert.equal(buildPayoutLink('iban', 'IT60X0542811101000000123456', 10), null);
  assert.equal(buildPayoutLink('satispay', '+39333', 10), null);
});

test('buildPayoutRequest: IBAN → messaggio con importo e IBAN', () => {
  const r = buildPayoutRequest({ method: 'iban', value: 'IT60X0542811101000000123456', holder: 'Giorgio', amount: 13.34, note: 'cena', fromName: 'Marco' });
  assert.match(r.message, /Ciao Marco/);
  assert.match(r.message, /13,34 €/);
  assert.match(r.message, /IBAN IT60X0542811101000000123456/);
  assert.match(r.message, /cena/);
  assert.equal(r.link, null);
});

test('buildPayoutRequest: PayPal → messaggio con LINK toccabile', () => {
  const r = buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, fromName: 'Anna' });
  assert.match(r.message, /paypal\.me\/giorgio\/20\.00EUR/);
  assert.equal(r.link, 'https://paypal.me/giorgio/20.00EUR');
});

test('buildPayoutRequest: firma Momentum sobria in coda, ma un solo URL (il pay-link)', () => {
  const r = buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, fromName: 'Anna' });
  assert.ok(r.message.trimEnd().endsWith(PAYOUT_BRAND_SIGNATURE));
  // il solo URL nel messaggio resta quello per pagare (nessun secondo link che confonde)
  const urls = r.message.match(/https?:\/\/\S+/g) || [];
  assert.equal(urls.length, 1);
  assert.match(urls[0], /paypal\.me/);
  // brand:false la toglie (controllabile)
  assert.ok(!buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, brand: false }).message.includes('Momentum'));
});

test('buildPayoutRequest: senza valore non promette nulla (chiede come pagare)', () => {
  const r = buildPayoutRequest({ method: 'iban', value: '', amount: 5 });
  assert.match(r.message, /come preferisci pagare/);
});

test('resolvePayout: usa il profilo payout se c\'è', () => {
  const p = resolvePayout({ payoutProfile: { method: 'paypal', value: 'giorgio' } });
  assert.equal(p.method, 'paypal');
  assert.equal(p.value, 'giorgio');
});

test('resolvePayout: ripiega sull\'IBAN dei dati fiscali (retro-compatibile)', () => {
  const p = resolvePayout({ invoiceProfile: { fiscale: { iban: 'IT60X0542811101000000123456', intestatario: 'Giorgio' } } });
  assert.equal(p.method, 'iban');
  assert.equal(p.value, 'IT60X0542811101000000123456');
  assert.equal(p.holder, 'Giorgio');
});

test('resolvePayout: null se non configurato (→ setup una volta)', () => {
  assert.equal(resolvePayout({}), null);
  assert.equal(resolvePayout({ payoutProfile: { method: 'paypal', value: '' } }), null);
});
