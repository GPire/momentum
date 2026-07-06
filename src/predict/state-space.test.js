import test from "node:test";
import assert from "node:assert/strict";
import { createHoltWintersState, updateHoltWintersState, forecastFromState } from "./state-space.js";

// HoltWinters (engines.js) non ha dipendenze da browser: importabile diretto, nessuno shim.
const { HoltWinters } = await import("./engines.js");

function syntheticSeries(n, period = 7) {
  // trend leggero + stagionalità settimanale + piccolo rumore deterministico
  const arr = [];
  for (let i = 0; i < n; i++) {
    const trend = i * 0.5;
    const seasonal = (i % period === 5 || i % period === 6) ? 20 : 5; // weekend più alto
    const noise = (i * 37 % 7) - 3;
    arr.push(Math.max(0, 50 + trend + seasonal + noise));
  }
  return arr;
}

test("createHoltWintersState + forecastFromState riproduce ESATTAMENTE il risultato della versione batch (stato a freddo)", () => {
  const series = syntheticSeries(42);
  const batch = new HoltWinters().forecast(series, 14);

  const state = createHoltWintersState(series);
  const streaming = forecastFromState(state, 14);

  assert.equal(streaming.level, batch.level);
  assert.equal(streaming.trend, batch.trend);
  for (let i = 0; i < batch.forecasted.length; i++) {
    assert.ok(Math.abs(streaming.forecasted[i] - batch.forecasted[i]) < 1e-9, `forecast[${i}] diverge: ${streaming.forecasted[i]} vs ${batch.forecasted[i]}`);
  }
});

test("updateHoltWintersState converge verso lo stesso ordine di grandezza di un ri-calcolo batch sulla serie estesa (non identico per costruzione, vedi commento in state-space.js)", () => {
  const series = syntheticSeries(70);
  let state = createHoltWintersState(series.slice(0, 56));

  // aggiunge i restanti 14 punti UNO ALLA VOLTA, O(1) ciascuno
  for (let i = 56; i < series.length; i++) {
    state = updateHoltWintersState(state, series[i]);
  }
  const streaming = forecastFromState(state, 7);

  const batch = new HoltWinters().forecast(series, 7);

  // non ci aspettiamo identità bit-per-bit (la versione batch ri-baseline
  // la media stagionale ad ogni chiamata, quella streaming no per essere
  // O(1)) — verifichiamo che restino nello stesso ordine di grandezza,
  // non che divergano in modo scomposto
  for (let i = 0; i < batch.forecasted.length; i++) {
    const relDiff = Math.abs(streaming.forecasted[i] - batch.forecasted[i]) / Math.max(1, batch.forecasted[i]);
    assert.ok(relDiff < 0.35, `forecast[${i}] troppo divergente: streaming=${streaming.forecasted[i]} batch=${batch.forecasted[i]} (${(relDiff*100).toFixed(1)}%)`);
  }
});

test("updateHoltWintersState non riprocessa mai la storia: costo indipendente dal numero di punti già visti", () => {
  const series = syntheticSeries(20);
  let state = createHoltWintersState(series);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 5000; i++) {
    state = updateHoltWintersState(state, 50 + (i % 10));
  }
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  // 5000 aggiornamenti O(1) devono essere quasi istantanei; una regressione a
  // O(n) per chiamata (es. qualcuno reintroduce una scansione della storia)
  // farebbe esplodere questo tempo con l'aumentare delle chiamate
  assert.ok(elapsedMs < 200, `5000 update O(1) hanno impiegato ${elapsedMs}ms, sospetta regressione a costo non costante`);
  assert.equal(state.t, series.length + 5000);
});

test("con storia insufficiente (< 2 periodi) resta in modalità fallback fino a raggiungere la soglia", () => {
  let state = createHoltWintersState([10, 12, 11]); // period=7 default, serve almeno 14 punti
  assert.equal(state.initialized, false);
  for (let i = 0; i < 20; i++) state = updateHoltWintersState(state, 10 + i % 3);
  assert.equal(state.initialized, true); // deve attivarsi una volta raggiunta la soglia
});

test("il forecast da stato non inizializzato è una proiezione piatta sulla media, non un errore o NaN", () => {
  const state = createHoltWintersState([5, 6, 7]);
  const result = forecastFromState(state, 5);
  assert.equal(result.forecasted.length, 5);
  result.forecasted.forEach(v => assert.ok(!isNaN(v)));
});
