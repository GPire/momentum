// Parser del testo delle notifiche bancarie/wallet — italiane E dei circuiti
// carta internazionali (Visa/Mastercard, vedi sotto).
//
// PERCHÉ ESISTE: una webapp non può leggere le notifiche di altre app
// (blocco di privacy del sistema operativo, identico su iOS e Android, non
// aggirabile da nessun codice). Questo modulo è il CUORE PURO della
// funzione "lettura automatica delle notifiche": oggi riceve il testo da
// (a) screenshot condivisi via OCR e (b) in futuro dal plugin nativo
// Android NotificationListenerService (guscio Capacitor), l'unica via reale
// per la lettura diretta. Su iPhone la lettura diretta non esisterà mai
// (nemmeno per le app native); lì la via è l'Open Banking.
//
// Pattern reali dei principali wallet/banche italiane, PIÙ un secondo
// gruppo di pattern in inglese per gli avvisi generici dei circuiti carta
// (Visa/Mastercard) — questi non li manda mai il circuito stesso, li manda
// la banca/app emittente, ma la FORMULAZIONE ("Your Visa card ending 1234
// was charged...", "Mastercard purchase: ...") è condivisa da moltissimi
// emittenti nel mondo indipendentemente dalla lingua locale della banca —
// a differenza dei pattern italiani sopra, che sono specifici di wallet
// italiani e restano SEMPRE in euro. Onestà: non copre ogni banca del
// mondo (impossibile senza un campione reale di ognuna), copre le
// formulazioni più comuni in inglese, la lingua di default di moltissime
// app quando il dispositivo non è impostato in italiano.
// Ogni pattern è testato in node --test; quando nessun pattern matcha si
// ritorna null, mai una transazione inventata.
import { parseCellAmount, detectCurrency } from './pdf-parser.js';

const AMOUNT = '(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{1,2}|\\d+)';
const SIMBOLO_OPZ = '[€$£¥]?';
// Confine di fine-esercente: si ferma PRIMA di una data in coda ("... at
// TESCO 01/03/2026"), non solo a fine stringa. Trovato integrando questo
// modulo nel percorso screenshot (screenshot-parser.js): un OCR di
// notifica include quasi sempre una riga di data/ora sotto, e un confine
// `\s*$` da solo la inghiottiva dentro il nome dell'esercente ("TESCO
// 01/03/2026" invece di "TESCO").
const FINE_ESERCENTE = '(?:\\s+\\d{1,2}[/.-]\\d{1,2}|\\s*$)';

