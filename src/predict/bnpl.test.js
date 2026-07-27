import test from 'node:test';
import assert from 'node:assert/strict';

const { detectBnplSeries, projectSeries, bnplExposure, bnplToLedgerEvents, propagateSeriesCategory,
  learnPlanLengths, anticipateFromFirstCharge } = await import('./bnpl.js');

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-20T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function txAt(daysAgo, amount, description, category = null) {
  return { id: `t${daysAgo}-${amount}`, date: iso(NOW - daysAgo * DAY), amount, type: 'uscita', description, category };
}
function bucket(...txs) {
  const allTx = {};
  for (const t of txs) (allTx[t.date.slice(0, 7)] ||= []).push(t);
  return allTx;
}

// ── caso 1: Klarna "Pay in 4" biweekly, 2 di 4 rate già pagate ──────────────
test('detectBnplSeries: riconosce un piano Klarna biweekly da 2 addebiti', () => {
  const allTx = bucket(
    txAt(28, 45, 'KLARNA*ZARA'),
    txAt(14, 45, 'KLARNA*ZARA'),
  );
  const series = detectBnplSeries(allTx, { now: NOW });
  assert.equal(series.length, 1);
  assert.equal(series[0].providerId, 'klarna');
  assert.equal(series[0].paidCount, 2);
  assert.ok(Math.abs(series[0].cadenceDays - 14) < 1);
});

test('projectSeries: Pay in 4 biweekly, 2 pagate → proietta le 2 rate residue alle date giuste', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const s = detectBnplSeries(allTx, { now: NOW })[0];
  const p = projectSeries(s, { now: NOW });
  assert.equal(p.assumedTotal, 4);
  assert.equal(p.remainingCount, 2);
  assert.equal(p.remainingTotal, 90);
  assert.equal(p.upcoming.length, 2);
  assert.equal(p.upcoming[0].date, iso(NOW)); // oggi (14gg dopo l'ultima pagata)
  assert.ok(p.active);
  assert.ok(p.assumption.includes('4 rate'));
});

// ── caso 2: PayPal "Pay in 3" mensile, 1 di 3 rate pagata ────────────────────
test('detectBnplSeries + projectSeries: PayPal Pay in 3 mensile, 1 pagata → tace sulla serie (serve almeno 2 addebiti)', () => {
  const allTx = bucket(txAt(5, 120, 'PayPal Pay in 3 - Volo'));
  assert.equal(detectBnplSeries(allTx, { now: NOW }).length, 0, 'un solo addebito non è ancora un piano confermato');
});

test('projectSeries: PayPal Pay in 3 mensile, 2 di 3 pagate → proietta 1 rata residua a ~30 giorni', () => {
  const allTx = bucket(
    txAt(35, 120, 'PayPal Pay in 3 - Volo'),
    txAt(5, 120, 'PayPal Pay in 3 - Volo'),
  );
  const s = detectBnplSeries(allTx, { now: NOW })[0];
  const p = projectSeries(s, { now: NOW });
  assert.equal(p.assumedTotal, 3);
  assert.equal(p.remainingCount, 1);
  assert.ok(Math.abs(new Date(p.upcoming[0].date) - (NOW + 25 * DAY)) < 3 * DAY);
});

// ── caso 3: piano concluso (tutte le rate pagate) ───────────────────────────
test('projectSeries: 4 di 4 rate Klarna già pagate → piano NON più attivo', () => {
  const allTx = bucket(
    txAt(42, 30, 'Klarna'), txAt(28, 30, 'Klarna'), txAt(14, 30, 'Klarna'), txAt(0.1, 30, 'Klarna'),
  );
  const s = detectBnplSeries(allTx, { now: NOW })[0];
  const p = projectSeries(s, { now: NOW });
  assert.equal(p.remainingCount, 0);
  assert.equal(p.active, false);
});

// ── caso 4: un singolo addebito Klarna (pagamento in un'unica soluzione) ────
test('detectBnplSeries: un SOLO addebito Klarna non genera mai un piano (nessuna invenzione)', () => {
  const allTx = bucket(txAt(3, 89.9, 'Klarna checkout'));
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW }), []);
});

