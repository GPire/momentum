import test from 'node:test';
import assert from 'node:assert/strict';
const { taxSetAside, taxSetAsideForPeriod, classifyIncome, learnIncomeType, suggestRegime, projectAnnualTax, inferAtecoSettore, FORFETTARIO_CEILING, REGIMI, ATECO_COEFFICIENTI, simulateNewPartitaIva, CASSE_PROFESSIONALI, ATECO_COMUNI, searchAtecoComuni, CAUSE_ESCLUSIONE_FORFETTARIO, verificaEsclusioneForfettario } = await import('./tax.js');

function fattura(desc, amount = 1000, date = '2026-03-10') {
  return { type: 'entrata', description: desc, amount, date };
}

test('proiezione: conserva tutti gli incassi classificati e passa età e cassa senza mutare lo storico', () => {
  const transactions = Object.freeze([
    Object.freeze(fattura('fattura Alfa', '1000', '2026-01-10')),
    Object.freeze(fattura('fattura Beta', 69000, '2026-02-10')),
  ]);
  const opts = { regime: 'forfettario', cassaPropria: 'medici_odontoiatri', eta: 45, year: 2026, referenceDate: new Date('2026-12-31T12:00:00Z') };
  const result = projectAnnualTax(transactions, opts);
  assert.equal(result.invoicedYTD, 70000);
  assert.equal(result.estimatedAnnualTax, taxSetAside(70000, opts).setAside);
  assert.equal(transactions[0].amount, '1000');
});

test('proiezione e simulatore condividono anno e aggiornamento regole ricevuti', () => {
  // Fixture tecnica, non normativa reale.
  const rulesOverride = { version: 'test-only', rules: { 2025: { forfettarioCeiling: 80000, impostaStd: 0.12, impostaStartup: 0.04, startupAnni: 5, inpsGestioneSeparata: 0.2 } } };
  const opts = { regime: 'forfettario', year: 2025, rulesOverride, referenceDate: new Date('2025-01-31T12:00:00Z') };
  const projection = projectAnnualTax([fattura('fattura cliente', 1000, '2025-01-31')], opts);
  assert.equal(projection.regimeSuggestion.ceiling, 80000);
  assert.equal(projection.estimatedAnnualTax, taxSetAside(12000, opts).setAside);
  const simulation = simulateNewPartitaIva(12000, opts);
  assert.equal(simulation.setAside, projection.estimatedAnnualTax);
  assert.equal(suggestRegime(81000, opts).overCeiling, true);
});

test('forfettario: scomposizione INPS + imposta, netto coerente', () => {
  const r = taxSetAside(1000, { regime: 'forfettario' });
  // imponibile=1000, reddito=780, inps=780*0.2607=203.35, imposta=(780-203.35)*0.15=86.50
  assert.ok(Math.abs(r.setAside - (203.35 + 86.50)) < 1, `setAside ${r.setAside}`);
  assert.equal(r.net, +(1000 - r.setAside).toFixed(2));
  assert.ok(r.breakdown.length === 2); // no IVA nel forfettario
  assert.ok(r.effectiveRate > 20 && r.effectiveRate < 40);
});

test('forfettario startup: imposta 5% → accantonamento minore', () => {
  const full = taxSetAside(1000, { regime: 'forfettario' });
  const startup = taxSetAside(1000, { regime: 'forfettario_startup' });
  assert.ok(startup.setAside < full.setAside);
});

test('ordinario: include IVA da versare', () => {
  const r = taxSetAside(1000, { regime: 'ordinario' });
  assert.ok(r.breakdown.some(b => /IVA/.test(b.voce)));
  assert.ok(r.setAside > taxSetAside(1000, { regime: 'forfettario' }).setAside);
});

// ============================================================
// GRANDISSIMI FATTURATI — richiesta esplicita dell'utente: il regime
// ordinario deve reggere anche i fatturati molto sopra il tetto forfettario,
// con la vera progressività IRPEF (scaglioni reali, tax-rules.js), non una
// stima piatta che sottostimerebbe (o sovrastimerebbe) di molto l'imposta
// vera proprio dove conta di più: i redditi alti.
// ============================================================

test('GRANDISSIMI FATTURATI: ordinario con scaglioni reali (anno 2026) usa IRPEF progressiva, non la stima piatta', () => {
  const r = taxSetAside(300000, { regime: 'ordinario', year: 2026 });
  assert.ok(r.breakdown.some((b) => /scaglioni reali/.test(b.voce)));
});

test('GRANDISSIMI FATTURATI: la progressività reale pesa meno della vecchia stima piatta al 27% su un reddito molto alto in parte ai primi scaglioni', () => {
  // A un imponibile che attraversa tutti e 3 gli scaglioni, l'aliquota
  // MEDIA reale (23/33/43 pesati) è diversa dalla stima piatta al 27% usata
  // prima di questa correzione — verifichiamo che il calcolo NON coincida
  // per costruzione con la vecchia formula piatta.
  const reale = taxSetAside(100000, { regime: 'ordinario', year: 2026 });
  const impostaReale = reale.breakdown.find((b) => /IRPEF/.test(b.voce)).importo;
  const redditoImponibile = 100000 * REGIMI.ordinario.coeffRedditivita;
  const inps = redditoImponibile * REGIMI.ordinario.inps;
  const impostaPiattaVecchia = +((redditoImponibile - inps) * REGIMI.ordinario.impostaSostitutiva).toFixed(2);
  assert.notEqual(impostaReale, impostaPiattaVecchia);
});

test('ordinario: anno SENZA scaglioni verificati (es. 2021) ripiega onestamente sulla stima piatta, dichiarata come tale', () => {
  const r = taxSetAside(50000, { regime: 'ordinario', year: 2021 });
  const voce = r.breakdown.find((b) => /IRPEF|Imposta/.test(b.voce));
  assert.match(voce.voce, /stima/i);
});

test('ordinario: fatturato piccolo E grande restano entrambi calcolabili senza crash, netto sempre coerente', () => {
  for (const importo of [500, 50000, 85000, 200000, 1000000]) {
    const r = taxSetAside(importo, { regime: 'ordinario', year: 2026 });
    assert.equal(r.net, +(importo - r.setAside).toFixed(2));
    assert.ok(r.setAside > 0 && r.setAside < importo);
  }
});

// ============================================================
// FORFETTARIO — ogni scenario, non solo il caso professionisti di default.
// BUG REALE trovato testando: ATECO_COEFFICIENTI (commercio 40%, costruzioni
// 86%, intermediari 62%, altre 67%) esiste ma non è collegato da NESSUNA
// parte del codice — taxSetAside usa sempre il coefficiente "professionisti"
// (78%) di REGIMI.forfettario, a prescindere dal settore reale dichiarato.
// Per un commerciante questo SOVRASTIMA pesantemente l'accantonamento
// (tassa il 78% del fatturato come reddito invece del 40% reale). Il
// meccanismo di override ESISTE già (opts.overrides) — qui si dimostra che
// funziona correttamente quando usato; il collegamento automatico (dedurre
// l'ATECO e passarlo da soli) è il prossimo passo, non ancora fatto.
// ============================================================

test('FORFETTARIO ogni ATECO: coefficienti diversi producono accantonamenti materialmente diversi (via overrides)', () => {
  const risultati = {};
  for (const [settore, { coeff }] of Object.entries(ATECO_COEFFICIENTI)) {
    risultati[settore] = taxSetAside(10000, { regime: 'forfettario', overrides: { coeffRedditivita: coeff } }).setAside;
  }
  // Costruzioni (86%) deve accantonare più di commercio (40%) sullo stesso
  // fatturato: sono settori con margini presunti molto diversi.
  assert.ok(risultati.costruzioni > risultati.commercio, `costruzioni ${risultati.costruzioni} vs commercio ${risultati.commercio}`);
  assert.ok(risultati.professionisti > risultati.commercio);
});

test('FORFETTARIO: SENZA override esplicito, usa sempre "professionisti" (78%) — dichiara il gap, non lo nasconde', () => {
  // Documenta lo stato attuale: un forfettario "commercio" che non passa
  // l'override viene comunque calcolato come se fosse un professionista.
  // Questo test fallirà (correttamente) il giorno in cui l'inferenza
  // automatica dell'ATECO verrà collegata — è il segnale che serve.
  const default_ = taxSetAside(10000, { regime: 'forfettario' });
  const commercioEsplicito = taxSetAside(10000, { regime: 'forfettario', overrides: { coeffRedditivita: ATECO_COEFFICIENTI.commercio.coeff } });
  assert.notEqual(default_.setAside, commercioEsplicito.setAside);
});

