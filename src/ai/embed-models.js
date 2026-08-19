// ============================================================
// IL REGISTRO DEI MODELLI DI EMBEDDING — e perché serviva
// ============================================================
// `semantic-embed.js` aveva il modello scritto DENTRO: l'identificativo, la
// quantizzazione, e — il dettaglio che conta piu' di tutti — il prefisso da
// mettere davanti al testo e il modo di ridurre l'uscita a un vettore. Con
// quella forma, cambiare modello significa riscrivere il file, e cambiarlo
// **e' diventato necessario per un motivo che non e' tecnico**.
//
// ── IL PROBLEMA DI LICENZA, ed e' concreto ──
// EmbeddingGemma non e' Apache 2.0. Vive sotto i "Gemma Terms of Use", che
// non sono una licenza approvata OSI: Google si riserva di **limitare l'uso da
// remoto** se ritiene violate le proprie policy, e chi ridistribuisce il
// modello deve propagare le stesse restrizioni a valle. Per un progetto che
// promette all'utente di funzionare offline e per sempre sul suo dispositivo,
// dipendere da un permesso revocabile e' una contraddizione — e per un
// prodotto commerciale e' un rischio da mettere per iscritto, non da scoprire
// dopo.
// Quindi il modello va potuto sostituire in una riga, e la licenza va scritta
// ACCANTO al modello, dove si legge, invece di stare in un documento a parte
// che nessuno riapre.
//
// ── I TRE DETTAGLI CHE NON SI POSSONO IGNORARE CAMBIANDO MODELLO ──
// Non basta scambiare un identificativo: due modelli di embedding con la
// stessa interfaccia si usano in modo diverso, e sbagliare uno dei tre
// degrada la qualita' in silenzio (nessun errore, solo risposte peggiori —
// il tipo di guasto piu' difficile da accorgersene).
//
// 1. IL PREFISSO. Alcuni modelli sono addestrati con un'istruzione davanti al
//    testo e senza di essa perdono parecchio: la famiglia E5 vuole "query:",
//    EmbeddingGemma vuole la sua riga di compito, BGE-M3 non vuole niente.
//    Qui il prefisso e' un dato del modello, non una costante globale.
// 2. LA RIDUZIONE A VETTORE. EmbeddingGemma restituisce direttamente il
//    vettore della frase; altri modelli restituiscono un vettore per ogni
//    token e la riduzione la deve fare chi chiama — media su tutti i token
//    (E5), primo token (BGE-M3), ultimo token (famiglia Qwen). Applicare la
//    media a un modello addestrato sul primo token produce vettori che
//    "funzionano" e confrontano male.
// 3. LA MASCHERA DI ATTENZIONE. Nella media vanno contati solo i token veri:
//    includere il riempimento sposta il vettore verso il nulla, e piu' la
//    frase e' corta piu' il danno e' grande. E qui le frasi sono corte.
//
// Funzioni PURE (la riduzione e la normalizzazione); nessuna rete.
'use strict';

