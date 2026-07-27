// Motore Q&A on-device: risponde in linguaggio naturale alle domande
// dell'utente sui PROPRI dati, calcolando la risposta con i motori già
// verificati del progetto (advisor, subscriptions, engagement) — mai frasi
// generiche. Differenza strutturale rispetto a un chatbot cloud: la risposta
// nasce dai numeri veri dell'utente, sul dispositivo, anche offline, e ogni
// intent è deterministico e testabile. Quando non sa rispondere lo dice
// (intent 'unknown'), non inventa — stessa disciplina del resto del progetto.
//
// Multilingua (IT/EN/ES/FR/DE, coerente con src/ai/chat.js che copre già 4
// intent in queste stesse lingue): riusa lo STESSO rilevatore di lingua
// (src/i18n/detect.js) invece di uno parallelo — un'unica architettura, non
// due sistemi di rilevamento linguistico nello stesso progetto. Le lingue
// rilevate ma non ancora tradotte qui (es. 'pt') ricadono onestamente
// sull'inglese, mai su un italiano che l'utente non ha scritto.
//
// Funzioni pure: tutto lo stato arriva dal chiamante via `ctx`
// { allTx, monthlyBudget, savingsGoals, referenceDate, hwDailyLevel }.
import { getDailySafeToSpend, getMonthEndProjection, getUpcomingCharges } from '../predict/advisor.js';
import { detectRecurring } from '../predict/subscriptions.js';
import { computeGoalProgress } from '../predict/engagement.js';
import { buildCausalGraph, propagateImpact } from '../predict/causal-graph.js';
import { investableSurplus } from '../alpha/bridge.js';
import { monthKey } from '../core/constants.js';
import { detectLanguage } from '../i18n/detect.js';

const LANGS = ['it', 'en', 'es', 'fr', 'de'];
// Fallback onesto: una lingua rilevata ma non tradotta qui (es. 'pt') usa
// l'inglese, mai spacciato per italiano solo perché è la lingua di default
// del motore quando NESSUNA lingua è rilevata.
const L = (lang) => LANGS.includes(lang) ? lang : 'en';

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

const MONTH_NAMES = {
  it: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'],
  en: ['january','february','march','april','may','june','july','august','september','october','november','december'],
  es: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  fr: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  de: ['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'],
};

const fmt = n => `${(+n).toFixed(2).replace('.', ',')}€`;
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// Periodo citato nella domanda → {start, end, label} nella lingua rilevata.
function resolvePeriod(q, ref, lang) {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(ref);
  const LBL = {
    it: { today: 'oggi', yesterday: 'ieri', thisWeek: 'questa settimana', lastMonth: 'il mese scorso', thisMonth: 'questo mese', in: 'a' },
    en: { today: 'today', yesterday: 'yesterday', thisWeek: 'this week', lastMonth: 'last month', thisMonth: 'this month', in: 'in' },
    es: { today: 'hoy', yesterday: 'ayer', thisWeek: 'esta semana', lastMonth: 'el mes pasado', thisMonth: 'este mes', in: 'en' },
    fr: { today: 'aujourd\'hui', yesterday: 'hier', thisWeek: 'cette semaine', lastMonth: 'le mois dernier', thisMonth: 'ce mois', in: 'en' },
    de: { today: 'heute', yesterday: 'gestern', thisWeek: 'diese Woche', lastMonth: 'letzten Monat', thisMonth: 'diesen Monat', in: 'im' },
  }[lang];

  if (/\b(oggi|today|hoy|aujourd|heute)\b/.test(q)) return { start: today, end: today, label: LBL.today };
  if (/\b(ieri|yesterday|ayer|hier|gestern)\b/.test(q)) {
    const y = new Date(today.getTime() - 86_400_000);
    return { start: y, end: y, label: LBL.yesterday };
  }
  if (/(questa settimana|this week|esta semana|cette semaine|diese woche)/.test(q)) {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1) - day);
    return { start: monday, end: today, label: LBL.thisWeek };
  }
  if (/(mese scorso|scorso mese|last month|mes pasado|mois dernier|letzten monat)/.test(q)) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    return { start, end: new Date(ref.getFullYear(), ref.getMonth(), 0), label: LBL.lastMonth };
  }
  const months = MONTH_NAMES[lang];
  for (let i = 0; i < 12; i++) {
    if (q.includes(months[i])) {
      // il mese nominato più recente non nel futuro (a luglio, "giugno" = giugno di quest'anno)
      const year = i <= ref.getMonth() ? ref.getFullYear() : ref.getFullYear() - 1;
      return { start: new Date(year, i, 1), end: new Date(year, i + 1, 0), label: `${LBL.in} ${months[i]}` };
    }
  }
  return { start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0), label: LBL.thisMonth };
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