test('FORFETTARIO: coefficiente commercio (40%) accantona meno di metà rispetto a professionisti (78%) sullo stesso fatturato', () => {
  const professionisti = taxSetAside(20000, { regime: 'forfettario', overrides: { coeffRedditivita: ATECO_COEFFICIENTI.professionisti.coeff } });
  const commercio = taxSetAside(20000, { regime: 'forfettario', overrides: { coeffRedditivita: ATECO_COEFFICIENTI.commercio.coeff } });
  assert.ok(commercio.setAside < professionisti.setAside * 0.6);
});

test('FORFETTARIO: fatturato esattamente al tetto (85.000€) → ancora forfettario, non ancora oltre', () => {
  const s = suggestRegime(FORFETTARIO_CEILING);
  assert.equal(s.suggested, 'forfettario');
  assert.equal(s.overCeiling, false);
});

test('FORFETTARIO: un euro sopra il tetto → passa a ordinario', () => {
  const s = suggestRegime(FORFETTARIO_CEILING + 1);
  assert.equal(s.suggested, 'ordinario');
  assert.equal(s.overCeiling, true);
});

test('FORFETTARIO: fatturato zero → suggerisce forfettario (0% del tetto), nessun crash', () => {
  const s = suggestRegime(0);
  assert.equal(s.suggested, 'forfettario');
  assert.equal(s.pctOfCeiling, 0);
});

test('FORFETTARIO STARTUP: stesso coefficiente di redditività del forfettario normale, cambia solo l\'imposta', () => {
  assert.equal(REGIMI.forfettario_startup.coeffRedditivita, REGIMI.forfettario.coeffRedditivita);
  assert.equal(REGIMI.forfettario_startup.inps, REGIMI.forfettario.inps);
});

test('FORFETTARIO: fatturato molto piccolo (es. 50€, un primo cliente) → accantonamento coerente, mai zero per arrotondamento', () => {
  const r = taxSetAside(50, { regime: 'forfettario' });
  assert.ok(r.setAside > 0 && r.setAside < 50);
});

test('FORFETTARIO: overrides personalizzati NON intaccano il regime ordinario nella stessa sessione (nessuna mutazione condivisa)', () => {
  taxSetAside(10000, { regime: 'forfettario', overrides: { coeffRedditivita: 0.4 } });
  const dopo = taxSetAside(1000, { regime: 'forfettario' });
  // Deve tornare al default 78%, non restare "sporcato" dall'override precedente.
  const atteso = taxSetAside(1000, { regime: 'forfettario', overrides: { coeffRedditivita: REGIMI.forfettario.coeffRedditivita } });
  assert.equal(dopo.setAside, atteso.setAside);
});

// ============================================================
// inferAtecoSettore — SIMULAZIONI DI SCENARIO, ogni settore ATECO, ogni
// caso limite: nessuna fattura, segnale unico (troppo debole), segnale
// netto, settori misti/discordi, e l'effetto finale su taxSetAside.
// ============================================================

test('SCENARIO: nessuna transazione → nessuna inferenza, motivo onesto', () => {
  const r = inferAtecoSettore([]);
  assert.equal(r.inferred, false);
  assert.equal(r.settore, 'professionisti');
  assert.match(r.reason, /nessuna fattura/);
});

test('SCENARIO: solo entrate NON-fattura (stipendio/personale) → nessun segnale, default invariato', () => {
  const r = inferAtecoSettore([
    { type: 'entrata', description: 'stipendio mensile', amount: 2000, date: '2026-03-01' },
    { type: 'entrata', description: 'rimborso spese viaggio', amount: 50, date: '2026-03-05' },
  ]);
  assert.equal(r.inferred, false);
});

test('SCENARIO: UNA sola fattura con parola di settore → segnale troppo debole, resta professionisti', () => {
  const r = inferAtecoSettore([fattura('vendita prodotti al cliente')]);
  assert.equal(r.inferred, false, 'una sola fattura non deve bastare a cambiare il default');
});

test('SCENARIO: due o più fatture concordi su "commercio" → inferenza corretta', () => {
  const r = inferAtecoSettore([
    fattura('vendita prodotti online cliente A'),
    fattura('vendita merce cliente B'),
    fattura('fattura vendita articoli cliente C'),
  ]);
  assert.equal(r.inferred, true);
  assert.equal(r.settore, 'commercio');
  assert.equal(r.coeff, ATECO_COEFFICIENTI.commercio.coeff);
});

test('SCENARIO: due fatture concordi su "costruzioni" (edile/cantiere) → inferenza corretta', () => {
  const r = inferAtecoSettore([
    fattura('fattura cliente per lavori edili ristrutturazione appartamento'),
    fattura('fattura cantiere idraulico'),
  ]);
  assert.equal(r.settore, 'costruzioni');
  assert.equal(r.coeff, ATECO_COEFFICIENTI.costruzioni.coeff);
});

test('SCENARIO: due fatture concordi su "intermediari" (agenzia/provvigione) → inferenza corretta', () => {
  const r = inferAtecoSettore([
    fattura('fattura cliente provvigione agenzia immobiliare'),
    fattura('fattura commissione intermediazione vendita'),
  ]);
  assert.equal(r.settore, 'intermediari');
});

test('SCENARIO: fatture di consulenza/sviluppo (nessuna parola di settore specifico) → resta professionisti, non un\'inferenza sbagliata', () => {
  const r = inferAtecoSettore([
    fattura('consulenza sviluppo software cliente A'),
    fattura('consulenza design UX cliente B'),
    fattura('formazione onboarding cliente C'),
  ]);
  assert.equal(r.inferred, false);
  assert.equal(r.settore, 'professionisti');
});

test('SCENARIO: segnali MISTI tra due settori diversi → vince quello con più fatture concordi', () => {
  const r = inferAtecoSettore([
    fattura('vendita prodotti cliente A'),
    fattura('vendita merce cliente B'),
    fattura('vendita articoli cliente C'),
    fattura('lavori edili cantiere'), // un solo segnale costruzioni, minoritario
  ]);
  assert.equal(r.settore, 'commercio');
});

test('SCENARIO: fatture non imponibili (personal/salary) tra le fatture vere NON contano nel conteggio', () => {
  const r = inferAtecoSettore([
    fattura('vendita prodotti cliente A'),
    fattura('vendita merce cliente B'),
    { type: 'entrata', description: 'rimborso spese vendita auto personale', amount: 200, date: '2026-03-01' }, // personal, contiene "vendita" ma non è fattura
  ]);
  assert.equal(r.settore, 'commercio'); // le 2 fatture vere bastano comunque
});

test('SCENARIO END-TO-END: l\'inferenza collegata a taxSetAside cambia davvero l\'accantonamento di un commerciante', () => {
  const txs = [fattura('vendita prodotti cliente A'), fattura('vendita merce cliente B')];
  const inferenza = inferAtecoSettore(txs);
  const r = taxSetAside(10000, { regime: 'forfettario', overrides: { coeffRedditivita: inferenza.coeff } });
  const rDefault = taxSetAside(10000, { regime: 'forfettario' });
  assert.ok(r.setAside < rDefault.setAside, 'un commerciante deve accantonare meno del default professionisti sullo stesso fatturato');
});

test('importo zero → nessun accantonamento, mai NaN', () => {
  const r = taxSetAside(0);
  assert.equal(r.setAside, 0);
  assert.equal(r.net, 0);
});

test('taxSetAside: importo non numerico o input nullo resta sicuro', () => {
  const r = taxSetAside('non-numero');
  assert.equal(r.setAside, 0);
  assert.equal(r.net, 0);
  assert.doesNotThrow(() => taxSetAside(null));
});

test('periodo: entrate ambigue NON tassate d\'ufficio (default prudente), solo segnalate', () => {
  const txs = [
    { type: 'entrata', amount: 2000 },
    { type: 'entrata', amount: 1000 },
    { type: 'uscita', amount: 500 },
  ];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  assert.equal(r.count, 0);            // nessuna fattura chiara → niente tasse a caso
  assert.equal(r.daAccantonare, 0);
  assert.equal(r.uncertainCount, 2);   // segnalate per conferma
});

test('periodo: importi serializzati come stringhe vengono normalizzati e i valori rotti restano espliciti', () => {
  const r = taxSetAsideForPeriod([
    { type: 'entrata', amount: '1000', description: 'Fattura cliente' },
    { type: 'entrata', amount: 'non-numero', description: 'Fattura cliente' },
  ], { regime: 'forfettario' });
  assert.equal(r.incassato, 1000);
  assert.equal(r.count, 1);
  assert.equal(r.invalidCount, 1);
  assert.equal(r.invalidAmount, 0);
  assert.doesNotMatch(JSON.stringify(r), /NaN|Infinity/);
});

test('periodo: modalità cautelativa taxUncertain=true tassa anche le ambigue', () => {
  const txs = [{ type: 'entrata', amount: 1000 }];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario', taxUncertain: true });
  assert.equal(r.count, 1);
  assert.ok(r.daAccantonare > 0);
});

