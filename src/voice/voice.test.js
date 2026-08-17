import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || { SpeechRecognition: undefined, webkitSpeechRecognition: undefined };
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { VoiceParser, linguaVoceAttiva, SPEECH_LOCALE } = await import("./voice.js");

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
// extractAmount (VoiceParser): nessun test diretto esisteva finora — solo
// test sull'intera pipeline VoiceParser.parse(). È il motivo per cui questo
// bug è passato inosservato fino a una segnalazione dal vivo: il pulsante
// microfono del form transazione (VoiceCore.toggle) instrada il testo
// riconosciuto proprio dentro VoiceParser.parse(), che chiama extractAmount.
test('extractAmount: "113 euro e 39" detto a voce → 113.39, non 113 coi centesimi persi', () => {
  assert.equal(VoiceParser.extractAmount('ho speso 113 euro e 39'), 113.39);
});

test('extractAmount: "12 e 50 al bar" (senza "euro") → 12.5', () => {
  assert.equal(VoiceParser.extractAmount('12 e 50 al bar'), 12.5);
});

test('extractAmount: importo scritto con la virgola "113,39 euro" → 113.39, non doppiato', () => {
  assert.equal(VoiceParser.extractAmount('113,39 euro di spesa'), 113.39);
});

test('extractAmount: importo scritto col punto "27.50" → 27.5', () => {
  assert.equal(VoiceParser.extractAmount('27.50 al supermercato'), 27.5);
});

test('extractAmount: numero intero senza centesimi "50 euro" → 50, non inventa decimali', () => {
  assert.equal(VoiceParser.extractAmount('ho speso 50 euro'), 50);
});

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

// ── NUMERI COMPOSTI PARLATI (11-99): bug reale trovato testando dal vivo
// con frasi discorsive (2026-08-17) — "undici".."diciannove" mancavano DEL
// TUTTO, e i composti 21-99 ("ventitré", "trentacinque"...) non erano nel
// dizionario perché in italiano sono UNA sola parola (non due token come
// in inglese "twenty three", già sommati correttamente prima) ──

test('numeri fra 11 e 19 (mancavano tutti): "ho speso quindici euro"', () => {
  const r = VoiceParser.parse('ho speso quindici euro di parcheggio');
  assert.equal(r[0].amount, 15);
});

test('BUG REALE: numero composto 21-99 in una sola parola: "ho speso ventitré euro"', () => {
  const r = VoiceParser.parse('ho speso ventitré euro di benzina');
  assert.equal(r[0].amount, 23);
});

test('composti senza accento (trascrizione vocale spesso non lo mette): "ventitre" vale come "ventitré"', () => {
  assert.equal(VoiceParser.parse('ho speso ventitre euro di benzina')[0].amount, 23);
});

test('elisione corretta: "ventuno"/"ventotto" (non "ventiuno"/"ventiotto")', () => {
  assert.equal(VoiceParser.parse('ho speso ventuno euro di libri')[0].amount, 21);
  assert.equal(VoiceParser.parse('ho speso ottantotto euro di scarpe')[0].amount, 88);
});

test('composti nelle decine alte: "novantanove", "sessantacinque"', () => {
  assert.equal(VoiceParser.parse('ho speso novantanove euro di abbonamento')[0].amount, 99);
  assert.equal(VoiceParser.parse('ho speso sessantacinque euro di scarpe')[0].amount, 65);
});

// ── ORARI DETTI CON MEZZE ORE/QUARTI: bug reale trovato testando dal vivo
// (2026-08-17) — "alle 11 e mezza" (il modo più comune di dire un orario
// non in punto) non veniva riconosciuto affatto: "e mezza" restava come
// rumore nella descrizione E l'orario restava sbagliato (sempre in punto) ──

test('BUG REALE: "alle 11 e mezza" → orario 11:30, non lasciato come rumore nella descrizione', () => {
  const r = VoiceParser.parse('ho un appuntamento dal dentista alle 11 e mezza');
  const appt = r.find(x => x.intent === 'appointment');
  assert.ok(appt);
  assert.equal(appt.hasTime, true);
  assert.equal(new Date(appt.date).getMinutes(), 30);
  assert.doesNotMatch(appt.description.toLowerCase(), /mezza/);
});

test('"alle 9 e un quarto" → orario 9:15', () => {
  const r = VoiceParser.parse('ho un appuntamento dal dottore alle 9 e un quarto');
  const appt = r.find(x => x.intent === 'appointment');
  assert.equal(new Date(appt.date).getMinutes(), 15);
});

// ── INTENTO DIVISIONE (split) via voce — feature multi-intento proprietaria ──
// Prima la clausola "dividi con Marco" (senza importo) veniva scartata da
// _parseClause (path transazione: niente importo → null): l'azione di divisione
// spariva in silenzio. Ora è un intento a sé, con anafora sull'importo.
test('split autonomo con importo proprio: "dividi 40 di cena con Marco e Luca"', () => {
  const r = VoiceParser.parse('dividi 40 di cena con Marco e Luca');
  assert.equal(r.length, 1);
  assert.equal(r[0].intent, 'split');
  assert.equal(r[0].amount, 40);
  assert.deepEqual(r[0].people, ['Io', 'Marco', 'Luca']);
});

