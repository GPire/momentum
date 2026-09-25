import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOfficialMacroBrief } from './market-macro-brief.js';

const now = Date.parse('2026-09-25T12:00:00Z');
test('asset brief includes one recent original from each official central bank', () => {
  const items = [
    { fonte: 'fed', titolo: 'FOMC statement', data: '2026-09-16', link: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm' },
    { fonte: 'fed', titolo: 'Old statement', data: '2026-09-01', link: 'https://www.federalreserve.gov/old.htm' },
    { fonte: 'bce', titolo: 'ECB rate decision', data: '2026-09-20', link: 'https://www.ecb.europa.eu/press/pr/date/2026/html/example.en.html', viaRelay: true },
  ];
  assert.deepEqual(selectOfficialMacroBrief(items, { now }).map(v => [v.source, v.title, v.viaRelay]), [
    ['Fed', 'FOMC statement', false], ['BCE', 'ECB rate decision', true],
  ]);
});

test('asset brief excludes stale news, injected domains and invalid dates', () => {
  const items = [
    { fonte: 'fed', titolo: 'Impostor', data: '2026-09-20', link: 'https://federalreserve.gov.attacker.example/post' },
    { fonte: 'fed', titolo: 'Too old', data: '2025-09-20', link: 'https://www.federalreserve.gov/post' },
    { fonte: 'fed', titolo: 'Board member to resign', data: '2026-09-24', link: 'https://www.federalreserve.gov/post' },
    { fonte: 'bce', titolo: 'Unsafe URL', data: '2026-09-20', link: 'javascript:alert(1)' },
    { fonte: 'bce', titolo: 'Future event', data: '2027-09-20', link: 'https://www.ecb.europa.eu/post' },
  ];
  assert.deepEqual(selectOfficialMacroBrief(items, { now }), []);
});
