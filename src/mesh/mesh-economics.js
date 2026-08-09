// ============================================================
// QUANDO LA RETE È DAVVERO UN DATACENTER — e quando è una bugia comoda
// ============================================================
// "Con n dispositivi Momentum ha una potenza di calcolo illimitata" è la frase
// che si vorrebbe poter dire. È vera solo a certe condizioni, e chi la dice
// senza misurarle sta vendendo. Questo modulo esiste per rendere quella frase
// **verificabile prima di pronunciarla**: dice, prima di distribuire, se
// distribuire conviene — e di quanto.
//
// TRE MURI CHE NESSUN NUMERO DI DISPOSITIVI ABBATTE. Sono di architettura, non
// di implementazione: non si risolvono scrivendo codice migliore.
//
//  1. LA PARTE CHE NON SI PUÒ DIVIDERE (Amdahl, 1967). Preparare le unità,
//     verificare i risultati, fondere il tutto: quel pezzo resta sul
//     dispositivo di chi ha chiesto, e nessun altro può farlo al posto suo.
//     Con il 5% di lavoro non divisibile il guadagno massimo è 20 volte —
//     **anche con mille telefoni**. Non è un limite pratico da migliorare, è
//     un tetto aritmetico. Chi promette scalabilità lineare o non l'ha
//     misurata o spera che nessuno lo faccia.
//
//  2. IL COSTO DI PARLARSI. Un datacenter ha interconnessioni da centinaia di
//     gigabit e microsecondi di latenza. Una mesh di telefoni ha megabit e
//     decine di millisecondi, su reti che cambiano. Se il tempo per SPEDIRE
//     un'unità supera il tempo per CALCOLARLA, distribuire è una perdita
//     secca e la si sta facendo solo per poterlo raccontare. Il rapporto fra
//     calcolo e dati trasferiti (l'intensità aritmetica) decide tutto, e
//     decide prima di ogni ottimizzazione.
//
//  3. LA BATTERIA NON È GRATIS, È PRESTATA. Distribuire non riduce l'energia
//     totale spesa: la sposta, e di solito la aumenta (ogni trasferimento è
//     radio accesa). Il guadagno è in TEMPO per chi chiede, il costo è in
//     AUTONOMIA per chi presta. Chiamarlo "gratuito" è la premessa di ogni
//     app che diventa odiosa.
//
// COSA RESTA VERO, e non è poco: per i carichi con intensità aritmetica alta
// — un Monte Carlo manda un seme (poche decine di byte) e riporta tre numeri,
// dopo aver simulato centomila percorsi — la mesh **è** un datacenter, e ogni
// dispositivo in più conta davvero. Questo modulo serve a distinguere quei
// carichi da quelli in cui distribuire è teatro, invece di scoprirlo dopo.
//
// Funzioni PURE, tempi e misure iniettabili.
'use strict';

import { deliveryOdds } from './compute-reliability.js';

// Sotto questo guadagno non si distribuisce: sotto il 30% di tempo risparmiato
// non vale la batteria di qualcun altro. È una soglia di rispetto, non di
// prestazione.
export const GUADAGNO_MINIMO = 1.3;
// Byte al secondo di riferimento quando la banda non è misurata. Prudente
// apposta: WebRTC su rete mobile, non fibra.
export const BANDA_PRUDENTE = 250 * 1024;
export const LATENZA_PRUDENTE_MS = 90;

// ── Il tetto di Amdahl: quanto si può guadagnare al MASSIMO ──
// `frazioneSeriale` è la quota di lavoro che resta comunque a chi chiede.
export function speedupCeiling(frazioneSeriale, dispositivi = Infinity) {
  const s = Math.max(0, Math.min(1, +frazioneSeriale || 0));
  const n = Math.max(1, dispositivi);
  const conN = 1 / (s + (1 - s) / n);
  return {
    tetto: s > 0 ? 1 / s : Infinity,
    conQuestiDispositivi: +conN.toFixed(2),
    // Il numero oltre il quale aggiungere dispositivi non serve più a niente:
    // dove si è arrivati al 90% del tetto teorico.
    saturazioneA: s > 0 ? Math.ceil((0.9 * (1 - s)) / (s * (1 - 0.9))) : null,
    motivo: s > 0
      ? `il ${Math.round(s * 100)}% del lavoro non si può dividere: oltre ${(1 / s).toFixed(1)}× non si va, nemmeno con mille dispositivi`
      : 'nessuna parte seriale dichiarata: il tetto è teorico e quasi sempre ottimistico',
  };
}

