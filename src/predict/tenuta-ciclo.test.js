// Garanzie sulla tenuta del ciclo. Una probabilità mostrata a un utente che
// sta decidendo se può permettersi una cosa deve essere: stabile (non balla),
// onesta (tace quando non sa) e monotona (peggiorando i dati non migliora).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tenutaCiclo, speseGiaNote, fasciaTenuta, testoTenuta, MIN_GIORNI_STORIA,
} from './tenuta-ciclo.js';

// Una storia realistica: tanti zeri, qualche giorno grosso. È la forma vera
// della spesa quotidiana, ed è quella che una gaussiana sbaglia.
const storiaTipica = [
  0, 0, 12, 0, 35, 0, 0, 8, 0, 60, 0, 0, 15, 4, 0, 0, 90, 0, 7, 0,
  22, 0, 0, 45, 0, 11, 0, 0, 30, 0, 5, 0, 0, 18, 0, 70, 0, 0, 9, 0,
];

// ── Determinismo ──
test('TENUTA: stesso input → stessa probabilità, sempre', () => {
  const args = { rimanente: 300, giorniRimasti: 12, giorniStorici: storiaTipica };
  const a = tenutaCiclo(args);
  for (let i = 0; i < 200; i++) {
    assert.equal(tenutaCiclo(args).probabilitaSecco, a.probabilitaSecco);
    assert.equal(tenutaCiclo(args).saldoMediano, a.saldoMediano);
  }
});

test('TENUTA: il seme cambia la simulazione ma non la sostanza', () => {
  const base = { rimanente: 300, giorniRimasti: 12, giorniStorici: storiaTipica };
  const p = [1, 2, 3, 4, 5].map(s => tenutaCiclo({ ...base, seme: s }).probabilitaSecco);
  const min = Math.min(...p), max = Math.max(...p);
  assert.ok(max - min < 0.06, `semi diversi devono dare la stessa risposta a meno del rumore: ${p}`);
});

// ── Onestà: si tace quando non si sa ──
test('TENUTA: sotto il minimo di storia non si pubblica nessuna probabilità', () => {
  const r = tenutaCiclo({ rimanente: 300, giorniRimasti: 10, giorniStorici: storiaTipica.slice(0, MIN_GIORNI_STORIA - 1) });
  assert.equal(r.misurabile, false);
  assert.ok(/giorni/.test(r.motivo));
  assert.equal(r.probabilitaSecco, undefined, 'non deve esistere proprio, non essere zero');
  assert.equal(testoTenuta(r), null, 'e non si scrive niente');
  assert.equal(fasciaTenuta(r), null);
});

test('TENUTA: ciclo finito o dati assenti → non misurabile, mai un numero inventato', () => {
  assert.equal(tenutaCiclo({ rimanente: 100, giorniRimasti: 0, giorniStorici: storiaTipica }).misurabile, false);
  assert.equal(tenutaCiclo({}).misurabile, false);
  assert.equal(tenutaCiclo().misurabile, false);
});

// ── Monotonia: la direzione non può essere sbagliata ──
test('TENUTA: più soldi → mai più rischio', () => {
  let prec = 1.1;
  for (const soldi of [50, 100, 200, 400, 800, 1600]) {
    const p = tenutaCiclo({ rimanente: soldi, giorniRimasti: 14, giorniStorici: storiaTipica }).probabilitaSecco;
    assert.ok(p <= prec + 1e-9, `con ${soldi}€ il rischio è salito: ${p} > ${prec}`);
    prec = p;
  }
});

test('TENUTA: più giorni da coprire → mai meno rischio', () => {
  let prec = -1;
  for (const gg of [2, 5, 10, 20, 30]) {
    const p = tenutaCiclo({ rimanente: 300, giorniRimasti: gg, giorniStorici: storiaTipica }).probabilitaSecco;
    assert.ok(p >= prec - 1e-9, `con ${gg} giorni il rischio è sceso: ${p} < ${prec}`);
    prec = p;
  }
});

test('TENUTA: le spese già in programma non possono migliorare la situazione', () => {
  const senza = tenutaCiclo({ rimanente: 400, giorniRimasti: 14, giorniStorici: storiaTipica });
  const con = tenutaCiclo({ rimanente: 400, giorniRimasti: 14, giorniStorici: storiaTipica, speseNoteInArrivo: 150 });
  assert.ok(con.probabilitaSecco >= senza.probabilitaSecco);
  assert.equal(con.disponibile, 250);
});

