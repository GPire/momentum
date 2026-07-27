// Riassunto REALE di un'azienda/cripto — cosa fa, settore, dimensione — in
// linguaggio semplice, comprensibile anche a un bambino di 8 anni. Cripto:
// CoinGecko /coins/{id} (nessuna chiave). Azioni/ETF: Alpha Vantage OVERVIEW
// (chiave personale, stesso host già verificato CORS-aperto). Mai un
// riassunto inventato: se la fonte non risponde, si dichiara e basta. "Cosa
// c'è di nuovo" NON è un giudizio di "innovazione" inventato — sono le
// notizie reali più recenti già mostrate altrove (src/alpha/news.js),
// qui si limita a descrivere l'azienda/asset in sé.
'use strict';

function stripHtml(s = '') {
  return String(s).replace(/<[^>]*>/g, '').trim();
}

export async function fetchCryptoOverview(id, { fetchImpl = fetch } = {}) {
  if (!id) throw new Error('Serve un id cripto.');
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`CoinGecko overview: HTTP ${res.status}`);
  const json = await res.json();
  const desc = stripHtml(json?.description?.en || '');
  return {
    kind: 'crypto',
    name: json?.name || id,
    summary: desc ? (desc.split(/\.\s/).slice(0, 2).join('. ') + '.') : 'Nessuna descrizione disponibile per questa cripto.',
    category: (json?.categories || []).filter(Boolean).slice(0, 3).join(', ') || null,
    marketCapRank: json?.market_cap_rank ?? null,
    homepage: json?.links?.homepage?.[0] || null,
  };
}

export async function fetchStockOverview(symbol, { apiKey, fetchImpl = fetch } = {}) {
  if (!symbol) throw new Error('Serve un ticker.');
  if (!apiKey) throw new Error('Serve la tua chiave Alpha Vantage personale (Momentum Vault → Prezzi live).');
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Alpha Vantage overview: HTTP ${res.status}`);
  const json = await res.json();
  if (json?.Note || json?.Information || !json?.Name) {
    throw new Error('Limite richieste Alpha Vantage raggiunto, chiave non valida, o azienda non coperta.');
  }
  return {
    kind: 'stock',
    name: json.Name,
    summary: json.Description || 'Nessuna descrizione disponibile per questa azienda.',
    sector: json.Sector || null,
    industry: json.Industry || null,
    marketCap: Number.isFinite(+json.MarketCapitalization) ? +json.MarketCapitalization : null,
    peRatio: Number.isFinite(+json.PERatio) ? +json.PERatio : null,
  };
}

export async function fetchAssetOverview(asset, { apiKey, fetchImpl = fetch } = {}) {
  return asset.kind === 'crypto'
    ? fetchCryptoOverview(asset.id, { fetchImpl })
    : fetchStockOverview(asset.symbol, { apiKey, fetchImpl });
}
