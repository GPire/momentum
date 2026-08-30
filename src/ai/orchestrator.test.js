import test from "node:test";
import assert from "node:assert/strict";

// orchestrator.js importa (transitivamente, via vault.js -> constants.js e
// altri moduli scritti per il browser) riferimenti a `window`/`navigator`/
// `document` valutati al top-level del modulo. Shim minimo solo per poter
// testare in Node la logica pura di classify()/setMeso(), senza jsdom.
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0, hardwareConcurrency: 4 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };

const { MomentumOrchestrator } = await import("./orchestrator.js");
const { NeuralNexus } = await import("./neural-nexus.js");
const { createGraph: dcgnCreateGraph, observe: dcgnObserve } = await import("../graph/dcgn.js");

function mockVault(totalWords = 0) {
  return { state: { mlData: { totalWords } } };
}

test("con solo NeuralNexus disponibile, classify ritorna la predizione grezza", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 70 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(), neuralNexus: nexus });
  const result = orch.classify("acme xyz corp", 30, new Date());
  assert.equal(result.cat, "spesa");
});

test("ensemble a 2 vie concorde: Nano e NeuralNexus d'accordo, alta confidenza combinata", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 60 }) };
  const trained = { metrics: { test_accuracy: 0.9 }, predict: () => ({ category: "spesa", confidence: 0.95 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus, trainedCategorizer: trained });
  const result = orch.classify("acme xyz corp", 30, new Date());
  assert.equal(result.cat, "spesa");
  assert.ok(result.advice.includes("concorde"));
});

test("ensemble a 3 vie: il Meso, più accurato, pesa di più del Nano quando sono in disaccordo", () => {
  const nexus = { predict: () => ({ cat: "trasporti", confidence: 40 }) }; // poco sicuro, peso basso con totalWords=0
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const result = orch.classify("acme xyz corp", 12, new Date());
  // il Meso ha peso e confidenza maggiori: resta la categoria in testa (spesa).
  // Ma con 3 modelli su 3 categorie diverse la confidenza combinata è bassa,
  // quindi il sistema ONESTAMENTE si astiene invece di forzare (comportamento
  // corretto dell'astensione: sa di non sapere abbastanza).
  assert.equal(result.cat, "spesa");
  assert.equal(result.abstain, true);
});

test("setMeso attiva l'ensemble a 3 vie dopo il caricamento asincrono", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 50 }) };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "spesa", confidence: 0.8 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus, trainedCategorizer: trained });
  const before = orch.classify("test", 10, new Date());
  assert.ok(before.advice.includes("Ensemble"));
  assert.equal(orch.meso, null);

  const meso = { metrics: { hard_noisy_test_accuracy: 0.9 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  orch.setMeso(meso);
  assert.equal(orch.meso, meso);
  const after = orch.classify("test", 10, new Date());
  assert.ok(after.advice.includes("meso:"));
});

test("il peso di NeuralNexus cresce con l'uso reale (totalWords alto)", () => {
  const nexus = { predict: () => ({ cat: "shopping", confidence: 90 }) };
  const trained = { metrics: { test_accuracy: 0.9 }, predict: () => ({ category: "spesa", confidence: 0.95 }) };
  // con molto uso, NeuralNexus (specializzato su questo utente) deve poter vincere
  // anche contro un Nano molto sicuro
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(5000), neuralNexus: nexus, trainedCategorizer: trained });
  const result = orch.classify("test", 10, new Date());
  assert.equal(result.cat, "shopping");
});

// ---- v3: affidabilità per-categoria misurata ----

function mockVaultV3() {
  return { state: { mlData: { totalWords: 0 } }, save() {} };
}
const nexusTrainable = (cat, conf) => ({
  predict: () => ({ cat, confidence: conf }),
  tokenize: t => t.split(' '),
  train: () => {},
});

test("v3: senza storico di correzioni i pesi restano ESATTAMENTE neutri (nessuna invenzione)", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  // identico al comportamento pre-v3: vince il Meso (peso base + confidenza maggiori)
  assert.equal(orch.classify("acme xyz corp", 12, new Date()).cat, "spesa");
});

test("v3: le correzioni reali dell'utente spostano il voto verso il modello che ci prende", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });

  // L'utente corregge più volte: la verità era "ristoranti" (il Nano aveva
  // ragione, il Meso torto). La matrice di precisione deve accumularsi...
  for (let i = 0; i < 6; i++) {
    orch.classify("acme xyz corp", 12, new Date());
    orch.learn("acme xyz corp", "ristoranti", 12, new Date());
  }
  const stats = orch.vault.state.mlData.modelStats;
  assert.equal(stats.meso["spesa"].wrong, 6);
  assert.equal(stats.nano["ristoranti"].right, 6);

  // ...e ora lo stesso caso deve essere vinto dal Nano (misurato > dichiarato)
  assert.equal(orch.classify("acme xyz corp", 12, new Date()).cat, "ristoranti");
});

// ---- Wave 13 (Meta-Bandit Ensemble, Momentum Core v4) ----

