// ============================================================
// REGIME STRUTTURALE — quando cambia il MODO in cui i settori si muovono
// insieme, non solo QUANTO
// ============================================================
// macro-regime.js/market-stress.js/global-stress.js leggono il regime da
// indicatori macro o da soglie su volatilità/correlazione MEDIA. Qui la lente
// è un'altra — la stessa usata in ambito istituzionale per il regime
// detection strutturale (Bloomberg MAC3: proiezione della distanza fra
// matrici di correlazione cross-asset; ricerca Macrosynergy 2024-2026 sulla
// stessa idea): non "quanto sono alte le correlazioni oggi" ma "quanto la
// MATRICE INTERA delle correlazioni fra i nove settori è cambiata rispetto a
// prima" — un numero medio nasconde quali coppie si sono avvicinate e quali
// no; la matrice intera no.
//
// METODO: finestra scorrevole di N mesi → matrice di correlazione 9×9 per
// ogni finestra (matriceCorrelazione, panoramica-incrociata.js) → distanza di
// FROBENIUS fra matrici consecutive (radice della somma dei quadrati delle
// differenze entrata per entrata: quanto la struttura è cambiata da un mese
// al successivo) → soglia statistica (media + 2 deviazioni standard DELLA
// SERIE STESSA, non un numero scelto a occhio) per dire quali salti sono
// anomali. Per la mappa visiva, le stesse matrici — campionate a passo più
// largo — proiettate in 2D con MDS classica (Torgerson 1952, via
// autovaloriEVettoriSimmetrica).
//
// PERCHÉ CAMPIONARE PER LA MAPPA: `autovaloriEVettoriSimmetrica` usa Jacobi,
// scritto e verificato per "poche decine di righe" (commento originale in
// panoramica-incrociata.js) — con le 330 finestre mensili del pannello la
// matrice di distanze sarebbe 330×330, fuori dallo scopo testato e
// dall'ordine di iterazioni ragionevole. Si campiona un punto ogni `passo`
// mesi (default 12: un punto l'anno) — la mappa perde risoluzione mensile ma
// resta dentro la matematica verificata, e lo si dichiara sempre.
//
// ONESTÀ SUI LIMITI: una finestra di N mesi è uno SGUARDO ALL'INDIETRO — un
// cambio di regime si vede solo dopo che è iniziato, mai in anticipo (nessuna
// predizione qui, solo descrizione misurata di ciò che è già successo).
//
// VERIFICATO SUI DATI VERI (non solo teoria): con finestra a 24 mesi
// (default) i cambi rilevati si addensano attorno a 2008 (crisi 2008-01→10),
// dic-2018 e mar-2022 — episodi noti — ma il crollo COVID di marzo 2020 NON
// emerge sopra soglia. Con finestra a 12 mesi emerge (2020-02), insieme però
// a più falsi segnali sparsi. Non è un bug: una finestra lunga è sensibile
// alla deriva STRUTTURALE graduale, una corta a lo SHOCK isolato — sono due
// domande diverse, e questo modulo risponde a quella lunga per default.
// Funzioni PURE.
'use strict';

import { PANNELLO_SETTORI, DATE_PANNELLO } from './historical-panel.js';
import { matriceCorrelazione, autovaloriEVettoriSimmetrica } from './panoramica-incrociata.js';

