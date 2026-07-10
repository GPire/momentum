// Motore Q&A on-device: risponde in linguaggio naturale alle domande
// dell'utente sui PROPRI dati, calcolando la risposta con i motori già
// verificati del progetto (advisor, subscriptions, engagement) — mai frasi
// generiche. Differenza strutturale rispetto a un chatbot cloud: la risposta
// nasce dai numeri veri dell'utente, sul dispositivo, anche offline, e ogni
// intent è deterministico e testabile. Quando non sa rispondere lo dice
// (intent 'unknown'), non inventa — stessa disciplina del resto del progetto.
//
// Funzioni pure: tutto lo stato arriva dal chiamante via `ctx`
// { allTx, monthlyBudget, savingsGoals, referenceDate, hwDailyLevel }.
import { getDailySafeToSpend, getMonthEndProjection, getUpcomingCharges } from '../predict/advisor.js';
import { detectRecurring } from '../predict/subscriptions.js';
import { computeGoalProgress } from '../predict/engagement.js';
import { buildCausalGraph, propagateImpact } from '../predict/causal-graph.js';
import { investableSurplus } from '../alpha/bridge.js';
import { monthKey } from '../core/constants.js';

// Media mensile di uscite ed entrate + fondo d'emergenza stimato (investimenti
// accumulati) dallo storico — per rispondere "quanto posso investire".
function monthlyFinance(allTx, ref) {
  const months = {};
  let invested = 0;
  for (const t of Object.values(allTx || {}).flat()) {
    const mk = (t.date || '').slice(0, 7);
    if (!mk) continue;
    const m = months[mk] = months[mk] || { inc: 0, out: 0 };
    if (t.type === 'entrata') m.inc += t.amount;
    else if (t.type === 'uscita') m.out += t.amount;
    else if (t.type === 'invest') invested += t.amount;
  }
  const keys = Object.keys(months);
  const n = keys.length || 1;
  const avgExp = keys.reduce((s, k) => s + months[k].out, 0) / n;
  const thisMk = monthKey(ref);
  const cur = months[thisMk] || { inc: 0, out: 0 };
  return { avgMonthlyExpense: avgExp, netMonthlyFlow: cur.inc - cur.out, invested };
}

const MONTH_NAMES = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

const fmt = n => `${(+n).toFixed(2).replace('.', ',')}€`;

// Periodo citato nella domanda → {start, end, label}. Default: mese corrente.
function resolvePeriod(q, ref) {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(ref);

  if (/\boggi\b/.test(q)) return { start: today, end: today, label: 'oggi' };
  if (/\bieri\b/.test(q)) {
    const y = new Date(today.getTime() - 86_400_000);
    return { start: y, end: y, label: 'ieri' };
  }
  if (/questa settimana/.test(q)) {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1) - day);
    return { start: monday, end: today, label: 'questa settimana' };
  }
  if (/(mese scorso|scorso mese)/.test(q)) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    return { start, end: new Date(ref.getFullYear(), ref.getMonth(), 0), label: 'il mese scorso' };
  }
  for (let i = 0; i < 12; i++) {
    if (q.includes(MONTH_NAMES[i])) {
      // il mese nominato più recente non nel futuro (a luglio, "giugno" = giugno di quest'anno)
      const year = i <= ref.getMonth() ? ref.getFullYear() : ref.getFullYear() - 1;
      return { start: new Date(year, i, 1), end: new Date(year, i + 1, 0), label: `a ${MONTH_NAMES[i]}` };
    }
  }
  return { start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0), label: 'questo mese' };
}

function txInPeriod(allTx, period) {
  const endOfDay = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate(), 23, 59, 59, 999);
  return Object.values(allTx || {}).flat()
    .filter(t => { const d = new Date(t.date); return d >= period.start && d <= endOfDay; });
}

