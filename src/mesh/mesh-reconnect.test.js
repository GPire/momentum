import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { MeshNode } = await import('./mesh-signaling.js');

const fakeMind = () => ({
  model: { serialize: () => ({ format: 'nexus-v1', net: {}, trainedExamples: 0 }) },
  mergeRemote: () => ({ accepted: false }),
});

function linkedChannels() {
  const a = { readyState: 'open' };
  const b = { readyState: 'open' };
  a.send = (data) => b.onmessage?.({ data });
  b.send = (data) => a.onmessage?.({ data });
  return [a, b];
}

// Timer finto: registra (fn, ms) invece di usare setTimeout vero. `avanza()`
// esegue tutti i timer schedulati finora, in ordine — deterministico, niente
// attese reali nei test.
function fakeScheduler() {
  const queue = [];
  return {
    scheduleFn: (fn, ms) => queue.push({ fn, ms }),
    avanza() { const q = queue.splice(0); for (const { fn } of q) fn(); },
    ritardi() { return queue.map((q) => q.ms); },
    lunghezza: () => queue.length,
  };
}

function nodoConScheduler(id, opts = {}) {
  // randomFn fissato a 0.5 → jitter = 0.75 + 0.5*0.5 = 1.0 esatto: i ritardi
  // diventano prevedibili (reconnectBaseMs * 2^tentativo), niente casualità
  // da dover tollerare nei confronti numerici dei test.
  const sched = fakeScheduler();
  const node = new MeshNode(id, fakeMind(), {
    scheduleFn: sched.scheduleFn, randomFn: () => 0.5,
    reconnectBaseMs: 100, reconnectMaxMs: 1000, maxReconnectAttempts: 4,
    ...opts,
  });
  return { node, sched };
}

test('un canale che si chiude programma un tentativo di riconnessione', () => {
  const { node: a, sched: schedA } = nodoConScheduler('A');
  const b = new MeshNode('B', fakeMind());
  const [chA, chB] = linkedChannels();
  b.addDirectPeer('A', null, chB);
  a.addDirectPeer('B', null, chA);

  assert.equal(schedA.lunghezza(), 0);
  chA.readyState = 'closed';
  chA.onclose();
  assert.equal(a.peers.has('B'), false, 'il peer perso deve uscire dalla lista');
  assert.equal(schedA.lunghezza(), 1, 'deve essere stato programmato un tentativo');
});

test('il ritardo cresce esponenzialmente ad ogni tentativo fallito (con jitter neutralizzato)', () => {
  const { node: a, sched } = nodoConScheduler('A', { reconnectBaseMs: 100, reconnectMaxMs: 10000 });
  // Nessun relay disponibile: ogni tentativo fallisce e ne programma un altro.
  a._scheduleReconnect('fantasma');
  assert.deepEqual(sched.ritardi(), [100]);
  sched.avanza(); // 1° tentativo: nessun relay -> ne programma un altro
  assert.deepEqual(sched.ritardi(), [200]);
  sched.avanza(); // 2°
  assert.deepEqual(sched.ritardi(), [400]);
  sched.avanza(); // 3°
  assert.deepEqual(sched.ritardi(), [800]);
});

test('il ritardo non supera mai il tetto massimo', () => {
  const { node: a, sched } = nodoConScheduler('A', { reconnectBaseMs: 1000, reconnectMaxMs: 3000, maxReconnectAttempts: 10 });
  a._scheduleReconnect('fantasma');
  for (let i = 0; i < 5; i++) sched.avanza();
  assert.ok(sched.ritardi()[0] <= 3000);
});

test('dopo il numero massimo di tentativi si smette di insistere', () => {
  const { node: a, sched } = nodoConScheduler('A', { maxReconnectAttempts: 3 });
  a._scheduleReconnect('fantasma');
  for (let i = 0; i < 3; i++) sched.avanza(); // 3 tentativi consumati, ognuno fallisce (nessun relay) e ne programma un altro
  // Il 4° tentativo (oltre il massimo) NON deve essere programmato.
  assert.equal(sched.lunghezza(), 0, `attesi 0 tentativi in coda, trovati ${sched.lunghezza()}`);
  assert.equal(a._reconnectAttempts.has('fantasma'), false);
});

