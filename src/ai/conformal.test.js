import test from 'node:test';
import assert from 'node:assert/strict';
import {
  minCalibrationFor, conformalQuantile, calibrateClassifier, predictSet,
  calibrateRegressor, predictInterval, initAdaptive, updateAdaptive,
  observedCoverage, setText, intervalText, interruptionRate,
} from './conformal.js';

// mulberry32 e non un LCG: con un generatore lineare congruenziale, prendere
// un numero fisso di estrazioni per caso (qui 5) introduce una correlazione
// strutturale fra l'etichetta e le probabilita' — e i test misuravano una
// copertura del 98,6% invece del 90%, cioe' un difetto del banco di prova
// scambiabile per un difetto del modulo. Il generatore va bene solo se e' il
// caso a essere davvero casuale.
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const normale = (r, mu, sigma) => {
  const u = Math.max(1e-12, r()), v = r();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ── La correzione per campione finito: è ciò che rende la garanzia vera ──

test('quanti esempi servono davvero per il livello chiesto', () => {
  assert.equal(minCalibrationFor(0.1), 9, 'per il 90% servono 9 esempi');
  assert.equal(minCalibrationFor(0.05), 19, 'per il 95% ne servono 19');
});

test('con troppi pochi esempi NON si finge la garanzia: si restituisce l\'infinito', () => {
  const q = conformalQuantile([0.1, 0.2, 0.3], 0.05);
  assert.equal(q.q, Infinity);
  assert.equal(q.garantito, false);
  assert.match(q.motivo, /ne servono almeno 19/);
});

test('il quantile è quello CONFORME, non quello campionario', () => {
  // 9 punteggi, alpha 0.1 → k = ceil(10*0.9) = 9 → il massimo, non il 90esimo
  // percentile campionario (che sarebbe l'ottavo). Sbagliare qui è l'errore
  // più comune, e rompe la garanzia proprio nei casi limite.
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.equal(conformalQuantile(s, 0.1).q, 9);
  assert.equal(conformalQuantile(s, 0.2).q, 8);
});

// ── LA GARANZIA, verificata empiricamente e non solo citata ──

test('COPERTURA DIMOSTRATA: su mille casi nuovi la risposta vera è dentro ~90 volte su 100', () => {
  const r = rng(7);
  const categorie = ['Bar', 'Ristorante', 'Spesa', 'Trasporti'];
  // Un modello mediocre apposta: la garanzia deve reggere lo stesso, ed è
  // esattamente la proprietà che nessuna "confidenza del modello" possiede.
  const caso = () => {
    const vera = categorie[Math.floor(r() * categorie.length)];
    const dist = {};
    let tot = 0;
    for (const c of categorie) { const p = c === vera ? 0.3 + r() * 0.5 : r() * 0.4; dist[c] = p; tot += p; }
    for (const c of categorie) dist[c] /= tot;
    return { vera, distribuzione: dist };
  };
  const cal = calibrateClassifier(Array.from({ length: 300 }, caso));
  let dentro = 0;
  const prove = Array.from({ length: 1000 }, caso);
  for (const p of prove) if (predictSet(p.distribuzione, cal, { alpha: 0.1 }).insieme.includes(p.vera)) dentro++;
  const copertura = dentro / prove.length;
  assert.ok(copertura >= 0.87 && copertura <= 0.95, `copertura misurata ${copertura}, attesa ~0.90`);
});

test('chiedere più garanzia costa insiemi più larghi — non si ottiene niente gratis', () => {
  const r = rng(11);
  const categorie = ['a', 'b', 'c', 'd', 'e'];
  const caso = () => {
    const vera = categorie[Math.floor(r() * categorie.length)];
    const dist = {}; let tot = 0;
    for (const c of categorie) { const p = c === vera ? 0.4 + r() * 0.3 : r() * 0.3; dist[c] = p; tot += p; }
    for (const c of categorie) dist[c] /= tot;
    return { vera, distribuzione: dist };
  };
  const cal = calibrateClassifier(Array.from({ length: 400 }, caso));
  const prove = Array.from({ length: 200 }, caso);
  const media = (alpha) => prove.reduce((s, p) => s + predictSet(p.distribuzione, cal, { alpha }).ampiezza, 0) / prove.length;
  assert.ok(media(0.01) > media(0.1), `99%: ${media(0.01)} deve essere più largo del 90%: ${media(0.1)}`);
});

test('quando il modello sa, l\'insieme è UNO e l\'app non deve chiedere niente', () => {
  const cal = calibrateClassifier(Array.from({ length: 100 }, () => ({ vera: 'Bar', distribuzione: { Bar: 0.97, Altro: 0.03 } })));
  const r = predictSet({ Bar: 0.98, Altro: 0.02 }, cal, { alpha: 0.1 });
  assert.equal(r.certo, true);
  assert.deepEqual(r.insieme, ['Bar']);
  assert.equal(setText(r), 'È Bar.');
});

test('quando NON sa distinguere due categorie lo dice, e chiede una cosa sola', () => {
  const r = rng(13);
  const cal = calibrateClassifier(Array.from({ length: 200 }, () => {
    const vera = r() < 0.5 ? 'Bar' : 'Ristorante';
    return { vera, distribuzione: { Bar: 0.45, Ristorante: 0.45, Spesa: 0.1 } };
  }));
  // Caso davvero indistinguibile: le due categorie hanno la stessa probabilita'.
  const s = predictSet({ Bar: 0.45, Ristorante: 0.45, Spesa: 0.1 }, cal, { alpha: 0.1 });
  assert.equal(s.ampiezza, 2);
  assert.equal(s.certo, false);
  assert.match(setText(s), /^È Bar oppure Ristorante: quale delle due\?$/);
});

test('una spesa che non somiglia a niente viene riconosciuta come tale', () => {
  const cal = calibrateClassifier(Array.from({ length: 100 }, () => ({ vera: 'Bar', distribuzione: { Bar: 0.95, Altro: 0.05 } })));
  const s = predictSet({ Bar: 0.34, Altro: 0.33, Terzo: 0.33 }, cal, { alpha: 0.1 });
  assert.equal(s.fuoriDominio, true);
  assert.match(setText(s), /dimmi tu cos'è/);
});

test('una categoria mai vista dal modello riceve scomodità massima, non un errore', () => {
  const cal = calibrateClassifier([{ vera: 'Nuova', distribuzione: { Bar: 1 } }]);
  assert.equal(cal.scores[0], 1);
});

// ── Regressione: cassa, fisco, rendimenti ──

test('l\'intervallo sulla cassa copre il vero circa quanto promesso', () => {
  const r = rng(17);
  const esempi = Array.from({ length: 300 }, () => { const p = 1000 + r() * 500; return { previsto: p, vero: p + normale(r, 0, 200) }; });
  const cal = calibrateRegressor(esempi);
  let dentro = 0;
  for (let i = 0; i < 1000; i++) {
    const p = 1000 + r() * 500, vero = p + normale(r, 0, 200);
    const iv = predictInterval(p, cal, { alpha: 0.1 });
    if (vero >= iv.da && vero <= iv.a) dentro++;
  }
  assert.ok(dentro / 1000 >= 0.87, `copertura ${dentro / 1000}`);
});

test('con pochi dati l\'intervallo è ILLIMITATO e il testo lo ammette', () => {
  const cal = calibrateRegressor([{ previsto: 10, vero: 12 }, { previsto: 20, vero: 19 }]);
  const iv = predictInterval(15, cal, { alpha: 0.05 });
  assert.equal(iv.illimitato, true);
  assert.equal(iv.garantito, false);
  assert.match(intervalText(iv), /troppo poco per dirti quanto posso sbagliare/);
});

test('il testo dell\'intervallo non usa gergo statistico', () => {
  const r = rng(19);
  const cal = calibrateRegressor(Array.from({ length: 100 }, () => { const p = 5000; return { previsto: p, vero: p + normale(r, 0, 300) }; }));
  const t = intervalText(predictInterval(5000, cal, { alpha: 0.1 }));
  assert.match(t, /^Fra /);
  assert.ok(!/confidenza|quantile|conforme|alpha|copertura/i.test(t), `gergo: ${t}`);
});

// ── L'adattiva: quando la vita cambia ──

test('se sbaglia più del promesso, allarga da sola', () => {
  let s = initAdaptive(0.1);
  const iniziale = s.alpha;
  for (let i = 0; i < 30; i++) s = updateAdaptive(s, false); // sbaglia sempre
  assert.ok(s.alpha < iniziale, `alpha deve scendere (intervalli più larghi): ${s.alpha}`);
});

test('se va meglio del promesso, stringe — non resta larga per sempre', () => {
  let s = initAdaptive(0.1);
  for (let i = 0; i < 50; i++) s = updateAdaptive(s, true);
  assert.ok(s.alpha > 0.1, `alpha deve salire (intervalli più stretti): ${s.alpha}`);
  assert.ok(s.alpha <= 0.5, 'ma non oltre il tetto');
});

test('a regime alpha si stabilizza sul bersaglio, perche' + String.fromCharCode(39) + 'e' + String.fromCharCode(39) + ' un anello chiuso', () => {
  // La simulazione DEVE accoppiare l'errore ad alpha: nella realta' un alpha
  // piu' alto significa intervalli piu' stretti e quindi piu' errori. Una
  // simulazione con errore fisso farebbe camminare alpha a caso — ed e'
  // esattamente quello che faceva la prima versione di questo test, misurando
  // una passeggiata aleatoria e chiamandola instabilita' del metodo.
  const r = rng(23);
  let s = initAdaptive(0.1);
  for (let i = 0; i < 3000; i++) s = updateAdaptive(s, r() > s.alpha);
  assert.ok(Math.abs(s.alpha - 0.1) < 0.05, `alpha ${s.alpha} deve assestarsi su 0.1`);
  const c = observedCoverage(s, { finestra: 500 });
  assert.ok(Math.abs(c.copertura - 0.9) < 0.06, `copertura osservata ${c.copertura}`);
});

test('la copertura VERA si misura, non si assume — e uno scostamento nel rumore non è un allarme', () => {
  const r = rng(29);
  let s = initAdaptive(0.1);
  for (let i = 0; i < 100; i++) s = updateAdaptive(s, r() > 0.1);
  const c = observedCoverage(s);
  assert.equal(c.n, 100);
  assert.equal(c.inLinea, true, `copertura ${c.copertura}, non doveva suonare l'allarme`);
  assert.equal(c.motivo, null);
});

test('un peggioramento vero viene detto in italiano, non con un numero', () => {
  let s = initAdaptive(0.1);
  for (let i = 0; i < 60; i++) s = updateAdaptive(s, i % 2 === 0); // copre solo metà
  const c = observedCoverage(s);
  assert.equal(c.inLinea, false);
  assert.match(c.motivo, /sbagliando più di quanto avevo promesso/);
});

test('senza casi verificati non si inventa una copertura', () => {
  assert.equal(observedCoverage(initAdaptive(0.1)).copertura, null);
});

// ── La metrica anti-abbandono ──

test('QUANTE VOLTE l\'app interrompe davvero la persona: è il numero da guardare', () => {
  const r = rng(31);
  const categorie = ['Bar', 'Spesa', 'Trasporti', 'Casa'];
  // Modello buono: quasi sempre sa. Le domande devono essere poche.
  const caso = () => {
    const vera = categorie[Math.floor(r() * categorie.length)];
    const dist = {}; let tot = 0;
    for (const c of categorie) { const p = c === vera ? 0.8 + r() * 0.2 : r() * 0.08; dist[c] = p; tot += p; }
    for (const c of categorie) dist[c] /= tot;
    return { vera, distribuzione: dist };
  };
  const cal = calibrateClassifier(Array.from({ length: 300 }, caso));
  const risultati = Array.from({ length: 300 }, caso).map((p) => predictSet(p.distribuzione, cal, { alpha: 0.1 }));
  const m = interruptionRate(risultati);
  assert.ok(m.quota < 0.2, `con un modello buono si deve chiedere poco: quota ${m.quota}`);
  assert.ok(m.ampiezzaMedia < 1.5);
  assert.equal(interruptionRate([]).quota, null);
});

test('con un modello scadente le domande aumentano — e il numero lo rende visibile', () => {
  const r = rng(37);
  const categorie = ['a', 'b', 'c', 'd'];
  const caso = () => {
    const vera = categorie[Math.floor(r() * categorie.length)];
    const dist = {}; let tot = 0;
    for (const c of categorie) { const p = 0.2 + r() * 0.3; dist[c] = p; tot += p; }
    for (const c of categorie) dist[c] /= tot;
    return { vera, distribuzione: dist };
  };
  const cal = calibrateClassifier(Array.from({ length: 300 }, caso));
  const risultati = Array.from({ length: 300 }, caso).map((p) => predictSet(p.distribuzione, cal, { alpha: 0.1 }));
  assert.ok(interruptionRate(risultati).quota > 0.5, 'un modello che tira a indovinare deve risultare evidente');
});

test('la copertura misurata NON deve essere gonfiata: vicino al 90%, non al 99%', () => {
  const r = rng(41);
  const categorie = ['a', 'b', 'c', 'd'];
  const caso = () => {
    const vera = categorie[Math.floor(r() * categorie.length)];
    const dist = {}; let tot = 0;
    for (const c of categorie) { const p = c === vera ? 0.3 + r() * 0.5 : r() * 0.4; dist[c] = p; tot += p; }
    for (const c of categorie) dist[c] /= tot;
    return { vera, distribuzione: dist };
  };
  const cal = calibrateClassifier(Array.from({ length: 500 }, caso));
  const prove = Array.from({ length: 2000 }, caso);
  const dentro = prove.filter((p) => predictSet(p.distribuzione, cal, { alpha: 0.1 }).insieme.includes(p.vera)).length;
  const cop = dentro / prove.length;
  // Il limite superiore è la parte che conta: una garanzia molto più larga del
  // richiesto significa insiemi inutilmente grandi, cioè domande inutili.
  assert.ok(cop >= 0.87 && cop <= 0.94, `copertura ${cop}: deve essere ~0.90, non gonfiata`);
});

test('l\'insieme vuoto vale come domanda, non come risposta certa', () => {
  const cal = calibrateClassifier(Array.from({ length: 100 }, () => ({ vera: 'Bar', distribuzione: { Bar: 0.96, Altro: 0.04 } })));
  const s = predictSet({ Bar: 0.4, Altro: 0.35, Terzo: 0.25 }, cal, { alpha: 0.1 });
  assert.equal(s.ampiezza, 0);
  assert.equal(s.certo, false);
  assert.equal(s.migliore, 'Bar', 'la UI deve comunque poter proporre qualcosa');
  assert.equal(interruptionRate([s]).quota, 1);
});
