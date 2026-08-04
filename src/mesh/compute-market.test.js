import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAREABLE_WORKLOADS, NEVER_SHAREABLE, assertShareable,
  deviceCapability, makeWorkUnits, assignWork,
  resultHash, verifyResults, collectResults, planComputation,
} from './compute-market.js';

// Casualità deterministica: i test non devono dipendere da Math.random.
const seq = (valori) => { let i = 0; return () => valori[i++ % valori.length]; };

const peer = (peerId, cap) => ({ peerId, capability: cap });
const capace = (score) => ({ score, disponibile: true, motivi: [] });

// ── Il cancello: cosa non esce, esce mai ──

test('i carichi con dati personali non partono MAI, con un motivo esplicito', () => {
  for (const kind of Object.keys(NEVER_SHAREABLE)) {
    assert.throws(() => assertShareable(kind), /non si distribuisce mai/, `${kind} doveva essere rifiutato`);
  }
});

test('un carico sconosciuto viene rifiutato per prudenza, non accettato per default', () => {
  assert.throws(() => assertShareable('qualcosa-di-nuovo'), /non è nell'elenco/);
});

test('i carichi ammessi dichiarano il PERCHÉ sono ammessi', () => {
  for (const [kind, spec] of Object.entries(SHAREABLE_WORKLOADS)) {
    assert.ok(spec.perche && spec.perche.length > 20, `${kind} deve motivare perché è distribuibile`);
    assert.doesNotThrow(() => assertShareable(kind));
  }
});

test('planComputation rifiuta PRIMA di preparare qualunque cosa se il carico è personale', () => {
  assert.throws(
    () => planComputation({ kind: 'previsione-cassa', totalUnits: 100, peers: [peer('a', capace(8))] }),
    /non si distribuisce mai/
  );
});

// ── Capacità: dai segnali veri, senza fingere di sapere ──

test('un dispositivo a batteria sotto il 40% non viene usato', () => {
  const c = deviceCapability({ cores: 8, charging: false, batteryLevel: 0.3 });
  assert.equal(c.disponibile, false);
  assert.match(c.motivi[0], /sotto il 40/);
});

test('lo stesso dispositivo IN CARICA è pienamente utilizzabile e vale di più', () => {
  const scarico = deviceCapability({ cores: 8, charging: true, batteryLevel: 0.3 });
  const aBatteria = deviceCapability({ cores: 8, charging: false, batteryLevel: 0.9 });
  assert.equal(scarico.disponibile, true);
  assert.ok(scarico.score > aBatteria.score, 'in carica deve pesare di più');
});

test('un dispositivo caldo viene lasciato in pace', () => {
  const c = deviceCapability({ cores: 8, charging: true, thermalThrottled: true });
  assert.equal(c.disponibile, false);
  assert.match(c.motivi[0], /caldo/);
});

test('senza Battery API (Safari/iOS) si applica prudenza e lo si DICHIARA, non si finge', () => {
  const c = deviceCapability({ cores: 8, charging: null });
  assert.ok(c.disponibile);
  assert.ok(c.motivi.some((m) => /sconosciuto/.test(m)), `atteso un motivo esplicito, ricevuti: ${c.motivi}`);
  const noto = deviceCapability({ cores: 8, charging: true });
  assert.ok(c.score < noto.score, 'senza sapere lo stato si è più prudenti');
});

test('schermo spento riduce il peso: il dispositivo potrebbe sospendersi a metà lavoro', () => {
  const acceso = deviceCapability({ cores: 4, charging: true, screenOn: true });
  const spento = deviceCapability({ cores: 4, charging: true, screenOn: false });
  assert.ok(spento.score < acceso.score);
});

// ── Unità deterministiche ──

test('le unità di lavoro sono deterministiche: stesso carico, stessi semi', () => {
  const a = makeWorkUnits('montecarlo-strategie', 5);
  const b = makeWorkUnits('montecarlo-strategie', 5);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((u) => u.seed)).size, 5, 'i semi devono essere tutti diversi');
});

