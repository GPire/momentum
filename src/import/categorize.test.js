import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { guardCategory, safeCategorize } = await import('./categorize.js');

test('guardrail: crypto SENZA evidenza → demota (il bug "Sumup Sartoria → Crypto")', () => {
  assert.equal(guardCategory('crypto', 'Sumup *Sartoria Genova', 'uscita'), 'spesa'); // sconosciuto → spesa sicura
  assert.equal(guardCategory('etf', 'Ristorante Da Mario', 'uscita'), 'ristoranti');  // demote INTELLIGENTE via dizionario
});

test('guardrail: crypto CON evidenza → resta crypto', () => {
  assert.equal(guardCategory('crypto', 'Binance acquisto Bitcoin', 'uscita'), 'crypto');
  assert.equal(guardCategory('etf', 'Acquisto ETF MSCI World', 'uscita'), 'etf');
});

test('guardrail: stipendio su un\'uscita → demota (una spesa non è stipendio)', () => {
  assert.equal(guardCategory('stipendio', 'Pagamento negozio', 'uscita'), 'spesa');
  assert.equal(guardCategory('stipendio', 'Accredito busta paga', 'entrata'), 'stipendio');
});

test('guardrail: categoria normale non toccata', () => {
  assert.equal(guardCategory('ristoranti', 'Pizzeria Napoli', 'uscita'), 'ristoranti');
  assert.equal(guardCategory('spesa', 'Esselunga', 'uscita'), 'spesa');
});

test('safeCategorize: esercente noto dal dizionario ha precedenza', () => {
  assert.equal(safeCategorize('Esselunga Milano', 30, new Date(), 'uscita'), 'spesa');
  assert.equal(safeCategorize('Binance BTC', 100, new Date(), 'uscita'), 'crypto');
});
