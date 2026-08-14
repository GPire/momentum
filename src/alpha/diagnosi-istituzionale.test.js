import test from 'node:test';
import assert from 'node:assert/strict';

const di = await import('./diagnosi-istituzionale.js');
const tr = await import('./portfolio-tail-risk.js');

const pos = (ticker, quantity, avgPrice = 100, assetClass = 'stock') => ({ ticker, quantity, avgPrice, assetClass });
const pesiDi = (obj) => Object.fromEntries(tr.SETTORI.map((s) => [s, obj[s] || 0]));

test('dataDiIndice: l indice 0 è il primo mese del pannello, e la scala non slitta', () => {
  assert.equal(di.dataDiIndice(0), '1999-02');
  assert.equal(di.dataDiIndice(11), '2000-01');
  assert.equal(di.dataDiIndice(12), '2000-02');
});

test('episodiStorici: trova crisi VERE (2008 o dot-com), non finestre a caso', () => {
  const e = di.episodiStorici(pesiDi({ XLF: 1 }), { quanti: 3 });
  assert.equal(e.length, 3);
  // La finanza nel 2008: il peggior episodio deve cadere in quella finestra.
  const anni = e.map((x) => Number(x.da.slice(0, 4)));
  assert.ok(anni.some((a) => a >= 2007 && a <= 2009), `atteso un episodio 2007-2009, trovati ${e.map(x => x.da).join(', ')}`);
  // Le perdite devono essere ordinate dalla peggiore.
  assert.ok(e[0].perdita <= e[1].perdita);
  assert.ok(e[0].perdita < 0);
});

test('episodiStorici: le finestre scelte NON si sovrappongono (mai lo stesso crollo contato tre volte)', () => {
  const e = di.episodiStorici(pesiDi({ XLK: 1 }), { quanti: 3, finestra: 12 });
  for (let i = 0; i < e.length; i++) {
    for (let j = i + 1; j < e.length; j++) {
      assert.ok(Math.abs(e[i].indice - e[j].indice) >= 12, 'due episodi si sovrappongono');
    }
  }
});

test('episodiStorici: la serie restituita ha la lunghezza della finestra (serve alla prova di cassa)', () => {
  const e = di.episodiStorici(pesiDi({ XLE: 1 }), { quanti: 1, finestra: 12 });
  assert.equal(e[0].serie.length, 12);
});

test('divarioCapitaleRischio: un solo settore → nessun divario possibile (100% capitale, 100% rischio)', () => {
  const tail = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 300, seed: 5 });
  const d = di.divarioCapitaleRischio(tail);
  assert.equal(d.valutabile, true);
  assert.ok(Math.abs(d.divarioMassimo) < 0.01);
  assert.equal(d.sbilanciato, null);
});

test('divarioCapitaleRischio: le quote di capitale e di rischio sommano ciascuna a 1', () => {
  const tail = tr.tailRiskPortafoglio([pos('XLK', 5), pos('XLU', 5)], { percorsi: 400, seed: 8 });
  const d = di.divarioCapitaleRischio(tail);
  const sommaCap = d.righe.reduce((s, r) => s + r.quotaCapitale, 0);
  const sommaRis = d.righe.reduce((s, r) => s + r.quotaRischio, 0);
  assert.ok(Math.abs(sommaCap - 1) < 0.01);
  assert.ok(Math.abs(sommaRis - 1) < 0.01);
});

test('divarioCapitaleRischio: metà capitale in un settore volatile e metà in uno difensivo → il divario emerge', () => {
  // XLK (tecnologia) è molto più volatile di XLU (utility): a pesi uguali,
  // la tecnologia deve produrre più della metà della perdita in coda.
  const tail = tr.tailRiskPortafoglio([pos('XLK', 5), pos('XLU', 5)], { percorsi: 800, seed: 21 });
  const d = di.divarioCapitaleRischio(tail);
  const tec = d.righe.find((r) => r.settore === 'XLK');
  assert.ok(Math.abs(tec.quotaCapitale - 0.5) < 0.01, 'il capitale deve essere metà');
  assert.ok(tec.quotaRischio > tec.quotaCapitale, 'la tecnologia deve pesare di più nel rischio che nel capitale');
});

test('scommesseEfficaci: per rischio non può superare per capitale di molto, e un settore solo vale 1', () => {
  const tail = tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 300, seed: 5 });
  const s = di.scommesseEfficaci(tail);
  assert.equal(s.valutabile, true);
  assert.equal(s.perCapitale, 1);
  assert.ok(Math.abs(s.perRischio - 1) < 0.05);
});

test('scommesseEfficaci: un indice ampio mostra più scommesse di un settore solo', () => {
  const ampio = di.scommesseEfficaci(tr.tailRiskPortafoglio([pos('SPY', 10)], { percorsi: 400, seed: 3 }));
  const solo = di.scommesseEfficaci(tr.tailRiskPortafoglio([pos('XLK', 10)], { percorsi: 400, seed: 3 }));
  assert.ok(ampio.perRischio > solo.perRischio);
  assert.ok(ampio.perCapitale > solo.perCapitale);
});

