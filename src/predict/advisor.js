// Advisor giornaliero: trasforma budget settimanale, abbonamenti ricorrenti
// e forecast in UN numero comprensibile ("oggi puoi spendere X") e in pochi
// avvisi in linguaggio semplice. È il punto unico che produce gli insight
// per la UI — prima erano frasi hardcoded sparse in main.js.
//
// Il "safe to spend" è la metrica anti-abbandono per eccellenza in questa
// categoria di app: non chiede nulla, risponde all'unica domanda che l'utente
// si fa davvero ogni giorno. Qui è derivato dal budget settimanale già
// esistente (a sua volta derivato dal mensile: zero input aggiuntivi), meno
// gli addebiti ricorrenti attesi prima di fine settimana — così il numero
// non promette soldi che Netflix si porterà via dopodomani.
// Funzioni pure sui dati (pattern engines.js), nessun DOM.
import { getWeeklyStatus } from './weekly-budget.js';
import { detectRecurring, detectPriceHikes } from './subscriptions.js';
import { buildCausalGraph } from './causal-graph.js';

const DAY_MS = 86_400_000;

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Addebiti ricorrenti attesi nella finestra [referenceDate, referenceDate+horizonDays].
// Per ogni serie mensile rilevata: data attesa = ultimo addebito + intervallo
// medio; importo = ULTIMO addebito (così un aumento di prezzo già avvenuto
// viene riservato al valore nuovo, non alla vecchia media).
// Un addebito "in ritardo" (atteso pochi giorni fa ma non ancora visto) può
// arrivare da un momento all'altro: viene incluso con daysUntil 0, non
// scartato — scartarlo gonfierebbe il safe-to-spend proprio nei giorni
// in cui l'addebito è più probabile.
const OVERDUE_GRACE_DAYS = 5;

export function getUpcomingCharges(allTx, referenceDate = new Date(), horizonDays = 7, opts = {}) {
  const ref = startOfDay(referenceDate);
  const horizonEnd = new Date(ref.getTime() + horizonDays * DAY_MS);
  const charges = [];

  for (const group of detectRecurring(allTx, opts)) {
    const latest = group.items[group.items.length - 1]; // items ordinati per data
    const expected = new Date(startOfDay(new Date(latest.date)).getTime() + Math.round(group.avgInterval) * DAY_MS);
    const daysUntil = Math.round((expected - ref) / DAY_MS);

    if (daysUntil > horizonDays) continue;            // troppo lontano
    if (daysUntil < -OVERDUE_GRACE_DAYS) continue;    // così in ritardo che probabilmente è saltato/disdetto
    if (expected > horizonEnd) continue;

    charges.push({
      description: group.representative,
      category: group.category,
      amount: latest.amount,
      expectedDate: expected,
      daysUntil: Math.max(0, daysUntil),
    });
  }
  return charges.sort((a, b) => a.daysUntil - b.daysUntil);
}

// SOLDI GIÀ IMPEGNATI ("committed reserve"): quanto del tuo saldo è già
// promesso agli impegni ricorrenti in arrivo da qui a fine mese — abbonamenti
// MA anche le uscite fisse grandi (affitto, mutuo, rata prestito), che
// detectRecurring coglie perché sono mensili e stabili a prescindere dall'importo.
// È la base del "disponibile VERO": appena entra un incasso, questa quota è già
// spoken-for e NON va spesa. Onestà: solo ricorrenti realmente rilevati dai dati,
// mai stime inventate; se non c'è storia, reserved = 0. Funzione pura.
export function getMonthlyCommitments(allTx, referenceDate = new Date(), opts = {}) {
  const ref = startOfDay(referenceDate);
  const endOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const daysToEom = Math.max(0, Math.round((endOfMonth - ref) / DAY_MS));
  const items = getUpcomingCharges(allTx, ref, daysToEom, opts);
  const reserved = +items.reduce((s, c) => s + (c.amount || 0), 0).toFixed(2);
  // separa gli impegni "grandi" (fissi tipo affitto/mutuo) dai piccoli, utile
  // alla UI per spiegare da cosa è composta la riserva senza elencare tutto.
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  return {
    reserved,
    count: items.length,
    items: sorted,
    top: sorted.slice(0, 3).map(c => ({ name: c.description, amount: c.amount, daysUntil: c.daysUntil })),
    daysToEndOfMonth: daysToEom,
  };
}