test('anafora: "ho speso 40 di cena e dividila con Marco" → 1 solo split (no doppio conteggio)', () => {
  const r = VoiceParser.parse('ho speso 40 di cena e dividila con Marco');
  assert.equal(r.length, 1, 'la spesa piatta deve essere assorbita dalla divisione');
  assert.equal(r[0].intent, 'split');
  assert.equal(r[0].amount, 40);
  assert.ok(r[0].people.includes('Marco'));
  assert.equal(r.filter(x => x.intent === 'transaction').length, 0);
});

test('spesa indipendente + split indipendente restano due azioni distinte', () => {
  const r = VoiceParser.parse('ho speso 20 al bar e dividi 40 di cena con Marco');
  assert.equal(r.filter(x => x.intent === 'transaction').length, 1);
  const split = r.find(x => x.intent === 'split');
  assert.ok(split);
  assert.equal(split.amount, 40);
});

test('un promemoria "su" una divisione resta promemoria, non attiva lo split', () => {
  const r = VoiceParser.parse('ricordami di dividere le spese con Marco domani');
  assert.equal(r.length, 1);
  assert.equal(r[0].intent, 'reminder');
});

test('descrizione dello split pulita dai connettivi: "dividi 30 di pizza con Anna"', () => {
  const r = VoiceParser.parse('dividi 30 di pizza con Anna');
  assert.equal(r[0].intent, 'split');
  assert.equal(r[0].description.toLowerCase(), 'pizza');
  assert.deepEqual(r[0].people, ['Io', 'Anna']);
});

// ── DUE PROMEMORIA DISTINTI IN UNA FRASE (2026-08-17) — bug reale trovato
// testando dal vivo con frasi discorsive: "ricordami di chiamare X e di
// pagare Y" restava fuso in un solo promemoria (descrizione mescolata, data
// solo del primo) — il secondo "ricordami" è sottinteso nel parlato ma il
// connettivo "e di [verbo]" deve comunque separare le due azioni ──

test('BUG REALE: "ricordami di chiamare X e di pagare Y" → DUE promemoria distinti, non uno fuso', () => {
  const r = VoiceParser.parse("ricordami di chiamare mia madre domani e di pagare la bolletta entro venerdì");
  const rem = r.filter(x => x.intent === 'reminder');
  assert.equal(rem.length, 2, 'devono restare due promemoria separati');
  assert.match(rem[0].description.toLowerCase(), /madre/);
  assert.match(rem[1].description.toLowerCase(), /bolletta/);
  assert.notEqual(rem[0].date, rem[1].date, 'ogni promemoria deve avere la SUA data, non quella del primo copiata sul secondo');
});

test('un solo verbo dopo "e" che NON è nella lista nota non forza uno split a vuoto (mai un falso positivo)', () => {
  const r = VoiceParser.parse('ricordami di comprare il regalo e di essere puntuale');
  // "essere" non è nella lista dei verbi noti: nessuna separazione forzata,
  // resta un solo promemoria coerente con la frase originale.
  assert.equal(r.filter(x => x.intent === 'reminder').length, 1);
});

// ── FUSIONE "cosa ho comprato" + "quanto ho speso" (2026-08-17) ──
// Segnalato dall'utente con una trascrizione vocale reale: "ho comprato
// magliette e ho speso 1039,49 euro" veniva registrato come DUE transazioni
// (una senza importo, una senza descrizione) invece di una sola. Il
// segmentatore ha ragione a tenerle separate (due ancore verbali distinte),
// ma _resolveAmountlessPurchase le fonde quando il secondo pezzo non porta
// NESSUNA descrizione propria — segnale già calcolato da _parseClause
// (descGeneric), non un'euristica nuova sul testo grezzo.
test('BUG REALE: "ho comprato X e ho speso Y euro" → UNA transazione, non due', () => {
  const r = VoiceParser.parse('ho comprato magliette e ho speso 1039.49 euro');
  assert.equal(r.length, 1, 'le due clausole devono fondersi in una sola transazione');
  assert.equal(r[0].intent, 'transaction');
  assert.equal(r[0].amount, 1039.49);
  assert.equal(r[0].description.toLowerCase(), 'magliette');
  assert.ok(!r[0].amountMissing);
});

test('la "e" residua a fine descrizione sparisce dopo la fusione ("Magliette e" → "Magliette")', () => {
  const r = VoiceParser.parse('ho comprato magliette e ho speso 50 euro');
  assert.equal(r[0].description, 'Magliette');
});

test('due spese REALMENTE separate (entrambe con descrizione propria) NON si fondono', () => {
  const r = VoiceParser.parse('ho comprato il pane e ho speso 20 euro alla spesa settimanale');
  assert.equal(r.length, 2, 'due descrizioni vere restano due transazioni distinte');
});

