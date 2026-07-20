// ============================================================
// OMEGA — il ragionatore a 5 strati di Momentum (W1)
// ============================================================
// Trasforma NeuroSym da router a RAGIONATORE: attraversa i 5 strati
// (Percezione → Memoria → Ragionamento → Decisione → Apprendimento),
// FONDA le risposte sulla memoria semantica (regole con fonte, W2), aggiunge
// le catene causa-effetto (W4) e SI AUTO-VERIFICA (self-check aritmetico +
// astensione calibrata, W0). Ogni risposta porta la sua "catena di pensiero"
// tracciabile — spiegabilità reale, non un numero orfano.
// Onestà (regola #1): unifica moduli VERI e testati; nessun LLM, nessun
// param-count inventato. È il "cervello" che un acquirente vede come UNO.
'use strict';

import { NeuroSym } from './neurosym.js';
import { applicableRules, ground, recall } from '../graph/semantic.js';
import { buildCausalGraph, explainChain } from '../predict/causal-graph.js';
import { calibratedEnsemble, expectedCalibrationError } from './calibration.js';
import { crossDomainWhatIf } from './reasoning-fusion.js';

// Self-check: verifica che un numero dichiarato coincida col ricalcolo diretto,
// entro tolleranza. Il ragionatore "capisce a priori quando rischia di
// sbagliare": se il conto non torna, la risposta è marcata non affidabile.
export function verifyArithmetic(claimed, recomputed, tol = 0.01) {
  if (claimed == null || recomputed == null) return { ok: false, reason: 'valore mancante' };
  const diff = Math.abs(claimed - recomputed);
  const scale = Math.max(1, Math.abs(recomputed));
  const ok = diff / scale <= tol;
  return { ok, claimed, recomputed, diff: +diff.toFixed(4), reason: ok ? 'coerente' : 'incoerenza aritmetica' };
}

