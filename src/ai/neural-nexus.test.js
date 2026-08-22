import test from 'node:test';
import assert from 'node:assert/strict';

// neural-nexus.js importa (transitivamente, via constants.js) riferimenti a
// window/navigator valutati al top-level del modulo — stesso shim minimo
// già usato in orchestrator.test.js.
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };

const { NeuralNexus, fondiOutputPerNome } = await import('./neural-nexus.js');
const { VaultDAO } = await import('../core/vault.js');

function mlDataVuoto() {
  return { vocab: {}, catCounts: {}, totalWords: 0 };
}
function resetVault() {
  VaultDAO.state = { mlData: mlDataVuoto(), onboardingProfile: null };
  VaultDAO.save = () => {};
}

// ── Cantiere C4 (PIANO_TASK_2026-08-21.md): l'output della rete cresce da
// solo invece di restare bloccato a 8 categorie fisse ──────────────────────

test('initPriorWeights: un net nuovo parte dal seme (8 categorie), catIndex presente', () => {
  resetVault();
  NeuralNexus.initPriorWeights(null);
  const net = VaultDAO.state.mlData.neuralNet;
  assert.equal(net.W2.length, 8);
  assert.equal(net.b2.length, 8);
  assert.equal(net.indexToCat.length, 8);
  assert.equal(net.catIndex.spesa, 0);
});

test('MIGRAZIONE: un net vecchio (senza catIndex, W2/b2 già a 8 righe) viene allineato senza perdere i pesi già addestrati', () => {
  resetVault();
  const w2Originale = Array.from({ length: 8 }, (_, i) => Array.from({ length: 12 }, (_, j) => i * 100 + j)); // valori riconoscibili
  VaultDAO.state.mlData.neuralNet = {
    embeddings: {},
    W1: Array.from({ length: 12 }, () => Array.from({ length: 8 }, () => 0)),
    b1: Array.from({ length: 12 }, () => 0),
    W2: w2Originale,
    b2: Array.from({ length: 8 }, () => 0),
    // niente catIndex/indexToCat: simula un net salvato prima del fix
  };
  NeuralNexus.initPriorWeights(null);
  const net = VaultDAO.state.mlData.neuralNet;
  assert.equal(net.catIndex.ristoranti, 1); // stesso ordine del seme originale
  assert.equal(net.W2, w2Originale, 'i pesi ORIGINALI non devono essere ricreati');
  assert.equal(net.W2[1][5], 105, 'un peso già addestrato deve restare intatto dopo la migrazione');
});

test('train: una categoria MAI vista prima (es. "casa") fa crescere la rete invece di essere scartata', () => {
  resetVault();
  NeuralNexus.train('bolletta enel condominio', 'casa', 80);
  const net = VaultDAO.state.mlData.neuralNet;
  assert.ok('casa' in net.catIndex, 'casa deve essere entrata nella mappa');
  assert.equal(net.W2.length, 9, 'una riga di output in più rispetto al seme di 8');
  assert.equal(net.b2.length, 9);
});

test('train: categorie nuove ripetute non duplicano la riga di output (idempotente)', () => {
  resetVault();
  NeuralNexus.train('bolletta enel', 'casa', 80);
  NeuralNexus.train('bolletta gas', 'casa', 60);
  NeuralNexus.train('affitto mensile', 'casa', 700);
  const net = VaultDAO.state.mlData.neuralNet;
  assert.equal(net.W2.length, 9, 'sempre una sola riga per "casa", non una per ogni esempio');
});

test('forward: la lunghezza delle probabilità segue net.b2.length, dinamica', () => {
  resetVault();
  NeuralNexus.train('bolletta enel', 'casa', 80);
  NeuralNexus.train('farmacia comunale', 'salute', 30);
  const net = VaultDAO.state.mlData.neuralNet;
  const tokens = NeuralNexus.tokenize('bolletta enel condominio');
  const { probs } = NeuralNexus.forward(tokens, net);
  assert.equal(probs.length, net.b2.length);
  const somma = probs.reduce((s, p) => s + p, 0);
  assert.ok(Math.abs(somma - 1) < 1e-9, 'softmax valido anche con output cresciuto');
});

