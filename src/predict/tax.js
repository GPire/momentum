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
export function classifyIncome(tx = {}) {
  if (tx.taxable === true) return { kind: 'invoice', reason: 'marcata come fattura dall\'utente' };
  if (tx.taxable === false) return { kind: 'personal', reason: 'marcata come non imponibile dall\'utente' };
  const desc = String(tx.description || '').toLowerCase();
  if (INVOICE_KW.test(desc)) return { kind: 'invoice', reason: 'sembra una fattura/compenso P.IVA' };
  if (PERSONAL_KW.test(desc)) return { kind: 'personal', reason: 'sembra un rimborso/regalo/interessi/giroconto (non imponibile)' };
  if (SALARY_KW.test(desc)) return { kind: 'salary', reason: 'sembra uno stipendio (già tassato alla fonte)' };
  return { kind: 'uncertain', reason: 'origine non chiara: confermala tu (è una fattura?)' };
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
  const entrate = (transactions || []).filter(t => t.type === 'entrata');
  let taxableGross = 0, totalSet = 0, excludedGross = 0, uncertainGross = 0;
  let taxableCount = 0, excludedCount = 0, uncertainCount = 0;
  const uncertain = [];
  for (const t of entrate) {
    const { kind } = classifyIncome(t);
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