// `pooling`:
//   'frase'  — il modello da' gia' il vettore della frase (nessun lavoro)
//   'media'  — media dei token, pesata dalla maschera
//   'primo'  — il primo token (CLS)
//   'ultimo' — l'ultimo token vero (non il riempimento)
export const MODELLI = {
  // Il modello STORICO. Resta disponibile e documentato, ma non e' piu' la
  // scelta predefinita: vedi la nota di licenza sopra.
  // ── LA SCELTA PREDEFINITA (verificata sulla model card il 2026-08-18) ──
  // Licenza MIT: permissiva senza clausole, uso commerciale libero, nessun
  // permesso revocabile. Ed e' anche PIU' LEGGERO di quello che sostituisce —
  // 112,8MB in int8 contro 197MB — con 118M parametri contro 300M.
  // Il compito qui e' la similarita' fra DOMANDE BREVI, non il recupero di
  // documenti lunghi: e' esattamente cio' per cui la famiglia E5 e' forte, e
  // la dimensione in meno non e' un compromesso su questo compito.
  'e5-small': {
    id: 'Xenova/multilingual-e5-small',
    dtype: 'q8',
    // QUALE BACKEND, e non e' un dettaglio: la quantizzazione a 8 bit e'
    // pensata per WASM, e chiederla insieme a WebGPU lascia il caricamento
    // appeso senza mai fallire — trovato provandolo dal vivo, con il modello
    // fermo dopo il tokenizer su una macchina con webgpu attivo. Un
    // caricamento che non finisce e non da' errore e' peggio di uno che
    // fallisce: l'utente aspetta per sempre una funzione che non arrivera'.
    backend: 'wasm',
    // La famiglia E5 e' addestrata con questo prefisso e SENZA di esso perde
    // parecchio. Applicato in modo simmetrico ai due testi, perche' qui si
    // confrontano due domande fra loro.
    prefisso: 'query: ',
    pooling: 'media',
    licenza: 'MIT',
    licenzaPermissiva: true,
    lingue: '100',
    parametri: '118M',
    pesoStimato: '113MB (int8)',
  },

  // ── IL LIVELLO PESANTE, per i dispositivi che possono permetterselo ──
  // Apache 2.0, non gated, oltre 100 lingue, primo su piu' classifiche
  // multilingue nel 2025. Il prezzo e' il peso: 0,6B parametri e nessuna
  // variante q4 pubblicata — solo fp32/fp16/q8, cioe' circa 600MB. Tre volte
  // il modello predefinito, e su una connessione lenta e' la differenza fra
  // "si scarica" e "l'utente rinuncia".
  // Non e' quindi un'alternativa: e' un GRADINO SUPERIORE, e chi decide se
  // salirlo e' il profilo del dispositivo (device/adaptive-runtime.js), non
  // una preferenza scritta a mano.
  'qwen3-embedding-0.6b': {
    id: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
    dtype: 'q8',
    backend: 'wasm',
    // Formato di istruzione della famiglia Qwen3-Embedding. Le istruzioni si
    // scrivono in inglese anche per testi in altre lingue: e' la
    // raccomandazione degli autori, non una nostra scelta stilistica.
    prefisso: 'Instruct: Retrieve semantically similar questions\nQuery: ',
    // Ultimo token, non media: applicare la media a un modello addestrato
    // sull'ultimo token produce vettori che sembrano funzionare e confrontano
    // male.
    pooling: 'ultimo',
    licenza: 'Apache-2.0',
    licenzaPermissiva: true,
    lingue: 'oltre 100',
    parametri: '600M',
    pesoStimato: '~600MB (q8, nessun q4 pubblicato)',
  },

  // ── IL MODELLO STORICO ──
  // Resta registrato e documentato, ma NON e' piu' la scelta predefinita.
  // Non per qualita': per licenza.
  'embeddinggemma-300m': {
    id: 'onnx-community/embeddinggemma-300m-ONNX',
    dtype: 'q4',
    backend: 'auto',
    prefisso: 'task: sentence similarity | query: ',
    pooling: 'frase',
    licenza: 'Gemma Terms of Use',
    licenzaPermissiva: false,
    notaLicenza: 'Non OSI. Google puo\' limitare l\'uso da remoto; le restrizioni si propagano a chi ridistribuisce.',
    lingue: 'oltre 100',
    parametri: '300M',
    pesoStimato: '197MB (q4)',
  },
};

// Il modello in uso: quello con licenza pulita e il peso piu' basso.
export let MODELLO_PREDEFINITO = 'e5-small';

// ── IL MODELLO SI ADATTA AL DISPOSITIVO ──
// Momentum ha gia' un profilo hardware MISURATO (device/profiler.js) e un
// budget di esperti per fascia (device/adaptive-runtime.js). Il modello
// linguistico entra nello stesso schema invece di essere una costante: su un
// telefono modesto 113MB si scaricano, 600MB spesso no — e un download che
// non finisce e' una funzione che non esiste.
// Regola: si sale al livello pesante SOLO su fascia massima e con la memoria
// dichiarata dal dispositivo, mai indovinando dal nome del chip.
export const MEMORIA_MINIMA_PESANTE = 8; // GB dichiarati dal browser

