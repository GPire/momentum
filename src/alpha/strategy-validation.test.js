import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalCdf, normalInv, sharpeRatio, expectedMaxSharpe,
  deflatedSharpe, minimumTrackRecord, detectLookAhead,
  validateStrategy, validateStrategySet,
} from './strategy-validation.js';

// Rendimenti deterministici: i test devono fallire per un bug, mai per fortuna.
function gaussiani(n, mu, sigma, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
  const out = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u1 = Math.max(1e-9, rnd()), u2 = rnd();
    out.push(mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }
  return out;
}

// ── Fondamenta matematiche verificate contro valori noti ──

test('normalCdf coincide con i valori tabulati noti', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.645) - 0.95) < 1e-3, `atteso ~0.95, ottenuto ${normalCdf(1.645)}`);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(normalCdf(-1.96) - 0.025) < 1e-3);
});

test('normalInv è l\'inversa di normalCdf sui valori noti', () => {
  assert.ok(Math.abs(normalInv(0.95) - 1.6449) < 1e-3, `ottenuto ${normalInv(0.95)}`);
  assert.ok(Math.abs(normalInv(0.975) - 1.95996) < 1e-3);
  assert.ok(Math.abs(normalInv(0.5)) < 1e-6);
  for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    assert.ok(Math.abs(normalCdf(normalInv(p)) - p) < 1e-3, `giro completo fallito su p=${p}`);
  }
});

test('sharpeRatio su una serie senza variabilità è zero, non infinito', () => {
  assert.equal(sharpeRatio([0.01, 0.01, 0.01, 0.01]), 0);
  assert.equal(sharpeRatio([]), 0);
});

// ── La soglia di fortuna: il numero che nessuno calcola ──

test('con UNA sola prova non c\'è nulla da scontare: soglia zero', () => {
  assert.equal(expectedMaxSharpe(1), 0);
});

test('più strategie si provano, più alta è la soglia da battere', () => {
  const s2 = expectedMaxSharpe(2);
  const s8 = expectedMaxSharpe(8);
  const s100 = expectedMaxSharpe(100);
  assert.ok(s2 > 0 && s8 > s2 && s100 > s8, `attesa crescita monotona: ${s2}, ${s8}, ${s100}`);
});

// IL test che dimostra il valore di tutto il modulo: strategie SENZA alcun
// valore reale, di cui si sceglie la migliore. Il metodo ingenuo la
// promuoverebbe; il vaglio deve bocciarla.
test('DATA SNOOPING: la migliore di 50 strategie inutili viene BOCCIATA', () => {
  const strategie = Array.from({ length: 50 }, (_, i) => ({
    name: `inutile-${i}`,
    returns: gaussiani(120, 0, 0.04, i + 1), // media zero: nessun valore reale
  }));
  // La "migliore" per Sharpe grezzo — quella che un backtest ingenuo mostrerebbe.
  const migliore = strategie
    .map((s) => ({ ...s, sr: sharpeRatio(s.returns) }))
    .sort((a, b) => b.sr - a.sr)[0];
  assert.ok(migliore.sr > 0, 'la migliore di 50 casuali ha per forza uno Sharpe positivo');

  const ingenuo = deflatedSharpe(migliore.returns, { trials: 1 });
  const corretto = deflatedSharpe(migliore.returns, { trials: 50 });
  assert.ok(corretto.probabilita < ingenuo.probabilita,
    'tenere conto dei 50 tentativi deve abbassare la fiducia');
  assert.notEqual(corretto.verdetto, 'solido',
    `la migliore di 50 strategie casuali NON deve mai risultare solida (${JSON.stringify(corretto)})`);
});

test('una strategia con un vantaggio VERO e grande regge anche a molti tentativi', () => {
  const vera = gaussiani(600, 0.02, 0.03, 7); // Sharpe atteso ~0.67 per periodo, molto forte
  const r = deflatedSharpe(vera, { trials: 50 });
  assert.equal(r.verdetto, 'solido', JSON.stringify(r));
  assert.ok(r.probabilita > 0.95);
});

test('con pochi dati non si emette un verdetto: si dice che sono pochi', () => {
  const r = deflatedSharpe([0.01, -0.02, 0.03], { trials: 8 });
  assert.equal(r.verdetto, 'dati-insufficienti');
  assert.equal(r.probabilita, null);
  assert.match(r.spiegazione, /almeno 8 periodi/);
});

test('le code grasse abbassano la fiducia a parità di Sharpe (il caso cripto)', () => {
  const normale = gaussiani(200, 0.01, 0.03, 3);
  // Stessa media e deviazione, ma con due scossoni estremi: code più grasse.
  const conCode = [...normale];
  conCode[10] = 0.35; conCode[150] = -0.34;
  const a = deflatedSharpe(normale, { trials: 8 });
  const b = deflatedSharpe(conCode, { trials: 8 });
  assert.ok(b.code > a.code, 'la serie con scossoni deve avere code più grasse');
});

// ── Quanto storico servirebbe ──

test('se il risultato non è ancora credibile, dice quanti periodi mancano', () => {
  const debole = gaussiani(40, 0.004, 0.03, 11);
  const m = minimumTrackRecord(debole);
  if (m.periodi !== null) {
    assert.ok(m.periodi > 0);
    assert.match(m.spiegazione, /Servirebbero|già sufficiente/);
  }
});

