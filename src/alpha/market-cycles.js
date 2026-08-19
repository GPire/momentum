// ============================================================
// MARKET CYCLES — Wave 10++ v10: base-rate storici, non previsioni
// ============================================================
// Risponde alla richiesta "predittivo / comprendere cosa sta per succedere /
// cicli e ciclicità" nell'UNICO modo onesto e costruibile on-device: NON un
// oracolo che inventa il futuro, ma la STATISTICA STORICA — "dopo un calo di
// questa profondità, il mercato ha storicamente recuperato in mediana N mesi".
// È un base-rate misurato sui dati reali (i 40 anni di S&P 500/SPY/BTC
// scaricati in bench/alpha-bench-real.mjs), con caveat esplicito che il
// passato non garantisce il futuro. Funzioni pure, nessun DOM, nessuna rete.
'use strict';

const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// Estrae gli EPISODI di drawdown completi e in corso da una serie mensile.
// Un episodio: dal picco precedente → al minimo → al recupero del picco (o
// "in corso" se non ha ancora recuperato a fine serie). Ritorna profondità,
// mesi picco→minimo (durata calo) e mesi minimo→recupero (durata recupero).
export function drawdownEpisodes(closes = [], { minDepthPct = 10 } = {}) {
  const episodes = [];
  let peak = closes[0], peakIdx = 0;
  let troughIdx = 0, troughVal = closes[0];
  let inDD = false;
  const openEpisode = () => { episodes.push({ peakIdx, depthPct: 0, troughIdx, declineMonths: 0, recoveryMonths: null, recovered: false }); inDD = true; };
  for (let i = 1; i < closes.length; i++) {
    const c = closes[i];
    if (!Number.isFinite(c)) continue;
    if (inDD) {
      const ep = episodes[episodes.length - 1];
      if (c < troughVal) { troughVal = c; troughIdx = i; } // nuovo minimo
      const depth = (peak - troughVal) / peak * 100;
      ep.depthPct = +depth.toFixed(1);
      ep.troughIdx = troughIdx;
      ep.declineMonths = troughIdx - ep.peakIdx;
      if (c >= peak) { // recuperato il picco precedente → episodio chiuso
        ep.recovered = true;
        ep.recoveryMonths = i - troughIdx;
        inDD = false;
        peak = c; peakIdx = i; troughVal = c; troughIdx = i;
      }
    } else {
      if (c >= peak) { peak = c; peakIdx = i; troughVal = c; troughIdx = i; }
      else {
        const depth = (peak - c) / peak * 100;
        if (depth >= minDepthPct) { troughVal = c; troughIdx = i; openEpisode(); episodes[episodes.length - 1].depthPct = +depth.toFixed(1); episodes[episodes.length - 1].declineMonths = i - peakIdx; }
      }
    }
  }
  return episodes.filter(e => e.depthPct >= minDepthPct);
}

// Base-rate del recupero per fascia di profondità: quanti episodi, e mediana
// dei mesi di recupero (solo tra quelli RECUPERATI — gli episodi in corso non
// hanno un tempo di recupero, e inventarlo sarebbe disonesto).
// BUG LATENTE TROVATO estendendo l'archivio ai dati GIORNALIERI (2026-08-19):
// questi campi contano DIFFERENZE DI INDICE, non mesi. Finche' l'unico
// chiamante passava serie mensili i due coincidevano e il nome era corretto
// per caso. Con 41 anni di dati giornalieri lo stesso codice ha prodotto
// "medianRecoveryMonths: 1093" — che letto come mesi sono 91 anni, mentre
// sono 1093 giorni di borsa, cioe' poco piu' di quattro anni.
// Nessun errore, nessun crash: solo un'unita' sbagliata, che e' il modo piu'
// silenzioso di mentire con un numero giusto.
// I nomi storici restano per non rompere i chiamanti esistenti; si aggiungono
// `periodi` (neutro) e `unita` (dichiarata), e chi passa dati giornalieri deve
// dirlo — il valore predefinito resta mensile, come prima.
export const CADENZE = {
  mensile: { unita: 'mesi', perAnno: 12 },
  giornaliera: { unita: 'giorni di borsa', perAnno: 252 },
};