test('predict: una categoria nuova, addestrata a sufficienza, riceve un contributo neurale REALE (non più sempre zero)', () => {
  resetVault();
  // "prima" del fix: 'casa' non era in CAT_INDICES -> neuralProb sempre 0.
  // Qui si addestra ripetutamente e si verifica che il net SA rispondere.
  for (let i = 0; i < 40; i++) NeuralNexus.train('bolletta enel condominio spese', 'casa', 90);
  const net = VaultDAO.state.mlData.neuralNet;
  const tokens = NeuralNexus.tokenize('bolletta enel condominio spese');
  const { probs } = NeuralNexus.forward(tokens, net);
  const idx = net.catIndex.casa;
  assert.ok(idx !== undefined);
  assert.ok(probs[idx] > 1 / net.b2.length, `dopo 40 esempi il neurale deve preferire "casa" più della media uniforme, ottenuto ${probs[idx]}`);
});

test('predict: continua a funzionare su una categoria del seme originale (nessuna regressione)', () => {
  resetVault();
  for (let i = 0; i < 10; i++) NeuralNexus.train('esselunga spesa alimentari', 'spesa', 45);
  const r = NeuralNexus.predict('esselunga spesa alimentari', 45);
  assert.ok(r.cat, 'deve restituire una categoria');
  assert.ok(Number.isFinite(r.confidence));
});

test('validate: NON fa crescere il net (sola lettura) — una categoria mai vista viene semplicemente saltata', () => {
  resetVault();
  NeuralNexus.initPriorWeights(null);
  const net = VaultDAO.state.mlData.neuralNet;
  const righeIniziali = net.W2.length;
  const loss = NeuralNexus.validate([{ tokens: ['bolletta'], catId: 'categoria-mai-vista-XYZ' }], net);
  assert.equal(net.W2.length, righeIniziali, 'validate non deve mai modificare la struttura del net');
  assert.equal(loss, 0, 'nessun esempio valutabile -> loss 0, non un crash');
});

test('validate: su una categoria nota calcola una loss finita', () => {
  resetVault();
  NeuralNexus.initPriorWeights(null);
  const net = VaultDAO.state.mlData.neuralNet;
  const loss = NeuralNexus.validate([{ tokens: ['esselunga', 'spesa'], catId: 'spesa' }], net);
  assert.ok(Number.isFinite(loss) && loss >= 0);
});

test('cresciCategoria (indirettamente via train): l\'ordine delle categorie del seme resta 0-7 anche dopo aver aggiunto categorie nuove', () => {
  resetVault();
  NeuralNexus.train('bolletta enel', 'casa', 80); // nuova, prende indice 8
  const net = VaultDAO.state.mlData.neuralNet;
  assert.equal(net.catIndex.spesa, 0);
  assert.equal(net.catIndex.crypto, 7);
  assert.equal(net.catIndex.casa, 8);
});

// ── fondiOutputPerNome: la fusione mesh deve seguire il NOME della
// categoria, mai la posizione — due dispositivi possono far crescere le
// loro reti in ordine diverso (PIANO_TASK_2026-08-21.md, seguito al
// Cantiere C4) ───────────────────────────────────────────────────────────

function rigaRiconoscibile(base, n = 12) {
  return Array.from({ length: n }, (_, j) => base + j);
}

test('fondiOutputPerNome: stesso ordine di categorie su entrambi i net -> equivale alla media per posizione (nessuna regressione)', () => {
  const catIndex = { spesa: 0, casa: 1 };
  const indexToCat = ['spesa', 'casa'];
  const localNet = { catIndex, indexToCat, W2: [rigaRiconoscibile(0), rigaRiconoscibile(100)], b2: [1, 2] };
  const remoteNet = { catIndex, indexToCat, W2: [rigaRiconoscibile(1000), rigaRiconoscibile(2000)], b2: [10, 20] };
  const { W2, b2, indexToCat: unione } = fondiOutputPerNome(localNet, remoteNet, 0.5, 0.5);
  assert.deepEqual(unione, ['spesa', 'casa']);
  assert.deepEqual(W2[0], rigaRiconoscibile(0).map((v, j) => v * 0.5 + rigaRiconoscibile(1000)[j] * 0.5));
  assert.equal(b2[0], 1 * 0.5 + 10 * 0.5);
  assert.deepEqual(W2[1], rigaRiconoscibile(100).map((v, j) => v * 0.5 + rigaRiconoscibile(2000)[j] * 0.5));
  assert.equal(b2[1], 2 * 0.5 + 20 * 0.5);
});

