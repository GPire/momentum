// ============================================================
// QUICK-ADD via deep-link — l'automazione "Wallet"/"Transaction" di iOS
// Shortcuts (dal 2026 anche notification-keyword) apre Momentum con i dati
// della transazione appena fatta con Apple Pay.
// ============================================================
// PERCHÉ ESISTE: verificato (fonte: support.apple.com/guide/shortcuts,
// developer.apple.com/forums) che da iOS 17 esiste un trigger di
// automazione personale legato a Apple Pay/Wallet, che passa alla
// Shortcut carta, esercente e importo. La Shortcut può aprire un URL:
// questo modulo legge quell'URL. Nessuna lettura diretta delle notifiche
// di altre app (resta impossibile per una PWA, vedi notification-parser.js)
// — qui è la SHORTCUT STESSA, autorizzata dall'utente sul proprio
// dispositivo, a portare il dato a Momentum. Zero server: tutto nell'URL,
// letto ed elaborato solo sul dispositivo.
//
// SICUREZZA (regola del progetto: mai fidarsi di input esterno). Un
// deep-link può arrivare da QUALUNQUE fonte, non solo dalla propria
// Shortcut — un link malevolo condiviso ad arte potrebbe provare a far
// precompilare l'app con dati fasulli. Per questo extractQuickAddParams
// non inserisce MAI la transazione da sola: costruisce solo un PREFILL,
// che il chiamante (main.js) mostra nel form di conferma già esistente
// (window.openPrefilledAdd) — l'utente vede e conferma ogni campo prima
// che qualunque cosa venga salvata, esattamente come già succede per i
// link "unisciti a un gruppo" (stesso principio, stesso file).
'use strict';

import { VALUTE_ISO4217 } from '../core/iso4217.js';

// Estrae { amount, merchant, currency, card } da un URL completo (query o
// hash, qualunque formato — stessa flessibilità di extractJoinPayload in
// main.js: un link può arrivare riscritto da un accorciatore o da un altro
// dominio). Ritorna null se manca l'essenziale (query assente, importo o
// esercente non validi) — MAI un prefill parziale indovinato.
export function extractQuickAddParams(urlString) {
  if (!urlString) return null;
  let url;
  try { url = new URL(urlString); } catch { return null; }

  // I parametri possono stare nella query (?quickadd=1&amount=...) o nel
  // frammento (#quickadd=1&amount=...) — un link riscritto da hosting
  // statici usa spesso il secondo, come per il deep-link "unisciti".
  const fromQuery = url.searchParams;
  const fromHash = new URLSearchParams(url.hash.replace(/^#\/?/, ''));
  const get = (key) => fromQuery.get(key) ?? fromHash.get(key);

  if (get('quickadd') == null) return null;

  const amount = parseFloat(get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchant = String(get('merchant') || '').trim().slice(0, 60);
  if (!merchant) return null;

  const rawCurrency = String(get('currency') || '').toUpperCase();
  const currency = VALUTE_ISO4217.has(rawCurrency) ? rawCurrency : null;

  const card = String(get('card') || '').trim().slice(0, 40) || null;

  return { amount, merchant, currency, card };
}

// Costruisce il prefill per il form di conferma (stessa forma già accettata
// da attachFormListeners in main.js: { type, category, amount, description }).
// La categorizzazione usa l'orchestratore VERO (stesso cervello di ogni
// altro import) — mai una categoria a caso. Un pagamento Apple Pay è quasi
// sempre un'uscita: la Wallet automation di iOS non dichiara il verso nel
// payload documentato, quindi qui non si inventa un caso "entrata" mai
// confermato — dichiarato, non nascosto.
export function buildQuickAddPrefill(params, orchestrator) {
  const result = orchestrator?.classify
    ? orchestrator.classify(params.merchant, params.amount, new Date())
    : { cat: null };
  return {
    type: 'uscita',
    category: result.cat || null,
    amount: params.amount,
    description: params.card ? `${params.merchant} (${params.card})` : params.merchant,
  };
}

// Genera l'URL pronto da incollare nella Shortcut e i passaggi guidati.
// Ricerca dedicata (fonti: support.apple.com/guide/shortcuts, guida
// pubblica di MoneyCoach — concorrente reale con la STESSA integrazione in
// produzione dal 2026): non esiste un modo di installare un'automazione
// Shortcuts con un tap solo senza possedere un iPhone/Mac per generare il
// file firmato — nemmeno i concorrenti lo fanno, pubblicano una guida
// passo-passo. Questa funzione costruisce quella guida, con l'URL già
// pronto (dominio reale dell'installazione, non un segnaposto) da
// incollare in UNA sola azione "Testo" di Shortcuts.
// `origin` = location.origin del dispositivo dell'utente (iniettato dal
// chiamante, mai letto qui: funzione pura, testabile senza DOM/browser).
export function buildQuickAddSetupInstructions(origin) {
  const url = `${origin}/?quickadd=1&amount=[Importo]&merchant=[Nome esercente]&card=[Nome carta]`;
  return {
    url,
    passi: [
      'Apri l\'app Comandi Rapidi (Shortcuts).',
      'Tocca "Automazione" in basso, poi "+" → "Crea automazione personale".',
      'Scegli "Wallet" (su iOS 17-25 si chiama "Transaction") e seleziona le carte da tenere d\'occhio, o "Qualsiasi carta".',
      'Tocca "Aggiungi azione", cerca "Testo" e incollalo — poi tocca dentro il campo di testo e SOSTITUISCI [Importo], [Nome esercente] e [Nome carta] con le variabili vere: tocca l\'icona con i puntini sopra la tastiera e scegli quelle proposte dal trigger Wallet.',
      'Aggiungi una seconda azione, "Apri URL", e collegala al testo appena creato.',
      'Salva. Da ora ogni pagamento Apple Pay apre Momentum già con importo, esercente e categoria proposta — tu confermi con un tocco, mai un salvataggio automatico.',
    ],
    urlModello: url,
  };
}