// ── caso 5: cadenza fuori finestra (non è un piano a rate) ──────────────────
test('detectBnplSeries: due addebiti Klarna a 90 giorni di distanza NON sono la stessa serie', () => {
  const allTx = bucket(txAt(95, 60, 'Klarna'), txAt(5, 60, 'Klarna'));
  assert.equal(detectBnplSeries(allTx, { now: NOW }).length, 0);
});

// ── caso 6: importi diversi non sono la stessa serie (tranne piccola tolleranza) ──
test('detectBnplSeries: importi molto diversi non vengono uniti nella stessa serie', () => {
  const allTx = bucket(txAt(28, 45, 'Klarna'), txAt(14, 90, 'Klarna'));
  assert.equal(detectBnplSeries(allTx, { now: NOW }).length, 0);
});

test('detectBnplSeries: una piccola differenza (arrotondamento dell\'ultima rata) resta la stessa serie', () => {
  const allTx = bucket(txAt(28, 45.00, 'Klarna'), txAt(14, 45.02, 'Klarna'));
  assert.equal(detectBnplSeries(allTx, { now: NOW }).length, 1);
});

// ── caso 7: NON confondere un vero abbonamento mensile con un piano BNPL ────
test('detectBnplSeries: senza il nome di un provider BNPL, una spesa ricorrente mensile non viene mai etichettata', () => {
  const allTx = bucket(txAt(60, 9.99, 'Netflix'), txAt(30, 9.99, 'Netflix'), txAt(0.1, 9.99, 'Netflix'));
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW }), []);
});

// ── caso 8: più piani CONCORRENTI da provider diversi (il vero "stacking") ──
test('bnplExposure: aggrega più piani attivi di provider DIVERSI (il numero che nessun provider vede da solo)', () => {
  const allTx = bucket(
    txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'),         // Klarna: 2 rate residue da 45
    txAt(35, 120, 'PayPal Pay in 3 - Volo'), txAt(5, 120, 'PayPal Pay in 3 - Volo'), // PayPal: 1 rata residua da 120
  );
  const exp = bnplExposure(allTx, { now: NOW });
  assert.equal(exp.count, 2);
  assert.equal(exp.totalRemaining, 210); // 2×45 + 1×120
  assert.equal(exp.byProvider.length, 2);
  assert.ok(exp.nextDue, 'deve indicare la prossima scadenza tra TUTTI i piani');
});

test('bnplExposure: un piano già concluso non entra nell\'esposizione', () => {
  const allTx = bucket(txAt(42, 30, 'Klarna'), txAt(28, 30, 'Klarna'), txAt(14, 30, 'Klarna'), txAt(0.1, 30, 'Klarna'));
  const exp = bnplExposure(allTx, { now: NOW });
  assert.equal(exp.count, 0);
  assert.equal(exp.totalRemaining, 0);
});

// ── ponte Cassa Unica ────────────────────────────────────────────────────────
test('bnplToLedgerEvents: le rate future entrano nel ledger come eventi certi', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const ev = bnplToLedgerEvents(allTx, { now: NOW, horizonDays: 45 });
  assert.equal(ev.length, 2);
  assert.equal(ev[0].amount, -45);
  assert.equal(ev[0].kind, 'bnpl');
  assert.equal(ev[0].certain, true);
});

test('bnplToLedgerEvents: rispetta l\'orizzonte richiesto (nessun evento oltre)', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const ev = bnplToLedgerEvents(allTx, { now: NOW, horizonDays: 10 }); // la 2ª rata residua cade a +28gg, fuori
  assert.equal(ev.length, 1);
});

// ── propagazione categoria (Momentum Core) ──────────────────────────────────
function fakeOrchestrator() {
  const calls = [];
  return { calls, learn: (d, c, a) => calls.push({ d, c, a }) };
}

test('propagateSeriesCategory: corregge il Core una volta per rata già pagata, non una sola volta', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const s = detectBnplSeries(allTx, { now: NOW })[0];
  const o = fakeOrchestrator();
  const r = propagateSeriesCategory(o, s, 'shopping', { now: NOW });
  assert.equal(r.taught, 2); // paidCount = 2
  assert.ok(o.calls.every(c => c.c === 'shopping' && c.d === 'Klarna'));
});

