import { ALL_CATS, formatMoney } from '../core/constants.js';
import { VaultDAO } from '../core/vault.js';
import { CAT_RULES, SYNONYMS } from '../core/lexicon.js';

// ==========================================
// NEUROSYNAPSE™ V9.5 & ANTIFOMO CORE
// ==========================================
// BUG REALE TROVATO E CORRETTO (Cantiere C4, PIANO_TASK_2026-08-21.md):
// questi due elenchi erano l'intero output della rete — 8 categorie fisse,
// scritte a mano. Da quando l'app ne ha 15 (casa/bollette/salute/istruzione/
// viaggi/svago/risparmio aggiunte dopo), le 7 mancanti avevano un indice
// SEMPRE undefined in predict() -> il contributo neurale per quelle era
// SEMPRE zero. E peggiorava con l'uso: il peso della rete cresce quando
// l'utente addestra di più (vedi `alpha` in predict()), quindi più l'app
// veniva usata più queste 7 categorie diventavano IMPOSSIBILI da predire
// dalla rete — l'opposto di "impara con l'uso".
//
// Restano qui SOLO come SEME per un net nuovo o come chiave di migrazione
// per un net già salvato (i pesi W2 già addestrati sono allineati a questo
// ordine, vanno letti con questa mappa la prima volta, non ricreati da
// zero). Da qui in avanti l'elenco vero vive DENTRO il net stesso
// (net.catIndex/net.indexToCat) e CRESCE da solo — vedi cresciCategoria().
const CAT_INDICES_SEME = {
  'spesa': 0, 'ristoranti': 1, 'shopping': 2, 'abbonamenti': 3, 'trasporti': 4, 'stipendio': 5, 'etf': 6, 'crypto': 7
};
const INDEX_TO_CAT_SEME = ['spesa', 'ristoranti', 'shopping', 'abbonamenti', 'trasporti', 'stipendio', 'etf', 'crypto'];

// Fa crescere l'output della rete di UNA categoria, se `catId` non è ancora
// fra quelle che sa produrre — mai un esempio scartato in silenzio perché
// "non era nell'elenco" (era esattamente il bug sopra). La nuova riga di
// pesi nasce con la stessa inizializzazione delle altre (piccola, casuale):
// impara dal primo esempio in poi, come ogni altra categoria.
function cresciCategoria(net, catId) {
  if (!net.catIndex) net.catIndex = {};
  if (!net.indexToCat) net.indexToCat = [];
  if (Object.prototype.hasOwnProperty.call(net.catIndex, catId)) return net.catIndex[catId];
  const idx = net.indexToCat.length;
  net.catIndex[catId] = idx;
  net.indexToCat.push(catId);
  net.W2.push(Array.from({ length: 12 }, () => (Math.random() - 0.5) * 0.5));
  net.b2.push(0);
  return idx;
}