test("meta-bandit: le conferme ripetute popolano expertBandit con contesto categoria x lunghezza x tier", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  for (let i = 0; i < 6; i++) {
    orch.classify("acme xyz corp", 12, new Date());
    orch.learn("acme xyz corp", "ristoranti", 12, new Date());
  }
  const arms = orch.vault.state.mlData.expertBandit.arms;
  // nano ha votato giusto (ristoranti) 6 volte in questo contesto: la sua
  // media a posteriori deve essere salita sopra il prior neutro (0.5).
  const nanoCtxKey = `ristoranti|short|medio`;
  assert.ok(arms[`${nanoCtxKey}|nano`], 'expertBandit deve avere un arm per nano in questo contesto');
  assert.ok(arms[`${nanoCtxKey}|nano`].a > arms[`${nanoCtxKey}|nano`].b, 'nano premiato in questo contesto (a>b)');
});

test("meta-bandit: un esperto privilegiato in UN contesto non contamina un contesto diverso (fine-grain reale)", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const shortDesc = "acme xyz corp"; // < 15 char -> bucket 'short'
  for (let i = 0; i < 8; i++) {
    orch.classify(shortDesc, 12, new Date());
    orch.learn(shortDesc, "ristoranti", 12, new Date());
  }
  const arms = orch.vault.state.mlData.expertBandit.arms;
  // Un contesto MAI osservato (descrizione lunga, stessa categoria) deve
  // restare al prior neutro: nessuna contaminazione cross-contesto.
  const untouchedKey = `ristoranti|long|medio|nano`;
  assert.equal(arms[untouchedKey], undefined, 'un contesto mai visto non deve avere un arm');
});

test("meta-bandit: a freddo (0 osservazioni in expertBandit) il comportamento resta ESATTAMENTE quello v3", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  // stesso esito atteso del test "v3: senza storico... pesi restano ESATTAMENTE neutri"
  assert.equal(orch.classify("acme xyz corp", 12, new Date()).cat, "spesa");
});

test("meta-bandit: degrado gentile se mlData.expertBandit e' assente (stato precedente alla wave 13)", () => {
  const nexus = nexusTrainable("spesa", 60);
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus }); // mockVault non ha expertBandit
  const r = orch.classify("acme xyz corp", 30, new Date());
  assert.equal(r.cat, "spesa"); // nessun crash, nessuna regressione
});

test("v3: learn senza classify precedente non inventa statistiche", () => {
  const nexus = nexusTrainable("spesa", 60);
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  orch.learn("bolletta enel", "utenze", 78, new Date());
  assert.equal(orch.vault.state.mlData.modelStats, undefined);
});

// ---- astensione ("so di non sapere") ----

test("astensione: modelli in disaccordo e confidenza bassa → abstain true", () => {
  // tre modelli, tre categorie diverse, tutti a bassa confidenza → nessuno domina
  const nexus = { predict: () => ({ cat: "trasporti", confidence: 30 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "ristoranti", confidence: 0.34 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.85 }, predict: () => ({ category: "shopping", confidence: 0.33 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const r = orch.classify("acme xyz corp", 12, new Date());
  assert.equal(r.abstain, true);
  assert.ok(r.advice.includes("Non sono sicuro"));
});

test("astensione: modelli concordi → mai astensione (anche se ambiguo)", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 40 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "spesa", confidence: 0.4 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("acme xyz corp", 12, new Date());
  assert.equal(r.abstain, false);
});

test("astensione: esercente noto (dizionario) non astiene mai", () => {
  const nexus = { predict: () => ({ cat: "trasporti", confidence: 30 }), tokenize: t => t.split(' '), train: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  const r = orch.classify("netflix", 12, new Date());
  assert.equal(r.cat, "abbonamenti");
  assert.ok(!r.abstain);
});

// ---- Momentum Core: API unificata infer() ----

test("infer(): API unificata restituisce category/confidence/abstain/sources", () => {
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: { predict: () => ({ cat: "spesa", confidence: 60 }), tokenize: t => t.split(' '), train: () => {} } });
  const r = orch.infer("netflix", 12, new Date());
  assert.equal(r.category, "abbonamenti"); // dizionario
  assert.equal(typeof r.confidence, "number");
  assert.equal(r.abstain, false);
  assert.ok(Array.isArray(r.sources));
});

test("infer(): retro-compatibile con classify() sulla categoria", () => {
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: { predict: () => ({ cat: "spesa", confidence: 60 }), tokenize: t => t.split(' '), train: () => {} } });
  assert.equal(orch.infer("acme xyz", 10, new Date()).category, orch.classify("acme xyz", 10, new Date()).cat);
});

// ---- DCGN in produzione: apprendimento online ----

