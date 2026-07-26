import test from 'node:test';
import assert from 'node:assert/strict';

const { discretionaryProfile, buildLedger, simulateCash, bestLevers, cashForecast } =
  await import('./cash-forecast.js');

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-20T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const mk = (d) => `${new Date(d).getUTCFullYear()}-${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}`;

// Costruisce uno storico: `perDay(dateMs) → importo speso quel giorno`.
function historyOf(days, perDay, { from = NOW } = {}) {
  const allTx = {};
  for (let i = days; i >= 1; i--) {
    const t = from - i * DAY;
    const amt = perDay(t, i);
    if (!amt) continue;
    const k = mk(t);
    (allTx[k] ||= []).push({ type: 'uscita', amount: amt, date: iso(t), description: 'spesa', category: 'varie' });
  }
  return allTx;
}

const mutuo = { id: 'm1', name: 'Mutuo', amount: 600, dayOfMonth: 5, kind: 'mutuo', startDate: '2024-01-05', termMonths: 240 };
const affitto = { id: 'a1', name: 'Affitto', amount: 500, dayOfMonth: 1, kind: 'affitto' };
const salary = { dayOfMonth: 27, amount: 1800 };

// ── profilo di spesa libera ─────────────────────────────────────────────────
test('discretionaryProfile: tace sotto la soglia minima di storico', () => {
  const allTx = historyOf(5, () => 10);
  assert.equal(discretionaryProfile(allTx, { now: NOW }), null);
});

test('discretionaryProfile: tace senza alcun movimento', () => {
  assert.equal(discretionaryProfile({}, { now: NOW }), null);
});

test('discretionaryProfile: media giornaliera su serie densa (i giorni a zero contano)', () => {
  // 60 giorni, 20€ solo nei giorni pari → media ≈ 10€/giorno
  const allTx = historyOf(60, (t, i) => (i % 2 === 0 ? 20 : 0));
  const p = discretionaryProfile(allTx, { now: NOW });
  assert.ok(p, 'profilo atteso');
  assert.ok(Math.abs(p.dailyMean - 10) < 1.5, `media ${p.dailyMean}`);
  assert.ok(p.observedDays >= 55);
});

test('discretionaryProfile: ESCLUDE le rate degli impegni (niente doppio conteggio)', () => {
  // 20€/giorno tutti i giorni + una rata da 600€ il giorno 5 di ogni mese
  const allTx = historyOf(60, () => 20);
  for (const d of ['2026-06-05', '2026-07-05']) {
    (allTx[d.slice(0, 7)] ||= []).push({ type: 'uscita', amount: 600, date: d, description: 'Mutuo', category: 'casa' });
  }
  const senza = discretionaryProfile(allTx, { now: NOW });
  const con = discretionaryProfile(allTx, { now: NOW, commitments: [mutuo] });
  assert.ok(senza.dailyMean > con.dailyMean, 'senza esclusione la media è gonfiata');
  assert.ok(Math.abs(con.dailyMean - 20) < 1, `media depurata ${con.dailyMean}`);
});

test('discretionaryProfile: esclude UNA rata per mese, non tutto ciò che le somiglia', () => {
  // REGRESSIONE (bug trovato dal bench): con una bolletta variabile la banda di
  // tolleranza è larghissima; escludere "tutto ciò che somiglia" divorava spese
  // libere vere → ritmo sottostimato e previsione ottimista di ~110€ su 14 giorni.
  const bolletta = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 80, dayOfMonth: 12, kind: 'bolletta', variable: true };
  const allTx = {};
  for (let i = 60; i >= 1; i--) {
    const t = NOW - i * DAY;
    (allTx[mk(t)] ||= []).push({ type: 'uscita', amount: 60, date: iso(t), description: 'spesa', category: 'varie' });
  }
  for (const d of ['2026-06-12', '2026-07-12']) {
    (allTx[d.slice(0, 7)] ||= []).push({ type: 'uscita', amount: 95, date: d, description: 'Enel', category: 'casa' });
  }
  const p = discretionaryProfile(allTx, { now: NOW, commitments: [bolletta] });
  // la spesa libera vera è 60€/giorno: le rate escluse sono 2, non decine.
  assert.ok(Math.abs(p.dailyMean - 60) < 3, `ritmo ${p.dailyMean}, atteso ~60`);
});

