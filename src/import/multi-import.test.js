import test from 'node:test';
import assert from 'node:assert/strict';

// Shim ambiente browser PRIMA di importare (constants.js usa window/navigator).
const learned = [];
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.document = { querySelector: () => null, getElementById: () => null, addEventListener: () => {} };
globalThis.window = {
  momentumOrchestrator: { learn: (d, c) => learned.push([d, c]) },
  requestIdleCallback: (fn) => setTimeout(() => fn({ timeRemaining: () => 10 }), 0),
};
const { learnInBackground, readCsvText, addParsed, KIND_TO_SOURCE } = await import('./multi-import.js');

test('learnInBackground: addestra i modelli da OGNI operazione importata (idle-chunked)', async () => {
  learned.length = 0;
  const pairs = Array.from({ length: 95 }, (_, i) => ({ description: 'tx ' + i, category: 'spesa', amount: 10, date: new Date() }));
  learnInBackground(pairs, 40); // 95 in chunk da 40 → 3 giri idle
  await new Promise(r => setTimeout(r, 120));
  assert.equal(learned.length, 95); // TUTTE le operazioni addestrano i modelli
  assert.equal(learned[0][0], 'tx 0');
});

test('reconcileModelsWithHistory: al cambio firma modelli, ri-addestra dai dati preservati (no data loss)', async () => {
  learned.length = 0;
  const { reconcileModelsWithHistory } = await import('./multi-import.js');
  // shim VaultDAO minimale con storico transazioni
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = { '2026-06': [
    { description: 'Netflix', category: 'abbonamenti', amount: 14.99, date: '2026-06-05' },
    { description: 'Esselunga', category: 'spesa', amount: 40, date: '2026-06-10' },
  ] };
  VaultDAO.state.mlData = { modelSignature: 'vecchia' };
  VaultDAO.save = () => {};
  const r1 = reconcileModelsWithHistory('nuova-v2');   // firma diversa → ri-addestra
  await new Promise(r => setTimeout(r, 60));
  assert.equal(r1.reconciled, true);
  assert.equal(r1.count, 2);
  assert.equal(learned.length, 2);                     // ha riappreso da tutto lo storico
  const r2 = reconcileModelsWithHistory('nuova-v2');   // stessa firma → non ripete
  assert.equal(r2.reconciled, false);
});

// D2 (W9): il CSV di PORTAFOGLIO (posizioni) si distingue dal CSV di movimenti
// dall'header — falsificato con header reali (Revolut, banca IT, storico trade).
test('isPortfolioCsv: riconosce le posizioni, NON i movimenti', async () => {
  const { isPortfolioCsv } = await import('./multi-import.js');
  assert.equal(isPortfolioCsv('Ticker;Classe;Quantità;PrezzoMedio'), true);
  assert.equal(isPortfolioCsv('symbol,asset,quantity,avgprice'), true);
  // movimenti: hanno descrizione/importo → NON portafoglio
  assert.equal(isPortfolioCsv('Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance'), false);
  assert.equal(isPortfolioCsv('Data;Descrizione;Uscite;Entrate;Saldo'), false);
  assert.equal(isPortfolioCsv('Date,Ticker,Type,Quantity,Price per share,Total Amount'), false); // storico trade
});

// ── readCsvText: encoding, non solo UTF-8 ──
// file.text() (usato prima) decodifica SEMPRE come UTF-8. Molti export
// bancari italiani/europei più vecchi sono Windows-1252: un accento diventa
// un byte che UTF-8 non sa leggere, e il risultato erano lettere rotte in
// silenzio ("CaffÃ¨" o peggio, un carattere di sostituzione), mai un errore.
test('readCsvText: UTF-8 vero resta UTF-8 (nessun falso positivo)', async () => {
  const testo = 'Descrizione;Importo\nCaffè bar;-1,20\nFarmacia età;-9,50\n';
  const bytes = new TextEncoder().encode(testo); // UTF-8 vero: 'è' = 2 byte (0xC3 0xA8)
  const risultato = await readCsvText(new Blob([bytes]));
  assert.equal(risultato, testo);
});

test('readCsvText: Windows-1252 (export bancari italiani più vecchi) — accenti non rotti', async () => {
  // "Caffè bar" con 'è' come SINGOLO byte 0xE8 (Windows-1252), non i due byte
  // UTF-8 (0xC3 0xA8). new TextDecoder('utf-8',{fatal:true}) deve rifiutare
  // questi byte (0xE8 da solo non è mai un inizio di sequenza UTF-8 valida
  // seguito da uno spazio), facendo scattare il fallback.
  const bytes = new Uint8Array([
    0x43, 0x61, 0x66, 0x66, 0xE8, 0x20, 0x62, 0x61, 0x72, 0x3B, 0x2D, 0x31, 0x2C, 0x32, 0x30, // "Caffè bar;-1,20"
  ]);
  const risultato = await readCsvText(new Blob([bytes]));
  assert.equal(risultato, 'Caffè bar;-1,20', 'accento leggibile, non rotto o sostituito');
});

// ── Provenienza per source-registry.js (2026-08-28) — CSV/PDF/screenshot
// multiplo si auto-salvano senza conferma per-riga: senza un tag di
// provenienza, il registro di affidabilità non può misurarli. ──

test('addParsed: ogni transazione salvata porta il tag "source" passato, per il registro affidabilità', async () => {
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = {};
  VaultDAO.save = () => {};
  const seenIds = new Set();
  const txs = [{ date: new Date('2026-07-01'), amount: 12.5, type: 'uscita', description: 'Bar Roma' }];
  addParsed(txs, seenIds, [], 'csv');
  const salvata = VaultDAO.state.transactions['2026-07'][0];
  assert.equal(salvata.source, 'csv');
});

test('addParsed: senza un source passato, nessun campo "source" viene aggiunto (retrocompatibile con chi non lo passa)', async () => {
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = {};
  VaultDAO.save = () => {};
  const seenIds = new Set();
  const txs = [{ date: new Date('2026-07-01'), amount: 12.5, type: 'uscita', description: 'Bar Roma' }];
  addParsed(txs, seenIds, []);
  const salvata = VaultDAO.state.transactions['2026-07'][0];
  assert.equal(salvata.source, undefined);
});

test('KIND_TO_SOURCE: copre i 4 formati reali gestiti da importFiles, screenshot multiplo condivide lo STESSO tag del singolo (un solo canale misurato, non due)', () => {
  assert.deepEqual(KIND_TO_SOURCE, { csv: 'csv', pdf: 'pdf', xml: 'camt053', image: 'screenshot_ocr' });
});

// NOTA scoperta scrivendo questo test: lo standard WHATWG Encoding (seguito
// dai browser veri, dove questo file gira davvero) mappa il byte 0x80 di
// windows-1252 sul simbolo euro. Il TextDecoder di QUESTO Node/ICU invece lo
// tratta come ISO-8859-1 puro (carattere di controllo C1) per l'intero
// intervallo 0x80-0x9F — verificato byte per byte, non un'ipotesi. È una
// differenza dell'ambiente di test, non del codice: non scrivo qui
// un'asserzione che affermerebbe un comportamento che non posso verificare
// in questo ambiente. Gli accenti (il caso reale che conta per gli estratti
// conto italiani) sono già coperti dal test sopra e lì Node e i browser
// concordano (0xE0→à, 0xE8→è, fuori dall'intervallo C1).
