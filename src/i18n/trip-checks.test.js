import test from 'node:test';
import assert from 'node:assert/strict';
import { tripChecksCopy, tripIssueLabel } from './trip-checks.js';

const LANGS = ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt'];

test('tripChecksCopy: tutte le 7 lingue hanno lo stesso numero di voci (nessuna dimenticata durante un\'aggiunta)', () => {
  const lengths = LANGS.map(lang => {
    let i = 0;
    while (tripChecksCopy(lang, i) !== undefined) i++;
    return i;
  });
  assert.ok(lengths.every(n => n === lengths[0]), `lunghezze diverse fra lingue: ${JSON.stringify(lengths)}`);
});

test('tripIssueLabel: "duplicate_receipt" (anti-frode allegato riusato) risolve un testo reale in tutte le 7 lingue, mai "undefined"', () => {
  for (const lang of LANGS) {
    const label = tripIssueLabel(lang, 'duplicate_receipt');
    assert.equal(typeof label, 'string');
    assert.ok(label.length > 0, `lingua ${lang}: etichetta vuota`);
  }
});

test('tripIssueLabel: ogni codice reale prodotto da inspectTripArchive risolve un testo, nessuno cade nel buco "undefined"', () => {
  const codici = ['missing_attachment', 'missing_id', 'duplicate_id', 'invalid_amount', 'invalid_date', 'duplicate_receipt', 'invalid_attachment', 'revision_conflict', 'policy_limit', 'policy_currency', 'invalid_policy', 'policy_daily'];
  for (const code of codici) {
    const label = tripIssueLabel('it', code);
    assert.notEqual(label, undefined, `codice "${code}" non risolve alcuna etichetta`);
  }
});