// Pattern d'intento PER LINGUA (coerente con lo stile di src/ai/chat.js:
// parole-chiave robuste, non frasi fisse). Un intento matcha se il pattern
// della lingua rilevata (o di una qualsiasi, come rete di sicurezza su testo
// misto) trova riscontro.
const PATTERNS = {
  invest: {
    it: /(quanto posso investire|posso investire|quanto investire|investire questo mese)/,
    en: /(how much can i invest|can i invest|invest this month)/,
    es: /(cuánto puedo invertir|puedo invertir|invertir este mes)/,
    fr: /(combien puis-je investir|puis-je investir|investir ce mois)/,
    de: /(wie viel kann ich investieren|kann ich investieren|diesen monat investieren)/,
  },
  affordability: {
    it: /(posso permettermi|posso spendere|ce la faccio a spendere|posso comprare)/,
    en: /(can i afford|can i spend|can i buy)/,
    es: /(puedo permitirme|puedo gastar|puedo comprar)/,
    fr: /(puis-je me permettre|puis-je dépenser|puis-je acheter)/,
    de: /(kann ich mir .{0,15}leisten|kann ich .{0,10}ausgeben|kann ich kaufen)/,
  },
  safeToSpend: {
    it: /(quanto posso spendere|cosa posso spendere|budget di oggi|quanto mi resta oggi)/,
    en: /(how much can i spend|what can i spend|today's budget)/,
    es: /(cuánto puedo gastar|presupuesto de hoy|cuánto me queda hoy)/,
    fr: /(combien puis-je dépenser|budget d.?aujourd|combien me reste)/,
    de: /(wie viel kann ich .{0,15}ausgeben|budget für heute|wie viel bleibt)/,
  },
  budgetLeft: {
    it: /(quanto (mi )?resta|quanto rimane)/,
    en: /(how much (do i have )?left|what's left)/,
    es: /(cuánto (me )?queda|qué queda)/,
    fr: /(combien (me )?reste|qu.?est-ce qu.?il reste)/,
    de: /(wie viel (bleibt|habe ich noch)|was bleibt)/,
  },
  monthEnd: {
    it: /(fine mese|chiudo il mese|finisco il mese|proiezione|previsione)/,
    en: /(end of month|how will i end|month projection)/,
    es: /(fin de mes|cómo termino el mes|proyección del mes)/,
    fr: /(fin du mois|comment vais-je finir le mois|projection du mois)/,
    de: /(monatsende|wie werde ich den monat beenden|monatsprognose)/,
  },
  subscriptions: {
    it: /(abbonament|quando pago|pagamenti ricorrenti|spese fisse)/,
    en: /(subscription|recurring payment)/,
    es: /(suscripci|pagos recurrentes)/,
    fr: /(abonnement|paiements récurrents)/,
    de: /(abonnement|wiederkehrende zahlung)/,
  },
  causal: {
    it: /(cosa succede se|se spendo di più|se aumento|cosa si muove con|cosa cambia se)/,
    en: /(what happens if|if i spend more|if i increase)/,
    es: /(qué pasa si|si gasto más|si aumento)/,
    fr: /(que se passe-t-il si|si je dépense plus|si j.?augmente)/,
    de: /(was passiert wenn|wenn ich mehr ausgebe|wenn ich erhöhe)/,
  },
  topCategory: {
    it: /(dove spendo|dove vanno|in cosa spendo|categoria più|top categor)/,
    en: /(where do i spend|biggest expense)/,
    es: /(dónde gasto|mayor gasto)/,
    fr: /(où je dépense|plus grosse dépense)/,
    de: /(wo gebe ich aus|größte ausgabe)/,
  },
  savings: {
    it: /(risparmiat|messo da parte|risparmio)/,
    en: /(how much (have i )?saved|savings)/,
    es: /(cuánto (he )?ahorrado|ahorro)/,
    fr: /(combien j.?ai économisé|épargne)/,
    de: /(wie viel habe ich gespart|ersparnis)/,
  },
  income: {
    it: /(guadagnat|entrate|incassat|quanto è entrato)/,
    en: /(how much (did i )?earn|income)/,
    es: /(cuánto (he )?ganado|ingresos)/,
    fr: /(combien j.?ai gagné|revenus)/,
    de: /(wie viel habe ich verdient|einkommen)/,
  },
  spent: {
    it: /(quanto ho speso|quanto abbiamo speso|spese di|quanto spendo|le mie spese)/,
    en: /(how much (did i|have i) spen[dt]|my expenses)/,
    es: /(cuánto (he )?gastado|mis gastos)/,
    fr: /(combien j.?ai dépensé|mes dépenses)/,
    de: /(wie viel habe ich .{0,20}ausgegeben|meine ausgaben)/,
  },
  goal: {
    it: /(obiettivo|obbiettivo)/,
    en: /(goal)/,
    es: /(objetivo|meta)/,
    fr: /(objectif)/,
    de: /(ziel)/,
  },
  when: { it: /quando/, en: /when/, es: /cuándo/, fr: /quand/, de: /wann/ },
};
function matches(intent, q) {
  const p = PATTERNS[intent];
  return p.it.test(q) || p.en.test(q) || p.es.test(q) || p.fr.test(q) || p.de.test(q);
}

const UNKNOWN_MSG = {
  it: 'Questa non la so ancora. Prova con: "quanto ho speso questo mese?", "quanto posso spendere oggi?", "posso permettermi 50€?", "come chiudo il mese?", "quali abbonamenti pago?", "dove spendo di più?", "quanto ho risparmiato?".',
  en: 'I don\'t know this one yet. Try: "how much have I spent this month?", "how much can I spend today?", "can I afford 50€?", "how will I end the month?", "what subscriptions do I pay?", "where do I spend the most?", "how much have I saved?".',
  es: 'Esto todavía no lo sé. Prueba con: "¿cuánto he gastado este mes?", "¿cuánto puedo gastar hoy?", "¿puedo permitirme 50€?", "¿cómo termino el mes?", "¿qué suscripciones pago?", "¿dónde gasto más?", "¿cuánto he ahorrado?".',
  fr: 'Je ne sais pas encore répondre à ça. Essaie : "combien j\'ai dépensé ce mois-ci ?", "combien puis-je dépenser aujourd\'hui ?", "puis-je me permettre 50€ ?", "comment vais-je finir le mois ?", "quels abonnements je paie ?", "où je dépense le plus ?", "combien j\'ai économisé ?".',
  de: 'Das weiß ich noch nicht. Versuch es mit: "Wie viel habe ich diesen Monat ausgegeben?", "Wie viel kann ich heute ausgeben?", "Kann ich mir 50€ leisten?", "Wie werde ich den Monat beenden?", "Welche Abos zahle ich?", "Wo gebe ich am meisten aus?", "Wie viel habe ich gespart?".',
};

export function answerQuestion(question, ctx) {
  const q = (question || '').toLowerCase().trim();
  const ref = ctx.referenceDate || new Date();
  const allTx = ctx.allTx || {};
  const monthTxs = allTx[monthKey(ref)] || [];
  if (!q) return { intent: 'unknown', answer: UNKNOWN_MSG.it };
  const lang = L(detectLanguage(q).lang);

  // — "quanto posso investire?"
  if (matches('invest', q)) {
    const f = monthlyFinance(allTx, ref);
    const r = investableSurplus({
      netMonthlyFlow: f.netMonthlyFlow,
      avgMonthlyExpense: f.avgMonthlyExpense,
      currentEmergencyFund: ctx.emergencyFund ?? f.invested,
      emergencyMonths: ctx.emergencyMonths ?? 6,
    });
    return { intent: 'invest', data: r, answer: r.note };
  }

  // — "posso permettermi X?" (prima di safe-to-spend: contiene un importo)
  if (matches('affordability', q) && extractAmount(q) !== null) {
    const amount = extractAmount(q);
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    const T = {
      it: { noBudget: 'Per risponderti mi serve un budget mensile impostato — toccalo nella sezione Analisi e te lo dico subito.', over: n => `Meglio di no: questa settimana sei già oltre di ${n}. Se puoi, rimanda.`, yesToday: (a, r) => `Sì: ${a} rientrano nei ${r} di oggi.`, yesWeek: (a, r, d) => `Sì, ma usa il margine della settimana: dovrai stare più leggero nei prossimi ${d} giorni.`, risky: (r, a) => `Rischioso: ti restano ${r} per tutta la settimana. ${a} ti manderebbero oltre.` },
      en: { noBudget: 'I need a monthly budget set up to answer this — set it in the Analysis section and I\'ll tell you right away.', over: n => `Better not: you're already ${n} over this week. Postpone it if you can.`, yesToday: (a, r) => `Yes: ${a} fits within today's ${r}.`, yesWeek: (a, r, d) => `Yes, but use the week's margin: you'll need to go lighter for the next ${d} days.`, risky: (r, a) => `Risky: you have ${r} left for the whole week. ${a} would push you over.` },
      es: { noBudget: 'Para responderte necesito un presupuesto mensual configurado — actívalo en la sección Análisis y te digo enseguida.', over: n => `Mejor que no: esta semana ya estás ${n} por encima. Si puedes, aplázalo.`, yesToday: (a, r) => `Sí: ${a} entra dentro de los ${r} de hoy.`, yesWeek: (a, r, d) => `Sí, pero usa el margen de la semana: tendrás que ir más ligero los próximos ${d} días.`, risky: (r, a) => `Arriesgado: te quedan ${r} para toda la semana. ${a} te pasarían de largo.` },
      fr: { noBudget: 'Il me faut un budget mensuel configuré pour répondre — active-le dans la section Analyse et je te réponds tout de suite.', over: n => `Mieux vaut pas : cette semaine tu es déjà à ${n} de dépassement. Reporte si tu peux.`, yesToday: (a, r) => `Oui : ${a} rentrent dans les ${r} d'aujourd'hui.`, yesWeek: (a, r, d) => `Oui, mais utilise la marge de la semaine : il faudra lever le pied les ${d} prochains jours.`, risky: (r, a) => `Risqué : il te reste ${r} pour toute la semaine. ${a} te feraient dépasser.` },
      de: { noBudget: 'Dazu brauche ich ein eingerichtetes Monatsbudget — richte es im Bereich Analyse ein, dann sage ich es dir sofort.', over: n => `Besser nicht: diese Woche bist du schon ${n} drüber. Verschieb es wenn möglich.`, yesToday: (a, r) => `Ja: ${a} passen in die heutigen ${r}.`, yesWeek: (a, r, d) => `Ja, aber nutze den Spielraum der Woche: die nächsten ${d} Tage musst du kürzertreten.`, risky: (r, a) => `Riskant: dir bleiben ${r} für die ganze Woche. ${a} würden das überschreiten.` },
    }[lang];
    if (!sts) return { intent: 'affordability', answer: T.noBudget };
    if (sts.isOverBudget) return { intent: 'affordability', data: sts, answer: T.over(fmt(Math.abs(sts.weekRemaining))) };
    if (amount <= sts.safeToday) return { intent: 'affordability', data: sts, answer: T.yesToday(fmt(amount), fmt(sts.safeToday)) };
    if (amount <= sts.weekRemaining - sts.reservedForCharges) return { intent: 'affordability', data: sts, answer: T.yesWeek(fmt(amount), fmt(sts.safeToday), sts.daysLeftInWeek - 1) };
    return { intent: 'affordability', data: sts, answer: T.risky(fmt(Math.max(0, sts.weekRemaining)), fmt(amount)) };
  }

  // — "quanto posso spendere oggi?"
  if (matches('safeToSpend', q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    const T = {
      it: { noBudget: 'Imposta prima un budget mensile (sezione Analisi): da lì calcolo quanto puoi spendere ogni giorno.', over: n => `Oggi meglio niente: questa settimana sei oltre di ${n}.`, ok: (t, w, d) => `Oggi puoi spendere ${t}. Ti restano ${w} per la settimana (${d} giorni).` },
      en: { noBudget: 'Set a monthly budget first (Analysis section): from there I can calculate how much you can spend each day.', over: n => `Better nothing today: you're ${n} over this week.`, ok: (t, w, d) => `You can spend ${t} today. You have ${w} left for the week (${d} days).` },
      es: { noBudget: 'Configura primero un presupuesto mensual (sección Análisis): desde ahí calculo cuánto puedes gastar cada día.', over: n => `Hoy mejor nada: esta semana estás ${n} por encima.`, ok: (t, w, d) => `Hoy puedes gastar ${t}. Te quedan ${w} para la semana (${d} días).` },
      fr: { noBudget: 'Configure d\'abord un budget mensuel (section Analyse) : à partir de là je calcule combien tu peux dépenser chaque jour.', over: n => `Aujourd'hui mieux vaut rien : cette semaine tu dépasses de ${n}.`, ok: (t, w, d) => `Aujourd'hui tu peux dépenser ${t}. Il te reste ${w} pour la semaine (${d} jours).` },
      de: { noBudget: 'Richte zuerst ein Monatsbudget ein (Bereich Analyse): von dort berechne ich, wie viel du täglich ausgeben kannst.', over: n => `Heute besser nichts: diese Woche bist du ${n} drüber.`, ok: (t, w, d) => `Heute kannst du ${t} ausgeben. Dir bleiben ${w} für die Woche (${d} Tage).` },
    }[lang];
    if (!sts) return { intent: 'safe-to-spend', answer: T.noBudget };
    if (sts.isOverBudget) return { intent: 'safe-to-spend', data: sts, answer: T.over(fmt(Math.abs(sts.weekRemaining))) };
    return { intent: 'safe-to-spend', data: sts, answer: T.ok(fmt(sts.safeToday), fmt(sts.weekRemaining), sts.daysLeftInWeek) };
  }

  // — "quanto mi resta questa settimana / del budget?"
  if (matches('budgetLeft', q)) {
    const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
    const T = {
      it: { noBudget: 'Non hai ancora un budget impostato: senza, "quanto resta" non ha una risposta vera.', over: n => `Sei oltre di ${n} questa settimana.`, ok: (w, t, d) => `${w} per questa settimana, ${t} se li spalmi sui ${d} giorni che mancano.` },
      en: { noBudget: 'You don\'t have a budget set yet: without one, "what\'s left" has no real answer.', over: n => `You're ${n} over this week.`, ok: (w, t, d) => `${w} for this week, ${t} if spread over the ${d} remaining days.` },
      es: { noBudget: 'Todavía no tienes un presupuesto configurado: sin él, "cuánto queda" no tiene una respuesta real.', over: n => `Estás ${n} por encima esta semana.`, ok: (w, t, d) => `${w} para esta semana, ${t} si lo repartes en los ${d} días que quedan.` },
      fr: { noBudget: 'Tu n\'as pas encore de budget configuré : sans ça, "combien reste" n\'a pas de vraie réponse.', over: n => `Tu dépasses de ${n} cette semaine.`, ok: (w, t, d) => `${w} pour cette semaine, ${t} si tu les étales sur les ${d} jours restants.` },
      de: { noBudget: 'Du hast noch kein Budget eingerichtet: ohne das hat "was bleibt" keine echte Antwort.', over: n => `Du bist diese Woche ${n} drüber.`, ok: (w, t, d) => `${w} für diese Woche, ${t} wenn du sie auf die ${d} verbleibenden Tage verteilst.` },
    }[lang];
    if (!sts) return { intent: 'budget-left', answer: T.noBudget };
    return { intent: 'budget-left', data: sts, answer: sts.isOverBudget ? T.over(fmt(Math.abs(sts.weekRemaining))) : T.ok(fmt(sts.weekRemaining), fmt(sts.safeToday), sts.daysLeftInWeek) };
  }

  // — "come finisco il mese?" — proiezione
  if (matches('monthEnd', q)) {
    const proj = getMonthEndProjection({ monthTxs, monthlyBudget: ctx.monthlyBudget || 0, referenceDate: ref, hwDailyLevel: ctx.hwDailyLevel ?? null });
    const T = {
      it: { noBudget: (s, t) => `Hai speso ${s} finora; di questo passo arrivi a ${t} a fine mese. Imposta un budget e ti dico anche se ci stai dentro.`, over: (s, t, d) => `Attento: hai speso ${s} e di questo passo chiudi a ${t}, cioè ${d} oltre il budget.`, ok: (s, t, d) => `Bene: hai speso ${s} e di questo passo chiudi a ${t}, con ${d} di margine.` },
      en: { noBudget: (s, t) => `You've spent ${s} so far; at this pace you'll reach ${t} by month end. Set a budget and I'll tell you if you're within it too.`, over: (s, t, d) => `Watch out: you've spent ${s} and at this pace you'll reach ${t}, that's ${d} over budget.`, ok: (s, t, d) => `Good: you've spent ${s} and at this pace you'll close at ${t}, with ${d} to spare.` },
      es: { noBudget: (s, t) => `Has gastado ${s} hasta ahora; a este ritmo llegas a ${t} a fin de mes. Configura un presupuesto y también te digo si te mantienes dentro.`, over: (s, t, d) => `Cuidado: has gastado ${s} y a este ritmo cierras en ${t}, es decir ${d} por encima del presupuesto.`, ok: (s, t, d) => `Bien: has gastado ${s} y a este ritmo cierras en ${t}, con ${d} de margen.` },
      fr: { noBudget: (s, t) => `Tu as dépensé ${s} jusqu'ici ; à ce rythme tu atteindras ${t} en fin de mois. Configure un budget et je te dirai aussi si tu restes dedans.`, over: (s, t, d) => `Attention : tu as dépensé ${s} et à ce rythme tu termineras à ${t}, soit ${d} au-delà du budget.`, ok: (s, t, d) => `Bien : tu as dépensé ${s} et à ce rythme tu clôtureras à ${t}, avec ${d} de marge.` },
      de: { noBudget: (s, t) => `Du hast bisher ${s} ausgegeben; in diesem Tempo erreichst du ${t} zum Monatsende. Richte ein Budget ein, dann sage ich dir auch, ob du darin bleibst.`, over: (s, t, d) => `Achtung: du hast ${s} ausgegeben und wirst in diesem Tempo bei ${t} landen, das sind ${d} über dem Budget.`, ok: (s, t, d) => `Gut: du hast ${s} ausgegeben und wirst in diesem Tempo bei ${t} abschließen, mit ${d} Spielraum.` },
    }[lang];
    if (!ctx.monthlyBudget) return { intent: 'month-end', data: proj, answer: T.noBudget(fmt(proj.spentSoFar), fmt(proj.projectedTotal)) };
    return { intent: 'month-end', data: proj, answer: proj.willOverspend
      ? T.over(fmt(proj.spentSoFar), fmt(proj.projectedTotal), fmt(Math.abs(proj.projectedDelta)))
      : T.ok(fmt(proj.spentSoFar), fmt(proj.projectedTotal), fmt(proj.projectedDelta)) };
  }

  // — abbonamenti: "quali abbonamenti pago" / "quando pago X"
  if (matches('subscriptions', q)) {
    const recurring = detectRecurring(allTx);
    const NONE = { it: 'Non vedo ancora addebiti ricorrenti nei tuoi dati.', en: 'I don\'t see any recurring charges in your data yet.', es: 'Todavía no veo cargos recurrentes en tus datos.', fr: 'Je ne vois pas encore de prélèvements récurrents dans tes données.', de: 'Ich sehe noch keine wiederkehrenden Belastungen in deinen Daten.' }[lang];
    if (recurring.length === 0) return { intent: 'subscriptions', answer: NONE };
    const named = recurring.find(g => q.includes(g.representative.toLowerCase().split(/[^a-z0-9]+/)[0]));
    if (named && PATTERNS.when[lang].test(q)) {
      const upcoming = getUpcomingCharges(allTx, ref, 40).find(c => c.description === named.representative);
      if (upcoming) {
        const locale = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }[lang];
        const soon = { it: 'a momenti', en: 'any moment', es: 'en cualquier momento', fr: 'à tout moment', de: 'jeden Moment' }[lang];
        const inDays = { it: n => `tra ${n} giorni`, en: n => `in ${n} days`, es: n => `en ${n} días`, fr: n => `dans ${n} jours`, de: n => `in ${n} Tagen` }[lang];
        return { intent: 'subscriptions', data: upcoming, answer: `${named.representative}: ${fmt(upcoming.amount)} ${upcoming.daysUntil === 0 ? soon : inDays(upcoming.daysUntil)} (${upcoming.expectedDate.toLocaleDateString(locale)}).` };
      }
    }
    const total = recurring.reduce((s, g) => s + g.items[g.items.length - 1].amount, 0);
    const list = recurring.map(g => `${g.representative} (${fmt(g.items[g.items.length - 1].amount)})`).join(', ');
    const SUM = {
      it: `Paghi ${recurring.length} abbonament${recurring.length === 1 ? 'o' : 'i'} per ${fmt(total)} al mese: ${list}.`,
      en: `You pay ${recurring.length} subscription${recurring.length === 1 ? '' : 's'} for ${fmt(total)}/month: ${list}.`,
      es: `Pagas ${recurring.length} suscripci${recurring.length === 1 ? 'ón' : 'ones'} por ${fmt(total)} al mes: ${list}.`,
      fr: `Tu paies ${recurring.length} abonnement${recurring.length === 1 ? '' : 's'} pour ${fmt(total)}/mois : ${list}.`,
      de: `Du zahlst ${recurring.length} Abo${recurring.length === 1 ? '' : 's'} für ${fmt(total)}/Monat: ${list}.`,
    }[lang];
    return { intent: 'subscriptions', data: recurring, answer: SUM };
  }

  // — ragionamento a catena: "cosa succede se spendo di più in X?"
  if (matches('causal', q)) {
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    const ASK_CAT = { it: 'Dimmi la categoria: ad esempio "cosa succede se spendo di più in Ristorante?"', en: 'Tell me the category: e.g. "what happens if I spend more on dining?"', es: 'Dime la categoría: por ejemplo "¿qué pasa si gasto más en Restaurante?"', fr: 'Dis-moi la catégorie : par exemple "que se passe-t-il si je dépense plus en Restaurant ?"', de: 'Nenn mir die Kategorie: z.B. "was passiert wenn ich mehr für Restaurant ausgebe?"' }[lang];
    if (!namedCat) return { intent: 'causal', answer: ASK_CAT };
    const links = buildCausalGraph(allTx, ref);
    const effects = propagateImpact(links, namedCat, 30); // scenario: +30%
    const NONE = { it: `Nei tuoi dati non vedo altre spese che si muovono insieme a ${namedCat}: aumentarla non dovrebbe trascinare altro.`, en: `In your data, I don't see other expenses moving together with ${namedCat}: increasing it shouldn't drag anything else along.`, es: `En tus datos no veo otros gastos que se muevan junto a ${namedCat}: aumentarlo no debería arrastrar nada más.`, fr: `Dans tes données je ne vois pas d'autres dépenses bouger avec ${namedCat} : l'augmenter ne devrait rien entraîner d'autre.`, de: `In deinen Daten sehe ich keine anderen Ausgaben, die sich mit ${namedCat} mitbewegen: eine Erhöhung sollte nichts anderes nach sich ziehen.` }[lang];
    if (effects.length === 0) return { intent: 'causal', answer: NONE };
    const dir = (up) => ({ it: up ? 'sale' : 'scende', en: up ? 'rises' : 'falls', es: up ? 'sube' : 'baja', fr: up ? 'monte' : 'baisse', de: up ? 'steigt' : 'sinkt' }[lang]);
    const after = { it: ' la settimana dopo', en: ' the week after', es: ' la semana siguiente', fr: ' la semaine suivante', de: ' die Woche danach' }[lang];
    const parts = effects.slice(0, 3).map(e => `${e.category} ${dir(e.expectedPct > 0)} ${Math.abs(e.expectedPct)}%${e.lagWeeks > 0 ? after : ''}`);
    const RESULT = { it: `Nei tuoi dati, quando sale ${namedCat} (+30%): ${parts.join('; ')}. Non è una legge, è quello che è successo finora nelle tue settimane.`, en: `In your data, when ${namedCat} rises (+30%): ${parts.join('; ')}. This isn't a law, it's what's happened so far in your weeks.`, es: `En tus datos, cuando sube ${namedCat} (+30%): ${parts.join('; ')}. No es una ley, es lo que ha pasado hasta ahora en tus semanas.`, fr: `Dans tes données, quand ${namedCat} augmente (+30%) : ${parts.join('; ')}. Ce n'est pas une loi, c'est ce qui s'est passé jusqu'ici dans tes semaines.`, de: `In deinen Daten, wenn ${namedCat} steigt (+30%): ${parts.join('; ')}. Das ist kein Gesetz, sondern was bisher in deinen Wochen passiert ist.` }[lang];
    return { intent: 'causal', data: effects, answer: RESULT };
  }

  // — "dove spendo di più?" (prima di "quanto ho speso": distribuzione)
  if (matches('topCategory', q)) {
    const period = resolvePeriod(q, ref, lang);
    const spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    const NONE = { it: `Nessuna spesa registrata ${period.label}.`, en: `No expenses recorded ${period.label}.`, es: `Ningún gasto registrado ${period.label}.`, fr: `Aucune dépense enregistrée ${period.label}.`, de: `Keine Ausgaben erfasst ${period.label}.` }[lang];
    if (spese.length === 0) return { intent: 'top-category', answer: NONE };
    const byCat = {};
    spese.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totale = spese.reduce((s, t) => s + t.amount, 0);
    const pct = ((top[0][1] / totale) * 100).toFixed(0);
    const RESULT = {
      it: `${cap(period.label)} la voce più pesante è ${top[0][0]} con ${fmt(top[0][1])} (${pct}% del totale)${top[1] ? `, poi ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` e ${top[2][0]} (${fmt(top[2][1])})` : ''}.`,
      en: `${cap(period.label)} your biggest expense is ${top[0][0]} at ${fmt(top[0][1])} (${pct}% of the total)${top[1] ? `, then ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` and ${top[2][0]} (${fmt(top[2][1])})` : ''}.`,
      es: `${cap(period.label)} el gasto mayor es ${top[0][0]} con ${fmt(top[0][1])} (${pct}% del total)${top[1] ? `, luego ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` y ${top[2][0]} (${fmt(top[2][1])})` : ''}.`,
      fr: `${cap(period.label)} la plus grosse dépense est ${top[0][0]} avec ${fmt(top[0][1])} (${pct}% du total)${top[1] ? `, puis ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` et ${top[2][0]} (${fmt(top[2][1])})` : ''}.`,
      de: `${cap(period.label)} ist die größte Ausgabe ${top[0][0]} mit ${fmt(top[0][1])} (${pct}% der Summe)${top[1] ? `, dann ${top[1][0]} (${fmt(top[1][1])})` : ''}${top[2] ? ` und ${top[2][0]} (${fmt(top[2][1])})` : ''}.`,
    }[lang];
    return { intent: 'top-category', data: top, answer: RESULT };
  }

  // — "quanto ho risparmiato / messo da parte?"
  if (matches('savings', q)) {
    const period = resolvePeriod(q, ref, lang);
    const txs = txInPeriod(allTx, period);
    const inc = txs.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    const out = txs.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0);
    const net = inc - out;
    const POS = { it: (p, n, i, o) => `${p} hai messo da parte ${n} (${i} entrati, ${o} usciti).`, en: (p, n, i, o) => `${p} you saved ${n} (${i} in, ${o} out).`, es: (p, n, i, o) => `${p} has ahorrado ${n} (${i} entrados, ${o} salidos).`, fr: (p, n, i, o) => `${p} tu as économisé ${n} (${i} entrés, ${o} sortis).`, de: (p, n, i, o) => `${p} hast du ${n} gespart (${i} eingegangen, ${o} ausgegeben).` }[lang];
    const NEG = { it: (p, n, i, o) => `${p} hai speso ${n} più di quanto è entrato (${i} entrati, ${o} usciti).`, en: (p, n, i, o) => `${p} you spent ${n} more than came in (${i} in, ${o} out).`, es: (p, n, i, o) => `${p} has gastado ${n} más de lo que entró (${i} entrados, ${o} salidos).`, fr: (p, n, i, o) => `${p} tu as dépensé ${n} de plus que ce qui est entré (${i} entrés, ${o} sortis).`, de: (p, n, i, o) => `${p} hast du ${n} mehr ausgegeben als eingenommen (${i} eingegangen, ${o} ausgegeben).` }[lang];
    const label = cap(period.label);
    return { intent: 'savings', data: { inc, out, net }, answer: net >= 0 ? POS(label, fmt(net), fmt(inc), fmt(out)) : NEG(label, fmt(Math.abs(net)), fmt(inc), fmt(out)) };
  }

  // — "quanto ho guadagnato / entrate?"
  if (matches('income', q)) {
    const period = resolvePeriod(q, ref, lang);
    const inc = txInPeriod(allTx, period).filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    const label = cap(period.label);
    const RESULT = { it: `${label}: ${fmt(inc)} di entrate.`, en: `${label}: ${fmt(inc)} in income.`, es: `${label}: ${fmt(inc)} de ingresos.`, fr: `${label} : ${fmt(inc)} de revenus.`, de: `${label}: ${fmt(inc)} Einkommen.` }[lang];
    return { intent: 'income', data: { inc }, answer: RESULT };
  }

  // — "quanto ho speso [periodo] [in categoria]?"
  if (matches('spent', q)) {
    const period = resolvePeriod(q, ref, lang);
    let spese = txInPeriod(allTx, period).filter(t => t.type === 'uscita');
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    if (namedCat) spese = spese.filter(t => t.category === namedCat);
    const tot = spese.reduce((s, t) => s + t.amount, 0);
    const label = cap(period.label);
    const RESULT = {
      it: `${label} hai speso ${fmt(tot)}${namedCat ? ` in ${namedCat}` : ''} (${spese.length} movimenti).`,
      en: `${label} you spent ${fmt(tot)}${namedCat ? ` on ${namedCat}` : ''} (${spese.length} transactions).`,
      es: `${label} has gastado ${fmt(tot)}${namedCat ? ` en ${namedCat}` : ''} (${spese.length} movimientos).`,
      fr: `${label} tu as dépensé ${fmt(tot)}${namedCat ? ` en ${namedCat}` : ''} (${spese.length} mouvements).`,
      de: `${label} hast du ${fmt(tot)}${namedCat ? ` für ${namedCat}` : ''} ausgegeben (${spese.length} Buchungen).`,
    }[lang];
    return { intent: 'spent', data: { tot, count: spese.length, period, category: namedCat || null }, answer: RESULT };
  }

  // — obiettivi: "a che punto è il mio obiettivo?"
  if (matches('goal', q)) {
    const goals = ctx.savingsGoals || [];
    const NONE = { it: 'Non hai ancora obiettivi di risparmio. Ne creiamo uno dalla sezione Analisi?', en: 'You don\'t have any savings goals yet. Want to create one from the Analysis section?', es: 'Todavía no tienes objetivos de ahorro. ¿Creamos uno desde la sección Análisis?', fr: 'Tu n\'as pas encore d\'objectifs d\'épargne. On en crée un depuis la section Analyse ?', de: 'Du hast noch keine Sparziele. Sollen wir eins im Bereich Analyse erstellen?' }[lang];
    if (goals.length === 0) return { intent: 'goal', answer: NONE };
    const named = goals.find(g => q.includes(g.name.toLowerCase())) || goals[0];
    const prog = computeGoalProgress(named, allTx, ref);
    const onTrack = { it: prog.onTrack === true ? ' — sei in linea.' : prog.onTrack === false ? ' — sei indietro rispetto al ritmo necessario.' : '.', en: prog.onTrack === true ? ' — you\'re on track.' : prog.onTrack === false ? ' — you\'re behind the pace needed.' : '.', es: prog.onTrack === true ? ' — vas bien.' : prog.onTrack === false ? ' — vas por detrás del ritmo necesario.' : '.', fr: prog.onTrack === true ? ' — tu es dans les temps.' : prog.onTrack === false ? ' — tu es en retard sur le rythme nécessaire.' : '.', de: prog.onTrack === true ? ' — du liegst im Plan.' : prog.onTrack === false ? ' — du liegst hinter dem nötigen Tempo.' : '.' }[lang];
    const CONNECT = { it: 'su', en: 'of', es: 'de', fr: 'sur', de: 'von' }[lang];
    return { intent: 'goal', data: prog, answer: `"${named.name}": ${fmt(prog.saved)} ${CONNECT} ${fmt(named.target)} (${prog.pct}%)${onTrack}` };
  }

  // — onestà: nessun intent riconosciuto
  return { intent: 'unknown', answer: UNKNOWN_MSG[lang] };
}
