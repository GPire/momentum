import test from 'node:test';
import assert from 'node:assert/strict';
const { computeSyncDigest, transactionsMissingFromPeer, mergeTransactions, reconcileHead, planSync } = await import('./sync.js');

const tx = (id, date, amount, hash) => ({ id, date, amount, category: 'spesa', description: 'x', hash: hash || 'h' + id, prevHash: 'p' + id });

test('digest: compatto, solo id+hash per mese', () => {
  const d = computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] });
  assert.equal(d['2026-07'].length, 2);
  assert.deepEqual(d['2026-07'][0], { id: 1, hash: 'h1' });
});

test('missing: invia solo ciò che il peer non ha', () => {
  const mine = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20), tx(3, '2026-07-03', 30)] };
  const peerDigest = computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10)] });
  const toSend = transactionsMissingFromPeer(mine, peerDigest);
  assert.equal(toSend['2026-07'].length, 2); // 2 e 3
});

test('merge: unione per id, non tocca le esistenti (hash chain intatta)', () => {
  const local = { '2026-07': [tx(1, '2026-07-01', 10, 'HASH1')] };
  const incoming = { '2026-07': [tx(1, '2026-07-01', 999, 'DIVERSO'), tx(2, '2026-07-02', 20)] };
  const { merged, added, skipped } = mergeTransactions(local, incoming);
  assert.equal(added, 1);   // solo la 2
  assert.equal(skipped, 1); // la 1 già presente
  const t1 = merged['2026-07'].find(t => t.id === 1);
  assert.equal(t1.amount, 10);      // NON sovrascritto
  assert.equal(t1.hash, 'HASH1');   // hash chain intatta
});

test('merge order-independent (CRDT-like): A∪B == B∪A', () => {
  const A = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] };
  const B = { '2026-07': [tx(2, '2026-07-02', 20), tx(3, '2026-07-03', 30)] };
  const ab = mergeTransactions(A, B).merged['2026-07'].map(t => t.id).sort();
  const ba = mergeTransactions(B, A).merged['2026-07'].map(t => t.id).sort();
  assert.deepEqual(ab, ba);
  assert.deepEqual(ab, [1, 2, 3]);
});

test('recupero da perdita: merge da vuoto = ripristino completo', () => {
  const remote = { '2026-06': [tx(1, '2026-06-01', 10)], '2026-07': [tx(2, '2026-07-01', 20)] };
  const { merged, added } = mergeTransactions({}, remote);
  assert.equal(added, 2);
  assert.equal(merged['2026-06'].length, 1);
  assert.equal(merged['2026-07'].length, 1);
});

test('reconcileHead: lastHash = hash della tx più recente', () => {
  const merged = { '2026-07': [tx(1, '2026-07-01', 10, 'OLD'), tx(2, '2026-07-20', 20, 'NEW')] };
  assert.equal(reconcileHead(merged), 'NEW');
});

test('planSync: mostra il costo del delta', () => {
  const mine = { '2026-07': [tx(1, '2026-07-01', 10), tx(2, '2026-07-02', 20)] };
  const p = planSync(mine, computeSyncDigest({ '2026-07': [tx(1, '2026-07-01', 10)] }));
  assert.equal(p.count, 1);
  assert.ok(/solo le differenze/.test(p.note));
});

// Integrazione con VaultDAO.applySyncMerge (shim minimo del vault)
test('VaultDAO.applySyncMerge: unisce e riallinea la testa senza toccare le esistenti', async () => {
  globalThis.window = globalThis.window || {}; globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
  const { VaultDAO } = await import('../core/vault.js');
  VaultDAO.state.transactions = { '2026-07': [tx(1, '2026-07-01', 10, 'H1')] };
  VaultDAO.state.lastHash = 'H1';
  VaultDAO.save = () => {}; // no-op in test
  const added = VaultDAO.applySyncMerge({ '2026-07': [tx(1, '2026-07-01', 999, 'X'), tx(2, '2026-07-20', 20, 'H2')] });
  assert.equal(added, 1);
  assert.equal(VaultDAO.state.transactions['2026-07'].find(t => t.id === 1).amount, 10); // intatta
  assert.equal(VaultDAO.state.lastHash, 'H2'); // testa riallineata alla più recente
});