const [ANNO0, MESE0] = DATE_PANNELLO[0].split('-').map(Number);
export function dataDiIndiceMese(i) {
  const totale = (MESE0 - 1) + i;
  const anno = ANNO0 + Math.floor(totale / 12);
  const mese = (totale % 12) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

// Due anni: abbastanza mesi per una correlazione a 9 serie non troppo
// rumorosa, abbastanza corta da vedere i regimi muoversi entro l'orizzonte
// del pannello (330 mesi).
export const LARGHEZZA_DEFAULT = 24;

// Matrici di correlazione a finestra scorrevole, una per ogni mese in cui la
// finestra è piena.
export function finestreCorrelazione(pannello = PANNELLO_SETTORI, larghezza = LARGHEZZA_DEFAULT) {
  const nMesi = Math.min(...pannello.map((s) => s.r.length));
  const out = [];
  for (let fine = larghezza - 1; fine < nMesi; fine++) {
    const serie = pannello.map((s) => s.r.slice(fine - larghezza + 1, fine + 1));
    out.push({ fine, mese: dataDiIndiceMese(fine), matrice: matriceCorrelazione(serie) });
  }
  return out;
}

// Distanza di Frobenius fra due matrici di correlazione: radice della somma
// dei quadrati delle differenze, sul solo triangolo superiore (la matrice è
// simmetrica con 1 fissi in diagonale — includerla non cambierebbe il
// confronto fra distanze, è solo peso in più da portarsi dietro).
export function distanzaFrobenius(m1, m2) {
  const n = m1.length;
  let somma = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) somma += (m1[i][j] - m2[i][j]) ** 2;
  return Math.sqrt(somma);
}

// La serie delle distanze fra finestre CONSECUTIVE: quanto la struttura è
// cambiata da un mese al successivo. Mai fra finestre lontane — essendo
// scorrevoli si sovrappongono già molto, il confronto che dice qualcosa è al
// passo più piccolo.
export function serieDistanzeStrutturali(finestre) {
  const out = [];
  for (let i = 1; i < finestre.length; i++) {
    out.push({ fine: finestre[i].fine, mese: finestre[i].mese, distanza: distanzaFrobenius(finestre[i - 1].matrice, finestre[i].matrice) });
  }
  return out;
}

const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const scarto = (a) => { const m = media(a); return Math.sqrt(media(a.map((x) => (x - m) ** 2))); };

// SOGLIA statistica: media + k deviazioni standard DELLA SERIE STESSA — non
// un valore assoluto (la scala di Frobenius cresce con il numero di asset, un
// numero fisso non varrebbe per un pannello diverso da 9 settori) e non
// scelto a occhio. k=2 lascia fuori circa il 2,5% dei mesi più estremi sotto
// approssimazione gaussiana — stesso principio di controllo statistico già
// usato altrove nel progetto (contribution-drift.js, il k del CUSUM).
export const K_SOGLIA = 2;
export const MIN_FINESTRE = 6;

export function rilevaCambiRegime(pannello = PANNELLO_SETTORI, { larghezza = LARGHEZZA_DEFAULT, kSoglia = K_SOGLIA } = {}) {
  const finestre = finestreCorrelazione(pannello, larghezza);
  if (finestre.length < MIN_FINESTRE) {
    return { disponibile: false, motivo: `Servono almeno ${MIN_FINESTRE} finestre di ${larghezza} mesi per parlare di cambi di regime: qui ce ne sono ${finestre.length}.` };
  }
  const distanze = serieDistanzeStrutturali(finestre);
  const valori = distanze.map((d) => d.distanza);
  const m = media(valori), s = scarto(valori);
  const soglia = m + kSoglia * s;
  // STRETTO, non >=: con una serie perfettamente stabile (deviazione zero) la
  // soglia coincide con zero, e un confronto >= segnalerebbe OGNI finestra
  // come "cambio" — trovato scrivendo il test con nove serie identiche fra
  // loro, dove nulla cambia mai per costruzione.
  const cambi = distanze.filter((d) => d.distanza > soglia);
  return {
    disponibile: true,
    larghezza,
    finestre: finestre.length,
    distanzaMedia: +m.toFixed(4),
    distanzaDeviazione: +s.toFixed(4),
    soglia: +soglia.toFixed(4),
    cambi: cambi.map((c) => ({ mese: c.mese, distanza: +c.distanza.toFixed(4) })),
    serie: distanze,
  };
}

// Doppio centraggio (Torgerson): trasforma una matrice di distanze al
// quadrato in una matrice di prodotti scalari B, il passo che rende possibile
// un'eigendecomposizione al posto di dover conoscere le coordinate originali.
function centraDoppio(D) {
  const n = D.length;
  const D2 = D.map((row) => row.map((d) => d * d));
  const mediaRiga = D2.map((row) => media(row));
  const mediaTotale = media(mediaRiga);
  return D2.map((row, i) => row.map((d2, j) => -0.5 * (d2 - mediaRiga[i] - mediaRiga[j] + mediaTotale)));
}

