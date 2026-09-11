import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themePreference, themeIsDark } from './theme-preference.js';
test('fresh profiles follow device; legacy explicit choices survive migration', () => {
  assert.equal(themePreference({}), 'system');
  assert.equal(themePreference({themeDark:false}), 'light');
  assert.equal(themePreference({themeDark:true}), 'dark');
  assert.equal(themePreference({themePreference:'system',themeDark:true}), 'system');
  assert.equal(themePreference({themePreference:'invalid',themeDark:false}), 'light');
});
test('OS changes affect only system preference', () => {
  for (const systemDark of [false,true]) {
    assert.equal(themeIsDark('system',systemDark),systemDark);
    assert.equal(themeIsDark('light',systemDark),false);
    assert.equal(themeIsDark('dark',systemDark),true);
  }
});
