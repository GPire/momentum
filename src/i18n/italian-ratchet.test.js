import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findItalianUiStrings } from '../../scripts/italian-ui-strings.mjs';

// Testi visibili scritti in italiano direttamente nel codice. Il tetto può solo
// scendere: ogni testo nuovo passa dalle traduzioni nelle 7 lingue.
// Per vedere l'elenco: VERBOSE=1 node scripts/italian-ui-strings.mjs src/main.js
const TETTO = { 'src/main.js': 0, 'index.html': 32 };

for (const [file, tetto] of Object.entries(TETTO)) {
  test(`${file}: nessun nuovo testo solo in italiano (tetto ${tetto})`, () => {
    const trovati = findItalianUiStrings(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
    assert.ok(trovati.length <= tetto, `${trovati.length} testi solo in italiano, tetto ${tetto}. Nuovi: usa tCh() con le 7 lingue.`);
  });
}