test("DCGN: impara online e inizia a votare dopo abbastanza osservazioni", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 30 }), tokenize: t => t.split(' '), train: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  // insegna un esercente nuovo 35 volte (soglia DCGN = 30)
  for (let i = 0; i < 35; i++) orch.learn("bottega artigiana zzz", "shopping", 20, new Date());
  // ora il grafo ha imparato; l'orchestratore lo include tra i votanti
  const r = orch.classify("bottega artigiana zzz", 20, new Date());
  assert.ok(orch.graph.docs >= 30, "il grafo deve aver accumulato osservazioni");
  assert.ok(r.cat, "la classificazione produce una categoria");
});

test("DCGN: grafo vuoto non vota (nessun rumore al primo avvio)", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 70 }), tokenize: t => t.split(' '), train: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  const r = orch.classify("xyz mai visto", 10, new Date());
  assert.equal(orch.graph.docs, 0);
  assert.equal(r.cat, "spesa"); // solo NeuralNexus
});

// ---- Sparse-MoE reale: budget esperti gatea il voto in produzione ----

test("sparse-MoE: su tier minimo solo Nano vota (Meso escluso dal budget device)", () => {
  const prevProfile = globalThis.window.momentumDeviceProfile;
  globalThis.window.momentumDeviceProfile = { tier: 'minimo' };
  const nexus = { predict: () => ({ cat: "spesa", confidence: 50 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "spesa", confidence: 0.8 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.9 }, predict: () => ({ category: "ristoranti", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const r = orch.classify("acme xyz", 10, new Date());
  // su minimo il Meso NON è nel budget → non deve comparire tra le fonti
  assert.ok(!(r.sources || []).includes('meso'), 'Meso non deve votare su tier minimo');
  globalThis.window.momentumDeviceProfile = prevProfile;
});

test("sparse-MoE: su tier massimo Meso è attivabile", () => {
  const prevProfile = globalThis.window.momentumDeviceProfile;
  globalThis.window.momentumDeviceProfile = { tier: 'massimo' };
  const nexus = { predict: () => ({ cat: "spesa", confidence: 50 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "spesa", confidence: 0.8 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.9 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const r = orch.classify("acme xyz", 10, new Date());
  assert.ok((r.sources || []).includes('meso'), 'Meso deve votare su tier massimo');
  globalThis.window.momentumDeviceProfile = prevProfile;
});

// ── INTEGRAZIONE: la morfologia recupera l'esercente LOCALE mai visto dove la
// gerarchia posizionale tace (cablaggio reale in learn()+classify()). ────────
test("morfologia in produzione: un tipo-LACUNA (ignoto al dizionario) categorizza un locale MAI visto", () => {
  const nexus = { predict: () => ({ cat: null, confidence: 0 }), tokenize: t => t.split(' '), train: () => {} };
  // un modello addestrato (che qui tace) serve solo ad attivare il percorso
  // ensemble; senza, l'orchestratore restituirebbe la sola predizione grezza.
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: null, confidence: 0 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained });
  // "officina" NON è nel dizionario statico: l'utente conferma 3 officine diverse
  // (insegne/primo-token diversi) come 'trasporti'. Il tipo si impara da solo.
  orch.learn("DA GINO OFFICINA", "trasporti", 120, new Date());
  orch.learn("OFFICINA ROSSI SUD", "trasporti", 90, new Date());
  orch.learn("MECCANICA BIANCHI OFFICINA", "trasporti", 150, new Date());
  // una QUARTA officina mai vista, primo token ancora diverso: dizionario muto,
  // gerarchia senza genitore utile → la morfologia è l'unico segnale corretto.
  const r = orch.classify("AUTORIPARAZIONI VERDI OFFICINA CENTRO", 110, new Date());
  assert.equal(r.cat, "trasporti", "il tipo 'officina' trasferisce la categoria all'esercente locale nuovo");
  assert.ok((r.sources || []).includes("morphology"), "il voto deve arrivare dallo strato morfologico");
});

test("morfologia a freddo: nessun tipo appreso → non vota (nessuna invenzione)", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 55 }), tokenize: t => t.split(' '), train: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  const r = orch.classify("OFFICINA QUALUNQUE", 10, new Date());
  assert.ok(!(r.sources || []).includes("morphology"), "a freddo lo strato morfologico tace");
});

// ── C4 (PIANO_TASK_2026-08-21.md): il peso di LogReg legge la sua vera
// accuratezza dichiarata (meta.gate.candidateAcc), non più un fisso 0.80
// incondizionato — bug reale trovato e corretto (HashedLogReg scartava
// meta.gate al caricamento, orchestrator.js non poteva mai leggerlo). ─────
test("C4: il peso di LogReg usa meta.gate.candidateAcc quando presente, non il fallback fisso — cambia davvero l'esito", () => {
  const nexus = { predict: () => ({ cat: null, confidence: 0 }), tokenize: t => t.split(' '), train: () => {} };
  // Tarato apposta: con l'ex fallback fisso (0.80) nano vince per un pelo;
  // con la vera accuratezza dichiarata (91,46%) vince LogReg. La differenza
  // di esito prova che il numero letto conta davvero, non solo che esiste.
  const trained = { metrics: { test_accuracy: 0.79 }, predict: () => ({ category: "spesa", confidence: 1.0 }) };
  const logregSenzaMeta = { meta: null, predict: () => ({ category: "trasporti", confidence: 0.98, allProbs: { trasporti: 0.98, spesa: 0.02 } }) };
  const logregConMeta = { meta: { gate: { candidateAcc: 91.46 } }, predict: () => ({ category: "trasporti", confidence: 0.98, allProbs: { trasporti: 0.98, spesa: 0.02 } }) };

  const rFallback = new MomentumOrchestrator({ vaultDAO: mockVault(), neuralNexus: nexus, trainedCategorizer: trained, trainedLogReg: logregSenzaMeta })
    .classify("acme xyz", 10, new Date());
  const rReale = new MomentumOrchestrator({ vaultDAO: mockVault(), neuralNexus: nexus, trainedCategorizer: trained, trainedLogReg: logregConMeta })
    .classify("acme xyz", 10, new Date());

  assert.equal(rFallback.cat, "spesa", "senza meta.gate, il fallback 0.80 lascia vincere nano");
  assert.equal(rReale.cat, "trasporti", "con la vera accuratezza (91,46%), LogReg vince davvero");
});

test("C4: senza LogReg caricato, nessun voto 'logreg' compare (invariato)", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 60 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "spesa", confidence: 0.8 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(), neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("acme xyz", 10, new Date());
  assert.ok(!(r.sources || []).includes("logreg"));
});

// ── Categorie dinamiche (2026-08-30): scoreByCategory NON enumera un
// elenco fisso di categorie da nessuna parte (a differenza del bug trovato
// e corretto in bench/categorizer-bench.mjs, dove l'universo di voto era
// limitato a `meso.categories`) — accumula qualunque stringa proponga
// ciascun esperto. Questo significa che una categoria che SOLO NeuralNexus
// conosce (perché cresce dinamicamente per categoria, mai Nano/Meso, che
// sono esperti statici pre-addestrati offline) può vincere il voto anche
// quando gli esperti statici non l'hanno mai vista — verificato qui, non
// solo assunto dalla lettura del codice. ──
test("categoria dinamica: una categoria che SOLO NeuralNexus conosce può vincere il voto, anche se Nano/Meso non l'hanno mai vista", () => {
  // totalWords alto = dispositivo con storico reale (NON cold-start): il
  // peso di NeuralNexus (nexusWeight = min(0.8, 0.2+totalWords/500)) cresce
  // con quanto l'utente ha già insegnato all'app — coerente con "una
  // categoria personalizzata che l'utente ha corretto molte volte deve
  // poter vincere", non un dispositivo mai usato.
  const nexus = { predict: () => ({ cat: "hobby_personalizzato", confidence: 85 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "shopping", confidence: 0.5 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.8 }, predict: () => ({ category: "shopping", confidence: 0.5 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(2000), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const r = orch.classify("acquisto modellismo ferroviario", 40, new Date());
  assert.equal(r.cat, "hobby_personalizzato", "una categoria mai vista dagli esperti statici deve poter vincere via NeuralNexus, senza bisogno di riaddestrare Nano/Meso");
});

// ── Consenso federato (LIVELLO A — src/mesh/federated-distillation.js,
// difeso dal rilevatore di deriva lenta in src/mesh/contribution-drift.js):
// il recupero per un dispositivo NUOVO senza storico locale. ───────────────
test("consenso federato: un dispositivo NUOVO senza storico locale usa il consenso di rete su una parola-tipo generica", () => {
  // "notaio" era la parola-tipo originale di questo test, finché il
  // dizionario esercenti (Fase 1, 2026-08-30: src/ai/merchant-dictionary.js)
  // non ha imparato "notaio"→professionale — ora Stadio 0 risponde da solo
  // e il test smetteva di esercitare il fallback federato che vuole
  // verificare. Sostituita con una parola-tipo genuinamente sconosciuta a
  // dizionario/morfologia (mai un vero esercente), l'intento del test resta
  // identico.
  const nexus = { predict: () => ({ cat: null, confidence: 0 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: null, confidence: 0 }) };
  const vault = mockVaultV3();
  vault.state.mlData.federatedProbeConsensus = { glorfindo: { legale: 0.9, altro: 0.1 } };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("GLORFINDO ROSSI CENTRO", 15, new Date());
  assert.equal(r.cat, "legale");
  assert.ok((r.sources || []).includes("federated-probe"), "il voto deve arrivare dal consenso federato");
});

test("consenso federato: tace se la morfologia LOCALE sa già rispondere (precede solo il cold-start assoluto, non la sostituisce)", () => {
  const nexus = { predict: () => ({ cat: null, confidence: 0 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: null, confidence: 0 }) };
  const vault = mockVaultV3();
  vault.state.mlData.federatedProbeConsensus = { officina: { spesa: 0.9 } };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: trained });
  orch.learn("DA GINO OFFICINA", "trasporti", 120, new Date());
  orch.learn("OFFICINA ROSSI SUD", "trasporti", 90, new Date());
  orch.learn("MECCANICA BIANCHI OFFICINA", "trasporti", 150, new Date());
  const r = orch.classify("AUTORIPARAZIONI VERDI OFFICINA CENTRO", 110, new Date());
  assert.equal(r.cat, "trasporti");
  assert.ok(!(r.sources || []).includes("federated-probe"), "la morfologia locale ha già risposto: il federato non deve votare sopra di lei");
});

test("consenso federato: sotto la soglia di confidenza non vota (meglio tacere che indovinare)", () => {
  const nexus = { predict: () => ({ cat: null, confidence: 0 }), tokenize: t => t.split(' '), train: () => {} };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: null, confidence: 0 }) };
  const vault = mockVaultV3();
  vault.state.mlData.federatedProbeConsensus = { notaio: { legale: 0.35, altro: 0.3, spesa: 0.35 } };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("NOTAIO ROSSI CENTRO", 15, new Date());
  assert.ok(!(r.sources || []).includes("federated-probe"), "0.35 di confidenza non basta per votare");
});

