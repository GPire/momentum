// Parser del testo delle notifiche bancarie/wallet italiane.
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
// Pattern reali dei principali wallet/banche italiane. Ogni pattern è
// testato in node --test; quando nessun pattern matcha si ritorna null,
// mai una transazione inventata.
import { parseCellAmount } from './pdf-parser.js';

const AMOUNT = '(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{1,2}|\\d+)';

// Ordine importante: i pattern più specifici prima. `type` è la direzione;
// `merchant` è l'indice del gruppo col nome esercente/mittente (o null).
const PATTERNS = [
  // Google Wallet / Pay: "Hai pagato 12,50 € presso Esselunga con ..."
  { re: new RegExp(`hai pagato\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:presso|da|a)\\s+(.+?)(?:\\s+con\\b|\\s*$)`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // Apple Pay via banca / carte: "Pagamento di 8,00€ presso BAR ROMA"
  { re: new RegExp(`pagamento\\s+di\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:presso|a favore di|a|verso)\\s+(.+?)(?:\\s+il\\b|\\s+alle\\b|\\s*\\.|\\s*$)`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  // Satispay: "Hai inviato 15,00 € a Mario Rossi" / "Mario ti ha inviato 20 €"
  { re: new RegExp(`hai inviato\\s*€?\\s*${AMOUNT}\\s*€?\\s+a\\s+(.+?)\\s*$`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`(.+?)\\s+ti ha inviato\\s*€?\\s*${AMOUNT}\\s*€?`, 'i'), type: 'entrata', amountIdx: 2, merchantIdx: 1 },
  // Intesa/UniCredit/BPER stile SMS/push: "Addebito di 78,50 EUR per SDD ENEL"
  { re: new RegExp(`addebit\\w*\\s+(?:di\\s+)?€?\\s*${AMOUNT}\\s*(?:€|eur)?\\s*(?:per|causale)?\\s*(.*)$`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`accredit\\w*\\s+(?:di\\s+)?€?\\s*${AMOUNT}\\s*(?:€|eur)?\\s*(?:per|causale|da)?\\s*(.*)$`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // Revolut: "Paid €12.40 at Tesco" / "You received €200 from ..."
  { re: new RegExp(`paid\\s*€?\\s*${AMOUNT}\\s*€?\\s+(?:at|to)\\s+(.+?)\\s*$`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: 2 },
  { re: new RegExp(`(?:you\\s+)?received\\s*€?\\s*${AMOUNT}\\s*€?\\s+from\\s+(.+?)\\s*$`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // PayPal: "Hai ricevuto 45,00 € da Luca Bianchi"
  { re: new RegExp(`hai ricevuto\\s*€?\\s*${AMOUNT}\\s*€?\\s+da\\s+(.+?)\\s*$`, 'i'), type: 'entrata', amountIdx: 1, merchantIdx: 2 },
  // Generico prelievo: "Prelievo di 100,00 € carta *1234"
  { re: new RegExp(`prelievo\\s+(?:di\\s+)?€?\\s*${AMOUNT}`, 'i'), type: 'uscita', amountIdx: 1, merchantIdx: null },
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
    return {
      amount: Math.abs(amount),
      type: p.type,
      description: merchant || (title || '').trim().slice(0, 60) || 'Da notifica',
      source: 'notification',
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
