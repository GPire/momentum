// Optional public context for an instrument already identified by search.
// Wikidata descriptions are CC0. Wikipedia extracts are CC BY-SA and retain
// attribution. Neither source becomes a price, holding or training label.
// A name-only hit is insufficient: Apple the fruit is not AAPL.
import { conTimeout } from '../core/con-timeout.js';

const cache = new Map();
const COMPANY_WORDS = /company|corporation|manufacturer|bank|financial|firm|software|semiconductor|retailer|automaker|enterprise|conglomerate|airline|business|azienda|societ[aà]|produtt|banca|impresa|gruppo|multinazionale|unternehmen|hersteller|konzern|entreprise|soci[eé]t[eé]|fabricant|banque|empresa|compa[ñn][ií]a|fabricante|bedrijf|onderneming|fabrikant/i;
const FUND_WORDS = /\betf\b|exchange.traded|\bfund\b|\bfonds\b|\bfondo\b|\bfundo\b|\btrust\b|\bETP\b/i;
const CRYPTO_WORDS = /cryptocurrency|cryptoasset|blockchain|digital currency|digital asset|crypto token|tokenized stock|stablecoin|cryptomonnaie|criptomoneda|criptovaluta|criptomoeda|kryptow[aä]hrung/i;
// Search results also contain forums, websites and articles *about* a coin.
// A mention of "blockchain" in their descriptions does not identify them as
// the instrument the user searched for (e.g. Ethereum Stack Exchange).
const CRYPTO_SIDEPAGES = /\b(?:site|website|web service|forum|community|magazine|book|podcast|article|wiki|fanclub|fan club)\b/i;

function normalizedName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(incorporated|inc|corporation|corp|limited|ltd|plc|holdings?|group|company|co|nv|ag|sa|spa|se|llc)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function selectPublicDescription(asset, rows) {
  if (!asset || !['stock', 'crypto'].includes(asset.kind) || !Array.isArray(rows)) return null;
  const target = normalizedName(asset.name);
  if (target.length < 3) return null;
  const kindWords = asset.kind === 'crypto' ? CRYPTO_WORDS : asset.instrumentType === 'etf' ? FUND_WORDS : COMPANY_WORDS;
  for (const row of rows) {
    if (!/^Q\d+$/.test(String(row?.id || ''))) continue;
    const name = normalizedName(row.label);
    if (name !== target) continue;
    const summary = String(row.description || '').trim().slice(0, 240);
    if (!summary || !kindWords.test(summary)) continue;
    if (asset.kind === 'crypto' && (CRYPTO_SIDEPAGES.test(summary) || !kindWords.test(summary.slice(0, 100)))) continue;
    return { id: row.id, summary, source: 'Wikidata', sourceUrl: `https://www.wikidata.org/wiki/${row.id}` };
  }
  return null;
}

function tickerValues(entity) {
  const statements = [...(entity?.claims?.P249 || []), ...(entity?.claims?.P414 || []).flatMap(row => row?.qualifiers?.P249 || [])];
  return statements.map(row => row?.mainsnak?.datavalue?.value || row?.datavalue?.value)
    .filter(value => typeof value === 'string').map(value => value.toUpperCase());
}

// A shortened search name (e.g. JPMorgan → JPMorgan Chase) needs more than a
// similar label. P249 is exchange-specific, so only an exact ticker claim can
// admit the longer name; a missing claim is an abstention, not a guessed match.
export function selectTickerDescription(asset, rows, entities) {
  if (asset?.kind !== 'stock' || !Array.isArray(rows) || !entities) return null;
  const target = normalizedName(asset.name);
  const symbol = String(asset.symbol || '').toUpperCase();
  if (target.length < 5 || !/^[A-Z0-9.]{1,16}$/.test(symbol)) return null;
  const kindWords = asset.instrumentType === 'etf' ? FUND_WORDS : COMPANY_WORDS;
  for (const row of rows) {
    const name = normalizedName(row?.label);
    if (!name.startsWith(`${target} `) || !kindWords.test(String(row.description || ''))) continue;
    if (!tickerValues(entities[row.id]).includes(symbol)) continue;
    return { id: row.id, summary: String(row.description).trim().slice(0, 240), source: 'Wikidata', sourceUrl: `https://www.wikidata.org/wiki/${row.id}` };
  }
  return null;
}

