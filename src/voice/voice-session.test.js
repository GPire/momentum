import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'it-IT' }, configurable: true });
globalThis.document = { querySelector: () => null, getElementById: () => null, addEventListener() {} };
const { VoiceCore, VoiceParser, SPEECH_LOCALE, spokenCategory } = await import('./voice.js');
const { VaultDAO } = await import('../core/vault.js');
class Recognition {
  static async available() { return 'available'; }
  starts = 0;
  processLocally = false;
  start() { this.starts++; }
  stop() {}
  abort() {}
}
const container = { querySelector: () => null };
test('rapid taps before onstart request only one recognition session, transcribed on the device', async () => {
  window.SpeechRecognition = Recognition;
  VoiceCore.init(container);
  await Promise.all([VoiceCore.toggle(), VoiceCore.toggle()]);
  assert.equal(VoiceCore.recognition.starts, 1);
  assert.equal(VoiceCore.recognition.processLocally, true);
});

test('without on-device transcription and without the user saying yes, the microphone never starts', async () => {
  class SoloOnline { starts = 0; start() { this.starts++; } stop() {} abort() {} }
  window.SpeechRecognition = SoloOnline;
  VaultDAO.state.voiceCloudOk = false;
  VoiceCore.init(container);
  await VoiceCore.toggle();
  assert.equal(VoiceCore.recognition.starts, 0);
  VaultDAO.state.voiceCloudOk = true;
  await VoiceCore.toggle();
  assert.equal(VoiceCore.recognition.starts, 1);
  window.SpeechRecognition = Recognition;
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

test('batched final results are processed once; identical later utterances remain valid', () => {
  const original = VoiceParser.parse;
  const seen = [];
  VoiceParser.parse = text => { seen.push(text); return []; };
  document.createElement = () => ({});
  const final = text => ({ isFinal: true, 0: { transcript: text } });
  try {
    VoiceCore.init(container);
    const results = [final('taxi 15'), final('pranzo 20'), { isFinal: false, 0: { transcript: 'hotel' } }];
    VoiceCore.recognition.onresult({ resultIndex: 0, results });
    VoiceCore.recognition.onresult({ resultIndex: 0, results });
    results[2] = final('taxi 15');
    VoiceCore.recognition.onresult({ resultIndex: 2, results });
    assert.deepEqual(seen, ['taxi 15', 'pranzo 20', 'taxi 15']);
    VoiceCore.recognition.onstart();
    VoiceCore.recognition.onresult({ resultIndex: 0, results: [final('taxi 15')] });
    assert.equal(seen.length, 4);
  } finally { VoiceParser.parse = original; }
});

test('spoken custom category keeps international letters through the actual parser', () => {
  const previous = VaultDAO.state.customCategories;
  VaultDAO.state.customCategories = [{ id: 'office-test', name: 'Büro', type: 'uscita', icon: 'briefcase', color: '#888888' }];
  try {
    const result = VoiceParser.parse('ho speso 15 euro per Büro')[0];
    assert.equal(result.description, 'Büro');
    assert.equal(result.category, 'office-test');
  } finally { VaultDAO.state.customCategories = previous; }
});

test('voice metrics use closed categories and ignore callbacks from older sessions',()=>{
 window.SpeechRecognition=Recognition;
 const events=[];
 VoiceCore.init(container,key=>events.push(key));
 const oldError=VoiceCore.recognition.onerror;
 VoiceCore.init(container,key=>events.push(key));
 oldError({error:'network'});
 assert.deepEqual(events,[]);
 VoiceCore.recognition.onerror({error:'network'});
 VoiceCore.recognition.onerror({error:'aborted'});
 assert.deepEqual(events,['voice_network_failed']);
});