export function recoveryBaseRates(closes = [], { minDepthPct = 10, cadenza = 'mensile' } = {}) {
  const episodes = drawdownEpisodes(closes, { minDepthPct });
  const c = CADENZE[cadenza] || CADENZE.mensile;
  const buckets = { '10-20%': [], '20-35%': [], '35%+': [] };
  const bucketOf = (d) => d < 20 ? '10-20%' : d < 35 ? '20-35%' : '35%+';
  let ongoing = 0;
  for (const e of episodes) {
    if (e.recovered) buckets[bucketOf(e.depthPct)].push(e.recoveryMonths);
    else ongoing++;
  }
  const rows = Object.entries(buckets).map(([band, periodi]) => {
    const med = median(periodi);
    const max = periodi.length ? Math.max(...periodi) : null;
    return {
      band, count: periodi.length,
      // Nomi storici: invariati per i chiamanti che passano dati mensili.
      medianRecoveryMonths: med,
      maxRecoveryMonths: max,
      // Nomi neutri, corretti a qualunque cadenza.
      medianaPeriodi: med,
      massimoPeriodi: max,
      // E la stessa cosa in anni, che e' l'unita' che una persona capisce
      // senza dover sapere quale cadenza sia stata usata.
      medianaAnni: med === null ? null : +(med / c.perAnno).toFixed(1),
      massimoAnni: max === null ? null : +(max / c.perAnno).toFixed(1),
    };
  });
  return { rows, totalEpisodes: episodes.length, ongoing, cadenza, unita: c.unita };
}

// Contesto ONESTO sulla posizione attuale: quanto siamo sotto il massimo, e
// cosa dice la storia per cali di profondità simile o maggiore. Mai "il
// mercato risalirà": sempre "storicamente, cali così si sono recuperati in
// mediana N mesi — tendenza passata, non una garanzia".
export function currentDrawdownContext(closes = [], { minDepthPct = 10 } = {}) {
  const clean = closes.filter(Number.isFinite);
  if (clean.length < 12) return { inDrawdown: false, note: 'Storico insufficiente per un contesto affidabile.' };
  const peak = Math.max(...clean);
  const current = clean[clean.length - 1];
  const depth = +((peak - current) / peak * 100).toFixed(1);
  if (depth < minDepthPct) return { inDrawdown: false, depthPct: depth, note: `Vicino ai massimi (−${depth}% dal picco). Nessun calo rilevante in corso.` };
  const episodes = drawdownEpisodes(clean, { minDepthPct }).filter(e => e.recovered && e.depthPct >= depth * 0.7);
  const recoveries = episodes.map(e => e.recoveryMonths);
  const med = median(recoveries);
  return {
    inDrawdown: true, depthPct: depth,
    comparableEpisodes: episodes.length,
    medianRecoveryMonths: med,
    note: med != null
      ? `Sei a −${depth}% dal massimo. Storicamente, cali di profondità simile si sono recuperati in mediana ${med} mesi (su ${episodes.length} episodi passati). Tendenza storica, NON una garanzia sul futuro.`
      : `Sei a −${depth}% dal massimo. Nessun episodio storico comparabile in questa serie: non azzardo una stima di recupero.`,
  };
}

// Stagionalità (ciclicità intra-anno): rendimento medio per mese di calendario.
// dates: 'YYYY-MM'. Onesto: campione piccolo per mese, in-sample, TENDENZA
// non certezza — dichiarato, e count riportato per fascia.
export function monthlySeasonality(dates = [], closes = []) {
  const byMonth = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < closes.length; i++) {
    if (!Number.isFinite(closes[i]) || !Number.isFinite(closes[i - 1]) || closes[i - 1] === 0) continue;
    const m = parseInt(String(dates[i]).slice(5, 7), 10) - 1;
    if (m >= 0 && m < 12) byMonth[m].push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return byMonth.map((rets, m) => ({
    month: m + 1,
    avgReturnPct: rets.length ? +(100 * rets.reduce((s, x) => s + x, 0) / rets.length).toFixed(2) : null,
    count: rets.length,
    positiveRatePct: rets.length ? +(100 * rets.filter(x => x > 0).length / rets.length).toFixed(0) : null,
  }));
}
