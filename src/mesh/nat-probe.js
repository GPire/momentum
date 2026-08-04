// ============================================================
// NAT PROBE — sapere PRIMA se il collegamento diretto funzionerà
// ============================================================
// Il problema reale, e il motivo per cui questo file esiste:
// su molte reti mobili (NAT simmetrico, CGNAT degli operatori) due
// dispositivi NON riescono a collegarsi direttamente via WebRTC, e senza
// un server TURN non è aggirabile. Oggi l'utente vede una rotella girare
// per trenta secondi e poi niente: conclude che l'app è rotta, e se ne va.
// È il punto di abbandono numero uno di qualunque cosa peer-to-peer.
//
// Qui la rete viene DIAGNOSTICATA prima di provarci, usando solo server
// STUN pubblici (nessun dato personale esce: una richiesta STUN chiede
// soltanto "da fuori, come mi vedi?"). Se la risposta è "qui il diretto
// non funzionerà", l'app lo dice subito e propone il canale che funziona,
// invece di far aspettare e poi fallire.
//
// Onestà, come sempre: questa è una PREVISIONE basata su come il NAT mappa
// le porte, non una certezza. Il tipo di NAT è il fattore dominante ma non
// l'unico (firewall aziendali, VPN, blocco UDP). Per questo la funzione
// restituisce una probabilità dichiarata e una frase che non promette.
//
// La parte pura (classificazione e previsione) non tocca la rete: prende
// osservazioni e restituisce un giudizio → testabile senza browser.
// La parte impura (raccolta delle osservazioni) prende RTCPeerConnection
// come parametro → sostituibile nei test.
'use strict';

// Pool di server STUN pubblici. Averne uno solo — com'era finora in
// mesh-signaling.js — è un punto di rottura singolo: se quel server è
// irraggiungibile (rete aziendale che lo blocca, disservizio), il
// collegamento fallisce senza che nessuno capisca perché.
// Tutti e tre VERIFICATI dal vivo il 2026-08-04: rispondono davvero.
export const STUN_POOL = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

// ── COME si misura, e perché così (imparato provando, non a tavolino) ──
//
// Primo tentativo sbagliato, corretto dopo una prova reale: interrogare ogni
// server con una RTCPeerConnection SEPARATA e confrontare le porte pubbliche.
// Non funziona: connessioni diverse usano socket locali diversi, quindi porte
// pubbliche diverse sono NORMALI anche su una rete perfettamente buona. Quella
// versione avrebbe dichiarato "rete variabile" quasi ovunque — un allarme
// falso al posto di una diagnosi (misurato dal vivo: 27258 / 27260 / 27261 su
// una rete che invece è prevedibile).
//
// Il metodo corretto è UNA sola connessione con TUTTI i server nell'elenco
// iceServers: la raccolta parte dallo stesso socket locale, e il browser
// deduplica le candidate identiche. Quindi:
//   • una sola candidate pubblica distinta → la rete assegna sempre la stessa
//     porta a prescindere da chi contatti: il collegamento diretto è possibile;
//   • due o più candidate pubbliche distinte → la porta cambia in base alla
//     destinazione: il diretto quasi sempre fallisce senza un TURN.
// Verificato dal vivo sulla rete di sviluppo: tre server, una sola candidate.

// ── Parte pura: dalle osservazioni al giudizio ──

