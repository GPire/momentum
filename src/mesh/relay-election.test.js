'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puoBucare, probabilitaDiretta, puoFareDaPonte, quotaIrrisolvibile } from './nat-matrix.js';
import {
  candidatiPonte, eleggiPonte, scegliStrada, coperturaStimata,
  costoPrivacyPonte, MAX_SESSIONI_PONTE,
} from './relay-election.js';

const P = (id, kind, extra = {}) => ({ id, nat: { kind }, sessioniAttive: 0, minutiOnline: 60, disponibile: true, ...extra });

// ── La matrice: il difetto che il nostro codice aveva ──

test('IL PUNTO: simmetrico contro NON simmetrico RIESCE', () => {
  for (const altro of ['aperto', 'prevedibile']) {
    const v = puoBucare('variabile', altro);
    assert.equal(v.ok, true, `variabile <-> ${altro} deve riuscire`);
    assert.equal(v.imparata, true);
    assert.ok(probabilitaDiretta('variabile', altro) > 0.8,
      'il vecchio calcolo dava ~15% e proponeva il ripiego senza nemmeno provare');
  }
});

test('simmetrico contro simmetrico e\' l\'UNICO caso davvero senza uscita in diretta', () => {
  const v = puoBucare('variabile', 'variabile');
  assert.equal(v.ok, false);
  assert.equal(v.irrisolvibile, true);
  assert.ok(probabilitaDiretta('variabile', 'variabile') < 0.05);
});

test('l\'ordine dei due lati non cambia il verdetto', () => {
  for (const a of ['aperto', 'prevedibile', 'variabile', 'bloccato', 'incerto']) {
    for (const b of ['aperto', 'prevedibile', 'variabile', 'bloccato', 'incerto']) {
      assert.equal(puoBucare(a, b).ok, puoBucare(b, a).ok, `${a}/${b} asimmetrico`);
      assert.equal(probabilitaDiretta(a, b).toFixed(4), probabilitaDiretta(b, a).toFixed(4));
    }
  }
});

test('una rete che filtra tutto non si salva con nessuno', () => {
  for (const altro of ['aperto', 'prevedibile', 'variabile']) {
    assert.equal(puoBucare('bloccato', altro).ok, false);
  }
});

test('IL NUMERO: col 15% di simmetrici, l\'irrisolvibile e\' ~2%, non il 15%', () => {
  const q = quotaIrrisolvibile({ aperto: 20, prevedibile: 65, variabile: 15 });
  assert.ok(q.quota > 0.02 && q.quota < 0.03, `atteso ~2%, ottenuto ${(q.quota * 100).toFixed(2)}%`);
  assert.ok(q.quotaSalvataDallaMatrice > 0.2,
    'un quarto delle coppie ha un lato simmetrico e funziona lo stesso: erano quelle a cui rinunciavamo');
});

// ── Elezione del ponte ──

test('un ponte deve essere raggiungibile da ENTRAMBI i capi', () => {
  const a = P('a', 'variabile'), b = P('b', 'variabile');
  const buono = P('ok', 'prevedibile');
  const inutile = P('no', 'variabile'); // simmetrico: non puo' fare da ponte
  const c = candidatiPonte(a, b, [buono, inutile]);
  assert.deepEqual(c.map((x) => x.id), ['ok']);
  assert.equal(puoFareDaPonte({ kind: 'variabile' }), false);
});

test('non si usa un dispositivo gia\' carico ne\' uno dichiarato non disponibile', () => {
  const a = P('a', 'variabile'), b = P('b', 'variabile');
  const pieno = P('pieno', 'aperto', { sessioniAttive: MAX_SESSIONI_PONTE });
  const scarico = P('scarico', 'aperto', { disponibile: false });
  assert.deepEqual(candidatiPonte(a, b, [pieno, scarico]), []);
});

