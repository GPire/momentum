import test from 'node:test';
import assert from 'node:assert/strict';
import { queueDataChannelMessages, queuedDataChannelBytes, utf8Bytes } from './data-channel-outbox.js';

test('sends immediately while the WebRTC buffer has room', () => {
  const sent = [];
  const channel = { readyState: 'open', bufferedAmount: 0, send: value => sent.push(value) };
  assert.equal(queueDataChannelMessages(channel, ['a', 'b']), true);
  assert.deepEqual(sent, ['a', 'b']);
  assert.equal(queuedDataChannelBytes(channel), 0);
});

test('waits for bufferedamountlow instead of flooding a congested channel', () => {
  const sent = [], listeners = {}, scheduled = [];
  const channel = {
    readyState: 'open', bufferedAmount: 300_000,
    send: value => sent.push(value),
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  assert.equal(queueDataChannelMessages(channel, ['first', 'second'], { scheduleFn: fn => scheduled.push(fn) }), true);
  assert.deepEqual(sent, []);
  assert.ok(queuedDataChannelBytes(channel) > 0);
  channel.bufferedAmount = 0;
  listeners.bufferedamountlow();
  assert.deepEqual(sent, ['first', 'second']);
  assert.equal(queuedDataChannelBytes(channel), 0);
});

test('rejects an outbox batch that would exceed its memory bound', () => {
  let problem;
  const channel = { readyState: 'open', bufferedAmount: 999, send() {} };
  assert.equal(queueDataChannelMessages(channel, 'abcdef', { maxQueuedBytes: 5, onError: value => { problem = value; } }), false);
  assert.equal(problem.reason, 'outbox-full');
});

test('measures UTF-8 bytes rather than JavaScript code units', () => {
  assert.equal(utf8Bytes('€'), 3);
  assert.equal(utf8Bytes('a'), 1);
});

test('a synchronous send failure is reported instead of claiming delivery', () => {
  const channel = { readyState: 'open', bufferedAmount: 0, send() { throw new Error('closed'); } };
  let problem;
  assert.equal(queueDataChannelMessages(channel, 'payload', { onError: value => { problem = value; } }), false);
  assert.equal(problem.reason, 'send-failed');
  assert.equal(queuedDataChannelBytes(channel), 0);
});
