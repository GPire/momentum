'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  correlazione, livelliDaRendimenti, scomponi, trappolaDeiLivelli,
  anticipaOSegue, analizzaTitolo, testoTitolo, MIN_OSSERVAZIONI,
  mensiliDaSerie, mesiArchivio, allinea,
} from './titolo-causale.js';
import { SERIE_STORICHE } from './historical-returns.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
// Rumore approssimativamente normale da uniformi: basta e avanza per costruire
// serie di prova, e resta riproducibile.
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;

test('correlazione: identica a se stessa = 1, opposta = -1, costante = null', () => {
  const a = [1, -2, 3, -4, 5];
  assert.ok(Math.abs(correlazione(a, a) - 1) < 1e-12);
  assert.ok(Math.abs(correlazione(a, a.map((x) => -x)) + 1) < 1e-12);
  assert.equal(correlazione(a, [2, 2, 2, 2, 2]), null);
});

test('con troppi pochi periodi si rifiuta invece di regredire su nulla', () => {
  const corta = Array.from({ length: MIN_OSSERVAZIONI - 1 }, () => 0.01);
  const r = analizzaTitolo(corta, corta);
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 24 periodi/);
});

test('un titolo che E il mercato: quota mercato ~100%, beta ~1, niente di suo', () => {
  const rng = seme(1);
  const mercato = Array.from({ length: 120 }, () => rumore(rng) * 0.04);
  const s = scomponi(mercato, mercato);
  assert.ok(Math.abs(s.beta - 1) < 1e-9);
  assert.ok(s.quotaMercato > 99.9);
  assert.ok(s.quotaSua < 0.1);
});

test('un titolo scorrelato: quasi tutto e roba sua, e il beta e vicino a zero', () => {
  const rng = seme(2);
  const mercato = Array.from({ length: 240 }, () => rumore(rng) * 0.04);
  const proprio = Array.from({ length: 240 }, () => rumore(rng) * 0.04);
  const s = scomponi(proprio, mercato);
  assert.ok(s.quotaMercato < 5, `quota mercato ${s.quotaMercato}`);
  assert.ok(s.quotaSua > 95);
  assert.ok(Math.abs(s.beta) < 0.25, `beta ${s.beta}`);
});

test('un titolo a leva doppia sul mercato: beta ~2 e quasi tutto spiegato dal mercato', () => {
  const rng = seme(3);
  const mercato = Array.from({ length: 240 }, () => rumore(rng) * 0.04);
  const leva = mercato.map((m) => 2 * m + rumore(rng) * 0.002);
  const s = scomponi(leva, mercato);
  assert.ok(Math.abs(s.beta - 2) < 0.1, `beta ${s.beta}`);
  assert.ok(s.quotaMercato > 90, `quota ${s.quotaMercato}`);
});

// ── LA TRAPPOLA, sui dati veri ──
test('BITCOIN E S&P 500: i grafici sembrano gemelli, i movimenti no', () => {
  // Il caso reale che giustifica l'intero modulo. Sui livelli ricostruiti la
  // correlazione e' altissima perche' entrambi salgono nel tempo; sui
  // rendimenti veri crolla. Chi guarda due linee sovrapposte vede un legame
  // che sui movimenti non c'e' con quella forza.
  const btc = SERIE_STORICHE.btc.rendimenti;
  const spy = SERIE_STORICHE.spy.rendimenti;
  const n = Math.min(btc.length, spy.length);
  const l = trappolaDeiLivelli(btc.slice(-n), spy.slice(-n));
  assert.ok(l.suLivelli > 0.85, `livelli ${l.suLivelli}`);
  assert.ok(l.suVariazioni < 0.5, `variazioni ${l.suVariazioni}`);
  assert.equal(l.ingannevole, true);
  assert.ok(l.gonfiata > 0.4, `gonfiata ${l.gonfiata}`);
});

test('due serie senza NESSUN legame ma entrambe in crescita sembrano legate sui livelli', () => {
  // La regressione spuria in provetta: due passeggiate indipendenti con una
  // tendenza. Sui livelli si vede un legame forte; sulle variazioni sparisce.
  const rng = seme(9);
  const a = Array.from({ length: 300 }, () => 0.01 + rumore(rng) * 0.03);
  const b = Array.from({ length: 300 }, () => 0.01 + rumore(rng) * 0.03);
  const l = trappolaDeiLivelli(a, b);
  assert.ok(Math.abs(l.suLivelli) > 0.9, `livelli ${l.suLivelli}`);
  assert.ok(Math.abs(l.suVariazioni) < 0.2, `variazioni ${l.suVariazioni}`);
  assert.equal(l.ingannevole, true);
});

test('anticipo: su dati senza struttura temporale la risposta e "nessuno"', () => {
  const rng = seme(4);
  const mercato = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const titolo = mercato.map((m) => 0.9 * m + rumore(rng) * 0.02);
  const t = anticipaOSegue(titolo, mercato);
  assert.equal(t.verso, 'nessuno');
  assert.match(t.avvertenza, /Nessun anticipo distinguibile/);
});

