import { ALL_CATS, formatMoney } from '../core/constants.js';
import { VaultDAO } from '../core/vault.js';
import { CAT_RULES, SYNONYMS } from '../core/lexicon.js';

// ==========================================
// NEUROSYNAPSE™ V9.5 & ANTIFOMO CORE
// ==========================================
const CAT_INDICES = {
  'spesa': 0, 'ristoranti': 1, 'shopping': 2, 'abbonamenti': 3, 'trasporti': 4, 'stipendio': 5, 'etf': 6, 'crypto': 7
};
const INDEX_TO_CAT = ['spesa', 'ristoranti', 'shopping', 'abbonamenti', 'trasporti', 'stipendio', 'etf', 'crypto'];

const NeuralNexus = {
  tokenize(text) {
    const stopwords = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'and', 'the', 'for']);
    return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w)).map(w => SYNONYMS[w] || w);
  },
  initPriorWeights(profile) {
    const s = VaultDAO.state.mlData;
    if (!s.neuralNet) {
      s.neuralNet = {
        embeddings: {},
        W1: Array.from({length: 12}, () => Array.from({length: 8}, () => (Math.random() - 0.5) * 0.5)),
        b1: Array.from({length: 12}, () => 0),
        W2: Array.from({length: 8}, () => Array.from({length: 12}, () => (Math.random() - 0.5) * 0.5)),
        b2: Array.from({length: 8}, () => 0)
      };
    }
    
    const net = s.neuralNet;
    const prof = profile || { riskProfile: 'bilanciato', horizon: 'medio' };
    if (prof.riskProfile === 'aggressivo') {
      net.embeddings['investimento'] = [0.1, -0.2, 0.4, 0.3, -0.1, 0.2, 0.5, 0.6];
      net.embeddings['crypto'] = [-0.2, 0.3, 0.1, 0.5, 0.2, -0.4, 0.4, 0.7];
      net.embeddings['etf'] = [0.3, 0.1, 0.2, 0.4, -0.1, 0.3, 0.6, 0.4];
      net.embeddings['futuro'] = [0.2, 0.2, 0.1, 0.3, 0.0, 0.1, 0.5, 0.5];
    } else if (prof.riskProfile === 'conservativo') {
      net.embeddings['risparmio'] = [0.4, 0.3, 0.1, -0.2, 0.5, 0.1, 0.1, -0.3];
      net.embeddings['spesa'] = [0.5, 0.4, -0.3, -0.1, 0.2, -0.2, -0.4, -0.5];
      net.embeddings['bolletta'] = [0.6, 0.3, -0.2, -0.3, 0.1, -0.1, -0.5, -0.4];
    }
  },
  forward(tokens, net) {
    let embSum = Array.from({length: 8}, () => 0);
    let count = 0;
    tokens.forEach(t => {
      if (!net.embeddings[t]) {
        net.embeddings[t] = Array.from({length: 8}, () => (Math.random() - 0.5) * 0.2);
      }
      for (let d = 0; d < 8; d++) {
        embSum[d] += net.embeddings[t][d];
      }
      count++;
    });
    if (count > 0) {
      for (let d = 0; d < 8; d++) embSum[d] /= count;
    }

    let h1 = Array.from({length: 12}, () => 0);
    for (let i = 0; i < 12; i++) {
      let sum = net.b1[i];
      for (let j = 0; j < 8; j++) {
        sum += net.W1[i][j] * embSum[j];
      }
      h1[i] = Math.max(0, sum);
    }

    let logits = Array.from({length: 8}, () => 0);
    for (let i = 0; i < 8; i++) {
      let sum = net.b2[i];
      for (let j = 0; j < 12; j++) {
        sum += net.W2[i][j] * h1[j];
      }
      logits[i] = sum;
    }

    let maxLogit = Math.max(...logits);
    let exps = logits.map(l => Math.exp(l - maxLogit));
    let expSum = exps.reduce((a,b)=>a+b, 0);
    let probs = exps.map(e => e / (expSum || 1));

    return { embSum, h1, logits, probs };
  },
  trainNeural(tokens, targetCat, net) {
    if (tokens.length === 0) return;
    const targetIdx = CAT_INDICES[targetCat];
    if (targetIdx === undefined) return;

    const { embSum, h1, probs } = this.forward(tokens, net);

    let dLogits = probs.slice();
    dLogits[targetIdx] -= 1.0;

    let dh1 = Array.from({length: 12}, () => 0);
    const lr = 0.05;
    const l2 = 1e-4; // weight decay: contrasta overfitting su pochi esempi (dataset personale piccolo)

    // Gradient clipping: limita la norma per evitare update instabili
    // su transazioni con importi anomali (exploding gradient reale, non teorico)
    const clip = (v, max = 5) => Math.max(-max, Math.min(max, v));

    for (let i = 0; i < 8; i++) {
      let dl = clip(dLogits[i]);
      net.b2[i] -= lr * dl;
      for (let j = 0; j < 12; j++) {
        net.W2[i][j] -= lr * (dl * h1[j] + l2 * net.W2[i][j]);
        dh1[j] += net.W2[i][j] * dl;
      }
    }

    let dH1Raw = Array.from({length: 12}, () => 0);
    for (let i = 0; i < 12; i++) {
      dH1Raw[i] = h1[i] > 0 ? clip(dh1[i]) : 0;
    }

    let dEmbSum = Array.from({length: 8}, () => 0);
    for (let i = 0; i < 12; i++) {
      let dh = dH1Raw[i];
      net.b1[i] -= lr * dh;
      for (let j = 0; j < 8; j++) {
        net.W1[i][j] -= lr * (dh * embSum[j] + l2 * net.W1[i][j]);
        dEmbSum[j] += net.W1[i][j] * dh;
      }
    }

    const n = tokens.length;
    tokens.forEach(t => {
      for (let d = 0; d < 8; d++) {
        net.embeddings[t][d] -= lr * clip(dEmbSum[d] / n, 1);
      }
    });
  },

  // Valuta la cross-entropy loss su un set di esempi SENZA aggiornare
  // i pesi — serve al mesh federato per decidere se accettare un merge
  // (vedi momentum_orchestrator.js): un merge che peggiora questa loss
  // viene rifiutato (mitigazione model poisoning).
  validate(examples, net) {
    if (!examples.length) return 0;
    let totalLoss = 0;
    examples.forEach(({ tokens, catId }) => {
      const targetIdx = CAT_INDICES[catId];
      if (targetIdx === undefined) return;
      const { probs } = this.forward(tokens, net);
      totalLoss += -Math.log(Math.max(probs[targetIdx], 1e-10));
    });
    return totalLoss / examples.length;
  },
  train(text, catId, amount = 0, dateObj = new Date()) {
    try {
      const tokens = this.tokenize(text);
      if (tokens.length === 0) return;
      const s = VaultDAO.state.mlData;
      if (!s.catCounts[catId]) s.catCounts[catId] = 0;
      
      tokens.forEach(t => {
        if (!s.vocab[t]) s.vocab[t] = {};
        if (!s.vocab[t][catId]) s.vocab[t][catId] = { count: 0, avgAmount: 0 };
        s.vocab[t][catId].count++;
        s.vocab[t][catId].avgAmount += (amount - s.vocab[t][catId].avgAmount) / s.vocab[t][catId].count;
        s.catCounts[catId]++;
        s.totalWords++;
      });

      if (!s.neuralNet) this.initPriorWeights(VaultDAO.state.onboardingProfile);
      this.trainNeural(tokens, catId, s.neuralNet);

      VaultDAO.save();
    } catch(e) { console.error("ML Train error:", e); }
  },
  predict(text, currentAmount = 0, currentDate = new Date()) {
    try {
      const tokens = this.tokenize(text);
      const s = VaultDAO.state.mlData;
      
      const lower = text.toLowerCase();
      for (const rule of CAT_RULES) {
        if (rule.kw.some(k => lower.includes(k))) return { cat: rule.id, confidence: 75, advice: "Regola neurale intercettata." };
      }

      if (tokens.length === 0 || s.totalWords === 0) {
        return { cat: 'spesa', confidence: 20, advice: "Dati insufficienti. Usato priors di riserva." };
      }

      // 1. Get Naive Bayes probabilities
      const cats = ALL_CATS.map(c => c.id);
      let logScores = {};
      cats.forEach(cat => {
        let catCount = s.catCounts[cat] || 1;
        let logProb = Math.log(catCount / s.totalWords);
        
        tokens.forEach(token => {
          let tData = s.vocab[token] && s.vocab[token][cat];
          let wCount = tData ? tData.count : 0;
          let probWordGivenCat = (wCount + 1) / (catCount + Object.keys(s.vocab).length);
          logProb += Math.log(probWordGivenCat);
        });
        logScores[cat] = logProb;
      });

      let maxLog = -Infinity;
      Object.values(logScores).forEach(v => { if (v > maxLog) maxLog = v; });
      let bayesProbs = {};
      let bayesSum = 0;
      cats.forEach(c => {
        const expVal = Math.exp(logScores[c] - maxLog);
        bayesProbs[c] = expVal;
        bayesSum += expVal;
      });
      cats.forEach(c => { bayesProbs[c] /= (bayesSum || 1); });

      // 2. Get Neural SLM probabilities
      if (!s.neuralNet) this.initPriorWeights(VaultDAO.state.onboardingProfile);
      const neuralOutputs = this.forward(tokens, s.neuralNet);

      // 3. Dynamic Gating combination (alpha decay based on trained count)
      const sampleCount = s.totalWords || 0;
      const alpha = Math.max(0.15, 1.0 / (1.0 + sampleCount / 25.0));

      let finalProbs = {};
      cats.forEach(c => {
        const catIdx = CAT_INDICES[c];
        const neuralProb = neuralOutputs.probs[catIdx] || 0;
        const bayesProb = bayesProbs[c] || 0;
        finalProbs[c] = alpha * bayesProb + (1 - alpha) * neuralProb;
      });

      let bestCat = 'spesa';
      let maxProb = -1;
      cats.forEach(c => {
        if (finalProbs[c] > maxProb) {
          maxProb = finalProbs[c];
          bestCat = c;
        }
      });

      const confidence = Math.round(maxProb * 100);
      return { cat: bestCat, confidence, advice: `Consiglio HBNSN (Gating: ${Math.round(alpha*100)}% Bayes / ${Math.round((1-alpha)*100)}% Neural)` };
    } catch(e) {
      console.error("Prediction error:", e);
      return { cat: 'spesa', confidence: 15, advice: "Errore predizione. Usato fallback." };
    }
  }
};

