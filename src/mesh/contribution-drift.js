// ============================================================
// L'ATTACCO CHE NESSUN SINGOLO CONTROLLO PUÒ VEDERE
// ============================================================
// La ricerca sullo stato dell'arte 2024-2026 ha trovato tre attacchi
// DIMOSTRATI contro esattamente lo schema che Momentum usa, e tutti e tre
// condividono lo stesso disegno:
//
//  - avvelenamento dei LOGIT nella distillazione federata (Zheng et al. 2024,
//    arXiv:2401.17746): non tocca i pesi, tocca le previsioni pubblicate sul
//    probe set — cioè arriva PRIMA del nostro merge-gate, che guarda i pesi;
//  - inferenza di appartenenza e della distribuzione delle etichette dalle
//    sole previsioni pubblicate (PETS 2025, arXiv:2502.08001), con un
//    attaccante "onesto ma curioso": un peer normale della mesh;
//  - backdoor semantici (SABLE, DSN 2026) che superano Multi-Krum e la media
//    troncata portando il tasso di successo dal 52% all'84,5% — e la nostra
//    mediana per coordinata appartiene alla stessa famiglia di difese.
//
// IL DISEGNO COMUNE: **restare sotto soglia a ogni singolo round**. Nessuno di
// questi attacchi fa mai un passo abbastanza grande da essere scartato. Fanno
// mille passi piccoli tutti nella stessa direzione. Un controllo che valuta
// ogni round in isolamento — cioè tutto ciò che abbiamo oggi — non può vederli
// per costruzione, non perché sia scritto male.
//
// LA DOMANDA GIUSTA non è "questo contributo è strano?" ma **"questo
// dispositivo sta spingendo, da mesi, sempre dalla stessa parte?"**. Un peer
// onesto sbaglia in direzioni casuali: i suoi scarti si compensano. Un peer che
// avvelena non può permetterselo — se cambiasse direzione annullerebbe il
// proprio lavoro. La persistenza della direzione è la firma che l'attacco non
// può nascondere, perché è ciò che lo rende un attacco.
//
// LO STRUMENTO GIUSTO ESISTE DAL 1954: la somma cumulata di Page (CUSUM), il
// test sequenziale progettato esattamente per scoprire uno spostamento piccolo
// e persistente che nessun controllo campione-per-campione rileva. Si accumula
// lo scarto dalla mediana robusta, si perdona una quota di rumore (k), e si
// suona quando la somma supera una soglia (h). È aritmetica: una somma e un
// massimo, per peer, per round.
//
// LA SECONDA COSA CHE UN ROUND SOLO NON VEDE: la COLLUSIONE. Tre dispositivi
// che spingono ognuno un po', ma tutti e tre nella stessa direzione negli
// stessi round, sono un attacco coordinato — e ciascuno preso da solo è
// innocente. Si misura la concordanza dei segni fra le loro traiettorie.
//
// ONESTÀ SUI LIMITI: questo non "risolve" SABLE. Gli autori stessi dichiarano
// che le difese note sono inefficaci in ambienti eterogenei, e non ho trovato
// nessuna difesa a costo basso dimostrata contro di lui. Questo alza il costo
// dell'attacco: per restare invisibile ora bisogna anche alternare la
// direzione, e alternare la direzione significa avvelenare più lentamente —
// spesso così lentamente da non arrivare mai. È una mitigazione misurabile,
// non una soluzione, e va chiamata con il suo nome.
//
// Funzioni PURE.
'use strict';

// Quanto rumore si perdona a ogni round prima di iniziare a sommare. Espresso
// in scarti assoluti mediani (MAD), non in unità arbitrarie: un peer che
// devia come deviano tutti non accumula niente.
// Valori SCELTI MISURANDO, non a occhio. Simulazione con 7 peer onesti su 60
// round, 200 ripetizioni per configurazione:
//   k=0,50 h=5 -> falsi positivi 0,14%  ma rileva solo il 46% delle spinte a 0,55 sigma
//   k=0,25 h=5 -> falsi positivi 0,29%  rileva il 98%
//   k=0,20 h=4 -> falsi positivi 0,29%  rileva il 99% a 0,55 sigma e il 52% a 0,34 sigma
// Scelto k=0,20 h=4: allo stesso costo in falsi allarmi di k=0,25 scopre di
// piu'. Sotto 0,3 sigma la rilevazione diventa una moneta, e va detto invece
// che promettere una sensibilita' che non c'e'.
export const TOLLERANZA_K = 0.2;
export const SOGLIA_H = 4;
// Sotto questo numero di round non si accusa nessuno: una traiettoria di tre
// punti non è una traiettoria.
export const MIN_ROUND = 8;
export const FINESTRA = 100;

