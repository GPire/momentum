import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPersonalBundleBoundary as check } from './personal-bundle-boundary.mjs';

const chunk = (fileName, module, imports = [], isEntry = false) => ({
  type: 'chunk', fileName, modules: { [module]: {} }, imports, isEntry,
});
test('personal trips remain available while company client code is deferred', () => {
  const app = chunk('app.js', '/repo/src/trips/trip-engine.js', [], true);
  app.dynamicImports = ['company.js'];
  assert.doesNotThrow(() => check({ app, company: chunk('company.js', '/repo/src/trips/company-submit.js') }));
});
test('rejects company code through a shared static chunk and handles cycles', () => {
  const bundle = {
    app: chunk('app.js', '/repo/src/main.js', ['shared.js'], true),
    shared: chunk('shared.js', '/repo/src/core/vault.js', ['app.js', 'company.js']),
    company: chunk('company.js', 'C:\\repo\\src\\trips\\company-attachments.js'),
  };
  assert.throws(() => check(bundle), /eagerly loaded/);
  assert.doesNotThrow(() => check(bundle, { singlefile: true }));
});
test('server and authentication code cannot enter even lazy or singlefile chunks', () => {
  for (const module of ['/repo/server/company/worker.js', '/repo/server/auth/auth.js', '/repo/node_modules/better-auth/dist/index.js', '/repo/node_modules/@better-auth/passkey/dist/index.js']) {
    for (const singlefile of [false, true]) {
      assert.throws(() => check({ auth: chunk('auth.js', module) }, { singlefile }), /Server authentication/);
    }
  }
});