test('classifyIncome: distingue fattura / stipendio / personale / ambigua', () => {
  assert.equal(classifyIncome({ description: 'Fattura n.12 cliente Rossi', type: 'entrata' }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Compenso prestazione consulenza', type: 'entrata' }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Stipendio mensile', category: 'stipendio', type: 'entrata' }).kind, 'salary');
  assert.equal(classifyIncome({ description: 'Rimborso spese viaggio', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Bonifico da Mario', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'accredito', type: 'entrata' }).kind, 'uncertain');
});

test('classifyIncome: flag esplicito taxable ha la precedenza sull\'inferenza', () => {
  assert.equal(classifyIncome({ description: 'Stipendio', taxable: true }).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Fattura cliente', taxable: false }).kind, 'personal');
});

test('periodo: lo STIPENDIO non viene tassato come P.IVA (fix "messe a caso")', () => {
  const txs = [
    { type: 'entrata', amount: 3000, description: 'Fattura cliente Rossi' },
    { type: 'entrata', amount: 1500, description: 'Stipendio mensile', category: 'stipendio' },
    { type: 'entrata', amount: 200, description: 'Rimborso benzina' },
  ];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  assert.equal(r.incassato, 3000, 'solo la fattura è imponibile');
  assert.equal(r.count, 1);
  assert.equal(r.excludedCount, 2, 'stipendio + rimborso esclusi');
  assert.equal(r.excludedGross, 1700);
});

// "Tax Vault" (2026-09-06): COSA compone l'accantonamento, non solo il
// totale — riusa il breakdown già calcolato da taxSetAside per ogni
// transazione (mai una seconda formula), aggregato per voce sul periodo.
test('periodo: la scomposizione (breakdown) aggrega le stesse voci di taxSetAside, sommate su più fatture', () => {
  const txs = [
    { type: 'entrata', amount: 1000, description: 'Fattura cliente Rossi' },
    { type: 'entrata', amount: 2000, description: 'Fattura cliente Bianchi' },
  ];
  const periodo = taxSetAsideForPeriod(txs, { regime: 'forfettario' });
  const singola1 = taxSetAside(1000, { regime: 'forfettario' });
  const singola2 = taxSetAside(2000, { regime: 'forfettario' });
  const totaleAtteso = singola1.breakdown.find(b => b.voce === 'Imposta sostitutiva').importo
    + singola2.breakdown.find(b => b.voce === 'Imposta sostitutiva').importo;
  const voceImposta = periodo.breakdown.find(b => b.voce === 'Imposta sostitutiva');
  assert.ok(voceImposta, 'la voce "Imposta sostitutiva" deve essere aggregata');
  assert.equal(voceImposta.importo, +totaleAtteso.toFixed(2));
  // Somma di tutte le voci del breakdown ≈ daAccantonare, MAI esattamente
  // uguale per costruzione: setAside arrotonda la SOMMA grezza (iva+inps+
  // imposta) una volta sola, mentre ogni voce del breakdown si arrotonda
  // SINGOLARMENTE per la visualizzazione — su più transazioni le due
  // strategie di arrotondamento possono divergere di qualche centesimo.
  // Caratteristica nota di taxSetAside (non introdotta qui), non un bug:
  // la tolleranza è proporzionale al numero di transazioni sommate.
  const sommaVoci = periodo.breakdown.reduce((s, b) => s + b.importo, 0);
  assert.ok(Math.abs(sommaVoci - periodo.daAccantonare) <= 0.01 * txs.length,
    `breakdown (${sommaVoci}) troppo lontano da daAccantonare (${periodo.daAccantonare})`);
});

test('periodo: nessuna fattura → breakdown vuoto, mai un array con voci a zero fantasma', () => {
  const r = taxSetAsideForPeriod([{ type: 'entrata', amount: 500, description: 'Stipendio', category: 'stipendio' }], { regime: 'forfettario' });
  assert.deepEqual(r.breakdown, []);
});

test('interessi/dividendi/bonus bancari NON sono fatture P.IVA (fix reale su dati Revolut)', () => {
  assert.equal(classifyIncome({ description: 'Interessi', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Dividendo ASML', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Bonus Revolut', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Personal loan', type: 'entrata' }).kind, 'personal');
  assert.equal(classifyIncome({ description: 'Refund Amazon', type: 'entrata' }).kind, 'personal');
});

test('overrides: aliquote personalizzabili dall\'utente', () => {
  const r = taxSetAside(1000, { regime: 'forfettario', overrides: { impostaSostitutiva: 0.05 } });
  const base = taxSetAside(1000, { regime: 'forfettario' });
  assert.ok(r.setAside < base.setAside);
});

// ---- Auto-apprendimento + intelligenza regime (upgrade v10) ----

test('learnIncomeType + classifyIncome: impara dalla correzione dell\'utente', () => {
  // "Studio Rossi" senza keyword → uncertain
  assert.equal(classifyIncome({ description: 'Bonifico Studio Rossi 12' }).kind, 'uncertain');
  // l'utente conferma che è una fattura → appreso
  const learned = learnIncomeType({}, 'Bonifico Studio Rossi 12', 'invoice');
  assert.equal(classifyIncome({ description: 'Bonifico Studio Rossi 47' }, learned).kind, 'invoice');
  assert.equal(classifyIncome({ description: 'Bonifico Studio Rossi 47' }, learned).reason, 'appreso da una tua conferma precedente');
});

test('classifyIncome: GENERALIZZA ai mittenti simili (stesso cliente, mese diverso)', () => {
  // Una sola conferma su "Studio Verdi marzo" deve far riconoscere anche
  // "Studio Verdi aprile" (mese diverso, descrizione mai vista): la vecchia
  // chiave esatta NON ci riusciva, i token appresi sì.
  const learned = learnIncomeType({}, 'Compenso Studio Verdi marzo', 'invoice');
  const r = classifyIncome({ description: 'Studio Verdi aprile' }, learned);
  assert.equal(r.kind, 'invoice');
  assert.equal(r.reason, 'appreso dai tuoi mittenti simili');
});

test('classifyIncome: il voto token richiede evidenza netta (un token generico non basta)', () => {
  // Confermo un mittente "personale"; una descrizione che condivide solo un mese
  // (stopword) NON deve ereditare la classe.
  const learned = learnIncomeType({}, 'Regalo Nonna dicembre', 'personal');
  const r = classifyIncome({ description: 'Fattura dicembre cliente' }, learned);
  assert.equal(r.kind, 'invoice'); // vince la keyword fattura, non il token "dicembre" (è stopword)
});

test('classifyIncome: retro-compatibile con la vecchia mappa piatta salvata nei vault', () => {
  // Vault storici hanno taxLearned come { chiave: kind }: deve funzionare ancora.
  const legacy = { 'compenso studio bianchi': 'invoice' };
  const r = classifyIncome({ description: 'Compenso Studio Bianchi 88' }, legacy);
  assert.equal(r.kind, 'invoice');
  assert.equal(r.reason, 'appreso da una tua conferma precedente');
});

test('learnIncomeType: accumula i conteggi dei token nel nuovo formato', () => {
  let l = learnIncomeType({}, 'Acme Consulting gennaio', 'invoice');
  l = learnIncomeType(l, 'Acme Consulting febbraio', 'invoice');
  assert.equal(l.t.acme.invoice, 2);       // token accumulato su due conferme
  assert.equal(l.t.consulting.invoice, 2);
  assert.ok(l.k['acme consulting gennaio']); // chiavi esatte conservate
});

test('learnIncomeType: ignora kind non validi e descrizioni vuote', () => {
  assert.deepEqual(learnIncomeType({}, '', 'invoice'), {});
  assert.deepEqual(learnIncomeType({}, 'x', 'boh'), {});
});

test('suggestRegime: sopra il tetto forfettario → ordinario', () => {
  const r = suggestRegime(FORFETTARIO_CEILING + 10000);
  assert.equal(r.suggested, 'ordinario');
  assert.equal(r.overCeiling, true);
});

test('suggestRegime: sotto il tetto → forfettario con % del tetto', () => {
  const r = suggestRegime(42500); // 50% di 85000
  assert.equal(r.suggested, 'forfettario');
  assert.equal(r.overCeiling, false);
  assert.equal(r.pctOfCeiling, 50);
});

test('projectAnnualTax: annualizza le fatture e stima le tasse di fine anno', () => {
  const ref = new Date(2026, 5, 1); // 1 giugno → ~6 mesi trascorsi
  const txs = [
    { type: 'entrata', amount: 3000, description: 'Fattura n.1 cliente', date: '2026-01-15' },
    { type: 'entrata', amount: 3000, description: 'Fattura n.2 cliente', date: '2026-04-10' },
    { type: 'entrata', amount: 1500, description: 'Stipendio', date: '2026-03-01' }, // escluso
  ];
  const r = projectAnnualTax(txs, { regime: 'forfettario', referenceDate: ref });
  assert.equal(r.invoicedYTD, 6000);
  assert.ok(r.annualizedRevenue > 13000 && r.annualizedRevenue < 15500, `annualizzato ${r.annualizedRevenue}`);
  assert.ok(r.estimatedAnnualTax > 0);
  assert.ok(/proiezione lineare/.test(r.note));
});

test('projectAnnualTax: nessuna fattura → nessuna proiezione inventata', () => {
  const r = projectAnnualTax([{ type: 'entrata', amount: 500, description: 'rimborso', date: '2026-02-01' }], { referenceDate: new Date(2026, 5, 1) });
  assert.equal(r.invoicedYTD, 0);
  assert.equal(r.estimatedAnnualTax, 0);
});

test('projectAnnualTax: una data di riferimento serializzata o non valida non interrompe la stima', () => {
  const fromString = projectAnnualTax([{ type: 'entrata', amount: 1000, description: 'fattura cliente', date: '2026-01-15' }], { regime: 'forfettario', referenceDate: '2026-01-31T12:00:00Z' });
  assert.equal(fromString.year, 2026);
  assert.ok(fromString.estimatedAnnualTax > 0);
  const invalid = projectAnnualTax([{ type: 'entrata', amount: 1000, description: 'fattura cliente', date: '2026-01-15' }], { regime: 'forfettario', referenceDate: 'not-a-date' });
  assert.equal(invalid.year, new Date().getFullYear());
  assert.doesNotThrow(() => JSON.stringify(invalid));
});

test('taxSetAsideForPeriod: usa la memoria appresa per classificare', () => {
  const learned = learnIncomeType({}, 'Compenso mensile Acme', 'invoice');
  const txs = [{ type: 'entrata', amount: 2000, description: 'Compenso mensile Acme 03' }];
  const r = taxSetAsideForPeriod(txs, { regime: 'forfettario', learned });
  assert.equal(r.count, 1);
  assert.ok(r.daAccantonare > 0);
});

test('classifyIncome: usa il modello addestrato come segnale di generalizzazione', () => {
  const fakeModel = { predict: (t) => /studio|cliente|consul/i.test(t) ? { category: 'invoice', confidence: 0.9 } : { category: 'personal', confidence: 0.5 } };
  // descrizione SENZA parole-chiave forti ma che il modello riconosce
  const r = classifyIncome({ description: 'Studio Verdi 2026' }, null, fakeModel);
  assert.equal(r.kind, 'invoice');
  assert.ok(/modello fiscale/.test(r.reason));
});

test('classifyIncome: modello a bassa confidenza NON forza un\'etichetta', () => {
  const fakeModel = { predict: () => ({ category: 'invoice', confidence: 0.4 }) };
  const r = classifyIncome({ description: 'accredito xyz' }, null, fakeModel);
  assert.equal(r.kind, 'uncertain');
});

test('ENSEMBLE: modello sotto-soglia + tua conferma CONCORDE supera la soglia', () => {
  // Modello prevede invoice a 0.62: da solo NON basta (soglia 0.7) → uncertain.
  const fakeModel = { predict: () => ({ category: 'invoice', confidence: 0.62 }) };
  assert.equal(classifyIncome({ description: 'Gamma report' }, null, fakeModel).kind, 'uncertain');
  // UNA conferma su "Gamma widget" (nessuna keyword) → lean soft concorde: la
  // fusione noisy-OR porta 0.62 sopra 0.7 e decide, spiegandolo.
  const learned = learnIncomeType({}, 'Gamma widget', 'invoice');
  const r = classifyIncome({ description: 'Gamma report' }, learned, fakeModel);
  assert.equal(r.kind, 'invoice');
  assert.ok(/concordi/.test(r.reason));
});

test('ENSEMBLE: modello e conferme DISCORDI → resta uncertain (mai forzare)', () => {
  const fakeModel = { predict: () => ({ category: 'invoice', confidence: 0.62 }) };
  // Token "kappa" appreso come PERSONAL, modello dice invoice → discordi:
  // nessuna fusione, resta uncertain (l'ensemble si astiene, non inventa).
  const learned = learnIncomeType({}, 'Kappa donazione', 'personal');
  const r = classifyIncome({ description: 'Kappa report' }, learned, fakeModel);
  assert.equal(r.kind, 'uncertain');
});

// ── FATTURA da UNA RIGA (NL) ──────────────────────────────────────────────
const { parseInvoiceLine } = await import('./tax.js');

test('NL fattura: "fattura a Rossi Srl 500 per consulenza"', () => {
  const r = parseInvoiceLine('fattura a Rossi Srl 500 per consulenza');
  assert.equal(r.amount, 500);
  assert.equal(r.client, 'Rossi Srl');
  assert.equal(r.description.toLowerCase(), 'consulenza');
});

test('NL fattura: "500 a Mario Rossi per sito web"', () => {
  const r = parseInvoiceLine('500 a Mario Rossi per sito web');
  assert.equal(r.amount, 500);
  assert.equal(r.client, 'Mario Rossi');
  assert.equal(r.description.toLowerCase(), 'sito web');
});

test('NL fattura: importo decimale con virgola', () => {
  const r = parseInvoiceLine('emetti 1200,50 a Studio Bianchi per progetto');
  assert.equal(r.amount, 1200.5);
  assert.equal(r.client, 'Studio Bianchi');
});

test('NL fattura: senza importo → null (una fattura senza importo non esiste)', () => {
  assert.equal(parseInvoiceLine('fattura a Rossi per consulenza'), null);
  assert.equal(parseInvoiceLine(''), null);
});

// ── LIVELLO 0/1: simulatore per chi non ha ancora la P.IVA ─────────────────
test('simulateNewPartitaIva: fatturato zero → nessuna stima inventata', () => {
  const s = simulateNewPartitaIva(0);
  assert.equal(s.regime, null);
  assert.equal(s.setAside, 0);
  assert.match(s.note, /Inserisci/);
});

test('simulateNewPartitaIva: fatturato sotto il tetto → forfettario, con la nota sul primo anno', () => {
  const s = simulateNewPartitaIva(30000);
  assert.equal(s.regime, 'forfettario');
  assert.ok(s.setAside > 0);
  assert.ok(s.netAnnuo > 0 && s.netAnnuo < 30000);
  assert.equal(+(s.netMensile * 12).toFixed(2), s.netAnnuo);
  assert.match(s.primoAnnoNote, /SECONDO anno/);
  assert.match(s.primoAnnoNote, /quasi doppio/);
});

test('simulateNewPartitaIva: fatturato oltre il tetto → ordinario, coerente con suggestRegime', () => {
  const s = simulateNewPartitaIva(120000);
  assert.equal(s.regime, 'ordinario');
  assert.equal(s.suggestion.overCeiling, true);
});

test('simulateNewPartitaIva: strategie legittime — aliquota startup posta come domanda, mai come fatto certo', () => {
  const s = simulateNewPartitaIva(30000);
  const startupTip = s.strategie.find(t => t.icon === 'startup');
  assert.ok(startupTip, 'deve suggerire di verificare l\'aliquota startup');
  assert.match(startupTip.testo, /Chiedilo al commercialista/);
  assert.match(startupTip.testo, /prima attività/i);
});

test('simulateNewPartitaIva: strategia sul tempismo incassi solo quando vicini al tetto, mai a fatturati bassi', () => {
  const basso = simulateNewPartitaIva(15000); // 17% del tetto
  assert.equal(basso.strategie.find(t => t.icon === 'timing'), undefined);
  const vicino = simulateNewPartitaIva(65000); // 76% del tetto
  const timingTip = vicino.strategie.find(t => t.icon === 'timing');
  assert.ok(timingTip);
  assert.match(timingTip.testo, /incassi/);
});

test('simulateNewPartitaIva: oltre il tetto (regime ordinario) → nessuna strategia forfettario-specifica', () => {
  const s = simulateNewPartitaIva(120000);
  assert.equal(s.strategie.length, 0);
});

test('taxSetAside: cassa NON coperta da regole (una delle altre 13) -> INPS azzerato, mai un\'aliquota inventata', () => {
  const senzaCassa = taxSetAside(30000, { regime: 'forfettario' });
  const conCassa = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'medici_odontoiatri' }); // ENPAM, non in CASSE_CON_REGOLE
  assert.ok(senzaCassa.breakdown.find(b => b.voce === 'Contributi INPS').importo > 0);
  const rigaCassa = conCassa.breakdown.find(b => /ENPAM/.test(b.voce));
  assert.ok(rigaCassa, 'la scomposizione deve nominare la cassa vera, non "INPS"');
  assert.equal(rigaCassa.importo, 0, 'Momentum non inventa l\'aliquota di una cassa non verificata');
  assert.match(rigaCassa.nota, /ENPAM/);
  assert.match(rigaCassa.nota, /non all'INPS/);
  assert.equal(conCassa.cassaCalcolo, null);
  assert.equal(conCassa.cassaNome, 'ENPAM');
});

// ── Cassa professionale REALE (Cassa Forense/Inarcassa/CNPADC, 2026-08-26):
// aliquote/minimi verificati incrociando più fonti — vedi CASSE_CON_REGOLE.
// Numeri attesi calcolati a mano con la stessa aritmetica del codice, non
// dedotti dall'output della funzione stessa. ──

test('taxSetAside: Cassa Forense calcolata per davvero — soggettivo 17% + integrativo 4%, entrambi sopra il minimo a questo fatturato', () => {
  const r = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'avvocati' });
  // redditoImponibile = 30000*0.78 = 23400; soggettivo = 23400*0.17 = 3978 (> minimo 2790)
  // integrativo = 30000*0.04 = 1200 (> minimo 355)
  const soggettivo = r.breakdown.find(b => /soggettivo.*Cassa Forense/.test(b.voce));
  const integrativo = r.breakdown.find(b => /integrativo.*Cassa Forense/.test(b.voce));
  assert.ok(soggettivo && integrativo);
  assert.equal(soggettivo.importo, 3978);
  assert.equal(integrativo.importo, 1200);
  assert.equal(r.cassaCalcolo.totale, 5178);
  // Il soggettivo è deducibile: baseImposta = 23400-3978=19422, imposta = 19422*0.15=2913.3
  const imposta = r.breakdown.find(b => /Imposta/.test(b.voce));
  assert.equal(imposta.importo, 2913.3);
  assert.equal(r.setAside, 8091.3); // 2913.3 (imposta) + 5178 (cassa), zero INPS/IVA
  assert.equal(r.net, 21908.7);
});

test('taxSetAside: Cassa Forense — minimi applicati a un fatturato basso dove il calcolato scenderebbe sotto', () => {
  const r = taxSetAside(3000, { regime: 'forfettario', cassaPropria: 'avvocati' });
  // redditoImponibile = 3000*0.78=2340; soggettivo calcolato = 2340*0.17=397.8, MOLTO sotto il minimo 2790
  // integrativo calcolato = 3000*0.04=120, sotto il minimo 355
  assert.equal(r.cassaCalcolo.soggettivo, 2790, 'vince il minimo, non il calcolato');
  assert.equal(r.cassaCalcolo.integrativo, 355, 'vince il minimo, non il calcolato');
});

test('taxSetAside: Inarcassa e CNPADC calcolate con le rispettive aliquote/minimi reali', () => {
  const inarcassa = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'ingegneri_architetti' });
  // redditoImponibile=23400; soggettivo=23400*0.145=3393 (>2800); integrativo=30000*0.04=1200 (>850)
  assert.equal(inarcassa.cassaCalcolo.soggettivo, 3393);
  assert.equal(inarcassa.cassaCalcolo.integrativo, 1200);

  const cnpadc = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'commercialisti' });
  // soggettivo=23400*0.12=2808 (>3180? NO: 2808<3180, vince il minimo)
  assert.equal(cnpadc.cassaCalcolo.soggettivo, 3180);
  // integrativo CNPADC: nessun minimo confermato -> solo il calcolato, 30000*0.04=1200
  assert.equal(cnpadc.cassaCalcolo.integrativo, 1200);
});

