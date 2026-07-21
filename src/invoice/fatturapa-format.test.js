import test from 'node:test';
import assert from 'node:assert/strict';
const { formatForDate, validateFormatPayload, fetchFormatUpdate, FORMAT_SPECS, FORMAT_REGISTRY_VERSION } = await import('./fatturapa-format.js');
const { buildFatturaPaXML } = await import('./fatturapa-xml.js');
const { computeInvoice } = await import('./invoice-engine.js');

test('formatForDate: oggi → tracciato 1.2.2 / FPR12', () => {
  const s = formatForDate(new Date('2026-07-21'));
  assert.equal(s.tracciato, '1.2.2');
  assert.equal(s.versione, 'FPR12');
  assert.equal(s.regimeCodes.forfettario, 'RF19');
});

test('formatForDate: data prima della prima spec → usa la più vecchia (mai crash)', () => {
  const s = formatForDate(new Date('1990-01-01'));
  assert.ok(s.versione);
});

test('validateFormatPayload: payload valido → ok', () => {
  const p = { version: '2027-01', specs: { '2027-01-01': { tracciato: '1.3.0', versione: 'FPR13', namespace: 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.3', regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' }, naturaForfettario: 'N2.2', decimals: 2 } } };
  assert.equal(validateFormatPayload(p).ok, true);
});

test('validateFormatPayload: namespace non attendibile → rifiutato (anti-veleno)', () => {
  const p = { version: '2027-01', specs: { '2027-01-01': { versione: 'FPR13', namespace: 'http://evil.example.com/x', regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' }, naturaForfettario: 'N2.2', decimals: 2 } } };
  assert.equal(validateFormatPayload(p).ok, false);
});

test('validateFormatPayload: versione tracciato malformata → rifiutato', () => {
  const p = { version: '2027-01', specs: { '2027-01-01': { versione: 'XX', namespace: 'http://ivaservizi.agenziaentrate.gov.it/x', regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' }, naturaForfettario: 'N2.2', decimals: 2 } } };
  assert.equal(validateFormatPayload(p).ok, false);
});

test('fetchFormatUpdate: senza fonte → non aggiorna, fallback sicuro', async () => {
  const r = await fetchFormatUpdate({});
  assert.equal(r.updated, false);
});

test('fetchFormatUpdate: payload avvelenato → NON adottato', async () => {
  const bad = { version: '2099-01', specs: { '2099-01-01': { versione: 'FPR13', namespace: 'http://evil/x', regimeCodes: {}, naturaForfettario: 'N2.2', decimals: 2 } } };
  const fetchImpl = async () => ({ ok: true, json: async () => bad });
  const r = await fetchFormatUpdate({ url: 'https://x', fetchImpl });
  assert.equal(r.updated, false);
  assert.ok(/anti-veleno/.test(r.reason));
});

test('fetchFormatUpdate: payload valido e più recente → adottato', async () => {
  const good = { version: '2099-01', specs: { '2099-01-01': { tracciato: '1.3.0', versione: 'FPR13', namespace: 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.3', regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' }, naturaForfettario: 'N2.2', decimals: 2, tipoDocumentoDefault: 'TD01', tipoRitenuta: 'RT01', tipoCassa: 'TC22', causaleRitenutaDefault: 'A', condizioniPagamento: 'TP02', modalitaPagamento: 'MP05', rifNormativoForfettario: 'x' } } };
  const fetchImpl = async () => ({ ok: true, json: async () => good });
  const r = await fetchFormatUpdate({ url: 'https://x', fetchImpl });
  assert.equal(r.updated, true);
  assert.equal(r.version, '2099-01');
});

test('formatOverride: un formato aggiornato validato cambia l\'XML SENZA toccare il codice', () => {
  const override = { version: '2099-01', specs: { '2099-01-01': { tracciato: '1.3.0', versione: 'FPR13', namespace: 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.3', regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' }, naturaForfettario: 'N2.2', rifNormativoForfettario: 'Rif futuro', tipoDocumentoDefault: 'TD01', tipoRitenuta: 'RT01', tipoCassa: 'TC22', causaleRitenutaDefault: 'A', condizioniPagamento: 'TP02', modalitaPagamento: 'MP05', decimals: 2 } } };
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: { partitaIva: '01234567890', denominazione: 'X', indirizzo: 'a', cap: '00100', comune: 'Roma' },
    client: { denominazione: 'Y', partitaIva: '09876543210', indirizzo: 'b', cap: '20100', comune: 'Milano', codiceDestinatario: 'ABCDEFG' },
    invoice: inv, meta: { number: 1, year: 2099, date: '2099-02-01', regime: 'forfettario', formatOverride: override },
  });
  assert.ok(/versione="FPR13"/.test(xml));
  assert.ok(/v1\.3/.test(xml));
  assert.ok(/<FormatoTrasmissione>FPR13<\/FormatoTrasmissione>/.test(xml));
});

test('FORMAT_SPECS e versione registro presenti', () => {
  assert.ok(Object.keys(FORMAT_SPECS).length >= 1);
  assert.ok(/^\d{4}-\d{2}$/.test(FORMAT_REGISTRY_VERSION));
});
