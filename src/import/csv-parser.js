import { parseCellAmount, parseCellDate, COLUMN_KEYWORDS } from './pdf-parser.js';
import { parseCsvRow } from './revolut-csv.js';

// ==========================================
// CSV PARSING & QUANTUM DEDUPLICATION
// ==========================================

// Importo ROBUSTO: gestisce ciò che rompe gli altri parser — valuta (€$£¥),
// negativi tra PARENTESI "(1.234,56)" (contabilità), segno in coda "12,00-",
// entrambe le convenzioni decimali. Ritorna number firmato o null.
function robustAmount(s) {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }        // (123,45) = negativo
  if (/[-−]\s*$/.test(t)) { neg = true; }                            // "12,00-" segno in coda
  const v = parseCellAmount(t);                                      // gestisce €, . , e segno davanti
  if (v === null) return null;
  return neg ? -Math.abs(v) : v;
}
// Una cella "sembra" una data / un importo / testo? (per l'inferenza colonne)
const looksDate = (s) => !!parseCellDate(String(s || ''));
const looksAmount = (s) => { const t = String(s || '').trim(); return /\d/.test(t) && /[.,]\d{1,2}\)?\s*[-−]?$|^\(?\s*[-−+]?\s*[€$£¥]?\s*\d/.test(t) && robustAmount(t) !== null; };
const looksText = (s) => { const t = String(s || '').trim(); return t.length >= 2 && /[a-zà-ü]{2,}/i.test(t) && !looksAmount(t) && !looksDate(t); };
const DC_DEBIT = /^(d|dr|debit|debito|dare|-|out|uscita)$/i;
const DC_CREDIT = /^(c|cr|credit|credito|avere|\+|in|entrata)$/i;

