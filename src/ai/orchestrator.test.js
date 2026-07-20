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
