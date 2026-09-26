// Riscrive src/i18n/italian-debt-baseline.json coi valori attuali, SOLO al
// ribasso: un file che è cresciuto fa fallire lo script invece di alzare il tetto.
import { readFileSync, writeFileSync } from 'node:fs';
import { findItalianStringsWide } from './italian-strings-wide.mjs';

const path = 'src/i18n/italian-debt-baseline.json';
const base = JSON.parse(readFileSync(path, 'utf8'));
const out = {};
const cresciuti = [];
for (const [file, tetto] of Object.entries(base)) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  const n = findItalianStringsWide(src).length;
  if (n > tetto) cresciuti.push(`${file}: ${n} > ${tetto}`);
  if (n > 0) out[file] = Math.min(n, tetto);
}
if (cresciuti.length) { console.error(cresciuti.join('\n')); process.exit(1); }
writeFileSync(path, JSON.stringify(out, null, 1) + '\n');
const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log(`debito: ${tot(base)} -> ${tot(out)} in ${Object.keys(out).length} file`);
