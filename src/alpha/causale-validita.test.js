'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adeguatezzaCampione, rotturaStrutturale, classificaLegame, valutaValidita,
  CAMPIONI_PER_IDENTIFICARE,
} from './causale-validita.js';
import { SERIE_STORICHE } from './historical-returns.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;

// ── 1. Il campione ──
test('dati mensili: NESSUN archivio realistico raggiunge la soglia di identificabilita', () => {
  // Il fatto scomodo. 1500 osservazioni mensili sono 125 anni: la soglia non
  // e' raggiungibile su dati macro mensili, e va detto invece di stimare.
  const a = adeguatezzaCampione(402, { perAnno: 12 });
  assert.equal(a.identificabile, false);
  assert.ok(a.rapporto < 0.3, `rapporto ${a.rapporto}`);
  assert.match(a.messaggio, /non identificabile/);
  assert.match(a.messaggio, /125 anni/);
});

test('dati giornalieri su molti anni possono raggiungerla', () => {
  const a = adeguatezzaCampione(2000, { perAnno: 252 });
  assert.equal(a.identificabile, true);
  assert.ok(a.rapporto > 1);
});

test('cercare piu relazioni alza la soglia: ogni confronto e un\'altra occasione di sbagliare', () => {
  const una = adeguatezzaCampione(1500, { perAnno: 12, relazioniCercate: 1 });
  const cinque = adeguatezzaCampione(1500, { perAnno: 12, relazioniCercate: 5 });
  assert.equal(una.identificabile, true);
  assert.equal(cinque.identificabile, false);
  assert.equal(cinque.richiesti, CAMPIONI_PER_IDENTIFICARE * 5);
});

// ── 2. La rottura di regime ──
test('serie omogenea: nessuna rottura inventata', () => {
  const rng = seme(1);
  const x = Array.from({ length: 200 }, () => rumore(rng) * 0.04);
  const r = rotturaStrutturale(x, { rng: seme(2), permutazioni: 199 });
  assert.equal(r.rotturaPresente, false, `p=${r.p}`);
  assert.match(r.messaggio, /Nessun cambio di regime/);
});

test('rottura VERA di volatilita: riconosciuta, e si dice perche il grafo sarebbe finto', () => {
  const rng = seme(3);
  // Primo tratto calmo, secondo tratto sei volte piu' agitato: e' esattamente
  // il passaggio da mercato tranquillo a crisi.
  const calmo = Array.from({ length: 100 }, () => rumore(rng) * 0.01);
  const agitato = Array.from({ length: 100 }, () => rumore(rng) * 0.06);
  const r = rotturaStrutturale([...calmo, ...agitato], { rng: seme(4), permutazioni: 199 });
  assert.equal(r.rotturaPresente, true, `p=${r.p}`);
  assert.ok(Math.abs(r.puntoDiRottura - 100) < 25, `trovata a ${r.puntoDiRottura}`);
  assert.match(r.messaggio, /mai esistito/);
});

test('rottura di media: riconosciuta anche senza cambio di volatilita', () => {
  const rng = seme(5);
  const basso = Array.from({ length: 100 }, () => -0.03 + rumore(rng) * 0.01);
  const alto = Array.from({ length: 100 }, () => 0.03 + rumore(rng) * 0.01);
  const r = rotturaStrutturale([...basso, ...alto], { rng: seme(6), permutazioni: 199 });
  assert.equal(r.rotturaPresente, true, `p=${r.p}`);
});

test('serie troppo corta per cercare una rottura: null, non un verdetto', () => {
  assert.equal(rotturaStrutturale(Array.from({ length: 30 }, () => 0.01)), null);
});

// ── 3. Freccia, anello o co-movimento ──
test('entrambi i versi significativi: e un ANELLO, non una freccia', () => {
  const c = classificaLegame({ aVersoB: true, bVersoA: true, contemporanea: 0.2 });
  assert.equal(c.tipo, 'retroazione');
  assert.equal(c.affidabile, false);
  assert.match(c.messaggio, /anello, non una freccia/);
});

test('un verso solo MA forte simultaneita: declassato a co-movimento', () => {
  // Il caso tipico dei mercati: azionario e credito si muovono insieme, e un
  // ritardo apparente e' la stessa cosa vista due volte.
  const c = classificaLegame({ aVersoB: true, bVersoA: false, contemporanea: 0.85 });
  assert.equal(c.tipo, 'co-movimento');
  assert.equal(c.affidabile, false);
});

test('un verso solo e poca simultaneita: si chiama PRECEDENZA, mai "causa"', () => {
  const c = classificaLegame({ aVersoB: true, bVersoA: false, contemporanea: 0.1 });
  assert.equal(c.tipo, 'precedenza');
  assert.equal(c.affidabile, true);
  // La parola "causa" non deve comparire come affermazione.
  assert.match(c.messaggio, /non una prova di causa/);
});

test('nessun verso: nessun legame', () => {
  assert.equal(classificaLegame({}).tipo, 'nessuno');
});

// ── IL GUARDIANO, applicato ai dati veri del progetto ──
test('SUL NOSTRO ARCHIVIO: la freccia causale NON e presentabile come causa', () => {
  // Il test piu' importante del file, e il piu' scomodo. Applicato all'archivio
  // azionario reale del progetto (402 mesi), il guardiano dice che una
  // relazione causale non e' presentabile — perche' il campione e' un ordine di
  // grandezza sotto la soglia di identificabilita'. E' la stessa disciplina che
  // il progetto applica altrove (rifiutare sotto il 50% di copertura), qui
  // puntata sulle proprie conclusioni.
  const v = valutaValidita(SERIE_STORICHE.spy.rendimenti, {
    perAnno: 12, relazioniCercate: 5, rng: seme(7), permutazioni: 99,
  });
  assert.equal(v.utilizzabile, false);
  assert.ok(v.problemi.includes('campione'));
  assert.match(v.messaggio, /non va presentata come causa/);
});

test('il guardiano passa solo quando NESSUNA difesa scatta', () => {
  const rng = seme(8);
  // Campione abbondante (giornaliero), serie omogenea, legame a un verso senza
  // simultaneita': l'unico caso in cui si puo' parlare di precedenza.
  const x = Array.from({ length: 1600 }, () => rumore(rng) * 0.01);
  const v = valutaValidita(x, {
    perAnno: 252, relazioniCercate: 1,
    legame: { aVersoB: true, bVersoA: false, contemporanea: 0.05 },
    rng: seme(9), permutazioni: 99,
  });
  assert.equal(v.utilizzabile, true);
  assert.deepEqual(v.problemi, []);
  assert.match(v.messaggio, /precedenza non significa causa/);
});

test('i problemi si accumulano e vengono elencati tutti, non solo il primo', () => {
  const rng = seme(10);
  const calmo = Array.from({ length: 60 }, () => rumore(rng) * 0.01);
  const agitato = Array.from({ length: 60 }, () => rumore(rng) * 0.08);
  const v = valutaValidita([...calmo, ...agitato], {
    perAnno: 12, relazioniCercate: 3,
    legame: { aVersoB: true, bVersoA: true, contemporanea: 0.3 },
    rng: seme(11), permutazioni: 199,
  });
  assert.deepEqual(v.problemi.sort(), ['campione', 'direzione', 'regime']);
  assert.ok(v.messaggio.length > 200, 'devono comparire tutte le spiegazioni');
});
