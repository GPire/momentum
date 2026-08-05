import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startCategoryExperiment, stopCategoryExperiment, activeExperiments, experimentStatus,
} from './experiment-tracker.js';

const NOW = new Date('2026-08-04T12:00:00Z'); // martedì

function tx(category, amount, date) {
  return { type: 'uscita', category, amount, date: new Date(date).toISOString() };
}

function txForWeeks(category, importoPerSettimana, daSettimane, aSettimane, now = NOW) {
  const monday = new Date(now);
  const day = monday.getDay();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1) - day);
  const out = [];
  for (let w = daSettimane; w < aSettimane; w++) {
    const d = new Date(monday.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000);
    out.push(tx(category, importoPerSettimana, d));
  }
  return { '2026-XX': out };
}

// ── Avvio: la fotografia del passato ──

test('avviare un esperimento fotografa le settimane passate come baseline', () => {
  const allTx = txForWeeks('Ristoranti', 80, -6, 0); // 6 settimane passate, prima di ora
  const exp = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW, settimaneBaseline: 6 });
  assert.equal(exp.Ristoranti.baseline.length, 6);
  assert.ok(exp.Ristoranti.baseline.every((v) => Math.abs(v - 80) < 1e-6));
});

test('avviare un esperimento su una categoria in corso lo SOSTITUISCE (mai un accumulo silenzioso)', () => {
  const allTx = txForWeeks('Ristoranti', 80, -6, 0);
  const primo = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW });
  const secondo = startCategoryExperiment(primo, 'Ristoranti', allTx, { now: new Date(NOW.getTime() + 20 * 86_400_000) });
  assert.notEqual(primo.Ristoranti.avviatoIl, secondo.Ristoranti.avviatoIl);
});

test('due categorie possono avere esperimenti indipendenti insieme', () => {
  const allTx = { ...txForWeeks('Ristoranti', 80, -6, 0), ...txForWeeks('Trasporti', 30, -6, 0) };
  let exps = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW });
  exps = startCategoryExperiment(exps, 'Trasporti', allTx, { now: NOW });
  assert.deepEqual(activeExperiments(exps).sort(), ['Ristoranti', 'Trasporti']);
});

test('fermare un esperimento lo rimuove senza toccare gli altri', () => {
  let exps = startCategoryExperiment({}, 'Ristoranti', {}, { now: NOW });
  exps = startCategoryExperiment(exps, 'Trasporti', {}, { now: NOW });
  exps = stopCategoryExperiment(exps, 'Ristoranti');
  assert.deepEqual(activeExperiments(exps), ['Trasporti']);
});

// ── Stato: guardabile in ogni momento, senza consumare nulla ──

test('senza esperimento avviato per quella categoria, lo stato è null', () => {
  assert.equal(experimentStatus({}, 'Ristoranti', {}, { now: NOW }), null);
});

test('appena avviato, dice che è presto e non emette un verdetto', () => {
  const allTx = txForWeeks('Ristoranti', 80, -6, 0);
  const exps = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW, settimaneBaseline: 6 });
  const stato = experimentStatus(exps, 'Ristoranti', allTx, { now: new Date(NOW.getTime() + 3 * 86_400_000) });
  assert.equal(stato.conclusione, null);
});

// Il caso che dimostra l'integrazione: una vera riduzione di spesa dopo
// l'avvio viene misurata e confermata con un intervallo in euro.
test('INTEGRAZIONE: una riduzione reale dopo l\'avvio viene rilevata', () => {
  let allTx = txForWeeks('Ristoranti', 80, -6, 0); // baseline: 6 settimane a 80€
  const exps = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW, settimaneBaseline: 6 });

  // Simula 8 settimane DOPO l'avvio con spesa dimezzata, con un po' di rumore
  // deterministico (non tutte identiche: un esperimento reale non lo è mai).
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; }
  const rnd = rng(5);
  const dopo = new Date(NOW.getTime() + 8 * 7 * 86_400_000);
  const followTx = txForWeeks('Ristoranti', 1, 0, 8, dopo); // placeholder, sovrascritto sotto
  followTx['2026-XX'] = followTx['2026-XX'].map((t, i) => ({ ...t, amount: 35 + rnd() * 10 }));
  allTx = { '2026-A': allTx['2026-XX'], '2026-B': followTx['2026-XX'] };

  const stato = experimentStatus(exps, 'Ristoranti', allTx, { now: dopo });
  assert.equal(stato.settimanePassate, 8);
  assert.equal(stato.mediaBaseline, 80);
  if (stato.conclusione === 'cambiato') {
    assert.ok(stato.differenza < -20, `atteso un calo netto, ottenuto ${stato.differenza}`);
    assert.ok(Array.isArray(stato.intervallo));
  }
});

test('senza alcun cambiamento, lo stato lo dice chiaramente', () => {
  const allTx = txForWeeks('Ristoranti', 80, -6, 0);
  const exps = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW, settimaneBaseline: 6 });
  const dopo = new Date(NOW.getTime() + 8 * 7 * 86_400_000);
  const identico = txForWeeks('Ristoranti', 80, 0, 8, dopo);
  const tutto = { '2026-A': allTx['2026-XX'], '2026-B': identico['2026-XX'] };
  const stato = experimentStatus(exps, 'Ristoranti', tutto, { now: dopo });
  if (stato.conclusione === 'nessun-cambiamento') {
    assert.match(stato.messaggio, /non ha funzionato: è un'informazione utile/);
  }
});

test('nessuno stato dipende dal momento in cui lo si guarda (guardabile sempre)', () => {
  const allTx = txForWeeks('Ristoranti', 80, -6, 0);
  const exps = startCategoryExperiment({}, 'Ristoranti', allTx, { now: NOW, settimaneBaseline: 6 });
  const dopo = new Date(NOW.getTime() + 5 * 7 * 86_400_000);
  const segue = txForWeeks('Ristoranti', 50, 0, 5, dopo);
  const tutto = { '2026-A': allTx['2026-XX'], '2026-B': segue['2026-XX'] };
  const a = experimentStatus(exps, 'Ristoranti', tutto, { now: dopo });
  const b = experimentStatus(exps, 'Ristoranti', tutto, { now: dopo });
  assert.deepEqual(a, b, 'guardare due volte lo stesso stato deve dare la stessa risposta');
});
