// Garanzie su "la cripto mi diversifica?": la matematica deve reggere PRIMA
// che qualcuno prenda una decisione con questi numeri. Qui si verificano
// proprietà (identità di Euler, casi limite noti), non valori scritti a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  correlazione, deviazione, correlazioneQuandoConta, contributoAlRischio,
  esposizioneCripto, testoEsposizioneCripto, MIN_GIORNI,
} from './cripto-azioni.js';

// Generatore deterministico: i test non devono dipendere da Math.random.
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function normali(n, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u = Math.max(1e-12, r()), v = r();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}
// Due serie con correlazione nota rho.
function coppiaCorrelata(n, rho, seed = 3) {
  const r = rng(seed);
  const a = normali(n, r), b = normali(n, r);
  return { x: a, y: a.map((v, i) => rho * v + Math.sqrt(1 - rho * rho) * b[i]) };
}

// ── Correlazione ──
test('CRIPTO-AZIONI: la correlazione ritrova un rho noto', () => {
  for (const rho of [-0.6, 0, 0.3, 0.55, 0.9]) {
    const { x, y } = coppiaCorrelata(4000, rho, 11);
    const c = correlazione(x, y);
    assert.ok(Math.abs(c - rho) < 0.05, `rho ${rho} → ${c}`);
  }
});

test('CRIPTO-AZIONI: non calcolabile → null, mai zero', () => {
  // Zero significa "indipendenti": è una risposta, e sarebbe falsa.
  assert.equal(correlazione([], []), null);
  assert.equal(correlazione([1, 2], [1, 2]), null, 'due punti non bastano');
  assert.equal(correlazione([1, 1, 1, 1], [1, 2, 3, 4]), null, 'una serie ferma non ha correlazione');
  assert.equal(deviazione([5]), 0);
});

test('CRIPTO-AZIONI: la correlazione resta nell’intervallo, sempre', () => {
  const { x, y } = coppiaCorrelata(500, 0.99, 5);
  const c = correlazione(x, y);
  assert.ok(c >= -1 && c <= 1);
});

// ── Correlazione nei giorni peggiori ──
test('CRIPTO-AZIONI: la coda si sceglie sulle AZIONI, non su entrambe', () => {
  // Costruito apposta: indipendenti in media, ma nei giorni peggiori delle
  // azioni la cripto crolla insieme. È il caso che la media nasconde.
  const r = rng(21);
  const azioni = normali(600, r);
  const cripto = azioni.map((a, i) => (a < -1.2 ? a * 1.4 : normali(1, r)[0]));
  const media = correlazione(cripto, azioni);
  const coda = correlazioneQuandoConta(cripto, azioni);
  assert.ok(coda > media + 0.2, `la coda deve smascherare il legame: media ${media}, coda ${coda}`);
});

test('CRIPTO-AZIONI: senza abbastanza storia la coda non si pronuncia', () => {
  const { x, y } = coppiaCorrelata(MIN_GIORNI - 1, 0.5);
  assert.equal(correlazioneQuandoConta(x, y), null);
});

// ── Contributo al rischio: le proprietà che lo rendono corretto ──
test('CRIPTO-AZIONI: i contributi sommano sempre a 1 (identità di Euler)', () => {
  const casi = [
    [[{ nome: 'a', peso: 10, volatilita: 0.8 }, { nome: 'b', peso: 90, volatilita: 0.18 }], [[1, 0.55], [0.55, 1]]],
    [[{ nome: 'a', peso: 50, volatilita: 0.2 }, { nome: 'b', peso: 50, volatilita: 0.2 }], [[1, -0.9], [-0.9, 1]]],
    [[{ nome: 'a', peso: 1, volatilita: 2 }, { nome: 'b', peso: 99, volatilita: 0.1 }], [[1, 0], [0, 1]]],
    [[{ nome: 'a', peso: 33, volatilita: 0.5 }, { nome: 'b', peso: 33, volatilita: 0.3 }, { nome: 'c', peso: 34, volatilita: 0.15 }],
     [[1, 0.4, 0.2], [0.4, 1, 0.6], [0.2, 0.6, 1]]],
  ];
  for (const [voci, corr] of casi) {
    const r = contributoAlRischio(voci, corr);
    const somma = r.voci.reduce((s, v) => s + v.contributo, 0);
    assert.ok(Math.abs(somma - 1) < 1e-9, `somma ${somma}`);
    // E anche i contributi assoluti ricompongono la volatilità totale.
    const sommaAss = r.voci.reduce((s, v) => s + v.contributoAssoluto, 0);
    assert.ok(Math.abs(sommaAss - r.volatilitaPortafoglio) < 1e-9);
  }
});

