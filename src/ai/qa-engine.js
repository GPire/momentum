// Motore Q&A on-device: risponde in linguaggio naturale alle domande
// dell'utente sui PROPRI dati, calcolando la risposta con i motori già
// verificati del progetto (advisor, subscriptions, engagement) — mai frasi
// generiche. Differenza strutturale rispetto a un chatbot cloud: la risposta
// nasce dai numeri veri dell'utente, sul dispositivo, anche offline, e ogni
// intent è deterministico e testabile. Quando non sa rispondere lo dice
// (intent 'unknown'), non inventa — stessa disciplina del resto del progetto.
//
// Bilingue (italiano/inglese): ogni intent riconosce entrambe le forme della
// domanda; la lingua della RISPOSTA segue quella rilevata nella domanda
// (euristica su parole-chiave comuni, dichiarata — non un rilevatore
// linguistico formale, sarebbe precisione finta su un problema semplice).
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

const MONTH_NAMES_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const MONTH_NAMES_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const fmt = n => `${(+n).toFixed(2).replace('.', ',')}€`;

// Euristica dichiarata (non un rilevatore linguistico formale): parole
// funzione inglesi comuni nelle domande di questo dominio. Falsi negativi
// possibili su frasi ambigue — in quel caso resta l'italiano (default).
const ENGLISH_MARKERS = /\b(how much|what|today|yesterday|this week|last month|spend|spent|save|saved|savings|budget|left|subscription|goal|invest|income|earned|afford|can i)\b/;
function detectLang(q) { return ENGLISH_MARKERS.test(q) ? 'en' : 'it'; }

// Periodo citato nella domanda → {start, end, label} in ENTRAMBE le lingue.
// Default: mese corrente.
function resolvePeriod(q, ref, lang) {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(ref);
  const L = lang === 'en'
    ? { today: 'today', yesterday: 'yesterday', thisWeek: 'this week', lastMonth: 'last month', thisMonth: 'this month' }
    : { today: 'oggi', yesterday: 'ieri', thisWeek: 'questa settimana', lastMonth: 'il mese scorso', thisMonth: 'questo mese' };

  if (/\b(oggi|today)\b/.test(q)) return { start: today, end: today, label: L.today };
  if (/\b(ieri|yesterday)\b/.test(q)) {
    const y = new Date(today.getTime() - 86_400_000);
    return { start: y, end: y, label: L.yesterday };
  }
  if (/(questa settimana|this week)/.test(q)) {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1) - day);
    return { start: monday, end: today, label: L.thisWeek };
  }
  if (/(mese scorso|scorso mese|last month)/.test(q)) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    return { start, end: new Date(ref.getFullYear(), ref.getMonth(), 0), label: L.lastMonth };
  }
  const months = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_IT;
  for (let i = 0; i < 12; i++) {
    if (q.includes(months[i])) {
      // il mese nominato più recente non nel futuro (a luglio, "giugno" = giugno di quest'anno)
      const year = i <= ref.getMonth() ? ref.getFullYear() : ref.getFullYear() - 1;
      return { start: new Date(year, i, 1), end: new Date(year, i + 1, 0), label: lang === 'en' ? `in ${MONTH_NAMES_EN[i]}` : `a ${MONTH_NAMES_IT[i]}` };
    }
  }
  return { start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0), label: L.thisMonth };
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

// Prima lettera maiuscola, per aprire una frase con il label del periodo.
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

