// Explicit fallback for environments that prohibit child-process pipes.
// Same esbuild version, target and minification; standard CI stays on Vite's CLI.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import vm from 'node:vm';

if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Portable build requires Node 24 or newer.');
const require = createRequire(import.meta.url);
const tools = new URL('./portable-tools/node_modules/esbuild-wasm/', import.meta.url);
const context = vm.createContext({ console, setTimeout, clearTimeout, TextEncoder, TextDecoder, WebAssembly, performance, crypto, Uint8Array, Uint32Array, Int32Array, ArrayBuffer, URL, module: { exports: {} } });
context.self = context;
try { vm.runInContext(readFileSync(new URL('lib/browser.js', tools), 'utf8'), context); }
catch (error) { throw new Error('Run npm run build:portable:setup first.', { cause: error }); }
const compiler = context.module.exports;
if (compiler.version !== require('esbuild/package.json').version) throw new Error('Native and WASM esbuild versions differ. Update portable-tools before validating a release.');

// Vite 5 executes `net use` when resolving Windows real paths. Preserving
// symlinks avoids that optimization. Refuse linked source/dependency trees so
// this fallback cannot silently change which package instance is bundled.
function requirePlainTree(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Portable build requires a tree without symlinks: ${full}`);
    if (entry.isDirectory()) requirePlainTree(full);
  }
}
for (const path of ['src', 'node_modules']) requirePlainTree(path);
await compiler.initialize({ wasmModule: await WebAssembly.compile(readFileSync(new URL('esbuild.wasm', tools))), worker: false });
globalThis.__momentumBuildCompiler = compiler;
const hooks = registerHooks({ resolve(specifier, ctx, next) {
  return specifier === 'esbuild' ? { url: new URL('./compiler-wasm.mjs', import.meta.url).href, shortCircuit: true } : next(specifier, ctx);
} });
try {
  const { build } = await import('vite');
  const { default: config } = await import('../vite.config.js');
  const mode = process.argv.includes('--singlefile') ? 'singlefile' : 'production';
  console.log(`Portable production build: esbuild ${compiler.version} WebAssembly; unchanged target/minification.`);
  await build({ ...config({ mode, command: 'build' }), configFile: false, mode, resolve: { preserveSymlinks: true } });
} finally {
  hooks.deregister();
  compiler.stop();
  delete globalThis.__momentumBuildCompiler;
}
