// Annual SEC observations with filing provenance. No network or inferred dates.
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
const accession = x => typeof x === 'string' && /^\d{10}-\d{2}-\d{6}$/.test(x);
const order = (a, b) => a.end.localeCompare(b.end) || (a.start || '').localeCompare(b.start || '')
  || a.filed.localeCompare(b.filed) || a.concept.localeCompare(b.concept) || a.accn.localeCompare(b.accn);

export function annualSecFacts(json, concepts, { flow, unit = 'USD' } = {}) {
  if (!Array.isArray(concepts) || typeof flow !== 'boolean') return [];
  const records = [];
  for (const concept of new Set(concepts)) {
    const rows = json?.facts?.['us-gaap']?.[concept]?.units?.[unit];
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (!['10-K', '10-K/A'].includes(r?.form) || !Number.isFinite(r.val)
          || !date(r.end) || !date(r.filed) || r.filed < r.end || !accession(r.accn)) continue;
      if (flow) {
        if (!date(r.start)) continue;
        const days = (Date.parse(r.end) - Date.parse(r.start)) / 86400000;
        if (days < 340 || days > 400) continue;
      } else if (r.start != null) continue;
      records.push({ concept, unit, start: flow ? r.start : null, end: r.end,
        filed: r.filed, accn: r.accn, form: r.form, value: r.val, source: 'SEC EDGAR companyfacts' });
    }
  }
  return [...new Map(records.map(r => [JSON.stringify(r), r])).values()].sort(order);
}

// Input is one economic measure (its XBRL aliases), never unrelated concepts.
// End-of-day filing knowledge only: not an intraday availability guarantee.
export function secFactsAt(records, asOf, { conceptPriority = [] } = {}) {
  if (!date(asOf) || !Array.isArray(records)) return [];
  const selected = new Map();
  for (const r of [...records].filter(r => r && date(r.end) && date(r.filed)
      && r.end <= asOf && r.filed >= r.end && r.filed <= asOf && accession(r.accn)
      && typeof r.concept === 'string' && typeof r.unit === 'string'
      && (r.start === null || date(r.start)) && Number.isFinite(r.value)).sort(order)) {
    const key = `${r.unit}|${r.start || ''}|${r.end}`;
    const prev = selected.get(key);
    const rank = concept => {
      const index = conceptPriority.indexOf(concept);
      return index < 0 ? Infinity : index;
    };
    if (prev && rank(r.concept) > rank(prev.concept)) continue;
    if (!prev || rank(r.concept) < rank(prev.concept) || r.filed > prev.filed) selected.set(key, { ...r, conflict: false });
    else if (r.filed === prev.filed && r.value !== prev.value) {
      selected.set(key, { ...prev, value: null, conflict: true });
    }
  }
  return [...selected.values()].sort(order);
}

export function annualSecValues(records, asOf, { conceptPriority = [], periodEnds = null } = {}) {
  const years = new Map();
  for (const r of secFactsAt(records, asOf, { conceptPriority })) {
    if (periodEnds && !periodEnds.has(r.end)) continue;
    const year = Number(r.end.slice(0, 4));
    const previous = years.get(year);
    // Fiscal changes may create two annual periods in one calendar year.
    // A year-only consumer cannot distinguish them: retain a missing value.
    years.set(year, previous ? { ...previous, value: null, conflict: true } : r);
  }
  return [...years].sort(([a], [b]) => a - b)
    .map(([anno, r]) => ({ anno, valore: r.value, provenienza: r }));
}
