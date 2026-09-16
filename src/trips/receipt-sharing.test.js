import test from 'node:test';
import assert from 'node:assert/strict';
import { shareTripReceipts } from './receipt-sharing.js';

const files = [{ name: 'one.pdf' }, { name: 'two.png' }];
function setup(navigator = {}) {
  const calls = [];
  return { calls, args: { files, address: 'test@example.com', navigator,
    download: async file => calls.push(file.name), openEmail: async address => calls.push(address) } };
}
test('native file sharing passes all files and never opens email or claims delivery', async () => {
  const { args, calls } = setup({ canShare: () => true, share: async payload => assert.deepEqual(payload.files, files) });
  assert.deepEqual(await shareTripReceipts(args), { status: 'prepared', channel: 'share', count: 2 });
  assert.deepEqual(calls, []);
});
test('desktop without file sharing downloads before opening the email draft', async () => {
  const { args, calls } = setup();
  assert.equal((await shareTripReceipts(args)).channel, 'email');
  assert.deepEqual(calls, ['one.pdf', 'two.png', 'test@example.com']);
});
for (const name of ['AbortError', 'NotAllowedError', 'DataError']) {
  test(`${name} does not trigger a second transport or certify an upload`, async () => {
    const { args, calls } = setup({ canShare: () => true, share: async () => { throw Object.assign(new Error(), { name }); } });
    assert.equal((await shareTripReceipts(args)).status, name === 'AbortError' ? 'cancelled' : 'failed');
    assert.deepEqual(calls, []);
  });
}
test('failed download never opens an email draft with an incomplete set', async () => {
  const { args, calls } = setup();
  args.download = async () => { throw new Error('download failed'); };
  await assert.rejects(shareTripReceipts(args));
  assert.deepEqual(calls, []);
});
test('empty files or invalid recipient cause no side effects', async () => {
  const { args, calls } = setup();
  await assert.rejects(shareTripReceipts({ ...args, files: [] }));
  await assert.rejects(shareTripReceipts({ ...args, address: 'invalid' }));
  assert.deepEqual(calls, []);
});
