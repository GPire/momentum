// ============================================================
// DIVERGENZA SENTIMENT↔PREZZO — un segnale da desk, non un altro numero
// ============================================================
// Quello che i desk istituzionali chiamano "sentiment-price divergence":
// le notizie dicono una cosa, il prezzo ne ha già fatta un'altra. Non è un
// terzo sistema: riusa SOLO cose che esistono già nel progetto —
// `aggregateNewsSentiment` (src/ai/reasoning-fusion.js, ora alimentato
// anche dal sentiment on-device, src/ai/local-sentiment.js, per chi non ha
// una chiave Alpha Vantage) e una variazione di prezzo che il chiamante
// dichiara con la sua finestra temporale — mai calcolata a occhio qui
// dentro. Complementare, non doppione, di src/alpha/cot-panel.js (che
// misura il positioning nei futures, non il testo delle notizie) e di
// src/alpha/posizionamento.js (che è critico apposta sul sentiment da
// sondaggio — questo modulo lavora su un numero diverso: NOTIZIE reali,
// non un sondaggio).
//
// ONESTÀ SUL LIMITE, dichiarata come in cosaFecceroIMercati (notizie.js):
// una divergenza dice che due segnali non concordano ADESSO, mai quale dei
// due "ha ragione" — chi dice che una divergenza si chiuderà in una
// direzione precisa sta indovinando, esattamente come per reazioneAllaFed.
'use strict';

const SOGLIA_SENTIMENT = 0.15; // stessa soglia "somewhat-*" di src/alpha/news.js
const SOGLIA_PREZZO = 0.01;    // sotto l'1% è rumore, non un movimento da leggere

export function divergenzaSentimentPrezzo({ sentiment, variazionePrezzo, finestraGiorni } = {}) {
  if (!sentiment || !Number.isFinite(sentiment.score)) {
    return { valido: false, motivo: 'serve un sentiment aggregato (aggregateNewsSentiment) con un punteggio reale' };
  }
  if (!Number.isFinite(variazionePrezzo)) {
    return { valido: false, motivo: 'serve la variazione di prezzo nella stessa finestra' };
  }
  if (!Number.isFinite(finestraGiorni) || finestraGiorni <= 0) {
    return { valido: false, motivo: 'la finestra temporale del prezzo va dichiarata — confrontare sentiment e prezzo senza sapere su quanti giorni non ha senso' };
  }

  const sentimentSu = sentiment.score >= SOGLIA_SENTIMENT;
  const sentimentGiu = sentiment.score <= -SOGLIA_SENTIMENT;
  const prezzoSu = variazionePrezzo >= SOGLIA_PREZZO;
  const prezzoGiu = variazionePrezzo <= -SOGLIA_PREZZO;

  let tipo = 'coerente';
  if (sentimentSu && prezzoGiu) tipo = 'sentiment-positivo-prezzo-giu';
  else if (sentimentGiu && prezzoSu) tipo = 'sentiment-negativo-prezzo-su';
  else if (sentimentSu && !prezzoSu && !prezzoGiu) tipo = 'sentiment-positivo-prezzo-fermo';
  else if (sentimentGiu && !prezzoSu && !prezzoGiu) tipo = 'sentiment-negativo-prezzo-fermo';
  const divergente = tipo !== 'coerente';

  // Una divergenza costruita su un sentiment poco affidabile (poche fonti,
  // in parte on-device: aggregateNewsSentiment lo dichiara già in
  // `sentiment.confidence`) è ANCORA MENO affidabile — è un'affermazione
  // COMPOSTA (sentiment E prezzo devono essere letti giusti entrambi), mai
  // più sicura della sua parte più debole. 0,85 non è una misura, è un
  // fattore di sconto dichiarato per non promettere più di quanto la somma
  // delle parti garantisca.
  const confidence = +(Math.min(0.65, sentiment.confidence * 0.85)).toFixed(3);

  const testoTipo = {
    'coerente': 'Il sentiment delle notizie e il movimento di prezzo raccontano la stessa storia.',
    'sentiment-positivo-prezzo-giu': 'Le notizie sono positive ma il prezzo è già sceso: o il mercato sa qualcosa che le notizie non dicono ancora, o le notizie sono in ritardo.',
    'sentiment-negativo-prezzo-su': 'Le notizie sono negative ma il prezzo è salito: il mercato non sembra preoccuparsene, almeno finora.',
    'sentiment-positivo-prezzo-fermo': 'Le notizie sono positive ma il prezzo non si è ancora mosso: il mercato non ha (ancora) reagito, o ha già scontato tutto prima.',
    'sentiment-negativo-prezzo-fermo': 'Le notizie sono negative ma il prezzo tiene: nessun segno che il mercato le stia prendendo sul serio, almeno per ora.',
  }[tipo];

  return {
    valido: true, tipo, divergente,
    sentimentScore: +sentiment.score.toFixed(3), variazionePrezzo: +variazionePrezzo.toFixed(4), finestraGiorni,
    confidence,
    testo: `${testoTipo} (sentiment ${sentiment.score >= 0 ? '+' : ''}${sentiment.score.toFixed(2)} su ${sentiment.n} notizie${sentiment.onDevice ? ', in parte stimate on-device' : ''}; prezzo ${variazionePrezzo >= 0 ? '+' : ''}${(variazionePrezzo * 100).toFixed(1)}% in ${finestraGiorni}g)`,
    avvertenza: 'una divergenza dice che i due segnali non concordano ADESSO, non quale dei due avrà ragione — nessuna previsione sulla direzione futura',
  };
}
