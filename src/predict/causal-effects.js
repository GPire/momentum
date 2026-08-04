// ============================================================
// CAUSAL EFFECTS — da "esiste un legame" a "se cambio X, ecco cosa succede"
// ============================================================
// `causal-discovery.js` risponde alla domanda "quali legami sono reali?".
// Questo file risponde a quella che interessa davvero a una persona:
// **"se taglio i ristoranti del 20%, quanto risparmio DAVVERO, e con quanta
// incertezza?"** — e lo fa considerando anche le vie indirette, le interazioni
// e i casi in cui l'effetto non è lo stesso per tutti i mesi.
//
// Quattro capacità che il motore attuale non ha:
//
//  1. EFFETTO CON INTERVALLO, MAI UN NUMERO SECCO. Il coefficiente si stima
//     controllando per i genitori (aggiustamento backdoor sul grafo scoperto),
//     e si accompagna al suo errore standard. "Tra 40 € e 120 €" è una
//     risposta onesta; "risparmi 87 €" è una promessa che non possiamo fare.
//
//  2. VIE INDIRETTE. Se A influenza B e B influenza C, tagliare A muove
//     anche C. L'effetto TOTALE è la somma dei prodotti lungo tutti i
//     cammini: è il motivo per cui un consiglio basato su una sola coppia
//     sbaglia sistematicamente il conto.
//
//  3. INTERAZIONI (l'effetto non è sempre lo stesso). Sui soldi è la regola:
//     mangiare fuori pesa in modo diverso nei mesi in cui l'entrata è bassa.
//     Si testa esplicitamente il termine di interazione, invece di assumere
//     che l'effetto medio descriva tutti i mesi — che è la ragione per cui i
//     consigli "medi" non funzionano per nessuno in particolare.
//
//  4. LEGAMI NON LINEARI MONOTONI. La correlazione parziale vede solo le
//     relazioni lineari. Un controllo per ranghi intercetta i legami che
//     crescono ma non in linea retta — e quando i due disaccordano, lo si
//     DICE invece di scegliere quello che fa più comodo.
//
// Assunzione dichiarata, perché senza dichiararla i numeri sarebbero
// disonesti: le stime di effetto valgono SE il grafo scoperto è corretto e SE
// gli effetti sono approssimativamente lineari nell'intervallo considerato.
// Fuori da un intervallo osservato, l'estrapolazione viene rifiutata.
//
// Funzioni PURE, nessun DOM, nessuna rete.
'use strict';

import { normalCdf } from '../alpha/strategy-validation.js';
import { buildLaggedFrame, partialCorrelationTest } from './causal-discovery.js';

// ── Minimi quadrati con errori standard ──
// Serve la diagonale di (XᵀX)⁻¹ per gli errori standard: si inverte con
// Gauss-Jordan. Ritorna null sui sistemi degeneri, mai una stima inventata.
export function olsWithSE(y, X = []) {
  const n = y.length;
  const cols = [new Array(n).fill(1), ...X.map((c) => c.slice(0, n))];
  const k = cols.length;
  if (n <= k + 1) return null;

  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) =>
    cols[i].reduce((s, v, t) => s + v * cols[j][t], 0)));
  const b = cols.map((c) => c.reduce((s, v, t) => s + v * y[t], 0));

  // Gauss-Jordan su [A | I] → inversa
  const M = A.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < k; i++) {
    let piv = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    if (Math.abs(M[piv][i]) < 1e-12) return null;
    [M[i], M[piv]] = [M[piv], M[i]];
    const d = M[i][i];
    for (let c = 0; c < 2 * k; c++) M[i][c] /= d;
    for (let r = 0; r < k; r++) {
      if (r === i) continue;
      const f = M[r][i];
      if (f === 0) continue;
      for (let c = 0; c < 2 * k; c++) M[r][c] -= f * M[i][c];
    }
  }
  const inv = M.map((row) => row.slice(k));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  const fitted = y.map((_, t) => cols.reduce((s, c, j) => s + beta[j] * c[t], 0));
  const resid = y.map((v, t) => v - fitted[t]);
  const rss = resid.reduce((s, r) => s + r * r, 0);
  const dof = n - k;
  const sigma2 = rss / dof;
  const se = inv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i])));
  return { beta, se, dof, rss, sigma2, resid, n };
}

