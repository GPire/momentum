// Stable instrument identity, separate from prices and investment opinions.
// Specific fund exposures come from issuer product pages; review when the
// product changes. Unknown funds get no guessed benchmark.
const FUND_FACTS = {
  SPY: ['S&P 500', 'https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy'],
  VOO: ['S&P 500', 'https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf'],
  IVV: ['S&P 500', 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf'],
  QQQ: ['Nasdaq-100', 'https://www.invesco.com/qqq-etf/en/home.html'],
  VTI: ['Morningstar US Total Market', 'https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf'],
  IBIT: ['Bitcoin', 'https://www.ishares.com/us/products/333011/ishares-Bitcoin-trust-etf'],
  XLF: ['Financial Select Sector Index', 'https://www.ssga.com/us/en/individual/etfs/state-street-financial-select-sector-spdr-etf-xlf'],
  XLK: ['Technology Select Sector Index', 'https://www.ssga.com/us/en/individual/etfs/state-street-technology-select-sector-spdr-etf-xlk'],
  XLV: ['Health Care Select Sector Index', 'https://www.ssga.com/us/en/individual/etfs/state-street-health-care-select-sector-spdr-etf-xlv'],
  GLD: ['prezzo dell’oro fisico, al netto dei costi', 'https://www.ssga.com/us/en/individual/etfs/spdr-gold-shares-gld'],
};

const OFFICIAL_COMPANY_FACTS = {
  ASML: {
    sourceUrl: 'https://www.asml.com/company/about-asml',
    summary: {
      it: 'ASML costruisce macchine di litografia che i produttori usano per realizzare i circuiti dei microchip.',
      en: 'ASML builds lithography machines that chipmakers use to produce circuits on microchips.',
      de: 'ASML baut Lithografiemaschinen, mit denen Chiphersteller Schaltkreise auf Mikrochips fertigen.',
      fr: 'ASML fabrique des machines de lithographie utilisées pour produire les circuits des puces électroniques.',
      es: 'ASML fabrica máquinas de litografía que permiten producir los circuitos de los microchips.',
      nl: 'ASML bouwt lithografiemachines waarmee chipmakers schakelingen op microchips produceren.',
      pt: 'A ASML fabrica máquinas de litografia usadas na produção dos circuitos de microchips.',
    },
  },
};

function shortPublicSummary(value) {
  const clean = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || /^nessuna descrizione|^no description/i.test(clean)) return null;
  if (clean.length <= 320) return clean;
  const cut = clean.slice(0, 320).lastIndexOf(' ');
  return `${clean.slice(0, cut > 230 ? cut : 320).trimEnd()}…`;
}

function plainSecActivity(value) {
  const label = String(value || '').toUpperCase();
  if (/SEMICONDUCTOR/.test(label)) return 'semiconductors';
  if (/PREPACKAGED SOFTWARE|COMPUTER PROGRAMMING|SOFTWARE/.test(label)) return 'software';
  if (/COMMERCIAL BANK|BANKING/.test(label)) return 'banking';
  if (/RETAIL/.test(label)) return 'retail';
  if (/ELECTRONIC COMPUTERS/.test(label)) return 'hardware';
  return null;
}

export function assetIdentityBrief(asset, { snapshot = null, overview = null, publicFact = null, lang = 'en' } = {}) {
  const symbol = String(asset?.symbol || '').toUpperCase();
  const name = String(asset?.name || symbol).trim();
  if (asset?.kind === 'crypto') return {
    kind: /\b(xstock|tokenized stock|bstocks)\b/i.test(name) ? 'tokenized-stock' : 'crypto',
    name, summary: shortPublicSummary(overview?.summary) || shortPublicSummary(publicFact?.summary),
    source: shortPublicSummary(overview?.summary) ? 'CoinGecko' : publicFact?.source || null,
    sourceUrl: shortPublicSummary(overview?.summary) && asset.id ? `https://www.coingecko.com/en/coins/${encodeURIComponent(asset.id)}` : publicFact?.sourceUrl || null,
    license: shortPublicSummary(overview?.summary) ? null : publicFact?.license || null,
  };
  if (asset?.instrumentType === 'etf') {
    const [focus, url] = FUND_FACTS[symbol] || [];
    return { kind: symbol === 'IBIT' ? 'bitcoin-etp' : symbol === 'GLD' ? 'gold-etp' : 'etf', name, focus: focus || null, sourceUrl: url || publicFact?.sourceUrl || null,
      summary: focus ? null : shortPublicSummary(publicFact?.summary), source: focus ? null : publicFact?.source || null,
      license: focus ? null : publicFact?.license || null };
  }
  const official = OFFICIAL_COMPANY_FACTS[symbol];
  const overviewSummary = shortPublicSummary(overview?.summary);
  const summary = official?.summary?.[lang] || official?.summary?.en || overviewSummary || shortPublicSummary(publicFact?.summary);
  return {
    kind: 'stock', name,
    summary,
    source: official ? 'ASML' : overviewSummary ? 'Alpha Vantage' : publicFact?.source || null,
    sourceUrl: official?.sourceUrl || (overviewSummary ? null : publicFact?.sourceUrl || null),
    license: official || overviewSummary ? null : publicFact?.license || null,
    sector: snapshot?.ticker === symbol && snapshot?.sector ? String(snapshot.sector).slice(0, 100) : null,
    activity: snapshot?.ticker === symbol ? plainSecActivity(snapshot?.sector) : null,
    sectorYear: snapshot?.ticker === symbol && Number.isInteger(snapshot?.year) ? snapshot.year : null,
  };
}
