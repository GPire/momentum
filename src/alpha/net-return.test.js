'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNetReturn, ALIQUOTA_CAPITAL_GAIN, ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO, BOLLO_TITOLI_ALIQUOTA_ANNUA, BOLLO_TITOLI_SOGLIA_ESENZIONE,
  COUNTRY_TAX_PROFILES, netReturnFreshness, validateNetReturnPayload, fetchNetReturnRatesUpdate, NET_RETURN_RATES_VERSION,
} from './net-return.js';

test('aliquote verificate: 26% azioni/ETF/crypto, 12,5% titoli di Stato, bollo 0,2%, soglia 5000€', () => {
  assert.equal(ALIQUOTA_CAPITAL_GAIN, 0.26);
  assert.equal(ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO, 0.125);
  assert.equal(BOLLO_TITOLI_ALIQUOTA_ANNUA, 0.002);
  assert.equal(BOLLO_TITOLI_SOGLIA_ESENZIONE, 5000);
});

test('computeNetReturn: plusvalenza su azione tassata al 26%, minusvalenza mai tassata', () => {
  const rows = [
    { ticker: 'AAPL', assetClass: 'stock', pl: 1000, cost: 5000 },
    { ticker: 'TSLA', assetClass: 'stock', pl: -500, cost: 2000 },
  ];
  const r = computeNetReturn(rows, 10000);
  const aapl = r.rows.find(x => x.ticker === 'AAPL');
  const tsla = r.rows.find(x => x.ticker === 'TSLA');
  assert.equal(aapl.impostaCapitalGain, 260); // 1000 * 0.26
  assert.equal(aapl.netPl, 740);
  assert.equal(tsla.impostaCapitalGain, 0, 'una perdita non paga mai imposta');
  assert.equal(tsla.netPl, -500);
});

test('computeNetReturn: bond usa l\'aliquota agevolata 12,5%, non il 26%', () => {
  const rows = [{ ticker: 'BTP', assetClass: 'bond', pl: 800, cost: 10000 }];
  const r = computeNetReturn(rows, 10800);
  assert.equal(r.rows[0].aliquotaCapitalGain, 0.125);
  assert.equal(r.rows[0].impostaCapitalGain, 100); // 800 * 0.125
});

test('computeNetReturn: bollo titoli 0,2% annuo sul totale, sopra la soglia di 5.000€', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 0, cost: 10000 }];
  const r = computeNetReturn(rows, 10000);
  assert.equal(r.bolloTitoli, 20); // 10000 * 0.002
  assert.equal(r.bolloEsente, false);
});

test('computeNetReturn: sotto i 5.000€ il bollo è esente, mai addebitato', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 0, cost: 3000 }];
  const r = computeNetReturn(rows, 3000);
  assert.equal(r.bolloTitoli, 0);
  assert.equal(r.bolloEsente, true);
});

test('computeNetReturn: il totale netto sottrae imposta E bollo dal lordo, mai solo uno dei due', () => {
  const rows = [{ ticker: 'X', assetClass: 'stock', pl: 1000, cost: 9000 }];
  const r = computeNetReturn(rows, 10000);
  // lordo 1000, imposta 260, bollo 20 -> netto 720
  assert.equal(r.totalPlLordo, 1000);
  assert.equal(r.totaleImpostaCapitalGain, 260);
  assert.equal(r.bolloTitoli, 20);
  assert.equal(r.netTotalPl, 720);
});

test('computeNetReturn: portafoglio vuoto -> tutto a zero, nessun crash', () => {
  const r = computeNetReturn([], 0);
  assert.equal(r.netTotalPl, 0);
  assert.equal(r.bolloTitoli, 0);
  assert.deepEqual(r.rows, []);
});

test('computeNetReturn: dichiara sempre il limite sulle minusvalenze non compensate (onestà)', () => {
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 100, cost: 1000 }], 1000);
  assert.match(r.disclaimer, /credito d'imposta per gli anni futuri/);
});

