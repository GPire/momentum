import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSketch, serializeCells, diffCells, peelDiff, reconcile,
  resolveKeysAgainstIds, recommendedSize, estimateWireBytes, keyOf, DEFAULT_K,
} from './iblt.js';

// Generatore deterministico: i test non devono dipendere da Math.random().
function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function randomIds(n, rnd, prefix = 'tx') {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}-${Math.floor(rnd() * 1e9)}`);
}

// L'oracolo: la verità calcolata con un Set, indipendente dallo sketch.
function bruteForceDiff(mine, peer) {
  const peerSet = new Set(peer);
  const mineSet = new Set(mine);
  return {
    peerIsMissing: mine.filter((x) => !peerSet.has(x)).sort(),
    iAmMissing: peer.filter((x) => !mineSet.has(x)).sort(),
  };
}

function twoWayReconcile(mineIds, peerIds, m) {
  const mySketch = buildSketch(mineIds, { m });
  const peerSketch = buildSketch(peerIds, { m });
  const r = reconcile(mySketch, serializeCells(peerSketch));
  if (!r.success) return { success: false };
  // Le chiavi che "io" non so risolvere le risolve il peer sui SUOI id reali —
  // esattamente il giro che farebbe la rete (una piccola richiesta, mai
  // l'elenco intero).
  const iAmMissing = resolveKeysAgainstIds(r.iAmMissingKeys, peerIds).sort();
  return { success: true, peerIsMissing: [...r.peerIsMissing].sort(), iAmMissing };
}

// ── Correttezza: quando riesce, il risultato è SEMPRE esatto ──

test('nessuna differenza: sketch identici, nulla da scambiare', () => {
  const ids = randomIds(200, seeded(1));
  const r = twoWayReconcile(ids, [...ids], recommendedSize(0));
  assert.equal(r.success, true);
  assert.deepEqual(r.peerIsMissing, []);
  assert.deepEqual(r.iAmMissing, []);
});

test('una sola differenza da un lato', () => {
  const base = randomIds(500, seeded(2));
  const mine = [...base, 'extra-mio'];
  const r = twoWayReconcile(mine, base, recommendedSize(1));
  assert.equal(r.success, true);
  assert.deepEqual(r.peerIsMissing, ['extra-mio']);
  assert.deepEqual(r.iAmMissing, []);
});

test('differenze su entrambi i lati insieme', () => {
  const base = randomIds(300, seeded(3));
  const mine = [...base.slice(1), 'solo-mio-A', 'solo-mio-B'];
  const peer = [...base.slice(1), 'solo-peer-A'];
  // differenza reale: 2 solo mie + 1 solo del peer + l'elemento tolto a entrambi = base[0] è mancante SOLO al confronto (non è né mio né suo, quindi non conta)
  const oracolo = bruteForceDiff(mine, peer);
  const r = twoWayReconcile(mine, peer, recommendedSize(oracolo.peerIsMissing.length + oracolo.iAmMissing.length));
  assert.equal(r.success, true);
  assert.deepEqual(r.peerIsMissing, oracolo.peerIsMissing);
  assert.deepEqual(r.iAmMissing, oracolo.iAmMissing);
});

// Il test più importante del modulo: su MOLTE combinazioni casuali di
// dimensione e differenza, ogni volta che la decodifica dichiara successo,
// il risultato deve coincidere ESATTAMENTE con l'oracolo a forza bruta. Zero
// eccezioni ammesse — è la proprietà di sicurezza dell'intera struttura.
test('fuzzing esteso: quando success è true, il risultato è SEMPRE esatto (zero eccezioni)', () => {
  const rnd = seeded(42);
  let successi = 0, tentativi = 0;
  const taglie = [50, 200, 1000, 5000];
  for (const n of taglie) {
    for (const d of [0, 1, 2, 3, 5, 10]) {
      for (let trial = 0; trial < 5; trial++) {
        tentativi++;
        const base = randomIds(n, rnd, `n${n}t${trial}`);
        const soloMie = randomIds(Math.ceil(d / 2), rnd, `mia${trial}`);
        const soloPeer = randomIds(Math.floor(d / 2), rnd, `peer${trial}`);
        const mine = [...base, ...soloMie];
        const peer = [...base, ...soloPeer];
        const oracolo = bruteForceDiff(mine, peer);
        const r = twoWayReconcile(mine, peer, recommendedSize(d));
        if (r.success) {
          successi++;
          assert.deepEqual(r.peerIsMissing, oracolo.peerIsMissing, `n=${n} d=${d} trial=${trial}: peerIsMissing sbagliato`);
          assert.deepEqual(r.iAmMissing, oracolo.iAmMissing, `n=${n} d=${d} trial=${trial}: iAmMissing sbagliato`);
        }
      }
    }
  }
  // Alla dimensione consigliata, la stragrande maggioranza deve riuscire —
  // altrimenti la struttura non avrebbe senso pratico.
  assert.ok(successi / tentativi >= 0.85, `tasso di successo troppo basso: ${successi}/${tentativi}`);
});

// ── Sicurezza: quando NON riesce, non mente mai ──

test('sketch troppo piccolo per la differenza reale: fallimento dichiarato, mai un risultato parziale', () => {
  const rnd = seeded(7);
  const base = randomIds(500, rnd);
  const soloMie = randomIds(40, rnd, 'mia');
  const soloPeer = randomIds(40, rnd, 'peer');
  const mine = [...base, ...soloMie];
  const peer = [...base, ...soloPeer];
  // Dimensione ridicolmente piccola per una differenza di 80 elementi.
  const r = twoWayReconcile(mine, peer, 8);
  assert.equal(r.success, false);
  // Nessun elenco parziale silenzioso: quando fallisce, reconcile() da sola
  // (senza passare dal round-trip a due vie) restituisce liste vuote.
  const mySketch = buildSketch(mine, { m: 8 });
  const peerSketch = buildSketch(peer, { m: 8 });
  const direct = reconcile(mySketch, serializeCells(peerSketch));
  assert.equal(direct.success, false);
  assert.deepEqual(direct.peerIsMissing, []);
  assert.deepEqual(direct.iAmMissingKeys, []);
});

test('fallback: quando lo sketch fallisce, lo scambio completo esistente resta comunque corretto', async () => {
  const { computeSyncDigest, transactionsMissingFromPeer } = await import('./sync.js');
  const rnd = seeded(9);
  const base = Array.from({ length: 300 }, (_, i) => ({ id: `b${i}`, hash: `h${i}`, date: '2026-01-01' }));
  const extra = Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, hash: `hx${i}`, date: '2026-02-01' }));
  const mineTx = { '2026-01': base, '2026-02': extra };
  const peerTx = { '2026-01': base };

  // Lo sketch, sottodimensionato apposta, fallisce.
  const mineIds = [...base, ...extra].map((t) => t.id);
  const peerIds = base.map((t) => t.id);
  const sketchResult = twoWayReconcile(mineIds, peerIds, 8);
  assert.equal(sketchResult.success, false);

  // Il fallback (il meccanismo di OGGI, già in produzione) trova comunque
  // esattamente i 60 elementi mancanti: la degradazione non perde correttezza.
  const peerDigest = computeSyncDigest(peerTx);
  const missing = transactionsMissingFromPeer(mineTx, peerDigest);
  assert.equal(missing['2026-02'].length, 60);
});

// ── Dimensione e stima dei byte: il numero che il piano promette di misurare ──

test('recommendedSize cresce con la differenza attesa e non scende mai sotto il minimo', () => {
  assert.ok(recommendedSize(0) >= 8);
  assert.ok(recommendedSize(10) > recommendedSize(1));
  assert.ok(recommendedSize(100) > recommendedSize(10));
});

test('MISURA REALE: byte scambiati, digest completo contro sketch, a tre scale', async () => {
  const { computeSyncDigest } = await import('./sync.js');
  const enc = new TextEncoder();
  const risultati = [];
  for (const n of [100, 1000, 10000]) {
    const ids = Array.from({ length: n }, (_, i) => `tx-2026-${i}`);
    const tx = { '2026-01': ids.map((id) => ({ id, hash: `h${id}abcdef0123456789` })) };
    const digestJson = JSON.stringify(computeSyncDigest(tx));
    const naiveBytes = enc.encode(digestJson).length;

    const d = 3; // la differenza tipica citata nel piano
    const m = recommendedSize(d);
    const ibltBytes = estimateWireBytes(m);

    risultati.push({ n, naiveBytes, ibltBytes, riduzionePct: +(100 * (1 - ibltBytes / naiveBytes)).toFixed(1) });
  }
  // eslint-disable-next-line no-console
  console.log('[iblt] byte scambiati, digest completo vs sketch (differenza=3):', JSON.stringify(risultati));

  // A 10.000 transazioni con una differenza di 3, lo sketch deve pesare una
  // frazione minima del digest completo — è la promessa concreta del piano.
  const grande = risultati.find((r) => r.n === 10000);
  assert.ok(grande.ibltBytes < grande.naiveBytes * 0.05, `atteso <5%, misurato ${grande.riduzionePct}% di riduzione`);
  // A 100 transazioni il vantaggio è meno drammatico ma deve esserci comunque.
  const piccola = risultati.find((r) => r.n === 100);
  assert.ok(piccola.ibltBytes < piccola.naiveBytes);
});

// ── Unità più fini, per capire un fallimento se mai si ripresentasse ──

test('diffCells di due sketch identici è tutto a zero (si annulla per intero)', () => {
  const ids = randomIds(50, seeded(11));
  const a = buildSketch(ids, { m: 32 });
  const b = buildSketch([...ids], { m: 32 });
  const d = diffCells(a.cells, serializeCellsAsObjects(b));
  assert.ok(d.every((c) => c.count === 0 && c.hi === 0 && c.lo === 0 && c.check === 0));
});
function serializeCellsAsObjects(sketch) { return sketch.cells; }

test('sketch di dimensioni diverse non si possono sottrarre', () => {
  const a = buildSketch(['a', 'b'], { m: 16 });
  const b = buildSketch(['a', 'b'], { m: 32 });
  assert.throws(() => diffCells(a.cells, b.cells), /dimensioni diverse/);
});

test('peelDiff su celle già tutte a zero restituisce successo e nessun elemento', () => {
  const cells = Array.from({ length: 16 }, () => ({ count: 0, hi: 0, lo: 0, check: 0 }));
  const r = peelDiff(cells, { m: 16, k: DEFAULT_K });
  assert.equal(r.success, true);
  assert.deepEqual(r.resolved, []);
});

test('resolveKeysAgainstIds trova solo le corrispondenze vere', () => {
  const ids = ['alpha', 'beta', 'gamma'];
  const keys = [keyOf('beta'), keyOf('non-esiste')];
  const found = resolveKeysAgainstIds(keys, ids);
  assert.deepEqual(found, ['beta']);
});

test('keyOf è deterministico e distingue id diversi', () => {
  assert.deepEqual(keyOf('stessa-stringa'), keyOf('stessa-stringa'));
  const a = keyOf('id-1'), b = keyOf('id-2');
  assert.ok(a.hi !== b.hi || a.lo !== b.lo);
});

test('un insieme vuoto produce uno sketch valido e vuoto', () => {
  const s = buildSketch([], { m: 16 });
  assert.equal(s.table.size, 0);
  assert.ok(s.cells.every((c) => c.count === 0));
  const r = reconcile(s, serializeCells(buildSketch([], { m: 16 })));
  assert.equal(r.success, true);
  assert.deepEqual(r.peerIsMissing, []);
});

// Regressione diretta del bug trovato dal fuzzing: uno sketch minuscolo (m
// vicino a k) è il caso in cui gli indici di un elemento collidono più
// facilmente. Ogni elemento risolto deve comparire ESATTAMENTE una volta.
test('REGRESSIONE — nessun elemento viene mai recuperato più di una volta, anche con sketch minuscoli', () => {
  const rnd = seeded(99);
  for (let m = DEFAULT_K; m <= 12; m++) {
    for (let trial = 0; trial < 20; trial++) {
      const base = randomIds(30, rnd, `m${m}t${trial}`);
      const mine = [...base, `unico-${m}-${trial}`];
      const mySketch = buildSketch(mine, { m });
      const peerSketch = buildSketch(base, { m });
      const r = reconcile(mySketch, serializeCells(peerSketch));
      if (!r.success) continue; // il fallimento dichiarato è accettabile, mai un duplicato
      const conteggio = r.peerIsMissing.filter((x) => x === `unico-${m}-${trial}`).length;
      assert.ok(conteggio <= 1, `m=${m} trial=${trial}: l'elemento è comparso ${conteggio} volte`);
    }
  }
});

test('uno sketch più piccolo di k celle viene rifiutato subito, non produce indici incoerenti', () => {
  assert.throws(() => buildSketch(['a'], { m: 2, k: DEFAULT_K }), /troppo piccola/);
});

test('dimensione dello sketch non valida viene rifiutata subito', () => {
  assert.throws(() => buildSketch(['a'], { m: 0 }), /non valida/);
  assert.throws(() => buildSketch(['a'], { m: -3 }), /non valida/);
});