// ── Predizione conforme: da una soglia scelta a mano a una garanzia ──

// Un vault con calibrazione: gli score sono 1 - p(vera) sulle correzioni
// dell'utente. Tutti bassi = il modello e' stato quasi sempre a suo agio.
function vaultConCalibrazione(scores, totalWords = 0) {
  return { state: { mlData: { totalWords, conformalScores: scores } } };
}

test("CONFORME: senza abbastanza conferme dell'utente si usa la soglia storica, e lo dichiara", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 40 }) };
  const trained = { metrics: { test_accuracy: 0.6 }, predict: () => ({ category: "svago", confidence: 0.42 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: vaultConCalibrazione([0.2, 0.3]), neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("qualcosa di ambiguo", 30, new Date());
  assert.equal(r.garanzia, null, "nessuna garanzia con due sole conferme");
  assert.match(r.motivoAstensione || "", /servono 9 tue conferme/);
});

test("CONFORME: con abbastanza conferme la garanzia esiste ed e' dichiarata", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 95 }) };
  const trained = { metrics: { test_accuracy: 0.95 }, predict: () => ({ category: "spesa", confidence: 0.97 }) };
  // Descrizione senza senso apposta: un colpo nel dizionario esercenti
  // uscirebbe prima, ad alta confidenza, senza passare dalla conforme.
  // 30 conferme in cui il modello era quasi sempre a suo agio.
  const scores = Array.from({ length: 30 }, (_, i) => 0.02 + (i % 5) * 0.01);
  const orch = new MomentumOrchestrator({ vaultDAO: vaultConCalibrazione(scores), neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("zzqx wvtr 4471", 30, new Date());
  assert.equal(r.garanzia, 0.9);
  assert.ok(Array.isArray(r.insieme), "la UI deve ricevere l'insieme, non solo una categoria");
});

