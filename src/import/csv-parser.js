import { monthKey } from '../core/constants.js';
import { levenshtein, logETL } from '../core/utils.js';
import { getCatById, VaultDAO } from '../core/vault.js';
import { showSignatureAlert, showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';
import { parseCellAmount, parseCellDate, COLUMN_KEYWORDS } from './pdf-parser.js';
import { parseRevolutExport, isRevolutExport, parseCsvRow } from './revolut-csv.js';
import { safeCategorize } from './categorize.js';

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

const handleUniversalCSV = (e) => {
  const input = e.target; // riferimento all'<input type=file> per azzerarlo dopo
  const file = input.files[0]; if(!file) return; const reader = new FileReader();
  try { logETL(`Inizio parsing CSV: ${file.name}...`); } catch (_) {}
  reader.onerror = () => { try { showToast('Impossibile leggere il file.', 'error'); } catch (_) {} };

  reader.onload = (ev) => {
   try {
    // \r?\n: gli estratti conto Windows usano CRLF; senza questo ogni riga
    // porta un \r finale che sporca l'ultima colonna (date/importi non parsati).
    const text = ev.target.result; const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if(lines.length < 2) { logETL("Errore: CSV vuoto.", true); return showToast("CSV vuoto", "error"); }

    // Percorso DEDICATO export Revolut (schema ricco): riconosce investimenti
    // azionari/crypto, dividendi, interessi, depositi e spese (categoria via MCC),
    // col verso giusto (entrata/uscita/invest). Verificato su file reali.
    if (isRevolutExport(lines[0])) {
      let addedR = 0, skippedR = 0;
      // Indice degli id già presenti → dedup ESATTA (niente doppio inserimento
      // se il file è già stato caricato, anche parzialmente).
      const seenIds = new Set();
      for (const m of Object.values(VaultDAO.state.transactions)) for (const tx of m) if (tx.externalId) seenIds.add(tx.externalId);
      for (const t of parseRevolutExport(text)) {
        if (!t.date || !t.amount) continue;
        if (t.externalId && seenIds.has(t.externalId)) { skippedR++; continue; } // già importata
        if (t.externalId) seenIds.add(t.externalId);
        const k = monthKey(t.date);
        // categoria: quella del parser (MCC/asset) ha precedenza; altrimenti
        // categorizzazione SICURA (dizionario + ML con guardrail).
        const catId = t.category || safeCategorize(t.description, t.amount, t.date, t.type);
        const cat = getCatById(catId) || getCatById('spesa');
        const newTx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: t.date.toISOString(), externalId: t.externalId || '' };
        // noDedup quando c'è un transaction_id fidato: la dedup esatta è già
        // fatta col Set di externalId sopra; evita che la fuzzy fonda distinti.
        const { duplicate } = VaultDAO.addTransaction(k, newTx, { bulk: true, noDedup: !!t.externalId });
        if (!duplicate) addedR++;
      }
      VaultDAO.save(); // UN solo salvataggio alla fine (evita O(n²) su file grandi)
      if (input) input.value = '';
      if (addedR > 0) { window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()); showSignatureAlert("Revolut importato", `${addedR} operazioni riconosciute (investimenti, dividendi, spese)${skippedR ? `; ${skippedR} già presenti, saltate` : ''}.`); }
      else showToast(skippedR ? `Tutte le ${skippedR} operazioni erano già presenti (nessun doppione).` : "Nessuna operazione trovata.", "info");
      return;
    }

    // Delimitatore per FREQUENZA nell'header (non solo ';' vs ','): molti
    // export bancari usano il TAB o il ';'. Prima si sceglieva sempre ',' se
    // non c'era ';' → un file tab-separato dava 1 colonna e 0 righe importate
    // ("prende 1 valore su 2000"). Ora si conta e si prende il più frequente.
    const delim = [';', '\t', ',', '|'].map(d => ({ d, n: (lines[0].split(d).length - 1) })).sort((a, b) => b.n - a.n)[0].d || ',';
    let added = 0;
    let existingTxs = []; Object.keys(VaultDAO.state.transactions).forEach(m => existingTxs.push(...VaultDAO.state.transactions[m]));

    const headers = lines[0].split(delim).map(h => h.replace(/["']/g, '').trim().toLowerCase());
    let dateIdx = -1, descIdx = -1, amountIdx = -1, expenseIdx = -1, incomeIdx = -1;

    headers.forEach((h, idx) => {
      // 'saldo'/'totale' ESCLUSI: sono il saldo progressivo, non l'importo del
      // movimento — prenderli faceva importare il balance al posto della spesa.
      if (COLUMN_KEYWORDS.ignore.test(h)) return; // colonna saldo/balance → ignorata
      if (COLUMN_KEYWORDS.date.test(h)) dateIdx = idx;
      else if (COLUMN_KEYWORDS.desc.test(h)) descIdx = idx;
      else if (/(importo|ammontare|cifra|cassa|valore)/i.test(h)) amountIdx = idx;
      else if (/(addebito|uscita|spesa|addebiti|dare)/i.test(h)) expenseIdx = idx;
      else if (/(accredito|entrata|accrediti|avere)/i.test(h)) incomeIdx = idx;
    });

    lines.slice(1).forEach(line => {
       const cols = line.split(delim).map(c => c.replace(/["']/g, '').trim());
       if (cols.length < 2) return;

       let dateStr = '';
       let descVal = 'Operazione Importata';
       let amountVal = null;
       let isExpense = true;

       if (dateIdx !== -1 && cols[dateIdx]) dateStr = cols[dateIdx];
       if (descIdx !== -1 && cols[descIdx]) descVal = cols[descIdx];

       if (amountIdx !== -1 && cols[amountIdx]) {
         const parsed = parseCellAmount(cols[amountIdx]);
         if (parsed !== null) {
           amountVal = Math.abs(parsed);
           isExpense = parsed < 0;
         }
       } else if (expenseIdx !== -1 || incomeIdx !== -1) {
         const expVal = expenseIdx !== -1 && cols[expenseIdx] ? parseCellAmount(cols[expenseIdx]) : null;
         const incVal = incomeIdx !== -1 && cols[incomeIdx] ? parseCellAmount(cols[incomeIdx]) : null;
         if (expVal !== null && expVal !== 0) {
           amountVal = Math.abs(expVal);
           isExpense = true;
         } else if (incVal !== null && incVal !== 0) {
           amountVal = Math.abs(incVal);
           isExpense = false;
         }
       }

       // Fallbacks
       if (!dateStr) {
         dateStr = cols.find(c => /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(c) || /^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(c)) || '';
       }
       if (amountVal === null) {
         const rawAmt = cols.find(c => /^-?\d+([.,]\d{1,2})?$/.test(c) || /^-?\d{1,3}([.,]\d{3})*([.,]\d{2})?$/.test(c));
         if (rawAmt) {
           const parsed = parseCellAmount(rawAmt);
           if (parsed !== null) {
             amountVal = Math.abs(parsed);
             isExpense = parsed < 0;
           }
         }
       }
       if (descVal === 'Operazione Importata' || !descVal) {
         descVal = cols.find(c => c !== dateStr && isNaN(parseCellAmount(c))) || "Operazione Ledger";
       }

       if (dateStr && amountVal !== null && amountVal > 0) {
          let dObj = null;
          if (dateStr.includes('/')) {
            const p = dateStr.split('/');
            const year = p[2].length === 2 ? parseInt('20' + p[2]) : parseInt(p[2]);
            dObj = new Date(year, parseInt(p[1]) - 1, parseInt(p[0]));
          } else if (dateStr.includes('-')) {
            const p = dateStr.split('-');
            if (p[0].length === 4) {
              dObj = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
            } else {
              dObj = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
            }
          } else {
            dObj = new Date(dateStr);
          }

          if (dObj && !isNaN(dObj.getTime())) {
             const k = monthKey(dObj);
             const type = isExpense ? 'uscita' : 'entrata';
             
             const isDuplicate = existingTxs.some(t => {
                 if (t.amount === amountVal && t.type === type) {
                     const tDate = t.date ? new Date(t.date) : new Date();
                     const timeDiffHours = Math.abs(dObj.getTime() - tDate.getTime()) / 36e5;
                     return timeDiffHours <= 72 && levenshtein(t.description.toLowerCase(), descVal.toLowerCase()) < 5;
                 }
                 return false;
             });
             
             if (!isDuplicate) {
                const catId = safeCategorize(descVal, amountVal, dObj, type); // guardrail anti-crypto/etf spurie
                const cc = getCatById(catId) || getCatById('spesa');
                const newTx = { id: Date.now() + Math.random(), amount: amountVal, type, category: cc.id, description: descVal.substring(0, 40), color: cc.color, date: dObj.toISOString() };
                VaultDAO.addTransaction(k, newTx, { bulk: true }); // bulk: no save per-riga
                existingTxs.push(newTx);
                added++;
             }
          }
       }
    });
    if (added > 0) VaultDAO.save(); // UN solo salvataggio finale (niente O(n²) su CSV grandi)
    if(added > 0) {
        window.renderAfterImport ? window.renderAfterImport() : (window.renderDashboard?.(), window.renderAnalysis?.()); showSignatureAlert("ETL Completato", `Importate ${added} nuove operazioni.`);
    } else {
        showToast("Nessuna nuova operazione trovata nel CSV.", "info");
    }
    // Azzera l'input: senza questo, riselezionare un file (soprattutto LO STESSO)
    // non rilancia l'evento 'change' e sembra che l'import "non parta più".
    if (input) input.value = '';
   } catch (err) {
     // Qualunque errore nell'import non deve restare silenzioso (era la causa
     // per cui "l'import non faceva niente"): lo si mostra e si logga.
     console.error('Errore import CSV:', err);
     try { logETL('Errore import CSV: ' + (err?.message || err), true); } catch (_) {}
     try { showToast('Errore durante l\'import: ' + (err?.message || 'sconosciuto'), 'error'); } catch (_) {}
     if (input) input.value = '';
   }
  };
  reader.readAsText(file);
};


export { handleUniversalCSV };
