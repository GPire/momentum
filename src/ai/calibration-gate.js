// ============================================================
// CALIBRAZIONE COME CANCELLO — "quanto sei sicuro" deve valere qualcosa
// ============================================================
// `expectedCalibrationError` esiste in calibration.js da tempo. Verificato il
// 2026-08-07: non ha mai filtrato NESSUNA previsione mostrata a nessuno. È
// importata solo da `omega.js` (orfano) e `nb-categorizer.js` (orfano), e
// dentro omega non viene nemmeno chiamata. Era una metrica da test, non un
// cancello — e un cluster "cervello AI" che nessuna riga di produzione esegue
// è esattamente ciò che una due diligence trova per primo.
//
// LA DOMANDA CHE MANCAVA. `orchestrator.js` pesa gli esperti per ACCURATEZZA
// (quante volte indovinano) via expert-bandit. Ma c'è una domanda diversa e
// più importante quando si parla di soldi: *quando questo esperto dice "sono
// sicuro all'80%", ha ragione l'80% delle volte?* Un esperto accurato ma
// spavaldo è più pericoloso di uno meno accurato che sa di non sapere,
// perché la sua sicurezza viene creduta.
//
// PERCHÉ QUI SI FA IL CONTRARIO DI merge-gate.js, ed è deliberato.
// In merge-gate, sotto il minimo di campioni si RIFIUTA: quello che si giudica
// arriva da fuori (il modello di un peer) e rifiutare non costa niente, si
// tiene il proprio. Qui invece si giudica un esperto NOSTRO: escluderlo
// finché non ha abbastanza storia significherebbe zittire ogni esperto nuovo
// per sempre, e lasciare l'app senza risposta al primo avvio. Quindi sotto il
// minimo l'esperto resta a peso NEUTRO — non promosso, non ucciso.
// "Non posso giudicare" non vuol dire "va bene", ma nemmeno "vai via".
'use strict';

import { expectedCalibrationError } from './calibration.js';

// Sotto questo numero di esiti osservati la calibrazione non è giudicabile:
// con 5 campioni l'ECE è rumore, e agirci sopra farebbe più danno che bene.
export const MIN_CAMPIONI = 20;
// Oltre questo scarto medio fra sicurezza dichiarata ed esito reale l'esperto
// è sistematicamente spavaldo (o pauroso) e smette di poter dominare il voto.
export const ECE_SOSPENSIONE = 0.25;
// Quanti esiti si tengono per esperto: abbastanza per un ECE stabile, non
// tanti da far crescere il vault senza limite. È una finestra scorrevole, così
// un esperto che MIGLIORA se ne accorge invece di restare marchiato a vita.
export const FINESTRA = 200;

export function initCalibrationState() { return { esperti: {}, astensioni: { totale: 0, giuste: 0, sbagliate: 0 } }; }

// Registra un esito: l'esperto aveva dichiarato `confidence` (0..1) e la sua
// risposta era giusta o sbagliata. Additivo e mai mutante in place.
export function recordExpertOutcome(state, source, confidence, correct) {
  const s = state || initCalibrationState();
  if (!source || !Number.isFinite(+confidence)) return s;
  const c = Math.max(0, Math.min(1, +confidence));
  const prec = s.esperti[source] || [];
  const next = [...prec, { confidence: c, correct: !!correct }].slice(-FINESTRA);
  return { ...s, esperti: { ...s.esperti, [source]: next } };
}

// Quanto è calibrato questo esperto? Ritorna sempre un verdetto leggibile,
// mai un numero solo: `giudicabile` distingue "è mal calibrato" da "non lo so
// ancora", che sono due cose diverse e vanno trattate diversamente.
export function expertCalibration(state, source, { minCampioni = MIN_CAMPIONI, soglia = ECE_SOSPENSIONE } = {}) {
  const campioni = state?.esperti?.[source] || [];
  if (campioni.length < minCampioni) {
    return {
      source, campioni: campioni.length, ece: null, giudicabile: false, affidabile: null,
      motivo: `servono almeno ${minCampioni} esiti per giudicare quanto è tarata la sua sicurezza (ora ${campioni.length})`,
    };
  }
  const ece = expectedCalibrationError(campioni);
  return {
    source, campioni: campioni.length, ece: +ece.toFixed(4), giudicabile: true,
    affidabile: ece <= soglia,
    motivo: ece <= soglia
      ? 'quando dice di essere sicuro, di solito ha ragione'
      : 'la sua sicurezza non corrisponde a quanto indovina davvero',
  };
}

