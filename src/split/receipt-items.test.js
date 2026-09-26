import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptItems } from './receipt-items.js';

test('scontrino italiano di ristorante: voci, coperto escluso dalle intestazioni, totale verificato', () => {
  const r = parseReceiptItems(`TRATTORIA DA MARIO
P.IVA 01234567890
Tavolo 7
2 x Pizza margherita    16,00
Pasta carbonara 12,50
Acqua naturale 3,00
Vino rosso 1/2 L 9,00
TOTALE EURO 40,50
Carta di credito 40,50
IVA 10% 3,68`);
  assert.deepEqual(r.items.map((i) => [i.description, i.amount, i.quantity]), [
    ['Pizza margherita', 16, 2], ['Pasta carbonara', 12.5, 1], ['Acqua naturale', 3, 1], ['Vino rosso 1/2 L', 9, 1],
  ]);
  assert.equal(r.total, 40.5);
  assert.equal(r.verified, true);
});

test('sconto e servizio entrano nel controllo, non diventano voci', () => {
  const r = parseReceiptItems(`Burger 14.90
Fries 4.50
Discount -2.00
Service 3.00
TOTAL 20.40`);
  assert.equal(r.items.length, 2);
  assert.equal(r.discounts, 2);
  assert.equal(r.service, 3);
  assert.equal(r.verified, true);
});

test('tedesco, olandese, francese, spagnolo, portoghese: la riga del totale viene riconosciuta', () => {
  for (const [voce, tot] of [['Summe', 'Schnitzel 18,50\nBier 4,50\nSumme 23,00'], ['Totaal', 'Bitterballen 7,50\nBier 4,00\nTotaal 11,50'],
    ['Total', 'Croque monsieur 9,00\nCafé 2,50\nTotal 11,50'], ['Total', 'Tapas 12,00\nCaña 2,50\nTotal 14,50'], ['Total', 'Bacalhau 15,00\nImperial 2,00\nTotal 17,00']]) {
    const r = parseReceiptItems(tot);
    assert.equal(r.verified, true, voce);
    assert.equal(r.items.length, 2, voce);
  }
});

test('se le voci non tornano col totale si dice di quanto, senza aggiustare di nascosto', () => {
  const r = parseReceiptItems('Pizza 10,00\nBirra 5,00\nTOTALE 18,00');
  assert.equal(r.verified, false);
  assert.equal(r.difference, 3);
  assert.deepEqual(r.items.map((i) => i.amount), [10, 5]);
});

test('senza totale leggibile nulla è "verificato"; righe senza lettere scartate', () => {
  const r = parseReceiptItems('12/09/2026 14:32\nInsalata 8,00\n0001 2,00');
  assert.equal(r.total, null);
  assert.equal(r.verified, false);
  assert.deepEqual(r.items.map((i) => i.description), ['Insalata']);
});

test('migliaia con separatore e importi con valuta in coda', () => {
  const r = parseReceiptItems('Hotel 2 notti 1.234,50 €\nCity tax 4,00 €\nTOTALE 1.238,50 €');
  assert.equal(r.items[0].amount, 1234.5);
  assert.equal(r.verified, true);
});

test('sales tax aggiunta in fondo (USA): il totale torna sommandola, ed è dichiarata a parte', () => {
  const r = parseReceiptItems('Burrito 11.50\nSoda 2.50\nSubtotal 14.00\nSales Tax 8.875% 1.24\nTotal 15.24');
  assert.equal(r.addedTax, 1.24);
  assert.equal(r.verified, true);
  assert.equal(r.items.length, 2);
});

test('parole di pagamento solo come parole intere: "Panino di Riccardo" resta una voce', () => {
  const r = parseReceiptItems('Panino di Riccardo 6,50\nCoperto 2,00\nTotale 8,50\nBancomat 8,50');
  assert.deepEqual(r.items.map((i) => i.description), ['Panino di Riccardo', 'Coperto']);
  assert.equal(r.verified, true);
});
