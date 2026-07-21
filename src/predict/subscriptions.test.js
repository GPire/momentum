import test from "node:test";
import assert from "node:assert/strict";
import { detectRecurring, detectPriceHikes } from "./subscriptions.js";

function monthlySeries(description, category, amounts, startDate = "2026-03-15") {
  const start = new Date(startDate);
  return amounts.map((amount, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 30);
    return { id: `${description}-${i}`, date: d.toISOString(), amount, type: "uscita", category, description };
  });
}

test("riconosce un abbonamento mensile come ricorrente", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", [9.99, 9.99, 9.99]) };
  const recurring = detectRecurring(allTx);
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].items.length, 3);
});

test("non considera ricorrente una singola transazione", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", [9.99]) };
  assert.equal(detectRecurring(allTx).length, 0);
});

test("non considera ricorrenti due spese occasionali con intervallo irregolare", () => {
  const allTx = {
    all: [
      { id: "a", date: "2026-03-01T10:00:00Z", amount: 30, type: "uscita", category: "spesa", description: "Esselunga" },
      { id: "b", date: "2026-03-03T10:00:00Z", amount: 32, type: "uscita", category: "spesa", description: "Esselunga" },
    ],
  };
  assert.equal(detectRecurring(allTx).length, 0);
});

test("rileva un aumento di prezzo silenzioso (Netflix 9.99 -> 14.99)", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", [9.99, 9.99, 9.99, 14.99]) };
  const hikes = detectPriceHikes(allTx);
  assert.equal(hikes.length, 1);
  assert.equal(hikes[0].description, "Netflix");
  assert.equal(hikes[0].previousAmount, 9.99);
  assert.equal(hikes[0].newAmount, 14.99);
  assert.ok(hikes[0].increasePct > 49 && hikes[0].increasePct < 51);
});

test("non segnala variazioni piccole sotto soglia (arrotondamenti/commissioni)", () => {
  const allTx = { all: monthlySeries("Spotify", "abbonamenti", [9.99, 9.99, 10.05]) };
  assert.equal(detectPriceHikes(allTx).length, 0);
});

test("riconosce l'abbonamento anche con descrizioni leggermente diverse (SATISPAY*NETFLIX vs Netflix)", () => {
  const items = monthlySeries("Netflix", "abbonamenti", [9.99, 9.99]);
  items[1].description = "SATISPAY*NETFLIX.COM";
  const allTx = { all: items };
  const recurring = detectRecurring(allTx);
  assert.equal(recurring.length, 1);
});

test("più abbonamenti diversi vengono rilevati come gruppi separati", () => {
  const allTx = {
    all: [
      ...monthlySeries("Netflix", "abbonamenti", [9.99, 9.99, 14.99]),
      ...monthlySeries("Spotify", "abbonamenti", [4.99, 4.99, 4.99], "2026-03-05"),
    ],
  };
  const hikes = detectPriceHikes(allTx);
  assert.equal(hikes.length, 1);
  assert.equal(hikes[0].description, "Netflix");
});

test('subscriptionSummary: trova abbonamenti, stima il prossimo addebito e il totale mensile', async () => {
  const { subscriptionSummary } = await import('./subscriptions.js');
  const allTx = { '2026-04': [], '2026-05': [], '2026-06': [] };
  // Netflix mensile ~14,99 per 3 mesi + Spotify ~9,99 per 3 mesi
  const push = (mk, date, desc, amt) => allTx[mk].push({ date, type: 'uscita', category: 'abbonamenti', description: desc, amount: amt });
  push('2026-04', '2026-04-05', 'Netflix', 14.99); push('2026-05', '2026-05-05', 'Netflix', 14.99); push('2026-06', '2026-06-05', 'Netflix', 14.99);
  push('2026-04', '2026-04-10', 'Spotify Premium', 9.99); push('2026-05', '2026-05-10', 'Spotify Premium', 9.99); push('2026-06', '2026-06-10', 'Spotify Premium', 9.99);
  const s = subscriptionSummary(allTx, new Date('2026-06-15'));
  assert.equal(s.count, 2);
  assert.ok(Math.abs(s.monthlyTotal - 24.98) < 0.02);   // 14.99 + 9.99
  const netflix = s.subscriptions.find(x => /netflix/i.test(x.name));
  assert.ok(netflix && netflix.nextDate.startsWith('2026-07')); // prossimo ~5 luglio
});

// --- anticipatePriceHikes: creep silenzioso + previsione anticipata ---
import { anticipatePriceHikes, subscriptionSummary } from "./subscriptions.js";

test("anticipatePriceHikes: creep silenzioso (piccoli aumenti sotto-soglia) → segnalato con impatto annuale", () => {
  // 9.99→10.49→10.99→11.49: ogni passo ~5% (<10%, detectPriceHikes lo perde),
  // ma +15% cumulato → creep. Ultimo addebito lontano nel tempo (no upcoming).
  const tx = { all: monthlySeries("Streaming", "abbonamenti", [9.99, 10.49, 10.99, 11.49], "2026-01-10") };
  // detectPriceHikes NON lo becca (latest vs media precedenti < 10%)
  assert.equal(detectPriceHikes(tx).length, 0);
  const ref = new Date("2026-05-01"); // lontano dal prossimo addebito
  const al = anticipatePriceHikes(tx, ref);
  const creep = al.find(a => a.type === "creep");
  assert.ok(creep, "il creep silenzioso deve essere segnalato");
  assert.equal(creep.baseline, 9.99);
  assert.ok(creep.totalPct >= 12);
  assert.ok(creep.annualImpact > 0);           // impatto annuale concreto
  assert.ok(creep.predictedNext > creep.current); // prevede il prossimo più alto
});

test("anticipatePriceHikes: prezzo piatto → nessun allarme (niente invenzioni)", () => {
  const tx = { all: monthlySeries("Palestra", "sport", [30, 30, 30, 30]) };
  assert.equal(anticipatePriceHikes(tx, new Date("2026-08-01")).length, 0);
});

test("anticipatePriceHikes: salto singolo grosso resta a detectPriceHikes (no doppioni creep)", () => {
  const tx = { all: monthlySeries("Cloud", "software", [5, 5, 5, 12]) };
  const al = anticipatePriceHikes(tx, new Date("2026-08-01"));
  assert.equal(al.filter(a => a.type === "creep").length, 0); // il salto grosso non è "creep"
  assert.ok(detectPriceHikes(tx).length >= 1);                 // lo prende il reattivo
});

test("subscriptionSummary espone anticipated", () => {
  const tx = { all: monthlySeries("Streaming", "abbonamenti", [9.99, 10.49, 10.99, 11.49], "2026-01-10") };
  const s = subscriptionSummary(tx, new Date("2026-05-01"));
  assert.ok(Array.isArray(s.anticipated));
});
