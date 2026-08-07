import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNat, predictDirect, adviseChannel, directTimeoutMs,
  parseCandidate, gatherObservations, probeNetwork, STUN_POOL,
} from './nat-probe.js';

const srflx = (server, ip, port) => ({ server, ip, port, type: 'srflx', protocol: 'udp' });
const host = (server, ip, port) => ({ server, ip, port, type: 'host', protocol: 'udp' });

// ── Lettura delle candidate ICE ──

test('legge ip, porta e tipo da una candidate reale', () => {
  const c = parseCandidate('candidate:842163049 1 udp 1677729535 93.184.216.34 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0');
  assert.deepEqual(c, { protocol: 'udp', ip: '93.184.216.34', port: 54321, type: 'srflx' });
});

test('legge anche le candidate locali e quelle IPv6', () => {
  const h = parseCandidate('candidate:1 1 udp 2122260223 192.168.1.14 49152 typ host generation 0');
  assert.equal(h.type, 'host');
  assert.equal(h.ip, '192.168.1.14');
  const v6 = parseCandidate('candidate:2 1 udp 2122194687 2a01:cb00:1::1 49153 typ host generation 0');
  assert.equal(v6.ip, '2a01:cb00:1::1');
});

test('una riga che non è una candidate non produce un dato inventato', () => {
  assert.equal(parseCandidate('roba a caso'), null);
  assert.equal(parseCandidate(''), null);
  assert.equal(parseCandidate(null), null);
});

// ── Classificazione della rete ──

test('nessuna risposta STUN: rete che blocca, e lo dice', () => {
  const n = classifyNat([], { serversQueried: 3 });
  assert.equal(n.kind, 'bloccato');
  assert.equal(n.mappings, 0);
});

test('solo candidate locali (nessuna pubblica) vale come bloccato', () => {
  const n = classifyNat([host('a', '192.168.1.14', 49152)], { serversQueried: 3 });
  assert.equal(n.kind, 'bloccato');
});

test('indirizzo pubblico diretto: nessun NAT', () => {
  const n = classifyNat([
    host('a', '93.184.216.34', 49152),
    srflx('a', '93.184.216.34', 49152),
  ], { serversQueried: 3 });
  assert.equal(n.kind, 'aperto');
});

test('una sola mappatura con piu server interrogati: rete prevedibile', () => {
  const n = classifyNat([
    host('a', 'abc123.local', 49152),
    srflx('a', '93.184.216.34', 54321),
    srflx('a', '93.184.216.34', 54321),
  ], { serversQueried: 3 });
  assert.equal(n.kind, 'prevedibile');
  assert.equal(n.mappings, 1);
});

test('piu mappature pubbliche distinte: rete variabile, il diretto non partira', () => {
  const n = classifyNat([
    srflx('a', '93.184.216.34', 54321),
    srflx('a', '93.184.216.34', 61002),
  ], { serversQueried: 3 });
  assert.equal(n.kind, 'variabile');
  assert.equal(n.mappings, 2);
});

test('anche un indirizzo pubblico che cambia (piu uscite) e variabile', () => {
  const n = classifyNat([
    srflx('a', '100.64.10.1', 54321),
    srflx('a', '100.64.10.9', 54321),
  ], { serversQueried: 3 });
  assert.equal(n.kind, 'variabile');
});

// Il caso che conta di piu: NON dichiarare una diagnosi che non si puo fare.
test('un solo server interrogato non basta: incerto, mai una diagnosi inventata', () => {
  const n = classifyNat([srflx('a', '93.184.216.34', 54321)], { serversQueried: 1 });
  assert.equal(n.kind, 'incerto');
  assert.match(n.reason, /un solo server/);
});

test('senza sapere quanti server sono stati interrogati non si conclude nulla', () => {
  const n = classifyNat([srflx('a', '93.184.216.34', 54321)]);
  assert.equal(n.kind, 'incerto');
});

// Questo test boccia la PRIMA versione della sonda, sbagliata: interrogava ogni
// server con una connessione separata, quindi vedeva porte diverse (socket
// diversi) e dichiarava "variabile" anche su reti perfettamente buone.
// Misurato dal vivo il 2026-08-04: 27258 / 27260 / 27261 su una rete che il
// metodo corretto classifica come prevedibile.
test('porte consecutive da socket diversi NON devono essere lette come rete variabile', () => {
  const daUnaSolaConnessione = classifyNat([
    host('a', 'xyz.local', 49152),
    srflx('a', '109.55.84.191', 27248),
  ], { serversQueried: 3 });
  assert.equal(daUnaSolaConnessione.kind, 'prevedibile',
    'con una connessione sola e piu server, una mappatura unica significa rete buona');
});

