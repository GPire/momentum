import test from 'node:test';
import assert from 'node:assert/strict';

const { TrainedCategorizer } = await import('./trained-categorizer.js');
const { MOMENTUM_TRAINED_MODEL_DATA } = await import('./trained-model-data.js');

// Nessun test esisteva per questo file prima del 2026-08-30 (trovato mentre
// si aggiungeva il path int8, vedi sotto) — il modello Nano è l'UNICO
// classificatore attivo sul tier hardware minimo (Meso non carica nemmeno
// lì), quindi il suo comportamento di default merita la stessa copertura
// già richiesta per ogni altro modulo del progetto.

test('TrainedCategorizer: si costruisce dal modello reale e predice una categoria nota per un caso chiaro', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
  const r = nano.predict('abbonamento netflix mensile');
  assert.ok(nano.categories.includes(r.category), 'la categoria predetta deve esistere nell\'elenco reale del modello');
  assert.ok(r.confidence > 0 && r.confidence <= 1);
  assert.equal(Object.keys(r.allProbs).length, nano.categories.length);
});

test('TrainedCategorizer: le probabilità di tutte le categorie sommano a 1 (softmax valido)', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
  const r = nano.predict('spesa esselunga supermercato');
  const somma = Object.values(r.allProbs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(somma - 1) < 1e-6, `le probabilità devono sommare a 1, sommano a ${somma}`);
});

test('TrainedCategorizer: testo vuoto non fa crashare il modello (vettore TF-IDF tutto zero, nessuna divisione per zero)', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
  assert.doesNotThrow(() => nano.predict(''));
});

test('TrainedCategorizer: senza opts (comportamento storico) il modello resta in float, mai quantizzato di default', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
  assert.equal(nano.quantized, null);
});

// ── Path int8 (2026-08-30) — stesso schema già in produzione per il Meso
// (trained-meso.js), esteso qui al Nano perché è l'unico modello garantito
// attivo sul tier hardware più debole. ──
test('TrainedCategorizer con opts.int8: quantizza i pesi alla costruzione', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA, { int8: true });
  assert.notEqual(nano.quantized, null);
  assert.equal(nano.quantized.length, 2, 'due matrici quantizzate, una per strato (W1, W2)');
});

test('TrainedCategorizer con opts.int8: continua a predire in modo sicuro (softmax valido, categoria reale)', () => {
  const nano = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA, { int8: true });
  const r = nano.predict('abbonamento netflix mensile');
  assert.ok(nano.categories.includes(r.category));
  const somma = Object.values(r.allProbs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(somma - 1) < 1e-6);
});

test('TrainedCategorizer: la quantizzazione int8 non stravolge la predizione rispetto al float, sugli stessi casi (stesso principio già misurato per il Meso: accuratezza invariata)', () => {
  const nanoFloat = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
  const nanoInt8 = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA, { int8: true });
  const casi = [
    'abbonamento netflix mensile',
    'spesa esselunga supermercato',
    'stipendio bonifico azienda',
    'benzina distributore autostrada',
    'farmacia acquisto medicinali',
  ];
  let concordanze = 0;
  for (const testo of casi) {
    const rf = nanoFloat.predict(testo);
    const ri = nanoInt8.predict(testo);
    if (rf.category === ri.category) concordanze++;
    // la confidenza può spostarsi leggermente per l'errore di quantizzazione,
    // ma non deve mai collassare a un valore assurdo
    assert.ok(ri.confidence > 0 && ri.confidence <= 1);
  }
  assert.ok(concordanze >= casi.length - 1, `la quantizzazione int8 deve concordare con il float sulla maggior parte dei casi chiari (${concordanze}/${casi.length})`);
});

test('TrainedCategorizer.load: passa opts.int8 al costruttore (mai perso nel caricamento asincrono)', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ json: async () => MOMENTUM_TRAINED_MODEL_DATA });
    const nano = await TrainedCategorizer.load('/fake-url.json', { int8: true });
    assert.notEqual(nano.quantized, null);
  } finally {
    globalThis.fetch = savedFetch;
  }
});