function extractAmount(q) {
  const m = q.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

export function answerQuestion(question, ctx) {
  const q = (question || '').toLowerCase().trim();
  const ref = ctx.referenceDate || new Date();
  const allTx = ctx.allTx || {};
  const monthTxs = allTx[monthKey(ref)] || [];
  if (!q) return { intent: 'unknown', answer: 'Fammi una domanda sui tuoi soldi: spese, risparmi, budget, abbonamenti, obiettivi, investimenti.' };

  // — "quanto posso investire?" (motore alpha/bridge: fondo emergenza prima)
  if (/(quanto posso investire|posso investire|quanto investire|investire questo mese)/.test(q)) {
    const f = monthlyFinance(allTx, ref);
    const r = investableSurplus({
      netMonthlyFlow: f.netMonthlyFlow,
      avgMonthlyExpense: f.avgMonthlyExpense,
      currentEmergencyFund: ctx.emergencyFund ?? f.invested,
      emergencyMonths: ctx.emergencyMonths ?? 6,
    });
    return { intent: 'invest', data: r, answer: r.note };
  }

  // — "posso permettermi X?" (prima di "quanto posso spendere": contiene un importo)
  if (/(posso permettermi|posso spendere|ce la faccio a spendere|posso comprare)/.test(q) && extractAmount(q) !== null) {
    const amount = extractAmount(q);
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'affordability', answer: `Per risponderti mi serve un budget mensile impostato — toccalo nella sezione Analisi e te lo dico subito.` };
    if (sts.isOverBudget) return { intent: 'affordability', data: sts, answer: `Meglio di no: questa settimana sei già oltre di ${fmt(Math.abs(sts.weekRemaining))}. Se puoi, rimanda.` };
    if (amount <= sts.safeToday) return { intent: 'affordability', data: sts, answer: `Sì: ${fmt(amount)} rientrano nei ${fmt(sts.safeToday)} di oggi. Dopo ti resterebbero ${fmt(sts.safeToday - amount)} per la giornata.` };
    if (amount <= sts.weekRemaining - sts.reservedForCharges) return { intent: 'affordability', data: sts, answer: `Sì, ma usa il margine della settimana: oggi il tuo ritmo sarebbe ${fmt(sts.safeToday)}, spendendone ${fmt(amount)} dovrai stare più leggero nei prossimi ${sts.daysLeftInWeek - 1} giorni.` };
    return { intent: 'affordability', data: sts, answer: `Rischioso: ti restano ${fmt(Math.max(0, sts.weekRemaining))} per tutta la settimana${sts.reservedForCharges > 0 ? ` (di cui ${fmt(sts.reservedForCharges)} già impegnati per gli abbonamenti)` : ''}. ${fmt(amount)} ti manderebbero oltre.` };
  }

  // — "quanto posso spendere oggi?"
  if (/(quanto posso spendere|cosa posso spendere|budget di oggi|quanto mi resta oggi)/.test(q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'safe-to-spend', answer: 'Imposta prima un budget mensile (sezione Analisi): da lì calcolo quanto puoi spendere ogni giorno.' };
    if (sts.isOverBudget) return { intent: 'safe-to-spend', data: sts, answer: `Oggi meglio niente: questa settimana sei oltre di ${fmt(Math.abs(sts.weekRemaining))}.` };
    return { intent: 'safe-to-spend', data: sts, answer: `Oggi puoi spendere ${fmt(sts.safeToday)}. Ti restano ${fmt(sts.weekRemaining)} per la settimana (${sts.daysLeftInWeek} giorni)${sts.reservedForCharges > 0 ? `, ${fmt(sts.reservedForCharges)} già da parte per gli abbonamenti in arrivo` : ''}.` };
  }

  // — "quanto mi resta questa settimana / del budget?"
  if (/(quanto (mi )?resta|quanto rimane)/.test(q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'budget-left', answer: 'Non hai ancora un budget impostato: senza, "quanto resta" non ha una risposta vera.' };
    return { intent: 'budget-left', data: sts, answer: sts.isOverBudget ? `Sei oltre di ${fmt(Math.abs(sts.weekRemaining))} questa settimana.` : `${fmt(sts.weekRemaining)} per questa settimana, ${fmt(sts.safeToday)} se li spalmi sui ${sts.daysLeftInWeek} giorni che mancano.` };
  }

  // — "come finisco il mese?" / proiezione
  if (/(fine mese|chiudo il mese|finisco il mese|proiezione|previsione)/.test(q)) {
    const proj = getMonthEndProjection({ monthTxs, monthlyBudget: ctx.monthlyBudget || 0, referenceDate: ref, hwDailyLevel: ctx.hwDailyLevel ?? null });
    if (!ctx.monthlyBudget) return { intent: 'month-end', data: proj, answer: `Hai speso ${fmt(proj.spentSoFar)} finora; di questo passo arrivi a ${fmt(proj.projectedTotal)} a fine mese. Imposta un budget e ti dico anche se ci stai dentro.` };
    return { intent: 'month-end', data: proj, answer: proj.willOverspend
      ? `Attento: hai speso ${fmt(proj.spentSoFar)} e di questo passo chiudi a ${fmt(proj.projectedTotal)}, cioè ${fmt(Math.abs(proj.projectedDelta))} oltre il budget (stima ${proj.method === 'holt-winters' ? 'sul tuo andamento reale' : 'sul ritmo del mese'}).`
      : `Bene: hai speso ${fmt(proj.spentSoFar)} e di questo passo chiudi a ${fmt(proj.projectedTotal)}, con ${fmt(proj.projectedDelta)} di margine.` };
  }

  // — abbonamenti: "quali abbonamenti pago" / "quando pago Netflix"
  if (/(abbonament|quando pago|pagamenti ricorrenti|spese fisse)/.test(q)) {
    const recurring = detectRecurring(allTx);
    if (recurring.length === 0) return { intent: 'subscriptions', answer: 'Non vedo ancora addebiti ricorrenti nei tuoi dati.' };
    const named = recurring.find(g => q.includes(g.representative.toLowerCase().split(/[^a-z0-9]+/)[0]));
    if (named && /quando/.test(q)) {
      const upcoming = getUpcomingCharges(allTx, ref, 40).find(c => c.description === named.representative);
      if (upcoming) return { intent: 'subscriptions', data: upcoming, answer: `${named.representative}: prossimo addebito di ${fmt(upcoming.amount)} previsto ${upcoming.daysUntil === 0 ? 'a momenti' : `tra ${upcoming.daysUntil} giorni`} (${upcoming.expectedDate.toLocaleDateString('it-IT')}).` };
    }
    const total = recurring.reduce((s, g) => s + g.items[g.items.length - 1].amount, 0);
    return { intent: 'subscriptions', data: recurring, answer: `Paghi ${recurring.length} abbonament${recurring.length === 1 ? 'o' : 'i'} per ${fmt(total)} al mese: ${recurring.map(g => `${g.representative} (${fmt(g.items[g.items.length - 1].amount)})`).join(', ')}.` };
  }

  // — ragionamento a catena: "cosa succede se spendo di più in X?"
  // Risposta dal grafo di co-variazione misurato sui dati veri (correlazioni
  // sulle differenze settimanali, soglie dichiarate) — mai nessi inventati.
  if (/(cosa succede se|se spendo di più|se aumento|cosa si muove con|cosa cambia se)/.test(q)) {
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    if (!namedCat) return { intent: 'causal', answer: 'Dimmi la categoria: ad esempio "cosa succede se spendo di più in Ristorante?"' };
    const links = buildCausalGraph(allTx, ref);
    const effects = propagateImpact(links, namedCat, 30); // scenario: +30%
    if (effects.length === 0) return { intent: 'causal', answer: `Nei tuoi dati non vedo altre spese che si muovono insieme a ${namedCat}: aumentarla non dovrebbe trascinare altro.` };
    const parts = effects.slice(0, 3).map(e =>
      `${e.category} ${e.expectedPct > 0 ? 'sale' : 'scende'} di solito del ${Math.abs(e.expectedPct)}%${e.lagWeeks > 0 ? ' la settimana dopo' : ''}`);
    return { intent: 'causal', data: effects, answer: `Nei tuoi dati, quando sale ${namedCat} (+30%): ${parts.join('; ')}. Non è una legge, è quello che è successo finora nelle tue settimane.` };
  }

  // — "dove spendo di più?" (prima di "quanto ho speso": è una domanda di distribuzione)
  if (/(dove spendo|dove vanno|in cosa spendo|categoria più|top categor)/.test(q)) {
    const period = resolvePeriod(q, ref);
    const spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    if (spese.length === 0) return { intent: 'top-category', answer: `Nessuna spesa registrata ${period.label}.` };
    const byCat = {};
    spese.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totale = spese.reduce((s, t) => s + t.amount, 0);
    return { intent: 'top-category', data: top, answer: `${period.label[0].toUpperCase()}${period.label.slice(1)} la voce più pesante è ${top[0][0]} con ${fmt(top[0][1])} (${((top[0][1] / totale) * 100).toFixed(0)}% del totale)${top[1] ? `, poi ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` e ${top[2][0]} (${fmt(top[2][1])})` : ''}.` };
  }

  // — "quanto ho risparmiato / messo da parte?"
  if (/(risparmiat|messo da parte|risparmio)/.test(q)) {
    const period = resolvePeriod(q, ref);
    const txs = txInPeriod(allTx, period);
    const inc = txs.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    const out = txs.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0);
    const net = inc - out;
    return { intent: 'savings', data: { inc, out, net }, answer: net >= 0
      ? `${period.label[0].toUpperCase()}${period.label.slice(1)} hai messo da parte ${fmt(net)} (${fmt(inc)} entrati, ${fmt(out)} usciti).`
      : `${period.label[0].toUpperCase()}${period.label.slice(1)} hai speso ${fmt(Math.abs(net))} più di quanto è entrato (${fmt(inc)} entrati, ${fmt(out)} usciti).` };
  }

  // — "quanto ho guadagnato / entrate?"
  if (/(guadagnat|entrate|incassat|quanto è entrato)/.test(q)) {
    const period = resolvePeriod(q, ref);
    const inc = txInPeriod(allTx, period).filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    return { intent: 'income', data: { inc }, answer: `${period.label[0].toUpperCase()}${period.label.slice(1)}: ${fmt(inc)} di entrate.` };
  }

  // — "quanto ho speso [periodo] [in categoria]?"
  if (/(quanto ho speso|quanto abbiamo speso|spese di|quanto spendo|le mie spese)/.test(q)) {
    const period = resolvePeriod(q, ref);
    let spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    // filtro categoria: la domanda nomina una categoria presente nei dati?
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    if (namedCat) spese = spese.filter(t => t.category === namedCat);
    const tot = spese.reduce((s, t) => s + t.amount, 0);
    return { intent: 'spent', data: { tot, count: spese.length, period, category: namedCat || null }, answer: `${period.label[0].toUpperCase()}${period.label.slice(1)} hai speso ${fmt(tot)}${namedCat ? ` in ${namedCat}` : ''} (${spese.length} movimenti).` };
  }

  // — obiettivi: "a che punto è / come va il mio obiettivo?"
  if (/(obiettivo|obbiettivo|goal)/.test(q)) {
    const goals = ctx.savingsGoals || [];
    if (goals.length === 0) return { intent: 'goal', answer: 'Non hai ancora obiettivi di risparmio. Ne creiamo uno dalla sezione Analisi?' };
    const named = goals.find(g => q.includes(g.name.toLowerCase())) || goals[0];
    const prog = computeGoalProgress(named, allTx, ref);
    return { intent: 'goal', data: prog, answer: `"${named.name}": ${fmt(prog.saved)} su ${fmt(named.target)} (${prog.pct}%)${prog.onTrack === true ? ' — sei in linea.' : prog.onTrack === false ? ' — sei indietro rispetto al ritmo necessario.' : '.'}` };
  }

  // — onestà: nessun intent riconosciuto
  return {
    intent: 'unknown',
    answer: 'Questa non la so ancora. Prova con: "quanto ho speso questo mese?", "quanto posso spendere oggi?", "posso permettermi 50€?", "come chiudo il mese?", "quali abbonamenti pago?", "dove spendo di più?", "quanto ho risparmiato?".',
  };
}
