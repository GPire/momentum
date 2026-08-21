// ==========================================
// PDF BANK PARSER (COLUMN RESONANCE)
// ==========================================
// Cuore puro del parser: prende gli item di testo ({text, x, y}) di una
// pagina e restituisce le transazioni. Separato da processPageWithColumnMap
// (che fa solo l'estrazione via pdf.js) per essere testabile in Node con
// layout sintetici delle varie banche, senza PDF reali.
// Parser di CONFERME di singola transazione (Revolut, broker, wallet, ecc.):
// layout chiave-valore invece che a colonne. Estrae importo, data, descrizione,
// verso (entrata/uscita) e riconosce investimenti/acquisti di stock/crypto.
// `rows` = righe già raggruppate per y; `items` = item grezzi (per il full-text).
// Ritorna [] se non riconosce una conferma, o [tx] con la singola transazione.
// Regex STRETTE per evitare falsi positivi dai campi/boilerplate del documento
// (es. il campo Revolut "Payment Token" NON è crypto). Si applicano SOLO al
// testo significativo (descrizione/riferimento/beneficiario), mai all'intero PDF.
const CONFIRM_INVEST = /\b(shares?|stock|equity|etf|dividend|obbligazion|azioni)\b/i;
const CONFIRM_CRYPTO = /\b(crypto|bitcoin|btc|ethereum|eth|litecoin|solana|cardano|ripple|dogecoin|binance|coinbase|kraken)\b/i;
const CONFIRM_INCOMING = /\b(received|incoming|top.?up|refund|rimborso|ricevut|accredito|salary|stipendio|payout|cashback)\b/i;

const extractConfirmationTransaction = (rows, items) => {
  const fullText = items.map(i => i.text).join(' ');
  // Deve sembrare una conferma/ricevuta con un importo, non uno statement vuoto.
  const looksConfirmation = /(confirmation|receipt|conferma|ricevuta|transfer details|beneficiary|payment|transaction)/i.test(fullText)
    && /(amount|importo|total|totale|€|\$|£)/i.test(fullText);
  if (!looksConfirmation) return [];

  // Valore sulla stessa riga di un'etichetta: trova la riga con l'etichetta e
  // restituisce, tra gli item a x maggiore, quello che soddisfa `pick`.
  const valueFor = (labelRe, pick) => {
    for (const row of rows) {
      const li = row.findIndex(it => labelRe.test(it.text.trim()));
      if (li === -1) continue;
      for (let j = 0; j < row.length; j++) {
        if (j === li) continue;
        const v = pick(row[j].text.trim());
        if (v !== null && v !== undefined && v !== '') return v;
      }
    }
    return null;
  };

  // Importo: la riga con etichetta "Amount/Importo" (NON "Fee"). Prende il primo
  // valore monetario > 0 su quella riga.
  let amount = valueFor(/^(amount|importo|total|totale|importe|montant|betrag|valor)$/i, (t) => {
    const a = parseCellAmount(t); return (a !== null && Math.abs(a) > 0) ? Math.abs(a) : null;
  });
  // Fallback: il valore monetario più grande del documento (l'importo domina la fee).
  if (amount === null) {
    let best = 0;
    for (const it of items) { const a = parseCellAmount(it.text); if (a !== null && Math.abs(a) > best) best = Math.abs(a); }
    amount = best > 0 ? best : null;
  }
  if (amount === null) return [];

  // Data: preferisci "Operation/Value Date", poi qualunque data ISO/gg-mm nel testo.
  let date = valueFor(/^(operation date|value date|date|data|fecha|datum|booking date)$/i, (t) => parseCellDate(t));
  if (!date) { for (const it of items) { const d = parseCellDate(it.text); if (d) { date = d; break; } } }
  if (!date) date = new Date();

  // Descrizione: Reference/Details + beneficiario (Name). Combinati per dare al
  // categorizzatore il massimo segnale ("Pagamento Bolletta - IREN MERCATO SPA").
  const ref = valueFor(/^(reference|transfer details|details|causale|descrizione|concept|motivo|payment for)$/i, (t) => t && !/^€|^\$|^\d+[.,]\d/.test(t) ? t : null);
  const beneficiary = valueFor(/^(name|beneficiary|beneficiary details|payee|to|merchant|counterparty)$/i, (t) => t && t.length > 1 ? t : null);
  let description = [ref, beneficiary].filter(Boolean).join(' - ') || (ref || beneficiary || 'Operazione importata');

  // Verso + riconoscimento investimenti/stock/crypto — SOLO sul testo
  // significativo (ref + beneficiario), non sul boilerplate del documento.
  const signal = [ref, beneficiary].filter(Boolean).join(' ');
  let type = 'uscita';        // una conferma di trasferimento/pagamento è in uscita
  let category = null;
  if (CONFIRM_CRYPTO.test(signal)) { category = 'crypto'; type = 'uscita'; }
  else if (CONFIRM_INVEST.test(signal)) { category = 'etf'; type = 'uscita'; }
  else if (CONFIRM_INCOMING.test(signal)) { type = 'entrata'; }

  const tx = { date, amount, type, description: description.slice(0, 80) };
  if (category) tx.category = category; // suggerimento al categorizzatore a valle
  return [tx];
};

