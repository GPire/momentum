import test from 'node:test';
import assert from 'node:assert/strict';

const { commitmentOccurrences, deriveCommitmentLabels, trainCommitments, labelFingerprint,
  commitmentNormality, judgeCommitmentPayment, enrichWithNormality } =
  await import('./commitment-training.js');

const luce = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 90, dayOfMonth: 12, kind: 'bolletta', variable: true };
const affitto = { id: 'a1', name: 'Affitto', merchant: 'Affitto', amount: 780, dayOfMonth: 5, kind: 'affitto' };

const bollette = (amounts, cat = 'spesa') => {
  const allTx = {};
  const mesi = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
  amounts.forEach((a, i) => {
    allTx[mesi[i]] = [{ type: 'uscita', amount: a, date: `${mesi[i]}-12`, description: 'Enel Energia',
      category: Array.isArray(cat) ? cat[i] : cat }];
  });
  return allTx;
};

// ── occorrenze ──────────────────────────────────────────────────────────────
test('commitmentOccurrences: una occorrenza per mese, in ordine di data', () => {
  const occ = commitmentOccurrences(luce, bollette([80, 110, 95]));
  assert.equal(occ.length, 3);
  assert.deepEqual(occ.map(o => o.date), ['2026-03-12', '2026-04-12', '2026-05-12']);
});

// ── etichette ───────────────────────────────────────────────────────────────
test('deriveCommitmentLabels: impara la categoria in cui archivi davvero quei pagamenti', () => {
  const l = deriveCommitmentLabels([luce], bollette([80, 110, 95]));
  assert.equal(l.length, 1);
  assert.equal(l[0].description, 'Enel');
  assert.equal(l[0].category, 'spesa');
  assert.equal(l[0].agreement, 1);
  assert.ok(l[0].confidence > 0.6);
});

test('deriveCommitmentLabels: TACE se le archiviazioni sono discordi (guardrail)', () => {
  const allTx = bollette([80, 110, 95, 100], ['spesa', 'trasporti', 'shopping', 'abbonamenti']);
  assert.deepEqual(deriveCommitmentLabels([luce], allTx), []);
});

test('deriveCommitmentLabels: una minoranza discorde non impedisce di imparare', () => {
  const allTx = bollette([80, 110, 95, 100], ['spesa', 'spesa', 'spesa', 'trasporti']);
  const l = deriveCommitmentLabels([luce], allTx);
  assert.equal(l[0].category, 'spesa');
  assert.equal(l[0].agreement, 0.75);
});

test('deriveCommitmentLabels: sotto minSamples non insegna nulla', () => {
  assert.deepEqual(deriveCommitmentLabels([luce], bollette([80])), []);
});

test('deriveCommitmentLabels: la categoria DICHIARATA sull\'impegno vale anche senza storico', () => {
  const l = deriveCommitmentLabels([{ ...luce, category: 'abbonamenti' }], {});
  assert.equal(l[0].category, 'abbonamenti');
  assert.equal(l[0].source, 'dichiarata');
  assert.ok(l[0].confidence >= 0.9);
});

test('deriveCommitmentLabels: la confidenza cresce con le occorrenze concordi', () => {
  const poche = deriveCommitmentLabels([luce], bollette([80, 110]))[0];
  const molte = deriveCommitmentLabels([luce], bollette([80, 110, 95, 100, 90]))[0];
  assert.ok(molte.confidence > poche.confidence);
  assert.ok(molte.confidence < 1, 'mai certezza assoluta: resta una misura');
});

// ── addestramento ───────────────────────────────────────────────────────────
function fakeOrchestrator() {
  const calls = [];
  return { calls, learn: (d, c, a, date) => calls.push({ d, c, a, date }) };
}

test('trainCommitments: insegna al Core la coppia esercente → categoria', () => {
  const o = fakeOrchestrator();
  const r = trainCommitments(o, [luce], bollette([80, 110, 95]));
  assert.equal(o.calls[0].d, 'Enel');
  assert.equal(o.calls[0].c, 'spesa');
  assert.equal(r.taught.length, 1);
});

test('trainCommitments: porta tanta evidenza quante sono le occorrenze concordi', () => {
  // un\'osservazione sola non basta (e non deve): la gerarchia si astiene sotto 2.
  const o = fakeOrchestrator();
  const r = trainCommitments(o, [luce], bollette([80, 110, 95]));
  assert.equal(o.calls.length, 3);
  assert.equal(r.taught[0].evidence, 3);
});

test('trainCommitments: il TETTO impedisce a un impegno lunghissimo di schiacciare l\'albero', () => {
  const allTx = {};
  for (let i = 1; i <= 12; i++) {
    const m = `2025-${String(i).padStart(2, '0')}`;
    allTx[m] = [{ type: 'uscita', amount: 90, date: `${m}-12`, description: 'Enel Energia', category: 'spesa' }];
  }
  const o = fakeOrchestrator();
  const r = trainCommitments(o, [luce], allTx);
  assert.equal(o.calls.length, 5, 'cap a 5 osservazioni');
  assert.equal(r.taught[0].evidence, 5);
});