// MDS classica (Torgerson 1952): proietta punti di cui si conosce SOLO la
// distanza a coppie (qui: Frobenius fra matrici di correlazione) su un piano
// 2D che preserva quelle distanze il più possibile — stessa idea di una PCA,
// ma partendo da distanze invece che da coordinate originali. Le prime due
// componenti (autovalori più grandi di B) danno gli assi che spiegano di più
// della variazione strutturale osservata.
export function mds2D(matriciDistanza) {
  const n = matriciDistanza.length;
  if (n < 3) return matriciDistanza.map(() => ({ x: 0, y: 0 }));
  const B = centraDoppio(matriciDistanza);
  const { valori, vettori } = autovaloriEVettoriSimmetrica(B, { iterazioni: 500 });
  const l1 = Math.max(0, valori[0] || 0), l2 = Math.max(0, valori[1] || 0);
  const v1 = vettori[0] || new Array(n).fill(0), v2 = vettori[1] || new Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => ({ x: +(v1[i] * Math.sqrt(l1)).toFixed(4), y: +(v2[i] * Math.sqrt(l2)).toFixed(4) }));
}

export const PASSO_MAPPA_DEFAULT = 12; // un punto l'anno
export const MIN_PUNTI_MAPPA = 4;

// La mappa visiva: un punto per ogni finestra campionata, posizionato in modo
// che due punti vicini abbiano avuto una struttura di correlazione simile e
// due punti lontani una struttura diversa. Serve a VEDERE i regimi come
// "zone" della mappa invece che leggere una lista di numeri.
export function mappaRegimi(pannello = PANNELLO_SETTORI, { larghezza = LARGHEZZA_DEFAULT, passo = PASSO_MAPPA_DEFAULT } = {}) {
  const finestre = finestreCorrelazione(pannello, larghezza);
  const campionate = finestre.filter((_, i) => i % passo === 0);
  if (campionate.length < MIN_PUNTI_MAPPA) {
    return { disponibile: false, motivo: `Servono almeno ${MIN_PUNTI_MAPPA} punti campionati ogni ${passo} mesi per una mappa: qui ce ne sono ${campionate.length}.` };
  }
  const n = campionate.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distanzaFrobenius(campionate[i].matrice, campionate[j].matrice);
      D[i][j] = d; D[j][i] = d;
    }
  }
  const coords = mds2D(D);
  return {
    disponibile: true,
    risoluzioneMesi: passo,
    punti: campionate.map((f, i) => ({ mese: f.mese, x: coords[i].x, y: coords[i].y })),
  };
}

// Spiegazione in italiano, con i numeri veri — mai un giudizio su cosa fare,
// solo la descrizione misurata di cosa è cambiato.
export function testoRegimeStrutturale(risultato) {
  if (!risultato?.disponibile) return risultato?.motivo || 'Dati insufficienti per parlare di regime strutturale.';
  const { cambi, finestre, larghezza, distanzaMedia, distanzaDeviazione } = risultato;
  if (!cambi.length) {
    return `Negli ultimi ${finestre} mesi osservati (finestre di ${larghezza} mesi) la struttura di correlazione fra i nove settori non ha mai fatto un salto anomalo da un mese al successivo: la distanza è rimasta entro la sua variazione normale (media ${distanzaMedia}, deviazione ${distanzaDeviazione}).`;
  }
  const ultimo = cambi[cambi.length - 1];
  const testoUltimo = cambi.length === 1 ? `un solo cambio, a ${ultimo.mese}` : `${cambi.length} cambi, l'ultimo a ${ultimo.mese}`;
  return `${testoUltimo} (distanza ${ultimo.distanza} contro una media di ${distanzaMedia}): il MODO in cui i nove settori si muovono insieme è cambiato in modo statisticamente anomalo. Non dice in che direzione va il mercato — dice solo che la struttura è diversa da prima, e serve incrociarlo con macro-regime.js/market-stress.js per capire perché.`;
}