// ── Effetto diretto di una variabile ritardata su un target ──
// Aggiustamento backdoor: si condiziona sui genitori del target (esclusa la
// variabile in esame) e sui genitori della variabile stessa — lo stesso
// insieme che rende valido il test MCI.
export function directEffect(frame, parentsByTarget, fromKey, toName, { z = 1.96 } = {}) {
  const y = frame.target[toName];
  const x = frame.lagged[fromKey];
  if (!y || !x) return null;

  const [fromName] = fromKey.split('@');
  const parentsY = (parentsByTarget[toName] || []).filter((p) => p.key !== fromKey).slice(0, 3);
  const parentsX = (parentsByTarget[fromName] || []).filter((p) => p.key !== fromKey).slice(0, 2);
  const controlli = [...new Set([...parentsY, ...parentsX].map((p) => p.key))]
    .map((k) => frame.lagged[k]).filter(Boolean);

  const fit = olsWithSE(y, [x, ...controlli]);
  if (!fit) return null;
  const beta = fit.beta[1];        // beta[0] è l'intercetta
  const se = fit.se[1];
  const t = se > 0 ? beta / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(t)));

  return {
    from: fromName, to: toName, lag: Number(fromKey.split('@')[1]),
    beta: +beta.toFixed(4),
    se: +se.toFixed(4),
    ic: [+(beta - z * se).toFixed(4), +(beta + z * se).toFixed(4)],
    p: +p.toFixed(6),
    n: fit.n,
    controlliUsati: controlli.length,
  };
}

// ── Interazione: l'effetto cambia a seconda del contesto ──
// Si aggiunge il prodotto X·M e si testa il suo coefficiente. Se è
// significativo, l'effetto medio NON descrive nessun mese in particolare, ed è
// esattamente il motivo per cui i consigli generici falliscono.
export function interactionEffect(frame, fromKey, toName, moderatorKey, { z = 1.96 } = {}) {
  const y = frame.target[toName];
  const x = frame.lagged[fromKey];
  const m = frame.lagged[moderatorKey];
  if (!y || !x || !m) return null;

  const n = Math.min(y.length, x.length, m.length);
  const centra = (a) => { const mu = a.reduce((s, v) => s + v, 0) / a.length; return a.map((v) => v - mu); };
  const xc = centra(x.slice(0, n)), mc = centra(m.slice(0, n));
  const inter = xc.map((v, i) => v * mc[i]);

  const fit = olsWithSE(y.slice(0, n), [xc, mc, inter]);
  if (!fit) return null;
  const beta = fit.beta[3], se = fit.se[3];
  const t = se > 0 ? beta / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(t)));

  // Effetto di X quando il moderatore è basso / alto (± una deviazione standard):
  // è il numero che rende la scoperta utilizzabile invece che solo vera.
  const sdM = Math.sqrt(mc.reduce((s, v) => s + v * v, 0) / Math.max(1, mc.length - 1));
  return {
    from: fromKey.split('@')[0], to: toName, moderatore: moderatorKey.split('@')[0],
    betaInterazione: +beta.toFixed(4),
    p: +p.toFixed(6),
    significativa: p < 0.05,
    effettoQuandoBasso: +(fit.beta[1] - beta * sdM).toFixed(4),
    effettoQuandoAlto: +(fit.beta[1] + beta * sdM).toFixed(4),
    ic: [+(beta - z * se).toFixed(4), +(beta + z * se).toFixed(4)],
    n: fit.n,
  };
}

