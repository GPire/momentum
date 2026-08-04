// ============================================================
// CAUSAL DIAGNOSTICS — i modi in cui OGNI motore causale sbaglia
// ============================================================
// `causal-discovery.js` implementa PCMCI e batte nettamente il metodo a coppie
// (misurato: richiamo dal 20% al 91% a parità di precisione). Ma sarebbe
// disonesto fermarsi lì: PCMCI, PC, FCI, Granger — tutti i motori causali
// condividono modi di sbagliare noti e documentati. Un'app che mostra un grafo
// causale senza dichiararli sta vendendo una certezza che non ha.
//
// Questo file implementa i cinque controlli che trasformano un grafo in un
// grafo CON I SUOI LIMITI SCRITTI SOPRA. Nessuno di questi è un'invenzione:
// sono i punti deboli riconosciuti della disciplina, resi misurabili.
//
//  1. CAUSA COMUNE NON OSSERVATA (sufficienza causale). Tutti i metodi tipo PC
//     assumono che ogni causa comune sia tra le variabili misurate. Se una non
//     lo è — l'umore, un cambio di lavoro, una stagione — resta un legame che
//     sembra causale e non lo è. Firma rilevabile: i residui di due variabili,
//     una volta tolti i loro genitori, restano correlati nello stesso istante.
//
//  2. NON STAZIONARIETÀ. Le abitudini cambiano: un trasloco, un figlio, un
//     lavoro nuovo. Un grafo stimato a cavallo di un cambiamento non descrive
//     né il prima né il dopo. Si confronta l'effetto nella prima e nella
//     seconda metà: se differiscono troppo, il grafo unico è privo di senso.
//
//  3. AGGREGAZIONE TEMPORALE. Se la causa agisce in un giorno ma i dati sono
//     settimanali, causa ed effetto cadono nello stesso periodo: la direzione
//     diventa indistinguibile e i metodi la scelgono comunque — spesso a caso.
//     Sintomo: entrambe le direzioni significative, o correlazione istantanea
//     forte non spiegata dal grafo.
//
//  4. RETROAZIONE. Spendere causa stress, lo stress causa spesa. I grafi
//     aciclici non lo rappresentano; con i ritardi sì, ma va DETTO, perché un
//     consiglio su un anello di retroazione si comporta diversamente da uno
//     su una catena semplice (l'effetto si amplifica invece di esaurirsi).
//
//  5. POTENZA STATISTICA. "Nessun legame trovato" con 12 settimane di dati non
//     significa "non c'è legame": significa che non lo vedremmo comunque.
//     Assenza di prove non è prova di assenza, e va scritto ogni volta.
//
// Funzioni PURE, nessun DOM, nessuna rete.
'use strict';

import { normalCdf } from '../alpha/strategy-validation.js';
import { residualize, partialCorrelationTest } from './causal-discovery.js';
import { olsWithSE } from './causal-effects.js';

// ── 1. Causa comune non osservata ──
// Dopo aver tolto a ogni variabile i suoi genitori, i residui dovrebbero essere
// scorrelati. Se due residui restano correlati NELLO STESSO istante, qualcosa
// che non stiamo misurando li muove insieme.
export function detectLatentConfounders(frame, parentsByTarget, { alpha = 0.01 } = {}) {
  const nomi = frame.names || [];
  const residui = {};
  for (const name of nomi) {
    const y = frame.target[name];
    if (!y) continue;
    const Z = (parentsByTarget[name] || []).slice(0, 4).map((p) => frame.lagged[p.key]).filter(Boolean);
    const r = Z.length ? residualize(y, Z) : y;
    if (r) residui[name] = r;
  }

  const sospetti = [];
  const chiavi = Object.keys(residui);
  for (let i = 0; i < chiavi.length; i++) {
    for (let j = i + 1; j < chiavi.length; j++) {
      const t = partialCorrelationTest(residui[chiavi[i]], residui[chiavi[j]], []);
      if (t.p !== null && t.p < alpha && Math.abs(t.r) > 0.25) {
        sospetti.push({
          tra: [chiavi[i], chiavi[j]],
          r: t.r,
          p: t.p,
          nota: `${chiavi[i]} e ${chiavi[j]} si muovono insieme anche dopo aver tolto tutto ciò che conosciamo: probabilmente qualcosa che non stiamo misurando li guida entrambi.`,
        });
      }
    }
  }
  return {
    sospetti: sospetti.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    pulito: sospetti.length === 0,
    avvertimento: sospetti.length
      ? 'Alcuni legami potrebbero avere una causa in comune che l\'app non vede (umore, stagione, un cambiamento nella tua vita). I numeri restano validi come descrizione, non come garanzia che intervenire funzioni.'
      : null,
  };
}

