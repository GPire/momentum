// ============================================================
// NON TUTTI VIVONO IL CICLO AMERICANO
// ============================================================
// Tutta l'analisi macro costruita finora e' americana: curva USA, recessioni
// NBER, condizioni finanziarie della Fed di Chicago. E' materiale solido, ma
// Momentum non e' un'app americana — e' europea, americana e globale. Detto in
// modo brutale: fino a qui, a un utente di Milano, Francoforte o Londra
// l'app rispondeva "ecco come vanno le cose negli Stati Uniti", senza dirlo.
//
// Questo modulo misura quanto quella risposta sia sbagliata per ciascun Paese,
// e la risposta e' che dipende molto — il che e' esattamente il motivo per cui
// serviva misurarlo invece di assumerlo.
//
// IL NUMERO CHE ORGANIZZA TUTTO. Correlazione fra le VARIAZIONI mensili dei
// tassi a lungo termine e quelle americane, su 419 mesi (1991-2026):
//     Germania 0,74 · Australia 0,74 · Regno Unito 0,68 · area euro 0,58
//     Giappone 0,35 · **Italia 0,33**
// La Germania si muove quasi in sincronia con gli Stati Uniti; l'Italia meno
// della meta'. Non e' un caso: il rendimento tedesco e' il "risk free"
// europeo e segue il ciclo globale dei tassi, mentre quello italiano porta
// dentro una componente di rischio-Paese che e' locale e che nei momenti
// difficili si muove per conto suo — a volte nella direzione opposta.
// Conseguenza pratica: una previsione costruita sui tassi americani vale molto
// per un tedesco e poco per un italiano, e un'app che non lo distingue sta
// dando a meta' dei suoi utenti una risposta presa da un altro Paese.
//
// PERCHE' LO STESSO INDICATORE PER TUTTI, e non il "decennale" di ogni Paese
// preso dalla sua borsa nazionale: le convenzioni di calcolo differiscono, e
// una differenza fra Paesi misurata su definizioni diverse sarebbe in parte un
// artefatto. Qui la fonte e' unica (serie OCSE armonizzate) proprio perche' il
// confronto sia lecito.
//
// LA FINESTRA parte dal 1991 perche' e' quando inizia la serie italiana. Gli
// archivi singoli sono molto piu' lunghi (la Germania arriva al 1956), ma
// accorciarli tutti alla stessa finestra e' l'unico modo di confrontarli senza
// che il periodo diverso spieghi da solo le differenze.
//
// Funzioni PURE.
'use strict';

import { TASSI_PAESI, NOMI_PAESI, PAESI_DA, PAESI_A, PAESI_MESI, PAESI_FONTE } from './country-rates-panel.js';

