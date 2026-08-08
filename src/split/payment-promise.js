// ============================================================
// "QUANDO MI RIDAI I SOLDI?" — la domanda che nessuno vuole fare
// ============================================================
// I messaggi ancorati alle spese (group-chat.js) risolvono "chi ha preso il
// taxi". Utile, ma l'obiezione è giusta: assomiglia ai commenti di Splitwise.
// Il messaggio DAVVERO difficile in un gruppo di spese è un altro, e nessuna
// app del settore lo affronta:
//
//     "senti… quando me li ridai?"
//
// È la frase che nessuno vuole scrivere. Chi la manda si sente esattore, chi
// la riceve si sente in torto, e il risultato quasi sempre è che nessuno la
// scrive: il debito resta lì, il gruppo muore, e l'app viene disinstallata da
// entrambi. Splitwise ci mette sopra un pulsante "remind" — cioè automatizza
// esattamente la cosa sgradevole, e la rende più fredda invece che più facile.
//
// LA COSA CHE SOLO MOMENTUM PUÒ FARE. Splitwise sa quanto devi. Non sa se
// puoi. Momentum, sul TUO dispositivo, ha già la tua previsione di cassa
// (cash-forecast.js, con p10/p50/p90 misurati). Quindi la domanda cambia
// padrone: invece che l'altro ti chieda quando paghi, **è il tuo telefono a
// rispondere per te**, prima che qualcuno debba chiedere.
//
//     "Marco può il 27" — invece di tre messaggi imbarazzanti.
//
// COSA ESCE DAL DISPOSITIVO, e va detto con precisione perché è il punto:
// **una data. Nient'altro.** Non il saldo, non lo stipendio, non quanto ti
// resta, non perché quel giorno e non prima. La previsione di cassa non lascia
// mai il telefono: esce solo la sua conclusione. C'è un test che fallisce se
// un saldo o un importo di stipendio finiscono nell'oggetto condiviso.
//
// E IL PEZZO ANTI-ATTRITO: se qualcuno ha promesso una data, l'app **smette di
// sollecitarlo** fino a quel giorno. Il valore non è mandare più promemoria:
// è togliere di mezzo la conversazione finché non serve.
'use strict';

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const GIORNO = 86400000;

// Il primo giorno in cui pagare `importo` NON ti lascia scoperto.
// Si usa il percorso PRUDENTE (p10), non quello probabile: promettere una data
// su cui si arriva "in media" significa mancarla una volta su due, e una
// promessa mancata è peggio di nessuna promessa — la seconda volta nessuno ti
// crede più.
export function earliestComfortableDate(forecast, importo, { cushion = 0, now = Date.now() } = {}) {
  const imp = Math.max(0, +importo || 0);
  if (!forecast || !Array.isArray(forecast.path) || !forecast.path.length) {
    return { data: null, motivo: 'non ho abbastanza storia per dire quando puoi', giudicabile: false };
  }
  if (imp === 0) return { data: iso(now), motivo: 'non devi niente', giudicabile: true };

  for (const punto of forecast.path) {
    if ((punto.p10 - imp) >= cushion) {
      return {
        data: punto.date,
        traGiorni: punto.inDays,
        giudicabile: true,
        // Il MOTIVO non contiene numeri della propria cassa: dice quando, non
        // quanto si ha. È la differenza fra rispondere e mettersi a nudo.
        motivo: punto.inDays <= 0 ? 'puoi già adesso' : `dal ${punto.date} ce la fai senza restare scoperto`,
      };
    }
  }
  // Nessun giorno nell'orizzonte funziona: si dice, invece di promettere una
  // data a caso. "Non entro il mese" è un'informazione utile; una data
  // inventata è un danno.
  return {
    data: null, giudicabile: true, oltreOrizzonte: true,
    motivo: 'non entro le prossime settimane: meglio dirlo che promettere una data che salterebbe',
  };
}

// L'oggetto che LASCIA il dispositivo. Volutamente minuscolo: chi lo riceve
// impara una data e nient'altro. Il campo `capacita` è qualitativo apposta —
// 'ora' | 'presto' | 'tardi' | 'non-so' — perché anche "fra 3 giorni" contro
// "fra 28" direbbe troppo su come stai messo.
export function makePromise({ memberId, expenseId = null, importo, valutazione, now = Date.now() } = {}) {
  if (!memberId || !valutazione) return null;
  const traGiorni = valutazione.traGiorni;
  const capacita = !valutazione.giudicabile ? 'non-so'
    : valutazione.oltreOrizzonte ? 'tardi'
    : traGiorni <= 0 ? 'ora'
    : traGiorni <= 14 ? 'presto' : 'tardi';
  return {
    id: `${memberId}:${expenseId || 'gruppo'}`,
    memberId,
    expenseId,
    data: valutazione.data,      // l'unica cosa concreta che esce
    capacita,
    // L'importo promesso è già noto a tutti (è il saldo del gruppo, calcolato
    // da chiunque): includerlo non aggiunge nessuna informazione nuova.
    importo: +(+importo || 0).toFixed(2),
    at: now,
  };
}

