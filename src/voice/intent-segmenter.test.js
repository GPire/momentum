import test from "node:test";
import assert from "node:assert/strict";

// Ambiente minimo per importare VoiceParser (usa window/document/NeuralNexus).
globalThis.window = globalThis.window || { SpeechRecognition: undefined, webkitSpeechRecognition: undefined };
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };
globalThis.indexedDB = undefined;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

const { segmentIntents } = await import("./intent-segmenter.js");
const { VoiceParser } = await import("./voice.js");

// ══════════════════════════════════════════════════════════════════════════
// SEGMENTAZIONE PURA — ogni scenario, come chiederebbe un utente reale.
// ══════════════════════════════════════════════════════════════════════════

test("una sola spesa → un solo segmento", () => {
  assert.equal(segmentIntents("ho speso 20 euro di benzina").length, 1);
});

test("descrizione con 'e' interna NON si spezza (pane e latte)", () => {
  assert.equal(segmentIntents("ho comprato pane e latte per 5 euro").length, 1);
});

test("elenco di voci con prezzo proprio si spezza sul connettivo", () => {
  assert.equal(segmentIntents("caffè 3 euro e pranzo 12 euro").length, 2);
});

test("appuntamento con più persone NON si spezza (con Marco e Luca)", () => {
  assert.equal(segmentIntents("ho un appuntamento con Marco e Luca").length, 1);
});

test("spesa + appuntamento verbless-priced misti si separano", () => {
  const s = segmentIntents("ho una riunione alle 10 e caffè 3 euro");
  assert.equal(s.length, 2);
});

// BUG REALE trovato testando dal vivo con frasi discorsive (2026-08-17):
// "ventitré euro e cinquanta" (centesimi detti a parole) restava tagliato
// in DUE segmenti (23€ e 50€) invece di restare un solo importo (23,50€) —
// la segmentazione gira DOPO normalizeForSegmentation, quindi il fix deve
// convertire in cifre PRIMA che il taglio in due avvenga, non dopo.
test("BUG REALE: centesimi a parole (\"ventitré euro e cinquanta\") restano UN solo segmento", () => {
  const s = segmentIntents("ho speso ventitré euro e cinquanta al ristorante");
  assert.equal(s.length, 1);
  assert.match(s[0], /23\.50/);
});

test('normalizeForSegmentation converte "undici euro e trenta" in "11.30 euro"', async () => {
  const { normalizeForSegmentation } = await import('./intent-segmenter.js');
  assert.match(normalizeForSegmentation('undici euro e trenta'), /11\.30 euro/);
});

test('centesimi a parole SOPRA i 99 non vengono confusi (mai un importo a 3 cifre scambiato per centesimi)', () => {
  // "cento" non è nella lista sotto-cento: la frase resta gestita dal ramo
  // esistente dei numeri composti ("cento" + "cinquanta" restano separati
  // se non seguiti dal pattern "euro e"), nessun crash né importo inventato.
  const s = segmentIntents("ho speso cento euro e ho speso cinquanta euro");
  assert.equal(s.length, 2, 'due spese vere restano due spese, non si fondono per errore');
});

test("numeri-parola contigui restano uno (mille duecento)", () => {
  assert.equal(segmentIntents("ho speso mille e duecento euro di affitto").length, 1);
});

test("orario non è un confine né un importo (riunione alle 10)", () => {
  const s = segmentIntents("giovedì ho una riunione di lavoro alle 10");
  assert.equal(s.length, 1);
});

test("ancore di appuntamento nuove (riunione/call/colloquio/visita/conferenza)", () => {
  const s = segmentIntents("ho una riunione alle 9 e ho una call alle 10 e ho un colloquio alle 11 e ho una visita alle 12 e ho una conferenza alle 13");
  assert.equal(s.length, 5);
});

test("stringa vuota → nessun segmento", () => {
  assert.equal(segmentIntents("").length, 0);
  assert.equal(segmentIntents("   ").length, 0);
});