test("CONFORME: quando restano due categorie plausibili la domanda e' RISTRETTA, non generica", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 50 }) };
  const trained = { metrics: { test_accuracy: 0.8 }, predict: () => ({ category: "svago", confidence: 0.5 }) };
  // Calibrazione larga: il modello e' stato spesso scomodo, quindi la soglia
  // conforme e' alta e piu' categorie restano plausibili.
  const scores = Array.from({ length: 40 }, () => 0.62);
  const orch = new MomentumOrchestrator({ vaultDAO: vaultConCalibrazione(scores), neuralNexus: nexus, trainedCategorizer: trained });
  const r = orch.classify("posto ambiguo", 30, new Date());
  if (r.insieme && r.insieme.length > 1) {
    assert.equal(r.abstain, true);
    assert.match(r.advice, /quale delle due/);
    assert.match(r.motivoAstensione, /categorie ancora plausibili/);
  } else {
    assert.equal(r.abstain, false, "con una sola categoria plausibile non si disturba nessuno");
  }
});

// learn() addestra anche il NeuralNexus: il finto deve esporne l'API minima.
// Con il solo NeuralNexus classify() esce prima dell'ensemble: per esercitare
// il percorso conforme serve almeno un secondo esperto che voti.
const secondoEsperto = (cat = "spesa", conf = 0.7) => ({
  metrics: { test_accuracy: 0.85 },
  predict: () => ({ category: cat, confidence: conf }),
});
const nexusAddestrabile = () => ({
  predict: () => ({ cat: "spesa", confidence: 80 }),
  tokenize: (s) => String(s).toLowerCase().split(/\s+/).filter(Boolean),
  train: () => {},
  validate: () => 0,
});

