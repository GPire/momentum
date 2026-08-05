// ============================================================
// ASSET TRACK RECORD — "questo storico è bravura o fortuna?"
// ============================================================
// Il problema di settore che questo file affronta: quando cerchi un asset in
// QUALSIASI app — Robinhood, Yahoo Finance, Bloomberg incluso — vedi il grafico
// e il rendimento storico, e la tentazione naturale è "ha reso +180% in 3 anni,
// è forte". Nessuno ti dice se quel numero è distinguibile dal rumore.
//
// Qui si prende la serie prezzi VERA già scaricata dall'app (Binance/CoinGecko
// per le cripto, Alpha Vantage/Twelve Data per azioni-ETF — mai una serie
// finta) e la si fa passare dagli stessi strumenti scientifici già costruiti:
// Sharpe deflazionato (strategy-validation.js) e i principi falsificabili di
// Munger/Simons (master-principles.js). Non un consiglio di acquisto — un
// giudizio sull'AFFIDABILITÀ del numero che l'utente sta già guardando.
//
// Funzioni pure, nessuna rete (la serie arriva dal chiamante).
'use strict';

import { deflatedSharpe } from './strategy-validation.js';
import { testInversione } from './master-principles.js';

// Converte una serie di prezzi [{date, price}] in rendimenti periodici
// semplici. Nessun prezzo <= 0 viene diviso (produrrebbe un rendimento
// infinito o inventato): si salta quel punto e si conta quanti sono stati
// scartati, così un problema nei dati si vede invece di sparire.
export function returnsFromSeries(series) {
  const tutti = series || [];
  const pts = tutti.filter((p) => Number.isFinite(p?.price) && p.price > 0);
  // BUG REALE trovato dal test: il filtro toglieva i prezzi non validi PRIMA
  // del ciclo, quindi il conteggio dentro al ciclo (`if prev<=0`) era codice
  // morto — non scattava mai, perché un prezzo <=0 non poteva più capitare
  // lì dentro. Il conteggio va fatto sulla differenza di lunghezza, non
  // dentro un ciclo che non vede più i punti scartati.
  const scartati = tutti.length - pts.length;
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push(pts[i].price / pts[i - 1].price - 1);
  return { returns: out, scartati, n: out.length };
}

// Il referto: quanti periodi, quanti tentativi dichiarare (se l'utente ha
// cercato tra molti asset nella stessa sessione, il numero va scontato — ma
// qui di default è 1: un singolo asset cercato non è "il migliore di N",
// a meno che il chiamante non dichiari altrimenti).
export function assessTrackRecord(series, { tentativi = 1, label = '' } = {}) {
  const { returns, scartati, n } = returnsFromSeries(series);
  if (n < 8) {
    return {
      disponibile: false,
      motivo: `Servono almeno 8 periodi di storico per dire qualcosa: qui ce ne sono ${n}.`,
    };
  }

  const ds = deflatedSharpe(returns, { trials: tentativi });
  const inv = testInversione(returns, { quanti: Math.max(1, Math.round(n * 0.05)) });

  const messaggi = {
    solido: `Su questo storico, ${label || 'l\'andamento'} regge anche tenendo conto del caso: non è solo fortuna.`,
    incerto: `Su questo storico non si può dire con sicurezza se sia bravura o fortuna.`,
    'probabile-fortuna': `Su questo storico, un risultato così si vede spesso anche senza alcun vantaggio reale: da solo non basta a fidarsi.`,
    'dati-insufficienti': `Troppo pochi dati per giudicare.`,
    'non-calcolabile': `La forma di questi dati non permette una stima affidabile.`,
  };

  return {
    disponibile: true,
    periodi: n,
    scartati,
    sharpe: ds.sharpe,
    sogliaFortuna: ds.soglia,
    probabilita: ds.probabilita,
    verdetto: ds.verdetto,
    messaggio: messaggi[ds.verdetto] || ds.spiegazione,
    // Munger applicato al singolo asset: quanto pesano i pochi periodi
    // peggiori sul risultato totale — utile a capire se il rendimento
    // mostrato dipende da un crollo evitato per un soffio o da un solo mese
    // eccezionale, informazione che nessun grafico da solo dà.
    concentrazione: inv ? {
      evitandoIPeggiori: inv.evitandoIPeggiori,
      mancandoIMigliori: inv.mancandoIMigliori,
      messaggio: inv.evitandoIPeggiori > inv.mancandoIMigliori
        ? `Il risultato dipende più dall'aver evitato i tratti peggiori che dall'aver preso quelli migliori: pochi periodi molto negativi contano più di tutto il resto.`
        : `Il risultato dipende soprattutto da pochi periodi eccezionali: senza quelli lo storico sarebbe molto più modesto.`,
    } : null,
  };
}