function conciseExtract(value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 30 || /may refer to|può riferirsi a|disambiguation/i.test(clean.slice(0, 90))) return null;
  // Only the identity sentence: later encyclopedia prose may contain an old
  // market-cap figure or a ranking that must not appear as current research.
  const sentenceEnd = [...clean.matchAll(/[.!?](?=\s+[A-ZÀ-Ý]|$)/g)].find(match => match.index >= 45)?.index;
  if (Number.isInteger(sentenceEnd) && sentenceEnd < 320) return clean.slice(0, sentenceEnd + 1);
  if (clean.length <= 320) return clean;
  const end = clean.slice(0, 320).lastIndexOf(' ');
  return `${clean.slice(0, end > 230 ? end : 320).trimEnd()}…`;
}

async function wikipediaExtract(id, language, fetchImpl, knownEntity = null) {
  let links = knownEntity?.sitelinks;
  if (!links) {
    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    for (const [name, value] of Object.entries({ action: 'wbgetentities', ids: id, props: 'sitelinks', format: 'json', origin: '*' })) entityUrl.searchParams.set(name, value);
    const entityResponse = await conTimeout(fetchImpl(entityUrl.toString()), 4_000, 'Wikidata unavailable');
    if (!entityResponse.ok) return null;
    links = (await entityResponse.json())?.entities?.[id]?.sitelinks || {};
  }
  const articleLanguage = links[`${language}wiki`] ? language : links.enwiki ? 'en' : null;
  if (!articleLanguage) return null;
  const title = links[`${articleLanguage}wiki`]?.title;
  if (!title || title.length > 180) return null;
  const articleUrl = new URL(`https://${articleLanguage}.wikipedia.org/w/api.php`);
  for (const [name, value] of Object.entries({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exchars: '650', titles: title, redirects: '1', format: 'json', origin: '*' })) articleUrl.searchParams.set(name, value);
  const articleResponse = await conTimeout(fetchImpl(articleUrl.toString()), 4_000, 'Wikipedia unavailable');
  if (!articleResponse.ok) return null;
  const pages = Object.values((await articleResponse.json())?.query?.pages || {});
  const summary = conciseExtract(pages[0]?.extract);
  if (!summary) return null;
  return { summary, source: 'Wikipedia', sourceUrl: `https://${articleLanguage}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, language: articleLanguage, license: 'CC BY-SA 4.0' };
}

export async function fetchPublicDescription(asset, { lang = 'en', fetchImpl = fetch } = {}) {
  if (!['stock', 'crypto'].includes(asset?.kind) || !asset.name) return null;
  const locale = /^(it|en|de|fr|es|nl|pt)$/.test(lang) ? lang : 'en';
  const key = `${asset.instrumentType || 'stock'}:${asset.name}:${locale}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  for (const language of locale === 'en' ? ['en'] : [locale, 'en']) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    for (const [name, value] of Object.entries({ action: 'wbsearchentities', search: asset.name.slice(0, 90), language, uselang: language, limit: '8', format: 'json', origin: '*' })) url.searchParams.set(name, value);
    try {
      const response = await conTimeout(fetchImpl(url.toString()), 4_000, 'Wikidata unavailable');
      if (!response.ok) break;
      const rows = (await response.json())?.search;
      let result = selectPublicDescription(asset, rows);
      let knownEntity = null;
      if (!result && asset.kind === 'stock') {
        const target = normalizedName(asset.name);
        const candidates = (Array.isArray(rows) ? rows : []).filter(row => /^Q\d+$/.test(String(row?.id || ''))
          && normalizedName(row.label).startsWith(`${target} `)).slice(0, 3);
        if (target.length >= 5 && candidates.length) {
          const claimsUrl = new URL('https://www.wikidata.org/w/api.php');
          for (const [name, value] of Object.entries({ action: 'wbgetentities', ids: candidates.map(row => row.id).join('|'), props: 'claims|sitelinks', format: 'json', origin: '*' })) claimsUrl.searchParams.set(name, value);
          const claimsResponse = await conTimeout(fetchImpl(claimsUrl.toString()), 4_000, 'Wikidata unavailable');
          if (claimsResponse.ok) {
            const entities = (await claimsResponse.json())?.entities || {};
            result = selectTickerDescription(asset, candidates, entities);
            knownEntity = result ? entities[result.id] : null;
          }
        }
      }
      if (result) {
        let expanded = null;
        try { expanded = await wikipediaExtract(result.id, language, fetchImpl, knownEntity); } catch (_) { /* CC0 short description remains usable. */ }
        const value = { ...result, ...expanded, language: expanded?.language || language };
        cache.set(key, { value, expires: Date.now() + 7 * 86400_000 });
        return value;
      }
    } catch (_) { break; }
  }
  cache.set(key, { value: null, expires: Date.now() + 15 * 60_000 });
  return null;
}