const extractTransactionsFromItems = (items) => {
  // Bug reale corretto: nello spazio PDF la y cresce verso l'ALTO, quindi
  // l'ordinamento ascendente processava le righe dal fondo pagina — l'header
  // veniva cercato dal basso e le righe senza data ereditavano la data della
  // riga SOTTO (processata prima) invece che della propria transazione sopra.
  // Ora si ordina per y discendente: prima riga = cima della pagina.
  const sorted = [...items].sort((a,b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let curRow = [];
  let lastY = null;
  const Y_TOL = 8;
  sorted.forEach(item => {
    if (lastY === null || Math.abs(item.y - lastY) <= Y_TOL) {
      curRow.push(item);
    } else {
      rows.push(curRow.sort((a,b) => a.x - b.x));
      curRow = [item];
    }
    lastY = item.y;
  });
  if (curRow.length) rows.push(curRow.sort((a,b) => a.x - b.x));

  const columnMap = detectColumnMap(rows);
  // Nessuna tabella riconosciuta: potrebbe essere una CONFERMA di singola
  // transazione (Revolut/broker: layout chiave-valore, non a colonne). Provo
  // il parser dedicato prima di arrendermi all'OCR.
  if (!columnMap || (columnMap.expense === -1 && columnMap.income === -1)) {
    return extractConfirmationTransaction(rows, items);
  }

  const transactions = [];
  let lastDate = null;

  for (const row of rows) {
    // Bug reale corretto: prima si scartava OGNI riga contenente una
    // parola chiave di colonna (es. "accredito", "addebito"), non solo
    // la vera intestazione — così transazioni con descrizioni normali
    // come "Accredito Stipendio" o "Addebito Bolletta" venivano perse
    // per intero. Ora si scarta solo la riga identificata come header.
    if (row === columnMap.headerRow) continue;
    let date = null;
    let description = '';
    let hasIgnoredCells = false;
    const amounts = { expense: null, income: null };
    
    for (const item of row) {
      const col = categorizeItemToColumn(item.x, columnMap);
      if (col === 'date') {
        const d = parseCellDate(item.text);
        if (d) date = d;
      } else if (col === 'desc') {
        description += (description ? ' ' : '') + item.text;
      } else if (col === 'expense') {
        const amt = parseCellAmount(item.text);
        if (amt !== null) amounts.expense = amt;
      } else if (col === 'income') {
        const amt = parseCellAmount(item.text);
        if (amt !== null) amounts.income = amt;
      } else if (col === 'ignore') {
        hasIgnoredCells = true; // colonna Saldo/Balance: mai una transazione
      }
    }
    description = description.trim();

    // Riga di continuazione: solo testo descrittivo, nessuna data e nessun
    // importo. Negli estratti reali e' la seconda riga della descrizione
    // della transazione sopra — prima veniva persa del tutto. Si appende
    // alla transazione precedente, mai creata come transazione nuova.
    // Righe fatte solo di celle Saldo/Balance non sono continuazioni.
    if (!date && amounts.expense === null && amounts.income === null) {
      if (description && !hasIgnoredCells && transactions.length > 0) {
        const prev = transactions[transactions.length - 1];
        prev.description = (prev.description + ' ' + description).slice(0, 120);
      }
      continue;
    }

    if (!date) date = lastDate;
    else lastDate = date;

    if (!date) continue;

    description = description || 'Transazione PDF';
    if (amounts.expense !== null) {
      const val = amounts.expense;
      const isSingleAmountCol = /importo|ammontare|valore|cifra|amount/i.test(columnMap.expenseLabel || '');
      
      if (val < 0) {
        transactions.push({ date, amount: Math.abs(val), type: 'uscita', description });
      } else if (val > 0) {
        const t = isSingleAmountCol ? 'entrata' : 'uscita';
        transactions.push({ date, amount: val, type: t, description });
      }
    }
    if (amounts.income !== null) {
      const val = amounts.income;
      if (val < 0) {
        transactions.push({ date, amount: Math.abs(val), type: 'uscita', description });
      } else if (val > 0) {
        transactions.push({ date, amount: val, type: 'entrata', description });
      }
    }
  }
  return transactions;
};

const processPageWithColumnMap = async (page, existingTxs) => {
  const textContent = await page.getTextContent();
  const items = textContent.items.map(item => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width
  }));
  return extractTransactionsFromItems(items);
};

