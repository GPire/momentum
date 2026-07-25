import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoice } from './invoice-engine.js';
import { buildFatturaPaXML, validateFatturaPa } from './fatturapa-xml.js';

// ══════════════════════════════════════════════════════════════════════════
// SIMULAZIONE "COMMERCIALISTA" — profili diversi, calcolo + XML SdI verificati.
// Piccolo/grande freelancer, SRL piccola/media/grande, SpA. Ogni caso: calcolo
// corretto (IVA/ritenuta/cassa/totale) + fattura elettronica che NON verrebbe
// scartata dallo SdI (nessun errore bloccante) + RegimeFiscale giusto.
// ══════════════════════════════════════════════════════════════════════════

// P.IVA italiane con checksum VALIDO (generate con la funzione reale dell'app).
const PIVA_EMIT = '00743110157';
const PIVA_CLI = '12345670892';
const PIVA_CLI2 = '98765430107';

const emitterBase = {
  denominazione: 'Emittente Test', partitaIva: PIVA_EMIT,
  indirizzo: 'Via Roma 1', cap: '20100', comune: 'Milano', provincia: 'MI', nazione: 'IT',
};
const clientAzienda = (piva = PIVA_CLI) => ({
  denominazione: 'Cliente Azienda Srl', partitaIva: piva,
  indirizzo: 'Corso Italia 5', cap: '00100', comune: 'Roma', provincia: 'RM', nazione: 'IT',
  codiceDestinatario: 'ABCDE12',
});

// Nessun errore BLOCCANTE = lo SdI la accetterebbe (i warn sono ammessi).
function noBlocking(data, etichetta) {
  const controls = validateFatturaPa(data);
  const errs = controls.filter(c => c.level === 'error');
  assert.equal(errs.length, 0, `${etichetta}: errori bloccanti SdI → ${JSON.stringify(errs)}`);
}

test('PICCOLO FREELANCER — forfettario: no IVA, no ritenuta, bollo se >77,47€', () => {
  const inv = computeInvoice({ imponibile: 3000, regime: 'forfettario' });
  assert.equal(inv.ivaImporto, 0, 'forfettario non ha IVA');
  assert.equal(inv.ritenutaImporto, 0, 'forfettario non ha ritenuta');
  assert.equal(inv.bolloImporto, 2, 'bollo 2€ dovuto sopra 77,47€ senza IVA');
  assert.equal(inv.totaleFattura, 3002, 'imponibile + bollo');
  const meta = { number: 1, year: 2026, date: '2026-03-10', regime: 'forfettario' };
  const data = { emitter: emitterBase, client: clientAzienda(), invoice: inv, meta };
  noBlocking(data, 'freelancer forfettario');
  const { xml } = buildFatturaPaXML(data);
  assert.ok(xml.includes('<RegimeFiscale>RF19</RegimeFiscale>'), 'regime forfettario RF19 nel XML');
});

test('GRANDE FREELANCER — ordinario: IVA 22% + ritenuta 20% + cassa 4%', () => {
  const inv = computeInvoice({ imponibile: 8000, regime: 'ordinario', ivaPct: 0.22, ritenutaPct: 0.20, cassaPct: 0.04 });
  // cassa = 320; imponibile IVA = 8320; IVA = 1830,40; ritenuta = 20% di 8000 = 1600.
  assert.equal(inv.cassaImporto, 320);
  assert.equal(inv.ivaImporto, 1830.4);
  assert.equal(inv.ritenutaImporto, 1600);
  // totale = 8000 + 320 + 1830,40 = 10150,40; netto = totale - ritenuta.
  assert.equal(inv.totaleFattura, 10150.4);
  assert.equal(inv.nettoARicevere, 8550.4);
  const meta = { number: 2, year: 2026, date: '2026-04-01', regime: 'ordinario' };
  const data = { emitter: emitterBase, client: clientAzienda(), invoice: inv, meta };
  noBlocking(data, 'freelancer ordinario');
  const { xml } = buildFatturaPaXML(data);
  assert.ok(xml.includes('<RegimeFiscale>RF01</RegimeFiscale>'), 'regime ordinario RF01');
});

// SRL/SpA (società di capitali): IVA 22%, nessuna cassa previdenziale né
// ritenuta d'acconto (non sono professionisti). RegimeFiscale RF01.
for (const [nome, imp] of [['SRL piccola', 5000], ['SRL media', 50000], ['SRL grande', 200000], ['SpA', 500000]]) {
  test(`${nome} — società di capitali: IVA 22%, no cassa/ritenuta, RF01, XML valido`, () => {
    const inv = computeInvoice({ imponibile: imp, regime: 'ordinario', ivaPct: 0.22, ritenutaPct: 0, cassaPct: 0 });
    assert.equal(inv.cassaImporto, 0);
    assert.equal(inv.ritenutaImporto, 0);
    assert.equal(inv.ivaImporto, Math.round(imp * 0.22 * 100) / 100);
    assert.equal(inv.totaleFattura, Math.round((imp + imp * 0.22) * 100) / 100);
    assert.equal(inv.nettoARicevere, inv.totaleFattura, 'senza ritenuta netto = totale');
    const meta = { number: 3, year: 2026, date: '2026-05-15', regime: 'ordinario' };
    const data = { emitter: { ...emitterBase, denominazione: nome + ' Emittente' }, client: clientAzienda(PIVA_CLI2), invoice: inv, meta };
    noBlocking(data, nome);
    const { xml } = buildFatturaPaXML(data);
    assert.ok(xml.includes('<RegimeFiscale>RF01</RegimeFiscale>'));
    assert.ok(xml.includes('<Divisa>EUR</Divisa>') || xml.includes('EUR'), 'divisa EUR');
  });
}

test('SCARTO SdI previsto: cliente senza P.IVA né Codice Fiscale → errore bloccante 00417', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario' });
  const data = {
    emitter: emitterBase,
    client: { denominazione: 'Cliente Senza Id', indirizzo: 'x', cap: '00100', comune: 'Roma', provincia: 'RM' },
    invoice: inv, meta: { number: 9, year: 2026, date: '2026-06-01', regime: 'forfettario' },
  };
  const controls = validateFatturaPa(data);
  assert.ok(controls.some(c => c.code === '00417' && c.level === 'error'), 'atteso errore 00417');
});

test('SCARTO SdI previsto: emittente e cliente stessa P.IVA → errore 00471', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario' });
  const data = {
    emitter: emitterBase,
    client: { ...clientAzienda(PIVA_EMIT) }, // stessa P.IVA dell'emittente
    invoice: inv, meta: { number: 10, year: 2026, date: '2026-06-02', regime: 'ordinario' },
  };
  const controls = validateFatturaPa(data);
  assert.ok(controls.some(c => c.code === '00471' && c.level === 'error'), 'atteso errore 00471');
});