test('LA SCALA DI PRIVACY: un mio dispositivo batte sempre uno del gruppo, che batte uno sconosciuto', () => {
  const a = P('a', 'variabile'), b = P('b', 'variabile');
  const sconosciuto = P('x', 'aperto', { minutiOnline: 999 });     // il piu' "bravo"
  const gruppo = P('g', 'prevedibile', { stessoGruppo: true, minutiOnline: 1 });
  const mio = P('m', 'prevedibile', { mio: true, minutiOnline: 1 });
  assert.equal(eleggiPonte(a, b, [sconosciuto, gruppo, mio]).ponte.id, 'm');
  assert.equal(eleggiPonte(a, b, [sconosciuto, gruppo]).ponte.id, 'g');
  assert.equal(eleggiPonte(a, b, [sconosciuto]).ponte.id, 'x');
});

test('il costo per la privacy e\' DICHIARATO e cresce con la distanza', () => {
  assert.equal(costoPrivacyPonte('mio').vedeMetadati, false);
  assert.equal(costoPrivacyPonte('gruppo').vedeMetadati, true);
  assert.equal(costoPrivacyPonte('rete').vedeMetadati, true);
  for (const l of ['mio', 'gruppo', 'rete']) {
    assert.equal(costoPrivacyPonte(l).vedeContenuto, false, 'il contenuto e\' sigillato in ogni caso');
    assert.ok(!/NAT|relay|TURN|metadat/i.test(costoPrivacyPonte(l).testo), 'niente gergo verso l\'utente');
  }
});

test('DISPERSIONE: coppie diverse non si schiantano tutte sullo stesso ponte', () => {
  const ponti = ['x', 'y', 'z', 'w'].map((id) => P(id, 'aperto'));
  const scelti = new Set();
  for (let i = 0; i < 40; i++) {
    const a = P(`a${i}`, 'variabile'), b = P(`b${i}`, 'variabile');
    scelti.add(eleggiPonte(a, b, ponti).ponte.id);
  }
  assert.ok(scelti.size >= 3, `usati solo ${scelti.size} ponti su 4: un dispositivo verrebbe schiacciato`);
});

test('la scelta e\' DETERMINISTICA: la stessa coppia ottiene sempre lo stesso ponte', () => {
  const ponti = ['x', 'y', 'z'].map((id) => P(id, 'aperto'));
  const a = P('a', 'variabile'), b = P('b', 'variabile');
  const primo = eleggiPonte(a, b, ponti).ponte.id;
  for (let i = 0; i < 10; i++) assert.equal(eleggiPonte(a, b, ponti).ponte.id, primo);
  // ...e non dipende da chi dei due chiede per primo
  assert.equal(eleggiPonte(b, a, ponti).ponte.id, primo);
});

test('a parita\' di fiducia si preferisce il meno carico', () => {
  const a = P('a', 'variabile'), b = P('b', 'variabile');
  const carico = P('carico', 'aperto', { sessioniAttive: 3 });
  const libero = P('libero', 'aperto', { sessioniAttive: 0 });
  assert.equal(eleggiPonte(a, b, [carico, libero]).ponte.id, 'libero');
});

// ── La strada completa ──

test('se il diretto funziona non si scomoda nessuno', () => {
  const s = scegliStrada(P('a', 'variabile'), P('b', 'aperto'), [P('x', 'aperto')]);
  assert.equal(s.tipo, 'diretto');
});

