import test from 'node:test';
import assert from 'node:assert/strict';
import {
  punteggioDaEtichette, classificaSentiment, arricchisciConSentimentLocale, sentimentModelPronto,
} from './local-sentiment.js';

// ── La matematica pura, senza rete/modello ──

test('punteggioDaEtichette: P(positive) - P(negative), qualunque sia l\'ordine delle etichette', () => {
  const s = punteggioDaEtichette([
    { label: 'neutral', score: 0.1 }, { label: 'positive', score: 0.8 }, { label: 'negative', score: 0.1 },
  ]);
  assert.ok(Math.abs(s - 0.7) < 1e-9);
});

test('punteggioDaEtichette: robusta a maiuscole, ordine mancante, input vuoto', () => {
  assert.equal(punteggioDaEtichette([{ label: 'POSITIVE', score: 0.6 }, { label: 'NEGATIVE', score: 0.4 }]), 0.19999999999999996);
  assert.equal(punteggioDaEtichette([]), 0);
  assert.equal(punteggioDaEtichette(null), 0);
  assert.equal(punteggioDaEtichette([{ label: 'neutral', score: 1 }]), 0, 'solo neutro: nessun segnale, punteggio zero');
});

test('sentimentModelPronto: false finché nessuna chiamata reale ha toccato il modello', () => {
  // Questo modulo non ha ancora invocato getPipeline() in questo processo
  // (i test sopra/sotto usano tutti `classify` iniettato): deve restare
  // false, mai promettere un modello caricato che non è mai partito.
  assert.equal(sentimentModelPronto(), false);
});

// ── classificaSentiment con un classificatore FINTO iniettato ──
// Stesso schema di `fetchImpl` altrove nel progetto: verifica la logica
// (mappatura, cache, onestà sui fallimenti) senza scaricare 82MB di
// modello ONNX reale a ogni run della suite. Il modello vero si verifica
// dal vivo in Chrome, come ogni altro modulo con una rete dentro.

test('classificaSentiment: testo vuoto → null, mai una chiamata al classificatore', async () => {
  let chiamato = false;
  const finto = async () => { chiamato = true; return [{ label: 'positive', score: 1 }]; };
  assert.equal(await classificaSentiment('', { classify: finto }), null);
  assert.equal(await classificaSentiment('   ', { classify: finto }), null);
  assert.equal(await classificaSentiment(null, { classify: finto }), null);
  assert.equal(chiamato, false);
});

test('classificaSentiment: titolo chiaramente positivo → score positivo ed etichetta coerente', async () => {
  const finto = async () => [
    { label: 'positive', score: 0.91 }, { label: 'neutral', score: 0.07 }, { label: 'negative', score: 0.02 },
  ];
  const testoUnico = `Utili trimestrali record, oltre le attese degli analisti ${Date.now()}`;
  const r = await classificaSentiment(testoUnico, { classify: finto });
  assert.ok(r.score > 0.35, `score troppo basso per essere bullish: ${r.score}`);
  assert.equal(r.label, 'bullish'); // stessa soglia di src/alpha/news.js
  assert.ok(Array.isArray(r.grezzo) && r.grezzo.length === 3);
});

test('classificaSentiment: titolo chiaramente negativo → score negativo', async () => {
  const finto = async () => [
    { label: 'negative', score: 0.88 }, { label: 'neutral', score: 0.09 }, { label: 'positive', score: 0.03 },
  ];
  const testoUnico = `Crollo delle vendite, taglio delle stime per l'intero anno ${Date.now()}`;
  const r = await classificaSentiment(testoUnico, { classify: finto });
  assert.ok(r.score < -0.35, `score troppo alto per essere bearish: ${r.score}`);
  assert.equal(r.label, 'bearish');
});

test('classificaSentiment: se il classificatore fallisce, null — mai un punteggio inventato', async () => {
  const finto = async () => { throw new Error('modello non caricato'); };
  const testoUnico = `Testo che farà fallire il classificatore ${Date.now()}`;
  assert.equal(await classificaSentiment(testoUnico, { classify: finto }), null);
});

