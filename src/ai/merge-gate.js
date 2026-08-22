// ============================================================
// CANCELLO DI MERGE — il modello condiviso non deve MAI peggiorare il tuo
// ============================================================
// L'apprendimento federato ha un modo di fallire che quasi nessuno racconta:
// non serve mandare un modello pessimo per rovinare quello di un altro.
// Bastano tanti modelli appena mediocri.
//
// Il cancello precedente rifiutava un merge se peggiorava la loss di oltre
// il 10%. Preso uno alla volta, sembra prudente. Misurato in sequenza, non
// lo è affatto — ogni merge passa, e insieme affondano il modello:
//
//     10 merge appena sotto soglia -> loss 2,57x  (157% peggio)
//     20 merge appena sotto soglia -> loss 6,61x  (561% peggio)
//
// È una via di avvelenamento LENTO: nessun singolo passo sembra un attacco.
//
// La difesa non è stringere la soglia (renderebbe il sistema incapace di
// assorbire il normale rumore di misura). È ANCORARSI AL MIGLIORE RISULTATO
// MAI OTTENUTO, invece che all'ultimo. Un merge può oscillare, ma la deriva
// complessiva rispetto al miglior modello che quel dispositivo abbia mai
// avuto resta dentro un tetto. Così mille passi piccoli non sommano più di
// quanto ne sommi uno.
//
// SECONDO DIFETTO CORRETTO: prima, con meno di 5 esempi di verifica, il
// merge veniva accettato ALLA CIECA. Cioè proprio su un dispositivo nuovo —
// la finestra esatta in cui un attaccante colpirebbe. Quando non si può
// verificare non si accetta: si aspetta di avere di che giudicare. È
// l'opposto di quello che faceva.
'use strict';

// Rumore di misura tollerato su un singolo passo: la loss su un holdout
// piccolo oscilla anche senza che nulla sia peggiorato davvero.
export const TOLLERANZA_PASSO = 1.02;
// Tetto di deriva COMPLESSIVA rispetto al miglior modello mai raggiunto.
// È questo a rendere impossibile l'avvelenamento lento.
export const TETTO_DERIVA = 1.15;
// Sotto questa quantità di esempi tenuti da parte non si giudica.
export const MIN_VERIFICA = 5;

// Decide se accettare un merge. Funzione pura: nessuno stato, nessun DOM,
// tutto iniettato — così si può simulare una sequenza di mille merge senza
// toccare un vault.
//
//  lossBefore  loss del modello locale ora
//  lossAfter   loss del modello fuso, sullo STESSO holdout
//  bestLoss    la loss migliore mai raggiunta da questo dispositivo
//              (null la prima volta: si adotta lossBefore come ancora)
export function evaluateMerge({
  lossBefore, lossAfter, bestLoss = null, validationSize = 0,
  minValidation = MIN_VERIFICA, tolleranzaPasso = TOLLERANZA_PASSO, tettoDeriva = TETTO_DERIVA,
} = {}) {
  if (!Number.isFinite(lossAfter) || !Number.isFinite(lossBefore)) {
    return { accept: false, reason: 'misura non disponibile: senza un numero non si giudica' };
  }
  // Non si può verificare -> non si accetta. Prima qui si passava alla cieca.
  if (validationSize < minValidation) {
    return {
      accept: false,
      reason: `servono almeno ${minValidation} esempi tenuti da parte per giudicare un modello altrui (ora ${validationSize}): fino ad allora si impara solo da sé`,
    };
  }

  const ancora = Number.isFinite(bestLoss) && bestLoss > 0 ? Math.min(bestLoss, lossBefore) : lossBefore;

  // 1) Il passo singolo non deve peggiorare oltre il rumore di misura.
  if (lossAfter > lossBefore * tolleranzaPasso) {
    return { accept: false, reason: 'questo modello peggiora le tue previsioni', lossBefore, lossAfter, ancora };
  }
  // 2) E la deriva COMPLESSIVA dal miglior modello mai avuto resta sotto il
  //    tetto: è il controllo che i mille passi piccoli non possono aggirare.
  if (lossAfter > ancora * tettoDeriva) {
    return {
      accept: false,
      reason: 'accettandolo il tuo modello si allontanerebbe troppo dal migliore che hai mai avuto',
      lossBefore, lossAfter, ancora,
    };
  }

  return {
    accept: true,
    reason: lossAfter < ancora ? 'migliora il tuo modello' : 'non lo peggiora',
    lossBefore, lossAfter, ancora,
    // La nuova ancora si abbassa solo quando si migliora davvero: è ciò che
    // impedisce all'ancora stessa di scivolare verso il peggio nel tempo.
    nuovoBest: Math.min(ancora, lossAfter),
  };
}

// ============================================================
// CANCELLO PER CATEGORIA — un buco reale del cancello sopra
// ============================================================
// evaluateMerge() giudica una SOLA media aggregata. Con l'output di
// NeuralNexus ormai dinamico (una categoria rara può avere solo 2-3 esempi
// nel validation set su 100), una fusione può devastare UNA categoria
// specifica senza spostare quasi per niente la media generale — annegata
// dalle categorie più frequenti, esattamente come è già successo (misurato
// per davvero, non ipotizzato) al modello LogReg in questa stessa sessione,
// dove "trasporti" perdeva 6-11 punti mentre l'accuratezza globale sembrava
// a posto. Qui la stessa classe di problema si applica alla loss per
// categoria invece che all'accuratezza, e al percorso mesh invece che al
// retraining offline.
//
// Soglia in NAT assoluti (unità della cross-entropy), non solo un rapporto:
// un rapporto puro esplode su basi minuscole (0,001->0,01 è "10x" ma
// trascurabile), un salto assoluto di ~1 nat significa che la probabilità
// della categoria vera è scesa di un fattore ~e — un peggioramento reale,
// leggibile alla stessa scala per qualunque categoria.
export const SOGLIA_NAT_PER_CAT = 1.0;
export const MIN_ESEMPI_PER_CAT = 3;

//  perCatBefore/perCatAfter  { [categoria]: { loss, n } } — vedi
//                            NeuralNexus.validatePerCategoria
export function evaluateMergePerCategoria({
  perCatBefore, perCatAfter,
  minEsempi = MIN_ESEMPI_PER_CAT, sogliaNat = SOGLIA_NAT_PER_CAT,
} = {}) {
  if (!perCatBefore || !perCatAfter) {
    return { accept: true, reason: 'nessuna rottura per categoria da verificare' };
  }
  for (const [cat, prima] of Object.entries(perCatBefore)) {
    if (!prima || prima.n < minEsempi || !Number.isFinite(prima.loss)) continue; // troppo pochi esempi per fidarsi
    const dopo = perCatAfter[cat];
    if (!dopo || !Number.isFinite(dopo.loss)) continue; // la categoria fusa non la conosce più: non dovrebbe succedere, ma non è materia di questo cancello
    if (dopo.loss - prima.loss > sogliaNat) {
      return {
        accept: false,
        categoria: cat,
        reason: `questo modello peggiora "${cat}" in modo specifico (loss ${prima.loss.toFixed(2)} -> ${dopo.loss.toFixed(2)}), anche se la media generale può sembrare a posto`,
      };
    }
  }
  return { accept: true, reason: 'nessuna categoria specifica peggiora oltre soglia' };
}
