import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findItalianUiStrings } from '../../scripts/italian-ui-strings.mjs';

// Testi visibili scritti in italiano direttamente nel codice. Il tetto può solo
// scendere: ogni testo nuovo passa dalle traduzioni nelle 7 lingue.
// Per vedere l'elenco: VERBOSE=1 node scripts/italian-ui-strings.mjs src/main.js
const TETTO = { 'src/main.js': 0, 'index.html': 0 };

for (const [file, tetto] of Object.entries(TETTO)) {
  test(`${file}: nessun nuovo testo solo in italiano (tetto ${tetto})`, () => {
    const trovati = findItalianUiStrings(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
    assert.ok(trovati.length <= tetto, `${trovati.length} testi solo in italiano, tetto ${tetto}. Nuovi: usa tCh() con le 7 lingue.`);
  });
}

// Misura larga (ogni stringa con parole italiane in ogni modulo di src/): il
// debito esistente è fotografato in italian-debt-baseline.json e può solo
// scendere. Quando un file scende, abbassa il suo numero nel file.
import { findItalianStringsWide } from '../../scripts/italian-strings-wide.mjs';
const BASE = JSON.parse(readFileSync(new URL('./italian-debt-baseline.json', import.meta.url), 'utf8'));
test('moduli di src/: il debito di traduzione non cresce in nessun file', () => {
  const cresciuti = [];
  for (const [file, tetto] of Object.entries(BASE)) {
    let src;
    try { src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'); } catch { continue; }
    const n = findItalianStringsWide(src).length;
    if (n > tetto) cresciuti.push(`${file}: ${n} > ${tetto}`);
  }
  assert.deepEqual(cresciuti, [], 'Nuovi testi solo in italiano: usa le traduzioni nelle 7 lingue.');
});

import { readdirSync } from 'node:fs';
test('moduli nuovi di src/: nessun testo solo in italiano', () => {
  const root = new URL('../../src/', import.meta.url);
  const nuovi = readdirSync(root, { recursive: true })
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && !f.startsWith('i18n/') && !(`src/${f}` in BASE))
    .filter((f) => findItalianStringsWide(readFileSync(new URL(f, root), 'utf8')).length > 0);
  assert.deepEqual(nuovi, []);
});
