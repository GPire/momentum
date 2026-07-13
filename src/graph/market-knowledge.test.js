import test from 'node:test';
import assert from 'node:assert/strict';
const { macroChains, investorFor, explainMacro, MACRO_LINKS, INVESTOR_PRINCIPLES } = await import('./market-knowledge.js');

test('macroChains: tassi in rialzo → obbligazioni giù', () => {
  const c = macroChains('cosa succede se salgono i tassi di interesse?');
  assert.ok(c.some(x => x.id === 'rates-up-bonds-down'));
});

test('macroChains: inflazione → beni reali', () => {
  assert.ok(macroChains('con l\'inflazione alta cosa conviene?').some(x => x.id === 'inflation-real-assets'));
});

test('investorFor: riconosce il grande investitore pertinente', () => {
  assert.equal(investorFor('mi spieghi la strategia di Buffett?').who, 'Warren Buffett');
  assert.equal(investorFor('conviene un etf a basso costo indicizzato?').who, 'John Bogle');
});

test('explainMacro: catena + fonte + caveat onesto', () => {
  const e = explainMacro('tassi in rialzo');
  assert.ok(e && /obbligazioni/.test(e.text) && /fonte:/i.test(e.text) && /non una certezza/.test(e.text));
});

test('knowledge base ampliata (50 anni, più investitori/istituzioni)', () => {
  assert.ok(MACRO_LINKS.length >= 15 && INVESTOR_PRINCIPLES.length >= 15);
});

test('istituzioni: JP Morgan, Vanguard, VanEck, McKinsey riconosciute', () => {
  assert.equal(investorFor('secondo JP Morgan conviene restare investito?').who, 'JP Morgan (Guide to the Markets)');
  assert.ok(/VanEck/.test(investorFor('vaneck oro emergenti moat').who));
  assert.ok(/McKinsey/.test(investorFor('mckinsey roic costo del capitale').who));
});

test('macro 50 anni: curva invertita → recessione', () => {
  assert.ok(macroChains('la curva dei rendimenti si inverte').some(x => x.id === 'yield-curve-inversion'));
});