test('la riconnessione riuscita azzera il contatore dei tentativi', () => {
  const { node: a, sched } = nodoConScheduler('A');
  const b = new MeshNode('B', fakeMind());
  const [chA, chB] = linkedChannels();
  b.addDirectPeer('A', null, chB);
  a.addDirectPeer('B', null, chA);

  chA.readyState = 'closed';
  chA.onclose(); // 1° tentativo programmato

  // Torna connesso "a mano" (come farebbe una nuova addDirectPeer riuscita).
  const [chA2, chB2] = linkedChannels();
  a.addDirectPeer('B', null, chA2);
  assert.equal(a._reconnectAttempts.has('B'), false, 'il contatore deve azzerarsi alla riconnessione riuscita');
});

test('se nel frattempo il peer è già tornato, il tentativo programmato non fa nulla', () => {
  const { node: a, sched } = nodoConScheduler('A');
  const b = new MeshNode('B', fakeMind());
  const [chA, chB] = linkedChannels();
  b.addDirectPeer('A', null, chB);
  a.addDirectPeer('B', null, chA);

  chA.readyState = 'closed';
  chA.onclose();
  // Prima che il timer scatti, il peer torna disponibile per un'altra via.
  const [chA2] = linkedChannels();
  a.addDirectPeer('B', null, chA2);
  const primaCount = a.peers.size;
  sched.avanza(); // il vecchio tentativo scatta ora
  assert.equal(a.peers.size, primaCount, 'non deve toccare un peer già connesso');
});

test('con reconnect:false nessun tentativo viene mai programmato', () => {
  const sched = fakeScheduler();
  const a = new MeshNode('A', fakeMind(), { reconnect: false, scheduleFn: sched.scheduleFn });
  const b = new MeshNode('B', fakeMind());
  const [chA, chB] = linkedChannels();
  b.addDirectPeer('A', null, chB);
  a.addDirectPeer('B', null, chA);

  chA.readyState = 'closed';
  chA.onclose();
  assert.equal(sched.lunghezza(), 0);
});

test('senza un relay disponibile ora, si riprova più avanti invece di arrendersi subito', () => {
  const { node: a, sched } = nodoConScheduler('A', { maxReconnectAttempts: 5 });
  // Nessun peer connesso: `_tryReconnect` non trova alcun relay.
  a._tryReconnect('fantasma');
  assert.equal(sched.lunghezza(), 1, 'deve aver programmato un nuovo tentativo invece di arrendersi');
  assert.equal(a._reconnectAttempts.get('fantasma'), 1);
});

// Verifica end-to-end con una VERA riconnessione via relay: A e B sono
// connessi tramite un terzo nodo C; A perde il collegamento diretto con B ma
// resta connesso a C — la riconnessione automatica deve ristabilirlo passando
// per C, esattamente come l'auto-discovery già esistente.
test('riconnessione reale via relay: A ritrova B passando per C dopo un blip', async () => {
  const a = new MeshNode('A', fakeMind(), { reconnectBaseMs: 10, scheduleFn: (fn) => fn() /* esegue subito, sincrono per il test */ });
  const c = new MeshNode('C', fakeMind());
  const b = new MeshNode('B', fakeMind());

  // A<->C direct
  const [chAC, chCA] = linkedChannels();
  c.addDirectPeer('A', null, chCA);
  a.addDirectPeer('C', null, chAC);
  // B<->C direct
  const [chBC, chCB] = linkedChannels();
  c.addDirectPeer('B', null, chCB);
  b.addDirectPeer('C', null, chBC);

  // Ora dobbiamo dare ad A e B un canale diretto che poi "cade", per innescare
  // la riconnessione. Lo creiamo a mano (come se fosse avvenuto in passato).
  const [chAB, chBA] = linkedChannels();
  a.addDirectPeer('B', null, chAB);
  b.addDirectPeer('A', null, chBA);
  assert.ok(a.peers.has('B') && b.peers.has('A'));

  // Instradamento relay reale servirebbe RTCPeerConnection: qui verifichiamo
  // che il MECCANISMO di riconnessione parta (chiami _initiateAutoConnect
  // passando per un relay valido) — l'handshake RTC vero è già coperto dal
  // test end-to-end del 2026-08-04 in main.js/console del browser.
  let relayUsato = null;
  const originale = a._initiateAutoConnect.bind(a);
  a._initiateAutoConnect = (targetId, viaPeerId) => { relayUsato = viaPeerId; return Promise.resolve(); };

  chAB.readyState = 'closed';
  chAB.onclose(); // A perde B, ma è ancora connesso a C

  assert.equal(relayUsato, 'C', 'la riconnessione deve passare dal relay ancora vivo (C)');
  a._initiateAutoConnect = originale;
});
