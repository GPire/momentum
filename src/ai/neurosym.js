// ============================================================
// NEUROSYM — il motore AI unificato di Momentum (façade onesta)
// ============================================================
// Un unico punto d'ingresso che orchestra i sottosistemi REALI già costruiti,
// con spiegazione tracciabile. NON è nuovo codice ML né un LLM: è
// l'unificazione (nome + API + explain) di ciò che esiste, così che l'app e
// un investitore/acquirente vedano UN cervello, non moduli sparsi.
// Onestà (regola #1): ogni sottosistema è quello reale e testato; specs
// misurate, mai param-count inventati. Vedi NEUROSYM.md.
//
// Sottosistemi orchestrati:
//  - Categorizzazione: orchestrator (dizionario + Nano/Meso/DCGN + sparse-MoE)
//  - Memoria episodica: DCGN (apprende online, decade)
//  - Ragionamento causale: causal-graph (co-variazione tra categorie)
//  - Investimenti: alpha/* (factors incl. Soros + arbiter Munger + portfolio)
//  - Q&A NL: qa-engine (deterministico, on-device)
//  - Fisco: tax (accantonamento P.IVA)
//  - Adattività hardware: adaptive-runtime + compute-planner + expert-adapter
'use strict';

import { answerQuestion } from './qa-engine.js';
import { analyzePortfolio } from '../alpha/portfolio-import.js';
import { taxSetAsideForPeriod } from '../predict/tax.js';
import { activatableHeavyExperts } from './expert-adapter.js';

export const NeuroSym = {
  // Categorizzazione: delega all'orchestratore (unico cervello di categoria).
  categorize(orchestrator, description, amount, date) {
    return orchestrator ? orchestrator.infer(description, amount, date) : { category: null, confidence: 0, abstain: true };
  },

  // Domanda in linguaggio naturale (spese/investimenti/tasse/…).
  ask(question, ctx) {
    return answerQuestion(question, ctx);
  },

  // Analisi del portafoglio reale con le strategie dei grandi.
  analyzePortfolio(positions, opts) {
    return analyzePortfolio(positions, opts);
  },

  // Accantonamento fiscale P.IVA su un periodo.
  taxForPeriod(transactions, opts) {
    return taxSetAsideForPeriod(transactions, opts);
  },

  // Auto-descrizione onesta dell'architettura ATTIVA su questo device: cosa è
  // acceso, con quali specs misurabili. Serve alla UI e alla due diligence.
  explain(profile = null) {
    const heavy = activatableHeavyExperts(profile);
    return {
      engine: 'NeuroSym',
      layers: [
        { name: 'Categorizzazione', components: ['dizionario esercenti', 'Nano', 'Meso', 'DCGN'], mode: 'sparse-MoE per tier' },
        { name: 'Memoria episodica', components: ['DCGN grafo online'], mode: 'apprende ad ogni transazione, decade' },
        { name: 'Ragionamento causale', components: ['causal-graph'], mode: 'co-variazione tra categorie' },
        { name: 'Investimenti', components: ['value/growth/momentum/risk/reflexivity', 'arbitro Munger', 'portfolio risk-parity'], mode: 'strategie dei grandi, personalizzate per utente' },
        { name: 'Q&A / fisco', components: ['qa-engine deterministico', 'tax P.IVA'], mode: 'on-device, offline' },
        { name: 'Adattività hardware', components: ['compute-planner', 'adaptive-runtime', 'INT8'], mode: `si plasma al device${heavy.length ? ' + heavy-expert attivo' : ' (heavy-expert slot vuoto)'}` },
      ],
      heavyExpertReady: heavy.length > 0,
      honesty: 'Specs misurate (dimensione/latenza reali). Nessun param-count inventato; sul ragionamento aperto i frontier LLM restano avanti — vinciamo su specializzazione, aritmetica verificabile e assi strutturali.',
    };
  },
};
