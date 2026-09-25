// The bundled SEC panel is a dated filing snapshot, not a market quote.
// Keeping the search here lets both the search box and the company sheet use
// the same public, keyless evidence without inventing a current stock price.
import { SEC_CATALOG_INDEX } from './sec-catalog-index.js';

const normalize = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function secCompanyNameForTicker(ticker) {
  return SEC_CATALOG_INDEX.find(([symbol]) => symbol === String(ticker || '').toUpperCase())?.[1] || null;
}

export function searchSecCatalog(query, { limit = 8 } = {}) {
  const q = normalize(query);
  // One- and two-letter tickers exist. For short input, only exact ticker
  // matches are safe; company-name prefixes would be too noisy.
  if (!q) return [];
  return SEC_CATALOG_INDEX.map(([symbol, companyName]) => {
      const ticker = normalize(symbol), name = normalize(companyName);
      const score = ticker === q ? 4 : q.length < 3 ? 0 : name === q ? 3 : name.startsWith(q) ? 2 : name.includes(q) ? 1 : 0;
      return { symbol, companyName, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName))
    .slice(0, limit)
    .map(({ symbol, companyName, score }) => ({
      kind: 'stock', id: symbol, symbol, name: companyName,
      region: 'United States', _secMatch: true, _secScore: score,
    }));
}

export async function secCompanySnapshot(ticker) {
  const [{ AZIENDE_PANEL, SEC_PANEL_SCARICATO_IL }, { percentileTitolo }] = await Promise.all([
    import('./panel-settoriale.js'), import('./screener-settore.js'),
  ]);
  const company = AZIENDE_PANEL.find((row) => row.ticker === String(ticker || '').toUpperCase());
  if (!company) return null;
  const latest = [...(company.anni || [])].filter((row) => Number.isInteger(row.anno))
    .sort((a, b) => b.anno - a.anno)[0];
  if (!latest) return null;
  const previous = company.anni?.find((row) => row.anno === latest.anno - 1);
  const peer = percentileTitolo(company.ticker, { anno: latest.anno });
  return {
    ticker: company.ticker, name: company.nome, cik: company.cik, sector: company.sicDescription,
    year: latest.anno, snapshotAt: SEC_PANEL_SCARICATO_IL,
    revenue: Number.isFinite(latest.ricavi) ? latest.ricavi : null,
    revenueGrowth: Number.isFinite(latest.ricavi) && Number.isFinite(previous?.ricavi) && previous.ricavi > 0
      ? latest.ricavi / previous.ricavi - 1 : null,
    netIncome: Number.isFinite(latest.utileNetto) ? latest.utileNetto : null,
    margin: Number.isFinite(latest.margine) ? latest.margine : null,
    operatingCashFlow: Number.isFinite(latest.flussoCassaOperativo) ? latest.flussoCassaOperativo : null,
    roe: Number.isFinite(latest.roe) ? latest.roe : null,
    marginPercentile: peer.disponibile && Number.isFinite(peer.percentili?.margine) ? peer.percentili.margine : null,
  };
}
