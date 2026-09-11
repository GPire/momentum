import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectTests(path) : entry.name.endsWith('.test.js') ? [path] : [];
  });
}

const major = Number.parseInt(process.versions.node, 10);
const files = [...collectTests('src'), ...collectTests('server')];
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
