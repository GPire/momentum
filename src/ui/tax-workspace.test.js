import test from 'node:test';
import assert from 'node:assert/strict';
import { taxWorkspaceCountry } from './tax-workspace.js';
import { t as tCh, UI_LANGS } from '../i18n/ui-strings.js';

test('explicit country wins over configurations retained for other countries', () => {
  for (const country of ['it', 'ch', 'es']) {
    const state = Object.freeze({ taxActiveCountry: country, taxRegime: 'forfettario', esActive: true });
    assert.equal(taxWorkspaceCountry(state), country);
    assert.equal(state.taxRegime, 'forfettario');
  }
});
test('legacy archives keep their existing Italian or Spanish view', () => {
  assert.equal(taxWorkspaceCountry({ taxRegime: 'ordinario', esActive: true }), 'it');
  assert.equal(taxWorkspaceCountry({ esActive: true }), 'es');
  assert.equal(taxWorkspaceCountry(), 'it');
  assert.equal(taxWorkspaceCountry({ taxActiveCountry: 'unknown', esActive: true }), 'es');
});
test('entry instructions and country names exist in every supported interface language', () => {
  for (const lang of UI_LANGS) {
    for (const key of ['taxStartChoiceHint', 'taxStartRegistered', 'taxStartConsidering', 'vaultTaxSubtitle', 'vaultTaxItalyTitle', 'vaultTaxSwissTitle', 'vaultTaxSpainTitle']) {
      assert.ok(tCh(key, lang)?.length > 0, `${lang}/${key}`);
      assert.notEqual(tCh(key, lang), key, `${lang}/${key}`);
    }
  }
});
