// Manual fixture regeneration from repository tags. Only synthetic data.
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
// Optional shell-exported snapshot avoids child-process pipes on locked-down Windows.
const snapshot = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '')) : null;
const git = (...args) => (snapshot ? snapshot[args.join(' ')] : execFileSync('git', args, { encoding: 'utf8' })).trim();
const output = new URL('../src/core/fixtures/', import.meta.url);
mkdirSync(output, { recursive: true });
const states = [];
for (const tag of ['v7.0', 'v7.1']) {
  const revision = git('rev-parse', tag);
  const source = git('show', `${tag}:src/core/vault.js`);
  const constants = git('show', `${tag}:src/core/constants.js`);
  const schema = Number(constants.match(/SCHEMA_VERSION\s*=\s*([\d.]+)/)[1]);
  const literal = source.match(/state: (\{[\s\S]*?\n  \}),\r?\n  init\(\)/)[1];
  const state = JSON.parse(JSON.stringify(runInNewContext(`(${literal})`, { SCHEMA_VERSION: schema }, { timeout: 1000 })));
  state.currentDate = '2026-07-07T12:00:00.000Z';
  state.isFirstLaunch = false;
  state.monthlyBudget = 420.25;
  state.transactions = { '2026-07': [{ id: 7001, amount: 12.5, type: 'uscita', category: 'spesa', date: '2026-07-05T12:00:00.000Z', description: 'Caffè di prova' }] };
  state.mlData = { ...state.mlData, vocab: { caffè: { spesa: 3 } }, catCounts: { spesa: 3 }, totalWords: 3, lastTraining: 1783425600000 };
  state.savingsGoals = [{ id: 'historic-trip', name: 'Viaggio', target: 800, saved: 21 }];
  state.engagement = { lastActiveDay: '2026-07-07', streak: 4, bestStreak: 8 };
  states.push({ tag, revision, schema, state });
}
const revision = git('rev-parse', '57a70d7');
const source = git('show', `${revision}:src/core/backup.js`);
if (/^import\s/m.test(source)) throw new Error('Historical exporter must be self-contained');
const exporter = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const password = 'Synthetic historical fixture only';
const encrypted = await exporter.encryptBackup(states[0].state, password);
const legacy = { transactions: Object.values(states[0].state.transactions).flat(), budget: 420.25, aggression: 'advisor' };
writeFileSync(new URL('historical-backups.json', output), JSON.stringify({
  provenance: 'Synthetic states built from actual tagged Vault defaults. Encrypted envelope produced by the original exporter. Not customer backups.',
  states, encrypted: { revision, password, envelope: encrypted, expected: states[0].state },
  dna: { text: Buffer.from(JSON.stringify(legacy)).toString('base64'), expected: legacy },
}, null, 2) + '\n');
console.log('Historical fixtures generated:', states.map(s => `${s.tag} ${s.revision}`).join(', '), 'exporter', revision);
