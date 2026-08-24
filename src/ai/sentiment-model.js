// ============================================================
// IL REGISTRO DEI MODELLI DI SENTIMENT — stesso pattern di embed-models.js
// ============================================================
// "Comunica con il resto in modo architetturale, non un pezzo isolato":
// questo file esiste apposta perché embed-models.js ha già risolto lo
// stesso problema (identificativo/quantizzazione/licenza di un modello
// ONNX scelti a mano una volta, mai riscritti dentro il codice che li usa)
// — riusare la STESSA forma invece di inventarne una nuova per un compito
// diverso è la parte "architetturale" della richiesta, non un dettaglio.
//
// ── PERCHÉ NON "TinyFinBERT" NEL SENSO STRETTO DEL NOME ──
// L'utente ha nominato TinyFinBERT esplicitamente (il modello del paper
// arXiv:2409.18999, distillato da FinBERT: 4 layer, hidden 312, 14,5M
// parametri). Verificato dal vivo (2026-08-24, Hugging Face Hub API,
// `/api/models?search=tinyfinbert`): ZERO repository pubblicano quei pesi.
// È un modello di un paper accademico senza checkpoint pubblico — non
// scaricabile, non convertibile in ONNX senza rifare il training da zero
// (nessuna toolchain GPU disponibile in questo ambiente, e comunque non è
// onesto spacciare un modello mai validato indipendentemente per uno
// citato in letteratura). Dichiarato invece di far finta.
//
// ── COSA SI USA DAVVERO, e perché è la scelta onesta più vicina ──
// `Xenova/distilroberta-finetuned-financial-news-sentiment-analysis`:
// conversione ONNX (pronta per transformers.js, nessuna conversione fatta
// da noi) di `mrm8488/distilroberta-finetuned-financial-news-sentiment-
// analysis` — DistilRoBERTa (6 layer, distillato, non il BERT-base a 12
// layer) addestrato specificamente su TITOLI di notizie finanziarie (non
// solo il linguaggio da analista del Financial PhraseBank): è esattamente
// il tipo di testo che questo modulo classifica (titoli, non articoli
// interi). Apache-2.0, nessuna clausola gated, verificato sulla model card
// e sui file reali (Hugging Face Hub API) il 2026-08-24: 82,5MB in int8,
// 82M parametri — più piccolo del FinBERT "canonico" (110MB/110M,
// registrato sotto come alternativa) e comunque un ordine di grandezza
// sopra i 14,5M di TinyFinBERT: la parte "tiny" del nome non è raggiunta,
// dichiarato esplicitamente, non nascosto dietro un nome comodo.
//
// ── LA SECONDA VOCE, per chi vuole il modello più citato in letteratura ──
// `Xenova/finbert`: conversione ONNX di ProsusAI/finbert, il riferimento
// più citato nella ricerca sul sentiment finanziario (pre-addestrato su
// 1,8M articoli Reuters, affinato sul Financial PhraseBank). Più pesante
// (110MB int8) e pensato per frasi in stile analista più che titoli di
// cronaca — non la scelta predefinita per QUESTO compito, ma la si tiene
// registrata (stesso motivo di qwen3-embedding-0.6b in embed-models.js:
// un gradino sopra, non un'alternativa equivalente).
'use strict';

export const MODELLI_SENTIMENT = {
  'distilroberta-financial-news': {
    id: 'Xenova/distilroberta-finetuned-financial-news-sentiment-analysis',
    dtype: 'q8',
    // Stessa scelta di backend di e5-small in embed-models.js, per lo
    // stesso motivo dichiarato lì: la quantizzazione int8 è la via
    // ottimizzata di WASM, non quella delle shader WebGPU nella libreria
    // transformers.js oggi. Non ri-misurato in modo indipendente su QUESTO
    // modello (stessa famiglia di architettura, stessa libreria — ma la
    // misura originale è di e5-small, non di questo): se una sessione
    // futura misura WebGPU più veloce qui, va corretto con un numero in
    // mano, non a occhio.
    backend: 'wasm',
    licenza: 'Apache-2.0',
    licenzaPermissiva: true,
    parametri: '82M (DistilRoBERTa, 6 layer)',
    pesoStimato: '82,5MB (int8)',
    // Ordine delle etichette dichiarato dal model config (id2label), non
    // assunto: negative=0, neutral=1, positive=2.
    etichette: ['negative', 'neutral', 'positive'],
    fonte: 'mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis — Financial PhraseBank + titoli di notizie finanziarie reali',
  },
  'finbert': {
    id: 'Xenova/finbert',
    dtype: 'q8',
    backend: 'wasm',
    licenza: 'nessuna licenza esplicita dichiarata da ProsusAI/finbert (uso di ricerca/pratica comune, non un permesso scritto come Apache/MIT)',
    licenzaPermissiva: false,
    parametri: '110M (BERT-base, 12 layer)',
    pesoStimato: '110,7MB (int8)',
    etichette: ['positive', 'negative', 'neutral'],
    fonte: 'ProsusAI/finbert — Reuters TRC2 (pre-training) + Financial PhraseBank (fine-tuning), il riferimento più citato in letteratura',
  },
};

export const MODELLO_SENTIMENT_PREDEFINITO = 'distilroberta-financial-news';

let SCELTO = MODELLO_SENTIMENT_PREDEFINITO;
export function scegliModelloSentiment(chiave) {
  if (MODELLI_SENTIMENT[chiave]) SCELTO = chiave;
}
export function modelloSentimentAttivo() {
  return MODELLI_SENTIMENT[SCELTO];
}
