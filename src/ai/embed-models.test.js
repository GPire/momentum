'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELLI, registraModello, scegliModello, modelloAttivo, elencoModelli,
  riduci, normalizza, preparaTesto,
} from './embed-models.js';

test('il modello storico dichiara la sua licenza NON permissiva, in chiaro', () => {
  // Il punto di tutto il file: la licenza sta accanto al modello, dove si
  // legge, non in un documento che nessuno riapre.
  const g = MODELLI['embeddinggemma-300m'];
  assert.equal(g.licenzaPermissiva, false);
  assert.match(g.licenza, /Gemma/);
  assert.match(g.notaLicenza, /da remoto/);
});

test('registraModello rifiuta un pooling inventato', () => {
  assert.throws(() => registraModello('x', { id: 'a/b', pooling: 'magia' }), /pooling sconosciuto/);
});

test('con soloPermissive si RIFIUTA di reintrodurre una licenza vincolata', () => {
  // La guardia che impedisce di ricadere per distrazione nel problema che
  // questo file esiste per risolvere.
  assert.throws(
    () => registraModello('vincolato', { id: 'a/b', pooling: 'media', licenza: 'Custom Terms', licenzaPermissiva: false }, { soloPermissive: true }),
    /Licenza non permissiva/,
  );
});

test('un modello permissivo si registra e diventa selezionabile', () => {
  registraModello('prova-permissiva', {
    id: 'finto/modello-ONNX', dtype: 'q4', prefisso: 'query: ', pooling: 'media',
    licenza: 'Apache-2.0', licenzaPermissiva: true, lingue: '100', parametri: '118M',
  }, { soloPermissive: true });
  const m = scegliModello('prova-permissiva');
  assert.equal(m.id, 'finto/modello-ONNX');
  assert.equal(modelloAttivo().licenzaPermissiva, true);
  assert.ok(elencoModelli().find((x) => x.chiave === 'prova-permissiva' && x.attivo));
  scegliModello('embeddinggemma-300m'); // si rimette come prima
});

test('scegliere un modello inesistente non passa in silenzio', () => {
  assert.throws(() => scegliModello('non-esiste'), /Modello sconosciuto/);
});

// ── LA RIDUZIONE: dove si sbaglia senza accorgersene ──
test('IL RIEMPIMENTO NON DEVE ENTRARE NELLA MEDIA', () => {
  // Il bug silenzioso: contare i token di riempimento sposta il vettore verso
  // lo zero, e piu' la frase e' corta piu' il danno e' grande. Qui le frasi
  // sono domande brevi, quindi e' il caso peggiore.
  const tokens = [[1, 1], [3, 3], [0, 0], [0, 0]];
  const conMaschera = riduci(tokens, [1, 1, 0, 0], 'media');
  const senzaMaschera = riduci(tokens, null, 'media');
  assert.deepEqual([...conMaschera], [2, 2]);
  assert.deepEqual([...senzaMaschera], [1, 1]); // trascinato verso lo zero
});

test('pooling "ultimo" prende l\'ultimo token VERO, non l\'ultima riga', () => {
  const tokens = [[1, 0], [2, 0], [9, 9], [0, 0]];
  assert.deepEqual([...riduci(tokens, [1, 1, 1, 0], 'ultimo')], [9, 9]);
});

test('pooling "primo" prende il primo token', () => {
  assert.deepEqual([...riduci([[5, 6], [1, 1]], [1, 1], 'primo')], [5, 6]);
});

test('riduci su input vuoto o maschera tutta a zero: null, non un vettore finto', () => {
  assert.equal(riduci([], [], 'media'), null);
  assert.equal(riduci([[1, 2]], [0], 'media'), null);
});

test('normalizza rende il vettore unitario, e non divide per zero', () => {
  const v = normalizza(Float32Array.from([3, 4]));
  assert.ok(Math.abs(v[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(v[1] - 0.8) < 1e-6);
  const zero = normalizza(Float32Array.from([0, 0]));
  assert.deepEqual([...zero], [0, 0]);
});

test('IL PREFISSO E UN DATO DEL MODELLO, non una costante globale', () => {
  // Sbagliare il prefisso non da' errori: da' solo risposte peggiori. Per
  // questo deve viaggiare col modello.
  registraModello('con-query', { id: 'a/b', prefisso: 'query: ', pooling: 'media', licenza: 'MIT', licenzaPermissiva: true }, { soloPermissive: true });
  registraModello('senza-prefisso', { id: 'c/d', prefisso: '', pooling: 'primo', licenza: 'MIT', licenzaPermissiva: true }, { soloPermissive: true });
  assert.equal(preparaTesto('quanto ho speso', 'con-query'), 'query: quanto ho speso');
  assert.equal(preparaTesto('quanto ho speso', 'senza-prefisso'), 'quanto ho speso');
  assert.match(preparaTesto('x', 'embeddinggemma-300m'), /^task: sentence similarity/);
});

test('preparaTesto ripulisce gli spazi ma non tocca il prefisso', () => {
  assert.equal(preparaTesto('  ciao  ', 'senza-prefisso'), 'ciao');
});