// handlePDFUpload è stata rimossa: era importata in main.js e mai chiamata
// (#pdf-upload è cablato su runMulti → import/multi-import.js). Il suo
// fallback OCR per pagine scansionate — capacità reale, non ridondante — è
// stato PORTATO in multi-import.js (ocrPdfPage), non perso: senza, una pagina
// scansionata importava zero righe in silenzio nella pipeline vera.

// Bug reale corretto: la versione precedente cercava le parole chiave di
// colonna ("accredito", "addebito", "importo"...) in OGNI riga del
// documento, non solo nell'intestazione. Una normalissima descrizione di
// transazione come "Accredito Stipendio Azienda SRL" veniva scambiata per
// l'intestazione della colonna entrata, corrompendo l'estrazione di TUTTE
// le righe successive. Ora si cerca solo nella vera riga di intestazione:
// quella in cui compaiono almeno 2 parole chiave di colonne diverse
// insieme (segno distintivo di un header, non di una riga dati).
const detectColumnMap = (rows) => {
  let headerRow = null;
  for (const row of rows) {
    const matches = new Set();
    for (const item of row) {
      const t = item.text.toLowerCase();
      if (COLUMN_KEYWORDS.expense.test(t)) matches.add('expense');
      if (COLUMN_KEYWORDS.income.test(t)) matches.add('income');
      if (COLUMN_KEYWORDS.date.test(t)) matches.add('date');
      if (COLUMN_KEYWORDS.desc.test(t)) matches.add('desc');
    }
    if (matches.size >= 2) { headerRow = row; break; } // prima riga con più intestazioni insieme = vero header
  }
  if (!headerRow) return { expense: -1, income: -1, date: -1, desc: -1, ignore: -1 };

  let expenseX = -1, incomeX = -1, dateX = -1, descX = -1, ignoreX = -1;
  let expenseLabel = '';
  for (const item of headerRow) {
    const t = item.text.toLowerCase();
    // Saldo/Balance per primo e in esclusiva: "Saldo" non deve mai
    // diventare la colonna importi (bug reale: il saldo progressivo
    // veniva importato come una spesa per ogni riga).
    if (COLUMN_KEYWORDS.ignore.test(t)) { ignoreX = item.x; continue; }
    if (COLUMN_KEYWORDS.expense.test(t)) { expenseX = item.x; expenseLabel = t; }
    if (COLUMN_KEYWORDS.income.test(t)) incomeX = item.x;
    if (COLUMN_KEYWORDS.date.test(t)) dateX = item.x;
    if (COLUMN_KEYWORDS.desc.test(t)) descX = item.x;
  }
  // expenseLabel salvato per davvero (bug reale corretto: prima si
  // confrontava il nome letterale della chiave "expense" con parole come
  // "importo", che non poteva mai corrispondere — il controllo "colonna
  // importo unica, usa il segno" non scattava mai).
  return { expense: expenseX, income: incomeX, date: dateX, desc: descX, ignore: ignoreX, expenseLabel, headerRow };
};