// ── Espansione multi-Paese (stesso schema di country-invoicing.js) ──
test('COUNTRY_TAX_PROFILES: Germania 26,375% flat (Abgeltungssteuer + Soli), Francia 31,4% (PFU 2026)', () => {
  assert.equal(COUNTRY_TAX_PROFILES.DE.aliquotaStandard, 0.26375);
  assert.equal(COUNTRY_TAX_PROFILES.FR.aliquotaStandard, 0.314);
  assert.equal(COUNTRY_TAX_PROFILES.DE.bollo, null, 'la Germania non ha un bollo titoli come l\'Italia');
});

test('computeNetReturn: Germania applica la franchigia Sparerpauschbetrag (1.000€) prima di tassare', () => {
  const rows = [{ ticker: 'ETF', assetClass: 'stock', pl: 2000, cost: 10000 }];
  const r = computeNetReturn(rows, 12000, 'DE');
  // taxableGains = 2000 - 1000 = 1000; imposta = 1000 * 0.26375 = 263.75
  assert.equal(r.allowanceApplicata, 1000);
  assert.equal(r.totaleImpostaCapitalGain, 263.75);
  assert.equal(r.bolloTitoli, 0, 'nessun bollo in Germania');
});

test('computeNetReturn: Francia tassa tutto al 31,4% flat, nessuna franchigia nel regime PFU', () => {
  const rows = [{ ticker: 'CAC', assetClass: 'stock', pl: 1000, cost: 5000 }];
  const r = computeNetReturn(rows, 6000, 'FR');
  assert.equal(r.totaleImpostaCapitalGain, 314); // 1000 * 0.314
  assert.equal(r.allowanceApplicata, 0);
});

test('computeNetReturn: Paese sconosciuto -> ripiega sull\'Italia, mai un crash o un\'aliquota inventata', () => {
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 100, cost: 1000 }], 1000, 'ZZ');
  assert.equal(r.country, 'ZZ');
  assert.equal(r.countryName, 'Italia'); // fallback dichiarato, non un errore silenzioso
});

// ── Freschezza dichiarata ──
test('netReturnFreshness: verificato di recente -> livello ok', () => {
  const f = netReturnFreshness('IT', { now: new Date('2026-08-10') });
  assert.equal(f.livello, 'ok');
  assert.equal(f.aggiornato, true);
});

test('netReturnFreshness: oltre il periodo di revisione -> livello verifica, onestamente dichiarato scaduto', () => {
  const f = netReturnFreshness('IT', { now: new Date('2028-01-01') }); // oltre 365 giorni per l'Italia
  assert.equal(f.livello, 'verifica');
  assert.equal(f.aggiornato, false);
  assert.match(f.messaggio, /potrebbero essere cambiate/);
});

test('netReturnFreshness: Germania ha un periodo di revisione più lungo (stabile dal 2009)', () => {
  const dueAnniDopo = netReturnFreshness('DE', { now: new Date('2028-08-06') }); // 2 anni dopo
  assert.equal(dueAnniDopo.livello, 'probabile', 'per la Germania 2 anni sono ancora nel periodo tipico');
});

// ── Auto-aggiornamento (stesso schema verificato di fetchRulesUpdate) ──
test('validateNetReturnPayload: payload valido passa', () => {
  const v = validateNetReturnPayload({
    version: '2026-09', profiles: { IT: { name: 'Italia', aliquotaStandard: 0.26, allowanceAnnuo: 0, verificatoIl: '2026-09-01', periodoRevisioneGiorni: 365 } },
  });
  assert.equal(v.ok, true);
});

test('validateNetReturnPayload: aliquota implausibile (es. 90%) viene respinta — anti-veleno', () => {
  const v = validateNetReturnPayload({
    version: '2026-09', profiles: { IT: { name: 'Italia', aliquotaStandard: 0.9, allowanceAnnuo: 0, verificatoIl: '2026-09-01', periodoRevisioneGiorni: 365 } },
  });
  assert.equal(v.ok, false);
  assert.match(v.reason, /implausibile/);
});

test('validateNetReturnPayload: payload malformato o vuoto -> respinto, mai un crash', () => {
  assert.equal(validateNetReturnPayload(null).ok, false);
  assert.equal(validateNetReturnPayload({}).ok, false);
  assert.equal(validateNetReturnPayload({ version: '2026-09', profiles: {} }).ok, false);
});