// "Oggi puoi spendere X": (rimanente della settimana − ricorrenti attesi
// entro fine settimana) / giorni rimasti (oggi incluso).
// Ritorna null se non c'è un budget mensile impostato (senza budget il
// numero sarebbe inventato — meglio nessuna card che una card falsa).
export function getDailySafeToSpend({ monthTxs, allTx, monthlyBudget, referenceDate = new Date() }) {
  if (!monthlyBudget || monthlyBudget <= 0) return null;

  const { currentWeek } = getWeeklyStatus(monthTxs, monthlyBudget, referenceDate);
  if (!currentWeek) return null;

  const ref = startOfDay(referenceDate);
  const daysLeftInWeek = Math.max(1, Math.round((startOfDay(currentWeek.end) - ref) / DAY_MS) + 1);

  const daysToWeekEnd = Math.round((startOfDay(currentWeek.end) - ref) / DAY_MS);
  const upcomingCharges = getUpcomingCharges(allTx, referenceDate, daysToWeekEnd);
  const reservedForCharges = +upcomingCharges.reduce((s, c) => s + c.amount, 0).toFixed(2);

  const available = currentWeek.remaining - reservedForCharges;

  return {
    safeToday: +Math.max(0, available / daysLeftInWeek).toFixed(2),
    weekRemaining: currentWeek.remaining,
    daysLeftInWeek,
    reservedForCharges,
    upcomingCharges,
    isOverBudget: currentWeek.remaining < 0,
  };
}

// Proiezione fine mese. Se disponibile usa il livello giornaliero Holt-Winters
// del forecast worker (spesa giornaliera "tipica" già destagionalizzata),
// altrimenti il run-rate del mese (speso finora / giorni trascorsi).
// `method` dichiara sempre quale stima è stata usata — mai spacciare un
// run-rate per un forecast.
export function getMonthEndProjection({ monthTxs, monthlyBudget = 0, referenceDate = new Date(), hwDailyLevel = null }) {
  const ref = startOfDay(referenceDate);
  const dayOfMonth = ref.getDate();
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const endOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  const spentSoFar = +(monthTxs || [])
    .filter(t => t.type === 'uscita' && new Date(t.date) <= endOfToday)
    .reduce((s, t) => s + t.amount, 0).toFixed(2);

  const useHW = typeof hwDailyLevel === 'number' && isFinite(hwDailyLevel) && hwDailyLevel >= 0;
  const dailyRate = useHW ? hwDailyLevel : spentSoFar / dayOfMonth;

  const projectedTotal = +(spentSoFar + dailyRate * daysRemaining).toFixed(2);
  const projectedDelta = monthlyBudget > 0 ? +(monthlyBudget - projectedTotal).toFixed(2) : null;

  return {
    spentSoFar,
    projectedTotal,
    projectedDelta,
    willOverspend: projectedDelta !== null && projectedDelta < 0,
    daysRemaining,
    method: useHW ? 'holt-winters' : 'run-rate',
  };
}

// Sweep del salvadanaio: se la settimana SCORSA è chiusa in avanzo, proponi
// di metterlo da parte (verso il primo obiettivo, o il salvadanaio se non
// ce ne sono) — un tocco, mai automatico: spostare soldi è una decisione
// dell'utente. `lastSweepWeek` (chiave lunedì corrente) evita di riproporre.
export function getSweepSuggestion({ allTx, monthlyBudget, savingsGoals = [], lastSweepWeek = null, referenceDate = new Date() }) {
  if (!monthlyBudget || monthlyBudget <= 0) return null;

  const ref = startOfDay(referenceDate);
  const day = ref.getDay();
  const thisMonday = new Date(ref);
  thisMonday.setDate(thisMonday.getDate() + (day === 0 ? -6 : 1) - day);
  const weekKey = `${thisMonday.getFullYear()}-${String(thisMonday.getMonth() + 1).padStart(2, '0')}-${String(thisMonday.getDate()).padStart(2, '0')}`;
  if (lastSweepWeek === weekKey) return null; // già fatto questa settimana

  // stato della settimana scorsa, osservata dalla sua domenica
  const lastSunday = new Date(thisMonday.getTime() - DAY_MS);
  const mk = `${lastSunday.getFullYear()}-${String(lastSunday.getMonth() + 1).padStart(2, '0')}`;
  const { weeks } = getWeeklyStatus(allTx?.[mk] || [], monthlyBudget, lastSunday);
  const lastWeek = weeks.find(w => w.isCurrent);
  if (!lastWeek || lastWeek.remaining < 10) return null; // niente avanzo significativo

  return {
    amount: +lastWeek.remaining.toFixed(2),
    goalId: savingsGoals[0]?.id ?? null,
    goalName: savingsGoals[0]?.name ?? null,
    weekKey,
  };
}

