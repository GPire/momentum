import test from 'node:test';
import assert from 'node:assert/strict';
import { publicWidgetOptions, validPublicWidgetSymbol } from './public-market-widget.js';

test('public widget accepts symbols but never executable input', () => {
  assert.equal(validPublicWidgetSymbol('AAPL'), true);
  assert.equal(validPublicWidgetSymbol('AMEX:SPY'), true);
  assert.equal(validPublicWidgetSymbol('AAPL";alert(1)'), false);
  assert.equal(publicWidgetOptions('AAPL";alert(1)'), null);
});

test('quote and news widgets remain provider displays with a bounded locale', () => {
  const quote = publicWidgetOptions('NASDAQ:AAPL', { language: 'it', dark: true });
  assert.equal(quote.symbol, 'NASDAQ:AAPL');
  assert.equal(quote.locale, 'it');
  assert.equal(quote.colorTheme, 'dark');
  const news = publicWidgetOptions('AMEX:SPY', { kind: 'news', language: 'zz', dark: false });
  assert.equal(news.feedMode, 'symbol');
  assert.equal(news.locale, 'en');
  assert.equal(news.colorTheme, 'light');
});

test('chart fallback is display-only and rejects malformed symbols', () => {
  const chart = publicWidgetOptions('NASDAQ:AAPL', { kind: 'chart', language: 'it' });
  assert.equal(chart.symbol, 'NASDAQ:AAPL');
  assert.equal(chart.interval, 'D');
  assert.equal(chart.theme, 'dark');
  assert.equal(chart.withdateranges, true);
  assert.equal(publicWidgetOptions('AAPL/<script>', { kind: 'chart' }), null);
});
