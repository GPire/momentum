import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initEstimate, addUnit, estimate, samplesNeeded, shouldStop,
  compareOptions, estimateText, savingsText, MIN_CAMPIONI, Z_95,
} from './progressive-estimate.js';

// Generatore deterministico: i test non devono dipendere da Math.random.
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
// Normale via Box-Muller, deterministica.
const normale = (r, mu, sigma) => {
  const u = Math.max(1e-12, r()), v = r();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const versa = (state, n, mu, sigma, seed) => {
  const r = rng(seed); let s = state;
  for (let i = 0; i < n; i++) s = addUnit(s, { valore: normale(r, mu, sigma), indice: i });
  return s;
};

// ── La stima esiste dal primo campione, e lo dichiara ──

test('con zero o un campione non si finge una stima', () => {
  assert.equal(estimate(initEstimate()).media, null);
  const uno = addUnit(initEstimate(), { valore: 100 });
  const e = estimate(uno);
  assert.equal(e.media, 100);
  assert.equal(e.affidabile, false);
  assert.match(e.motivo, /due campioni/);
});

test('sotto la soglia la stima c\'è ma non si dichiara affidabile', () => {
  const s = versa(initEstimate(), MIN_CAMPIONI - 1, 1000, 200, 7);
  const e = estimate(s);
  assert.equal(e.affidabile, false);
  assert.ok(e.media > 0, 'un numero c\'è comunque');
  assert.match(e.motivo, /rumore/);
});

test('la media stimata converge sulla verità e l\'intervallo la contiene', () => {
  const VERO = 1200;
  const s = versa(initEstimate(), 4000, VERO, 300, 11);
  const e = estimate(s);
  assert.ok(Math.abs(e.media - VERO) < 20, `media ${e.media} lontana dal vero ${VERO}`);
  assert.ok(e.da < VERO && e.a > VERO, `l'intervallo [${e.da}, ${e.a}] deve contenere ${VERO}`);
  assert.ok(Math.abs(e.deviazione - 300) < 20, `deviazione stimata ${e.deviazione}`);
});

test('l\'intervallo si STRINGE man mano che arrivano i risultati — è tutto il punto', () => {
  const poco = versa(initEstimate(), 50, 1000, 400, 3);
  const tanto = versa(initEstimate(), 5000, 1000, 400, 3);
  assert.ok(estimate(tanto).semiAmpiezza < estimate(poco).semiAmpiezza / 5,
    'con 100 volte i campioni l\'incertezza deve scendere di circa 10 volte');
});

test('lotti di dimensione diversa: una fetta grande conta più di una piccola', () => {
  // Due dispositivi con fette diverse, come le assegna assignWork.
  let s = initEstimate();
  s = addUnit(s, { n: 900, media: 100, m2: 0 });
  s = addUnit(s, { n: 100, media: 200, m2: 0 });
  const e = estimate(s);
  assert.equal(e.n, 1000);
  assert.ok(Math.abs(e.media - 110) < 1e-9, `media pesata attesa 110, ottenuta ${e.media}`);
});

test('fondere i lotti dà ESATTAMENTE lo stesso risultato che mandare i valori uno per uno', () => {
  const r = rng(909); const valori = Array.from({ length: 600 }, () => normale(r, 1000, 250));
  let unoAUno = initEstimate();
  for (const v of valori) unoAUno = addUnit(unoAUno, { valore: v });
  // Gli stessi valori divisi in 6 lotti da 100, ognuno ridotto ai suoi tre numeri.
  let aLotti = initEstimate();
  for (let k = 0; k < 6; k++) {
    const fetta = valori.slice(k * 100, k * 100 + 100);
    const media = fetta.reduce((a, b) => a + b, 0) / fetta.length;
    const m2 = fetta.reduce((a, b) => a + (b - media) ** 2, 0);
    aLotti = addUnit(aLotti, { n: fetta.length, media, m2 });
  }
  const a = estimate(unoAUno), b = estimate(aLotti);
  assert.equal(a.n, b.n);
  assert.ok(Math.abs(a.media - b.media) < 1e-9, `${a.media} vs ${b.media}`);
  assert.ok(Math.abs(a.semiAmpiezza - b.semiAmpiezza) < 1e-9, `${a.semiAmpiezza} vs ${b.semiAmpiezza}`);
});

test('IL BUG CHE HA TROVATO IL TEST: un lotto senza dispersione viene rifiutato, non accettato con un intervallo finto', () => {
  // Accettarlo produceva un errore standard dieci volte più piccolo del vero:
  // una precisione inventata, che è peggio di nessuna precisione.
  assert.throws(() => addUnit(initEstimate(), { n: 100, media: 184000, m2: undefined }), /dispersione/);
  // Un campione singolo invece non ha dispersione interna: è legittimo.
  assert.equal(estimate(addUnit(initEstimate(), { valore: 5 })).media, 5);
});

test('un\'unità eterogenea viene RIFIUTATA invece di falsare la statistica in silenzio', () => {
  assert.throws(() => addUnit(initEstimate(), { valore: 1, eterogenea: true }), /STESSA distribuzione/);
});

test('valori non numerici non entrano nella stima', () => {
  let s = versa(initEstimate(), 20, 500, 50, 5);
  const prima = estimate(s).n;
  s = addUnit(s, { valore: NaN });
  s = addUnit(s, { valore: undefined });
  assert.equal(estimate(s).n, prima);
});

// ── IL PUNTO CENTRALE: le unità perse non rompono niente ──

test('IL TUTTO-O-NIENTE SPARISCE: perdere il 30% delle unità allarga l\'intervallo, non cancella la risposta', () => {
  const VERO = 800;
  const completo = versa(initEstimate(), 3000, VERO, 250, 21);
  // Stessi campioni, ma tre dispositivi su dieci non hanno mai consegnato.
  const r = rng(21); let parziale = initEstimate();
  for (let i = 0; i < 3000; i++) { const v = normale(r, VERO, 250); if (i % 10 >= 3) parziale = addUnit(parziale, { valore: v }); }

  const ec = estimate(completo), ep = estimate(parziale);
  assert.equal(ep.affidabile, true, 'con il 70% dei risultati la risposta deve esistere');
  assert.ok(ep.da < VERO && ep.a > VERO, 'e deve restare corretta');
  assert.ok(ep.semiAmpiezza > ec.semiAmpiezza, 'più larga, come è giusto');
  assert.ok(ep.semiAmpiezza < ec.semiAmpiezza * 1.5, `ma solo di poco: ${ep.semiAmpiezza} vs ${ec.semiAmpiezza}`);
});

// ── Quanti campioni servono, e quando smettere ──

test('il numero di campioni si DEDUCE dalla variabilità, non si fissa a un numero tondo', () => {
  const tranquillo = versa(initEstimate(), 300, 1000, 50, 31);
  const turbolento = versa(initEstimate(), 300, 1000, 500, 31);
  const a = samplesNeeded(tranquillo, { semiAmpiezzaVoluta: 10 });
  const b = samplesNeeded(turbolento, { semiAmpiezzaVoluta: 10 });
  assert.ok(b.servono > a.servono * 50, `al fenomeno turbolento ne servono molti di più: ${a.servono} vs ${b.servono}`);
  // Controllo del conto: n ≈ (z·σ/semi)²
  const atteso = ((Z_95 * estimate(tranquillo).deviazione) / 10) ** 2;
  assert.ok(Math.abs(a.servono - atteso) <= 1, `${a.servono} vs ${atteso}`);
});

test('quando la precisione chiesta è irraggiungibile lo dice, invece di prometterla', () => {
  const s = versa(initEstimate(), 200, 1000, 900, 41);
  const r = samplesNeeded(s, { semiAmpiezzaVoluta: 0.01, tetto: 100000 });
  assert.equal(r.oltreIlTetto, true);
  assert.match(r.motivo, /intervallo più largo/);
});

test('senza ancora variabilità osservata non inventa un numero', () => {
  assert.equal(samplesNeeded(initEstimate(), { semiAmpiezzaVoluta: 5 }).servono, null);
});

test('si smette appena la precisione è raggiunta, e si dice quanto si è risparmiato', () => {
  const s = versa(initEstimate(), 2000, 1000, 200, 51);
  const r = shouldStop(s, { semiAmpiezzaVoluta: 20, unitaConsegnate: 20, unitaTotali: 100 });
  assert.equal(r.basta, true);
  assert.equal(r.perche, 'precisione raggiunta');
  assert.equal(r.risparmiate, 80);
  assert.match(savingsText({ risparmiate: 80, unitaTotali: 100 }), /80%/);
});

test('se la precisione non basta si continua', () => {
  const s = versa(initEstimate(), 40, 1000, 400, 61);
  assert.equal(shouldStop(s, { semiAmpiezzaVoluta: 1, unitaConsegnate: 4, unitaTotali: 100 }).basta, false);
});

test('quando non arriverà più niente si chiude con quello che c\'è, dichiarandolo', () => {
  const s = versa(initEstimate(), 500, 1000, 300, 71);
  const r = shouldStop(s, { semiAmpiezzaVoluta: 0.5, unitaConsegnate: 100, unitaTotali: 100 });
  assert.equal(r.basta, true);
  assert.equal(r.perche, 'non arriverà altro');
  assert.equal(r.stima.affidabile, true);
});

test('la precisione si può chiedere anche in percentuale, che è come la si pensa', () => {
  const s = versa(initEstimate(), 3000, 10000, 1000, 81);
  const r = shouldStop(s, { precisioneRelativaVoluta: 0.01, unitaConsegnate: 30, unitaTotali: 100 });
  assert.equal(r.basta, true, `precisione relativa ottenuta: ${estimate(s).precisioneRelativa}`);
});

// ── Il confronto: la domanda vera ──

test('per sapere CHI vince non serve sapere QUANTO: si decide molto prima', () => {
  const a = versa(initEstimate(), 400, 1200, 300, 91);
  const b = versa(initEstimate(), 400, 900, 300, 92);
  const r = compareOptions(a, b);
  assert.equal(r.deciso, true);
  assert.equal(r.vincitrice, 'A');
  // Eppure nessuna delle due è ancora nota con precisione stretta.
  assert.ok(estimate(a).semiAmpiezza > 20, 'le singole stime sono ancora larghe, e va bene così');
});

test('se la differenza è dentro il margine di errore NON si sceglie un vincitore', () => {
  const a = versa(initEstimate(), 300, 1000, 400, 101);
  const b = versa(initEstimate(), 300, 1005, 400, 102);
  const r = compareOptions(a, b);
  assert.equal(r.deciso, false);
  assert.match(r.motivo, /margine di errore/);
  assert.ok(r.da <= 0 && r.a >= 0, 'l\'intervallo della differenza contiene lo zero');
});

test('una vittoria vera ma irrilevante nella pratica viene dichiarata tale', () => {
  // Differenza vera di 3 € su un fenomeno poco variabile: statisticamente
  // certa, e completamente irrilevante per chi deve decidere.
  const a = versa(initEstimate(), 8000, 1003, 20, 111);
  const b = versa(initEstimate(), 8000, 1000, 20, 112);
  const r = compareOptions(a, b, { differenzaTrascurabile: 5 });
  assert.equal(r.deciso, true);
  assert.equal(r.irrilevante, true);
  assert.match(r.motivo, /equivalenti/);
});

test('confrontare troppo presto non produce un verdetto', () => {
  const a = versa(initEstimate(), 3, 1000, 300, 121);
  const b = versa(initEstimate(), 3, 900, 300, 122);
  const r = compareOptions(a, b);
  assert.equal(r.deciso, false);
  assert.match(r.motivo, /troppo presto/);
});

// ── Come si racconta ──

test('il testo per la persona non contiene gergo statistico', () => {
  const s = versa(initEstimate(), 2000, 184320, 12000, 131);
  const t = estimateText(s);
  assert.match(t, /^Fra /);
  assert.ok(!/confidenza|standard|varianza|deviazione|campion|stima/i.test(t), `gergo nel testo: ${t}`);
  assert.match(estimateText(versa(initEstimate(), 3, 100, 10, 141)), /è presto/);
  assert.equal(estimateText(initEstimate()), 'Sto ancora calcolando.');
});

test('non si vanta di un risparmio che non c\'è stato', () => {
  assert.equal(savingsText({ risparmiate: 2, unitaTotali: 100 }), null);
  assert.equal(savingsText({ risparmiate: 0, unitaTotali: 100 }), null);
});

// ── L'innesto nel mercato del calcolo ──

test('INNESTO: il piano si chiude da solo quando la risposta è decisa, e dice cosa annullare', async () => {
  const { planComputation, evaluateProgress } = await import('./compute-market.js');
  const capace = (score) => ({ score, disponibile: true, motivi: [] });
  const plan = planComputation({
    kind: 'montecarlo-strategie', totalUnits: 100,
    peers: [{ peerId: 'a', capability: capace(8) }, { peerId: 'b', capability: capace(8) }],
    self: { cores: 4 }, verifyRatio: 0,
    // Precisione chiesta: ±600 € su una proiezione da 184.000 €. Chiedere di
    // più su un fenomeno con questa variabilità sarebbe chiedere cifre
    // decimali, non una risposta migliore.
    precisione: { semiAmpiezzaVoluta: 600 },
  });
  // Arrivano i primi 20 risultati: ognuno è un lotto di 100 percorsi, ridotto
  // ai tre numeri che bastano (quanti, media, dispersione).
  const r = rng(211); let stima = initEstimate();
  for (let i = 0; i < 20; i++) {
    const percorsi = Array.from({ length: 100 }, () => normale(r, 184000, 12000));
    const media = percorsi.reduce((a, b) => a + b, 0) / 100;
    const m2 = percorsi.reduce((a, b) => a + (b - media) ** 2, 0);
    stima = addUnit(stima, { n: 100, media, m2, indice: i });
  }

  const p = evaluateProgress(plan, stima, { unitaConsegnate: 20 });
  assert.equal(p.basta, true, 'con 2000 percorsi la precisione chiesta è già raggiunta');
  assert.equal(p.daAnnullare.length, 80, 'le 80 unità non ancora servite non servono più a nessuno');
  assert.match(p.testo, /^Fra /);
  assert.match(p.risparmio, /80%/);
});

test('INNESTO: senza precisione dichiarata non si ferma niente (comportamento storico)', async () => {
  const { planComputation, evaluateProgress } = await import('./compute-market.js');
  const capace = (score) => ({ score, disponibile: true, motivi: [] });
  const plan = planComputation({
    kind: 'montecarlo-strategie', totalUnits: 100,
    peers: [{ peerId: 'a', capability: capace(8) }, { peerId: 'b', capability: capace(8) }],
    self: { cores: 4 }, verifyRatio: 0,
  });
  const stima = versa(initEstimate(), 500, 184000, 12000, 221);
  const p = evaluateProgress(plan, stima, { unitaConsegnate: 20 });
  assert.equal(p.basta, false);
  assert.deepEqual(p.daAnnullare, []);
});
