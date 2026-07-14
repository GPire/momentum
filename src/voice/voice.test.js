import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || { SpeechRecognition: undefined, webkitSpeechRecognition: undefined };
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { VoiceParser } = await import("./voice.js");

// Bug reale trovato testando con una frase lunga e naturale (10 clausole in
// sequenza, come parlerebbe davvero un utente): "ho" da solo non veniva mai
// rimosso dalla descrizione (solo la frase fissa "ho comprato"), e articoli/
// preposizioni articolate italiane (lo, nel, sul...) non erano previste nello
// strip. Risultato: "ho ricevuto lo stipendio di 1500 euro" → descrizione
// "Ho lo" invece di qualcosa di leggibile, perché il fallback scattava solo
// su stringa vuota, non su un residuo insensato ma non vuoto.
test("descrizione pulita per un'entrata (stipendio) invece del residuo 'Ho lo'", () => {
  const [result] = VoiceParser.parse("ho ricevuto lo stipendio di 1500 euro");
  assert.equal(result.type, "entrata");
  assert.equal(result.amount, 1500);
  assert.notEqual(result.description, "Ho lo");
  assert.ok(result.description.length >= 3, `descrizione troppo corta/insensata: "${result.description}"`);
});

test("descrizione pulita per un risparmio invece del residuo 'Ho nel risparmio'", () => {
  const [result] = VoiceParser.parse("ho messo 100 euro nel risparmio");
  assert.equal(result.type, "invest");
  assert.equal(result.category, "risparmio");
  assert.notEqual(result.description, "Ho nel risparmio");
});

test("descrizione pulita per un investimento in bitcoin (niente 'Ho' residuo)", () => {
  const [result] = VoiceParser.parse("ho investito 200 euro in bitcoin");
  assert.equal(result.category, "crypto");
  assert.ok(!/^ho\b/i.test(result.description.trim()), `descrizione inizia ancora con "ho": "${result.description}"`);
});

test("frase lunga con 10 clausole miste (transazioni + appuntamenti) viene scomposta tutta, nessuna persa", () => {
  const text = "ho speso 35 euro al supermercato oggi e domani ho un appuntamento dal dentista alle 15 e giovedì ho una riunione di lavoro alle 10 e ho ricevuto lo stipendio di 1500 euro e ho investito 200 euro in bitcoin e venerdì ho una call con il team alle 9 e ho pagato 12 euro per la benzina e sabato ho un colloquio alle 11 e ho messo 100 euro nel risparmio e lunedì prossimo ho una visita medica alle 16";
  const results = VoiceParser.parse(text);
  assert.equal(results.length, 10);

  const transactions = results.filter(r => r.intent === "transaction");
  const appointments = results.filter(r => r.intent === "appointment");
  assert.equal(transactions.length, 5);
  assert.equal(appointments.length, 5);

  // nessuna descrizione di transazione deve essere un residuo insensato
  transactions.forEach(t => {
    assert.ok(t.description.length >= 3, `descrizione troppo corta: "${t.description}"`);
    assert.ok(!/^ho\b/i.test(t.description.trim()), `descrizione inizia ancora con "ho": "${t.description}"`);
  });

  // importi e tipi devono restare corretti dopo la pulizia della descrizione
  const stipendio = transactions.find(t => t.type === "entrata");
  assert.equal(stipendio.amount, 1500);
  const bitcoin = transactions.find(t => t.category === "crypto");
  assert.equal(bitcoin.amount, 200);
  const risparmio = transactions.find(t => t.category === "risparmio");
  assert.equal(risparmio.amount, 100);
});

test("orario di un appuntamento resta corretto dopo la pulizia della descrizione (regressione tempo/importo)", () => {
  const [result] = VoiceParser.parse("domani ho un appuntamento dal dentista alle 15");
  assert.equal(result.intent, "appointment");
  const localHour = new Date(result.date).getUTCHours(); // confronto diretto sull'orario UTC salvato
  assert.ok(result.hasTime);
});

test('"ho messo 100 euro da parte" → risparmio (non spesa), anche non contiguo', () => {
  const r = VoiceParser.parse('ho messo 100 euro da parte');
  assert.ok(r && r.length >= 1);
  const tx = r.find(x => x.intent === 'transaction');
  assert.equal(tx.type, 'invest');
  assert.equal(tx.category, 'risparmio');
});

test('discorso lungo misto: 5 azioni distinte riconosciute con intent corretti', () => {
  const r = VoiceParser.parse('ho speso 25 euro al supermercato e ho pagato 12 euro di benzina e ricordami di chiamare il commercialista domani e ho un appuntamento dal dentista giovedì e ho messo 100 euro da parte');
  assert.equal(r.length, 5);
  assert.equal(r.filter(x => x.intent === 'transaction').length, 3);
  assert.equal(r.filter(x => x.intent === 'reminder').length, 1);
  assert.equal(r.filter(x => x.intent === 'appointment').length, 1);
});

// Casistiche di discorso naturale trovate SIMULANDO (metodo: falsificazione):
// bug reali corretti — decimali detti a voce, numeri-parola composti, azioni
// concatenate senza "e", split solo quando c'è un PROPRIO importo.
test('decimale detto a voce: "12 e 50 al bar" → 12.50 (non 12)', () => {
  const r = VoiceParser.parse('ho speso 12 e 50 al bar');
  const tx = r.find(x => x.intent === 'transaction');
  assert.equal(tx.amount, 12.5);
});

test('numeri-parola composti: "mille e duecento" → 1200 (un solo importo)', () => {
  const r = VoiceParser.parse('ho speso mille e duecento euro di affitto');
  assert.equal(r.filter(x => x.intent === 'transaction').length, 1);
  assert.equal(r[0].amount, 1200);
});

test('azioni concatenate SENZA "e": "ho pagato 30 di benzina ho comprato 15 di libri"', () => {
  const r = VoiceParser.parse('ho pagato 30 di benzina ho comprato 15 euro di libri e ho investito 200 in etf');
  const tx = r.filter(x => x.intent === 'transaction');
  assert.equal(tx.length, 3);
  assert.deepEqual(tx.map(t => t.amount).sort((a,b)=>a-b), [15, 30, 200]);
});

test('due importi propri splittano, un solo importo condiviso NO', () => {
  assert.equal(VoiceParser.parse('coffee 3 euros and lunch 12 euros').filter(x=>x.intent==='transaction').length, 2);
  assert.equal(VoiceParser.parse('pane e latte 5 euro').filter(x=>x.intent==='transaction').length, 1);
});
