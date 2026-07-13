import test from "node:test";
import assert from "node:assert/strict";

// screenshot-parser.js importa transitivamente moduli scritti per il browser
// (constants.js legge `window`/`navigator` al top-level). Stesso shim minimo
// già usato in orchestrator.test.js, nessuna dipendenza jsdom aggiunta.
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0, hardwareConcurrency: 4 };
globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, getElementById: () => null };

const { parseScreenshotText } = await import("./screenshot-parser.js");

test("estrae il totale di uno scontrino distinguendolo da contanti/resto", () => {
  const raw = "BAR ROMA\nVia Roma 12\nCaffe 1.20\nCornetto 1.50\nTOTALE 38,90\nCONTANTI 40,00\nRESTO 1,10";
  const result = parseScreenshotText(raw);
  assert.equal(result.amount, 38.90);
  assert.equal(result.type, "uscita");
  assert.equal(result.confidence, "alta");
});

test("riconosce una notifica di accredito come entrata", () => {
  const raw = "La tua banca\nAccredito ricevuto\nStipendio Azienda SRL\nImporto 1.500,00\n03/07/2026";
  const result = parseScreenshotText(raw);
  assert.equal(result.type, "entrata");
  assert.equal(result.amount, 1500);
});

test("riconosce una notifica di pagamento POS come uscita", () => {
  const raw = "Pagamento effettuato\nSATISPAY*BAR ROMA\nImporto 15,00\n01/07/2026";
  const result = parseScreenshotText(raw);
  assert.equal(result.type, "uscita");
  assert.equal(result.amount, 15);
});

test("estrae la data quando presente nel testo OCR", () => {
  const raw = "Esselunga\nTotale 42,50\n15/06/2026 18:32";
  const result = parseScreenshotText(raw);
  assert.equal(result.date.getFullYear(), 2026);
  assert.equal(result.date.getMonth(), 5); // giugno = indice 5
  assert.equal(result.date.getDate(), 15);
});

test("fallback sul numero più alto quando non c'è una parola chiave vicino all'importo", () => {
  const raw = "Scontrino generico\n3.50\n12.00\n1.20";
  const result = parseScreenshotText(raw);
  assert.equal(result.amount, 12.00);
  assert.equal(result.confidence, "media");
});

test("confidenza bassa e amount null quando l'OCR non trova nessun numero", () => {
  const raw = "testo illeggibile senza cifre";
  const result = parseScreenshotText(raw);
  assert.equal(result.amount, null);
  assert.equal(result.confidence, "bassa");
});

test("gestisce testo OCR rumoroso con rumore/artefatti tipici del riconoscimento reale", () => {
  const raw = "B4R R0MA\n\n\nTOT4LE: 12,50 €\n\nGrazie della visita";
  const result = parseScreenshotText(raw);
  // il pattern con parola chiave richiede "totale" esatto, quindi qui
  // l'OCR rumoroso ("TOT4LE") cade nel fallback numero-più-alto: verifichiamo
  // che comunque un importo plausibile venga estratto, non che fallisca del tutto
  assert.equal(result.amount, 12.50);
});

// ---- extractMerchant + scontrini realistici (potenziamento OCR) ----

const { extractMerchant } = await import("./screenshot-parser.js");

test("scontrino supermercato: esercente estratto saltando P.IVA e indirizzo", () => {
  const raw = "ESSELUNGA S.P.A.\nVia Vittor Pisani 20\n20124 MILANO\nP.IVA 04916380159\nDOCUMENTO COMMERCIALE\nPasta 1,20\nLatte 1,50\nTOTALE COMPLESSIVO 45,80\nCONTANTI 50,00\nRESTO 4,20\n05/07/2026 18:32";
  const result = parseScreenshotText(raw);
  assert.equal(result.description, "ESSELUNGA S.P.A.");
  assert.equal(result.amount, 45.80); // "TOTALE COMPLESSIVO" ora entra nel pattern keyword
  assert.equal(result.confidence, "alta");
  assert.equal(result.date.getDate(), 5);
});

test("scontrino farmacia: righe fiscali in testa, il nome arriva dopo", () => {
  const raw = "DOCUMENTO COMMERCIALE\nFARMACIA SAN CARLO\nCorso Italia 5\nP.IVA 01234567890\nAspirina 8,50\nTOTALE 8,50";
  const result = parseScreenshotText(raw);
  assert.equal(result.description, "FARMACIA SAN CARLO");
  assert.equal(result.amount, 8.50);
});

test("scontrino ristorante: 'IMPORTO PAGATO EUR' riconosciuto come totale", () => {
  const raw = "TRATTORIA DA MARIO\nVia Garibaldi 3\nCoperto 4,00\nVino 12,00\nIMPORTO PAGATO EUR 62,00";
  const result = parseScreenshotText(raw);
  assert.equal(result.description, "TRATTORIA DA MARIO");
  assert.equal(result.amount, 62.00);
  assert.equal(result.confidence, "alta");
});

test("extractMerchant: null quando le prime righe sono tutte rumore (mai nomi inventati)", () => {
  assert.equal(extractMerchant(["P.IVA 01234567890", "12/06/2026", "45,80"]), null);
});

test("extractMerchant: salta righe con importi anche se contengono lettere", () => {
  assert.equal(extractMerchant(["TOTALE 45,80", "BAR SPORT"]), "BAR SPORT");
});

test('parseScreenshotTransactions: lista movimenti mobile (OCR reale buddybank) → 4 uscite', async () => {
  const { parseScreenshotTransactions } = await import('./screenshot-parser.js');
  const ocr = `12:08 ZI 35)
Carta Di Debito (GP)
Myone Mastercard

Stegab S.a.s Di Stefan -2 50€
Sumup Stegab Sas Di -19 60 €
Intro Food N Soul -18 50 €
Moby Orli -8 60 €
Home Prodotti Pagamenti Altro`;
  const txs = parseScreenshotTransactions(ocr);
  assert.equal(txs.length, 4);                       // non più 1 sola!
  assert.deepEqual(txs.map(t => t.amount), [2.5, 19.6, 18.5, 8.6]);
  assert.ok(txs.every(t => t.type === 'uscita'));
  assert.ok(/Stegab/.test(txs[0].description));
  assert.ok(/Moby Orli/.test(txs[3].description));
});

test('parseScreenshotTransactions: data senza anno "12 Lug" + formato virgola', async () => {
  const { parseScreenshotTransactions } = await import('./screenshot-parser.js');
  const txs = parseScreenshotTransactions('Ristorante Roma -45,80 € 12 Lug - 09:49');
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 45.8);
  assert.equal(txs[0].date.getMonth(), 6); // luglio
  assert.equal(txs[0].date.getDate(), 12);
});
