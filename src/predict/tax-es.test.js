import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RETA_TRAMOS_2026, RETA_ALIQUOTA_2026, tramoReta, cuotaReta,
  IRPF_ESTATAL_2026, irpfEstatal, IVA_ES, RETENCION_IRPF, nettoFatturaConRitenuta,
} from './tax-es.js';

// ── RETA: 15 tramos reali dal BOE (Orden PJC/297/2026) — verificato con
// DUE letture separate della fonte primaria dopo che la prima aveva
// sotto-contato la tabla general (9 righe invece di 12), stessa disciplina
// già applicata a Cassa Forense/Inarcassa/CNPADC. ──

test('RETA_TRAMOS_2026: 15 tramos reali (3 tabla reducida + 12 tabla general)', () => {
  assert.equal(RETA_TRAMOS_2026.length, 15);
});

test('tramoReta: reddito basso finisce nella tabla reducida', () => {
  const t = tramoReta(500);
  assert.equal(t.rendimientoHasta, 670);
  assert.equal(t.baseMinima, 653.59);
});

test('tramoReta: reddito alto finisce nell\'ultimo tramo aperto (>6000)', () => {
  const t = tramoReta(10000);
  assert.equal(t.rendimientoHasta, Infinity);
  assert.equal(t.baseMinima, 1928.10);
});

test('tramoReta: reddito 0 o negativo non crasha, ricade sul primo tramo', () => {
  assert.equal(tramoReta(0).rendimientoHasta, 670);
  assert.equal(tramoReta(-500).rendimientoHasta, 670);
  assert.equal(tramoReta(null).rendimientoHasta, 670);
});

test('cuotaReta: default usa la base mínima del tramo, mai una base più alta imposta', () => {
  const r = cuotaReta(2000); // tramo 1850-2030
  assert.equal(r.tramo.rendimientoHasta, 2030);
  assert.equal(r.baseUsata, 1209.15);
  assert.equal(r.baseÈMinima, true);
  assert.equal(r.cuotaMensual, +(1209.15 * RETA_ALIQUOTA_2026).toFixed(2));
});

test('cuotaReta: aliquota 2026 è 30,5% (28,30 contingencias comunes + 1,30 profesionales + 0,90 MEI)', () => {
  assert.equal(+RETA_ALIQUOTA_2026.toFixed(3), 0.305);
});

test('cuotaReta: base scelta esplicitamente viene rispettata, ma vincolata dentro il tramo (mai fuori range)', () => {
  const dentro = cuotaReta(2000, { baseElegida: 1500 }); // dentro 1209.15-2030
  assert.equal(dentro.baseUsata, 1500);
  assert.equal(dentro.baseÈMinima, false);
  const sottoIlMinimo = cuotaReta(2000, { baseElegida: 100 }); // sotto 1209.15
  assert.equal(sottoIlMinimo.baseUsata, 1209.15, 'non scende sotto il minimo del tramo');
  const sopraIlMassimo = cuotaReta(2000, { baseElegida: 99999 }); // sopra 2030
  assert.equal(sopraIlMassimo.baseUsata, 2030, 'non sale sopra il massimo del tramo');
});

// ── IRPF: solo scaglione statale, dichiarato esplicitamente ──

test('irpfEstatal: scaglioni progressivi reali (9,5% -> 24,5%), ogni fascia paga solo la sua parte', () => {
  // 12450*0.095 = 1182.75 esatto sul primo scaglione
  assert.equal(irpfEstatal(12450), 1182.75);
  // Sopra il primo scaglione: 12450*0.095 + (20200-12450)*0.12 = 1182.75+930 = 2112.75
  assert.equal(irpfEstatal(20200), 2112.75);
});

test('irpfEstatal: reddito 0 o negativo -> 0, mai un\'imposta negativa', () => {
  assert.equal(irpfEstatal(0), 0);
  assert.equal(irpfEstatal(-1000), 0);
});

test('irpfEstatal: fascia più alta aperta (>300.000) usa il 24,5%, non un\'aliquota inventata', () => {
  const base = 400000;
  const atteso = 12450 * 0.095 + (20200 - 12450) * 0.12 + (35200 - 20200) * 0.15 + (60000 - 35200) * 0.185 + (300000 - 60000) * 0.225 + (400000 - 300000) * 0.245;
  assert.equal(irpfEstatal(base), +atteso.toFixed(2));
});

// ── IVA e ritenuta ──

test('IVA_ES: aliquote reali verificate su Agencia Tributaria (21/10/4%)', () => {
  assert.equal(IVA_ES.general, 0.21);
  assert.equal(IVA_ES.reducido, 0.10);
  assert.equal(IVA_ES.superreducido, 0.04);
});

test('nettoFatturaConRitenuta: ritenuta generale 15%, ridotta 7% nei primi anni di attività', () => {
  const generale = nettoFatturaConRitenuta(1000);
  assert.equal(generale.ritenuta, 150);
  assert.equal(generale.netto, 850);
  const ridotta = nettoFatturaConRitenuta(1000, { primeriAnni: true });
  assert.equal(ridotta.ritenuta, 70);
  assert.equal(ridotta.netto, 930);
});

test('nettoFatturaConRitenuta: importo 0 o negativo non crasha', () => {
  assert.equal(nettoFatturaConRitenuta(0).netto, 0);
  assert.equal(nettoFatturaConRitenuta(-500).netto, 0);
});
