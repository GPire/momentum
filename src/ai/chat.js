// ============================================================
// CHATBOT NL MULTILINGUA — IT / EN / ES (on-device, deterministico)
// ============================================================
// Router conversazionale in linguaggio naturale sopra i motori DETERMINISTICI
// già verificati (advisor, tax, alpha, engagement). Onestà (regola #1): NON è
// un LLM generativo che allucina — riconosce l'intento in più lingue, calcola
// la risposta dai dati VERI, e la restituisce localizzata. Rileva la lingua e
// risponde in quella (IT/EN/ES completi; FR/DE rilevate → fallback EN, roadmap).
// Funzioni pure: lo stato arriva dal chiamante via ctx.
'use strict';

import { detectLanguage, isSupported } from '../i18n/detect.js';
import { getDailySafeToSpend, getMonthEndProjection } from '../predict/advisor.js';
import { taxSetAsideForPeriod } from '../predict/tax.js';
import { investableSurplus } from '../alpha/bridge.js';
import { monthKey } from '../core/constants.js';

// Pattern d'intento per lingua (parole-chiave, non frasi fisse → robusto al
// linguaggio naturale). Ordine = priorità.
const INTENTS = {
  spent: {
    it: /(quanto ho speso|quanto spendo|le mie spese)/,
    en: /(how much (did|have) i (spend|spent)|how much do i spend|my spending)/,
    es: /(cuánto (he )?gastado|cuánto gasto|mis gastos)/,
  },
  safeToSpend: {
    it: /(quanto posso spendere|budget di oggi|quanto mi resta oggi)/,
    en: /(how much can i spend|today.?s budget|how much left today)/,
    es: /(cuánto puedo gastar|presupuesto de hoy|cuánto me queda hoy)/,
  },
  savings: {
    it: /(quanto ho risparmiato|risparmio|messo da parte)/,
    en: /(how much (have i|did i) save|savings|set aside)/,
    es: /(cuánto (he )?ahorrado|ahorro|apartado)/,
  },
  invest: {
    it: /(quanto posso investire|posso investire)/,
    en: /(how much can i invest|can i invest)/,
    es: /(cuánto puedo invertir|puedo invertir)/,
  },
  tax: {
    it: /(quanto metto da parte per le tasse|tasse|partita iva|accantonare)/,
    en: /(how much for taxes|set aside for tax|tax)/,
    es: /(cuánto para impuestos|apartar para impuestos|impuestos|autónomo)/,
    fr: /(combien pour les impôts|mettre de côté pour|impôts|tva)/,
    de: /(wie viel für steuern|für steuern zurücklegen|steuern|mehrwertsteuer)/,
  },
};

// Pattern FR/DE per gli altri intenti (aggiunti dopo per non spezzare i primi 4)
INTENTS.spent.fr = /(combien j.?ai dépensé|combien je dépense|mes dépenses)/;
INTENTS.spent.de = /(wie viel habe ich .{0,20}ausgegeben|wie viel gebe ich aus|meine ausgaben)/;
INTENTS.safeToSpend.fr = /(combien puis-je dépenser|budget d.?aujourd|combien me reste)/;
INTENTS.safeToSpend.de = /(wie viel kann ich .{0,15}ausgeben|budget für heute|wie viel bleibt)/;
INTENTS.savings.fr = /(combien j.?ai économisé|épargne|mis de côté)/;
INTENTS.savings.de = /(wie viel habe ich gespart|ersparnis|zurückgelegt)/;
INTENTS.invest.fr = /(combien puis-je investir|puis-je investir)/;
INTENTS.invest.de = /(wie viel kann ich investieren|kann ich investieren)/;