// ── Intensità aritmetica: quanto si calcola per ogni byte che viaggia ──
// È la domanda che decide se un carico è distribuibile PER NATURA, prima di
// qualunque considerazione su chi c'è in rete.
export function arithmeticIntensity({ msCalcoloPerUnita, byteInviati, byteRicevuti, banda = BANDA_PRUDENTE }) {
  const byte = Math.max(1, (+byteInviati || 0) + (+byteRicevuti || 0));
  const msTrasferimento = (byte / banda) * 1000;
  const rapporto = msCalcoloPerUnita / msTrasferimento;
  return {
    msCalcolo: msCalcoloPerUnita,
    msTrasferimento: +msTrasferimento.toFixed(2),
    rapporto: +rapporto.toFixed(2),
    // Sotto 1 il trasferimento costa più del calcolo: distribuire è una
    // perdita secca, sempre, con qualunque numero di dispositivi.
    distribuibilePerNatura: rapporto >= 1,
    motivo: rapporto >= 10
      ? 'si calcola molto e si trasferisce pochissimo: è il caso in cui la rete vale davvero'
      : rapporto >= 1
        ? 'il calcolo supera il trasferimento, ma di poco: conviene solo con dispositivi veloci e vicini'
        : 'spedire il lavoro costa più che farlo: distribuirlo sarebbe solo apparenza',
  };
}

