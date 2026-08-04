import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeObservations, capitalProcess, evidenceAgainst, confidenceSequence,
  runExperiment, estimateRemaining, naivePeekingTest,
} from './anytime-experiment.js';

function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
}

// ── Normalizzazione onesta ──

test('un valore fuori dall\'intervallo dichiarato allarga l\'intervallo e lo SEGNALA', () => {
  const n = normalizeObservations([10, 20, 500], { lo: 0, hi: 100 });
  assert.equal(n.allargato, true, 'schiacciare in silenzio falserebbe la garanzia');
  assert.ok(n.x.every((v) => v >= 0 && v <= 1));
});

test('valori tutti uguali sono dichiarati degeneri, non forzati', () => {
  const n = normalizeObservations([5, 5, 5]);
  assert.equal(n.degenere, true);
});

// ── La proprietà fondamentale: il capitale non può azzerarsi ──

test('il capitale resta sempre positivo, anche nel caso peggiore', () => {
  const rnd = rng(3);
  const x = Array.from({ length: 300 }, () => rnd());
  for (const m of [0.01, 0.5, 0.99]) {
    for (const dir of [1, -1]) {
      const p = capitalProcess(x, m, { direzione: dir });
      assert.ok(p.storia.every((k) => k > 0), `capitale non positivo con m=${m} dir=${dir}`);
      assert.ok(Number.isFinite(p.K));
    }
  }
});

// ── IL TEST DECISIVO ──
// Mille esperimenti in cui NON è cambiato niente, guardati ogni giorno.
// Il metodo classico deve sbagliare molto più spesso del 5% dichiarato;
// il metodo valido in ogni istante deve restare sotto il 5%.
test('GUARDARE OGNI GIORNO: il test classico esplode, quello valido-sempre regge', () => {
  const RIPETIZIONI = 1000;
  const PERIODI = 60;
  const m = 0.5;
  let falsiClassico = 0, falsiAnytime = 0;

  for (let r = 0; r < RIPETIZIONI; r++) {
    const rnd = rng(r * 7919 + 13);
    // Ipotesi nulla VERA: media esattamente 0.5, nessun cambiamento.
    const x = Array.from({ length: PERIODI }, () => rnd());
    if (naivePeekingTest(x, m).rifiutato) falsiClassico++;
    if (evidenceAgainst(x, m, { alpha: 0.05 }).rifiutato) falsiAnytime++;
  }

  const tassoClassico = (100 * falsiClassico / RIPETIZIONI);
  const tassoAnytime = (100 * falsiAnytime / RIPETIZIONI);
  // eslint-disable-next-line no-console
  console.log(`[anytime] falsi allarmi guardando ogni giorno per ${PERIODI} periodi, su ${RIPETIZIONI} esperimenti — classico: ${tassoClassico.toFixed(1)}% | valido-sempre: ${tassoAnytime.toFixed(1)}%`);

  assert.ok(tassoClassico > 15,
    `il test classico DEVE gonfiarsi guardandolo ogni giorno (misurato ${tassoClassico.toFixed(1)}%): se non lo fa, il confronto non dimostra nulla`);
  assert.ok(tassoAnytime <= 5,
    `il metodo valido in ogni istante deve rispettare il 5% dichiarato, misurato ${tassoAnytime.toFixed(1)}%`);
  assert.ok(tassoClassico > tassoAnytime * 3,
    `atteso un divario netto: classico ${tassoClassico.toFixed(1)}% vs valido-sempre ${tassoAnytime.toFixed(1)}%`);
});

// ── Potenza: un cambiamento vero va trovato ──

test('un cambiamento VERO e grande viene rilevato', () => {
  const rnd = rng(29);
  // Media 0.75 contro un riferimento di 0.5: cambiamento netto.
  const x = Array.from({ length: 80 }, () => Math.min(1, 0.5 + rnd() * 0.5));
  const e = evidenceAgainst(x, 0.5, { alpha: 0.05 });
  assert.equal(e.rifiutato, true, `un cambiamento evidente doveva essere trovato: ${JSON.stringify(e)}`);
  assert.equal(e.direzione, 'aumento');
  assert.ok(e.primoIstanteDecisivo > 0 && e.primoIstanteDecisivo <= 80);
});

test('la direzione riportata è quella giusta anche in diminuzione', () => {
  const rnd = rng(31);
  const x = Array.from({ length: 80 }, () => Math.max(0, rnd() * 0.5));
  const e = evidenceAgainst(x, 0.5, { alpha: 0.05 });
  assert.equal(e.rifiutato, true);
  assert.equal(e.direzione, 'diminuzione');
});

// ── Intervallo valido in ogni istante ──

test('l\'intervallo si stringe man mano che arrivano dati', () => {
  const rnd = rng(37);
  const tutti = Array.from({ length: 200 }, () => 0.3 + rnd() * 0.1);
  const corto = confidenceSequence(tutti.slice(0, 20), { alpha: 0.05, griglia: 51 });
  const lungo = confidenceSequence(tutti, { alpha: 0.05, griglia: 51 });
  assert.ok(lungo.larghezza < corto.larghezza,
    `più dati devono stringere l'intervallo: ${corto.larghezza} → ${lungo.larghezza}`);
});