test("CONFORME: la conferma dell'utente alimenta la calibrazione, e la finestra non cresce all'infinito", () => {
  const nexus = nexusAddestrabile();
  const vault = { state: { mlData: { totalWords: 0, conformalScores: [] }, transactions: {} }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: secondoEsperto() });
  orch.classify("zzqx wvtr 4471", 5, new Date());
  orch.learn("zzqx wvtr 4471", "spesa", 5, new Date());
  const dopo = vault.state.mlData.conformalScores;
  assert.equal(dopo.length, 1, "una conferma = un punto di calibrazione");
  assert.ok(dopo[0] >= 0 && dopo[0] <= 1, `punteggio fuori scala: ${dopo[0]}`);

  vault.state.mlData.conformalScores = Array.from({ length: 300 }, () => 0.1);
  orch.classify("zzqx wvtr 4471", 5, new Date());
  orch.learn("zzqx wvtr 4471", "spesa", 5, new Date());
  assert.equal(vault.state.mlData.conformalScores.length, 300, "finestra limitata: conta come si comporta adesso");
});

test("CONFORME: una correzione dell'utente pesa piu' di una conferma, senza codice apposta", () => {
  // Il punteggio e' 1 - p(vera): se l'utente CORREGGE, p(vera) era bassa e il
  // punteggio esce alto. La calibrazione impara dagli errori da sola.
  const nexus = nexusAddestrabile();
  const vault = { state: { mlData: { totalWords: 0, conformalScores: [] }, transactions: {} }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: secondoEsperto() });
  orch.classify("kkvw plth 9902", 12, new Date());
  orch.learn("kkvw plth 9902", "svago", 12, new Date()); // l'utente CORREGGE
  const scoreCorrezione = vault.state.mlData.conformalScores[0];

  vault.state.mlData.conformalScores = [];
  orch.classify("kkvw plth 9902", 12, new Date());
  orch.learn("kkvw plth 9902", "spesa", 12, new Date()); // l'utente CONFERMA
  const scoreConferma = vault.state.mlData.conformalScores[0];

  assert.ok(scoreCorrezione > scoreConferma,
    `una correzione deve produrre uno scarto maggiore: ${scoreCorrezione} vs ${scoreConferma}`);
});

test("CONFORME: un colpo del dizionario NON entra nella calibrazione, ed e' corretto cosi'", () => {
  // La garanzia conforme si applica solo al percorso dell'ensemble: i colpi
  // del dizionario escono prima, ad alta confidenza, senza passare di li'.
  // Calibrare anche su quelli riempirebbe l'insieme di casi facili e renderebbe
  // la soglia troppo stretta proprio dove serve larga — la scambiabilita' fra
  // calibrazione e casi d'uso e' l'ipotesi su cui poggia tutta la garanzia.
  const nexus = nexusAddestrabile();
  const vault = { state: { mlData: { totalWords: 0, conformalScores: [] }, transactions: {} }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: nexus, trainedCategorizer: secondoEsperto() });
  const r = orch.classify("esselunga", 30, new Date());
  if (r.sources && r.sources.includes("dictionary")) {
    orch.learn("esselunga", r.cat, 30, new Date());
    assert.equal(vault.state.mlData.conformalScores.length, 0);
  }
});

// ── mergeRemoteNeuralNet: fusione mesh per NOME di categoria, non per
// posizione (seguito al Cantiere C4 — la crescita dinamica dell'output di
// NeuralNexus rende possibile che due dispositivi abbiano ordini diversi) ──

// Net "spento": W1/b1 a zero -> h1 sempre 0 -> i logit sono ESATTAMENTE b2
// (il contenuto del testo non conta). Serve solo a isolare, nell'integrazione
// col cancello di merge reale, l'unica cosa che qui deve essere testata: che
// la fusione avvenga per NOME di categoria, non per posizione nell'array.
function retSpenta({ catIndex, indexToCat, b2, W2 }) {
  return {
    embeddings: {},
    W1: Array.from({ length: 12 }, () => Array.from({ length: 8 }, () => 0)),
    b1: Array.from({ length: 12 }, () => 0),
    W2, b2, catIndex, indexToCat,
  };
}

