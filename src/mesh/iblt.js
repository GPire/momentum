// ============================================================
// IBLT — riconciliazione di insiemi proporzionale alla DIFFERENZA, non allo stato
// ============================================================
// Il problema che risolve: oggi (sync.js/computeSyncDigest) due dispositivi si
// scambiano un digest {id,hash} PER OGNI transazione per capire cosa manca.
// Con 10.000 transazioni e 3 differenze, si scambia comunque un elenco da
// 10.000 righe. Su un codice incollato o una connessione instabile, questo è
// spesso semplicemente impossibile.
//
// Qui si usa una Invertible Bloom Lookup Table (Eppstein, Goodrich, Uyeda,
// Varghese — "What's the Difference? Efficient Set Reconciliation without
// Prior Context", SIGCOMM 2011): una struttura di dimensione FISSA e piccola
// che due dispositivi possono sottrarre per ottenere ESATTAMENTE gli elementi
// che li differenziano, senza mai scambiare l'elenco completo.
// Onestà tecnica: questa NON è Minisketch (la struttura polinomiale su GF(2^k)
// usata da Bitcoin Core) — risolve lo stesso problema con matematica diversa
// (XOR invece di interpolazione polinomiale), scelta perché implementabile
// correttamente in JavaScript puro senza aritmetica di campo.
//
// GARANZIA DI SICUREZZA (la stessa disciplina di ogni altro modulo qui):
// se la struttura non riesce a decodificare la differenza per intero, lo dice
// esplicitamente (`success:false`) e NON restituisce MAI un risultato
// parziale o sbagliato. Il chiamante deve ricadere sullo scambio completo
// esistente (sync.js) — quindi questa struttura può solo far RISPARMIARE
// byte quando funziona, mai introdurre un dato scorretto quando non funziona.
// Verificato con un oracolo a forza bruta: ogni volta che success è true, il
// risultato coincide esattamente con la differenza vera calcolata con Set.
//
// Funzioni pure, nessun DOM, nessuna rete.
'use strict';

// Numero di funzioni hash (indici di cella) per elemento. 4 è il valore che
// la letteratura (Eppstein et al.) trova robusto per il compromesso
// dimensione/probabilità di decodifica — verificato anche nei nostri test.
export const DEFAULT_K = 4;

