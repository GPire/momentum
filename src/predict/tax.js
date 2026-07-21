// ============================================================
// PARTITA IVA — accantonamento fiscale automatico (bassa frizione)
// ============================================================
// Frizione enorme e reale per freelance/P.IVA: sapere quanto mettere da parte
// per tasse+contributi+IVA a ogni incasso, per non trovarsi scoperti a fine
// anno. Momentum lo calcola da ogni entrata. Onestà (regola #1): NON è
// consulenza fiscale né sostituisce il commercialista — sono STIME su aliquote
// DICHIARATE dall'utente (configurabili), coi valori di default del regime
// forfettario/ordinario italiano. Funzioni pure, testabili.
'use strict';

// Configurazioni di default (modificabili dall'utente). Regime forfettario:
// coefficiente di redditività (dipende dal codice ATECO, default 78% servizi),
// imposta sostitutiva 15% (5% primi 5 anni startup), gestione separata INPS
// ~26,07% sul reddito imponibile. Ordinario: IRPEF a scaglioni (stima con
// aliquota media dichiarata) + IVA 22% + INPS. Tutto DICHIARATO, mai nascosto.
export const REGIMI = {
  forfettario: { coeffRedditivita: 0.78, impostaSostitutiva: 0.15, inps: 0.2607, iva: 0, label: 'Forfettario (servizi, imposta 15%)' },
  forfettario_startup: { coeffRedditivita: 0.78, impostaSostitutiva: 0.05, inps: 0.2607, iva: 0, label: 'Forfettario startup (imposta 5%, primi 5 anni)' },
  ordinario: { coeffRedditivita: 1.0, impostaSostitutiva: 0.27, inps: 0.24, iva: 0.22, label: 'Ordinario (IRPEF media stimata + IVA 22%)' },
};

// Coefficiente di redditività forfettario per gruppo ATECO (valori reali IT):
// l'imposta forfettaria si calcola sul fatturato × questo coefficiente. Senza
// conoscerlo, il calcolo è arbitrario — per questo va CHIESTO/appreso, non
// assunto. Default 78% (servizi/professionisti), il più comune.
export const ATECO_COEFFICIENTI = {
  professionisti: { coeff: 0.78, label: 'Professionisti / servizi (78%)' },
  commercio: { coeff: 0.40, label: 'Commercio ingrosso/dettaglio (40%)' },
  ambulante_alimentari: { coeff: 0.40, label: 'Ambulante alimentari (40%)' },
  intermediari: { coeff: 0.62, label: 'Intermediari del commercio (62%)' },
  costruzioni: { coeff: 0.86, label: 'Costruzioni / immobiliare (86%)' },
  altre: { coeff: 0.67, label: 'Altre attività (67%)' },
};

// Tetto di ricavi per restare nel regime forfettario (Italia, 85.000€/anno).
// Superarlo obbliga al regime ordinario: è un'informazione predittiva reale
// e utile, non una previsione inventata.
export const FORFETTARIO_CEILING = 85000;

import { rulesForYear } from './tax-rules.js';

