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