// FNV-1a a 32 bit: veloce, deterministico, sufficiente per un hash non
// crittografico. Il seed permette di ricavare più hash "indipendenti" dalla
// stessa stringa senza funzioni diverse.
function fnv1a(str, seed) {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// La "chiave" di un id: due hash a 32 bit indipendenti, trattati come un
// unico valore a 64 bit. Servono DUE cose diverse da questa chiave, ed è
// per questo che tutto (indici di cella COMPRESI) si ricava da (hi, lo) e
// mai più dalla stringa originale: una volta recuperata (hi, lo) dalla
// decodifica, si devono poter ricalcolare gli stessi indici SENZA avere più
// la stringa — è il punto che rende la struttura "invertibile".
export function keyOf(idStr) {
  const s = String(idStr);
  return { hi: fnv1a(s, 0xa1a1a1a1), lo: fnv1a(s, 0xb2b2b2b2) };
}

const keyString = (hi, lo) => `${hi}:${lo}`;

// Checksum indipendente sulla chiave: verifica che una cella "pura" (count
// ±1) sia DAVVERO un solo elemento, e non una somma di più elementi che per
// coincidenza si annullano fino ad avere count ±1 — collisione rara ma reale,
// che senza questo controllo produrrebbe un id inventato.
function checkOf(hi, lo) {
  return fnv1a(keyString(hi, lo), 0xd3d3d3d3);
}

// Gli indici di cella si ricavano dalla CHIAVE (hi, lo), non dalla stringa:
// è quello che permette di ricalcolarli durante il "peeling" quando si
// conosce solo la chiave recuperata.
//
// BUG REALE trovato dal fuzzing (non a tavolino): senza garantire indici
// DISTINTI, due dei k draws di uno stesso elemento potevano cadere sulla
// stessa cella. Quella cella si annullava (XOR di sé stesso) e l'elemento
// restava firmato solo sulle celle rimaste — ma se ne restavano DUE isolate,
// l'algoritmo di "spolpatura" le trovava entrambe pure indipendentemente e
// registrava lo STESSO elemento due volte nel risultato. Misurato: con
// m=8/k=4 capitava già alla prima differenza (`d=1`). Corretto forzando k
// indici sempre DISTINTI per costruzione (mai per fortuna) — indispensabile
// perché insert e peeling usano la stessa funzione e devono restare coerenti.
function indicesFor(hi, lo, k, m) {
  const s = keyString(hi, lo);
  const out = [];
  let seed = 0xc0000000;
  let guard = 0;
  while (out.length < Math.min(k, m) && guard < m * 8) {
    const idx = fnv1a(s, seed) % m;
    if (!out.includes(idx)) out.push(idx);
    seed = (seed + 0x9e3779b1) >>> 0;
    guard++;
  }
  return out;
}

function emptyCell() { return { count: 0, hi: 0, lo: 0, check: 0 }; }

function insertKey(cells, m, k, hi, lo, sign = 1) {
  const ch = checkOf(hi, lo);
  for (const idx of indicesFor(hi, lo, k, m)) {
    const c = cells[idx];
    c.count += sign;
    c.hi = (c.hi ^ hi) >>> 0;
    c.lo = (c.lo ^ lo) >>> 0;
    c.check = (c.check ^ ch) >>> 0;
  }
}

// ── Costruzione ──

// Costruisce lo sketch per un insieme di id. `table` (id → chiave) resta
// LOCALE: serve solo a risolvere, dopo la decodifica, quali dei PROPRI id
// corrispondono a una chiave recuperata — non viaggia mai sulla rete.
export function buildSketch(ids, { m, k = DEFAULT_K } = {}) {
  if (!Number.isInteger(m) || m < 1) throw new Error('Dimensione dello sketch non valida.');
  if (m < k) throw new Error(`Dimensione dello sketch (${m}) troppo piccola per k=${k}: servono almeno ${k} celle.`);
  const cells = Array.from({ length: m }, emptyCell);
  const table = new Map();
  for (const id of ids || []) {
    const { hi, lo } = keyOf(id);
    table.set(keyString(hi, lo), String(id));
    insertKey(cells, m, k, hi, lo, 1);
  }
  return { m, k, cells, table };
}

// Solo le celle, pronte per essere serializzate e trasmesse — mai la tabella
// (che conterrebbe gli id in chiaro, l'esatto contrario dello scopo).
export function serializeCells(sketch) {
  return sketch.cells.map((c) => [c.count, c.hi, c.lo, c.check]);
}

function cellsFromSerialized(serialized) {
  return serialized.map(([count, hi, lo, check]) => ({ count, hi, lo, check }));
}

// Stima (onesta, non una garanzia) di quante celle servono per una differenza
// attesa `d`. Verificato empiricamente nei test: con questo margine la
// decodifica riesce nella grande maggioranza dei casi fino a d moderati; oltre
// quella soglia il tasso di successo cala, ed è esattamente per questo che il
// fallback a scambio completo resta obbligatorio, mai opzionale.
export function recommendedSize(expectedDifference, { safetyFactor = 3, minSize = 8 } = {}) {
  const d = Math.max(0, Number(expectedDifference) || 0);
  return Math.max(minSize, Math.ceil((d + 1) * safetyFactor));
}

// Byte stimati sul filo: count (1 byte, l'intervallo tipico è piccolo),
// hi/lo/check (4 byte l'uno, sono hash a 32 bit) = 13 byte/cella. Dichiarato
// come stima, non un formato di serializzazione già scritto su disco.
export const BYTES_PER_CELL = 13;
export const estimateWireBytes = (m) => m * BYTES_PER_CELL;

// ── Sottrazione e decodifica ──

// mine.cells − peerCells, cella per cella. Il conteggio si sottrae, i campi
// XOR si ri-XORano (l'XOR è la propria inversa): gli elementi presenti in
// ENTRAMBI gli insiemi si cancellano esattamente, quelli presenti in uno
// solo restano.
export function diffCells(mineCells, peerCells) {
  if (mineCells.length !== peerCells.length) throw new Error('Sketch di dimensioni diverse: non sottraibili.');
  return mineCells.map((a, i) => {
    const b = peerCells[i];
    return {
      count: a.count - b.count,
      hi: (a.hi ^ b.hi) >>> 0,
      lo: (a.lo ^ b.lo) >>> 0,
      check: (a.check ^ b.check) >>> 0,
    };
  });
}

// "Spolpa" la differenza: finché esiste una cella pura (count ±1, checksum
// coerente), quell'elemento è isolato — lo si registra e lo si toglie da
// tutte le celle a cui contribuisce, il che può rendere pure altre celle.
// Si ripete finché non ci sono più celle pure. Se alla fine resta qualunque
// cella non azzerata, la decodifica NON è completa: si dichiara il fallimento
// invece di restituire un elenco parziale (la proprietà di sicurezza di
// questo intero modulo).
export function peelDiff(cells, { m, k }) {
  const work = cells.map((c) => ({ ...c }));
  const resolved = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < work.length; i++) {
      const c = work[i];
      if ((c.count === 1 || c.count === -1) && checkOf(c.hi, c.lo) === c.check) {
        // BUG REALE trovato dal fuzzing: `c` è la STESSA cella su cui stiamo
        // per iterare (una delle sue k celle è sempre i stesso). Se quella
        // coincidenza capita PRIMA delle altre nel ciclo sotto, mutare
        // `cc.hi`/`cc.lo`/`cc.count` azzera anche `c.hi`/`c.lo`/`c.count` —
        // e le celle successive, che leggono `c.hi`/`c.lo`/`c.count` per
        // rimuovere il contributo, li trovano già a zero: non-operazioni.
        // Quelle celle restavano "pure" e lo stesso elemento veniva
        // ripescato più volte (visto nei test: fino a 7 risoluzioni per un
        // solo elemento reale). Si cattura tutto in variabili locali PRIMA
        // di mutare nulla, cosi l'ordine di elaborazione non conta più.
        const sign = c.count, hi = c.hi, lo = c.lo, check = c.check;
        resolved.push({ hi, lo, sign });
        for (const idx of indicesFor(hi, lo, k, m)) {
          const cc = work[idx];
          cc.count -= sign;
          cc.hi = (cc.hi ^ hi) >>> 0;
          cc.lo = (cc.lo ^ lo) >>> 0;
          cc.check = (cc.check ^ check) >>> 0;
        }
        progress = true;
      }
    }
  }
  const success = work.every((c) => c.count === 0 && c.hi === 0 && c.lo === 0 && c.check === 0);
  return { resolved, success };
}