test('fondiOutputPerNome: BUG CORRETTO — categorie cresciute in ordine DIVERSO sui due dispositivi non si mescolano mai per posizione', () => {
  // Dispositivo locale: ha imparato prima "casa" (riga 0) poi "salute" (riga 1).
  const localNet = {
    catIndex: { casa: 0, salute: 1 },
    indexToCat: ['casa', 'salute'],
    W2: [rigaRiconoscibile(800), rigaRiconoscibile(900)], // riga0=casa, riga1=salute
    b2: [8, 9],
  };
  // Dispositivo remoto: stesso NOME "casa" ma cresciuto DOPO "salute" -> ordine invertito.
  const remoteNet = {
    catIndex: { salute: 0, casa: 1 },
    indexToCat: ['salute', 'casa'],
    W2: [rigaRiconoscibile(9000), rigaRiconoscibile(8000)], // riga0=salute, riga1=casa
    b2: [90, 80],
  };
  const { W2, b2, catIndex, indexToCat } = fondiOutputPerNome(localNet, remoteNet, 0.5, 0.5);

  const iCasa = catIndex.casa, iSalute = catIndex.salute;
  assert.notEqual(iCasa, iSalute);
  assert.equal(indexToCat[iCasa], 'casa');
  assert.equal(indexToCat[iSalute], 'salute');

  // "casa" fusa deve combinare SOLO le righe "casa" reali (800 locale, 8000 remoto) — mai con "salute".
  const attesaCasa = rigaRiconoscibile(800).map((v, j) => v * 0.5 + rigaRiconoscibile(8000)[j] * 0.5);
  assert.deepEqual(W2[iCasa], attesaCasa, 'la fusione di "casa" non deve mai contenere pesi di "salute"');
  assert.equal(b2[iCasa], 8 * 0.5 + 80 * 0.5);

  const attesaSalute = rigaRiconoscibile(900).map((v, j) => v * 0.5 + rigaRiconoscibile(9000)[j] * 0.5);
  assert.deepEqual(W2[iSalute], attesaSalute, 'la fusione di "salute" non deve mai contenere pesi di "casa"');
  assert.equal(b2[iSalute], 9 * 0.5 + 90 * 0.5);
});

test('fondiOutputPerNome: una categoria nota solo a UN dispositivo viene adottata inalterata (sapere asimmetrico)', () => {
  const localNet = {
    catIndex: { spesa: 0, cryptoLocaleSolo: 1 },
    indexToCat: ['spesa', 'cryptoLocaleSolo'],
    W2: [rigaRiconoscibile(0), rigaRiconoscibile(500)],
    b2: [1, 5],
  };
  const remoteNet = {
    catIndex: { spesa: 0 },
    indexToCat: ['spesa'],
    W2: [rigaRiconoscibile(1000)],
    b2: [10],
  };
  const { W2, b2, catIndex } = fondiOutputPerNome(localNet, remoteNet, 0.3, 0.7);
  const iSpesa = catIndex.spesa, iSolo = catIndex.cryptoLocaleSolo;
  assert.deepEqual(W2[iSpesa], rigaRiconoscibile(0).map((v, j) => v * 0.3 + rigaRiconoscibile(1000)[j] * 0.7));
  assert.deepEqual(W2[iSolo], rigaRiconoscibile(500), 'una categoria che il remoto non conosce resta quella locale, non modificata');
  assert.equal(b2[iSolo], 5);
});
