// ============================================================
// EXPERIMENT TRACKER — collega il grafo causale all'esperimento reale
// ============================================================
// Chiude il cerchio tra due motori costruiti separatamente: il grafo causale
// (causal-orchestrator.js) TROVA un legame nei dati passati; questo modulo
// permette di VERIFICARLO nel futuro con l'esperimento valido in ogni istante
// (anytime-experiment.js). È la funzione che nessuna app di finanza personale
// ha: non solo "sembra che X influenzi Y", ma "prova a cambiare X, te lo dico
// io — guardando quando vuoi — se Y è cambiato davvero".
//
// Stato additivo nel vault: `state.experiments = { [category]: { avviatoIl,
// baseline: [...importi settimanali PRIMA] } }`. Costruito una volta
// all'avvio dell'esperimento (baseline = fotografia del passato), mai più
// toccato — il confronto successivo usa sempre quella stessa fotografia,
// altrimenti "prima" si sposterebbe ogni volta che si guarda il risultato.
//
// Funzioni pure: lo stato del vault entra ed esce come parametro, MAI
// mutato in place (stesso stile additivo di backup-health.js/recovery-shares.js).
'use strict';

import { runExperiment } from './anytime-experiment.js';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function mondayOf(d) {
  const x = new Date(d);
  const day = x.getDay();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + (day === 0 ? -6 : 1) - day);
  return x;
}

// Somme settimanali di una categoria in uscita, dalla più vecchia alla più
// recente, nell'intervallo [start, end).
function weeklySums(allTx, category, start, end) {
  const weeks = Math.max(0, Math.round((end - start) / WEEK_MS));
  const out = new Array(weeks).fill(0);
  for (const tx of Object.values(allTx || {}).flat()) {
    if (tx.type !== 'uscita' || tx.category !== category) continue;
    const d = new Date(tx.date);
    if (d < start || d >= end) continue;
    const idx = Math.floor((d - start) / WEEK_MS);
    if (idx >= 0 && idx < weeks) out[idx] += Number(tx.amount) || 0;
  }
  return out;
}

// Avvia un esperimento su una categoria: fotografa le `settimaneBaseline`
// settimane appena trascorse come riferimento. Se un esperimento su quella
// categoria è già in corso, lo sostituisce (ricominciare è una scelta valida,
// mai bloccata — ma azzera anche il progresso già fatto, quindi la UI deve
// chiederlo, non farlo in silenzio).
export function startCategoryExperiment(experiments, category, allTx, {
  now = new Date(), settimaneBaseline = 6,
} = {}) {
  const monday = mondayOf(now);
  const start = new Date(monday.getTime() - settimaneBaseline * WEEK_MS);
  const baseline = weeklySums(allTx, category, start, monday);
  return {
    ...(experiments || {}),
    [category]: { avviatoIl: monday.toISOString(), baseline, settimaneBaseline },
  };
}

export function stopCategoryExperiment(experiments, category) {
  const out = { ...(experiments || {}) };
  delete out[category];
  return out;
}

export function activeExperiments(experiments) {
  return Object.keys(experiments || {});
}

// Lo stato attuale di un esperimento: quante settimane sono passate dall'avvio
// e cosa dice il metodo valido in ogni istante finora. Si può chiamare OGNI
// VOLTA che l'utente apre la schermata (anche più volte al giorno): è
// esattamente la proprietà per cui esiste anytime-experiment.js — guardare
// non consuma la garanzia.
export function experimentStatus(experiments, category, allTx, { now = new Date(), lo = 0, hi = null } = {}) {
  const exp = (experiments || {})[category];
  if (!exp) return null;

  const avviato = new Date(exp.avviatoIl);
  const followUp = weeklySums(allTx, category, avviato, mondayOf(now));
  const massimoStorico = Math.max(...exp.baseline, ...followUp, 1);
  const r = runExperiment({
    name: category, baseline: exp.baseline, followUp,
    lo: Number.isFinite(lo) ? lo : 0,
    hi: Number.isFinite(hi) ? hi : massimoStorico * 1.5,
    minPeriodi: 4, unita: '€',
  });
  return {
    ...r,
    category,
    avviatoIl: exp.avviatoIl,
    settimanePassate: followUp.length,
    mediaBaseline: exp.baseline.length ? +(exp.baseline.reduce((s, v) => s + v, 0) / exp.baseline.length).toFixed(2) : 0,
  };
}
