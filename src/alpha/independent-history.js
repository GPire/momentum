// Optional market comparisons must never erase a successfully loaded price
// series. Each source is independent, and absent evidence stays absent.
export async function collectCryptoHistoryEvidence({ livePrice, yearAgo, history, multiYear }) {
  const settle = task => Promise.resolve().then(task).catch(() => null);
  const [live, past, historical, comparison] = await Promise.all([
    settle(livePrice), settle(yearAgo), settle(history), settle(multiYear),
  ]);
  return {
    live,
    past,
    series: Array.isArray(historical?.series) ? historical.series : [],
    source: historical?.source || null,
    currency: historical?.currency || null,
    pair: historical?.pair || null,
    multiYear: Array.isArray(comparison) ? comparison : [],
  };
}
