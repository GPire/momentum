// Classifica dei settori S&P 500 su dati REALI misurati (SPDR Select Sector
// ETF, bench/fetch-sector-history.mjs + bench/generate-measured-assumptions.mjs).
//
// COSA FA: ordina i settori per Sharpe ratio storico REALE (rendimento
// aggiustato per il rischio, non il rendimento nudo — altrimenti vince
// sempre il settore più volatile). Aggiunge il regime attuale di ognuno
// (risk-on/risk-off/neutral, calcolato sull'ultimo tratto della serie).
//
// COSA NON FA: non dice "compra il settore in testa alla classifica". Questo
// è un ranking storico misurato, non un segnale operativo — Momentum non è
// un consulente finanziario abilitato e non emette raccomandazioni di
// acquisto/vendita (vedi reasoning-fusion.js:investmentReadiness per lo
// stesso principio applicato alla liquidità personale).
//
// Onestà sui limiti: gli ETF settoriali sono nati fine 1998 (XLRE nel 2015)
// — mai "40 anni di storia per settore", perché quei fondi non esistevano
// prima. Ogni riga dichiara il periodo REALE coperto e la data di calcolo.
'use strict';

export function sectorRanking(measured) {
  const sectors = measured?.sectors;
  if (!sectors || typeof sectors !== 'object') return { rows: [], asOf: null, yearsCovered: null };
  const rows = Object.entries(sectors)
    .filter(([, s]) => s && s.buyHold)
    .map(([symbol, s]) => ({
      symbol,
      label: s.label,
      sharpe: s.buyHold.sharpe,
      mu: s.buyHold.mu,
      sigma: s.buyHold.sigma,
      maxDrawdown: s.buyHold.maxDrawdown,
      regime: s.regime?.regime || null,
      regimeExplanation: s.regime?.explanation || null,
      months: s.sampleMonths,
      fetchedAt: s.fetchedAt,
    }))
    .sort((a, b) => b.sharpe - a.sharpe);
  const yearsCovered = rows.length ? Math.round(Math.min(...rows.map(r => r.months)) / 12) : null;
  return { rows, asOf: measured?.generatedAt || null, yearsCovered };
}
