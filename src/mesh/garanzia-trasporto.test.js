// ============================================================
// GARANZIA DI TRASPORTO — come Momentum SOPRAVVIVE a una rete vera
// ============================================================
// Richiesta prima del rilascio: "anche il sync live, immediato, e reti mesh
// e messaggi, ogni cosa testata". Il trasporto WebRTC in sé è codice di
// Chrome, non nostro: testarlo vorrebbe dire testare il browser. Quello che
// è NOSTRO — e non era coperto da nessun test — è come `mesh-signaling.js`
// si comporta quando la rete fa quello che fa sempre: consegna messaggi
// corrotti, troncati, duplicati, fuori ordine, o da un peer che mente.
//
// Qui il canale WebRTC è finto ma il CONTRATTO è quello vero: si chiama
// `channel.onmessage({ data })` esattamente come fa il browser, con
// `readyState` che cambia sotto i piedi come succede quando una connessione
// cade a metà. Nessuna dipendenza nuova: il canale finto è venti righe.
//
// LA DOMANDA A CUI QUESTO FILE RISPONDE: se un peer manda spazzatura, l'app
// dell'utente smette di ricevere i messaggi buoni che arrivano dopo?
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { MeshNode } = await import('./mesh-signaling.js');

// Canale finto con lo STESSO contratto di un RTCDataChannel vero: `send`,
// `readyState`, `onmessage`. Registra cosa è stato spedito, così si può
// verificare che il filtro di privacy blocchi davvero prima dell'invio.
function canaleFinto({ readyState = 'open' } = {}) {
  return { readyState, inviati: [], send(m) { this.inviati.push(m); }, onmessage: null, onclose: null, onerror: null };
}

// Aggancia un peer al nodo come farebbe una connessione riuscita, senza rete.
function collega(node, peerId, { readyState = 'open' } = {}) {
  const channel = canaleFinto({ readyState });
  node.peers.set(peerId, { pc: null, channel, lastSeen: Date.now() });
  node._wireChannel(peerId, channel);
  return channel;
}

function nodoDiProva() {
  // `mind` finto: qui non si testa l'apprendimento federato, solo il trasporto.
  return new MeshNode('nodo-locale', { export: () => ({}), import: () => {} }, {
    autoDiscovery: false, reconnect: false,
    scheduleFn: () => {}, randomFn: () => 0.5,
  });
}

// ────────────────────────────────────────────────────────────
// 1. LA RETE CONSEGNA SPAZZATURA — e l'app deve sopravvivere
// ────────────────────────────────────────────────────────────

test('GARANZIA trasporto: un messaggio CORROTTO non deve impedire di ricevere quelli buoni che arrivano dopo', async () => {
  const node = nodoDiProva();
  const ricevuti = [];
  node.onSplitGroupsReceived = (peerId, groups) => ricevuti.push(groups);
  const ch = collega(node, 'peer-1');

  // Messaggi realmente possibili su una rete vera: JSON troncato a metà
  // (pacchetto spezzato), testo non JSON, stringa vuota.
  const spazzatura = [
    '{"type":"split_share","groups":[{"id":"g1"',   // troncato
    'non sono json',
    '',
    '{"type":',
    '[[[',
  ];
  for (const s of spazzatura) {
    await ch.onmessage({ data: s });
  }

  // E ORA il messaggio buono: deve arrivare.
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share', groups: [{ id: 'g1', name: 'Cena', members: [], expenses: [] }] }) });

  assert.equal(ricevuti.length, 1, 'dopo cinque messaggi corrotti, quello valido non è stato consegnato');
  assert.equal(ricevuti[0][0].id, 'g1');
});

test('GARANZIA trasporto: un messaggio corrotto non fa cadere il nodo né sporca gli altri peer', async () => {
  const node = nodoDiProva();
  const ricevuti = [];
  node.onSplitGroupsReceived = (peerId, groups) => ricevuti.push([peerId, groups]);
  const chA = collega(node, 'peer-A');
  const chB = collega(node, 'peer-B');

  await chA.onmessage({ data: '}{ rotto' });
  await chB.onmessage({ data: JSON.stringify({ type: 'split_share', groups: [{ id: 'g2', name: 'Casa', members: [], expenses: [] }] }) });

  assert.equal(ricevuti.length, 1, 'il peer sano deve continuare a essere ascoltato');
  assert.equal(ricevuti[0][0], 'peer-B');
  assert.equal(node.peers.size, 2, 'nessun peer deve essere stato rimosso per colpa di un messaggio malformato');
});

