import test from 'node:test';
import assert from 'node:assert/strict';
const { rsEncode, qrMatrix, qrSvg } = await import('./qr-encode.js');

test('Reed-Solomon: combacia col vettore di riferimento indipendente (HELLO WORLD v1-M)', () => {
  // Data codewords documentati per "HELLO WORLD" versione 1, livello M (16 cw):
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  // EC codewords documentati (10 codeword di correzione) — riferimento pubblico noto:
  const expected = [196, 35, 39, 119, 235, 215, 231, 226, 93, 23];
  assert.deepEqual(rsEncode(data, 10), expected);
});

test('Reed-Solomon: caso banale (tutti zero) → EC tutti zero', () => {
  assert.deepEqual(rsEncode([0, 0, 0], 5), [0, 0, 0, 0, 0]);
});

test('qrMatrix: dimensione corretta per versione (21 = v1, +4 per versione)', () => {
  const m = qrMatrix('hello');
  assert.equal(m.length, 21);        // "hello" (5 byte) sta in v1
  assert.ok(m.every(row => row.length === 21));
});

test('qrMatrix: finder pattern presenti nei 3 angoli (7x7 con bordo)', () => {
  const m = qrMatrix('test');
  const isFinder = (r0, c0) => {
    // centro 3x3 pieno, anello interno vuoto, bordo pieno
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const on = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      if (m[r0 + i][c0 + j] !== on) return false;
    }
    return true;
  };
  const n = m.length;
  assert.ok(isFinder(0, 0), 'finder alto-sx');
  assert.ok(isFinder(0, n - 7), 'finder alto-dx');
  assert.ok(isFinder(n - 7, 0), 'finder basso-sx');
});

test('qrMatrix: sceglie versione più grande per payload lungo (EPC ~200 byte)', () => {
  const long = 'BCD\n002\n1\nSCT\n\n' + 'X'.repeat(180);
  const m = qrMatrix(long);
  assert.ok(m.length > 21, 'un payload lungo richiede una versione > 1');
});

test('qrSvg: produce un SVG con quiet zone e moduli', () => {
  const svg = qrSvg('IBAN test', { moduleSize: 4, quiet: 4 });
  assert.ok(/^<svg/.test(svg));
  assert.ok(/<rect/.test(svg));
  assert.ok(/viewBox/.test(svg));
});
