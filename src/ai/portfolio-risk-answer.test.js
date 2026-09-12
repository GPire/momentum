import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = globalThis.window || {};
if (!globalThis.navigator) globalThis.navigator = { maxTouchPoints: 0 };
const { answerQuestion } = await import('./qa-engine.js');
import { learnCorrection } from './qa-learning.js';
import { portfolioProviderRisk } from '../alpha/portfolio-provider-risk.js';
import { t } from '../i18n/ui-strings.js';

const points = Array.from({ length: 1201 }, (_, i) => ({ date: new Date(Date.UTC(2023, 0, i + 1)).toISOString().slice(0, 10), close: 100 + i % 7 }));
const asOf = points.at(-1).date;
const ctx = () => ({ referenceDate: new Date(`${asOf}T12:00:00Z`), uiLanguage: 'it',
  positions: [{ ticker: 'bitcoin', quantity: 2, assetClass: 'crypto' }],
  marketRiskSources: { bitcoin: { prices: points, currency: 'EUR', symbol: 'bitcoin', kind: 'prices',
    assetKind: 'crypto', verified: 'single-source', priceSource: 'coingecko', source: 'coingecko', asOf } },
});

test('real QA entry point calculates sourced portfolio risk without training on its answer', () => {
  const context = ctx(), before = JSON.stringify(context);
  const r = answerQuestion('qual è il rischio del portafoglio?', context);
  assert.equal(r.intent, 'portfolio-risk');
  assert.equal(r.data.available, true);
  assert.equal(r.data.coverage, 1);
  assert.equal(r.data.horizon, 5);
  assert.ok(r.answer.includes('non è una previsione'));
  assert.equal(JSON.stringify(context), before);
});

test('seven language questions and responses, including empty holdings', () => {
  const questions = { it: 'rischio del portafoglio', en: 'portfolio risk', de: 'Portfoliorisiko',
    fr: 'risque du portefeuille', es: 'riesgo de mi cartera', nl: 'risico van mijn portefeuille', pt: 'risco da carteira' };
  for (const [lang, question] of Object.entries(questions)) {
    const result = answerQuestion(question, { ...ctx(), uiLanguage: lang, positions: [] });
    assert.equal(result.intent, 'portfolio-risk', lang);
    assert.equal(result.answer, t('qaPortfolioRiskEmpty', lang));
    const available = answerQuestion(question, { ...ctx(), uiLanguage: lang });
    assert.ok(!available.answer.includes('qaPortfolioRisk'));
    assert.ok(!/\{\d\}/.test(available.answer));
  }
});

test('missing, mismatched or estimated provider data produces no risk number', () => {
  for (const changes of [{ currency: null }, { symbol: 'another' }, { assetKind: 'stock' },
    { synthetic: true }, { verified: 'fallback' }, { priceSource: null }]) {
    const context = ctx(); Object.assign(context.marketRiskSources.bitcoin, changes);
    const result = answerQuestion('rischio del portafoglio', context);
    assert.equal(result.data.available, false);
    assert.equal(result.answer, t('qaPortfolioRiskMissing', 'it'));
    assert.equal(result.data.expectedShortfall, undefined);
  }
});

test('insufficient history is not promoted to a usable estimate', () => {
  const context = ctx(); context.marketRiskSources.bitcoin.prices = points.slice(-180);
  const result = portfolioProviderRisk(context.positions, context.marketRiskSources, { asOf });
  assert.equal(result.reason, 'insufficient-tail');
});

test('explicit repeated intent corrections use existing on-device learning', () => {
  const question = 'misura la fragilità delle mie posizioni';
  let qaLearning = learnCorrection(null, question, 'portfolioRisk');
  qaLearning = learnCorrection(qaLearning, question, 'portfolioRisk');
  const result = answerQuestion(question, { ...ctx(), qaLearning });
  assert.equal(result.intent, 'portfolio-risk');
  assert.equal(result.learned, true);
  assert.equal(result.data.available, true);
});

test('risk recognition leaves other portfolio and spending questions alone', () => {
  assert.equal(answerQuestion('quanto vale il mio patrimonio?', ctx()).intent, 'net-worth');
  assert.notEqual(answerQuestion('quanto posso spendere oggi?', ctx()).intent, 'portfolio-risk');
});