test('discretionaryProfile: fattori per giorno della settimana normalizzati attorno a 1', () => {
  // sabato (getUTCDay 6) spende il triplo
  const allTx = historyOf(90, (t) => (new Date(t).getUTCDay() === 6 ? 60 : 20));
  const p = discretionaryProfile(allTx, { now: NOW });
  assert.ok(p.dowFactor[6] > 1.8, `sabato ${p.dowFactor[6]}`);
  assert.ok(p.dowFactor[2] < 1, `martedì ${p.dowFactor[2]}`);
  const mean = p.dowFactor.reduce((s, v) => s + v, 0) / 7;
  assert.ok(Math.abs(mean - 1) < 0.05, `normalizzazione ${mean}`);
});

test('discretionaryProfile: sigma non è mai zero se c\'è variabilità (niente falsa certezza)', () => {
  const allTx = historyOf(60, (t, i) => (i % 10 === 0 ? 200 : 0)); // spese rare e grosse → MAD = 0
  const p = discretionaryProfile(allTx, { now: NOW });
  assert.ok(p.sigma > 0, 'sigma deve ripiegare sullo scarto medio assoluto');
});

test('discretionaryProfile: coverage cresce con lo storico disponibile', () => {
  const corto = discretionaryProfile(historyOf(20, () => 10), { now: NOW });
  const lungo = discretionaryProfile(historyOf(90, () => 10), { now: NOW });
  assert.ok(corto.coverage < lungo.coverage);
  assert.equal(lungo.coverage, 1);
});

// ── registro eventi ─────────────────────────────────────────────────────────
test('buildLedger: impegni e stipendio finiscono sulla stessa linea temporale', () => {
  const ev = buildLedger({ commitments: [mutuo, affitto], salary, now: NOW, horizonDays: 45 });
  const dates = ev.map(e => `${e.date}:${e.amount}`);
  assert.ok(dates.includes('2026-07-27:1800'), 'stipendio del 27');
  assert.ok(dates.includes('2026-08-01:-500'), 'affitto del 1° agosto');
  assert.ok(dates.includes('2026-08-05:-600'), 'mutuo del 5 agosto');
  assert.deepEqual(ev.map(e => e.ms), [...ev.map(e => e.ms)].sort((a, b) => a - b), 'ordinati nel tempo');
});

test('buildLedger: un impegno GIÀ pagato questo mese non è più un fantasma', () => {
  const bolletta = { id: 'b1', name: 'Luce', amount: 70, dayOfMonth: 22, kind: 'bolletta' };
  const monthTx = [{ type: 'uscita', amount: 68, date: '2026-07-22', description: 'Enel' }];
  const senza = buildLedger({ commitments: [bolletta], now: NOW, horizonDays: 20 });
  const con = buildLedger({ commitments: [bolletta], now: NOW, horizonDays: 20, monthTx });
  assert.ok(senza.some(e => e.date === '2026-07-22'), 'senza riconciliazione il fantasma c\'è');
  assert.ok(!con.some(e => e.date === '2026-07-22'), 'materializzato → non contato di nuovo');
});

test('buildLedger: un abbonamento già dichiarato come impegno non viene contato due volte', () => {
  const netflix = { id: 'n1', name: 'Netflix', amount: 12.99, dayOfMonth: 24, kind: 'abbonamento' };
  const subs = [{ name: 'Netflix', amount: 12.99, nextDate: '2026-07-24' }];
  const ev = buildLedger({ commitments: [netflix], subscriptions: subs, now: NOW, horizonDays: 20 });
  assert.equal(ev.filter(e => e.date === '2026-07-24').length, 1);
  assert.equal(ev.find(e => e.date === '2026-07-24').source, 'commitment');
});