test('il numero di confronti provati viene sempre dichiarato', () => {
  const rng = seme(5);
  const mercato = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const titolo = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const t = anticipaOSegue(titolo, mercato, { maxRitardo: 3 });
  assert.equal(t.confronti, 7); // 1 contemporanea + 3 anticipi + 3 ritardi
  assert.ok(/confronti/.test(t.avvertenza));
});

test('livelliDaRentimenti ricostruisce una crescita composta, non una somma', () => {
  const l = livelliDaRendimenti([0.1, 0.1]);
  assert.ok(Math.abs(l[1] - 121) < 1e-9);
});

// ── L'ALLINEAMENTO: dove si sbaglia in silenzio ──
test('mesiArchivio attraversa il cambio d\'anno', () => {
  // Con scostamento 0 si legge la formula pura; il default e' 1 e il perche'
  // e' nel test successivo.
  assert.deepEqual(mesiArchivio('1993-11', 4, 0), ['1993-11', '1993-12', '1994-01', '1994-02']);
  assert.deepEqual(mesiArchivio('1993-11', 2), ['1993-12', '1994-01']);
});

test('LO SCOSTAMENTO DI UN MESE dell\'archivio, verificato su episodi noti', () => {
  // Il campo `da` e' il mese del primo PREZZO, quindi il primo RENDIMENTO e'
  // del mese dopo. Letto senza scostamento, il crollo del covid diventa un
  // rialzo del 12,7%: numeri plausibili, mese sbagliato.
  const spy = SERIE_STORICHE.spy;
  const etichette = mesiArchivio(spy.da, spy.rendimenti.length);
  const rend = (mese) => spy.rendimenti[etichette.indexOf(mese)];

  assert.ok(rend('2020-03') < -0.10, `covid: ${rend('2020-03')}`);
  assert.ok(rend('2020-04') > 0.10, `rimbalzo: ${rend('2020-04')}`);
  assert.ok(rend('2008-10') < -0.14, `Lehman: ${rend('2008-10')}`);
  assert.ok(rend('2022-06') < -0.05, `giugno 2022: ${rend('2022-06')}`);
});

test('mensiliDaSerie prende l\'ULTIMO prezzo del mese, non il primo', () => {
  const m = mensiliDaSerie([
    { date: '2020-01-05', price: 100 }, { date: '2020-01-28', price: 110 },
    { date: '2020-02-03', price: 120 }, { date: '2020-02-27', price: 132 },
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0].mese, '2020-02');
  assert.ok(Math.abs(m[0].rendimento - 0.2) < 1e-12); // 110 -> 132
});

test('prezzi non validi o a zero non entrano nei rendimenti', () => {
  const m = mensiliDaSerie([
    { date: '2020-01-31', price: 100 }, { date: '2020-02-29', price: 0 },
    { date: '2020-03-31', price: 120 }, { date: '2020-04-30', price: null },
  ]);
  assert.ok(m.every((x) => Number.isFinite(x.rendimento)));
  assert.ok(!m.some((x) => x.mese === '2020-02'));
});

test('ALLINEAMENTO PER MESE, non per posizione: mesi fuori archivio scartati', () => {
  // Il bug che questo test previene: confrontare il primo mese del titolo con
  // il primo mese dell'archivio (febbraio 1993) produrrebbe un beta perfetto
  // e privo di senso.
  const mensili = [
    { mese: '1980-01', rendimento: 0.5 },   // prima dell'archivio: da scartare
    { mese: '2020-03', rendimento: -0.1 },
    { mese: '2020-04', rendimento: 0.08 },
    { mese: '2099-01', rendimento: 0.2 },   // dopo l'archivio: da scartare
  ];
  const a = allinea(mensili, SERIE_STORICHE.spy);
  assert.deepEqual(a.mesi, ['2020-03', '2020-04']);
  assert.equal(a.titolo.length, 2);
  assert.equal(a.mercato.length, 2);
  // Marzo 2020 e' il crollo del covid: il mercato deve risultare molto negativo.
  assert.ok(a.mercato[0] < -0.1, `marzo 2020 dovrebbe essere un crollo, e ${a.mercato[0]}`);
});

test('il testo non giudica il titolo e non suggerisce mosse', () => {
  const btc = SERIE_STORICHE.btc.rendimenti, spy = SERIE_STORICHE.spy.rendimenti;
  const n = Math.min(btc.length, spy.length);
  const t = testoTitolo(analizzaTitolo(btc.slice(-n), spy.slice(-n), { nome: 'Bitcoin', indice: 'le azioni americane' }));
  assert.ok(!/\b(compra|vendi|conviene|ti consiglio|dovresti|ottimo|pessimo|migliore)\b/i.test(t), t);
  assert.match(t, /non un consiglio/);
});

test('il testo non costruisce preposizioni sgrammaticate ("da le", "di il")', () => {
  const btc = SERIE_STORICHE.btc.rendimenti, spy = SERIE_STORICHE.spy.rendimenti;
  const n = Math.min(btc.length, spy.length);
  const t = testoTitolo(analizzaTitolo(btc.slice(-n), spy.slice(-n), { nome: 'Bitcoin', indice: 'le azioni americane' }));
  assert.ok(!/\b(da le|di il|a il|da il|di le|in il)\b/.test(t), t);
  assert.ok(!/\bpiu del mercato\b/.test(t), 'accento mancante su "più"');
});
