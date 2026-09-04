import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { answerQuestion } = await import('./qa-engine.js');

const REF = new Date(2026, 6, 15); // mercoledì 15 luglio 2026

function tx(date, amount, description, type = 'uscita', category = 'Alimentari') {
  return { date, amount, description, type, category };
}

const CTX = {
  referenceDate: REF,
  monthlyBudget: 3100, // luglio: 100€/giorno
  savingsGoals: [{ id: 1, name: 'Vacanza', target: 1000, createdAt: '2026-07-01' }],
  allTx: {
    '2026-06': [
      tx('2026-06-10', 250, 'Spesa grossa', 'uscita', 'Alimentari'),
      tx('2026-06-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago'),
    ],
    '2026-05': [tx('2026-05-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-04': [tx('2026-04-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-07': [
      tx('2026-07-05', 1500, 'Stipendio', 'entrata', 'Stipendio'),
      tx('2026-07-08', 120, 'Esselunga', 'uscita', 'Alimentari'),
      tx('2026-07-14', 60, 'Benzina', 'uscita', 'Trasporti'),
    ],
  },
};

test('quanto ho speso questo mese', () => {
  const r = answerQuestion('Quanto ho speso questo mese?', CTX);
  assert.equal(r.intent, 'spent');
  assert.equal(r.data.tot, 180); // 120+60
  assert.ok(r.answer.includes('180,00€'));
});

// ── Bilingue: le stesse domande in inglese, stessi intent, risposta in inglese ──
test('English: "how much have I spent this month?" → stesso intent, risposta in inglese', () => {
  const r = answerQuestion('How much have I spent this month?', CTX);
  assert.equal(r.intent, 'spent');
  assert.equal(r.data.tot, 180);
  assert.ok(/you spent/i.test(r.answer));
  assert.ok(!/hai speso/i.test(r.answer));
});

test('English: "how much can I spend today?" → safe-to-spend in inglese', () => {
  const r = answerQuestion('How much can I spend today?', CTX);
  assert.equal(r.intent, 'safe-to-spend');
  assert.ok(/you can spend/i.test(r.answer));
});

test('English: "can I afford 50€?" → affordability in inglese', () => {
  const r = answerQuestion('Can I afford 50€ today?', CTX);
  assert.equal(r.intent, 'affordability');
  assert.ok(/yes|risky|better not/i.test(r.answer));
});

test('English: "what subscriptions do I pay?" → elenco in inglese', () => {
  const r = answerQuestion('What subscriptions do I pay?', CTX);
  assert.equal(r.intent, 'subscriptions');
  assert.ok(/you pay/i.test(r.answer));
});

test('English: "where do I spend the most?" → top categoria in inglese', () => {
  const r = answerQuestion('Where do I spend the most this month?', CTX);
  assert.equal(r.intent, 'top-category');
  assert.ok(/biggest expense/i.test(r.answer));
});

test('English: "how much have I saved?" → savings in inglese', () => {
  const r = answerQuestion('How much have I saved this month?', CTX);
  assert.equal(r.intent, 'savings');
  assert.ok(/you saved|you spent/i.test(r.answer));
});

test('English: domanda fuori dominio → messaggio "unknown" in inglese, mai in italiano', () => {
  const r = answerQuestion('What is the weather tomorrow?', CTX);
  assert.equal(r.intent, 'unknown');
  assert.ok(/don't know this one yet/i.test(r.answer));
});

test('Italiano resta italiano: nessuna regressione dal rilevamento lingua', () => {
  const r = answerQuestion('Dove spendo di più questo mese?', CTX);
  assert.equal(r.intent, 'top-category');
  assert.ok(/la voce più pesante/i.test(r.answer));
});

// ── Spagnolo, francese, tedesco: stessi intent, stesso motore, risposta nella lingua rilevata ──
test('Español: "¿cuánto he gastado este mes?" → intent spent, risposta in spagnolo', () => {
  const r = answerQuestion('¿Cuánto he gastado este mes?', CTX);
  assert.equal(r.intent, 'spent');
  assert.ok(/has gastado/i.test(r.answer));
});

test('Español: "¿cuánto puedo gastar hoy?" → safe-to-spend in spagnolo', () => {
  const r = answerQuestion('¿Cuánto puedo gastar hoy?', CTX);
  assert.equal(r.intent, 'safe-to-spend');
  assert.ok(/puedes gastar/i.test(r.answer));
});

test('Français: "combien j\'ai dépensé ce mois-ci ?" → intent spent, risposta in francese', () => {
  const r = answerQuestion('Combien j\'ai dépensé ce mois-ci ?', CTX);
  assert.equal(r.intent, 'spent');
  assert.ok(/tu as dépensé/i.test(r.answer));
});

test('Deutsch: "wie viel habe ich diesen monat ausgegeben?" → intent spent, risposta in tedesco', () => {
  const r = answerQuestion('Wie viel habe ich diesen Monat ausgegeben?', CTX);
  assert.equal(r.intent, 'spent');
  assert.ok(/hast du.*ausgegeben/i.test(r.answer));
});

test('Español: domanda fuori dominio (ma con marcatori linguistici spagnoli) → messaggio "unknown" in spagnolo', () => {
  // il rilevatore condiviso (src/i18n/detect.js) riconosce la lingua da
  // parole-chiave del dominio finanziario, non è un rilevatore linguistico
  // generico — dichiarato onestamente nei suoi stessi commenti. Una frase
  // fuori dominio SENZA nessun marcatore ricade sull'italiano di default
  // (comportamento del rilevatore condiviso, non un bug introdotto qui).
  const r = answerQuestion('¿Cuánto tarda en llegar el tren?', CTX);
  assert.equal(r.intent, 'unknown');
  assert.ok(/todavía no lo sé/i.test(r.answer));
});

test('quanto ho speso a giugno (mese nominato)', () => {
  const r = answerQuestion('quanto ho speso a giugno?', CTX);
  assert.equal(r.intent, 'spent');
  assert.equal(r.data.tot, 262.99);
});

test('quanto ho speso in alimentari (filtro categoria)', () => {
  const r = answerQuestion('quanto ho speso in alimentari questo mese?', CTX);
  assert.equal(r.data.tot, 120);
  assert.equal(r.data.category, 'Alimentari');
});

test('quanto posso spendere oggi → safe-to-spend', () => {
  const r = answerQuestion('quanto posso spendere oggi?', CTX);
  assert.equal(r.intent, 'safe-to-spend');
  assert.ok(r.data.safeToday > 0);
  assert.ok(r.answer.includes('Oggi puoi spendere'));
});

test('posso permettermi 50€ → sì con margine di oggi', () => {
  const r = answerQuestion('posso permettermi 50€?', CTX);
  assert.equal(r.intent, 'affordability');
  assert.ok(r.answer.startsWith('Sì'));
});

test('posso permettermi una cifra enorme → avvisa, non asseconda', () => {
  const r = answerQuestion('posso permettermi 99999€?', CTX);
  assert.equal(r.intent, 'affordability');
  assert.ok(/Rischioso|Meglio di no/.test(r.answer));
});

// ── UNA SOLA RISPOSTA: QA e Dashboard devono raccontare lo stesso numero
// (bug reale corretto 2026-09-04, trovato verificando a fondo un fix
// precedente sullo stesso tema) — con uno stipendio impostato, la Dashboard
// risponde dalla Cassa Unica (cycleAllowance): il QA deve rispondere dalla
// STESSA fonte, mai dal motore budget-puro che darebbe un numero diverso
// nello stesso istante. La frase, non solo il numero, deve cambiare: senza
// una vera "settimana" di calendario a cui riferirsi, si parla di quanto
// manca allo stipendio. ──
test('con stipendio impostato, "quanto posso spendere oggi" risponde dalla Cassa Unica, non dal budget puro', () => {
  const ctxConStipendio = { ...CTX, salary: { dayOfMonth: 27, amount: 1800 }, fixedCommitments: [], monthlyBudget: 1200 };
  const r = answerQuestion('quanto posso spendere oggi?', ctxConStipendio);
  assert.equal(r.intent, 'safe-to-spend');
  assert.equal(r.data.source, 'cassaUnica');
  assert.ok(r.data.safeToday > 0 && r.data.safeToday < 1200, `numero implausibile: ${r.data.safeToday}`);
  assert.ok(!/settimana/i.test(r.answer), `non deve più parlare di "settimana" con lo stipendio attivo: "${r.answer}"`);
  assert.ok(/stipendio/i.test(r.answer), `deve dire quanto manca allo stipendio: "${r.answer}"`);
});

test('senza stipendio impostato, "quanto posso spendere oggi" resta sul motore budget-puro (comportamento invariato)', () => {
  const r = answerQuestion('quanto posso spendere oggi?', CTX);
  assert.equal(r.data.source, 'budget');
  assert.ok(/settimana/i.test(r.answer));
});

test('con stipendio impostato, un budget mensile più prudente vince (mai proporre più dello stipendio meno del budget dichiarato)', () => {
  // Stipendio molto alto ma budget dichiarato modesto: il numero di oggi
  // deve restare ancorato al budget, non allo stipendio (stesso bug del
  // Cassa Unica di fixed-commitments.js, qui verificato end-to-end dal QA).
  const ctxGeneroso = { ...CTX, allTx: { '2026-07': [] }, salary: { dayOfMonth: 27, amount: 5000 }, fixedCommitments: [], monthlyBudget: 300 };
  const r = answerQuestion('quanto posso spendere oggi?', ctxGeneroso);
  assert.equal(r.data.source, 'cassaUnica');
  assert.ok(r.data.safeToday < 30, `con budget 300€/mese non deve mai avvicinarsi a una quota da 5000€/mese (era ${r.data.safeToday})`);
});

test('come chiudo il mese → proiezione con budget', () => {
  const r = answerQuestion('come chiudo il mese?', CTX);
  assert.equal(r.intent, 'month-end');
  assert.ok(typeof r.data.projectedTotal === 'number');
});

test('quali abbonamenti pago → elenco con totale', () => {
  const r = answerQuestion('quali abbonamenti pago?', CTX);
  assert.equal(r.intent, 'subscriptions');
  assert.ok(r.answer.includes('NETFLIX.COM'));
});

test('quando pago netflix → prossimo addebito atteso', () => {
  const r = answerQuestion('quando pago netflix?', CTX);
  assert.equal(r.intent, 'subscriptions');
  assert.ok(/tra \d+ giorni|a momenti/.test(r.answer));
});

test('dove spendo di più → top categoria con percentuale', () => {
  const r = answerQuestion('dove spendo di più questo mese?', CTX);
  assert.equal(r.intent, 'top-category');
  assert.ok(r.answer.includes('Alimentari'));
});

test('quanto ho risparmiato questo mese → netto entrate-uscite', () => {
  const r = answerQuestion('quanto ho risparmiato questo mese?', CTX);
  assert.equal(r.intent, 'savings');
  assert.equal(r.data.net, 1320); // 1500 - 180
});

test('obiettivo vacanza → progresso reale', () => {
  const r = answerQuestion('a che punto è il mio obiettivo vacanza?', CTX);
  assert.equal(r.intent, 'goal');
  assert.ok(r.answer.includes('Vacanza'));
  assert.equal(r.data.saved, 1320);
});

test('domanda fuori dominio → onestà, mai risposte inventate', () => {
  const r = answerQuestion('che tempo fa domani?', CTX);
  assert.equal(r.intent, 'unknown');
  assert.ok(r.answer.includes('non la so'));
});

test('senza budget: affordability chiede il budget invece di inventare', () => {
  const r = answerQuestion('posso permettermi 50€?', { ...CTX, monthlyBudget: 0 });
  assert.ok(r.answer.includes('budget'));
});

test('ragionamento a catena: "cosa succede se spendo di più in X?" usa il grafo misurato', () => {
  // storia con legame vero: settimane alterne alte/basse per Ristorante e Trasporti insieme
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  for (let w = 0; w < 25; w++) {
    const d = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mk = d.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push(
      { date: d, amount: w % 2 === 0 ? 120 : 30, description: 'cena', type: 'uscita', category: 'Ristorante' },
      { date: d, amount: w % 2 === 0 ? 60 : 15, description: 'taxi', type: 'uscita', category: 'Trasporti' },
    );
  }
  const r = answerQuestion('cosa succede se spendo di più in ristorante?', { ...CTX, allTx });
  assert.equal(r.intent, 'causal');
  assert.ok(r.answer.includes('Trasporti'));
  assert.ok(r.answer.includes('Non è una legge')); // onestà dichiarata nella risposta
});

// Integrazione additiva (src/predict/causal-orchestrator.js, PCMCI): con
// abbastanza settimane e un legame RITARDATO vero (non nello stesso istante,
// che il motore non testa per costruzione), la risposta guadagna una frase
// in euro con incertezza, IN PIÙ rispetto a quella esistente — mai al posto.
test('ragionamento a catena: con abbastanza storia e un legame ritardato vero, arriva anche la stima in euro', () => {
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; }
  const rnd = rng(55);
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  let ristPrec = 50;
  for (let w = 0; w < 26; w++) {
    const dRist = new Date(monday0.getTime() + w * 7 * 86_400_000).toISOString().slice(0, 10);
    const dAlim = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mkR = dRist.slice(0, 7), mkA = dAlim.slice(0, 7);
    const rist = 40 + rnd() * 40;
    const alim = Math.max(10, 120 - ristPrec * 0.8 + rnd() * 10);
    ristPrec = rist;
    (allTx[mkR] = allTx[mkR] || []).push({ date: dRist, amount: +rist.toFixed(2), description: 'cena', type: 'uscita', category: 'Ristorante' });
    (allTx[mkA] = allTx[mkA] || []).push({ date: dAlim, amount: +alim.toFixed(2), description: 'spesa', type: 'uscita', category: 'Alimentari' });
  }
  const r = answerQuestion('cosa succede se spendo di più in ristorante?', { ...CTX, allTx });
  assert.equal(r.intent, 'causal');
  assert.ok(r.answer.includes('Non è una legge'), 'la risposta esistente deve restare intatta');
  // La frase aggiuntiva compare SOLO se il controllo scientifico la sostiene:
  // non si asserisce che compaia sempre, si verifica che se compare sia in
  // euro e coerente col nome della categoria coinvolta.
  if (r.answer.includes('In euro:')) {
    assert.match(r.answer, /In euro: aumentando Ristorante di [\d.,]+€\/settimana/);
  }
});

// Integrazione con predict/macro-context.js: quando il chiamante ha già un
// tasso macro reale (ctx.macroContext, mai scaricato dentro qa-engine.js —
// resta puro/sincrono) e la diagnosi lo trova responsabile del legame, il QA
// avvisa PRIMA di qualunque numero — mai lasciare credere una leva finta.
test('ragionamento a catena: un legame spiegato dal macro viene segnalato prima dei numeri', () => {
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; }
  const gauss = (r) => { const u1 = Math.max(1e-9, r()), u2 = r(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const rnd = rng(31);
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  const macroRaw = []; let m = 3;
  for (let w = 0; w < 26; w++) {
    m += 0.15 * gauss(rnd);
    macroRaw.push(m);
    const dR = new Date(monday0.getTime() + w * 7 * 86_400_000).toISOString().slice(0, 10);
    const dA = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mkR = dR.slice(0, 7), mkA = dA.slice(0, 7);
    const rist = Math.max(5, 1.2 * m + 0.2 * gauss(rnd));
    const alim = Math.max(5, 1.2 * m + 0.2 * gauss(rnd));
    (allTx[mkR] = allTx[mkR] || []).push({ date: dR, amount: rist, description: 'cena', type: 'uscita', category: 'Ristorante' });
    (allTx[mkA] = allTx[mkA] || []).push({ date: dA, amount: alim, description: 'spesa', type: 'uscita', category: 'Alimentari' });
  }
  const macroContext = { values: macroRaw, copertura: 1, label: 'il tasso di riferimento BCE' };
  const r = answerQuestion('cosa succede se spendo di più in ristorante?', { ...CTX, allTx, macroContext });
  assert.equal(r.intent, 'causal');
  // Il legame reale è forte (guidato dallo stesso driver): se la diagnosi lo
  // ha trovato E spiegato con successo, il messaggio deve dirlo prima dei
  // numeri; se per rumore statistico non lo trova in questo campione, la
  // risposta esistente deve comunque restare intatta (mai un crash).
  assert.ok(r.answer.includes('Non è una legge'));
  if (r.answer.includes('Attenzione:')) {
    assert.match(r.answer, /tasso di riferimento BCE/);
    assert.match(r.answer, /potrebbe non spostare nulla/);
  }
});

test('FALLBACK: macroContext malformato (rete assente/dati corrotti) → risposta base resta valida, nessun crash', () => {
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; }
  const rnd = rng(55);
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  let ristPrec = 50;
  for (let w = 0; w < 26; w++) {
    const dRist = new Date(monday0.getTime() + w * 7 * 86_400_000).toISOString().slice(0, 10);
    const dAlim = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mkR = dRist.slice(0, 7), mkA = dAlim.slice(0, 7);
    const rist = 40 + rnd() * 40;
    const alim = Math.max(10, 120 - ristPrec * 0.8 + rnd() * 10);
    ristPrec = rist;
    (allTx[mkR] = allTx[mkR] || []).push({ date: dRist, amount: +rist.toFixed(2), description: 'cena', type: 'uscita', category: 'Ristorante' });
    (allTx[mkA] = allTx[mkA] || []).push({ date: dAlim, amount: +alim.toFixed(2), description: 'spesa', type: 'uscita', category: 'Alimentari' });
  }
  const refFallback = new Date(monday0.getTime() + 26 * 7 * 86_400_000 + 3 * 86_400_000);
  // Tre forme di "macro rotto" plausibili: fetch fallito (null, già coperto
  // sopra), risposta a metà (senza `values`), e un valore del tutto assurdo
  // (stringa al posto dell'array) — nessuna deve mai far cadere il QA.
  for (const macroContext of [{}, { values: undefined, copertura: 1 }, { values: 'non-un-array', copertura: 1 }]) {
    const r = answerQuestion('cosa succede se spendo di più in ristorante?', { referenceDate: refFallback, allTx, macroContext });
    assert.equal(r.intent, 'causal');
    assert.ok(r.answer.includes('Non è una legge'), 'la risposta base deve restare intatta anche con un macroContext rotto');
  }
});

test('senza macroContext, il comportamento resta quello di sempre (nessuna regressione)', () => {
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  for (let w = 0; w < 25; w++) {
    const d = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mk = d.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push(
      { date: d, amount: w % 2 === 0 ? 120 : 30, description: 'cena', type: 'uscita', category: 'Ristorante' },
      { date: d, amount: w % 2 === 0 ? 60 : 15, description: 'taxi', type: 'uscita', category: 'Trasporti' },
    );
  }
  const r = answerQuestion('cosa succede se spendo di più in ristorante?', { ...CTX, allTx });
  assert.equal(r.intent, 'causal');
  assert.ok(!r.answer.includes('Attenzione:'), 'senza contesto macro non deve mai comparire l\'avviso');
});

test('ragionamento a catena: senza legami nei dati lo dice, non inventa', () => {
  const r = answerQuestion('cosa succede se spendo di più in alimentari?', CTX);
  assert.equal(r.intent, 'causal');
  assert.ok(/non vedo|Dimmi la categoria/.test(r.answer));
});

test('intent investimento: "quanto posso investire" usa il motore alpha/bridge', () => {
  // storia con avanzo e fondo emergenza accumulato (invest)
  const allTx = {
    '2026-05': [{ date: '2026-05-05', amount: 5000, type: 'invest', category: 'etf', description: 'pac' }],
    '2026-07': [
      { date: '2026-07-05', amount: 2000, type: 'entrata', category: 'stipendio', description: 'stipendio' },
      { date: '2026-07-10', amount: 800, type: 'uscita', category: 'spesa', description: 'spesa' },
    ],
  };
  const r = answerQuestion('quanto posso investire questo mese?', { allTx, referenceDate: new Date(2026, 6, 15), emergencyFund: 10000 });
  assert.equal(r.intent, 'invest');
  assert.ok(typeof r.answer === 'string' && r.answer.length > 0);
  assert.ok('investable' in r.data);
});

test('intent investimento: "dove posso investire oggi?" matcha lo stesso motore (segnalato dall\'utente, prima cadeva sulla chat generica)', () => {
  const allTx = {
    '2026-05': [{ date: '2026-05-05', amount: 5000, type: 'invest', category: 'etf', description: 'pac' }],
    '2026-07': [
      { date: '2026-07-05', amount: 2000, type: 'entrata', category: 'stipendio', description: 'stipendio' },
      { date: '2026-07-10', amount: 800, type: 'uscita', category: 'spesa', description: 'spesa' },
    ],
  };
  const r = answerQuestion('dove posso investire oggi?', { allTx, referenceDate: new Date(2026, 6, 15), emergencyFund: 10000 });
  assert.equal(r.intent, 'invest');
  // Con l'avanzo disponibile, la risposta cita categorie con Sharpe misurato
  // (mai un consiglio d'acquisto specifico) invece di restare generica.
  assert.ok(/Sharpe.*misurato/.test(r.answer));
  assert.ok(/consiglio d'acquisto/.test(r.answer)); // la dicitura onesta resta presente
});

test('intent investimento: senza avanzo disponibile, nessun arricchimento aggiunto (resta solo il motivo)', () => {
  const allTx = {
    '2026-07': [
      { date: '2026-07-05', amount: 500, type: 'entrata', category: 'stipendio', description: 'stipendio' },
      { date: '2026-07-10', amount: 800, type: 'uscita', category: 'spesa', description: 'spesa' },
    ],
  };
  const r = answerQuestion('dove posso investire?', { allTx, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'invest');
  assert.ok(!/Sharpe/.test(r.answer));
});

test('intent netWorth: "quanto vale il mio patrimonio?" usa computeNetWorth', () => {
  const allTx = {
    '2026-07': [
      { date: '2026-07-05', amount: 2000, type: 'entrata', category: 'stipendio', description: 'stipendio' },
      { date: '2026-07-10', amount: 500, type: 'uscita', category: 'spesa', description: 'spesa' },
    ],
  };
  const r = answerQuestion('quanto vale il mio patrimonio?', { allTx, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'net-worth');
  assert.ok(/patrimonio totale/.test(r.answer));
  assert.ok('total' in r.data);
});

test('intent payday: "quando mi pagano?" con stipendio noto calcola i giorni', () => {
  const r = answerQuestion('quando mi pagano?', {
    allTx: {}, referenceDate: new Date(2026, 6, 15),
    salary: { dayOfMonth: 27, amount: 2000, label: 'Stipendio' },
    fixedCommitments: [],
  });
  assert.equal(r.intent, 'payday');
  assert.ok(/Ti pagano/.test(r.answer));
});

test('intent payday: senza stipendio noto, risposta onesta invece di un errore', () => {
  const r = answerQuestion('quando mi pagano?', { allTx: {}, referenceDate: new Date(2026, 6, 15), salary: null });
  assert.equal(r.intent, 'payday');
  assert.ok(/Non so ancora/.test(r.answer));
});

test('intent bnplOwed: "quanto devo ancora a rate?" senza piani aperti', () => {
  const r = answerQuestion('quanto devo ancora a rate?', { allTx: {}, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'bnpl-owed');
  assert.ok(/nessuno piani a rate aperti|non vedo piani/i.test(r.answer));
});

test('correzione refusi: "quanto ho spendrere questo mese" riconosce comunque "spendere"', () => {
  const allTx = { '2026-07': [{ date: '2026-07-05', amount: 100, type: 'uscita', category: 'spesa', description: 'spesa' }] };
  const r = answerQuestion('quanto posso spendrere oggi?', { allTx, referenceDate: new Date(2026, 6, 15), monthlyBudget: 1000 });
  assert.equal(r.intent, 'safe-to-spend');
});

test('correzione refusi: "investmire" riconosciuto come "investire"', () => {
  const allTx = {
    '2026-07': [
      { date: '2026-07-05', amount: 2000, type: 'entrata', category: 'stipendio', description: 'stipendio' },
      { date: '2026-07-10', amount: 500, type: 'uscita', category: 'spesa', description: 'spesa' },
    ],
  };
  const r = answerQuestion('quanto posso investmire questo mese?', { allTx, referenceDate: new Date(2026, 6, 15), emergencyFund: 10000 });
  assert.equal(r.intent, 'invest');
});

test('correzione refusi: "stipnedio" riconosciuto come "stipendio" nell\'intento payday', () => {
  const r = answerQuestion('quando arriva lo stipnedio?', { allTx: {}, referenceDate: new Date(2026, 6, 15), salary: { dayOfMonth: 27, amount: 2000 }, fixedCommitments: [] });
  assert.equal(r.intent, 'payday');
});

test('correzione refusi: non tocca parole già corrette o troppo diverse dal dizionario', () => {
  // "pizza" non è nel dizionario e non somiglia a nessuna parola-chiave: non deve
  // rompere né cambiare il riconoscimento di un intento non correlato.
  const r = answerQuestion('quanto ho speso in pizza questo mese?', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'spent');
});

// ============================================================
// AUTO-APPRENDIMENTO (ai/qa-learning.js): una formulazione fuori dai
// pattern fissi, confermata due volte dall'utente come "intendevo X",
// viene riconosciuta da sola la volta successiva — collegamento reale
// tramite ctx.qaLearning, non solo il modulo isolato.
// ============================================================

test('SCENARIO: domanda MAI riconosciuta prima della 2a conferma', () => {
  const r = answerQuestion('quanto ho messo via questo mese', { allTx: {}, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'unknown');
});

test('SCENARIO: con 2 conferme già date su formulazioni simili, la stessa famiglia di domanda viene riconosciuta da sola e marcata `learned:true`', () => {
  const qaLearning = {
    unknownLog: [],
    learned: [{ question: 'quanto ho messo via questo mese', tokens: ['messo', 'via', 'questo', 'mese'], intent: 'savings', conferme: 2, ts: Date.now() }],
  };
  const r = answerQuestion('quanto ho messo via il mese', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15), qaLearning });
  assert.equal(r.intent, 'savings');
  assert.equal(r.learned, true);
});

// BUG REALE trovato dal vivo (2026-08-24): CANONICAL_TRIGGER/QA_LEARN_TOPICS
// scrivono gli intenti a più parole in camelCase ('netWorth', 'budgetLeft',
// 'bnplOwed', 'safeToSpend', 'monthEnd', 'topCategory'), ma il riconoscitore
// vero produce kebab-case ('net-worth', 'budget-left', ecc) — il confronto
// diretto non ha mai marcato `learned:true` per questi 6, silenziosamente,
// anche con le 2 conferme richieste già date. I 9 intenti monoparola (come
// 'savings' sopra) non hanno mai avuto il problema, per questo è passato
// inosservato: serve testare esplicitamente ognuno dei 6 a più parole.
test('SCENARIO: `learned:true` funziona anche per gli intenti a più parole (camelCase insegnato vs kebab-case riconosciuto)', () => {
  const casi = [
    { insegna: 'netWorth', domanda: 'quanto sono ricco adesso in totale', atteso: 'net-worth' },
    { insegna: 'budgetLeft', domanda: 'quanto mi rimane da spendere oggi ancora', atteso: 'budget-left' },
    { insegna: 'bnplOwed', domanda: 'quanto devo ancora pagare a rate adesso', atteso: 'bnpl-owed' },
  ];
  for (const { insegna, domanda, atteso } of casi) {
    const qaLearning = {
      unknownLog: [],
      learned: [{ question: domanda, tokens: domanda.split(' '), intent: insegna, conferme: 2, ts: Date.now() }],
    };
    const r = answerQuestion(domanda, { allTx: {}, referenceDate: new Date(2026, 6, 15), qaLearning });
    assert.equal(r.intent, atteso, `domanda "${domanda}"`);
    assert.equal(r.learned, true, `"${insegna}" insegnato ma learned non marcato per l'intento "${atteso}"`);
  }
});

test('SCENARIO: con UNA sola conferma, la domanda resta "unknown" — mai un\'azione automatica da n=1', () => {
  const qaLearning = {
    unknownLog: [],
    learned: [{ question: 'quanto ho messo via questo mese', tokens: ['messo', 'via', 'questo', 'mese'], intent: 'savings', conferme: 1, ts: Date.now() }],
  };
  const r = answerQuestion('quanto ho messo via il mese', { allTx: {}, referenceDate: new Date(2026, 6, 15), qaLearning });
  assert.equal(r.intent, 'unknown');
  assert.ok(!r.learned);
});

test('SCENARIO: una domanda già riconosciuta normalmente NON porta il badge `learned` (mai una sovra-dichiarazione)', () => {
  const r = answerQuestion('quanto ho speso questo mese?', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'spent');
  assert.ok(!r.learned);
});

test('FALLBACK: ctx.qaLearning malformato (learned non è un array, voci senza tokens) → risposta normale, nessun crash', () => {
  for (const qaLearning of [{ learned: 'non-un-array' }, { learned: [{ intent: 'savings' }] }, {}]) {
    const r = answerQuestion('quanto ho speso questo mese?', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15), qaLearning });
    assert.equal(r.intent, 'spent');
  }
});

test('FALLBACK: senza ctx.qaLearning il comportamento resta quello di sempre (nessuna regressione)', () => {
  const r = answerQuestion('quanto ho speso questo mese?', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.intent, 'spent');
  assert.ok(!('learned' in r) || !r.learned);
});

// ── ctx.semanticSimilarity (src/ai/semantic-embed.js): stesso punto di
// innesto di qa-learning.js, verificato qui fino alla risposta reale ──

test('ctx.semanticSimilarity: una parafrasi con ZERO parole in comune viene riconosciuta se la similarità semantica supera la soglia', () => {
  const qaLearning = {
    unknownLog: [],
    learned: [{ question: 'quanto ho messo via questo mese', tokens: ['messo', 'via', 'questo', 'mese'], intent: 'savings', conferme: 2, ts: Date.now() }],
  };
  // Frase completamente diversa nelle parole: Jaccard darebbe 0 (verificato
  // sotto), ma la finta similarità semantica simula un vero match di significato.
  const domanda = 'a quanto ammonta il mio accantonamento recente';
  const senzaSemantica = answerQuestion(domanda, { allTx: {}, referenceDate: new Date(2026, 6, 15), qaLearning });
  assert.equal(senzaSemantica.intent, 'unknown');
  const semanticSimilarity = (a, b) => 0.9;
  const conSemantica = answerQuestion(domanda, { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15), qaLearning, semanticSimilarity });
  assert.equal(conSemantica.intent, 'savings');
  assert.equal(conSemantica.learned, true);
});

test('ctx.semanticSimilarity + banco canonico: una domanda MAI insegnata prima viene riconosciuta al primo tentativo se vicina a un esempio curato', () => {
  const domanda = 'quanto sono disposto a spendere in questo preciso momento';
  const senzaSemantica = answerQuestion(domanda, { allTx: {}, referenceDate: new Date(2026, 6, 15) });
  assert.equal(senzaSemantica.intent, 'unknown');
  const semanticSimilarity = (a, b) => (b === 'quanto posso spendere oggi' ? 0.9 : 0.1);
  const conSemantica = answerQuestion(domanda, { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15), semanticSimilarity });
  assert.equal(conSemantica.intent, 'safe-to-spend');
  // Mai un badge "imparato": non è stato insegnato da QUESTO utente, è un
  // riconoscimento curato — la distinzione deve restare visibile.
  assert.ok(!conSemantica.learned);
});

test('ctx.semanticSimilarity assente (utente senza il modello scaricato) → nessuna differenza, fallback a Jaccard', () => {
  const qaLearning = {
    unknownLog: [],
    learned: [{ question: 'quanto ho messo via questo mese', tokens: ['messo', 'via', 'questo', 'mese'], intent: 'savings', conferme: 2, ts: Date.now() }],
  };
  const r = answerQuestion('quanto ho messo via il mese', { allTx: { '2026-07': [] }, referenceDate: new Date(2026, 6, 15), qaLearning });
  assert.equal(r.intent, 'savings');
});

// ── Il correttore di refusi non deve riscrivere parole vere ──

test('BUG REALE: "perdere" e "vendere" non sono refusi di "spendere"', () => {
  // Trovato provando l'app nel browser con dati veri: "quanto posso PERDERE
  // nel caso peggiore?" veniva corretto in "quanto posso SPENDERE" (distanza
  // di Levenshtein 2) e rispondeva col budget giornaliero. Stessa cosa per
  // "vendere". In un'app di soldi confondere perdere/vendere con spendere non
  // e' un dettaglio: sono significati opposti.
  const ctx = { allTx: {}, referenceDate: new Date(), monthlyBudget: 1000 };
  assert.notEqual(answerQuestion('quanto posso perdere nel caso peggiore?', ctx).intent, 'safe-to-spend');
  assert.notEqual(answerQuestion('posso vendere adesso?', ctx).intent, 'safe-to-spend');
  assert.notEqual(answerQuestion('quanto ho perso quest\'anno?', ctx).intent, 'safe-to-spend');
});

test('...ma i refusi VERI continuano a essere corretti', () => {
  const ctx = { allTx: {}, referenceDate: new Date(), monthlyBudget: 1000 };
  // "spendrere" non e' una parola italiana: quello si', va corretto.
  assert.equal(answerQuestion('quanto posso spendrere oggi?', ctx).intent, 'safe-to-spend');
  assert.equal(answerQuestion('quanto posso spendere oggi?', ctx).intent, 'safe-to-spend');
});

// ── IL RIFIUTO VIENE PRIMA DI TUTTO ──
// Buco di sicurezza trovato provando l'app dal vivo con il motore semantico
// acceso (2026-08-19): il rifiuto motivato viveva solo nel ramo dei mercati,
// consultato per ULTIMO come ripiego. Così "dimmi tu dove investire adesso"
// incontrava prima l'intento `invest` della finanza personale e riceveva una
// RISPOSTA ("questo mese non avanza nulla") invece del no motivato: una
// richiesta di consiglio finanziario veniva servita.
// E la comprensione semantica peggiorava la cosa, perché allargava la portata
// degli intenti personali senza allargare quella dei rifiuti.
test('una richiesta di CONSIGLIO viene rifiutata prima di qualunque intento', () => {
  const rifiuto = (t) => (/dove investire|quale azienda|cosa compro/i.test(t)
    ? { intent: 'mercato-non-si-puo', answer: 'Non te lo dico, e non è prudenza.' }
    : null);
  for (const d of ['dimmi tu dove investire adesso', 'su quale azienda dovrei puntare i risparmi?']) {
    const r = answerQuestion(d, { ...CTX, rifiuto });
    assert.equal(r.intent, 'mercato-non-si-puo', `"${d}" ha ricevuto ${r.intent}`);
  }
});

test('il rifiuto NON intercetta le domande legittime sui propri soldi', () => {
  // Una rete di sicurezza che rifiuta tutto è inutile quanto una che non
  // rifiuta niente.
  const rifiuto = (t) => (/dove investire/i.test(t) ? { intent: 'mercato-non-si-puo', answer: 'no' } : null);
  const r = answerQuestion('quanto posso spendere oggi?', { ...CTX, rifiuto });
  assert.notEqual(r.intent, 'mercato-non-si-puo');
  assert.equal(r.intent, 'safe-to-spend');
});

test('un rifiuto che va in errore non rompe la risposta', () => {
  const rifiuto = () => { throw new Error('boom'); };
  const r = answerQuestion('quanto posso spendere oggi?', { ...CTX, rifiuto });
  assert.equal(r.intent, 'safe-to-spend');
});

test('senza ctx.rifiuto il comportamento resta identico a prima', () => {
  const r = answerQuestion('quanto posso spendere oggi?', CTX);
  assert.equal(r.intent, 'safe-to-spend');
});

// ── IL BANCO CANONICO NON PUÒ RUBARE UNA DOMANDA DI MERCATO ──
test('REGRESSIONE GRAVE: la semantica non deve dirottare le domande di borsa', () => {
  // Trovata provando l'app come la userebbe un TRADER (2026-08-20): con la
  // comprensione semantica accesa, "come sta il mercato?", "quanto rischio di
  // perdere?" e "sono davvero diversificato?" ricevevano tutte "questo mese
  // non avanza nulla: prima il budget". Con le sole parole chiave funzionavano
  // perfettamente: il livello semantico rendeva IRRAGGIUNGIBILE metà dell'app.
  //
  // La causa era l'ORDINE — il banco canonico veniva consultato prima del ramo
  // dei mercati — e nessuna soglia lo risolve, perché non è un problema di
  // taglio. Ora il banco è l'ultima spiaggia: ci si arriva solo se nessun
  // intento, personale o di mercato, ha riconosciuto la domanda.
  const mercato = (t) => (/mercato|perdere|diversificat/i.test(t)
    ? { intent: 'mercato-regime', answer: 'risposta di mercato' } : null);
  // Una similarità che direbbe "safeToSpend" su qualunque cosa: il caso
  // peggiore possibile.
  const bugiarda = () => 0.99;
  for (const d of ['come sta il mercato?', 'quanto rischio di perdere?', 'sono davvero diversificato?']) {
    const r = answerQuestion(d, { ...CTX, mercato, semanticSimilarity: bugiarda });
    assert.equal(r.intent, 'mercato-regime', `"${d}" dirottata dalla semantica`);
  }
});

test('ma la semantica AGGIUNGE ancora comprensione dove nessuno riconosce', () => {
  // La rete deve continuare a servire: se né le parole chiave né i mercati
  // riconoscono la domanda, il banco canonico può ancora salvarla.
  const similarity = (a, b) => (b === 'quanto posso spendere oggi' ? 0.99 : 0.01);
  const r = answerQuestion('e oggi quanto mi è concesso tirare fuori', { ...CTX, semanticSimilarity: similarity });
  assert.equal(r.intent, 'safe-to-spend');
  assert.equal(r.viaBancoCanonico, true);
});

test('nessun ciclo infinito quando il banco inietta un indizio', () => {
  // Il ri-riconoscimento con l'indizio iniettato potrebbe richiamare se
  // stesso: la guardia `_daBanco` lo impedisce.
  const similarity = () => 0.99;
  const r = answerQuestion('frase che non somiglia a niente di riconoscibile', { ...CTX, semanticSimilarity: similarity });
  assert.ok(r && r.intent, 'deve comunque restituire qualcosa');
});
