// ============================================================
// COSA HA DAVVERO PROTETTO — e la smentita di quello che avevo detto io
// ============================================================
// Avevo scritto, elencando i dati mancanti, che oro e materie prime erano
// "l'unica diversificazione che storicamente funziona davvero". Presi i dati,
// il numero dice il contrario. Lo lascio scritto qui perché una convinzione
// smentita dalla misura è la cosa più utile che un modulo possa contenere.
//
// Su 400 mesi (1993-2026), nel 5% dei mesi peggiori per le azioni — quando lo
// S&P ha perso in media il 9,4% in un mese:
//
//   Dollaro                      +1,90%   positivo l'85% delle volte
//   Titoli di Stato 10 anni      +1,44%   positivo il 70% delle volte
//   Titoli di Stato 2 anni       +0,65%   positivo il 75% delle volte
//   Oro                          +0,03%   positivo il 47% delle volte
//   Materie prime                −4,34%   positivo il 30% delle volte
//   Petrolio                     −5,90%   positivo il 40% delle volte
//   Rame                         −5,15%   positivo il 15% delle volte
//
// L'ORO NON È UN RIFUGIO, è una monetina: nei mesi che contano è finito in
// pari, e ha protetto meno di una volta su due. Le MATERIE PRIME non sono
// diversificazione: crollano insieme alle azioni, perché quando l'economia si
// ferma smette di consumarle. Il rame, che di tutte è la più legata al ciclo,
// è andato bene il 15% delle volte.
//
// Il vero contrappeso sono i TITOLI DI STATO e — sorpresa maggiore — il
// DOLLARO, che è il rifugio migliore dell'archivio. Ha una spiegazione: in una
// crisi il mondo intero cerca dollari per chiudere le proprie posizioni, e
// quella domanda arriva proprio quando tutto il resto vende.
//
// ── E POI GLI SCENARI, che è la parte nuova ──
// Fino a qui gli scenari venivano da un bootstrap a blocchi, eventualmente
// condizionato al regime di oggi. Ha un limite: **assume che il regime resti
// quello**. Nella realtà i regimi cambiano, e il modo in cui cambiano è esso
// stesso una regolarità misurabile.
//
// Qui gli stati (condizioni distese / neutre / tese, dai terzili del NFCI)
// diventano una catena di Markov con la matrice di transizione STIMATA dai
// dati, e ogni mese simulato pesca un mese REALE vissuto in quello stato.
// Due conseguenze che nessun altro metodo dà insieme:
//  · le correlazioni fra classi di attivo sono conservate per costruzione,
//    perché si pesca il vettore di TUTTI gli attivi dello stesso mese vero;
//  · gli scenari possono PEGGIORARE o MIGLIORARE nel tempo, con le probabilità
//    con cui è successo davvero.
//
// E la matrice dice una cosa che vale da sola: i regimi **non saltano**. Da
// condizioni distese a tese in un mese: 0,7%. Da tese a distese: 0,0%. Si
// passa sempre per il mezzo. Chi costruisce scenari con salti diretti sta
// simulando un mondo che non è mai esistito.
//
// Funzioni PURE.
'use strict';

import { LUNGO, NOMI_LUNGO, LUNGO_MESI, LUNGO_DA, LUNGO_A, LUNGO_FONTI } from './long-asset-panel.js';

