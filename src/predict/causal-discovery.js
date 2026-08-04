// ============================================================
// CAUSAL DISCOVERY — scoperta della struttura causale su serie temporali
// ============================================================
// Perché questo file esiste, detto senza indulgenza verso il codice esistente.
// `causal-graph.js` confronta le categorie a COPPIE e dichiara un legame se
// aggiungere il passato di A riduce la devianza residua di B di almeno il 15%.
// Il commento in quel file lo ammette già: è un'euristica, la soglia non è
// calibrata su un ground-truth. Da ricercatori i problemi sono tre, e sono
// gravi in modo diverso:
//
//  1. NON È UN TEST. Una soglia fissa su una riduzione percentuale non ha una
//     distribuzione nulla: non si sa quanto spesso quel 15% capiti per puro
//     caso. Con 8 settimane di dati capita molto spesso. Qui si usa un test F
//     vero con un p-value calcolato.
//
//  2. IL CONFONDENTE COMUNE. È il difetto classico del test bivariato, e sui
//     dati di spesa è la regola, non l'eccezione: lo stipendio arriva e fanno
//     salire INSIEME ristoranti e supermercato. Il test a coppie conclude
//     "ristoranti → supermercato", che è falso e porta a un consiglio sbagliato.
//     La soluzione corretta è quella di PCMCI (Runge et al., Science Advances
//     2019): condizionare sui GENITORI di entrambe le variabili, non su due
//     categorie prese a caso come fa `annotateConditionalGranger` oggi
//     (`.slice(0, 2)` delle prime chiavi che capitano).
//
//  3. NESSUNA CORREZIONE PER TEST MULTIPLI. Con 10 categorie si testano 90
//     coppie ordinate: qualcosa "risulta significativo" sempre. Qui si applica
//     Benjamini–Yekutieli, non Benjamini–Hochberg: BH assume indipendenza (o
//     dipendenza positiva) tra i test, e i nostri test condividono le stesse
//     serie — quindi sono dipendenti in modo arbitrario. BY costa un fattore
//     logaritmico di potenza ed è valido comunque: su un'app di soldi, un
//     legame falso costa più di un legame mancato.
//
// Funzioni PURE, nessun DOM, nessuna rete. Riusa `normalCdf` già scritto e
// verificato contro valori tabulati in `alpha/strategy-validation.js`.
'use strict';

import { normalCdf } from '../alpha/strategy-validation.js';

// ── Algebra minima: regressione lineare multipla per residui ──

// Risolve i minimi quadrati con eliminazione di Gauss sulle equazioni normali.
// Ritorna i residui di `y` rispetto alle colonne `X` (con intercetta).
// null se il sistema è degenere: mai un residuo inventato.
export function residualize(y, X = []) {
  const n = y.length;
  const cols = [new Array(n).fill(1), ...X.map((c) => c.slice(0, n))];
  const k = cols.length;
  if (n <= k) return null;

  // Matrice normale A = XᵀX, vettore b = Xᵀy
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) =>
    cols[i].reduce((s, v, t) => s + v * cols[j][t], 0)));
  const b = cols.map((c) => c.reduce((s, v, t) => s + v * y[t], 0));

  // Gauss con pivot parziale
  for (let i = 0; i < k; i++) {
    let piv = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-12) return null; // colonne collineari
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = i + 1; r < k; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < k; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const beta = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < k; j++) s -= A[i][j] * beta[j];
    beta[i] = s / A[i][i];
  }
  return y.map((v, t) => v - cols.reduce((s, c, j) => s + beta[j] * c[t], 0));
}

const corr = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  if (da <= 0 || db <= 0) return 0;
  return num / Math.sqrt(da * db);
};

// ── Test di indipendenza condizionale ──
// Correlazione parziale + trasformazione z di Fisher → p-value vero.
// Questo è il pezzo che manca oggi: un NUMERO che dice quanto spesso quel
// risultato capiterebbe se il legame non esistesse.
export function partialCorrelationTest(x, y, Z = []) {
  const n = Math.min(x.length, y.length, ...(Z.length ? Z.map((z) => z.length) : [Infinity]));
  const dof = n - Z.length - 3;
  if (!Number.isFinite(n) || dof <= 0) return { r: null, p: null, n, motivo: 'campione troppo piccolo per il numero di variabili di controllo' };

  const xs = x.slice(0, n), ys = y.slice(0, n), zs = Z.map((z) => z.slice(0, n));
  const rx = Z.length ? residualize(xs, zs) : xs;
  const ry = Z.length ? residualize(ys, zs) : ys;
  if (!rx || !ry) return { r: null, p: null, n, motivo: 'variabili di controllo collineari' };

  let r = corr(rx, ry);
  r = Math.max(-0.999999, Math.min(0.999999, r));
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const stat = Math.abs(z) * Math.sqrt(dof);
  const p = 2 * (1 - normalCdf(stat));
  return { r: +r.toFixed(4), p: +Math.max(0, Math.min(1, p)).toFixed(6), n, dof };
}

