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
const args = [
  ...(major >= 21 ? ['--no-experimental-global-navigator'] : []),
  '--test',
  ...collectTests('src'),
  ...collectTests('server'),
];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
