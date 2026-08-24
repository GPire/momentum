// ============================================================
// STORICO CRIPTO — CoinGecko gratuito, ma con un limite reale trovato dal vivo
// ============================================================
// Verificato dal vivo (2026-08-24, non ipotizzato): il piano gratuito di
// CoinGecko oggi limita lo storico a 365 giorni — oltre quella finestra
// l'endpoint risponde con l'errore esplicito "Your request exceeds the
// allowed time range... Public API users are limited to querying
// historical data within the past 365 days" — e NON accetta più
// `interval=monthly` sul piano gratuito ("Invalid value for 'interval'").
// Nessuna delle due restrizioni è documentata nei moduli che già usano
// CoinGecko in questo progetto (live-price.js, asset-overview.js): sono
// arrivate dopo, o semplicemente non le avevano mai testate su questo
// endpoint specifico.
//
// LA CONSEGUENZA CHE CONTA: con soli 365 giorni, aggregare a mensile
// darebbe ~12 punti — sotto la soglia di 24 mesi che src/alpha/titolo-
// causale.js/confronto-titoli.js chiedono per un confronto onesto (24
// osservazioni, non 24 giorni). Qui si usa quindi la granularità
// GIORNALIERA diretta invece di far finta di avere mesi che non ci sono —
// e ogni testo che la usa (mercato-qa.js) dichiara "giorni", mai "mesi",
// anche se il calcolo statistico sottostante (scomponi(), la stessa
// funzione già scritta e testata per i titoli via settore) è identico.
'use strict';

// id CoinGecko -> risultato. In-memory, per sessione: evita di rifare la
// stessa richiesta di rete più volte nella stessa conversazione (le cripto
// principali cambiano lentamente rispetto alla durata di una chat).
const CACHE = new Map();

// Pura, testabile senza rete: prezzi consecutivi -> rendimenti giornalieri.
// Un prezzo mancante/non finito o <=0 (capita nei dati CoinGecko su coin
// giovani) interrompe la coppia invece di produrre un rendimento assurdo.
export function prezziARendimenti(prezzi = []) {
  const out = [];
  for (let i = 1; i < prezzi.length; i++) {
    const p0 = prezzi[i - 1], p1 = prezzi[i];
    if (Number.isFinite(p0) && Number.isFinite(p1) && p0 > 0) out.push(p1 / p0 - 1);
  }
  return out;
}

export async function fetchStoricoRendimentiCripto(id, { fetchImpl = fetch, giorni = 365 } = {}) {
  if (!id) throw new Error('Serve un id CoinGecko (es. "bitcoin").');
  const chiave = `${id}:${giorni}`;
  if (CACHE.has(chiave)) return CACHE.get(chiave);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${giorni}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`CoinGecko storico: HTTP ${res.status}`);
  const json = await res.json();
  const punti = Array.isArray(json?.prices) ? json.prices : [];
  if (punti.length < 2) throw new Error(`Nessuno storico disponibile per "${id}".`);
  const rendimenti = prezziARendimenti(punti.map((p) => p[1]));
  const risultato = {
    rendimenti, giorni: rendimenti.length, scaricatoIl: new Date().toISOString(),
    fonte: 'CoinGecko (pubblico, gratuito — storico limitato a 365 giorni sul piano free)',
  };
  CACHE.set(chiave, risultato);
  return risultato;
}

export function azzeraCacheStoricoCripto() { CACHE.clear(); } // per i test

// Nomi/ticker comuni -> id CoinGecko. Elenco DELIBERATAMENTE piccolo (le
// cripto per capitalizzazione più note, non un elenco esaustivo delle
// migliaia di id CoinGecko): un elenco enorme aumenterebbe il rischio di
// far scattare il riconoscimento su parole comuni che coincidono con un
// ticker breve — lo stesso bug reale già trovato due volte in questa
// sessione per i ticker azionari (screener-settore.js). Chi chiama
// applica comunque un confine di parola, mai una sottostringa.
export const CRIPTO_ID_COINGECKO = {
  bitcoin: 'bitcoin', btc: 'bitcoin',
  ethereum: 'ethereum', eth: 'ethereum', ether: 'ethereum',
  solana: 'solana',
  cardano: 'cardano',
  ripple: 'ripple', xrp: 'ripple',
  dogecoin: 'dogecoin',
  litecoin: 'litecoin',
  polkadot: 'polkadot',
  chainlink: 'chainlink',
  avalanche: 'avalanche-2',
  binancecoin: 'binancecoin',
  polygon: 'matic-network',
  tron: 'tron',
};

// Trova UN nome/ticker cripto nel testo, a confine di parola — stessa
// cautela di trovaAziendaInTesto (screener-settore.js): mai una sottostringa.
export function trovaCriptoInTesto(domanda) {
  const norm = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const qn = norm(domanda);
  for (const [chiave, id] of Object.entries(CRIPTO_ID_COINGECKO)) {
    if (new RegExp(`\\b${chiave}\\b`).test(qn)) return { chiave, id };
  }
  return null;
}
