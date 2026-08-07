// ============================================================
// MATRICE DI COMPATIBILITÀ NAT — quando il collegamento diretto riesce DAVVERO
// ============================================================
// Si dice comunemente che fra il 10% e il 20% degli utenti non stabilisce mai
// una connessione diretta WebRTC, e che l'unica risposta sia un server TURN.
// Il numero è vero come statistica di prodotto, ma nasconde un dettaglio che
// cambia tutto — e che il nostro stesso codice stava ignorando.
//
// UN NAT SIMMETRICO ("variabile" nel nostro vocabolario) NON È UNA CONDANNA.
// Il buco si apre lo stesso se l'ALTRO lato non è simmetrico: il lato non
// ristretto riceve il primo pacchetto e da quello IMPARA la mappatura che il
// NAT simmetrico ha creato per quella specifica destinazione. Non deve
// indovinare nulla. Fallisce solo quando SONO ENTRAMBI simmetrici, perché
// allora nessuno dei due può prevedere la porta dell'altro.
//
// La differenza in numeri, con un 15% di dispositivi simmetrici:
//     coppie con UN lato simmetrico    -> 25,5%  RIESCONO
//     coppie con ENTRAMBI simmetrici   ->  2,25% falliscono davvero
// Cioè il caso realmente irrisolvibile è quasi dieci volte più piccolo di
// quello che il numero di prodotto lascia credere.
//
// Il nostro `adviseChannel` rinunciava appena UNO dei due lati era simmetrico:
// proponeva il ripiego senza nemmeno provare, proprio alla popolazione che ha
// più bisogno che qualcosa funzioni. Una previsione pessimistica che si
// autoavvera — e per l'utente è indistinguibile da un'app che non funziona.
//
// Questo modulo tiene la matrice come DATO verificabile, separata dalla sonda
// che misura, così si può correggere senza toccare la misura.
'use strict';

// Vocabolario condiviso con nat-probe.js — 'variabile' è il NAT simmetrico.
export const CLASSI = ['aperto', 'prevedibile', 'variabile', 'bloccato', 'incerto'];

// Un lato è "elastico" se accetta di imparare la mappatura altrui: è la
// proprietà che salva il collegamento contro un simmetrico.
const ELASTICO = new Set(['aperto', 'prevedibile']);

// Può riuscire un collegamento diretto fra due lati? Ritorna anche il PERCHÉ,
// perché una risposta booleana non permette di spiegare niente all'utente né
// di capire un guasto sul campo.
export function puoBucare(a, b) {
  const ka = a?.kind || a; const kb = b?.kind || b;
  if (ka === 'bloccato' || kb === 'bloccato') {
    return { ok: false, motivo: 'una delle due reti non lascia passare il traffico diretto', irrisolvibile: false };
  }
  if (ka === 'variabile' && kb === 'variabile') {
    // L'unico caso davvero senza uscita in diretta. Qui serve un ponte.
    return { ok: false, motivo: 'entrambe le reti cambiano porta ad ogni destinazione: nessuno dei due puo\' prevedere l\'altro', irrisolvibile: true };
  }
  if (ka === 'variabile' || kb === 'variabile') {
    return { ok: true, motivo: 'una rete cambia porta, ma l\'altra impara la mappatura dal primo pacchetto', imparata: true };
  }
  return { ok: true, motivo: 'entrambe le reti mantengono la stessa porta' };
}

// Probabilità stimata, calibrata sulla matrice invece che su un prodotto di
// due punteggi indipendenti — che è l'errore che produceva il 15% su una
// coppia che invece funziona.
// Dichiarato: sono ordini di grandezza noti del comportamento dei NAT, non
// misure nostre. Servono a decidere COSA PROVARE, non a essere mostrati.
const SINGOLO = { aperto: 0.98, prevedibile: 0.92, incerto: 0.6, variabile: 0.5, bloccato: 0.02 };

export function probabilitaDiretta(a, b = null) {
  const ka = a?.kind || a;
  if (!b) return SINGOLO[ka] ?? 0.5;
  const kb = b?.kind || b;
  const v = puoBucare(ka, kb);
  if (!v.ok) return v.irrisolvibile ? 0.02 : 0.05;
  if (v.imparata) {
    // Riesce, ma dipende dal lato elastico: se quello è solo "prevedibile" e
    // non "aperto" resta qualche caso limite (NAT con timeout aggressivi).
    const elastico = ELASTICO.has(ka) ? ka : kb;
    return elastico === 'aperto' ? 0.9 : 0.82;
  }
  if (ka === 'incerto' || kb === 'incerto') return 0.6;
  return Math.min(0.98, (SINGOLO[ka] ?? 0.5) * (SINGOLO[kb] ?? 0.5) + 0.1);
}

// Un dispositivo può fare da PONTE per altri due? Serve che sia raggiungibile
// da chiunque, cioè che non sia lui stesso dietro un NAT che nasconde.
export function puoFareDaPonte(nat) {
  const k = nat?.kind || nat;
  return ELASTICO.has(k);
}

// Quanta parte della rete resta irraggiungibile in diretta, data la
// distribuzione delle classi. Serve a rispondere con un numero, non con
// un'impressione, alla domanda "quanti utenti restano fuori?".
export function quotaIrrisolvibile(distribuzione = {}) {
  const tot = Object.values(distribuzione).reduce((s, n) => s + n, 0);
  if (tot <= 0) return { coppieOk: 0, coppieIrrisolvibili: 0, quota: 0 };
  const p = (k) => (distribuzione[k] || 0) / tot;
  const simm = p('variabile');
  const bloc = p('bloccato');
  // Coppie con entrambi simmetrici + coppie che coinvolgono un bloccato.
  const irr = simm * simm + (1 - (1 - bloc) * (1 - bloc));
  return {
    quota: Math.min(1, irr),
    quotaSalvataDallaMatrice: 2 * simm * (1 - simm - bloc), // un lato simmetrico, l'altro no
    nota: 'la quota irrisolvibile in diretta e\' molto piu\' piccola della quota di dispositivi simmetrici, perche\' basta che UN lato non lo sia',
  };
}
