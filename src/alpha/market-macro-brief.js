// A compact, source-checked macro brief for an asset detail. Official policy
// news is context, never evidence that it caused an asset's price movement.
const SOURCES = {
  fed: { label: 'Fed', host: 'federalreserve.gov' },
  bce: { label: 'BCE', host: 'ecb.europa.eu' },
};
const MARKET_TOPIC = /\b(rate|rates|interest|monetary|inflation|economic|economy|outlook|financial stability|fomc|policy|projections?|balance sheet|quantitative easing)\b/i;

export function selectOfficialMacroBrief(items, { now = Date.now(), maxAgeDays = 120 } = {}) {
  if (!Array.isArray(items)) return [];
  const selected = [];
  for (const source of Object.keys(SOURCES)) {
    const expected = SOURCES[source];
    const valid = items.flatMap((item) => {
      if (item?.fonte !== source || !item.link || !item.titolo || !MARKET_TOPIC.test(item.titolo)) return [];
      const when = Date.parse(item.data || '');
      if (!Number.isFinite(when) || when > now + 86_400_000 || when < now - maxAgeDays * 86_400_000) return [];
      let url;
      try { url = new URL(item.link); } catch (_) { return []; }
      if (url.protocol !== 'https:' || (url.hostname !== expected.host && !url.hostname.endsWith(`.${expected.host}`))) return [];
      return [{ title: String(item.titolo).slice(0, 200), date: item.data, url: url.href, source: expected.label, viaRelay: Boolean(item.viaRelay) }];
    }).sort((a, b) => b.date.localeCompare(a.date));
    if (valid[0]) selected.push(valid[0]);
  }
  return selected;
}
