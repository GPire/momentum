// ============================================================
// POSIZIONAMENTO CRYPTO — funding rate, open interest, long/short (2026-08-30)
// ============================================================
// Ricerca 2026: funding rate/open interest sono tra gli strumenti più
// cercati dai trader crypto (CryptoQuant/CoinGlass li vendono come
// terminale dedicato) — e sono anche l'AREA dove Bloomberg è debole sui
// derivati crypto, non un terreno dove inseguirlo, uno dove differenziarsi.
// Fonte: Binance Futures API (fapi.binance.com), CORS-aperto verificato dal
// vivo (access-control-allow-origin: *, nessuna chiave), stesso principio
// già usato per CoinGecko in crypto-storico.js.
//
// Non ci si ferma al solo funding rate: un terzo segnale, il rapporto
// long/short (globalLongShortAccountRatio — quanti account sono long vs
// short sui perpetui), aggiunge una dimensione che il solo funding rate non
// dà — un funding alto con long/short quasi paritario e diverso da un
// funding alto CON posizionamento fortemente sbilanciato: il secondo è
// affollamento vero, il primo può essere solo un costo di finanziamento
// alto per pochi. Combinarli è la parte "più avanzata" richiesta.
//
// ONESTÀ (regola #1 del progetto): un funding rate elevato o un
// posizionamento affollato NON è un segnale di trading, mai un consiglio
// "compra/vendi" — sono fatti misurati sul mercato dei derivati, storicamente
// correlati a maggiore volatilità/correzioni, ma correlazione non è certezza.
// Soglie dichiarate come euristiche di settore (non una legge fisica): un
// funding annualizzato oltre ~15-20% è considerato "elevato" nel gergo dei
// trader di perpetui (il funding "base" tipico è vicino a 0,01%/8h ≈ 10,95%
// annualizzato solo per il meccanismo, quindi la soglia è sopra quel livello
// naturale, non sopra zero).
'use strict';

const BASE = 'https://fapi.binance.com/fapi/v1';
const DATA_BASE = 'https://fapi.binance.com/futures/data';