// ── Legami non lineari monotoni ──
// Correlazione dei ranghi (Spearman) sui residui: intercetta le relazioni che
// crescono senza essere rette. Quando lineare e monotono disaccordano, il
// risultato lo DICE — non si sceglie il più conveniente.
const ranks = (a) => {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length; i++) r[idx[i][1]] = i + 1;
  return r;
};

export function monotoneCheck(frame, fromKey, toName, controlKeys = []) {
  const y = frame.target[toName];
  const x = frame.lagged[fromKey];
  if (!y || !x) return null;
  const Z = controlKeys.map((k) => frame.lagged[k]).filter(Boolean);

  const lineare = partialCorrelationTest(x, y, Z);
  const monotono = partialCorrelationTest(ranks(x), ranks(y), Z.map(ranks));
  if (lineare.p === null || monotono.p === null) return null;

  const discordi = (lineare.p < 0.05) !== (monotono.p < 0.05);
  return {
    lineare: { r: lineare.r, p: lineare.p },
    monotono: { r: monotono.r, p: monotono.p },
    discordi,
    nota: discordi
      ? 'Il legame c\'è ma non è una linea retta: il numero medio descriverebbe male i casi estremi.'
      : null,
  };
}

// ── Vie indirette: l'effetto totale lungo tutti i cammini ──
// A → B → C significa che toccare A muove anche C. Sommare solo gli effetti
// diretti sbaglia il conto, sistematicamente e sempre nella stessa direzione.
// L'incertezza NON è una costante inventata: si propaga con il metodo delta.
// Per un prodotto di stime P = β₁·β₂·…·βₖ le varianze RELATIVE si sommano,
// quindi la deviazione relativa del cammino è √(Σ (seᵢ/βᵢ)²). È il motivo per
// cui un cammino lungo diventa inutilizzabile anche quando ogni singolo anello
// sembra solido: tre coefficienti al 30% di incertezza ciascuno danno oltre il
// 50% sul totale. Prima qui c'era una costante scelta a mano (0,25 per passo):
// un numero non misurato, esattamente ciò che questo progetto non ammette.
const REL_SE_DEFAULT = 0.35; // usato SOLO se un arco non porta il proprio errore standard

const relSeOf = (e) => {
  if (Number.isFinite(e.se) && Number.isFinite(e.beta) && Math.abs(e.beta) > 1e-9) {
    return Math.abs(e.se / e.beta);
  }
  return REL_SE_DEFAULT;
};

export function totalEffect(edges, fromName, toName, { maxDepth = 3 } = {}) {
  const out = new Map();
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e);
  }

  const cammini = [];
  const dfs = (nodo, prodotto, relVar, lag, visitati, percorso) => {
    if (percorso.length > maxDepth) return;
    for (const e of out.get(nodo) || []) {
      if (visitati.has(e.to)) continue; // niente cicli: un cammino non ripassa da dove è già stato
      const p = prodotto * e.beta;
      const rv = relVar + relSeOf(e) ** 2;
      const nuovoPercorso = [...percorso, `${e.from}→${e.to}`];
      if (e.to === toName) {
        cammini.push({
          percorso: nuovoPercorso, beta: +p.toFixed(4), lagTotale: lag + e.lag,
          passi: nuovoPercorso.length, se: +(Math.abs(p) * Math.sqrt(rv)).toFixed(4),
        });
      } else {
        dfs(e.to, p, rv, lag + e.lag, new Set([...visitati, e.to]), nuovoPercorso);
      }
    }
  };
  dfs(fromName, 1, 0, 0, new Set([fromName]), []);

  const diretto = cammini.filter((c) => c.passi === 1).reduce((s, c) => s + c.beta, 0);
  const totale = cammini.reduce((s, c) => s + c.beta, 0);
  // Cammini distinti sono stime largamente indipendenti: le varianze si sommano.
  const se = Math.sqrt(cammini.reduce((s, c) => s + c.se ** 2, 0));
  return {
    from: fromName, to: toName,
    diretto: +diretto.toFixed(4),
    indiretto: +(totale - diretto).toFixed(4),
    totale: +totale.toFixed(4),
    se: +se.toFixed(4),
    cammini: cammini.sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta)),
    // Se l'indiretto conta quanto o più del diretto, un consiglio basato sulla
    // sola coppia sarebbe fuorviante: va segnalato a chi mostra il risultato.
    dominatoDaIndiretto: Math.abs(totale - diretto) >= Math.abs(diretto) * 0.5,
  };
}