// ── CONSIGLI FISCALI (come un commercialista, ma onesto) ──
// Genera consigli PRIORITIZZATI dalla situazione REALE dell'utente, con le
// regole dell'anno pertinente (tax-rules.js). Onestà (regola #1): suggerimenti
// su regole pubbliche, MAI consulenza personalizzata — il disclaimer "verifica
// col commercialista" resta sempre. input: { annualizedRevenue, invoicedYTD,
// currentSetAside, estimatedAnnualTax, regime, startupYearsLeft, year }
export function taxAdvice(input = {}) {
  const year = input.year || new Date().getFullYear();
  const rules = rulesForYear(year);
  const advice = [];
  const eur = (n) => `${Math.round(n).toLocaleString('it-IT')}€`;

  if (input.regime && input.regime.startsWith('forfettario') && input.annualizedRevenue > 0) {
    const pct = input.annualizedRevenue / rules.forfettarioCeiling;
    if (pct > 1) advice.push({ priority: 'high', icon: '⚠️', text: `A questo ritmo superi il tetto forfettario (${eur(rules.forfettarioCeiling)}): preparati al passaggio all'ordinario, dove cambiano IVA e aliquote.` });
    else if (pct >= 0.8) advice.push({ priority: 'medium', icon: '📊', text: `Sei al ${Math.round(pct * 100)}% del tetto forfettario (${eur(rules.forfettarioCeiling)}): tieni d'occhio il fatturato per non superarlo senza accorgertene.` });
  }

  if (input.estimatedAnnualTax > 0 && input.currentSetAside != null && input.annualizedRevenue > 0) {
    const dovutoOra = input.estimatedAnnualTax * Math.min(1, (input.invoicedYTD || 0) / input.annualizedRevenue);
    if (input.currentSetAside < dovutoOra * 0.9) {
      advice.push({ priority: 'high', icon: '🏦', text: `Per le tasse dovresti aver messo da parte ~${eur(dovutoOra)}: ne hai ${eur(input.currentSetAside)}. Accantona la differenza ora per non trovarti scoperto a fine anno.` });
    } else if (input.currentSetAside >= dovutoOra) {
      advice.push({ priority: 'info', icon: '✅', text: `Sei in pari con l'accantonamento tasse (~${eur(input.currentSetAside)}): ottimo, continua così.` });
    }
  }

  if (input.regime === 'forfettario_startup' && input.startupYearsLeft > 0) {
    advice.push({ priority: 'info', icon: '🚀', text: `Sei sull'aliquota startup al ${(rules.impostaStartup * 100).toFixed(0)}% (ti restano ~${input.startupYearsLeft} anni): dal termine sale al ${(rules.impostaStd * 100).toFixed(0)}%, mettine un po' di più da parte in vista di quel salto.` });
  }

  const rank = { high: 0, medium: 1, info: 2 };
  advice.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return { advice, rulesYear: rules.year };
}

// Quanto accantonare da UN incasso lordo. Ritorna la scomposizione completa
// e tracciabile (mai un numero orfano).
// `amount` = importo incassato (imponibile per forfettario; per ordinario si
// assume amount = imponibile + IVA se `ivaInclusa`).
export function taxSetAside(amount, opts = {}) {
  const regimeKey = opts.regime || 'forfettario';
  const r = { ...REGIMI[regimeKey] || REGIMI.forfettario, ...opts.overrides };
  const gross = Math.max(0, amount || 0);
  if (gross === 0) return { setAside: 0, net: 0, breakdown: [], regime: r.label };

  // IVA (solo ordinario): quota da versare, separata dal reddito
  let iva = 0, imponibile = gross;
  if (r.iva > 0) {
    if (opts.ivaInclusa) { imponibile = gross / (1 + r.iva); iva = gross - imponibile; }
    else { iva = gross * r.iva; } // IVA aggiunta a parte
  }

  // Reddito imponibile su cui calcolare imposta + contributi
  const redditoImponibile = imponibile * r.coeffRedditivita;
  const inps = redditoImponibile * r.inps;
  const imposta = (redditoImponibile - inps) * r.impostaSostitutiva; // INPS deducibile

  const setAside = +(iva + inps + imposta).toFixed(2);
  const net = +(gross - setAside).toFixed(2);
  const breakdown = [
    ...(iva > 0 ? [{ voce: 'IVA da versare', importo: +iva.toFixed(2) }] : []),
    { voce: 'Contributi INPS', importo: +inps.toFixed(2) },
    { voce: r.impostaSostitutiva <= 0.15 ? 'Imposta sostitutiva' : 'Imposta (stima)', importo: +imposta.toFixed(2) },
  ];
  return { setAside, net, breakdown, regime: r.label, effectiveRate: +((setAside / gross) * 100).toFixed(1) };
}

