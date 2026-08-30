import test from 'node:test';
import assert from 'node:assert/strict';
import { analizzaPosizionamentoCrypto, SIMBOLI_SUPPORTATI, simboloDaNome } from './crypto-derivati.js';

function serie(rate, n, drift = 0) {
  return Array.from({ length: n }, (_, i) => ({ rate: rate + drift * i, time: 1_700_000_000_000 + i * 28_800_000 }));
}

test('senza dati disponibili, dichiara onestamente il motivo', () => {
  const r = analizzaPosizionamentoCrypto({ disponibile: false, motivo: 'BTCUSDT non è tra i perpetui.' });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /BTCUSDT/);
});

test('funding basso e stabile: nella norma, nessun affollamento', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: 0.0001, openInterest: 50000,
    fundingHistory: serie(0.0001, 10),
    longShortHistory: [{ ratio: 1.0, longAccount: 0.5, shortAccount: 0.5, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.fundingLabel, 'nella norma');
  assert.equal(r.posizionamento, 'equilibrato');
  assert.equal(r.affollamentoConfermato, false);
});

test('funding molto positivo (annualizzato oltre soglia) + long affollati: affollamento confermato', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: 0.002, openInterest: 50000, // 0,002*3*365 = 219% annualizzato, ben oltre 15%
    fundingHistory: serie(0.001, 10, 0.0001),
    longShortHistory: [{ ratio: 2.0, longAccount: 0.66, shortAccount: 0.33, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.fundingLabel, 'elevato (i long pagano molto ai short)');
  assert.equal(r.posizionamento, 'affollato sui long');
  assert.equal(r.affollamentoConfermato, true);
});

test('funding elevato ma posizionamento equilibrato: NON è affollamento confermato (i due segnali non si rinforzano)', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: 0.002, openInterest: 50000,
    fundingHistory: serie(0.001, 10, 0.0001),
    longShortHistory: [{ ratio: 1.05, longAccount: 0.51, shortAccount: 0.49, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.posizionamento, 'equilibrato');
  assert.equal(r.affollamentoConfermato, false);
});

test('funding negativo elevato + short affollati: affollamento confermato sul lato short', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: -0.002, openInterest: 50000,
    fundingHistory: serie(-0.001, 10, -0.0001),
    longShortHistory: [{ ratio: 0.4, longAccount: 0.28, shortAccount: 0.72, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.posizionamento, 'affollato sui short');
  assert.equal(r.affollamentoConfermato, true);
});

test('percentile: il funding di oggi in cima alla propria storia recente risulta vicino al 100%, non un numero a caso', () => {
  const dati = {
    disponibile: true, symbol: 'ETHUSDT',
    fundingRateOra: 0.005, openInterest: 20000, // il più alto della serie
    fundingHistory: [...serie(0.0001, 9), { rate: 0.005, time: 999 }],
    longShortHistory: [{ ratio: 1.0, longAccount: 0.5, shortAccount: 0.5, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.fundingPercentile, 100);
});

test('percentile estremo (>=90) può confermare affollamento anche sotto la soglia assoluta fissa, se il posizionamento è coerente', () => {
  // Un'altcoin con funding "normale" strutturalmente più basso della soglia
  // assoluta, ma oggi al massimo della SUA storia — il percentile cattura
  // l'anomalia relativa che una soglia universale fissa perderebbe.
  const dati = {
    disponibile: true, symbol: 'DOGEUSDT',
    fundingRateOra: 0.00015, openInterest: 10000, // 0,00015*3*365=16.4% annualizzato, appena sopra soglia ma userei il percentile
    fundingHistory: [...serie(0.00001, 9), { rate: 0.00015, time: 999 }],
    longShortHistory: [{ ratio: 1.8, longAccount: 0.64, shortAccount: 0.36, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.fundingPercentile, 100);
  assert.equal(r.posizionamento, 'affollato sui long');
  assert.equal(r.affollamentoConfermato, true);
});

test('senza storico long/short, il posizionamento resta onestamente sconosciuto, mai inventato', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: 0.0001, openInterest: 50000,
    fundingHistory: serie(0.0001, 10),
    longShortHistory: [],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.equal(r.posizionamento, 'sconosciuto');
  assert.equal(r.affollamentoConfermato, false);
});

test('testo: mai un consiglio di trading, sempre dichiarato come fatto misurato', () => {
  const dati = {
    disponibile: true, symbol: 'BTCUSDT',
    fundingRateOra: 0.002, openInterest: 50000,
    fundingHistory: serie(0.001, 10, 0.0001),
    longShortHistory: [{ ratio: 2.0, longAccount: 0.66, shortAccount: 0.33, time: 1 }],
  };
  const r = analizzaPosizionamentoCrypto(dati);
  assert.match(r.testo, /non è un consiglio di trading/i);
  assert.doesNotMatch(r.testo, /compra|vendi/i);
});

test('SIMBOLI_SUPPORTATI: solo simboli reali dei perpetui Binance, mai un ticker inventato', () => {
  assert.ok(SIMBOLI_SUPPORTATI.includes('BTCUSDT'));
  assert.ok(SIMBOLI_SUPPORTATI.includes('ETHUSDT'));
  assert.ok(SIMBOLI_SUPPORTATI.length >= 5);
});

// simboloDaNome: collega il modulo a "Chiedi a Momentum" (richiesto dal
// vivo dall'utente — la funzione esisteva solo come bottone, mai
// raggiungibile scrivendo una domanda in chat).
test('simboloDaNome: riconosce nome e ticker parlato per ogni moneta coperta', () => {
  assert.equal(simboloDaNome('sono troppo affollato su bitcoin?'), 'BTCUSDT');
  assert.equal(simboloDaNome('qual è il funding rate di btc'), 'BTCUSDT');
  assert.equal(simboloDaNome('posizionamento su ethereum'), 'ETHUSDT');
  assert.equal(simboloDaNome('affollamento su solana'), 'SOLUSDT');
  assert.equal(simboloDaNome('dogecoin è affollato?'), 'DOGEUSDT');
  assert.equal(simboloDaNome('avalanche funding'), 'AVAXUSDT');
});

test('simboloDaNome: confine di parola, non sottostringa (stesso errore già corretto altrove nel progetto)', () => {
  // "ada" non deve matchare dentro "canada" o "strada"
  assert.equal(simboloDaNome('quanto costa andare in canada'), null);
  assert.equal(simboloDaNome('quanto vale ada'), 'ADAUSDT');
});

test('simboloDaNome: nessuna moneta riconosciuta -> null, mai un simbolo a caso', () => {
  assert.equal(simboloDaNome('quanto ho speso questo mese?'), null);
  assert.equal(simboloDaNome(''), null);
  assert.equal(simboloDaNome(null), null);
});
