import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const { simulateCategoryChange } = await import('./what-if.js');

const REF = new Date(2026, 6, 15);

// Storia con legame vero Ristorante↔Trasporti (settimane alterne) e medie note.
function history() {
  const allTx = {};
  const monday0 = new Date(2026, 0, 5);
  for (let w = 0; w < 25; w++) {
    const d = new Date(monday0.getTime() + w * 7 * 86_400_000 + 2 * 86_400_000).toISOString().slice(0, 10);
    const mk = d.slice(0, 7);
    (allTx[mk] = allTx[mk] || []).push(
      { date: d, amount: w % 2 === 0 ? 120 : 30, description: 'cena', type: 'uscita', category: 'Ristorante' },
      { date: d, amount: w % 2 === 0 ? 60 : 15, description: 'taxi', type: 'uscita', category: 'Trasporti' },
    );
  }
  return allTx;
}

test('taglio del 20% su Ristorante → risparmio diretto positivo e coerente con la media reale', () => {
  const sim = simulateCategoryChange({ allTx: history(), catId: 'Ristorante', deltaPct: -20, referenceDate: REF });
  assert.ok(sim);
  assert.ok(sim.categoryMonthlyAvg > 0);
  assert.equal(sim.directMonthly, +(sim.categoryMonthlyAvg * 0.2).toFixed(2)); // 20% della media
  assert.ok(sim.directMonthly > 0); // tagliare = risparmiare
});

test('gli effetti a catena includono Trasporti (legame misurato) con verso concorde', () => {
  const sim = simulateCategoryChange({ allTx: history(), catId: 'Ristorante', deltaPct: -20, referenceDate: REF });
  const tr = sim.chainEffects.find(e => e.category === 'Trasporti');
  assert.ok(tr, 'effetto a catena su Trasporti mancante');
  assert.ok(tr.pct < 0, 'taglio Ristorante → Trasporti scende (correlazione positiva)');
  assert.ok(tr.monthlyEur > 0, 'quindi altro risparmio in €');
  assert.ok(sim.totalMonthly > sim.directMonthly, 'il totale include la catena');
});

test('aumento del 30% → costo diretto negativo', () => {
  const sim = simulateCategoryChange({ allTx: history(), catId: 'Ristorante', deltaPct: 30, referenceDate: REF });
  assert.ok(sim.directMonthly < 0);
});

test('categoria senza storia recente → null, mai simulazioni inventate', () => {
  assert.equal(simulateCategoryChange({ allTx: {}, catId: 'Fantasma', deltaPct: -20, referenceDate: REF }), null);
});
