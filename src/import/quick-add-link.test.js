import test from 'node:test';
import assert from 'node:assert/strict';
import { extractQuickAddParams, buildQuickAddPrefill, buildQuickAddSetupInstructions } from './quick-add-link.js';

test('extractQuickAddParams: link valido in query -> params estratti correttamente', () => {
  const p = extractQuickAddParams('https://momentum.app/?quickadd=1&amount=45.20&merchant=TESCO&currency=GBP&card=Visa');
  assert.deepEqual(p, { amount: 45.20, merchant: 'TESCO', currency: 'GBP', card: 'Visa' });
});

test('extractQuickAddParams: link valido nel FRAMMENTO (hash), non solo nella query', () => {
  const p = extractQuickAddParams('https://momentum.app/index.html#quickadd=1&amount=12.5&merchant=Starbucks');
  assert.equal(p.amount, 12.5);
  assert.equal(p.merchant, 'Starbucks');
});

test('extractQuickAddParams: senza il marcatore "quickadd" -> null, mai un falso positivo su un link qualunque', () => {
  assert.equal(extractQuickAddParams('https://momentum.app/?amount=45.20&merchant=TESCO'), null);
});

test('extractQuickAddParams: importo mancante, zero, negativo o non numerico -> null', () => {
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&merchant=TESCO'), null);
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&amount=0&merchant=TESCO'), null);
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&amount=-5&merchant=TESCO'), null);
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&amount=abc&merchant=TESCO'), null);
});

test('extractQuickAddParams: esercente mancante o vuoto -> null (mai un nome inventato)', () => {
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&amount=45.20'), null);
  assert.equal(extractQuickAddParams('https://momentum.app/?quickadd=1&amount=45.20&merchant=%20%20'), null);
});

test('extractQuickAddParams: URL malformato -> null, mai un\'eccezione non gestita', () => {
  assert.equal(extractQuickAddParams('non-e-un-url'), null);
  assert.equal(extractQuickAddParams(''), null);
  assert.equal(extractQuickAddParams(null), null);
});

test('extractQuickAddParams: valuta sconosciuta/non-ISO -> currency null, il resto resta valido', () => {
  const p = extractQuickAddParams('https://momentum.app/?quickadd=1&amount=45.20&merchant=TESCO&currency=XX');
  assert.equal(p.currency, null);
  assert.equal(p.amount, 45.20);
});

test('extractQuickAddParams: esercente troncato a 60 caratteri (mai una descrizione enorme in un link malevolo)', () => {
  const lungo = 'A'.repeat(500);
  const p = extractQuickAddParams(`https://momentum.app/?quickadd=1&amount=10&merchant=${lungo}`);
  assert.equal(p.merchant.length, 60);
});

test('extractQuickAddParams: card assente -> null, non stringa vuota', () => {
  const p = extractQuickAddParams('https://momentum.app/?quickadd=1&amount=10&merchant=TESCO');
  assert.equal(p.card, null);
});

// ── buildQuickAddPrefill ──

test('buildQuickAddPrefill: usa l\'orchestratore VERO per la categoria, mai una categoria a caso', () => {
  const orch = { classify: (desc, amt, date) => ({ cat: 'spesa', confidence: 90 }) };
  const prefill = buildQuickAddPrefill({ amount: 45.20, merchant: 'TESCO', currency: 'GBP', card: 'Visa' }, orch);
  assert.equal(prefill.type, 'uscita');
  assert.equal(prefill.category, 'spesa');
  assert.equal(prefill.amount, 45.20);
  assert.equal(prefill.description, 'TESCO (Visa)');
});

test('buildQuickAddPrefill: senza card nel payload, la descrizione resta solo il nome esercente', () => {
  const orch = { classify: () => ({ cat: 'ristoranti' }) };
  const prefill = buildQuickAddPrefill({ amount: 10, merchant: 'Starbucks', currency: null, card: null }, orch);
  assert.equal(prefill.description, 'Starbucks');
});

test('buildQuickAddPrefill: senza orchestratore disponibile (caso raro, app non ancora inizializzata) non crasha, categoria null', () => {
  const prefill = buildQuickAddPrefill({ amount: 10, merchant: 'TESCO', currency: null, card: null }, null);
  assert.equal(prefill.category, null);
  assert.equal(prefill.amount, 10);
});

// BUG REALE trovato testando dal vivo in Chrome: la valuta veniva estratta
// e validata da extractQuickAddParams ma si perdeva prima del salvataggio —
// una transazione in sterline finiva sommata al totale euro senza
// conversione né segnalazione (esattamente il numero inventato che
// currency-convert.js/dashboard esistono per evitare).
test('buildQuickAddPrefill: la valuta rilevata nel link ARRIVA nel prefill, non si perde', () => {
  const orch = { classify: () => ({ cat: 'spesa' }) };
  const prefill = buildQuickAddPrefill({ amount: 45.20, merchant: 'TESCO', currency: 'GBP', card: 'Visa' }, orch);
  assert.equal(prefill.currency, 'GBP');
});

test('buildQuickAddPrefill: senza valuta nel link, il prefill non ne dichiara una a caso', () => {
  const orch = { classify: () => ({ cat: 'spesa' }) };
  const prefill = buildQuickAddPrefill({ amount: 10, merchant: 'TESCO', currency: null, card: null }, orch);
  assert.equal(prefill.currency, null);
});

test('buildQuickAddSetupInstructions: usa il dominio reale del dispositivo, non un segnaposto', () => {
  const r = buildQuickAddSetupInstructions('https://momentum.example.app');
  assert.equal(r.url, 'https://momentum.example.app/?quickadd=1&amount=[Importo]&merchant=[Nome esercente]&card=[Nome carta]');
});

test('buildQuickAddSetupInstructions: passaggi in ordine, mai vuoti', () => {
  const r = buildQuickAddSetupInstructions('https://x.app');
  assert.ok(Array.isArray(r.passi) && r.passi.length >= 5);
  for (const p of r.passi) assert.ok(p.length > 5);
});