test('contributiCassaProfessionale: cassa non coperta -> null, mai un numero a caso', async () => {
  const { contributiCassaProfessionale } = await import('./tax.js');
  assert.equal(contributiCassaProfessionale(23400, 30000, 'medici_odontoiatri'), null);
  assert.equal(contributiCassaProfessionale(23400, 30000, 'professione_mai_sentita'), null);
});

test('taxSetAside: CIPAG (Cassa Geometri, 4a cassa coperta 2026-09-11) calcolata con aliquote/minimo reali', () => {
  const geometri = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'geometri' });
  // redditoImponibile=23400; soggettivo=23400*0.20=4680 (>4205, vince il calcolato)
  assert.equal(geometri.cassaCalcolo.soggettivo, 4680);
  // integrativo CIPAG: nessun minimo confermato per il 2026 (fonti discordanti) -> solo il calcolato, 30000*0.05=1500
  assert.equal(geometri.cassaCalcolo.integrativo, 1500);
});

// ── ENPAM (medici/odontoiatri), 5a cassa coperta, 2026-09-14 ──
// Struttura DIVERSA dalle altre 4 (mai forzata nello schema aliquota/minimo,
// come dichiarato il 2026-09-11): Quota A fissa per fascia d'età, Quota B
// proporzionale al reddito netto. Fonti: finom.co, money.it, fiscozen.it,
// centrofiscale.com, camicecapitale.com (concordanti su Quota A e aliquota
// ordinaria Quota B 19,5%, verificate 2026-09-14).

