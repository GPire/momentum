'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELLI_SENTIMENT, MODELLO_SENTIMENT_PREDEFINITO, modelloSentimentAttivo, scegliModelloSentiment,
} from './sentiment-model.js';

test('IL PREDEFINITO HA LICENZA PERMISSIVA e ID reale su Hugging Face', () => {
  const m = modelloSentimentAttivo();
  assert.equal(m.licenzaPermissiva, true, `il predefinito ha licenza "${m.licenza}"`);
  assert.match(m.licenza, /Apache/);
  assert.match(m.id, /^Xenova\//, 'deve essere una conversione ONNX pronta per transformers.js, non un repo PyTorch');
});

test('il predefinito è il più leggero fra i due registrati — coerente con "on-device"', () => {
  assert.equal(MODELLO_SENTIMENT_PREDEFINITO, 'distilroberta-financial-news');
  const pesoMB = (s) => parseFloat(s.replace(',', '.'));
  assert.ok(pesoMB(MODELLI_SENTIMENT['distilroberta-financial-news'].pesoStimato) < pesoMB(MODELLI_SENTIMENT['finbert'].pesoStimato));
});

test('ogni modello registrato dichiara licenza, peso, etichette e fonte', () => {
  for (const [chiave, m] of Object.entries(MODELLI_SENTIMENT)) {
    assert.ok(m.id, `${chiave} senza id Hugging Face`);
    assert.ok(m.licenza, `${chiave} senza licenza dichiarata`);
    assert.equal(typeof m.licenzaPermissiva, 'boolean', `${chiave}: permissiva non dichiarata`);
    assert.ok(m.pesoStimato, `${chiave} senza peso stimato`);
    assert.ok(Array.isArray(m.etichette) && m.etichette.length === 3, `${chiave}: servono 3 etichette (pos/neg/neutral)`);
    assert.ok(m.etichette.includes('positive') && m.etichette.includes('negative'), `${chiave}: etichette inattese ${m.etichette}`);
    assert.ok(m.fonte && m.fonte.length > 10, `${chiave} senza fonte/provenienza dichiarata`);
  }
});

test('scegliModelloSentiment cambia il modello attivo, e ignora chiavi sconosciute (mai un crash)', () => {
  scegliModelloSentiment('finbert');
  assert.equal(modelloSentimentAttivo().id, MODELLI_SENTIMENT.finbert.id);
  scegliModelloSentiment('non-esiste');
  assert.equal(modelloSentimentAttivo().id, MODELLI_SENTIMENT.finbert.id, 'una chiave sconosciuta non deve azzerare la scelta precedente');
  scegliModelloSentiment(MODELLO_SENTIMENT_PREDEFINITO); // ripristina per non influenzare altri test nello stesso processo
});
