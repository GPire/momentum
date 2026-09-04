// ============================================================
// PROFILO → QUALI PEZZI DI MOMENTUM ESISTONO PER TE
// ============================================================
// Richiesta esplicita (2026-09-04): "in base a età e risposte alle domande si
// attivano e disattivano feature di Momentum, quindi anche in base all'uso e
// alla profilazione: ogni risposta deve essere integrata nei modelli, e anche
// attivare o disattivare card o sezioni specifiche dentro Momentum Vault,
// Dashboard e Analisi Tensor".
//
// Perché un modulo puro e non tre `if` sparsi in main.js: le regole di
// visibilità erano già DUE meccanismi separati (`shouldShowAnalysisTensor` per
// chi non investe, la vista Essenziale/Completa per le card avanzate) più
// controlli ad hoc dentro i singoli render. Tre logiche che possono divergere
// sono esattamente il tipo di incoerenza che questo progetto ha già pagato
// altrove ("due numeri in disaccordo sulla stessa domanda"). Qui la decisione
// vive in UN posto, è pura, ed è testabile senza DOM.
//
// DUE PRINCIPI, entrambi già scelti in passato e qui mantenuti:
//  1. Si NASCONDE solo con un segnale ESPLICITO dell'utente. Finché non ha
//     detto niente su un tema, quel tema resta visibile: nascondere una
//     sezione intera a chi non si è ancora espresso significa decidere al suo
//     posto. (Stessa regola già scritta per shouldShowAnalysisTensor.)
//  2. Niente è irreversibile: ogni voce qui dipende da uno stato che l'utente
//     può cambiare (una risposta, un'impostazione, un dato che aggiunge) —
//     mai da una decisione presa una volta e congelata.
'use strict';

// Un minorenne non ha stipendio, non investe, non ha partita IVA: le sezioni
// che parlano di quelle cose non sono "avanzate", sono proprio di un'altra
// persona. Segnale esplicito dall'onboarding (gate età), non dedotto.
function eMinorenne(profilo = {}) {
  return profilo.isMinor === true || profilo.ageBracket === 'under18';
}

// `state` è VaultDAO.state (o una sua porzione): funzione pura, nessun DOM,
// nessuna lettura globale — così è testabile e riusabile ovunque.
export function featureVisibili(state = {}) {
  const prefs = state.investmentPrefs || {};
  const profilo = state.onboardingProfile || {};
  const minorenne = eMinorenne(profilo);

  // "Non investo" è una risposta vera dell'onboarding, non un default: si
  // rispetta. Per un minorenne vale comunque, anche se quel campo mancasse.
  const investe = !minorenne && prefs.invests !== false;

  // Segnali di contesto che l'utente ha dichiarato lui stesso.
  const liquiditaCorta = prefs.cashflowStress === 'corto';
  const entrateIrregolari = prefs.incomeRegularity === 'irregolare';

  // Uso reale: alcune sezioni hanno senso solo dopo che una cosa esiste
  // davvero (un gruppo spesa, una trasferta, un obiettivo).
  const haGruppiSpesa = (state.splitGroups || []).length > 0;
  const haTrasferte = (state.trips || []).length > 0;
  const haObiettivi = (state.savingsGoals || []).length > 0;
  const haPartitaIva = !!(state.taxRegime || state.esActive || state.chActive);

  return {
    // ── Analisi Tensor (sezione intera) ──
    analisiTensor: investe,
    tesseraInvestito: investe,
    criptovalute: investe,

    // ── Momentum Vault ──
    // La card che PROPONE la partita IVA: inutile a chi ce l'ha già attiva
    // (per lui ci sono le card fiscali vere) e fuori luogo per un minorenne.
    scopertaPartitaIva: !minorenne && !haPartitaIva,
    // Le card fiscali vere compaiono solo quando un regime è attivo davvero.
    cardFiscali: haPartitaIva,
    // Lo stipendio: un minorenne non ne ha uno da dichiarare.
    editorStipendio: !minorenne,

    // ── Dashboard ──
    // Il salvadanaio/cuscinetto sale di priorità per chi ha dichiarato meno
    // di due mesi di liquidità: è il suo problema numero uno, non una card
    // fra le altre.
    cuscinettoInPrimoPiano: liquiditaCorta,
    // La previsione di cassa serve soprattutto a chi non sa quanto entrerà:
    // con entrate regolari è una conferma, con entrate irregolari è la
    // risposta alla domanda che si fa ogni mese.
    previsioneCassaInPrimoPiano: entrateIrregolari,
    // Gli obiettivi si mostrano quando ne esiste almeno uno (anche creato
    // dall'onboarding), altrimenti resta l'invito a crearne uno.
    obiettivi: haObiettivi,

    // ── Sezioni che seguono l'uso, non il profilo ──
    divisioneSpese: true,          // sempre: è il loop virale, mai nascosto
    trasferte: haTrasferte || !minorenne,
    riepilogoGruppi: haGruppiSpesa,
  };
}