test('GARANZIA trasporto: un messaggio di tipo SCONOSCIUTO viene ignorato in silenzio, non rompe nulla', async () => {
  const node = nodoDiProva();
  let arrivati = 0;
  node.onSplitGroupsReceived = () => { arrivati++; };
  const ch = collega(node, 'peer-1');

  await ch.onmessage({ data: JSON.stringify({ type: 'tipo_che_non_esiste', payload: 42 }) });
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share', groups: [{ id: 'g3', members: [], expenses: [] }] }) });

  assert.equal(arrivati, 1, 'un tipo sconosciuto non deve bloccare i messaggi successivi');
});

test('GARANZIA trasporto: un payload con campi MANCANTI non produce un crash', async () => {
  const node = nodoDiProva();
  const ricevuti = [];
  node.onSplitGroupsReceived = (peerId, groups) => ricevuti.push(groups);
  const ch = collega(node, 'peer-1');

  // Un peer (o una versione più vecchia dell'app) manda il tipo giusto ma
  // senza il campo atteso.
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share' }) });
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share', groups: null }) });
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share', groups: 'non un array' }) });

  // Il nodo è ancora vivo e consegna il messaggio buono successivo.
  await ch.onmessage({ data: JSON.stringify({ type: 'split_share', groups: [{ id: 'g4', members: [], expenses: [] }] }) });
  assert.ok(ricevuti.length >= 1, 'il messaggio valido finale deve arrivare');
  assert.equal(ricevuti[ricevuti.length - 1][0].id, 'g4');
});

// ────────────────────────────────────────────────────────────
// 2. IL CANALE CADE — durante l'uso, non prima
// ────────────────────────────────────────────────────────────

test('GARANZIA trasporto: non si spedisce nulla su un canale che non è aperto', () => {
  const node = nodoDiProva();
  const aperto = collega(node, 'peer-aperto', { readyState: 'open' });
  const chiuso = collega(node, 'peer-chiuso', { readyState: 'closed' });
  const inConnessione = collega(node, 'peer-connecting', { readyState: 'connecting' });

  const gruppi = [{ id: 'g1', name: 'Test', members: [{ id: 'm0', name: 'Anna', claimedBy: 'peer-aperto' }], expenses: [] }];
  node.shareSplitGroups(gruppi, () => true);

  assert.equal(aperto.inviati.length, 1, 'il canale aperto deve ricevere');
  assert.equal(chiuso.inviati.length, 0, 'un canale chiuso non deve ricevere nulla');
  assert.equal(inConnessione.inviati.length, 0, 'un canale ancora in connessione non deve ricevere nulla');
});

test('GARANZIA trasporto: un canale che si CHIUDE a metà conversazione non blocca gli altri', () => {
  const node = nodoDiProva();
  const a = collega(node, 'peer-A');
  const b = collega(node, 'peer-B');
  const gruppi = [{ id: 'g1', name: 'T', members: [], expenses: [] }];

  node.shareSplitGroups(gruppi, () => true);
  assert.equal(a.inviati.length, 1);
  assert.equal(b.inviati.length, 1);

  // A cade (come quando un telefono va in tasca o perde la rete).
  a.readyState = 'closed';
  node.shareSplitGroups(gruppi, () => true);

  assert.equal(a.inviati.length, 1, 'nulla di nuovo deve essere spedito sul canale caduto');
  assert.equal(b.inviati.length, 2, 'il peer ancora connesso deve continuare a ricevere');
});

test('GARANZIA trasporto: se `send` LANCIA (canale morto fra il controllo e l\'invio) gli altri peer ricevono comunque', () => {
  const node = nodoDiProva();
  const rotto = collega(node, 'peer-rotto');
  const sano = collega(node, 'peer-sano');
  // Caso reale: readyState dice 'open' ma la connessione è già morta —
  // il browser lancia InvalidStateError dentro send().
  rotto.send = () => { throw new Error('InvalidStateError'); };

  const gruppi = [{ id: 'g1', name: 'T', members: [], expenses: [] }];
  let esploso = false;
  try { node.shareSplitGroups(gruppi, () => true); } catch (_) { esploso = true; }

  assert.equal(esploso, false, 'un solo canale morto non deve far fallire l\'intero invio');
  assert.equal(sano.inviati.length, 1, 'il peer sano deve aver ricevuto lo stesso');
});

// ────────────────────────────────────────────────────────────
// 3. PRIVACY: un peer non riceve i gruppi di cui non fa parte
// ────────────────────────────────────────────────────────────