// Un'osservazione è una candidate raccolta:
//   { ip, port, type: 'srflx' | 'host', … }
// 'srflx' = come mi vede il mondo fuori dal NAT; 'host' = il mio indirizzo
// nella rete locale.
//
// `serversQueried` è quanti server STUN sono stati messi nell'elenco: serve a
// distinguere "una sola candidate perché la rete è prevedibile" da "una sola
// candidate perché ho interrogato un server solo" — due situazioni diverse
// che non vanno confuse.
//
//  'aperto'      — l'indirizzo esterno coincide con quello locale: nessun NAT.
//  'prevedibile' — una sola mappatura pubblica pur avendo interrogato più
//                  server: la porta non dipende dalla destinazione. Qui il
//                  collegamento diretto quasi sempre riesce.
//  'variabile'   — più mappature pubbliche distinte dallo stesso socket: la
//                  porta cambia in base a chi contatti. Il diretto fallisce
//                  quasi sempre senza un TURN.
//  'bloccato'    — nessuna candidate pubblica: UDP filtrato o STUN bloccato.
//  'incerto'     — un solo server interrogato: non basta per decidere, e si
//                  dice invece di tirare a indovinare.
export function classifyNat(observations = [], { serversQueried = 0 } = {}) {
  const obs = (Array.isArray(observations) ? observations : []).filter(
    (o) => o && o.ip && Number.isFinite(Number(o.port))
  );
  const srflx = obs.filter((o) => o.type === 'srflx');
  const host = obs.filter((o) => o.type === 'host');

  if (!srflx.length) {
    return { kind: 'bloccato', reason: 'Nessun server ha risposto: questa rete non lascia passare il collegamento diretto.', mappings: 0 };
  }

  const mappings = new Set(srflx.map((o) => `${o.ip}:${o.port}`));

  // Nessun NAT: l'indirizzo pubblico è anche quello locale. Nota: i browser
  // moderni nascondono l'indirizzo locale dietro un nome .local (mDNS), quindi
  // questo caso si riconosce solo dove quell'offuscamento non c'è. Se non si
  // riconosce non è un problema: 'prevedibile' porta allo stesso consiglio.
  const localIps = new Set(host.map((o) => o.ip).filter((ip) => !/\.local$/i.test(ip)));
  if (mappings.size === 1 && localIps.has(srflx[0].ip)) {
    return { kind: 'aperto', reason: 'Questo dispositivo ha un indirizzo pubblico diretto.', mappings: 1 };
  }

  if (mappings.size > 1) {
    return {
      kind: 'variabile',
      reason: 'Questa rete cambia la porta a seconda di chi contatti.',
      mappings: mappings.size,
    };
  }

  // Una sola mappatura. Vale come "prevedibile" SOLO se abbiamo davvero
  // interrogato più server: con un server solo la domanda non è stata posta.
  if (serversQueried < 2) {
    return { kind: 'incerto', reason: 'È stato interrogato un solo server: non basta per capire come questa rete assegna le porte.', mappings: 1 };
  }
  return { kind: 'prevedibile', reason: 'Questa rete assegna sempre la stessa porta, chiunque contatti.', mappings: 1 };
}

// Probabilità stimata che il collegamento DIRETTO riesca, dato il proprio NAT
// e (se noto) quello dell'altro. I numeri non sono misurazioni nostre: sono
// l'ordine di grandezza noto del comportamento dei NAT, e servono a decidere
// COSA PROPORRE, non a essere mostrati come una statistica. Per questo la UI
// riceve una frase, non una percentuale.
const BASE = { aperto: 0.98, prevedibile: 0.9, incerto: 0.6, variabile: 0.15, bloccato: 0.02 };

