'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  earliestComfortableDate, makePromise, mergePromises, addPromise, promiseFor,
  shouldRemind, waitingText, owingText, promisesStatus,
} from './payment-promise.js';
import { createGroup, mergeGroups } from './split-engine.js';

// Una previsione di cassa finta ma della forma VERA (cash-forecast.js:325):
// ogni punto ha date, inDays, p50, p10, p90.
function forecast(valoriP10) {
  return {
    path: valoriP10.map((p10, i) => ({
      date: new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10),
      inDays: i, p10, p50: p10 + 100, p90: p10 + 200,
    })),
  };
}

test('IL PUNTO: la data si calcola sul percorso PRUDENTE, non su quello probabile', () => {
  // p10 sale piano: solo dal terzo giorno restano 50 € dopo aver pagato 40.
  const r = earliestComfortableDate(forecast([10, 20, 90, 120]), 40);
  assert.equal(r.traGiorni, 2);
  assert.equal(r.data, '2026-08-12');
  // Col p50 (che qui e' 100 in piu') si sarebbe promesso il giorno 0 —
  // cioe' una data mancata una volta su due.
});

test('se puoi gia\' adesso, lo dice senza rimandare', () => {
  const r = earliestComfortableDate(forecast([500, 600]), 40);
  assert.equal(r.traGiorni, 0);
  assert.match(r.motivo, /puoi gia' adesso|già adesso/);
});

test('se NON ci arrivi nell\'orizzonte, si dice — non si inventa una data', () => {
  const r = earliestComfortableDate(forecast([10, 12, 15, 11]), 500);
  assert.equal(r.data, null);
  assert.equal(r.oltreOrizzonte, true);
  assert.match(r.motivo, /meglio dirlo che promettere una data che salterebbe/);
});

test('senza abbastanza storia non si giudica, e si dice', () => {
  const r = earliestComfortableDate(null, 40);
  assert.equal(r.giudicabile, false);
  assert.equal(r.data, null);
});

test('il cuscinetto viene rispettato: "non scoperto" non vuol dire "a zero"', () => {
  const senza = earliestComfortableDate(forecast([50, 60, 200]), 40, { cushion: 0 });
  const con = earliestComfortableDate(forecast([50, 60, 200]), 40, { cushion: 100 });
  assert.equal(senza.traGiorni, 0);
  assert.equal(con.traGiorni, 2, 'con un cuscinetto la data giusta e\' piu\' in la\'');
});

// ══ LA PRIVACY: cosa esce davvero dal dispositivo ══

test('DALLA CASSA ESCE SOLO UNA DATA: nessun saldo, nessuno stipendio', () => {
  const f = forecast([-800, -200, 350, 900]);
  // `now` fissato in ENTRAMBE le chiamate (mai Date.now() reale): sia `at`
  // (epoch millisecondi) sia `data` (derivata dallo stesso `now`) possono
  // contenere per puro caso una qualunque sequenza di 3 cifre — incluso
  // "800" — rendendo questo test instabile senza che sia mai uscito un
  // dato vero. Un valore fisso e verificato (nessuna delle cifre cercate
  // compare in "1000000000000") rende il test deterministico, non solo
  // statisticamente improbabile da rompere.
  const v = earliestComfortableDate(f, 40, { now: 1000000000000 });
  const p = makePromise({ memberId: 'm1', importo: 40, valutazione: v, now: 1000000000000 });
  const serializzato = JSON.stringify(p);
  for (const numero of ['-800', '-200', '350', '900', '800']) {
    assert.ok(!serializzato.includes(numero), `il saldo ${numero} e' uscito dal dispositivo`);
  }
  assert.deepEqual(Object.keys(p).sort(), ['at', 'capacita', 'data', 'expenseId', 'id', 'importo', 'memberId']);
});

test('la capacita\' e\' QUALITATIVA: anche "fra 3 giorni" contro "fra 28" direbbe troppo', () => {
  const vicino = makePromise({ memberId: 'm', importo: 10, valutazione: earliestComfortableDate(forecast([500]), 10) });
  const medio = makePromise({ memberId: 'm', importo: 10, valutazione: { data: '2026-08-20', traGiorni: 10, giudicabile: true } });
  const lontano = makePromise({ memberId: 'm', importo: 10, valutazione: { data: '2026-09-20', traGiorni: 40, giudicabile: true } });
  assert.equal(vicino.capacita, 'ora');
  assert.equal(medio.capacita, 'presto');
  assert.equal(lontano.capacita, 'tardi');
});

test('l\'importo promesso e\' gia\' noto a tutti (e\' il saldo del gruppo): non e\' una fuga', () => {
  const p = makePromise({ memberId: 'm', importo: 40, valutazione: { data: '2026-08-20', traGiorni: 5, giudicabile: true } });
  assert.equal(p.importo, 40);
});

// ══ ANTI-ATTRITO: quando NON dire niente ══

test('IL PEZZO CHE CONTA: chi ha promesso una data non viene sollecitato prima', () => {
  let g = createGroup({ name: 'Cena', members: ['Io', 'Marco'] });
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-27', traGiorni: 19, giudicabile: true } }));
  const r = shouldRemind(g, 'm1', { now: Date.parse('2026-08-20') });
  assert.equal(r.sollecita, false);
  assert.match(r.motivo, /ha detto 2026-08-27/);
});

test('chi non ha promesso niente, invece, si puo\' sollecitare', () => {
  const g = createGroup({ name: 'Cena', members: ['Io', 'Marco'] });
  assert.equal(shouldRemind(g, 'm1').sollecita, true);
});

test('passata la data (con qualche giorno di grazia) si torna a poter chiedere', () => {
  let g = createGroup({ name: 'Cena', members: ['Io', 'Marco'] });
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-27', traGiorni: 1, giudicabile: true } }));
  const r = shouldRemind(g, 'm1', { now: Date.parse('2026-09-05') });
  assert.equal(r.sollecita, true);
  assert.equal(r.inRitardo, true);
});

test('chi ha detto "non ce la faccio" NON si sollecita: insistere non cambia la sua cassa', () => {
  let g = createGroup({ name: 'Cena', members: ['Io', 'Marco'] });
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 400, valutazione: { data: null, oltreOrizzonte: true, giudicabile: true } }));
  const r = shouldRemind(g, 'm1');
  assert.equal(r.sollecita, false);
  assert.match(r.motivo, /insistere non cambia la sua cassa/);
});

