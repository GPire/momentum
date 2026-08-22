// ============================================================
// VALUTE DIVERSE NELLA DASHBOARD — mai sommate come se fossero la stessa
// ============================================================
// Momentum non chiama server esterni per dati finanziari (principio del
// progetto, unica eccezione dichiarata: il riassunto notizie via LLM
// esterno, opt-in, con chiave propria dell'utente). Senza un tasso di
// cambio live, sommare "45 £" a "100 €" in un unico totale sarebbe un
// numero INVENTATO — sembrerebbe preciso e sarebbe semplicemente sbagliato.
//
// La scelta onesta (non la più comoda): il totale principale della
// dashboard resta SOLO nella valuta base del dispositivo (il caso normale,
// quasi sempre l'unico che esiste). Le transazioni in altre valute vengono
// tenute FUORI da quel numero e segnalate a parte — mai incluse in
// silenzio, mai scartate in silenzio. Se l'utente inserisce un tasso a
// mano (vedi convertiConTasso), può comunque vedere un equivalente
// convertito — ma è SEMPRE una stima dichiarata, mai spacciata per il dato
// reale che il totale base rappresenta.
'use strict';

// Divide le transazioni fra "valuta base" (o senza `currency` — il caso di
// sempre, transazioni vecchie o mai toccate da questo fix) e "altre
// valute", raggruppate per codice. Funzione pura: nessun accesso al vault,
// nessun DOM — il chiamante decide come mostrarlo.
function raggruppaPerValuta(transazioni, valutaBase = 'EUR') {
  const base = { count: 0, totale: 0 };
  const altre = {}; // { GBP: { count, totale }, ... }
  for (const t of transazioni || []) {
    const importo = Number(t.amount) || 0;
    const valuta = t.currency || valutaBase;
    if (valuta === valutaBase) {
      base.count++; base.totale += importo;
    } else {
      if (!altre[valuta]) altre[valuta] = { count: 0, totale: 0 };
      altre[valuta].count++; altre[valuta].totale += importo;
    }
  }
  return { base, altre };
}

// Testo breve e onesto per la nota in dashboard — null quando non c'è
// nulla da segnalare (il caso normale: tutto in valuta base).
function notaValuteEstranee(altre, formatMoney) {
  const codici = Object.keys(altre || {});
  if (!codici.length) return null;
  const parti = codici.map((c) => `${formatMoney(altre[c].totale, c)} in ${c}`);
  const conteggio = codici.reduce((s, c) => s + altre[c].count, 0);
  return `${conteggio === 1 ? '1 transazione' : `${conteggio} transazioni`} non incluse nel totale: ${parti.join(', ')}`;
}

// Conversione con un tasso fornito ESPLICITAMENTE dall'utente (mai una
// fonte remota qui: quella resta un passo successivo dichiarato, non
// implementato — vedi commento in testa al file). `tassi` è una mappa
// { GBP: 1.17, USD: 0.92, ... } = quante unità di valutaBase per 1 unità
// di quella valuta, così com'è tipicamente scritta dall'utente ("1 sterlina
// vale 1,17 euro"). Nessun tasso noto -> null, mai una stima inventata.
function convertiConTasso(importo, daValuta, valutaBase, tassi) {
  if (daValuta === valutaBase) return importo;
  const tasso = tassi?.[daValuta];
  if (!Number.isFinite(tasso)) return null;
  return importo * tasso;
}

export { raggruppaPerValuta, notaValuteEstranee, convertiConTasso };