// ── 2. Non stazionarietà: le abitudini cambiano ──
// Si stima lo stesso effetto nella prima e nella seconda metà del periodo e si
// confronta. Differenza troppo grande = un grafo solo non descrive nessuna
// delle due epoche.
export function checkStationarity(frame, fromKey, toName, { zSoglia = 2.5 } = {}) {
  const y = frame.target[toName];
  const x = frame.lagged[fromKey];
  if (!y || !x) return null;
  const n = Math.min(y.length, x.length);
  if (n < 24) return { stabile: null, motivo: 'Servono almeno 24 periodi per confrontare due epoche.' };

  const meta = Math.floor(n / 2);
  const fit1 = olsWithSE(y.slice(0, meta), [x.slice(0, meta)]);
  const fit2 = olsWithSE(y.slice(meta, n), [x.slice(meta, n)]);
  if (!fit1 || !fit2) return { stabile: null, motivo: 'Una delle due metà non permette una stima.' };

  const b1 = fit1.beta[1], b2 = fit2.beta[1];
  const se = Math.sqrt(fit1.se[1] ** 2 + fit2.se[1] ** 2);
  const z = se > 0 ? (b1 - b2) / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));

  return {
    stabile: Math.abs(z) < zSoglia,
    primaMeta: +b1.toFixed(4),
    secondaMeta: +b2.toFixed(4),
    z: +z.toFixed(2),
    p: +p.toFixed(4),
    nota: Math.abs(z) >= zSoglia
      ? `Questo legame era ${b1 > b2 ? 'più forte' : 'più debole'} prima e ${b1 > b2 ? 'più debole' : 'più forte'} dopo: qualcosa nella tua vita è cambiato, e un unico numero descrive male entrambi i periodi.`
      : null,
  };
}

// ── 3. Aggregazione temporale: la direzione non è decidibile ──
// Se la causa agisce più in fretta del periodo di misura, causa ed effetto
// cadono insieme. Sintomi: entrambe le direzioni significative, oppure una
// correlazione istantanea forte che il grafo non spiega.
export function checkTimeAggregation(frame, links, { alpha = 0.05 } = {}) {
  const ambigui = [];
  const visti = new Set();

  for (const l of links) {
    const chiave = [l.from, l.to].sort().join('|');
    if (visti.has(chiave)) continue;
    const inverso = links.find((o) => o.from === l.to && o.to === l.from);
    if (inverso) {
      visti.add(chiave);
      ambigui.push({
        tra: [l.from, l.to],
        motivo: 'entrambe-le-direzioni',
        nota: `Sembra che ${l.from} influenzi ${l.to} e viceversa. Di solito significa che la causa agisce più in fretta di quanto misuriamo: non possiamo dire chi viene prima.`,
      });
      continue;
    }
    // Correlazione nello stesso istante non spiegata: stesso sintomo.
    const a = frame.target[l.from], b = frame.target[l.to];
    if (a && b) {
      const t = partialCorrelationTest(a, b, []);
      if (t.p !== null && t.p < alpha && Math.abs(t.r) > 0.6) {
        visti.add(chiave);
        ambigui.push({
          tra: [l.from, l.to],
          motivo: 'correlazione-istantanea-forte',
          r: t.r,
          nota: `${l.from} e ${l.to} si muovono quasi sempre insieme nello stesso periodo: con dati così la direzione non è dimostrabile.`,
        });
      }
    }
  }
  return { ambigui, pulito: ambigui.length === 0 };
}

// ── 4. Anelli di retroazione ──
// Con i ritardi un ciclo è rappresentabile, ma va dichiarato: su un anello
// l'effetto di un intervento si ripercuote su sé stesso invece di esaurirsi,
// quindi la stima "effetto totale" di una catena semplice sarebbe sbagliata.
export function detectFeedbackLoops(links, { maxLen = 4 } = {}) {
  const out = new Map();
  for (const l of links) {
    if (!out.has(l.from)) out.set(l.from, []);
    out.get(l.from).push(l);
  }
  const cicli = [];
  const visti = new Set();

  const dfs = (start, nodo, percorso, lagTot) => {
    if (percorso.length > maxLen) return;
    for (const e of out.get(nodo) || []) {
      if (e.to === start && percorso.length >= 1) {
        const nodi = [...percorso.map((p) => p.from), e.from, e.to];
        const firma = [...new Set(nodi)].sort().join('|');
        if (!visti.has(firma)) {
          visti.add(firma);
          cicli.push({
            nodi: [...new Set(nodi)],
            passi: percorso.length + 1,
            lagTotale: lagTot + e.lag,
            nota: `${[...new Set(nodi)].join(' → ')} → ${start}: qui l'effetto torna su sé stesso. Un cambiamento si amplifica invece di esaurirsi, quindi va misurato nel tempo, non calcolato una volta sola.`,
          });
        }
        continue;
      }
      if (percorso.some((p) => p.to === e.to)) continue; // già attraversato
      dfs(start, e.to, [...percorso, e], lagTot + e.lag);
    }
  };
  for (const nodo of out.keys()) dfs(nodo, nodo, [], 0);
  return { cicli, presenti: cicli.length > 0 };
}