// Ordine importante: i pattern più specifici prima. `type` è la direzione;
// `merchant` è l'indice del gruppo col nome esercente/mittente (o null).
const PATTERNS = [
  // Google Wallet / Pay: "Hai pagato 12,50 € presso Esselunga con ..."
  { re: new RegExp(`hai pagato\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:presso|da|a)\\s+(.+?)(?:\\s+con\\b|\\s*$)`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // Apple Pay via banca / carte: "Pagamento di 8,00€ presso BAR ROMA"
  { re: new RegExp(`pagamento\\s+di\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:presso|a favore di|a|verso)\\s+(.+?)(?:\\s+il\\b|\\s+alle\\b|\\s*\\.|\\s*$)`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // Satispay: "Hai inviato 15,00 € a Mario Rossi" / "Mario ti ha inviato 20 €"
  { re: new RegExp(`hai inviato\\s*€?\\s*${AMOUNT}\\s*€?\\s+a\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`(.+?)\\s+ti ha inviato\\s*€?\\s*${AMOUNT}\\s*€?`, 'i'), type: 'entrata', amountIdx: 2, merchantIdx: 1 },
  // Intesa/UniCredit/BPER stile SMS/push: "Addebito di 78,50 EUR per SDD ENEL"
  { re: new RegExp(`addebit\\w*\\s+(?:di\\s+)?€?\\s*${AMOUNT}\\s*(?:€|eur)?\\s*(?:per|causale)?\\s*(.*)$`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`accredit\\w*\\s+(?:di\\s+)?€?\\s*${AMOUNT}\\s*(?:€|eur)?\\s*(?:per|causale|da)?\\s*(.*)$`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // Revolut: "Paid €12.40 at Tesco" / "You received €200 from ..."
  { re: new RegExp(`paid\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:at|to)\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`(?:you\\s+)?received\\s*€?\\s*${AMOUNT}\\s*€?\\s+from\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // PayPal: "Hai ricevuto 45,00 € da Luca Bianchi"
  { re: new RegExp(`hai ricevuto\\s*€?\\s*${AMOUNT}\\s*€?\\s+da\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // Generico prelievo: "Prelievo di 100,00 € carta *1234"
  { re: new RegExp(`prelievo\\s+(?:di\\s+)?€?\\s*${AMOUNT}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: null },

  // ── Avvisi carta Visa/Mastercard (inglese, molti emittenti nel mondo) ──
  // "You spent $45.00 on your Visa card at TESCO" / "...Mastercard ending 1234 at..."
  { re: new RegExp(`you spent\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+on your (?:visa|mastercard)(?:\\s+card)?(?:\\s+ending\\s+(?:in\\s+)?\\d+)?\\s+at\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // "Your Visa card ending 1234 was charged $45.00 at TESCO"
  { re: new RegExp(`your (?:visa|mastercard)(?:\\s+card)?(?:\\s+ending\\s+(?:in\\s+)?\\d+)?\\s+was charged\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+at\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // "A payment of $45.00 was made with your Mastercard at TESCO"
  { re: new RegExp(`a payment of\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+was made(?:\\s+(?:with|using) your (?:visa|mastercard)(?:\\s+card)?)?\\s+at\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // "Mastercard purchase: $45.00 at TESCO" / "Visa purchase £30.00 at STARBUCKS"
  { re: new RegExp(`(?:visa|mastercard)\\s+purchase:?\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+at\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // "Card ending 1234: purchase of $50.00 approved at WALMART"
  { re: new RegExp(`card ending\\s+(?:in\\s+)?\\d+:?\\s*purchase of\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+approved\\s+at\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // "Visa refund of $20.00 from TESCO" / "You received a refund of €10.00 from AMAZON"
  { re: new RegExp(`(?:visa|mastercard)?\\s*refund of\\s*${SIMBOLO_OPZ}\\s*${AMOUNT}\\s*${SIMBOLO_OPZ}\\s+(?:from|at)\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },

  // ── PIX ricevuto (Nubank, Brasile) — "Você recebeu um Pix de R$ 50,00
  // de Maria Souza". Confidenza DICHIARATA media: fonte terza parte (guida
  // non ufficiale), non la documentazione Nubank stessa — ricerca dedicata
  // non ha trovato altre formulazioni PIX/carta brasiliane verificabili
  // con fonte primaria, quindi qui c'è SOLO questo pattern, di proposito,
  // non un'intera famiglia inventata per somiglianza.
  { re: new RegExp(`voc[eê] recebeu um pix de\\s*r\\$\\s*${AMOUNT}\\s+de\\s+(.+?)${FINE_ESERCENTE}`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
];

// Pulisce il nome esercente da code tecniche delle notifiche
// ("con carta *1234", "il 05/07", orari, punti finali).
function cleanMerchant(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\b(?:con\s+)?carta\s*\*?\d*\b/gi, '')
    .replace(/\bil\s+\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/gi, '')
    .replace(/\balle\s+\d{1,2}[:.]\d{2}\b/gi, '')
    .replace(/[.\s]+$/, '')
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 60) : null;
}

// `title` e `text` come arrivano da una notifica (o dal suo OCR).
// Ritorna { amount, type, description, source } oppure null.
export function parseNotificationText(title, text) {
  const full = `${title || ''} ${text || ''}`.replace(/\s+/g, ' ').trim();
  if (!full) return null;

  for (const p of PATTERNS) {
    const m = full.match(p.re);
    if (!m) continue;
    const amount = parseCellAmount(m[p.amountIdx]);
    if (amount === null || amount <= 0) continue;
    const merchant = p.merchantIdx ? cleanMerchant(m[p.merchantIdx]) : null;
    // Valuta cercata sull'intero testo (simbolo o codice ISO), non solo
    // sulla cifra estratta da AMOUNT (che di proposito cattura solo cifre):
    // i pattern italiani sono sempre EUR per costruzione (wallet italiani),
    // quelli carta internazionali no — assente quando non c'è indizio.
    const currency = detectCurrency(full);
    return {
      amount: Math.abs(amount),
      type: p.type,
      description: merchant || (title || '').trim().slice(0, 60) || 'Da notifica',
      source: 'notification',
      ...(currency ? { currency } : {}),
    };
  }
  return null;
}

// Punto d'ingresso per il guscio nativo Android (Capacitor,
// NotificationListenerService): riceve { title, text, package, ts } e
// filtra i pacchetti noti di wallet/banche — le notifiche di WhatsApp
// e simili non devono nemmeno arrivare al parser.
export const KNOWN_WALLET_PACKAGES = [
  'com.google.android.apps.walletnfcrel',   // Google Wallet
  'com.satispay.customer',
  'com.paypal.android.p2pmobile',
  'com.revolut.revolut',
  'com.latuabancaperandroid',               // Intesa Sanpaolo
  'it.copergmps.rt.pf.android.sp.bmps',     // MPS
  'com.unicredit',
  'it.bnl.apps.banking',
  'it.ingdirect.app',
  'com.mediolanum.android.fullbanca',
  'posteitaliane.posteapp.appbpol',         // BancoPosta
  'com.n26.android',
  'it.hype.app',
];

export function parseNativeNotification(nativeNotification) {
  const { title, text, package: pkg } = nativeNotification || {};
  if (pkg && !KNOWN_WALLET_PACKAGES.includes(pkg)) return null;
  return parseNotificationText(title, text);
}