test('propagateSeriesCategory: senza serie o categoria non fa nulla (nessun crash)', () => {
  assert.deepEqual(propagateSeriesCategory(fakeOrchestrator(), null, 'shopping'), { taught: 0 });
});

// ── AUTO-ADDESTRAMENTO: lunghezza-piano imparata per provider ───────────────
test('learnPlanLengths: un piano ANCORA in corso non viene imparato (non è davvero chiuso)', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const series = detectBnplSeries(allTx, { now: NOW });
  const r = learnPlanLengths(series, {}, { now: NOW });
  assert.deepEqual(r.learned, {});
  assert.equal(r.taught.length, 0);
});

test('learnPlanLengths: un piano chiuso viene registrato, ma serve un 2° piano prima di fidarsi', () => {
  const closed = bucket(txAt(42, 30, 'Klarna'), txAt(28, 30, 'Klarna'), txAt(14, 30, 'Klarna'), txAt(0.1, 30, 'Klarna'));
  const series = detectBnplSeries(closed, { now: NOW });
  const r = learnPlanLengths(series, {}, { now: NOW });
  assert.equal(r.learned.klarna.closedLengths.length, 1);
  assert.equal(r.taught.length, 1);
  // con un solo campione, la proiezione NON usa ancora l'appreso (soglia minima 2)
  const p = projectSeries(series[0], { now: NOW, learned: r.learned });
  assert.equal(p.learnedFromHistory, false);
});

test('learnPlanLengths: con 2+ piani chiusi da 5 rate, il Klarna di QUESTO utente proietta 5 rate non 4', () => {
  // due piani Klarna passati, entrambi chiusi a 5 rate biweekly (più lunghi dello standard 4)
  const closedA = [txAt(70, 20, 'Klarna'), txAt(56, 20, 'Klarna'), txAt(42, 20, 'Klarna'), txAt(28, 20, 'Klarna'), txAt(14.1, 20, 'Klarna')];
  const closedB = [txAt(200, 20, 'Klarna'), txAt(186, 20, 'Klarna'), txAt(172, 20, 'Klarna'), txAt(158, 20, 'Klarna'), txAt(144.1, 20, 'Klarna')];
  let allTx = bucket(...closedA, ...closedB);
  let series = detectBnplSeries(allTx, { now: NOW });
  let learned = {};
  for (const s of series) {
    const r = learnPlanLengths([s], learned, { now: NOW });
    learned = r.learned;
  }
  assert.equal(learned.klarna.closedLengths.length, 2, 'entrambi i piani chiusi imparati');

  // ora un NUOVO piano Klarna in corso, 2 rate pagate: la proiezione deve usare
  // l'appreso (5) e non lo standard di settore (4).
  const nuovo = bucket(txAt(28, 45, 'Klarna'), txAt(14, 45, 'Klarna'));
  const s3 = detectBnplSeries(nuovo, { now: NOW })[0];
  const p = projectSeries(s3, { now: NOW, learned });
  assert.equal(p.assumedTotal, 5, 'usa i 5 imparati, non i 4 di settore');
  assert.equal(p.remainingCount, 3);
  assert.ok(p.learnedFromHistory);
  assert.ok(p.assumption.includes('imparato'));
});

test('learnPlanLengths: non re-impara lo stesso piano chiuso due volte (impronta)', () => {
  const closed = bucket(txAt(42, 30, 'Klarna'), txAt(28, 30, 'Klarna'), txAt(14, 30, 'Klarna'), txAt(0.1, 30, 'Klarna'));
  const series = detectBnplSeries(closed, { now: NOW });
  const first = learnPlanLengths(series, {}, { now: NOW });
  const second = learnPlanLengths(series, first.learned, { now: NOW, seen: first.seen });
  assert.equal(second.taught.length, 0);
  assert.equal(second.learned.klarna.closedLengths.length, 1, 'non duplicato');
});

