import test from 'node:test';
import assert from 'node:assert/strict';
const { combineConfidence, crossDomainWhatIf } = await import('./reasoning-fusion.js');

test('combineConfidence: nessun layer -> confidenza 0, nessuna invenzione', () => {
  const r = combineConfidence([]);
  assert.equal(r.confidence, 0);
  assert.equal(r.coverage, 0);
});

test('combineConfidence: tutti i layer rispondono -> copertura piena, nessuno sconto', () => {
  const r = combineConfidence([{ name: 'a', ok: true, confidence: 0.8 }, { name: 'b', ok: true, confidence: 0.8 }]);
  assert.equal(r.coverage, 1);
  assert.equal(r.agree, true);
  assert.equal(r.confidence, 0.8); // avg 0.8 * (0.5+0.5*1) = 0.8, nessuno sconto
});

test('combineConfidence: copertura parziale sconta la confidenza combinata', () => {
  const full = combineConfidence([{ name: 'a', ok: true, confidence: 0.8 }, { name: 'b', ok: true, confidence: 0.8 }]);
  const partial = combineConfidence([{ name: 'a', ok: true, confidence: 0.8 }, { name: 'b', ok: false }]);
  assert.ok(partial.confidence < full.confidence);
  assert.deepEqual(partial.missing, ['b']);
});

test('combineConfidence: nessun layer risponde -> confidenza 0, missing = tutti', () => {
  const r = combineConfidence([{ name: 'a', ok: false }, { name: 'b', ok: false }]);
  assert.equal(r.confidence, 0);
  assert.deepEqual(r.missing, ['a', 'b']);
});

const allTx = {
  '2026-04': [{ date: '2026-04-05', amount: 300, type: 'uscita', category: 'ristorazione' }],
  '2026-05': [{ date: '2026-05-05', amount: 320, type: 'uscita', category: 'ristorazione' }],
  '2026-06': [{ date: '2026-06-05', amount: 310, type: 'uscita', category: 'ristorazione' }],
};

test('crossDomainWhatIf: con storico reale produce whatIf + twin, layer entrambi ok', () => {
  const r = crossDomainWhatIf({ allTx, category: 'ristorazione', deltaPct: -20, referenceDate: new Date(2026, 6, 15), netWorthStart: 1000, years: 1 });
  assert.ok(r.whatIf, 'whatIf deve calcolarsi con storico reale');
  assert.ok(r.whatIf.totalMonthly > 0, 'tagliare del 20% deve liberare cashflow positivo');
  assert.ok(r.twin, 'twin deve calcolarsi se whatIf ha un impatto');
  assert.ok(r.twin.deltaP50 >= 0, 'con più contributo mensile il p50 a 1 anno non deve essere inferiore');
  assert.ok(r.combined.confidence > 0);
});

test('crossDomainWhatIf: nessuno storico per la categoria -> whatIf nullo, degrado gentile (nessun crash)', () => {
  const r = crossDomainWhatIf({ allTx: {}, category: 'mai-vista', deltaPct: -20, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.whatIf, null);
  assert.equal(r.twin, null);
  assert.equal(r.combined.confidence, 0);
  assert.deepEqual(r.combined.missing, ['causal-whatif', 'net-worth-twin']);
});

test('crossDomainWhatIf: deltaPct che non cambia nulla (es. 0%) non calcola un twin inventato', () => {
  const r = crossDomainWhatIf({ allTx, category: 'ristorazione', deltaPct: 0, referenceDate: new Date(2026, 6, 15) });
  assert.ok(r.whatIf); // il causale si calcola comunque
  assert.equal(r.twin, null); // ma senza impatto € non si proietta nulla
});

test('crossDomainWhatIf: mai un layer mancante rompe gli altri (degradazione graceful)', () => {
  // categoria valida ma allTx malformato in modo che what-if possa fallire internamente
  assert.doesNotThrow(() => crossDomainWhatIf({ allTx: null, category: 'ristorazione', deltaPct: -20 }));
});
