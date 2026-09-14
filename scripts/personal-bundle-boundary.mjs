// Check Rollup's actual chunk graph, including shared static dependencies.
export function assertPersonalBundleBoundary(bundle, { singlefile = false } = {}) {
  const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
  const normalize = id => id.replaceAll('\\', '/').split('?')[0];
  for (const chunk of chunks) {
    for (const id of Object.keys(chunk.modules)) {
      const path = normalize(id);
      if (/\/server\/(auth|company)\//.test(path) || /\/node_modules\/(better-auth|@better-auth)\//.test(path)) {
        throw new Error(`Server authentication/company module in client bundle: ${id}`);
      }
    }
  }
  // Single-file exports intentionally inline all client functionality.
  if (singlefile) return;
  const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const pending = chunks.filter(chunk => chunk.isEntry);
  const visited = new Set();
  while (pending.length) {
    const chunk = pending.pop();
    if (visited.has(chunk.fileName)) continue;
    visited.add(chunk.fileName);
    for (const id of Object.keys(chunk.modules)) {
      if (/\/src\/trips\/company-(policy|submit|attachments)\.js$/.test(normalize(id))) {
        throw new Error(`Company module eagerly loaded by personal app: ${id}`);
      }
    }
    for (const name of chunk.imports) if (byName.has(name)) pending.push(byName.get(name));
  }
}

export function personalBundleBoundary(singlefile) {
  return {
    name: 'momentum-personal-bundle-boundary',
    generateBundle(_options, bundle) {
      assertPersonalBundleBoundary(bundle, { singlefile });
    },
  };
}
