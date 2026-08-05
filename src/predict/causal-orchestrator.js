// ============================================================
// CAUSAL ORCHESTRATOR — il punto d'ingresso unico per la UI
// ============================================================
// Cinque moduli scientifici sono stati costruiti separatamente:
//  - causal-discovery.js  → PCMCI: quali legami sono reali (non solo coppie)
//  - causal-effects.js    → quanto vale l'effetto, con intervallo, vie
//                            indirette e interazioni
//  - causal-diagnostics.js→ i 5 modi in cui QUALSIASI motore causale sbaglia
//  - nonlinear-dependence.js → i legami che la correlazione non vede (soglie, U)
//  - anytime-experiment.js  → verificare nel tempo se un cambiamento reggeva
//
// Questo file li mette in fila in UN SOLO risultato pronto per la UI, con una
// regola di degradazione onesta: **PCMCI ha bisogno di più dati del vecchio
// metodo a coppie** (deve stimare più parametri). Con poche settimane di
// storia, il nuovo motore semplicemente non può girare — e in quel caso si
// usa il vecchio, DICHIARANDO che è la versione meno potente, non spacciandolo
// per il risultato migliore. Man mano che l'utente accumula settimane, il
// motore passa da solo alla versione forte, senza che nessuno debba fare nulla.
//
// Funzioni PURE tranne l'orchestratore stesso, che accetta le serie già
// costruite (nessun accesso diretto al vault: la UI decide cosa passare).
'use strict';

import { discoverCausalGraph } from './causal-discovery.js';
import { analyzeCausalScenario } from './causal-effects.js';
import { diagnoseCausalGraph, detectLatentConfounders } from './causal-diagnostics.js';
import { compareLinearVsNonlinear } from './nonlinear-dependence.js';
import { partialCorrelationTest } from './causal-discovery.js';
import { buildCausalGraph as legacyBuildGraph, pruneNonCausal as legacyPrune } from './causal-graph.js';
import { explainConfoundersWithMacro } from './macro-context.js';

// Sotto questa soglia PCMCI non ha statisticamente senso provarlo (troppo
// pochi gradi di libertà per selezionare genitori E testare MCI): si passa
// al vecchio metodo, dichiarandolo esplicitamente come "versione base".
const SOGLIA_PCMCI = 16;

export function analyzeCausalStructure(series, {
  maxLag = 3, alpha = 0.05, allTx = null, referenceDate = new Date(), interventi = {},
  // Serie macro GIÀ allineata (macro-context.js: alignMacroToWeeks) e la sua
  // etichetta leggibile — mai una chiamata di rete da qui: questo modulo
  // resta puro, la rete la fa solo chi orchestrara la UI (main.js), con le
  // uniche fonti senza chiave (BCE, BIS) verificate CORS-aperte dal vivo.
  macroContext = null,
} = {}) {
  const settimane = Math.min(...Object.values(series || {}).map((s) => s?.length || 0).filter((n) => n > 0));

  if (!Number.isFinite(settimane) || settimane < SOGLIA_PCMCI) {
    // Versione base: il vecchio metodo a coppie, MA dichiarato per quello che
    // è. Serve comunque allTx per costruirlo (stesso input di sempre).
    const links = allTx ? legacyPrune(legacyBuildGraph(allTx, referenceDate, { maxLag })) : [];
    return {
      motore: 'base',
      motivoMotoreBase: `Servono almeno ${SOGLIA_PCMCI} settimane di storia per il controllo statistico completo: ce ne sono ${settimane || 0}. Uso il metodo più semplice, che può confondere due categorie guidate dalla stessa causa (es. lo stipendio).`,
      links, edges: [], scenari: [], diagnosi: null, nonLineari: [],
      riassunto: links.length
        ? `${links.length} legami trovati con il metodo base (ancora poca storia per quello avanzato).`
        : 'Non ci sono ancora abbastanza dati per dire qualcosa.',
    };
  }

  const discovered = discoverCausalGraph(series, { maxLag, alpha });
  if (!discovered.affidabile) {
    return {
      motore: 'pcmci', links: [], edges: [], scenari: [], diagnosi: null, nonLineari: [],
      riassunto: discovered.motivo,
    };
  }

  const effetti = analyzeCausalScenario(series, discovered, { interventi, maxLag });
  let diagnosi = diagnoseCausalGraph(discovered, { alpha: 0.01 });

  // Se è disponibile una serie macro reale (BCE/BIS, senza chiave), si
  // rifà il rilevamento del confondente nascosto e si prova a NOMINARLO:
  // da "qualcosa che non misuriamo" a "probabilmente il tasso di
  // riferimento". Solo se il macro spiega davvero (mai un'attribuzione a
  // metà) — altrimenti l'avvertimento resta quello anonimo di prima.
  if (macroContext?.values?.length && diagnosi.utilizzabile) {
    const latentGrezzo = detectLatentConfounders(discovered.frame, discovered.parentsByTarget);
    const arricchito = explainConfoundersWithMacro(latentGrezzo, macroContext, { label: macroContext.label || 'un fattore macroeconomico' });
    const avvertimenti = diagnosi.avvertimenti.map((a) => a.tipo === 'causa-comune-non-vista'
      ? { ...a, casi: arricchito.sospetti, dettaglio: arricchito.sospetti.some((s) => s.spiegatoDaMacro) ? 'Uno o più legami sono probabilmente spiegati da un fattore macroeconomico reale, non da un legame diretto tra le tue categorie.' : a.dettaglio }
      : a);
    diagnosi = { ...diagnosi, avvertimenti };
  }

  // Legami non lineari: si cercano SOLO tra le coppie che PCMCI ha scartato
  // (altrimenti si ritesterebbe tutto due volte). È qui che emergono le
  // soglie e le relazioni a U che il grafo lineare non può vedere.
  const nonLineari = [];
  const { frame } = discovered;
  const scartatiUnivoci = new Map();
  for (const s of discovered.scartati || []) {
    const k = `${s.from}|${s.to}`;
    if (!scartatiUnivoci.has(k)) scartatiUnivoci.set(k, s);
  }
  for (const s of scartatiUnivoci.values()) {
    const x = frame.lagged[`${s.from}@${s.lag}`];
    const y = frame.target[s.to];
    if (!x || !y) continue;
    const cmp = compareLinearVsNonlinear(x, y, [], {
      testers: { partialCorrelationTest }, permutazioni: 199, seed: 7, alpha,
    });
    if (cmp.verdetto === 'legame-nascosto') {
      nonLineari.push({ from: s.from, to: s.to, lag: s.lag, ...cmp });
    }
  }

  const gravi = (diagnosi?.avvertimenti || []).filter((a) => a.gravita === 'alta').length;
  return {
    motore: 'pcmci',
    links: discovered.links,
    edges: effetti.edges,
    scenari: effetti.scenari,
    diagnosi,
    nonLineari,
    testEseguiti: discovered.testEseguiti,
    correzione: discovered.correzione,
    riassunto: [
      effetti.riassunto,
      gravi > 0 ? `Attenzione: ${gravi} ${gravi === 1 ? 'motivo rende' : 'motivi rendono'} rischioso usarli per decidere.` : null,
      nonLineari.length ? `Trovat${nonLineari.length === 1 ? 'o' : 'i'} anche ${nonLineari.length} legame${nonLineari.length === 1 ? '' : 'i'} nascost${nonLineari.length === 1 ? 'o' : 'i'} (non una linea retta).` : null,
    ].filter(Boolean).join(' '),
  };
}