test('CRIPTO-AZIONI: a parità di tutto, contributo = peso', () => {
  // Due asset identici e perfettamente correlati: metà rischio ciascuno.
  const r = contributoAlRischio(
    [{ nome: 'a', peso: 50, volatilita: 0.3 }, { nome: 'b', peso: 50, volatilita: 0.3 }],
    [[1, 1], [1, 1]],
  );
  assert.ok(Math.abs(r.voci[0].contributo - 0.5) < 1e-9);
});

test('CRIPTO-AZIONI: più volatile e correlato → contribuisce più di quanto pesa', () => {
  const r = contributoAlRischio(
    [{ nome: 'cripto', peso: 10, volatilita: 0.75 }, { nome: 'azioni', peso: 90, volatilita: 0.18 }],
    [[1, 0.55], [0.55, 1]],
  );
  const c = r.voci[0];
  assert.ok(Math.abs(c.peso - 0.1) < 1e-9);
  // Verificato a mano: con w=[0,1|0,9], vol=[0,75|0,18] e rho=0,55 il conto
  // dà 0,272 — un decimo del portafoglio che vale più di un quarto del
  // rischio. È esattamente il numero che questo modulo esiste per dire.
  assert.ok(Math.abs(c.contributo - 0.272) < 0.005, `atteso ~0,272, ottenuto ${c.contributo}`);
  assert.ok(c.contributo > c.peso * 2.5);
});

test('CRIPTO-AZIONI: correlazione negativa → contribuisce MENO del peso (diversifica davvero)', () => {
  const r = contributoAlRischio(
    [{ nome: 'oro', peso: 20, volatilita: 0.15 }, { nome: 'azioni', peso: 80, volatilita: 0.18 }],
    [[1, -0.5], [-0.5, 1]],
  );
  assert.ok(r.voci[0].contributo < r.voci[0].peso);
});

test('CRIPTO-AZIONI: input degeneri non producono numeri finti', () => {
  assert.equal(contributoAlRischio([], []), null);
  assert.equal(contributoAlRischio([{ nome: 'a', peso: 0, volatilita: 0.2 }]), null, 'peso totale zero');
  assert.equal(contributoAlRischio([{ nome: 'a', peso: 10, volatilita: 0 }], [[1]]), null, 'volatilità nulla');
  // Correlazioni mancanti trattate come 0, senza esplodere.
  const r = contributoAlRischio([{ nome: 'a', peso: 1, volatilita: 0.2 }, { nome: 'b', peso: 1, volatilita: 0.2 }], null);
  assert.ok(r && Number.isFinite(r.volatilitaPortafoglio));
});

// ── Il referto ──
test('CRIPTO-AZIONI: scenario reale — 10% di cripto, correlazione 0,55', () => {
  const { x, y } = coppiaCorrelata(800, 0.55, 42);
  // Cripto ~3 volte più volatile delle azioni, com'è nei fatti.
  const cripto = x.map(v => v * 0.045);
  const azioni = y.map(v => v * 0.011);
  const r = esposizioneCripto({ serie: { cripto, azioni }, pesi: { cripto: 1000, azioni: 9000 } });
  assert.equal(r.misurabile, true);
  assert.ok(Math.abs(r.pesoCripto - 0.1) < 1e-6);
  assert.ok(r.contributoRischioCripto > r.pesoCripto * 2, `il rischio deve superare di molto il peso: ${r.contributoRischioCripto}`);
  assert.equal(r.diversificaDavvero, false);
  assert.ok(r.moltiplicatore >= 2);
  const t = testoEsposizioneCripto(r);
  assert.ok(t.includes('10%'), t);
  assert.ok(/non ti sta diversificando/.test(t), t);
  assert.ok(/\d+ giorni/.test(t), 'deve dichiarare su quanti giorni è misurato');
});

