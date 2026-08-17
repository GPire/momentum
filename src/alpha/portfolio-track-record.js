// ============================================================
// IL TUO PORTAFOGLIO REGGE, O È STATO FORTUNATO? — track record REALE
// ============================================================
// Ricerca di mercato (2026-08-17): Bloomberg, Yahoo Finance, ogni app
// retail — nessuna dice mai se un rendimento storico è distinguibile dal
// caso. asset-track-record.js risponde a questa domanda per UN singolo
// titolo cercato ("Nvidia ha reso +180% in 3 anni: bravura o fortuna?").
// Qui la STESSA domanda si pone al portafoglio INTERO dell'utente, con i
// SUOI pesi reali: se avesse tenuto questa allocazione per i 331 mesi reali
// del pannello storico (portfolio-tail-risk.js — dot-com, 2008, COVID,
// 2022), il suo rendimento aggiustato per il rischio sarebbe distinguibile
// dal rumore o è il tipo di risultato che si vede spesso anche senza alcun
// vantaggio reale?
//
// È il vaglio che un desk di risk management applica a un trader (Sharpe
// deflazionato, Bailey & López de Prado), applicato qui a una persona sulla
// propria allocazione — nessuna app consumer lo fa gratis, ed è esattamente
// il "verificalo altrove prima di fidarti" che il 53% degli investitori
// retail chiede a qualsiasi giudizio automatico.
//
// Riusa DUE motori già scritti e testati, nessun terzo motore duplicato:
//  - mappaPortafoglio (portfolio-tail-risk.js): stessi pesi, stessa
//    dichiarazione onesta di copertura, stesso rifiuto sotto il 50%.
//  - assessTrackRecord (asset-track-record.js): stesso Sharpe deflazionato,
//    stesso linguaggio senza gergo, stessa analisi di concentrazione
//    (il risultato dipende da pochi mesi eccezionali o da aver evitato i
//    peggiori?).
//
// NON è un consiglio: non dice mai se vendere o comprare, solo se il
// risultato misurato regge al controllo statistico. Funzioni pure, nessun
// DOM, nessuna rete.
'use strict';

import { mappaPortafoglio, COPERTURA_MINIMA } from './portfolio-tail-risk.js';
import { PANNELLO_SETTORI } from './historical-panel.js';
import { assessTrackRecord } from './asset-track-record.js';

// Rendimenti mensili REALI (non ricampionati/bootstrap) del portafoglio se
// avesse avuto questi pesi per tutta la storia del pannello — stesso schema
// di rendimentoPortafoglio (market-stress.js), ma sui mesi VERI in ordine,
// non su uno scenario ricampionato: qui serve la sequenza reale, non una
// simulazione, perché la domanda è "il tuo track record", non "il peggior
// caso possibile".
function rendimentiReali(pesi) {
  const mesi = PANNELLO_SETTORI[0].r.length;
  const out = new Array(mesi).fill(0);
  for (const s of PANNELLO_SETTORI) {
    const peso = pesi[s.simbolo] || 0;
    if (!peso) continue;
    for (let t = 0; t < mesi; t++) out[t] += peso * s.r[t];
  }
  return out;
}

// assessTrackRecord si aspetta una serie prezzo {date,price} (come arriva da
// un provider reale), non rendimenti diretti: si ricostruisce una serie
// sintetica a base 100 dai rendimenti mensili REALI pesati — la stessa
// trasformazione che farebbe un grafico prezzo/rendimento, nessuna invenzione
// di dati, solo un cambio di rappresentazione della stessa serie.
function serieDaRendimenti(rendimenti) {
  let prezzo = 100;
  const serie = [{ date: 'mese-0', price: prezzo }];
  rendimenti.forEach((r, i) => {
    prezzo *= (1 + r);
    serie.push({ date: `mese-${i + 1}`, price: prezzo });
  });
  return serie;
}

export function trackRecordPortafoglio(positions = [], { priceByTicker = {}, sectorByTicker = {} } = {}) {
  if (!positions.length) return { valutabile: false, motivo: 'Nessuna posizione da valutare.' };
  const mappa = mappaPortafoglio(positions, { priceByTicker, sectorByTicker });
  if (!mappa.sufficiente) {
    return {
      valutabile: false,
      motivo: `Misurato solo il ${Math.round(mappa.copertura * 100)}% del portafoglio: sotto il ${Math.round(COPERTURA_MINIMA * 100)}% il risultato sarebbe più fuorviante che utile.`,
      mappa,
    };
  }
  const rendimenti = rendimentiReali(mappa.pesi);
  const serie = serieDaRendimenti(rendimenti);
  const esito = assessTrackRecord(serie, { label: 'la tua allocazione attuale' });
  if (!esito.disponibile) return { valutabile: false, motivo: esito.motivo, mappa };
  return { valutabile: true, ...esito, mappa };
}