export const ATTIVI = ['azioniUsa', 'titoliStato10a', 'titoliStato2a', 'oro', 'materiePrime', 'petrolio', 'rame', 'dollaro'];
export const N_STATI = 3;
export const NOMI_STATI = ['condizioni distese', 'condizioni neutre', 'condizioni tese'];

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const devst = (a) => {
  if (a.length < 2) return 0;
  const m = media(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

export function pannelloLungo() {
  return { mesi: LUNGO_MESI, da: LUNGO_DA, a: LUNGO_A, fonti: LUNGO_FONTI, attivi: ATTIVI };
}

// ── Cosa ha protetto, misurato senza modelli né assunzioni ──
// Nessuna correlazione, nessuna correzione: si guardano i mesi peggiori per le
// azioni e si legge cosa hanno fatto gli altri. È la domanda nella sua forma
// più diretta, e proprio per questo la più difficile da contestare.
export function rifugiNeiCrolli({ quota = 0.05 } = {}) {
  const eq = LUNGO.azioniUsa;
  const ordine = eq.map((v, i) => i).sort((a, b) => eq[a] - eq[b]);
  const k = Math.max(5, Math.floor(quota * eq.length));
  const peggiori = ordine.slice(0, k);

  const righe = [];
  for (const a of ATTIVI) {
    if (a === 'azioniUsa') continue;
    const v = peggiori.map((i) => LUNGO[a][i]).filter((x) => x !== null && Number.isFinite(x));
    if (v.length < 5) { righe.push({ attivo: a, nome: NOMI_LUNGO[a], dati: v.length, giudicabile: false }); continue; }
    const m = media(v);
    const positivo = v.filter((x) => x > 0).length / v.length;
    // L'errore standard serve a non chiamare "rifugio" un vantaggio che sta
    // dentro il rumore di venti osservazioni.
    const se = devst(v) / Math.sqrt(v.length);
    righe.push({
      attivo: a, nome: NOMI_LUNGO[a], dati: v.length, giudicabile: true,
      rendimentoMedio: +m.toFixed(4),
      quotaPositiva: +positivo.toFixed(3),
      errore: +se.toFixed(4),
      // Rifugio = ha guadagnato, in modo distinguibile dal caso, ed è stato
      // positivo nettamente più spesso di una moneta.
      rifugio: m > 0 && m > 2 * se && positivo > 0.6,
      // Il contrario: è affondato insieme alle azioni.
      affonda: m < 0 && Math.abs(m) > 2 * se,
    });
  }
  righe.sort((a, b) => (b.rendimentoMedio ?? -9) - (a.rendimentoMedio ?? -9));
  return {
    mesiConsiderati: k,
    azioniInQueiMesi: +media(peggiori.map((i) => eq[i])).toFixed(4),
    classifica: righe,
    rifugi: righe.filter((r) => r.rifugio).map((r) => r.nome),
    zavorre: righe.filter((r) => r.affonda).map((r) => r.nome),
  };
}

// ── Gli stati, dai terzili delle condizioni finanziarie ──
export function statiStorici() {
  const n = LUNGO.nfci;
  const ordinati = [...n].sort((a, b) => a - b);
  const t1 = ordinati[Math.floor(n.length / 3)];
  const t2 = ordinati[Math.floor((2 * n.length) / 3)];
  const stati = n.map((x) => (x <= t1 ? 0 : x <= t2 ? 1 : 2));
  const conteggio = [0, 0, 0];
  for (const s of stati) conteggio[s]++;
  return { stati, soglie: [+t1.toFixed(4), +t2.toFixed(4)], conteggio, oggi: stati[stati.length - 1] };
}

// La matrice di transizione mensile, stimata contando.
export function matriceTransizione() {
  const { stati } = statiStorici();
  const M = Array.from({ length: N_STATI }, () => new Array(N_STATI).fill(0));
  for (let i = 1; i < stati.length; i++) M[stati[i - 1]][stati[i]]++;
  const prob = M.map((riga) => {
    const tot = riga.reduce((a, b) => a + b, 0) || 1;
    return riga.map((x) => +(x / tot).toFixed(4));
  });
  return {
    conteggi: M, probabilita: prob,
    persistenza: prob.map((r, i) => r[i]),
    // Il fatto strutturale: i salti diretti fra gli estremi quasi non esistono.
    saltiDiretti: +(prob[0][2] + prob[2][0]).toFixed(4),
    nota: 'i regimi non saltano: si passa sempre per lo stato di mezzo. Simulare salti diretti significa simulare un mondo mai esistito',
  };
}

// ── SIMULAZIONE MULTI-STATO ──
// Catena di Markov sugli stati + pesca di un mese REALE vissuto in quello
// stato. Il vettore di tutti gli attivi viene dallo stesso mese, quindi le
// correlazioni non vanno stimate: ci sono già.
export function simulaMultiStato(mesi, rng, { statoIniziale = null } = {}) {
  const { stati, oggi } = statiStorici();
  const { probabilita } = matriceTransizione();
  const perStato = [[], [], []];
  stati.forEach((s, i) => perStato[s].push(i));

  let s = statoIniziale === null ? oggi : statoIniziale;
  const percorso = new Array(mesi);
  const statiVisti = new Array(mesi);
  for (let t = 0; t < mesi; t++) {
    // Transizione.
    const r = rng();
    let acc = 0, next = N_STATI - 1;
    for (let j = 0; j < N_STATI; j++) { acc += probabilita[s][j]; if (r <= acc) { next = j; break; } }
    s = next;
    statiVisti[t] = s;
    // Un mese vero vissuto in quello stato: tutti gli attivi insieme.
    const i = perStato[s][Math.floor(rng() * perStato[s].length)];
    const riga = {};
    for (const a of ATTIVI) riga[a] = LUNGO[a][i];
    percorso[t] = riga;
  }
  return { percorso, stati: statiVisti };
}

// Il rendimento di un portafoglio lungo uno scenario. `pesi` in frazioni.
export function rendimentoScenario(scenario, pesi) {
  const somma = Object.values(pesi).reduce((a, b) => a + b, 0) || 1;
  return scenario.percorso.map((mese) => {
    let r = 0;
    for (const [a, w] of Object.entries(pesi)) {
      const v = mese[a];
      // Un attivo senza dato in quel mese (l'oro prima del 2000) non partecipa:
      // meglio un portafoglio più piccolo che un valore inventato.
      if (v !== null && Number.isFinite(v)) r += (w / somma) * v;
    }
    return r;
  });
}

// Il confronto fra portafogli, su scenari IDENTICI: stesso seme, stessi mesi
// pescati, stessi stati attraversati. È l'unico modo di confrontare due
// allocazioni senza che la fortuna del sorteggio decida il vincitore.
export function confrontaPortafogli(portafogli, { mesi = 60, prove = 800, seed = 20260810, rngFactory } = {}) {
  const risultati = Object.fromEntries(Object.keys(portafogli).map((k) => [k, []]));
  for (let p = 0; p < prove; p++) {
    const rng = rngFactory(seed + p);
    const scen = simulaMultiStato(mesi, rng);
    for (const [nome, pesi] of Object.entries(portafogli)) {
      const r = rendimentoScenario(scen, pesi);
      let v = 1, picco = 1, peggio = 0;
      for (const x of r) { v *= (1 + x); picco = Math.max(picco, v); peggio = Math.max(peggio, 1 - v / picco); }
      risultati[nome].push({ finale: v, peggiorCalo: peggio, medio: media(r) });
    }
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  return Object.fromEntries(Object.entries(risultati).map(([nome, v]) => {
    const finali = v.map((x) => x.finale), cali = v.map((x) => x.peggiorCalo);
    return [nome, {
      medianaFinale: +q(finali, 0.5).toFixed(4),
      scenarioBrutto: +q(finali, 0.05).toFixed(4),
      scenarioBuono: +q(finali, 0.95).toFixed(4),
      peggiorCaloTipico: +q(cali, 0.5).toFixed(4),
      peggiorCaloGrave: +q(cali, 0.95).toFixed(4),
      prove: v.length,
    }];
  }));
}

// ── Come si racconta ──
export function rifugiText(r) {
  if (!r?.classifica?.length) return null;
  const pct = (x) => (x * 100).toFixed(1).replace('.', ',');
  const migliore = r.classifica.find((x) => x.giudicabile);
  const oro = r.classifica.find((x) => x.attivo === 'oro');
  const parti = [
    `Nei mesi in cui le azioni hanno perso di più (in media il ${pct(Math.abs(r.azioniInQueiMesi))}% in un mese), quello che ha protetto di più è stato ${migliore.nome.toLowerCase()}: ${pct(migliore.rendimentoMedio)}% in media.`,
  ];
  if (oro?.giudicabile && !oro.rifugio) {
    parti.push(`L'oro, che tutti chiamano bene rifugio, in quei mesi è finito in pari ed è stato positivo solo ${Math.round(oro.quotaPositiva * 100)} volte su 100: una monetina.`);
  }
  if (r.zavorre.length) parti.push(`Sono invece affondate insieme alle azioni: ${r.zavorre.map((z) => z.toLowerCase()).join(', ')}.`);
  return parti.join(' ');
}

// ── E DENTRO LE AZIONI: quali settori hanno tenuto e quali no ──
// Non tutte le azioni sono la stessa cosa nei crolli, e il motivo non è
// misterioso: si vende ciò di cui si può fare a meno. Le utility e i beni di
// prima necessità continuano a essere pagati anche in recessione — la bolletta
// e la spesa non si rimandano — mentre i consumi discrezionali, l'industria e
// l'energia dipendono da decisioni che si possono posticipare.
// Qui non lo si racconta: lo si misura sui nove settori dello S&P 500, negli
// stessi mesi peggiori usati sopra.
export async function settoriNeiCrolli({ quota = 0.1 } = {}) {
  const { PANNELLO_SETTORI } = await import('./historical-panel.js');
  const mercato = [];
  const T = PANNELLO_SETTORI[0].r.length;
  for (let t = 0; t < T; t++) mercato.push(media(PANNELLO_SETTORI.map((s) => s.r[t])));

  const ordine = mercato.map((v, i) => i).sort((a, b) => mercato[a] - mercato[b]);
  const k = Math.max(5, Math.floor(quota * T));
  const peggiori = ordine.slice(0, k);
  const mediaMercato = media(peggiori.map((i) => mercato[i]));

  const righe = PANNELLO_SETTORI.map((s) => {
    const v = peggiori.map((i) => s.r[i]);
    const m = media(v);
    return {
      simbolo: s.simbolo, nome: s.nome,
      rendimentoMedio: +m.toFixed(4),
      // Quanto ha fatto MEGLIO del mercato: è il numero che conta, perché in
      // un crollo scendono quasi tutti e "ha perso poco" è già difesa.
      megliODelMercato: +(m - mediaMercato).toFixed(4),
      quotaPositiva: +(v.filter((x) => x > 0).length / v.length).toFixed(3),
      difensivo: m > mediaMercato,
    };
  }).sort((a, b) => b.rendimentoMedio - a.rendimentoMedio);

  return {
    mesiConsiderati: k,
    mercatoInQueiMesi: +mediaMercato.toFixed(4),
    classifica: righe,
    tengono: righe.filter((r) => r.difensivo).map((r) => r.nome),
    cedono: righe.filter((r) => !r.difensivo).map((r) => r.nome),
    // Il divario fra il migliore e il peggiore: dice quanto conta la scelta
    // del settore proprio nei mesi in cui si crede che "scenda tutto uguale".
    divario: +(righe[0].rendimentoMedio - righe[righe.length - 1].rendimentoMedio).toFixed(4),
  };
}

export function settoriText(s) {
  if (!s?.classifica?.length) return null;
  const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
  const top = s.classifica[0], flop = s.classifica[s.classifica.length - 1];
  return `Nei mesi peggiori il mercato ha perso in media il ${pct(s.mercatoInQueiMesi)}%, ma non tutti allo stesso modo: ${top.nome.toLowerCase()} ha perso il ${pct(top.rendimentoMedio)}%, ${flop.nome.toLowerCase()} il ${pct(flop.rendimentoMedio)}%. Sono ${pct(s.divario)} punti di differenza fra il primo e l'ultimo, dentro lo stesso mese e lo stesso mercato: si vende per primo ciò di cui si può fare a meno.`;
}