// Fonde due output di rete cresciuti in modo INDIPENDENTE su due dispositivi
// diversi — il caso che la crescita dinamica rende possibile e che un merge
// "per posizione" romperebbe in silenzio: se il dispositivo A ha imparato
// "casa" prima di "salute" e il dispositivo B il contrario, la riga 8 di A è
// "casa" ma la riga 8 di B è "salute". Fondere riga-con-riga medierebbe due
// categorie diverse — un errore silenzioso, mai un crash, quindi il tipo
// peggiore. Qui si fonde per NOME di categoria, mai per indice grezzo.
// Esportata perché il chiamante (orchestrator.js, mergeRemoteNeuralNet) deve
// costruire la struttura del net FUSO prima di validarlo col cancello.
//
// PESO PER CATEGORIA (non solo globale): la ricerca sul federated learning
// non-IID (RegMean/Fisher averaging, vedi commit successivo) converge su un
// punto — mediare col peso GLOBALE del dispositivo (quanti esempi in
// totale) è ingenuo quando i dati sono eterogenei per categoria, che è
// esattamente il caso reale qui: due persone spendono in modo diverso, una
// ha 300 transazioni "viaggi" e 3 "salute", un'altra il contrario. Se il
// dispositivo locale ha visto "salute" solo 3 volte e il remoto 300, la
// riga fusa deve pendere verso il remoto SU QUELLA categoria, anche se il
// locale ha più esempi in totale su TUTTE le altre. `localCatCounts`/
// `remoteCatCounts` (mlData.catCounts, già tracciati e ora trasmessi via
// mesh, vedi nexus-adapter.js) rendono possibile questo peso mirato; se
// mancano (peer con formato più vecchio, o categoria mai contata da
// nessuno dei due) si ricade sul peso globale invariato — mai un crash,
// mai un NaN.
export function fondiOutputPerNome(localNet, remoteNet, wLocal, wRemote, localCatCounts = null, remoteCatCounts = null) {
  const catLoc = localNet.catIndex || { ...CAT_INDICES_SEME };
  const idxLoc = localNet.indexToCat || [...INDEX_TO_CAT_SEME];
  const catRem = remoteNet.catIndex || { ...CAT_INDICES_SEME };
  const idxRem = remoteNet.indexToCat || [...INDEX_TO_CAT_SEME];

  // L'unione: prima le categorie locali (ordine stabile per chi già le
  // conosce), poi quelle viste SOLO dal remoto, in coda.
  const unione = [...idxLoc];
  for (const cat of idxRem) if (!unione.includes(cat)) unione.push(cat);

  const W2 = [], b2 = [];
  for (const cat of unione) {
    const iL = catLoc[cat], iR = catRem[cat];
    if (iL !== undefined && iR !== undefined) {
      // Entrambi la conoscono: peso per QUESTA categoria se i conteggi ci
      // sono ed è misurabile (evita NaN su 0/0), altrimenti il peso globale.
      const cL = localCatCounts?.[cat] || 0, cR = remoteCatCounts?.[cat] || 0;
      const totCat = cL + cR;
      const [wL, wR] = totCat > 0 ? [cL / totCat, cR / totCat] : [wLocal, wRemote];
      W2.push(localNet.W2[iL].map((v, j) => v * wL + remoteNet.W2[iR][j] * wR));
      b2.push(localNet.b2[iL] * wL + remoteNet.b2[iR] * wR);
    } else if (iL !== undefined) {
      // Solo il locale la conosce: si adotta il suo peso, niente da mediare.
      W2.push(localNet.W2[iL]);
      b2.push(localNet.b2[iL]);
    } else {
      // Solo il remoto la conosce: appresa da un peer, adottata direttamente
      // (stesso principio già usato per le parole nuove in embeddings).
      W2.push(remoteNet.W2[iR]);
      b2.push(remoteNet.b2[iR]);
    }
  }
  return { W2, b2, catIndex: Object.fromEntries(unione.map((c, i) => [c, i])), indexToCat: unione };
}

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
        W2: INDEX_TO_CAT_SEME.map(() => Array.from({ length: 12 }, () => (Math.random() - 0.5) * 0.5)),
        b2: INDEX_TO_CAT_SEME.map(() => 0),
        catIndex: { ...CAT_INDICES_SEME },
        indexToCat: [...INDEX_TO_CAT_SEME],
      };
    } else if (!s.neuralNet.catIndex) {
      // MIGRAZIONE: un net salvato prima di questo fix aveva l'output fisso
      // a 8 righe (W2/b2) ma nessuna mappa che le colleghi alle categorie.
      // Il seme è l'ordine ORIGINALE con cui quelle righe sono state
      // addestrate: usarlo per allineare la mappa preserva i pesi già
      // imparati invece di azzerarli. Da qui in poi il net cresce da solo.
      s.neuralNet.catIndex = { ...CAT_INDICES_SEME };
      s.neuralNet.indexToCat = [...INDEX_TO_CAT_SEME];
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

    // Output DINAMICO: quante categorie il net conosce oggi (net.b2.length),
    // non più 8 fisse — cresce con cresciCategoria() man mano che ne arrivano
    // di nuove, mai un tetto scritto qui.
    const nCat = net.b2.length;
    let logits = Array.from({length: nCat}, () => 0);
    for (let i = 0; i < nCat; i++) {
      let sum = net.b2[i];
      for (let j = 0; j < 12; j++) {
        sum += net.W2[i][j] * h1[j];
      }
      logits[i] = sum;
    }

    let maxLogit = Math.max(...logits, -Infinity);
    let exps = logits.map(l => Math.exp(l - maxLogit));
    let expSum = exps.reduce((a,b)=>a+b, 0);
    let probs = exps.map(e => e / (expSum || 1));

    return { embSum, h1, logits, probs };
  },
  trainNeural(tokens, targetCat, net) {
    if (tokens.length === 0) return;
    // Prima faceva `if (targetIdx === undefined) return` — un esempio di
    // addestramento per una categoria nuova veniva scartato in silenzio,
    // per sempre. Ora la categoria nasce al primo esempio: cresce, non si
    // rifiuta.
    const targetIdx = cresciCategoria(net, targetCat);

    const { embSum, h1, probs } = this.forward(tokens, net);

    let dLogits = probs.slice();
    dLogits[targetIdx] -= 1.0;

    let dh1 = Array.from({length: 12}, () => 0);
    const lr = 0.05;
    const l2 = 1e-4; // weight decay: contrasta overfitting su pochi esempi (dataset personale piccolo)

    // Gradient clipping: limita la norma per evitare update instabili
    // su transazioni con importi anomali (exploding gradient reale, non teorico)
    const clip = (v, max = 5) => Math.max(-max, Math.min(max, v));

    const nCat = net.b2.length; // dinamico, come in forward()
    for (let i = 0; i < nCat; i++) {
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
      // Sola lettura apposta: validate() valuta un merge federato SENZA
      // toccare il net (vedi commento sopra) — mai farlo crescere qui, una
      // categoria mai vista in questo net semplicemente non è valutabile.
      const targetIdx = net.catIndex ? net.catIndex[catId] : undefined;
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

      // La seconda condizione fa scattare la MIGRAZIONE (initPriorWeights)
      // anche su un net già esistente ma salvato prima di questo fix
      // (senza catIndex) — altrimenti resterebbe bloccato alle 8 categorie
      // originali per sempre, esattamente il bug appena corretto.
      if (!s.neuralNet || !s.neuralNet.catIndex) this.initPriorWeights(VaultDAO.state.onboardingProfile);
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
      // La seconda condizione fa scattare la MIGRAZIONE (initPriorWeights)
      // anche su un net già esistente ma salvato prima di questo fix
      // (senza catIndex) — altrimenti resterebbe bloccato alle 8 categorie
      // originali per sempre, esattamente il bug appena corretto.
      if (!s.neuralNet || !s.neuralNet.catIndex) this.initPriorWeights(VaultDAO.state.onboardingProfile);
      const neuralOutputs = this.forward(tokens, s.neuralNet);

      // 3. Dynamic Gating combination (alpha decay based on trained count)
      const sampleCount = s.totalWords || 0;
      const alpha = Math.max(0.15, 1.0 / (1.0 + sampleCount / 25.0));

      // BUG CORRETTO QUI: leggeva CAT_INDICES (8 fisse) invece della mappa
      // vera del net — le 7 categorie aggiunte dopo (casa, bollette, salute,
      // istruzione, viaggi, svago, risparmio) avevano SEMPRE indice
      // undefined, quindi SEMPRE neuralProb=0, e la cosa PEGGIORAVA con
      // l'uso perché `alpha` (il peso di Bayes) scende quando l'utente
      // addestra di più — più si usava l'app, più queste categorie
      // diventavano invisibili alla parte neurale dell'ensemble.
      let finalProbs = {};
      cats.forEach(c => {
        const catIdx = s.neuralNet.catIndex ? s.neuralNet.catIndex[c] : undefined;
        const neuralProb = catIdx !== undefined ? (neuralOutputs.probs[catIdx] || 0) : 0;
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


export { NeuralNexus, AntiFOMO, QuantumRL };
