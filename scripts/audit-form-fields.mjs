import { readFileSync, writeFileSync } from 'node:fs';

// Source inventory, not a substitute for runtime accessible-name/layout checks.
const rows = [];
for (const file of ['index.html', 'src/main.js']) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<(input|textarea|select)\b(?:"[^"]*"|'[^']*'|[^'">])*>/g)) {
    const tag = match[0];
    const attr = name => tag.match(new RegExp(`\\b${name}=("[^"]*"|'[^']*')`))?.[1].slice(1, -1) || '';
    if (attr('type') === 'hidden' || /\shidden(?:\s|>)/.test(tag)) continue;
    const prefix = source.slice(0, match.index);
    const wrapped = prefix.lastIndexOf('<label') > prefix.lastIndexOf('</label>');
    const id = attr('id');
    const linked = id && source.includes(`for="${id}"`);
    rows.push({ file, line: prefix.split('\n').length, id: id || attr('name') || '(dynamic)', type: attr('type') || match[1], placeholder: attr('placeholder'), label: Boolean(wrapped || linked || attr('aria-label') || attr('aria-labelledby')), name: Boolean(attr('name')), literal: Boolean(attr('placeholder') && !attr('placeholder').includes('${') && !attr('data-i18n-placeholder')) });
  }
}
const esc = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const report = `# Inventory of form controls\n\nGenerated from source; labels attached by JavaScript, dynamic templates and duplicate IDs require browser verification. A missing source label is a review candidate, not a certified WCAG failure.\n\n${rows.length} controls; ${rows.filter(r => !r.label).length} without a source label; ${rows.filter(r => !r.name).length} without name; ${rows.filter(r => r.literal).length} literal placeholders to review for localization.\n\n| Source | Field | Type | Label found | Name | Placeholder |\n|---|---|---|---|---|---|\n` + rows.map(r => `| ${r.file}:${r.line} | ${esc(r.id)} | ${r.type} | ${r.label ? 'yes' : 'REVIEW'} | ${r.name ? 'yes' : 'REVIEW'} | ${esc(r.placeholder)} |`).join('\n') + '\n';
writeFileSync('docs/form-fields-audit.md', report);
console.log(report.split('\n').slice(0, 5).join('\n'));
