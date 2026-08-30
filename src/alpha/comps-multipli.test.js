import test from 'node:test';
import assert from 'node:assert/strict';
import { analizzaComps, testoComps, esportaCompsCsv } from './comps-multipli.js';

test('senza pari, dichiara onestamente non disponibile', () => {
  const r = analizzaComps({ symbol: 'ACME' }, []);
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /ACME/);
});

test('senza target, dichiara onestamente non disponibile', () => {
  const r = analizzaComps(null, [{ symbol: 'X', evToEbitda: 10 }]);
  assert.equal(r.disponibile, false);
});

test('calcola la mediana EV/EBITDA dei pari, esclude quelli senza dato utilizzabile', () => {
  const target = { symbol: 'ACME', evToEbitda: 12, ebitda: 1_000_000 };
  const peers = [
    { symbol: 'A', evToEbitda: 8 },
    { symbol: 'B', evToEbitda: 10 },
    { symbol: 'C', evToEbitda: 14 },
    { symbol: 'D', evToEbitda: null }, // azienda in perdita, esclusa
    { symbol: 'E', evToEbitda: -3 }, // negativo, escluso (mai un multiplo negativo nella mediana)
  ];
  const r = analizzaComps(target, peers);
  assert.equal(r.disponibile, true);
  assert.equal(r.medianaEvEbitda, 10); // mediana di [8,10,14]
  assert.equal(r.pariConDato.evEbitda, 3);
  assert.equal(r.numeroPari, 5); // tutti i pari validi contati, anche quelli senza dato
});

test('il target non compare mai tra i propri pari, anche se incluso per errore dal chiamante', () => {
  const target = { symbol: 'ACME', evToEbitda: 12, ebitda: 1_000_000 };
  const peers = [{ symbol: 'ACME', evToEbitda: 12 }, { symbol: 'B', evToEbitda: 10 }];
  const r = analizzaComps(target, peers);
  assert.equal(r.numeroPari, 1, 'il target incluso per errore tra i pari va escluso, non contato');
});

test('EV implicito: mediana dei pari applicata all\'EBITDA reale del target, mai un\'invenzione', () => {
  const target = { symbol: 'ACME', evToEbitda: 12, ebitda: 2_000_000 };
  const peers = [{ symbol: 'A', evToEbitda: 8 }, { symbol: 'B', evToEbitda: 10 }, { symbol: 'C', evToEbitda: 12 }];
  const r = analizzaComps(target, peers);
  assert.equal(r.medianaEvEbitda, 10);
  assert.equal(r.evImplicitoEbitda, 20_000_000); // 10 × 2.000.000
});

test('scostamento: il target sopra la mediana dei pari risulta "più caro", mai un giudizio nascosto nel numero', () => {
  const target = { symbol: 'ACME', evToEbitda: 15, ebitda: 1_000_000 };
  const peers = [{ symbol: 'A', evToEbitda: 10 }, { symbol: 'B', evToEbitda: 10 }];
  const r = analizzaComps(target, peers);
  assert.equal(r.medianaEvEbitda, 10);
  assert.equal(r.scostoEbitda, 50); // (15-10)/10 = +50%
});

test('senza EBITDA reale del target, mai un EV implicito inventato (resta null)', () => {
  const target = { symbol: 'ACME', evToEbitda: 12, ebitda: null };
  const peers = [{ symbol: 'A', evToEbitda: 10 }];
  const r = analizzaComps(target, peers);
  assert.equal(r.evImplicitoEbitda, null);
});

test('nessun pari con multiplo utilizzabile su nessuna metrica: dichiara onestamente, mai una mediana vuota spacciata per zero', () => {
  const target = { symbol: 'ACME', ebitda: 1_000_000 };
  const peers = [{ symbol: 'A', evToEbitda: null, evToRevenue: null }];
  const r = analizzaComps(target, peers);
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /nessun/i);
});

test('testoComps: mai un consiglio di acquisto/vendita, sempre dichiarato come ipotesi', () => {
  const target = { symbol: 'ACME', evToEbitda: 12, ebitda: 1_000_000 };
  const peers = [{ symbol: 'A', evToEbitda: 10 }, { symbol: 'B', evToEbitda: 10 }];
  const r = analizzaComps(target, peers);
  const testo = testoComps(r);
  assert.match(testo, /non è un prezzo obiettivo/i);
  assert.doesNotMatch(testo, /compra|vendi|consiglio/i);
});

test('testoComps: quando non disponibile, ritorna il motivo dichiarato', () => {
  const r = analizzaComps({ symbol: 'ACME' }, []);
  assert.equal(testoComps(r), r.motivo);
});

// ── esportaCompsCsv: gli analisti IB vogliono la tabella dentro Excel, non
// solo una frase (ricerca 2026-08-30, complaint reale su Bloomberg/Capital IQ:
// "care più degli agganci a Office che degli screenshot"). ──
test('esportaCompsCsv: riga target + righe pari + riga mediana, stesse colonne', () => {
  const target = { symbol: 'ACME', name: 'Acme Corp', evToEbitda: 12, evToRevenue: 3, ebitda: 1_000_000 };
  const peers = [{ symbol: 'A', name: 'Alpha Inc', evToEbitda: 10, evToRevenue: 2.5 }, { symbol: 'B', name: 'Beta Ltd', evToEbitda: 10, evToRevenue: 2.5 }];
  const r = analizzaComps(target, peers);
  const csv = esportaCompsCsv(r);
  const righe = csv.split('\r\n');
  assert.equal(righe.length, 5); // intestazione + target + 2 pari + mediana
  assert.match(righe[0], /Ticker,Nome,EV\/EBITDA,EV\/Revenue,Ruolo/);
  assert.match(righe[1], /^ACME,Acme Corp,12,3,TARGET$/);
  assert.match(righe[4], /MEDIANA PARI,10,2.5/);
});

test('esportaCompsCsv: un nome azienda con la virgola dentro non rompe il CSV (RFC 4180)', () => {
  const target = { symbol: 'ACME', name: 'Acme, Inc.', evToEbitda: 12, ebitda: 1_000_000 };
  const peers = [{ symbol: 'A', name: 'Alpha', evToEbitda: 10 }];
  const r = analizzaComps(target, peers);
  const csv = esportaCompsCsv(r);
  assert.match(csv, /"Acme, Inc\."/);
});

test('esportaCompsCsv: quando non disponibile, ritorna stringa vuota (mai un CSV a metà)', () => {
  const r = analizzaComps({ symbol: 'ACME' }, []);
  assert.equal(esportaCompsCsv(r), '');
});
