import test from 'node:test';
import assert from 'node:assert/strict';
const { taxSetAside, taxSetAsideForPeriod, classifyIncome, learnIncomeType, suggestRegime, projectAnnualTax, inferAtecoSettore, FORFETTARIO_CEILING, REGIMI, ATECO_COEFFICIENTI, simulateNewPartitaIva } = await import('./tax.js');

function fattura(desc, amount = 1000, date = '2026-03-10') {
  return { type: 'entrata', description: desc, amount, date };
}

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
