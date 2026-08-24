import test from 'node:test';
import assert from 'node:assert/strict';
import { creaTracciatoreProgresso } from './download-progress.js';

test('stato iniziale: inattivo, nessuna percentuale inventata', () => {
  const { stato } = creaTracciatoreProgresso();
  const s = stato();
  assert.equal(s.fase, 'inattivo');
  assert.equal(s.pct, null);
});

test('initiate/download portano la fase a "scaricamento" anche prima del primo byte', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback({ status: 'initiate', file: 'model_quantized.onnx' });
  assert.equal(stato().fase, 'scaricamento');
});

test('un solo file: la percentuale segue loaded/total di quel file', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback({ status: 'download', file: 'model_quantized.onnx' });
  callback({ status: 'progress', file: 'model_quantized.onnx', loaded: 25, total: 100 });
  assert.equal(stato().pct, 25);
  callback({ status: 'progress', file: 'model_quantized.onnx', loaded: 80, total: 100 });
  assert.equal(stato().pct, 80);
});

test('più file (tokenizer piccolo + modello grande): la percentuale è aggregata sui byte VERI, non la media dei due file', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback({ status: 'progress', file: 'tokenizer.json', loaded: 500, total: 500 }); // piccolo, già finito
  callback({ status: 'progress', file: 'model_quantized.onnx', loaded: 41_000_000, total: 82_000_000 }); // a metà
  const s = stato();
  // (500 + 41.000.000) / (500 + 82.000.000) ≈ 50%, non (100%+50%)/2=75%
  assert.ok(s.pct >= 49 && s.pct <= 51, `pct=${s.pct}`);
});

test('un file "done" senza mai aver mandato un evento "progress" (letto dalla cache) conta comunque come completato, non 0', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback({ status: 'progress', file: 'model_quantized.onnx', loaded: 40, total: 80 });
  callback({ status: 'done', file: 'tokenizer.json' }); // mai visto prima, letto in un colpo dalla cache
  const s = stato();
  assert.ok(s.pct >= 45, `il file "done" deve contribuire come completo, non restare a 0: pct=${s.pct}`);
});

test('"ready" segna la fase come "pronto"', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback({ status: 'progress', file: 'x.onnx', loaded: 10, total: 10 });
  callback({ status: 'ready' });
  assert.equal(stato().fase, 'pronto');
});

test('eventi vuoti/malformati non fanno mai crashare', () => {
  const { callback, stato } = creaTracciatoreProgresso();
  callback(null);
  callback(undefined);
  callback({});
  callback({ status: 'progress' }); // senza `file`
  assert.doesNotThrow(() => stato());
});