test('buildLedger: un abbonamento NON dichiarato entra come evento (non certo)', () => {
  const subs = [{ name: 'Spotify', amount: 10.99, nextDate: '2026-07-25' }];
  const ev = buildLedger({ subscriptions: subs, now: NOW, horizonDays: 20 });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].certain, false);
  assert.equal(ev[0].amount, -10.99);
});

test('buildLedger: un impegno estinto non genera occorrenze future', () => {
  const finito = { id: 'f1', name: 'Prestito', amount: 200, dayOfMonth: 10, kind: 'prestito',
    startDate: '2024-08-10', termMonths: 12 };
  assert.equal(buildLedger({ commitments: [finito], now: NOW, horizonDays: 60 }).length, 0);
});

test('buildLedger: orizzonte rispettato (nessun evento oltre la finestra)', () => {
  const ev = buildLedger({ commitments: [affitto], salary, now: NOW, horizonDays: 10 });
  const max = NOW + 10 * DAY;
  assert.ok(ev.every(e => e.ms <= max));
});

// ── simulazione ─────────────────────────────────────────────────────────────
test('simulateCash: senza profilo il saldo si muove solo con gli eventi', () => {
  const ledger = buildLedger({ commitments: [affitto], salary, now: NOW, horizonDays: 20 });
  const s = simulateCash({ startBalance: 100, profile: null, ledger, now: NOW, horizonDays: 20 });
  assert.equal(s.end.p50, 100 + 1800 - 500);
  assert.equal(s.end.p10, s.end.p50, 'senza dispersione la banda è chiusa');
});