export function answerQuestion(question, ctx) {
  const q = (question || '').toLowerCase().trim();
  const ref = ctx.referenceDate || new Date();
  const allTx = ctx.allTx || {};
  const monthTxs = allTx[monthKey(ref)] || [];
  if (!q) return { intent: 'unknown', answer: 'Fammi una domanda sui tuoi soldi: spese, risparmi, budget, abbonamenti, obiettivi, investimenti.' };
  const lang = detectLang(q);
  const en = lang === 'en';

  // — "quanto posso investire?" / "how much can I invest?"
  if (/(quanto posso investire|posso investire|quanto investire|investire questo mese|how much can i invest|can i invest|invest this month)/.test(q)) {
    const f = monthlyFinance(allTx, ref);
    const r = investableSurplus({
      netMonthlyFlow: f.netMonthlyFlow,
      avgMonthlyExpense: f.avgMonthlyExpense,
      currentEmergencyFund: ctx.emergencyFund ?? f.invested,
      emergencyMonths: ctx.emergencyMonths ?? 6,
    });
    return { intent: 'invest', data: r, answer: r.note };
  }

  // — "posso permettermi X?" / "can I afford X?" (prima di safe-to-spend: contiene un importo)
  if (/(posso permettermi|posso spendere|ce la faccio a spendere|posso comprare|can i afford|can i spend|can i buy)/.test(q) && extractAmount(q) !== null) {
    const amount = extractAmount(q);
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'affordability', answer: en ? 'I need a monthly budget set up to answer this — set it in the Analysis section and I\'ll tell you right away.' : `Per risponderti mi serve un budget mensile impostato — toccalo nella sezione Analisi e te lo dico subito.` };
    if (sts.isOverBudget) return { intent: 'affordability', data: sts, answer: en ? `Better not: you're already ${fmt(Math.abs(sts.weekRemaining))} over this week. Postpone it if you can.` : `Meglio di no: questa settimana sei già oltre di ${fmt(Math.abs(sts.weekRemaining))}. Se puoi, rimanda.` };
    if (amount <= sts.safeToday) return { intent: 'affordability', data: sts, answer: en ? `Yes: ${fmt(amount)} fits within today's ${fmt(sts.safeToday)}. You'd have ${fmt(sts.safeToday - amount)} left for the day.` : `Sì: ${fmt(amount)} rientrano nei ${fmt(sts.safeToday)} di oggi. Dopo ti resterebbero ${fmt(sts.safeToday - amount)} per la giornata.` };
    if (amount <= sts.weekRemaining - sts.reservedForCharges) return { intent: 'affordability', data: sts, answer: en ? `Yes, but use the week's margin: today's pace would be ${fmt(sts.safeToday)}, spending ${fmt(amount)} means going lighter for the next ${sts.daysLeftInWeek - 1} days.` : `Sì, ma usa il margine della settimana: oggi il tuo ritmo sarebbe ${fmt(sts.safeToday)}, spendendone ${fmt(amount)} dovrai stare più leggero nei prossimi ${sts.daysLeftInWeek - 1} giorni.` };
    return { intent: 'affordability', data: sts, answer: en ? `Risky: you have ${fmt(Math.max(0, sts.weekRemaining))} left for the whole week${sts.reservedForCharges > 0 ? ` (${fmt(sts.reservedForCharges)} already committed to subscriptions)` : ''}. ${fmt(amount)} would push you over.` : `Rischioso: ti restano ${fmt(Math.max(0, sts.weekRemaining))} per tutta la settimana${sts.reservedForCharges > 0 ? ` (di cui ${fmt(sts.reservedForCharges)} già impegnati per gli abbonamenti)` : ''}. ${fmt(amount)} ti manderebbero oltre.` };
  }

  // — "quanto posso spendere oggi?" / "how much can I spend today?"
  if (/(quanto posso spendere|cosa posso spendere|budget di oggi|quanto mi resta oggi|how much can i spend|what can i spend|today's budget)/.test(q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'safe-to-spend', answer: en ? 'Set a monthly budget first (Analysis section): from there I can calculate how much you can spend each day.' : 'Imposta prima un budget mensile (sezione Analisi): da lì calcolo quanto puoi spendere ogni giorno.' };
    if (sts.isOverBudget) return { intent: 'safe-to-spend', data: sts, answer: en ? `Better nothing today: you're ${fmt(Math.abs(sts.weekRemaining))} over this week.` : `Oggi meglio niente: questa settimana sei oltre di ${fmt(Math.abs(sts.weekRemaining))}.` };
    return { intent: 'safe-to-spend', data: sts, answer: en
      ? `You can spend ${fmt(sts.safeToday)} today. You have ${fmt(sts.weekRemaining)} left for the week (${sts.daysLeftInWeek} days)${sts.reservedForCharges > 0 ? `, ${fmt(sts.reservedForCharges)} already set aside for upcoming subscriptions` : ''}.`
      : `Oggi puoi spendere ${fmt(sts.safeToday)}. Ti restano ${fmt(sts.weekRemaining)} per la settimana (${sts.daysLeftInWeek} giorni)${sts.reservedForCharges > 0 ? `, ${fmt(sts.reservedForCharges)} già da parte per gli abbonamenti in arrivo` : ''}.` };
  }

  // — "quanto mi resta questa settimana / del budget?" / "how much do I have left?"
  if (/(quanto (mi )?resta|quanto rimane|how much (do i have )?left|what's left)/.test(q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    if (!sts) return { intent: 'budget-left', answer: en ? 'You don\'t have a budget set yet: without one, "what\'s left" has no real answer.' : 'Non hai ancora un budget impostato: senza, "quanto resta" non ha una risposta vera.' };
    return { intent: 'budget-left', data: sts, answer: en
      ? (sts.isOverBudget ? `You're ${fmt(Math.abs(sts.weekRemaining))} over this week.` : `${fmt(sts.weekRemaining)} for this week, ${fmt(sts.safeToday)} if spread over the ${sts.daysLeftInWeek} remaining days.`)
      : (sts.isOverBudget ? `Sei oltre di ${fmt(Math.abs(sts.weekRemaining))} questa settimana.` : `${fmt(sts.weekRemaining)} per questa settimana, ${fmt(sts.safeToday)} se li spalmi sui ${sts.daysLeftInWeek} giorni che mancano.`) };
  }

  // — "come finisco il mese?" / "how will I end the month?" — proiezione
  if (/(fine mese|chiudo il mese|finisco il mese|proiezione|previsione|end of month|how will i end|month projection)/.test(q)) {
    const proj = getMonthEndProjection({ monthTxs, monthlyBudget: ctx.monthlyBudget || 0, referenceDate: ref, hwDailyLevel: ctx.hwDailyLevel ?? null });
    if (!ctx.monthlyBudget) return { intent: 'month-end', data: proj, answer: en ? `You've spent ${fmt(proj.spentSoFar)} so far; at this pace you'll reach ${fmt(proj.projectedTotal)} by month end. Set a budget and I'll tell you if you're within it too.` : `Hai speso ${fmt(proj.spentSoFar)} finora; di questo passo arrivi a ${fmt(proj.projectedTotal)} a fine mese. Imposta un budget e ti dico anche se ci stai dentro.` };
    return { intent: 'month-end', data: proj, answer: proj.willOverspend
      ? (en ? `Watch out: you've spent ${fmt(proj.spentSoFar)} and at this pace you'll reach ${fmt(proj.projectedTotal)}, that's ${fmt(Math.abs(proj.projectedDelta))} over budget (estimate ${proj.method === 'holt-winters' ? 'based on your real trend' : 'based on this month\'s pace'}).` : `Attento: hai speso ${fmt(proj.spentSoFar)} e di questo passo chiudi a ${fmt(proj.projectedTotal)}, cioè ${fmt(Math.abs(proj.projectedDelta))} oltre il budget (stima ${proj.method === 'holt-winters' ? 'sul tuo andamento reale' : 'sul ritmo del mese'}).`)
      : (en ? `Good: you've spent ${fmt(proj.spentSoFar)} and at this pace you'll close at ${fmt(proj.projectedTotal)}, with ${fmt(proj.projectedDelta)} to spare.` : `Bene: hai speso ${fmt(proj.spentSoFar)} e di questo passo chiudi a ${fmt(proj.projectedTotal)}, con ${fmt(proj.projectedDelta)} di margine.`) };
  }

  // — abbonamenti: "quali abbonamenti pago" / "what subscriptions do I pay"
  if (/(abbonament|quando pago|pagamenti ricorrenti|spese fisse|subscription|recurring payment)/.test(q)) {
    const recurring = detectRecurring(allTx);
    if (recurring.length === 0) return { intent: 'subscriptions', answer: en ? 'I don\'t see any recurring charges in your data yet.' : 'Non vedo ancora addebiti ricorrenti nei tuoi dati.' };
    const named = recurring.find(g => q.includes(g.representative.toLowerCase().split(/[^a-z0-9]+/)[0]));
    if (named && /(quando|when)/.test(q)) {
      const upcoming = getUpcomingCharges(allTx, ref, 40).find(c => c.description === named.representative);
      if (upcoming) return { intent: 'subscriptions', data: upcoming, answer: en
        ? `${named.representative}: next charge of ${fmt(upcoming.amount)} expected ${upcoming.daysUntil === 0 ? 'any moment' : `in ${upcoming.daysUntil} days`} (${upcoming.expectedDate.toLocaleDateString('en-US')}).`
        : `${named.representative}: prossimo addebito di ${fmt(upcoming.amount)} previsto ${upcoming.daysUntil === 0 ? 'a momenti' : `tra ${upcoming.daysUntil} giorni`} (${upcoming.expectedDate.toLocaleDateString('it-IT')}).` };
    }
    const total = recurring.reduce((s, g) => s + g.items[g.items.length - 1].amount, 0);
    return { intent: 'subscriptions', data: recurring, answer: en
      ? `You pay ${recurring.length} subscription${recurring.length === 1 ? '' : 's'} for ${fmt(total)}/month: ${recurring.map(g => `${g.representative} (${fmt(g.items[g.items.length - 1].amount)})`).join(', ')}.`
      : `Paghi ${recurring.length} abbonament${recurring.length === 1 ? 'o' : 'i'} per ${fmt(total)} al mese: ${recurring.map(g => `${g.representative} (${fmt(g.items[g.items.length - 1].amount)})`).join(', ')}.` };
  }

  // — ragionamento a catena: "cosa succede se spendo di più in X?" / "what happens if I spend more on X?"
  // Risposta dal grafo di co-variazione misurato sui dati veri (correlazioni
  // sulle differenze settimanali, soglie dichiarate) — mai nessi inventati.
  if (/(cosa succede se|se spendo di più|se aumento|cosa si muove con|cosa cambia se|what happens if|if i spend more|if i increase)/.test(q)) {
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    if (!namedCat) return { intent: 'causal', answer: en ? 'Tell me the category: e.g. "what happens if I spend more on dining?"' : 'Dimmi la categoria: ad esempio "cosa succede se spendo di più in Ristorante?"' };
    const links = buildCausalGraph(allTx, ref);
    const effects = propagateImpact(links, namedCat, 30); // scenario: +30%
    if (effects.length === 0) return { intent: 'causal', answer: en ? `In your data, I don't see other expenses moving together with ${namedCat}: increasing it shouldn't drag anything else along.` : `Nei tuoi dati non vedo altre spese che si muovono insieme a ${namedCat}: aumentarla non dovrebbe trascinare altro.` };
    const parts = effects.slice(0, 3).map(e => en
      ? `${e.category} usually ${e.expectedPct > 0 ? 'rises' : 'falls'} by ${Math.abs(e.expectedPct)}%${e.lagWeeks > 0 ? ' the week after' : ''}`
      : `${e.category} ${e.expectedPct > 0 ? 'sale' : 'scende'} di solito del ${Math.abs(e.expectedPct)}%${e.lagWeeks > 0 ? ' la settimana dopo' : ''}`);
    return { intent: 'causal', data: effects, answer: en
      ? `In your data, when ${namedCat} rises (+30%): ${parts.join('; ')}. This isn't a law, it's what's happened so far in your weeks.`
      : `Nei tuoi dati, quando sale ${namedCat} (+30%): ${parts.join('; ')}. Non è una legge, è quello che è successo finora nelle tue settimane.` };
  }

  // — "dove spendo di più?" / "where do I spend the most?" (prima di "quanto ho speso": distribuzione)
  if (/(dove spendo|dove vanno|in cosa spendo|categoria più|top categor|where do i spend|biggest expense)/.test(q)) {
    const period = resolvePeriod(q, ref, lang);
    const spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    if (spese.length === 0) return { intent: 'top-category', answer: en ? `No expenses recorded ${period.label}.` : `Nessuna spesa registrata ${period.label}.` };
    const byCat = {};
    spese.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totale = spese.reduce((s, t) => s + t.amount, 0);
    return { intent: 'top-category', data: top, answer: en
      ? `${cap(period.label)} your biggest expense is ${top[0][0]} at ${fmt(top[0][1])} (${((top[0][1] / totale) * 100).toFixed(0)}% of the total)${top[1] ? `, then ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` and ${top[2][0]} (${fmt(top[2][1])})` : ''}.`
      : `${cap(period.label)} la voce più pesante è ${top[0][0]} con ${fmt(top[0][1])} (${((top[0][1] / totale) * 100).toFixed(0)}% del totale)${top[1] ? `, poi ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` e ${top[2][0]} (${fmt(top[2][1])})` : ''}.` };
  }

  // — "quanto ho risparmiato / messo da parte?" / "how much have I saved?"
  if (/(risparmiat|messo da parte|risparmio|how much (have i )?saved|savings)/.test(q)) {
    const period = resolvePeriod(q, ref, lang);
    const txs = txInPeriod(allTx, period);
    const inc = txs.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    const out = txs.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0);
    const net = inc - out;
    return { intent: 'savings', data: { inc, out, net }, answer: en
      ? (net >= 0 ? `${cap(period.label)} you saved ${fmt(net)} (${fmt(inc)} in, ${fmt(out)} out).` : `${cap(period.label)} you spent ${fmt(Math.abs(net))} more than came in (${fmt(inc)} in, ${fmt(out)} out).`)
      : (net >= 0 ? `${cap(period.label)} hai messo da parte ${fmt(net)} (${fmt(inc)} entrati, ${fmt(out)} usciti).` : `${cap(period.label)} hai speso ${fmt(Math.abs(net))} più di quanto è entrato (${fmt(inc)} entrati, ${fmt(out)} usciti).`) };
  }

  // — "quanto ho guadagnato / entrate?" / "how much did I earn?"
  if (/(guadagnat|entrate|incassat|quanto è entrato|how much (did i )?earn|income)/.test(q)) {
    const period = resolvePeriod(q, ref, lang);
    const inc = txInPeriod(allTx, period).filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    return { intent: 'income', data: { inc }, answer: en ? `${cap(period.label)}: ${fmt(inc)} in income.` : `${cap(period.label)}: ${fmt(inc)} di entrate.` };
  }

  // — "quanto ho speso [periodo] [in categoria]?" / "how much did I spend...?"
  if (/(quanto ho speso|quanto abbiamo speso|spese di|quanto spendo|le mie spese|how much (did i|have i) spen[dt]|my expenses)/.test(q)) {
    const period = resolvePeriod(q, ref, lang);
    let spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    // filtro categoria: la domanda nomina una categoria presente nei dati?
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    if (namedCat) spese = spese.filter(t => t.category === namedCat);
    const tot = spese.reduce((s, t) => s + t.amount, 0);
    return { intent: 'spent', data: { tot, count: spese.length, period, category: namedCat || null }, answer: en
      ? `${cap(period.label)} you spent ${fmt(tot)}${namedCat ? ` on ${namedCat}` : ''} (${spese.length} transactions).`
      : `${cap(period.label)} hai speso ${fmt(tot)}${namedCat ? ` in ${namedCat}` : ''} (${spese.length} movimenti).` };
  }

  // — obiettivi: "a che punto è il mio obiettivo?" / "how's my goal going?"
  if (/(obiettivo|obbiettivo|goal)/.test(q)) {
    const goals = ctx.savingsGoals || [];
    if (goals.length === 0) return { intent: 'goal', answer: en ? 'You don\'t have any savings goals yet. Want to create one from the Analysis section?' : 'Non hai ancora obiettivi di risparmio. Ne creiamo uno dalla sezione Analisi?' };
    const named = goals.find(g => q.includes(g.name.toLowerCase())) || goals[0];
    const prog = computeGoalProgress(named, allTx, ref);
    return { intent: 'goal', data: prog, answer: en
      ? `"${named.name}": ${fmt(prog.saved)} of ${fmt(named.target)} (${prog.pct}%)${prog.onTrack === true ? ' — you\'re on track.' : prog.onTrack === false ? ' — you\'re behind the pace needed.' : '.'}`
      : `"${named.name}": ${fmt(prog.saved)} su ${fmt(named.target)} (${prog.pct}%)${prog.onTrack === true ? ' — sei in linea.' : prog.onTrack === false ? ' — sei indietro rispetto al ritmo necessario.' : '.'}` };
  }

  // — onestà: nessun intent riconosciuto
  return en
    ? { intent: 'unknown', answer: 'I don\'t know this one yet. Try: "how much have I spent this month?", "how much can I spend today?", "can I afford 50€?", "how will I end the month?", "what subscriptions do I pay?", "where do I spend the most?", "how much have I saved?".' }
    : { intent: 'unknown', answer: 'Questa non la so ancora. Prova con: "quanto ho speso questo mese?", "quanto posso spendere oggi?", "posso permettermi 50€?", "come chiudo il mese?", "quali abbonamenti pago?", "dove spendo di più?", "quanto ho risparmiato?".' };
}
