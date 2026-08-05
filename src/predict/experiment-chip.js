// ============================================================
// EXPERIMENT-CHIP — decide COSA proporre per ogni categoria del grafo
// causale, senza toccare il DOM (main.js resta l'unico posto che genera HTML).
// ============================================================
// Tre motori esistono già separati: il grafo causale trova un legame
// (causal-orchestrator.js), l'esperimento lo verifica nel tempo
// (experiment-tracker.js), il contesto macro spiega quando il legame non è
// una leva reale ma una coincidenza esterna (macro-context.js). Questo
// modulo li fonde in UNA decisione per categoria, con una regola esplicita
// sulla precedenza: un esperimento già avviato o concluso non sparisce mai
// dietro una scoperta arrivata dopo — si nasconderebbe lavoro (e dati) che
// la persona ha già raccolto. La spiegazione macro, se c'è, si aggiunge come
// nota, non sostituisce lo stato.
'use strict';

// avvertimenti: analisi.diagnosi?.avvertimenti (array), come prodotto da
// causal-diagnostics.js/macro-context.js. cats: elenco categorie da
// mostrare. experiments/allTx/now/experimentStatusFn: stesso ingresso di
// experimentStatus (iniettabile per i test).
export function classifyCategoryChips(cats, {
  avvertimenti = [], experiments = {}, allTx = {}, now = new Date(), experimentStatusFn,
} = {}) {
  const confondentiMacro = new Map();
  const casoConfondente = (avvertimenti || []).find((a) => a.tipo === 'causa-comune-non-vista');
  for (const c of casoConfondente?.casi || []) {
    if (!c.spiegatoDaMacro) continue;
    for (const cat of c.tra || []) confondentiMacro.set(cat, c.spiegatoDaMacro);
  }

  return (cats || []).map((categoria) => {
    const spiegazioneMacro = confondentiMacro.get(categoria) || null;
    const stato = experimentStatusFn(experiments, categoria, allTx, { now });
    if (stato) return { categoria, tipo: 'stato', stato, spiegazioneMacro };
    if (spiegazioneMacro) return { categoria, tipo: 'macro-spiegato', spiegazioneMacro };
    return { categoria, tipo: 'proponi', spiegazioneMacro: null };
  });
}
