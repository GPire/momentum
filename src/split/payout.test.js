import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPayoutLink, buildPayoutRequest, resolvePayout, PAYOUT_METHODS, PAYOUT_BRAND_SIGNATURE } from './payout.js';
import { payoutCopy } from '../i18n/payout.js';

test('repayment translations cover seven languages and preserve every parameter', () => {
  const tokens = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  for (const [key, row] of Object.entries(payoutCopy)) {
    assert.equal(row.length, 7, key);
    for (const text of row) { assert.ok(text.trim(), key); assert.deepEqual(tokens(text), tokens(row[0]), key); }
  }
});

test('repayment retains currency, localization and distinct provider/detail URLs', () => {
  for (const lang of ['it','en','de','fr','es','nl','pt']) {
    const request = buildPayoutRequest({ method: 'paypal', value: '@anna', amount: 12.50, currency: 'USD', lang, note: 'Cena & amici', fromName: 'Marco #2', momentumLink: 'https://example.com/#join=test' });
    assert.equal(request.currency, 'USD');
    assert.equal(request.link, 'https://paypal.me/anna/12.50USD');
    assert.ok(!request.message.includes('€'));
    assert.ok(request.message.includes('Marco #2'));
    const wa = new URL(`https://wa.me/?text=${encodeURIComponent(request.message)}`);
    assert.equal(wa.searchParams.get('text'), request.message);
    assert.ok(request.message.includes('Momentum'));
  }
});

test('payment links reject impersonated hosts and replace stale PayPal amounts', () => {
  for (const value of ['https://paypal.me.evil.test/name', 'https://evil.test/name', 'javascript:alert(1)', 'https://name:secret@paypal.me/name', 'http://paypal.me/name']) assert.equal(buildPayoutLink('paypal', value, 10), null, value);
  assert.equal(buildPayoutLink('paypal', 'https://paypal.me/anna/20EUR', 12.5, 'USD'), 'https://paypal.me/anna/12.50USD');
  assert.equal(buildPayoutLink('other', 'javascript:alert(1)', 10), null);
  assert.equal(buildPayoutLink('revolut', 'https://revolut.me/anna', 10), 'https://revolut.me/anna');
  for (const amount of [NaN, Infinity, -1, 0, 'words']) assert.throws(() => buildPayoutRequest({ amount }));
});

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

test('buildPayoutRequest: senza momentumLink → firma testuale, un solo URL (il pay-link)', () => {
  const r = buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, fromName: 'Anna' });
  assert.match(r.message, new RegExp(PAYOUT_BRAND_SIGNATURE.slice(2, 20)));
  const urls = r.message.match(/https?:\/\/\S+/g) || [];
  assert.equal(urls.length, 1);
  assert.match(urls[0], /paypal\.me/);
  assert.ok(!buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, brand: false }).message.includes('Momentum'));
});

test('buildPayoutRequest: con momentumLink → 2 link ETICHETTATI e distinti (paga qui vs vedi su Momentum)', () => {
  const r = buildPayoutRequest({ method: 'paypal', value: 'giorgio', amount: 20, fromName: 'Anna', momentumLink: 'https://x.y/?join=MSPLIT1:abc' });
  // pay-link sotto "Puoi pagarmi qui:"
  assert.match(r.message, /Puoi pagarmi qui:\nhttps:\/\/paypal\.me\/giorgio\/20\.00EUR/);
  // link Momentum etichettato e separato
  assert.match(r.message, /Vedi la tua parte\nhttps:\/\/x\.y\/\?join=/);
  const urls = r.message.match(/https?:\/\/\S+/g) || [];
  assert.equal(urls.length, 2);
  assert.equal(r.momentumLink, 'https://x.y/?join=MSPLIT1:abc');
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
