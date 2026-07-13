// ============================================================
// PARSER EXPORT REVOLUT — schema ricco reale (W: import intelligente)
// ============================================================
// L'export "Transaction export.csv" di Revolut ha uno schema strutturato che
// permette una classificazione PERFETTA: type (BUY/DIVIDEND/CARD_TRANSACTION…),
// asset_class (STOCK/CRYPTO), name (Snowflake/Tesla/Apple), shares, price,
// amount FIRMATO, mcc_code. Riconosce investimenti azionari, crypto, dividendi,
// interessi, depositi e spese — ciascuno col verso e la categoria giusti.
// Funzione PURA e testabile in Node (niente DOM). Onestà (regola #1): niente
// dato inventato; se un campo manca, si degrada con criterio.
'use strict';

// Parser CSV robusto: rispetta le virgolette (le descrizioni Revolut contengono
// virgole, es. "SNOWFLAKE INC. A DL-,0001, quantity: 1") e le doppie-virgolette
// escape (""). Uno split(',') naive spezzerebbe quei campi.
export function parseCsvRow(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// MCC → categoria (ISO 18245): i codici carta danno la categoria SENZA ML, con
// precisione altissima. Coperti i più comuni; il resto ricade sul categorizzatore.
const MCC_CATEGORY = {
  spesa: [5411, 5412, 5422, 5451, 5462, 5499, 5300, 5310, 5331],
  ristoranti: [5811, 5812, 5813, 5814, 5462],
  trasporti: [4111, 4121, 4131, 4784, 4789, 5541, 5542, 5172, 7523, 7512, 7513, 4011, 4112],
  shopping: [5651, 5655, 5661, 5691, 5699, 5732, 5733, 5734, 5735, 5912, 5942, 5944, 5945, 5977, 5311, 5399, 5722, 5200],
  abbonamenti: [4899, 4814, 4816, 5815, 5816, 5817, 5818, 7841],
  etf: [6211],
};
function mccToCategory(mcc) {
  const n = parseInt(mcc, 10);
  if (!n) return null;
  for (const [cat, codes] of Object.entries(MCC_CATEGORY)) if (codes.includes(n)) return cat;
  return null;
}

const num = (v) => { if (v == null || v === '') return null; const f = parseFloat(String(v).replace(',', '.')); return isNaN(f) ? null : f; };
const mkDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };

// È un export Revolut? Riconosciuto dall'header (colonne caratteristiche).
export function isRevolutExport(headerLine) {
  const h = headerLine.toLowerCase();
  return h.includes('asset_class') && h.includes('symbol') && h.includes('type') && h.includes('amount');
}

// Cuore: testo CSV → transazioni normalizzate per Momentum.
// Ritorna [{ date:Date, amount:+number, type:'entrata'|'uscita'|'invest',
//            category?:string, description:string, meta:{...} }].
export function parseRevolutExport(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvRow(lines[0]).map(h => h.replace(/"/g, '').trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const iDate = col('date'), iType = col('type'), iAsset = col('asset_class'),
        iName = col('name'), iSymbol = col('symbol'), iAmount = col('amount'),
        iDesc = col('description'), iCparty = col('counterparty_name'), iMcc = col('mcc_code'),
        iShares = col('shares'), iPrice = col('price'), iTxId = col('transaction_id');

  const txs = [];
  for (let r = 1; r < lines.length; r++) {
    const c = parseCsvRow(lines[r]).map(x => x.replace(/^"|"$/g, ''));
    if (c.length < header.length - 2) continue;
    const type = (c[iType] || '').toUpperCase();
    const asset = (c[iAsset] || '').toUpperCase();
    const amount = num(c[iAmount]);
    const name = (c[iName] || '').trim();
    const descRaw = (c[iDesc] || '').trim();
    const cparty = iCparty >= 0 ? (c[iCparty] || '').trim() : '';
    const date = mkDate(c[iDate]);
    if (!date) continue;

    // Movimenti senza cassa (migrazioni, split, azioni societarie a 0) → saltati.
    if (amount === null || amount === 0) continue;

    let txType, category = null, description;
    const isBuy = type === 'BUY';
    const isSell = type === 'SELL';

    if (isBuy) {
      // Acquisto di investimento: esce cassa verso un asset → tipo 'invest'.
      txType = 'invest';
      category = asset === 'CRYPTO' ? 'crypto' : 'etf';
      const sh = num(c[iShares]), pr = num(c[iPrice]);
      description = `Acquisto ${name || c[iSymbol]}${sh ? ` (${sh} @ ${pr || '?'})` : ''}`;
    } else if (isSell) {
      txType = 'entrata';
      category = asset === 'CRYPTO' ? 'crypto' : 'etf';
      description = `Vendita ${name || c[iSymbol]}`;
    } else if (type === 'DIVIDEND') {
      txType = 'entrata'; category = 'etf';
      description = `Dividendo ${name}`.trim();
    } else if (type === 'INTEREST_PAYMENT') {
      txType = 'entrata'; category = 'etf';
      description = 'Interessi';
    } else if (type === 'STOCKPERK' || type.startsWith('BENEFITS_SAVEBACK')) {
      txType = 'entrata'; category = 'etf';
      description = `Bonus ${name || 'Revolut'}`.trim();
    } else if (type.includes('INBOUND') || type.includes('INPAYMENT') || type === 'TRANSFER_INBOUND' || type === 'CUSTOMER_INBOUND') {
      txType = 'entrata';
      description = cparty || descRaw || 'Accredito';
    } else if (type.includes('OUTBOUND') || type === 'TRANSFER_OUTBOUND') {
      txType = 'uscita';
      description = cparty || descRaw || 'Trasferimento';
    } else if (type.startsWith('CARD_TRANSACTION')) {
      txType = 'uscita';
      category = mccToCategory(c[iMcc]); // MCC → categoria precisa; null → ML a valle
      description = name || descRaw || 'Pagamento carta';
    } else {
      // Tipo non mappato: usa il SEGNO dell'importo per il verso, ML per categoria.
      txType = amount < 0 ? 'uscita' : 'entrata';
      description = name || cparty || descRaw || 'Operazione';
    }

    txs.push({
      date, amount: Math.abs(amount), type: txType,
      ...(category ? { category } : {}),
      description: description.slice(0, 80),
      // externalId = transaction_id UNICO di Revolut → dedup ESATTA: nessun
      // doppio inserimento re-importando, e nessuna fusione di spese distinte
      // ma di pari importo (il rischio della dedup fuzzy su 5 anni di dati).
      externalId: iTxId >= 0 ? (c[iTxId] || '') : '',
      meta: { source: 'revolut', rawType: type, asset, symbol: c[iSymbol] || '' },
    });
  }
  return txs;
}
