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

// Totale da accantonare su TUTTE le entrate di un periodo (per la card UI):
// somma gli accantonamenti di ogni incasso `entrata`.
export function taxSetAsideForPeriod(transactions, opts = {}) {
  const entrate = (transactions || []).filter(t => t.type === 'entrata');
  let totalGross = 0, totalSet = 0;
  for (const t of entrate) {
    totalGross += t.amount;
    totalSet += taxSetAside(t.amount, opts).setAside;
  }
  return {
    incassato: +totalGross.toFixed(2),
    daAccantonare: +totalSet.toFixed(2),
    disponibileReale: +(totalGross - totalSet).toFixed(2),
    count: entrate.length,
    note: entrate.length ? `Su ${entrate.length} incassi (${totalGross.toFixed(0)}€) metti da parte ~${totalSet.toFixed(0)}€ per il fisco: il tuo "vero" disponibile è ${(totalGross - totalSet).toFixed(0)}€.` : 'Nessun incasso registrato in questo periodo.',
  };
}
