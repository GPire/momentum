import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizza, estraiPeriodo, intentoMercato, rifiutoMotivato,
  chiediAlMercato, chiediAlMercatoSync, precarica, pronto,
  DOMANDE_SENZA_RISPOSTA,
} from './mercato-qa.js';

// I moduli pesanti si caricano una volta per tutto il file.
test('il precaricamento rende disponibili le risposte sincrone', async () => {
  assert.equal(pronto(), false, 'prima del precaricamento non deve essere pronto');
  await precarica();
  assert.equal(pronto(), true);
});

// ── Estrazione del periodo ──

test('riconosce le tre forme in cui una persona scrive una data', () => {
  assert.equal(estraiPeriodo('cosa è successo ad aprile 2025?').etichetta, 'aprile 2025');
  assert.equal(estraiPeriodo('com\'è andato il 2022?').etichetta, 'il 2022');
  assert.equal(estraiPeriodo('e nel 2025-04?').etichetta, '2025-04');
  assert.equal(estraiPeriodo('cosa protegge?'), null);
});

test('gli accenti non cambiano il significato di una domanda', () => {
  assert.equal(normalizza('Il mercato salirà?'), 'il mercato salira?');
  assert.equal(normalizza("cos'è successo"), 'cos e successo');
});

// ── I RIFIUTI, che sono la parte più importante ──

test('NON SI RISPONDE MAI a cosa comprare o dove va il mercato', () => {
  for (const d of ['cosa devo comprare?', 'su cosa investo?', 'è il momento di comprare?',
    'il mercato salirà?', 'dove va il mercato?', 'quanto scenderà la borsa?', 'cosa farà la Fed?']) {
    const r = chiediAlMercatoSync(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, 'mercato-non-si-puo', `"${d}" ha ricevuto ${r.intent}`);
  }
});

test('ogni rifiuto spiega il PERCHÉ e dice cosa si può chiedere invece', () => {
  for (const d of DOMANDE_SENZA_RISPOSTA) {
    assert.ok(d.risposta.length > 100, 'un rifiuto di una riga è una scusa, non una risposta');
    assert.ok(/perch|ragione|nessuno sa|non la so/i.test(d.risposta), `manca il perché: ${d.risposta}`);
  }
  const compra = rifiutoMotivato('cosa devo comprare?');
  assert.match(compra.answer, /nessuno sa cosa farà il mercato/);
  assert.match(compra.answer, /cosa è successo/);
});

test('il rifiuto ha la precedenza sulla risposta: non si aggira riformulando', () => {
  // "conviene comprare oro?" contiene 'oro' e 'convien', che farebbero scattare
  // l'intento sull'oro. Ma chiede cosa comprare, e quello viene prima.
  const r = chiediAlMercatoSync('conviene comprare oro adesso?');
  assert.equal(r.intent, 'mercato-non-si-puo');
});

// ── Le risposte che invece esistono ──