// ── Correzione per test multipli sotto dipendenza arbitraria ──
// Benjamini–Yekutieli. Il fattore armonico è il prezzo della validità quando
// i test sono dipendenti — e i nostri lo sono, perché condividono le serie.
export function benjaminiYekutieli(pvalues, alpha = 0.05) {
  const items = pvalues
    .map((p, i) => ({ i, p }))
    .filter((it) => Number.isFinite(it.p))
    .sort((a, b) => a.p - b.p);
  const m = items.length;
  if (!m) return { rejected: new Set(), soglia: 0, c: 1, m: 0 };
  const c = Array.from({ length: m }, (_, j) => 1 / (j + 1)).reduce((s, v) => s + v, 0);

  let kMax = -1;
  for (let k = 0; k < m; k++) {
    if (items[k].p <= ((k + 1) / (m * c)) * alpha) kMax = k;
  }
  const rejected = new Set(kMax >= 0 ? items.slice(0, kMax + 1).map((it) => it.i) : []);
  return { rejected, soglia: kMax >= 0 ? items[kMax].p : 0, c: +c.toFixed(3), m };
}

// ── Costruzione delle variabili ritardate ──
// Ogni "nodo" è una coppia (variabile, ritardo). Il presente di Y si spiega
// solo col passato: nessun legame istantaneo, che sui dati settimanali di
// spesa non sarebbe distinguibile da una correlazione qualsiasi.
export function buildLaggedFrame(series, { maxLag = 3 } = {}) {
  const names = Object.keys(series).filter((k) => Array.isArray(series[k]) && series[k].length > maxLag + 4);
  if (!names.length) return { names, T: 0, target: {}, lagged: {} };
  const len = Math.min(...names.map((k) => series[k].length));
  const T = len - maxLag;
  if (T < 5) return { names, T: 0, target: {}, lagged: {} };

  const target = {};
  const lagged = {};
  for (const name of names) {
    const s = series[name].slice(0, len);
    target[name] = s.slice(maxLag);                       // Y_t
    for (let lag = 1; lag <= maxLag; lag++) {
      lagged[`${name}@${lag}`] = s.slice(maxLag - lag, len - lag); // X_{t-lag}
    }
  }
  return { names, T, target, lagged, maxLag };
}

// ── Fase 1 (PC1): chi sono i genitori plausibili di ogni variabile ──
// Si parte da tutti i candidati ritardati e si eliminano iterativamente quelli
// che diventano indipendenti condizionando sui candidati più forti trovati
// finora. È la fase che riduce drasticamente il numero di condizionamenti
// rispetto a "condiziona su tutto", che con poche settimane di dati sarebbe
// impossibile.
export function selectParents(frame, targetName, { alphaPC = 0.2, maxConditions = 3 } = {}) {
  const y = frame.target[targetName];
  if (!y || !frame.T) return [];

  let candidates = Object.keys(frame.lagged).map((key) => ({
    key,
    ...partialCorrelationTest(frame.lagged[key], y, []),
  })).filter((c) => c.p !== null);

  // Ordine iniziale per forza dell'associazione.
  candidates.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  candidates = candidates.filter((c) => c.p <= alphaPC);

  for (let dim = 1; dim <= maxConditions; dim++) {
    if (candidates.length <= dim) break;
    const sopravvissuti = [];
    for (const cand of candidates) {
      // Condiziona sui `dim` candidati più forti diversi da questo: è
      // l'insieme che ha più probabilità di spiegarlo via, non due categorie
      // prese a caso come fa l'implementazione attuale.
      const Z = candidates.filter((o) => o.key !== cand.key).slice(0, dim).map((o) => frame.lagged[o.key]);
      const t = partialCorrelationTest(frame.lagged[cand.key], y, Z);
      if (t.p === null || t.p <= alphaPC) sopravvissuti.push({ ...cand, r: t.r ?? cand.r, p: t.p ?? cand.p });
    }
    candidates = sopravvissuti.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }
  return candidates;
}