const categorizeItemToColumn = (x, map) => {
  // Solo colonne realmente trovate nell'header: -1 è il segnaposto di
  // "assente" e Math.abs(x - (-1)) misurava la distanza da una colonna
  // inesistente — con layout a colonna unica poteva vincere per sbaglio.
  // La colonna ignore (Saldo/Balance) partecipa alla gara: gli item vicini
  // a lei appartengono a lei, non alla colonna importi adiacente.
  const dists = [
    { col: 'date', pos: map.date },
    { col: 'desc', pos: map.desc },
    { col: 'expense', pos: map.expense },
    { col: 'income', pos: map.income },
    { col: 'ignore', pos: map.ignore ?? -1 }
  ].filter(d => d.pos !== -1)
   .map(d => ({ col: d.col, dist: Math.abs(x - d.pos) }));
  if (dists.length === 0) return 'desc';
  dists.sort((a,b) => a.dist - b.dist);
  return dists[0].col;
};

// Mesi testuali abbreviati — IT, EN, e le altre 4 lingue che Momentum
// dichiara di supportare altrove (i18n/detect.js: it,en,es,fr,de,pt), non
// solo IT+EN. Molte abbreviazioni COINCIDONO fra lingue per puro caso
// (feb/mar/apr/nov sono identiche in italiano e inglese: non serve una voce
// per lingua, la stessa chiave serve a entrambe) — quelle sotto sono SOLO le
// abbreviazioni che nessun'altra lingua già copre.
// 'giu' NON compare per il francese "juin"/"juillet": entrambi si accorciano
// a "jui" nelle prime 3 lettere, e indovinare quale dei due sarebbe esattamente
// il tipo di errore silenzioso che questo progetto rifiuta di fare — quella
// riga resta semplicemente non riconosciuta invece di essere sbagliata a metà.
const TEXT_MONTHS = {
  gen:0, feb:1, mar:2, apr:3, mag:4, giu:5, lug:6, ago:7, set:8, ott:9, nov:10, dic:11, // IT
  jan:0, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, dec:11,                              // EN (+coincidenze IT sopra)
  ene:0, abr:3,                                                                        // ES (+coincidenze IT/EN)
  avr:3, mai:4, aou:7,                                                                 // FR (+coincidenze IT/EN)
  okt:9, dez:11,                                                                       // DE (+coincidenze sopra)
  fev:1, out:9,                                                                        // PT (+coincidenze sopra)
};