// CRDT: una promessa più recente dello stesso membro sostituisce la vecchia.
// Le persone cambiano idea, e una promessa vecchia che sopravvive a quella
// nuova sarebbe peggio di nessuna promessa.
export function mergePromises(a = [], b = []) {
  const byId = new Map();
  for (const p of [...(a || []), ...(b || [])]) {
    if (!p || !p.id) continue;
    const prev = byId.get(p.id);
    if (!prev || (+p.at || 0) > (+prev.at || 0)) byId.set(p.id, p);
  }
  return [...byId.values()];
}

export function addPromise(group, promise) {
  if (!group || !promise) return group;
  return { ...group, promises: mergePromises(group.promises, [promise]) };
}

export function promiseFor(group, memberId, expenseId = null) {
  const id = `${memberId}:${expenseId || 'gruppo'}`;
  return (group?.promises || []).find((p) => p.id === id) || null;
}

// ── LA PARTE ANTI-ATTRITO: quando NON dire niente ──
// Il valore non è sollecitare meglio. È non sollecitare affatto finché non
// serve. Una persona che ha detto "il 27" e a cui il 20 arriva un promemoria
// impara che dire una data non serve a niente — e la volta dopo non la dice.
export function shouldRemind(group, memberId, { now = Date.now(), graziaGiorni = 2 } = {}) {
  const p = promiseFor(group, memberId);
  if (!p) return { sollecita: true, motivo: 'non ha ancora detto quando può' };
  if (!p.data) {
    return { sollecita: false, motivo: 'ha detto che al momento non ce la fa: insistere non cambia la sua cassa' };
  }
  const scadenza = new Date(p.data).getTime() + graziaGiorni * GIORNO;
  if (now <= scadenza) {
    return { sollecita: false, motivo: `ha detto ${p.data}`, dataPromessa: p.data };
  }
  return { sollecita: true, motivo: `aveva detto ${p.data} ed è passato`, dataPromessa: p.data, inRitardo: true };
}

// Cosa si mostra a chi ASPETTA i soldi. Mai un tono da esattore: la frase
// dice un fatto e toglie il pensiero, non mette pressione su nessuno.
export function waitingText(group, memberId, nome) {
  const p = promiseFor(group, memberId);
  const chi = nome || 'Chi ti deve dei soldi';
  if (!p) return `${chi} non ha ancora detto quando può.`;
  if (!p.data) return `${chi} in questo momento non ce la fa. Te lo dirà appena può — non serve chiedere.`;
  if (p.capacita === 'ora') return `${chi} può già adesso.`;
  return `${chi} può dal ${p.data}. Non serve ricordarglielo: te lo segno io.`;
}

// Cosa si mostra a chi DEVE i soldi — e qui il tono conta ancora di più.
// Mai colpa, mai rosso: la persona sa già di dovere. Quello che non sa è
// quando può permetterselo senza restare scoperta, ed è l'unica cosa che
// l'app può aggiungere di utile.
export function owingText(valutazione, importo) {
  const eur = `${(+importo || 0).toFixed(2).replace('.', ',')} €`;
  if (!valutazione?.giudicabile) return `Devi ${eur}. Non ho abbastanza storia per dirti quando ti conviene.`;
  if (valutazione.oltreOrizzonte) return `Devi ${eur}. Nelle prossime settimane non ci arrivi senza restare scoperto: dirlo ora è meglio che far passare il tempo.`;
  if ((valutazione.traGiorni ?? 0) <= 0) return `Puoi saldare i ${eur} adesso senza restare scoperto.`;
  return `Puoi saldare i ${eur} dal ${valutazione.data} senza restare scoperto.`;
}

// Riassunto di gruppo: quante promesse in piedi, quante in ritardo. Serve a
// mostrare UNA riga invece di far aprire ogni persona a mano.
export function promisesStatus(group, { now = Date.now() } = {}) {
  const membri = (group?.members || []).filter((m) => !m.left);
  let attese = 0, inRitardo = 0, senzaRisposta = 0;
  for (const m of membri) {
    const r = shouldRemind(group, m.id, { now });
    if (r.inRitardo) inRitardo++;
    else if (!r.sollecita && r.dataPromessa) attese++;
    else if (r.sollecita) senzaRisposta++;
  }
  return { attese, inRitardo, senzaRisposta };
}
