// ============================================================
// ACHIEVEMENTS — Wave 3 v10: riconoscimento onesto, dopamina vera
// ============================================================
// Gamification alla Streaks (che "hackera il centro di ricompensa") MA
// onesta: ogni traguardo è un FATTO MISURATO dai dati reali dell'utente, mai
// un badge regalato ("hai aperto l'app"). Include la dopamina ANTICIPATORIA —
// il vero motore di Streaks — via nextMilestone ("sei a 5/7"). Funzioni pure,
// nessun DOM, idempotente: un traguardo si sblocca una volta sola.
'use strict';

import { computeGoalProgress } from './engagement.js';
import { t as tAch } from '../i18n/ui-strings.js';

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Ogni achievement: check(stats) → bool, e (per i progressivi) progress(stats)
// → { current, target } per la dopamina anticipatoria. SOLO metriche misurate.
export const ACHIEVEMENTS = [
  { id: 'first-step', name: 'Primo passo', icon: '🌱', desc: 'La tua prima transazione registrata.', check: s => s.txCount >= 1, progress: s => ({ current: Math.min(s.txCount, 1), target: 1 }) },
  { id: 'getting-serious', name: 'Ci prendi gusto', icon: '📈', desc: '50 transazioni registrate.', check: s => s.txCount >= 50, progress: s => ({ current: Math.min(s.txCount, 50), target: 50 }) },
  { id: 'veteran', name: 'Veterano', icon: '🏛️', desc: '500 transazioni: conosci i tuoi soldi.', check: s => s.txCount >= 500, progress: s => ({ current: Math.min(s.txCount, 500), target: 500 }) },
  { id: 'streak-3', name: 'Tre di fila', icon: '🔥', desc: '3 giorni di fila con l\'app.', check: s => s.bestStreak >= 3, progress: s => ({ current: Math.min(s.bestStreak, 3), target: 3 }) },
  { id: 'streak-7', name: 'Settimana piena', icon: '🔥', desc: '7 giorni di fila.', check: s => s.bestStreak >= 7, progress: s => ({ current: Math.min(s.bestStreak, 7), target: 7 }) },
  { id: 'streak-30', name: 'Un mese intero', icon: '⚡', desc: '30 giorni di fila: è un\'abitudine.', check: s => s.bestStreak >= 30, progress: s => ({ current: Math.min(s.bestStreak, 30), target: 30 }) },
  { id: 'streak-100', name: 'Inarrestabile', icon: '💯', desc: '100 giorni di fila.', check: s => s.bestStreak >= 100, progress: s => ({ current: Math.min(s.bestStreak, 100), target: 100 }) },
  { id: 'first-saved', name: 'Primo gruzzolo', icon: '🏦', desc: 'Hai messo da parte i primi soldi.', check: s => s.totalSaved > 0 },
  { id: 'under-budget', name: 'Sotto controllo', icon: '✅', desc: 'Un mese chiuso sotto budget.', check: s => s.monthsUnderBudget >= 1 },
  { id: 'first-goal', name: 'Obiettivo raggiunto', icon: '🎯', desc: 'Hai completato un obiettivo di risparmio.', check: s => s.goalsDone >= 1 },
  { id: 'consistency', name: 'Costanza', icon: '📆', desc: '3 mesi di storia tracciata.', check: s => s.monthsTracked >= 3, progress: s => ({ current: Math.min(s.monthsTracked, 3), target: 3 }) },
];