// ── Fase 2 (MCI): il test che regge al confondente comune ──
// Per il legame X_{t-τ} → Y_t si condiziona sui genitori di Y (tolto X stesso)
// E sui genitori di X. Il secondo pezzo è ciò che distingue MCI da un Granger
// condizionale qualsiasi: rimuove l'autocorrelazione di X, che altrimenti
// gonfia la significatività.
export function mciTest(frame, parentsByTarget, fromKey, toName) {
  const y = frame.target[toName];
  const x = frame.lagged[fromKey];
  if (!y || !x) return { r: null, p: null, motivo: 'serie non disponibile' };

  const parentsY = (parentsByTarget[toName] || []).filter((p) => p.key !== fromKey).slice(0, 3);
  const [fromName] = fromKey.split('@');
  const parentsX = (parentsByTarget[fromName] || []).filter((p) => p.key !== fromKey).slice(0, 2);

  const Z = [...parentsY, ...parentsX]
    .map((p) => frame.lagged[p.key])
    .filter(Boolean);
  // Deduplica per riferimento: lo stesso ritardo può comparire in entrambi.
  const unici = [...new Set(Z)];
  return partialCorrelationTest(x, y, unici);
}

// ── L'algoritmo completo ──
export function discoverCausalGraph(series, {
  maxLag = 3, alpha = 0.05, alphaPC = 0.2, maxConditions = 3, minSamples = 12,
} = {}) {
  const frame = buildLaggedFrame(series, { maxLag });
  if (!frame.T || frame.T < minSamples) {
    return {
      links: [], scartati: [], frame,
      motivo: `Servono almeno ${minSamples} periodi utili: ce ne sono ${frame.T || 0}.`,
      affidabile: false,
    };
  }

  // Fase 1
  const parentsByTarget = {};
  for (const name of frame.names) parentsByTarget[name] = selectParents(frame, name, { alphaPC, maxConditions });

  // Fase 2 su tutte le coppie (variabile ritardata → variabile target),
  // escludendo l'auto-legame (il passato di Y su Y, che è autocorrelazione,
  // non causalità tra categorie diverse).
  const candidati = [];
  for (const toName of frame.names) {
    for (const fromKey of Object.keys(frame.lagged)) {
      const [fromName, lag] = fromKey.split('@');
      if (fromName === toName) continue;
      const t = mciTest(frame, parentsByTarget, fromKey, toName);
      if (t.p === null) continue;
      candidati.push({ from: fromName, to: toName, lag: Number(lag), r: t.r, p: t.p, n: t.n });
    }
  }

  // Fase 3: correzione per test multipli sotto dipendenza arbitraria.
  const by = benjaminiYekutieli(candidati.map((c) => c.p), alpha);
  const links = [];
  const scartati = [];
  candidati.forEach((c, i) => {
    const rec = { ...c, significativo: by.rejected.has(i) };
    if (rec.significativo) links.push(rec); else scartati.push(rec);
  });

  return {
    links: links.sort((a, b) => a.p - b.p),
    scartati,
    testEseguiti: candidati.length,
    correzione: { metodo: 'Benjamini-Yekutieli', alpha, fattore: by.c, sogliaEffettiva: by.soglia },
    parentsByTarget,
    frame,
    affidabile: true,
    motivo: null,
  };
}

// ── Il confronto onesto: cosa avrebbe detto il metodo a coppie ──
// Esiste perché la differenza tra i due va MOSTRATA, non affermata: se il
// metodo vecchio trovava 14 legami e questo ne trova 2, quel numero è
// l'informazione più utile che possiamo dare (e la più scomoda per noi).
export function comparePairwise(series, { maxLag = 3, alpha = 0.05 } = {}) {
  const frame = buildLaggedFrame(series, { maxLag });
  if (!frame.T) return { pairwise: [], mci: [], frame };

  const pairwise = [];
  for (const toName of frame.names) {
    for (const fromKey of Object.keys(frame.lagged)) {
      const [fromName, lag] = fromKey.split('@');
      if (fromName === toName) continue;
      // Bivariato "alla vecchia maniera": si condiziona SOLO sul passato di Y,
      // niente genitori, niente correzione per test multipli.
      const yOwn = frame.lagged[`${toName}@1`];
      const t = partialCorrelationTest(frame.lagged[fromKey], frame.target[toName], yOwn ? [yOwn] : []);
      if (t.p !== null && t.p <= alpha) pairwise.push({ from: fromName, to: toName, lag: Number(lag), r: t.r, p: t.p });
    }
  }
  const discovered = discoverCausalGraph(series, { maxLag, alpha });
  return {
    pairwise,
    mci: discovered.links,
    scartatiDalControllo: pairwise.length - discovered.links.length,
    frame,
  };
}
