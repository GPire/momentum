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

// ── PENDING → POSTED (2026-08-28): una notifica/screenshot cattura l'addebito
// SUBITO con un importo provvisorio; il CSV/PDF arriva DOPO (anche oltre le
// 48h di sempre, es. weekend) con l'importo definitivo — mancia, conversione
// valuta. Causa reale e documentata di duplicati sfuggiti (verificato via
// ricerca prima di scrivere codice). ──

test("pending→posted: notifica + PDF stesso esercente, importo leggermente diverso (mancia), oltre le 48h di sempre → riconosciuto come lo stesso", () => {
  const notifica = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  // 4 giorni dopo (weekend), importo salito per la mancia aggiunta.
  const pdf = { date: "2026-07-05T10:00:00Z", amount: 45, type: "uscita", description: "Ristorante Da Mario", source: "pdf" };
  assert.equal(isDuplicate(pdf, [notifica]), true);
});

test("pending→posted: screenshot + import CSV, stesso schema", () => {
  const screenshot = { id: "s1", date: "2026-07-01T12:00:00Z", amount: 100, type: "uscita", description: "Hotel Roma Centro", source: "screenshot_ocr" };
  const csv = { date: "2026-07-04T09:00:00Z", amount: 108, type: "uscita", description: "Hotel Roma Centro", source: "csv" };
  assert.equal(isDuplicate(csv, [screenshot]), true);
});

test("pending→posted: la differenza di importo oltre il 15% NON viene considerata la stessa spesa (mai un match troppo largo)", () => {
  const notifica = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  const pdf = { date: "2026-07-02T10:00:00Z", amount: 60, type: "uscita", description: "Ristorante Da Mario", source: "pdf" }; // +50%, troppo
  assert.equal(isDuplicate(pdf, [notifica]), false);
});

test("pending→posted: oltre i 5 giorni NON viene più considerata la stessa spesa", () => {
  const notifica = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  const pdf = { date: "2026-07-07T10:00:00Z", amount: 41, type: "uscita", description: "Ristorante Da Mario", source: "pdf" }; // 6 giorni dopo
  assert.equal(isDuplicate(pdf, [notifica]), false);
});

