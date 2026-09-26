import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { answerQuestion } = await import('./qa-engine.js');

// Olandese e portoghese sono lingue dell'interfaccia: prima del 26/09/2026 il
// motore le rilevava ma rispondeva in inglese e non riconosceva le domande.
const REF = new Date(2026, 6, 15);
const tx = (date, amount, description, type, category) => ({ date, amount, description, type, category });
const CTX = {
  referenceDate: REF,
  monthlyBudget: 3100,
  savingsGoals: [{ id: 1, name: 'Vakantie', target: 1000, createdAt: '2026-07-01' }],
  salary: null,
  allTx: {
    '2026-06': [tx('2026-06-10', 250, 'Boodschappen', 'uscita', 'Alimentari'), tx('2026-06-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-05': [tx('2026-05-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-04': [tx('2026-04-17', 12.99, 'NETFLIX.COM', 'uscita', 'Svago')],
    '2026-07': [tx('2026-07-05', 1500, 'Salaris', 'entrata', 'Stipendio'), tx('2026-07-08', 120, 'Albert Heijn', 'uscita', 'Alimentari'), tx('2026-07-14', 60, 'Benzine', 'uscita', 'Trasporti')],
  },
};

const CASI = {
  nl: [
    ['Hoeveel heb ik deze maand uitgegeven?', 'spent', /uitgegeven/],
    ['Hoeveel kan ik vandaag uitgeven?', 'safe-to-spend', /vandaag kun je/i],
    ['Kan ik 50 euro veroorloven?', 'affordability', /^(Ja|Liever|Riskant)/],
    ['Hoe eindig ik de maand?', 'month-end', /tempo/],
    ['Welke abonnementen betaal ik?', 'subscriptions', /abonnement/],
    ['Waar geef ik het meest uit?', 'top-category', /grootste uitgave/],
    ['Hoeveel heb ik gespaard deze maand?', 'savings', /gespaard|uitgegeven/],
    ['Hoeveel heb ik verdiend deze maand?', 'income', /inkomsten/],
    ['Hoe staat mijn doel ervoor?', 'goal', /van/],
    ['Wat is mijn vermogen?', 'net-worth', /vermogen/],
    ['Wanneer word ik betaald?', 'payday', /betaald/],
  ],
  pt: [
    ['Quanto gastei este mês?', 'spent', /gastou/],
    ['Quanto posso gastar hoje?', 'safe-to-spend', /hoje pode gastar/i],
    ['Posso pagar 50 euros?', 'affordability', /^(Sim|Melhor|Arriscado)/],
    ['Como termino o mês?', 'month-end', /ritmo/],
    ['Que assinaturas pago?', 'subscriptions', /subscriç/],
    ['Onde gasto mais?', 'top-category', /maior despesa/],
    ['Quanto poupei este mês?', 'savings', /poupou|gastou/],
    ['Quanto ganhei este mês?', 'income', /receitas/],
    ['Como está o meu objetivo?', 'goal', / de /],
    ['Qual é o meu património?', 'net-worth', /património/],
    ['Quando recebo o salário?', 'payday', /recebe/i],
  ],
};

for (const [lang, casi] of Object.entries(CASI)) {
  for (const [domanda, intento, atteso] of casi) {
    test(`${lang}: "${domanda}" → ${intento}, risposta nella stessa lingua`, () => {
      const r = answerQuestion(domanda, CTX);
      assert.equal(r.intent, intento, JSON.stringify(r).slice(0, 200));
      assert.equal(typeof r.answer, 'string');
      assert.ok(!r.answer.includes('undefined'), r.answer);
      assert.match(r.answer, atteso);
      assert.doesNotMatch(r.answer, /\b(you|your|hai speso|puoi)\b/i, r.answer);
    });
  }
}

test('domanda non capita: suggerimenti nella lingua della domanda', () => {
  assert.match(answerQuestion('Hoeveel kost een olifant op de maan eigenlijk', CTX).answer, /Dit weet ik nog niet/);
  assert.match(answerQuestion('Quanto custa um elefante na lua afinal', CTX).answer, /Ainda não sei/);
});