// ══ CRDT ══

test('una promessa piu\' recente sostituisce la vecchia: le persone cambiano idea', () => {
  const vecchia = makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-27', traGiorni: 19, giudicabile: true }, now: 1000 });
  const nuova = makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-15', traGiorni: 7, giudicabile: true }, now: 2000 });
  const fuse = mergePromises([vecchia], [nuova]);
  assert.equal(fuse.length, 1);
  assert.equal(fuse[0].data, '2026-08-15');
  // Commutativo: l'ordine di sincronizzazione non decide chi vince.
  assert.equal(mergePromises([nuova], [vecchia])[0].data, '2026-08-15');
});

test('la promessa viaggia col gruppo, come tutto il resto', () => {
  let a = createGroup({ id: 'g', name: 'X', members: ['Io', 'Marco'] });
  const b = { ...a };
  a = addPromise(a, makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-27', traGiorni: 5, giudicabile: true } }));
  const fuso = mergeGroups(b, a);
  assert.equal(promiseFor(fuso, 'm1').data, '2026-08-27');
});

test('promesse di persone diverse non si sovrascrivono', () => {
  const p1 = makePromise({ memberId: 'm1', importo: 10, valutazione: { data: '2026-08-20', traGiorni: 1, giudicabile: true } });
  const p2 = makePromise({ memberId: 'm2', importo: 20, valutazione: { data: '2026-08-25', traGiorni: 6, giudicabile: true } });
  assert.equal(mergePromises([p1], [p2]).length, 2);
});

// ══ Il tono: mai da esattore, mai colpa ══

test('a chi ASPETTA si toglie il pensiero, non si da\' un compito', () => {
  let g = createGroup({ name: 'X', members: ['Io', 'Marco'] });
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 40, valutazione: { data: '2026-08-27', traGiorni: 5, giudicabile: true } }));
  const t = waitingText(g, 'm1', 'Marco');
  assert.match(t, /Marco può dal 2026-08-27/);
  assert.match(t, /Non serve ricordarglielo/);
});

test('a chi DEVE non si ricorda che deve — quello lo sa gia\' — si dice quando puo\'', () => {
  const t = owingText({ data: '2026-08-27', traGiorni: 12, giudicabile: true }, 40);
  assert.match(t, /Puoi saldare i 40,00 € dal 2026-08-27/);
  assert.ok(!/devi|dovresti|ricorda/i.test(t.split('.')[0]), t);
});

test('nessun testo verso l\'utente ha tono da esattore o gergo', () => {
  let g = createGroup({ name: 'X', members: ['Io', 'Marco'] });
  const testi = [waitingText(g, 'm1', 'Marco')];
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 40, valutazione: { data: null, oltreOrizzonte: true, giudicabile: true } }));
  testi.push(waitingText(g, 'm1', 'Marco'), owingText({ oltreOrizzonte: true, giudicabile: true }, 400));
  for (const t of testi) {
    assert.ok(!/sollecito|moroso|insolvente|p10|forecast|debito scaduto/i.test(t), t);
  }
});

test('il riassunto conta attese, ritardi e chi non ha risposto', () => {
  let g = createGroup({ name: 'X', members: ['Io', 'A', 'B', 'C'] });
  g = addPromise(g, makePromise({ memberId: 'm1', importo: 10, valutazione: { data: '2026-08-27', traGiorni: 5, giudicabile: true } }));
  g = addPromise(g, makePromise({ memberId: 'm2', importo: 10, valutazione: { data: '2026-08-01', traGiorni: 1, giudicabile: true } }));
  const s = promisesStatus(g, { now: Date.parse('2026-08-20') });
  assert.equal(s.attese, 1);       // m1, non ancora scaduta
  assert.equal(s.inRitardo, 1);    // m2, passata
  assert.equal(s.senzaRisposta, 2); // m0 e m3
});

test('input mancanti non creano promesse fantasma', () => {
  assert.equal(makePromise({}), null);
  assert.equal(makePromise({ memberId: 'm' }), null);
  assert.equal(addPromise(null, {}), null);
  assert.deepEqual(mergePromises(null, null), []);
});