const AntiFOMO = {
  scan(text) {
    const lower = text.toLowerCase();
    const triggers = ["solo oggi", "offerta", "fomo", "limited", "promo", "to the moon", "hype", "esclusivo", "sconto"];
    return triggers.some(t => lower.includes(t));
  }
};

// ==========================================
// QUANTUMRL™ POLICY ENGINE
// ==========================================
const QuantumRL = {
  getFriction(amount, category) {
    const aggression = VaultDAO.state.aiAggression;
    if (aggression === 'zen') return { level: 'ok', warning: '' };
    
    let budget = VaultDAO.state.monthlyBudget || 1500;
    const profile = VaultDAO.state.onboardingProfile || { riskProfile: 'bilanciato', horizon: 'medio' };
    let toleranceMultiplier = 1.0;
    
    if (profile.riskProfile === 'conservativo') {
      toleranceMultiplier = 0.7;
    } else if (profile.riskProfile === 'aggressivo') {
      toleranceMultiplier = 1.25;
    }
    
    if (profile.horizon === 'breve') {
      toleranceMultiplier *= 0.85;
    }

    const dailyLimit = (budget / 30) * toleranceMultiplier;
    
    if (amount > dailyLimit * 1.5) {
      if (aggression === 'predator') {
        const workDays = Math.ceil(amount / 50);
        return { level: 'block', warning: `Apex Predator: Questa spesa brucia circa ${workDays} giorni di lavoro! Valuta la cancellazione.` };
      }
      return { level: 'warn', warning: `Advisor: Spesa elevata rispetto alla soglia giornaliera tarata (${formatMoney(dailyLimit)}).` };
    }
    return { level: 'ok', warning: '' };
  }
};


export { CAT_INDICES, INDEX_TO_CAT, NeuralNexus, AntiFOMO, QuantumRL };