test('due simmetrici passano da un ponte', () => {
  const s = scegliStrada(P('a', 'variabile'), P('b', 'variabile'), [P('x', 'prevedibile')]);
  assert.equal(s.tipo, 'ponte');
  assert.equal(s.via.id, 'x');
  assert.match(s.testo, /non puo' leggere niente/);
});

test('senza nessun ponte non si gira a vuoto: si passa alla consegna differita', () => {
  const s = scegliStrada(P('a', 'variabile'), P('b', 'variabile'), [P('y', 'variabile')]);
  assert.equal(s.tipo, 'differito');
  assert.match(s.testo, /parte da solo appena/);
});

test('nessun testo verso l\'utente contiene gergo di rete', () => {
  const casi = [
    scegliStrada(P('a', 'variabile'), P('b', 'aperto'), []),
    scegliStrada(P('a', 'variabile'), P('b', 'variabile'), [P('x', 'aperto')]),
    scegliStrada(P('a', 'variabile'), P('b', 'variabile'), []),
  ];
  for (const c of casi) assert.ok(!/\b(NAT|STUN|TURN|ICE|WebRTC|relay|peer)\b/i.test(c.testo), c.testo);
});

// ── La misura che rende il claim citabile ──

test('COPERTURA MISURATA: con una rete realistica quasi nessuna coppia resta fuori', () => {
  const r = coperturaStimata({ distribuzione: { aperto: 4, prevedibile: 13, variabile: 3 }, nPeers: 20 });
  assert.equal(r.coppie, 190);
  assert.ok(r.senzaStrada === 0, `coppie senza strada: ${r.senzaStrada}`);
  assert.ok(r.viaPonte > 0, 'le coppie simmetrico-simmetrico devono passare da un ponte');
  assert.equal(r.quotaRaggiungibile, 1);
});

test('CASO AVVERSO: rete fatta QUASI solo di reti difficili', () => {
  // 18 simmetrici e 2 normali: i ponti sono pochissimi e si riempiono.
  const r = coperturaStimata({ distribuzione: { variabile: 18, prevedibile: 2 }, nPeers: 20 });
  assert.ok(r.senzaStrada === 0 || r.viaPonte > 0);
  assert.ok(r.quotaRaggiungibile > 0.2,
    `anche nel caso avverso resta raggiungibile ${(r.quotaRaggiungibile * 100).toFixed(0)}%`);
});

test('CASO PEGGIORE ONESTO: senza NESSUN dispositivo normale non c\'e\' ponte possibile', () => {
  const r = coperturaStimata({ distribuzione: { variabile: 10 }, nPeers: 10 });
  assert.equal(r.dirette, 0);
  assert.equal(r.viaPonte, 0);
  assert.equal(r.senzaStrada, 45, 'e va detto, non nascosto: qui resta solo la consegna differita');
});

test('la copertura CRESCE aggiungendo dispositivi normali (il contrario di un server)', () => {
  const pochi = coperturaStimata({ distribuzione: { variabile: 8, prevedibile: 1 }, nPeers: 9 });
  const molti = coperturaStimata({ distribuzione: { variabile: 8, prevedibile: 8 }, nPeers: 16 });
  assert.ok(molti.quotaRaggiungibile > pochi.quotaRaggiungibile,
    `${(pochi.quotaRaggiungibile * 100).toFixed(0)}% -> ${(molti.quotaRaggiungibile * 100).toFixed(0)}%`);
});

// ── Il trasporto vero, non solo la decisione ──
// Questi test usano il MeshNode reale con canali finti: verificano che un
// pacchetto attraversi davvero un terzo dispositivo, e che quel terzo non
// possa leggerlo.
import { MeshNode } from './mesh-signaling.js';
import { generateExchangeIdentity, sealFor, openSealed } from './store-forward.js';

// Canali finti collegati al VERO dispatch dei messaggi (`_wireChannel`), non
// a una scorciatoia: se il ponte funzionasse solo con un percorso inventato
// per il test non dimostrerebbe niente.
function collega(a, b) {
  const ca = { readyState: 'open' }, cb = { readyState: 'open' };
  ca.send = (raw) => queueMicrotask(() => cb.onmessage?.({ data: raw }));
  cb.send = (raw) => queueMicrotask(() => ca.onmessage?.({ data: raw }));
  a.peers.set(b.nodeId, { channel: ca });
  b.peers.set(a.nodeId, { channel: cb });
  a._wireChannel(b.nodeId, ca);
  b._wireChannel(a.nodeId, cb);
}
const attendi = () => new Promise((r) => setTimeout(r, 20));

test('TRASPORTO: A e C non si vedono, il pacchetto arriva passando da B', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null), C = new MeshNode('C', null);
  collega(A, B); collega(B, C);           // A e C NON sono collegati fra loro
  assert.equal(A.peers.has('C'), false);

  const idC = await generateExchangeIdentity();
  const idA = await generateExchangeIdentity();
  const pacco = await sealFor(idC.publicKey, idA, { importo: 30, nota: 'benzina' });

  let arrivato = null, vistoDaB = 'mai chiamato';
  C.onBundlesReceived = async (_da, bundles) => { arrivato = await openSealed(idC, bundles[0]); };
  B.onBundlesReceived = async (_da, bundles) => { vistoDaB = await openSealed(idC, bundles[0]); };

  assert.equal(A.sendViaBridge('B', 'C', pacco), true);
  await attendi();
  assert.deepEqual(arrivato, { importo: 30, nota: 'benzina' });
  assert.equal(vistoDaB, 'mai chiamato', 'il ponte non deve nemmeno ricevere il pacchetto come suo');
});

