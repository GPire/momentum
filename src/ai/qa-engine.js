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
import { buildCausalGraph, propagateImpact, pruneNonCausal, buildCategorySeries } from '../predict/causal-graph.js';
import { analyzeCausalStructure } from '../predict/causal-orchestrator.js';
import { simulateScenario } from '../predict/causal-effects.js';
import { investableSurplus } from '../alpha/bridge.js';
import { commitmentForecast } from '../predict/fixed-commitments.js';
import { bnplExposure } from '../predict/bnpl.js';
import { computeNetWorth } from '../alpha/net-worth.js';
import { monthKey } from '../core/constants.js';
import { detectLanguage } from '../i18n/detect.js';
import MEASURED from '../alpha/measured-assumptions.js';
import { findMacroConfounderWarning, macroConfounderNote } from './causal-macro-note.js';
import { suggestLearnedIntent } from './qa-learning.js';

// Una frase-innesco letterale per intento, garantita dal test dedicato a
// combaciare col pattern italiano corrispondente in PATTERNS più sotto.
// Usata SOLO per l'apprendimento (vedi qa-learning.js): quando l'utente ha
// già confermato due volte che una sua formulazione significa "X", la si
// aiuta a essere riconosciuta aggiungendo questa frase a `qMatch` — mai al
// testo `q` che alimenta importi/categorie/periodi.
const CANONICAL_TRIGGER = {
  invest: 'quanto posso investire',
  affordability: 'posso permettermi',
  safeToSpend: 'quanto posso spendere oggi',
  budgetLeft: 'quanto mi resta',
  monthEnd: 'fine mese',
  subscriptions: 'abbonamenti',
  causal: 'cosa succede se spendo di più in',
  topCategory: 'dove spendo',
  savings: 'risparmiato',
  income: 'guadagnato',
  spent: 'quanto ho speso',
  goal: 'obiettivo',
  netWorth: 'patrimonio',
  payday: 'quando mi pagano',
  bnplOwed: 'quanto devo a rate',
};

// Arricchimento onesto per "dove posso investire" (segnalato dall'utente:
// senza questo la domanda cadeva sulla chat generica, che con nessun dato
// reale rispondeva solo con frasi educative generiche). MAI un consiglio
// d'acquisto specifico — solo le STESSE categorie e Sharpe ratio MISURATI
// (walk-forward, mai un numero inventato) già mostrati nella tabella
// "Strategia (10 anni)" di Analisi Tensor, qui riassunti in una frase.
function topMeasuredStrategiesNote() {
  const rows = [
    { label: MEASURED.spy?.label, sharpe: MEASURED.spy?.momentumTiming?.sharpe },
    { label: `${MEASURED.spy?.label} (buy&hold)`, sharpe: MEASURED.spy?.buyHold?.sharpe },
    { label: MEASURED.btc?.label, sharpe: MEASURED.btc?.buyHold?.sharpe },
  ].filter(r => r.label && Number.isFinite(r.sharpe)).sort((a, b) => b.sharpe - a.sharpe);
  if (!rows.length) return '';
  const top = rows.slice(0, 2).map(r => `${r.label} (Sharpe ${r.sharpe.toFixed(2)}, misurato)`).join(' e ');
  return ` Dato storico (non una previsione, non un consiglio d'acquisto): negli ultimi anni ${top} hanno avuto il miglior rapporto rischio/rendimento — vedi la tabella completa in Analisi Tensor.`;
}

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

// ── CORREZIONE REFUSI (richiesta esplicita: "se uno sbaglia a digitare non
// funziona") ─────────────────────────────────────────────────────────────
// Distanza di Levenshtein pura, senza librerie esterne — piccola e testabile.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

