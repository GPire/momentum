// ============================================================
// NONLINEAR DEPENDENCE — vedere i legami che la correlazione non vede
// ============================================================
// Il limite che resta in `causal-discovery.js`: la correlazione parziale
// misura solo la dipendenza LINEARE. È una scelta ragionevole (veloce, stabile
// con pochi dati) ma ha un punto cieco enorme e molto concreto sui soldi.
//
// Esempi reali di legami che la correlazione dichiara INESISTENTI:
//  • a soglia — "finché sto sotto budget non cambio niente, appena sforo taglio
//    tutto": la relazione esiste solo da una certa cifra in poi;
//  • a U — spendo poco quando sono a casa e poco quando sono in vacanza, molto
//    nel mezzo: la correlazione è esattamente zero e il legame è fortissimo;
//  • saturazione — oltre un certo importo un aumento non produce più effetto.
//
// Su tutti questi la correlazione vale ~0 e il motore direbbe "nessun legame".
// Qui si usa la **correlazione di distanza** (Székely, Rizzo, Bakirov 2007),
// che ha una proprietà che la correlazione classica non ha:
//
//     dCor(X, Y) = 0  ⟺  X e Y sono indipendenti
//
// Non "non correlati": INDIPENDENTI. Vale per qualunque forma di legame.
// La significatività si ottiene con un test di permutazione: si rimescola Y
// tante volte e si guarda quanto spesso il legame osservato capiterebbe per
// caso. Non serve assumere nessuna distribuzione.
//
// LIMITE DICHIARATO, perché è reale: il controllo per le variabili terze qui
// avviene togliendo la loro parte LINEARE (residui). Quindi il legame X–Y è
// cercato in modo non parametrico, ma il condizionamento resta lineare. Un
// condizionamento pienamente non parametrico richiederebbe stime di
// informazione condizionale con i vicini più prossimi, che con poche decine di
// settimane di dati personali sono troppo instabili per essere oneste.
//
// Costo: O(n²) in memoria e tempo. Con n fino a qualche centinaio va bene; oltre
// si campiona, dichiarandolo.
'use strict';

import { residualize } from './causal-discovery.js';

// Matrice delle distanze doppiamente centrata: è il cuore del metodo.
// Centrare due volte è ciò che rende la statistica zero se e solo se le
// variabili sono indipendenti.
function doubleCenteredDistances(v) {
  const n = v.length;
  const a = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) row[j] = Math.abs(v[i] - v[j]);
    return row;
  });
  const rowMean = new Float64Array(n);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += a[i][j];
    rowMean[i] = s / n;
    grand += s;
  }
  grand /= n * n;
  const A = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) row[j] = a[i][j] - rowMean[i] - rowMean[j] + grand;
    return row;
  });
  return A;
}

const dotMean = (A, B, n) => {
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += A[i][j] * B[i][j];
  return s / (n * n);
};

// Correlazione di distanza: 0 solo se indipendenti, 1 se perfettamente legate.
// A differenza della correlazione classica non ha segno: misura la FORZA del
// legame, non la direzione. Il segno, quando serve, si legge dalla parte
// lineare — e quando le due dicono cose diverse è un'informazione, non un
// problema da nascondere.
export function distanceCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 4) return null;
  const A = doubleCenteredDistances(x.slice(0, n));
  const B = doubleCenteredDistances(y.slice(0, n));
  const dCovXY = dotMean(A, B, n);
  const dVarX = dotMean(A, A, n);
  const dVarY = dotMean(B, B, n);
  if (dVarX <= 0 || dVarY <= 0) return 0;
  const denom = Math.sqrt(Math.sqrt(dVarX) * Math.sqrt(dVarY));
  if (denom <= 0) return 0;
  const dCor = Math.sqrt(Math.max(0, dCovXY)) / denom;
  return Math.max(0, Math.min(1, dCor));
}