test('provaDiTenuta: cassa abbondante → NON costretto a vendere nemmeno nel peggior episodio', () => {
  const t = di.provaDiTenuta(pesiDi({ XLF: 1 }), {
    liquidita: 100000, speseMensili: 1000, contributoMensile: 0, portafoglio: 50000,
  }, { quanti: 3 });
  assert.equal(t.valutabile, true);
  assert.equal(t.avrestiVenduto, false);
  assert.equal(t.quantiCostretto, 0);
});

test('provaDiTenuta: senza cassa e con spese → costretto a vendere dentro il crollo', () => {
  const t = di.provaDiTenuta(pesiDi({ XLF: 1 }), {
    liquidita: 0, speseMensili: 2000, contributoMensile: 0, portafoglio: 50000,
  }, { quanti: 3 });
  assert.equal(t.avrestiVenduto, true);
  assert.ok(t.quantiCostretto > 0);
  assert.ok(t.esiti[0].perditaRealizzata > 0, 'vendere nel calo deve produrre una perdita vera, non solo sulla carta');
});

test('provaDiTenuta: dichiara i mesi di cassa, il numero che decide l esito', () => {
  const t = di.provaDiTenuta(pesiDi({ XLK: 1 }), { liquidita: 6000, speseMensili: 1000, portafoglio: 20000 });
  assert.equal(t.mesiDiCassa, 6);
});

test('provaDiTenuta: senza portafoglio non si inventa un esito', () => {
  const t = di.provaDiTenuta(pesiDi({ XLK: 1 }), { liquidita: 1000, speseMensili: 500, portafoglio: 0 });
  assert.equal(t.valutabile, false);
});

test('diagnosiIstituzionale: rifiuta quando il portafoglio non è misurabile, senza inventare osservazioni', () => {
  const d = di.diagnosiIstituzionale([pos('BTC', 1, 50000, 'crypto')], {});
  assert.equal(d.valutabile, false);
  assert.ok(d.motivo);
  assert.equal(di.diagnosiTextSemplice(d), null);
});

test('diagnosiIstituzionale: le osservazioni sono ordinate per gravità, la vendita forzata prima di tutto', () => {
  const d = di.diagnosiIstituzionale([pos('XLK', 50), pos('XLU', 50)], {
    liquidita: 0, speseMensili: 3000, percorsi: 500, seed: 13,
  });
  assert.equal(d.valutabile, true);
  assert.ok(d.osservazioni.length > 0);
  assert.equal(d.osservazioni[0].tipo, 'vendita-forzata');
  assert.equal(d.osservazioni[0].gravita, 'alta');
});

test('diagnosiIstituzionale: ogni osservazione porta il numero che la sostiene', () => {
  const d = di.diagnosiIstituzionale([pos('XLK', 50), pos('XLU', 50)], {
    liquidita: 0, speseMensili: 3000, percorsi: 500, seed: 13,
  });
  for (const o of d.osservazioni) {
    assert.ok(o.titolo && o.dettaglio, 'ogni osservazione deve essere spiegata');
    assert.match(o.dettaglio, /\d/, `l'osservazione "${o.tipo}" non porta nessun numero`);
  }
});

test('diagnosiIstituzionale: cassa solida e portafoglio ampio → nessun allarme inventato', () => {
  const d = di.diagnosiIstituzionale([pos('SPY', 100)], {
    liquidita: 500000, speseMensili: 1000, percorsi: 500, seed: 13,
  });
  assert.equal(d.valutabile, true);
  assert.equal(d.tenuta.avrestiVenduto, false);
  // Un indice ampio non deve risultare più fragile di se stesso.
  assert.equal(d.tail.piuFragileDelMercato, false);
});

test('diagnosiTextSemplice: nessuna parola tecnica per chi non ha mai investito', () => {
  const d = di.diagnosiIstituzionale([pos('XLK', 50), pos('XLU', 50)], {
    liquidita: 0, speseMensili: 3000, percorsi: 500, seed: 13,
  });
  const t = di.diagnosiTextSemplice(d);
  assert.ok(t);
  assert.doesNotMatch(t, /expected shortfall|herfindahl|bootstrap|percentile|eteroschedastic/i);
});

test('diagnosiIstituzionale: non attribuisce mai opinioni a persone reali né consiglia mosse', () => {
  const d = di.diagnosiIstituzionale([pos('XLK', 50), pos('XLU', 50)], {
    liquidita: 0, speseMensili: 3000, percorsi: 500, seed: 13,
  });
  const testo = [di.diagnosiTextSemplice(d), ...d.osservazioni.map((o) => `${o.titolo} ${o.dettaglio}`)].join(' ');
  assert.doesNotMatch(testo, /buffett|dalio|secondo\s+\w+\s+dovresti/i);
  assert.doesNotMatch(testo, /compra|vendi subito|ti consiglio|dovresti comprare/i);
});