// Parole-chiave italiane più importanti dei pattern qui sotto — usate SOLO
// per correggere refusi PRIMA del riconoscimento (mai per rispondere: gli
// intent restano gli stessi regex di sempre, verificati). Un refuso tipico
// ("spendrere", "investmire", "stipnedio") viene riportato alla parola
// corretta se abbastanza vicino e senza ambiguità — non tocca parole già
// corrette o troppo corte (rumore, non refuso).
const TYPO_DICTIONARY_IT = [
  'spendere', 'speso', 'spesa', 'spese', 'investire', 'investimento', 'investimenti',
  'patrimonio', 'stipendio', 'rate', 'abbonamenti', 'obiettivo', 'permettermi',
  'resta', 'rimane', 'budget', 'previsione', 'proiezione', 'risparmiato', 'risparmi',
  'categoria', 'notizie', 'grafico', 'andamento', 'storico', 'oggi', 'mese', 'settimana',
];
function correctTypos(text) {
  return text.split(/(\s+)/).map(tok => {
    // Stacca punteggiatura iniziale/finale (es. "stipnedio?") per non far
    // fallire il match solo per un "?" o "," attaccato alla parola.
    const m = tok.match(/^([^a-zàèéìòù]*)([a-zàèéìòù]+)([^a-zàèéìòù]*)$/i);
    if (!m) return tok;
    const [, pre, word, post] = m;
    if (word.length < 4) return tok;
    if (TYPO_DICTIONARY_IT.includes(word)) return tok; // già corretta
    const maxDist = word.length <= 6 ? 1 : 2;
    let best = null, bestDist = Infinity, ties = 0;
    for (const cand of TYPO_DICTIONARY_IT) {
      const dist = levenshtein(word, cand);
      if (dist < bestDist) { bestDist = dist; best = cand; ties = 1; }
      else if (dist === bestDist) ties++;
    }
    return best && bestDist <= maxDist && bestDist > 0 && ties === 1 ? pre + best + post : tok;
  }).join('');
}

