// ============================================================
// TRIP REVIEW — far approvare una nota spese di trasferta, senza server
// ============================================================
// Il problema reale (ricerca su SAP Concur/Zoho Expense/Expensify, recensioni
// 2026): l'approvazione di una nota spese richiede un sistema multi-utente
// lato azienda — è esattamente ciò che un'app on-device NON ha e non vuole
// avere. Ma il flusso vero che serve al dipendente è più semplice di un
// workflow aziendale a più livelli: "far vedere la trasferta a chi deve
// approvarla, e ricevere indietro un sì o un 'manca questo'".
//
// Questo si può fare a zero server, riusando ESATTAMENTE i due meccanismi che
// Momentum ha già collaudato altrove:
//  1. il codice/link auto-contenuto dello split (encodeGroupShare) → il
//     riepilogo viaggia dentro il link stesso, leggibile SEMPRE, anche
//     offline, anche se il P2P non si aggancia mai;
//  2. l'aggancio WebRTC senza server di mesh-signaling.js (PairingSignaling:
//     offerta e risposta scambiate come codici, nessun signaling server) → se
//     si apre il canale, sopra ci passano i GIUSTIFICATIVI VERI (foto e PDF a
//     piena qualità), che in un QR non entrerebbero mai.
//
// LIMITE FISICO DICHIARATO, non aggirabile: un QR regge qualche KB, una foto
// di scontrino ne pesa centinaia. Le immagini NON stanno nel codice: il codice
// porta il riepilogo (date, importi, categorie, cosa manca) e l'aggancio; le
// immagini arrivano dopo, sul canale diretto. Mai promettere il contrario.
//
// SEPARAZIONE DELIBERATA payload/trasporto: questo file produce e legge SOLO
// payload, non sa nulla di come viaggiano. Oggi il trasporto è link, QR e
// canale WebRTC; domani, con le app native (Capacitor Android/iOS già
// previsto), gli stessi identici payload potranno viaggiare su Nearby
// Share/Wi-Fi Direct, MultipeerConnectivity/AirDrop o NFC — trasporti più
// veloci e che funzionano anche senza internet — senza cambiare una riga qui
// dentro. Per lo stesso motivo il riconoscimento di un codice avviene per
// CONTENUTO (il marcatore), mai per dominio o schema URL: un deep link
// nativo, un incolla da chat e un QR sono la stessa cosa per questo modulo.
//
// Funzioni pure: nessun DOM, nessuna rete (il WebRTC lo maneggia chi chiama).
'use strict';

