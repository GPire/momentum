'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFatturaPaXML, fatturaPassivaToAcquisti } from './fatturapa-import.js';
import { buildFatturaPaXML } from './fatturapa-xml.js';

const fornitoreTest = {
  emitter: { partitaIva: '01234567890', denominazione: 'Fornitore Test SRL', indirizzo: 'Via Roma 1', cap: '20100', comune: 'Milano', provincia: 'MI' },
  client: { partitaIva: '09876543210', denominazione: 'Mario Rossi', indirizzo: 'Via Milano 2', cap: '00100', comune: 'Roma', provincia: 'RM' },
  invoice: { imponibile: 500, ivaImporto: 110, cassaImporto: 0, ritenutaImporto: 0, bolloImporto: 0, regime: 'ordinario' },
  meta: { number: 42, year: 2026, date: '2026-03-15', regime: 'ordinario', description: 'Materiale ufficio' },
};

test('parseFatturaPaXML: round-trip su un XML generato da buildFatturaPaXML — legge fornitore, data, imponibile, aliquota', () => {
  const { xml } = buildFatturaPaXML(fornitoreTest);
  const parsed = parseFatturaPaXML(xml);
  assert.equal(parsed.errore, undefined);
  assert.equal(parsed.fornitore, 'Fornitore Test SRL');
  assert.equal(parsed.partitaIvaCedente, '01234567890');
  assert.equal(parsed.data, '2026-03-15');
  assert.equal(parsed.righeRiepilogo.length, 1);
  assert.equal(parsed.righeRiepilogo[0].imponibile, 500);
  assert.equal(parsed.righeRiepilogo[0].aliquotaIva, 0.22);
});

test('parseFatturaPaXML: file che non è una FatturaPA -> errore chiaro, nessun crash', () => {
  const parsed = parseFatturaPaXML('<html><body>non è una fattura</body></html>');
  assert.match(parsed.errore, /non sembra una fattura elettronica/);
});

test('parseFatturaPaXML: input vuoto/assente -> errore, non un crash', () => {
  assert.match(parseFatturaPaXML('').errore, /non sembra/);
  assert.match(parseFatturaPaXML(null).errore, /non sembra/);
});

test('parseFatturaPaXML: FatturaPA valida ma senza importi -> errore onesto invece di un dato inventato', () => {
  const xml = '<FatturaElettronica versione="FPR12"><FatturaElettronicaHeader><CedentePrestatore><Anagrafica><Denominazione>X</Denominazione></Anagrafica></CedentePrestatore></FatturaElettronicaHeader></FatturaElettronica>';
  const parsed = parseFatturaPaXML(xml);
  assert.match(parsed.errore, /mancano dati essenziali/);
});

test('parseFatturaPaXML: forfettario emittente -> aliquota 0, imponibile letto correttamente', () => {
  const { xml } = buildFatturaPaXML({
    ...fornitoreTest,
    invoice: { imponibile: 800, ivaImporto: 0, cassaImporto: 0, ritenutaImporto: 0, bolloImporto: 0, regime: 'forfettario' },
    meta: { ...fornitoreTest.meta, regime: 'forfettario' },
  });
  const parsed = parseFatturaPaXML(xml);
  assert.equal(parsed.righeRiepilogo[0].imponibile, 800);
  assert.equal(parsed.righeRiepilogo[0].aliquotaIva, 0);
});

test('fatturaPassivaToAcquisti: produce voci nel formato del registro acquisti, pronte da sommare all\'IVA a credito', () => {
  const { xml } = buildFatturaPaXML(fornitoreTest);
  const parsed = parseFatturaPaXML(xml);
  const acquisti = fatturaPassivaToAcquisti(parsed);
  assert.equal(acquisti.length, 1);
  assert.equal(acquisti[0].imponibile, 500);
  assert.equal(acquisti[0].aliquotaIva, 0.22);
  assert.equal(acquisti[0].data, '2026-03-15');
  assert.match(acquisti[0].descrizione, /Fornitore Test SRL/);
  assert.match(acquisti[0].descrizione, /42\/2026/);
});

test('fatturaPassivaToAcquisti: su un errore di parsing -> lista vuota, mai un\'eccezione', () => {
  assert.deepEqual(fatturaPassivaToAcquisti({ errore: 'x' }), []);
  assert.deepEqual(fatturaPassivaToAcquisti(null), []);
});

test('parseFatturaPaXML: multi-voce (voci[]) con più aliquote diverse -> più righeRiepilogo distinte', () => {
  // Nota: DatiRiepilogo è per ALIQUOTA (non per voce): una fattura con più
  // voci alla STESSA aliquota produce un solo riepilogo, corretto.
  const { xml } = buildFatturaPaXML({
    ...fornitoreTest,
    invoice: { imponibile: 500, ivaImporto: 110, cassaImporto: 0, ritenutaImporto: 0, bolloImporto: 0, regime: 'ordinario' },
    meta: { ...fornitoreTest.meta, voci: [{ descrizione: 'Materiale', importo: 300 }, { descrizione: 'Trasporto', importo: 200 }] },
  });
  const parsed = parseFatturaPaXML(xml);
  assert.equal(parsed.righeRiepilogo.length, 1);
  assert.equal(parsed.righeRiepilogo[0].imponibile, 500);
});