test('fetchNetReturnRatesUpdate: senza url configurata -> resta sui dati inclusi, nessuna chiamata', async () => {
  const r = await fetchNetReturnRatesUpdate({});
  assert.equal(r.updated, false);
  assert.match(r.reason, /nessuna fonte/);
});

test('fetchNetReturnRatesUpdate: payload valido e più recente -> adottato', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      version: '2099-01',
      profiles: { IT: { name: 'Italia', aliquotaStandard: 0.27, allowanceAnnuo: 0, verificatoIl: '2099-01-01', periodoRevisioneGiorni: 365 } },
    }),
  });
  const r = await fetchNetReturnRatesUpdate({ url: 'https://example.test/rates.json', fetchImpl, currentVersion: NET_RETURN_RATES_VERSION });
  assert.equal(r.updated, true);
  assert.equal(r.profiles.IT.aliquotaStandard, 0.27);
});

test('fetchNetReturnRatesUpdate: payload avvelenato (aliquota fuori scala) -> MAI adottato', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ version: '2099-01', profiles: { IT: { name: 'Italia', aliquotaStandard: 5, allowanceAnnuo: 0, verificatoIl: '2099-01-01', periodoRevisioneGiorni: 365 } } }),
  });
  const r = await fetchNetReturnRatesUpdate({ url: 'https://example.test/rates.json', fetchImpl });
  assert.equal(r.updated, false);
  assert.match(r.reason, /anti-veleno/);
});

test('computeNetReturn: un profilesOverride valido cambia davvero il calcolo, senza aggiornare l\'app', () => {
  const override = { IT: { ...COUNTRY_TAX_PROFILES.IT, aliquotaStandard: 0.30 } };
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 1000, cost: 5000 }], 1000, 'IT', override);
  assert.equal(r.totaleImpostaCapitalGain, 300); // 1000 * 0.30, non 0.26
});

// ── Svizzera: il caso più semplice e più forte del registro ──
test('COUNTRY_TAX_PROFILES: Svizzera esente al 0%, federale e cantonale, per investitori privati', () => {
  assert.equal(COUNTRY_TAX_PROFILES.CH.aliquotaStandard, 0);
  assert.equal(COUNTRY_TAX_PROFILES.CH.bollo, null);
  assert.match(COUNTRY_TAX_PROFILES.CH.noteRischio, /KS 36/);
});

test('computeNetReturn: Svizzera -> netto identico al lordo, zero imposta su qualunque plusvalenza', () => {
  const rows = [{ ticker: 'NESN', assetClass: 'stock', pl: 5000, cost: 20000 }];
  const r = computeNetReturn(rows, 25000, 'CH');
  assert.equal(r.totaleImpostaCapitalGain, 0);
  assert.equal(r.netTotalPl, r.totalPlLordo);
  assert.equal(r.bolloTitoli, 0);
});

test('computeNetReturn: Svizzera espone la noteRischio (trader professionale / imposta patrimoniale) — mai una promessa assoluta', () => {
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 100, cost: 1000 }], 1000, 'CH');
  assert.match(r.noteRischio, /trader professionale/);
  assert.match(r.noteRischio, /patrimoniale cantonale/);
});

test('computeNetReturn: un Paese senza noteRischio (es. Italia) espone null, mai un campo vuoto ambiguo', () => {
  const r = computeNetReturn([{ ticker: 'X', assetClass: 'stock', pl: 100, cost: 1000 }], 1000, 'IT');
  assert.equal(r.noteRischio, null);
});

test('validateNetReturnPayload: un\'aliquota 0 verificata (es. esenzione reale) è valida, non respinta come dato mancante', () => {
  const v = validateNetReturnPayload({
    version: '2026-09', profiles: { CH: { name: 'Svizzera', aliquotaStandard: 0, allowanceAnnuo: 0, verificatoIl: '2026-09-01', periodoRevisioneGiorni: 1460 } },
  });
  assert.equal(v.ok, true);
});