// Simboli Binance Futures reali per le principali cripto — stesso principio
// di crypto-storico.js: solo simboli VERI, mai un ticker inventato per una
// moneta che Binance non quota sui perpetui USDT-margined.
export const SIMBOLI_SUPPORTATI = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Binance Futures: HTTP ${res.status} su ${url}`);
  return res.json();
}

// Scarica i 3 ingredienti in parallelo — mai una cascata sequenziale che
// triplica il tempo di attesa senza motivo, sono 3 endpoint indipendenti.
export async function fetchPosizionamentoCrypto(symbol, { fetchImpl = fetch, storicoLimite = 30 } = {}) {
  if (!SIMBOLI_SUPPORTATI.includes(symbol)) {
    return { disponibile: false, motivo: `${symbol} non è tra i perpetui Binance coperti da questo modulo.` };
  }
  const [premium, openInterest, fundingHistory, longShortHistory] = await Promise.all([
    getJson(`${BASE}/premiumIndex?symbol=${symbol}`, fetchImpl),
    getJson(`${BASE}/openInterest?symbol=${symbol}`, fetchImpl),
    getJson(`${BASE}/fundingRate?symbol=${symbol}&limit=${storicoLimite}`, fetchImpl),
    // "period" accetta solo un enum fisso di Binance (5m/15m/30m/1h/2h/4h/
    // 6h/12h/1d) — 8h (usato per il funding, che HA una cadenza fissa a 8h)
    // NON è un valore valido qui, endpoint diverso, granularità diversa.
    // Trovato dal vivo in un browser reale (HTTP 400, "period is invalid"),
    // non assunto dalla documentazione.
    getJson(`${DATA_BASE}/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=${storicoLimite}`, fetchImpl),
  ]);
  return {
    disponibile: true, symbol,
    fundingRateOra: +premium.lastFundingRate,
    markPrice: +premium.markPrice,
    prossimoFunding: premium.nextFundingTime,
    openInterest: +openInterest.openInterest,
    fundingHistory: fundingHistory.map((f) => ({ rate: +f.fundingRate, time: f.fundingTime })),
    longShortHistory: longShortHistory.map((l) => ({ ratio: +l.longShortRatio, longAccount: +l.longAccount, shortAccount: +l.shortAccount, time: l.timestamp })),
  };
}

// ── Analisi pura: dai dati grezzi al posizionamento, mai una rete qui dentro ──
const FUNDING_ANNUALIZZATO_ELEVATO = 0.15; // 15% annualizzato — soglia euristica di settore, non zero
const SKEW_AFFOLLATO = 1.5; // long/short ratio oltre 1,5 (o sotto 0,67) = posizionamento sbilanciato

export function analizzaPosizionamentoCrypto(dati) {
  if (!dati?.disponibile) return { disponibile: false, motivo: dati?.motivo || 'Dati non disponibili.' };
  const { symbol, fundingRateOra, openInterest, fundingHistory, longShortHistory } = dati;

  // Il funding si paga ogni 8h (3 volte al giorno su Binance): annualizzare
  // per confrontarlo con una soglia leggibile invece di un numero come
  // "0,0083%" che nessuno riesce a giudicare a colpo d'occhio.
  const fundingAnnualizzato = +(fundingRateOra * 3 * 365 * 100).toFixed(1);
  const fundingLabel = Math.abs(fundingAnnualizzato) < FUNDING_ANNUALIZZATO_ELEVATO * 100
    ? 'nella norma'
    : fundingAnnualizzato > 0 ? 'elevato (i long pagano molto ai short)' : 'elevato negativo (gli short pagano molto ai long)';

  // Percentile contro la PROPRIA storia recente, non solo una soglia fissa
  // universale — un'altcoin ha spesso un funding "normale" strutturalmente
  // più alto di BTC: una soglia unica per tutti classificherebbe male chi
  // parte da una base diversa. Stesso principio già in uso nel progetto per
  // i titoli azionari (screener-settore.js: percentile contro il settore,
  // mai un numero assoluto isolato).
  let fundingPercentile = null;
  if (fundingHistory.length >= 8) {
    const rates = fundingHistory.map((f) => f.rate).sort((a, b) => a - b);
    const sotto = rates.filter((r) => r <= fundingRateOra).length;
    fundingPercentile = Math.round((sotto / rates.length) * 100);
  }

  // Trend del funding: media prima metà vs seconda metà dello storico —
  // stesso principio "confronto onesto tra due finestre" già usato altrove
  // nel progetto (es. anticipatePriceHikes in subscriptions.js).
  let fundingTrend = 'stabile';
  if (fundingHistory.length >= 6) {
    const meta = Math.floor(fundingHistory.length / 2);
    const primaMedia = fundingHistory.slice(0, meta).reduce((s, f) => s + f.rate, 0) / meta;
    const secondaMedia = fundingHistory.slice(meta).reduce((s, f) => s + f.rate, 0) / (fundingHistory.length - meta);
    if (secondaMedia > primaMedia * 1.3 && secondaMedia > 0) fundingTrend = 'in salita';
    else if (secondaMedia < primaMedia * 0.7 || (primaMedia > 0 && secondaMedia < 0)) fundingTrend = 'in discesa';
  }

  const ultimoLongShort = longShortHistory[longShortHistory.length - 1] || null;
  const skew = ultimoLongShort ? ultimoLongShort.ratio : null;
  const posizionamento = skew === null ? 'sconosciuto'
    : skew >= SKEW_AFFOLLATO ? 'affollato sui long'
      : skew <= 1 / SKEW_AFFOLLATO ? 'affollato sui short'
        : 'equilibrato';

  // L'AVANZAMENTO reale: combinare TRE segnali, non solo giustapporli.
  // Funding elevato (assoluto O percentile estremo contro la propria
  // storia) + posizionamento affollato nella STESSA direzione è
  // affollamento vero (molti scommettono nello stesso senso E pagano per
  // farlo) — diverso da un funding alto isolato, che può riflettere il
  // costo per pochi speculatori mentre il grosso del mercato resta neutro.
  const fundingEstremoLong = fundingAnnualizzato > FUNDING_ANNUALIZZATO_ELEVATO * 100 || (fundingPercentile !== null && fundingPercentile >= 90);
  const fundingEstremoShort = fundingAnnualizzato < -FUNDING_ANNUALIZZATO_ELEVATO * 100 || (fundingPercentile !== null && fundingPercentile <= 10);
  const coerente = (fundingEstremoLong && posizionamento === 'affollato sui long')
    || (fundingEstremoShort && posizionamento === 'affollato sui short');

  return {
    disponibile: true, symbol,
    fundingRateOra, fundingAnnualizzato, fundingLabel, fundingTrend, fundingPercentile,
    openInterest, posizionamento, skew,
    affollamentoConfermato: coerente,
    testo: costruisciTesto({ symbol, fundingAnnualizzato, fundingLabel, fundingTrend, fundingPercentile, posizionamento, coerente, openInterest }),
  };
}

function costruisciTesto({ symbol, fundingAnnualizzato, fundingLabel, fundingTrend, fundingPercentile, posizionamento, coerente, openInterest }) {
  const righe = [];
  // Il percentile si menziona SOLO quando RINFORZA un'etichetta già
  // "elevata" in termini assoluti — mai da solo, mai contro fundingLabel.
  // Trovato dal vivo in Chrome: BTC con funding stabile e basso finiva
  // "nella norma — più alto del 100% degli ultimi valori", tecnicamente
  // vero (100° percentile di un insieme di valori tutti simili) ma
  // suona contraddittorio a chiunque legga le due cose una accanto
  // all'altra. Il percentile resta comunque nel calcolo di
  // affollamentoConfermato sotto (dove serve davvero: un'altcoin con
  // funding "normale" strutturalmente più alto della soglia fissa) — qui
  // è solo il TESTO a essere più prudente, mai il numero.
  const fundingGiaElevato = fundingLabel !== 'nella norma';
  const percentileEstremo = fundingPercentile !== null && (fundingPercentile >= 90 || fundingPercentile <= 10);
  const percText = fundingGiaElevato && percentileEstremo ? ` — più alto del ${fundingPercentile}% degli ultimi valori dello stesso ${symbol}` : '';
  righe.push(`Funding rate ${symbol}: ${fundingAnnualizzato >= 0 ? '+' : ''}${fundingAnnualizzato}% annualizzato (${fundingLabel}${percText}), trend ${fundingTrend}.`);
  righe.push(`Posizionamento sui perpetui: ${posizionamento}.`);
  if (coerente) {
    righe.push('Funding elevato E posizionamento sbilanciato nella stessa direzione: affollamento reale, storicamente associato a maggiore probabilità di correzione — mai una certezza, un fatto misurato sul mercato dei derivati.');
  } else {
    righe.push('Nessun affollamento chiaro: i due segnali non si rinforzano a vicenda.');
  }
  righe.push(`Open interest attuale: ${openInterest.toLocaleString('it-IT')} contratti.`);
  righe.push('Questo NON è un consiglio di trading — è un fatto misurato sul mercato dei derivati, non una previsione di prezzo.');
  return righe.join(' ');
}