test('contributoEnpam: Quota A per fascia d\'età, valori 2026 verificati', async () => {
  const { contributoEnpam } = await import('./tax.js');
  assert.equal(contributoEnpam(0, 26).quotaA, 304.73); // under 30
  assert.equal(contributoEnpam(0, 32).quotaA, 591.47); // 30-35
  assert.equal(contributoEnpam(0, 37).quotaA, 1109.92); // 35-40
  assert.equal(contributoEnpam(0, 45).quotaA, 2049.83); // 40+
});

test('contributoEnpam: Quota B = 19,5% del reddito netto (aliquota ordinaria, mai una ridotta indovinata)', async () => {
  const { contributoEnpam } = await import('./tax.js');
  const r = contributoEnpam(50000, 45);
  assert.equal(r.quotaB, 9750); // 50000 * 0.195
  assert.equal(r.totale, 9750 + 2049.83);
});

test('contributoEnpam: senza età -> null, mai un\'assunzione sulla fascia', async () => {
  const { contributoEnpam } = await import('./tax.js');
  assert.equal(contributoEnpam(50000, null), null);
  assert.equal(contributoEnpam(50000, undefined), null);
});

test('contributoEnpam: età fuori dai limiti plausibili (0, 120) -> null, mai un\'estrapolazione', async () => {
  const { contributoEnpam } = await import('./tax.js');
  assert.equal(contributoEnpam(50000, 5), null);
  assert.equal(contributoEnpam(50000, 130), null);
});

test('contributoEnpam: il contributo maternità NON è incluso nel totale (importo con fonti discordanti, 84,26€ vs 95,54€, mai scelto a caso)', async () => {
  const { contributoEnpam } = await import('./tax.js');
  const r = contributoEnpam(50000, 45);
  assert.equal(r.contributoMaternitaNonIncluso, true);
  assert.equal(r.totale, r.quotaA + r.quotaB); // il totale non include la maternità
});

test('contributoEnpam: aliquota Quota B ridotta al 9,5% con altra copertura previdenziale obbligatoria (fonte: fiscozen.it, verificato 2026-09-14)', async () => {
  const { contributoEnpam } = await import('./tax.js');
  const r = contributoEnpam(50000, 45, { altraCoperturaPrevidenziale: true });
  assert.equal(r.quotaB, 4750); // 50000 * 0.095
  assert.equal(r.aliquotaQuotaB, 0.095);
});

test('contributoEnpam: senza altra copertura -> aliquota ordinaria 19,5% (default invariato)', async () => {
  const { contributoEnpam } = await import('./tax.js');
  const r = contributoEnpam(50000, 45);
  assert.equal(r.aliquotaQuotaB, 0.195);
});

// ── Integrazione in taxSetAside, 2026-09-14: sia Quota A sia Quota B sono
// INTERAMENTE deducibili dal reddito imponibile (art. 10 comma 1 lett. e
// TUIR, verificato fiscozen.it) — diverso dalle altre 4 casse, dove solo il
// "soggettivo" è deducibile e l'"integrativo" è un pass-through come l'IVA.
// Verifica che taxSetAside NON riusi ciecamente quello schema per ENPAM. ──

test('taxSetAside: ENPAM (medici_odontoiatri) con età -> Quota A+B entrambe dedotte dalla base imponibile', () => {
  const conEta = taxSetAside(60000, { regime: 'ordinario', cassaPropria: 'medici_odontoiatri', eta: 45 });
  const senzaCassa = taxSetAside(60000, { regime: 'ordinario' });
  // La base imponibile con ENPAM deve essere PIÙ BASSA di quella senza
  // cassa di un importo pari all'INTERO contributo ENPAM (quotaA+quotaB),
  // non solo una parte — altrimenti la deduzione sarebbe sbagliata per
  // difetto e l'utente pagherebbe più IRPEF del dovuto.
  assert.ok(conEta.cassaCalcolo);
  assert.equal(conEta.cassaCalcolo.nomeBreve, 'ENPAM');
  const redditoImponibile60k = 60000; // regime ordinario: imponibile = fatturato (nessun coefficiente ATECO)
  const enpamAtteso = 2049.83 + redditoImponibile60k * 0.195; // fascia 40+, aliquota ordinaria
  assert.equal(conEta.cassaCalcolo.totale, +enpamAtteso.toFixed(2));
  assert.equal(conEta.setAside < senzaCassa.setAside, true); // deduzione reale, meno da accantonare per l'IRPEF
});

