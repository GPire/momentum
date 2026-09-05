// ============================================================
// GARANZIA SYBIL + PARTIZIONE — l'attacco cronometrato sulla riconnessione
// ============================================================
// sybil-resistance.test.js verifica già l'attacco "a rete piena": la difesa
// (ancoraggio sul PROPRIO punteggio, non sulla media — vedi trustRank) regge
// perché il proprio punteggio non si sposta quando l'attaccante aggiunge
// identità in un angolo lontano del grafo. Ma quel test presuppone che il MIO
// grafo onesto sia già completo quando arriva l'attacco.
//
// Il momento più pericoloso in una mesh reale non è quello: è SUBITO DOPO una
// partizione di rete, quando il mio dispositivo ha appena ripreso a vedere
// gli altri e la MIA rete di amicizie vere non è ancora tutta ri-sincronizzata
// (mancano ancora gruppi/spese che arriveranno a momenti), mentre l'attaccante
// — che non deve aspettare una sincronizzazione onesta, i suoi dati sono già
// pronti — può spingere il proprio cluster fabbricato PROPRIO in quella
// finestra, quando il mio grafo onesto è più povero del solito.
//
// Qui si verifica che la difesa regga ANCHE quando il mio riferimento è
// calcolato su una rete onesta temporaneamente incompleta (il caso reale
// subito dopo un ripristino di rete), non solo a rete onesta piena.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrustGraph, trustRank, effectiveAnonymity, sybilDiagnosis, trustedWitnesses,
} from './sybil-resistance.js';

const GIORNO = 86400000;
const gruppo = (id, dispositivi, spese) => ({
  id, name: id,
  members: dispositivi.map((d, i) => ({ id: `m${i}`, name: d, claimedBy: d })),
  expenses: spese.map(([chiPaga, chiDeve, giorno]) => ({
    payer: `m${dispositivi.indexOf(chiPaga)}`,
    amount: 40,
    date: giorno * GIORNO,
    owed: Object.fromEntries(chiDeve.map((d) => [`m${dispositivi.indexOf(d)}`, 20])),
  })),
});

// Una storia onesta lunga (120 giorni, 3 amici) — ma qui parametrizzata per
// poter simulare quanta ne è GIÀ arrivata dopo la partizione (0..1).
function storiaOnesta(frazioneArrivata = 1) {
  const persone = ['me', 'anna', 'bruno', 'carla'];
  const tutti = [];
  for (let g = 0; g < 120; g += 10) {
    tutti.push(['me', ['anna', 'bruno'], g]);
    tutti.push(['anna', ['me', 'carla'], g + 3]);
    tutti.push(['bruno', ['me', 'carla'], g + 6]);
  }
  const quante = Math.round(tutti.length * frazioneArrivata);
  return gruppo('reale', persone, tutti.slice(0, quante));
}

// Il cluster fabbricato: 40 identità finte, dense fra loro, con UN solo ponte
// verso "me" — sempre pronto per intero, perché non deve aspettare una
// sincronizzazione onesta fra persone vere.
function clusterFabbricato() {
  const finti = Array.from({ length: 40 }, (_, i) => `s${i}`);
  const spese = [];
  for (let i = 0; i < finti.length; i++) {
    for (let j = i + 1; j < Math.min(i + 5, finti.length); j++) spese.push([finti[i], [finti[j]], i]);
  }
  return { rete: gruppo('finta', finti, spese), ponte: gruppo('ponte', ['me', 's0'], [['me', ['s0'], 5]]), finti };
}

test('SYBIL+PARTIZIONE: col mio grafo onesto ANCORA INCOMPLETO (appena ripristinata la rete), il cluster fabbricato resta escluso', () => {
  const { rete, ponte, finti } = clusterFabbricato();
  // Subito dopo il ripristino: solo il 15% della mia storia onesta è già
  // ri-arrivata (poche spese con anna/bruno/carla), il resto deve ancora
  // sincronizzarsi — mentre il cluster fabbricato, che non aspetta nessuno, è
  // già tutto qui.
  const onestaParziale = storiaOnesta(0.15);
  const grafo = buildTrustGraph([onestaParziale, rete, ponte], { me: 'me' });
  const cl = trustRank(grafo);

  const anon = effectiveAnonymity(finti, cl, { k: 3 });
  assert.equal(anon.kDichiarato, 40, 'sembrano 40 dispositivi distinti');
  assert.ok(anon.kEffettivo < 3, `anche con la mia rete onesta ancora povera, il cluster fabbricato non deve contare come testimoni indipendenti: kEffettivo=${anon.kEffettivo}`);
  assert.equal(anon.sufficiente, false);

  const diagnosi = sybilDiagnosis(grafo, cl);
  assert.equal(diagnosi.sospetto, true, 'la firma dell\'attacco (denso dentro, strozzato verso di me) deve essere visibile anche con pochi dati onesti');
  assert.ok(diagnosi.conduttanza < 0.2);
});

