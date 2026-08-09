import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initDriftState, observeRound, peerVerdict, driftWeight,
  detectCollusion, combinedWeight, driftText,
  SOGLIA_H, MIN_ROUND,
} from './contribution-drift.js';

const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// Una rete di peer onesti: ognuno propone il valore vero più rumore proprio.
const rete = (r, onesti, extra = {}, vero = 0.5, sigma = 0.05) => {
  const c = {};
  for (const id of onesti) c[id] = vero + gauss(r) * sigma;
  for (const [id, delta] of Object.entries(extra)) c[id] = vero + delta;
  return c;
};

const ONESTI = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

// ── Chi si comporta bene non viene mai accusato ──

test('cento round di soli peer onesti: nessun sospetto, nessun peso ridotto', () => {
  const r = rng(3);
  let s = initDriftState();
  for (let i = 0; i < 100; i++) s = observeRound(s, rete(r, ONESTI));
  for (const id of ONESTI) {
    const v = peerVerdict(s, id);
    assert.equal(v.sospetto, false, `${id} accusato ingiustamente: cusum ${v.cusum}, persistenza ${v.persistenza}`);
    assert.equal(driftWeight(s, id), 1);
  }
});

test('un peer semplicemente RUMOROSO non è un attaccante: devia molto ma in direzioni che cambiano', () => {
  const r = rng(5);
  let s = initDriftState();
  for (let i = 0; i < 60; i++) {
    const c = rete(r, ONESTI);
    c.rumoroso = 0.5 + gauss(r) * 0.4; // dieci volte il rumore degli altri
    s = observeRound(s, c);
  }
  const v = peerVerdict(s, 'rumoroso');
  assert.equal(v.sospetto, false, 'deviare tanto non basta: serve deviare sempre dalla stessa parte');
  assert.ok(v.persistenza < 0.75, `persistenza ${v.persistenza}: deve restare vicino al caso`);
});

test('con pochi round non si accusa nessuno, e si dice perché', () => {
  const r = rng(7);
  let s = initDriftState();
  for (let i = 0; i < 4; i++) s = observeRound(s, rete(r, ONESTI, { cattivo: 0.3 }));
  const v = peerVerdict(s, 'cattivo');
  assert.equal(v.giudicabile, false);
  assert.equal(v.sospetto, false);
  assert.match(v.motivo, /troppo poco per parlare di tendenza/);
  assert.equal(driftWeight(s, 'cattivo'), 1, 'nessuna penalità su un giudizio che non si può dare');
});

test('con meno di tre opinioni il round non conta: la mediana non direbbe niente', () => {
  let s = initDriftState();
  s = observeRound(s, { a: 0.5, b: 0.9 });
  assert.equal(s.round, 0);
});

// ── L'ATTACCO CHE UN ROUND SOLO NON VEDE ──

test('L\'AVVELENAMENTO LENTO viene scoperto: passi piccoli, sempre nella stessa direzione', () => {
  const r = rng(11);
  let s = initDriftState();
  // Lo scarto e' circa metà del rumore onesto: in nessun singolo round questo
  // dispositivo sarebbe scartato da un controllo per outlier.
  for (let i = 0; i < 40; i++) s = observeRound(s, rete(r, ONESTI, { lento: 0.03 }));

  const v = peerVerdict(s, 'lento');
  assert.equal(v.sospetto, true, `avvelenamento lento non rilevato: cusum ${v.cusum}, persistenza ${v.persistenza}`);
  assert.equal(v.verso, 'alto');
  assert.ok(v.cusum >= SOGLIA_H);
  assert.match(v.motivo, /sempre nello stesso senso/);
  assert.ok(driftWeight(s, 'lento') < 1, 'il suo parere deve contare meno');
});

test('lo stesso scarto, ma di segno alternato, NON fa scattare niente — è la prova che misura la direzione', () => {
  const r = rng(11);
  let s = initDriftState();
  for (let i = 0; i < 40; i++) s = observeRound(s, rete(r, ONESTI, { altalena: i % 2 ? 0.03 : -0.03 }));
  assert.equal(peerVerdict(s, 'altalena').sospetto, false);
});

test('nessun singolo round basterebbe: lo scarto è sotto il rumore normale della rete', () => {
  const r = rng(13);
  let s = initDriftState();
  let zMax = 0;
  const zs = [];
  for (let i = 0; i < 40; i++) {
    s = observeRound(s, rete(r, ONESTI, { lento: 0.03 }));
    zMax = Math.max(zMax, Math.abs(s.peer.lento.ultimoZ));
    zs.push(Math.abs(s.peer.lento.ultimoZ));
  }
  // Lo scarto TIPICO e' la misura giusta: nella meta' dei round questo
  // dispositivo devia meno di mezza deviazione, cioe' meno di parecchi peer
  // onesti. Nessun controllo round-per-round lo scarterebbe mai.
  const ordinati = [...zs].sort((a, b) => a - b);
  const zMediano = ordinati[Math.floor(ordinati.length / 2)];
  assert.ok(zMediano < 1, `scarto tipico di un round: ${zMediano} deviazioni`);
  // Lo scarto TIPICO di ogni singolo round resta piccolo: qualunque controllo
  // round-per-round lo lascerebbe passare, che è il disegno degli attacchi
  // documentati. (Il massimo puntuale può schizzare quando gli onesti si
  // trovano d'accordo per caso e la scala si stringe: per questo z è limitato.)
  assert.ok(zMax <= 4, `z limitato per costruzione: ${zMax}`);
  assert.equal(peerVerdict(s, 'lento').sospetto, true, 'eppure la traiettoria lo tradisce');
});