test('trainCommitments: una categoria dichiarata a mano vale il minimo per essere ascoltata', () => {
  const o = fakeOrchestrator();
  trainCommitments(o, [{ ...luce, category: 'abbonamenti' }], {});
  assert.equal(o.calls.length, 2);
});

test('trainCommitments: NON riaddestra la stessa etichetta due volte', () => {
  const o = fakeOrchestrator();
  const allTx = bollette([80, 110, 95]);
  const first = trainCommitments(o, [luce], allTx);
  const n = o.calls.length;
  const second = trainCommitments(o, [luce], allTx, { seen: first.seen });
  assert.equal(o.calls.length, n, 'il secondo giro non deve insegnare di nuovo');
  assert.equal(second.taught.length, 0);
});

test('trainCommitments: un mese in più cambia l\'impronta e riaddestra (segnale nuovo)', () => {
  const o = fakeOrchestrator();
  const first = trainCommitments(o, [luce], bollette([80, 110, 95]));
  const n = o.calls.length;
  const second = trainCommitments(o, [luce], bollette([80, 110, 95, 105]), { seen: first.seen });
  assert.equal(second.taught.length, 1);
  assert.ok(o.calls.length > n);
});

test('trainCommitments: un orchestratore che esplode non rompe nulla', () => {
  const o = { learn: () => { throw new Error('boom'); } };
  const r = trainCommitments(o, [luce], bollette([80, 110, 95]));
  assert.deepEqual(r.taught, []);
});

test('trainCommitments: sotto la soglia di confidenza non insegna', () => {
  const o = fakeOrchestrator();
  trainCommitments(o, [luce], bollette([80, 110, 95]), { minConfidence: 0.99 });
  assert.equal(o.calls.length, 0);
});

test('labelFingerprint: cambia se cambia la categoria appresa', () => {
  const a = { id: 'x', description: 'Enel', category: 'spesa', samples: 3 };
  const b = { ...a, category: 'trasporti' };
  assert.notEqual(labelFingerprint(a), labelFingerprint(b));
});

// ── normalità per impegno ───────────────────────────────────────────────────
test('commitmentNormality: banda misurata sui pagamenti reali, tace sotto 3 campioni', () => {
  assert.equal(commitmentNormality(luce, bollette([80, 110])), null);
  const n = commitmentNormality(luce, bollette([80, 110, 95]));
  assert.equal(n.samples, 3);
  assert.ok(n.low < n.typical && n.typical < n.high);
  assert.ok(n.method.includes('MAD'));
});

test('commitmentNormality: una rata identica ogni mese ha una banda minima, non nulla', () => {
  const allTx = {};
  for (const m of ['2026-04', '2026-05', '2026-06']) {
    allTx[m] = [{ type: 'uscita', amount: 780, date: `${m}-05`, description: 'Affitto', category: 'spesa' }];
  }
  const n = commitmentNormality(affitto, allTx);
  assert.ok(n.high > n.typical, 'banda minima: 2 centesimi di scarto non sono un\'anomalia');
  assert.ok(n.high - n.typical < 30);
});

test('judgeCommitmentPayment: riconosce come NORMALE una bolletta variabile nella sua banda', () => {
  const j = judgeCommitmentPayment(luce, 120, bollette([80, 110, 95, 130]));
  assert.equal(j.level, 'normale');
  assert.ok(j.message.includes('Nella norma'));
});

test('judgeCommitmentPayment: segnala fuori scala con la cifra, senza giudizi', () => {
  const j = judgeCommitmentPayment(luce, 400, bollette([80, 110, 95, 100]));
  assert.equal(j.level, 'sopra');
  assert.ok(j.deltaPct > 200);
  assert.ok(j.message.includes('sopra il tuo solito'));
  assert.ok(!/sbagliato|male|troppo/i.test(j.message), 'niente giudizio, solo il fatto');
});

test('judgeCommitmentPayment: un importo molto basso invita a controllare', () => {
  const j = judgeCommitmentPayment(luce, 5, bollette([80, 110, 95, 100]));
  assert.equal(j.level, 'sotto');
  assert.ok(j.message.includes('controlla'));
});

test('judgeCommitmentPayment: tace senza abbastanza storico', () => {
  assert.equal(judgeCommitmentPayment(luce, 400, bollette([80])), null);
});

// ── ponte verso il forecast ─────────────────────────────────────────────────
test('enrichWithNormality: passa al forecast la forbice reale dell\'impegno', () => {
  const [c] = enrichWithNormality([luce], bollette([60, 150, 95, 120]));
  assert.ok(c.learnedMin < c.learnedMax);
  assert.ok(c.typical > 0);
  assert.equal(c.learned, true);
  assert.ok(c.normalitySamples >= 3);
});

test('enrichWithNormality: senza storico lascia l\'impegno com\'è', () => {
  const [c] = enrichWithNormality([luce], {});
  assert.equal(c.learnedMin, undefined);
  assert.equal(c.amount, 90);
});
