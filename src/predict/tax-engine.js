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

import { taxSetAsideForPeriod, REGIMI, classifyIncome } from './tax.js';
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
// reddito annuo, non transazioni.
//
// BUG REALE trovato e corretto (2026-09-06, analizzando un audit esterno):
// prima sommava OGNI transazione di tipo 'entrata', senza distinguere
// stipendio da reddito indipendente. Un utente con stipendio CHF5.000/mese
// + attività autonoma CHF2.000/mese avrebbe visto CHF7.000 annualizzati a
// CHF84.000 per il calcolo AVS di un'attività indipendente — concettualmente
// sbagliato, l'AVS da dipendente la versa già il datore di lavoro. Ora usa
// classifyIncome (tax.js, la STESSA funzione già usata da IT/ES per
// distinguere fattura/stipendio/personale — mai una seconda logica
// inventata solo per la Svizzera) e annualizza SOLO la quota 'invoice'.
function entrateAnnualizzate(transactions, opts = {}) {
  const learned = opts.learned || null;
  const model = opts.model || null;
  const entrate = (transactions || []).filter((t) => t.type === 'entrata');
  let totale = 0, count = 0, excludedGross = 0, excludedCount = 0, uncertainGross = 0, uncertainCount = 0;
  for (const t of entrate) {
    const { kind } = classifyIncome(t, learned, model);
    if (kind === 'invoice') { totale += t.amount; count++; }
    else if (kind === 'uncertain') { uncertainGross += t.amount; uncertainCount++; }
    else { excludedGross += t.amount; excludedCount++; } // 'salary'/'personal': mai nell'attività indipendente
  }
  return {
    totale: +totale.toFixed(2), count, annualizzato: +(totale * 12).toFixed(2),
    excludedGross: +excludedGross.toFixed(2), excludedCount,
    uncertainGross: +uncertainGross.toFixed(2), uncertainCount,
  };
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
  // Territorio foral: irpfMensual è `null` (non stimato), mai sommato come 0.
  const daAccantonare = r.reta ? +(r.reta.cuotaMensual + (r.irpfMensual || 0)).toFixed(2) : 0;
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
  const { totale, count, annualizzato, excludedGross, excludedCount, uncertainGross, uncertainCount } = entrateAnnualizzate(transactions, opts);
  const avs = computeAvsIndipendente(annualizzato);
  // Sotto soglia degressiva, computeAvsIndipendente dichiara onestamente
  // "non lo stimiamo" (contributo: null) — l'adattatore non deve MAI
  // convertire quel null in uno zero silenzioso, propaga l'onestà a monte.
  const daAccantonareAnnuo = avs.contributo;
  const daAccantonare = daAccantonareAnnuo != null ? +(daAccantonareAnnuo / 12).toFixed(2) : null;
  const disponibileReale = daAccantonare != null ? +(totale - daAccantonare).toFixed(2) : null;
  // Trasparenza sull'esclusione (2026-09-06): se c'è stipendio/personale
  // escluso, va detto — altrimenti un utente con stipendio+attività
  // indipendente si chiederebbe perché il numero è più basso di quanto
  // vede sull'estratto conto.
  const excludedTxt = excludedCount ? ` (${excludedCount} entrata${excludedCount > 1 ? 'e' : ''} non da attività indipendente esclus${excludedCount > 1 ? 'e' : 'a'}: stipendio/personale ~${eurCh(excludedGross)})` : '';
  return {
    countryCode: 'CH',
    incassato: totale,
    daAccantonare,
    disponibileReale,
    count,
    excludedGross, excludedCount, uncertainGross, uncertainCount,
    note: avs.nota || (daAccantonare != null
      ? `Su ${eurCh(totale)} da attività indipendente questo mese, accantona ~${eurCh(daAccantonare)} di AVS/AI/APG (proiezione da reddito annualizzato ${eurCh(annualizzato)})${excludedTxt}.`
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
