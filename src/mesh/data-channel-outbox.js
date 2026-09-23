'use strict';

const DEFAULT_HIGH_WATER = 256 * 1024;
const DEFAULT_LOW_WATER = 64 * 1024;
const DEFAULT_MAX_QUEUED = 16 * 1024 * 1024;
const states = new WeakMap();

function bytes(value) {
  const text = String(value ?? '');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).byteLength;
  return Buffer.byteLength(text, 'utf8');
}

function later(scheduleFn, fn, delay) {
  const handle = scheduleFn(fn, delay);
  handle?.unref?.();
  return handle;
}

/**
 * Reliable RTCDataChannel outbox with bounded memory and transport backpressure.
 * `true` means the messages were accepted by the local outbox, not received by
 * the remote peer; application receipts remain the source of delivery truth.
 */
function queueDataChannelMessages(channel, messages, {
  highWaterMark = DEFAULT_HIGH_WATER,
  lowWaterMark = DEFAULT_LOW_WATER,
  maxQueuedBytes = DEFAULT_MAX_QUEUED,
  scheduleFn = (fn, ms) => setTimeout(fn, ms),
  onError = () => {},
} = {}) {
  if (!channel || channel.readyState !== 'open') return false;
  const batch = (Array.isArray(messages) ? messages : [messages]).map(value => {
    const message = String(value);
    return { message, bytes: bytes(message) };
  });
  const batchBytes = batch.reduce((total, item) => total + item.bytes, 0);
  let state = states.get(channel);
  if (!state) {
    state = { queue: [], queuedBytes: 0, scheduled: false, listening: false, failed: false };
    states.set(channel, state);
  }
  if (state.failed) return false;
  if (state.queuedBytes + batchBytes > maxQueuedBytes) {
    onError({ reason: 'outbox-full', bytes: state.queuedBytes + batchBytes });
    return false;
  }
  state.queue.push(...batch);
  state.queuedBytes += batchBytes;

  const drain = () => {
    state.scheduled = false;
    if (state.failed) return;
    if (channel.readyState !== 'open') {
      state.queue.length = 0;
      state.queuedBytes = 0;
      state.failed = true;
      onError({ reason: 'channel-closed' });
      return;
    }
    while (state.queue.length && Number(channel.bufferedAmount || 0) <= highWaterMark) {
      const next = state.queue[0];
      try {
        channel.send(next.message);
        state.queue.shift();
        state.queuedBytes -= next.bytes;
      } catch (error) {
        if (error?.name !== 'OperationError') {
          state.queue.length = 0;
          state.queuedBytes = 0;
          state.failed = true;
          onError({ reason: 'send-failed', error });
          return;
        }
        break;
      }
    }
    if (!state.queue.length || state.scheduled) return;
    state.scheduled = true;
    later(scheduleFn, drain, 250);
  };

  if (!state.listening && typeof channel.addEventListener === 'function') {
    state.listening = true;
    try {
      channel.bufferedAmountLowThreshold = lowWaterMark;
      channel.addEventListener('bufferedamountlow', drain);
    } catch { /* polling fallback below */ }
  }
  drain();
  return !state.failed;
}

function queuedDataChannelBytes(channel) {
  return states.get(channel)?.queuedBytes || 0;
}

export { bytes as utf8Bytes, queueDataChannelMessages, queuedDataChannelBytes };
