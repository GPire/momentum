// ============================================================
// CALIBRAZIONE DELLA CASSA UNICA — la previsione si verifica da sola
// ============================================================
// Due lacune trovate nella stessa ricerca (2026-09-11): (1) "Cassa Unica più
// intelligente" — oggi il motore (cash-forecast.js) è misurato una volta sola
// contro un backtest sintetico (bench/cash-forecast-bench.mjs), mai contro le
// PROPRIE previsioni passate di un utente reale; (2) "Dashboard a valore
// continuativo" — l'"effetto laurea" (ANALISI_COMPETITOR.md §7): una volta
// capito il budget, l'utente smette di aprire l'app perché non c'è più nulla
// di nuovo da vedere. Questo modulo risolve entrambe insieme: SALVA un'istantanea
// della previsione di oggi, e più avanti CONFRONTA quell'istantanea con quello
// che è successo per davvero — un motivo genuino per tornare ("la previsione
// di 14 giorni fa aveva ragione?"), e un modo reale di sapere se la banda
// prudente/fortunato dichiarata all'80% lo è DAVVERO per QUESTO utente,
// non solo nel bench sintetico.
//
// Onestà (regola #1): non tocca il motore di previsione (cash-forecast.js
// resta invariato) — è un livello di OSSERVAZIONE sopra, mai una seconda
// formula. Se una previsione era relativa (nessun saldo dichiarato,
// `forecast.relative === true`, `startBalance` a 0 per costruzione), il
// confronto si riduce a "il flusso netto reale nella finestra è caduto dentro
// la banda?" — esattamente lo stesso confronto, nessun caso speciale.
// Funzioni pure, nessun DOM, nessun accesso a VaultDAO: chi chiama decide
// come/se persistere le istantanee.
'use strict';

const r2 = (n) => Math.round(n * 100) / 100;

// Cattura i checkpoint scelti (default 7/14/30 giorni) dal `path` di un
// `cashForecast()` già calcolato — nessun ricalcolo. `null` se il forecast
// non è utilizzabile (dati insufficienti) o non copre nessuno dei checkpoint
// richiesti (orizzonte troppo corto).
export function snapshotForecast(forecast, { now = Date.now(), checkpoints = [7, 14, 30] } = {}) {
  if (!forecast || !forecast.known || !Array.isArray(forecast.path)) return null;
  const targets = checkpoints
    .map((days) => forecast.path.find((p) => p.inDays === days))
    .filter(Boolean)
    .map((p) => ({ daysAhead: p.inDays, date: p.date, p10: p.p10, p50: p.p50, p90: p.p90 }));
  if (!targets.length) return null;
  return {
    takenAt: new Date(now).toISOString().slice(0, 10),
    startBalance: forecast.startBalance ?? 0,
    relative: !!forecast.relative,
    targets,
  };
}

// Flusso netto REALE fra due date incluse — stessa convenzione di segno già
// in uso ovunque nel progetto per la liquidità (entrata +, uscita/invest -,
// vedi computeSafeSweepEstimate in main.js): NON una seconda definizione.
function netFlowBetween(allTx, fromMs, toMs) {
  let net = 0;
  for (const txs of Object.values(allTx || {})) {
    for (const t of (txs || [])) {
      if (!t || !t.date) continue;
      const d = Date.parse(t.date);
      if (!(d >= fromMs && d <= toMs)) continue;
      if (t.type === 'entrata') net += +t.amount || 0;
      else if (t.type === 'uscita') net -= +t.amount || 0;
      else if (t.type === 'invest') net -= +t.amount || 0;
    }
  }
  return net;
}

// Confronta UNA istantanea con quello che è successo per davvero, SOLO per i
// checkpoint la cui data è già passata (gli altri restano non ancora
// verificabili — mai un confronto anticipato). `allTx` = VaultDAO.state.transactions
// (o equivalente), stessa struttura per-mese usata in tutto il progetto.
export function evaluateSnapshot(snapshot, allTx, { now = Date.now() } = {}) {
  if (!snapshot) return [];
  const takenAtMs = Date.parse(snapshot.takenAt);
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  const out = [];
  for (const target of snapshot.targets) {
    const targetMs = Date.parse(target.date);
    if (targetMs > today) continue; // non ancora verificabile: si tace, non si stima
    const actual = r2(snapshot.startBalance + netFlowBetween(allTx, takenAtMs, targetMs));
    out.push({
      daysAhead: target.daysAhead,
      date: target.date,
      predicted: { p10: target.p10, p50: target.p50, p90: target.p90 },
      actual,
      withinBand: actual >= target.p10 && actual <= target.p90,
      errorP50: r2(actual - target.p50),
    });
  }
  return out;
}

// Valuta OGNI istantanea salvata (array, la più vecchia per prima) e ritorna
// solo le valutazioni con almeno un checkpoint già passato — pronte da
// mostrare o da aggregare. Le istantanee già valutate una volta restano
// valutabili di nuovo (idempotente: stesso input, stesso output), è compito
// del chiamante decidere se un checkpoint è già stato mostrato.
export function evaluateAllSnapshots(snapshots, allTx, opts = {}) {
  return (snapshots || [])
    .map((s) => ({ takenAt: s.takenAt, evaluations: evaluateSnapshot(s, allTx, opts) }))
    .filter((s) => s.evaluations.length > 0);
}

// Riepilogo di calibrazione su TUTTE le valutazioni passate di un utente: la
// banda dichiara "80% dei casi dentro" (Z90 in cash-forecast.js) — qui si
// misura se è vero DAVVERO per questo utente, non solo nel bench sintetico.
// Richiede un minimo di osservazioni (default 5) per non dichiarare un
// verdetto su 1-2 casi, statisticamente vuoto.
export function calibrationSummary(evaluations, { minObservations = 5 } = {}) {
  const flat = evaluations.flat();
  if (flat.length < minObservations) {
    return { known: false, count: flat.length, minObservations, reason: 'non abbastanza previsioni verificate ancora' };
  }
  const within = flat.filter((e) => e.withinBand).length;
  const withinPct = +((within / flat.length) * 100).toFixed(1);
  return {
    known: true,
    count: flat.length,
    withinBandPct: withinPct,
    declaredTargetPct: 80, // Z90 = banda 10°-90° percentile, teoricamente 80%
    // Scostamento dal dichiarato: positivo = la banda è più larga (prudente)
    // del necessario, negativo = più stretta (ottimista) di quanto dovrebbe.
    deltaFromDeclared: +(withinPct - 80).toFixed(1),
  };
}