// ── Casi estremi ──
test('TENUTA: soldi abbondanti → rischio praticamente nullo', () => {
  const r = tenutaCiclo({ rimanente: 100000, giorniRimasti: 10, giorniStorici: storiaTipica });
  assert.equal(r.probabilitaSecco, 0);
  assert.equal(fasciaTenuta(r), 'tranquillo');
  assert.ok(/senza problemi/.test(testoTenuta(r)));
});

test('TENUTA: soldi ridicoli → rischio praticamente certo', () => {
  const r = tenutaCiclo({ rimanente: 3, giorniRimasti: 20, giorniStorici: storiaTipica });
  assert.ok(r.probabilitaSecco > 0.95);
  assert.equal(fasciaTenuta(r), 'rischio');
  assert.ok(/rischi di restare a secco/.test(testoTenuta(r)));
});

test('TENUTA: le spese note che superano il rimanente si dicono, non si simulano', () => {
  const r = tenutaCiclo({ rimanente: 100, giorniRimasti: 10, giorniStorici: storiaTipica, speseNoteInArrivo: 250 });
  assert.equal(r.certo, true);
  assert.equal(r.probabilitaSecco, 1);
  assert.ok(/già in programma/.test(testoTenuta(r)), 'il testo deve dire la causa, non una percentuale');
});

test('TENUTA: chi non spende mai non è mai a rischio', () => {
  const r = tenutaCiclo({ rimanente: 10, giorniRimasti: 25, giorniStorici: new Array(40).fill(0) });
  assert.equal(r.probabilitaSecco, 0);
});

// ── Il testo dice sempre cosa fare ──
test('TENUTA: quando c’è un rischio, si dice anche il tetto giornaliero per evitarlo', () => {
  for (const soldi of [40, 80, 150, 250]) {
    const r = tenutaCiclo({ rimanente: soldi, giorniRimasti: 15, giorniStorici: storiaTipica });
    const t = testoTenuta(r);
    if (fasciaTenuta(r) === 'tranquillo') continue;
    assert.ok(/al giorno/.test(t), `una percentuale da sola non dice cosa fare: "${t}"`);
    assert.ok(Math.abs(r.tettoGiornalieroSicuro - soldi / 15) < 0.02);
  }
});

