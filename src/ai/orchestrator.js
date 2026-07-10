import { monthKey } from '../core/constants.js';
import { VaultDAO } from '../core/vault.js';
import { NeuralNexus } from './neural-nexus.js';
import { VoiceParser } from '../voice/voice.js';
import { handlePDFUpload } from '../import/pdf-parser.js';
import { TrainedCategorizer } from './trained-categorizer.js';
import { MeshNode } from '../mesh/mesh-signaling.js';
import { lookupMerchant } from './merchant-dictionary.js';
import { fuseSignals } from './signal-fusion.js';
import { createGraph, observe as dcgnObserve, classify as dcgnClassify, decay as dcgnDecay } from '../graph/dcgn.js';
import { adaptiveExecutionPlan, canActivate } from '../device/adaptive-runtime.js';

// ============================================================
// MOMENTUM ORCHESTRATOR — v1.0
// ============================================================
// Onestà tecnica: questo NON è un "MoE" con esperti neurali multipli
// che si allenano insieme — è un router reale e semplice tra i
// sottosistemi già esistenti e funzionanti nella webapp V50.0
// (NeuralNexus per categorizzazione, VoiceParser per la voce,
// handlePDFUpload per gli estratti conto) più il layer nuovo di
// condivisione federata (mesh P2P). v3: i pesi del voto sono modulati
// dall'affidabilità per-categoria MISURATA sulle conferme/correzioni reali
// dell'utente (matrice di precisione incrementale in mlData.modelStats) —
// il sistema impara anche QUALE dei suoi modelli ascoltare, categoria per
// categoria. Il valore è nel coordinamento
// reale, non in un'invenzione architetturale.
//
// Sostituisce l'uso diretto e sparso di NeuralNexus/VoiceParser nel
// codice della webapp con un unico punto d'ingresso coerente, e
// collega il mesh federato al VERO stato neurale della webapp
// (VaultDAO.state.mlData.neuralNet) invece che a un motore separato
// — un solo cervello nell'app, non due paralleli.
//
// Va incluso DOPO NeuralNexus, VaultDAO, VoiceParser nella pagina.
// ============================================================
'use strict';

class MomentumOrchestrator {
  constructor({ vaultDAO, neuralNexus, meshNode, trainedCategorizer, trainedMeso }) {
    this.vault = vaultDAO;
    this.nexus = neuralNexus;
    this.mesh = meshNode; // istanza di MeshNode (momentum_mesh_signaling.js), opzionale
    // TrainedCategorizer = "Nano" (trained-categorizer.js): modello leggero,
    // sempre caricato, funziona anche su tier minimo. TrainedMeso ("Meso",
    // trained-meso.js): più accurato su testo rumoroso (89.7% vs 80.0% del
    // Nano sullo stesso test, misurato in train_meso.py) ma più pesante —
    // caricato in modo asincrono solo se il profiler κ lo giustifica (vedi
    // initMomentumRealAI in main.js). `setMeso()` lo attacca quando arriva.
    this.trained = trainedCategorizer;
    this.meso = trainedMeso || null;
    this._validationSet = []; // { tokens, catId } — mai usati per il training
    // ── DCGN (src/graph/dcgn.js): il 3° modello REALE, un grafo che impara
    // ONLINE da ogni transazione confermata (nessun retraining). Vive nel
    // vault (serializzabile) e sopravvive ai riavvii. Al primo avvio è vuoto
    // e non vota (la cascata degrada all'ensemble Nano+Meso).
    this.graph = this.vault.state?.mlData?.dcgn || createGraph();
    if (this.vault.state?.mlData) this.vault.state.mlData.dcgn = this.graph;
    this._learnCount = 0;
  }

  setMeso(trainedMeso) { this.meso = trainedMeso; }

  // ── Punto d'ingresso unico per registrare una transazione ──
  // (sostituisce le chiamate dirette sparse a NeuralNexus.train nel
  // codice esistente — stesso comportamento, un solo posto da capire)
  recordTransaction({ description, catId, amount, date, type }) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const tx = {
      id: Date.now() + Math.random(),
      amount, type, category: catId, description,
      date: date.toISOString(),
    };
    this.vault.addTransaction(monthKey, tx);