test('IL PONTE NON PUO\' LEGGERE: con le SUE chiavi il contenuto resta chiuso', async () => {
  const idC = await generateExchangeIdentity(), idA = await generateExchangeIdentity();
  const idB = await generateExchangeIdentity(); // il ponte, con la sua identità
  const pacco = await sealFor(idC.publicKey, idA, { iban: 'IT60X0542811101000000123456' });
  assert.equal(await openSealed(idB, pacco), null, 'un ponte che potesse leggere sarebbe un server TURN qualunque');
  assert.deepEqual(await openSealed(idC, pacco), { iban: 'IT60X0542811101000000123456' });
});

test('un anello nella mesh non fa rimbalzare il pacchetto all\'infinito', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null), C = new MeshNode('C', null);
  collega(A, B); collega(B, C); collega(C, A);   // anello chiuso
  let consegne = 0;
  const perso = new MeshNode('Z', null);   // destinatario che non esiste nella mesh
  for (const n of [A, B, C]) n.onBundlesReceived = async () => { consegne++; };
  A.sendViaBridge('B', perso.nodeId, { v: 1, to: 'x', from: 'y', iv: 'a', ct: 'b', exp: Date.now() + 1000 });
  await attendi();
  assert.equal(consegne, 0, 'nessuno lo prende per suo');
});

test('non si finge un invio riuscito quando il canale non c\'e\'', () => {
  const A = new MeshNode('A', null);
  assert.equal(A.sendViaBridge('inesistente', 'C', { v: 1 }), false);
  assert.equal(A.sendViaBridge('B', 'A', { v: 1 }), false, 'ne\' un ponte verso se stessi');
});

// ══ IL ROUTING COLLEGATO PER DAVVERO ══
// relay-election.js era ORFANO: mesh-signaling.js e channel-learning.js lo
// citavano solo nei commenti, `sendViaBridge` esisteva e nessuno eleggeva un
// ponte. Il 2% di coppie senza strada — la ragione per cui il modulo esiste —
// restava senza strada. Questi test passano da `routeToPeer`, cioe' dalla
// decisione VERA, non da una chiamata a sendViaBridge cablata nel test.

test('ROUTING: con un peer collegato direttamente non si scomoda nessun ponte', () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  const r = A.routeToPeer('B', { v: 1, to: 'x', from: 'y', iv: 'a', ct: 'b', exp: Date.now() + 1000 });
  assert.equal(r.tipo, 'diretto');
});

