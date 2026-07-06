// Retention layer: streak, recap settimanale, obiettivi di risparmio,
// proposta zero-input degli abbonamenti rilevati. È la risposta al vero
// motivo per cui le app di finanza personale vengono abbandonate: nessuna
// gratificazione e troppa manutenzione manuale. Tutto derivato dai dati già
// presenti — nessuna di queste funzioni chiede input nuovi all'utente,
// tranne la creazione volontaria di un obiettivo.
// Funzioni pure sui dati (pattern engines.js/advisor.js), nessun DOM.
import { detectRecurring } from './subscriptions.js';
import { descriptionSimilarity } from '../core/deduplicator.js';

const DAY_MS = 86_400_000;

function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}

function daysBetween(dayKeyA, dayKeyB) {
  const [ya, ma, ga] = dayKeyA.split('-').map(Number);
  const [yb, mb, gb] = dayKeyB.split('-').map(Number);
  return Math.round((new Date(yb, mb - 1, gb) - new Date(ya, ma - 1, ga)) / DAY_MS);
}

// Streak di giorni consecutivi in cui l'utente ha "tenuto il polso" (app
// aperta o transazione registrata). Pura: ritorna il NUOVO oggetto
// engagement, mai muta quello ricevuto. `changed` dice al chiamante se
// serve salvare.
export function touchStreak(engagement, referenceDate = new Date()) {
  const prev = engagement || { lastActiveDay: null, streak: 0, bestStreak: 0 };
  const today = dayKey(referenceDate);

  if (prev.lastActiveDay === today) {
    return { ...prev, changed: false };
  }

  let streak;
  if (!prev.lastActiveDay) {
    streak = 1;
  } else {
    const gap = daysBetween(prev.lastActiveDay, today);
    // gap 1 = giorno consecutivo; gap > 1 = catena spezzata, si riparte;
    // gap < 0 (orologio spostato indietro) non deve mai regalare progressi.
    streak = gap === 1 ? prev.streak + 1 : 1;
  }

  return {
    lastActiveDay: today,
    streak,
    bestStreak: Math.max(streak, prev.bestStreak || 0),
    changed: true,
  };
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day);
  return d;
}

function sumInRange(allTx, start, end, type) {
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  return Object.values(allTx || {}).flat()
    .filter(t => t.type === type)
    .filter(t => { const d = new Date(t.date); return d >= start && d <= endOfDay; })
    .reduce((s, t) => s + t.amount, 0);
}

// Recap dell'ULTIMA settimana completa (lun-dom) confrontata con quella
// prima: quanto hai speso, la differenza, la categoria dove è andato di più,
// quanto hai messo da parte. null se non ci sono abbastanza dati per dire
// qualcosa di vero (mai un recap inventato su zero transazioni).
export function computeWeeklyRecap(allTx, referenceDate = new Date()) {
  const thisMonday = mondayOf(referenceDate);
  const weekStart = new Date(thisMonday.getTime() - 7 * DAY_MS);   // lunedì scorso
  const weekEnd = new Date(thisMonday.getTime() - 1 * DAY_MS);     // domenica scorsa
  const prevStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const prevEnd = new Date(weekStart.getTime() - 1 * DAY_MS);

  const endOfWeek = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999);
  const weekTx = Object.values(allTx || {}).flat()
    .filter(t => { const d = new Date(t.date); return d >= weekStart && d <= endOfWeek; });
  if (weekTx.length === 0) return null;

  const totalSpent = weekTx.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0);
  const income = weekTx.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
  const prevTotalSpent = sumInRange(allTx, prevStart, prevEnd, 'uscita');

  const byCat = {};
  for (const t of weekTx) {
    if (t.type === 'uscita') byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0] || null;

  return {
    weekStart, weekEnd,
    totalSpent: +totalSpent.toFixed(2),
    prevTotalSpent: +prevTotalSpent.toFixed(2),
    // null se la settimana prima è vuota: "hai speso il ∞% in più" non è un dato.
    deltaPct: prevTotalSpent > 0 ? +(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100).toFixed(1) : null,
    topCategory: top ? { id: top[0], amount: +top[1].toFixed(2) } : null,
    saved: +(income - totalSpent).toFixed(2),
  };
}

// Progresso di un obiettivo di risparmio: risparmio netto (entrate − uscite)
// accumulato da quando l'obiettivo esiste. Con una deadline, `onTrack`
// confronta il ritmo reale con quello necessario — un fatto misurato, non
// un incoraggiamento di cortesia.
export function computeGoalProgress(goal, allTx, referenceDate = new Date()) {
  const created = new Date(goal.createdAt);
  const saved = sumInRange(allTx, created, referenceDate, 'entrata')
              - sumInRange(allTx, created, referenceDate, 'uscita');
  const pct = goal.target > 0 ? Math.min(100, Math.max(0, (saved / goal.target) * 100)) : 0;

  let onTrack = null;
  if (goal.deadline) {
    const deadline = new Date(goal.deadline);
    const totalDays = Math.max(1, Math.round((deadline - created) / DAY_MS));
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((referenceDate - created) / DAY_MS)));
    const requiredByNow = goal.target * (elapsedDays / totalDays);
    onTrack = saved >= requiredByNow;
  }

  return {
    saved: +saved.toFixed(2),
    pct: +pct.toFixed(1),
    remaining: +Math.max(0, goal.target - saved).toFixed(2),
    onTrack,
  };
}

// Proposta zero-input: serie ricorrenti rilevate nei dati che l'utente non
// ha ancora registrato come abbonamento. Un tap per registrarle — e una
// volta in `subscriptions` migliorano anche il forecast (gatherSeries in
// oracle.js le usa), quindi non è una feature cosmetica.
export function suggestSubscriptionRegistrations(allTx, knownSubscriptions = [], opts = {}) {
  const threshold = opts.similarityThreshold ?? 0.72; // stessa soglia di deduplicatore/subscriptions
  const knownNames = (knownSubscriptions || []).map(s => (typeof s === 'string' ? s : s?.name || s?.description || ''));

  return detectRecurring(allTx, opts)
    .filter(g => !knownNames.some(n => n && descriptionSimilarity(n, g.representative) >= threshold))
    .map(g => ({
      description: g.representative,
      category: g.category,
      amount: g.items[g.items.length - 1].amount, // ultimo importo, cattura aumenti già avvenuti
      avgInterval: +g.avgInterval.toFixed(1),
      occurrences: g.items.length,
    }));
}
