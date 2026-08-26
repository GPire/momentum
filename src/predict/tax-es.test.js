import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RETA_TRAMOS_2026, RETA_ALIQUOTA_2026, tramoReta, cuotaReta,
  IRPF_ESTATAL_2026, irpfEstatal, IVA_ES, RETENCION_IRPF, nettoFatturaConRitenuta,
  retaIrpfPeriodo,
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

// ── retaIrpfPeriodo: accantonamento reale dalle transazioni del Vault ──

test('retaIrpfPeriodo: nessuna transazione -> count 0, nessun crash', () => {
  const r = retaIrpfPeriodo([]);
  assert.equal(r.count, 0);
  assert.equal(r.incassato, 0);
  assert.equal(r.reta, null);
});

test('retaIrpfPeriodo: riconosce le fatture in SPAGNOLO ("factura", "cliente"), non solo IT/EN', () => {
  const txs = [
    { type: 'entrata', amount: 1500, description: 'Factura cliente ACME' },
    { type: 'entrata', amount: 500, description: 'Nómina empresa X' }, // salario, escluso
    { type: 'entrata', amount: 100, description: 'Reembolso Amazon' }, // rimborso, escluso
  ];
  const r = retaIrpfPeriodo(txs);
  assert.equal(r.count, 1);
  assert.equal(r.incassato, 1500);
  assert.equal(r.excludedCount, 2);
});

test('retaIrpfPeriodo: somma PRIMA tutte le fatture del mese e cerca il tramo UNA VOLTA sul totale, non per singola transazione (la RETA non è proporzionale come l\'INPS italiano)', () => {
  // 10 fatture da 300€ = 3000€ reali: devono finire nel tramo di 3000€
  // (2760-3190), NON in 10 volte il tramo di 300€ (fino a 670€).
  const txs = Array.from({ length: 10 }, (_, i) => ({ type: 'entrata', amount: 300, description: `Factura ${i}` }));
  const r = retaIrpfPeriodo(txs);
  assert.equal(r.incassato, 3000);
  assert.equal(r.reta.tramo.rendimientoHasta, 3190, 'deve usare il tramo del TOTALE (3000€), non 10 tramos separati da 300€');
  assert.equal(r.reta.cuotaMensual, cuotaReta(3000).cuotaMensual);
});

test('retaIrpfPeriodo: irpfMensual coerente con irpfEstatal annualizzato sul reddito del periodo', () => {
  const txs = [{ type: 'entrata', amount: 2000, description: 'Factura consultoría' }];
  const r = retaIrpfPeriodo(txs);
  assert.equal(r.irpfMensual, +(irpfEstatal(2000 * 12) / 12).toFixed(2));
});

test('retaIrpfPeriodo: disponibleReal = incassato - cuota RETA - IRPF mensile, mai un numero scollegato', () => {
  const txs = [{ type: 'entrata', amount: 2000, description: 'Factura consultoría' }];
  const r = retaIrpfPeriodo(txs);
  assert.equal(r.disponibleReal, +(2000 - r.reta.cuotaMensual - r.irpfMensual).toFixed(2));
});

test('retaIrpfPeriodo: entrate ambigue (kind uncertain) restano fuori dal calcolo ma vengono segnalate, mai tassate d\'ufficio', () => {
  const txs = [
    { type: 'entrata', amount: 1000, description: 'Factura cliente' },
    { type: 'entrata', amount: 200, description: 'Movimiento sin descripción clara' },
  ];
  const r = retaIrpfPeriodo(txs);
  assert.equal(r.incassato, 1000, 'la entrata ambigua non entra nel tassabile');
  assert.equal(r.uncertainCount, 1);
  assert.equal(r.uncertain.length, 1);
});

test('retaIrpfPeriodo: passa baseElegida a cuotaReta quando fornita (scelta base máxima)', () => {
  const txs = [{ type: 'entrata', amount: 2000, description: 'Factura consultoría' }]; // tramo 1850-2030
  const r = retaIrpfPeriodo(txs, { baseElegida: 2030 });
  assert.equal(r.reta.baseUsata, 2030);
  assert.equal(r.reta.baseÈMinima, false);
});