// ── ANTICIPAZIONE: proiettare dalla PRIMA rata quando c'è storia personale ──
test('anticipateFromFirstCharge: senza storia (nessun piano chiuso) tace anche con un solo addebito', () => {
  const allTx = bucket(txAt(2, 60, 'Klarna'));
  assert.deepEqual(anticipateFromFirstCharge(allTx, {}, { now: NOW }), []);
});

test('anticipateFromFirstCharge: con UN SOLO piano chiuso in passato non basta (serve ≥2, un caso solo potrebbe essere anomalo)', () => {
  const learned = { klarna: { closedLengths: [4], closedCadences: [14] } };
  const allTx = bucket(txAt(1, 60, 'Klarna'));
  assert.deepEqual(anticipateFromFirstCharge(allTx, learned, { now: NOW }), []);
});

test('anticipateFromFirstCharge: con 2+ piani chiusi, proietta l\'INTERO piano dalla prima rata reale', () => {
  const learned = { klarna: { closedLengths: [4, 4], closedCadences: [14, 14] } };
  const allTx = bucket(txAt(1, 60, 'Klarna'));
  const r = anticipateFromFirstCharge(allTx, learned, { now: NOW });
  assert.equal(r.length, 1);
  assert.equal(r[0].assumedTotal, 4);
  assert.equal(r[0].remainingCount, 3, 'la prima è già pagata, ne restano 3 su 4');
  assert.equal(r[0].remainingTotal, 180);
  assert.ok(r[0].anticipated);
  assert.ok(r[0].assumption.includes('anticipato'));
});

test('anticipateFromFirstCharge: NON anticipa una carica che è già parte di una serie confermata (eviterebbe il doppio conteggio)', () => {
  const learned = { klarna: { closedLengths: [4, 4], closedCadences: [14, 14] } };
  // 2 addebiti reali → già una serie CONFERMATA: non deve anche "anticipare" su quella stessa prima carica.
  const allTx = bucket(txAt(15, 60, 'Klarna'), txAt(1, 60, 'Klarna'));
  assert.deepEqual(anticipateFromFirstCharge(allTx, learned, { now: NOW }), []);
});

test('anticipateFromFirstCharge: PRIOR TRA PROVIDER — un provider mai visto usa l\'abitudine personale (non tace, non usa lo standard di settore)', () => {
  // l'utente ha chiuso 2 piani Klarna da 4 rate: è la SUA abitudine, vale
  // anche per un provider che non ha mai usato prima (stessa persona, stesso
  // comportamento di spesa a rate — non è una proprietà del brand Klarna).
  const learned = { klarna: { closedLengths: [4, 4], closedCadences: [14, 14] } };
  const allTx = bucket(txAt(1, 60, 'PayPal Pay in 3 - Volo'));
  const r = anticipateFromFirstCharge(allTx, learned, { now: NOW });
  assert.equal(r.length, 1);
  assert.equal(r[0].providerId, 'paypal-pay-later');
  assert.equal(r[0].learnedTier, 'personale');
  assert.equal(r[0].assumedTotal, 4);
  assert.ok(r[0].assumption.includes('altri piani'));
});

test('anticipateFromFirstCharge: senza NESSUNA storia (nemmeno di altri provider) tace comunque', () => {
  assert.deepEqual(anticipateFromFirstCharge(bucket(txAt(1, 60, 'PayPal Pay in 3 - Volo')), {}, { now: NOW }), []);
});

test('bnplExposure: con anticipate:true include i piani anticipati nell\'esposizione totale', () => {
  const learned = { klarna: { closedLengths: [4, 4], closedCadences: [14, 14] } };
  const allTx = bucket(txAt(1, 60, 'Klarna'));
  const senza = bnplExposure(allTx, { now: NOW, learned });
  const con = bnplExposure(allTx, { now: NOW, learned, anticipate: true });
  assert.equal(senza.count, 0, 'di default (anticipate assente) si comporta come prima');
  assert.equal(con.count, 1);
  assert.equal(con.anticipatedCount, 1);
  assert.equal(con.confirmedCount, 0);
});

