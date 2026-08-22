import { evaluateMerge } from './merge-gate.js';
import { monthKey } from '../core/constants.js';
import { VaultDAO } from '../core/vault.js';
import { NeuralNexus, fondiOutputPerNome } from './neural-nexus.js';
import { VoiceParser } from '../voice/voice.js';
import { TrainedCategorizer } from './trained-categorizer.js';
import { MeshNode } from '../mesh/mesh-signaling.js';
import { lookupMerchant } from './merchant-dictionary.js';
import { fuseSignals } from './signal-fusion.js';
import { calibrateClassifier, predictSet, conformalQuantile, minCalibrationFor } from './conformal.js';
import { createGraph, observe as dcgnObserve, classify as dcgnClassify, decay as dcgnDecay } from '../graph/dcgn.js';
import { adaptiveExecutionPlan, canActivate } from '../device/adaptive-runtime.js';
import { expertContext, expertWeightFactor, observeExpertOutcome } from './expert-bandit.js';
import { initCalibrationState, recordExpertOutcome, calibrationGate, recordAbstention } from './calibration-gate.js';
import { initMerchantHierarchy, observeMerchant, predictMerchant } from './merchant-hierarchy.js';
import { initMorphology, observeMorphology, predictMorphology, typeTokens } from './merchant-morphology.js';

