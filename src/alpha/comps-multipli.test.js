import test from 'node:test';
import assert from 'node:assert/strict';
import { analizzaComps, testoComps } from './comps-multipli.js';

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
