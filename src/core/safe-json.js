// JSON.stringify can overflow the JS stack on deeply nested but otherwise
// valid data. Use its fast native path normally and an iterative equivalent
// only for that specific failure. Circular data still fails explicitly.
export function stringifyVault(value) {
  try { return JSON.stringify(value); }
  catch (error) { if (!(error instanceof RangeError)) throw error; }

  const output = [], ancestors = new Set();
  const normalize = item => item && typeof item === 'object' && typeof item.toJSON === 'function' ? item.toJSON() : item;
  const stack = [{ type: 'value', value: normalize(value) }];
  while (stack.length) {
    const frame = stack.pop();
    if (frame.type === 'literal') { output.push(frame.value); continue; }
    if (frame.type === 'close') {
      ancestors.delete(frame.value);
      output.push(frame.bracket);
      continue;
    }
    const item = frame.value;
    if (!item || typeof item !== 'object') {
      output.push(typeof item === 'number' && !Number.isFinite(item) ? 'null' : JSON.stringify(item));
      continue;
    }
    if (ancestors.has(item)) throw new TypeError('Circular vault data cannot be serialized');
    ancestors.add(item);
    const array = Array.isArray(item);
    output.push(array ? '[' : '{');
    stack.push({ type: 'close', value: item, bracket: array ? ']' : '}' });
    const entries = array
      ? Array.from({ length: item.length }, (_, index) => ({ value: normalize(item[index]), key: null }))
      : Object.keys(item).map(key => ({ value: normalize(item[key]), key }))
        .filter(entry => !['undefined', 'function', 'symbol'].includes(typeof entry.value));
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index];
      stack.push({ type: 'value', value: array && ['undefined', 'function', 'symbol'].includes(typeof entry.value) ? null : entry.value });
      if (!array) stack.push({ type: 'literal', value: `${JSON.stringify(entry.key)}:` });
      if (index) stack.push({ type: 'literal', value: ',' });
    }
  }
  return output.join('');
}