test('TENUTA: nessun NaN, nessun valore assurdo, con qualunque input', () => {
  const sporchi = [
    { rimanente: NaN, giorniRimasti: 10, giorniStorici: storiaTipica },
    { rimanente: -500, giorniRimasti: 10, giorniStorici: storiaTipica },
    { rimanente: 300, giorniRimasti: 10.7, giorniStorici: storiaTipica },
    { rimanente: 300, giorniRimasti: 10, giorniStorici: [...storiaTipica, NaN, -5, Infinity, 'x'] },
    { rimanente: 300, giorniRimasti: 10, giorniStorici: storiaTipica, speseNoteInArrivo: NaN },
    { rimanente: Infinity, giorniRimasti: 10, giorniStorici: storiaTipica },
  ];
  for (const caso of sporchi) {
    const r = tenutaCiclo(caso);
    if (!r.misurabile) { assert.ok(typeof r.motivo === 'string'); continue; }
    assert.ok(r.probabilitaSecco >= 0 && r.probabilitaSecco <= 1, `probabilità fuori scala: ${r.probabilitaSecco}`);
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} non finito con ${JSON.stringify(caso)}`);
    }
  }
});

// ── Spese già note ──
test('SPESE NOTE: prende solo quelle dentro la finestra, e mai quella di oggi', () => {
  const da = new Date(2026, 8, 5);   // 5 settembre
  const a = new Date(2026, 8, 20);   // 20 settembre
  const ric = [
    { importo: 12.99, giornoDelMese: 10, nome: 'Streaming' },
    { importo: 40, giornoDelMese: 25 },   // fuori finestra
    { importo: 8, giornoDelMese: 5 },     // oggi: già nello speso
    { importo: 30, giornoDelMese: 20 },   // ultimo giorno: dentro
  ];
  const r = speseGiaNote(ric, { da, a });
  assert.equal(r.totale, 42.99);
  assert.deepEqual(r.voci.map(v => v.importo).sort((x, y) => x - y), [12.99, 30]);
});

test('SPESE NOTE: un ciclo a cavallo di due mesi funziona senza casi speciali', () => {
  const r = speseGiaNote([{ importo: 100, giornoDelMese: 1 }, { importo: 50, giornoDelMese: 28 }],
    { da: new Date(2026, 8, 25), a: new Date(2026, 9, 5) });
  assert.equal(r.totale, 150, 'sia il 28 settembre sia il 1° ottobre cadono nella finestra');
});

test('SPESE NOTE: il 31 in un mese da 30 giorni cade l’ultimo giorno, non sparisce', () => {
  const r = speseGiaNote([{ importo: 20, giornoDelMese: 31 }],
    { da: new Date(2026, 8, 1), a: new Date(2026, 8, 30) }); // settembre, 30 giorni
  assert.equal(r.totale, 20);
  assert.equal(r.voci[0].quando.getDate(), 30);
});

test('SPESE NOTE: input sballati non producono totali finti', () => {
  assert.equal(speseGiaNote([], {}).totale, 0);
  assert.equal(speseGiaNote(null, { da: new Date(), a: new Date() }).totale, 0);
  assert.equal(speseGiaNote([{ importo: -5, giornoDelMese: 3 }], { da: new Date(2026, 8, 1), a: new Date(2026, 8, 10) }).totale, 0);
  assert.equal(speseGiaNote([{ importo: 10, giornoDelMese: 0 }], { da: new Date(2026, 8, 1), a: new Date(2026, 8, 10) }).totale, 0);
  // Finestra invertita: nessuna spesa, nessuna eccezione.
  assert.equal(speseGiaNote([{ importo: 10, giornoDelMese: 3 }], { da: new Date(2026, 8, 10), a: new Date(2026, 8, 1) }).totale, 0);
});

// ── Il ricampionamento deve vedere i grappoli, non solo l'insieme dei valori ──
test('TENUTA: la stessa spesa totale concentrata in un weekend è più rischiosa che spalmata', () => {
  // Stesso totale, forma diversa: 9 giorni "forti" da 35€ (0 il resto).
  // Grappolo: tre weekend consecutivi da 3 giorni. Sparso: gli stessi 9 giorni
  // forti separati, mai due di fila. Un ricampionamento giorno-per-giorno
  // indipendente (bug corretto: era così prima) è CIECO a questa differenza,
  // perché vede solo il multi-insieme dei valori, mai la sequenza — qui si
  // verifica che il block bootstrap la veda davvero.
  const gg = 21, forte = (15 * gg) / 9;
  const grappolo = new Array(gg).fill(0);
  for (const start of [1, 8, 15]) for (let i = 0; i < 3; i++) grappolo[start + i] = forte;
  const sparso = new Array(gg).fill(0);
  [0, 2, 5, 7, 9, 12, 14, 17, 19].forEach(i => { sparso[i] = forte; });
  assert.equal(grappolo.reduce((a, b) => a + b, 0), sparso.reduce((a, b) => a + b, 0), 'stesso totale, premessa del confronto');

  const args = { rimanente: 15 * gg, giorniRimasti: gg };
  // Media su più semi: un solo seme è rumore Monte Carlo, non un confronto onesto.
  const mediaRischio = (storia) => {
    const semi = [1, 2, 3, 4, 5, 6, 7, 8];
    return semi.reduce((s, seme) => s + tenutaCiclo({ ...args, giorniStorici: storia, seme }).probabilitaSecco, 0) / semi.length;
  };
  const rGrappolo = mediaRischio(grappolo);
  const rSparso = mediaRischio(sparso);
  assert.ok(rGrappolo > rSparso + 0.05,
    `un grappolo di giorni forti consecutivi deve pesare più della stessa spesa spalmata: grappolo=${rGrappolo} sparso=${rSparso}`);
});

// ── Scenario completo ──
test('TENUTA scenario: la media dice "in pari", la tenuta dice "stretto"', () => {
  // 200€ per 10 giorni = 20€/giorno, ed è esattamente la media di questa
  // persona. Sulla carta è in pari. Ma i suoi giorni veri sono fatti di zeri
  // e di picchi: il rischio reale non è zero, ed è questo che la media nasconde.
  const media = storiaTipica.reduce((s, x) => s + x, 0) / storiaTipica.length;
  const r = tenutaCiclo({ rimanente: media * 10, giorniRimasti: 10, giorniStorici: storiaTipica });
  assert.ok(r.probabilitaSecco > 0.2, `spendendo esattamente la propria media il rischio non è trascurabile: ${r.probabilitaSecco}`);
  assert.ok(r.saldoScenarioBrutto <= r.saldoMediano);
});