test('SYNC mesh: N dispositivi (10/20/30) convergono — commutativo, idempotente, senza duplicati', () => {
  const dev = (d, k) => { const bm = {}; for (let i = 0; i < k; i++) { const mo = `2026-0${1 + (i % 6)}`; (bm[mo] = bm[mo] || []).push(tx(`d${d}_${i}`, `${mo}-1${i % 9}`, (i + 1) * 3)); } return bm; };
  for (const N of [10, 20, 30]) {
    const devices = Array.from({ length: N }, (_, d) => dev(d, 4)); // N*4 tx totali
    let a = {}; for (const x of devices) a = mergeTransactions(a, x).merged;
    let b = {}; for (const x of devices.slice().reverse()) b = mergeTransactions(b, x).merged;
    for (const x of devices) a = mergeTransactions(a, x).merged; // re-merge → idempotente
    const flatA = Object.values(a).flat(), flatB = Object.values(b).flat();
    assert.equal(flatA.length, N * 4, `N=${N}: tutte le tx unite`);
    assert.equal(flatA.length, flatB.length, `N=${N}: convergenza ordine-indipendente`);
    assert.equal(new Set(flatA.map(t => t.id)).size, flatA.length, `N=${N}: nessun duplicato`);
  }
});

// ── CANCELLAZIONI CHE NON TORNANO INDIETRO ───────────────────────────────────
// Il bug era questo: cancelli una spesa sul telefono, il tablet ce l'ha ancora,
// al sync te la rimanda e la spesa RISORGE. Su un'app di soldi e' grave: uno
// cancella un doppione e se lo ritrova il giorno dopo.
const { markDeleted, pruneTombstones, tombstonesFromDigest } = await import('./sync.js');

const txDi = (id) => ({ id, amount: 10 + id, category: 'spesa', date: '2026-08-01', hash: `h${id}`, prevHash: `p${id}` });
const idsDi = (d, mese = '2026-08') => (d.tx[mese] || []).map(t => t.id).sort((a, b) => a - b).join(',');
// Un giro di sincronizzazione reale: a riceve da b cio' che gli manca.
function sincronizza(a, b) {
  const inviato = transactionsMissingFromPeer(b.tx, computeSyncDigest(a.tx, a.tomb), b.tomb);
  const r = mergeTransactions(a.tx, inviato, a.tomb);
  a.tx = r.merged; a.tomb = r.tombstones;
  return r;
}

test('SYNC: una spesa cancellata non torna indietro dall\'altro dispositivo', () => {
  const telefono = { tx: { '2026-08': [txDi(1), txDi(2), txDi(3)] }, tomb: {} };
  const tablet = { tx: { '2026-08': [txDi(1), txDi(2), txDi(3)] }, tomb: {} };
  telefono.tx['2026-08'] = telefono.tx['2026-08'].filter(t => t.id !== 2);
  telefono.tomb = markDeleted(telefono.tomb, 2);
  sincronizza(telefono, tablet);
  assert.equal(idsDi(telefono), '1,3', 'la spesa cancellata e\' tornata sul telefono');
});

test('SYNC: la cancellazione raggiunge anche l\'altro dispositivo', () => {
  const telefono = { tx: { '2026-08': [txDi(1), txDi(3)] }, tomb: markDeleted({}, 2) };
  const tablet = { tx: { '2026-08': [txDi(1), txDi(2), txDi(3)] }, tomb: {} };
  sincronizza(tablet, telefono);
  assert.equal(idsDi(tablet), '1,3', 'il tablet deve applicare la cancellazione ricevuta');
  assert.ok('2' in tablet.tomb, 'e ricordarla, per non riproporla a un terzo dispositivo');
});

test('SYNC: un dispositivo NUOVO non riceve mai le spese cancellate', () => {
  const telefono = { tx: { '2026-08': [txDi(1), txDi(3)] }, tomb: markDeleted({}, 2) };
  const portatile = { tx: {}, tomb: {} };
  sincronizza(portatile, telefono);
  assert.equal(idsDi(portatile), '1,3');
});

test('SYNC: converge comunque, in qualunque ordine si sincronizzino tre dispositivi', () => {
  const base = () => ({ tx: { '2026-08': [txDi(1), txDi(2), txDi(3), txDi(4)] }, tomb: {} });
  const ordini = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0]];
  for (const ordine of ordini) {
    const d = [base(), base(), base()];
    // ognuno cancella una spesa diversa, offline
    d[0].tx['2026-08'] = d[0].tx['2026-08'].filter(t => t.id !== 2); d[0].tomb = markDeleted(d[0].tomb, 2);
    d[1].tx['2026-08'] = d[1].tx['2026-08'].filter(t => t.id !== 3); d[1].tomb = markDeleted(d[1].tomb, 3);
    // poi si sincronizzano tutti con tutti, nell'ordine dato
    for (let giro = 0; giro < 3; giro++) for (const i of ordine) for (let j = 0; j < 3; j++) if (i !== j) sincronizza(d[i], d[j]);
    const risultati = d.map(x => idsDi(x));
    assert.equal(risultati[0], '1,4', `ordine ${ordine}: atteso 1,4 — ottenuto ${risultati[0]}`);
    assert.ok(risultati.every(r => r === risultati[0]), `ordine ${ordine}: i dispositivi divergono (${risultati.join(' | ')})`);
  }
});

