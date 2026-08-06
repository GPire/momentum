// ============================================================
// PAYLOAD QR-BILL SVIZZERO — verificato dal documento PRIMARIO ufficiale
// ============================================================
// Colma la lacuna dichiarata nel commit precedente (swiss-qr-reference.js):
// lì avevo verificato SOLO l'algoritmo del riferimento QRR perché le fonti
// secondarie sulla struttura completa del payload non erano abbastanza
// certe da fidarsene per un formato di pagamento reale. Qui invece la
// struttura viene dal documento ufficiale scaricato ed estratto
// direttamente: "Swiss Implementation Guidelines for the QR-bill", SIX
// Group, Version 2.3 – 20.11.2023 (six-group.com/dam/download/banking-
// services/standardization/qr-bill/ig-qr-bill-v2.3-en.pdf), tabella 8
// "Swiss QR Code data elements" (capitolo 4.2.2), letta campo per campo —
// non un riassunto di terzi.
//
// Regole verificate dal documento primario (capitolo 4.1):
//  - Separatore tra elementi: CR+LF o solo LF (uno dei due, coerente in
//    tutto il documento) — qui si usa CR+LF. Nessun a capo dopo l'ultimo
//    elemento.
//  - Set di caratteri: UTF-8 ristretto (Basic Latin + Latin-1 Supplement +
//    Latin Extended-A + Ș/ș/Ț/ț/€) — caratteri fuori da questo insieme
//    vanno normalizzati prima dell'uso, non lasciati passare.
//  - Livello di correzione errore del codice QR: "M" (capitolo 6.1).
//  - I campi "A" (aggiuntivi: StrdBkgInf, AltPmtInf) si omettono
//    interamente se non usati — non una riga vuota, proprio assenti, e il
//    payload finisce lì.
'use strict';

const CRLF = '\r\n';

// Ordine ESATTO dei 32 campi verificato dalla tabella 8 del documento
// ufficiale (Header → CdtrInf → UltmtCdtr [7 righe SEMPRE vuote, mai
// compilate] → CcyAmt → UltmtDbtr → RmtInf → [StrdBkgInf/AltPmtInf solo se usati]).
function riga(v) { return v == null ? '' : String(v); }

function normalizzaTesto(s) {
  // Restringe al set di caratteri ammesso (capitolo 4.1.1): rimuove
  // silenziosamente solo i codepoint fuori dall'insieme dichiarato — mai
  // un carattere non ammesso che romperebbe la scansione in banca.
  return String(s || '').replace(/[^ -~ -ÿĀ-ſȘșȚț€]/g, '');
}

export function validateSwissQrData(data = {}) {
  const errori = [];
  const c = data.creditor || {};
  if (!/^(CH|LI)\d{19}$/.test(String(c.iban || '').replace(/\s/g, '')))
    errori.push('IBAN del creditore mancante o non valido: servono 21 caratteri, solo CH o LI.');
  if (!c.name) errori.push('Nome del creditore mancante.');
  if (!c.postalCode) errori.push('CAP del creditore mancante.');
  if (!c.town) errori.push('Città del creditore mancante.');
  if (!/^[A-Z]{2}$/.test(c.country || '')) errori.push('Paese del creditore mancante o non nel formato ISO 3166-1 (es. CH).');
  if (data.currency && !['CHF', 'EUR'].includes(data.currency)) errori.push('Valuta non ammessa: solo CHF o EUR.');
  if (data.amount != null) {
    const a = +data.amount;
    if (!(a >= 0.01 && a <= 999999999.99)) errori.push('Importo fuori dal range ammesso (0.01–999999999.99).');
  }
  const tipoRif = data.referenceType || 'NON';
  if (!['QRR', 'SCOR', 'NON'].includes(tipoRif)) errori.push('Tipo di riferimento non valido: solo QRR, SCOR o NON.');
  // BUG REALE trovato dal test contro l'esempio ufficiale SIX: il controllo
  // precedente riconosceva come QR-IBAN solo un IID che iniziasse per "30",
  // escludendo l'intervallo 31000-31999 — l'esempio ufficiale stesso usa
  // IID 31961 (CH6431961...), un QR-IBAN legittimo che veniva respinto.
  // L'IID è a 5 cifre, posizioni 5-9 dell'IBAN (dopo CH/LI + 2 cifre di
  // controllo): va estratto e confrontato come numero, non come prefisso.
  const ibanNorm = String(c.iban || '').replace(/\s/g, '');
  const iid = +ibanNorm.slice(4, 9);
  const isQrIban = Number.isFinite(iid) && iid >= 30000 && iid <= 31999;
  if (isQrIban && tipoRif !== 'QRR') errori.push('Con un QR-IBAN il tipo di riferimento deve essere QRR.');
  if (!isQrIban && tipoRif === 'QRR') errori.push('Il riferimento QRR richiede un QR-IBAN (IID 30000-31999), non un IBAN normale.');
  if (tipoRif === 'QRR' && !/^\d{27}$/.test(String(data.reference || '').replace(/\s/g, '')))
    errori.push('Il riferimento QRR deve avere esattamente 27 cifre numeriche.');
  return { ok: errori.length === 0, errori };
}

// Costruisce il payload testuale completo, campo per campo, nell'ordine
// esatto della tabella 8 ufficiale. `creditor`/`debtor`:
// { iban, name, street, buildingNo, postalCode, town, country }.
// Indirizzo SEMPRE strutturato (AdrTp "S") — la forma "combinata" (K) non è
// più raccomandata dalla transizione all'indirizzo strutturato obbligatorio.
export function buildSwissQrPayload(data = {}) {
  const v = validateSwissQrData(data);
  const c = data.creditor || {};
  const d = data.debtor || null;
  const n = normalizzaTesto;

  const righe = [
    // Header
    'SPC', '0200', '1',
    // CdtrInf
    riga(c.iban).replace(/\s/g, '').toUpperCase(),
    'S',
    n(c.name).slice(0, 70),
    n(c.street).slice(0, 70),
    n(c.buildingNo).slice(0, 16),
    n(c.postalCode).slice(0, 16),
    n(c.town).slice(0, 35),
    riga(c.country).toUpperCase(),
    // UltmtCdtr — 7 righe SEMPRE vuote (il gruppo non va mai compilato)
    '', '', '', '', '', '', '',
    // CcyAmt
    data.amount != null ? (+data.amount).toFixed(2) : '',
    riga(data.currency || 'CHF'),
    // UltmtDbtr — opzionale, 7 righe (tutte vuote se non fornito)
    d ? 'S' : '',
    d ? n(d.name).slice(0, 70) : '',
    d ? n(d.street).slice(0, 70) : '',
    d ? n(d.buildingNo).slice(0, 16) : '',
    d ? n(d.postalCode).slice(0, 16) : '',
    d ? n(d.town).slice(0, 35) : '',
    d ? riga(d.country).toUpperCase() : '',
    // RmtInf
    riga(data.referenceType || 'NON'),
    riga(data.reference).replace(/\s/g, ''),
    n(data.unstructuredMessage).slice(0, 140),
    'EPD',
  ];

  // Campi "A" (aggiuntivi): si aggiungono SOLO se usati, mai una riga vuota
  // al loro posto — il payload finisce prima se non servono.
  if (data.billingInfo) righe.push(n(data.billingInfo).slice(0, 140));
  if (Array.isArray(data.alternativeProcedures)) {
    for (const p of data.alternativeProcedures.slice(0, 2)) righe.push(n(p).slice(0, 100));
  }

  return { ok: v.ok, errori: v.errori, payload: righe.join(CRLF) };
}