test('simulateCash: la banda si allarga come radice del tempo, non linearmente', () => {
  const profile = { dailyMean: 10, dailyMedian: 10, sigma: 10, blockSigma: {}, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const s = simulateCash({ startBalance: 1000, profile, ledger: [], now: NOW, horizonDays: 40 });
  const w = (i) => s.path[i - 1].p90 - s.path[i - 1].p50;
  assert.ok(Math.abs(w(4) / w(1) - 2) < 0.01, 'a 4 giorni la banda è doppia rispetto a 1 giorno');
  assert.ok(w(40) < w(1) * 40, 'non cresce linearmente');
});

test('simulateCash: trova il GIORNO DI RISCHIO prudente prima di quello probabile', () => {
  const profile = { dailyMean: 20, dailyMedian: 20, sigma: 15, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const s = simulateCash({ startBalance: 300, profile, ledger: [], now: NOW, horizonDays: 45 });
  assert.ok(s.riskDay, 'atteso un giorno di rischio prudente');
  assert.ok(s.riskDayP50, 'atteso un giorno di rischio probabile');
  assert.ok(s.riskDay.inDays < s.riskDayP50.inDays, 'lo scenario prudente arriva prima');
});

test('simulateCash: nessun giorno di rischio se lo stipendio copre tutto', () => {
  const profile = { dailyMean: 20, dailyMedian: 20, sigma: 2, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const ledger = buildLedger({ salary, now: NOW, horizonDays: 30 });
  const s = simulateCash({ startBalance: 2000, profile, ledger, now: NOW, horizonDays: 30 });
  assert.equal(s.riskDay, null);
  assert.ok(s.end.p50 > 2000 - 30 * 20);
});

test('simulateCash: il cuscinetto anticipa il giorno di rischio', () => {
  const profile = { dailyMean: 20, dailyMedian: 20, sigma: 5, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const base = simulateCash({ startBalance: 500, profile, ledger: [], now: NOW, horizonDays: 45, cushion: 0 });
  const cuscino = simulateCash({ startBalance: 500, profile, ledger: [], now: NOW, horizonDays: 45, cushion: 200 });
  assert.ok(cuscino.riskDay.inDays < base.riskDay.inDays);
});

test('simulateCash: il debito di divisione resta uno scenario a parte, non falsa la linea base', () => {
  const s = simulateCash({ startBalance: 500, profile: null, ledger: [], now: NOW, horizonDays: 10, splitOwed: 120 });
  assert.equal(s.end.p50, 500, 'la linea base non tocca il debito split');
  assert.equal(s.withSplit.endP50, 380);
  assert.ok(s.assumptions.some(a => a.includes('divisione')));
});

test('simulateCash: il minimo del percorso viene tracciato (la valle del mese)', () => {
  const profile = { dailyMean: 10, dailyMedian: 10, sigma: 1, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const ledger = buildLedger({ commitments: [affitto], salary, now: NOW, horizonDays: 40 });
  const s = simulateCash({ startBalance: 800, profile, ledger, now: NOW, horizonDays: 40 });
  // la valle deve cadere PRIMA dello stipendio del 27
  assert.ok(s.lowest.date <= '2026-07-27', `valle ${s.lowest.date}`);
  assert.ok(s.lowest.value < 800);
});

test('simulateCash: gli eventi del giorno sono esposti nel percorso', () => {
  const ledger = buildLedger({ salary, now: NOW, horizonDays: 15 });
  const s = simulateCash({ startBalance: 0, profile: null, ledger, now: NOW, horizonDays: 15 });
  const giorno = s.path.find(p => p.date === '2026-07-27');
  assert.equal(giorno.events.length, 1);
  assert.equal(giorno.events[0].kind, 'stipendio');
});

// ── leve controfattuali ─────────────────────────────────────────────────────
test('bestLevers: la riduzione di spesa sposta DAVVERO il giorno di rischio', () => {
  const profile = { dailyMean: 30, dailyMedian: 30, sigma: 5, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const base = simulateCash({ startBalance: 600, profile, ledger: [], now: NOW, horizonDays: 45 });
  const levers = bestLevers(base, { profile, ledger: [], startBalance: 600, now: NOW, horizonDays: 45 });
  assert.ok(levers.length, 'attesa almeno una leva');
  assert.ok(levers[0].daysGained > 0, 'la leva migliore guadagna giorni misurati');
  assert.ok(levers[0].endDelta > 0);
});

test('bestLevers: nessuna leva inventata se non c\'è nulla da migliorare', () => {
  const base = simulateCash({ startBalance: 5000, profile: null, ledger: [], now: NOW, horizonDays: 30 });
  assert.deepEqual(bestLevers(base, { profile: null, ledger: [], startBalance: 5000, now: NOW, horizonDays: 30 }), []);
});

test('bestLevers: propone di sospendere l\'abbonamento più caro, misurandone l\'effetto', () => {
  const profile = { dailyMean: 25, dailyMedian: 25, sigma: 4, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const ledger = buildLedger({
    subscriptions: [{ name: 'Palestra', amount: 60, nextDate: '2026-07-23' },
      { name: 'Spotify', amount: 10, nextDate: '2026-07-24' }],
    now: NOW, horizonDays: 45,
  });
  const base = simulateCash({ startBalance: 700, profile, ledger, now: NOW, horizonDays: 45 });
  const levers = bestLevers(base, { profile, ledger, startBalance: 700, now: NOW, horizonDays: 45 });
  const sub = levers.find(l => l.kind === 'abbonamento');
  assert.ok(sub, 'attesa la leva abbonamento');
  assert.ok(sub.label.includes('Palestra'), 'sceglie il più caro');
  assert.equal(sub.endDelta, 60);
});

test('bestLevers: le leve sono ordinate per giorni guadagnati', () => {
  const profile = { dailyMean: 40, dailyMedian: 40, sigma: 6, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const base = simulateCash({ startBalance: 800, profile, ledger: [], now: NOW, horizonDays: 45 });
  const levers = bestLevers(base, { profile, ledger: [], startBalance: 800, now: NOW, horizonDays: 45 });
  for (let i = 1; i < levers.length; i++) assert.ok(levers[i - 1].daysGained >= levers[i].daysGained);
});

// ── ingresso unico ──────────────────────────────────────────────────────────
test('cashForecast: tace onestamente quando non c\'è nulla su cui basarsi', () => {
  const f = cashForecast({ allTx: {}, commitments: [], salary: null, now: NOW });
  assert.equal(f.known, false);
  assert.ok(f.reason);
});

test('cashForecast: senza saldo dichiarato la previsione è RELATIVA e lo dichiara', () => {
  const allTx = historyOf(60, () => 15);
  const f = cashForecast({ allTx, commitments: [affitto], salary, now: NOW, horizonDays: 30 });
  assert.equal(f.known, true);
  assert.equal(f.relative, true);
  assert.equal(f.startBalance, 0);
  assert.ok(/più di oggi|più di quanto hai oggi/.test(f.headline), f.headline);
});

test('cashForecast: con saldo dichiarato parla del giorno critico', () => {
  const allTx = historyOf(60, () => 40);
  const f = cashForecast({ allTx, commitments: [affitto, mutuo], salary, startBalance: 400, now: NOW, horizonDays: 30 });
  assert.equal(f.relative, false);
  assert.ok(f.riskDay, 'con 400€ e 40€/giorno il rischio esiste');
  assert.ok(f.headline.includes(f.riskDay.date));
});

test('cashForecast: usa gli importi APPRESI degli impegni (bolletta variabile)', () => {
  // bolletta dichiarata 50€ ma pagata realmente ~120€ negli ultimi mesi
  const allTx = {};
  for (const d of ['2026-04-12', '2026-05-12', '2026-06-12']) {
    (allTx[d.slice(0, 7)] ||= []).push({ type: 'uscita', amount: 120, date: d, description: 'Enel', category: 'casa' });
  }
  // importo fuori banda (120 vs 50 digitati): lo riconosce dal NOME dell'esercente,
  // altrimenti non imparerebbe MAI la cifra vera di una bolletta sottostimata.
  const bolletta = { id: 'b1', name: 'Luce', merchant: 'Enel', amount: 50, dayOfMonth: 12, kind: 'bolletta' };
  const f = cashForecast({ allTx, commitments: [bolletta], salary: null, startBalance: 0, now: NOW, horizonDays: 40 });
  const ev = f.ledger.find(e => e.source === 'commitment');
  assert.equal(ev.amount, -120, 'usa la media reale appresa, non i 50€ digitati');
});

test('cashForecast: la confidenza riflette la copertura dello storico', () => {
  const corto = cashForecast({ allTx: historyOf(20, () => 10), commitments: [], salary, startBalance: 0, now: NOW });
  const lungo = cashForecast({ allTx: historyOf(90, () => 10), commitments: [], salary, startBalance: 0, now: NOW });
  assert.ok(corto.confidence < lungo.confidence);
});

test('cashForecast: dichiara sempre metodo e ipotesi (onestà tecnica)', () => {
  const f = cashForecast({ allTx: historyOf(60, () => 12), commitments: [affitto], salary, startBalance: 500, now: NOW });
  assert.ok(f.method.length > 10);
  assert.ok(f.assumptions.length >= 2);
  assert.ok(f.assumptions.some(a => a.includes('giorno')));
});

test('cashForecast: il debito di divisione compare come scenario separato', () => {
  const f = cashForecast({ allTx: historyOf(60, () => 10), commitments: [], salary, splitOwed: 85,
    startBalance: 300, now: NOW, horizonDays: 30 });
  assert.equal(f.withSplit.owed, 85);
  assert.ok(f.withSplit.endP50 < f.end.p50);
});

test('cashForecast: percorso lungo esattamente quanto l\'orizzonte richiesto', () => {
  const f = cashForecast({ allTx: historyOf(60, () => 10), commitments: [], salary, startBalance: 100, now: NOW, horizonDays: 21 });
  assert.equal(f.path.length, 21);
  assert.equal(f.path.at(-1).date, iso(NOW + 21 * DAY));
});

test('simulateCash: se la dispersione è stata MISURATA su finestre reali, la banda la usa', () => {
  // σ giornaliera piccola ma finestre di 14 giorni molto disperse (spese a
  // grappoli): la banda deve seguire la misura, non la teoria dell'indipendenza.
  const teorica = { dailyMean: 10, sigma: 5, blockSigma: {}, dowFactor: [1, 1, 1, 1, 1, 1, 1], observedDays: 90, coverage: 1 };
  const misurata = { ...teorica, blockSigma: { 14: 400 } };
  const a = simulateCash({ startBalance: 1000, profile: teorica, ledger: [], now: NOW, horizonDays: 14 });
  const b = simulateCash({ startBalance: 1000, profile: misurata, ledger: [], now: NOW, horizonDays: 14 });
  assert.ok((b.end.p90 - b.end.p10) > (a.end.p90 - a.end.p10) * 3, 'la banda misurata è molto più larga');
});

test('simulateCash: un impegno a importo variabile allarga la banda (forbice appresa)', () => {
  const fisso = buildLedger({ commitments: [{ id: 'x', name: 'Rata', amount: 200, dayOfMonth: 25, kind: 'prestito' }], now: NOW, horizonDays: 20 });
  const vario = buildLedger({ commitments: [{ id: 'x', name: 'Luce', amount: 200, dayOfMonth: 25, kind: 'bolletta',
    variable: true, learned: true, learnedMin: 90, learnedMax: 310 }], now: NOW, horizonDays: 20 });
  const a = simulateCash({ startBalance: 1000, profile: null, ledger: fisso, now: NOW, horizonDays: 20 });
  const b = simulateCash({ startBalance: 1000, profile: null, ledger: vario, now: NOW, horizonDays: 20 });
  assert.equal(a.end.p90 - a.end.p10, 0, 'una rata fissa non aggiunge incertezza');
  assert.ok(b.end.p90 - b.end.p10 > 100, 'una bolletta variabile sì');
});

test('discretionaryProfile: misura la dispersione anche a 7 e 30 giorni quando lo storico basta', () => {
  // spesa irregolare (non periodica): un pattern perfettamente ciclico avrebbe
  // finestre lunghe QUASI COSTANTI, ed è giusto che la misura lo rifletta.
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const allTx = historyOf(90, () => Math.round(rnd() * 120));
  const p = discretionaryProfile(allTx, { now: NOW });
  assert.ok(p.blockSigma[7] > 0 && p.blockSigma[14] > 0 && p.blockSigma[30] > 0);
  assert.ok(p.blockSigma[30] > p.blockSigma[7], 'con spesa irregolare le finestre lunghe disperdono di più');
});

// ── ponte verso NeuroSym: extraDailyCut ──────────────────────────────────────
test('cashForecast: extraDailyCut riduce il ritmo di spesa e sposta il finale in meglio', () => {
  const allTx = historyOf(60, () => 30);
  const base = cashForecast({ allTx, commitments: [], salary: null, startBalance: 0, now: NOW, horizonDays: 20 });
  const cut = cashForecast({ allTx, commitments: [], salary: null, startBalance: 0, now: NOW, horizonDays: 20, extraDailyCut: 10 });
  assert.ok(cut.end.p50 > base.end.p50, 'tagliare 10€/giorno lascia più soldi a fine finestra');
  assert.ok(Math.abs((cut.end.p50 - base.end.p50) - 200) < 5, 'circa 10€ × 20 giorni in più');
});

test('cashForecast: extraDailyCut non manda mai il ritmo sotto zero', () => {
  const allTx = historyOf(60, () => 5);
  const cut = cashForecast({ allTx, commitments: [], salary: null, startBalance: 0, now: NOW, horizonDays: 10, extraDailyCut: 999 });
  assert.equal(cut.profile.dailyMean, 0);
});

test('cashForecast: extraDailyCut=0 (default) non cambia nulla', () => {
  const allTx = historyOf(60, () => 20);
  const a = cashForecast({ allTx, commitments: [], salary: null, startBalance: 0, now: NOW, horizonDays: 15 });
  const b = cashForecast({ allTx, commitments: [], salary: null, startBalance: 0, now: NOW, horizonDays: 15, extraDailyCut: 0 });
  assert.deepEqual(a.end, b.end);
});