// Frasi di risposta localizzate (template; i numeri arrivano dal motore).
const L = {
  it: {
    spent: (v) => `Questo mese hai speso ${v}.`,
    safe: (v, d) => `Oggi puoi spendere ${v} (restano ${d} per la settimana).`,
    safeOver: () => `Meglio non spendere oggi: questa settimana sei già oltre budget.`,
    savings: (v) => `Questo mese hai messo da parte ${v}.`,
    invest: (note) => note,
    tax: (note) => note,
    noBudget: () => `Imposta prima un budget mensile: da lì calcolo quanto puoi spendere.`,
    unknown: () => `Non ho capito. Prova: "quanto ho speso questo mese?", "quanto posso investire?", "quanto metto da parte per le tasse?".`,
  },
  en: {
    spent: (v) => `This month you spent ${v}.`,
    safe: (v, d) => `You can spend ${v} today (${d} left for the week).`,
    safeOver: () => `Better not to spend today: you're already over budget this week.`,
    savings: (v) => `This month you set aside ${v}.`,
    invest: (note) => note,
    tax: (note) => note,
    noBudget: () => `Set a monthly budget first, then I can tell you how much you can spend.`,
    unknown: () => `I didn't get that. Try: "how much did I spend this month?", "how much can I invest?", "how much for taxes?".`,
  },
  es: {
    spent: (v) => `Este mes has gastado ${v}.`,
    safe: (v, d) => `Hoy puedes gastar ${v} (te quedan ${d} para la semana).`,
    safeOver: () => `Mejor no gastes hoy: esta semana ya estás por encima del presupuesto.`,
    savings: (v) => `Este mes has apartado ${v}.`,
    invest: (note) => note,
    tax: (note) => note,
    noBudget: () => `Primero define un presupuesto mensual y te diré cuánto puedes gastar.`,
    unknown: () => `No lo he entendido. Prueba: "¿cuánto he gastado este mes?", "¿cuánto puedo invertir?", "¿cuánto para impuestos?".`,
  },
  fr: {
    spent: (v) => `Ce mois-ci tu as dépensé ${v}.`,
    safe: (v, d) => `Tu peux dépenser ${v} aujourd'hui (${d} restants pour la semaine).`,
    safeOver: () => `Mieux vaut ne pas dépenser aujourd'hui : tu es déjà au-dessus du budget cette semaine.`,
    savings: (v) => `Ce mois-ci tu as mis de côté ${v}.`,
    invest: (note) => note,
    tax: (note) => note,
    noBudget: () => `Définis d'abord un budget mensuel, puis je te dirai combien tu peux dépenser.`,
    unknown: () => `Je n'ai pas compris. Essaie : « combien j'ai dépensé ce mois ? », « combien puis-je investir ? », « combien pour les impôts ? ».`,
  },
  de: {
    spent: (v) => `Diesen Monat hast du ${v} ausgegeben.`,
    safe: (v, d) => `Du kannst heute ${v} ausgeben (${d} übrig für die Woche).`,
    safeOver: () => `Heute besser nichts ausgeben: Du bist diese Woche schon über dem Budget.`,
    savings: (v) => `Diesen Monat hast du ${v} zurückgelegt.`,
    invest: (note) => note,
    tax: (note) => note,
    noBudget: () => `Lege zuerst ein Monatsbudget fest, dann sage ich dir, wie viel du ausgeben kannst.`,
    unknown: () => `Das habe ich nicht verstanden. Versuche: „Wie viel habe ich diesen Monat ausgegeben?", „Wie viel kann ich investieren?", „Wie viel für Steuern?".`,
  },
};

const fmt = n => `${(+n).toFixed(2).replace('.', ',')}€`;

function matchIntent(q, lang) {
  for (const [intent, pats] of Object.entries(INTENTS)) {
    const pat = pats[lang] || pats.en;
    if (pat.test(q)) return intent;
  }
  return 'unknown';
}

function monthlyFinance(allTx, ref) {
  const months = {}; let invested = 0;
  for (const t of Object.values(allTx || {}).flat()) {
    const mk = (t.date || '').slice(0, 7); if (!mk) continue;
    const m = months[mk] = months[mk] || { inc: 0, out: 0 };
    if (t.type === 'entrata') m.inc += t.amount;
    else if (t.type === 'uscita') m.out += t.amount;
    else if (t.type === 'invest') invested += t.amount;
  }
  const keys = Object.keys(months); const n = keys.length || 1;
  const avgExp = keys.reduce((s, k) => s + months[k].out, 0) / n;
  const cur = months[monthKey(ref)] || { inc: 0, out: 0 };
  return { avgMonthlyExpense: avgExp, netMonthlyFlow: cur.inc - cur.out, invested };
}

// Punto d'ingresso: chat(messaggio, ctx). ctx = { allTx, monthlyBudget,
// referenceDate, taxRegime?, emergencyFund?, forceLang? }.
export function chat(message, ctx = {}) {
  const det = detectLanguage(message);
  const lang = ctx.forceLang || (isSupported(det.lang) ? det.lang : 'en'); // FR/DE → EN finché non completi
  const t = L[lang];
  const q = String(message || '').toLowerCase().trim();
  const ref = ctx.referenceDate || new Date();
  const allTx = ctx.allTx || {};
  const monthTxs = allTx[monthKey(ref)] || [];
  const intent = matchIntent(q, lang);

  let answer;
  switch (intent) {
    case 'spent': {
      const spent = monthTxs.filter(x => x.type === 'uscita').reduce((s, x) => s + x.amount, 0);
      answer = t.spent(fmt(spent)); break;
    }
    case 'safeToSpend': {
      const sts = getDailySafeToSpend({ monthTxs, allTx, monthlyBudget: ctx.monthlyBudget, referenceDate: ref });
      answer = !sts ? t.noBudget() : sts.isOverBudget ? t.safeOver() : t.safe(fmt(sts.safeToday), fmt(sts.weekRemaining)); break;
    }
    case 'savings': {
      const inc = monthTxs.filter(x => x.type === 'entrata').reduce((s, x) => s + x.amount, 0);
      const out = monthTxs.filter(x => x.type === 'uscita').reduce((s, x) => s + x.amount, 0);
      answer = t.savings(fmt(inc - out)); break;
    }
    case 'invest': {
      const f = monthlyFinance(allTx, ref);
      const r = investableSurplus({ netMonthlyFlow: f.netMonthlyFlow, avgMonthlyExpense: f.avgMonthlyExpense, currentEmergencyFund: ctx.emergencyFund ?? f.invested });
      answer = r.note; break; // bridge note (IT); localizzazione piena roadmap
    }
    case 'tax': {
      const r = taxSetAsideForPeriod(monthTxs, { regime: ctx.taxRegime || 'forfettario' });
      answer = r.note; break;
    }
    default:
      answer = t.unknown();
  }
  return { lang, intent, answer, detectedConfidence: det.confidence };
}
