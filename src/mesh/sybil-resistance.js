// ============================================================
// MILLE IDENTITÀ FINTE, ZERO CENE DIVISE — la difesa che regge le altre
// ============================================================
// Tutte le difese costruite finora nella mesh — la reputazione di
// `update-ledger.js`, la corroborazione fra pari indipendenti di
// `knowledge-relay.js`, il k-anonimato di `federated-distillation.js`, il
// conteggio dei testimoni indipendenti di `collective-curiosity.js` — poggiano
// tutte sullo stesso presupposto, e nessuna lo verifica:
//
//        **che dispositivi diversi siano persone diverse.**
//
// Senza un server che validi le identità, questo presupposto è falso per
// costruzione: chi attacca fabbrica mille identità in un minuto (attacco
// Sybil, Douceur 2002). Con k=3, tre identità finte bastano a far uscire un
// token che doveva restare dentro; con venti, si sposta un consenso federato
// restando sempre sotto ogni soglia. Non è un rischio teorico: è il modo
// standard di rompere esattamente i sistemi come questo, ed è la prima
// domanda che farebbe chi valuta seriamente l'architettura.
//
// LA RISORSA CHE MOMENTUM HA E QUASI NESSUNO HA: una rete sociale **attestata
// da soldi veri**. I gruppi di spesa non sono contatti né follower: sono
// persone con cui si è diviso un conto, in date diverse, con importi che
// entrambe le parti hanno confermato e che vivono in una catena di hash
// condivisa. Fabbricare mille dispositivi costa un minuto. Fabbricare mille
// persone che hanno diviso una cena con te, in mesi diversi, no — e
// soprattutto non lo si può fare *dal proprio computer*.
//
// COME SI USA (SybilGuard/SybilRank, Yu 2006 / Cao 2012, adattati): la fiducia
// parte da qui — dal dispositivo di chi sta valutando, l'unico di cui si è
// certi — e si propaga per pochi passi lungo la rete sociale. Il punto non è
// la propagazione, è il POCHI PASSI: la regione onesta è densamente connessa e
// la fiducia vi si diffonde in fretta, mentre verso una regione di identità
// finte si passa solo per i rarissimi legami reali che l'attaccante è riuscito
// a stabilire. Quei pochi legami sono una strozzatura, e una passeggiata
// interrotta presto non riesce ad attraversarla. Mille identità finte dietro
// un solo legame vero si spartiscono la fiducia di UN legame vero.
//
// COSA CAMBIA IN CONCRETO: il k-anonimato smette di contare i dispositivi e
// comincia a contare le **origini fidate distinte**. È una riga di differenza
// e cambia la garanzia da "tre id diversi" a "tre persone diverse".
//
// ONESTÀ SUI LIMITI, perché qui è particolarmente facile sovravendere:
//  - Questo NON ferma chi stringe relazioni vere. Chi divide davvero le spese
//    con dieci persone si guadagna la fiducia di dieci persone: giusto così.
//    Limita il DANNO in proporzione ai legami reali, non lo azzera.
//  - Un utente nuovo non ha ancora nessun gruppo. Non viene escluso da niente
//    di suo: il suo modello locale funziona identico. Semplicemente non porta
//    voti nel consenso altrui, e la cosa è dichiarata invece che nascosta.
//  - La fiducia è SOGGETTIVA e locale: ognuno la calcola dal proprio punto di
//    vista. Non esiste una classifica globale, che richiederebbe un'autorità —
//    cioè esattamente la cosa che non vogliamo.
//
// Funzioni PURE. Lavora su gruppi già presenti sul dispositivo; nessun importo
// esce da qui e nessun importo entra nel calcolo (contano gli EPISODI e il
// tempo, non le cifre: una relazione lunga è cara da falsificare, una costosa
// no).
'use strict';

