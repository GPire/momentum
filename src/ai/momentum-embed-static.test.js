'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vettoreParola, vettoreFrase, coperturaVocabolario, dimensioni, numeroParole, vocabolarioCoperto,
} from './momentum-embed-static.js';

function coseno(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // entrambi già normalizzati L2: il prodotto scalare è il coseno
}

test('il vocabolario ha le 686 parole attese, dimensione 384', () => {
  assert.equal(dimensioni(), 384);
  assert.equal(numeroParole(), 686);
  assert.equal(vocabolarioCoperto().length, 686);
});

test('vettoreParola: parola nota → vettore normalizzato L2 (norma 1.0)', () => {
  const v = vettoreParola('perdere');
  assert.ok(v);
  assert.equal(v.length, 384);
  let normaQuadra = 0;
  for (let i = 0; i < v.length; i++) normaQuadra += v[i] * v[i];
  assert.ok(Math.abs(Math.sqrt(normaQuadra) - 1) < 1e-4);
});

test('vettoreParola: parola assente dal vocabolario → null, non un vettore a caso', () => {
  assert.equal(vettoreParola('xyzxyzparolainventata'), null);
});

test('vettoreParola: case-insensitive', () => {
  const a = vettoreParola('Perdere');
  const b = vettoreParola('perdere');
  assert.deepEqual(Array.from(a), Array.from(b));
});

// ── LA PROVA VERA: il modello distingue significati, non solo esiste ──
test('IL SEGNALE: "perdere" è più vicino a "perdita" che a "stipendio"', () => {
  const perdere = vettoreParola('perdere');
  const perdita = vettoreParola('perdita');
  const stipendio = vettoreParola('stipendio');
  const simileStessoSenso = coseno(perdere, perdita);
  const simileSensoDiverso = coseno(perdere, stipendio);
  assert.ok(simileStessoSenso > simileSensoDiverso,
    `atteso "perdere"~"perdita" (${simileStessoSenso.toFixed(3)}) > "perdere"~"stipendio" (${simileSensoDiverso.toFixed(3)})`);
});

test('IL SEGNALE: "vendere" è più vicino a "vendita" che a "investimento"', () => {
  const vendere = vettoreParola('vendere');
  const vendita = vettoreParola('vendita');
  const investimento = vettoreParola('investimento');
  assert.ok(coseno(vendere, vendita) > coseno(vendere, investimento));
});

test('IL SEGNALE: multilingua — "perdere" (it) è più vicino a "lose" (en) che a "salary" (en)', () => {
  const perdere = vettoreParola('perdere');
  const lose = vettoreParola('lose');
  const salary = vettoreParola('salary');
  assert.ok(coseno(perdere, lose) > coseno(perdere, salary));
});

test('coperturaVocabolario: 0 per testo vuoto o senza parole note, 1 per testo tutto coperto', () => {
  assert.equal(coperturaVocabolario(''), 0);
  assert.equal(coperturaVocabolario('xyzxyz qwqwqw'), 0);
  assert.equal(coperturaVocabolario('perdere vendere'), 1);
});

test('coperturaVocabolario: frazione corretta con parole miste', () => {
  const c = coperturaVocabolario('perdere xyzxyz');
  assert.ok(Math.abs(c - 0.5) < 1e-9);
});

test('vettoreFrase: nessuna parola coperta → null, non un vettore di zeri spacciato per significato', () => {
  assert.equal(vettoreFrase('xyzxyz qwqwqw'), null);
  assert.equal(vettoreFrase(''), null);
  assert.equal(vettoreFrase(null), null);
});

test('vettoreFrase: frase coperta → vettore normalizzato L2', () => {
  const v = vettoreFrase('rischio di perdere i miei risparmi');
  assert.ok(v);
  let normaQuadra = 0;
  for (let i = 0; i < v.length; i++) normaQuadra += v[i] * v[i];
  assert.ok(Math.abs(Math.sqrt(normaQuadra) - 1) < 1e-4);
});

test('vettoreFrase: due frasi con lo stesso senso sono più vicine di due frasi con senso diverso', () => {
  const a = vettoreFrase('quanto posso perdere nel caso peggiore');
  const b = vettoreFrase('quanto rischio di perdere');
  const c = vettoreFrase('quanto guadagno con lo stipendio');
  assert.ok(coseno(a, b) > coseno(a, c),
    `atteso coppia stesso senso (${coseno(a,b).toFixed(3)}) > coppia senso diverso (${coseno(a,c).toFixed(3)})`);
});
