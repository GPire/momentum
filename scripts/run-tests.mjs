import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectTests(path) : entry.name.endsWith('.test.js') ? [path] : [];
  });
}

const major = Number.parseInt(process.versions.node, 10);
// `server/` è un bundle isolato per principio (docs/personal-company-loading.md,
// scripts/personal-bundle-boundary.mjs): dipendenze proprie, mai nel bundle
// Vite personale. Le sue dipendenze (server/auth/package.json, es. better-auth)
// non sono installate da un `npm ci` alla radice — solo da un `npm ci` con
// prefix dedicato — e server/company/*.test.js usa `node:sqlite`, disponibile
// solo da Node 22+. Un ambiente che non ha fatto quel passo aggiuntivo (una
// CI su Node 20 pensata per script/fetch, o un checkout locale mai installato
// dentro server/auth) non deve far fallire l'INTERA suite personale per
// questo — si salta `server/` con un avviso esplicito, mai un crash silenzioso.
const serverDepsPronte = major >= 22 && existsSync(join('server', 'auth', 'node_modules'));
if (!serverDepsPronte) {
  console.log(`server/*.test.js saltati (richiede Node 22+ e 'npm ci' dentro server/auth — Node attuale: ${process.versions.node}${major >= 22 ? ', dipendenze non installate' : ''}).`);
}
// server/license non ha dipendenze né node:sqlite: gira sempre, anche su Node 20.
const files = [...collectTests('src'), ...(serverDepsPronte ? collectTests('server') : collectTests(join('server', 'license')))];
// Separate processes still isolate globals; inherited handles avoid restricted
// environments that cannot create the test runner's IPC pipes.
if (process.argv.includes('--serial-files')) {
  if (major < 22) throw new Error('--serial-files requires Node 22 or newer');
  const failed = [];
  for (const file of files) {
    console.log(`\nFILE ${file}`);
    const result = spawnSync(process.execPath, ['--no-experimental-global-navigator', '--test', '--test-isolation=none', file], { stdio: 'inherit' });
    if (result.error || result.status !== 0) { failed.push(file); console.error(result.error || `Exit ${result.status}: ${file}`); }
  }
  console.log(`\nFILES: ${files.length - failed.length}/${files.length} passed`);
  if (failed.length) console.error('FAILED FILES:', failed.join(', '));
  process.exit(failed.length ? 1 : 0);
}
const args = [
  ...(major >= 21 ? ['--no-experimental-global-navigator'] : []),
  '--test',
  ...files,
];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