// Consolidatore: unico produttore degli insight per la UI. Ogni insight è
// { kind, severity: 'info'|'warn'|'danger', title, body, action?, items? }.
// Linguaggio volutamente semplice (regola "lo capirebbe un bambino di 8
// anni"): mai gergo statistico nei testi mostrati.
export function getAdvisorInsights({ allTx, monthTxs, monthlyBudget = 0, referenceDate = new Date(), hwDailyLevel = null, staleness = null, savingsGoals = [], lastSweepWeek = null }) {
  const insights = [];
  const fmt = n => `${n.toFixed(2).replace('.', ',')}€`;

  // Sweep dell'avanzo della settimana scorsa (salvadanaio → obiettivo)
  const sweep = getSweepSuggestion({ allTx, monthlyBudget, savingsGoals, lastSweepWeek, referenceDate });
  if (sweep) {
    insights.push({
      kind: 'sweep', severity: 'info',
      title: `Hai avanzato ${fmt(sweep.amount)} la settimana scorsa`,
      body: sweep.goalName
        ? `Li metto da parte per "${sweep.goalName}"? Un tocco e il tuo obiettivo fa un passo avanti.`
        : `Li metto nel salvadanaio? Un tocco e sono al sicuro.`,
      action: { label: 'Sì, mettili da parte', handler: 'applySweep', payload: sweep },
    });
  }

  const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget, referenceDate });
  if (sts) {
    const chargeNote = sts.reservedForCharges > 0
      ? ` Ho già messo da parte ${fmt(sts.reservedForCharges)} per gli abbonamenti in arrivo.`
      : '';
    insights.push(sts.isOverBudget ? {
      kind: 'safe-to-spend', severity: 'danger',
      title: 'Fermati: questa settimana hai già speso troppo',
      body: `Sei oltre di ${fmt(Math.abs(sts.weekRemaining))}. Ogni giorno senza spese ti rimette in pari.`,
      data: sts,
    } : {
      kind: 'safe-to-spend', severity: 'info',
      title: `Oggi puoi spendere ${fmt(sts.safeToday)}`,
      body: `Ti restano ${fmt(sts.weekRemaining)} per questa settimana (${sts.daysLeftInWeek} giorni).${chargeNote}`,
      data: sts,
    });
  }

  if (monthlyBudget > 0) {
    const proj = getMonthEndProjection({ monthTxs, monthlyBudget, referenceDate, hwDailyLevel });
    if (proj.daysRemaining > 0 && proj.spentSoFar > 0) {
      insights.push(proj.willOverspend ? {
        kind: 'month-end', severity: 'warn',
        title: `Così finisci il mese a ${fmt(proj.projectedDelta)}`,
        body: `Hai speso ${fmt(proj.spentSoFar)}. Se continui così arrivi a ${fmt(proj.projectedTotal)} su ${fmt(monthlyBudget)} (stima).`,
        data: proj,
      } : {
        kind: 'month-end', severity: 'info',
        title: `Di questo passo ti avanzano ${fmt(proj.projectedDelta)}`,
        body: `Hai speso ${fmt(proj.spentSoFar)}. A fine mese saresti a ${fmt(proj.projectedTotal)} su ${fmt(monthlyBudget)} (stima).`,
        data: proj,
      });
    }
  }

  const hikes = detectPriceHikes(allTx);
  if (hikes.length > 0) {
    insights.push({
      kind: 'price-hike', severity: 'warn',
      title: 'Abbonamenti aumentati di prezzo',
      body: 'Questi costi sono saliti senza che tu abbia cambiato nulla:',
      items: hikes,
    });
  }

  // Legame più forte scoperto nel grafo causale: una scoperta sui PROPRI
  // dati vale più di un consiglio generico. Mostrato solo se robusto
  // (|r| ≥ 0.6 e abbastanza settimane) — mai nessi deboli spacciati per veri.
  try {
    const links = buildCausalGraph(allTx, referenceDate);
    const top = links.find(l => Math.abs(l.r) >= 0.6 && l.samples >= 10);
    if (top) {
      const verso = top.r > 0 ? 'sale anche' : 'scende';
      insights.push({
        kind: 'causal', severity: 'info',
        title: 'Le tue spese si muovono insieme',
        body: `Nei tuoi dati, quando sale ${top.from}, di solito ${verso} ${top.to}${top.lagWeeks > 0 ? ' la settimana dopo' : ' nella stessa settimana'} (visto su ${top.samples} settimane).`,
        data: top,
      });
    }
  } catch (_) { /* grafo non calcolabile con questi dati: nessuna card */ }

  if (staleness && staleness.stale && staleness.suggestion) {
    insights.push({
      kind: 'budget-stale', severity: 'info',
      title: 'Budget da aggiornare',
      body: `Il tetto attuale è ${staleness.diffPct}% ${staleness.direction} la tua spesa media reale (${fmt(staleness.suggestion.rawAverage)}).`,
      action: { label: `Aggiorna a ${fmt(staleness.suggestion.suggested)}`, handler: 'applyBudgetSuggestion', payload: staleness.suggestion.suggested },
    });
  }

  const rank = { danger: 0, warn: 1, info: 2 };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
