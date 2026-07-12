import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { detectLanguage } = await import('../i18n/detect.js');
const { chat } = await import('./chat.js');

const CTX = {
  referenceDate: new Date(2026, 6, 15),
  monthlyBudget: 3100,
  allTx: { '2026-07': [
    { date: '2026-07-05', amount: 1500, type: 'entrata', category: 'stipendio', description: 's' },
    { date: '2026-07-08', amount: 200, type: 'uscita', category: 'spesa', description: 'x' },
  ]},
};

test('detectLanguage: IT/EN/ES riconosciute', () => {
  assert.equal(detectLanguage('quanto ho speso questo mese').lang, 'it');
  assert.equal(detectLanguage('how much did i spend this month').lang, 'en');
  assert.equal(detectLanguage('cuánto he gastado este mes').lang, 'es');
});

test('chat: "quanto ho speso" (IT) → risposta italiana con cifra', () => {
  const r = chat('quanto ho speso questo mese?', CTX);
  assert.equal(r.lang, 'it');
  assert.equal(r.intent, 'spent');
  assert.ok(r.answer.includes('200,00€'));
});

test('chat: "how much did I spend" (EN) → risposta inglese', () => {
  const r = chat('how much did I spend this month?', CTX);
  assert.equal(r.lang, 'en');
  assert.equal(r.intent, 'spent');
  assert.ok(/This month you spent/.test(r.answer));
});

test('chat: "cuánto he gastado" (ES) → risposta spagnola', () => {
  const r = chat('¿cuánto he gastado este mes?', CTX);
  assert.equal(r.lang, 'es');
  assert.equal(r.intent, 'spent');
  assert.ok(/Este mes has gastado/.test(r.answer));
});

test('chat: safe-to-spend multilingua', () => {
  assert.equal(chat('quanto posso spendere oggi?', CTX).intent, 'safeToSpend');
  assert.equal(chat('how much can I spend today?', CTX).intent, 'safeToSpend');
  assert.equal(chat('¿cuánto puedo gastar hoy?', CTX).intent, 'safeToSpend');
});

test('chat: intent invest e tax riconosciuti in ES', () => {
  assert.equal(chat('¿cuánto puedo invertir este mes?', CTX).intent, 'invest');
  assert.equal(chat('¿cuánto para impuestos?', { ...CTX, taxRegime: 'forfettario' }).intent, 'tax');
});

test('chat: francese ora completo → risponde in FR (non più fallback)', () => {
  const r = chat('combien puis-je dépenser aujourd\'hui', CTX);
  assert.equal(r.lang, 'fr');
  assert.ok(typeof r.answer === 'string');
});

test('chat: messaggio incomprensibile → unknown localizzato', () => {
  assert.equal(chat('bardzo dziwne zdanie', CTX).intent, 'unknown');
});

test('chat: francese completo → risposta in francese', () => {
  const r = chat('combien j\'ai dépensé ce mois?', CTX);
  assert.equal(r.lang, 'fr');
  assert.equal(r.intent, 'spent');
  assert.ok(/Ce mois-ci tu as dépensé/.test(r.answer));
});

test('chat: tedesco completo → risposta in tedesco', () => {
  const r = chat('wie viel habe ich diesen monat ausgegeben?', CTX);
  assert.equal(r.lang, 'de');
  assert.equal(r.intent, 'spent');
  assert.ok(/ausgegeben/.test(r.answer));
});

test('chat: safe-to-spend in FR e DE', () => {
  assert.equal(chat('combien puis-je dépenser aujourd\'hui?', CTX).intent, 'safeToSpend');
  assert.equal(chat('wie viel kann ich heute ausgeben?', CTX).intent, 'safeToSpend');
});
