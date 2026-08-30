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
// `titoloKey`/`testoKey` (2026-08-28): riferimento a src/i18n/ui-strings.js
// per IT/EN/ES/DE/FR — `titolo`/`testo` restano la sorgente italiana E il
// fallback se una voce futura non ha ancora una chiave (mai un buco muto:
// meglio italiano che niente). Chi rilascia una nuova voce può aggiungerla
// senza la chiave, tradurla dopo — non blocca il rilascio della funzione.
// Voci storiche aggiunte il 2026-08-30, richieste esplicitamente
// dall'utente: "dipende sempre da quanto un utente non entra nell'app,
// deve essere personalizzata su questo" — RELEASES esisteva solo dal
// 27/08, un dispositivo fermo da settimane vedeva solo quelle 3 voci
// recenti anche se si era perso mesi di sviluppo vero. Ricostruite da
// fatti verificati (git log + memoria di progetto), non inventate.
// Tradotte come tutte le altre (titoloKey/testoKey), stessa disciplina.
export const RELEASES = [
  {
    versione: '2026-07-20',
    voci: [
      {
        colore: 'primary',
        icona: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
        titolo: 'Un solo stile, ovunque',
        testo: 'Icone coerenti al posto delle emoji sparse, e i termini tecnici tradotti in chiaro (es. "Deciso" invece di "Apex Predator") — la stessa Momentum, più facile da leggere a colpo d\'occhio.',
        titoloKey: 'wn0720_0_t', testoKey: 'wn0720_0_d',
      },
      {
        colore: 'gold',
        icona: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6"/>',
        titolo: 'Fattura elettronica vera, non solo un PDF',
        testo: 'Chi ha Partita IVA può generare l\'XML ufficiale FatturaPA direttamente sul telefono, con una guida che dice cosa manca prima di caricarla.',
        titoloKey: 'wn0720_1_t', testoKey: 'wn0720_1_d',
      },
      {
        colore: 'green',
        icona: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        titolo: 'Fatti pagare con un QR',
        testo: 'Un codice QR di bonifico SEPA pronto da inquadrare con l\'app della banca — niente IBAN da ricopiare a mano.',
        titoloKey: 'wn0720_2_t', testoKey: 'wn0720_2_d',
      },
    ],
  },
  {
    versione: '2026-07-21',
    voci: [
      {
        colore: 'purple',
        icona: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 4-3.5"/>',
        titolo: 'Dividi le spese, senza account',
        testo: 'Cena, vacanza, casa: crea un gruppo e sai subito chi deve cosa a chi — tutto resta sul telefono, nessun server nel mezzo.',
        titoloKey: 'wn0721_0_t', testoKey: 'wn0721_0_d',
      },
      {
        colore: 'primary',
        icona: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6"/>',
        titolo: 'Crea una fattura in pochi tocchi',
        testo: 'Cliente, importo, causale: Momentum calcola netto e ritenuta al volo e genera il documento pronto da inviare.',
        titoloKey: 'wn0721_1_t', testoKey: 'wn0721_1_d',
      },
    ],
  },
  {
    versione: '2026-08-10',
    voci: [
      {
        colore: 'gold',
        icona: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        titolo: 'La prima schermata, ridisegnata',
        testo: 'Il numero che conta davvero — quanto puoi spendere oggi — ora è il primo che vedi, al centro, invece di essere sotto la piega.',
        titoloKey: 'wn0810_0_t', testoKey: 'wn0810_0_d',
      },
      {
        colore: 'primary',
        icona: '<path d="M4 19V5M4 19h16M8 15l3-3 3 3 4-6"/>',
        titolo: 'Numeri più facili da leggere',
        testo: 'Uno stile unico per ogni tipo di testo in tutta l\'app — a colpo d\'occhio si capisce subito cosa è un dato e cosa è solo una spiegazione.',
        titoloKey: 'wn0810_1_t', testoKey: 'wn0810_1_d',
      },
    ],
  },
  {
    versione: '2026-08-17',
    voci: [
      {
        colore: 'green',
        icona: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
        titolo: 'Notifiche, una per una',
        testo: 'Scadenze fiscali, cambi di normativa, avvisi di prezzo: ora si spengono singolarmente, non serve più disattivarle tutte per toglierne una sola.',
        titoloKey: 'wn0817_0_t', testoKey: 'wn0817_0_d',
      },
      {
        colore: 'purple',
        icona: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
        titolo: 'Capisce il significato, non solo le parole',
        testo: 'Un modello di comprensione del linguaggio (opzionale, scaricabile in Momentum Vault) fa riconoscere una domanda anche quando la fai in un modo diverso da come l\'hai insegnata.',
        titoloKey: 'wn0817_1_t', testoKey: 'wn0817_1_d',
      },
    ],
  },
  {
    versione: '2026-08-26',
    voci: [
      {
        colore: 'gold',
        icona: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        titolo: 'Quattro domande, su misura per te',
        testo: 'Il primo avvio ora chiede anche quanto potresti resistere se le entrate si fermassero — e ti mostra subito cosa è cambiato per te, con i tuoi numeri veri.',
        titoloKey: 'wn0826_0_t', testoKey: 'wn0826_0_d',
      },
      {
        colore: 'primary',
        icona: '<path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        titolo: '"Non investo" è ora una risposta vera',
        testo: 'Chi sceglie di non investire non riceve più consigli su come farlo — l\'app rispetta la scelta invece di insistere.',
        titoloKey: 'wn0826_1_t', testoKey: 'wn0826_1_d',
      },
    ],
  },
  {
    versione: '2026-08-27',
    voci: [
      {
        colore: 'gold',
        icona: '<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
        titolo: 'Partita IVA Spagna, con le tue fatture vere',
        testo: 'Non più solo un simulatore: se lavori come autónomo, RETA e IRPF ora si calcolano dalle transazioni reali che registri, mese per mese.',
        titoloKey: 'wn0827_0_t', testoKey: 'wn0827_0_d',
      },
      {
        colore: 'primary',
        icona: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 4-3.5"/>',
        titolo: 'Divisione spese più affidabile',
        testo: 'Chi deve cosa a chi ora è sempre corretto anche per chi si unisce a un gruppo (non solo per chi lo crea), e due persone con lo stesso nome non si confondono più.',
        titoloKey: 'wn0827_1_t', testoKey: 'wn0827_1_d',
      },
      {
        colore: 'green',
        icona: '<path d="M20 6L9 17l-5-5"/>',
        titolo: 'Sincronizzazione tra dispositivi, corretta alla radice',
        testo: 'Rinominare un gruppo, aggiungere una spesa o scrivere in chat ora raggiunge davvero gli altri dispositivi collegati, subito.',
        titoloKey: 'wn0827_2_t', testoKey: 'wn0827_2_d',
      },
      {
        colore: 'purple',
        icona: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
        titolo: 'Quanto è merito tuo, mese per mese',
        testo: 'Nell\'analisi di un titolo, un grafico mostra ora quanto del suo andamento è davvero "suo" e non solo il mercato che sale — mese dopo mese, non solo un numero unico.',
        titoloKey: 'wn0827_3_t', testoKey: 'wn0827_3_d',
      },
    ],
  },
  {
    versione: '2026-08-28',
    voci: [
      {
        colore: 'gold',
        icona: '<path d="M3 3v18h18M7 14l4-4 3 3 5-6"/>',
        titolo: 'I tuoi canali di import, monitorati da soli',
        testo: 'Screenshot, CSV e PDF che si dimostrano affidabili iniziano a salvarsi da soli, senza chiedere conferma ogni volta — visibile in Momentum Vault, sotto gli import.',
        titoloKey: 'wn0828_0_t', testoKey: 'wn0828_0_d',
      },
      {
        colore: 'green',
        icona: '<path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
        titolo: 'Il backup prima di installarla come app',
        testo: 'Su iPhone, aggiungere Momentum alla Home ora avvisa di salvare un backup prima — e chi l\'ha già usata da un browser può recuperare i suoi dati con un tocco.',
        titoloKey: 'wn0828_1_t', testoKey: 'wn0828_1_d',
      },
      {
        colore: 'primary',
        icona: '<path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        titolo: 'Niente più doppioni tra notifica e conto',
        testo: 'Una spesa vista prima da una notifica o uno screenshot, e poi confermata dall\'estratto conto arrivato dopo, non compare più due volte.',
        titoloKey: 'wn0828_2_t', testoKey: 'wn0828_2_d',
      },
      {
        colore: 'purple',
        icona: '<path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/>',
        titolo: 'L\'app ti dice quando ha imparato qualcosa',
        testo: 'Correggere la categoria di una spesa ora mostra subito che Momentum se lo ricorderà — non resta più un cambiamento invisibile.',
        titoloKey: 'wn0828_3_t', testoKey: 'wn0828_3_d',
      },
    ],
  },
  {
    versione: '2026-08-30',
    voci: [
      {
        colore: 'primary',
        icona: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        titolo: 'Chiedi "Apple" o "Tesla", punto e basta',
        testo: 'Scrivere il nome secco di un\'azione o una cripto in chat ora funziona — prima serviva una frase completa ("quanto vale..."), e se proprio non trova nulla te lo dice chiaramente, invece del solito "non lo so".',
        titoloKey: 'wn0830_0_t', testoKey: 'wn0830_0_d',
      },
      {
        colore: 'gold',
        icona: '<path d="M3 3v18h18M7 14l4-4 4 4 4-8"/>',
        titolo: 'Storico prezzi azionario, senza configurare nulla',
        testo: 'Apple, Tesla, NVIDIA e molte altre ora mostrano un grafico storico reale anche senza una chiave dati personale — dichiarato sempre onestamente quando il prezzo viene da questa fonte.',
        titoloKey: 'wn0830_1_t', testoKey: 'wn0830_1_d',
      },
      {
        colore: 'purple',
        icona: '<path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/>',
        titolo: 'Comparabili e posizionamento crypto, anche in chat',
        testo: 'Il confronto con i pari (EV/EBITDA) e il posizionamento sui derivati crypto (funding rate, affollamento) prima erano solo un bottone — ora si chiedono anche scrivendo, es. "sono troppo affollato su bitcoin?".',
        titoloKey: 'wn0830_2_t', testoKey: 'wn0830_2_d',
      },
      {
        colore: 'green',
        icona: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>',
        titolo: 'Mai più un\'attesa infinita',
        testo: 'Se una fonte esterna non risponde, ora Momentum lo dice entro pochi secondi invece di restare bloccato su "sto cercando..." per sempre.',
        titoloKey: 'wn0830_3_t', testoKey: 'wn0830_3_d',
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
