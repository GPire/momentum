// ============================================================
// STRATEGY VALIDATION — quali risultati storici sono veri, e quali sono fortuna
// ============================================================
// Il problema di settore che questo file affronta, e che praticamente nessuna
// app consumer affronta: **un backtest che sembra ottimo, molto spesso non
// significa niente.**
//
// Se si provano 8 strategie su 40 anni di dati, la migliore avrà un bel numero
// anche se nessuna delle 8 ha alcun valore reale: è il massimo di 8 estrazioni
// casuali, non un merito. Più strategie si provano, più il "vincitore" è
// gonfiato. Questo si chiama data snooping ed è la ragione per cui una quantità
// enorme di prodotti finanziari mostra grafici storici splendidi e poi delude:
// il numero mostrato non è mai stato corretto per quante volte si è provato.
//
// Qui si applicano gli strumenti veri della letteratura, non un'euristica:
//  - **Sharpe deflazionato** (Bailey & López de Prado): quanto resta dello
//    Sharpe una volta scontato il numero di tentativi, l'asimmetria e le code
//    dei rendimenti. Risponde a "questo risultato è distinguibile dalla
//    fortuna?" con una probabilità, non con un'opinione.
//  - **Lunghezza minima dello storico** (minimum track record length): quanti
//    mesi servirebbero perché quel risultato diventi credibile. È il numero
//    che permette di dire "torna fra due anni", invece di far decidere adesso.
//  - **Rilevamento del guardare avanti** (look-ahead): un segnale che usa un
//    dato che a quella data non esisteva ancora produce backtest fantastici e
//    perdite reali. Si controlla, non si spera.
//
// Il risultato è la funzione che nessun competitor offre: dire all'utente
// **"questa strategia che sembra buona non lo è, e questo è il motivo"**.
// Vale anche contro noi stessi: le nostre 8 strategie passano dallo stesso
// vaglio, e se una non regge lo diciamo.
//
// Funzioni PURE, nessuna rete, nessun DOM. Nessun consiglio di acquisto: qui
// si misura l'affidabilità di un numero, non si dice a nessuno cosa comprare.
'use strict';

// ── Statistica di base (nessuna dipendenza) ──

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function moments(returns) {
  const n = returns.length;
  if (n < 2) return { n, mu: 0, sigma: 0, skew: 0, kurt: 3 };
  const mu = mean(returns);
  const c2 = mean(returns.map((r) => (r - mu) ** 2));
  const sigma = Math.sqrt(c2);
  if (sigma === 0) return { n, mu, sigma: 0, skew: 0, kurt: 3 };
  const c3 = mean(returns.map((r) => (r - mu) ** 3));
  const c4 = mean(returns.map((r) => (r - mu) ** 4));
  return { n, mu, sigma, skew: c3 / sigma ** 3, kurt: c4 / sigma ** 4 };
}

// Funzione di ripartizione normale standard, via erf con l'approssimazione di
// Abramowitz & Stegun 7.1.26 (errore < 1.5e-7): sufficiente e verificabile.
export function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t * t
    - 0; // (espansione scritta per esteso sotto, tenuta leggibile)
  // Forma canonica dell'approssimazione:
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  void y;
  return 0.5 * (1 + sign * erf);
}

// Inversa approssimata della normale standard (Acklam): serve per sapere
// "quale Sharpe atteso avrebbe il migliore di N tentativi tutti inutili".
export function normalInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ── Sharpe osservato ──

export function sharpeRatio(returns, { riskFree = 0 } = {}) {
  const { n, mu, sigma } = moments(returns);
  if (n < 2 || sigma === 0) return 0;
  return (mu - riskFree) / sigma;
}

// ── La soglia di fortuna ──
// Lo Sharpe atteso del MIGLIORE fra `trials` strategie che non hanno alcun
// valore reale. È il numero che chiunque provi più strategie dovrebbe battere
// e che quasi nessuno calcola. Con una sola prova la soglia è zero: non c'è
// nessuna selezione da scontare.
export function expectedMaxSharpe(trials, { varianceOfTrials = 1 } = {}) {
  const N = Math.max(1, Math.floor(trials));
  if (N === 1) return 0;
  const gamma = 0.5772156649015329; // Eulero-Mascheroni
  const term = (1 - gamma) * normalInv(1 - 1 / N) + gamma * normalInv(1 - 1 / (N * Math.E));
  return Math.sqrt(varianceOfTrials) * term;
}

