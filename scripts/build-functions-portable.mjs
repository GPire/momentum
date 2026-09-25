import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Portable Functions build requires Node 24 or newer.');
const tools = new URL('./portable-tools/node_modules/esbuild-wasm/', import.meta.url);
const context = vm.createContext({ console, setTimeout, clearTimeout, TextEncoder, TextDecoder, WebAssembly, performance, crypto, Uint8Array, Uint32Array, Int32Array, ArrayBuffer, URL, module: { exports: {} } });
context.self = context;
try { vm.runInContext(readFileSync(new URL('lib/browser.js', tools), 'utf8'), context); }
catch (error) { throw new Error('Run npm run build:portable:setup first.', { cause: error }); }
const compiler = context.module.exports;
const allFiles = vm.runInContext('/.*/', context);
await compiler.initialize({ wasmModule: await WebAssembly.compile(readFileSync(new URL('esbuild.wasm', tools))), worker: false });
try {
  const result = await compiler.build({
    entryPoints: ['functions/v1/[[path]].js', 'functions/company/[[path]].js', 'functions/api/market-filings.js', 'functions/api/market-headlines.js', 'functions/api/market-crypto-news.js', 'functions/api/market-policy-news.js', 'functions/api/market-quarter.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outdir: 'pages-functions-check',
    write: false,
    logLevel: 'warning',
    plugins: [{
      name: 'node-files',
      setup(build) {
        build.onResolve({ filter: allFiles }, args => ({ namespace: 'node-file', path: resolve(args.kind === 'entry-point' ? '.' : dirname(args.importer), args.path) }));
        build.onLoad({ filter: allFiles, namespace: 'node-file' }, args => ({ contents: readFileSync(args.path, 'utf8'), loader: 'js', resolveDir: dirname(args.path) }));
      },
    }],
  });
  if (result.errors.length || result.outputFiles.length !== 7) throw new Error('Pages Functions bundle incomplete.');
  console.log(`Portable Pages Functions build: ${result.outputFiles.length}/7 routes bundled with esbuild ${compiler.version} WebAssembly.`);
} finally { compiler.stop(); }