// ══════════════════════════════════════════════════════════════════════════
// STRESS 20+20 — la richiesta esplicita: 20 spese con descrizioni + 20
// appuntamenti con descrizioni in UNA frase, nulla perso, nulla fuso.
// ══════════════════════════════════════════════════════════════════════════

test("STRESS: 20 transazioni + 20 appuntamenti in una frase → 40 azioni, nulla perso", () => {
  const descrizioni = [
    "benzina", "spesa al supermercato", "pane e latte", "caffè al bar", "pranzo con i colleghi",
    "abbonamento palestra", "libro di storia", "cena fuori", "biglietto del treno", "farmacia",
    "vestiti nuovi", "regalo per Anna", "parcheggio in centro", "cinema con gli amici", "taxi la sera",
    "bolletta della luce", "internet di casa", "assicurazione auto", "scarpe da corsa", "colazione"
  ];
  const appunt = [
    ["appuntamento dal dentista", "lunedì", "9"],
    ["riunione di lavoro", "martedì", "10"],
    ["call con il team", "mercoledì", "11"],
    ["visita medica", "giovedì", "12"],
    ["colloquio di lavoro", "venerdì", "14"],
    ["conferenza sul marketing", "sabato", "15"],
    ["incontro con il commercialista", "domani", "16"],
    ["appuntamento dal barbiere", "lunedì", "17"],
    ["riunione di condominio", "martedì", "18"],
    ["call con il cliente", "mercoledì", "9"],
    ["visita dal cardiologo", "giovedì", "10"],
    ["colloquio con il direttore", "venerdì", "11"],
    ["conferenza stampa", "sabato", "12"],
    ["incontro con gli amici", "domenica", "13"],
    ["appuntamento dall'avvocato", "lunedì", "14"],
    ["riunione con i fornitori", "martedì", "15"],
    ["call di aggiornamento", "mercoledì", "16"],
    ["visita di controllo", "giovedì", "17"],
    ["colloquio conoscitivo", "venerdì", "18"],
    ["conferenza annuale", "sabato", "9"],
  ];
  const txPhrases = descrizioni.map((d, i) => `ho speso ${(i + 1) * 5} euro di ${d}`);
  const apPhrases = appunt.map(([nome, giorno, ora]) => `${giorno} ho ${nome} alle ${ora}`);
  // intervallati (spesa, appuntamento, spesa, appuntamento…) come parlerebbe davvero.
  const interleaved = [];
  for (let i = 0; i < 20; i++) { interleaved.push(txPhrases[i]); interleaved.push(apPhrases[i]); }
  const text = interleaved.join(" e ");

  const results = VoiceParser.parse(text);
  assert.ok(results, "parse ha restituito null");
  const tx = results.filter(r => r.intent === "transaction");
  const events = results.filter(r => r.intent === "appointment" || r.intent === "reminder");

  assert.equal(tx.length, 20, `transazioni attese 20, trovate ${tx.length}`);
  assert.equal(events.length, 20, `eventi attesi 20, trovati ${events.length}`);
  assert.equal(results.length, 40, `azioni totali attese 40, trovate ${results.length}`);

  // Importi: somma attesa = 5*(1+2+...+20) = 5*210 = 1050. Nessun importo perso.
  const somma = tx.reduce((s, t) => s + t.amount, 0);
  assert.equal(somma, 1050, `somma importi attesa 1050, trovata ${somma}`);

  // Ogni transazione ha una descrizione sensata (≥3 char, mai residuo "ho").
  tx.forEach(t => {
    assert.ok(t.description.length >= 3, `descrizione troppo corta: "${t.description}"`);
    assert.ok(!/^ho\b/i.test(t.description.trim()), `descrizione con "ho" residuo: "${t.description}"`);
  });
});