test('ROUTING: due reti che non si parlano -> il ponte viene ELETTO e usato', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null), C = new MeshNode('C', null);
  collega(A, B); collega(B, C);            // A e C non si vedono
  // Le classi di rete: A e C simmetrici (non possono bucare fra loro), B normale.
  A.setLocalNat('variabile');
  A.peerNat.set('B', 'prevedibile');
  A.peerNat.set('C', 'variabile');
  let arrivato = null;
  C.onBundlesReceived = async (_da, b) => { arrivato = b[0]; };

  const r = A.routeToPeer('C', { v: 1, to: 'C', from: 'A', iv: 'a', ct: 'b', exp: Date.now() + 60000 });
  assert.equal(r.tipo, 'ponte', 'senza elezione questo resta "differito" e il pacchetto non parte mai');
  assert.equal(r.via, 'B');
  await attendi();
  assert.ok(arrivato, 'e il pacchetto deve ARRIVARE, non solo essere instradato');
});

test('ROUTING: la capienza del ponte si CONSUMA (non e\' un ponte infinito)', () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  A.setLocalNat('variabile');
  A.peerNat.set('B', 'aperto');
  for (const t of ['C', 'D', 'E']) A.peerNat.set(t, 'variabile');
  const pacco = { v: 1, to: 'x', from: 'A', iv: 'a', ct: 'b', exp: Date.now() + 60000 };
  A.routeToPeer('C', pacco); A.routeToPeer('D', pacco);
  assert.ok(A.peers.get('B').sessioniPonte >= 2, 'un telefono che fa da ponte non ha capienza infinita');
});

test('ROUTING: senza nessun ponte possibile si dichiara "differito", non si finge un invio', () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  A.setLocalNat('variabile');
  A.peerNat.set('B', 'variabile'); // anche l'unico vicino e' simmetrico: non puo' fare da ponte
  A.peerNat.set('Z', 'variabile');
  const r = A.routeToPeer('Z', { v: 1, to: 'Z', from: 'A', iv: 'a', ct: 'b', exp: Date.now() + 60000 });
  assert.equal(r.tipo, 'differito');
  assert.match(r.testo, /parte da solo appena/);
});

test('LA CLASSE DI RETE VIAGGIA: device_hello la porta, ed e\' cio\' che rende calcolabile l\'elezione', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  B.setLocalNat('prevedibile');
  B.sendDeviceHello('A', 'chiave-pubblica-finta');
  await attendi();
  assert.equal(A.peerNat.get('B'), 'prevedibile',
    'senza questo, scegliStrada non sa com\'e\' la rete dell\'altro e il ponte non e\' eleggibile');
});

test('GOSSIP: le classi di rete si propagano ai nodi mai visti di persona', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  B.peerNat.set('C', 'aperto');   // B conosce C
  B._broadcastPeerList();
  await attendi();
  assert.equal(A.peerNat.get('C'), 'aperto', 'A impara di C senza averlo mai visto');
});

test('GOSSIP anti-abuso: un terzo non puo\' RISCRIVERE la classe che sappiamo di prima mano', async () => {
  const A = new MeshNode('A', null), B = new MeshNode('B', null);
  collega(A, B);
  A.peerNat.set('C', 'variabile');           // A lo sa direttamente da C
  B.peerNat.set('C', 'aperto');              // B racconta il contrario
  B._broadcastPeerList();
  await attendi();
  assert.equal(A.peerNat.get('C'), 'variabile',
    'un peer non deve poter dichiarare un altro "ottimo ponte" per dirottarci su di se\'');
});

test('la classe di rete che viaggia e\' una PAROLA, mai un indirizzo', () => {
  const A = new MeshNode('A', null);
  A.setLocalNat('variabile');
  const inviati = [];
  A.peers.set('B', { channel: { readyState: 'open', send: (m) => inviati.push(m) } });
  A.sendDeviceHello('B', 'k');
  A._broadcastPeerList();
  const tutto = inviati.join(' ');
  assert.ok(!/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(tutto), 'nessun IP');
  assert.ok(!/"port"|:\d{4,5}[,}]/.test(tutto), 'nessuna porta');
  assert.match(tutto, /variabile/);
});