test('scomposizione casse: quote ENPAM e contributi fissi sono finiti e riconciliano il totale', () => {
  for (const cassaPropria of ['medici_odontoiatri', 'psicologi', 'consulenti_lavoro']) {
    for (const regime of ['forfettario', 'ordinario']) {
      const result = taxSetAside(60000, { cassaPropria, regime, eta: 45, year: 2026 });
      assert.ok(result.breakdown.every(row => Number.isFinite(row.importo)));
      const total = result.breakdown.reduce((sum, row) => sum + row.importo, 0);
      assert.ok(Math.abs(total - result.setAside) <= 0.02, `${cassaPropria}: ${total} != ${result.setAside}`);
    }
  }
});

test('taxSetAside: ENPAM senza età -> cassaCalcolo null, mai un numero indovinato sulla fascia', () => {
  const s = taxSetAside(60000, { regime: 'ordinario', cassaPropria: 'medici_odontoiatri' });
  assert.equal(s.cassaCalcolo, null);
});

test('simulateNewPartitaIva: propaga eta a taxSetAside (chi non ha ancora la P.IVA, stesso motore di chi ce l\'ha già)', async () => {
  const { simulateNewPartitaIva } = await import('./tax.js');
  const s = simulateNewPartitaIva(60000, { cassaPropria: 'medici_odontoiatri', eta: 45 });
  assert.ok(s.cassaCalcolo);
  assert.equal(s.cassaCalcolo.nomeBreve, 'ENPAM');
});

test('taxSetAside: CIPAG — un fatturato basso fa vincere il minimo soggettivo (4.205€), mai il calcolato sotto minimo', () => {
  const r = taxSetAside(5000, { regime: 'forfettario', cassaPropria: 'geometri' });
  // redditoImponibile = 5000*0.78=3900; soggettivo calcolato = 3900*0.20=780, molto sotto il minimo 4205
  assert.equal(r.cassaCalcolo.soggettivo, 4205, 'vince il minimo, non il calcolato');
});

// ── ENPAP (psicologi), 6a cassa coperta, 2026-09-15 ──
// Struttura soggettivo/integrativo come le altre 4 in CASSE_CON_REGOLE, PIÙ
// un contributo di maternità FISSO che le altre non hanno — qui le fonti
// concordano (centrofiscale.com + fiscoetasse.com, verificato 2026-09-15,
// diverso da ENPAM dove le fonti discordavano ed è stato lasciato fuori).
test('taxSetAside: ENPAP (psicologi, 6a cassa coperta) — soggettivo 10%, integrativo 2%, minimi reali', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'psicologi' });
  // redditoImponibile forfettario = 60000*0.78 = 46800; soggettivo = 46800*0.10 = 4680 (>856, vince il calcolato)
  assert.equal(r.cassaCalcolo.soggettivo, 4680);
  // integrativo = 60000*0.02 = 1200 (>66, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 1200);
});

test('taxSetAside: ENPAP — fatturato basso fa vincere i minimi (856€ soggettivo, 66€ integrativo)', () => {
  const r = taxSetAside(3000, { regime: 'forfettario', cassaPropria: 'psicologi' });
  // redditoImponibile = 3000*0.78=2340; soggettivo calcolato = 234, sotto minimo 856
  assert.equal(r.cassaCalcolo.soggettivo, 856);
  // integrativo calcolato = 3000*0.02=60, sotto minimo 66
  assert.equal(r.cassaCalcolo.integrativo, 66);
});

test('taxSetAside: ENPAP — il contributo di maternità fisso (110€) è incluso nel totale della cassa, dichiarato nel nomeBreve/campo dedicato', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'psicologi' });
  assert.equal(r.cassaCalcolo.contributoFisso, 110);
  assert.equal(r.cassaCalcolo.totale, +(4680 + 1200 + 110).toFixed(2));
});

// ── ENPAPI (infermieri liberi professionisti), 7a cassa coperta, 2026-09-15 ──
// Struttura soggettivo/integrativo standard, come le altre 5 in
// CASSE_CON_REGOLE, nessun campo aggiuntivo. Fonti concordanti
// (fiscoetasse.com + centrofiscale.com, verificato 2026-09-15): soggettivo
// 16% del reddito netto (min 1.600€/anno), integrativo 4% del fatturato
// (min 150€/anno) — l'aliquota integrativa ridotta al 2% per prestazioni
// verso la PA NON è gestita (Momentum non distingue i clienti PA dagli
// altri): limite dichiarato, non un'approssimazione silenziosa.
test('taxSetAside: ENPAPI (infermieri, 7a cassa coperta) — soggettivo 16%, integrativo 4%, minimi reali', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'infermieri' });
  // redditoImponibile forfettario = 60000*0.78 = 46800; soggettivo = 46800*0.16 = 7488 (>1600, vince il calcolato)
  assert.equal(r.cassaCalcolo.soggettivo, 7488);
  // integrativo = 60000*0.04 = 2400 (>150, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 2400);
});

test('taxSetAside: ENPAPI — fatturato basso fa vincere i minimi (1.600€ soggettivo, 150€ integrativo)', () => {
  const r = taxSetAside(3000, { regime: 'forfettario', cassaPropria: 'infermieri' });
  // redditoImponibile = 3000*0.78=2340; soggettivo calcolato = 374,4, sotto minimo 1600
  assert.equal(r.cassaCalcolo.soggettivo, 1600);
  // integrativo calcolato = 3000*0.04=120, sotto minimo 150
  assert.equal(r.cassaCalcolo.integrativo, 150);
});

test('taxSetAside: ENPAPI — nessun contributoFisso (a differenza di ENPAP), il campo resta assente', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'infermieri' });
  assert.equal(r.cassaCalcolo.contributoFisso, undefined);
  assert.equal(r.cassaCalcolo.totale, +(7488 + 2400).toFixed(2));
});

// ── ENPACL (consulenti del lavoro), 8a cassa coperta, 2026-09-15 ──
// Struttura soggettivo/integrativo + contributo fisso, come ENPAP. Fonti
// concordanti (fiscoetasse.com + centrofiscale.com/partitaiva.it, fonte
// primaria enpacl.it, verificato 2026-09-15): soggettivo 12% del reddito
// netto (min 2.620€/anno — l'aliquota/il minimo agevolati per neoiscritti
// under 35, 6%/1.310€, NON sono gestiti: Momentum non conosce l'anno di
// iscrizione alla cassa, limite dichiarato), integrativo 4% del volume
// d'affari (min 380€/anno), contributo fisso di maternità 52,98€/anno.
test('taxSetAside: ENPACL (consulenti del lavoro, 8a cassa coperta) — soggettivo 12%, integrativo 4%, minimi reali', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'consulenti_lavoro' });
  // redditoImponibile forfettario = 60000*0.78 = 46800; soggettivo = 46800*0.12 = 5616 (>2620, vince il calcolato)
  assert.equal(r.cassaCalcolo.soggettivo, 5616);
  // integrativo = 60000*0.04 = 2400 (>380, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 2400);
});

test('taxSetAside: ENPACL — fatturato basso fa vincere i minimi (2.620€ soggettivo, 380€ integrativo)', () => {
  const r = taxSetAside(5000, { regime: 'forfettario', cassaPropria: 'consulenti_lavoro' });
  // redditoImponibile = 5000*0.78=3900; soggettivo calcolato = 468, sotto minimo 2620
  assert.equal(r.cassaCalcolo.soggettivo, 2620);
  // integrativo calcolato = 5000*0.04=200, sotto minimo 380
  assert.equal(r.cassaCalcolo.integrativo, 380);
});

test('taxSetAside: ENPACL — il contributo di maternità fisso (52,98€) è incluso nel totale della cassa', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'consulenti_lavoro' });
  assert.equal(r.cassaCalcolo.contributoFisso, 52.98);
  assert.equal(r.cassaCalcolo.totale, +(5616 + 2400 + 52.98).toFixed(2));
});

// ── ENPAB (biologi), 9a cassa coperta, 2026-09-15 ──
// Struttura soggettivo/integrativo + contributo fisso, come ENPAP/ENPACL.
// Fonti concordanti (fiscoetasse.com + partitaiva.it, fonte primaria
// enpab.it, verificato 2026-09-15): soggettivo 15% del reddito netto
// (elevabile volontariamente fino al 36%, mai usato di default — stesso
// principio già applicato a CNPADC/ENPACL), minimo 1.309€/anno; integrativo
// 4% del volume d'affari (anche per prestazioni verso la PA, nessuna
// riduzione da gestire qui), minimo 106€/anno; contributo fisso di
// maternità 136€/anno.
test('taxSetAside: ENPAB (biologi, 9a cassa coperta) — soggettivo 15%, integrativo 4%, minimi reali', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'biologi' });
  // redditoImponibile forfettario = 60000*0.78 = 46800; soggettivo = 46800*0.15 = 7020 (>1309, vince il calcolato)
  assert.equal(r.cassaCalcolo.soggettivo, 7020);
  // integrativo = 60000*0.04 = 2400 (>106, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 2400);
});