// Generatore deterministico: le permutazioni devono essere riproducibili,
// altrimenti lo stesso dato darebbe risposte diverse a ogni apertura dell'app
// — inaccettabile per un numero che l'utente vede.
function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Test di indipendenza non parametrico, con controllo (lineare) per le terze.
// Il p-value viene da permutazione: nessuna distribuzione assunta.
export function nonlinearIndependenceTest(x, y, Z = [], {
  permutazioni = 199, seed = 12345, maxN = 300,
} = {}) {
  let n = Math.min(x.length, y.length, ...(Z.length ? Z.map((z) => z.length) : [Infinity]));
  if (!Number.isFinite(n) || n < 12) {
    return { dCor: null, p: null, n, motivo: 'Servono almeno 12 periodi per un test senza assunzioni.' };
  }

  // Oltre una certa dimensione il costo quadratico non vale: si campiona in
  // modo deterministico e lo si dichiara nel risultato.
  let campionato = false;
  let xs = x.slice(0, n), ys = y.slice(0, n), zs = Z.map((z) => z.slice(0, n));
  if (n > maxN) {
    const passo = n / maxN;
    const idx = Array.from({ length: maxN }, (_, i) => Math.floor(i * passo));
    xs = idx.map((i) => xs[i]); ys = idx.map((i) => ys[i]); zs = zs.map((z) => idx.map((i) => z[i]));
    n = maxN; campionato = true;
  }

  // Controllo per le terze: si toglie la loro parte lineare. Dichiarato come
  // limite, non spacciato per condizionamento completo.
  const rx = zs.length ? residualize(xs, zs) : xs;
  const ry = zs.length ? residualize(ys, zs) : ys;
  if (!rx || !ry) return { dCor: null, p: null, n, motivo: 'Le variabili di controllo sono ridondanti tra loro.' };

  const osservato = distanceCorrelation(rx, ry);
  if (osservato === null) return { dCor: null, p: null, n, motivo: 'Campione insufficiente.' };

  let piuEstremi = 0;
  for (let k = 0; k < permutazioni; k++) {
    const perm = seededShuffle(ry, seed + k * 7919);
    const d = distanceCorrelation(rx, perm);
    if (d !== null && d >= osservato) piuEstremi++;
  }
  // Stimatore con +1 al numeratore e al denominatore: è la forma corretta per
  // un test di permutazione, e non produce mai un p-value pari a zero (che
  // sarebbe una certezza che non abbiamo).
  const p = (piuEstremi + 1) / (permutazioni + 1);

  return {
    dCor: +osservato.toFixed(4),
    p: +p.toFixed(4),
    n,
    permutazioni,
    campionato,
    controlloLineare: zs.length > 0,
  };
}

// Il confronto che rende utile tutto il modulo: dove il metodo lineare e
// quello non parametrico DISACCORDANO. Un disaccordo non è un errore di uno
// dei due: è la firma di un legame che esiste ma non è una linea retta, e
// dirlo cambia il consiglio che si può dare.
export function compareLinearVsNonlinear(x, y, Z = [], opts = {}) {
  const { partialCorrelationTest } = opts.testers || {};
  const lineare = partialCorrelationTest
    ? partialCorrelationTest(x, y, Z)
    : null;
  const nonlin = nonlinearIndependenceTest(x, y, Z, opts);
  if (!lineare || lineare.p === null || nonlin.p === null) {
    return { lineare, nonlineare: nonlin, verdetto: 'non-valutabile' };
  }

  const alpha = opts.alpha ?? 0.05;
  const lin = lineare.p <= alpha;
  const nl = nonlin.p <= alpha;

  let verdetto, spiegazione;
  if (lin && nl) {
    verdetto = 'legame-lineare';
    spiegazione = 'Il legame c\'è ed è abbastanza regolare: al crescere di uno cresce (o cala) l\'altro in modo costante.';
  } else if (!lin && nl) {
    verdetto = 'legame-nascosto';
    spiegazione = 'Il legame c\'è ma NON è una linea retta: guardando solo le medie sembrerebbe che non esista. Probabilmente conta una soglia, o l\'effetto cambia oltre un certo punto.';
  } else if (lin && !nl) {
    verdetto = 'legame-debole';
    spiegazione = 'Si vede un andamento comune, ma non abbastanza forte da reggere un controllo senza assunzioni: da prendere con cautela.';
  } else {
    verdetto = 'nessun-legame';
    spiegazione = 'Nessun legame, né dritto né storto.';
  }
  return { lineare, nonlineare: nonlin, verdetto, spiegazione, discordi: lin !== nl };
}
