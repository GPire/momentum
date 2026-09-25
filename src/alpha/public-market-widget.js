// TradingView publishes this embeddable display for websites without an API
// key. Exchange licensing determines whether a venue is delayed or EOD.
// Its iframe is display-only: never read its contents into Momentum models,
// alerts, portfolio valuations or historical datasets.

const WIDGET_TYPES = new Set(['quote', 'news', 'chart']);

export function validPublicWidgetSymbol(symbol) {
  return typeof symbol === 'string' && /^[A-Za-z0-9._^:-]{1,24}$/.test(symbol);
}

export function publicWidgetOptions(symbol, { kind = 'quote', language = 'en', dark = true } = {}) {
  if (!validPublicWidgetSymbol(symbol) || !WIDGET_TYPES.has(kind)) return null;
  const locale = ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt'].includes(language) ? language : 'en';
  const shared = { symbol, colorTheme: dark ? 'dark' : 'light', isTransparent: true, locale, width: '100%' };
  if (kind === 'news') return { ...shared, feedMode: 'symbol', displayMode: 'adaptive', height: 360 };
  if (kind === 'chart') return { symbol, autosize: true, interval: 'D', timezone: 'Etc/UTC', theme: dark ? 'dark' : 'light', style: '1', locale, withdateranges: true, allow_symbol_change: true, calendar: false, support_host: 'https://www.tradingview.com' };
  return shared;
}

export function mountPublicMarketWidget(host, symbol, { kind = 'quote', language = 'en', dark = true, unavailable = '', sourceLink = 'Open source', previewLabel = 'Show preview', hidePreviewLabel = 'Hide preview' } = {}) {
  const options = publicWidgetOptions(symbol, { kind, language, dark });
  if (!host || !options) return false;
  // The vendor executes inside an opaque-origin sandbox, not in Momentum's
  // origin. It cannot inspect Vault, parent URL, storage or the parent DOM.
  const frame = document.createElement('iframe');
  const params = new URLSearchParams({ symbol: options.symbol, kind, lang: options.locale, theme: dark ? 'dark' : 'light' });
  frame.src = `/market-widget.html?${params}`;
  frame.title = kind === 'news' ? 'TradingView market news' : kind === 'chart' ? 'TradingView market chart' : 'TradingView market quote';
  frame.sandbox = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
  frame.referrerPolicy = 'no-referrer';
  frame.loading = 'lazy';
  frame.className = kind === 'chart' ? 'market-public-frame market-public-chart-frame' : 'market-public-frame';
  frame.addEventListener('error', () => { if (frame.isConnected) frame.replaceWith(document.createTextNode(unavailable)); });
  const link = document.createElement('a');
  link.href = `https://www.tradingview.com/symbols/${encodeURIComponent(options.symbol)}/`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer nofollow';
  link.className = 'market-public-credit';
  link.textContent = sourceLink;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'market-public-preview';
  button.textContent = previewLabel;
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    if (open) frame.remove();
    // Keep the reliable source link above the embed: if a browser blocks the
    // nested provider frame, the user can still open the chart immediately.
    else host.append(frame);
    button.setAttribute('aria-expanded', String(!open));
    button.textContent = open ? previewLabel : hidePreviewLabel;
  });
  host.replaceChildren(link, button);
  return true;
}
