import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initReliabilityState, recordComputeOutcome, deliveryHistory, typicalTime,
  deliveryOdds, expectedValue, rankByExpectedDelivery, stragglerDeadline,
  unitsToReassign, computeStatusText, FINESTRA, SOGLIA_CONSEGNA,
} from './compute-reliability.js';
import { assignWork, makeWorkUnits, planComputation } from './compute-market.js';

const capace = (score) => ({ score, disponibile: true, motivi: [] });
// Un peer "in condizioni ideali": in carica, schermo acceso, online da un po'.
// Così i test sulla STORIA non vengono sporcati dai segnali di adesso.
const ideale = (peerId, score) => ({
  peerId, capability: capace(score), minutiOnline: 30,
  signals: { charging: true, screenOn: true, batteryLevel: 0.9 },
});

const conStoria = (peerId, esiti, tempi = []) => {
  let s = initReliabilityState();
  for (const ok of esiti) s = recordComputeOutcome(s, peerId, { consegnato: ok, ms: 3000 });
  for (const ms of tempi) s = recordComputeOutcome(s, peerId, { consegnato: true, ms });
  return s;
};

// ── La storia ──

test('un dispositivo nuovo parte a metà strada: né promosso né escluso', () => {
  const h = deliveryHistory(initReliabilityState(), 'mai-visto');
  assert.equal(h.tasso, 0.5);
  assert.equal(h.giudicabile, false, 'zero osservazioni non sono un giudizio');
  assert.equal(h.totali, 0);
});

test('la storia si aggiorna e resta dichiarata come stimata finché è poca', () => {
  const s = conStoria('a', [true, true, false, true]);
  const h = deliveryHistory(s, 'a');
  assert.equal(h.consegne, 3);
  assert.equal(h.totali, 4);
  assert.equal(h.giudicabile, false, 'con 4 osservazioni non si giudica ancora');
  assert.ok(h.tasso > 0.5 && h.tasso < 0.75, `lisciato verso il centro, non 0.75 secco: ${h.tasso}`);
  assert.equal(deliveryHistory(conStoria('a', Array(6).fill(true)), 'a').giudicabile, true);
});

test('la finestra non cresce all\'infinito: conta il comportamento recente', () => {
  const s = conStoria('a', Array(FINESTRA + 20).fill(true));
  assert.equal(deliveryHistory(s, 'a').totali, FINESTRA);
});

test('chi ha smesso di consegnare non resta buono per sempre', () => {
  // 50 consegne buone, poi 50 fallimenti: la finestra ha già scordato le buone.
  const s = conStoria('a', [...Array(FINESTRA).fill(true), ...Array(FINESTRA).fill(false)]);
  assert.ok(deliveryHistory(s, 'a').tasso < 0.1, 'la finestra deve far dimenticare il passato lontano');
});

test('il tempo tipico è la MEDIANA: un episodio lentissimo non allarga l\'attesa per tutti', () => {
  const s = conStoria('a', [], [3000, 3200, 3100, 120000]);
  const t = typicalTime(s, 'a');
  assert.equal(t.misurato, true);
  assert.ok(t.ms <= 3200, `una media sarebbe stata ~32s: ${t.ms}`);
  assert.equal(typicalTime(initReliabilityState(), 'nuovo').misurato, false, 'senza misure va dichiarato');
});

// ── La previsione ──

test('un dispositivo non disponibile ha probabilità zero e lo dice a parole', () => {
  const o = deliveryOdds(initReliabilityState(), {
    peerId: 'x', capability: { score: 16, disponibile: false, motivi: ['a batteria, sotto il 40%'] },
  });
  assert.equal(o.p, 0);
  assert.match(o.motivo, /batteria/);
});