export const RIFERIMENTO = 'us';

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const variazioni = (a) => a.slice(1).map((v, i) => v - a[i]);
const correlazione = (a, b) => {
  const ma = media(a), mb = media(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? n / Math.sqrt(da * db) : null;
};

export function pannelloPaesi() {
  return { paesi: Object.keys(TASSI_PAESI), mesi: PAESI_MESI, da: PAESI_DA, a: PAESI_A, fonte: PAESI_FONTE };
}

// ── Quanto il ciclo americano spiega il tuo ──
// Si correlano le VARIAZIONI, non i livelli: due serie che scendono entrambe
// da trent'anni risultano correlate anche se non hanno niente in comune. E' la
// stessa trappola gia' misurata sul motore causale, dove cinque legami su
// cinque sparivano passando alle variazioni.
export function sincroniaConGliUsa({ riferimento = RIFERIMENTO } = {}) {
  const base = variazioni(TASSI_PAESI[riferimento]);
  const righe = [];
  for (const [k, serie] of Object.entries(TASSI_PAESI)) {
    if (k === riferimento) continue;
    const c = correlazione(base, variazioni(serie));
    righe.push({
      paese: k, nome: NOMI_PAESI[k],
      sincronia: c === null ? null : +c.toFixed(3),
      // Sopra 0,6 il ciclo americano e' una guida ragionevole; sotto, no.
      seguelUsa: c !== null && c > 0.6,
    });
  }
  righe.sort((a, b) => (b.sincronia ?? -1) - (a.sincronia ?? -1));
  return {
    riferimento: NOMI_PAESI[riferimento],
    righe,
    piuLegato: righe[0], menoLegato: righe[righe.length - 1],
    conclusione: 'i tassi di alcuni Paesi seguono da vicino quelli americani, altri quasi per niente: una previsione costruita sugli Stati Uniti non vale allo stesso modo dappertutto',
  };
}

// ── Lo scarto fra due Paesi: il premio che il mercato chiede in piu' ──
// Il caso piu' noto e' Italia contro Germania, ma la funzione e' generale:
// vale per Spagna-Germania, Regno Unito-area euro, qualunque coppia.
export function scartoFraPaesi(a, b) {
  const sa = TASSI_PAESI[a], sb = TASSI_PAESI[b];
  if (!sa || !sb) return { valido: false, motivo: `paese sconosciuto: ${!sa ? a : b}` };
  const serie = sa.map((x, i) => +(x - sb[i]).toFixed(3));
  const ordinati = [...serie].sort((x, y) => x - y);
  const oggi = serie[serie.length - 1];
  const percentile = serie.filter((x) => x <= oggi).length / serie.length;
  return {
    valido: true,
    coppia: `${NOMI_PAESI[a]} - ${NOMI_PAESI[b]}`,
    oggi, serie,
    minimo: ordinati[0], massimo: ordinati[ordinati.length - 1],
    mediano: ordinati[Math.floor(ordinati.length / 2)],
    // Dove siamo rispetto alla storia: e' il numero che dice se lo scarto di
    // oggi e' normale o eccezionale, e senza il quale un valore assoluto non
    // significa niente.
    percentile: +percentile.toFixed(3),
    tesoStoricamente: percentile > 0.8,
    distesoStoricamente: percentile < 0.2,
  };
}

// ── Il ciclo globale: quanto i tassi del mondo si muovono insieme ──
// Media delle correlazioni fra tutte le coppie. Quando sale, esiste "un ciclo
// dei tassi mondiale" e la geografia conta poco; quando scende, ogni Paese va
// per conto suo e la scelta di dove si vive torna a pesare.
export function cicloGlobale({ finestra = 60 } = {}) {
  const paesi = Object.keys(TASSI_PAESI);
  const finestre = [];
  const T = TASSI_PAESI.us.length;
  for (let fine = finestra + 1; fine <= T; fine += 12) {
    const coppie = [];
    for (let i = 0; i < paesi.length; i++) {
      for (let j = i + 1; j < paesi.length; j++) {
        const a = variazioni(TASSI_PAESI[paesi[i]].slice(fine - finestra - 1, fine));
        const b = variazioni(TASSI_PAESI[paesi[j]].slice(fine - finestra - 1, fine));
        const c = correlazione(a, b);
        if (c !== null) coppie.push(c);
      }
    }
    finestre.push({ fineIndice: fine, sincronia: +media(coppie).toFixed(3) });
  }
  const ultimo = finestre[finestre.length - 1];
  const valori = finestre.map((f) => f.sincronia);
  return {
    finestre,
    oggi: ultimo?.sincronia ?? null,
    minimo: Math.min(...valori), massimo: Math.max(...valori),
    // Percentile del valore attuale nella storia del ciclo.
    percentile: +(valori.filter((v) => v <= (ultimo?.sincronia ?? 0)).length / valori.length).toFixed(3),
  };
}

// ── Il quadro per UN Paese, che e' quello che serve a chi ci vive ──
export function quadroPaese(paese) {
  const serie = TASSI_PAESI[paese];
  if (!serie) return { valido: false, motivo: `paese sconosciuto: ${paese}` };
  const oggi = serie[serie.length - 1];
  const ordinati = [...serie].sort((a, b) => a - b);
  const percentile = serie.filter((x) => x <= oggi).length / serie.length;
  const sinc = sincroniaConGliUsa().righe.find((r) => r.paese === paese);
  const anno = serie.length > 12 ? +(oggi - serie[serie.length - 13]).toFixed(2) : null;
  return {
    valido: true, paese, nome: NOMI_PAESI[paese],
    tasso: +oggi.toFixed(2),
    variazioneUnAnno: anno,
    percentileStorico: +percentile.toFixed(3),
    minimoStorico: +ordinati[0].toFixed(2),
    massimoStorico: +ordinati[ordinati.length - 1].toFixed(2),
    sincroniaConGliUsa: sinc?.sincronia ?? null,
    ilCicloAmericanoTiRiguarda: !!sinc?.seguelUsa,
  };
}

// ── Come si racconta ──
export function tassiMondoText(paese = 'it') {
  const q = quadroPaese(paese);
  if (!q.valido) return null;
  const dir = q.variazioneUnAnno === null ? '' :
    q.variazioneUnAnno > 0.2 ? ` In un anno sono saliti di ${q.variazioneUnAnno.toFixed(1).replace('.', ',')} punti.`
      : q.variazioneUnAnno < -0.2 ? ` In un anno sono scesi di ${Math.abs(q.variazioneUnAnno).toFixed(1).replace('.', ',')} punti.` : '';
  const dove = q.percentileStorico > 0.8 ? 'fra i piu\' alti degli ultimi trent\'anni'
    : q.percentileStorico < 0.2 ? 'fra i piu\' bassi degli ultimi trent\'anni'
      : 'in linea con la media degli ultimi trent\'anni';
  const usa = q.ilCicloAmericanoTiRiguarda
    ? ' I tassi di questo Paese si muovono quasi insieme a quelli americani, quindi quello che succede negli Stati Uniti ti riguarda parecchio.'
    : ' I tassi di questo Paese seguono poco quelli americani: le notizie da Wall Street contano meno di quanto sembri per chi vive qui.';
  return `In ${q.nome} prestare soldi allo Stato per dieci anni rende oggi il ${q.tasso.toFixed(2).replace('.', ',')}%, ${dove}.${dir}${usa}`;
}

export function scartoText(s) {
  if (!s?.valido) return null;
  const dove = s.tesoStoricamente ? 'ai livelli piu\' tesi degli ultimi trent\'anni'
    : s.distesoStoricamente ? 'ai livelli piu\' tranquilli degli ultimi trent\'anni'
      : 'in una zona normale';
  return `Oggi ${s.coppia.split(' - ')[0]} paga ${s.oggi.toFixed(2).replace('.', ',')} punti in piu' della ${s.coppia.split(' - ')[1]} per prendere in prestito a dieci anni: siamo ${dove} (il massimo fu ${s.massimo.toFixed(1).replace('.', ',')}).`;
}