// ── Classificazione INTELLIGENTE dell'entrata (fix "tasse messe a caso") ──
// Il problema reale: non ogni entrata è una FATTURA P.IVA. Uno stipendio è già
// tassato alla fonte; un rimborso/regalo/giroconto NON è reddito imponibile.
// Applicare l'accantonamento a TUTTE le entrate è arbitrario. Qui si inferisce
// dal testo (e da un flag esplicito se presente), con onestà: le entrate
// ambigue NON si assumono in silenzio, si marcano 'uncertain' così la UI può
// chiedere "è una fattura?". Regola #1: mai un numero spacciato per certo.
const INVOICE_KW = /(fattura|invoice|compenso|parcella|prestazione|onorario|notula|saldo\s?fatt|acconto\s?fatt|p\.?\s?iva|partita iva|corrispettiv|cliente|consulenz|consulting|freelance|collaborazione)/i;
const SALARY_KW = /(stipendio|cedolino|busta paga|emolument|salary|payroll|wage|tredicesima|quattordicesima|netto in busta|retribuzione)/i;
// Non imponibili come fattura P.IVA: rimborsi, regali, giroconti, interessi,
// dividendi, bonus bancari, prestiti (IT + EN per gli export Revolut).
const PERSONAL_KW = /(rimborso|refund|regalo|gift|restituzione|giroconto|storno|reversal|cashback|vincita|prestito|loan|bonifico da|transfer from|ricarica|top.?up|interess|interest|dividend|bonus)/i;