test('le condizioni di ADESSO possono affossare una storia perfetta', () => {
  const s = conStoria('a', Array(20).fill(true));
  const pieno = deliveryOdds(s, ideale('a', 8));
  const scarico = deliveryOdds(s, {
    peerId: 'a', capability: capace(8), minutiOnline: 30,
    signals: { charging: false, screenOn: false, batteryLevel: 0.45 },
  });
  assert.ok(pieno.p > 0.85, `storia perfetta e condizioni buone: ${pieno.p}`);
  assert.ok(scarico.p < pieno.p * 0.6, `stesso dispositivo, condizioni pessime: ${scarico.p} vs ${pieno.p}`);
  assert.match(scarico.motivo, /batteria bassa/);
  assert.match(scarico.motivo, /schermo spento/);
});

test('chi si è appena collegato vale meno di chi è lì da mezz\'ora', () => {
  const s = initReliabilityState();
  const appena = deliveryOdds(s, { ...ideale('a', 8), minutiOnline: 0 });
  const stabile = deliveryOdds(s, { ...ideale('a', 8), minutiOnline: 30 });
  assert.ok(appena.p < stabile.p, `${appena.p} deve essere < ${stabile.p}`);
  // Ma pesa poco: non deve decidere da solo.
  assert.ok(appena.p > stabile.p * 0.7, 'il tempo online non deve dominare la previsione');
});

test('IL PUNTO DEL MODULO: il portatile modesto in carica batte il telefono veloce che sparisce', () => {
  // 2 consegne su 14: non abbastanza per essere escluso (resta sopra la
  // soglia), abbastanza per valere meno di un dispositivo la metà potente.
  const s = conStoria('telefono-veloce', [true, true, ...Array(12).fill(false)]);
  const peers = [
    { ...ideale('telefono-veloce', 16) },
    { ...ideale('portatile-modesto', 8) },
  ];
  const r = rankByExpectedDelivery(s, peers);
  assert.equal(r.ordine[0].peerId, 'portatile-modesto', 'a potenza grezza avrebbe vinto il telefono');
  assert.equal(r.cambiaQualcosa, true, 'e il modulo deve poter dichiarare che ha cambiato la scelta');
  const ev = expectedValue(s, peers[0]);
  assert.ok(ev.valore < ev.score, 'il valore atteso deve stare sotto la potenza grezza');
});

// ── Le scadenze ──

test('la scadenza nasce dalla mediana misurata, non da una costante', () => {
  const lento = conStoria('lento', [], [9000, 9000, 9000]);
  const a = stragglerDeadline(lento, 'lento', { unita: 1, now: 0 });
  const b = stragglerDeadline(initReliabilityState(), 'ignoto', { unita: 1, now: 0 });
  assert.ok(a.attesaMs > b.attesaMs, 'un lento affidabile merita più tempo di uno sconosciuto');
  assert.equal(a.misurato, true);
  assert.match(a.motivo, /di solito risponde in 9s/);
  assert.match(b.motivo, /non ho ancora misurato/);
});

test('più unità gli hai dato, più tempo gli lasci', () => {
  const s = conStoria('a', [], [2000]);
  const una = stragglerDeadline(s, 'a', { unita: 1, now: 0 });
  const dieci = stragglerDeadline(s, 'a', { unita: 10, now: 0 });
  assert.equal(dieci.attesaMs, una.attesaMs * 10);
});

test('si riassegna solo ciò che è davvero scaduto', () => {
  const inFlight = [
    { unit: { index: 0 }, peerId: 'a', scadeA: 1000 },
    { unit: { index: 1 }, peerId: 'b', scadeA: 9000 },
    { unit: { index: 2 }, peerId: 'c', scadeA: null },
  ];
  const r = unitsToReassign(inFlight, { now: 5000 });
  assert.deepEqual(r.map((x) => x.peerId), ['a']);
  assert.equal(r[0].ritardoMs, 4000);
  assert.equal(unitsToReassign(inFlight, { now: 0 }).length, 0);
});

test('quello che legge l\'utente non contiene gergo da sistemi distribuiti', () => {
  const t = computeStatusText({ totali: 10, tornate: 6, riassegnate: 1 });
  assert.match(t, /60%/);
  assert.match(t, /si è disconnesso/);
  assert.ok(!/straggler|shard|worker|peer|nodo/i.test(t), `gergo nel testo: ${t}`);
  assert.equal(computeStatusText({ totali: 10, tornate: 10, riassegnate: 0 }), 'Calcolo finito.');
  assert.equal(computeStatusText({ totali: 0, tornate: 0, riassegnate: 0 }), null);
});