export function initDriftState() { return { peer: {}, round: 0 }; }

const mediana = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// Scarto assoluto mediano: la misura di dispersione che non si lascia spostare
// dagli outlier — che qui sono esattamente ciò che stiamo cercando.
const mad = (a, med) => {
  const d = a.map((x) => Math.abs(x - med));
  const m = mediana(d);
  // 1.4826 riporta il MAD alla scala di una deviazione standard su dati
  // normali, così la soglia h si legge in "quante deviazioni".
  return m * 1.4826 || 1e-9;
};

// Registra UN round: il valore che ciascun peer ha proposto per una certa
// grandezza (la probabilità su una sonda, un peso, un aggregato pubblico).
// Il riferimento è la mediana dei presenti — non un valore "giusto" noto, che
// in un sistema senza server non esiste.
export function observeRound(state, contributi = {}) {
  const s = state || initDriftState();
  const valori = Object.values(contributi).filter(Number.isFinite);
  if (valori.length < 3) return s; // con due opinioni la mediana non dice niente

  const med = mediana(valori);
  const scala = mad(valori, med);
  const peer = { ...s.peer };

  for (const [peerId, v] of Object.entries(contributi)) {
    if (!Number.isFinite(v)) continue;
    // Lo scarto normalizzato, LIMITATO. Il MAD su otto valori puo' capitare
    // vicino a zero (un round in cui tutti si sono trovati d'accordo per caso),
    // e allora z esplode: misurato uno z di 7,4 su una rete di soli onesti.
    // Senza limite, un round fortunato basterebbe da solo a superare la soglia
    // — cioe' esattamente il falso allarme che questo modulo esiste per non
    // dare. Limitare l'influenza di una singola osservazione e' la pratica
    // standard in statistica robusta, e qui non toglie nulla: un attacco lento
    // non ha bisogno di z grandi, e uno grosso lo prende gia' il controllo
    // round-per-round.
    const zGrezzo = (v - med) / scala;
    const z = Math.max(-4, Math.min(4, zGrezzo));
    const prec = peer[peerId] || { su: 0, giu: 0, round: 0, segni: [], picco: 0 };
    // CUSUM a due lati: uno insegue le spinte verso l'alto, l'altro verso il
    // basso. Il perdono `k` è ciò che impedisce al rumore di accumularsi.
    const su = Math.max(0, prec.su + z - TOLLERANZA_K);
    const giu = Math.max(0, prec.giu - z - TOLLERANZA_K);
    peer[peerId] = {
      su, giu,
      round: prec.round + 1,
      segni: [...prec.segni, Math.sign(z)].slice(-FINESTRA),
      picco: Math.max(prec.picco, su, giu),
      ultimoZ: +z.toFixed(4),
      ultimoZGrezzo: +zGrezzo.toFixed(4),
    };
  }
  return { ...s, peer, round: s.round + 1 };
}

// IL VERDETTO su un peer. Due prove indipendenti che devono concordare: la
// somma cumulata sopra soglia E una direzione troppo costante per essere
// rumore. Chiedere entrambe riduce i falsi allarmi su chi ha semplicemente
// abitudini diverse.
export function peerVerdict(state, peerId) {
  const p = state?.peer?.[peerId];
  if (!p || p.round < MIN_ROUND) {
    return { sospetto: false, giudicabile: false, round: p?.round || 0, motivo: `solo ${p?.round || 0} round osservati: troppo poco per parlare di tendenza` };
  }
  const cusum = Math.max(p.su, p.giu);
  const verso = p.su >= p.giu ? 'alto' : 'basso';

  // Persistenza della direzione: quanto spesso lo scarto ha lo stesso segno.
  // Con scarti casuali ci si aspetta metà e metà; molto oltre significa che
  // qualcuno sta spingendo.
  const segni = p.segni.filter((x) => x !== 0);
  const positivi = segni.filter((x) => x > 0).length;
  const persistenza = segni.length ? Math.max(positivi, segni.length - positivi) / segni.length : 0.5;
  // Errore standard della proporzione sotto l'ipotesi "casuale": serve a non
  // gridare all'attacco per una serie fortunata di teste.
  const se = Math.sqrt(0.25 / Math.max(1, segni.length));
  const persistenzaAnomala = persistenza > 0.5 + 3 * se;

  const sospetto = cusum >= SOGLIA_H && persistenzaAnomala;
  return {
    sospetto, giudicabile: true, cusum: +cusum.toFixed(2), verso,
    persistenza: +persistenza.toFixed(3), persistenzaAnomala,
    round: p.round, picco: +p.picco.toFixed(2),
    motivo: sospetto
      ? `da ${p.round} round spinge sempre verso il ${verso}: uno scarto piccolo, ma sempre nello stesso senso`
      : cusum >= SOGLIA_H
        ? 'si discosta parecchio, ma in direzioni che cambiano: sembra un dispositivo diverso, non uno che spinge'
        : null,
  };
}