// IL CANCELLO. Ritorna il fattore da applicare al peso dell'esperto.
//  - non giudicabile  -> 1 (neutro): non promosso, non zittito
//  - calibrato        -> 1 (passa)
//  - scalibrato       -> fattore ridotto: continua a votare, ma non può più
//                        decidere da solo. Azzerarlo del tutto lo renderebbe
//                        impossibile da recuperare — non voterebbe mai più,
//                        quindi non produrrebbe mai esiti, quindi non
//                        potrebbe mai ri-calibrarsi. Una trappola senza uscita.
export function calibrationGate(state, source, opts = {}) {
  const cal = expertCalibration(state, source, opts);
  if (!cal.giudicabile) return { fattore: 1, ammesso: true, ...cal };
  if (cal.affidabile) return { fattore: 1, ammesso: true, ...cal };
  const fattore = opts.fattoreScalibrato ?? 0.35;
  return { fattore, ammesso: false, ...cal };
}

// ── L'ASTENSIONE, MISURATA ──
// L'astensione esisteva già in orchestrator.js (`abstain` sotto il 55% di
// confidenza e con i modelli in disaccordo). Quello che mancava è la seconda
// metrica, l'unica che dice se serve: **quando ha taciuto, aveva ragione a
// tacere?** Cioè: la sua ipotesi migliore era davvero sbagliata?
// Senza questa, l'astensione è solo pigrizia travestita da prudenza — e non
// c'è modo di sapere se la soglia (55) è giusta, alta o bassa.
export function recordAbstention(state, { astenuto, ipotesiMigliore, categoriaVera } = {}) {
  const s = state || initCalibrationState();
  if (!astenuto || !categoriaVera) return s;
  const avevaRagione = ipotesiMigliore !== categoriaVera;
  const a = s.astensioni || { totale: 0, giuste: 0, sbagliate: 0 };
  return {
    ...s,
    astensioni: {
      totale: a.totale + 1,
      giuste: a.giuste + (avevaRagione ? 1 : 0),
      sbagliate: a.sbagliate + (avevaRagione ? 0 : 1),
    },
  };
}

export function abstentionQuality(state, { minCampioni = MIN_CAMPIONI } = {}) {
  const a = state?.astensioni || { totale: 0, giuste: 0, sbagliate: 0 };
  if (a.totale < minCampioni) {
    return {
      volteTaciuto: a.totale, precisione: null, giudicabile: false,
      motivo: `troppe poche astensioni per dire se tacere serve (${a.totale})`,
    };
  }
  const precisione = a.giuste / a.totale;
  return {
    volteTaciuto: a.totale, giuste: a.giuste, sbagliate: a.sbagliate,
    precisione: +precisione.toFixed(3), giudicabile: true,
    // Sopra 0.5 tacere è meglio che tirare a indovinare: piu' della meta'
    // delle volte in cui ha taciuto, la risposta che avrebbe dato era
    // sbagliata. Sotto, sta chiedendo aiuto quando avrebbe azzeccato — cioè
    // sta creando attrito inutile, che è il costo vero dell'astensione.
    utile: precisione > 0.5,
    motivo: precisione > 0.5
      ? `quando tace, ${Math.round(precisione * 100)} volte su 100 la sua risposta sarebbe stata sbagliata: chiedere conviene`
      : `quando tace, ${Math.round((1 - precisione) * 100)} volte su 100 avrebbe indovinato: sta chiedendo troppo`,
  };
}

// Riassunto per l'interfaccia: mai un numero senza il suo significato.
export function calibrationSummary(state, sources = []) {
  return {
    esperti: sources.map((s) => expertCalibration(state, s)),
    astensione: abstentionQuality(state),
  };
}