function b64encode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
function b64decode(b64) {
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export const TRIP_REVIEW_PREFIX = 'MTRIP1:';
// Il PUNTO invece dei due punti nel formato compresso non è un vezzo: è una
// lezione già pagata in split/invite-codec.js — diversi client di posta
// spezzano un link sui due punti, troncando il codice a metà. Stesso motivo,
// stessa scelta, qui.
export const TRIP_REVIEW_PREFIX_GZ = 'MTRIPZ1.';
export const TRIP_VERDICT_PREFIX = 'MTRIPV1:';

// COMPRESSIONE — limite reale trovato da un test, non a tavolino: una
// trasferta di 30 spese produceva 2931 byte, appena OLTRE il tetto pratico di
// un QR fotografato da un telefono (~2.9KB): chi approva si sarebbe trovato
// davanti un quadrato illeggibile, senza capire perché. I dati qui sono
// ripetitivi per natura (stesse date, stesse categorie, stessi importi), il
// caso migliore per gzip: si dimezzano abbondantemente.
// CompressionStream è uno standard web nativo (Chrome/Edge, Safari 16.4+,
// Firefox 113+, Node 18+) — nessuna libreria da caricare, nessuna dipendenza
// nuova. Dove non c'è (browser vecchi), si ricade sul formato non compresso
// con l'altro prefisso: il codice resta valido, solo più lungo. La
// decodifica accetta SEMPRE entrambi i formati, così un codice generato da un
// telefono nuovo si legge anche su un telefono vecchio e viceversa.
const gzipDisponibile = () => (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined');

async function gzipToBase64(str) {
  const cs = new CompressionStream('gzip');
  const stream = new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(cs);
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}

async function base64ToGunzip(b64) {
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new TextDecoder().decode(new Uint8Array(await new Response(stream).arrayBuffer()));
}

// Gli unici due esiti possibili. Deliberatamente NON c'è un "respinta":
// una nota spese non viene bocciata, viene rimandata indietro con il motivo —
// e il motivo è l'informazione che serve al dipendente per sistemarla.
export const VERDICT_STATES = ['approvata', 'modifiche'];

// Chiavi corte nel payload: un QR più corto è un QR che si legge al primo
// colpo, su carta stampata e su uno schermo sporco. Nomi lunghi qui
// costerebbero centinaia di byte per una trasferta di venti spese.
export async function encodeTripReview({ tripId, tripName, startDate, endDate, expenses = [], totale = 0, numeroGiustificativiMancanti = 0, mittente = '' }, p2pOffer, { maxLen = 900 } = {}) {
  if (!tripId) throw new Error('serve l identificativo della trasferta');
  const slim = {
    v: 1,
    i: tripId,
    n: tripName || '',
    ...(startDate ? { s: startDate } : {}),
    ...(endDate ? { e: endDate } : {}),
    ...(mittente ? { m: mittente } : {}),
    t: Math.round((+totale + Number.EPSILON) * 100) / 100,
    k: numeroGiustificativiMancanti,
    // Le righe: data, categoria, descrizione, importo, e SOLO un flag per il
    // giustificativo (c'è / non c'è) — mai l'immagine, vedi il limite in testa.
    r: expenses.map(x => ({
      d: x.data,
      c: x.categoria,
      ...(x.mealType ? { p: x.mealType } : {}),
      w: String(x.descrizione || '').slice(0, 80),
      a: Math.round((+x.importo + Number.EPSILON) * 100) / 100,
      ...(x.scontrino ? { g: 1 } : {}),
      ...(x.giustificativoMancante ? { x: 1 } : {}),
    })),
    ...(p2pOffer ? { o: p2pOffer } : {}),
  };
  const codifica = async (obj) => {
    const json = JSON.stringify(obj);
    if (gzipDisponibile()) {
      try { return TRIP_REVIEW_PREFIX_GZ + await gzipToBase64(json); } catch (_) { /* in chiaro qui sotto */ }
    }
    return TRIP_REVIEW_PREFIX + b64encode(json);
  };

  const completo = await codifica(slim);
  if (completo.length <= maxLen) return completo;

  // DEGRADO INTELLIGENTE — limite reale misurato da un test, non ipotizzato:
  // una trasferta di mesi con 120 spese vere (date, categorie e importi tutti
  // diversi) fa 1452 caratteri anche compressa, oltre il tetto pratico di un
  // QR (~900, stessa soglia già pagata in split/invite-codec.js). Invece di
  // generare un QR illeggibile — o peggio, di far sparire il QR proprio nelle
  // trasferte lunghe, che sono quelle in cui approvare costa più fatica — il
  // codice si riduce da solo a una SINTESI PER GIORNO: totali giornalieri,
  // totali per categoria, e l'elenco delle sole spese senza giustificativo
  // (le uniche righe che chi approva deve davvero vedere una per una).
  // Il dettaglio completo non si perde: arriva sul collegamento diretto, e il
  // payload lo dichiara (`z: 1`) così chi riceve lo dice apertamente invece di
  // far credere che quelle siano tutte le spese.
  const perGiorno = {};
  const perCategoria = {};
  for (const x of slim.r) {
    perGiorno[x.d] = Math.round(((perGiorno[x.d] || 0) + x.a + Number.EPSILON) * 100) / 100;
    perCategoria[x.c] = Math.round(((perCategoria[x.c] || 0) + x.a + Number.EPSILON) * 100) / 100;
  }
  const sintesi = {
    ...slim,
    z: 1,                                   // riepilogo ridotto, non l'elenco completo
    q: slim.r.length,                       // quante spese ci sono in tutto
    gg: perGiorno,
    cc: perCategoria,
    r: slim.r.filter(x => x.x).slice(0, 25), // solo le righe che richiedono un giustificativo
  };
  const ridotto = await codifica(sintesi);
  if (ridotto.length <= maxLen) return ridotto;

  // SECONDO LIVELLO — limite trovato spingendo i numeri fino a dove arrivano
  // davvero: con 1500 spese su 112 giorni anche la sintesi giornaliera sfora
  // (1192 caratteri), perché i totali per giorno crescono coi GIORNI, non con
  // le spese. Una trasferta di mesi va allora riassunta per MESE: due mesi
  // fanno due righe, un anno ne fa dodici, e il codice resta piccolo per
  // sempre. Chi approva una trasferta lunghissima guarda comunque prima i
  // totali di periodo — il dettaglio giorno per giorno lo apre dal
  // collegamento diretto o dal riepilogo stampabile.
  const perMese = {};
  for (const [giorno, tot] of Object.entries(perGiorno)) {
    const mese = String(giorno).slice(0, 7);
    perMese[mese] = Math.round(((perMese[mese] || 0) + tot + Number.EPSILON) * 100) / 100;
  }
  return codifica({ ...sintesi, z: 2, gg: perMese, r: sintesi.r.slice(0, 10) });
}

// Estrae il payload da QUALSIASI cosa: codice nudo, link completo incollato,
// testo che lo contiene. Riconoscimento per CONTENUTO (il marcatore MTRIP1:),
// mai per dominio — se domani l'app vive altrove, i link già mandati
// continuano a funzionare (stessa scelta già fatta per lo split).
export function extractTripReviewPayload(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (s.startsWith(TRIP_REVIEW_PREFIX_GZ) || s.startsWith(TRIP_REVIEW_PREFIX)) return s;
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch (_) { /* non URL-encoded */ }
  // Il prefisso compresso va cercato PRIMA: "MTRIP1:" è un sotto-pezzo di
  // "MTRIPZ1:"? No — ma cercare l'uno o l'altro nell'ordine sbagliato su un
  // testo che contiene entrambi darebbe il primo trovato, non il più giusto.
  const m = decoded.match(/MTRIPZ1\.[A-Za-z0-9+/=_-]+/) || decoded.match(/MTRIP1:[A-Za-z0-9+/=_-]+/)
    || s.match(/MTRIPZ1\.[A-Za-z0-9+/=_%-]+/) || s.match(/MTRIP1:[A-Za-z0-9+/=_%-]+/);
  if (m) { try { return decodeURIComponent(m[0]); } catch (_) { return m[0]; } }
  return null;
}

// Ritorna la trasferta in sola lettura per chi deve approvarla, o null se il
// codice non è valido — mai un crash su un incolla sbagliato.
export async function decodeTripReview(code) {
  try {
    const payload = extractTripReviewPayload(code);
    const s = String(payload ?? code ?? '').trim();
    // Entrambi i formati, sempre: un telefono nuovo genera compresso, uno
    // vecchio genera in chiaro — e ognuno deve poter leggere l'altro.
    let json;
    if (s.startsWith(TRIP_REVIEW_PREFIX_GZ)) {
      json = await base64ToGunzip(s.slice(TRIP_REVIEW_PREFIX_GZ.length));
    } else {
      json = b64decode(s.startsWith(TRIP_REVIEW_PREFIX) ? s.slice(TRIP_REVIEW_PREFIX.length) : s);
    }
    const g = JSON.parse(json);
    if (!g || !g.i || !Array.isArray(g.r)) return null;
    return {
      tripId: g.i,
      tripName: g.n || '',
      startDate: g.s || null,
      endDate: g.e || null,
      mittente: g.m || '',
      totale: +g.t || 0,
      numeroGiustificativiMancanti: +g.k || 0,
      expenses: g.r.map(x => ({
        data: x.d,
        categoria: x.c,
        mealType: x.p || null,
        descrizione: x.w || '',
        importo: +x.a || 0,
        haGiustificativo: !!x.g,
        giustificativoMancante: !!x.x,
      })),
      p2pOffer: g.o || null,
      // Sintesi ridotta (trasferta troppo lunga per stare tutta in un QR):
      // chi riceve DEVE poterlo dire, altrimenti crederebbe che quelle sono
      // tutte le spese. `numeroSpeseTotali` dice quante sono davvero, i totali
      // per giorno/categoria restano esatti, e il dettaglio completo arriva
      // sul collegamento diretto.
      ridotto: !!g.z,
      // Livello del raggruppamento, così chi mostra i dati non scrive
      // "per giorno" sopra dei totali che sono per mese (una bugia piccola
      // ma di quelle che fanno perdere fiducia in un documento di soldi).
      raggruppamento: g.z === 2 ? 'mese' : (g.z ? 'giorno' : null),
      numeroSpeseTotali: g.z ? (+g.q || 0) : (Array.isArray(g.r) ? g.r.length : 0),
      totaliPerGiorno: g.gg || null,
      totaliPerCategoria: g.cc || null,
    };
  } catch (_) { return null; }
}

// L'ESITO che torna indietro. Minuscolo di proposito: deve stare in un SMS,
// in un messaggio, in un QR letto al volo — spesso chi approva è di fretta e
// non ha voglia di installare niente.
export function encodeTripVerdict({ tripId, state, note = '', reviewer = '' }) {
  if (!tripId) throw new Error('serve l identificativo della trasferta');
  if (!VERDICT_STATES.includes(state)) throw new Error('esito non valido');
  const slim = { v: 1, i: tripId, s: state, ...(note ? { n: String(note).slice(0, 200) } : {}), ...(reviewer ? { b: String(reviewer).slice(0, 40) } : {}), t: Date.now() };
  return TRIP_VERDICT_PREFIX + b64encode(JSON.stringify(slim));
}

export function extractTripVerdictPayload(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (s.startsWith(TRIP_VERDICT_PREFIX)) return s;
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch (_) { /* non URL-encoded */ }
  const m = decoded.match(/MTRIPV1:[A-Za-z0-9+/=_-]+/) || s.match(/MTRIPV1:[A-Za-z0-9+/=_%-]+/);
  if (m) { try { return decodeURIComponent(m[0]); } catch (_) { return m[0]; } }
  return null;
}

export function decodeTripVerdict(code) {
  try {
    const payload = extractTripVerdictPayload(code);
    const s = String(payload ?? code ?? '').trim();
    const body = s.startsWith(TRIP_VERDICT_PREFIX) ? s.slice(TRIP_VERDICT_PREFIX.length) : s;
    const g = JSON.parse(b64decode(body));
    if (!g || !g.i || !VERDICT_STATES.includes(g.s)) return null;
    return { tripId: g.i, state: g.s, note: g.n || '', reviewer: g.b || '', reviewedAt: +g.t || null };
  } catch (_) { return null; }
}

// Applica l'esito al viaggio (funzione pura: ritorna un nuovo oggetto).
// Un esito che riguarda un'ALTRA trasferta non viene mai applicato per errore:
// è il caso reale di chi incolla il codice sbagliato fra due trasferte aperte.
export function applyTripVerdict(trip, verdict) {
  if (!trip || !verdict) return trip;
  if (verdict.tripId !== trip.id) throw new Error('questo esito riguarda un altra trasferta');
  return { ...trip, approval: { state: verdict.state, note: verdict.note || '', reviewer: verdict.reviewer || '', reviewedAt: verdict.reviewedAt || Date.now() } };
}

// Segna la trasferta come "mandata in approvazione" (lato dipendente), così
// la schermata può dire "in attesa" invece di restare muta dopo aver
// condiviso il link — il silenzio dopo un invio è precisamente il momento in
// cui, su ogni prodotto concorrente, l'utente non sa più a che punto è.
export function markTripSentForReview(trip) {
  if (!trip) return trip;
  return { ...trip, approval: { state: 'inviata', note: '', reviewer: '', sentAt: Date.now() } };
}