// Pattern d'intento PER LINGUA (coerente con lo stile di src/ai/chat.js:
// parole-chiave robuste, non frasi fisse). Un intento matcha se il pattern
// della lingua rilevata (o di una qualsiasi, come rete di sicurezza su testo
// misto) trova riscontro.
const PATTERNS = {
  invest: {
    it: /(quanto posso investire|posso investire|quanto investire|investire questo mese|dove (posso )?investire|in cosa investire|dove mettere i (miei )?soldi)/,
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
  // 3 nuovi intent, richiesti esplicitamente ("altre feature di Chiedi a
  // Momentum") — riusano motori GIÀ esistenti e verificati (fixed-commitments,
  // bnpl, net-worth), mai nuovi calcoli inventati per l'occasione.
  netWorth: {
    it: /(patrimonio|quanto ho in totale|quanto vale tutto|quanto possiedo)/,
    en: /(net worth|how much (do i have|am i worth) in total)/,
    es: /(patrimonio neto|cuánto tengo en total)/,
    fr: /(patrimoine|combien j.?ai au total)/,
    de: /(vermögen|wie viel habe ich insgesamt)/,
  },
  payday: {
    it: /(quando mi pagano|quanto manca (allo |al )?stipendio|prima dello stipendio|quando arriva lo stipendio)/,
    en: /(when do i get paid|until (my )?(pay ?day|salary)|before (my )?(pay ?day|salary))/,
    es: /(cuándo me pagan|falta para (el )?sueldo)/,
    fr: /(quand suis-je payé|avant le salaire)/,
    de: /(wann werde ich bezahlt|bis zum gehalt)/,
  },
  bnplOwed: {
    it: /(quanto devo (ancora )?a rate|rate aperte|piani a rate|klarna|scalapay|paypal.{0,10}rate)/,
    en: /(how much do i (still )?owe .{0,15}installments|open installment plans|buy now pay later)/,
    es: /(cuánto debo .{0,15}cuotas|planes de cuotas)/,
    fr: /(combien dois-je .{0,15}mensualités|plans de paiement)/,
    de: /(wie viel schulde ich .{0,15}raten|ratenpläne)/,
  },
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

// Involucro sottile: calcola di nuovo (è pura ed economica) se la domanda
// combacia con qualcosa che l'utente ha già insegnato, e se l'intento
// davvero prodotto coincide con quello atteso lo dichiara con `learned:true`
// — mai una risposta imparata che sembra indistinguibile da una normale.
// Nota onesta: può marcare `learned:true` anche quando la frase-innesco non
// era strettamente necessaria (l'intento sarebbe scattato comunque) — è
// comunque corretto dire "questo è rinforzato da ciò che mi hai insegnato".
export function answerQuestion(question, ctx) {
  const risultato = answerQuestionCore(question, ctx);
  if (ctx?.qaLearning && risultato && risultato.intent !== 'unknown') {
    const suggerito = suggestLearnedIntent(ctx.qaLearning, question);
    if (suggerito?.autoApplicabile && suggerito.intent === risultato.intent) {
      risultato.learned = true;
    }
  }
  return risultato;
}

function answerQuestionCore(question, ctx) {
  const q = (question || '').toLowerCase().trim();
  const ref = ctx.referenceDate || new Date();
  const allTx = ctx.allTx || {};
  const monthTxs = allTx[monthKey(ref)] || [];
  if (!q) return { intent: 'unknown', answer: UNKNOWN_MSG.it };
  const lang = L(detectLanguage(q).lang);
  // Solo per il RICONOSCIMENTO dell'intento (matches()) — mai per estrarre
  // importi/categorie/periodi, che restano sul testo originale `q`.
  let qMatch = correctTypos(q);

  // AUTO-APPRENDIMENTO (ctx.qaLearning, opzionale — mai una chiamata di
  // rete qui, resta puro/sincrono): se questa formulazione (o una molto
  // simile) è già stata confermata dall'utente almeno 2 volte come
  // "intendevo X" (qa-learning.js, mai da un'unica conferma), si aiuta il
  // riconoscimento ad attivarsi. Il risultato porta sempre `learned:true` —
  // mai una risposta che sembra magica senza dire che è stata imparata.
  let appresoIntent = null;
  if (ctx.qaLearning) {
    const suggerito = suggestLearnedIntent(ctx.qaLearning, question);
    if (suggerito?.autoApplicabile && CANONICAL_TRIGGER[suggerito.intent]) {
      appresoIntent = suggerito.intent;
      qMatch = `${qMatch} ${CANONICAL_TRIGGER[suggerito.intent]}`;
    }
  }

  // — "quanto posso investire?"
  if (matches('invest', qMatch)) {
    const f = monthlyFinance(allTx, ref);
    const r = investableSurplus({
      netMonthlyFlow: f.netMonthlyFlow,
      avgMonthlyExpense: f.avgMonthlyExpense,
      currentEmergencyFund: ctx.emergencyFund ?? f.invested,
      emergencyMonths: ctx.emergencyMonths ?? 6,
    });
    const enrich = r.reason === 'ok' ? topMeasuredStrategiesNote() : '';
    return { intent: 'invest', data: r, answer: r.note + enrich };
  }

  // — "quanto vale il mio patrimonio?" (riusa computeNetWorth, stessa
  // funzione già usata in Analisi Tensor — mai un calcolo isolato).
  if (matches('netWorth', qMatch)) {
    const n = computeNetWorth({
      transactions: allTx,
      positions: ctx.positions || [],
      currentPriceByTicker: ctx.currentPriceByTicker || {},
      manualAssets: ctx.manualAssets || [],
      liabilities: ctx.liabilities || 0,
      asOf: ref,
    });
    const parts = [`contante ${fmt(n.cash)}`];
    if (n.invested > 0) parts.push(`investito ${fmt(n.invested)}`);
    if (n.liabilities > 0) parts.push(`debiti −${fmt(n.liabilities)}`);
    return { intent: 'net-worth', data: n, answer: `Il tuo patrimonio totale è ${fmt(n.total)} (${parts.join(', ')}).` };
  }

  // — "quando mi pagano?" / "quanto manca prima dello stipendio?" (riusa
  // commitmentForecast, lo stesso motore della card "Il tuo mese senza
  // sorprese" — mai un secondo calcolo isolato per il QA).
  if (matches('payday', qMatch)) {
    if (!ctx.salary) return { intent: 'payday', answer: 'Non so ancora quando ti pagano: dimmelo in Momentum Vault → Stipendio, o registra qualche entrata e lo capirò da solo.' };
    const f = commitmentForecast(ctx.fixedCommitments || [], ctx.salary, { now: ref.getTime(), monthTx: monthTxs });
    if (!f.payday) return { intent: 'payday', answer: 'Non riesco a calcolare la prossima data di stipendio con i dati che ho.' };
    const days = f.payday.daysToNext;
    const dayLabel = days === 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`;
    const dueTxt = f.dueBeforePaydayTotal > 0 ? ` Prima di allora devi ancora coprire ${fmt(f.dueBeforePaydayTotal)} di impegni fissi.` : ' Nessun impegno fisso da coprire prima di allora.';
    return { intent: 'payday', data: f, answer: `Ti pagano ${dayLabel} (${f.payday.date}).${dueTxt}` };
  }

  // — "quanto devo ancora a rate?" (riusa bnplExposure, lo stesso motore
  // del radar BNPL — mai un secondo rilevatore isolato per il QA).
  if (matches('bnplOwed', qMatch)) {
    const exp = bnplExposure(allTx, { now: ref.getTime(), learned: ctx.bnplLearned || {}, anticipate: true, dismissed: ctx.bnplDismissed || [] });
    if (exp.count === 0) return { intent: 'bnpl-owed', data: exp, answer: 'Non vedo piani a rate aperti al momento.' };
    const byProv = exp.byProvider.map(p => `${p.providerLabel} ${fmt(p.remainingTotal)}`).join(', ');
    return { intent: 'bnpl-owed', data: exp, answer: `Hai ${exp.count} piano${exp.count > 1 ? 'i' : ''} a rate aperto${exp.count > 1 ? 'i' : ''}: ${byProv}. Totale residuo ${fmt(exp.totalRemaining)}.` };
  }

  // — "posso permettermi X?" (prima di safe-to-spend: contiene un importo)
  if (matches('affordability', qMatch) && extractAmount(q) !== null) {
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
  if (matches('safeToSpend', qMatch)) {
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
  if (matches('budgetLeft', qMatch)) {
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
  if (matches('monthEnd', qMatch)) {
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
  if (matches('subscriptions', qMatch)) {
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
  if (matches('causal', qMatch)) {
    const cats = [...new Set(Object.values(allTx).flat().map(t => t.category))];
    const namedCat = cats.find(c => c && q.includes(String(c).toLowerCase()));
    const ASK_CAT = { it: 'Dimmi la categoria: ad esempio "cosa succede se spendo di più in Ristorante?"', en: 'Tell me the category: e.g. "what happens if I spend more on dining?"', es: 'Dime la categoría: por ejemplo "¿qué pasa si gasto más en Restaurante?"', fr: 'Dis-moi la catégorie : par exemple "que se passe-t-il si je dépense plus en Restaurant ?"', de: 'Nenn mir die Kategorie: z.B. "was passiert wenn ich mehr für Restaurant ausgebe?"' }[lang];
    if (!namedCat) return { intent: 'causal', answer: ASK_CAT };
    // Lag variabile (fino a 3 settimane, non solo 0/1) + potatura della
    // direzione più debole per coppia — entrambe le funzioni esistevano già,
    // testate e usate altrove (src/ai/reasoning-fusion.js), ma il QA
    // "causale" usava ancora solo la versione base a lag fisso: catturava
    // effetti immediati/a 1 settimana, non quelli differiti di 2-3 settimane
    // ("una spesa oggi si riflette sul risparmio fra qualche settimana").
    const links = pruneNonCausal(buildCausalGraph(allTx, ref, { maxLag: 3 }));
    const effects = propagateImpact(links, namedCat, 30); // scenario: +30%
    const NONE = { it: `Nei tuoi dati non vedo altre spese che si muovono insieme a ${namedCat}: aumentarla non dovrebbe trascinare altro.`, en: `In your data, I don't see other expenses moving together with ${namedCat}: increasing it shouldn't drag anything else along.`, es: `En tus datos no veo otros gastos que se muevan junto a ${namedCat}: aumentarlo no debería arrastrar nada más.`, fr: `Dans tes données je ne vois pas d'autres dépenses bouger avec ${namedCat} : l'augmenter ne devrait rien entraîner d'autre.`, de: `In deinen Daten sehe ich keine anderen Ausgaben, die sich mit ${namedCat} mitbewegen: eine Erhöhung sollte nichts anderes nach sich ziehen.` }[lang];
    if (effects.length === 0) return { intent: 'causal', answer: NONE };
    const dir = (up) => ({ it: up ? 'sale' : 'scende', en: up ? 'rises' : 'falls', es: up ? 'sube' : 'baja', fr: up ? 'monte' : 'baisse', de: up ? 'steigt' : 'sinkt' }[lang]);
    const after = { it: ' la settimana dopo', en: ' the week after', es: ' la semana siguiente', fr: ' la semaine suivante', de: ' die Woche danach' }[lang];
    const parts = effects.slice(0, 3).map(e => `${e.category} ${dir(e.expectedPct > 0)} ${Math.abs(e.expectedPct)}%${e.lagWeeks > 0 ? after : ''}`);
    let RESULT = { it: `Nei tuoi dati, quando sale ${namedCat} (+30%): ${parts.join('; ')}. Non è una legge, è quello che è successo finora nelle tue settimane.`, en: `In your data, when ${namedCat} rises (+30%): ${parts.join('; ')}. This isn't a law, it's what's happened so far in your weeks.`, es: `En tus datos, cuando sube ${namedCat} (+30%): ${parts.join('; ')}. No es una ley, es lo que ha pasado hasta ahora en tus semanas.`, fr: `Dans tes données, quand ${namedCat} augmente (+30%) : ${parts.join('; ')}. Ce n'est pas une loi, c'est ce qui s'est passé jusqu'ici dans tes semaines.`, de: `In deinen Daten, wenn ${namedCat} steigt (+30%): ${parts.join('; ')}. Das ist kein Gesetz, sondern was bisher in deinen Wochen passiert ist.` }[lang];

    // ADDITIVO (mai al posto della risposta esistente): con abbastanza
    // settimane di storia (src/predict/causal-orchestrator.js sceglie da solo
    // se il controllo avanzato PCMCI può girare), si aggiunge una stima in
    // EURO con incertezza — la differenza tra "si muovono insieme" e "se lo
    // fai, questo è quanto cambia, tra tot e tot". Se i dati non bastano o la
    // diagnosi trova un problema strutturale (es. una causa comune nascosta,
    // tipo lo stipendio che guida entrambe), la frase in più semplicemente
    // non compare: mai un numero quantificato che il controllo scientifico
    // non sostiene.
    try {
      const series = buildCategorySeries(allTx, ref, 26);
      // ctx.macroContext (opzionale, PRE-CALCOLATO dal chiamante — qa-engine.js
      // resta puro/sincrono, mai una chiamata di rete qui dentro): quando
      // main.js ha già scaricato il tasso BCE (predict/macro-context.js,
      // senza chiave), lo passa qui perché il QA possa spiegare un
      // confondente nascosto invece di limitarsi a "qualcosa che non vediamo".
      const analisi = analyzeCausalStructure(series, { allTx, maxLag: 3, macroContext: ctx.macroContext || null });
      // Se la diagnosi ha trovato che il legame è probabilmente spiegato dal
      // macro (non un vero effetto tra le TUE categorie), lo si dice PRIMA di
      // qualunque numero — mai lasciare che l'utente creda di avere una leva
      // che in realtà è solo un tasso che si muove per conto suo.
      const avvisoMacro = findMacroConfounderWarning(analisi.diagnosi?.avvertimenti, namedCat);
      if (avvisoMacro) RESULT += macroConfounderNote(avvisoMacro, namedCat, lang);
      if (analisi.motore === 'pcmci' && analisi.diagnosi?.perDecidere) {
        const settimanaleMedio = (series[namedCat] || []).reduce((s, v) => s + v, 0) / Math.max(1, (series[namedCat] || []).length);
        const delta = settimanaleMedio * 0.3;
        if (delta > 0) {
          const scenari = simulateScenario(analisi.edges, { [namedCat]: delta }, { targets: null });
          const certi = scenari.filter((s) => s.target !== namedCat && s.certo);
          if (certi.length) {
            const riga = certi.slice(0, 2).map((s) => {
              const segno = s.effetto >= 0 ? '+' : '';
              return `${s.target} ${segno}${fmt(s.effetto)}`;
            }).join(', ');
            const EXTRA = {
              it: ` In euro: aumentando ${namedCat} di ${fmt(delta)}/settimana, ci si aspetta ${riga}.`,
              en: ` In money: raising ${namedCat} by ${fmt(delta)}/week, expect ${riga}.`,
              es: ` En euros: subiendo ${namedCat} en ${fmt(delta)}/semana, se espera ${riga}.`,
              fr: ` En euros : en augmentant ${namedCat} de ${fmt(delta)}/semaine, on peut attendre ${riga}.`,
              de: ` In Euro: bei einer Erhöhung von ${namedCat} um ${fmt(delta)}/Woche, erwarte ${riga}.`,
            }[lang];
            RESULT += EXTRA;
          }
        }
      }
    } catch (_) { /* la risposta esistente resta valida anche se il controllo avanzato non gira */ }

    return { intent: 'causal', data: effects, answer: RESULT };
  }

  // — "dove spendo di più?" (prima di "quanto ho speso": distribuzione)
  if (matches('topCategory', qMatch)) {
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
  if (matches('savings', qMatch)) {
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
  if (matches('income', qMatch)) {
    const period = resolvePeriod(q, ref, lang);
    const inc = txInPeriod(allTx, period).filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0);
    const label = cap(period.label);
    const RESULT = { it: `${label}: ${fmt(inc)} di entrate.`, en: `${label}: ${fmt(inc)} in income.`, es: `${label}: ${fmt(inc)} de ingresos.`, fr: `${label} : ${fmt(inc)} de revenus.`, de: `${label}: ${fmt(inc)} Einkommen.` }[lang];
    return { intent: 'income', data: { inc }, answer: RESULT };
  }

  // — "quanto ho speso [periodo] [in categoria]?"
  if (matches('spent', qMatch)) {
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
  if (matches('goal', qMatch)) {
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
  // ── Prima di arrendersi: le domande sui MERCATI ──
  // Il motore di analisi dei mercati (src/alpha/*) sa rispondere a una classe
  // di domande che il QA delle finanze personali non copre: cos'e' successo in
  // un certo periodo, cosa ha protetto nei crolli, se l'oro o le cripto
  // proteggono davvero, come sta il mercato adesso. E sa anche RIFIUTARE, con
  // il motivo, le domande su cosa comprare o dove andra' il mercato.
  // Si guarda qui e non prima perche' le domande sui soldi PROPRI hanno la
  // precedenza: "quanto ho speso" non deve mai finire in un'analisi di borsa.
  // Il riconoscimento e' sincrono e senza rete; la risposta viene costruita in
  // modo asincrono solo se l'intento scatta, cosi' i pannelli di dati pesanti
  // si caricano unicamente quando servono davvero.
  if (ctx?.mercato) {
    const m = ctx.mercato(question);
    if (m) return m;
  }

  return { intent: 'unknown', answer: UNKNOWN_MSG[lang] };
}
