import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSplitDraft } from '../ui/split-draft.js';
import { buildRepaymentCode } from './repayment-share.js';
import { unpackShare, buildInviteUrl, extractShareCode } from './invite-codec.js';
import { computeBalances, encodeGroupShare, myMemberId, displayNames } from './split-engine.js';

test('repayment link round-trip preserves ten identities, namesakes, currency, cents and the creator claim', async () => {
  const members = Array.from({ length: 10 }, (_, i) => ({ id: i ? crypto.randomUUID() : 'Io', name: i === 1 || i === 2 ? 'Marco' : `Persona ${i}` }));
  const group = { ...buildSplitDraft({ members, paid: { Io: '120', [members[1].id]: '45.50', [members[2].id]: '34.50' }, name: 'Cena & amici', id: 'qa-share', deviceId: 'qa-device' }), baseCurrency: 'USD' };
  const code = await buildRepaymentCode(group);
  const url = buildInviteUrl({ base: 'https://example.com', path: '/', code, groupName: group.name });
  const received = await unpackShare(extractShareCode(url));
  assert.deepEqual(computeBalances(received), computeBalances(group));
  assert.equal(received.baseCurrency, 'USD');
  assert.equal(received.members.length, 10);
  assert.equal(myMemberId(received, 'qa-device'), 'Io');
  assert.deepEqual(displayNames(received.members), displayNames(group.members));
  assert.ok(code.length < encodeGroupShare(group).length);
  assert.ok(new URL(url).hash.includes('MSPLIT2.'));
  assert.ok(!new URL(url).search.includes('MSPLIT'));
});