test('CRIPTO-AZIONI: un asset che diversifica davvero viene riconosciuto come tale', () => {
  const { x, y } = coppiaCorrelata(800, -0.4, 9);
  const r = esposizioneCripto({ serie: { cripto: x.map(v => v * 0.01), azioni: y.map(v => v * 0.011) }, pesi: { cripto: 2000, azioni: 8000 } });
  assert.equal(r.diversificaDavvero, true);
  assert.ok(/sta ancora facendo il suo mestiere/.test(testoEsposizioneCripto(r)));
});

test('CRIPTO-AZIONI: il referto dice quando la diversificazione sparisce nei crolli', () => {
  const r = rng(77);
  const azioni = normali(700, r);
  const cripto = azioni.map(a => (a < -1.1 ? a * 1.5 : normali(1, r)[0] * 0.9));
  const res = esposizioneCripto({
    serie: { cripto: cripto.map(v => v * 0.03), azioni: azioni.map(v => v * 0.011) },
    pesi: { cripto: 1500, azioni: 8500 },
  });
  assert.ok(res.peggioramentoNeiCrolli > 0.1, `atteso peggioramento, ottenuto ${res.peggioramentoNeiCrolli}`);
  assert.ok(/quando servirebbe/.test(testoEsposizioneCripto(res)));
  assert.ok(res.contributoRischioCriptoNeiCrolli > res.contributoRischioCripto,
    'nei crolli la cripto deve pesare ancora di più sul rischio');
});

test('CRIPTO-AZIONI: si tace quando non c’è abbastanza per parlare', () => {
  const { x, y } = coppiaCorrelata(60, 0.5);
  const corto = esposizioneCripto({ serie: { cripto: x, azioni: y }, pesi: { cripto: 100, azioni: 900 } });
  assert.equal(corto.misurabile, false);
  assert.ok(/giorni/.test(corto.motivo));

  const soloCripto = esposizioneCripto({ serie: { cripto: x, azioni: y }, pesi: { cripto: 100, azioni: 0 } });
  assert.equal(soloCripto.misurabile, false, 'senza azioni non c’è niente da diversificare');
  assert.ok(testoEsposizioneCripto(soloCripto).startsWith('Non misurabile'));
  assert.equal(testoEsposizioneCripto(null), 'Non misurabile.');
});

test('CRIPTO-AZIONI: mai NaN nel referto, con qualunque schifezza in ingresso', () => {
  const sporchi = [
    { serie: {}, pesi: {} },
    { serie: { cripto: [NaN, NaN], azioni: [1, 2] }, pesi: { cripto: 1, azioni: 1 } },
    { serie: { cripto: new Array(300).fill(0), azioni: new Array(300).fill(0) }, pesi: { cripto: 1, azioni: 1 } },
    { serie: { cripto: null, azioni: undefined }, pesi: { cripto: -5, azioni: 'x' } },
    {},
  ];
  for (const caso of sporchi) {
    const r = esposizioneCripto(caso);
    assert.equal(typeof r.misurabile, 'boolean');
    if (r.misurabile) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} non finito`);
      }
    } else {
      assert.ok(typeof r.motivo === 'string' && r.motivo.length > 0);
    }
    assert.equal(typeof testoEsposizioneCripto(r), 'string');
  }
});

test('CRIPTO-AZIONI: funzione pura — stesso input, stesso risultato', () => {
  const { x, y } = coppiaCorrelata(400, 0.5, 4);
  const args = { serie: { cripto: x, azioni: y }, pesi: { cripto: 300, azioni: 700 } };
  const a = JSON.stringify(esposizioneCripto(args));
  for (let i = 0; i < 50; i++) assert.equal(JSON.stringify(esposizioneCripto(args)), a);
});