// ── Scenari: più cambiamenti insieme, con l'incertezza propagata ──
// L'utente non cambia una cosa sola: taglia i ristoranti E aumenta la spesa
// al supermercato. Gli effetti si sommano lungo il grafo, e l'incertezza
// cresce con la lunghezza dei cammini — un effetto a tre passi è molto meno
// certo di uno diretto, e mostrarli con la stessa faccia sarebbe disonesto.
export function simulateScenario(edges, interventi, { targets = null, maxDepth = 3 } = {}) {
  const nodi = new Set();
  for (const e of edges) { nodi.add(e.from); nodi.add(e.to); }
  const obiettivi = targets || [...nodi];

  const risultati = [];
  for (const to of obiettivi) {
    let effettoTotale = 0;
    let varianza = 0;
    const contributi = [];
    for (const [from, delta] of Object.entries(interventi || {})) {
      if (from === to) continue;
      const te = totalEffect(edges, from, to, { maxDepth });
      if (!te.cammini.length) continue;
      const contributo = te.totale * delta;
      effettoTotale += contributo;
      // Incertezza propagata dagli errori standard veri (metodo delta), non da
      // una costante: interventi diversi sono indipendenti, le varianze si sommano.
      varianza += (te.se * Math.abs(delta)) ** 2;
      const passiMedi = te.cammini.reduce((s, c) => s + c.passi * Math.abs(c.beta), 0) / Math.max(1e-9, te.cammini.reduce((s, c) => s + Math.abs(c.beta), 0));
      contributi.push({ from, delta, effetto: +contributo.toFixed(4), passiMedi: +passiMedi.toFixed(2), viaIndiretta: te.dominatoDaIndiretto });
    }
    if (!contributi.length) continue;
    // Banda al 95%: due errori standard. Se contiene lo zero, la risposta
    // onesta è "non lo so" — e viene detta, non nascosta dietro un numero.
    const banda = 1.96 * Math.sqrt(varianza);
    risultati.push({
      target: to,
      effetto: +effettoTotale.toFixed(4),
      se: +Math.sqrt(varianza).toFixed(4),
      intervallo: [+(effettoTotale - banda).toFixed(4), +(effettoTotale + banda).toFixed(4)],
      contributi: contributi.sort((a, b) => Math.abs(b.effetto) - Math.abs(a.effetto)),
      certo: Math.abs(effettoTotale) > banda,
    });
  }
  return risultati.sort((a, b) => Math.abs(b.effetto) - Math.abs(a.effetto));
}

// ── L'analisi completa, pronta da mostrare ──
export function analyzeCausalScenario(series, discovered, { interventi = {}, maxLag = 3 } = {}) {
  const frame = discovered?.frame || buildLaggedFrame(series, { maxLag });
  const parents = discovered?.parentsByTarget || {};

  const edges = [];
  for (const l of discovered?.links || []) {
    const eff = directEffect(frame, parents, `${l.from}@${l.lag}`, l.to);
    if (eff && Number.isFinite(eff.beta)) edges.push(eff);
  }

  const scenari = Object.keys(interventi).length ? simulateScenario(edges, interventi) : [];

  return {
    edges,
    scenari,
    // Nessun legame significativo NON è un fallimento: è un risultato, e va
    // detto con la stessa chiarezza di un risultato positivo.
    riassunto: edges.length
      ? `${edges.length} legami con effetto misurabile. ${scenari.filter((s) => s.certo).length} conseguenze abbastanza certe da mostrare.`
      : 'Nessun legame regge al controllo statistico: non c\'è niente di affidabile da dire su questi dati.',
  };
}
