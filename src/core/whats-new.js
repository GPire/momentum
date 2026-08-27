// ============================================================
// "COSA C'È DI NUOVO" — mostrato una volta per versione, solo al
// prossimo avvio VOLONTARIO di un utente già onboardato
// ============================================================
// Distinto dal toast "Nuova versione pronta" del service worker (main.js):
// quel toast segnala l'INTERRUZIONE (il reload forzato mentre l'app è
// aperta) — qui, mai. Questa schermata segnala l'ARRIVO (la prossima volta
// che l'utente apre Momentum di sua iniziativa), lo stesso momento in cui
// lo starfield/genesis è già usato per l'onboarding — coerente col
// principio "niente spettacolo su un'interruzione, va bene su un arrivo".
//
// Contenuto ONESTO (regola cardine del progetto): solo funzioni VERE già
// shippate, mai testo promozionale generico. Ogni voce va aggiornata a
// mano da chi rilascia — non generata, non un changelog automatico da git
// log (rumore, non quello che un utente vuole leggere).
//
// STORICO, non solo l'ultima (2026-08-27, richiesto esplicitamente
// dall'utente): un dispositivo fermo da mesi che ha saltato più release
// merita di vedere TUTTO quello che si è perso, non solo l'ultima — il
// contrario sarebbe un dato nascosto, la cosa che questo progetto si
// rifiuta di fare ovunque altrove. `RELEASES` è quindi un array di
// versioni, in ordine cronologico CRESCENTE (la più vecchia prima); chi
// consuma questo modulo concatena solo quelle più recenti del
// `whatsNewSeen` salvato, mostrandole in ordine da scorrere.
'use strict';

// Bumpare aggiungendo una NUOVA voce in fondo a `RELEASES` — mai
// modificare una voce già pubblicata (un dispositivo che l'ha già vista
// non deve rivederla cambiata), e mai una release senza almeno una voce
// reale (niente "release vuote" solo per marcare una versione).
export const RELEASES = [
  {
    versione: '2026-08-27',
    voci: [
      {
        colore: 'gold',
        icona: '<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
        titolo: 'Partita IVA Spagna, con le tue fatture vere',
        testo: 'Non più solo un simulatore: se lavori come autónomo, RETA e IRPF ora si calcolano dalle transazioni reali che registri, mese per mese.',
      },
      {
        colore: 'primary',
        icona: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 4-3.5"/>',
        titolo: 'Divisione spese più affidabile',
        testo: 'Chi deve cosa a chi ora è sempre corretto anche per chi si unisce a un gruppo (non solo per chi lo crea), e due persone con lo stesso nome non si confondono più.',
      },
      {
        colore: 'green',
        icona: '<path d="M20 6L9 17l-5-5"/>',
        titolo: 'Sincronizzazione tra dispositivi, corretta alla radice',
        testo: 'Rinominare un gruppo, aggiungere una spesa o scrivere in chat ora raggiunge davvero gli altri dispositivi collegati, subito.',
      },
      {
        colore: 'purple',
        icona: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
        titolo: 'Quanto è merito tuo, mese per mese',
        testo: 'Nell\'analisi di un titolo, un grafico mostra ora quanto del suo andamento è davvero "suo" e non solo il mercato che sale — mese dopo mese, non solo un numero unico.',
      },
    ],
  },
];

export const LATEST_WHATS_NEW_VERSION = RELEASES[RELEASES.length - 1].versione;

// Pura: dato lo stato salvato, dice se mostrare la schermata. Mai per un
// utente che sta completando l'onboarding ORA (seedProfileState marca
// whatsNewSeen alla versione corrente proprio per escluderlo: chi arriva
// nuovo non ha nulla con cui confrontare "cosa c'è di nuovo").
export function shouldShowWhatsNew(state = {}) {
  return state.whatsNewSeen !== LATEST_WHATS_NEW_VERSION;
}

// Le release MAI viste da questo dispositivo, in ordine cronologico
// (le più vecchie prima — si legge come una cronologia, non al contrario).
// `whatsNewSeen` assente (mai vista nessuna versione) → TUTTE le release
// note, mai un salto silenzioso alle sole più recenti: un dispositivo
// nuovissimo che arriva già "esistente" (es. da un vecchio backup
// ripristinato) deve poter vedere l'intera cronologia, non un pezzo.
export function unseenReleases(state = {}) {
  const seen = state.whatsNewSeen;
  if (!seen) return RELEASES;
  const idx = RELEASES.findIndex((r) => r.versione === seen);
  // Versione salvata non riconosciuta (dato corrotto o di una build più
  // vecchia di questo elenco): meglio mostrare tutto che nascondere per
  // un confronto fallito — stesso principio "onestà prima di tutto".
  if (idx === -1) return RELEASES;
  return RELEASES.slice(idx + 1);
}
