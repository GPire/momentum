'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaCanaleAFrame, INTESTAZIONE, MAX_MESSAGGIO } from './frame-stream.js';

// Scheduler deterministico: i timer scattano solo quando il test lo decide.
function orologio() {
  let id = 0; const timer = new Map();
  return {
    scheduleFn: (fn, ms) => { const h = ++id; timer.set(h, { fn, ms }); return h; },
    cancelFn: (h) => timer.delete(h),
    scatta() { const t = [...timer.entries()]; timer.clear(); for (const [, { fn }] of t) fn(); },
    pendenti: () => timer.size,
  };
}

// Due canali collegati da un "etere" che può perdere/riordinare/duplicare frame.
function coppia({ mtu = 23, perdi = () => false, duplica = () => false } = {}) {
  const o = orologio();
  const codaAB = [], codaBA = [];
  const a = creaCanaleAFrame({ mtu, inviaFrame: (f) => codaAB.push(f), ...o, timeoutAckMs: 100, tentativiMax: 3 });
  const b = creaCanaleAFrame({ mtu, inviaFrame: (f) => codaBA.push(f), ...o, timeoutAckMs: 100, tentativiMax: 3 });
  function consegna() {
    let mosso = false;
    while (codaAB.length || codaBA.length) {
      mosso = true;
      if (codaAB.length) { const f = codaAB.shift(); if (!perdi(f)) { b.ricevi(f); if (duplica(f)) b.ricevi(f); } }
      if (codaBA.length) { const f = codaBA.shift(); if (!perdi(f)) { a.ricevi(f); if (duplica(f)) a.ricevi(f); } }
    }
    return mosso;
  }
  return { a, b, o, consegna, codaAB, codaBA };
}

test('un messaggio più grande di un frame arriva intero e in ordine, e viene confermato', async () => {
  const { a, b, consegna } = coppia({ mtu: 23 }); // payloadMax = 15 byte
  const ricevuti = [];
  b.onmessage = (e) => ricevuti.push(e.data);
  const testo = 'x'.repeat(200) + 'FINE';
  const p = a.send(testo);
  consegna();
  assert.deepEqual(ricevuti, [testo]);
  assert.equal(await p, true);
  assert.equal(a.inSospeso(), 0);
  assert.equal(a.bufferedAmount, 0);
});

test('frame persi vengono ritrasmessi dal primo non confermato, mai tutto da capo', async () => {
  let persi = 0;
  const { a, b, o, consegna } = coppia({ mtu: 23, perdi: (f) => (f[4] & 2) === 0 && f[3] === 5 && persi++ === 0 });
  const ricevuti = [];
  b.onmessage = (e) => ricevuti.push(e.data);
  const testo = 'abcdefghij'.repeat(30); // 300 byte → 20 frame
  const p = a.send(testo);
  consegna();
  assert.deepEqual(ricevuti, []);  // manca il frame 5: niente consegna parziale
  o.scatta(); consegna();          // timeout → ritrasmissione da 5 in poi
  assert.deepEqual(ricevuti, [testo]);
  assert.equal(await p, true);
});

test('frame duplicati e in ordine sparso non corrompono il messaggio', () => {
  const { a, b, consegna } = coppia({ mtu: 23, duplica: () => true });
  const ricevuti = [];
  b.onmessage = (e) => ricevuti.push(e.data);
  a.send('duplicati ovunque ma un solo messaggio');
  consegna();
  assert.deepEqual(ricevuti, ['duplicati ovunque ma un solo messaggio']);
});

test('se l\'altro tace, dopo i tentativi massimi arriva un errore con motivo, non un\'attesa infinita', async () => {
  const { a, o } = coppia({ mtu: 23, perdi: () => true });
  const errori = [];
  a.onerror = (e) => errori.push(e.message);
  const p = a.send('nessuno mi sente');
  for (let i = 0; i < 5; i++) o.scatta();
  await assert.rejects(p, /non risponde/);
  assert.equal(errori.length, 1);
  assert.equal(a.inSospeso(), 0);
});

test('messaggi oltre il limite del trasporto sono rifiutati subito con l\'alternativa indicata', () => {
  const { a } = coppia();
  assert.throws(() => a.send('z'.repeat(MAX_MESSAGGIO + 1)), /hotspot/);
});

test('più messaggi in volo restano distinti (msgId) e un messaggio vuoto è un frame valido', () => {
  const { a, b, consegna } = coppia({ mtu: 23 });
  const ricevuti = [];
  b.onmessage = (e) => ricevuti.push(e.data);
  a.send('primo'); a.send(''); a.send('terzo');
  consegna();
  assert.deepEqual(ricevuti, ['primo', '', 'terzo']);
});

test('interfaccia compatibile con RTCDataChannel: readyState, close, onclose, frame corto rifiutato', () => {
  const { a } = coppia();
  assert.equal(a.readyState, 'open');
  assert.equal(a.ricevi(new Uint8Array(INTESTAZIONE - 1)).ok, false);
  let chiuso = false; a.onclose = () => { chiuso = true; };
  a.close();
  assert.equal(a.readyState, 'closed');
  assert.equal(chiuso, true);
  assert.throws(() => a.send('x'), /chiuso/);
});
