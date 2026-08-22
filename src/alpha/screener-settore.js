// ============================================================
// SCREENER DI SETTORE — cosa il pannello SEC su scala rende possibile
// ============================================================
// panel-settoriale.js (Cantiere D, PIANO_TASK_2026-08-21.md) è dati GENERATI
// a tempo di sviluppo (bench/fetch-panel-sec.mjs) — 600 aziende pubblicate
// per intero, percentili di settore calcolate su 1.500. Questo file è la
// logica scritta a mano che li rende UTILI: "in che percentile del suo
// settore sta questo titolo" (BANCO_INVESTITORE/BANCO_BANKER, Cantiere F) e
// "chi somiglia a questa azienda sui conti" (BANCO_BANKER).
//
// ONESTÀ SUI LIMITI: il pannello ha SOLO grandezze contabili (ricavi, utile,
// patrimonio, attivo — quindi margine/ROE/ROA). Non ha prezzo di mercato, e
// quindi non ha P/E, P/B, FCF yield: `factors.js.valueScore()` chiede anche
// quelli, e qui restano assenti (percentileRank li tratta come "neutro",
// mai come zero — è il comportamento già scritto in factors.js, non
// aggirato). Chi vuole un valueScore completo deve ancora unire un prezzo
// da un'altra fonte (asset-overview.js).
'use strict';

import { AZIENDE_PANEL, percentileSettore } from './panel-settoriale.js';

const gruppoSic = (sic) => (sic ? String(sic).padStart(4, '0').slice(0, 2) : null);

function aziendaPerTicker(ticker) {
  if (!ticker) return null;
  const t = String(ticker).toUpperCase();
  return AZIENDE_PANEL.find((a) => a.ticker === t) || null;
}

// Il percentile di UN titolo nel suo settore, sull'anno più recente
// disponibile (o quello richiesto). null onesto se il titolo non è fra le
// 600 pubblicate per intero, o se il gruppo-settore-anno non ha abbastanza
// aziende per un percentile (mai un numero inventato sotto soglia).
export function percentileTitolo(ticker, { anno = null } = {}) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const riga = anno ? az.anni.find((a) => a.anno === anno) : az.anni.at(-1);
  if (!riga) return { disponibile: false, motivo: `nessun dato per ${ticker} nell'anno richiesto.` };

  const percentili = {};
  for (const misura of ['margine', 'roe', 'roa']) {
    if (riga[misura] === null) continue;
    const p = percentileSettore(az.sic, riga.anno, misura, riga[misura]);
    if (p !== null) percentili[misura] = p;
  }
  return {
    disponibile: Object.keys(percentili).length > 0,
    ticker: az.ticker, nome: az.nome, sic: az.sic, settore: az.sicDescription, anno: riga.anno,
    valori: { margine: riga.margine, roe: riga.roe, roa: riga.roa },
    percentili,
    motivo: Object.keys(percentili).length === 0 ? `il settore di ${ticker} (${az.sicDescription}) non ha abbastanza aziende comparabili nel pannello per un percentile in ${riga.anno}.` : null,
  };
}

// Le aziende del pannello nello STESSO gruppo di settore (2 cifre del SIC),
// ordinate per vicinanza di ricavi (stessa taglia, prima ancora che stesso
// business — due aziende nello stesso settore ma di taglia molto diversa
// non sono comparabili quanto sembrano). Esclude il titolo stesso.
export function comparabili(ticker, { anno = null, limite = 8 } = {}) {
  const az = aziendaPerTicker(ticker);
  if (!az) return { disponibile: false, motivo: `"${ticker}" non è fra le aziende con settore noto in questo pannello.` };
  const gruppo = gruppoSic(az.sic);
  const rigaTicker = anno ? az.anni.find((a) => a.anno === anno) : az.anni.at(-1);
  const ricaviTicker = rigaTicker?.ricavi ?? 0;

  const candidati = AZIENDE_PANEL
    .filter((a) => a.ticker !== az.ticker && gruppoSic(a.sic) === gruppo)
    .map((a) => {
      const riga = anno ? a.anni.find((x) => x.anno === anno) : a.anni.at(-1);
      return riga ? { ticker: a.ticker, nome: a.nome, settore: a.sicDescription, anno: riga.anno, ricavi: riga.ricavi, margine: riga.margine, roe: riga.roe } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(Math.log((a.ricavi || 1) / (ricaviTicker || 1))) - Math.abs(Math.log((b.ricavi || 1) / (ricaviTicker || 1))))
    .slice(0, limite);

  return { disponibile: candidati.length > 0, ticker: az.ticker, settore: az.sicDescription, comparabili: candidati };
}

// Popola `peers` per factors.js.valueScore()/growthScore(): un array di
// valori REALI di aziende dello stesso settore-anno, non un intervallo
// inventato. Le chiavi che il pannello non può dare (pe, pb, fcfYield: qui
// non c'è prezzo di mercato) restano assenti — percentileRank le tratta già
// come "neutro" (0.5), mai come "cattivo" (0), quindi non falsano il punteggio.
export function peersDaPannello(sic, anno) {
  const gruppo = gruppoSic(sic);
  if (!gruppo) return {};
  const roe = [], margine = [];
  for (const a of AZIENDE_PANEL) {
    if (gruppoSic(a.sic) !== gruppo) continue;
    const riga = a.anni.find((x) => x.anno === anno);
    if (!riga) continue;
    if (riga.roe !== null) roe.push(riga.roe);
    if (riga.margine !== null) margine.push(riga.margine);
  }
  return { roe, margine };
}
