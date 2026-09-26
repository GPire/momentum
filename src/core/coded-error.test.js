import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { t, UI_LANGS } from '../i18n/ui-strings.js';
import { codedError } from './coded-error.js';

test('codedError: messaggio, codice e parametri', () => {
  const e = codedError('rsNeed', [2, 1], 'Servono 2 pezzi');
  assert.equal(e.message, 'Servono 2 pezzi');
  assert.equal(e.code, 'rsNeed');
  assert.deepEqual(e.params, [2, 1]);
});

test('ogni codice di errore usato in src/ ha il testo nelle 7 lingue', () => {
  const root = new URL('../', import.meta.url);
  const codici = new Set();
  for (const f of readdirSync(root, { recursive: true })) {
    if (!f.endsWith('.js') || f.endsWith('.test.js')) continue;
    const src = readFileSync(new URL(f, root), 'utf8');
    for (const m of src.matchAll(/codedError\('([A-Za-z0-9]+)'/g)) codici.add(m[1]);
  }
  assert.ok(codici.size >= 10);
  for (const c of codici) for (const lang of UI_LANGS) {
    assert.notEqual(t(`err_${c}`, lang, 1, 2), `err_${c}`, `${lang}/${c}`);
  }
});