// Ritorna { kind: 'invoice'|'salary'|'personal'|'uncertain', reason }.
// Priorità: (1) flag esplicito dell'utente; (2) parole nella DESCRIZIONE (il
// segnale forte e specifico); (3) la categoria da sola NON basta — 'stipendio'
// è la categoria DI DEFAULT di Momentum per ogni entrata, quindi non informa:
// meglio 'uncertain' (da confermare) che un'etichetta sbagliata.
// `learned` = mappa APPRESA dalle correzioni dell'utente { tokenNormalizzato:
// kind }. È l'integrazione con l'auto-apprendimento: quando l'utente conferma
// "questa è una fattura" (o non lo è), Momentum lo ricorda per quel mittente
// e non lo richiede più — come l'orchestratore impara le categorie.
function incomeKey(description = '') {
  return String(description).toLowerCase().replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
// Token per l'apprendimento GENERALIZZANTE: parole "mittente" (studio, verdi,
// acme...) togliendo connettori, mesi e verbi bancari generici (che non
// identificano un mittente). Così una conferma su "Studio Verdi marzo" insegna
// i token studio/verdi e riconosce anche "Studio Verdi aprile" — cosa che la
// sola chiave esatta non fa. È un mini Naive-Bayes appreso online dalle conferme.
const INCOME_STOP = new Set([
  'bonifico', 'pagamento', 'pagam', 'accredito', 'ricevuto', 'ricevut', 'saldo', 'acconto', 'importo',
  'del', 'della', 'dei', 'delle', 'dal', 'dalla', 'per', 'con', 'una', 'uno', 'gli', 'lei', 'the', 'for',
  'from', 'payment', 'transfer', 'srl', 'spa', 'snc', 'sas', 'ditta',
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);
function tokenizeIncome(description = '') {
  return String(description).toLowerCase()
    .replace(/[^a-zàèéìòùç]+/gi, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !INCOME_STOP.has(t));
}
// Normalizza la memoria fiscale in { k:{chiaveEsatta:kind}, t:{token:{invoice,
// salary,personal}} }, MIGRANDO le vecchie mappe piatte { chiave:kind } già
// salvate nei vault degli utenti (retro-compatibilità totale).
const INCOME_KINDS = ['invoice', 'salary', 'personal'];
function normalizeLearned(learned) {
  if (!learned || typeof learned !== 'object') return { k: {}, t: {} };
  if (learned.k && typeof learned.k === 'object' && learned.t && typeof learned.t === 'object') return learned; // già nuovo formato
  const k = {}; // vecchia mappa piatta { chiave: kind } → migra in .k
  for (const [key, kind] of Object.entries(learned)) if (typeof kind === 'string' && INCOME_KINDS.includes(kind)) k[key] = kind;
  return { k, t: {} };
}
// Voto dei token appresi sulla descrizione: somma i conteggi per classe dei
// token riconosciuti; classifica solo con supporto e maggioranza netti (mai a
// bassa evidenza). Ritorna { kind, share, support } o null.
function tokenVote(t, description) {
  const agg = { invoice: 0, salary: 0, personal: 0 };
  let support = 0;
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = t[tok]; if (!c) continue;
    for (const k of INCOME_KINDS) { const n = +c[k] || 0; agg[k] += n; support += n; }
  }
  if (support < 2) return null;
  const winner = INCOME_KINDS.reduce((a, b) => agg[a] >= agg[b] ? a : b);
  const share = agg[winner] / support;
  return share >= 0.8 ? { kind: winner, share, support } : null;
}
// Segnale SOFT dei token (per la FUSIONE d'ensemble): come tokenVote ma con
// soglie più basse (supporto ≥1), usato solo per RAFFORZARE una predizione
// concorde del modello, mai per decidere da solo. strength ∈ [0,1] cresce con la
// nettezza (share) e il supporto (satura a 3 conferme). Onesto: evidenza debole
// resta debole.
function tokenLean(t, description) {
  const agg = { invoice: 0, salary: 0, personal: 0 };
  let support = 0;
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = t[tok]; if (!c) continue;
    for (const k of INCOME_KINDS) { const n = +c[k] || 0; agg[k] += n; support += n; }
  }
  if (support < 1) return null;
  const winner = INCOME_KINDS.reduce((a, b) => agg[a] >= agg[b] ? a : b);
  const share = agg[winner] / support;
  if (share < 0.6) return null;                     // ambiguo → nessuna spinta
  const strength = share * Math.min(1, support / 3);
  return { kind: winner, strength };
}
// Fusione probabilistica onesta di due evidenze concordi (noisy-OR): due segnali
// deboli ma d'accordo diventano una convinzione più forte; se discordano, non si
// fondono (l'ensemble si astiene, non inventa). Riusa il pattern già in uso
// nell'orchestratore per combinare esperti.
function fuseConfidence(a, b) { return 1 - (1 - a) * (1 - b); }
// `model` (opzionale) = classificatore fiscale ADDESTRATO (HashedLogReg,
// public/momentum_income_model.json) con .predict(text) → {category,
// confidence}. È un MODELLO NUOVO, stessa architettura del LogReg esperto,
// specializzato su fattura/stipendio/personale. Nell'ensemble entra DOPO le
// regole a parole-chiave (alta precisione, interpretabili) come segnale di
// GENERALIZZAZIONE (n-grammi di caratteri) sui casi che le regole non colgono.
export function classifyIncome(tx = {}, learned = null, model = null) {
  if (tx.taxable === true) return { kind: 'invoice', reason: 'marcata come fattura dall\'utente' };
  if (tx.taxable === false) return { kind: 'personal', reason: 'marcata come non imponibile dall\'utente' };
  const desc = String(tx.description || '').toLowerCase();
  if (learned) {
    const L = normalizeLearned(learned);
    const key = incomeKey(desc);
    // (a) corrispondenza ESATTA su una tua conferma → priorità massima.
    if (key && L.k[key]) return { kind: L.k[key], reason: 'appreso da una tua conferma precedente' };
    // (b) GENERALIZZAZIONE: i token appresi dai tuoi mittenti riconoscono anche
    // descrizioni nuove/simili (es. stesso cliente, mese diverso). Solo con
    // evidenza netta (supporto ≥2, maggioranza ≥80%): mai forzare.
    const v = tokenVote(L.t, desc);
    if (v) return { kind: v.kind, reason: 'appreso dai tuoi mittenti simili' };
  }
  if (INVOICE_KW.test(desc)) return { kind: 'invoice', reason: 'sembra una fattura/compenso P.IVA' };
  if (PERSONAL_KW.test(desc)) return { kind: 'personal', reason: 'sembra un rimborso/regalo/interessi/giroconto (non imponibile)' };
  if (SALARY_KW.test(desc)) return { kind: 'salary', reason: 'sembra uno stipendio (già tassato alla fonte)' };
  // Modello addestrato: usa la predizione solo se abbastanza sicuro (≥0.7),
  // altrimenti resta 'uncertain' (mai un'etichetta forzata a bassa confidenza).
  if (model && typeof model.predict === 'function' && desc) {
    try {
      const p = model.predict(desc);
      if (p && INCOME_KINDS.includes(p.category)) {
        // ENSEMBLE: fonde la confidenza del modello con il lean SOFT dei tuoi
        // token appresi, ma SOLO se concordi (stessa classe). Così un modello a
        // 0.6 + una tua conferma coerente supera la soglia (decisione fondata),
        // mentre evidenze discordi restano 'uncertain' (mai forzare). Il modello
        // da solo mantiene il comportamento (e la reason) di prima.
        let conf = p.confidence;
        const lean = learned ? tokenLean(normalizeLearned(learned).t, desc) : null;
        const concorde = lean && lean.kind === p.category;
        if (concorde) conf = fuseConfidence(p.confidence, lean.strength);
        if (conf >= 0.7) {
          return concorde
            ? { kind: p.category, reason: `modello e tue conferme concordi (${Math.round(conf * 100)}%)` }
            : { kind: p.category, reason: `modello fiscale addestrato (${Math.round(p.confidence * 100)}%)` };
        }
      }
    } catch (_) { /* modello assente/rotto: si continua col fallback onesto */ }
  }
  return { kind: 'uncertain', reason: 'origine non chiara: confermala tu (è una fattura?)' };
}

