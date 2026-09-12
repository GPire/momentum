// Observation period and knowledge date are different clocks. No network.
const validDate = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;

export function macroVintageSnapshot(records, asOf) {
  if (!validDate(asOf) || !Array.isArray(records)) return [];
  const selected = new Map();
  for (const r of records) {
    if (!validDate(r?.date) || !validDate(r?.availableAt) || r.date > asOf || r.availableAt > asOf
        || !r.source || (r.validUntil && (!validDate(r.validUntil) || r.validUntil < asOf))) continue;
    const previous = selected.get(r.date);
    if (!previous || r.availableAt > previous.availableAt) selected.set(r.date, { ...r });
    else if (r.availableAt === previous.availableAt && r.close !== previous.close) selected.set(r.date, { ...previous, close: null });
  }
  return [...selected.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ ...r, close: Number.isFinite(r.close) ? r.close : null }));
}

// FRED realtime_start can be clipped to the requested realtime window.
// Treat it conservatively as known-at, never claim original release time.
export function parseFredVintages(json) {
  if (!Array.isArray(json?.observations)) return [];
  return json.observations.filter(r => validDate(r.date) && validDate(r.realtime_start)
    && validDate(r.realtime_end) && r.realtime_end >= r.realtime_start).map(r => ({
    date: r.date, availableAt: r.realtime_start, validUntil: r.realtime_end,
    close: typeof r.value === 'string' && r.value.trim() && r.value !== '.' && Number.isFinite(Number(r.value)) ? Number(r.value) : null,
    source: 'FRED/ALFRED',
  }));
}