test('la fusione avviene SOLO fra transazioni dello STESSO tipo (una spesa non eredita un importo detto per un investimento)', () => {
  const r = VoiceParser.parse('ho comprato magliette e ho investito 500 euro in etf');
  assert.equal(r.length, 2, 'tipi diversi restano due azioni separate, mai un dato inventato');
  const uscita = r.find(x => x.type === 'uscita');
  assert.ok(uscita && uscita.amountMissing, 'la spesa senza importo resta segnalata, non finta');
});

test('ENGLISH: "I bought t-shirts and I spent 1039.49 euros" → one transaction too', () => {
  const r = VoiceParser.parse('I bought t shirts and I spent 1039.49 euros');
  assert.equal(r.length, 1);
  assert.equal(r[0].amount, 1039.49);
  assert.ok(!r[0].amountMissing);
});

// ── RECUPERO PREDITTIVO DELL'IMPORTO — anti-attrito onesto ──
// Una spesa con un VERBO ma senza cifra prima veniva persa in silenzio. Ora è
// marcata amountMissing (il chiamante la stima dalla storia o la segnala).
test('spesa con verbo ma SENZA importo → non persa, marcata amountMissing', () => {
  const r = VoiceParser.parse('ho preso il caffè');
  assert.ok(r && r.length === 1);
  assert.equal(r[0].intent, 'transaction');
  assert.equal(r[0].amount, 0);
  assert.equal(r[0].amountMissing, true);
});

test('mix: una voce con importo + una senza → entrambe presenti (una amountMissing)', () => {
  const r = VoiceParser.parse('ho comprato il pane e ho speso 20 euro di benzina');
  const tx = r.filter(x => x.intent === 'transaction');
  assert.equal(tx.length, 2);
  assert.equal(tx.filter(t => t.amountMissing).length, 1);
  assert.equal(tx.filter(t => t.amount === 20).length, 1);
});

test('rumore senza verbo né importo → nessuna transazione inventata', () => {
  const r = VoiceParser.parse('ciao come stai oggi');
  const tx = (r || []).filter(x => x.intent === 'transaction');
  assert.equal(tx.length, 0);
});

// ── LINGUA DEL RICONOSCIMENTO VOCALE ──
// BUG REALE (2026-08-17): recognition.lang era fissato su 'it-IT' sempre —
// un dispositivo in inglese veniva ascoltato con un modello linguistico
// sbagliato, producendo trascrizioni spazzatura senza dirne il motivo.
test('linguaVoceAttiva: dispositivo in inglese → "en", non sempre "it"', () => {
  const prev = globalThis.navigator.language;
  globalThis.navigator.language = 'en-US';
  try { assert.equal(linguaVoceAttiva(), 'en'); }
  finally { globalThis.navigator.language = prev; }
});

test('linguaVoceAttiva: nessun segnale → "it" (l\'app nasce italiana, mai un crash)', () => {
  const prev = globalThis.navigator.language;
  delete globalThis.navigator.language;
  try { assert.equal(linguaVoceAttiva(), 'it'); }
  finally { globalThis.navigator.language = prev; }
});

test('SPEECH_LOCALE: ogni lingua rilevabile ha un locale BCP-47 valido per il Web Speech API', () => {
  for (const [lang, locale] of Object.entries(SPEECH_LOCALE)) {
    assert.match(locale, /^[a-z]{2}-[A-Z]{2}$/, `${lang} -> "${locale}" non è un locale valido`);
  }
});

// ── VOCE IN INGLESE: bug reali trovati testando dal vivo (2026-08-17) ──
test('inglese: "euros"/"dollars" (plurale) sparisce dalla descrizione, non solo "euro"/"dollar"', () => {
  const [r] = VoiceParser.parse('I spent 15 euros on groceries');
  assert.equal(r.amount, 15);
  assert.doesNotMatch(r.description, /euros?/i);
});

test('inglese: "remind me to call X" resta UN promemoria, non due azioni ("call" è verbo qui, non il sostantivo "a call")', () => {
  const r = VoiceParser.parse('remind me to call the accountant next Monday');
  assert.equal(r.length, 1, `attesa 1 azione, trovate ${r.length}: ${JSON.stringify(r)}`);
  assert.ok(r[0].intent === 'reminder' || r[0].intent === 'appointment');
});

test('inglese: "I have a call at 3pm" resta un appuntamento (uso legittimo di "call" come sostantivo, non rotto dal fix sopra)', () => {
  const r = VoiceParser.parse('I have a call at 3pm');
  const appt = r.find(x => x.intent === 'appointment');
  assert.ok(appt, `atteso un appuntamento: ${JSON.stringify(r)}`);
});

test('inglese: connettivi residui ("my", "of", "the", "at") non restano nella descrizione', () => {
  const [r] = VoiceParser.parse('I received my salary of 2000 euros');
  assert.doesNotMatch(r.description, /\b(my|of)\b/i);
  const [r2] = VoiceParser.parse('I spent 20 dollars at the supermarket');
  assert.doesNotMatch(r2.description, /\b(at|the)\b/i);
});
