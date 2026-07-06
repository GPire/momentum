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
  const result = orch.classify("esselunga", 30, new Date());
  assert.equal(result.cat, "spesa");
});

test("ensemble a 2 vie concorde: Nano e NeuralNexus d'accordo, alta confidenza combinata", () => {
  const nexus = { predict: () => ({ cat: "spesa", confidence: 60 }) };
  const trained = { metrics: { test_accuracy: 0.9 }, predict: () => ({ category: "spesa", confidence: 0.95 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus, trainedCategorizer: trained });
  const result = orch.classify("esselunga", 30, new Date());
  assert.equal(result.cat, "spesa");
  assert.ok(result.advice.includes("concorde"));
});

test("ensemble a 3 vie: il Meso, più accurato, pesa di più del Nano quando sono in disaccordo", () => {
  const nexus = { predict: () => ({ cat: "trasporti", confidence: 40 }) }; // poco sicuro, peso basso con totalWords=0
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVault(0), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });
  const result = orch.classify("satispay*bar roma", 12, new Date());
  // il Meso ha peso maggiore (accuratezza misurata più alta) e confidenza più alta: deve vincere
  assert.equal(result.cat, "spesa");
  assert.ok(result.advice.includes("disaccordo"));
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
  assert.equal(orch.classify("satispay*bar roma", 12, new Date()).cat, "spesa");
});

test("v3: le correzioni reali dell'utente spostano il voto verso il modello che ci prende", () => {
  const nexus = nexusTrainable("trasporti", 40);
  const trained = { metrics: { test_accuracy: 0.80 }, predict: () => ({ category: "ristoranti", confidence: 0.7 }) };
  const meso = { metrics: { hard_noisy_test_accuracy: 0.897 }, predict: () => ({ category: "spesa", confidence: 0.9 }) };
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus, trainedCategorizer: trained, trainedMeso: meso });

  // L'utente corregge più volte: la verità era "ristoranti" (il Nano aveva
  // ragione, il Meso torto). La matrice di precisione deve accumularsi...
  for (let i = 0; i < 6; i++) {
    orch.classify("satispay*bar roma", 12, new Date());
    orch.learn("satispay*bar roma", "ristoranti", 12, new Date());
  }
  const stats = orch.vault.state.mlData.modelStats;
  assert.equal(stats.meso["spesa"].wrong, 6);
  assert.equal(stats.nano["ristoranti"].right, 6);

  // ...e ora lo stesso caso deve essere vinto dal Nano (misurato > dichiarato)
  assert.equal(orch.classify("satispay*bar roma", 12, new Date()).cat, "ristoranti");
});

test("v3: learn senza classify precedente non inventa statistiche", () => {
  const nexus = nexusTrainable("spesa", 60);
  const orch = new MomentumOrchestrator({ vaultDAO: mockVaultV3(), neuralNexus: nexus });
  orch.learn("bolletta enel", "utenze", 78, new Date());
  assert.equal(orch.vault.state.mlData.modelStats, undefined);
});