export function modelloPerDispositivo(profilo = null) {
  const fascia = profilo?.tier;
  const memoria = profilo?.memory ?? 0;
  if (fascia === 'massimo' && memoria >= MEMORIA_MINIMA_PESANTE) return 'qwen3-embedding-0.6b';
  return 'e5-small';
}

// Registra un modello nuovo (o ne sostituisce uno) senza toccare il resto del
// codice. Rifiuta le licenze non permissive quando si chiede l'opposto: e' il
// controllo che impedisce di reintrodurre per distrazione il problema che
// questo file esiste per risolvere.
export function registraModello(chiave, config, { soloPermissive = false } = {}) {
  if (!chiave || !config?.id) throw new Error('Serve una chiave e un id del modello.');
  if (!['frase', 'media', 'primo', 'ultimo'].includes(config.pooling)) {
    throw new Error(`pooling sconosciuto: "${config.pooling}" (frase|media|primo|ultimo)`);
  }
  if (soloPermissive && !config.licenzaPermissiva) {
    throw new Error(`Licenza non permissiva per "${chiave}": ${config.licenza}`);
  }
  MODELLI[chiave] = { prefisso: '', ...config };
  return MODELLI[chiave];
}

export function scegliModello(chiave) {
  if (!MODELLI[chiave]) throw new Error(`Modello sconosciuto: "${chiave}" (disponibili: ${Object.keys(MODELLI).join(', ')})`);
  MODELLO_PREDEFINITO = chiave;
  return MODELLI[chiave];
}

export function modelloAttivo() { return MODELLI[MODELLO_PREDEFINITO]; }

// Elenco leggibile, con la licenza in chiaro: serve alla UI e a chi deve
// decidere cosa si puo' spedire in un prodotto.
export function elencoModelli() {
  return Object.entries(MODELLI).map(([chiave, m]) => ({
    chiave, id: m.id, parametri: m.parametri, lingue: m.lingue,
    licenza: m.licenza, permissiva: !!m.licenzaPermissiva,
    attivo: chiave === MODELLO_PREDEFINITO,
  }));
}

// ── La riduzione a un vettore singolo ──
// `tokens`: matrice [nToken][dim]. `maschera`: 1 per i token veri, 0 per il
// riempimento. Senza maschera si assume che siano tutti veri.
export function riduci(tokens, maschera = null, pooling = 'media') {
  if (!Array.isArray(tokens) || !tokens.length) return null;
  const n = tokens.length, dim = tokens[0].length;
  const m = maschera && maschera.length === n ? maschera : new Array(n).fill(1);

  if (pooling === 'primo') return Float32Array.from(tokens[0]);

  if (pooling === 'ultimo') {
    // L'ultimo token VERO, non l'ultima riga della matrice: con il riempimento
    // a destra l'ultima riga e' spesso vuota, e usarla darebbe un vettore che
    // non rappresenta niente.
    let i = n - 1;
    while (i > 0 && !m[i]) i--;
    return Float32Array.from(tokens[i]);
  }

  // Media pesata dalla maschera.
  const out = new Float32Array(dim);
  let veri = 0;
  for (let i = 0; i < n; i++) {
    if (!m[i]) continue;
    veri++;
    for (let d = 0; d < dim; d++) out[d] += tokens[i][d];
  }
  if (!veri) return null;
  for (let d = 0; d < dim; d++) out[d] /= veri;
  return out;
}

// Normalizzazione L2: dopo la riduzione il vettore non e' piu' unitario, e il
// coseno su vettori non normalizzati e' un'altra grandezza.
export function normalizza(vec) {
  if (!vec) return null;
  let somma = 0;
  for (let i = 0; i < vec.length; i++) somma += vec[i] * vec[i];
  const norma = Math.sqrt(somma);
  if (!(norma > 0)) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norma;
  return out;
}

// Il testo pronto per il modello attivo (o per quello indicato).
export function preparaTesto(testo, chiave = MODELLO_PREDEFINITO) {
  const m = MODELLI[chiave];
  if (!m) throw new Error(`Modello sconosciuto: "${chiave}"`);
  return `${m.prefisso || ''}${String(testo || '').trim()}`;
}