test('taxSetAside: ENPAB — fatturato basso fa vincere i minimi (1.309€ soggettivo, 106€ integrativo)', () => {
  const r = taxSetAside(2000, { regime: 'forfettario', cassaPropria: 'biologi' });
  // redditoImponibile = 2000*0.78=1560; soggettivo calcolato = 234, sotto minimo 1309
  assert.equal(r.cassaCalcolo.soggettivo, 1309);
  // integrativo calcolato = 2000*0.04=80, sotto minimo 106
  assert.equal(r.cassaCalcolo.integrativo, 106);
});

test('taxSetAside: ENPAB — il contributo di maternità fisso (136€) è incluso nel totale della cassa', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'biologi' });
  assert.equal(r.cassaCalcolo.contributoFisso, 136);
  assert.equal(r.cassaCalcolo.totale, +(7020 + 2400 + 136).toFixed(2));
});

// ── ENPAV (veterinari), 10a cassa coperta, 2026-09-15 ──
// Struttura a due scaglioni come Cassa Forense: soggettivo 10% del reddito
// netto fino a 18.500€/anno, 3% sulla parte eccedente. Fonte primaria
// enpav.it (pagina "contributi minimi") per i minimi 2026 (soggettivo
// 3.542,85€, integrativo 574,50€), incrociata con fidocommercialista.it/
// partitaiva.it/fiscoetasse.com per aliquote e soglia. Maternità (100€,
// dichiarata "in attesa di approvazione ministeriale" dalla fonte stessa)
// deliberatamente NON inclusa — non confermata.
test('taxSetAside: ENPAV (veterinari, 10a cassa coperta) — due scaglioni (10%/3%), integrativo 2%', () => {
  const r = taxSetAside(150000, { regime: 'forfettario', cassaPropria: 'veterinari' });
  // redditoImponibile = 150000*0.78 = 117000; entro=18500*0.10=1850, oltre=(117000-18500)*0.03=2955 -> 4805
  assert.equal(r.cassaCalcolo.soggettivo, 4805);
  // integrativo = 150000*0.02 = 3000 (>574.50, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 3000);
  assert.equal(r.cassaCalcolo.contributoFisso, undefined); // maternità non confermata, mai inclusa
});

test('taxSetAside: ENPAV — fatturato basso fa vincere i minimi (3.542,85€ soggettivo, 574,50€ integrativo)', () => {
  const r = taxSetAside(2000, { regime: 'forfettario', cassaPropria: 'veterinari' });
  // redditoImponibile = 2000*0.78=1560, tutto sotto soglia: soggettivo calcolato = 156, sotto minimo
  assert.equal(r.cassaCalcolo.soggettivo, 3542.85);
  // integrativo calcolato = 2000*0.02=40, sotto minimo 574.50
  assert.equal(r.cassaCalcolo.integrativo, 574.50);
});

// ── EPPI (periti industriali), 11a cassa coperta, 2026-09-15 ──
// Fonte primaria eppi.it ("la contribuzione", valori 2026): soggettivo 18%
// del reddito netto (min 2.392€/anno), integrativo 5% del fatturato (min
// 664€/anno). Maternità "da definire" per il 2026 secondo la fonte stessa
// — deliberatamente NON inclusa, non un numero mancante per pigrizia.
test('taxSetAside: EPPI (periti industriali, 11a cassa coperta) — soggettivo 18%, integrativo 5%, minimi reali', () => {
  const r = taxSetAside(60000, { regime: 'forfettario', cassaPropria: 'periti_industriali' });
  // redditoImponibile = 60000*0.78 = 46800; soggettivo = 46800*0.18 = 8424 (>2392, vince il calcolato)
  assert.equal(r.cassaCalcolo.soggettivo, 8424);
  // integrativo = 60000*0.05 = 3000 (>664, vince il calcolato)
  assert.equal(r.cassaCalcolo.integrativo, 3000);
  assert.equal(r.cassaCalcolo.contributoFisso, undefined); // maternità non definita, mai inclusa
});

test('taxSetAside: EPPI — fatturato basso fa vincere i minimi (2.392€ soggettivo, 664€ integrativo)', () => {
  const r = taxSetAside(3000, { regime: 'forfettario', cassaPropria: 'periti_industriali' });
  // redditoImponibile = 3000*0.78=2340; soggettivo calcolato = 421.20, sotto minimo 2392
  assert.equal(r.cassaCalcolo.soggettivo, 2392);
  // integrativo calcolato = 3000*0.05=150, sotto minimo 664
  assert.equal(r.cassaCalcolo.integrativo, 664);
});

test('taxSetAside: aliquota INPS ridotta al 24% per chi ha già un\'altra copertura previdenziale (LACUNA COLMATA)', () => {
  const piena = taxSetAside(30000, { regime: 'forfettario' });
  const ridotta = taxSetAside(30000, { regime: 'forfettario', altraCoperturaPrevidenziale: true });
  const rigaPiena = piena.breakdown.find(b => b.voce === 'Contributi INPS');
  const rigaRidotta = ridotta.breakdown.find(b => /aliquota ridotta 24%/.test(b.voce));
  assert.ok(rigaPiena);
  assert.ok(rigaRidotta, 'la scomposizione deve dichiarare esplicitamente l\'aliquota ridotta');
  assert.match(rigaRidotta.nota, /circolare INPS n\. 8/);
  // redditoImponibile = 30000*0.78=23400; INPS pieno 23400*0.2607=6100.38;
  // INPS ridotto 23400*0.24=5616 — meno, quindi più netto in tasca.
  assert.ok(rigaRidotta.importo < rigaPiena.importo);
  assert.equal(rigaRidotta.importo, +(23400 * 0.24).toFixed(2));
  assert.ok(ridotta.net > piena.net);
});
test('taxSetAside: cassa propria (non coperta da regole) e altra copertura insieme -> vince la cassa propria (esenzione INPS totale, non 24%)', () => {
  const r = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'medici_odontoiatri', altraCoperturaPrevidenziale: true });
  const riga = r.breakdown.find(b => /ENPAM/.test(b.voce));
  assert.ok(riga);
  assert.equal(riga.importo, 0); // esenzione totale, non la ridotta al 24% — l'INPS non c'entra comunque
});

test('taxSetAside: cassa propria CALCOLATA e altra copertura insieme -> l\'INPS resta comunque a zero, il contributo cassa non cambia con quel flag', () => {
  const soloCassa = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'avvocati' });
  const cassaEAltraCopertura = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'avvocati', altraCoperturaPrevidenziale: true });
  assert.equal(cassaEAltraCopertura.cassaCalcolo.totale, soloCassa.cassaCalcolo.totale, 'altraCoperturaPrevidenziale riguarda l\'INPS, non la cassa propria');
  assert.equal(cassaEAltraCopertura.breakdown.find(b => b.voce === 'Contributi INPS'), undefined);
});

test('taxSetAside: nome cassa sconosciuto -> messaggio prudente, mai un crash o un nome inventato', () => {
  const r = taxSetAside(30000, { regime: 'forfettario', cassaPropria: 'professione_mai_sentita' });
  assert.equal(r.cassaNome, 'la tua cassa professionale');
});

test('CASSE_PROFESSIONALI: copre le professioni ordinistiche più comuni con nomi reali verificati', () => {
  assert.equal(CASSE_PROFESSIONALI.avvocati, 'Cassa Forense');
  assert.equal(CASSE_PROFESSIONALI.commercialisti, 'CNPADC');
  assert.equal(CASSE_PROFESSIONALI.ingegneri_architetti, 'INARCASSA');
  assert.equal(CASSE_PROFESSIONALI.medici_odontoiatri, 'ENPAM');
});

test('simulateNewPartitaIva: cassa COPERTA (INARCASSA) propagata nel simulatore, il netto include già il contributo reale', () => {
  const s = simulateNewPartitaIva(30000, { cassaPropria: 'ingegneri_architetti' });
  assert.equal(s.cassaNome, 'INARCASSA');
  assert.ok(s.cassaCalcolo, 'il simulatore deve esporre il dettaglio del calcolo, non solo il nome');
  const tip = s.strategie.find(t => t.icon === 'cassa');
  assert.ok(tip);
  assert.match(tip.testo, /INARCASSA/);
  assert.match(tip.testo, /include già/); // NON "non lo include": ora lo calcola davvero
});