// ── Sharpe deflazionato ──
// Probabilità che lo Sharpe osservato sia VERAMENTE superiore alla soglia di
// fortuna, tenendo conto di quante strategie si sono provate, di quanti dati
// si hanno, e della forma della distribuzione dei rendimenti (asimmetria e
// code: rendimenti con code grasse rendono lo Sharpe meno affidabile di quanto
// sembri, ed è precisamente il caso delle cripto).
export function deflatedSharpe(returns, { trials = 1, riskFree = 0, varianceOfTrials = null } = {}) {
  const m = moments(returns);
  if (m.n < 8 || m.sigma === 0) {
    return {
      sharpe: 0, soglia: 0, probabilita: null, n: m.n,
      verdetto: 'dati-insufficienti',
      spiegazione: `Servono almeno 8 periodi per dire qualcosa: qui ce ne sono ${m.n}.`,
    };
  }
  const sr = (m.mu - riskFree) / m.sigma;

  // BUG REALE trovato dai test: qui il default era 1, un numero senza senso
  // dimensionale. `varianceOfTrials` è la varianza degli Sharpe STIMATI tra i
  // vari tentativi, e sotto l'ipotesi che nessuno abbia valore reale quella
  // varianza è la varianza campionaria dello stimatore, ≈ 1/(n−1) — NON 1.
  // Col valore sbagliato la soglia usciva ~2,3 e bocciava anche una strategia
  // genuinamente forte (Sharpe 0,71 su 600 periodi dichiarato "fortuna"):
  // un vaglio che boccia tutto è inutile quanto uno che promuove tutto.
  const varTrials = varianceOfTrials ?? 1 / Math.max(1, m.n - 1);
  const soglia = expectedMaxSharpe(trials, { varianceOfTrials: varTrials });

  // Errore standard dello Sharpe che tiene conto di asimmetria e curtosi
  // (Bailey & López de Prado): con code grasse l'incertezza è maggiore.
  const se = Math.sqrt((1 - m.skew * sr + ((m.kurt - 1) / 4) * sr ** 2) / (m.n - 1));
  if (!Number.isFinite(se) || se <= 0) {
    return { sharpe: +sr.toFixed(3), soglia: +soglia.toFixed(3), probabilita: null, n: m.n, verdetto: 'non-calcolabile', spiegazione: 'La forma dei rendimenti non permette una stima affidabile.' };
  }
  const probabilita = normalCdf((sr - soglia) / se);

  let verdetto, spiegazione;
  if (probabilita >= 0.95) {
    verdetto = 'solido';
    spiegazione = `Il risultato regge anche tenendo conto che sono state provate ${trials} strategie.`;
  } else if (probabilita >= 0.75) {
    verdetto = 'incerto';
    spiegazione = `Potrebbe essere vero, ma non abbastanza da fidarsi: con ${trials} tentativi un risultato così capita anche per caso.`;
  } else {
    verdetto = 'probabile-fortuna';
    spiegazione = `Provando ${trials} strategie, un risultato così bello capita spesso per puro caso. Non c'è motivo di crederci.`;
  }

  return {
    sharpe: +sr.toFixed(3),
    soglia: +soglia.toFixed(3),
    probabilita: +probabilita.toFixed(4),
    n: m.n,
    asimmetria: +m.skew.toFixed(3),
    code: +m.kurt.toFixed(3),
    verdetto,
    spiegazione,
  };
}

// ── Quanto storico servirebbe per crederci ──
// Se un risultato non è ancora credibile, questo dice DA QUANTI periodi lo
// diventerebbe — così invece di un "no" secco si può dare un "non ancora, e
// mancano circa N mesi". È molto più utile, e molto più onesto.
export function minimumTrackRecord(returns, { targetSharpe = 0, confidence = 0.95, riskFree = 0 } = {}) {
  const m = moments(returns);
  if (m.n < 3 || m.sigma === 0) return { periodi: null, spiegazione: 'Troppi pochi dati per stimarlo.' };
  const sr = (m.mu - riskFree) / m.sigma;
  if (sr <= targetSharpe) {
    return { periodi: null, spiegazione: 'Con questi numeri il risultato non diventerebbe credibile comunque: non è una questione di tempo.' };
  }
  const z = normalInv(confidence);
  const num = 1 - m.skew * sr + ((m.kurt - 1) / 4) * sr ** 2;
  const periodi = 1 + num * (z / (sr - targetSharpe)) ** 2;
  const n = Math.ceil(periodi);
  return {
    periodi: n,
    mancano: Math.max(0, n - m.n),
    spiegazione: n <= m.n
      ? 'Lo storico disponibile è già sufficiente.'
      : `Servirebbero circa ${n} periodi in tutto: ne mancano ancora ${n - m.n}.`,
  };
}