test('SYNC: le spese nuove continuano ad arrivare (la lapide non blocca il resto)', () => {
  const telefono = { tx: { '2026-08': [txDi(1)] }, tomb: markDeleted({}, 2) };
  const tablet = { tx: { '2026-08': [txDi(1), txDi(2), txDi(5)] }, tomb: {} };
  sincronizza(telefono, tablet);
  assert.equal(idsDi(telefono), '1,5', 'la 5 deve arrivare, la 2 no');
});

test('SYNC: i dispositivi con la versione precedente restano compatibili', () => {
  // Un dispositivo non aggiornato manda un digest SENZA cancellazioni: non
  // deve rompere niente, e le sue spese devono comunque arrivare.
  const vecchioDigest = computeSyncDigest({ '2026-08': [txDi(1)] }); // nessuna lapide
  assert.deepEqual(tombstonesFromDigest(vecchioDigest), {});
  const daMandare = transactionsMissingFromPeer({ '2026-08': [txDi(1), txDi(7)] }, vecchioDigest, markDeleted({}, 9));
  assert.equal(daMandare['2026-08'].length, 1, 'gli si manda solo la 7');
  assert.ok(daMandare.__deleted, 'e anche la cancellazione che non conosce');
  const r = mergeTransactions({ '2026-08': [txDi(1)] }, { '2026-08': [txDi(7)] });
  assert.equal(r.merged['2026-08'].length, 2, 'un merge senza lapidi funziona come prima');
});

test('SYNC: le lapidi vecchie si potano, quelle recenti restano', () => {
  const ora = Date.UTC(2026, 7, 3);
  const tomb = { vecchia: ora - 400 * 86400000, recente: ora - 10 * 86400000 };
  const potate = pruneTombstones(tomb, 365, ora);
  assert.deepEqual(Object.keys(potate), ['recente']);
});

test('SYNC: planSync dice anche quante cancellazioni viaggiano', () => {
  const piano = planSync({ '2026-08': [txDi(1)] }, computeSyncDigest({}), markDeleted({}, 2));
  assert.equal(piano.count, 1);
  assert.equal(piano.deletions, 1);
  assert.match(piano.note, /1 transazioni e 1 cancellazioni/);
});

test('SYNC: N dispositivi (2-12) convergono tutti allo stesso stato, in ordine casuale', () => {
  // Non tre dispositivi per finta: da due a dodici, ognuno che aggiunge e
  // cancella spese mentre e' scollegato, poi tutti si sincronizzano con tutti
  // in un ordine diverso a ogni giro (e' cosi' che si comporta una rete vera,
  // dove nessuno decide chi parla per primo).
  const rnd = (() => { let a = 20260803; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  for (let n = 2; n <= 12; n++) {
    const comuni = [txDi(1), txDi(2), txDi(3), txDi(4), txDi(5)];
    const disp = Array.from({ length: n }, () => ({ tx: { '2026-08': comuni.map(t => ({ ...t })) }, tomb: {} }));
    // ognuno, offline, aggiunge una spesa sua e cancella una di quelle comuni
    disp.forEach((d, i) => {
      d.tx['2026-08'].push(txDi(100 + i));
      const daCancellare = 1 + (i % 5);
      d.tx['2026-08'] = d.tx['2026-08'].filter(t => t.id !== daCancellare);
      d.tomb = markDeleted(d.tomb, daCancellare);
    });
    // gossip: coppie in ordine casuale, abbastanza giri perche' l'informazione
    // faccia il giro completo della rete
    const giri = Math.max(4, n);
    for (let g = 0; g < giri; g++) {
      const coppie = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) coppie.push([i, j]);
      for (let k = coppie.length - 1; k > 0; k--) { const q = Math.floor(rnd() * (k + 1)); [coppie[k], coppie[q]] = [coppie[q], coppie[k]]; }
      for (const [i, j] of coppie) sincronizza(disp[i], disp[j]);
    }
    const stati = disp.map(d => idsDi(d));
    assert.ok(stati.every(x => x === stati[0]), `con ${n} dispositivi non convergono: ${stati.join(' | ')}`);
    // Le cancellate non devono esserci in nessuno; le aggiunte devono esserci in tutti.
    const cancellate = new Set(disp.flatMap(d => Object.keys(d.tomb).map(Number)));
    for (const d of disp) {
      for (const c of cancellate) assert.ok(!d.tx['2026-08'].some(t => t.id === c), `${n} dispositivi: la spesa ${c} e' risorta`);
      for (let i = 0; i < n; i++) assert.ok(d.tx['2026-08'].some(t => t.id === 100 + i), `${n} dispositivi: manca la spesa aggiunta dal dispositivo ${i}`);
    }
  }
});