export const Omega = {
  // Categorizzazione con auto-verifica dell'astensione: combina gli esperti in
  // modo calibrato e, se nessuno è sicuro, ASTIENE (il chiamante chiede conferma
  // o sale al modello pesante). Riusa l'orchestratore reale per gli esperti.
  perceiveAndClassify(orchestrator, description, amount, date, opts = {}) {
    const base = NeuroSym.categorize(orchestrator, description, amount, date);
    // se l'orchestratore espone le distribuzioni degli esperti, ricalibra + astieni
    if (base && Array.isArray(base.experts) && base.experts.length && base.categories) {
      const cal = calibratedEnsemble(base.experts, base.categories, { abstainBelow: opts.abstainBelow ?? 0.45 });
      return { ...base, category: cal.category, confidence: cal.confidence, margin: cal.margin, abstain: cal.abstain };
    }
    return base;
  },

  // IL RAGIONATORE: data una situazione finanziaria, produce consiglio FONDATO
  // + catena di pensiero + auto-verifica. ctx = profilo derivato dai dati veri
  // (on-device): { wantsToInvest, emergencyMonths, hasHighInterestDebt,
  // isFreelance, allTx, referenceDate, causalQuery?:{category,deltaPct} }.
  reason(query, ctx = {}) {
    const chain = []; // catena di pensiero tracciabile
    const cites = []; // regole citate (fonte)

    // STRATO 1-2: Percezione + Memoria semantica (recall pertinente all'intento)
    const topical = recall(query);
    if (topical.length) chain.push(`Richiamo dalla memoria semantica ${topical.length} regole pertinenti a "${query}".`);

    // STRATO 3: Ragionamento — regole APPLICABILI al contesto reale dell'utente
    const rules = applicableRules(ctx).filter(r => r.id !== 'not-financial-advice');
    for (const r of rules.slice(0, 3)) {
      chain.push(`Regola applicabile: ${r.id} (priorità ${r.priority}).`);
      cites.push({ id: r.id, source: r.source, statement: r.statement });
    }

    // STRATO 3b: catena causale se richiesta (se muovo A → B, e forse C)
    let causal = null;
    if (ctx.causalQuery && ctx.allTx) {
      const links = ctx.causalLinks || buildCausalGraph(ctx.allTx, ctx.referenceDate || new Date(), { maxLag: ctx.maxLag ?? 3 });
      causal = explainChain(links, ctx.causalQuery.category, ctx.causalQuery.deltaPct ?? 20);
      if (causal.steps.length) chain.push(`Catena causale: ${causal.text}`);
    }

    // STRATO 3c (Wave 12 v10, src/ai/reasoning-fusion.js): stessa domanda
    // "se muovo X", ma tradotta in cashflow € (what-if) E traiettoria
    // patrimoniale (net-worth Twin, Monte Carlo) nella STESSA risposta —
    // nessun tracker di portafoglio del settore vede insieme spese e
    // patrimonio. Additivo: solo se causalQuery è presente, mai un requisito
    // nuovo per i chiamanti esistenti.
    let crossDomain = null;
    if (ctx.causalQuery && ctx.allTx) {
      crossDomain = crossDomainWhatIf({
        allTx: ctx.allTx,
        category: ctx.causalQuery.category,
        deltaPct: ctx.causalQuery.deltaPct ?? 20,
        referenceDate: ctx.referenceDate || new Date(),
        netWorthStart: ctx.netWorthStart ?? 0,
        years: ctx.netWorthYears ?? 1,
      });
      if (crossDomain.whatIf) {
        const sign = crossDomain.whatIf.totalMonthly >= 0 ? 'libera' : 'costa';
        chain.push(`Impatto cashflow: ${sign} ~${Math.abs(crossDomain.whatIf.totalMonthly)}€/mese (diretto + catena causale).`);
      }
      if (crossDomain.twin) {
        chain.push(`Patrimonio Twin a ${ctx.netWorthYears ?? 1} anno/i: ${crossDomain.twin.deltaP50 >= 0 ? '+' : ''}${crossDomain.twin.deltaP50}€ rispetto a non cambiare nulla (strategia prudente, ipotesi dichiarate).`);
      }
    }

    // STRATO 4: Decisione + auto-verifica
    const decision = ground(ctx); // la regola più fondante applicabile, con fonte
    let selfCheck = { ok: true, checks: [] };
    if (ctx.numericClaim && ctx.numericRecompute != null) {
      const v = verifyArithmetic(ctx.numericClaim, ctx.numericRecompute);
      selfCheck = { ok: v.ok, checks: [v] };
      chain.push(`Auto-verifica aritmetica: ${v.reason}.`);
    }

    // STRATO 5: (hook) l'apprendimento avviene nel DCGN/federated a valle.
    const disclaimer = 'Non è consulenza finanziaria personalizzata: sono proprietà calcolate sui tuoi dati e principi pubblici.';
    return {
      query,
      advice: decision ? decision.cite : (topical[0]?.statement ?? null),
      chainOfThought: chain,
      citations: cites,
      causal,
      crossDomain,
      selfCheck,
      abstain: !decision && !topical.length,
      disclaimer,
    };
  },

  // Auto-descrizione a 5 strati (estende NeuroSym.explain con memoria semantica,
  // causale e auto-verifica): la mappa ONESTA per UI e due diligence.
  explain(profile = null) {
    const base = NeuroSym.explain(profile);
    return {
      engine: 'Omega (NeuroSym)',
      architecture: [
        { layer: 1, name: 'Percezione', real: ['transazioni', 'market-data', 'voice', 'pdf-parser'] },
        { layer: 2, name: 'Memoria', real: ['DCGN episodica (online, decade)', 'semantica (regole con fonte)'] },
        { layer: 3, name: 'Ragionamento', real: ['Nano/Meso/ensemble calibrato', 'causale a lag variabile', 'alpha/8 strategie', 'rischio VaR/Sharpe', 'fusione cross-dominio cashflow+patrimonio (Wave 12)'] },
        { layer: 4, name: 'Decisione', real: ['advisor', 'chain-of-thought con fonte', 'self-check aritmetico', 'astensione su bassa confidenza'] },
        { layer: 5, name: 'Apprendimento', real: ['DCGN Hebbian online', 'federated reputation-weighted', 'self-tuning hardware'] },
      ],
      subsystems: base.layers,
      honesty: base.honesty + ' Il ragionatore FONDA le risposte su regole citabili e si auto-verifica; non genera testo libero né allucina numeri.',
    };
  },
};