// Parser CSV GENERICO ULTRA — architettura a INFERENZA DI CONTENUTO. Non si
// affida solo agli header (che variano per banca/lingua o mancano): analizza le
// COLONNE sui dati reali e deduce quale è data, importo, descrizione, e la
// direzione (colonna firmata, oppure Dare/Avere, oppure indicatore D/C).
// Risolve i problemi tipici del settore: header sconosciuti/assenti, delimitatore
// vario, virgolette con delimitatori interni, date/importi in mille formati,
// negativi tra parentesi, colonna saldo da ignorare. Ritorna transazioni
// normalizzate [{date:Date, amount:+num, type, description}].
export function parseGenericCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = [';', '\t', ',', '|'].map(d => ({ d, n: (lines[0].split(d).length - 1) })).sort((a, b) => b.n - a.n)[0].d || ',';
  const rows = lines.map(l => parseCsvRow(l, delim).map(c => c.replace(/^"|"$/g, '').trim()));
  const nCol = Math.max(...rows.map(r => r.length));
  if (nCol < 2) return [];

  // La prima riga è un header? (celle in gran parte testo non-numerico)
  const first = rows[0];
  const firstIsHeader = first.filter(c => looksText(c) && !looksAmount(c) && !looksDate(c)).length >= Math.ceil(nCol / 2);
  const header = firstIsHeader ? first.map(h => h.toLowerCase()) : null;
  const dataRows = firstIsHeader ? rows.slice(1) : rows;
  if (!dataRows.length) return [];

  // 1) Header hint (se presente): quale colonna è cosa.
  let dateCol = -1, descCol = -1, amountCol = -1, debitCol = -1, creditCol = -1, dcCol = -1, ignoreCols = new Set();
  if (header) header.forEach((h, i) => {
    if (COLUMN_KEYWORDS.ignore.test(h)) { ignoreCols.add(i); return; }
    if (dateCol < 0 && COLUMN_KEYWORDS.date.test(h)) dateCol = i;
    else if (descCol < 0 && COLUMN_KEYWORDS.desc.test(h)) descCol = i;
    else if (amountCol < 0 && /(importo|ammontare|cifra|amount|montant|betrag|valor|importe)/i.test(h)) amountCol = i;
    else if (debitCol < 0 && /(addebit|uscit|dare|debit|débit|soll|cargo)/i.test(h)) debitCol = i;
    else if (creditCol < 0 && /(accredit|entrat|avere|credit|crédit|haben|abono)/i.test(h)) creditCol = i;
    else if (dcCol < 0 && /(segno|d\/c|dare\/avere|tipo|type|sign)/i.test(h)) dcCol = i;
  });

  // 2) INFERENZA da contenuto per ciò che gli header non hanno dato: si valuta
  // ogni colonna sui dati (quota di celle che sembrano data / importo / testo).
  const N = Math.min(dataRows.length, 200);
  const score = Array.from({ length: nCol }, () => ({ date: 0, amount: 0, text: 0, len: 0, neg: 0, filled: 0 }));
  for (let r = 0; r < N; r++) for (let c = 0; c < nCol; c++) {
    const v = dataRows[r][c]; if (v == null || v === '') continue;
    const s = score[c]; s.filled++;
    if (looksDate(v)) s.date++;
    if (looksAmount(v)) { s.amount++; const a = robustAmount(v); if (a !== null && a < 0) s.neg++; }
    if (looksText(v)) { s.text++; s.len += String(v).length; }
  }
  const ratio = (c, k) => score[c].filled ? score[c][k] / score[c].filled : 0;
  const pickBy = (metric, exclude) => { let best = -1, bv = 0.5; for (let c = 0; c < nCol; c++) { if (exclude.has(c)) continue; const v = metric(c); if (v > bv) { bv = v; best = c; } } return best; };

  if (dateCol < 0) dateCol = pickBy(c => ratio(c, 'date'), new Set([...ignoreCols]));
  const used = new Set([dateCol, descCol, amountCol, debitCol, creditCol, dcCol, ...ignoreCols].filter(i => i >= 0));
  // colonne monetarie: se header non le ha date, prendi quelle a contenuto-importo
  if (amountCol < 0 && debitCol < 0 && creditCol < 0) {
    const moneyCols = [];
    for (let c = 0; c < nCol; c++) { if (used.has(c)) continue; if (ratio(c, 'amount') >= 0.6) moneyCols.push(c); }
    if (moneyCols.length === 1) amountCol = moneyCols[0];
    else if (moneyCols.length >= 2) {
      // due colonne monetarie → probabile Dare/Avere: quella con più negativi/
      // più piena a sinistra = debito. Euristica: ordina per posizione.
      const [a, b] = moneyCols.sort((x, y) => x - y);
      debitCol = a; creditCol = b;
    }
    moneyCols.forEach(c => used.add(c));
  }
  if (descCol < 0) descCol = pickBy(c => (used.has(c) ? 0 : ratio(c, 'text') * Math.min(1, (score[c].text ? score[c].len / score[c].text : 0) / 12)), used);

  // 3) Estrazione riga per riga.
  const out = [];
  for (const cols of dataRows) {
    if (cols.length < 2) continue;
    const dateRaw = dateCol >= 0 ? cols[dateCol] : (cols.find(looksDate) || '');
    const date = parseCellDate(dateRaw || '');
    if (!date) continue;

    let signed = null;
    if (amountCol >= 0) signed = robustAmount(cols[amountCol]);
    else if (debitCol >= 0 || creditCol >= 0) {
      const dv = debitCol >= 0 ? robustAmount(cols[debitCol]) : null;
      const cv = creditCol >= 0 ? robustAmount(cols[creditCol]) : null;
      if (dv !== null && Math.abs(dv) > 0) signed = -Math.abs(dv);
      else if (cv !== null && Math.abs(cv) > 0) signed = Math.abs(cv);
    }
    if (signed === null) { // fallback: prima cella importo-like non-data
      for (let c = 0; c < cols.length; c++) { if (c === dateCol) continue; const a = robustAmount(cols[c]); if (a !== null && looksAmount(cols[c])) { signed = a; break; } }
    }
    if (signed === null || signed === 0) continue;

    // direzione: colonna indicatore D/C se presente, altrimenti il segno.
    let type = signed < 0 ? 'uscita' : 'entrata';
    if (dcCol >= 0 && cols[dcCol]) { if (DC_DEBIT.test(cols[dcCol].trim())) type = 'uscita'; else if (DC_CREDIT.test(cols[dcCol].trim())) type = 'entrata'; }

    let desc = descCol >= 0 ? cols[descCol] : (cols.find(c => looksText(c)) || 'Operazione');
    out.push({ date, amount: Math.abs(signed), type, description: String(desc || 'Operazione').slice(0, 60) });
  }
  return out;
}

// handleUniversalCSV è stata rimossa: era importata in main.js e mai
// chiamata (la pipeline vera è import/multi-import.js → parseCsvFile, che
// usa questo stesso parseGenericCsv). Aveva una propria SECONDA logica di
// dedup (Levenshtein grezzo < 5, soglia diversa da quella centralizzata in
// core/deduplicator.js) — due fonti di verità sullo stesso problema che
// potevano disaccordare sullo stesso caso, mai verificata da nessun test
// perché nessun codice la raggiungeva.
