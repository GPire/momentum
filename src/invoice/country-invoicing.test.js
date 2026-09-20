import test from 'node:test';
import assert from 'node:assert/strict';
const { invoiceCountry, selectableCountries, COUNTRIES } = await import('./country-invoicing.js');
const { computeInvoice, renderInvoiceHTML } = await import('./invoice-engine.js');

test('invoiceCountry: IT completo, ignoto → profilo internazionale (mai crash)', () => {
  assert.equal(invoiceCountry('IT').name, 'Italia');
  assert.equal(invoiceCountry('it').eInvoiceMandatory, true);
  assert.equal(invoiceCountry('ZZ').name, COUNTRIES.DEFAULT.name); // Paese non mappato
  assert.equal(invoiceCountry().eInvoiceMandatory, false);         // default internazionale
});

test('ITALIA resta IDENTICA: ordinario 1000€ = stessi calcoli di prima', () => {
  const it = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'IT' });
  assert.equal(it.cassaImporto, 40);      // 4%
  assert.equal(it.ivaImporto, 228.80);    // 22% su 1040
  assert.equal(it.ritenutaImporto, 200);  // 20%
  assert.equal(it.totaleFattura, 1268.80);
});

test('Paese internazionale: nessuna ritenuta/cassa/bollo di default, solo IVA se indicata', () => {
  const intl = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'DEFAULT', ivaPct: 0.19 });
  assert.equal(intl.ritenutaImporto, 0);
  assert.equal(intl.cassaImporto, 0);
  assert.equal(intl.bolloImporto, 0);
  assert.equal(intl.ivaImporto, 190);     // 19% (es. Germania) — configurabile
  assert.equal(intl.totaleFattura, 1190);
});

test('Paese internazionale forfettario-like senza IVA: totale = imponibile, niente bollo', () => {
  const intl = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'DEFAULT' });
  assert.equal(intl.bolloImporto, 0);
  assert.equal(intl.totaleFattura, 1000);
});

test('disclaimer HTML per-Paese: IT parla di SdI, internazionale no', () => {
  const inv = computeInvoice({ imponibile: 500, regime: 'forfettario', country: 'IT' });
  const itHtml = renderInvoiceHTML(inv, { number: 1, year: 2026, client: 'A', country: 'IT' });
  const intlHtml = renderInvoiceHTML(inv, { number: 1, year: 2026, client: 'A', country: 'DEFAULT' });
  assert.ok(/SdI/.test(itHtml));
  assert.ok(!/SdI/.test(intlHtml));
  assert.ok(/tax obligations/i.test(intlHtml));
});

// BUG REALE trovato e corretto: il profilo internazionale dichiara
// locale:'en' ma testo ed etichette del documento erano SEMPRE in italiano —
// un cliente fuori Italia riceveva un documento che non poteva leggere.
test('documento internazionale (locale "en"): etichette e disclaimer in inglese, IT resta in italiano', () => {
  const inv = computeInvoice({ imponibile: 500, regime: 'forfettario', country: 'DEFAULT' });
  const intlHtml = renderInvoiceHTML(inv, { number: 2, year: 2026, client: 'Global Client Inc', country: 'DEFAULT' });
  assert.match(intlHtml, /<html lang="en"/);
  assert.match(intlHtml, /Invoice no\. 2\/2026/);
  assert.match(intlHtml, />From</);
  assert.match(intlHtml, />To</);
  assert.match(intlHtml, /Invoice total/);
  assert.match(intlHtml, /Net amount due/);
  assert.doesNotMatch(intlHtml, /Netto a ricevere|Fattura n\./);

  const itHtml = renderInvoiceHTML(inv, { number: 2, year: 2026, client: 'Cliente Italiano', country: 'IT' });
  assert.match(itHtml, /<html lang="it"/);
  assert.match(itHtml, /Fattura n\. 2\/2026/);
  assert.match(itHtml, /Netto a ricevere/);
});

test('selectableCountries: Italia mappata, altri come profilo internazionale', () => {
  const list = selectableCountries();
  assert.ok(list.find(c => c.code === 'IT' && c.mapped));
  assert.ok(list.find(c => c.code === 'DEFAULT'));
});

test('codici non mappati e proprietà ereditate usano sempre il profilo internazionale', () => {
  for (const code of ['CH', 'ES', '__proto__', 'constructor', 'toString', ' IT ']) {
    const expected = code.trim() === 'IT' ? COUNTRIES.IT : COUNTRIES.DEFAULT;
    assert.equal(invoiceCountry(code), expected);
    assert.doesNotThrow(() => renderInvoiceHTML({}, { country: code }));
  }
});

test('documenti generati non certificano validità fiscale o trasmissione', () => {
  const inv = computeInvoice({ imponibile: 500, regime: 'forfettario', country: 'IT' });
  const it = renderInvoiceHTML(inv, { country: 'IT' });
  const intl = renderInvoiceHTML(inv, { country: 'ES' });
  assert.match(it, /non attesta/i);
  assert.doesNotMatch(it, /valido per la contabilita/i);
  assert.match(intl, /not verified/i);
  assert.doesNotMatch(intl, /valid as an invoice/i);
});