test('l\'intervallo contiene la media vera', () => {
  const rnd = rng(41);
  const x = Array.from({ length: 200 }, () => 0.35 + (rnd() - 0.5) * 0.1); // media ~0.35
  const cs = confidenceSequence(x, { alpha: 0.05, griglia: 101 });
  assert.ok(cs.lo <= 0.35 && cs.hi >= 0.35, `atteso un intervallo che contiene 0.35: ${JSON.stringify(cs)}`);
});

// ── L'esperimento come lo vive la persona ──

test('ESPERIMENTO: un taglio di spesa reale viene confermato con un intervallo in euro', () => {
  const rnd = rng(43);
  const baseline = Array.from({ length: 30 }, () => 100 + rnd() * 40);   // ~120 €
  const followUp = Array.from({ length: 40 }, () => 60 + rnd() * 40);    // ~80 €
  const r = runExperiment({ name: 'meno ristoranti', baseline, followUp, lo: 0, hi: 200 });
  assert.equal(r.stato, 'concluso');
  assert.equal(r.conclusione, 'cambiato');
  assert.ok(r.differenza < -20, `atteso un calo netto, ottenuto ${r.differenza}`);
  assert.match(r.messaggio, /diminuito davvero/);
  assert.ok(Array.isArray(r.intervallo), 'deve riportare un intervallo in euro');
});

test('ESPERIMENTO: il verdetto scomodo "non è cambiato niente" viene detto chiaramente', () => {
  const rnd = rng(47);
  const baseline = Array.from({ length: 40 }, () => 100 + rnd() * 20);
  const followUp = Array.from({ length: 40 }, () => 100 + rnd() * 20); // identico
  const r = runExperiment({ name: 'prova inutile', baseline, followUp, lo: 0, hi: 200 });
  assert.equal(r.conclusione, 'nessun-cambiamento');
  assert.match(r.messaggio, /non ha funzionato: è un'informazione utile, non un fallimento/);
  assert.equal(r.puoiFermarti, true);
});

test('ESPERIMENTO: all\'inizio dice che è presto, e che si può guardare comunque', () => {
  const rnd = rng(53);
  const baseline = Array.from({ length: 30 }, () => 100 + rnd() * 20);
  const followUp = [95, 98];
  const r = runExperiment({ name: 'appena iniziato', baseline, followUp, lo: 0, hi: 200, minPeriodi: 10 });
  assert.equal(r.stato, 'in-corso');
  assert.match(r.messaggio, /Puoi guardare quando vuoi, il risultato resta valido/);
  assert.equal(r.puoiFermarti, false);
});

test('ESPERIMENTO: senza periodo di confronto non si inventa un risultato', () => {
  const r = runExperiment({ name: 'senza base', baseline: [], followUp: [1, 2, 3] });
  assert.equal(r.conclusione, null);
  assert.match(r.messaggio, /Manca il periodo di confronto|non è ancora successo abbastanza/i);
});

// ── Quanto manca ──

test('QUANTO MANCA: con un effetto vero stima un numero di periodi raggiungibile', () => {
  const rnd = rng(59);
  const x = Array.from({ length: 15 }, () => Math.min(1, 0.62 + rnd() * 0.2));
  const e = estimateRemaining(x, 0.5);
  if (e.periodi !== null) {
    assert.ok(e.periodi >= 0 && e.periodi < 500, `stima irragionevole: ${e.periodi}`);
    assert.match(e.messaggio, /Servono ancora|abbastanza/);
  }
});

test('QUANTO MANCA: se non si sta andando da nessuna parte, lo dice invece di promettere', () => {
  const rnd = rng(61);
  const x = Array.from({ length: 40 }, () => rnd()); // nessun effetto
  const e = estimateRemaining(x, 0.5);
  if (e.periodi === null) {
    assert.match(e.messaggio, /non arriveremo a una risposta|troppo piccola/);
  }
});

test('QUANTO MANCA: con troppi pochi dati non si stima', () => {
  const e = estimateRemaining([0.5, 0.6], 0.5);
  assert.equal(e.periodi, null);
  assert.match(e.messaggio, /Troppo presto/);
});

// ── Linguaggio ──

test('i messaggi non contengono gergo statistico', () => {
  const rnd = rng(67);
  const baseline = Array.from({ length: 30 }, () => 100 + rnd() * 40);
  const followUp = Array.from({ length: 40 }, () => 60 + rnd() * 40);
  const casi = [
    runExperiment({ name: 'a', baseline, followUp, lo: 0, hi: 200 }),
    runExperiment({ name: 'b', baseline, followUp: [95, 98], lo: 0, hi: 200, minPeriodi: 10 }),
    runExperiment({ name: 'c', baseline, followUp: baseline, lo: 0, hi: 200 }),
  ];
  for (const c of casi) {
    assert.ok(!/p-value|martingal|Ville|alpha|ipotesi nulla|e-value|confidence/i.test(c.messaggio),
      `gergo trovato: ${c.messaggio}`);
  }
});
