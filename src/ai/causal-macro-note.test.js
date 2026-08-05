'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMacroConfounderWarning, macroConfounderNote } from './causal-macro-note.js';

const AVVISO_BCE = [
  { tipo: 'causa-comune-non-vista', casi: [
    { tra: ['Ristorante', 'Alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' },
  ] },
];

test('trova il caso macro-spiegato quando la categoria chiesta è coinvolta', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Ristorante');
  assert.ok(avviso);
  assert.equal(avviso.spiegatoDaMacro, 'il tasso di riferimento BCE');
});

test('categoria NON coinvolta nel confondente → nessun avviso trovato', () => {
  assert.equal(findMacroConfounderWarning(AVVISO_BCE, 'Trasporti'), null);
});

test('nessun avvertimento di quel tipo → nessun avviso (mai un crash su undefined)', () => {
  assert.equal(findMacroConfounderWarning([], 'Ristorante'), null);
  assert.equal(findMacroConfounderWarning(undefined, 'Ristorante'), null);
  assert.equal(findMacroConfounderWarning([{ tipo: 'potenza-bassa', casi: [] }], 'Ristorante'), null);
});

test('caso trovato ma senza spiegatoDaMacro (macro non disponibile per la coppia) → nessun avviso', () => {
  const avv = [{ tipo: 'causa-comune-non-vista', casi: [{ tra: ['Ristorante', 'Alimentari'], spiegatoDaMacro: null }] }];
  assert.equal(findMacroConfounderWarning(avv, 'Ristorante'), null);
});

test('la nota in italiano nomina entrambe le categorie e il motivo, mai un numero', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Ristorante');
  const nota = macroConfounderNote(avviso, 'Ristorante', 'it');
  assert.match(nota, /Attenzione:/);
  assert.match(nota, /Ristorante/);
  assert.match(nota, /Alimentari/);
  assert.match(nota, /tasso di riferimento BCE/);
  assert.match(nota, /potrebbe non spostare nulla/);
  assert.doesNotMatch(nota, /\d/, 'la nota di cautela non deve mai contenere un numero quantificato');
});

test('SCENARIO: le 5 lingue supportate producono tutte una nota coerente, mai italiano di scorta', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Ristorante');
  const attese = {
    en: /Note:.*Ristorante.*Alimentari.*because of.*tasso di riferimento BCE/s,
    es: /Atención:.*Ristorante.*Alimentari/s,
    fr: /Attention :.*Ristorante.*Alimentari/s,
    de: /Achtung:.*Ristorante.*Alimentari/s,
    it: /Attenzione:.*Ristorante.*Alimentari/s,
  };
  for (const [lang, re] of Object.entries(attese)) {
    const nota = macroConfounderNote(avviso, 'Ristorante', lang);
    assert.match(nota, re, `lingua ${lang}`);
  }
});

test('SCENARIO: lingua sconosciuta non spedita da detectLanguage → ricade sull\'italiano invece di andare in errore', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Ristorante');
  const nota = macroConfounderNote(avviso, 'Ristorante', 'zz-non-esiste');
  assert.match(nota, /Attenzione:/);
});

test('SCENARIO: la categoria chiesta è quella "altra" del confondente (Alimentari, non Ristorante) → l\'avviso la nomina correttamente come coinvolta e identifica Ristorante come l\'altra', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Alimentari');
  assert.ok(avviso);
  const nota = macroConfounderNote(avviso, 'Alimentari', 'it');
  assert.match(nota, /Alimentari e Ristorante/);
});

test('SCENARIO: due confondenti nello stesso grafo, la categoria chiesta appartiene solo a uno → trova quello giusto, non l\'altro', () => {
  const avv = [
    { tipo: 'causa-comune-non-vista', casi: [
      { tra: ['Ristorante', 'Alimentari'], spiegatoDaMacro: 'il tasso di riferimento BCE' },
      { tra: ['Bollette', 'Abbonamenti'], spiegatoDaMacro: 'inflazione' },
    ] },
  ];
  const avviso = findMacroConfounderWarning(avv, 'Bollette');
  assert.equal(avviso.spiegatoDaMacro, 'inflazione');
  const nota = macroConfounderNote(avviso, 'Bollette', 'it');
  assert.match(nota, /Bollette e Abbonamenti/);
  assert.match(nota, /inflazione/);
});

// ============================================================
// FALLBACK — il QA deve rispondere SEMPRE, anche quando il motore avanzato
// non gira o i dati d'ingresso sono malformati. Onestà tecnica: mai un
// crash, mai un avviso a metà, mai un tono da colpa (niente rosso, niente
// "hai sbagliato" — coerente col neurodesign già stabilito nel progetto:
// l'ambra è per "momento consapevole", il grigio neutro per "nessun
// cambiamento", mai un allarme rosso su una semplice assenza di dati).
// ============================================================

test('FALLBACK: diagnosi assente (motore "base", poche settimane di storia) → nessun avviso, nessun crash', () => {
  assert.equal(findMacroConfounderWarning(undefined, 'Ristorante'), null);
  assert.equal(findMacroConfounderWarning(null, 'Ristorante'), null);
});

test('FALLBACK: avvertimenti con forma inattesa (caso senza `tra`, o `casi` assente) → non esplode, restituisce null', () => {
  assert.equal(findMacroConfounderWarning([{ tipo: 'causa-comune-non-vista' }], 'Ristorante'), null);
  assert.equal(findMacroConfounderWarning([{ tipo: 'causa-comune-non-vista', casi: [{ spiegatoDaMacro: 'x' }] }], 'Ristorante'), null);
});

test('FALLBACK: categoria vuota o non stringa → nessun avviso spurio', () => {
  assert.equal(findMacroConfounderWarning(AVVISO_BCE, ''), null);
  assert.equal(findMacroConfounderWarning(AVVISO_BCE, undefined), null);
});

test('FALLBACK: macroConfounderNote con lingua assente o vuota → ricade sull\'italiano, mai testo indefinito', () => {
  const avviso = findMacroConfounderWarning(AVVISO_BCE, 'Ristorante');
  const nota = macroConfounderNote(avviso, 'Ristorante', undefined);
  assert.match(nota, /Attenzione:/);
  assert.doesNotMatch(nota, /undefined/);
});
