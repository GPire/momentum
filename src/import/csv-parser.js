import { monthKey } from '../core/constants.js';
import { levenshtein, logETL } from '../core/utils.js';
import { getCatById, VaultDAO } from '../core/vault.js';
import { showSignatureAlert, showToast } from '../ui/feedback.js';
import { NeuralNexus } from '../ai/neural-nexus.js';
import { parseCellAmount, COLUMN_KEYWORDS } from './pdf-parser.js';
import { parseRevolutExport, isRevolutExport } from './revolut-csv.js';

// ==========================================
// CSV PARSING & QUANTUM DEDUPLICATION
// ==========================================
const handleUniversalCSV = (e) => {
  const input = e.target; // riferimento all'<input type=file> per azzerarlo dopo
  const file = input.files[0]; if(!file) return; const reader = new FileReader();
  logETL(`Inizio parsing CSV: ${file.name}...`);

  reader.onload = (ev) => {
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
        // categoria: quella del parser (MCC/asset) ha precedenza; altrimenti ML.
        let catId = t.category;
        if (!catId) {
          const ml = window.momentumOrchestrator
            ? window.momentumOrchestrator.classify(t.description, t.amount, t.date)
            : NeuralNexus.predict(t.description, t.amount, t.date);
          catId = ml && ml.confidence > 60 ? ml.cat : (t.type === 'entrata' ? 'stipendio' : 'spesa');
        }
        const cat = getCatById(catId) || getCatById('spesa');
        const newTx = { id: Date.now() + Math.random(), amount: t.amount, type: t.type, category: cat.id, description: t.description, color: cat.color, date: t.date.toISOString(), externalId: t.externalId || '' };
        const { duplicate } = VaultDAO.addTransaction(k, newTx, { bulk: true }); // bulk: no save per-riga
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
                let catId = type === 'entrata' ? 'stipendio' : 'spesa';
                const prediction = window.momentumOrchestrator
                  ? window.momentumOrchestrator.classify(descVal, amountVal, dObj)
                  : NeuralNexus.predict(descVal, amountVal, dObj);
                if (prediction && prediction.confidence > 40) {
                  catId = prediction.cat;
                }
                
                const newTx = { id: Date.now() + Math.random(), amount: amountVal, type, category: catId, description: descVal.substring(0, 40), color: getCatById(catId).color, date: dObj.toISOString() };
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
  };
  reader.readAsText(file);
};


export { handleUniversalCSV };
