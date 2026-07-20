import test from 'node:test';
import assert from 'node:assert/strict';
const { evalReport, compareModels } = await import('./model-gate.js');

const mockModel = (rules) => ({ predict: (text) => ({ category: rules[text] ?? '?' }) });

const dataset = [
  { text: 'a1', cat: 'spesa' }, { text: 'a2', cat: 'spesa' }, { text: 'a3', cat: 'spesa' }, { text: 'a4', cat: 'spesa' },
  { text: 'b1', cat: 'trasporti' }, { text: 'b2', cat: 'trasporti' }, { text: 'b3', cat: 'trasporti' }, { text: 'b4', cat: 'trasporti' },
];

test('evalReport: accuratezza globale e per categoria calcolate correttamente', () => {
  const model = mockModel({ a1: 'spesa', a2: 'spesa', a3: 'trasporti', a4: 'spesa', b1: 'trasporti', b2: 'trasporti', b3: 'trasporti', b4: 'spesa' });
  const r = evalReport(model, dataset);
  assert.equal(r.n, 8);
  assert.equal(r.perCat.spesa, 75);      // 3/4 giuste
  assert.equal(r.perCat.trasporti, 75);  // 3/4 giuste
  assert.equal(r.acc, 75);
});

test('evalReport: dataset vuoto -> acc null, mai un numero inventato', () => {
  const r = evalReport(mockModel({}), []);
  assert.equal(r.acc, null);
  assert.equal(r.n, 0);
});

test('evalReport: categoria attesa ma assente dal dataset -> perCat[cat]=null, non 0 finto', () => {
  const model = mockModel({ a1: 'spesa' });
  const r = evalReport(model, [{ text: 'a1', cat: 'spesa' }], ['spesa', 'crypto']);
  assert.equal(r.perCat.crypto, null);
});

test('compareModels: candidato migliora ovunque -> pass', () => {
  const baseline = { acc: 80, perCat: { spesa: 80, trasporti: 80 } };
  const candidate = { acc: 85, perCat: { spesa: 85, trasporti: 85 } };
  const r = compareModels(baseline, candidate);
  assert.equal(r.pass, true);
  assert.deepEqual(r.reasons, []);
});

test('compareModels: accuratezza globale scesa oltre epsilon -> fail', () => {
  const baseline = { acc: 90, perCat: { spesa: 90 } };
  const candidate = { acc: 85, perCat: { spesa: 85 } };
  const r = compareModels(baseline, candidate, { epsilon: 0.3 });
  assert.equal(r.pass, false);
  assert.ok(r.reasons[0].includes('accuratezza globale scesa'));
});

test('compareModels: piccolo calo entro epsilon -> pass (tolleranza rispettata)', () => {
  const baseline = { acc: 90, perCat: { spesa: 90 } };
  const candidate = { acc: 89.8, perCat: { spesa: 89.8 } };
  const r = compareModels(baseline, candidate, { epsilon: 0.3 });
  assert.equal(r.pass, true);
});

test('compareModels: media che SALE ma una categoria CROLLA -> fail (il caso critico, killer "update rotti")', () => {
  // media: (95+95+95)/3=95 -> (99+99+82)/3≈93.3, sale leggermente in alcuni
  // scenari ma qui la costruiamo esplicitamente per far salire la media
  // globale mentre "crypto" crolla di 13 punti.
  const baseline = { acc: 90, perCat: { spesa: 95, trasporti: 90, crypto: 85 } };
  const candidate = { acc: 91, perCat: { spesa: 98, trasporti: 96, crypto: 72 } }; // media sale, crypto crolla -13
  const r = compareModels(baseline, candidate, { epsilon: 0.3, maxPerCatDrop: 3.0 });
  assert.equal(r.pass, false, 'la media che sale non deve mascherare il crollo su crypto');
  assert.equal(r.worstCat, 'crypto');
  assert.ok(r.reasons.some(s => s.includes('crypto')));
});

test('compareModels: categoria assente in uno dei due report non blocca il confronto sulle altre', () => {
  const baseline = { acc: 90, perCat: { spesa: 90, nuova: null } };
  const candidate = { acc: 90, perCat: { spesa: 90 } }; // 'nuova' non valutata nel candidato
  const r = compareModels(baseline, candidate);
  assert.equal(r.pass, true);
});

test('compareModels: dataset di valutazione vuoto (acc null) -> fail esplicito, mai un confronto finto', () => {
  const r = compareModels({ acc: null, perCat: {} }, { acc: 90, perCat: {} });
  assert.equal(r.pass, false);
  assert.ok(r.reasons[0].includes('vuoto'));
});