// ── Guardare avanti: l'errore che rende ogni backtest bellissimo e falso ──
// Un segnale che a un certo istante usa un dato futuro produce risultati
// spettacolari e perdite reali. Il controllo è semplice e definitivo: si
// ricalcola il segnale su una serie TRONCATA a quell'istante; se cambia,
// il segnale stava guardando avanti.
export function detectLookAhead(series, signalFn, { checkPoints = 8 } = {}) {
  const s = Array.isArray(series) ? series : [];
  if (s.length < 12) return { sospetto: false, controllati: 0, spiegazione: 'Serie troppo corta per il controllo.' };

  const violazioni = [];
  const passo = Math.max(1, Math.floor(s.length / (checkPoints + 2)));
  let controllati = 0;

  for (let t = Math.floor(s.length / 3); t < s.length - 1; t += passo) {
    let completo, troncato;
    try {
      completo = signalFn(s, t);
      troncato = signalFn(s.slice(0, t + 1), t);
    } catch (_) { continue; }
    controllati++;
    const a = JSON.stringify(completo ?? null);
    const b = JSON.stringify(troncato ?? null);
    if (a !== b) violazioni.push({ t, conFuturo: completo, senzaFuturo: troncato });
  }

  return {
    sospetto: violazioni.length > 0,
    controllati,
    violazioni: violazioni.slice(0, 3),
    spiegazione: violazioni.length
      ? `Il segnale cambia se gli si nasconde il futuro (${violazioni.length} punti su ${controllati}): il risultato storico non è ottenibile nella realtà.`
      : `Il segnale usa solo dati disponibili al momento (${controllati} punti controllati).`,
  };
}

// ── Il verdetto complessivo, in parole comprensibili ──
// È la funzione che la UI userà: prende una strategia e restituisce un
// giudizio che si capisce senza sapere cosa sia uno Sharpe.
export function validateStrategy({ name, returns, trials = 1, riskFree = 0, series = null, signalFn = null }) {
  const ds = deflatedSharpe(returns, { trials, riskFree });
  const mtr = minimumTrackRecord(returns, { riskFree });
  const la = (series && signalFn) ? detectLookAhead(series, signalFn) : null;

  const problemi = [];
  if (la?.sospetto) problemi.push('usa informazioni che all\'epoca non c\'erano');
  if (ds.verdetto === 'probabile-fortuna') problemi.push('il risultato non si distingue dalla fortuna');
  if (ds.verdetto === 'dati-insufficienti') problemi.push('non c\'è abbastanza storia per giudicare');

  const mostrabile = problemi.length === 0 && ds.verdetto === 'solido';

  return {
    name,
    mostrabile,
    deflated: ds,
    trackRecord: mtr,
    lookAhead: la,
    problemi,
    // Il testo che si può mostrare a chiunque, bambino incluso.
    titolo: mostrabile
      ? 'Questo risultato regge'
      : (la?.sospetto ? 'Questo risultato non è reale' : 'Questo risultato potrebbe essere solo fortuna'),
    dettaglio: mostrabile
      ? ds.spiegazione
      : [la?.sospetto ? la.spiegazione : null, ds.spiegazione, mtr.mancano ? mtr.spiegazione : null].filter(Boolean).join(' '),
  };
}

// Applica il vaglio a un insieme di strategie confrontate insieme: il numero
// di tentativi è il numero di strategie, e questa è esattamente la correzione
// che quasi nessuno applica. Restituisce anche quante ne sono state scartate,
// perché quel numero è esso stesso un'informazione onesta da mostrare.
export function validateStrategySet(strategie, { riskFree = 0 } = {}) {
  const trials = Math.max(1, (strategie || []).length);
  const esiti = (strategie || []).map((s) => validateStrategy({ ...s, trials, riskFree }));
  const solide = esiti.filter((e) => e.mostrabile);
  return {
    trials,
    esiti,
    solide,
    scartate: esiti.length - solide.length,
    riassunto: solide.length
      ? `Su ${esiti.length} strategie confrontate, ${solide.length} reggono al controllo statistico.`
      : `Nessuna delle ${esiti.length} strategie confrontate regge al controllo: i loro risultati storici non si distinguono dalla fortuna.`,
  };
}