// Compatibilità: la regola storica resta esportata con lo stesso nome e lo
// stesso significato, ma calcolata dall'unica fonte qui sopra — così non
// possono divergere. `investmentPrefs` da solo non conosce l'età, quindi per
// il percorso minorenne si passa lo stato intero quando lo si ha.
export function analisiTensorVisibile(state = {}) {
  return featureVisibili(state).analisiTensor;
}

// ── QUANTO NE SA CHI STA USANDO MOMENTUM ────────────────────────────────────
// Non è un giudizio sulla persona: è la scelta di quanto contesto dare prima
// di un numero. Dire "percentile di settore 87°" a chi ha appena installato
// l'app è un modo elegante di non farsi capire; ripetere "il percentile dice
// quante aziende fanno peggio" a chi legge bilanci per lavoro è rumore.
//
// Si stima da segnali GIÀ DATI, mai da una domanda in più (ogni domanda in
// onboarding è attrito, ed è la cosa che stiamo cercando di ridurre):
//  · l'età dichiarata (un minorenne parte sempre da principiante);
//  · "non investo" (segnale esplicito di disinteresse per la parte mercati);
//  · cosa ha DAVVERO fatto: posizioni inserite, partita IVA attiva, uso di
//    Analisi Tensor. I fatti battono le dichiarazioni.
export function livelloConoscenza(state = {}) {
  const profilo = state.onboardingProfile || {};
  const prefs = state.investmentPrefs || {};
  if (eMinorenne(profilo)) return 'principiante';
  if (prefs.invests === false) return 'principiante';

  const haPosizioni = (state.positions || []).length > 0;
  const haPartitaIva = !!(state.taxRegime || state.esActive || state.chActive);
  const vistaCompleta = state.uiComplexity === 'completo' && state.uiComplexitySetByUser === true;

  const segnali = [haPosizioni, haPartitaIva, vistaCompleta].filter(Boolean).length;
  if (segnali >= 2) return 'esperto';
  if (segnali === 1) return 'medio';
  return 'principiante';
}

// ── COSA MOMENTUM FA DA SOLO, PER QUESTA PERSONA ────────────────────────────
// Richiesta esplicita: "automatizzare compiti e funzioni per ogni tipo di
// utente, abbattendo attrito e abbandono". L'attrito non si toglie
// nascondendo il lavoro: si toglie facendo il lavoro al posto dell'utente
// QUANDO si può farlo senza rischiare di sbagliare al posto suo.
//
// Regola di sicurezza che vale per tutte le voci qui sotto: si automatizza
// solo ciò che è REVERSIBILE e VISIBILE. Un import salvato da solo si può
// cancellare e resta scritto da dove viene; una spesa categorizzata da sola
// si può correggere con un tocco (e la correzione insegna al modello). Non
// si automatizza mai qualcosa che l'utente non possa vedere e disfare.
export function automazioni(state = {}) {
  const livello = livelloConoscenza(state);
  const prefs = state.investmentPrefs || {};
  const liquiditaCorta = prefs.cashflowStress === 'corto';
  const principiante = livello === 'principiante';

  return {
    livello,
    // Quanto contesto mettere attorno a un numero prima di mostrarlo.
    spiegazioni: principiante ? 'estese' : livello === 'medio' ? 'brevi' : 'minime',
    // Vista di partenza: meno card per chi inizia, tutto per chi sa già
    // muoversi. Resta sempre cambiabile a mano (uiComplexitySetByUser).
    vistaConsigliata: livello === 'esperto' ? 'completo' : 'essenziale',
    // Un principiante non deve decidere una categoria per ogni riga importata:
    // si accetta in automatico quando il modello è sicuro, e si chiede solo
    // sulle righe davvero incerte. Chi è esperto vede una soglia più bassa
    // perché sa correggere e vuole controllo.
    sogliaAutoCategoria: principiante ? 0.75 : 0.85,
    // Il promemoria che conta di più cambia con la situazione dichiarata:
    // con meno di due mesi di liquidità il tema non è ottimizzare, è non
    // restare a secco.
    focusPromemoria: liquiditaCorta ? 'cuscinetto' : principiante ? 'abitudine' : 'ottimizzazione',
    // Chiedere conferma a ogni salvataggio è l'attrito più citato in assoluto
    // nelle recensioni delle app di spese. Si chiede solo dove serve davvero.
    confermaPerOgniSpesa: false,
    // Una spesa ricorrente riconosciuta si può registrare da sola, ma solo
    // dopo che l'utente ne ha viste abbastanza da fidarsi del meccanismo.
    autoRegistraRicorrenti: livello !== 'principiante',
  };
}
