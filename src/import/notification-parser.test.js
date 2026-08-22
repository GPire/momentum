import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { parseNotificationText, parseNativeNotification } = await import('./notification-parser.js');

test('Google Wallet: "Hai pagato ... presso ..."', () => {
  const r = parseNotificationText('Google Wallet', 'Hai pagato 12,50 € presso Esselunga con Visa •1234');
  assert.equal(r.amount, 12.50);
  assert.equal(r.type, 'uscita');
  assert.equal(r.description, 'Esselunga');
});

test('banca: "Pagamento di ... presso ..." con data in coda', () => {
  const r = parseNotificationText('Intesa Sanpaolo', 'Pagamento di 8,00€ presso BAR ROMA il 05/07 alle 09:12');
  assert.equal(r.amount, 8);
  assert.equal(r.type, 'uscita');
  assert.equal(r.description, 'BAR ROMA');
});

test('Satispay invio e ricezione', () => {
  const out = parseNotificationText('Satispay', 'Hai inviato 15,00 € a Mario Rossi');
  assert.equal(out.type, 'uscita');
  assert.equal(out.description, 'Mario Rossi');
  const inn = parseNotificationText('Satispay', 'Luca ti ha inviato 20 €');
  assert.equal(inn.type, 'entrata');
  assert.equal(inn.amount, 20);
});

test('SMS bancario: addebito SDD con causale', () => {
  const r = parseNotificationText('', 'Addebito di 78,50 EUR per SDD ENEL ENERGIA');
  assert.equal(r.amount, 78.50);
  assert.equal(r.type, 'uscita');
  assert.ok(r.description.includes('ENEL'));
});

test('accredito stipendio', () => {
  const r = parseNotificationText('La tua banca', 'Accredito di 1.850,00 EUR per EMOLUMENTI');
  assert.equal(r.amount, 1850);
  assert.equal(r.type, 'entrata');
});

test('Revolut in inglese', () => {
  const paid = parseNotificationText('Revolut', 'Paid €12.40 at Tesco');
  assert.equal(paid.amount, 12.40);
  assert.equal(paid.type, 'uscita');
  assert.equal(paid.description, 'Tesco');
  const recv = parseNotificationText('Revolut', 'You received €200 from John Smith');
  assert.equal(recv.type, 'entrata');
});

// ── Avvisi carta Visa/Mastercard (inglese, molti emittenti nel mondo) ──
// Su richiesta esplicita dell'utente: prima questo modulo copriva SOLO
// wallet italiani (sempre EUR per costruzione) e Revolut — un utente con
// un avviso carta in inglese (comunissimo per chi viaggia) non veniva mai
// riconosciuto.

test('Visa: "You spent $45.00 on your Visa card at TESCO"', () => {
  const r = parseNotificationText('Bank Alert', 'You spent $45.00 on your Visa card at TESCO');
  assert.equal(r.amount, 45);
  assert.equal(r.type, 'uscita');
  assert.equal(r.description, 'TESCO');
  assert.equal(r.currency, 'USD');
});

test('Mastercard con "ending 1234": "You spent £30.00 on your Mastercard ending 1234 at AMAZON"', () => {
  const r = parseNotificationText('Bank Alert', 'You spent £30.00 on your Mastercard ending 1234 at AMAZON');
  assert.equal(r.amount, 30);
  assert.equal(r.description, 'AMAZON');
  assert.equal(r.currency, 'GBP');
});

test('"Your Visa card ending 1234 was charged $45.00 at TESCO"', () => {
  const r = parseNotificationText('Bank Alert', 'Your Visa card ending 1234 was charged $45.00 at TESCO');
  assert.equal(r.amount, 45);
  assert.equal(r.type, 'uscita');
  assert.equal(r.description, 'TESCO');
});

test('"A payment of $45.00 was made with your Mastercard at TESCO"', () => {
  const r = parseNotificationText('Bank Alert', 'A payment of $45.00 was made with your Mastercard at TESCO');
  assert.equal(r.amount, 45);
  assert.equal(r.description, 'TESCO');
});

test('"Mastercard purchase: $45.00 at TESCO" / "Visa purchase £30.00 at STARBUCKS"', () => {
  const a = parseNotificationText('Bank Alert', 'Mastercard purchase: $45.00 at TESCO');
  assert.equal(a.amount, 45);
  assert.equal(a.description, 'TESCO');
  const b = parseNotificationText('Bank Alert', 'Visa purchase £30.00 at STARBUCKS');
  assert.equal(b.amount, 30);
  assert.equal(b.description, 'STARBUCKS');
});

test('"Card ending 1234: purchase of $50.00 approved at WALMART"', () => {
  const r = parseNotificationText('Bank Alert', 'Card ending 1234: purchase of $50.00 approved at WALMART');
  assert.equal(r.amount, 50);
  assert.equal(r.type, 'uscita');
  assert.equal(r.description, 'WALMART');
});

test('rimborso carta: "Visa refund of $20.00 from TESCO" è un\'entrata, non un\'uscita', () => {
  const r = parseNotificationText('Bank Alert', 'Visa refund of $20.00 from TESCO');
  assert.equal(r.amount, 20);
  assert.equal(r.type, 'entrata');
  assert.equal(r.description, 'TESCO');
});

test('valuta assente quando il pattern italiano è EUR per costruzione (nessuna regressione)', () => {
  const r = parseNotificationText('Intesa Sanpaolo', 'Pagamento di 8,00€ presso BAR ROMA');
  assert.equal(r.currency, 'EUR');
});

// BUG REALE TROVATO E CORRETTO integrando questo modulo nel percorso
// screenshot: un confine `\s*$` da solo inghiottiva una data in coda
// dentro il nome dell'esercente ("TESCO 01/03/2026" invece di "TESCO") —
// e una notifica OCR ha quasi sempre una riga di data/ora sotto.
test('l\'esercente si ferma PRIMA di una data in coda, non la inghiottisce (Visa, Revolut, Satispay)', () => {
  assert.equal(parseNotificationText('Bank Alert', 'You spent $45.00 on your Visa card at TESCO 01/03/2026').description, 'TESCO');
  assert.equal(parseNotificationText('Revolut', 'Paid €12.40 at Tesco 05.07.2026').description, 'Tesco');
  assert.equal(parseNotificationText('Satispay', 'Hai inviato 15,00 € a Mario Rossi 01/03/2026').description, 'Mario Rossi');
});

test('testo non finanziario → null, mai transazioni inventate', () => {
  assert.equal(parseNotificationText('WhatsApp', 'Ciao, ci vediamo alle 8?'), null);
  assert.equal(parseNotificationText('Meteo', 'Domani pioggia, 12 gradi'), null);
});

test('parseNativeNotification: filtra i pacchetti non-wallet', () => {
  const wa = parseNativeNotification({ title: 'x', text: 'Hai pagato 10,00 € presso Bar', package: 'com.whatsapp' });
  assert.equal(wa, null); // anche se il testo sembrerebbe un pagamento
  const gw = parseNativeNotification({ title: 'Google Wallet', text: 'Hai pagato 10,00 € presso Bar', package: 'com.google.android.apps.walletnfcrel' });
  assert.equal(gw.amount, 10);
});
