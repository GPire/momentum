// ============================================================
// COMPS — multipli di mercato contro i pari REALI (2026-08-30)
// ============================================================
// Il "comparable company analysis" degli investment banker (ricerca
// 2026: TradeAlgo/ChatFin/Street of Walls — i multipli standard sono
// EV/EBITDA, P/E, EV/Revenue, P/FCF; i pari si scelgono per dimensione
// vicina, tipicamente 0,3-3x ricavi/EV del target). screener-settore.js
// fa già la parte "stesso settore, dimensione vicina" (comparabili(),
// ordina i pari per distanza logaritmica di ricavi — stessa idea della
// fascia 0,3-3x) sul pannello SEC — ma il pannello ha SOLO dati di
// bilancio, mai prezzo di mercato, quindi mai un multiplo vero. Questo
// modulo prende quei pari REALI (ticker veri, non un intervallo
// inventato) e ci aggancia i loro multipli di mercato, scaricati da
// Alpha Vantage OVERVIEW (stessa fonte già in uso per il target,
// EVToEBITDA/EVToRevenue — campi presenti nella risposta e mai letti
// finora, vedi asset-overview.js).
//
// Onestà (regola #1 del progetto):
//  - Un multiplo IMPLICITO (mediana dei pari applicata all'EBITDA/ricavi
//    del target) non è un prezzo obiettivo: è "se il mercato pagasse
//    questa azienda come paga i suoi pari", un fatto aritmetico condito
//    con un'ipotesi dichiarata, mai un consiglio "compra/vendi".
//  - Il costo in richieste API è REALE e va detto: ogni pari in più è
//    una chiamata Alpha Vantage in più (limite gratuito 25/giorno) — il
//    chiamante decide quanti pari includere, mai un numero nascosto.
//  - Un pari senza EV/EBITDA (azienda in perdita operativa, o dato non
//    coperto) viene escluso dalla mediana, mai forzato a zero.
'use strict';

function mediana(valori) {
  const v = valori.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : +((v[mid - 1] + v[mid]) / 2).toFixed(2);
}

// `target`: { symbol, name, evToEbitda, evToRevenue, ebitda, revenueTTM, marketCap }
// `peers`: [{ symbol, name, evToEbitda, evToRevenue }, ...] — già filtrati per
// settore/dimensione da screener-settore.js/comparabili(), overview già
// scaricata dal chiamante (main.js) per ciascuno.
export function analizzaComps(target, peers = []) {
  if (!target?.symbol) return { disponibile: false, motivo: 'Serve il ticker del titolo target.' };
  const peersValidi = (peers || []).filter((p) => p && p.symbol !== target.symbol);
  if (!peersValidi.length) {
    return { disponibile: false, motivo: `Nessun'azienda comparabile trovata per ${target.symbol} nel pannello settoriale.` };
  }

  const evEbitdaPeers = peersValidi.map((p) => p.evToEbitda).filter((v) => Number.isFinite(v) && v > 0);
  const evRevenuePeers = peersValidi.map((p) => p.evToRevenue).filter((v) => Number.isFinite(v) && v > 0);
  const medianaEvEbitda = mediana(evEbitdaPeers);
  const medianaEvRevenue = mediana(evRevenuePeers);

  if (medianaEvEbitda === null && medianaEvRevenue === null) {
    return {
      disponibile: false,
      motivo: `Nessuno dei ${peersValidi.length} pari trovati ha un multiplo di mercato utilizzabile (aziende in perdita operativa o non coperte da Alpha Vantage per questo campo).`,
    };
  }

  // Multiplo implicito: SE il mercato pagasse il target come paga la
  // mediana dei suoi pari, quanto varrebbe il suo enterprise value —
  // dichiarato sempre come ipotesi, mai un prezzo obiettivo.
  const evImplicitoEbitda = medianaEvEbitda !== null && Number.isFinite(target.ebitda) && target.ebitda > 0
    ? +(medianaEvEbitda * target.ebitda).toFixed(0) : null;
  const evImplicitoRevenue = medianaEvRevenue !== null && Number.isFinite(target.revenueTTM) && target.revenueTTM > 0
    ? +(medianaEvRevenue * target.revenueTTM).toFixed(0) : null;

  const scostoEbitda = medianaEvEbitda !== null && Number.isFinite(target.evToEbitda) && target.evToEbitda > 0
    ? +(((target.evToEbitda - medianaEvEbitda) / medianaEvEbitda) * 100).toFixed(1) : null;
  const scostoRevenue = medianaEvRevenue !== null && Number.isFinite(target.evToRevenue) && target.evToRevenue > 0
    ? +(((target.evToRevenue - medianaEvRevenue) / medianaEvRevenue) * 100).toFixed(1) : null;

  return {
    disponibile: true,
    target: { symbol: target.symbol, name: target.name || target.symbol, evToEbitda: target.evToEbitda ?? null, evToRevenue: target.evToRevenue ?? null },
    numeroPari: peersValidi.length,
    pariConDato: { evEbitda: evEbitdaPeers.length, evRevenue: evRevenuePeers.length },
    medianaEvEbitda, medianaEvRevenue,
    evImplicitoEbitda, evImplicitoRevenue,
    scostoEbitda, scostoRevenue,
  };
}

// ── Il testo per l'utente — bambino di 8 anni, mai un consiglio ──
export function testoComps(r) {
  if (!r?.disponibile) return r?.motivo || null;
  const righe = [];
  righe.push(`Confronto con ${r.numeroPari} aziende simili per settore e dimensione.`);
  if (r.medianaEvEbitda !== null) {
    const dir = r.scostoEbitda === null ? '' : r.scostoEbitda > 0 ? `${Math.abs(r.scostoEbitda)}% più cara dei suoi pari` : r.scostoEbitda < 0 ? `${Math.abs(r.scostoEbitda)}% più economica dei suoi pari` : 'in linea coi suoi pari';
    righe.push(`Il mercato paga ${r.target.symbol} ${r.target.evToEbitda ?? '?'}× l'EBITDA, contro una mediana di ${r.medianaEvEbitda}× tra i pari (${r.pariConDato.evEbitda} con dato utilizzabile)${dir ? ` — ${dir}` : ''}.`);
  }
  if (r.medianaEvRevenue !== null) {
    righe.push(`Sui ricavi: ${r.target.evToRevenue ?? '?'}× contro una mediana di ${r.medianaEvRevenue}× tra i pari.`);
  }
  righe.push('Questo NON è un prezzo obiettivo: è quanto varrebbe se il mercato la pagasse come paga aziende simili — un\'ipotesi aritmetica, non una previsione.');
  return righe.join(' ');
}