test('bnplToLedgerEvents: le rate anticipate entrano nel ledger ma NON certe (banda più larga)', () => {
  const learned = { klarna: { closedLengths: [4, 4], closedCadences: [14, 14] } };
  const allTx = bucket(txAt(1, 60, 'Klarna'));
  const ev = bnplToLedgerEvents(allTx, { now: NOW, horizonDays: 45, learned, anticipate: true });
  assert.ok(ev.length > 0);
  assert.ok(ev.every(e => e.certain === false));
  assert.ok(ev[0].label.includes('prevista'));
});

test('anticipateFromFirstCharge: il provider SPECIFICO batte sempre il prior tra-provider quando entrambi disponibili', () => {
  // Klarna: 2 piani da 4 rate (specifico). PayPal: 2 piani da 3 rate (specifico anche lui).
  // Un NUOVO Klarna deve usare 4 (il suo specifico), non una media generica.
  const learned = {
    klarna: { closedLengths: [4, 4], closedCadences: [14, 14] },
    'paypal-pay-later': { closedLengths: [3, 3], closedCadences: [30, 30] },
  };
  const allTx = bucket(txAt(1, 60, 'Klarna'));
  const r = anticipateFromFirstCharge(allTx, learned, { now: NOW });
  assert.equal(r[0].learnedTier, 'provider');
  assert.equal(r[0].assumedTotal, 4);
});

test('projectSeries: il tier "personale" (prior tra provider) si dichiara onestamente diverso dal tier "provider"', () => {
  const learnedCrossOnly = { klarna: { closedLengths: [5, 5], closedCadences: [14, 14] } };
  const allTx = bucket(txAt(28, 45, 'PayPal Pay in 3 - Volo'), txAt(14, 45, 'PayPal Pay in 3 - Volo'));
  const s = detectBnplSeries(allTx, { now: NOW })[0];
  const p = projectSeries(s, { now: NOW, learned: learnedCrossOnly });
  assert.equal(p.learnedTier, 'personale');
  assert.equal(p.assumedTotal, 5, 'usa i 5 imparati da Klarna anche per PayPal, mai visto prima');
  assert.ok(p.assumption.includes('altri piani'));
});

// ── AUTO-ADATTAMENTO oltre l'elenco marchi: rilevamento GENERICO ───────────
test('detectBnplSeries: riconosce un piano a rate di un provider MAI SENTITO nominare (solo dal pattern biweekly, 3 rate)', () => {
  // BUG TROVATO verificando con spesa realistica: 2 sole coincidenze di
  // importo+cadenza sono un indizio troppo debole senza un marchio a
  // confermarle (una spesa abituale qualsiasi ci casca facilmente) — servono
  // 3 allineamenti consecutivi prima di parlare.
  const allTx = bucket(
    txAt(42, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
    txAt(28, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
    txAt(14, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
  );
  const series = detectBnplSeries(allTx, { now: NOW, includeUnbranded: true });
  assert.equal(series.length, 1);
  assert.equal(series[0].confidence, 'pattern');
  assert.ok(series[0].providerId.startsWith('generic:'));
});

test('detectBnplSeries: DI DEFAULT il rilevamento generico è disattivato (troppo prono a falsi positivi, vedi sotto)', () => {
  const allTx = bucket(
    txAt(42, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
    txAt(28, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
    txAt(14, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
  );
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW }), []);
});

test('detectBnplSeries: due sole coincidenze SENZA marchio non bastano più anche con opt-in (indizio troppo debole)', () => {
  const allTx = bucket(
    txAt(28, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
    txAt(14, 55, 'PAGAMENTO ESERCENTE XYZ RATA'),
  );
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW, includeUnbranded: true }), []);
});

test('detectBnplSeries: spesa da supermercato 2 volte a settimana, importo oscillante, NON genera piani a rate falsi (anche con opt-in)', () => {
  // Replica il bug trovato dal vivo su una cadenza REALISTICA (2 spese/settimana,
  // non una al giorno): i tre discriminanti (3 allineamenti, tolleranza
  // d'importo stretta, cadenza regolare) insieme devono tenere.
  let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const txs = [];
  for (let i = 90; i >= 1; i -= (3 + Math.floor(rnd() * 3))) txs.push(txAt(i, +(16 + rnd() * 4).toFixed(2), 'Supermercato'));
  const series = detectBnplSeries(bucket(...txs), { now: NOW, includeUnbranded: true });
  assert.deepEqual(series.filter(s => s.providerId.startsWith('generic:')), []);
});

// NOTA ONESTA (limite noto, non nascosto): con spesa ricorrente QUOTIDIANA in
// una fascia di prezzo molto stretta, anche i 3 discriminanti possono ancora
// incrociarsi per puro caso (verificato: dati sintetici a cadenza giornaliera
// fissa producono un falso positivo anche con opt-in). È il motivo per cui il
// rilevamento generico resta OPT-IN e mai il default — il pannello di gestione
// (window.openBnplManager) resta il controllo che chiude il cerchio quando la
// pura euristica non basta.

test('detectBnplSeries: un vero abbonamento MENSILE (Netflix-like, non biweekly) non attiva mai il generico', () => {
  const allTx = bucket(
    txAt(65, 12.99, 'Servizio Streaming XYZ'),
    txAt(35, 12.99, 'Servizio Streaming XYZ'),
    txAt(5, 12.99, 'Servizio Streaming XYZ'),
  );
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW, includeUnbranded: true }), []);
});