test('con meno di due dispositivi non si distribuisce: si calcola in casa e lo si dice', () => {
  const units = makeWorkUnits('backtest-storico', 10);
  const r = assignWork(units, [peer('solo', capace(8))]);
  assert.equal(r.locali.length, 10);
  assert.equal(r.assegnazioni.size, 0);
  assert.match(r.motivo, /calcolo locale/);
});

test('il lavoro va di più a chi può di più', () => {
  const units = makeWorkUnits('montecarlo-strategie', 100);
  const r = assignWork(units, [peer('forte', capace(16)), peer('debole', capace(2))], { verifyRatio: 0, randomFn: () => 0 });
  const forte = r.assegnazioni.get('forte').length;
  const debole = r.assegnazioni.get('debole').length;
  assert.ok(forte > debole * 2, `atteso molto più lavoro al forte: ${forte} vs ${debole}`);
  assert.equal(forte + debole, 100, 'nessuna unità deve andare persa');
});

test('un dispositivo non disponibile non riceve lavoro', () => {
  const units = makeWorkUnits('montecarlo-strategie', 20);
  const r = assignWork(units, [
    peer('ok1', capace(8)), peer('ok2', capace(8)),
    peer('scarico', { score: 0, disponibile: false, motivi: ['batteria'] }),
  ], { verifyRatio: 0, randomFn: () => 0 });
  assert.equal(r.assegnazioni.has('scarico'), false);
});

// ── Verifica: chi calcola per te non può mentirti ──

test('le unità di verifica vanno a DUE dispositivi diversi', () => {
  const units = makeWorkUnits('montecarlo-strategie', 20);
  const r = assignWork(units, [peer('a', capace(8)), peer('b', capace(8)), peer('c', capace(8))],
    { verifyRatio: 0.3, randomFn: seq([0.1, 0.5, 0.2, 0.9, 0.3, 0.4]) });
  assert.ok(r.verifiche.length > 0);
  for (const v of r.verifiche) assert.notEqual(v.peerA, v.peerB, 'la copia di controllo non può andare allo stesso dispositivo');
});

test('risultati identici: nessun sospetto, risultato affidabile', () => {
  const verifiche = [{ unit: { index: 3 }, peerA: 'a', peerB: 'b' }];
  const v = verifyResults(verifiche, { a: { 3: [1.5, 2.5] }, b: { 3: [1.5, 2.5] } });
  assert.equal(v.affidabile, true);
  assert.equal(v.concordi, 1);
  assert.deepEqual(v.sospetti, []);
});

test('UN PEER CHE MENTE viene individuato e il risultato è dichiarato NON affidabile', () => {
  const verifiche = [{ unit: { index: 3 }, peerA: 'onesto', peerB: 'bugiardo' }];
  const v = verifyResults(verifiche, { onesto: { 3: [1.5] }, bugiardo: { 3: [99999] } });
  assert.equal(v.affidabile, false);
  assert.equal(v.discordi, 1);
  assert.deepEqual(v.sospetti.map((s) => s.peerId).sort(), ['bugiardo', 'onesto']);
  assert.equal(v.daRicalcolare.length, 1, 'l\'unità in dubbio va ricalcolata, mai accettata');
});

test('differenze minime di arrotondamento NON contano come menzogna', () => {
  const verifiche = [{ unit: { index: 0 }, peerA: 'a', peerB: 'b' }];
  const v = verifyResults(verifiche, { a: { 0: [1.0000001] }, b: { 0: [1.0000002] } });
  assert.equal(v.affidabile, true, 'il rumore in virgola mobile non deve accusare nessuno');
});

test('un dispositivo che non risponde è un ritardatario, non un bugiardo', () => {
  const verifiche = [{ unit: { index: 1 }, peerA: 'a', peerB: 'muto' }];
  const v = verifyResults(verifiche, { a: { 1: [5] } });
  assert.deepEqual(v.sospetti, []);
  assert.equal(v.affidabile, true);
});

test('anche UNA sola verifica fallita basta a bloccare la consegna del risultato', () => {
  const verifiche = [
    { unit: { index: 0 }, peerA: 'a', peerB: 'b' },
    { unit: { index: 1 }, peerA: 'a', peerB: 'c' },
    { unit: { index: 2 }, peerA: 'b', peerB: 'c' },
  ];
  const v = verifyResults(verifiche, {
    a: { 0: [1], 1: [2] }, b: { 0: [1], 2: [3] }, c: { 1: [2], 2: [999] },
  });
  assert.equal(v.concordi, 2);
  assert.equal(v.affidabile, false);
});

