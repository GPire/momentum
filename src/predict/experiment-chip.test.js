'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCategoryChips } from './experiment-chip.js';

const NOW = new Date('2026-08-05T00:00:00Z');

function statoFinto(map) {
  // sostituisce experimentStatus reale: restituisce ciò che c'è in `map`
  // per la categoria, o null — permette scenari deterministici senza dover
  // costruire transazioni vere per ogni caso.
  return (experiments, categoria) => map[categoria] || null;
}

test('categoria senza legame macro e senza esperimento → propone di iniziare', () => {
  const out = classifyCategoryChips(['trasporti'], {
    avvertimenti: [],
    experimentStatusFn: statoFinto({}),
    now: NOW,
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].tipo, 'proponi');
  assert.equal(out[0].spiegazioneMacro, null);
});

test('categoria in un confondente macro-spiegato, nessun esperimento → chip informativo, mai il bottone', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [
      { tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' },
    ] },
  ];
  const out = classifyCategoryChips(['ristoranti', 'alimentari', 'trasporti'], {
    avvertimenti, experimentStatusFn: statoFinto({}), now: NOW,
  });
  const ristoranti = out.find((o) => o.categoria === 'ristoranti');
  const alimentari = out.find((o) => o.categoria === 'alimentari');
  const trasporti = out.find((o) => o.categoria === 'trasporti');
  assert.equal(ristoranti.tipo, 'macro-spiegato');
  assert.equal(ristoranti.spiegazioneMacro, 'il tasso di riferimento BCE');
  assert.equal(alimentari.tipo, 'macro-spiegato');
  assert.equal(trasporti.tipo, 'proponi');
});

test('esperimento GIÀ avviato + confondente scoperto dopo → lo stato resta visibile, mai sostituito dal chip macro (bug reale corretto)', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [
      { tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' },
    ] },
  ];
  const out = classifyCategoryChips(['ristoranti'], {
    avvertimenti,
    experimentStatusFn: statoFinto({ ristoranti: { conclusione: null, avviatoIl: '2026-07-01' } }),
    now: NOW,
  });
  assert.equal(out[0].tipo, 'stato');
  assert.equal(out[0].stato.avviatoIl, '2026-07-01');
  // la spiegazione macro non sparisce: diventa nota da mostrare accanto allo stato
  assert.equal(out[0].spiegazioneMacro, 'il tasso di riferimento BCE');
});

test('esperimento CONCLUSO ("cambiato") + confondente sulla stessa categoria → resta "confermato", con la nota macro allegata', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [{ tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: 'inflazione' }] },
  ];
  const out = classifyCategoryChips(['ristoranti'], {
    avvertimenti,
    experimentStatusFn: statoFinto({ ristoranti: { conclusione: 'cambiato' } }),
    now: NOW,
  });
  assert.equal(out[0].tipo, 'stato');
  assert.equal(out[0].stato.conclusione, 'cambiato');
  assert.equal(out[0].spiegazioneMacro, 'inflazione');
});

test('nessun avvertimento di tipo causa-comune-non-vista → nessuna categoria marcata macro-spiegata', () => {
  const out = classifyCategoryChips(['ristoranti', 'alimentari'], {
    avvertimenti: [{ tipo: 'potenza-bassa', casi: [] }],
    experimentStatusFn: statoFinto({}),
    now: NOW,
  });
  assert.ok(out.every((o) => o.tipo === 'proponi' && o.spiegazioneMacro === null));
});

test('caso macro trovato ma senza spiegatoDaMacro (macro non disponibile per questa coppia) → non blocca il bottone', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [{ tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: null }] },
  ];
  const out = classifyCategoryChips(['ristoranti', 'alimentari'], {
    avvertimenti, experimentStatusFn: statoFinto({}), now: NOW,
  });
  assert.ok(out.every((o) => o.tipo === 'proponi'));
});

test('lista vuota di categorie → lista vuota, nessun crash', () => {
  const out = classifyCategoryChips([], { avvertimenti: [], experimentStatusFn: statoFinto({}) });
  assert.deepEqual(out, []);
});

// ============================================================
// SIMULAZIONI DI SCENARIO — un utente reale, più categorie insieme, come
// richiesto esplicitamente: "vedine il funzionamento" per ogni caso plausibile.
// ============================================================

test('SCENARIO: utente con 4 categorie nel grafo, una coppia macro-spiegata, un esperimento in corso su un\'altra, una libera', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [{ tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' }] },
  ];
  const out = classifyCategoryChips(['ristoranti', 'alimentari', 'trasporti', 'svago'], {
    avvertimenti,
    experimentStatusFn: statoFinto({ trasporti: { conclusione: 'nessun-cambiamento' } }),
    now: NOW,
  });
  const byCat = Object.fromEntries(out.map((o) => [o.categoria, o]));
  assert.equal(byCat.ristoranti.tipo, 'macro-spiegato');
  assert.equal(byCat.alimentari.tipo, 'macro-spiegato');
  assert.equal(byCat.trasporti.tipo, 'stato');
  assert.equal(byCat.trasporti.stato.conclusione, 'nessun-cambiamento');
  assert.equal(byCat.svago.tipo, 'proponi');
});

// ============================================================
// FALLBACK — il grafo causale deve sempre proporre QUALCOSA per ogni
// categoria, anche quando la diagnosi manca del tutto (motore "base", poca
// storia) o arriva in una forma inattesa. Mai un crash, mai una categoria
// silenziosamente omessa dalla lista.
// ============================================================

test('FALLBACK: diagnosi assente (motore "base") → tutte le categorie propongono normalmente', () => {
  const out = classifyCategoryChips(['ristoranti', 'alimentari'], {
    avvertimenti: undefined, experimentStatusFn: statoFinto({}), now: NOW,
  });
  assert.ok(out.every((o) => o.tipo === 'proponi'));
});

test('FALLBACK: avvertimenti con caso senza `tra` (forma inattesa) → non esplode, categoria trattata come libera', () => {
  const avvertimenti = [{ tipo: 'causa-comune-non-vista', casi: [{ spiegatoDaMacro: 'x' }] }];
  const out = classifyCategoryChips(['ristoranti'], {
    avvertimenti, experimentStatusFn: statoFinto({}), now: NOW,
  });
  assert.equal(out[0].tipo, 'proponi');
});

test('SCENARIO: due confondenti macro indipendenti nello stesso grafo (es. BCE su ristoranti/alimentari, inflazione su bollette/abbonamenti)', () => {
  const avvertimenti = [
    { tipo: 'causa-comune-non-vista', casi: [
      { tra: ['ristoranti', 'alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' },
      { tra: ['bollette', 'abbonamenti'], spiegatoDaMacro: 'inflazione' },
    ] },
  ];
  const out = classifyCategoryChips(['ristoranti', 'alimentari', 'bollette', 'abbonamenti', 'trasporti'], {
    avvertimenti, experimentStatusFn: statoFinto({}), now: NOW,
  });
  const byCat = Object.fromEntries(out.map((o) => [o.categoria, o]));
  assert.equal(byCat.ristoranti.spiegazioneMacro, 'il tasso di riferimento BCE');
  assert.equal(byCat.bollette.spiegazioneMacro, 'inflazione');
  assert.equal(byCat.trasporti.tipo, 'proponi');
});