test('COSA È SUCCESSO in un periodo: fatto verificabile', async () => {
  const r = await chiediAlMercato('cosa è successo ad aprile 2025?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /2025-04/);
  assert.match(r.answer, /nel mezzo sono arrivate a perdere/);
});

test('un periodo fuori archivio riceve un no chiaro, non numeri inventati', async () => {
  const r = await chiediAlMercato('cosa è successo nel 1998?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /archivio dettagliato parte dal 2021/);
});

test('LE CRIPTO: risposta netta e con i numeri', async () => {
  const r = await chiediAlMercato('le cripto proteggono quando crolla la borsa?');
  assert.equal(r.intent, 'mercato-cripto');
  assert.match(r.answer, /^No\./);
  assert.match(r.answer, /amplificano/);
});

test('L\'ORO: si smonta il luogo comune con la misura, non con un\'opinione', async () => {
  const r = await chiediAlMercato('l\'oro protegge davvero?');
  assert.equal(r.intent, 'mercato-oro');
  assert.match(r.answer, /monetina/);
  assert.match(r.answer, /volte su 100/);
});

test('le altre domande con risposta arrivano tutte a destinazione', async () => {
  const attesi = {
    'cosa protegge quando crolla il mercato?': 'mercato-rifugi',
    'quali settori tengono nei crolli?': 'mercato-settori',
    'conviene diversificare nel mondo?': 'mercato-diversificazione',
    'sta arrivando una recessione?': 'mercato-recessione',
    'come sta il mercato adesso?': 'mercato-regime',
  };
  for (const [d, intent] of Object.entries(attesi)) {
    const r = await chiediAlMercato(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, intent, `"${d}" -> ${r.intent}`);
    assert.ok(r.answer.length > 40, `risposta troppo corta per "${d}"`);
  }
});

// ── Cosa NON deve intercettare ──

test('le domande sui soldi PROPRI non finiscono in un\'analisi di borsa', () => {
  for (const d of ['quanto ho speso questo mese?', 'quando mi pagano?', 'quanto posso spendere oggi?',
    'quanto ho speso in bar?', 'a quanto ammonta il mio patrimonio?']) {
    assert.equal(intentoMercato(d), null, `"${d}" è stato scambiato per una domanda di mercato`);
    assert.equal(chiediAlMercatoSync(d), null);
  }
});

test('una domanda che non c\'entra niente non riceve una risposta di mercato', () => {
  assert.equal(chiediAlMercatoSync('quanto costa un caffè'), null);
  assert.equal(chiediAlMercatoSync(''), null);
  assert.equal(chiediAlMercatoSync(null), null);
});

// ── La regola di fondo ──

test('NESSUNA risposta suggerisce mai di comprare o vendere', async () => {
  const domande = [
    'cosa protegge quando crolla il mercato?', 'l\'oro protegge?',
    'le cripto proteggono?', 'quali settori tengono nei crolli?',
    'conviene diversificare nel mondo?', 'sta arrivando una recessione?',
    'come sta il mercato adesso?', 'cosa è successo ad aprile 2025?',
  ];
  for (const d of domande) {
    const r = await chiediAlMercato(d);
    assert.ok(!/dovresti comprare|ti conviene comprare|conviene vendere|compra ora|vendi ora/i.test(r.answer),
      `indicazione operativa in "${d}": ${r.answer}`);
  }
});

// ── L'innesto nel QA vero ──

test('INNESTO: il QA delle finanze personali consulta i mercati solo alla fine', async () => {
  globalThis.window = globalThis.window || {};
  globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
  const { answerQuestion } = await import('../ai/qa-engine.js');

  const ctx = { allTx: {}, referenceDate: new Date(), mercato: chiediAlMercatoSync };
  // Domanda di mercato: senza il ponte sarebbe 'unknown'.
  const mercato = answerQuestion('cosa protegge quando crolla il mercato?', ctx);
  assert.equal(mercato.intent, 'mercato-rifugi');
  // Senza il ponte, la stessa domanda resta senza risposta: la prova che
  // l'innesto sta davvero facendo qualcosa.
  const senza = answerQuestion('cosa protegge quando crolla il mercato?', { allTx: {}, referenceDate: new Date() });
  assert.equal(senza.intent, 'unknown');
});

test('IL PRECARICAMENTO SCALDA ANCHE I SETTORI: la prima domanda non riceve "non lo so"', async () => {
  // Questo test nasce da un bug visto solo nel browser: la risposta sui
  // settori si calcola in modo asincrono, e alla PRIMA domanda tornava null.
  // Nei test non si vedeva perche' le chiamate precedenti avevano gia' riempito
  // la cache — il classico difetto che i test si nascondono a vicenda.
  // Si forza un modulo pulito per riprodurre davvero il primo avvio.
  const fresco = await import(`./mercato-qa.js?prima=${Date.now()}`);
  await fresco.precarica();
  const r = fresco.chiediAlMercatoSync('quali settori tengono nei crolli?');
  assert.ok(r, 'la PRIMA domanda sui settori deve gia\' avere una risposta');
  assert.equal(r.intent, 'mercato-settori');
});

test('LE DOMANDE DA OPERATORE: perdita massima, scenario, durata, limiti', async () => {
  const attesi = {
    'quanto posso perdere nel caso peggiore?': 'mercato-perdita',
    'e se si ripetesse il 2008?': 'mercato-scenario',
    'quanto dura un mercato orso?': 'mercato-durata',
    'cosa non sai?': 'mercato-limiti',
    'quanto sono affidabili le tue previsioni?': 'mercato-limiti',
  };
  for (const [d, intent] of Object.entries(attesi)) {
    const r = await chiediAlMercato(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, intent, `"${d}" -> ${r.intent}`);
    assert.ok(r.answer.length > 80);
  }
});

test('LA PERDITA MASSIMA spiega perché la soglia da sola inganna', async () => {
  const r = await chiediAlMercato('quanto posso perdere nel caso peggiore?');
  assert.match(r.answer, /sottostimare la perdita/);
  assert.ok(r.data.es < r.data.var, 'la perdita media nella coda deve essere peggiore della soglia');
});

test('LO SCENARIO dice "simulare" e non "prevedere"', async () => {
  const r = await chiediAlMercato('e se si ripetesse il 2008?');
  assert.match(r.answer, /simularlo, ma non prevederlo/);
  assert.match(r.answer, /i regimi non saltano/);
});

test('I LIMITI sono la risposta più importante: elenca cosa NON sa, con i numeri', async () => {
  const r = await chiediAlMercato('cosa non sai?');
  assert.match(r.answer, /non so dove andra/i);
  assert.match(r.answer, /banca centrale/);
  assert.match(r.answer, /mesi di distanza nessuno dei segnali/);
  assert.ok(r.data.finestraCieca.length > 0, 'la finestra cieca deve venire da una misura, non da una frase');
});

// ── L'ALTRA METÀ: chi non sa ancora niente ──

test('EDUCAZIONE: le definizioni sono semplici e portano un numero MISURATO', async () => {
  await precarica();
  const attesi = {
    "cos'è la volatilità?": /balla/,
    'cosa vuol dire diversificare?': /non si muovono insieme/i,
    "cos'è un ETF?": /pacchetto/,
    "cos'è un mercato orso?": /stagione/,
    'cosa sono le obbligazioni?': /prestito/,
    'spiegami la curva dei rendimenti': /si "inverte"/,
    "cos'è un bene rifugio?": /quando tutto il resto scende/,
    "cos'è il rischio?": /vendere in un brutto momento/,
  };
  for (const [d, atteso] of Object.entries(attesi)) {
    const r = await chiediAlMercato(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, 'mercato-spiegazione', `"${d}" -> ${r.intent}`);
    assert.match(r.answer, atteso);
  }
});

test('UNA DEFINIZIONE CHE PORTA UN FATTO si ricorda, una astratta no', async () => {
  await precarica();
  // Non è un glossario: ogni voce che PUÒ avere un numero deve averlo.
  const conNumero = {
    "cos'è la volatilità?": /mese peggiore ha fatto/,
    'cosa vuol dire diversificare?': /Esempio misurato/,
    "cos'è un mercato orso?": /mesi — ma il piu/,
    "cos'è un bene rifugio?": /L'oro, che tutti chiamano/,
  };
  for (const [d, atteso] of Object.entries(conNumero)) {
    const r = await chiediAlMercato(d);
    assert.match(r.answer, atteso, `"${d}" ha perso il numero misurato`);
  }
});

test('BUG DI SOTTOSTRINGA: "obbligazioni" contiene "azioni"', async () => {
  await precarica();
  const obb = await chiediAlMercato('cosa sono le obbligazioni?');
  assert.match(obb.answer, /prestito/, 'deve rispondere sulle obbligazioni, non sulle azioni');
  const az = await chiediAlMercato("cos'è un'azione?");
  assert.match(az.answer, /pezzetto di un/, 'e le azioni devono restare le azioni');
});

test('chi chiede COS\'È non riceve un numero al posto di una spiegazione', async () => {
  await precarica();
  // "cos'è la volatilità" non è "quanto è volatile adesso": rispondere con un
  // indice sarebbe il modo più veloce di perdere una persona che sta imparando.
  const r = await chiediAlMercato("cos'è la volatilità?");
  assert.equal(r.intent, 'mercato-spiegazione');
  assert.ok(!/indice|percentile|deviazione standard|sigma/i.test(r.answer), `gergo: ${r.answer}`);
});

test('le spiegazioni non suggeriscono comunque mai cosa fare', async () => {
  await precarica();
  for (const d of ["cos'è un ETF?", 'cosa sono le obbligazioni?', "cos'è un bene rifugio?"]) {
    const r = await chiediAlMercato(d);
    assert.ok(!/dovresti|conviene|ti consiglio|meglio comprare/i.test(r.answer), `consiglio in "${d}": ${r.answer}`);
  }
});