// ── 5. Potenza statistica: quando "non trovato" non vuol dire "non c'è" ──
// Con n osservazioni e un test bilaterale, qual è il più PICCOLO effetto che
// avremmo potuto vedere? Se è grande, un "nessun legame" non informa di nulla.
export function powerAnalysis(n, { alpha = 0.05, potenza = 0.8, nControlli = 0 } = {}) {
  const dof = n - nControlli - 3;
  if (dof <= 0) return { rilevabile: null, motivo: 'Campione troppo piccolo per qualunque conclusione.' };

  // Correlazione minima rilevabile: z_alpha/2 + z_beta sulla scala di Fisher.
  const zAlpha = 1.959963985; // bilaterale al 5%
  const zBeta = potenza >= 0.8 ? 0.841621234 : 0.674489750;
  const zMin = (zAlpha + zBeta) / Math.sqrt(dof);
  const rMin = (Math.exp(2 * zMin) - 1) / (Math.exp(2 * zMin) + 1);

  let giudizio, nota;
  if (rMin > 0.5) {
    giudizio = 'molto-bassa';
    nota = `Con ${n} periodi vedremmo solo legami fortissimi. Non trovarne NON significa che non ci siano: significa che con questi dati non si vedrebbero comunque.`;
  } else if (rMin > 0.3) {
    giudizio = 'limitata';
    nota = `Con ${n} periodi si vedono i legami medio-forti. Quelli deboli sfuggirebbero.`;
  } else {
    giudizio = 'buona';
    nota = `Con ${n} periodi si vedono anche i legami moderati.`;
  }

  return {
    n, dof,
    correlazioneMinimaRilevabile: +rMin.toFixed(3),
    giudizio,
    nota,
    // Quanti periodi servirebbero per vedere un legame moderato (r = 0.3)?
    periodiPerLegameModerato: Math.ceil(((zAlpha + zBeta) / (0.5 * Math.log((1 + 0.3) / (1 - 0.3)))) ** 2 + 3 + nControlli),
  };
}

// ── Il referto completo ──
// Trasforma un grafo in un grafo con i suoi limiti dichiarati. È la funzione
// che la UI deve chiamare PRIMA di mostrare qualunque conclusione causale.
export function diagnoseCausalGraph(discovered, { alpha = 0.01 } = {}) {
  if (!discovered?.affidabile) {
    return {
      utilizzabile: false,
      motivo: discovered?.motivo || 'Grafo non disponibile.',
      avvertimenti: [],
    };
  }
  const { frame, parentsByTarget, links } = discovered;

  const latenti = detectLatentConfounders(frame, parentsByTarget, { alpha });
  const tempo = checkTimeAggregation(frame, links);
  const cicli = detectFeedbackLoops(links);
  const potenza = powerAnalysis(frame.T);

  const stazionarieta = links.map((l) => ({
    link: `${l.from}→${l.to}`,
    ...(checkStationarity(frame, `${l.from}@${l.lag}`, l.to) || {}),
  })).filter((s) => s.stabile === false);

  const avvertimenti = [];
  if (!latenti.pulito) avvertimenti.push({ tipo: 'causa-comune-non-vista', gravita: 'alta', dettaglio: latenti.avvertimento, casi: latenti.sospetti });
  if (!tempo.pulito) avvertimenti.push({ tipo: 'direzione-non-decidibile', gravita: 'alta', dettaglio: 'Per alcune coppie non si può dire chi viene prima.', casi: tempo.ambigui });
  if (cicli.presenti) avvertimenti.push({ tipo: 'anello-di-retroazione', gravita: 'media', dettaglio: 'Alcuni effetti tornano su sé stessi.', casi: cicli.cicli });
  if (stazionarieta.length) avvertimenti.push({ tipo: 'abitudini-cambiate', gravita: 'media', dettaglio: 'Alcuni legami non sono stati stabili nel tempo.', casi: stazionarieta });
  if (potenza.giudizio === 'molto-bassa') avvertimenti.push({ tipo: 'dati-troppo-pochi', gravita: 'alta', dettaglio: potenza.nota, casi: [potenza] });

  // Un grafo con avvertimenti gravi non è "sbagliato": è utilizzabile solo per
  // descrivere, non per decidere un intervento. La distinzione va mostrata.
  const gravi = avvertimenti.filter((a) => a.gravita === 'alta').length;
  return {
    utilizzabile: true,
    perDecidere: gravi === 0,
    avvertimenti,
    potenza,
    riassunto: gravi === 0
      ? `${links.length} legami verificati, nessun problema strutturale rilevato: si possono usare per decidere.`
      : `${links.length} legami trovati, ma ${gravi} ${gravi === 1 ? 'problema' : 'problemi'} ${gravi === 1 ? 'rende' : 'rendono'} rischioso usarli per decidere: vanno letti come descrizione di quello che è successo, non come garanzia di quello che succederà se intervieni.`,
  };
}
