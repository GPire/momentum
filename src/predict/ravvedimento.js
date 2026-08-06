// ============================================================
// RAVVEDIMENTO OPEROSO — la scadenza saltata non deve sparire
// ============================================================
// BUG DI PRODOTTO TROVATO E CHIUSO QUI (2026-08-06): upcomingTaxDeadlines
// (tax-deadlines.js) scarta ogni scadenza con `data <= oggi` — corretto per
// non allarmare su scadenze passate GIÀ VERSATE, ma se non erano state
// versate la scadenza semplicemente SPARISCE dalla UI, come se non fosse mai
// esistita. Per chi apre una Partita IVA senza commercialista è il momento
// più delicato: ha saltato una scadenza e non lo sa. Nessun portale di
// fatturazione calcola il ravvedimento in automatico — lo fa qui.
//
// Regole verificate incrociando più fonti indipendenti (agosto 2026):
//  - Sanzione base 25% (violazioni con scadenza dopo il 1° settembre 2024).
//  - Riduzione per ravvedimento in base al ritardo: 1/10 entro 30 giorni,
//    1/9 entro 90 giorni, 1/8 entro 1 anno, 1/7 entro 2 anni, 1/6 oltre.
//  - Interessi legali: tasso 1,60% annuo per il 2026 (DM MEF 10/12/2025),
//    calcolati sui giorni effettivi: importo × tasso × giorni / 36500.
// Fonti: sibill.com, cafinforma.it, calcolatoreforfettario.com,
// centrofiscale.com, optlyx.com (ravvedimento operoso 2026).
//
// LIMITE ONESTO E DICHIARATO: il codice tributo della sanzione e degli
// interessi è SPECIFICO per ogni tipo di imposta (es. IVA: sanzione 8904,
// interessi 1991 — verificati; IRPEF: 8901/1989) e alcuni codici sono stati
// soppressi e sostituiti nel tempo (es. il vecchio 1992 per le imposte
// sostitutive). Con quattro tributi diversi coinvolti (imposta sostitutiva
// forfettario, IRPEF ordinario, IVA, INPS) e la certezza che i codici
// cambiano, qui NON si assume un codice specifico per ravvedimento — si
// calcolano gli IMPORTI (la parte difficile) e si rimanda al codice esatto
// sul sito ufficiale dei codici tributo, mai un numero indovinato.
'use strict';

export const SANZIONE_BASE = 0.25; // violazioni con scadenza dal 1° settembre 2024
export const TASSO_INTERESSE_LEGALE_2026 = 0.016; // DM MEF 10/12/2025

// Fasce di riduzione della sanzione in base ai giorni di ritardo, in ordine
// crescente — la prima che "contiene" il ritardo vince.
const FASCE_RIDUZIONE = [
  { giorniMax: 30, frazione: 1 / 10, label: 'entro 30 giorni' },
  { giorniMax: 90, frazione: 1 / 9, label: 'entro 90 giorni' },
  { giorniMax: 365, frazione: 1 / 8, label: 'entro 1 anno' },
  { giorniMax: 730, frazione: 1 / 7, label: 'entro 2 anni' },
  { giorniMax: Infinity, frazione: 1 / 6, label: 'oltre 2 anni' },
];

function fasciaPer(giorniRitardo) {
  return FASCE_RIDUZIONE.find((f) => giorniRitardo <= f.giorniMax) || FASCE_RIDUZIONE[FASCE_RIDUZIONE.length - 1];
}

// Calcola sanzione ridotta + interessi legali per un importo dovuto e non
// versato, `giorniRitardo` giorni dopo la scadenza. Mai un ritardo negativo:
// se la scadenza non è ancora passata, ritorna importi a zero (nessun
// ravvedimento da fare) invece di un numero senza senso.
export function calcolaRavvedimento(importoDovuto, giorniRitardo, { tassoInteresse = TASSO_INTERESSE_LEGALE_2026 } = {}) {
  const importo = Math.max(0, +importoDovuto || 0);
  const giorni = Math.max(0, Math.round(+giorniRitardo || 0));
  if (importo === 0 || giorni === 0) {
    return { importoDovuto: importo, giorniRitardo: giorni, sanzioneRidotta: 0, interessi: 0, totale: importo, fascia: null };
  }
  const fascia = fasciaPer(giorni);
  const sanzioneRidotta = +(importo * SANZIONE_BASE * fascia.frazione).toFixed(2);
  const interessi = +(importo * tassoInteresse * giorni / 36500).toFixed(2);
  const totale = +(importo + sanzioneRidotta + interessi).toFixed(2);
  return {
    importoDovuto: importo, giorniRitardo: giorni, sanzioneRidotta, interessi, totale,
    fascia: fascia.label,
    nota: `Sanzione ridotta a 1/${Math.round(1 / fascia.frazione)} del 25% (${fascia.label}) + interessi legali al ${(tassoInteresse * 100).toFixed(2)}% sui giorni di ritardo. Il codice tributo esatto per sanzione e interessi dipende dal tipo di imposta e va verificato sul sito ufficiale dei codici tributo (o col commercialista): qui trovi l'importo giusto, non un codice indovinato.`,
  };
}

// Applica calcolaRavvedimento a una scadenza fiscale (tax-deadlines.js:
// { id, label, date, importo }) rispetto a `now`. Ritorna null se la
// scadenza non è ancora passata (nessun ravvedimento da fare).
export function ravvedimentoPerScadenza(scadenza, { now = new Date() } = {}) {
  const oggi = new Date(now);
  const dataScadenza = new Date(scadenza.date);
  if (dataScadenza > oggi) return null;
  const giorni = Math.round((oggi - dataScadenza) / 86400000);
  return { ...scadenza, ravvedimento: calcolaRavvedimento(scadenza.importo, giorni) };
}