test('resultHash è stabile e distingue risultati diversi', () => {
  assert.equal(resultHash([1, 2, 3]), resultHash([1, 2, 3]));
  assert.notEqual(resultHash([1, 2, 3]), resultHash([1, 2, 4]));
});

// ── Raccolta: mai riempire un buco con un numero inventato ──

test('le unità mancanti vengono elencate, mai riempite con zeri', () => {
  const units = makeWorkUnits('backtest-storico', 4);
  const c = collectResults(units, { a: { 0: [1], 2: [3] } });
  assert.equal(c.completo, false);
  assert.deepEqual(c.mancanti, [1, 3]);
  assert.equal(c.risultati[1], undefined, 'un buco resta un buco, non diventa zero');
});

test('con tutte le unità presenti il risultato è completo e ordinato per indice', () => {
  const units = makeWorkUnits('backtest-storico', 3);
  const c = collectResults(units, { a: { 0: 'x', 2: 'z' }, b: { 1: 'y' } });
  assert.equal(c.completo, true);
  assert.deepEqual(c.risultati, ['x', 'y', 'z']);
});

// ── Il piano, spiegabile a voce ──

test('il piano spiega in parole cosa succede e perché è lecito', () => {
  const p = planComputation({
    kind: 'montecarlo-strategie', totalUnits: 40,
    peers: [peer('tablet', capace(8)), peer('portatile', capace(16))],
    self: { cores: 4, charging: false, batteryLevel: 0.8 },
    randomFn: seq([0.1, 0.6, 0.3, 0.8]),
  });
  assert.equal(p.distribuito, true);
  assert.equal(p.partecipanti.length, 2);
  assert.match(p.spiegazione, /divis/);
  assert.match(p.spiegazione, /due volte/);
  assert.match(p.spiegazione, /Nessun dato personale/);
  assert.ok(!/hash|seed|shard|worker/i.test(p.spiegazione), `gergo nella spiegazione: ${p.spiegazione}`);
});

test('senza altri dispositivi il piano dice che si calcola qui, senza inventare partecipanti', () => {
  const p = planComputation({ kind: 'montecarlo-strategie', totalUnits: 10, peers: [], self: { cores: 4 } });
  assert.equal(p.distribuito, false);
  assert.equal(p.localiDaCalcolare.length, 10);
  assert.match(p.spiegazione, /Calcolo fatto qui/);
});

// Simulazione d'insieme: molti dispositivi sparsi, uno mente.
test('SIMULAZIONE: 12 dispositivi, uno mente — viene scoperto e il risultato non viene consegnato', () => {
  const peers = Array.from({ length: 12 }, (_, i) => peer(`d${i}`, capace(4 + (i % 5))));
  const units = makeWorkUnits('montecarlo-strategie', 240);
  const r = assignWork(units, peers, { verifyRatio: 0.25, randomFn: seq([0.05, 0.35, 0.65, 0.95, 0.15, 0.55]) });
  assert.ok(r.verifiche.length >= 40, `attese molte verifiche, trovate ${r.verifiche.length}`);

  // Tutti onesti tranne d7, che restituisce numeri inventati.
  const risultati = {};
  for (const [peerId, list] of r.assegnazioni) {
    risultati[peerId] = {};
    for (const u of list) risultati[peerId][u.index] = peerId === 'd7' ? [123456] : [u.seed % 1000];
  }
  const v = verifyResults(r.verifiche, risultati);
  const coinvolgeD7 = r.verifiche.some((x) => x.peerA === 'd7' || x.peerB === 'd7');
  if (coinvolgeD7) {
    assert.equal(v.affidabile, false, 'un bugiardo coinvolto in una verifica deve far scattare l\'allarme');
    assert.ok(v.sospetti.some((s) => s.peerId === 'd7'), 'd7 deve finire tra i sospetti');
  }
});