    this.learn(description, catId, amount, date);
    return tx;
  }

  // ── Solo apprendimento (senza inserire la transazione): per i flussi
  // che aggiungono la transazione per conto proprio (import PDF/CSV con
  // deduplicazione, salvataggio dal form). Mantiene la logica holdout:
  // 1 esempio su 10 va nel set di validazione locale (mai nel training),
  // per proteggere i merge federati dall'avvelenamento.
  learn(description, catId, amount, date) {
    // ── v3: aggiornamento dell'affidabilità per-categoria misurata ──
    // Se questa descrizione è stata appena classificata, la categoria che
    // l'utente CONFERMA (o corregge) è la verità di riferimento: ogni
    // modello che aveva votato viene segnato giusto/sbagliato SULLA
    // categoria che aveva proposto. È la matrice di precisione incrementale
    // che rende i pesi del voto misurati sull'uso reale, non fissi.
    if (this._lastVote && this._lastVote.description === description) {
      const stats = this.vault.state.mlData.modelStats = this.vault.state.mlData.modelStats || {};
      for (const [model, predictedCat] of Object.entries(this._lastVote.byModel)) {
        const m = stats[model] = stats[model] || {};
        const cell = m[predictedCat] = m[predictedCat] || { right: 0, wrong: 0 };
        if (predictedCat === catId) cell.right++;
        else cell.wrong++;
      }
      this._lastVote = null;
    }

    const tokens = this.nexus.tokenize(description);
    const isHoldout = (this.vault.state.mlData.totalWords || 0) % 10 === 9;
    if (isHoldout && this._validationSet.length < 100) {
      this._validationSet.push({ tokens, catId });
    } else {
      this.nexus.train(description, catId, amount, date);
      // DCGN: apprendimento online Hebbiano — la transazione È il training.
      dcgnObserve(this.graph, description, catId);
      // Decadimento periodico (ogni ~200 osservazioni): il grafo resta
      // rilevante e limitato invece di crescere all'infinito.
      if (++this._learnCount % 200 === 0) dcgnDecay(this.graph);
    }
    this.mesh?.broadcastLearning?.();
  }

  // Precisione misurata di un modello sulla categoria che sta proponendo,
  // con lisciatura di Laplace: senza storico vale 0.5 (neutra), e il
  // moltiplicatore (0.5 + precisione) lascia i pesi ESATTAMENTE invariati
  // finché non ci sono dati reali — l'upgrade non inventa mai nulla.
  _measuredReliability(model, predictedCat) {
    const cell = this.vault.state.mlData.modelStats?.[model]?.[predictedCat];
    if (!cell) return 0.5;
    return (cell.right + 1) / (cell.right + cell.wrong + 2);
  }

  // ── Predizione categoria: ENSEMBLE reale a N vie tra NeuralNexus (Naive
  // Bayes + rete che impara continuamente dall'uso), TrainedCategorizer
  // "Nano" (modello fisso, sempre disponibile) e TrainedMeso "Meso" (più
  // accurato su testo rumoroso, presente solo se il tier del dispositivo lo
  // giustifica). Voto pesato per affidabilità REALE misurata di ciascun
  // modello — non un voto a caso, non un confronto binario: si somma il
  // punteggio pesato per ogni categoria proposta e vince il totale più alto,
  // qualunque sia il numero di modelli attivi in questo momento.
  classify(description, amount, date) {
    // ── Stadio 0: dizionario esercenti (src/ai/merchant-dictionary.js) ──
    // Come nei veri sistemi fintech, la maggioranza delle transazioni sono
    // esercenti NOTI: un match diretto è il segnale più forte e affidabile.
    // Se l'utente ha già CORRETTO questo esercente in passato (modelStats),
    // quella correzione ha la precedenza sul dizionario (l'utente ha sempre
    // ragione sui propri dati). Altrimenti il dizionario vince ad alta
    // confidenza. Nessun match → si prosegue col voto dei modelli ML.
    const dict = this._dictionaryHit ? this._dictionaryHit(description) : lookupMerchant(description);
    if (dict) {
      const corrected = this.vault.state.mlData?.modelStats?.dictionary?.[dict.category];
      // se l'utente ha corretto spesso il dizionario su questa categoria, non forzare
      const trustworthy = !corrected || corrected.right >= corrected.wrong;
      if (trustworthy) {
        this._lastVote = { description, byModel: { dictionary: dict.category } };
        return {
          cat: dict.category,
          confidence: Math.round(dict.confidence * 100),
          advice: `Esercente riconosciuto ("${dict.matched}") → ${dict.category}.`,
          source: 'dictionary',
        };
      }
    }

    const nexusPred = this.nexus.predict(description, amount, date);
    if (!this.trained && !this.meso) return nexusPred; // nessun modello addestrato disponibile

    const totalWords = this.vault.state.mlData.totalWords || 0;
    const nexusWeight = Math.min(0.8, 0.2 + totalWords / 500);
    const trainedBudget = 1 - nexusWeight;

    const candidates = [{ source: 'nexus', category: nexusPred.cat, confidence: nexusPred.confidence / 100, weight: nexusWeight }];

    // Il Nano e il Meso si dividono il budget restante in proporzione alla
    // loro accuratezza REALE su testo rumoroso (misurata in train_meso.py:
    // Nano 80.0%, Meso 89.7% sullo stesso test set) — non un peso arbitrario.
    const nanoAcc = this.trained ? (this.trained.metrics?.test_accuracy || 0.8) : 0;
    const mesoAcc = this.meso ? (this.meso.metrics?.hard_noisy_test_accuracy || 0.85) : 0;
    const accSum = nanoAcc + mesoAcc || 1;

    if (this.trained) {
      const p = this.trained.predict(description);
      candidates.push({ source: 'nano', category: p.category, confidence: p.confidence, weight: trainedBudget * (nanoAcc / accSum) });
    }
    // ── Sparse-MoE reale (src/device/adaptive-runtime.js): il budget di
    // esperti del dispositivo decide CHI vota davvero. Su tier minimo solo il
    // Nano (gatekeeper), salendo si sbloccano Meso e DCGN — meno calcolo su
    // hardware debole, mai crash. Senza profilo: tutti attivabili (invariato).
    const _plan = adaptiveExecutionPlan(typeof window !== 'undefined' ? window.momentumDeviceProfile : null);
    const _can = (e) => !window?.momentumDeviceProfile || canActivate(e, _plan);

    if (this.meso && _can('meso')) {
      const p = this.meso.predict(description);
      candidates.push({ source: 'meso', category: p.category, confidence: p.confidence, weight: trainedBudget * (mesoAcc / accSum) });
    }

    // ── DCGN: vota SOLO quando ha imparato abbastanza (≥30 osservazioni),
    // altrimenti tace (mai rumore da un grafo vuoto). Il suo peso parte
    // moderato e cresce con la precisione misurata (come nano/meso). È il
    // modello che migliora ONLINE con l'uso, senza retraining.
    if ((this.graph?.docs || 0) >= 30 && _can('dcgn')) {
      // Adattività hardware: su tier minimo il DCGN usa meno token (più
      // veloce, perdita minima); tier medio/massimo usano tutto. Lo stesso
      // grafo si plasma al dispositivo (src/graph/dcgn.js + compute-planner).
      const tier = (typeof window !== 'undefined' && window.momentumDeviceProfile?.tier) || 'medio';
      const maxTokens = tier === 'minimo' ? 24 : tier === 'medio' ? 60 : 0; // 0 = illimitato
      const p = dcgnClassify(this.graph, description, maxTokens ? { maxTokens } : {});
      if (p.category) {
        candidates.push({ source: 'dcgn', category: p.category, confidence: (p.confidence || 0) / 100, weight: 0.3 });
      }
    }

    // ── v3: il peso di ogni voto è modulato dalla precisione MISURATA di
    // quel modello proprio sulla categoria che sta proponendo (matrice
    // aggiornata in learn() dalle conferme/correzioni reali dell'utente).
    // Moltiplicatore (0.5 + precisione Laplace): neutro (×1.0) senza dati,
    // fino a ×1.5 per un modello sempre giusto su quella categoria, giù
    // verso ×0.5 per uno che lì sbaglia sempre.
    for (const c of candidates) {
      c.weight *= 0.5 + this._measuredReliability(c.source, c.category);
    }
    this._lastVote = {
      description,
      byModel: Object.fromEntries(candidates.map(c => [c.source, c.category])),
    };

    const scoreByCategory = {};
    for (const c of candidates) {
      scoreByCategory[c.category] = (scoreByCategory[c.category] || 0) + c.confidence * c.weight;
    }
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0) || 1;

    // ── Fusione multi-segnale (src/ai/signal-fusion.js): il voto testuale
    // viene aggiustato con i profili di IMPORTO e ORARIO appresi dai dati
    // reali dell'utente. Attiva solo con ≥20 transazioni e una data valida;
    // il testo resta dominante. Rende la predizione un vero multi-segnale
    // senza toccare il modello sklearn verificato.
    let bestCategory, confidence;
    const normalized = {};
    for (const cat of Object.keys(scoreByCategory)) normalized[cat] = scoreByCategory[cat] / totalWeight;
    if (date && (this.vault.state.mlData?.totalWords || 0) >= 0) {
      const fused = fuseSignals(normalized, { amount, date, allTx: this.vault.state.transactions || {} });
      bestCategory = fused.category;
      confidence = Math.round((fused.allProbs[bestCategory] || normalized[bestCategory]) * 100);
    } else {
      bestCategory = Object.keys(scoreByCategory).reduce((a, b) => scoreByCategory[a] >= scoreByCategory[b] ? a : b);
      confidence = Math.round(normalized[bestCategory] * 100);
    }

    const agree = new Set(candidates.map(c => c.category)).size === 1;
    const detail = candidates.map(c => `${c.source}:${c.category}(${Math.round(c.confidence * 100)}%)`).join(' · ');

    // ── Astensione: "so di non sapere" ──
    // Il punto chiave di un'AI che capisce a priori i propri errori: quando
    // i modelli sono in disaccordo E la confidenza combinata è bassa, invece
    // di forzare una categoria (sbagliando con sicurezza) l'esito è
    // `abstain: true`. La UI chiede conferma all'utente e quella risposta
    // diventa training (active learning, via modelStats). Un dizionario-hit
    // non arriva mai qui (ha già restituito ad alta confidenza sopra).
    // Soglie dichiarate; nessuna astensione se i modelli concordano.
    const ABSTAIN_CONFIDENCE = 55; // sotto → non abbastanza sicuri
    const abstain = !agree && confidence < ABSTAIN_CONFIDENCE;

    return {
      cat: bestCategory,
      confidence,
      abstain,
      sources: candidates.map(c => c.source),
      advice: abstain
        ? `Non sono sicuro (${confidence}%): ${detail}. Confermi tu la categoria?`
        : agree ? `Ensemble concorde (${detail}).` : `Ensemble in disaccordo, vince ${bestCategory} per punteggio pesato (${detail}).`,
    };
  }

  // ── Momentum Core: API unificata dell'architettura proprietaria ──
  // Un solo punto d'ingresso che restituisce la categoria + confidenza +
  // astensione + le fonti che hanno votato. `classify()` resta l'alias
  // retro-compatibile usato dai call-site esistenti. Questo è il nome
  // pubblico dell'architettura-sistema (vedi MOMENTUM_CORE.md).
  infer(description, amount, date) {
    const r = this.classify(description, amount, date);
    return {
      category: r.cat,
      confidence: r.confidence,
      abstain: !!r.abstain,
      sources: r.sources || (r.source ? [r.source] : ['nexus']),
      explanation: r.advice,
    };
  }

  // ── Merge federato applicato al VERO stato neurale della webapp ──
  // Sostituisce la logica di merge scritta per il motore standalone:
  // qui opera direttamente su VaultDAO.state.mlData.neuralNet.
  mergeRemoteNeuralNet(remoteNet, remoteExampleCount) {
    const localNet = this.vault.state.mlData.neuralNet;
    const localExampleCount = this.vault.state.mlData.totalWords || 1;
    const total = localExampleCount + remoteExampleCount;
    const wLocal = localExampleCount / total;
    const wRemote = remoteExampleCount / total;

    const mergeMatrix = (a, b) => a.map((row, i) => row.map((v, j) => v * wLocal + b[i][j] * wRemote));
    const mergeVector = (a, b) => a.map((v, i) => v * wLocal + b[i] * wRemote);

    const mergedEmbeddings = { ...localNet.embeddings };
    for (const [word, vec] of Object.entries(remoteNet.embeddings || {})) {
      mergedEmbeddings[word] = mergedEmbeddings[word]
        ? mergedEmbeddings[word].map((v, i) => v * wLocal + vec[i] * wRemote) // parola condivisa: media pesata
        : vec; // parola nuova appresa solo dal peer: adottata direttamente
    }

    const mergedNet = {
      embeddings: mergedEmbeddings,
      W1: mergeMatrix(localNet.W1, remoteNet.W1),
      b1: mergeVector(localNet.b1, remoteNet.b1),
      W2: mergeMatrix(localNet.W2, remoteNet.W2),
      b2: mergeVector(localNet.b2, remoteNet.b2),
    };

    // Controllo anti-avvelenamento: rifiuta se peggiora la loss di validazione
    if (this._validationSet.length >= 5) {
      const lossBefore = this.nexus.validate(this._validationSet, localNet);
      const lossAfter = this.nexus.validate(this._validationSet, mergedNet);
      if (lossAfter > lossBefore * 1.1) {
        return { accepted: false, lossBefore, lossAfter };
      }
    }

    this.vault.state.mlData.neuralNet = mergedNet;
    this.vault.state.mlData.totalWords = total;
    this.vault.save();
    return { accepted: true, totalExamples: total };
  }

  getValidationSetSize() {
    return this._validationSet.length;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MomentumOrchestrator };
}



export { MomentumOrchestrator };