// Passi di propagazione. Pochi APPOSTA: è la strozzatura dei legami veri a
// fare il lavoro, e più passi si fanno più la fiducia filtra verso le regioni
// finte. Quattro è il compromesso tipico su reti sociali reali.
export const PASSI = 4;
// Sotto questa quota della fiducia media non si vota. Non è un'espulsione:
// chi è sotto usa Momentum identico, semplicemente non fa da testimone.
export const SOGLIA_VOTO = 0.4;
// Due persone che hanno diviso una spesa una volta sola, ieri, sono un
// indizio. Il peso cresce con gli EPISODI e con il TEMPO, non con gli importi.
export const GIORNI_PER_PESO_PIENO = 90;

// ── La rete sociale attestata ──
// Un membro conta come nodo solo se è RIVENDICATO da un dispositivo
// (`claimedBy`): un nome scritto a mano in un gruppo non è una persona che
// può votare, è una stringa.
export function buildTrustGraph(groups = [], { me = null, now = Date.now() } = {}) {
  const archi = new Map();          // "a|b" -> { episodi, primo, ultimo }
  const nodi = new Set();
  if (me) nodi.add(me);

  for (const g of groups || []) {
    if (!g || !Array.isArray(g.members)) continue;
    const idDispositivo = new Map();  // memberId -> deviceId
    for (const m of g.members) if (m?.claimedBy) idDispositivo.set(m.id, m.claimedBy);
    if (idDispositivo.size < 2) continue; // un gruppo con un solo dispositivo non attesta niente

    for (const e of g.expenses || []) {
      const pagante = idDispositivo.get(e?.payer);
      if (!pagante) continue;
      // `|| now` sarebbe stato sbagliato: una data uguale a 0 è una data, non
      // un'assenza di data. Con la catena di `||` un episodio a timestamp 0
      // veniva spostato ad oggi e la relazione risultava lunga 56 anni.
      const quando = Number.isFinite(+e.date) ? +e.date
        : Number.isFinite(+e.createdAt) ? +e.createdAt : now;
      for (const membroId of Object.keys(e.owed || {})) {
        if (membroId === e.payer) continue;
        const debitore = idDispositivo.get(membroId);
        if (!debitore || debitore === pagante) continue;
        nodi.add(pagante); nodi.add(debitore);
        const k = [pagante, debitore].sort().join('|');
        const prec = archi.get(k) || { episodi: 0, primo: quando, ultimo: quando };
        archi.set(k, {
          episodi: prec.episodi + 1,
          primo: Math.min(prec.primo, quando),
          ultimo: Math.max(prec.ultimo, quando),
        });
      }
    }
  }

  // Il peso di un legame: quante volte, e per quanto tempo. Una relazione che
  // dura mesi è cara da falsificare; una che esplode in un pomeriggio no —
  // ed è esattamente la firma di un attacco fabbricato in fretta.
  const legami = [];
  for (const [k, v] of archi) {
    const [a, b] = k.split('|');
    const durataGiorni = (v.ultimo - v.primo) / 86400000;
    const peso = Math.log1p(v.episodi) * (0.5 + 0.5 * Math.min(1, durataGiorni / GIORNI_PER_PESO_PIENO));
    legami.push({ a, b, episodi: v.episodi, durataGiorni: +durataGiorni.toFixed(1), peso: +peso.toFixed(4) });
  }
  return { nodi: [...nodi], legami, me };
}

const vicini = (grafo) => {
  const m = new Map();
  for (const n of grafo.nodi) m.set(n, []);
  for (const l of grafo.legami) {
    if (!m.has(l.a)) m.set(l.a, []);
    if (!m.has(l.b)) m.set(l.b, []);
    m.get(l.a).push({ id: l.b, peso: l.peso });
    m.get(l.b).push({ id: l.a, peso: l.peso });
  }
  return m;
};