test("STRESS misto: spese + entrate + investimenti + split + appuntamenti insieme", () => {
  const text = "ho speso 20 euro di spesa e ho ricevuto lo stipendio di 1500 euro e ho investito 200 euro in bitcoin e dividi 40 di cena con Marco e domani ho un appuntamento dal dentista alle 15 e ho messo 100 euro da parte";
  const r = VoiceParser.parse(text);
  assert.ok(r);
  assert.equal(r.filter(x => x.intent === "transaction" && x.type === "uscita").length, 1);
  assert.equal(r.filter(x => x.intent === "transaction" && x.type === "entrata").length, 1);
  assert.equal(r.filter(x => x.intent === "transaction" && x.type === "invest").length, 2); // bitcoin + da parte
  assert.equal(r.filter(x => x.intent === "split").length, 1);
  assert.equal(r.filter(x => x.intent === "appointment").length, 1);
});

test("robustezza: tutte le spese di un dump hanno importo corretto e non si mescolano", () => {
  const r = VoiceParser.parse("ho pagato 30 di benzina e ho comprato 15 euro di libri e ho speso 8 euro di caffè e ho pagato 45 di cena");
  const tx = r.filter(x => x.intent === "transaction");
  assert.equal(tx.length, 4);
  assert.deepEqual(tx.map(t => t.amount).sort((a, b) => a - b), [8, 15, 30, 45]);
});

test("inglese misto: transazioni e appuntamento", () => {
  const r = VoiceParser.parse("i spent 20 euros on lunch and i paid 15 for parking and tomorrow i have a meeting");
  assert.ok(r.filter(x => x.intent === "transaction").length >= 2);
});

// ══════════════════════════════════════════════════════════════════════════
// OGNI ORDINE — le stesse azioni permutate NON devono cambiare il risultato.
// Garantiamo che il riconoscimento non dipenda dalla sequenza (robustezza
// reale: un utente le dice in qualsiasi ordine).
// ══════════════════════════════════════════════════════════════════════════

// Frasi atomiche con intento/importo attesi (verificabili).
const ATOMICHE = [
  { p: "ho speso 20 euro di benzina", intent: "transaction", type: "uscita", amount: 20 },
  { p: "ho pagato 45 euro di cena", intent: "transaction", type: "uscita", amount: 45 },
  { p: "ho ricevuto lo stipendio di 1500 euro", intent: "transaction", type: "entrata", amount: 1500 },
  { p: "ho investito 200 euro in bitcoin", intent: "transaction", type: "invest", amount: 200 },
  { p: "ho messo 100 euro da parte", intent: "transaction", type: "invest", amount: 100 },
  { p: "domani ho un appuntamento dal dentista alle 15", intent: "appointment" },
  { p: "giovedì ho una riunione di lavoro alle 10", intent: "appointment" },
  { p: "venerdì ho un colloquio alle 11", intent: "appointment" },
  { p: "ricordami di chiamare il commercialista lunedì", intent: "reminder" },
];

function multisetIntenti(results) {
  const m = {};
  for (const r of results) m[r.intent] = (m[r.intent] || 0) + 1;
  return m;
}
const ATTESO = multisetIntenti(ATOMICHE.map(a => ({ intent: a.intent })));
const SOMMA_ATTESA = ATOMICHE.filter(a => a.amount).reduce((s, a) => s + a.amount, 0);

// Permutazioni deterministiche (niente casualità nei test): identità, inversa,
// appuntamenti-prima, transazioni-prima, e alcune rotazioni.
function ordinamenti(arr) {
  const isTx = a => a.intent === "transaction";
  const rot = (n) => arr.map((_, i) => arr[(i + n) % arr.length]);
  return {
    "identità": arr.slice(),
    "inverso": arr.slice().reverse(),
    "appuntamenti-prima": [...arr.filter(a => !isTx(a)), ...arr.filter(isTx)],
    "transazioni-prima": [...arr.filter(isTx), ...arr.filter(a => !isTx(a))],
    "rotazione-3": rot(3),
    "rotazione-5": rot(5),
    "pari-poi-dispari": [...arr.filter((_, i) => i % 2 === 0), ...arr.filter((_, i) => i % 2 === 1)],
  };
}