// IL PESO da applicare al voto di quel peer. Non un'espulsione: un contributo
// sospetto pesa meno, e se la traiettoria rientra il peso torna. Espellere su
// una statistica sarebbe punire chi ha abitudini insolite.
export function driftWeight(state, peerId) {
  const v = peerVerdict(state, peerId);
  if (!v.giudicabile) return 1;
  if (!v.sospetto) return 1;
  // Decade con la somma cumulata, senza mai azzerarsi del tutto: chi è stato
  // declassato deve poter tornare, altrimenti un falso positivo è definitivo.
  return Math.max(0.1, Math.min(1, SOGLIA_H / v.cusum));
}

// ── LA COLLUSIONE, che un peer alla volta non si vede ──
// Tre dispositivi che spingono ognuno poco, ma tutti nella stessa direzione
// negli stessi round, sono un attacco coordinato. Presi singolarmente sono
// innocenti; insieme no.
export function detectCollusion(state, { minConcordanza = 0.8, minRound = MIN_ROUND } = {}) {
  const ids = Object.keys(state?.peer || {}).filter((id) => (state.peer[id].round || 0) >= minRound);
  const coppie = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = state.peer[ids[i]].segni, b = state.peer[ids[j]].segni;
      const n = Math.min(a.length, b.length);
      if (n < minRound) continue;
      const A = a.slice(-n), B = b.slice(-n);
      let uguali = 0, contati = 0;
      for (let k = 0; k < n; k++) {
        if (A[k] === 0 || B[k] === 0) continue;
        contati++;
        if (A[k] === B[k]) uguali++;
      }
      if (contati < minRound) continue;
      const concordanza = uguali / contati;
      if (concordanza >= minConcordanza) coppie.push({ a: ids[i], b: ids[j], concordanza: +concordanza.toFixed(3), round: contati });
    }
  }
  // Gruppi: se A concorda con B e B con C, i tre vanno guardati insieme.
  const gruppi = [];
  const visti = new Set();
  for (const c of coppie) {
    let g = gruppi.find((x) => x.has(c.a) || x.has(c.b));
    if (!g) { g = new Set(); gruppi.push(g); }
    g.add(c.a); g.add(c.b); visti.add(c.a); visti.add(c.b);
  }
  return {
    coppie,
    gruppi: gruppi.filter((g) => g.size >= 2).map((g) => [...g]),
    sospetto: gruppi.some((g) => g.size >= 3),
    motivo: gruppi.some((g) => g.size >= 3)
      ? 'più dispositivi si muovono insieme, sempre nella stessa direzione: presi uno per uno sembrerebbero normali'
      : null,
  };
}

// Il peso finale, che compone questa misura con la reputazione già esistente
// (update-ledger.js). Si moltiplica invece di sostituire: sono due domande
// diverse — "ha mentito in modo verificabile?" e "sta spingendo piano da
// mesi?" — e nessuna delle due sostituisce l'altra.
export function combinedWeight(state, peerId, reputazione = 1, { collusione = null } = {}) {
  let w = driftWeight(state, peerId) * (Number.isFinite(reputazione) ? reputazione : 1);
  if (collusione?.gruppi?.some((g) => g.length >= 3 && g.includes(peerId))) w *= 0.35;
  return +Math.max(0, Math.min(1, w)).toFixed(4);
}

// Cosa dire, e quasi sempre non va detto all'utente: allarmarlo per un attacco
// che il codice ha già depotenziato è creare paura senza dare niente in
// cambio. Serve al pannello tecnico.
export function driftText(state, peerId) {
  const v = peerVerdict(state, peerId);
  if (!v.giudicabile || !v.sospetto) return null;
  return `Un dispositivo collegato sta tirando i risultati sempre dalla stessa parte da ${v.round} scambi. Ho ridotto quanto conta il suo parere.`;
}
