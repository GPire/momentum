import test from 'node:test';
import assert from 'node:assert/strict';

const { quantizeMatrix, matmulQuantized } = await import('./quantize.js');

test('quantizeMatrix: ricostruzione approssima l\'originale entro l\'errore di scala', () => {
  const W = [[0.5, -1.0], [0.25, 0.75]];
  const q = quantizeMatrix(W);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const recon = q.q[i * 2 + j] * q.scale;
    assert.ok(Math.abs(recon - W[i][j]) < q.scale, 'errore entro un passo di quantizzazione');
  }
});

test('matmulQuantized: vicino al prodotto float esatto', () => {
  const W = [[0.5, -1.0, 0.3], [0.25, 0.75, -0.6]];
  const input = [2, 4];
  // float esatto
  const exact = [0, 0, 0];
  for (let k = 0; k < 3; k++) for (let i = 0; i < 2; i++) exact[k] += input[i] * W[i][k];
  const q = quantizeMatrix(W);
  const approx = matmulQuantized(input, q);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(approx[k] - exact[k]) < 0.1, `k=${k}: ${approx[k]} vs ${exact[k]}`);
});

test('matmulQuantized: input a zero non contribuisce (fast path corretto)', () => {
  const W = [[1, 2], [3, 4]];
  const q = quantizeMatrix(W);
  const out = matmulQuantized([0, 5], q);
  // solo la seconda riga conta: [5*3, 5*4] = [15, 20] a meno della quantizzazione
  assert.ok(Math.abs(out[0] - 15) < 0.2);
  assert.ok(Math.abs(out[1] - 20) < 0.2);
});