test("pending→posted: NON scatta tra due spese entrambe da canali \"definitivi\" (mai per CSV contro CSV, la regola stretta di sempre resta quella)", () => {
  const csv1 = { id: "c1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "csv" };
  const csv2 = { date: "2026-07-04T10:00:00Z", amount: 45, type: "uscita", description: "Ristorante Da Mario", source: "csv" }; // canale "csv" non è pending
  assert.equal(isDuplicate(csv2, [csv1]), false);
});

test("pending→posted: NON scatta se anche la nuova transazione arriva da un canale \"immediato\" (due notifiche/screenshot diverse restano due spese vere)", () => {
  const notifica1 = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  const screenshot2 = { date: "2026-07-02T10:00:00Z", amount: 41, type: "uscita", description: "Ristorante Da Mario", source: "screenshot_ocr" };
  assert.equal(isDuplicate(screenshot2, [notifica1]), false);
});

test("pending→posted: descrizione troppo diversa → NON è un match, anche con importo/tempo compatibili", () => {
  const notifica = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  const pdf = { date: "2026-07-02T10:00:00Z", amount: 41, type: "uscita", description: "Farmacia Centrale", source: "pdf" };
  assert.equal(isDuplicate(pdf, [notifica]), false);
});

test("pending→posted: tipo diverso (entrata vs uscita) → mai un match, stesso principio della regola stretta", () => {
  const notifica = { id: "n1", date: "2026-07-01T20:00:00Z", amount: 40, type: "uscita", description: "Rimborso Mario", source: "notification" };
  const pdf = { date: "2026-07-02T10:00:00Z", amount: 41, type: "entrata", description: "Rimborso Mario", source: "pdf" };
  assert.equal(isDuplicate(pdf, [notifica]), false);
});

test("pending→posted: la strict-match (entro 48h, 1 centesimo) ha SEMPRE priorità quando esiste, anche se esiste anche un candidato pending", () => {
  const notificaLontana = { id: "n1", date: "2026-06-28T20:00:00Z", amount: 40, type: "uscita", description: "Ristorante Da Mario", source: "notification" };
  const stessaSpesaVicina = { id: "n2", date: "2026-07-01T09:59:00Z", amount: 41, type: "uscita", description: "Ristorante Da Mario", source: "csv" };
  const pdf = { date: "2026-07-01T10:00:00Z", amount: 41, type: "uscita", description: "Ristorante Da Mario", source: "pdf" };
  const match = findDuplicate(pdf, [notificaLontana, stessaSpesaVicina]);
  assert.equal(match.id, "n2", "la strict-match più recente e precisa vince sul candidato pending più vecchio");
});

test("pending→posted: fuzz — 2000 coppie casuali di spese REALMENTE diverse (esercenti diversi) non producono mai un falso positivo", () => {
  const esercenti = ["Bar Roma", "Farmacia Centrale", "Ikea", "Netflix", "Esselunga", "Decathlon", "Zara", "Conad"];
  let falsiPositivi = 0;
  for (let i = 0; i < 2000; i++) {
    const a = esercenti[Math.floor(Math.random() * esercenti.length)];
    let b = esercenti[Math.floor(Math.random() * esercenti.length)];
    while (b === a) b = esercenti[Math.floor(Math.random() * esercenti.length)];
    const notifica = { id: "n" + i, date: "2026-07-01T12:00:00Z", amount: 1 + Math.random() * 200, type: "uscita", description: a, source: "notification" };
    const pdf = { date: "2026-07-0" + (2 + Math.floor(Math.random() * 4)) + "T12:00:00Z", amount: notifica.amount * (1 + (Math.random() * 0.1)), type: "uscita", description: b, source: "pdf" };
    if (isDuplicate(pdf, [notifica])) falsiPositivi++;
  }
  assert.equal(falsiPositivi, 0, "esercenti realmente diversi non devono mai essere fusi, qualunque combinazione di importo/data compatibili");
});

// ── MANUALE → ESTRATTO CONTO (2026-09-04) ───────────────────────────────────
// Segnalazione reale: chi segna le spese a mano e poi importa il CSV della
// banca si ritrova tutto in doppio, perché fra "Benzina" e "PAGAMENTO POS
// CARTA 4832 Q8 SRL" la somiglianza è 0,105 contro la soglia di 0,72.
const manuale = (over = {}) => ({ id: 1, date: '2026-09-02T10:00:00.000Z', amount: 45.30, type: 'uscita', description: 'Spesa', category: 'Alimentari', ...over });
const daBanca = (over = {}) => ({ date: '2026-09-02T00:00:00.000Z', amount: 45.30, type: 'uscita', description: 'PAGAMENTO POS 12345 ESSELUNGA SPA', source: 'csv', ...over });

test('GARANZIA: la riga della banca riconosce la voce segnata a mano, nonostante la descrizione diversa', () => {
  const m = findDuplicate(daBanca(), [manuale()]);
  assert.ok(m, 'duplicato non riconosciuto: l\'utente vedrebbe la stessa spesa due volte');
  assert.equal(m.id, 1);
});

test('GARANZIA: vale per ogni descrizione umana realistica, anche vuota', () => {
  for (const desc of ['Benzina', 'Spesa', 'Cena fuori', '', 'bar']) {
    const m = findDuplicate(daBanca({ description: 'ADDEBITO SEPA ENEL ENERGIA SPA' }), [manuale({ description: desc })]);
    assert.ok(m, `descrizione manuale ${JSON.stringify(desc)}: duplicato non riconosciuto`);
  }
});

test('GARANZIA: la banca contabilizza anche giorni dopo, e la voce manuale viene comunque riconosciuta', () => {
  const m = findDuplicate(daBanca({ date: '2026-09-04T00:00:00.000Z' }), [manuale()]); // +2 giorni
  assert.ok(m);
});

test('GARANZIA: importo diverso = spesa diversa, mai fusa', () => {
  assert.equal(findDuplicate(daBanca({ amount: 45.90 }), [manuale()]), null);
});

test('GARANZIA: tipo diverso (entrata vs uscita) non si fonde mai', () => {
  assert.equal(findDuplicate(daBanca({ type: 'entrata' }), [manuale()]), null);
});

test('GARANZIA: due voci manuali gemelle non vengono entrambe assorbite dalla stessa riga', () => {
  // Il caso pericoloso: due caffè veri da 1,20 lo stesso giorno. La prima
  // riga importata si fonde con la prima voce; la seconda NON deve fondersi
  // con la stessa (marcata `reconciledImport`) ma con l'altra.
  const a = manuale({ id: 1, amount: 1.20, description: 'caffè' });
  const b = manuale({ id: 2, amount: 1.20, description: 'caffè', date: '2026-09-02T16:00:00.000Z' });
  const primo = findDuplicate(daBanca({ amount: 1.20, description: 'POS BAR CENTRALE' }), [a, b]);
  assert.ok(primo);
  const secondo = findDuplicate(daBanca({ amount: 1.20, description: 'POS BAR CENTRALE' }), [{ ...primo, reconciledImport: true }, primo.id === 1 ? b : a]);
  assert.ok(secondo);
  assert.notEqual(secondo.id, primo.id, 'la stessa voce manuale ha assorbito due righe: una spesa vera sparirebbe');
});

test('GARANZIA: due righe importate fra loro restano soggette alla regola di sempre (descrizione)', () => {
  // Il ramo manuale non deve allargare la dedup fra due import: lì la
  // descrizione c'è ed è confrontabile, e due acquisti distinti di pari
  // importo nello stesso giorno devono restare due.
  // Descrizioni DAVVERO diverse: "POS NEGOZIO A" e "POS NEGOZIO B"
  // differiscono di un carattere (somiglianza 0,92) e si fondono per la
  // regola di sempre, correttamente.
  const importata = { id: 9, date: '2026-09-02T10:00:00.000Z', amount: 45.30, type: 'uscita', description: 'POS SUPERMERCATO ROMA EUR', source: 'csv' };
  assert.equal(findDuplicate(daBanca({ description: 'POS FARMACIA COMUNALE 12' }), [importata]), null);
});