// Stesso spogliamento d'accenti già usato in screenshot-parser.js (stripA):
// "déc"/"févr"/"Mär" devono trovare "dec"/"fev"/"mar" senza una voce a parte
// per ogni combinazione accento×lingua.
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const parseCellDate = (text) => {
  // ISO 2025-01-03 (comune negli export N26/Revolut) — controllato per primo
  // perché il pattern dd/mm leggerebbe mese e giorno al contrario.
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // dd/mm/yyyy o d/m/yy (prima si accettavano solo giorno/mese a 2 cifre:
  // "3/1/2025" veniva perso). CONVENZIONE DICHIARATA: giorno-primo, coerente
  // col mercato primario (Italia/Europa) — MAI cambiata in base a un'ipotesi.
  // L'unico caso corretto qui è quello INEQUIVOCABILE: se il secondo numero
  // supera 12 non può essere un mese in NESSUNA lettura, quindi dev'essere il
  // giorno — a differenza di `new Date()`, che con un mese fuori 0-11 non dà
  // errore ma SCORRE silenziosamente sull'anno sbagliato (un vero export USA
  // "12/25/2025" letto giorno-primo produceva il 12 gennaio 2027, un dato
  // sbagliato senza nessun avviso). Quando ENTRAMBI i numeri stanno in 1-12
  // resta l'ambiguità reale, e lì la convenzione dichiarata si applica.
  const match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})/);
  if (match) {
    let yr = parseInt(match[3]);
    if (yr < 100) yr += 2000;
    let dd = parseInt(match[1]), mm = parseInt(match[2]);
    if (mm > 12 && dd <= 12) { const t = dd; dd = mm; mm = t; } // l'unico scambio non ambiguo
    return new Date(yr, mm - 1, dd);
  }
  // "3 gen 2025" / "03 GEN 25" / "3 août 2025" / "3 Dez 2025"
  const textual = text.match(/(\d{1,2})\s+([a-zà-ÿ]{3,})\.?\s+(\d{4}|\d{2})/i);
  if (textual) {
    const chiave = stripDiacritics(textual[2].slice(0, 3).toLowerCase());
    const m = TEXT_MONTHS[chiave];
    if (m !== undefined) {
      let yr = parseInt(textual[3]);
      if (yr < 100) yr += 2000;
      return new Date(yr, m, parseInt(textual[1]));
    }
  }
  return null;
};

const parseCellAmount = (text) => {
  if (!text) return null;
  let cleaned = text.replace(/["'€$%\s]/g, '').trim();
  
  let isNegative = false;
  if (cleaned.startsWith('-') || cleaned.endsWith('-') || cleaned.includes('−')) {
    isNegative = true;
  }
  
  // Clean sign character for parsing
  cleaned = cleaned.replace(/[-−]/g, '');

  // Check if it's in format 1.234,56 (Italian style) or 1,234.56 (US style)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  let amt = parseFloat(cleaned);
  if (isNaN(amt)) return null;
  return isNegative ? -amt : amt;
};

// Intestazioni italiane + inglesi (N26, Revolut e simili esportano in EN).
// "saldo"/"balance" NON stanno più in expense (bug reale: la colonna del
// saldo progressivo veniva importata come spese) — sono una colonna da
// riconoscere e IGNORARE esplicitamente (chiave `ignore`).
// Multilingua (espansione EU): IT + EN + ES + FR + DE. Estratti conto di
// banche spagnole/francesi/tedesche usano header nella loro lingua.
const COLUMN_KEYWORDS = {
  date: /(data|valuta|date|booking|fecha|datum|buchung)/i,
  desc: /(descrizione|causale|operazione|dettagli|note|description|reference|details|payee|concepto|libelle|libellé|verwendungszweck|buchungstext|beschreibung|descrição|descricao|histórico|historico)/i,
  // temi, non parole intere: gli header reali usano spesso i plurali
  // ("Addebiti"/"Accrediti" su Intesa) che il singolare non matchava
  expense: /(uscit|addebit|importo|ammontare|valore|totale|debit|amount|money\s*out|paid\s*out|cargo|adeudo|débit|debit|soll|belastung|ausgang)/i,
  income: /(entrat|accredit|credit|money\s*in|paid\s*in|abono|ingreso|crédit|haben|gutschrift|eingang)/i,
  ignore: /(saldo|balance|solde|kontostand)/i
};


export { processPageWithColumnMap, extractTransactionsFromItems, detectColumnMap, categorizeItemToColumn, parseCellDate, parseCellAmount, COLUMN_KEYWORDS };
