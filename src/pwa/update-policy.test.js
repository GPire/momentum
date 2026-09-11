import test from 'node:test';
import assert from 'node:assert/strict';
import { checksCanonicalVersion, claimVersionReload } from './update-policy.js';

test('preview deployments never compare themselves with production', () => {
  for (const origin of ['https://ede2fb86.momentum-finance.pages.dev', 'https://codex-public-release-foundation.momentum-finance.pages.dev', 'https://momentum-finance.pages.dev', 'https://demo.example.com', 'capacitor://localhost', 'http://127.0.0.1:5173', 'https://branch--legacy.netlify.app']) {
    assert.equal(checksCanonicalVersion(origin), false, origin);
  }
});
test('legacy Netlify production mirrors retain their canonical check', () => {
  assert.equal(checksCanonicalVersion('https://legacy.netlify.app'), true);
  for (const origin of ['invalid', 'http://legacy.netlify.app', 'https://legacy.netlify.app.evil.test']) assert.equal(checksCanonicalVersion(origin), false);
});
test('a stale bundle cannot cause a reload loop, even if the remote changes again', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(claimVersionReload(storage, 'v1', 'v2'), true);
  assert.equal(claimVersionReload(storage, 'v1', 'v2'), false);
  assert.equal(claimVersionReload(storage, 'v1', 'v3'), false);
  assert.equal(claimVersionReload(storage, 'v2', 'v3'), true);
});
test('equal, absent or malformed versions never request a reload', () => {
  const storage = { getItem() { throw new Error('must not read'); } };
  for (const value of ['v1', '', null, undefined, {}, 123]) assert.equal(claimVersionReload(storage, 'v1', value), false);
});
test('blocked session storage does not trap the user in reloads', () => {
  assert.equal(claimVersionReload(null, 'v1', 'v2'), false);
  assert.equal(claimVersionReload({ getItem: () => null, setItem() { throw new Error('quota'); } }, 'v1', 'v2'), false);
});
