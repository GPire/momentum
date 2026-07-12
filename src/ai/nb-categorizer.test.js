import test from 'node:test';
import assert from 'node:assert/strict';
const { NBCategorizer, trainNBFromDictionary } = await import('./nb-categorizer.js');

test('NB: impara un merchant e lo predice', () => {
  const nb = new NBCategorizer([['esselunga', 'spesa'], ['netflix', 'abbonamenti'], ['trenitalia', 'trasporti']]);
  assert.equal(nb.predict('esselunga').category, 'spesa');
});

test('NB: generalizza via sottostringhe condivise', () => {
  const nb = new NBCategorizer([
    ['supermercato', 'spesa'], ['supermercado', 'spesa'], ['mercato', 'spesa'],
    ['ristorante', 'ristoranti'], ['pizzeria', 'ristoranti'],
  ], { alpha: 0.1 });
  // "ipermercato" mai visto ma condivide "merc" con la classe spesa
  assert.equal(nb.predict('ipermercato').category, 'spesa');
});

test('NB: la distribuzione somma a 1', () => {
  const nb = new NBCategorizer([['a x', 'uno'], ['b y', 'due']]);
  const r = nb.predict('a x');
  const sum = Object.values(r.allProbs).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('trainNBFromDictionary: costruisce da mappa merchant→categoria', () => {
  const nb = trainNBFromDictionary({ esselunga: 'spesa', netflix: 'abbonamenti', binance: 'crypto' });
  assert.equal(nb.predict('esselunga').category, 'spesa');
  assert.ok(nb.classes.includes('crypto'));
});