test('GARANZIA privacy: un gruppo viene spedito SOLO ai peer che ne fanno parte', () => {
  const node = nodoDiProva();
  const dentro = collega(node, 'device-anna');
  const fuori = collega(node, 'device-estraneo');

  const gruppo = {
    id: 'g1', name: 'Casa', expenses: [],
    members: [{ id: 'm0', name: 'Anna', claimedBy: 'device-anna' }, { id: 'm1', name: 'Bruno', claimedBy: 'device-bruno' }],
  };
  // Il filtro reale usato in produzione: appartiene al gruppo?
  const appartiene = (peerId) => gruppo.members.some(m => m.claimedBy === peerId);
  node.shareSplitGroups([gruppo], appartiene);

  assert.equal(dentro.inviati.length, 1, 'chi è nel gruppo deve riceverlo');
  assert.equal(fuori.inviati.length, 0, 'chi NON è nel gruppo non deve ricevere niente');
});

// DIFFERENZA DI COMPORTAMENTO DOCUMENTATA, NON UN BUG NASCOSTO.
// `shareSplitGroups` senza filtro manda a TUTTI i peer connessi, mentre
// `shareUserData`/`shareBusinessTrips`/`shareCustomCategories` senza filtro
// non mandano a NESSUNO ("sono dati personali, non vanno a un peer
// qualunque", commento loro). L'asimmetria è una scelta deliberata
// precedente, protetta da un test esplicito in mesh-signaling.test.js
// ("cambiare in silenzio la semantica romperebbe i chiamanti"): NON viene
// ribaltata qui. Questo test la fissa per iscritto — così se un giorno si
// decide di uniformarla, si fa consapevolmente e non per caso.
// Rischio pratico oggi: nullo. Tutti i chiamanti di produzione (main.js,
// cinque punti) passano sempre `peerAppartieneAlGruppo`.
test('DOCUMENTATO: shareSplitGroups senza filtro manda a tutti (diverso da trips/user-data, che non mandano a nessuno)', () => {
  const node = nodoDiProva();
  const ch = collega(node, 'peer-qualsiasi');
  const gruppi = [{ id: 'g1', name: 'Privato', members: [], expenses: [] }];

  const inviati = node.shareSplitGroups(gruppi, null);
  assert.equal(inviati, 1, 'comportamento storico: senza filtro si manda a tutti');
  assert.equal(ch.inviati.length, 1);

  // Mentre le trasferte, senza destinatario, non partono affatto.
  const inviateTrasferte = node.shareBusinessTrips([{ id: 't1' }], null);
  assert.equal(inviateTrasferte, 0, 'le trasferte restano a default sicuro');
});

// ────────────────────────────────────────────────────────────
// 4. RAFFICA: molti messaggi, molti peer, tutti insieme
// ────────────────────────────────────────────────────────────

test('GARANZIA trasporto: 10 peer e 50 messaggi a raffica, nessuno perso e nessun errore', async () => {
  const node = nodoDiProva();
  const ricevutiPer = new Map();
  node.onSplitGroupsReceived = (peerId, groups) => {
    ricevutiPer.set(peerId, (ricevutiPer.get(peerId) || 0) + (groups?.length || 0));
  };
  const canali = Array.from({ length: 10 }, (_, i) => collega(node, `peer-${i}`));

  // Ogni peer manda 5 gruppi, tutti "insieme" (interleaved come una mesh vera).
  const invii = [];
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < canali.length; i++) {
      invii.push(canali[i].onmessage({
        data: JSON.stringify({ type: 'split_share', groups: [{ id: `g-${i}-${round}`, members: [], expenses: [] }] }),
      }));
    }
  }
  await Promise.all(invii);

  assert.equal(ricevutiPer.size, 10, 'tutti e dieci i peer devono aver consegnato qualcosa');
  for (const [peerId, n] of ricevutiPer) {
    assert.equal(n, 5, `${peerId}: consegnati ${n} gruppi invece di 5`);
  }
});

test('GARANZIA trasporto: una raffica MISTA (buoni + corrotti alternati) consegna tutti i buoni', async () => {
  const node = nodoDiProva();
  let buoniRicevuti = 0;
  node.onSplitGroupsReceived = () => { buoniRicevuti++; };
  const ch = collega(node, 'peer-instabile');

  for (let i = 0; i < 20; i++) {
    const corrotto = i % 2 === 1;
    await ch.onmessage({
      data: corrotto ? '{"type":"split_sha' : JSON.stringify({ type: 'split_share', groups: [{ id: `g${i}`, members: [], expenses: [] }] }),
    });
  }
  assert.equal(buoniRicevuti, 10, `su 10 messaggi validi alternati a 10 corrotti ne sono arrivati ${buoniRicevuti}`);
});
