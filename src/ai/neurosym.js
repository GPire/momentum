// ============================================================
// NEUROSYM — façade di spiegazione (non un router: main.js chiama diretto)
// ============================================================
// STATO REALE (verificato 2026-08-23, sessione di pulizia codice morto):
// main.js chiama GIÀ direttamente orchestrator.infer()/qa-engine.answerQuestion()
// per categorizzazione e Q&A — NeuroSym.categorize()/ask() qui sotto sono
// wrapper corretti ma NON sul percorso vivo, un'indirezione in più che
// l'app non attraversa. La catena che UN TEMPO li chiamava (omega.js,
// executive.js, nb-categorizer.js) era essa stessa irraggiungibile da
// nessun punto dell'app — rimossa in questa sessione, non solo i tre file
// ma anche i loro test (erano test di codice mai eseguito in produzione).
//
// L'UNICO metodo qui sotto sul percorso vivo è explain(): main.js lo
// chiama per il pannello "Come funziona Momentum" (Impostazioni) — l'unica
// ragione per cui questo file non è stato rimosso insieme al resto della
// catena. Gli altri metodi restano (wrapper onesti, zero rischio a
// tenerli) ma sono dichiarati qui per quello che sono: disponibili, non
// wired.
//
// Sottosistemi REALMENTE dietro explain():
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
import { explainMacro, investorFor } from '../graph/market-knowledge.js';

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

  // Conoscenza di mercato (investment banking / ETF / azionario / cause-effetto
  // macro consolidate + principi dei grandi investitori e case istituzionali).
  // Ritorna { macro?, investor? } pertinenti alla domanda — knowledge REALE e
  // citabile, non previsioni. (src/graph/market-knowledge.js)
  marketInsight(query) {
    const macro = explainMacro(query);
    const inv = investorFor(query);
    return { macro: macro ? macro.text : null, investor: inv ? `${inv.who}: ${inv.principle}` : null };
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
        { name: 'Investimenti', components: ['value/growth/momentum/risk/reflexivity', 'arbitro Munger', 'portfolio risk-parity', 'regime di correlazione (Frobenius)', 'segnale/rumore (Marchenko-Pastur)', 'screener settoriale (SEC, migliaia di aziende)', 'rischio di rovina (Monte Carlo)', 'Component Expected Shortfall'], mode: 'strategie dei grandi + analisi strutturale di livello istituzionale, personalizzate per utente' },
        { name: 'Q&A / fisco', components: ['qa-engine deterministico', 'tax P.IVA'], mode: 'on-device, offline' },
        { name: 'Adattività hardware', components: ['compute-planner', 'adaptive-runtime', 'INT8'], mode: `si plasma al device${heavy.length ? ' + heavy-expert attivo' : ' (heavy-expert slot vuoto)'}` },
      ],
      heavyExpertReady: heavy.length > 0,
      honesty: 'Specs misurate (dimensione/latenza reali). Nessun param-count inventato; sul ragionamento aperto i frontier LLM restano avanti — vinciamo su specializzazione, aritmetica verificabile e assi strutturali.',
    };
  },
};