test('classificaSentiment: stesso testo → risposta dalla cache, il classificatore non viene richiamato', async () => {
  let chiamate = 0;
  const finto = async () => { chiamate++; return [{ label: 'neutral', score: 1 }]; };
  const testoUnico = `Titolo neutro da mettere in cache ${Date.now()}`;
  const a = await classificaSentiment(testoUnico, { classify: finto });
  const b = await classificaSentiment(testoUnico, { classify: finto });
  assert.equal(chiamate, 1, 'la seconda chiamata doveva venire dalla cache');
  assert.deepEqual(a, b);
});

// ── arricchisciConSentimentLocale: dove si aggancia al resto del progetto ──

test('arricchisciConSentimentLocale: MAI sovrascrive un punteggio reale già presente (Alpha Vantage vince sempre)', async () => {
  let chiamate = 0;
  const finto = async () => { chiamate++; return [{ label: 'positive', score: 1 }]; };
  const items = [
    { title: 'Notizia con score Alpha Vantage vero', sentimentScore: -0.6, sentimentLabel: 'bearish' },
  ];
  const out = await arricchisciConSentimentLocale(items, { classify: finto });
  assert.equal(out[0].sentimentScore, -0.6, 'il punteggio reale non deve essere toccato');
  assert.equal(out[0].sentimentSource, undefined, 'nessuna etichetta on-device su un punteggio che non è on-device');
  assert.equal(chiamate, 0);
});

test('arricchisciConSentimentLocale: riempie SOLO le voci con sentimentScore null (Finnhub/HN/RSS ufficiali)', async () => {
  const finto = async (testo) => (testo.includes('POSITIVA')
    ? [{ label: 'positive', score: 0.9 }, { label: 'neutral', score: 0.08 }, { label: 'negative', score: 0.02 }]
    : [{ label: 'negative', score: 0.85 }, { label: 'neutral', score: 0.1 }, { label: 'positive', score: 0.05 }]);
  const items = [
    { title: `Notizia POSITIVA senza sentiment da nessuna fonte a pagamento ${Date.now()}`, sentimentScore: null, sentimentLabel: 'sconosciuto' },
    { title: `Notizia negativa da Hacker News, mai valutata prima ${Date.now()}`, sentimentScore: null, sentimentLabel: 'sconosciuto' },
  ];
  const out = await arricchisciConSentimentLocale(items, { classify: finto });
  assert.ok(out[0].sentimentScore > 0);
  assert.equal(out[0].sentimentSource, 'on-device');
  assert.ok(out[1].sentimentScore < 0);
  assert.equal(out[1].sentimentSource, 'on-device');
});

test('arricchisciConSentimentLocale: rispetta il limite — non classifica più di `limite` voci per chiamata', async () => {
  let chiamate = 0;
  const finto = async () => { chiamate++; return [{ label: 'neutral', score: 1 }]; };
  const items = Array.from({ length: 10 }, (_, i) => ({ title: `Voce numero ${i} ${Date.now()}`, sentimentScore: null }));
  await arricchisciConSentimentLocale(items, { classify: finto, limite: 3 });
  assert.equal(chiamate, 3);
});

test('arricchisciConSentimentLocale: una voce senza titolo né riassunto viene saltata, mai un crash', async () => {
  const finto = async () => [{ label: 'neutral', score: 1 }];
  const items = [{ title: null, summary: null, sentimentScore: null }];
  const out = await arricchisciConSentimentLocale(items, { classify: finto });
  assert.equal(out[0].sentimentScore, null);
});

test('arricchisciConSentimentLocale: input vuoto/non valido → nessun crash', async () => {
  assert.deepEqual(await arricchisciConSentimentLocale([]), []);
  assert.deepEqual(await arricchisciConSentimentLocale(null), []);
});
