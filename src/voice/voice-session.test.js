import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'it-IT' }, configurable: true });
globalThis.document = { querySelector: () => null, getElementById: () => null, addEventListener() {} };
const { VoiceCore, VoiceParser, SPEECH_LOCALE, spokenCategory } = await import('./voice.js');
const { VaultDAO } = await import('../core/vault.js');
class Recognition {
  starts = 0;
  start() { this.starts++; }
  stop() {}
  abort() {}
}
const container = { querySelector: () => null };
test('rapid taps before onstart request only one recognition session', () => {
  window.SpeechRecognition = Recognition;
  VoiceCore.init(container);
  VoiceCore.toggle();
  VoiceCore.toggle();
  assert.equal(VoiceCore.recognition.starts, 1);
});
test('callbacks retained by an old recognizer cannot reset the new session', () => {
  VoiceCore.init(container);
  const lateEnd = VoiceCore.recognition.onend;
  VoiceCore.init(container);
  VoiceCore.isListening = true;
  lateEnd();
  assert.equal(VoiceCore.isListening, true);
});
test('Dutch uses its own speech locale', () => {
  assert.equal(SPEECH_LOCALE.nl, 'nl-NL');
});
test('spoken category follows renamed labels, accents and spacing without guessing between duplicate names', () => {
  const categories = [{ id: 'custom-1', name: 'Caffè lavoro', type: 'uscita' }];
  assert.equal(spokenCategory('caffe  lavoro', 'uscita', categories), 'custom-1');
  assert.equal(spokenCategory('caffe lavoro', 'entrata', categories), null);
  assert.equal(spokenCategory('caffe lavoro domani', 'uscita', categories), null);
  assert.equal(spokenCategory('caffe lavoro', 'uscita', [...categories, { ...categories[0], id: 'custom-2' }]), null);
});
test('a final voice expense reaches the Vault and refreshes the visible list', () => {
  const parse = VoiceParser.parse;
  const save = VaultDAO.save;
  const previous = VaultDAO.state.transactions;
  const head = VaultDAO.state.lastHash;
  let refreshes = 0;
  document.createElement = () => ({});
  VoiceParser.parse = () => [{ intent: 'transaction', type: 'uscita', amount: 15, category: 'spesa', description: 'Pane' }];
  VaultDAO.state.transactions = {};
  VaultDAO.save = () => {};
  window.renderDashboard = () => refreshes++;
  window.momentumOrchestrator = undefined;
  try {
    VoiceCore.init(container);
    VoiceCore.recognition.onresult({ results: [{ isFinal: true, 0: { transcript: 'ho speso 15 euro per pane' } }] });
    const transactions = Object.values(VaultDAO.state.transactions).flat();
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].amount, 15);
    assert.equal(refreshes, 1);
  } finally {
    VoiceParser.parse = parse; VaultDAO.save = save;
    VaultDAO.state.transactions = previous; VaultDAO.state.lastHash = head;
    delete window.renderDashboard;
  }
});
