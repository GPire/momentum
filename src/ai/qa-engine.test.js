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
