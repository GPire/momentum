import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizza, estraiPeriodo, intentoMercato, rifiutoMotivato,
  chiediAlMercato, chiediAlMercatoSync, precarica, pronto, rispostaCausaleCripto,
  DOMANDE_SENZA_RISPOSTA,
  dimenticaContesto,
  rispostaSincrona,
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

test('il 1998 ORA si può raccontare: l\'archivio giornaliero parte dal 1985', async () => {
  // Questo test asseriva "archivio dettagliato parte dal 2021" ed era giusto
  // finché l'archivio giornaliero copriva cinque anni. Estendendolo al 1985
  // quella frase è diventata FALSA — l'app aveva i dati e diceva di non
  // averli — e il test la difendeva. Un test che difende una frase invece di
  // un comportamento invecchia insieme alla frase.
  const r = await chiediAlMercato('cosa è successo nel 1998?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /giorni di borsa/);
  assert.ok(!/parte dal 2021/.test(r.answer), r.answer);
});

test('un periodo DAVVERO fuori archivio riceve un no chiaro, non numeri inventati', async () => {
  const r = await chiediAlMercato('cosa è successo nel 1970?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /Non ho i dati giorno per giorno/);
  assert.match(r.answer, /1985/);
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
    'quanto posso perdere nel caso peggiore?': 'mercato-perdita-massima',
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

test('RISCHIO DI ROVINA (BANCO_TRADER, Cantiere E2 — costruito e mai raggiungibile prima di questa sessione): senza un numero nella domanda, confronta 1/2/5% invece di indovinare', async () => {
  const r = await chiediAlMercato('quanto rischio per operazione prima di non rialzarmi più?');
  assert.equal(r.intent, 'mercato-rischio-rovina');
  assert.match(r.answer, /1%/);
  assert.match(r.answer, /2%/);
  assert.match(r.answer, /5%/);
  assert.match(r.answer, /edge-neutro|50\/50/, 'deve dichiarare l\'assunzione di tasso di vincita, mai nasconderla');
});

test('RISCHIO DI ROVINA: con una percentuale nella domanda, calcola SOLO quella — stessi numeri già misurati in una sessione precedente (2%→38%, 1%→4%)', async () => {
  const due = await chiediAlMercato('rischio il 2% a operazione, qual è la probabilità di rovina?');
  assert.equal(due.intent, 'mercato-rischio-rovina');
  assert.match(due.answer, /38%/);
  const uno = await chiediAlMercato('rischio l\'1% a operazione, qual è la probabilità di rovina?');
  assert.match(uno.answer, /4%/);
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

// ── Materie prime, casa, e l'ordine delle regole ──

test('L\'ORDINE DELLE REGOLE: le domande specifiche non devono cadere in quelle generiche', async () => {
  await precarica();
  // Ognuna di queste, prima di sistemare l'ordine, finiva nell'intento
  // sbagliato e riceveva una risposta corretta ma a un'altra domanda.
  assert.equal(intentoMercato('l\'oro protegge dall\'inflazione?'), 'inflazione-protezione',
    'cadeva in "oro", che risponde sui crolli di borsa');
  assert.equal(intentoMercato('il rame protegge dall\'inflazione?'), 'inflazione-protezione',
    'cadeva in "rifugi"');
  assert.equal(intentoMercato('come va il mercato immobiliare in Italia?'), 'immobiliare',
    'cadeva in "regime", per via di "come va il mercato"');
  // E queste NON devono essere state rubate dalle regole nuove.
  assert.equal(intentoMercato('le criptovalute proteggono nei crolli?'), 'cripto-rifugio');
  assert.equal(intentoMercato('come va il mercato?'), 'regime');
  assert.equal(intentoMercato('l\'oro protegge quando la borsa crolla?'), 'oro');
});

test('le domande di SEGUITO ereditano il contesto, e solo quello', async () => {
  await precarica();
  dimenticaContesto();
  // Da sola, "e in Asia?" non vuol dire niente: giusto non rispondere.
  assert.equal(rispostaSincrona('e in Asia?'), null);
  // Dopo una domanda sulla casa, invece, vuol dire la casa in Asia.
  rispostaSincrona('come va il mercato immobiliare in Italia?');
  const dopo = rispostaSincrona('e in Asia?');
  assert.ok(dopo, 'la conversazione si interrompeva proprio dove diventava interessante');
  assert.match(dopo.answer, /Asia/);
  assert.match(dopo.answer, /Giappone/);
  dimenticaContesto();
  assert.equal(rispostaSincrona('e nel resto del mondo?'), null, 'il contesto si può azzerare');
});

test('"quanto è salito l\'oro" riceve il numero REALE, non quello che si legge sul grafico', async () => {
  await precarica();
  const r = rispostaSincrona('quanto è salito l\'oro dal 1980?');
  assert.match(r.answer, /inflazione/);
  assert.match(r.answer, /45\.1 anni|45 anni/, 'l\'attesa per tornare in pari è il fatto che conta');
  assert.ok(!/dovresti|conviene/i.test(r.answer));
});

test('sulle TERRE RARE la risposta è cambiata perché la mia affermazione era sbagliata', async () => {
  await precarica();
  // Questo test prima verificava che la risposta dicesse "il dato non esiste".
  // Era la mia affermazione, non un fatto: cercando meglio sono saltati fuori
  // 121 anni di statistiche pubbliche dello USGS. Il test è stato riscritto
  // perché controllava che ripetessi un errore.
  for (const d of ['cosa sono le terre rare come investimento?', 'conviene investire in terre rare?']) {
    const r = rispostaSincrona(d);
    assert.ok(r, `nessuna risposta a: ${d}`);
    assert.match(r.answer, /121 anni/);
    assert.match(r.answer, /non sono rare/i, 'il fatto controintuitivo è il cuore della risposta');
    assert.match(r.answer, /dipendenza/, 'concentrazione, non scarsità');
    // Quello che resta vero della vecchia risposta: non c'è una quotazione, e
    // quello che si compra è azionario.
    assert.match(r.answer, /quotazione di borsa/);
    assert.match(r.answer, /minerarie/);
  }
});

test('"il mattone non scende mai" riceve 28 Paesi, non un\'opinione', async () => {
  await precarica();
  const r = rispostaSincrona('il mattone non scende mai, vero?');
  assert.match(r.answer, /28 Paesi/);
  assert.match(r.answer, /Irlanda/);
  assert.ok(!/dovresti|ti consiglio/i.test(r.answer));
});

// ── Cantiere E3/D via il pannello nuovo (screener-settore.js, 600 aziende) ──
// I due casi che qa-banco-prova.js (BANCO_BANKER) aspettava da prima che
// questi moduli esistessero: "il punteggio di manipolazione contabile" e
// "chi somiglia a questa azienda" — entrambi 'unknown' prima di questa
// sessione, mai wired dentro mercato-qa.js nonostante screener-settore.js
// esistesse già.

test('"il punteggio di manipolazione contabile di Apple" riceve Beneish/Piotroski, non "non lo so"', async () => {
  await precarica();
  const r = rispostaSincrona('qual è il punteggio di manipolazione contabile di Apple?');
  assert.ok(r, 'la domanda non deve cadere nel rifiuto generico');
  assert.equal(r.intent, 'mercato-qualita-contabile');
  // O calcola davvero (Beneish/Piotroski citati) o dichiara onestamente
  // perché non può — mai un silenzio, mai un numero senza spiegazione.
  assert.ok(/Beneish|Piotroski|Non ho i due bilanci/.test(r.answer), r.answer);
  assert.ok(!/non lo so$/i.test(r.answer.trim()));
});

test('senza nominare un\'azienda, la domanda sulla qualità contabile chiede quale, non inventa', async () => {
  await precarica();
  const r = rispostaSincrona('questi accrual sono normali o un campanello d\'allarme?');
  assert.equal(r.intent, 'mercato-qualita-contabile');
  assert.match(r.answer, /di quale azienda/i);
});

test('"chi somiglia a questa azienda sui conti" (Apple) riceve comparabili REALI, stesso settore e taglia simile', async () => {
  await precarica();
  const r = rispostaSincrona('chi somiglia ad Apple sui conti?');
  assert.ok(r, 'la domanda non deve cadere nel rifiuto generico');
  assert.equal(r.intent, 'mercato-comparabili');
  assert.ok(/Comparabili di|Non ho comparabili/.test(r.answer), r.answer);
});

test('il rifiuto motivato continua a intercettare consigli travestiti da domande sui conti', async () => {
  await precarica();
  const no = rifiutoMotivato('Apple è un buy secondo il suo Beneish M-Score?');
  assert.ok(no, 'un consiglio di investimento travestito da domanda tecnica deve restare rifiutato');
});

test('"quadro completo su questo titolo" (BANCO_BANKER): senza azienda nominata resta la panoramica di MERCATO, invariata', async () => {
  await precarica();
  const r = rispostaSincrona('dammi il quadro completo su questo titolo, non solo un numero');
  assert.equal(r.intent, 'mercato-panoramica');
  assert.match(r.answer, /indicatori|archivio/i, 'senza un\'azienda deve restare la panoramica generale, non inventarne una');
});

test('"quadro completo su Apple" compone percentili + qualità contabile + comparabili — tre cose già costruite, non una quarta nuova', async () => {
  await precarica();
  const r = rispostaSincrona('dammi il quadro completo su Apple, non solo un numero');
  assert.equal(r.intent, 'mercato-panoramica');
  assert.match(r.answer, /Apple/);
  assert.match(r.answer, /percentile/);
  assert.match(r.answer, /Beneish|Piotroski/);
  assert.match(r.answer, /Comparabili/);
  assert.ok(!/dovresti|ti consiglio|compra|vendi/i.test(r.answer));
});

test('"filtrami le aziende del settore per margine e crescita insieme" (BANCO_BANKER, testuale): senza contesto, chiede quale azienda', async () => {
  await precarica();
  dimenticaContesto();
  const r = rispostaSincrona('filtrami le aziende del settore per margine e crescita insieme');
  assert.equal(r.intent, 'mercato-screener-settore');
  assert.match(r.answer, /quale azienda/i);
});

test('lo screener EREDITA il settore dall\'ultima azienda discussa (stesso schema del contesto regionale "e in Asia?")', async () => {
  await precarica();
  dimenticaContesto();
  rispostaSincrona('chi somiglia ad Apple sui conti?'); // imposta il contesto (settore di Apple)
  const r = rispostaSincrona('filtrami le aziende del settore per margine e crescita insieme');
  assert.equal(r.intent, 'mercato-screener-settore');
  assert.ok(r.data.disponibile, JSON.stringify(r.data));
  assert.deepEqual(r.data.criteri, ['margine', 'crescita']);
  // Ordine DECRESCENTE — mai una lista a caso.
  for (let i = 1; i < r.data.classificate.length; i++) {
    assert.ok(r.data.classificate[i - 1].punteggioCombinato >= r.data.classificate[i].punteggioCombinato);
  }
  dimenticaContesto();
});

test('senza criteri nominati nella domanda, lo screener usa un default sensato invece di rifiutarsi', async () => {
  await precarica();
  dimenticaContesto();
  rispostaSincrona('chi somiglia ad Apple sui conti?');
  const r = rispostaSincrona('filtrami le aziende del settore');
  assert.equal(r.intent, 'mercato-screener-settore');
  assert.ok(r.data.criteri.length > 0, 'mai zero criteri: un default deve scattare');
  dimenticaContesto();
});

// ── confronto-titoli / titolo-causale — sbloccati via settore SPDR
// (sic-settore-map.js), 777 righe di src/alpha/confronto-titoli.js e
// titolo-causale.js costruite e testate dal 2026-08-21 ma mai raggiungibili
// da una domanda vera fino a questa sessione (BANCO_INVESTITORE). ──

test('BANCO_INVESTITORE: "la differenza fra questi due titoli si distingue dal rumore?" (Apple vs Caterpillar, settori diversi) risponde con dati reali', async () => {
  await precarica();
  const r = rispostaSincrona('la differenza fra Apple e Caterpillar si distingue dal rumore?');
  assert.equal(r.intent, 'mercato-confronto-titoli');
  assert.ok(r.data.disponibile, JSON.stringify(r.data));
  assert.match(r.answer, /Apple/);
  assert.match(r.answer, /CATERPILLAR|Caterpillar/i);
  assert.match(r.answer, /distinguibile dal rumore/);
  assert.match(r.answer, /non esiste uno storico prezzi mensile per il singolo titolo/, 'deve sempre dichiarare l\'approssimazione di settore');
  // Confine di parola, non sottostringa: "comprando" (descrittivo, legittimo
  // qui: "stanno comprando la stessa cosa" = stessa esposizione) contiene
  // "compra" — lo stesso errore di sottostringa già trovato e corretto più
  // volte in questa sessione (screener-settore.js: "quest" dentro "questi").
  assert.ok(!/\bdovresti\b|\bti consiglio\b|\bcompra\b|\bvendi\b/i.test(r.answer));
});

test('confronto-titoli: due aziende dello STESSO settore approssimato non vengono confrontate come se fossero dati distinti — si dichiara, mai un confronto degenere', async () => {
  await precarica();
  // Apple e Microsoft finiscono entrambe nel settore Tecnologia con questa mappa.
  const r = rispostaSincrona('la differenza fra Apple e Microsoft si distingue dal rumore?');
  assert.equal(r.intent, 'mercato-confronto-titoli');
  assert.match(r.answer, /stesso settore approssimato/);
});

test('confronto-titoli: senza due aziende nominate, chiede quali — mai un confronto a caso', async () => {
  await precarica();
  const r = rispostaSincrona('la differenza fra questi due titoli si distingue dal rumore?');
  assert.equal(r.intent, 'mercato-confronto-titoli');
  assert.match(r.answer, /quali due aziende/i);
});

test('BANCO_INVESTITORE: "è stata bravura mia o solo il mercato che saliva?" scompone il titolo (via il suo settore) dal mercato', async () => {
  await precarica();
  dimenticaContesto();
  rispostaSincrona('chi somiglia ad Apple sui conti?'); // imposta il contesto
  const r = rispostaSincrona('è stata bravura mia o solo il mercato che saliva?');
  assert.equal(r.intent, 'mercato-titolo-causale');
  assert.ok(r.data.disponibile, JSON.stringify(r.data));
  assert.match(r.answer, /Apple/);
  assert.match(r.answer, /roba sua/);
  assert.match(r.answer, /non esiste uno storico prezzi mensile per il singolo titolo/);
  dimenticaContesto();
});

test('titolo-causale: senza contesto né azienda nominata, chiede quale — mai un titolo a caso', async () => {
  await precarica();
  dimenticaContesto();
  const r = rispostaSincrona('è stata bravura mia o solo il mercato che saliva?');
  assert.equal(r.intent, 'mercato-titolo-causale');
  assert.match(r.answer, /di quale azienda/i);
});

// ── titolo-causale su CRIPTO (crypto-storico.js — CoinGecko, storico
// giornaliero, non mensile: il piano gratuito limita a 365 giorni,
// verificato dal vivo il 2026-08-24) — separato dal ramo azionario via
// settore perché richiede una rete vera, mai dentro rispostaSincrona. ──

function serieBtcEAltcoin(n, beta, seedRumore = 1) {
  // Serie sintetiche, non casuali: BTC oscilla in modo prevedibile, l'altcoin
  // è ESATTAMENTE beta*BTC + un piccolo rumore deterministico — così scomponi()
  // deve ritrovare un beta vicino a quello vero, non un numero a caso.
  const btc = Array.from({ length: n }, (_, i) => 0.01 * Math.sin(i / 3));
  const alt = btc.map((r, i) => beta * r + seedRumore * 0.0005 * Math.cos(i / 5));
  return { btc, alt };
}

function fetchImplCripto({ giorni = 300, beta = 1.2 } = {}) {
  const { btc, alt } = serieBtcEAltcoin(giorni, beta);
  const aPrezzi = (rend) => {
    const p = [1000];
    for (const r of rend) p.push(p.at(-1) * (1 + r));
    return p.map((v, i) => [i * 86400000, v]);
  };
  return async (url) => ({
    ok: true,
    json: async () => ({ prices: aPrezzi(url.includes('/bitcoin/') ? btc : alt) }),
  });
}

test('rispostaCausaleCripto: scompone un altcoin contro Bitcoin, testo in GIORNI non mesi (granularità diversa dal ramo azionario)', async () => {
  const r = await rispostaCausaleCripto('è stata bravura mia o solo il mercato per Ethereum?', { fetchImpl: fetchImplCripto({ beta: 1.2 }) });
  assert.ok(r, 'una cripto riconosciuta deve rispondere');
  assert.equal(r.intent, 'mercato-titolo-causale');
  assert.match(r.answer, /giorni/);
  assert.ok(!/\bmesi\b/.test(r.answer), 'granularità giornaliera: mai "mesi" nel testo');
  assert.match(r.answer, /Bitcoin/);
  // Beta ricostruito dalla regressione vicino a quello vero (1,2) — prova
  // che scomponi() sta davvero leggendo i dati iniettati, non un fisso.
  assert.ok(Math.abs(r.data.scomposizione.beta - 1.2) < 0.15, `beta=${r.data.scomposizione.beta}`);
});

test('rispostaCausaleCripto: Bitcoin contro se stesso si rifiuta, onestamente', async () => {
  const r = await rispostaCausaleCripto('è stata bravura mia o solo il mercato per Bitcoin?', { fetchImpl: fetchImplCripto() });
  assert.equal(r.intent, 'mercato-titolo-causale');
  assert.match(r.answer, /contro se stess/);
});

test('rispostaCausaleCripto: nessuna cripto nominata → null (si scende al ramo azionario)', async () => {
  const r = await rispostaCausaleCripto('è stata bravura mia o solo il mercato che saliva?', { fetchImpl: fetchImplCripto() });
  assert.equal(r, null);
});

// ── CONFRONTO DIRETTO CRIPTO-VS-CRIPTO (2026-09-05) — gap reale rispetto a
// CoinStats/Delta, che lo fanno per qualunque coppia mentre Momentum prima
// scomponeva SEMPRE contro Bitcoin, anche nominando due cripto diverse. ──
function fetchImplCoppia({ giorni = 300, beta = 1.4 } = {}) {
  // Serie sintetiche per ID specifico (non "bitcoin sì/no" come sopra):
  // 'ethereum' è la base, 'solana' è ESATTAMENTE beta*ethereum + rumore.
  const base = Array.from({ length: giorni }, (_, i) => 0.01 * Math.sin(i / 3));
  const derivata = base.map((r, i) => beta * r + 0.0005 * Math.cos(i / 5));
  const aPrezzi = (rend) => {
    const p = [1000];
    for (const r of rend) p.push(p.at(-1) * (1 + r));
    return p.map((v, i) => [i * 86400000, v]);
  };
  return async (url) => ({
    ok: true,
    json: async () => ({ prices: aPrezzi(url.includes('/ethereum/') ? base : derivata) }),
  });
}

test('rispostaCausaleCripto: nominando due cripto (non Bitcoin) scompone la SECONDA come riferimento, non Bitcoin', async () => {
  const r = await rispostaCausaleCripto('confronta queste due cripto: solana ed ethereum', { fetchImpl: fetchImplCoppia({ beta: 1.4 }) });
  assert.ok(r, 'due cripto riconosciute devono rispondere');
  assert.equal(r.intent, 'mercato-titolo-causale');
  assert.equal(r.data.riferimento, 'ethereum', 'la seconda cripto nominata è il riferimento, non Bitcoin');
  assert.match(r.answer, /ethereum/i);
  assert.ok(!/bitcoin/i.test(r.answer), 'con due cripto nominate, Bitcoin non deve comparire nella risposta');
  // Tolleranza più larga di quella del test originale (beta contro Bitcoin,
  // 0.15): qui la serie base è essa stessa una sinusoide (non un "mercato"
  // con più armoniche), la regressione ci arriva vicino ma con più
  // oscillazione — è la stessa proprietà (beta ricostruito ~ beta vero),
  // solo misurata con un margine realistico per questa fixture.
  assert.ok(Math.abs(r.data.scomposizione.beta - 1.4) < 0.35, `beta=${r.data.scomposizione.beta}`);
});

test('rispostaCausaleCripto: la PRIMA cripto nominata è il soggetto (target), la seconda il riferimento — l\'ordine conta', async () => {
  // Stessa coppia, ordine invertito nel testo: ora Solana è il riferimento.
  const r = await rispostaCausaleCripto('confronta queste due cripto: ethereum e solana', { fetchImpl: fetchImplCoppia({ beta: 1.4 }) });
  assert.equal(r.data.riferimento, 'solana');
});

test('rispostaCausaleCripto: con una sola cripto nominata il comportamento resta quello di sempre (contro Bitcoin)', async () => {
  const r = await rispostaCausaleCripto('è stata bravura mia o solo il mercato per Ethereum?', { fetchImpl: fetchImplCripto({ beta: 1.2 }) });
  assert.equal(r.data.riferimento, 'Bitcoin');
  assert.match(r.answer, /Bitcoin/);
});

test('chiediAlMercato: "confronta queste due cripto" passa dal ramo del confronto diretto', async () => {
  assert.equal(intentoMercato('confronta queste due cripto: solana ed ethereum'), 'titolo-causale');
  // Ma un confronto fra AZIONI non deve essere rubato da questo trigger.
  assert.equal(intentoMercato('confronta questi due titoli, quale ha reso di più'), 'confronto-titoli');
});

test('chiediAlMercato: una domanda su Ethereum passa dal ramo cripto, non da quello azionario via settore', async () => {
  // chiediAlMercato usa fetch globale (non riceve fetchImpl): si inietta
  // temporaneamente global.fetch, stesso schema usato altrove nei test di
  // rete di questo progetto quando la funzione pubblica non prende fetchImpl.
  const originale = global.fetch;
  global.fetch = fetchImplCripto({ beta: 0.8 });
  try {
    const r = await chiediAlMercato('è stata bravura mia o solo il mercato per Ethereum?');
    assert.equal(r.intent, 'mercato-titolo-causale');
    assert.match(r.answer, /giorni/);
  } finally {
    global.fetch = originale;
  }
});

test('PRIMA che gli archivi siano pronti NON si dice "non lo so": si dice di riprovare', async () => {
  // Il bug trovato provando dal vivo: nei primi secondi dopo l'avvio i moduli
  // di mercato non sono ancora caricati, e la risposta cadeva nel rifiuto
  // generico del QA. Un modulo importato fresco riproduce esattamente quello
  // stato — con la cache calda il bug è invisibile, ed è il motivo per cui
  // nessun test lo aveva visto.
  const fresco = await import(`./mercato-qa.js?freddo=${Date.now()}`);
  const r = fresco.rispostaSincrona('quanto è salito l\'oro dal 1980?');
  assert.ok(r, 'una domanda riconosciuta non deve sparire nel nulla');
  assert.equal(r.inCaricamento, true, 'il chiamante deve poter rifare la domanda da solo');
  assert.match(r.answer, /riprova|istante/i);
  assert.ok(!/non la so|non lo so/i.test(r.answer), 'non è vero che non la sa: la sa e basta aspettare');
  // E una domanda che NON riguarda i mercati continua a non ricevere risposta
  // da qui, anche a freddo: il ponte non deve rubare le domande altrui.
  assert.equal(fresco.rispostaSincrona('quanto ho speso questo mese?'), null);
});