// Auto-apprendimento: registra la correzione dell'utente sul mittente. Ritorna
// la NUOVA mappa (immutabile). Da qui in poi entrate simili si classificano da
// sole. Integra le tasse nel loop di apprendimento di Momentum.
export function learnIncomeType(learned = {}, description, kind) {
  const key = incomeKey(description);
  if (!key || !INCOME_KINDS.includes(kind)) return learned; // no-op: forma invariata (retro-compat test)
  const L = normalizeLearned(learned);
  const k = { ...L.k, [key]: kind };                 // chiave esatta (come prima)
  const t = { ...L.t };                              // + token per la generalizzazione
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = { ...(t[tok] || { invoice: 0, salary: 0, personal: 0 }) };
    c[kind] = (+c[kind] || 0) + 1;
    t[tok] = c;
  }
  return { k, t };
}

// Suggerisce il regime in base al fatturato ANNUO imponibile: sopra il tetto
// forfettario (85.000€) non si può stare nel forfettario → ordinario. Sotto,
// il forfettario è tipicamente più conveniente. Informazione reale, con caveat.
export function suggestRegime(annualInvoiced = 0) {
  if (annualInvoiced > FORFETTARIO_CEILING) {
    return { suggested: 'ordinario', reason: `Fatturato annuo ~${Math.round(annualInvoiced).toLocaleString('it-IT')}€ oltre il tetto forfettario (${FORFETTARIO_CEILING.toLocaleString('it-IT')}€): serve il regime ordinario.`, overCeiling: true };
  }
  const pct = Math.round((annualInvoiced / FORFETTARIO_CEILING) * 100);
  return { suggested: 'forfettario', reason: `Fatturato annuo ~${Math.round(annualInvoiced).toLocaleString('it-IT')}€ (${pct}% del tetto forfettario): il forfettario è di solito più conveniente. Verifica col commercialista.`, overCeiling: false, pctOfCeiling: pct };
}