test("mergeRemoteNeuralNet: ordini di categoria DIVERSI sui due dispositivi -> fusione per nome, categoria condivisa in comune riconosciuta anche se in posizione diversa", () => {
  const rigaCasa = Array.from({ length: 12 }, (_, j) => j); // stessa riga su entrambi i dispositivi
  const localNet = retSpenta({
    catIndex: { spesa: 0, casa: 1 }, indexToCat: ['spesa', 'casa'],
    W2: [Array.from({ length: 12 }, () => 1), rigaCasa], b2: [1, 5],
  });
  const remoteNet = retSpenta({
    // "casa" è nota a ENTRAMBI ma a posizione DIVERSA (0 qui, 1 in locale) —
    // esattamente il caso che il vecchio merge posizionale avrebbe rotto.
    // "salute" ha un bias fortemente negativo apposta: una categoria nuova
    // con probabilità trascurabile non deve alterare in modo misurabile la
    // normalizzazione softmax delle categorie condivise, cosa che renderebbe
    // questo test un falso negativo del cancello anziché una verifica pulita
    // della fusione per nome.
    catIndex: { casa: 0, salute: 1 }, indexToCat: ['casa', 'salute'],
    W2: [rigaCasa, Array.from({ length: 12 }, () => 2)], b2: [5, -50],
  });

  const vault = { state: { mlData: { neuralNet: localNet, totalWords: 500 } }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: NeuralNexus });
  for (let i = 0; i < 3; i++) orch._validationSet.push({ tokens: ['x'], catId: 'spesa' });
  for (let i = 0; i < 3; i++) orch._validationSet.push({ tokens: ['x'], catId: 'casa' });

  const risultato = orch.mergeRemoteNeuralNet(remoteNet, 500);

  assert.equal(risultato.accepted, true, `il merge doveva essere accettato: ${risultato.reason}`);
  assert.equal(risultato.totalExamples, 1000);

  const fuso = vault.state.mlData.neuralNet;
  assert.deepEqual([...fuso.indexToCat].sort(), ['casa', 'salute', 'spesa'], 'l\'unione deve contenere tutte e 3 le categorie, ognuna una sola volta');

  const iCasa = fuso.catIndex.casa, iSpesa = fuso.catIndex.spesa, iSalute = fuso.catIndex.salute;
  // "casa" nota a entrambi con lo STESSO peso (5 e 5, stessa riga) -> la
  // fusione non deve alterarla, a riprova che è stata riconosciuta per nome
  // e non mediata con "salute" (che a posizione locale 1 sarebbe toccata).
  assert.equal(fuso.b2[iCasa], 5, 'il bias di "casa" fuso di due valori identici deve restare 5, non essere mescolato con "salute"');
  assert.deepEqual(fuso.W2[iCasa], rigaCasa, 'la riga W2 di "casa" fusa da due valori identici deve restare invariata');
  assert.equal(fuso.b2[iSpesa], 1, '"spesa" nota solo al locale deve restare inalterata');
  assert.equal(fuso.b2[iSalute], -50, '"salute" nota solo al remoto deve essere adottata inalterata');
});

test("mergeRemoteNeuralNet: il cancello di merge protegge anche questo percorso — un peer che peggiora la categoria condivisa viene RIFIUTATO, il net locale resta intatto", () => {
  const rigaCasaLocale = Array.from({ length: 12 }, (_, j) => j);
  const localNet = retSpenta({
    catIndex: { spesa: 0, casa: 1 }, indexToCat: ['spesa', 'casa'],
    W2: [Array.from({ length: 12 }, () => 1), rigaCasaLocale], b2: [1, 9], // "casa" fortemente dominante in locale
  });
  const remoteNet = retSpenta({
    // Stesso NOME "casa", ma un peer che la spinge nella direzione OPPOSTA —
    // il caso che il cancello deve intercettare (avvelenamento, anche solo
    // per rumore/dati di scarsa qualità di un peer).
    catIndex: { casa: 0 }, indexToCat: ['casa'],
    W2: [Array.from({ length: 12 }, () => -1)], b2: [-50],
  });

  const vault = { state: { mlData: { neuralNet: localNet, totalWords: 500 } }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: NeuralNexus });
  for (let i = 0; i < 5; i++) orch._validationSet.push({ tokens: ['x'], catId: 'casa' });

  const risultato = orch.mergeRemoteNeuralNet(remoteNet, 500);

  assert.equal(risultato.accepted, false, 'un merge che peggiora drasticamente una categoria condivisa deve essere rifiutato');
  assert.equal(vault.state.mlData.neuralNet, localNet, 'in caso di rifiuto il net locale non deve essere sostituito');
  assert.equal(vault.state.mlData.totalWords, 500, 'in caso di rifiuto il conteggio esempi non deve avanzare');
});

