import test from 'node:test';
import assert from 'node:assert/strict';
import { divergenzaSentimentPrezzo, prepareSentimentPriceEvidence } from './sentiment-divergence.js';

const sent = (score, n = 5, extra = {}) => ({ score, n, confidence: 0.6, onDevice: false, label: 'x', ...extra });

test('la divergenza usa solo notizie pubblicate nella finestra dei prezzi aggiornati', () => {
  const now = Date.parse('2026-09-24T12:00:00Z');
  const series = [{ date: '2026-09-22', price: 100 }, { date: '2026-09-23', price: 96 }];
  const news = [
    { sentimentScore: 0.7, publishedAt: '2026-09-23T10:00:00Z', url: 'https://source.example/1' },
    { sentimentScore: -0.8, publishedAt: '2026-09-24T09:00:00Z', url: 'https://source.example/2' },
  ];
  const evidence = prepareSentimentPriceEvidence(news, series, { now });
  assert.equal(evidence.sentiment.n, 1);
  assert.equal(evidence.variazionePrezzo, -0.04);
  assert.equal(evidence.finestraGiorni, 1);
  assert.equal(prepareSentimentPriceEvidence(news.slice(1), series, { now }), null);
  assert.equal(prepareSentimentPriceEvidence([{ sentimentScore: 0.7, observedAt: news[0].publishedAt }], series, { now }), null);
  assert.equal(prepareSentimentPriceEvidence(news, [{ date: '2026-09-01', price: 100 }, { date: '2026-09-02', price: 96 }], { now }), null);
  assert.equal(prepareSentimentPriceEvidence(news, [{ date: '2026-09-22', price: 100 }, { date: '2026-09-23', price: 0 }], { now }), null);
  assert.equal(prepareSentimentPriceEvidence(news, [{ date: '2026-09-22', price: Infinity }, { date: '2026-09-23', price: 96 }], { now }), null);
});

test('input incompleto → non valido, mai un numero inventato', () => {
  assert.equal(divergenzaSentimentPrezzo({}).valido, false);
  assert.equal(divergenzaSentimentPrezzo({ sentiment: sent(0.4) }).valido, false, 'manca la variazione di prezzo');
  assert.equal(divergenzaSentimentPrezzo({ sentiment: sent(0.4), variazionePrezzo: 0.02 }).valido, false, 'manca la finestra: non si può confrontare senza sapere su quanti giorni');
  assert.equal(divergenzaSentimentPrezzo({ sentiment: sent(0.4), variazionePrezzo: 0.02, finestraGiorni: 0 }).valido, false);
});

test('sentiment positivo + prezzo in salita → coerente, non una divergenza', () => {
  const r = divergenzaSentimentPrezzo({ sentiment: sent(0.4), variazionePrezzo: 0.03, finestraGiorni: 5 });
  assert.equal(r.valido, true);
  assert.equal(r.tipo, 'coerente');
  assert.equal(r.divergente, false);
});

test('sentiment positivo ma prezzo in CALO → divergenza reale, rilevata', () => {
  const r = divergenzaSentimentPrezzo({ sentiment: sent(0.4), variazionePrezzo: -0.03, finestraGiorni: 5 });
  assert.equal(r.tipo, 'sentiment-positivo-prezzo-giu');
  assert.equal(r.divergente, true);
  assert.match(r.testo, /sa qualcosa che le notizie non dicono|in ritardo/);
});

test('sentiment negativo ma prezzo in salita → divergenza reale, rilevata', () => {
  const r = divergenzaSentimentPrezzo({ sentiment: sent(-0.5), variazionePrezzo: 0.04, finestraGiorni: 3 });
  assert.equal(r.tipo, 'sentiment-negativo-prezzo-su');
  assert.equal(r.divergente, true);
});

test('sentiment forte ma prezzo FERMO (sotto la soglia di rumore) → divergenza "prezzo-fermo", non "coerente"', () => {
  const su = divergenzaSentimentPrezzo({ sentiment: sent(0.5), variazionePrezzo: 0.002, finestraGiorni: 5 });
  assert.equal(su.tipo, 'sentiment-positivo-prezzo-fermo');
  const giu = divergenzaSentimentPrezzo({ sentiment: sent(-0.5), variazionePrezzo: -0.002, finestraGiorni: 5 });
  assert.equal(giu.tipo, 'sentiment-negativo-prezzo-fermo');
});

test('sentiment neutro + prezzo qualunque → sempre coerente (niente da confrontare)', () => {
  const r1 = divergenzaSentimentPrezzo({ sentiment: sent(0.05), variazionePrezzo: 0.08, finestraGiorni: 5 });
  assert.equal(r1.tipo, 'coerente');
  const r2 = divergenzaSentimentPrezzo({ sentiment: sent(0.05), variazionePrezzo: -0.08, finestraGiorni: 5 });
  assert.equal(r2.tipo, 'coerente');
});

test('la confidenza della divergenza non supera MAI quella del sentiment che la alimenta (è un\'affermazione composta)', () => {
  const bassa = divergenzaSentimentPrezzo({ sentiment: sent(0.4, 2, { confidence: 0.3 }), variazionePrezzo: -0.03, finestraGiorni: 5 });
  const alta = divergenzaSentimentPrezzo({ sentiment: sent(0.4, 10, { confidence: 0.7 }), variazionePrezzo: -0.03, finestraGiorni: 5 });
  assert.ok(bassa.confidence < alta.confidence);
  assert.ok(bassa.confidence <= 0.3);
  assert.ok(alta.confidence <= 0.7);
});

test('dichiara quando il sentiment sottostante è (in parte) on-device, mai nascosto', () => {
  const r = divergenzaSentimentPrezzo({ sentiment: sent(0.4, 3, { onDevice: true }), variazionePrezzo: -0.03, finestraGiorni: 5 });
  assert.match(r.testo, /on-device/);
});

test('mai una previsione sulla direzione futura — coerente con il resto del progetto (vedi notizie.js: reazioneAllaFed)', () => {
  const r = divergenzaSentimentPrezzo({ sentiment: sent(0.4), variazionePrezzo: -0.03, finestraGiorni: 5 });
  assert.match(r.avvertenza, /non quale dei due avrà ragione/);
  assert.ok(!/salira|scendera|si chiudera|tornera/i.test(r.testo + r.avvertenza));
});