test('un attacco che si ferma lascia il peso risalire: nessuna condanna definitiva', () => {
  const r = rng(17);
  let s = initDriftState();
  for (let i = 0; i < 30; i++) s = observeRound(s, rete(r, ONESTI, { pentito: 0.04 }));
  const durante = driftWeight(s, 'pentito');
  assert.ok(durante < 1);
  // Ora si comporta bene, e per giunta dall'altra parte: la somma rientra.
  for (let i = 0; i < 80; i++) s = observeRound(s, rete(r, [...ONESTI, 'pentito']));
  assert.ok(driftWeight(s, 'pentito') >= durante, 'chi rientra deve poter tornare a contare');
});

test('il peso non si azzera mai del tutto: un falso positivo non deve essere definitivo', () => {
  const r = rng(19);
  let s = initDriftState();
  for (let i = 0; i < 80; i++) s = observeRound(s, rete(r, ONESTI, { aggressivo: 0.5 }));
  const w = driftWeight(s, 'aggressivo');
  assert.ok(w >= 0.1 && w < 0.5, `peso ${w}: ridotto ma non annullato`);
});

// ── La collusione: innocenti uno per uno, colpevoli insieme ──

test('TRE DISPOSITIVI CHE SPINGONO INSIEME: presi singolarmente sembrano normali', () => {
  const r = rng(23);
  let s = initDriftState();
  for (let i = 0; i < 30; i++) {
    // Ognuno spinge pochissimo, ma sempre tutti e tre dalla stessa parte.
    s = observeRound(s, rete(r, ONESTI, { x1: 0.012, x2: 0.012, x3: 0.012 }));
  }
  const c = detectCollusion(s);
  assert.equal(c.sospetto, true, 'il movimento coordinato deve emergere');
  const gruppo = c.gruppi.find((g) => g.length >= 3);
  assert.ok(gruppo && ['x1', 'x2', 'x3'].every((x) => gruppo.includes(x)), `gruppo trovato: ${JSON.stringify(c.gruppi)}`);
  assert.match(c.motivo, /uno per uno sembrerebbero normali/);
});

test('peer onesti non vengono accusati di colludere solo perché a volte concordano', () => {
  const r = rng(29);
  let s = initDriftState();
  for (let i = 0; i < 60; i++) s = observeRound(s, rete(r, ONESTI));
  assert.equal(detectCollusion(s).sospetto, false);
});

test('la collusione abbassa ulteriormente il peso, e si compone con la reputazione esistente', () => {
  const r = rng(31);
  let s = initDriftState();
  for (let i = 0; i < 30; i++) s = observeRound(s, rete(r, ONESTI, { x1: 0.012, x2: 0.012, x3: 0.012 }));
  const c = detectCollusion(s);
  const senza = combinedWeight(s, 'x1', 1);
  const con = combinedWeight(s, 'x1', 1, { collusione: c });
  assert.ok(con < senza, `${con} deve essere sotto ${senza}`);
  // Reputazione bassa e deriva si moltiplicano: due domande diverse, due prove.
  assert.ok(combinedWeight(s, 'x1', 0.3, { collusione: c }) < con);
  assert.ok(combinedWeight(s, 'a', 1) === 1, 'un onesto non viene toccato');
});

// ── Come si racconta ──

test('non si allarma nessuno quando non c\'è niente da dire', () => {
  const r = rng(37);
  let s = initDriftState();
  for (let i = 0; i < 40; i++) s = observeRound(s, rete(r, ONESTI));
  assert.equal(driftText(s, 'a'), null);
});

test('quando c\'è qualcosa da dire, si dice senza gergo e dicendo cosa si è fatto', () => {
  const r = rng(41);
  let s = initDriftState();
  for (let i = 0; i < 40; i++) s = observeRound(s, rete(r, ONESTI, { lento: 0.02 }));
  const t = driftText(s, 'lento');
  assert.match(t, /sempre dalla stessa parte/);
  assert.match(t, /Ho ridotto quanto conta il suo parere/);
  assert.ok(!/CUSUM|deriva|mediana|z-score|peer/i.test(t), `gergo nel testo: ${t}`);
});

// ── L'innesto: si compone con la reputazione già esistente ──

test('INNESTO: il peso di deriva moltiplica la reputazione di update-ledger, non la sostituisce', async () => {
  const { appendUpdate, reputationWeight } = await import('./update-ledger.js');
  const r = rng(43);
  let s = initDriftState();
  for (let i = 0; i < 40; i++) s = observeRound(s, rete(r, ONESTI, { lento: 0.02 }));

  // Un peer che non ha MAI mentito in modo verificabile: la reputazione lo
  // promuove, la traiettoria no. Sono due prove indipendenti, e devono
  // convivere invece di annullarsi.
  let ledger = [];
  for (let i = 0; i < 10; i++) ledger = appendUpdate(ledger, { peerId: 'lento', accepted: true, examplesBefore: i, examplesAfter: i + 1 });
  const rep = reputationWeight(ledger, 'lento', 1);
  assert.ok(rep > 0.5, `reputazione buona: ${rep}`);
  const w = combinedWeight(s, 'lento', rep);
  assert.ok(w < rep, `la traiettoria deve pesare anche su chi la reputazione promuove: ${w} vs ${rep}`);
});