test('detectBnplSeries: un importo troppo piccolo (tipo un caffè ricorrente) non attiva il generico biweekly', () => {
  const allTx = bucket(txAt(28, 4.5, 'Bar Mario ricorrente'), txAt(14, 4.5, 'Bar Mario ricorrente'));
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW, includeUnbranded: true }), []);
});

test('detectBnplSeries: il generico non ruba addebiti già spiegati da un marchio noto', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const series = detectBnplSeries(allTx, { now: NOW, includeUnbranded: true });
  assert.equal(series.length, 1);
  assert.equal(series[0].confidence, 'brand');
});

test('detectBnplSeries: includeUnbranded:false disattiva il generico (uguale al default)', () => {
  const allTx = bucket(txAt(42, 55, 'PAGAMENTO ESERCENTE XYZ RATA'), txAt(28, 55, 'PAGAMENTO ESERCENTE XYZ RATA'), txAt(14, 55, 'PAGAMENTO ESERCENTE XYZ RATA'));
  assert.deepEqual(detectBnplSeries(allTx, { now: NOW, includeUnbranded: false }), []);
});

test('detectBnplSeries: un nuovo player noto per nome (es. Sezzle/Tabby) viene riconosciuto come marchio, non come pattern generico', () => {
  const allTx = bucket(txAt(28, 40, 'SEZZLE INSTALLMENT'), txAt(14, 40, 'SEZZLE INSTALLMENT'));
  const series = detectBnplSeries(allTx, { now: NOW });
  assert.equal(series[0].providerId, 'sezzle');
  assert.equal(series[0].confidence, 'brand');
});

// ── CONTROLLO utente: dismissed (il rilevatore generico può sbagliare) ─────
test('bnplExposure: dismissed esclude un piano specifico dall\'esposizione (falso positivo corretto dall\'utente)', () => {
  const allTx = bucket(txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'));
  const before = bnplExposure(allTx, { now: NOW });
  const id = before.plans[0].id;
  const after = bnplExposure(allTx, { now: NOW, dismissed: [id] });
  assert.equal(before.count, 1);
  assert.equal(after.count, 0);
});

test('bnplExposure: dismissed non tocca gli ALTRI piani (solo quello scelto)', () => {
  const allTx = bucket(
    txAt(28, 45, 'KLARNA*ZARA'), txAt(14, 45, 'KLARNA*ZARA'),
    txAt(35, 120, 'PayPal Pay in 3 - Volo'), txAt(5, 120, 'PayPal Pay in 3 - Volo'),
  );
  const before = bnplExposure(allTx, { now: NOW });
  const klarnaId = before.plans.find(p => p.providerId === 'klarna').id;
  const after = bnplExposure(allTx, { now: NOW, dismissed: [klarnaId] });
  assert.equal(after.count, 1);
  assert.equal(after.plans[0].providerId, 'paypal-pay-later');
});
