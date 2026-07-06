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
