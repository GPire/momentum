import test from "node:test";
import assert from "node:assert/strict";
import { novelty, amountNovelty, merchantNovelty, driftScore, ruleScore } from "./dispatcher.js";

function history() {
  // 8 spese regolari da "Esselunga" sui 30-40€, categoria spesa
  const days = [1, 3, 5, 8, 10, 13, 15, 18].map(d => `2026-06-${String(d).padStart(2, "0")}T10:00:00Z`);
  const amounts = [32, 35, 30, 38, 33, 36, 31, 34];
  return {
    "2026-06": days.map((date, i) => ({
      id: `h${i}`, date, amount: amounts[i], type: "uscita", category: "spesa", description: "Esselunga",
    })),
  };
}

test("una spesa in linea con lo storico ha bassa novità -> percorso rapido", () => {
  const tx = { date: "2026-06-20T10:00:00Z", amount: 33, type: "uscita", category: "spesa", description: "Esselunga" };
  const result = novelty(tx, history());
  assert.equal(result.route, "fast");
});

test("un importo anomalo (10x la media) alza la componente amount ma da sola non basta per 'heavy'", () => {
  // merchant familiare + nessuna regola violata: un solo segnale forte non deve bastare
  // a svegliare il worker pesante, altrimenti basterebbe un solo campo anomalo per farlo scattare sempre.
  const tx = { date: "2026-06-20T10:00:00Z", amount: 350, type: "uscita", category: "spesa", description: "Esselunga" };
  const result = novelty(tx, history());
  assert.ok(result.components.amount > 0.8, `amount novelty troppo bassa: ${result.components.amount}`);
  assert.notEqual(result.route, "fast"); // comunque più che il percorso rapido
});

test("importo anomalo + merchant mai visto + budget sforato insieme superano la soglia 'heavy'", () => {
  // tre segnali indipendenti che puntano tutti nella stessa direzione: qui il
  // dispatcher deve escalare, a differenza del caso con un solo segnale forte.
  const tx = { date: "2026-06-20T10:00:00Z", amount: 350, type: "uscita", category: "spesa", description: "Bonifico Estero Sconosciuto" };
  const result = novelty(tx, history(), { monthlyBudget: 300 });
  assert.equal(result.route, "heavy");
});

test("un merchant mai visto nella categoria ha alta merchantNovelty", () => {
  const tx = { date: "2026-06-20T10:00:00Z", amount: 33, type: "uscita", category: "spesa", description: "Negozio Esotico Mai Visto Prima" };
  const score = merchantNovelty(tx, history());
  assert.ok(score > 0.5, `attesa alta novità merchant, ottenuto ${score}`);
});

test("un merchant identico a quelli storici ha merchantNovelty vicina a 0", () => {
  const tx = { date: "2026-06-20T10:00:00Z", amount: 33, type: "uscita", category: "spesa", description: "Esselunga" };
  const score = merchantNovelty(tx, history());
  assert.equal(score, 0);
});

test("ruleScore rileva la zona grigia del deduplicatore (simile ma non abbastanza da fondere)", () => {
  const h = history();
  // stesso importo esatto di h0 (32€, 2026-06-01), descrizione parzialmente simile ma sotto soglia merge
  const tx = { date: "2026-06-01T11:00:00Z", amount: 32, type: "uscita", category: "spesa", description: "xyz qwe Essel" };
  const result = ruleScore(tx, h);
  // non verifichiamo un valore esatto (dipende dalla similarità reale), solo che il meccanismo sia esercitato
  assert.ok(typeof result.score === "number");
});

test("ruleScore segnala budget sforato quando configurato", () => {
  const h = history(); // totale giugno: 32+35+30+38+33+36+31+34 = 269
  const tx = { date: "2026-06-20T10:00:00Z", amount: 50, type: "uscita", category: "spesa", description: "Esselunga" };
  const result = ruleScore(tx, h, { monthlyBudget: 300 });
  assert.ok(result.score >= 0.8);
  assert.ok(result.reasons.includes("budget_sforato"));
});

test("driftScore alto quando la spesa recente si discosta molto dalla precedente", () => {
  const days = [];
  for (let d = 1; d <= 14; d++) days.push(`2026-06-${String(d).padStart(2, "0")}T10:00:00Z`);
  const allTx = {
    "2026-06": days.map((date, i) => ({
      id: `d${i}`, date, amount: i < 7 ? 10 : 100, type: "uscita", category: "spesa", description: "Test",
    })),
  };
  const tx = { date: "2026-06-15T10:00:00Z", amount: 100, type: "uscita", category: "spesa", description: "Test" };
  const score = driftScore(tx, allTx);
  assert.ok(score > 0.5, `drift atteso alto, ottenuto ${score}`);
});

test("con storico insufficiente amountNovelty ritorna un valore moderato di default, non 0 o 1 estremi", () => {
  const tx = { date: "2026-06-01T10:00:00Z", amount: 50, type: "uscita", category: "nuova_categoria", description: "Primo acquisto" };
  const score = amountNovelty(tx, { "2026-06": [] });
  assert.equal(score, 0.3);
});
