import test from "node:test";
import assert from "node:assert/strict";
import { detectRecurring, detectPriceHikes, detectDormantSubscriptions, detectNewSubscriptions, dormantSubscriptionKey } from "./subscriptions.js";

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

// --- cadenza annuale/trimestrale (bug reale: prima solo il mensile veniva riconosciuto) ---

function serieConCadenza(description, category, amounts, giorniIntervallo, startDate) {
  const start = new Date(startDate);
  return amounts.map((amount, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * giorniIntervallo);
    return { id: `${description}-${i}`, date: d.toISOString(), amount, type: "uscita", category, description };
  });
}

test("riconosce un abbonamento ANNUALE come ricorrente (prima veniva ignorato)", () => {
  const tx = { all: serieConCadenza("Amazon Prime", "abbonamenti", [36, 36, 36], 365, "2023-06-01") };
  const recurring = detectRecurring(tx);
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].cadenza, "annuale");
});

test("riconosce un abbonamento TRIMESTRALE come ricorrente", () => {
  const tx = { all: serieConCadenza("Assicurazione", "abbonamenti", [45, 45, 45], 90, "2025-01-01") };
  const recurring = detectRecurring(tx);
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].cadenza, "trimestrale");
});

test("non confonde un abbonamento annuale con uno mensile ravvicinato per errore", () => {
  const tx = { all: serieConCadenza("Dominio web", "abbonamenti", [12, 12], 365, "2024-01-01") };
  const recurring = detectRecurring(tx);
  assert.equal(recurring[0].isMonthly, false);
  assert.equal(recurring[0].cadenza, "annuale");
});

test("un intervallo a cavallo fra due finestre (es. 50 giorni) non viene classificato come nessuna cadenza nota", () => {
  const tx = { all: serieConCadenza("Irregolare", "varie", [10, 10, 10], 50, "2026-01-01") };
  assert.equal(detectRecurring(tx).length, 0);
});

test('subscriptionSummary: un abbonamento annuale conta come amount/12 nel totale mensile, non per intero', async () => {
  const { subscriptionSummary } = await import('./subscriptions.js');
  const allTx = { all: [
    ...serieConCadenza("Amazon Prime", "abbonamenti", [36, 36], 365, "2024-06-01"),
    ...monthlySeries("Netflix", "abbonamenti", [9.99, 9.99, 9.99], "2026-01-01"),
  ] };
  const s = subscriptionSummary(allTx, new Date("2026-06-15"));
  const prime = s.subscriptions.find(x => /prime/i.test(x.name));
  assert.ok(prime, "Amazon Prime deve comparire fra gli abbonamenti");
  assert.equal(prime.cadenza, "annuale");
  assert.ok(Math.abs(prime.monthlyEquivalent - 3) < 0.01); // 36/12 = 3
  // totale mensile = 3 (Prime pro-rata) + 9.99 (Netflix), NON 36 + 9.99
  assert.ok(Math.abs(s.monthlyTotal - 12.99) < 0.02);
});

// ── detectDormantSubscriptions: "abbonamento dimenticato" — onestà: Momentum
// non sa se il servizio è USATO, sa solo da quanto tempo l'utente non l'ha
// mai riguardato nell'app. Mai un giudizio "non lo usi più". ──
test("dormant: un abbonamento con 12 mesi di storia e mai riguardato viene segnalato", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", Array(12).fill(9.99)) };
  const refDate = new Date("2027-03-20"); // ~12 mesi dopo l'ultimo addebito generato
  const dormant = detectDormantSubscriptions(allTx, refDate);
  assert.equal(dormant.length, 1);
  assert.equal(dormant[0].name, "Netflix");
  assert.ok(dormant[0].daysSinceFirst >= 180);
  assert.equal(dormant[0].neverReviewed, true);
});

test("dormant: un abbonamento nuovo (4 mesi) non viene segnalato — serve tempo per parlare di dimenticato", () => {
  const allTx = { all: monthlySeries("Spotify", "abbonamenti", Array(4).fill(9.99)) };
  const refDate = new Date("2026-07-20"); // ~4 mesi dopo l'inizio, sotto la soglia di 180gg
  const dormant = detectDormantSubscriptions(allTx, refDate);
  assert.equal(dormant.length, 0);
});

test("dormant: un abbonamento riguardato di recente non viene segnalato, anche se vecchio", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", Array(12).fill(9.99)) };
  const refDate = new Date("2027-03-20");
  const key = dormantSubscriptionKey({ category: "abbonamenti", name: "Netflix" });
  const reviewedAt = { [key]: new Date("2027-02-20").toISOString() }; // riguardato 1 mese fa
  const dormant = detectDormantSubscriptions(allTx, refDate, { reviewedAt });
  assert.equal(dormant.length, 0);
});

test("dormant: una revisione vecchia quanto la soglia stessa non basta a tenerlo silenzioso per sempre", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", Array(12).fill(9.99)) };
  const refDate = new Date("2027-03-20");
  const key = dormantSubscriptionKey({ category: "abbonamenti", name: "Netflix" });
  const reviewedAt = { [key]: new Date("2026-06-01").toISOString() }; // riguardato >180gg fa
  const dormant = detectDormantSubscriptions(allTx, refDate, { reviewedAt });
  assert.equal(dormant.length, 1, "una revisione troppo vecchia non deve azzittire per sempre l'avviso");
});

// ── detectNewSubscriptions: "nuovo addebito ricorrente" — segnala APPENA
// confermato (2ª occorrenza), non mesi dopo. Onestà: mai "era un trial",
// Momentum non può saperlo — solo "addebito ricorrente appena confermato". ──
test("new: un addebito ricorrente appena confermato (2 occorrenze) viene segnalato subito", () => {
  const allTx = { all: monthlySeries("Disney Plus", "abbonamenti", [8.99, 8.99]) };
  const refDate = new Date("2026-04-20"); // subito dopo la 2ª occorrenza
  const fresh = detectNewSubscriptions(allTx, refDate);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].name, "Disney Plus");
});

test("new: un abbonamento con 5 occorrenze non è più 'nuovo' — è già in lista da tempo", () => {
  const allTx = { all: monthlySeries("Netflix", "abbonamenti", Array(5).fill(9.99)) };
  const refDate = new Date("2026-08-20");
  const fresh = detectNewSubscriptions(allTx, refDate);
  assert.equal(fresh.length, 0);
});

test("new: una volta segnalato come 'controllato', non ricompare", () => {
  const allTx = { all: monthlySeries("Disney Plus", "abbonamenti", [8.99, 8.99]) };
  const refDate = new Date("2026-04-20");
  const key = dormantSubscriptionKey({ category: "abbonamenti", name: "Disney Plus" });
  const fresh = detectNewSubscriptions(allTx, refDate, { reviewedAt: { [key]: Date.now() } });
  assert.equal(fresh.length, 0);
});
