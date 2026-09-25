// Price history is a dated observation set, not an evenly spaced sequence.
// Missing intervals remain gaps in the chart; no price is interpolated.
const DAY_MS = 86_400_000;
const dated = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date ? stamp : NaN;
};

export function historyWithinYears(series, years) {
  if (!Array.isArray(series) || !series.length || !Number.isFinite(years)) return series || [];
  const end = new Date(`${series[series.length - 1].date}T00:00:00Z`);
  if (!Number.isFinite(end.getTime())) return [];
  end.setUTCFullYear(end.getUTCFullYear() - years);
  const cutoff = end.toISOString().slice(0, 10);
  return series.filter(point => point.date >= cutoff);
}

export function historyPlot(series, { width = 320, height = 150, pad = 7 } = {}) {
  if (!Array.isArray(series) || series.length < 2) return { points: [], path: '' };
  const times = series.map(point => dated(point.date));
  const prices = series.map(point => Number(point.price));
  if (times.some(time => !Number.isFinite(time)) || prices.some(price => !Number.isFinite(price) || price <= 0)) return { points: [], path: '' };
  const first = times[0], last = times[times.length - 1];
  if (last <= first) return { points: [], path: '' };
  const intervals = times.slice(1).map((time, index) => time - times[index]).filter(delta => delta > 0).sort((a, b) => a - b);
  const typical = intervals[Math.floor(intervals.length / 2)] || DAY_MS;
  // A missed monthly close must not be drawn as if it were observed.
  // Daily series still tolerate weekends and short exchange closures.
  // These providers deliver daily or monthly observations. A very sparse
  // response must not redefine a years-long hole as its "normal" cadence.
  const gapAfter = Math.min(62 * DAY_MS, Math.max(7 * DAY_MS, typical * 1.75));
  const minPrice = Math.min(...prices), span = Math.max(...prices) - minPrice || 1;
  const points = series.map((point, index) => ({
    ...point,
    x: pad + ((times[index] - first) / (last - first)) * (width - pad * 2),
    y: height - pad - ((prices[index] - minPrice) / span) * (height - pad * 2),
    gap: index > 0 && times[index] - times[index - 1] > gapAfter,
  }));
  const path = points.map((point, index) => `${index === 0 || point.gap ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  return { points, path };
}

export function nearestHistoryIndex(series, ratio) {
  if (!Array.isArray(series) || !series.length) return -1;
  const first = dated(series[0].date);
  const last = dated(series[series.length - 1].date);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return -1;
  const target = first + Math.max(0, Math.min(1, ratio)) * (last - first);
  let low = 0, high = series.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dated(series[mid].date) < target) low = mid + 1;
    else high = mid;
  }
  if (low === 0) return 0;
  const before = dated(series[low - 1].date);
  const after = dated(series[low].date);
  return target - before <= after - target ? low - 1 : low;
}

export function formatHistoryPrice(price, locale = 'it-IT') {
  if (!Number.isFinite(price)) return '—';
  const absolute = Math.abs(price);
  if (absolute === 0 || absolute >= 1) return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
  return new Intl.NumberFormat(locale, absolute < 1e-8
    ? { notation: 'scientific', maximumSignificantDigits: 4 }
    : { maximumSignificantDigits: 5 }).format(price);
}

export function historyCoverage(series, now = new Date()) {
  if (!Array.isArray(series) || !series.length) return null;
  const first = dated(series[0].date);
  const last = dated(series[series.length - 1].date);
  const current = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !Number.isFinite(current) || first > last) return null;
  const ageDays = Math.floor((current - last) / DAY_MS);
  const gaps = historyPlot(series).points.filter(point => point.gap).length;
  return { first: series[0].date, last: series[series.length - 1].date, ageDays, stale: ageDays > 65, gaps };
}