// ============================================================
// MOMENTUM ORCHESTRATOR — v1.0
// ============================================================
// Onestà tecnica: questo NON è un "MoE" con esperti neurali multipli
// che si allenano insieme — è un router reale e semplice tra i
// sottosistemi già esistenti e funzionanti nella webapp V50.0
// (NeuralNexus per categorizzazione, VoiceParser per la voce,
// import/multi-import.js per gli estratti conto) più il layer nuovo di
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
  constructor({ vaultDAO, neuralNexus, meshNode, trainedCategorizer, trainedMeso, trainedLogReg }) {
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
    // LogReg (src/ai/hashed-logreg.js): 3° esperto STATICO, riaddestrato in
    // locale in JS (nessun Python). Il più forte in generalizzazione ML sul
    // test held-out (81% vs Meso 75%, Nano 54%); in ensemble con Meso porta
    // la generalizzazione a ~85% (misurato, bench/train-eval.mjs). Caricato
    // async come il Meso via setLogReg() quando il profilo lo consente.
    this.logreg = trainedLogReg || null;
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
  setLogReg(trainedLogReg) { this.logreg = trainedLogReg; }

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
        const correct = predictedCat === catId;
        if (correct) cell.right++;
        else cell.wrong++;
        // ── Wave 13 (Meta-Bandit Ensemble): stesso segnale, in più al
        // contesto fine (categoria x lunghezza-descrizione x tier) invece
        // che solo per-categoria. Additivo: se non c'era un contesto
        // registrato in classify() (es. voto dal dizionario) si salta.
        const ctx = this._lastVote.expertContexts?.[model];
        if (ctx) {
          this.vault.state.mlData.expertBandit = observeExpertOutcome(
            this.vault.state.mlData.expertBandit, { context: ctx, source: model, correct }
          );
        }
        // CALIBRAZIONE (src/ai/calibration-gate.js): stesso segnale, domanda
        // diversa. Il bandit sopra impara QUANTE VOLTE questo esperto
        // indovina; qui si impara se la SICUREZZA che dichiarava valeva
        // qualcosa. Un esperto accurato ma spavaldo e' piu' pericoloso di uno
        // meno accurato che sa di non sapere, perche' la sua sicurezza viene
        // creduta — e qui si parla di soldi.
        const confDichiarata = this._lastVote.byConfidence?.[model];
        if (Number.isFinite(confDichiarata)) {
          this.vault.state.mlData.calibrazione = recordExpertOutcome(
            this.vault.state.mlData.calibrazione || initCalibrationState(), model, confDichiarata, correct
          );
        }
      }
      // L'ASTENSIONE, misurata invece che dichiarata: quando ha taciuto,
      // aveva ragione a tacere? Cioe' la risposta che avrebbe dato era
      // davvero sbagliata? Senza questa seconda misura non c'e' modo di
      // sapere se la soglia di astensione e' giusta, alta o bassa — e
      // l'astensione resta pigrizia travestita da prudenza.
      if (this._lastVote.abstained) {
        this.vault.state.mlData.calibrazione = recordAbstention(
          this.vault.state.mlData.calibrazione || initCalibrationState(),
          { astenuto: true, ipotesiMigliore: this._lastVote.ipotesiMigliore, categoriaVera: catId }
        );
      }
      // ── L'INSIEME DI CALIBRAZIONE si costruisce QUI, e da nessun'altra
      // parte: la categoria che l'utente conferma o corregge e' l'unica
      // verita' di riferimento che esista. Il punteggio e' 1 - p(vera), cioe'
      // quanto il modello e' stato "scomodo" su un caso di cui ora sappiamo la
      // risposta. Finestra limitata: la garanzia deve valere su come il
      // modello si comporta ADESSO, non su com'era un anno fa.
      const pVera = this._lastVote.distribuzione?.[catId];
      if (this._lastVote.distribuzione) {
        const prec = this.vault.state.mlData.conformalScores || [];
        this.vault.state.mlData.conformalScores =
          [...prec, Number.isFinite(pVera) ? 1 - pVera : 1].slice(-300);
      }
      this._lastVote = null;
    }

    // ── Gerarchia esercenti (src/ai/merchant-hierarchy.js): ogni conferma o
    // correzione dell'utente alimenta l'albero dei token. È l'unico esperto
    // che generalizza a un punto vendita MAI VISTO della stessa catena.
    // Campo additivo nel vault (regola n.3), creato alla prima osservazione.
    this.vault.state.mlData.merchantHierarchy =
      this.vault.state.mlData.merchantHierarchy || initMerchantHierarchy();
    observeMerchant(this.vault.state.mlData.merchantHierarchy, description, catId,
      date ? new Date(date).getTime() : Date.now());

    // ── Morfologia esercenti (src/ai/merchant-morphology.js): il secondo strato
    // che generalizza per TIPO di attività (pizzeria, farmacia, officina...)
    // indipendentemente dalla posizione del token — copre i piccoli esercenti
    // LOCALI mai visti dove la gerarchia posizionale tace (bench: +76pt di
    // copertura corretta su quel caso). Campo additivo, stessa fonte di verità.
    this.vault.state.mlData.merchantMorphology =
      this.vault.state.mlData.merchantMorphology || initMorphology();
    this.vault.state.mlData.merchantMorphology = observeMorphology(
      this.vault.state.mlData.merchantMorphology, description, catId,
      date ? new Date(date).getTime() : Date.now());

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

    // Nano, Meso e LogReg si dividono il budget restante in proporzione alla
    // loro accuratezza REALE, letta dal modello CARICATO — non un peso
    // arbitrario, e non un numero scritto qui a mano: ogni modello dichiara
    // la propria misura, questo codice la legge. I fallback sotto (0.8/0.85)
    // sono valori prudenti per il caso raro in cui un modello sia caricato
    // ma senza la sua misura (mai un vero numero di oggi: leggere questi tre
    // commenti come "se manca il dato" non come "quanto vale oggi" — i
    // modelli si riaddestrano, un numero scritto qui invecchierebbe in
    // silenzio esattamente come è successo prima di questo fix).
    const nanoAcc = this.trained ? (this.trained.metrics?.test_accuracy || 0.8) : 0;
    const mesoAcc = this.meso ? (this.meso.metrics?.hard_noisy_test_accuracy || 0.85) : 0;
    // BUG REALE CORRETTO (Cantiere C4): prima era `this.logreg ? 0.80 : 0`,
    // incondizionato — l'UNICO dei tre esperti che non provava nemmeno a
    // leggere una misura vera, perché HashedLogReg scartava meta.gate in
    // silenzio al caricamento (corretto in hashed-logreg.js). Il modello
    // spedito dichiara 91,46% held-out (meta.gate.candidateAcc, in punti
    // percentuali) — più alto del fallback 0.80 che finora era l'unico
    // valore mai usato: LogReg era sotto-pesato rispetto alla sua vera forza.
    const logregAcc = this.logreg ? ((this.logreg.meta?.gate?.candidateAcc ?? 80) / 100) : 0;
    const accSum = nanoAcc + mesoAcc + logregAcc || 1;

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

    // LogReg: esperto statico più forte in generalizzazione; vota quando il
    // budget esperti lo consente (come il Meso). Ensemble Meso+LogReg ~85%.
    if (this.logreg && _can('meso')) {
      const p = this.logreg.predict(description);
      candidates.push({ source: 'logreg', category: p.category, confidence: p.confidence, weight: trainedBudget * (logregAcc / accSum) });
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

    // ── Gerarchia esercenti: l'esperto che risponde dove gli altri tirano a
    // indovinare — un punto vendita MAI VISTO di una catena che l'utente ha
    // già categorizzato ("ESSELUNGA VIA RIZZOLI" da "ESSELUNGA"). Nano/Meso/
    // LogReg lì sono fuori vocabolario, che è il limite n.1 misurato del
    // progetto. Tace (null) senza evidenza sufficiente: a freddo l'ensemble
    // si comporta ESATTAMENTE come prima. Il peso cresce con l'evidenza reale.
    const mh = this.vault.state.mlData.merchantHierarchy;
    let hierarchySpoke = false;
    if (mh) {
      const p = predictMerchant(mh, description);
      if (p) {
        hierarchySpoke = true;
        candidates.push({
          source: 'hierarchy',
          category: p.category,
          confidence: p.confidence,
          weight: 0.2 + 0.3 * Math.min(1, p.support / 10),
        });
      }
    }

    // ── Morfologia esercenti: vota SOLO quando la gerarchia tace (è il suo
    // dominio: l'esercente locale mai visto, riconosciuto per TIPO). Così non
    // duplica il voto della gerarchia quando lei sa già rispondere, e resta un
    // recupero mirato sul cold-start. A freddo tace: nessun tipo ancora appreso.
    const mm = this.vault.state.mlData.merchantMorphology;
    let morphologySpoke = false;
    if (mm && !hierarchySpoke) {
      const p = predictMorphology(mm, description);
      if (p) {
        morphologySpoke = true;
        candidates.push({
          source: 'morphology',
          category: p.category,
          confidence: p.confidence,
          // peso base modulato da concentrazione (margine) e supporto reale:
          // un tipo netto e molto visto pesa quanto un voto di gerarchia medio.
          weight: 0.15 + 0.3 * p.margin * Math.min(1, p.support / 6),
        });
      }
    }

    // ── Consenso federato su sonde pubbliche (LIVELLO A —
    // src/mesh/federated-distillation.js, difeso dal rilevatore di deriva
    // lenta in src/mesh/contribution-drift.js): vota SOLO quando gerarchia E
    // morfologia locale hanno taciuto ENTRAMBE — è il recupero per un
    // dispositivo NUOVO che non ha ancora osservato nulla in proprio, mai un
    // sostituto della morfologia locale una volta che questa sa rispondere.
    // Copre solo le parole-tipo generiche di PROBE_SET (poche lingue): peso
    // basso e fisso apposta, perché è un consenso di rete già mediato e
    // filtrato contro l'avvelenamento lento, non un'osservazione diretta.
    const fpc = this.vault.state.mlData.federatedProbeConsensus;
    if (fpc && !hierarchySpoke && !morphologySpoke) {
      const { tokens } = typeTokens(description);
      let best = null;
      for (const t of tokens) {
        const dist = fpc[t];
        if (!dist) continue;
        const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
        if (top && (!best || top[1] > best[1])) best = top;
      }
      if (best && best[1] >= 0.4) {
        candidates.push({ source: 'federated-probe', category: best[0], confidence: best[1], weight: 0.1 });
      }
    }

    // ── v3: il peso di ogni voto è modulato dalla precisione MISURATA di
    // quel modello proprio sulla categoria che sta proponendo (matrice
    // aggiornata in learn() dalle conferme/correzioni reali dell'utente).
    // Moltiplicatore (0.5 + precisione Laplace): neutro (×1.0) senza dati,
    // fino a ×1.5 per un modello sempre giusto su quella categoria, giù
    // verso ×0.5 per uno che lì sbaglia sempre.
    // ── Wave 13 (Meta-Bandit Ensemble, Momentum Core v4): sopra il voto
    // Laplace per-categoria, un secondo fattore più fine — categoria x
    // lunghezza-descrizione x tier-hardware — impara CHI ascoltare in
    // QUESTO contesto specifico. A freddo è 1.0 (neutro): comportamento
    // IDENTICO alla v3 finché non ci sono osservazioni in quel contesto.
    const _tier = (typeof window !== 'undefined' && window.momentumDeviceProfile?.tier) || 'medio';
    const expertContexts = {};
    const calState = this.vault.state.mlData.calibrazione;
    for (const c of candidates) {
      c.weight *= 0.5 + this._measuredReliability(c.source, c.category);
      const ctx = expertContext(c.category, description, _tier);
      expertContexts[c.source] = ctx;
      c.weight *= expertWeightFactor(this.vault.state.mlData.expertBandit, ctx, c.source);
      // IL CANCELLO DI CALIBRAZIONE. `expectedCalibrationError` esisteva da
      // tempo in calibration.js e non aveva mai filtrato NESSUNA previsione:
      // era importata solo da moduli orfani. Qui diventa quello che doveva
      // essere — un cancello, non una metrica da test.
      // A freddo il fattore e' 1 (neutro): comportamento identico a prima
      // finche' non ci sono abbastanza esiti per giudicare.
      c.weight *= calibrationGate(calState, c.source).fattore;
    }
    this._lastVote = {
      description,
      byModel: Object.fromEntries(candidates.map(c => [c.source, c.category])),
      // La sicurezza DICHIARATA da ciascuno, che e' quella su cui si misura
      // la calibrazione quando arrivera' la conferma dell'utente.
      byConfidence: Object.fromEntries(candidates.map(c => [c.source, c.confidence])),
      expertContexts,
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
    // La distribuzione EFFETTIVAMENTE usata per decidere. Va tenuta fuori dal
    // blocco: e' quella su cui si calibra la garanzia conforme, e calibrare su
    // una distribuzione diversa da quella che ha deciso renderebbe la garanzia
    // priva di significato.
    let probsFinali = normalized;
    if (date && (this.vault.state.mlData?.totalWords || 0) >= 0) {
      const fused = fuseSignals(normalized, { amount, date, allTx: this.vault.state.transactions || {} });
      bestCategory = fused.category;
      confidence = Math.round((fused.allProbs[bestCategory] || normalized[bestCategory]) * 100);
      if (fused.allProbs) probsFinali = fused.allProbs;
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
    // ── DA UNA SOGLIA SCELTA A MANO A UNA GARANZIA DIMOSTRATA ──
    // `ABSTAIN_CONFIDENCE = 55` era un numero deciso da noi: non prometteva
    // niente a nessuno. Con quella soglia non si puo' rispondere alla domanda
    // che conta davvero — "su cento volte in cui non chiedo, quante ne
    // sbaglio?" — perche' la confidenza di un modello e' un'opinione del
    // modello su se' stesso, e i modelli piccoli sono troppo sicuri di se'.
    //
    // La predizione conforme (src/ai/conformal.js) usa le CORREZIONI VERE
    // dell'utente come insieme di calibrazione e produce una soglia con una
    // garanzia di copertura dimostrata: al 90%, nel 90% dei casi la categoria
    // giusta e' fra quelle proposte. Cambia anche cosa si chiede: non piu'
    // "confermi tu?" su tutto, ma "e' Bar oppure Ristorante?" — una domanda
    // sola e gia' ristretta, solo dove l'incertezza e' reale.
    //
    // Finche' le correzioni sono troppo poche la garanzia NON e' ottenibile
    // (per il 90% ne servono almeno 9) e si torna alla soglia storica, che
    // resta il comportamento di sempre. Dichiarato in `motivoAstensione`,
    // non nascosto.
    const ABSTAIN_CONFIDENCE = 55; // ripiego finche' non c'e' calibrazione
    const ALPHA_CONFORME = 0.1;
    const distribuzione = probsFinali;
    const cal = { tipo: 'classificazione', scores: this.vault.state.mlData?.conformalScores || [] };
    const qc = conformalQuantile(cal.scores, ALPHA_CONFORME);
    let abstain, insiemeConforme = null, motivoAstensione;
    if (qc.garantito) {
      const set = predictSet(distribuzione, cal, { alpha: ALPHA_CONFORME });
      insiemeConforme = set;
      // Si chiede se le risposte plausibili non sono esattamente una. Zero
      // significa "niente di plausibile": e' il caso piu' importante da non
      // silenziare, perche' e' quasi sempre una categoria nuova.
      abstain = !set.certo;
      motivoAstensione = set.certo ? null
        : set.ampiezza === 0
          ? 'non somiglia a niente di gia' + String.fromCharCode(39) + ' visto'
          : `${set.ampiezza} categorie ancora plausibili`;
    } else {
      abstain = !agree && confidence < ABSTAIN_CONFIDENCE;
      motivoAstensione = abstain
        ? `soglia storica: servono ${minCalibrationFor(ALPHA_CONFORME)} tue conferme per una garanzia vera (ne ho ${qc.n})`
        : null;
    }
    // Si annota QUI l'astensione e l'ipotesi che si sarebbe data, perché è
    // l'unico momento in cui si conoscono entrambe. Alla conferma dell'utente
    // si potrà finalmente rispondere alla domanda che nessuno si faceva:
    // "aveva ragione a tacere?".
    if (this._lastVote) {
      this._lastVote.abstained = abstain;
      this._lastVote.ipotesiMigliore = bestCategory;
      // Serve alla calibrazione conforme: senza la distribuzione di ADESSO,
      // alla conferma dell'utente non si potrebbe piu' sapere quanto il
      // modello era scomodo su quel caso.
      this._lastVote.distribuzione = distribuzione;
    }

    return {
      cat: bestCategory,
      confidence,
      abstain,
      // L'insieme delle risposte ancora plausibili: e' cio' che permette alla
      // UI di chiedere "e' Bar oppure Ristorante?" invece di "confermi tu?".
      insieme: insiemeConforme?.insieme || null,
      garanzia: insiemeConforme ? insiemeConforme.copertura : null,
      motivoAstensione,
      sources: candidates.map(c => c.source),
      advice: abstain
        ? (insiemeConforme?.ampiezza > 1
            ? `Non riesco a decidere fra ${insiemeConforme.insieme.length} categorie: quale delle due e' giusta?`
            : insiemeConforme?.ampiezza === 0
              ? 'Questa non somiglia a niente che abbia gia' + String.fromCharCode(39) + ' visto: dimmi tu cos' + String.fromCharCode(39) + 'e' + String.fromCharCode(39) + '.'
              : `Non sono sicuro (${confidence}%): ${detail}. Confermi tu la categoria?`)
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

    // BUG REALE CORRETTO: W1/b1 restano un merge per posizione (embedding→
    // hidden, dimensione FISSA 8→12, indipendente da quali categorie il
    // dispositivo conosce — sempre allineati). W2/b2 (hidden→categorie) NO:
    // da quando l'output cresce dinamicamente (cresciCategoria), due
    // dispositivi possono aver imparato categorie diverse in ordine diverso,
    // e un merge per posizione fonderebbe "casa" di uno con "salute"
    // dell'altro — un errore silenzioso, mai un crash. fondiOutputPerNome
    // fonde per NOME di categoria, mai per indice grezzo.
    const { W2, b2, catIndex, indexToCat } = fondiOutputPerNome(localNet, remoteNet, wLocal, wRemote);
    const mergedNet = {
      embeddings: mergedEmbeddings,
      W1: mergeMatrix(localNet.W1, remoteNet.W1),
      b1: mergeVector(localNet.b1, remoteNet.b1),
      W2, b2, catIndex, indexToCat,
    };

    // CANCELLO DI MERGE (src/ai/merge-gate.js). Il controllo precedente
    // rifiutava solo oltre +10% sulla singola fusione, e sotto 5 esempi di
    // verifica accettava ALLA CIECA. Due falle misurate: venti merge appena
    // sotto soglia portavano il modello al 561% peggio, e un dispositivo
    // appena installato accettava qualunque cosa — la finestra esatta in cui
    // un attaccante colpirebbe. Ora si giudica rispetto al MIGLIOR modello
    // mai raggiunto, e senza esempi non si accetta.
    const lossBefore = this.nexus.validate(this._validationSet, localNet);
    const lossAfter = this.nexus.validate(this._validationSet, mergedNet);
    const verdetto = evaluateMerge({
      lossBefore, lossAfter,
      bestLoss: this.vault.state.mlData?.bestValidationLoss ?? null,
      validationSize: this._validationSet.length,
    });
    if (!verdetto.accept) {
      return { accepted: false, lossBefore, lossAfter, reason: verdetto.reason };
    }
    if (Number.isFinite(verdetto.nuovoBest)) {
      this.vault.state.mlData.bestValidationLoss = verdetto.nuovoBest;
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
