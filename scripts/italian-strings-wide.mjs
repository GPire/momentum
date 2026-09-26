// Misura larga del debito di traduzione: qualunque stringa (apici, virgolette,
// template) con parole italiane frequenti, in ogni modulo di src/. Più ampia di
// italian-ui-strings.mjs, quindi conta anche falsi positivi (liste di parole
// chiave per riconoscere scontrini italiani, messaggi di console, testi
// mostrati solo con l'interfaccia in italiano). Serve come tetto che scende,
// non come elenco da azzerare alla cieca.
import { readFileSync } from 'node:fs';

const PAROLE = /\b(il|la|le|gli|dei|delle|della|per|con|non|sono|questo|questa|tuoi|tua|tuo|nel|nella|alla|anche|ancora|puoi|devi|serve|servono|già|più|ogni|quando|spese|mese|entrate|movimenti|pezzi)\b/i;

export function findItalianStringsWide(source) {
  const out = [];
  const lines = source.split('\n');
  let inBlock = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    if (/console\.(log|warn|error|info|debug)\(/.test(line)) return;
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).){8,}?)\1/g)) {
      const s = m[2];
      if (PAROLE.test(s) && /\s\S+\s/.test(s)) out.push({ line: i + 1, text: s.slice(0, 100) });
    }
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    const r = findItalianStringsWide(readFileSync(f, 'utf8'));
    if (process.env.VERBOSE) for (const x of r) console.log(`${f}:${x.line}: ${x.text}`);
    else if (r.length) console.log(`${r.length}\t${f}`);
  }
}