// Proiezione fiscale annuale PREDITTIVA: dalle fatture dell'anno in corso
// annualizza il fatturato e stima le tasse di fine anno + avviso tetto. Onesto:
// è una proiezione lineare sul ritmo attuale, dichiarata tale, non una certezza.
export function projectAnnualTax(transactions = [], opts = {}) {
  const ref = opts.referenceDate || new Date();
  const learned = opts.learned || null;
  const model = opts.model || null;
  const year = ref.getFullYear();
  let invoicedYTD = 0;
  for (const t of transactions) {
    if (t.type !== 'entrata') continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    if (classifyIncome(t, learned, model).kind === 'invoice') invoicedYTD += t.amount;
  }
  // mesi trascorsi = mesi pieni prima del corrente + frazione del mese corrente
  // (giorno / giorni-del-mese). Più accurato del +1 fisso.
  const daysInMonth = new Date(year, ref.getMonth() + 1, 0).getDate();
  const monthsElapsed = ref.getMonth() + (ref.getDate() / daysInMonth);
  const annualized = monthsElapsed > 0 ? invoicedYTD * (12 / monthsElapsed) : 0;
  const regime = opts.regime || 'forfettario';
  const taxOnAnnual = taxSetAside(annualized, { regime, overrides: opts.overrides }).setAside;
  const suggestion = suggestRegime(annualized);
  return {
    invoicedYTD: +invoicedYTD.toFixed(2),
    annualizedRevenue: +annualized.toFixed(2),
    estimatedAnnualTax: +taxOnAnnual.toFixed(2),
    monthsElapsed: +monthsElapsed.toFixed(1),
    regimeSuggestion: suggestion,
    note: invoicedYTD > 0
      ? `A questo ritmo fatturi ~${Math.round(annualized).toLocaleString('it-IT')}€ nel ${year}: metti da parte ~${Math.round(taxOnAnnual).toLocaleString('it-IT')}€ di tasse totali (proiezione lineare, non una certezza).`
      : `Nessuna fattura nel ${year}: nessuna proiezione fiscale.`,
  };
}

// Totale da accantonare su un periodo — SOLO sulle entrate imponibili
// (fatture P.IVA). Stipendi e movimenti personali sono ESCLUSI e riportati a
// parte. Le entrate ambigue ('uncertain') sono prudenzialmente conteggiate ma
// segnalate (uncertainCount) così la UI può chiedere conferma con un tap.
// DEFAULT PRUDENTE (fix "tasse messe a caso"): si tassano SOLO le fatture
// chiare; le entrate ambigue NON si tassano d'ufficio (sarebbe di nuovo
// arbitrario) — si segnalano perché l'utente le confermi. opts.taxUncertain=true
// per la modalità cautelativa (accantona anche sull'incerto).
export function taxSetAsideForPeriod(transactions, opts = {}) {
  const taxUncertain = opts.taxUncertain === true;
  const learned = opts.learned || null;
  const model = opts.model || null;
  const entrate = (transactions || []).filter(t => t.type === 'entrata');
  let taxableGross = 0, totalSet = 0, excludedGross = 0, uncertainGross = 0;
  let taxableCount = 0, excludedCount = 0, uncertainCount = 0;
  const uncertain = [];
  for (const t of entrate) {
    const { kind } = classifyIncome(t, learned, model);
    const isTaxable = kind === 'invoice' || (kind === 'uncertain' && taxUncertain);
    if (kind === 'uncertain') { uncertainGross += t.amount; uncertainCount++; uncertain.push(t); }
    if (isTaxable) {
      taxableGross += t.amount;
      totalSet += taxSetAside(t.amount, opts).setAside;
      taxableCount++;
    } else if (kind !== 'uncertain') {
      excludedGross += t.amount; excludedCount++;
    }
  }
  const excludedTxt = excludedCount ? ` (${excludedCount} entrate non imponibili escluse: stipendio/rimborsi ~${excludedGross.toFixed(0)}€)` : '';
  const uncertainTxt = uncertainCount ? ` ${uncertainCount} entrata${uncertainCount > 1 ? 'e' : ''} da confermare (fattura?).` : '';
  return {
    incassato: +taxableGross.toFixed(2),
    daAccantonare: +totalSet.toFixed(2),
    disponibileReale: +(taxableGross - totalSet).toFixed(2),
    count: taxableCount,
    excludedGross: +excludedGross.toFixed(2), excludedCount,
    uncertainGross: +uncertainGross.toFixed(2), uncertainCount, uncertain,
    note: taxableCount
      ? `Su ${taxableCount} fattur${taxableCount > 1 ? 'e' : 'a'} (${taxableGross.toFixed(0)}€) metti da parte ~${totalSet.toFixed(0)}€ per il fisco: il "vero" disponibile è ${(taxableGross - totalSet).toFixed(0)}€${excludedTxt}.${uncertainTxt}`
      : (excludedCount || uncertainCount ? `Nessuna fattura imponibile qui${excludedTxt}.${uncertainTxt}` : 'Nessun incasso registrato in questo periodo.'),
  };
}
