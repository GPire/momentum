import test from "node:test";
import assert from "node:assert/strict";
import { isDuplicate, findDuplicate, mergeTransaction, reconcileTransaction, descriptionSimilarity } from "./deduplicator.js";

test("rileva duplicato tra notifica push e import PDF con testo diverso", () => {
  const pushTx = { id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "BAR ROMA", source: "push" };
  const pdfTx = { id: "d1", date: "2026-07-01T08:20:00Z", amount: 15, type: "uscita", description: "SATISPAY*BAR ROMA", source: "pdf" };

  assert.equal(isDuplicate(pdfTx, [pushTx]), true);
});

test("non segnala come duplicati transazioni con stesso importo ma descrizione diversa", () => {
  const existing = [{ id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma" }];
  const newTx = { date: "2026-07-01T09:00:00Z", amount: 15, type: "uscita", description: "Netflix.com" };

  assert.equal(isDuplicate(newTx, existing), false);
});

test("non segnala transazioni fuori dalla finestra temporale", () => {
  const existing = [{ id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma" }];
  const newTx = { date: "2026-07-05T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma" };

  assert.equal(isDuplicate(newTx, existing, { windowHours: 48 }), false);
});

test("non fonde entrata e uscita con stesso importo/descrizione (es. storno)", () => {
  const existing = [{ id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma" }];
  const newTx = { date: "2026-07-01T08:20:00Z", amount: 15, type: "entrata", description: "Bar Roma" };

  assert.equal(isDuplicate(newTx, existing), false);
});

test("il merge riempie i campi mancanti senza sovrascrivere quelli esistenti", () => {
  const existing = { id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma", category: null, source: "push" };
  const incoming = { date: "2026-07-01T08:20:00Z", amount: 15, type: "uscita", description: "SATISPAY*BAR ROMA", category: "Food & Drink", source: "pdf" };

  const merged = mergeTransaction(existing, incoming);
  assert.equal(merged.category, "Food & Drink");
  assert.equal(merged.description, "Bar Roma"); // campo esistente preservato
  assert.deepEqual(merged.sources.sort(), ["pdf", "push"]);
});

test("reconcileTransaction restituisce merge con targetId corretto", () => {
  const existing = [{ id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma", source: "push" }];
  const incoming = { date: "2026-07-01T08:20:00Z", amount: 15, type: "uscita", description: "Bar Roma", category: "Food", source: "pdf" };

  const result = reconcileTransaction(incoming, existing);
  assert.equal(result.action, "merge");
  assert.equal(result.targetId, "p1");
  assert.equal(result.transaction.category, "Food");
});

test("reconcileTransaction inserisce transazioni genuinamente nuove", () => {
  const existing = [{ id: "p1", date: "2026-07-01T08:15:00Z", amount: 15, type: "uscita", description: "Bar Roma" }];
  const incoming = { date: "2026-07-02T18:00:00Z", amount: 42, type: "uscita", description: "Ikea" };

  const result = reconcileTransaction(incoming, existing);
  assert.equal(result.action, "insert");
});

test("descriptionSimilarity è simmetrica e limitata a [0,1]", () => {
  const s1 = descriptionSimilarity("Bar Roma", "SATISPAY*BAR ROMA");
  const s2 = descriptionSimilarity("SATISPAY*BAR ROMA", "Bar Roma");
  assert.equal(s1, s2);
  assert.ok(s1 >= 0 && s1 <= 1);
});