test('osservazioni malformate vengono ignorate senza far crollare la diagnosi', () => {
  const n = classifyNat([
    null,
    { type: 'srflx' },
    { ip: '1.2.3.4', port: 'boh', type: 'srflx' },
    srflx('a', '93.184.216.34', 54321),
  ], { serversQueried: 2 });
  assert.equal(n.kind, 'prevedibile');
});

// ── Previsione e consiglio ──

test('due reti variabili insieme sono il caso peggiore', () => {
  const v = { kind: 'variabile' };
  assert.ok(predictDirect(v, v) < 0.05);
  assert.ok(predictDirect({ kind: 'prevedibile' }, { kind: 'prevedibile' }) > 0.7);
});

test('la previsione resta sempre tra 0 e 1, anche con input strani', () => {
  for (const k of ['aperto', 'prevedibile', 'incerto', 'variabile', 'bloccato', 'boh', undefined]) {
    const p = predictDirect({ kind: k }, { kind: k });
    assert.ok(p >= 0 && p <= 1, `${k} → ${p}`);
  }
});

// CORRETTO IL 2026-08-07. Questo test pretendeva il ripiego appena la PROPRIA
// rete era "variabile", e codificava un errore di fatto: un NAT simmetrico si
// collega benissimo a uno normale, perché il lato non ristretto impara la
// mappatura dal primo pacchetto. Fallisce solo simmetrico CONTRO simmetrico.
// Rinunciare da soli significava dirottare sul ripiego anche circa un quarto
// delle coppie, che avrebbero funzionato.
test('rete variabile DA SOLA: si prova comunque, dipende da chi c\'è dall\'altra parte', () => {
  const a = adviseChannel({ kind: 'variabile' });
  assert.equal(a.prefer, 'direct');
  assert.match(a.detail, /capricciose/);
});

test('rete variabile CONTRO un\'altra variabile: qui sì, si passa al piano B', () => {
  const a = adviseChannel({ kind: 'variabile' }, { kind: 'variabile' });
  assert.equal(a.prefer, 'paste');
  assert.match(a.headline, /non riescono a parlarsi/);
  assert.match(a.detail, /rete del telefono/);
});

test('rete variabile contro una normale: collegamento diretto, non ripiego', () => {
  for (const altro of ['aperto', 'prevedibile']) {
    assert.equal(adviseChannel({ kind: 'variabile' }, { kind: altro }).prefer, 'direct', altro);
  }
});

test('rete bloccata: dice dove succede, senza far sentire l utente in difetto', () => {
  const a = adviseChannel({ kind: 'bloccato' });
  assert.match(a.detail, /Non è un problema tuo/);
});

test('rete buona: si prova il diretto', () => {
  assert.equal(adviseChannel({ kind: 'prevedibile' }).prefer, 'direct');
  assert.equal(adviseChannel({ kind: 'aperto' }).prefer, 'direct');
  assert.equal(adviseChannel({ kind: 'incerto' }).prefer, 'direct');
});

test('se il piano B non è disponibile non viene proposto', () => {
  // Serve un caso in cui si ripiega davvero: due reti variabili.
  const a = adviseChannel({ kind: 'variabile' }, { kind: 'variabile' }, { paste: false });
  assert.equal(a.prefer, 'link');
});

test('nessun testo contiene gergo tecnico', () => {
  for (const k of ['aperto', 'prevedibile', 'incerto', 'variabile', 'bloccato']) {
    const a = adviseChannel({ kind: k });
    const txt = `${a.headline} ${a.detail}`;
    assert.ok(!/NAT|STUN|TURN|WebRTC|ICE|simmetric|srflx|UDP/i.test(txt), `${k}: ${txt}`);
  }
});

// L'attesa deve accorciarsi quando non c'è speranza: è la differenza tra
// un'app che sembra rotta e una che cambia strada da sola.
test('su una rete persa non si aspetta: si cambia subito canale', () => {
  assert.equal(directTimeoutMs({ kind: 'bloccato' }), 0);
  // Due variabili insieme: è l'unico caso senza speranza in diretta.
  assert.ok(directTimeoutMs({ kind: 'variabile' }, { kind: 'variabile' }) <= 3000);
  assert.ok(directTimeoutMs({ kind: 'prevedibile' }) >= 12000);
  // Una variabile da sola merita un'attesa media: vale la pena provare, ma
  // senza far aspettare come su una rete buona.
  const solo = directTimeoutMs({ kind: 'variabile' });
  assert.ok(solo > 3000 && solo < 12000, `attesa ${solo}ms`);
});