test('SYBIL+PARTIZIONE: il mio riferimento resta un\'ancora stabile man mano che la mia rete onesta si ri-sincronizza', () => {
  // Si simula il ripristino progressivo: 10%, 40%, 70%, 100% della storia
  // onesta via via ri-arrivata, con lo STESSO cluster fabbricato presente fin
  // dall'inizio. Il punto non è che il riferimento sia identico (più storia
  // onesta è legittimamente più fiducia), ma che il cluster fabbricato non
  // debba MAI approfittare del momento in cui la mia rete è più povera.
  const { rete, ponte, finti } = clusterFabbricato();
  const kEffettivoPerFrazione = [0.1, 0.4, 0.7, 1].map((frazione) => {
    const grafo = buildTrustGraph([storiaOnesta(frazione), rete, ponte], { me: 'me' });
    const cl = trustRank(grafo);
    return effectiveAnonymity(finti, cl, { k: 3 }).kEffettivo;
  });
  assert.ok(kEffettivoPerFrazione.every((k) => k < 3),
    `in NESSUN momento del ripristino il cluster fabbricato deve raggiungere k=3 testimoni indipendenti: ${kEffettivoPerFrazione.join(', ')}`);
});

test('SYBIL+PARTIZIONE: due bolle oneste isolate si riconnettono, il cluster fabbricato è arrivato durante la finestra e resta comunque fuori', () => {
  // Scenario più vicino a una vera partizione: la mia storia onesta stessa è
  // spaccata in due pezzi (metà con anna/bruno, metà con carla) come
  // capiterebbe se il mio dispositivo avesse perso e ripreso la connessione a
  // metà giornata — e SOLO DOPO che le due bolle si sono fuse arriva anche il
  // cluster fabbricato, esattamente nella finestra di massima confusione.
  const persone = ['me', 'anna', 'bruno', 'carla'];
  const bollaA = gruppo('bollaA', persone, [['me', ['anna', 'bruno'], 0], ['me', ['anna', 'bruno'], 10]]);
  const bollaB = gruppo('bollaB', persone, [['anna', ['me', 'carla'], 3], ['bruno', ['me', 'carla'], 6]]);
  const { rete, ponte, finti } = clusterFabbricato();

  const grafo = buildTrustGraph([bollaA, bollaB, rete, ponte], { me: 'me' });
  const cl = trustRank(grafo);
  const anon = effectiveAnonymity(finti, cl, { k: 3 });
  assert.ok(anon.kEffettivo < 3, `le due bolle oneste appena riunite non devono aprire una finestra per il cluster fabbricato: kEffettivo=${anon.kEffettivo}`);

  // E gli amici veri, spezzati su due bolle diverse, devono comunque risultare
  // testimoni fidati una volta riunite — la partizione non deve penalizzare
  // chi è onesto solo perché la sua storia è arrivata in due pezzi.
  const wit = trustedWitnesses(['anna', 'bruno', 'carla'], cl);
  assert.deepEqual([...wit.fidati].sort(), ['anna', 'bruno', 'carla'], 'gli amici veri restano testimoni fidati anche se la loro storia è arrivata spezzata in due bolle');
});

test('SYBIL+PARTIZIONE: il caso peggiore — utente NUOVO, zero storia onesta, solo il ponte dell\'attaccante', () => {
  // Il caso limite reale: chi installa Momentum e il primo gruppo che gli
  // arriva (per una qualunque ragione — il primo invito che apre, anche in
  // buona fede da parte di chi lo manda) è proprio il ponte verso un cluster
  // fabbricato. Nessuna storia onesta pregressa a fare da ancoraggio.
  const { rete, ponte, finti } = clusterFabbricato();
  const grafo = buildTrustGraph([rete, ponte], { me: 'me' });
  const cl = trustRank(grafo);
  assert.equal(cl.motivo, null, 'un solo legame reale (il ponte) basta per avere un punto di partenza');

  const anon = effectiveAnonymity(finti, cl, { k: 3 });
  assert.ok(anon.kEffettivo <= 1, `senza nessuna storia onesta pregressa, il cluster dietro il ponte non deve MAI contare come 40 testimoni: kEffettivo=${anon.kEffettivo}`);
  assert.equal(anon.sufficiente, false);

  const diagnosi = sybilDiagnosis(grafo, cl);
  assert.equal(diagnosi.sospetto, true, 'anche per un utente nuovo senza storia, il cluster fabbricato deve avere la firma riconoscibile (denso dentro, strozzato verso di me)');
});