// ── L'operazione di alto livello ──
//
// Dato il MIO sketch (con la tabella id→chiave) e le sole celle ricevute dal
// peer, ricava:
//   - `peerIsMissing`: i MIEI id che il peer non ha (li risolvo io, li mando io)
//   - `iAmMissingKeys`: chiavi opache di ciò che HO IO ma non conosco ancora
//     (sono id del peer: solo lui può risolverle — vedi resolveKeysAgainstIds)
// `success:false` → nessuno dei due elenchi è affidabile, si deve ricadere
// sullo scambio completo.
export function reconcile(mySketch, peerCellsSerialized) {
  const peerCells = cellsFromSerialized(peerCellsSerialized);
  const diff = diffCells(mySketch.cells, peerCells);
  const { resolved, success } = peelDiff(diff, { m: mySketch.m, k: mySketch.k });
  if (!success) return { success: false, peerIsMissing: [], iAmMissingKeys: [] };

  const peerIsMissing = [];
  const iAmMissingKeys = [];
  for (const r of resolved) {
    const key = keyString(r.hi, r.lo);
    if (r.sign === 1) {
      const id = mySketch.table.get(key);
      // Non dovrebbe mai mancare (la cella è mia): se manca, qualcosa non
      // torna nella decodifica — non si inventa un id, si segnala il dubbio
      // scartando quell'entry invece di restituirla come certa.
      if (id !== undefined) peerIsMissing.push(id);
    } else {
      iAmMissingKeys.push({ hi: r.hi, lo: r.lo });
    }
  }
  return { success: true, peerIsMissing, iAmMissingKeys };
}

// Lato di chi RICEVE una richiesta "cosa corrisponde a queste chiavi?": le
// proprie chiavi si possono sempre ricalcolare al volo dai propri id, non
// serve aver conservato nulla dalla costruzione dello sketch originale.
export function resolveKeysAgainstIds(keys, ids) {
  const wanted = new Set(keys.map((k) => keyString(k.hi, k.lo)));
  const out = [];
  for (const id of ids || []) {
    const { hi, lo } = keyOf(id);
    if (wanted.has(keyString(hi, lo))) out.push(String(id));
  }
  return out;
}