test('se il vantaggio è nullo o negativo, si dice che non è questione di tempo', () => {
  // Media chiaramente negativa: nessuna quantità di storico la renderebbe buona.
  const inPerdita = gaussiani(100, -0.02, 0.03, 13);
  assert.ok(sharpeRatio(inPerdita) < 0, 'il campione deve essere davvero in perdita');
  const m = minimumTrackRecord(inPerdita);
  assert.equal(m.periodi, null);
  assert.match(m.spiegazione, /non è una questione di tempo/);
});

// ── Guardare avanti: l'errore che rende un backtest bellissimo e falso ──

test('un segnale che GUARDA IL FUTURO viene scoperto', () => {
  const serie = Array.from({ length: 100 }, (_, i) => ({ close: 100 + Math.sin(i / 5) * 10 }));
  // Barare: il segnale legge il prezzo di DOMANI.
  const baro = (s, t) => (s[t + 1] ? (s[t + 1].close > s[t].close ? 'compra' : 'vendi') : null);
  const r = detectLookAhead(serie, baro);
  assert.equal(r.sospetto, true);
  assert.match(r.spiegazione, /non è ottenibile nella realtà/);
  assert.ok(r.violazioni.length > 0);
});

test('un segnale onesto (solo passato) passa il controllo', () => {
  const serie = Array.from({ length: 100 }, (_, i) => ({ close: 100 + Math.sin(i / 5) * 10 }));
  const onesto = (s, t) => (t >= 1 && s[t] && s[t - 1] ? (s[t].close > s[t - 1].close ? 'compra' : 'vendi') : null);
  const r = detectLookAhead(serie, onesto);
  assert.equal(r.sospetto, false);
  assert.ok(r.controllati > 0);
});

test('un segnale che esplode non fa crollare il controllo', () => {
  const serie = Array.from({ length: 60 }, (_, i) => ({ close: 100 + i }));
  const r = detectLookAhead(serie, () => { throw new Error('rotto'); });
  assert.equal(r.sospetto, false);
  assert.equal(r.controllati, 0);
});

test('serie troppo corta: nessun verdetto inventato', () => {
  const r = detectLookAhead([{ close: 1 }, { close: 2 }], () => 'x');
  assert.equal(r.sospetto, false);
  assert.match(r.spiegazione, /troppo corta/);
});

// ── Il verdetto complessivo, comprensibile ──

test('il verdetto è in parole comuni, senza gergo statistico', () => {
  const v = validateStrategy({ name: 'test', returns: gaussiani(200, 0.015, 0.03, 5), trials: 8 });
  const testo = `${v.titolo} ${v.dettaglio}`;
  assert.ok(!/Sharpe|deflat|p-value|curtosi|skew|z-score/i.test(testo), `gergo trovato: ${testo}`);
});

test('una strategia che guarda il futuro viene dichiarata NON reale, non solo dubbia', () => {
  const serie = Array.from({ length: 100 }, (_, i) => ({ close: 100 + Math.sin(i / 5) * 10 }));
  const v = validateStrategy({
    name: 'baro', returns: gaussiani(120, 0.02, 0.03, 5), trials: 4,
    series: serie, signalFn: (s, t) => (s[t + 1] ? s[t + 1].close : null),
  });
  assert.equal(v.mostrabile, false);
  assert.match(v.titolo, /non è reale/);
  assert.ok(v.problemi.includes('usa informazioni che all\'epoca non c\'erano'));
});

test('validateStrategySet usa il NUMERO di strategie come numero di tentativi', () => {
  const strategie = Array.from({ length: 12 }, (_, i) => ({
    name: `s${i}`, returns: gaussiani(150, 0, 0.04, i + 100),
  }));
  const r = validateStrategySet(strategie);
  assert.equal(r.trials, 12, 'confrontare 12 strategie significa 12 tentativi, non 1');
  assert.equal(r.solide.length, 0, 'nessuna strategia senza valore reale deve passare');
  assert.match(r.riassunto, /Nessuna delle 12/);
});

test('il riassunto dice quante ne reggono, anche quando qualcuna regge', () => {
  const strategie = [
    { name: 'vera', returns: gaussiani(600, 0.025, 0.03, 21) },
    ...Array.from({ length: 5 }, (_, i) => ({ name: `finta${i}`, returns: gaussiani(600, 0, 0.03, i + 200) })),
  ];
  const r = validateStrategySet(strategie);
  assert.equal(r.trials, 6);
  assert.ok(r.solide.some((s) => s.name === 'vera'), `la strategia vera doveva reggere: ${JSON.stringify(r.esiti.map((e) => [e.name, e.deflated.verdetto]))}`);
  assert.ok(r.scartate >= 4, 'quasi tutte le finte devono essere scartate');
  assert.match(r.riassunto, /reggono al controllo/);
});

// Il vaglio deve valere anche contro di noi: le nostre 8 strategie passano
// dallo stesso metro. Questo test documenta che il numero di tentativi
// corretto per il nostro confronto interno è 8, non 1.
test('applicato alle NOSTRE 8 strategie, il numero di tentativi è 8', () => {
  const nostre = Array.from({ length: 8 }, (_, i) => ({ name: `strategia-${i}`, returns: gaussiani(300, 0.005, 0.04, i + 50) }));
  const r = validateStrategySet(nostre);
  assert.equal(r.trials, 8);
  for (const e of r.esiti) {
    assert.ok(['solido', 'incerto', 'probabile-fortuna', 'dati-insufficienti', 'non-calcolabile'].includes(e.deflated.verdetto));
  }
});