// ── La fiducia, dal MIO punto di vista ──
// Passeggiata pesata interrotta presto, poi normalizzata per grado (senza,
// vincerebbe sempre chi ha più legami invece di chi è più vicino alla parte
// onesta della rete).
export function trustRank(grafo, { passi = PASSI, me = null } = {}) {
  const sorgente = me || grafo.me;
  const adj = vicini(grafo);
  // Senza legami attestati non c'è nessuna passeggiata da fare. Non è un
  // errore: è un utente che non ha ancora diviso una spesa con nessuno.
  if (!sorgente || !adj.get(sorgente)?.length) {
    return { rango: new Map(), media: 0, sorgente, motivo: 'nessun punto di partenza: questo dispositivo non è in nessun gruppo condiviso' };
  }

  let f = new Map([...adj.keys()].map((n) => [n, 0]));
  f.set(sorgente, 1);
  for (let s = 0; s < passi; s++) {
    const next = new Map([...adj.keys()].map((n) => [n, 0]));
    for (const [n, valore] of f) {
      if (valore <= 0) continue;
      const vs = adj.get(n) || [];
      const tot = vs.reduce((acc, v) => acc + v.peso, 0);
      if (!tot) { next.set(n, (next.get(n) || 0) + valore); continue; }
      // PASSEGGIATA PIGRA: metà della fiducia resta ferma a ogni passo.
      // BUG REALE trovato dal test, non a tavolino: senza la parte pigra, su
      // una rete che si comporta da bipartita la fiducia OSCILLA fra i due
      // lati e dopo un numero pari di passi metà delle persone vere risulta a
      // zero — due amici veri classificati come sconosciuti. La pigrizia
      // rompe la parità ed è anche il modo standard di farlo.
      next.set(n, (next.get(n) || 0) + valore * 0.5);
      for (const v of vs) next.set(v.id, (next.get(v.id) || 0) + (0.5 * valore * v.peso) / tot);
    }
    f = next;
  }

  // Normalizzazione per RADICE del grado, non per il grado. Dividere per il
  // grado pieno è la scelta classica quando la passeggiata arriva a regime —
  // ma qui i passi sono pochi apposta, e a pochi passi quella divisione
  // premia i nodi-foglia: chi ha UN solo legame debole con me risultava più
  // fidato di un amico con cui divido spese da mesi (misurato: 0,058 contro
  // 0,041). La radice tiene il correttivo contro chi è solo molto connesso
  // senza ribaltare la classifica a favore degli isolati.
  const rango = new Map();
  for (const [n, valore] of f) {
    const grado = (adj.get(n) || []).reduce((acc, v) => acc + v.peso, 0) || 1;
    rango.set(n, valore / Math.sqrt(grado));
  }
  const valori = [...rango.values()].filter((v) => v > 0);
  const media = valori.length ? valori.reduce((a, b) => a + b, 0) / valori.length : 0;
  // IL RIFERIMENTO PER LA SOGLIA È IL PROPRIO PUNTEGGIO, non la media.
  // DIFETTO DI METODO trovato provando l'attacco vero e proprio: con la media,
  // **più identità finte l'attaccante aggiunge, più la media si abbassa e più
  // la soglia scende** — cioè il sistema si apre da solo proprio mentre viene
  // attaccato. Il proprio punteggio invece non si muove quando qualcuno
  // fabbrica dispositivi in un angolo lontano della rete: è l'unico ancoraggio
  // che l'attaccante non può spostare.
  return { rango, media, riferimento: rango.get(sorgente) || media, sorgente, motivo: null };
}

// Chi può fare da TESTIMONE. Nota bene: non "chi può usare Momentum" e nemmeno
// "chi può ricevere calcolo" — solo chi conta come voce indipendente.
export function trustedWitnesses(peerIds = [], classifica, { soglia = SOGLIA_VOTO } = {}) {
  const { rango } = classifica;
  const taglio = (classifica.riferimento || classifica.media || 0) * soglia;
  const dentro = [], fuori = [];
  for (const id of peerIds) {
    const v = rango.get(id) || 0;
    (v >= taglio && v > 0 ? dentro : fuori).push({ peerId: id, fiducia: +v.toFixed(6) });
  }
  return {
    fidati: dentro.map((d) => d.peerId),
    esclusi: fuori,
    taglio,
    motivo: fuori.length
      ? `${fuori.length} dispositivi non hanno una storia condivisa con te: usano Momentum normalmente, ma non contano come conferma`
      : null,
  };
}