// ── L'innesto in assignWork: è qui che la previsione cambia il comportamento ──

test('senza stato di affidabilità il comportamento storico resta identico', () => {
  const units = makeWorkUnits('montecarlo-strategie', 20);
  const peers = [ideale('forte', 16), ideale('debole', 4)];
  const r = assignWork(units, peers, { verifyRatio: 0 });
  assert.ok(r.assegnazioni.get('forte').length > r.assegnazioni.get('debole').length);
  assert.equal(r.scadenze.size, 0, 'senza storia non si inventano scadenze');
  assert.equal(r.previsioni.length, 0);
});

test('con lo stato, le unità seguono chi consegna — non chi è potente', () => {
  const units = makeWorkUnits('montecarlo-strategie', 40);
  const peers = [ideale('potente-inaffidabile', 16), ideale('modesto-a', 5), ideale('modesto-b', 5)];
  let s = initReliabilityState();
  for (let i = 0; i < 12; i++) {
    s = recordComputeOutcome(s, 'potente-inaffidabile', { consegnato: false });
    s = recordComputeOutcome(s, 'modesto-a', { consegnato: true, ms: 4000 });
    s = recordComputeOutcome(s, 'modesto-b', { consegnato: true, ms: 4000 });
  }
  const senza = assignWork(units, peers, { verifyRatio: 0 });
  const con = assignWork(units, peers, { verifyRatio: 0, reliability: s, now: 0 });

  assert.ok(senza.assegnazioni.get('potente-inaffidabile').length >= 23,
    'la vecchia regola dava la fetta più grossa a chi non consegna');
  assert.equal(con.assegnazioni.has('potente-inaffidabile'), false,
    `sotto la soglia di ${SOGLIA_CONSEGNA} non si dà lavoro`);
  assert.deepEqual(con.esclusi, ['potente-inaffidabile']);
  assert.equal(con.assegnazioni.get('modesto-a').length + con.assegnazioni.get('modesto-b').length, 40,
    'nessuna unità persa per strada: quelle tolte al potente vanno agli altri');
  // E deve saper dire perché ha scelto così.
  const p = con.previsioni.find((x) => x.peerId === 'potente-inaffidabile');
  assert.ok(p && p.probabilita < SOGLIA_CONSEGNA && p.potenza === 16, 'la previsione va esposta, non nascosta');
});

test('nessuna unità va in volo senza una scadenza da cui riassegnarla', () => {
  const units = makeWorkUnits('montecarlo-strategie', 30);
  const s = conStoria('a', Array(10).fill(true), [3000]);
  const plan = planComputation({
    kind: 'montecarlo-strategie', totalUnits: 30,
    peers: [ideale('a', 8), ideale('b', 8)],
    self: { cores: 4 }, verifyRatio: 0, reliability: s, now: 1000,
  });
  assert.equal(plan.inFlight.length, units.length);
  for (const u of plan.inFlight) {
    assert.ok(u.scadeA > 1000, `unità ${u.unit.index} senza scadenza: resterebbe appesa per sempre`);
  }
  // E la scadenza deve poter scattare: nessuna unità tornata → tutte da riassegnare.
  const tardi = Math.max(...plan.inFlight.map((u) => u.scadeA)) + 1;
  assert.equal(unitsToReassign(plan.inFlight, { now: tardi }).length, units.length);
});

test('se nessuno è una buona scommessa si calcola in casa, dicendolo', () => {
  let s = initReliabilityState();
  for (let i = 0; i < 15; i++) {
    s = recordComputeOutcome(s, 'a', { consegnato: false });
    s = recordComputeOutcome(s, 'b', { consegnato: false });
  }
  const r = assignWork(makeWorkUnits('montecarlo-strategie', 10), [ideale('a', 8), ideale('b', 8)],
    { reliability: s, now: 0 });
  assert.equal(r.locali.length, 10);
  assert.match(r.motivo, /aspettarsi davvero un risultato/);
});
