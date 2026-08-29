// ============================================================
// TAX ENGINE FRAMEWORK — registro comune per i motori fiscali per paese
// ============================================================
// Proposto nel documento "Architettura AI Momentum" (2026-08-30), sezione 3:
// oggi tax.js (Italia), tax-ch.js (Svizzera) e tax-es.js (Spagna) sono tre
// file indipendenti con forme di funzione diverse — taxSetAsideForPeriod
// (transactions, opts), computeAvsIndipendente(redditoAnnuo),
// retaIrpfPeriodo(transactions, opts) — perché i tre sistemi fiscali sono
// strutturalmente diversi, non per un incidente di design. Questo modulo
// NON riscrive quella logica: è un ADATTATORE puro, mai una seconda
// implementazione delle regole fiscali. Ogni numero che produce viene da
// una chiamata diretta alla funzione reale già testata — vedi i test che
// confrontano l'output dell'adattatore con quello della funzione originale.
//
// Perché serve comunque: un decimo paese (Francia, Germania, UK, ...) deve
// poter registrarsi qui con la STESSA forma (countryCode → { computeLiability,
// regimeOptions, ... }), senza che il resto dell'app (UI, mesh, export)
// debba conoscere la forma specifica di ogni modulo fiscale.
'use strict';

import { taxSetAsideForPeriod, REGIMI } from './tax.js';
import { computeAvsIndipendente } from './tax-ch.js';
import { retaIrpfPeriodo } from './tax-es.js';

const registry = new Map();

// Mai sovrascrivere un paese già registrato in silenzio — un secondo
// registerTaxModule('IT', ...) per errore (es. un doppio import, o un
// futuro modulo che si carica due volte) deve fallire rumorosamente, non
// rimpiazzare zitto le regole fiscali italiane con qualcos'altro.
export function registerTaxModule(countryCode, moduleDef) {
  if (!countryCode) throw new Error('registerTaxModule: countryCode obbligatorio');
  if (registry.has(countryCode)) {
    throw new Error(`registerTaxModule: "${countryCode}" è già registrato — mai sovrascrivere un modulo fiscale in silenzio.`);
  }
  if (typeof moduleDef?.computeLiability !== 'function') {
    throw new Error(`registerTaxModule("${countryCode}"): computeLiability è obbligatoria.`);
  }
  registry.set(countryCode, moduleDef);
}

export function getTaxModule(countryCode) {
  return registry.get(countryCode) || null;
}

export function listTaxModules() {
  return [...registry.keys()];
}

// Somma le entrate di un periodo e le annualizza — stessa semplificazione
// già dichiarata in projectAnnualTax (Italia) e in retaIrpfPeriodo (Spagna,
// `taxableGross * 12`): assume reddito costante nel resto dell'anno, mai
// spacciata per una dichiarazione fiscale definitiva. Usata SOLO
// dall'adattatore Svizzero sotto, perché computeAvsIndipendente prende un
// reddito annuo, non transazioni — la Svizzera non ha un concetto di
// "fattura imponibile" da classificare come IT/ES (vedi tax-ch.js).
function entrateAnnualizzate(transactions) {
  const entrate = (transactions || []).filter((t) => t.type === 'entrata');
  const totale = entrate.reduce((s, t) => s + (t.amount || 0), 0);
  return { totale: +totale.toFixed(2), count: entrate.length, annualizzato: +(totale * 12).toFixed(2) };
}

// ── Adattatori: normalizzano l'output REALE di ogni modulo esistente in
// una forma comune { incassato, daAccantonare, disponibileReale, count,
// note, dettaglio }. `dettaglio` è SEMPRE l'oggetto originale, intatto —
// chi ha bisogno di un campo specifico del paese lo trova lì, mai perso. ──

function computeLiabilityIT(transactions, opts = {}) {
  const r = taxSetAsideForPeriod(transactions, opts);
  return {
    countryCode: 'IT',
    incassato: r.incassato,
    daAccantonare: r.daAccantonare,
    disponibileReale: r.disponibileReale,
    count: r.count,
    note: r.note,
    dettaglio: r,
  };
}

function computeLiabilityES(transactions, opts = {}) {
  const r = retaIrpfPeriodo(transactions, opts);
  const daAccantonare = r.reta ? +(r.reta.cuotaMensual + r.irpfMensual).toFixed(2) : 0;
  return {
    countryCode: 'ES',
    incassato: r.incassato,
    daAccantonare,
    disponibileReale: r.disponibleReal,
    count: r.count,
    note: r.note,
    dettaglio: r,
  };
}

// Unico adattatore che deve AGGREGARE lui stesso (vedi entrateAnnualizzate
// sopra): computeAvsIndipendente prende un reddito annuo già calcolato, non
// transazioni — qui SOLO la trasformazione transactions→numero, mai la
// logica AVS stessa (quella resta undividisa in tax-ch.js).
function computeLiabilityCH(transactions, opts = {}) {
  const { totale, count, annualizzato } = entrateAnnualizzate(transactions);
  const avs = computeAvsIndipendente(annualizzato);
  // Sotto soglia degressiva, computeAvsIndipendente dichiara onestamente
  // "non lo stimiamo" (contributo: null) — l'adattatore non deve MAI
  // convertire quel null in uno zero silenzioso, propaga l'onestà a monte.
  const daAccantonareAnnuo = avs.contributo;
  const daAccantonare = daAccantonareAnnuo != null ? +(daAccantonareAnnuo / 12).toFixed(2) : null;
  const disponibileReale = daAccantonare != null ? +(totale - daAccantonare).toFixed(2) : null;
  return {
    countryCode: 'CH',
    incassato: totale,
    daAccantonare,
    disponibileReale,
    count,
    note: avs.nota || (daAccantonare != null
      ? `Su ${eurCh(totale)} incassati questo mese, accantona ~${eurCh(daAccantonare)} di AVS/AI/APG (proiezione da reddito annualizzato ${eurCh(annualizzato)}).`
      : null),
    dettaglio: avs,
  };
}
function eurCh(n) { return `CHF ${Math.round(n).toLocaleString('it-CH')}`; }

// Registrazione dei 3 moduli esistenti — accade una sola volta, al primo
// import di questo file. `regimeOptions` riusa le costanti reali già
// esistenti (REGIMI per l'Italia); CH/ES non hanno un concetto di "regime"
// scelto dall'utente come l'Italia (AVS/RETA sono obbligatori, non un'opzione),
// quindi restano array vuoti — mai un dato inventato per riempire un campo.
registerTaxModule('IT', {
  computeLiability: computeLiabilityIT,
  regimeOptions: Object.keys(REGIMI || {}),
});
registerTaxModule('CH', {
  computeLiability: computeLiabilityCH,
  regimeOptions: [],
});
registerTaxModule('ES', {
  computeLiability: computeLiabilityES,
  regimeOptions: [],
});

export { computeLiabilityIT, computeLiabilityES, computeLiabilityCH, entrateAnnualizzate };
