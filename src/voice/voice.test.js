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
