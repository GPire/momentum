// Structural checks for received models; accuracy still requires the local
// validation gates. Accept the original eight-output format without remapping.
const LEGACY = ['spesa', 'ristoranti', 'shopping', 'abbonamenti', 'trasporti', 'stipendio', 'etf', 'crypto'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 512
  && !['__proto__', 'prototype', 'constructor'].includes(key);
const vector = (v, size) => Array.isArray(v) && v.length === size && v.every(Number.isFinite);
const matrix = (v, rows, cols) => Array.isArray(v) && v.length === rows && v.every(row => vector(row, cols));
const count = v => Number.isFinite(v) && v >= 0;

export function validNeuralModel(net) {
  if (!record(net) || !matrix(net.W1, 12, 8) || !vector(net.b1, 12) || !record(net.embeddings)) return false;
  const categories = net.indexToCat ?? LEGACY;
  if (!Array.isArray(categories) || !categories.length || categories.length > 512
    || !categories.every(safeKey) || new Set(categories).size !== categories.length
    || !matrix(net.W2, categories.length, 12) || !vector(net.b2, categories.length)) return false;
  if (net.catIndex !== undefined || net.indexToCat !== undefined) {
    if (!record(net.catIndex) || !Array.isArray(net.indexToCat)
      || Object.keys(net.catIndex).length !== categories.length
      || !categories.every((cat, i) => Object.hasOwn(net.catIndex, cat) && net.catIndex[cat] === i)) return false;
  }
  const words = Object.entries(net.embeddings);
  return words.length <= 50000 && words.every(([word, v]) => safeKey(word) && vector(v, 8));
}

export function validCategoryCounts(counts) {
  return record(counts) && Object.keys(counts).length <= 512
    && Object.entries(counts).every(([key, n]) => safeKey(key) && count(n));
}

export function validGraphModel(graph) {
  if (!record(graph) || graph.version !== 'dcgn-1' || !count(graph.docs)
    || !validCategoryCounts(graph.cats) || !record(graph.edges) || !record(graph.df)) return false;
  const rows = Object.entries(graph.edges), frequencies = Object.entries(graph.df);
  if (rows.length > 50000 || frequencies.length > 50000) return false;
  let cells = 0;
  return frequencies.every(([key, n]) => safeKey(key) && count(n)) && rows.every(([token, row]) => {
    if (!safeKey(token) || !record(row)) return false;
    const entries = Object.entries(row);
    cells += entries.length;
    return cells <= 200000 && entries.every(([cat, cell]) => safeKey(cat) && record(cell) && count(cell.w) && count(cell.n));
  });
}