// ── IL PUNTO CONCRETO: il k-anonimato conta PERSONE, non identificatori ──
// Prima: "tre dispositivi hanno visto questo token, può uscire". Dopo: "tre
// persone distinte, ognuna con una storia vera alle spalle, l'hanno visto".
// È la stessa riga di codice e una garanzia completamente diversa.
export function effectiveAnonymity(origini = [], classifica, { k = 3, soglia = SOGLIA_VOTO } = {}) {
  const distinte = [...new Set(origini)];
  const { fidati } = trustedWitnesses(distinte, classifica, { soglia });
  return {
    kDichiarato: distinte.length,
    kEffettivo: fidati.length,
    sufficiente: fidati.length >= k,
    // Il divario È l'allarme: molti identificatori, poche persone.
    gonfiato: distinte.length - fidati.length,
    motivo: fidati.length >= k
      ? null
      : `sembrano ${distinte.length} dispositivi ma sono ${fidati.length} persone con una storia vera: non basta per farlo uscire`,
  };
}

// ── La firma di un attacco, quando c'è ──
// Un gruppo di identità finte è denso al proprio interno e attaccato al resto
// del mondo da pochissimi legami: è una strozzatura, e si misura.
export function sybilDiagnosis(grafo, classifica, { soglia = SOGLIA_VOTO } = {}) {
  const adj = vicini(grafo);
  const { rango } = classifica;
  const taglio = (classifica.riferimento || classifica.media || 0) * soglia;
  const sospetti = grafo.nodi.filter((n) => n !== classifica.sorgente && (rango.get(n) || 0) < taglio);
  if (!sospetti.length) return { sospetto: false, motivo: 'nessuna regione isolata: la rete che vedi è fatta di persone con cui hai una storia' };

  const insieme = new Set(sospetti);
  let interni = 0, versoFuori = 0;
  for (const l of grafo.legami) {
    const a = insieme.has(l.a), b = insieme.has(l.b);
    if (a && b) interni += l.peso;
    else if (a || b) versoFuori += l.peso;
  }
  // Conduttanza: quanto poco quella regione è legata al resto. Bassa =
  // strozzatura = firma classica.
  const conduttanza = interni + versoFuori > 0 ? versoFuori / (interni + versoFuori) : 1;
  return {
    sospetto: sospetti.length >= 3 && conduttanza < 0.2,
    quanti: sospetti.length,
    conduttanza: +conduttanza.toFixed(3),
    legamiVeriVersoDiTe: +versoFuori.toFixed(3),
    motivo: sospetti.length >= 3 && conduttanza < 0.2
      ? `${sospetti.length} dispositivi molto legati fra loro e quasi scollegati da te: possono essere la stessa persona. Non li conto come conferme.`
      : 'dispositivi lontani da te, ma senza la firma di un gruppo fabbricato',
  };
}

// Cosa dire, se mai va detto. Quasi sempre non va detto: allarmare una persona
// per un attacco che il codice ha già neutralizzato è creare paura senza dare
// niente in cambio. Questo testo serve al pannello tecnico, non alla home.
export function trustText(diagnosi, anonimato) {
  if (anonimato && !anonimato.sufficiente && anonimato.gonfiato > 0) {
    return `Ho tenuto dentro un dato che sembrava condivisibile: i dispositivi che lo confermavano erano ${anonimato.kDichiarato}, ma le persone dietro ne risultano ${anonimato.kEffettivo}.`;
  }
  if (diagnosi?.sospetto) return diagnosi.motivo;
  return null;
}
