// Compare a downloaded candidate with the shipped archive before promotion.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { statSync, writeFileSync } from 'node:fs';
const [candidatePath, reportPath] = process.argv.slice(2);
if (!candidatePath || !reportPath) throw new Error('Usage: node bench/sec-fundamentals-audit.mjs candidate.mjs report.json');
const { FONDAMENTALI_STORICI: old } = await import('../src/alpha/fondamentali-storici.js');
const { FONDAMENTALI_STORICI: next } = await import(pathToFileURL(resolve(candidatePath)));
const measures = ['ricavi', 'utileNetto', 'patrimonioNetto', 'roe', 'margine', 'roa'];
const report = { companies: Object.keys(next).length, bytes: statSync(candidatePath).size,
  revisionRecords: 0, lostCompanies: [], lostYears: [], missingValues: [], changedValues: [], addedYears: 0 };
for (const [ticker, company] of Object.entries(old)) {
  const n = next[ticker];
  if (!n) { report.lostCompanies.push(ticker); continue; }
  for (const y of company.anni) {
    const row = n.anni.find(r => r.anno === y.anno);
    if (!row) { report.lostYears.push({ ticker, year: y.anno }); continue; }
    for (const key of measures) {
      if (!Number.isFinite(y[key])) continue;
      if (!Number.isFinite(row[key])) report.missingValues.push({ ticker, year: y.anno, key });
      else if (Math.abs(row[key] - y[key]) > Math.max(1e-6, Math.abs(y[key]) * 0.001)) {
        report.changedValues.push({ ticker, year: y.anno, key, before: y[key], after: row[key] });
      }
    }
  }
  report.addedYears += n.anni.filter(y => !company.anni.some(r => r.anno === y.anno)).length;
}
for (const n of Object.values(next)) {
  report.revisionRecords += Object.values(n.revisioni || {}).reduce((sum, rows) => sum + rows.length, 0);
}
// A pass is only a coverage check, never independent validation of the accounts.
report.coveragePassed = !report.lostCompanies.length && !report.lostYears.length && !report.missingValues.length;
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, missingValues: report.missingValues.length,
  changedValues: report.changedValues.length, lostYears: report.lostYears.length }));
if (!report.coveragePassed) process.exitCode = 2;
