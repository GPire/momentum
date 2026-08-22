// ============================================================
// QUANTI FATTORI DI RISCHIO VERI CI SONO — Marchenko-Pastur, e cosa i dati
// dicono di NON fare con quel numero
// ============================================================
// Cantiere E1 (PIANO_TASK_2026-08-21.md). La domanda di BANCO_TRADER "le mie
// posizioni sono la stessa scommessa?" ha una risposta rigorosa nella teoria
// delle matrici casuali: su una matrice di correlazione N×N stimata da T
// osservazioni, un autovalore SOTTO il bordo di Marchenko-Pastur
// λ+ = (1+√(N/T))² non si distingue statisticamente dal rumore di
// campionamento puro — anche N serie totalmente INDIPENDENTI produrrebbero
// autovalori fino a quel livello per puro caso.
//
// MISURATO sui 9 settori × 330 mesi del pannello: un solo autovalore (5,52,
// il 61,4% della varianza — il "modo di mercato", tutti i settori che si
// muovono insieme) supera il bordo (1,36). Gli altri otto (0,99 fino a 0,11)
// stanno dentro la banda di rumore: NON distinguibili da correlazioni
// casuali con questa quantità di storia. La risposta onesta a "sono la
// stessa scommessa" è: sì, per la parte che conta — un solo fattore
// comune spiega la maggioranza della varianza, e la struttura settoriale
// oltre quello non è quantificabile con sicurezza su 330 mesi.
//
// ── QUELLO CHE QUESTO MODULO NON FA, E PERCHÉ (validato, non assunto) ──
// La pratica comune in letteratura RMT applicata alla finanza è "pulire" la
// matrice — sostituire gli autovalori-rumore con la loro media, tenendo solo
// il segnale — per ottenere stime di rischio più stabili. L'ho provato PRIMA
// di scriverlo qui, con una validazione fuori campione su più finestre
// scorrevoli (120 mesi di stima, 60 di verifica, passo 20-30 mesi):
//   · previsione della varianza di un portafoglio equipesato: la matrice
//     "pulita" non batte quella grezza in modo consistente (errori 36,0-36,3%
//     su 6 finestre, nell'ordine del rumore statistico stesso);
//   · pesi a varianza minima (il caso in cui la teoria promette il guadagno
//     più grande, perché invertire una matrice amplifica gli autovalori
//     piccoli): la matrice pulita ha fatto PEGGIO della grezza fuori
//     campione su 8 finestre (varianza realizzata 12,60 contro 11,88).
// Con soli 9 asset e 330 mesi non c'è abbastanza segnale perché la pulizia
// paghi il suo costo (un modello più rigido). Pubblicare una "matrice
// pulita" come se migliorasse le stime di rischio sarebbe esattamente il
// tipo di affermazione che questo progetto rifiuta di fare senza numeri
// dietro — quindi qui NON c'è quella funzione. Il conteggio dei fattori
// distinguibili resta comunque un fatto vero e utile da solo.
//
// Funzioni PURE. Nessun DOM, nessuna rete.
'use strict';

import { matriceCorrelazione, autovaloriEVettoriSimmetrica } from './panoramica-incrociata.js';

// Il bordo superiore di Marchenko-Pastur per una matrice di correlazione
// N×N stimata da T osservazioni indipendenti: sopra questo valore un
// autovalore non può essere spiegato dal solo rumore di campionamento.
export function bordoMarchenkoPastur(n, t) {
  if (!(n > 0) || !(t > 0)) return null;
  return (1 + Math.sqrt(n / t)) ** 2;
}

// Quanti fattori di rischio sono DISTINGUIBILI dal rumore, su un pannello di
// serie di rendimento (una per asset, stessa lunghezza attesa). `serie` è
// un array di array di numeri — stesso formato di matriceCorrelazione().
export function classificaAutovalori(serie = []) {
  const n = serie.length;
  if (n < 2) return { disponibile: false, motivo: 'servono almeno 2 serie per una matrice di correlazione.' };
  const t = Math.min(...serie.map((s) => s.length));
  if (t < n + 5) return { disponibile: false, motivo: `troppa poca storia (${t} osservazioni per ${n} serie): il bordo di Marchenko-Pastur non è affidabile così vicino a N=T.` };

  const C = matriceCorrelazione(serie);
  const { valori } = autovaloriEVettoriSimmetrica(C);
  const bordo = bordoMarchenkoPastur(n, t);
  const autovalori = valori.map((v, i) => ({ indice: i, autovalore: +v.toFixed(4), quotaVarianza: +(v / n).toFixed(4), sopraIlBordo: v > bordo }));
  const fattoriDistinguibili = autovalori.filter((a) => a.sopraIlBordo).length;

  return {
    disponibile: true, n, t, bordo: +bordo.toFixed(4),
    autovalori, fattoriDistinguibili,
    varianzaSpiegataDalPrimo: autovalori[0]?.quotaVarianza ?? null,
  };
}

// Spiegazione onesta, senza suggerire mosse: quanti fattori indipendenti
// esistono davvero, non se convenga cambiare qualcosa.
export function testoRumoreCorrelazione(r) {
  if (!r?.disponibile) return r?.motivo || 'Dati insufficienti per distinguere segnale da rumore.';
  const { n, t, fattoriDistinguibili, varianzaSpiegataDalPrimo } = r;
  if (fattoriDistinguibili === 0) {
    return `Su ${n} serie e ${t} mesi di storia, nessun autovalore supera la soglia del rumore statistico: con questa quantità di dati la correlazione osservata non si distingue da coincidenza.`;
  }
  const primo = fattoriDistinguibili === 1
    ? `un solo fattore comune spiega il ${Math.round(varianzaSpiegataDalPrimo * 100)}% della varianza (tipicamente "il mercato": quando tutto si muove insieme)`
    : `${fattoriDistinguibili} fattori indipendenti si distinguono dal rumore`;
  return `Su ${n} serie e ${t} mesi di storia, ${primo}. Il resto della struttura non è quantificabile con sicurezza su questa storia: più dati servirebbero per dire se c'è altro oltre al rumore statistico.`;
}