// ── Il verdetto vero, con i dispositivi che ci sono adesso ──
// Include il costo dello STRAGGLER atteso: non è una penalità inventata, è la
// probabilità (già stimata da compute-reliability.js) che una fetta vada
// rifatta, moltiplicata per quanto costa rifarla.
export function distributionVerdict({
  unita, msCalcoloPerUnita, byteInviatiPerUnita = 64, byteRicevutiPerUnita = 64,
  frazioneSeriale = 0.05, coreLocali = 4, peers = [], reliability = null,
  banda = BANDA_PRUDENTE, latenzaMs = LATENZA_PRUDENTE_MS, now = Date.now(),
}) {
  const n = Math.max(1, +unita || 1);
  const lavoroTotaleMs = n * msCalcoloPerUnita;
  const tempoLocale = lavoroTotaleMs / Math.max(1, coreLocali);

  const intensita = arithmeticIntensity({ msCalcoloPerUnita, byteInviati: byteInviatiPerUnita, byteRicevuti: byteRicevutiPerUnita, banda });

  // Capacità utile di ciascun dispositivo: la potenza scontata dalla
  // probabilità di consegnare. Un dispositivo che quasi certamente sparisce
  // non aggiunge capacità, aggiunge attesa.
  const utili = [];
  for (const p of peers) {
    const score = +p?.capability?.score || 0;
    if (!(score > 0) || p?.capability?.disponibile === false) continue;
    const pr = reliability ? deliveryOdds(reliability, p, { now }).p : 1;
    if (pr > 0) utili.push({ peerId: p.peerId, score, pr, capacita: score * pr });
  }
  const capacitaRete = utili.reduce((s, u) => s + u.capacita, 0);
  const capacitaTotale = coreLocali + capacitaRete;

  if (!utili.length) {
    return {
      conviene: false, guadagno: 1, tempoLocale, tempoDistribuito: tempoLocale,
      intensita, tetto: speedupCeiling(frazioneSeriale, 1),
      motivo: 'nessun dispositivo utilizzabile: si calcola qui',
      testo: 'Faccio il calcolo su questo dispositivo: non ce ne sono altri disponibili adesso.',
    };
  }

  // Parte seriale: resta a chi chiede, e non si divide con nessuno.
  const seriale = lavoroTotaleMs * frazioneSeriale / Math.max(1, coreLocali);
  const parallelo = (lavoroTotaleMs * (1 - frazioneSeriale)) / capacitaTotale;

  // Comunicazione: ogni unità va spedita e ogni risultato torna, più un
  // andata-e-ritorno di coordinamento per dispositivo.
  const msRete = (n * (byteInviatiPerUnita + byteRicevutiPerUnita) / banda) * 1000 + utili.length * latenzaMs * 2;

  // Straggler atteso: la quota di lavoro affidata a chi potrebbe non
  // consegnare, che andrà rifatta. Vale come lavoro in più, non come magia.
  const quotaARischio = utili.reduce((s, u) => s + (u.capacita / capacitaTotale) * (1 - u.pr), 0);
  const msStraggler = parallelo * quotaARischio;

  const tempoDistribuito = seriale + parallelo + msRete + msStraggler;
  const guadagno = tempoLocale / tempoDistribuito;
  const tetto = speedupCeiling(frazioneSeriale, utili.length + 1);

  // L'energia: distribuire non la riduce, la sposta. Va detto, sempre.
  const energiaAltrui = +(parallelo * capacitaRete / capacitaTotale / 1000).toFixed(1);

  const conviene = guadagno >= GUADAGNO_MINIMO && intensita.distribuibilePerNatura;
  return {
    conviene,
    guadagno: +guadagno.toFixed(2),
    tempoLocale: Math.round(tempoLocale),
    tempoDistribuito: Math.round(tempoDistribuito),
    dettaglio: { seriale: Math.round(seriale), parallelo: Math.round(parallelo), rete: Math.round(msRete), straggler: Math.round(msStraggler) },
    dispositiviUtili: utili.length,
    capacitaRete: +capacitaRete.toFixed(2),
    secondiDiAltrui: energiaAltrui,
    intensita, tetto,
    // Il collo di bottiglia VERO, perché sapere che non conviene senza sapere
    // perché non serve a migliorare niente.
    colloDiBottiglia: !intensita.distribuibilePerNatura ? 'trasferimento'
      : msStraggler > parallelo * 0.5 ? 'dispositivi che spariscono'
      : seriale > parallelo ? 'la parte che non si può dividere'
      : msRete > parallelo ? 'la rete' : 'nessuno: sta girando bene',
    motivo: conviene ? null
      : !intensita.distribuibilePerNatura ? intensita.motivo
      : `si guadagnerebbe solo ${guadagno.toFixed(2)}×: non abbastanza per usare la batteria di altri`,
    testo: conviene
      ? `Divido il calcolo su ${utili.length} dispositivi: circa ${(tempoLocale / 1000).toFixed(1)}s diventano ${(tempoDistribuito / 1000).toFixed(1)}s. Agli altri dispositivi costa ${energiaAltrui}s di lavoro.`
      : `Faccio il calcolo qui: dividerlo non lo renderebbe abbastanza più veloce (${guadagno.toFixed(2)}×).`,
  };
}

// ── Quanti dispositivi servono DAVVERO ──
// Chiamare in causa venti telefoni quando cinque bastano è la stessa
// mancanza di rispetto di non usarne nessuno quando servirebbero.
export function devicesWorthAsking(opts, { massimo = 32 } = {}) {
  const peers = [...(opts.peers || [])].sort((a, b) => (b.capability?.score || 0) - (a.capability?.score || 0));
  let miglior = { quanti: 0, guadagno: 1, verdetto: null };
  for (let k = 1; k <= Math.min(massimo, peers.length); k++) {
    const v = distributionVerdict({ ...opts, peers: peers.slice(0, k) });
    // Si accetta un dispositivo in più solo se porta almeno un 5% in più:
    // sotto quella soglia sta solo prestando batteria per niente.
    if (v.guadagno > miglior.guadagno * 1.05) miglior = { quanti: k, guadagno: v.guadagno, verdetto: v };
    else break;
  }
  return {
    ...miglior,
    disponibili: peers.length,
    inutili: Math.max(0, peers.length - miglior.quanti),
    motivo: miglior.quanti === 0
      ? 'nessun dispositivo migliorerebbe le cose'
      : miglior.quanti < peers.length
        ? `oltre ${miglior.quanti} dispositivi il guadagno si appiattisce: gli altri resterebbero accesi per niente`
        : 'tutti i dispositivi disponibili aggiungono qualcosa',
  };
}