export function predictDirect(myNat, peerNat = null) {
  const mine = BASE[myNat?.kind] ?? 0.5;
  if (!peerNat) return clamp01(mine);
  const theirs = BASE[peerNat?.kind] ?? 0.5;
  // Due reti "variabili" insieme sono il caso peggiore: la porta cambia da
  // entrambi i lati e non c'è niente da indovinare.
  if (myNat?.kind === 'variabile' && peerNat?.kind === 'variabile') return 0.02;
  return clamp01(mine * theirs);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Il consiglio, in parole che non spaventano e non promettono.
// `channels` dichiara cosa è realmente disponibile adesso, così la frase non
// suggerisce mai una strada che non c'è.
export function adviseChannel(myNat, peerNat = null, channels = {}) {
  const p = predictDirect(myNat, peerNat);
  const haveLink = channels.link !== false;      // il link/QR c'è sempre
  const havePaste = channels.paste !== false;    // il codice da incollare

  if (myNat?.kind === 'bloccato') {
    return {
      prefer: havePaste ? 'paste' : 'link',
      confidence: p,
      headline: 'Questa rete non lascia passare il collegamento diretto.',
      detail: 'Non è un problema tuo né dell\'app: succede sulle reti di aziende, scuole e alcuni hotel. Usiamo il link, funziona lo stesso.',
    };
  }
  if (myNat?.kind === 'variabile' || (peerNat && peerNat.kind === 'variabile')) {
    return {
      prefer: havePaste ? 'paste' : 'link',
      confidence: p,
      headline: 'Su questa rete il collegamento diretto quasi sicuramente non parte.',
      detail: 'Capita spesso con la rete del telefono. Andiamo direttamente col link: ci mette lo stesso tempo ed è altrettanto sicuro.',
    };
  }
  if (myNat?.kind === 'incerto') {
    return {
      prefer: 'direct',
      confidence: p,
      headline: 'Proviamo il collegamento diretto.',
      detail: haveLink ? 'Se non parte entro pochi secondi passiamo al link, senza farti aspettare.' : '',
    };
  }
  return {
    prefer: 'direct',
    confidence: p,
    headline: 'Questa rete va bene per il collegamento diretto.',
    detail: '',
  };
}

// Quanto ha senso aspettare prima di passare al piano B. Su una rete che la
// sonda dà per persa non si aspetta trenta secondi: si cambia subito strada.
// È la differenza tra un'app che sembra rotta e una che sembra sveglia.
export function directTimeoutMs(myNat, peerNat = null) {
  const p = predictDirect(myNat, peerNat);
  if (p >= 0.85) return 12_000;
  if (p >= 0.5) return 7_000;
  if (p >= 0.1) return 3_000;
  return 0; // inutile provarci
}

// Estrae ip/porta/tipo da una riga di candidate ICE. Formato standard:
//   candidate:842163049 1 udp 1677729535 93.184.216.34 54321 typ srflx ...
// Funzione pura: è il punto in cui una stringa di rete diventa un dato, e
// va testata da sola perché un errore qui falserebbe ogni diagnosi.
export function parseCandidate(candidateStr) {
  const s = String(candidateStr || '');
  const m = s.match(/candidate:\S+\s+\d+\s+(udp|tcp)\s+\d+\s+(\S+)\s+(\d+)\s+typ\s+(\w+)/i);
  if (!m) return null;
  return { protocol: m[1].toLowerCase(), ip: m[2], port: Number(m[3]), type: m[4].toLowerCase() };
}

// ── Parte impura: raccogliere le osservazioni ──
// UNA sola connessione con TUTTI i server (vedi la nota sul metodo in cima):
// è l'unico modo per rendere confrontabili le mappature, perché partono dallo
// stesso socket locale.
// `PeerConnection` è un parametro: nei test entra un finto, in produzione
// entra RTCPeerConnection. Nessun import globale nascosto.
export async function gatherObservations({
  servers = STUN_POOL,
  PeerConnection = (typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : null),
  timeoutMs = 6000,
} = {}) {
  if (!PeerConnection || !servers?.length) return [];
  return new Promise((resolve) => {
    const found = [];
    let pc = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { pc?.close(); } catch (_) { /* già chiusa */ }
      resolve(found);
    };
    const timer = setTimeout(finish, timeoutMs);

    try {
      // Voci separate, non un unico array di urls: così il browser interroga
      // davvero tutti i server invece di fermarsi al primo che risponde.
      pc = new PeerConnection({ iceServers: servers.map((urls) => ({ urls })) });
      // Un canale dati qualsiasi: serve solo a far partire la raccolta ICE.
      pc.createDataChannel('probe');
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(timer); finish(); return; }
        const parsed = parseCandidate(e.candidate.candidate);
        if (parsed && (parsed.type === 'srflx' || parsed.type === 'host')) found.push(parsed);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => { clearTimeout(timer); finish(); });
    } catch (_) {
      clearTimeout(timer);
      finish();
    }
  });
}

// Il giro completo: sonda la rete e restituisce diagnosi + consiglio.
// Il risultato è pensato per essere messo in cache per la sessione: il tipo di
// rete non cambia da un minuto all'altro, e rifare la sonda a ogni tentativo
// sarebbe uno spreco — e un ritardo che l'utente sentirebbe.
export async function probeNetwork(opts = {}) {
  const servers = opts.servers || STUN_POOL;
  const observations = await gatherObservations({ ...opts, servers });
  const nat = classifyNat(observations, { serversQueried: servers.length });
  return { nat, advice: adviseChannel(nat, null, opts.channels), timeoutMs: directTimeoutMs(nat), observations };
}