// id → chiavi i18n (2026-08-29). ACHIEVEMENTS resta invariato (id/name/desc/
// icon in italiano, stessa forma di sempre — letto ancora così da chi non
// passa una lingua) — achievementLabel() è il punto unico da cui main.js e
// nextMilestone() leggono la versione tradotta, mai due mappe a rischio di
// disallinearsi.
const ACH_KEYS = {
  'first-step': { name: 'achFirstStepName', desc: 'achFirstStepDesc' },
  'getting-serious': { name: 'achGettingSeriousName', desc: 'achGettingSeriousDesc' },
  veteran: { name: 'achVeteranName', desc: 'achVeteranDesc' },
  'streak-3': { name: 'achStreak3Name', desc: 'achStreak3Desc' },
  'streak-7': { name: 'achStreak7Name', desc: 'achStreak7Desc' },
  'streak-30': { name: 'achStreak30Name', desc: 'achStreak30Desc' },
  'streak-100': { name: 'achStreak100Name', desc: 'achStreak100Desc' },
  'first-saved': { name: 'achFirstSavedName', desc: 'achFirstSavedDesc' },
  'under-budget': { name: 'achUnderBudgetName', desc: 'achUnderBudgetDesc' },
  'first-goal': { name: 'achFirstGoalName', desc: 'achFirstGoalDesc' },
  consistency: { name: 'achConsistencyName', desc: 'achConsistencyDesc' },
};

// Traduce nome+descrizione di un achievement per id. Ripiega sul testo
// italiano grezzo di ACHIEVEMENTS se l'id non è mappato (non dovrebbe mai
// succedere: ACH_KEYS copre tutti gli id sopra, verificato da un test).
export function achievementLabel(id, lang = 'it') {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return null;
  const k = ACH_KEYS[id];
  return {
    id, icon: a.icon,
    name: k ? tAch(k.name, lang) : a.name,
    desc: k ? tAch(k.desc, lang) : a.desc,
  };
}

// Metriche misurate dallo stato del vault. Esclude il mese CORRENTE (parziale)
// dal conteggio "mesi sotto budget": a inizio mese si è sempre sotto, contarlo
// sarebbe un traguardo regalato.
export function computeStats(state = {}, referenceDate = new Date()) {
  const allTx = state.transactions || {};
  const currentMk = monthKeyOf(referenceDate);
  let txCount = 0, totalSaved = 0;
  const months = new Set();
  for (const [mk, arr] of Object.entries(allTx)) {
    if (!arr || !arr.length) continue;
    months.add(mk);
    for (const t of arr) { txCount++; if (t.type === 'invest') totalSaved += Math.abs(t.amount); }
  }
  const budget = state.monthlyBudget || 0;
  let monthsUnderBudget = 0;
  if (budget > 0) {
    for (const mk of months) {
      if (mk === currentMk) continue; // mese in corso: parziale, non giudicabile
      const spent = (allTx[mk] || []).filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0);
      if (spent > 0 && spent <= budget) monthsUnderBudget++;
    }
  }
  const goalsDone = (state.savingsGoals || []).filter(g => {
    try { return computeGoalProgress(g, allTx, referenceDate).pct >= 100; } catch (_) { return false; }
  }).length;
  return {
    txCount, totalSaved, monthsTracked: months.size, monthsUnderBudget, goalsDone,
    bestStreak: state.engagement?.bestStreak || 0, streak: state.engagement?.streak || 0,
  };
}

// Valuta i traguardi. `unlocked` = mappa { id: isoDate } già sbloccati.
// Ritorna { unlocked (aggiornata), newly: [id] } — newly SOLO al primo
// sblocco (idempotente). Un traguardo non si revoca mai (no ansia da perdita).
export function evaluateAchievements(unlocked = {}, stats, referenceDate = new Date()) {
  const out = { ...unlocked };
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!out[a.id] && a.check(stats)) {
      out[a.id] = referenceDate.toISOString();
      newly.push(a.id);
    }
  }
  return { unlocked: out, newly };
}

// Dopamina anticipatoria: il traguardo progressivo NON ancora sbloccato più
// vicino (percentuale di completamento più alta). Ritorna { id, name, icon,
// current, target, pct } | null se non ci sono progressivi in corso.
export function nextMilestone(unlocked = {}, stats, lang = 'it') {
  let best = null;
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id] || !a.progress) continue;
    const { current, target } = a.progress(stats);
    if (current >= target) continue;
    const pct = target > 0 ? current / target : 0;
    if (!best || pct > best.pct) {
      const label = achievementLabel(a.id, lang);
      best = { id: a.id, name: label.name, icon: label.icon, desc: label.desc, current, target, pct: +pct.toFixed(3) };
    }
  }
  return best;
}
