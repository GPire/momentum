// Provider-independent validation. Conflicting dates are quarantined rather
// than resolved by response order; prices are never filled or coerced to zero.
export function cleanPriceSeries(entries = []) {
  const values = new Map(), conflicts = new Set();
  for (const entry of entries) {
    const date = entry?.date;
    const price = typeof entry?.price === 'string' && entry.price.trim() ? Number(entry.price) : entry?.price;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(price) || price <= 0) continue;
    const stamp = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date) continue;
    if (values.has(date) && values.get(date) !== price) conflicts.add(date);
    values.set(date, price);
  }
  return [...values].filter(([date]) => !conflicts.has(date)).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, price }));
}

export function commonReturns(series, { levels = [] } = {}) {
  const maps = Object.fromEntries(Object.entries(series).map(([key, entries]) =>
    [key, new Map(cleanPriceSeries(entries).map(({ date, price }) => [date, price]))]));
  const first = Object.values(maps)[0];
  const dates = first ? [...first.keys()].filter(date => Object.values(maps).every(map => map.has(date))) : [];
  return {
    dates: dates.slice(1),
    series: Object.fromEntries(Object.entries(maps).map(([key, map]) => [key,
      dates.slice(1).map((date, index) => levels.includes(key) ? map.get(date) : map.get(date) / map.get(dates[index]) - 1),
    ])),
  };
}
