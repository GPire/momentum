import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateNewsItems } from './news.js';
import { tIntegration } from '../i18n/integration-copy.js';

test('consolidateNewsItems unisce URL uguali senza parametri di tracciamento', () => {
  const result = consolidateNewsItems([
    { title: 'Apple presenta un nuovo prodotto', url: 'https://example.com/a?utm_source=x', source: 'Reuters', summary: null, sentimentScore: null },
    { title: 'Titolo aggiornato', url: 'https://example.com/a?fbclid=abc', source: 'Bloomberg', summary: 'Dettagli.', sentimentScore: 0.3, sentimentLabel: 'somewhat-bullish' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].corroborationCount, 2);
  assert.deepEqual(result[0].corroborationSources, ['Reuters', 'Bloomberg']);
  assert.equal(result[0].summary, 'Dettagli.');
  assert.equal(result[0].sentimentScore, 0.3);
});

test('consolidateNewsItems unisce solo titoli equivalenti e conserva eventi distinti', () => {
  const input = [
    { title: 'Apple rialza le stime!', url: 'https://a.test/1', source: 'A' },
    { title: 'Apple rialza le stime', url: 'https://b.test/2', source: 'B' },
    { title: 'Apple taglia le stime', url: 'https://c.test/3', source: 'C' },
  ];
  const result = consolidateNewsItems(input);
  assert.equal(result.length, 2);
  assert.equal(result[0].corroborationCount, 2);
  assert.equal(result[1].title, 'Apple taglia le stime');
  assert.equal(input[0].corroborationCount, undefined, 'non modifica gli oggetti in ingresso');
});

test('consolidateNewsItems scarta voci senza titolo e rispetta il limite', () => {
  const result = consolidateNewsItems([{ url: 'https://a.test' }, { title: 'A' }, { title: 'B' }], { limit: 1 });
  assert.deepEqual(result.map((x) => x.title), ['A']);
});

test('le nuove etichette notizie e modifica categoria coprono tutte le lingue', () => {
  for (const lang of ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt']) {
    for (const key of ['transactionCategoryQuestion', 'categoryMoved', 'categoryMovedLearned', 'newsTitle', 'newsOtherSources', 'newsOnDevice', 'newsSentimentSummary', 'newsSentimentDeviceNote', 'newsSentiment_bullish', 'newsSentiment_somewhat_bullish', 'newsSentiment_neutral', 'newsSentiment_somewhat_bearish', 'newsSentiment_bearish']) {
      assert.notEqual(tIntegration(key, lang, 'X', '0.20', 2), key, `${lang}: ${key}`);
    }
  }
});