for (const [nome, ord] of Object.entries(ordinamenti(ATOMICHE))) {
  test(`ordine "${nome}": stesse azioni riconosciute (intenti + somma importi)`, () => {
    const text = ord.map(a => a.p).join(" e ");
    const r = VoiceParser.parse(text);
    assert.ok(r, `parse null per ordine ${nome}`);
    assert.deepEqual(multisetIntenti(r), ATTESO, `intenti diversi per ordine ${nome}: ${JSON.stringify(multisetIntenti(r))}`);
    const somma = r.filter(x => x.intent === "transaction").reduce((s, t) => s + t.amount, 0);
    assert.equal(somma, SOMMA_ATTESA, `somma importi diversa per ordine ${nome}: ${somma}`);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// BUG REALE segnalato dall'utente (2026-08-17): "ho speso 20 euro ALLA
// spesa" si spezzava a metà frase, perdendo la parola "spesa" — SPEND_VERB
// riconosce "spesa" come il verbo "speso" (stesso participio, generi
// diversi), e la lista di preposizioni/articoli che dovrebbero escluderlo
// copriva solo le forme contratte con "di" (della/dello/...), dimenticando
// quelle con "a/da/su/in" (alla/dalla/nella/sulla/...) — proprio le
// costruzioni più comuni del parlato ("alla spesa", "dalla spesa"). Stesso
// omografo esiste per "presa" (participio di "preso") e "ricevuta"
// (participio di "ricevuto").
// ══════════════════════════════════════════════════════════════════════════

test('BUG REALE: "alla spesa" non si spezza a metà (spesa = sostantivo, non il verbo speso)', () => {
  const s = segmentIntents('ho speso 20 euro alla spesa e ho un appuntamento dal dentista giovedì alle 15');
  assert.equal(s.length, 2);
  assert.equal(s[0], 'ho speso 20 euro alla spesa');
  assert.match(s[1], /appuntamento/);
});

test('BUG REALE: stesso omografo con "dalla"/"nella"/"sulla" (non solo "alla")', () => {
  assert.equal(segmentIntents('ho speso 30 euro dalla spesa e ho investito 100 euro nel fondo pensione').length, 2);
  assert.equal(segmentIntents('ho speso 12 euro nella spesa settimanale e ho un appuntamento lunedì alle 11').length, 2);
  assert.equal(segmentIntents('ho speso 45 euro sulla spesa alimentare e ho un appuntamento mercoledì alle 16').length, 2);
});

test('BUG REALE: stesso omografo con "presa" e "ricevuta" (non solo "spesa")', () => {
  assert.equal(segmentIntents('ho pagato 10 euro alla presa elettrica').length, 1);
  assert.equal(segmentIntents('ho comprato 5 euro alla ricevuta del panettiere').length, 1);
});

test('SCENARIO: entrata + uscita + investimento + appuntamento + promemoria, tutto in un unico discorso', () => {
  const s = segmentIntents(
    "ho guadagnato 500 euro di stipendio ho speso 45 euro sulla spesa alimentare e ho un appuntamento dal dottore mercoledì alle 16 e ricordami di pagare l'affitto venerdì"
  );
  assert.equal(s.length, 4);
  assert.match(s[0], /guadagnato/);
  assert.match(s[1], /speso/);
  assert.match(s[2], /appuntamento/);
  assert.match(s[3], /ricordami/);
});

test('BUG REALE: "ho un appuntamento" apre una nuova azione anche SENZA connettivo "e" prima (solo virgola/pausa)', () => {
  // Trascrizione reale testata dal vivo (2026-08-17): fra la spesa e
  // l'appuntamento non c'era "e" ma una virgola — che normalizeForSegmentation
  // riduce a semplice spazio, quindi il taglio dipende SOLO dal
  // riconoscimento dell'ancora "appuntamento", non dal connettivo. "ho un"
  // restava incollato in coda al segmento SBAGLIATO (la spesa precedente)
  // invece di aprire il nuovo segmento.
  const s = segmentIntents('ho comprato una pizza 30 euro del ristorante ho un appuntamento domani alle 15');
  assert.equal(s.length, 2);
  assert.equal(s[0], 'ho comprato una pizza 30 euro del ristorante');
  assert.equal(s[1], 'ho un appuntamento domani alle 15');
});

test('BUG REALE: "ho un appuntamento" a INIZIO frase resta un solo segmento (nessuna azione precedente da cui separarsi)', () => {
  assert.equal(segmentIntents('ho un appuntamento con Marco domani alle 10').length, 1);
  assert.equal(segmentIntents('giovedì ho una riunione di lavoro alle 10').length, 1);
});

test('ENGLISH: income + expense + investment + appointment + reminder, all in one utterance', () => {
  const s = segmentIntents(
    "I earned 500 euros of salary I spent 45 euros on groceries and I have an appointment with the doctor at 16 and remind me to pay the rent friday"
  );
  assert.equal(s.length, 4);
  assert.match(s[0], /earned/);
  assert.match(s[1], /spent/);
  assert.match(s[2], /appointment/);
  assert.match(s[3], /remind/);
});

test('ENGLISH end-to-end (VoiceParser.parse): the mixed sentence produces the right 4 intents with the right types', () => {
  const r = VoiceParser.parse(
    "I earned 500 euros of salary I spent 45 euros on groceries and I have an appointment with the doctor at 16 and remind me to pay the rent friday"
  );
  assert.ok(r);
  const entrata = r.find(x => x.intent === 'transaction' && x.type === 'entrata');
  const uscita = r.find(x => x.intent === 'transaction' && x.type === 'uscita');
  const appt = r.find(x => x.intent === 'appointment');
  const rem = r.find(x => x.intent === 'reminder');
  assert.ok(entrata && entrata.amount === 500, 'missing/wrong income amount');
  assert.ok(uscita && uscita.amount === 45, 'missing/wrong expense amount');
  assert.ok(appt, 'missing appointment');
  assert.ok(rem, 'missing reminder');
});

test('ENGLISH BUG REGRESSION: "I have an appointment" opens a new action mid-utterance without a connective too', () => {
  const s = segmentIntents('I bought a pizza 30 euros from the restaurant I have an appointment tomorrow at 15');
  assert.equal(s.length, 2);
  assert.match(s[1], /appointment/);
});

test('SCENARIO end-to-end (VoiceParser.parse): la frase mista produce i 4 intenti giusti coi tipi giusti', () => {
  const r = VoiceParser.parse(
    "ho guadagnato 500 euro di stipendio ho speso 45 euro sulla spesa alimentare e ho un appuntamento dal dottore mercoledì alle 16 e ricordami di pagare l'affitto venerdì"
  );
  assert.ok(r);
  const entrata = r.find(x => x.intent === 'transaction' && x.type === 'entrata');
  const uscita = r.find(x => x.intent === 'transaction' && x.type === 'uscita');
  const appt = r.find(x => x.intent === 'appointment');
  const rem = r.find(x => x.intent === 'reminder');
  assert.ok(entrata && entrata.amount === 500, 'entrata da 500€ mancante o importo sbagliato');
  assert.ok(uscita && uscita.amount === 45, 'uscita da 45€ mancante o importo sbagliata');
  assert.ok(appt, 'appuntamento mancante');
  assert.equal(appt.hasTime, true, 'l\'orario del dottore (alle 16) deve essere riconosciuto');
  assert.ok(rem, 'promemoria mancante');
});

// Combinazioni a COPPIE, in ENTRAMBI gli ordini: ogni tipo accanto a ogni altro,
// avanti e indietro — nessuna coppia deve fondersi o perdere un pezzo.
test("ogni COPPIA di tipi, nei due ordini, resta due azioni", () => {
  for (let i = 0; i < ATOMICHE.length; i++) {
    for (let j = 0; j < ATOMICHE.length; j++) {
      if (i === j) continue;
      const a = ATOMICHE[i], b = ATOMICHE[j];
      const r = VoiceParser.parse(`${a.p} e ${b.p}`);
      assert.ok(r, `parse null per coppia ${i},${j}`);
      // Almeno 2 azioni (a volte 2 transazioni invest+invest restano 2 distinte).
      assert.ok(r.length >= 2, `coppia fusa (${a.p} | ${b.p}) → ${r.length} azioni: ${JSON.stringify(r.map(x => x.intent))}`);
    }
  }
});