test("mergeRemoteNeuralNet: SECONDO CANCELLO per categoria — un merge che la MEDIA giudicherebbe un miglioramento viene comunque rifiutato se devasta una categoria rara annegata nella media", () => {
  // "spesa" migliora molto (97/100 esempi), "salute" (solo 3/100) peggiora
  // di oltre 1,6 nat — un salto reale (la probabilità della classe vera
  // crolla da 50% a 10%). La media pesata sul validation set MIGLIORA
  // comunque (0,69 -> 0,17): il primo cancello (evaluateMerge, aggregato)
  // da SOLO avrebbe accettato con entusiasmo ("migliora il tuo modello").
  // Questo è esattamente il tipo di buco misurato per davvero su LogReg in
  // questa sessione (una categoria perdeva punti mentre l'accuratezza
  // globale sembrava a posto) — qui riprodotto apposta sul percorso mesh
  // per provare che il secondo cancello lo intercetta.
  const localNet = retSpenta({
    catIndex: { spesa: 0, salute: 1 }, indexToCat: ['spesa', 'salute'],
    W2: [Array.from({ length: 12 }, () => 0), Array.from({ length: 12 }, () => 0)],
    b2: [0, 0], // softmax([0,0]) = 50/50 per entrambe: punto di partenza neutro
  });
  const remoteNet = retSpenta({
    catIndex: { spesa: 0, salute: 1 }, indexToCat: ['spesa', 'salute'],
    W2: [Array.from({ length: 12 }, () => 0), Array.from({ length: 12 }, () => 0)],
    // Con peso 50/50 la fusione porta la rete a b2=[ln(9), 0]: p(spesa)=90%,
    // p(salute)=10% — "spesa" migliora, "salute" crolla dal 50% al 10%.
    b2: [2 * Math.log(9), 0],
  });

  const vault = { state: { mlData: { neuralNet: localNet, totalWords: 500 } }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: NeuralNexus });
  for (let i = 0; i < 97; i++) orch._validationSet.push({ tokens: ['x'], catId: 'spesa' });
  for (let i = 0; i < 3; i++) orch._validationSet.push({ tokens: ['x'], catId: 'salute' });

  // Prova che il PRIMO cancello da solo, su questi stessi numeri, accetterebbe.
  const lossBefore = NeuralNexus.validate(orch._validationSet, localNet);
  const netFusoPerVerifica = { ...localNet, b2: remoteNet.b2 }; // stessa forma, biases del "dopo" atteso
  const lossAfterAtteso = NeuralNexus.validate(orch._validationSet, netFusoPerVerifica);
  assert.ok(lossAfterAtteso < lossBefore, 'premessa del test: il cancello AGGREGATO da solo giudicherebbe questo un miglioramento');

  const risultato = orch.mergeRemoteNeuralNet(remoteNet, 500);

  assert.equal(risultato.accepted, false, 'il secondo cancello (per categoria) deve rifiutare anche se la media migliora');
  assert.match(risultato.reason, /salute/, 'il motivo del rifiuto deve nominare la categoria colpita');
  assert.equal(vault.state.mlData.neuralNet, localNet, 'in caso di rifiuto il net locale resta intatto');
});

// ── mergeRemoteGraph: il DCGN entra nella mesh — prima un grafo ORFANO ──
// dcgn.js aveva già mergeExpertWeighted/measureCompetence pronti, ma nessun
// punto del codice li collegava alla mesh. Qui si prova il collegamento con
// gli STESSI due cancelli già validati sopra per NeuralNexus, riusati pari
// pari (evaluateMerge + evaluateMergePerCategoria su validateLoss/
// validateLossPerCategoria del grafo).

const SPESA_G = ['esselunga supermercato', 'conad city', 'lidl italia', 'carrefour express'];
const RESTO_G = ['trattoria da mario', 'pizzeria bella napoli', 'osteria del corso', 'ristorante il gambero'];

function grafoLocaleDiProva() {
  const g = dcgnCreateGraph();
  for (const p of SPESA_G) dcgnObserve(g, p, 'spesa');
  for (const p of RESTO_G) dcgnObserve(g, p, 'ristoranti');
  return g;
}

function orchestratorConGrafo(graph) {
  const vault = { state: { mlData: { neuralNet: null, totalWords: 0, dcgn: graph } }, save: () => {} };
  const orch = new MomentumOrchestrator({ vaultDAO: vault, neuralNexus: NeuralNexus });
  for (const p of SPESA_G) orch._validationSet.push({ tokens: [], catId: 'spesa', text: p });
  for (const p of RESTO_G) orch._validationSet.push({ tokens: [], catId: 'ristoranti', text: p });
  return { orch, vault };
}

test("mergeRemoteGraph: un peer che rinforza in modo innocuo (stesse categorie, stessi esempi) viene accettato e il grafo locale viene aggiornato", () => {
  const localGraph = grafoLocaleDiProva();
  const { orch, vault } = orchestratorConGrafo(localGraph);
  const remoteBuono = dcgnCreateGraph();
  for (const p of SPESA_G) dcgnObserve(remoteBuono, p, 'spesa');
  for (const p of RESTO_G) dcgnObserve(remoteBuono, p, 'ristoranti');

  const risultato = orch.mergeRemoteGraph(remoteBuono);

  assert.equal(risultato.accepted, true);
  assert.equal(orch.graph, vault.state.mlData.dcgn, 'this.graph e il vault devono restare sincronizzati dopo l\'accettazione');
  assert.ok(vault.state.mlData.dcgn.docs > localGraph.docs, 'il grafo fuso deve avere assorbito conoscenza dal peer (più documenti osservati)');
});

test("mergeRemoteGraph: un peer che spinge OGNI token verso una categoria sbagliata viene rifiutato, il grafo locale resta intatto", () => {
  const localGraph = grafoLocaleDiProva();
  const { orch, vault } = orchestratorConGrafo(localGraph);
  const veleno = dcgnCreateGraph();
  for (let i = 0; i < 20; i++) for (const p of [...SPESA_G, ...RESTO_G]) dcgnObserve(veleno, p, 'crypto');

  const risultato = orch.mergeRemoteGraph(veleno);

  assert.equal(risultato.accepted, false);
  assert.ok(risultato.lossAfter > risultato.lossBefore, 'la loss misurata deve mostrare il peggioramento che ha causato il rifiuto');
  assert.equal(vault.state.mlData.dcgn, localGraph, 'in caso di rifiuto il grafo locale non deve essere sostituito');
  assert.equal(orch.graph, localGraph);
});
