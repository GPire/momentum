import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrigin, recordOrigin, resolveShareBase, buildShareUrl } from './share-base.js';

test('normalizeOrigin: estrae l\'origine pulita, o null', () => {
  assert.equal(normalizeOrigin('https://momentum.app/'), 'https://momentum.app');
  assert.equal(normalizeOrigin('https://x.y:8080/app/?a=1'), 'https://x.y:8080');
  assert.equal(normalizeOrigin('non-un-url'), null);
  assert.equal(normalizeOrigin(''), null);
});

test('recordOrigin: impara e conta le origini viste (immutabile)', () => {
  let s = {};
  s = recordOrigin(s, 'https://momentum.app', 1000);
  s = recordOrigin(s, 'https://momentum.app', 2000);
  s = recordOrigin(s, 'https://mirror.dev', 1500);
  assert.equal(s['https://momentum.app'].count, 2);
  assert.equal(s['https://momentum.app'].last, 2000);
  assert.equal(s['https://mirror.dev'].count, 1);
});

test('resolveShareBase: override esplicito (deploy/utente) vince su tutto', () => {
  const base = resolveShareBase({ shareBase: 'https://momentum.app/' }, 'http://localhost:5173');
  assert.equal(base, 'https://momentum.app');
});

test('resolveShareBase: senza override usa l\'origine corrente', () => {
  assert.equal(resolveShareBase({}, 'http://localhost:5173'), 'http://localhost:5173');
});

test('resolveShareBase: preferisce l\'origine imparata più stabile (≥2 avvii)', () => {
  const state = { shareOrigins: { 'https://momentum.app': { count: 5, last: 3000 }, 'https://tmp.dev': { count: 1, last: 5000 } } };
  // anche se ora giro su un host effimero, i link puntano al dominio stabile
  assert.equal(resolveShareBase(state, 'https://tmp-preview-123.vercel.app'), 'https://momentum.app');
});

test('resolveShareBase: un\'origine vista una volta NON scavalca quella corrente', () => {
  const state = { shareOrigins: { 'https://visto-una-volta.dev': { count: 1, last: 9999 } } };
  assert.equal(resolveShareBase(state, 'https://momentum.app'), 'https://momentum.app');
});

test('buildShareUrl: compone base risolta + codice, un solo slash', () => {
  const url = buildShareUrl({ shareBase: 'https://momentum.app' }, 'http://localhost', 'MSPLIT1:abc', '/');
  assert.equal(url, 'https://momentum.app/?join=MSPLIT1%3Aabc');
});
