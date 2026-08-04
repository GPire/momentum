import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRINCIPI, testCosti, testDiversificazione, testInversione,
  testDistinguibilita, testRiflessivita, evaluatePrinciples,
} from './master-principles.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}
const gauss = (rnd) => {
  const u1 = Math.max(1e-9, rnd()), u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ── Ogni principio deve dichiarare cosa lo renderebbe FALSO ──
// Senza questo è una citazione, non un'ipotesi.

test('ogni principio dichiara cosa lo falsificherebbe, o dichiara di non essere testabile', () => {
  for (const [nome, p] of Object.entries(PRINCIPI)) {
    assert.ok(p.maestro && p.afferma, `${nome} deve dire chi lo sostiene e cosa afferma`);
    if (p.forza === 'non-testabile') {
      assert.equal(p.falsificabile, null);
      assert.ok(p.nota, `${nome} non testabile deve spiegare PERCHÉ`);
    } else {
      assert.ok(p.falsificabile && p.falsificabile.length > 20, `${nome} deve dire cosa lo renderebbe falso`);
    }
  }
});

test('ogni principio ha una spiegazione comprensibile a un bambino, senza gergo', () => {
  for (const [nome, p] of Object.entries(PRINCIPI)) {
    assert.ok(p.perBambini && p.perBambini.length > 20, `${nome} manca la spiegazione semplice`);
    assert.ok(!/Sharpe|drawdown|volatilit|correlazion|alfa|beta/i.test(p.perBambini),
      `${nome}: gergo nella spiegazione semplice — ${p.perBambini}`);
  }
});

// ── Bogle: i costi ──

test('COSTI: l\'effetto composto viene calcolato, non stimato a occhio', () => {
  const t = testCosti({ rendimentoLordo: 0.07, costoAnnuo: 0.02, anni: 30, capitale: 10000 });
  assert.equal(t.confermato, true);
  // 1.07^30 ≈ 7.61 ; 1.05^30 ≈ 4.32 → si perde oltre il 40%
  assert.ok(t.quotaPersa > 40, `atteso oltre il 40% perso, misurato ${t.quotaPersa}%`);
  assert.match(t.messaggio, /si mangia/);
});

test('COSTI: un costo nullo non fa perdere nulla', () => {
  const t = testCosti({ rendimentoLordo: 0.07, costoAnnuo: 0, anni: 20 });
  assert.equal(t.perso, 0);
  assert.equal(t.quotaPersa, 0);
});

test('COSTI: dati mancanti non producono un numero inventato', () => {
  assert.equal(testCosti({ rendimentoLordo: 0.07 }), null);
});

// ── Dalio: la diversificazione ──

test('DIVERSIFICAZIONE: fonti davvero scorrelate riducono la perdita peggiore', () => {
  const rnd = rng(5);
  const n = 240;
  const a = Array.from({ length: n }, () => 0.005 + 0.05 * gauss(rnd));
  const b = Array.from({ length: n }, () => 0.005 + 0.05 * gauss(rnd)); // indipendente
  const t = testDiversificazione([a, b]);
  assert.equal(t.confermato, true, `atteso confermato: ${JSON.stringify(t)}`);
  assert.match(t.messaggio, /la perdita peggiore scende/);
});

// IL test che smaschera la falsa diversificazione: è l'errore più comune di
// chi crede di essere protetto e non lo è.
test('DIVERSIFICAZIONE FALSA: pezzi che si muovono insieme vengono smascherati', () => {
  const rnd = rng(7);
  const n = 240;
  const comune = Array.from({ length: n }, () => 0.005 + 0.05 * gauss(rnd));
  const a = comune.map((v) => v + 0.002 * gauss(rnd));
  const b = comune.map((v) => v + 0.002 * gauss(rnd)); // quasi identico ad a
  const t = testDiversificazione([a, b]);
  assert.equal(t.confermato, false, `pezzi correlati NON sono diversificazione: ${JSON.stringify(t)}`);
  assert.match(t.messaggio, /non è vera diversificazione/);
});

test('DIVERSIFICAZIONE: con una sola serie non si conclude nulla', () => {
  assert.equal(testDiversificazione([[0.01, 0.02, 0.03, 0.04]]), null);
});

// ── Munger: l'inversione ──

test('INVERSIONE: su rendimenti composti evitare i disastri conta più che prendere i picchi', () => {
  const rnd = rng(11);
  const r = Array.from({ length: 200 }, () => 0.004 + 0.06 * gauss(rnd));
  const t = testInversione(r, { quanti: 5 });
  assert.ok(t !== null);
  assert.ok(Number.isFinite(t.evitandoIPeggiori) && Number.isFinite(t.mancandoIMigliori));
  assert.ok(t.messaggio.length > 20);
});

test('INVERSIONE: con troppi pochi dati non si conclude', () => {
  assert.equal(testInversione([0.01, 0.02, -0.03], { quanti: 5 }), null);
});

// ── Simons: distinguibilità dal caso ──

test('DISTINGUIBILITÀ: una serie senza vantaggio reale non viene confermata', () => {
  const rnd = rng(13);
  const r = Array.from({ length: 200 }, () => 0.04 * gauss(rnd)); // media zero
  const t = testDistinguibilita(r, { tentativi: 20 });
  assert.equal(t.confermato, false, `una serie senza vantaggio non deve passare: ${JSON.stringify(t)}`);
});

test('DISTINGUIBILITÀ: un vantaggio vero e forte viene confermato', () => {
  const rnd = rng(17);
  const r = Array.from({ length: 600 }, () => 0.025 + 0.03 * gauss(rnd));
  const t = testDistinguibilita(r, { tentativi: 8 });
  assert.equal(t.confermato, true, JSON.stringify(t));
});

// ── Soros: riflessività come anello di retroazione ──

test('RIFLESSIVITÀ: un anello tra prezzo e fondamentali conferma il principio', () => {
  const cicli = { cicli: [{ nodi: ['Prezzo', 'Utili'], passi: 2, lagTotale: 2, nota: '' }], presenti: true };
  const t = testRiflessivita(cicli, { nodiPrezzo: ['Prezzo'], nodiFondamentali: ['Utili'] });
  assert.equal(t.confermato, true);
  assert.match(t.messaggio, /sta anche cambiando/);
});

test('RIFLESSIVITÀ: senza anello si dice che il prezzo segue, non guida', () => {
  const t = testRiflessivita({ cicli: [], presenti: false }, { nodiPrezzo: ['Prezzo'], nodiFondamentali: ['Utili'] });
  assert.equal(t.confermato, false);
  assert.match(t.messaggio, /sembra seguire, non guidare/);
});

test('RIFLESSIVITÀ: un anello che NON coinvolge prezzo e fondamentali non conta', () => {
  const cicli = { cicli: [{ nodi: ['A', 'B'], passi: 2, lagTotale: 2, nota: '' }], presenti: true };
  const t = testRiflessivita(cicli, { nodiPrezzo: ['Prezzo'], nodiFondamentali: ['Utili'] });
  assert.equal(t.confermato, false);
});

// ── Il referto complessivo ──

test('REFERTO: distingue confermati, smentiti e NON VERIFICABILI', () => {
  const rnd = rng(19);
  const r = Array.from({ length: 200 }, () => 0.04 * gauss(rnd));
  const res = evaluatePrinciples({
    costi: { rendimentoLordo: 0.07, costoAnnuo: 0.015, anni: 25 },
    rendimenti: r,
    tentativi: 10,
  });
  assert.ok(res.esiti.length >= 2);
  assert.ok(res.nonTestabili.length > 0, 'i principi non verificabili vanno elencati, non fatti sparire');
  assert.match(res.riassunto, /reggono sui tuoi dati|principio regge/);
});

test('REFERTO: il principio di Lynch è dichiarato non testabile, non finto verificato', () => {
  const res = evaluatePrinciples({ costi: { rendimentoLordo: 0.06, costoAnnuo: 0.01 } });
  const lynch = res.nonTestabili.find((p) => p.principio === 'comprensione');
  assert.ok(lynch, 'il principio non testabile deve comparire esplicitamente');
  assert.equal(lynch.confermato, null);
  assert.match(lynch.messaggio, /non si può verificare sui prezzi/);
});

test('REFERTO: l\'avvertenza protegge dall\'errore di generalizzare', () => {
  const res = evaluatePrinciples({ costi: { rendimentoLordo: 0.06, costoAnnuo: 0.01 } });
  assert.match(res.avvertenza, /pochi dati non smentiscono nulla/);
});

test('REFERTO: senza alcun dato non si inventa nessun verdetto', () => {
  const res = evaluatePrinciples({});
  assert.deepEqual(res.esiti, []);
  assert.ok(res.nonTestabili.length > 0);
});

test('nessun testo del referto dà indicazioni di acquisto', () => {
  const rnd = rng(23);
  const res = evaluatePrinciples({
    costi: { rendimentoLordo: 0.07, costoAnnuo: 0.02 },
    rendimenti: Array.from({ length: 200 }, () => 0.04 * gauss(rnd)),
    serieRendimenti: [
      Array.from({ length: 100 }, () => 0.05 * gauss(rnd)),
      Array.from({ length: 100 }, () => 0.05 * gauss(rnd)),
    ],
  });
  const testo = [res.riassunto, res.avvertenza, ...res.esiti.map((e) => e.messaggio)].join(' ');
  assert.ok(!/\bcompra\b|\bvendi\b|dovresti investire|ti consigliamo di/i.test(testo),
    `nessun consiglio operativo ammesso: ${testo}`);
});

// I rendimenti possono superare il +100% senza limite, e sotto il −100% solo
// con la leva. Questi test fissano la distinzione, che e' sostanziale.

test('un rendimento oltre il +100% e legittimo e non viene toccato', () => {
  const esplosivo = [3.2, -0.4, 1.8, 0.2, -0.3, 2.5, 0.1, -0.2];
  const calmo = [0.02, 0.01, -0.01, 0.03, 0.0, 0.02, -0.02, 0.01];
  const t = testDiversificazione([esplosivo, calmo]);
  assert.equal(t.valoriSospetti, 0, 'un +320% e possibile: nessun sospetto');
  assert.equal(t.attendibile, true);
});

test('POSIZIONE SENZA DEBITO: sotto il −100% e un dato sbagliato, e si dice', () => {
  const impossibile = [0.1, -1.8, 0.2, -2.5, 0.3, 0.1, -0.2, 0.4];
  const normale = [0.05, 0.02, -0.1, 0.03, 0.01, -0.05, 0.02, 0.04];
  const t = testDiversificazione([impossibile, normale], { tipoPosizione: 'lunga' });
  assert.ok(t.valoriSospetti > 0, 'i valori impossibili vanno contati');
  assert.equal(t.attendibile, false);
  assert.match(t.avviso, /non e possibile perdere piu di tutto|non è possibile perdere più di tutto/);
  assert.match(t.avviso, /leva/, 'deve suggerire la spiegazione alternativa, non solo accusare i dati');
});

test('CON LEVA: sotto il −100% e legittimo e NON viene segnalato come errore', () => {
  const conLeva = [0.1, -1.8, 0.2, -2.5, 0.3, 0.1, -0.2, 0.4];
  const normale = [0.05, 0.02, -0.1, 0.03, 0.01, -0.05, 0.02, 0.04];
  const t = testDiversificazione([conLeva, normale], { tipoPosizione: 'leva' });
  assert.equal(t.valoriSospetti, 0, 'con la leva perdere piu del capitale e possibile davvero');
  assert.equal(t.attendibile, true);
  assert.equal(t.tipoPosizione, 'leva');
});

test('AZZERAMENTO: quando il capitale arriva a zero il calcolo si ferma li', () => {
  const rovinato = [-0.5, -0.6, -0.9, -0.99, 5.0, 10.0, 3.0, 2.0]; // il recupero arriva troppo tardi
  const normale = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
  const t = testDiversificazione([rovinato, normale], { tipoPosizione: 'leva' });
  assert.ok(t.perditaPeggioreMedia >= -100, `perdita fuori scala: ${t.perditaPeggioreMedia}%`);
  if (t.volteAzzerato > 0) {
    assert.match(t.avvisoAzzeramento, /da li non si recupera piu|da lì non si recupera più/);
  }
});

test('nessuna perdita massima puo superare il −100% del capitale investito', () => {
  const casi = [
    [-0.99, -0.99, -0.99, -0.99, 0.5, 0.5, 0.5, 0.5],
    [-3, 2, -4, 5, -1.5, 0.2, 0.3, 0.4],
  ];
  const normale = [0.01, 0.02, 0.01, 0.0, 0.01, 0.02, 0.0, 0.01];
  for (const c of casi) {
    for (const tipo of ['lunga', 'leva']) {
      const t = testDiversificazione([c, normale], { tipoPosizione: tipo });
      assert.ok(t.perditaPeggioreUnita >= -100 && t.perditaPeggioreMedia >= -100,
        `${tipo}: perdita impossibile ${t.perditaPeggioreUnita} / ${t.perditaPeggioreMedia}`);
    }
  }
});

test('con dati validi il risultato e dichiarato attendibile', () => {
  const rnd = rng(77);
  const a = Array.from({ length: 120 }, () => 0.004 + 0.03 * gauss(rnd));
  const b = Array.from({ length: 120 }, () => 0.004 + 0.03 * gauss(rnd));
  const t = testDiversificazione([a, b]);
  assert.equal(t.attendibile, true);
  assert.equal(t.valoriSospetti, 0);
});
