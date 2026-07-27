import test from 'node:test';
import assert from 'node:assert/strict';
const { combineConfidence, crossDomainWhatIf, investmentReadiness } = await import('./reasoning-fusion.js');

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
  assert.deepEqual(r.combined.missing, ['causal-whatif', 'net-worth-twin', 'short-term-cash']);
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

// ── STRATO BREVE TERMINE: ponte con la Cassa Unica (src/predict/cash-forecast.js) ──
const salaryFixture = { dayOfMonth: 27, amount: 1800 };
const rentFixture = [{ id: 'a1', name: 'Affitto', amount: 700, dayOfMonth: 1, kind: 'affitto' }];

// storico più ricco: 90 giorni di spesa libera reale + la categoria da tagliare,
// necessario perché sia il causal-whatif SIA il profilo di spesa libera parlino.
function richHistory(refDate) {
  const tx = {};
  for (let i = 1; i <= 90; i++) {
    const d = new Date(refDate); d.setDate(d.getDate() - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (tx[mk] ||= []).push({ date: d.toISOString().slice(0, 10), amount: 15, type: 'uscita', category: 'varie' });
  }
  for (const mk of ['2026-04', '2026-05', '2026-06']) {
    (tx[mk] ||= []).push({ date: `${mk}-05`, amount: 300, type: 'uscita', category: 'ristorazione' });
  }
  return tx;
}

test('crossDomainWhatIf: senza impegni/stipendio il layer breve-termine resta non disponibile (nessuna invenzione)', () => {
  const r = crossDomainWhatIf({ allTx, category: 'ristorazione', deltaPct: -20, referenceDate: new Date(2026, 6, 15) });
  assert.equal(r.shortTerm, null);
  assert.deepEqual(r.layers.find(l => l.name === 'short-term-cash'), { name: 'short-term-cash', ok: false, confidence: 0 });
});

test('crossDomainWhatIf: CON impegni/stipendio il taglio causale sposta anche la cassa a 30 giorni', () => {
  const ref = new Date(2026, 6, 15);
  const tx = richHistory(ref);
  const r = crossDomainWhatIf({
    allTx: tx, category: 'ristorazione', deltaPct: -20, referenceDate: ref,
    commitments: rentFixture, salary: salaryFixture,
  });
  assert.ok(r.whatIf.totalMonthly > 0, 'precondizione: il taglio libera cashflow');
  assert.ok(r.shortTerm, 'il layer breve termine deve calcolarsi con impegni+stipendio noti');
  assert.ok(r.shortTerm.dailyCut > 0);
  assert.ok(r.shortTerm.endDelta > 0, 'tagliare libera soldi ANCHE nei prossimi 30 giorni');
  assert.ok(r.shortTerm.dataConfidence > 0);
  assert.ok(r.combined.confidence > 0);
});

test('crossDomainWhatIf: il layer breve-termine non esplode se cashForecast fallisce', () => {
  const r = crossDomainWhatIf({
    allTx, category: 'ristorazione', deltaPct: -20, referenceDate: new Date(2026, 6, 15),
    commitments: [{ id: 'x' }], // impegno malformato: niente amount/dayOfMonth
  });
  // può risultare null o calcolato, ma MAI un crash — il test stesso è l'asserzione.
  assert.ok(r.combined);
});

// ── "posso permettermi di investire ora?" — regime + cassa personale ───────
test('investmentReadiness: senza dati di cassa (allTx vuoto, nessun impegno/stipendio) il layer personale resta non disponibile', () => {
  const r = investmentReadiness({ allTx: {}, commitments: [], salary: null, now: Date.parse('2026-07-26') });
  assert.equal(r.cash, null);
  assert.equal(r.verdict, null, 'senza un layer, nessun verdetto inventato');
});

test('investmentReadiness: con storico di spesa reale e stipendio noto calcola un avanzo sicuro e un verdetto', () => {
  const allTx = {};
  for (let i = 1; i <= 60; i++) {
    const d = new Date(2026, 6, 26 - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (allTx[mk] ||= []).push({ type: 'uscita', amount: 10, date: d.toISOString().slice(0, 10), category: 'varie' });
  }
  const salary = { dayOfMonth: 27, amount: 1800 };
  const r = investmentReadiness({ allTx, commitments: [], salary, now: Date.parse('2026-07-26T12:00:00Z') });
  assert.ok(r.cash, 'la cassa deve calcolarsi con storico sufficiente');
  assert.ok(r.verdict, 'atteso un verdetto con entrambi i layer disponibili');
  assert.equal(r.verdict.marketRegime, 'risk-on');
  assert.equal(r.verdict.canConsider, true);
  assert.ok(r.verdict.message.includes('€'));
  assert.ok(typeof r.verdict.marketStaleDays === 'number' && r.verdict.marketStaleDays >= 0, 'dichiara sempre quanto è vecchio il dato di mercato');
});

test('investmentReadiness: MAI un consiglio di compra/vendi — solo il quadro, mai un imperativo', () => {
  const allTx = {};
  for (let i = 1; i <= 60; i++) {
    const d = new Date(2026, 6, 26 - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (allTx[mk] ||= []).push({ type: 'uscita', amount: 10, date: d.toISOString().slice(0, 10), category: 'varie' });
  }
  const r = investmentReadiness({ allTx, now: Date.parse('2026-07-26T12:00:00Z') });
  assert.ok(!/\bcompra\b|\bvendi\b|\bacquista subito\b/i.test(r.verdict.message));
});

test('investmentReadiness: assetKey "cripto" usa il regime/misura di Bitcoin, non SPY', () => {
  const allTx = {};
  for (let i = 1; i <= 60; i++) {
    const d = new Date(2026, 6, 26 - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (allTx[mk] ||= []).push({ type: 'uscita', amount: 10, date: d.toISOString().slice(0, 10), category: 'varie' });
  }
  const r = investmentReadiness({ allTx, now: Date.parse('2026-07-26T12:00:00Z'), assetKey: 'cripto' });
  assert.equal(r.regime.regime, 'risk-off'); // misurato su Bitcoin, diverso da SPY
});

test('investmentReadiness: senza avanzo sicuro (spesa altissima) dice onestamente di aspettare, mai un incoraggiamento a investire', () => {
  const allTx = {};
  for (let i = 1; i <= 60; i++) {
    const d = new Date(2026, 6, 26 - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    (allTx[mk] ||= []).push({ type: 'uscita', amount: 500, date: d.toISOString().slice(0, 10), category: 'varie' });
  }
  const r = investmentReadiness({ allTx, now: Date.parse('2026-07-26T12:00:00Z') });
  assert.equal(r.verdict.canConsider, false);
  assert.ok(r.verdict.message.includes('prima la tua liquidità'));
});