// ── Raccolta: nessuna rete vera nei test ──

// Una sola connessione con tutti i server: il finto verifica anche CHE i
// server siano passati come voci separate, perche' e' quello che fa la
// differenza tra interrogarli tutti e fermarsi al primo.
function fakePC(candidates, spy = {}) {
  return class FakePC {
    constructor(config) {
      spy.iceServers = config.iceServers;
      this.onicecandidate = null;
    }
    createDataChannel() { return {}; }
    async createOffer() { return { type: 'offer', sdp: '' }; }
    async setLocalDescription() {
      queueMicrotask(() => {
        for (const c of candidates) this.onicecandidate?.({ candidate: { candidate: c } });
        this.onicecandidate?.({ candidate: null });
      });
    }
    close() { this.closed = true; }
  };
}

test('i server vengono passati come voci separate, non come un unico elenco', async () => {
  const spy = {};
  const PC = fakePC(['candidate:1 1 udp 1 9.9.9.9 5000 typ srflx'], spy);
  await gatherObservations({ servers: ['stun:a', 'stun:b', 'stun:c'], PeerConnection: PC });
  assert.equal(spy.iceServers.length, 3, 'tre voci separate, non una sola con tre url');
  assert.deepEqual(spy.iceServers.map((s) => s.urls), ['stun:a', 'stun:b', 'stun:c']);
});

test('raccolta: una sola mappatura pubblica su tre server interrogati', async () => {
  const PC = fakePC([
    'candidate:1 1 udp 1 abc.local 49152 typ host',
    'candidate:2 1 udp 1 93.184.216.34 5000 typ srflx',
  ]);
  const obs = await gatherObservations({ servers: ['stun:a', 'stun:b', 'stun:c'], PeerConnection: PC });
  assert.equal(obs.length, 2);
  assert.equal(classifyNat(obs, { serversQueried: 3 }).kind, 'prevedibile');
});

test('raccolta: due mappature diverse dallo stesso socket = rete variabile', async () => {
  const PC = fakePC([
    'candidate:1 1 udp 1 100.64.0.1 5000 typ srflx',
    'candidate:2 1 udp 1 100.64.0.1 6001 typ srflx',
  ]);
  const obs = await gatherObservations({ servers: ['stun:a', 'stun:b'], PeerConnection: PC });
  assert.equal(classifyNat(obs, { serversQueried: 2 }).kind, 'variabile');
});

test('una connessione che non emette mai nulla non blocca per sempre', async () => {
  const PC = class {
    constructor() { this.onicecandidate = null; }
    createDataChannel() { return {}; }
    async createOffer() { return {}; }
    async setLocalDescription() { /* silenzio totale */ }
    close() {}
  };
  const obs = await gatherObservations({ servers: ['stun:a'], PeerConnection: PC, timeoutMs: 60 });
  assert.deepEqual(obs, []);
});

test('senza WebRTC (ambiente che non lo ha) non si crolla: nessuna osservazione', async () => {
  assert.deepEqual(await gatherObservations({ PeerConnection: null }), []);
  const r = await probeNetwork({ PeerConnection: null });
  assert.equal(r.nat.kind, 'bloccato');
  assert.equal(r.timeoutMs, 0);
  assert.equal(r.advice.prefer, 'paste');
});

test('il giro completo restituisce diagnosi, consiglio e attesa coerenti', async () => {
  const PC = fakePC([
    'candidate:1 1 udp 1 100.64.0.1 5000 typ srflx',
    'candidate:2 1 udp 1 100.64.0.1 6001 typ srflx',
  ]);
  const r = await probeNetwork({ servers: ['stun:a', 'stun:b'], PeerConnection: PC });
  assert.equal(r.nat.kind, 'variabile');
  // La sonda misura solo la PROPRIA rete: senza sapere chi c'è dall'altra
  // parte il diretto va tentato, perché la maggioranza dei dispositivi non è
  // simmetrica. Il ripiego si decide quando si conosce anche l'altro lato.
  assert.equal(r.advice.prefer, 'direct');
  assert.ok(r.timeoutMs > 3000 && r.timeoutMs < 12000);
});

test('il pool ha almeno due server distinti: con uno solo la diagnosi sarebbe impossibile', () => {
  assert.ok(STUN_POOL.length >= 2);
  assert.equal(new Set(STUN_POOL).size, STUN_POOL.length);
  for (const s of STUN_POOL) assert.match(s, /^stuns?:/);
});