test('simulateNewPartitaIva: cassa NON coperta (ENPAM) — il simulatore avvisa che il numero non la include', () => {
  const s = simulateNewPartitaIva(30000, { cassaPropria: 'medici_odontoiatri' });
  assert.equal(s.cassaNome, 'ENPAM');
  assert.equal(s.cassaCalcolo, null);
  const tip = s.strategie.find(t => t.icon === 'cassa');
  assert.match(tip.testo, /non all'INPS/);
  assert.match(tip.testo, /NON li include/);
});

// Bug reale trovato dal vivo in Chrome, 2026-09-14: con l'età fornita ENPAM
// VIENE calcolata, ma il messaggio riusava .soggettivo/.integrativo (campi
// che ENPAM non ha, ha quotaA/quotaB) — mostrava "NaN€" all'utente.
test('simulateNewPartitaIva: cassa ENPAM CON età — messaggio con Quota A/B reali, mai NaN', () => {
  const s = simulateNewPartitaIva(60000, { cassaPropria: 'medici_odontoiatri', eta: 45 });
  assert.ok(s.cassaCalcolo);
  const tip = s.strategie.find(t => t.icon === 'cassa');
  assert.ok(tip);
  assert.doesNotMatch(tip.testo, /NaN/);
  assert.match(tip.testo, /include già/);
  assert.match(tip.testo, /Quota A/);
  assert.match(tip.testo, /Quota B/);
  assert.match(tip.testo, /maternità/i); // il limite dichiarato va detto qui, non solo nel Centro Fiducia
});

test('simulateNewPartitaIva: dipendente che apre anche la P.IVA -> aliquota INPS ridotta al 24%, verificata e applicata davvero', () => {
  const s = simulateNewPartitaIva(30000, { altraCoperturaPrevidenziale: true });
  const tip = s.strategie.find(t => t.icon === 'dipendente');
  assert.ok(tip);
  assert.match(tip.testo, /24%/);
  assert.match(tip.testo, /circolare INPS/);
  // LACUNA COLMATA (2026-08-06): il netto ORA cambia davvero — l'aliquota
  // ridotta (24% invece di 26,07%) è verificata su fonte ufficiale e
  // applicata, non più solo una domanda da fare al commercialista.
  const senza = simulateNewPartitaIva(30000);
  assert.ok(s.netAnnuo > senza.netAnnuo, 'con aliquota ridotta il netto deve essere più alto');
});

test('simulateNewPartitaIva: chi ha una cassa propria non vede anche il consiglio da dipendente (si escludono a vicenda)', () => {
  const s = simulateNewPartitaIva(30000, { cassaPropria: 'avvocati', altraCoperturaPrevidenziale: true });
  assert.equal(s.strategie.find(t => t.icon === 'dipendente'), undefined);
});

test('simulateNewPartitaIva: settore ATECO cambia il coefficiente e quindi il netto (commercio vs professionisti)', () => {
  const professionista = simulateNewPartitaIva(30000, { ateco: 'professionisti' });
  const commerciante = simulateNewPartitaIva(30000, { ateco: 'commercio' });
  // Stesso fatturato, coefficiente più basso per il commercio (40% vs 78%)
  // → base imponibile più bassa → meno tasse → più netto in tasca.
  assert.ok(commerciante.netAnnuo > professionista.netAnnuo);
  assert.equal(commerciante.atecoLabel, ATECO_COEFFICIENTI.commercio.label);
});

test('simulateNewPartitaIva: senza settore indicato, ripiega sul coefficiente di default (nessun crash)', () => {
  const s = simulateNewPartitaIva(30000);
  assert.equal(s.atecoLabel, null);
  assert.ok(s.netAnnuo > 0);
});

test('simulateNewPartitaIva: stessa aritmetica di taxSetAside, nessuna formula duplicata', () => {
  const s = simulateNewPartitaIva(40000);
  const atteso = taxSetAside(40000, { regime: 'forfettario' });
  assert.equal(s.setAside, +atteso.setAside.toFixed(2));
  assert.equal(s.netAnnuo, +atteso.net.toFixed(2));
});

// ── AUTO-ADDESTRAMENTO: creare una fattura insegna il cliente ──────────────
test('un cliente fatturato viene riconosciuto come reddito da fattura in futuro', () => {
  // Simula: creo una fattura per "Studio Bianchi" → apprendo il mittente.
  let learned = learnIncomeType({}, 'Studio Bianchi', 'invoice');
  // Un accredito futuro con quel nome ora si classifica da solo come fattura.
  const c = classifyIncome({ description: 'Bonifico da Studio Bianchi' }, learned);
  assert.equal(c.kind, 'invoice');
});

// ── RICERCA ATECO LIBERA: guard di coerenza + comportamento della ricerca ──
test('ATECO_COMUNI: ogni voce punta a una categoria di coefficiente esistente e verificata', () => {
  // Guard di regressione: se in futuro si aggiunge una voce con una categoria
  // sbagliata o inventata, il coefficiente applicato sarebbe silenziosamente
  // falso — meglio un test rosso che una tassa calcolata male.
  for (const entry of ATECO_COMUNI) {
    assert.ok(ATECO_COEFFICIENTI[entry.categoria], `categoria sconosciuta: ${entry.categoria} (${entry.code})`);
    assert.match(entry.code, /^\d{2}\.\d{2}\.\d{2}$/, `codice ATECO mal formato: ${entry.code}`);
  }
});

test('searchAtecoComuni: query vuota o troppo corta non restituisce risultati a caso', () => {
  assert.deepEqual(searchAtecoComuni(''), []);
  assert.deepEqual(searchAtecoComuni('a'), []);
});

test('searchAtecoComuni: descrizione in linguaggio comune trova il codice giusto', () => {
  const hits = searchAtecoComuni('vendo vestiti online sul mio shop');
  assert.ok(hits.some((h) => h.code === '47.91.00'), 'deve trovare e-commerce');
});

test('searchAtecoComuni: mestieri diversi non si confondono fra loro', () => {
  const idraulico = searchAtecoComuni('sono un idraulico faccio caldaie');
  assert.equal(idraulico[0].code, '43.22.00');
  const avvocato = searchAtecoComuni('sono un avvocato ho uno studio legale');
  assert.equal(avvocato[0].code, '69.10.00');
});

test('searchAtecoComuni: nessuna corrispondenza restituisce lista vuota, mai un risultato a caso', () => {
  assert.deepEqual(searchAtecoComuni('xyzxyzxyz qwqwqw'), []);
});

// ── VERIFICA ELEGGIBILITÀ FORFETTARIO (2026-09-06) — problema di mercato
// reale: Momentum controllava solo la soglia di fatturato, mai le altre
// cause di esclusione (partecipazioni societarie, redditi da lavoro
// dipendente, fatturazione verso l'ex datore...). ──

test('verificaEsclusioneForfettario: nessuna risposta true → non escluso, nessuna causa presunta', () => {
  const r = verificaEsclusioneForfettario({});
  assert.equal(r.escluso, false);
  assert.deepEqual(r.cause, []);
});

test('verificaEsclusioneForfettario: chiavi mancanti trattate come false, mai un "sì" indovinato', () => {
  const r = verificaEsclusioneForfettario({ regimiSpeciali: false });
  assert.equal(r.escluso, false);
});

test('verificaEsclusioneForfettario: BASTA UNA causa vera per escludere, non serve che siano tutte vere', () => {
  const r = verificaEsclusioneForfettario({ redditoLavoroDipendente: true });
  assert.equal(r.escluso, true);
  assert.equal(r.cause.length, 1);
  assert.equal(r.cause[0].chiave, 'redditoLavoroDipendente');
  assert.ok(r.cause[0].label.includes('35.000'));
  assert.ok(r.cause[0].fonte, 'ogni causa deve avere la sua fonte normativa');
});

test('verificaEsclusioneForfettario: più cause vere → tutte riportate, nessuna persa', () => {
  const r = verificaEsclusioneForfettario({ controlloSrl: true, fatturazioneExDatore: true });
  assert.equal(r.escluso, true);
  assert.equal(r.cause.length, 2);
  const chiavi = r.cause.map(c => c.chiave);
  assert.ok(chiavi.includes('controlloSrl'));
  assert.ok(chiavi.includes('fatturazioneExDatore'));
});

test('CAUSE_ESCLUSIONE_FORFETTARIO: ogni causa dichiara la propria fonte normativa, mai un motivo senza fonte', () => {
  for (const [chiave, causa] of Object.entries(CAUSE_ESCLUSIONE_FORFETTARIO)) {
    assert.ok(typeof causa.label === 'string' && causa.label.length > 10, `${chiave}: label mancante o troppo corta`);
    assert.ok(typeof causa.fonte === 'string' && causa.fonte.length > 5, `${chiave}: fonte mancante`);
  }
});
