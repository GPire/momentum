// ============================================================
// IL MODELLO STATICO DI MOMENTUM — sempre lì, senza scaricare niente
// ============================================================
// Cosa è, con onestà. Questo NON è Model2Vec vero (che distilla l'INTERO
// vocabolario di un tokenizer, così ogni parola qualunque si ricompone da
// sottoparole). Questo è più piccolo e più mirato: una tabella statica delle
// 686 parole che appaiono davvero nel dominio di Momentum (le formulazioni
// canoniche del QA, le famiglie di mercato, i termini del glossario
// finanziario bloccato, in 6 lingue) — vedi la provenienza esatta in
// `momentum-embed-static-data.js`. Copre esattamente ciò che serve al
// pianificatore e al confine del rifiuto, non testo qualunque.
//
// Il guadagno reale: NESSUN download (113MB di embed-models.js diventano
// opzionali, non necessari per il primo instradamento), NESSUN modello da
// caricare, NESSUN backend WASM/WebGPU da scegliere — un lookup e una media,
// millisecondi anche su un dispositivo modesto. Il prezzo: parole mai viste
// nel banco di Momentum non hanno un vettore — `vettoreFrase` lo dichiara
// (copertura < 1), non lo nasconde con un numero a caso.
//
// ── IL CONFINE, MISURATO — non un'ipotesi ──
// Provato dal vivo (2026-08-21): il coseno fra il vettore REALE di una frase
// intera (il modello vero, con attenzione fra le parole) e la media
// bag-of-words di questo file, sulla STESSA frase, vale 0,90-0,92 su cinque
// domande del banco canonico. Non è alto quanto sembra: è lo STESSO ordine
// di grandezza del rumore di fondo già documentato in `spazio-momentum.js`
// (frasi SCORRELATE, nel modello grezzo non corretto, stanno già a 0,90-0,96).
// Quindi: NON sostituisce il vettore reale, e NON va mescolato nella stessa
// cache/confronto di `semantic-embed.js` — la soglia calibrata lì è tarata
// su vettori di frase reali, e un confronto statico-contro-reale userebbe
// quella soglia fuori dal dominio per cui è stata misurata (il tipo di
// degrado silenzioso, senza errore, che questo progetto esiste per evitare).
// Cosa RESTA vero e utile: il confronto STATICO-CONTRO-STATICO (le funzioni
// qui sotto, fra loro) conserva il segnale — vedi i test "IL SEGNALE", dove
// "perdere" sta più vicino a "perdita" che a "stipendio", anche fra lingue.
// Il posto giusto è quindi un comparatore rapido a parte (es. nel
// pianificatore del Cantiere A: un pre-filtro "sembra la stessa famiglia di
// domanda?" prima di scomodare il modello pesante), non un sostituto
// silenzioso dentro `embed()`.
'use strict';

import { SCALA, DIM, PAROLE, DATI_B64 } from './momentum-embed-static-data.js';

// Decodifica UNA SOLA VOLTA al caricamento del modulo: base64 → bytes →
// Int16Array → vista per parola. atob esiste nel browser; in Node (test)
// serve il fallback Buffer.
function decodificaBase64(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

const BYTES = decodificaBase64(DATI_B64);
const TUTTI_I_VETTORI = new Int16Array(BYTES.buffer, BYTES.byteOffset, BYTES.byteLength / 2);

const INDICE = new Map();
PAROLE.forEach((parola, i) => INDICE.set(parola, i));

// Confine di parola con accenti — stesso principio di i18n/glossario-
// finanziario.js (paroleDi): "renderà" non deve confondersi con "rendimento".
const RE_PAROLA = /[a-zà-ÿ]+/gi;
function paroleDi(testo) {
  return (String(testo || '').toLowerCase().match(RE_PAROLA)) || [];
}

// Il vettore dequantizzato di UNA parola esatta del vocabolario, o null se
// non c'è. Float32Array di lunghezza DIM, norma L2 = 1.0 (verificato in test).
export function vettoreParola(parola) {
  const i = INDICE.get(String(parola || '').toLowerCase());
  if (i === undefined) return null;
  const out = new Float32Array(DIM);
  const base = i * DIM;
  for (let d = 0; d < DIM; d++) out[d] = TUTTI_I_VETTORI[base + d] / SCALA;
  return out;
}

// Quante parole del testo sono nel vocabolario coperto, come frazione. Serve
// a chi chiama per decidere se questo basta o se serve il modello vero.
export function coperturaVocabolario(testo) {
  const parole = paroleDi(testo);
  if (!parole.length) return 0;
  const trovate = parole.filter((p) => INDICE.has(p)).length;
  return trovate / parole.length;
}

// Il vettore di una frase: media delle parole del vocabolario che contiene,
// poi normalizzato L2. null se NESSUNA parola è coperta — mai un vettore
// fatto di zeri spacciato per un significato.
export function vettoreFrase(testo) {
  const parole = paroleDi(testo);
  let n = 0;
  const somma = new Float64Array(DIM);
  for (const parola of parole) {
    const i = INDICE.get(parola);
    if (i === undefined) continue;
    const base = i * DIM;
    for (let d = 0; d < DIM; d++) somma[d] += TUTTI_I_VETTORI[base + d] / SCALA;
    n++;
  }
  if (!n) return null;
  let normaQuadra = 0;
  for (let d = 0; d < DIM; d++) { somma[d] /= n; normaQuadra += somma[d] * somma[d]; }
  const norma = Math.sqrt(normaQuadra);
  if (!(norma > 0)) return null;
  const out = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) out[d] = somma[d] / norma;
  return out;
}

export function dimensioni() { return DIM; }
export function numeroParole() { return PAROLE.length; }
export function vocabolarioCoperto() { return PAROLE.slice(); }
