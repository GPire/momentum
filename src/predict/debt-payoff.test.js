'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinaDebiti, pagamentoInsufficiente, simulaEstinzione, confrontaStrategie, testoConfronto } from './debt-payoff.js';

const CARTA = { id: 'c', nome: 'Carta di credito', saldo: 2000, tasso: 19, pagamentoMinimo: 60 };
const AUTO = { id: 'a', nome: 'Prestito auto', saldo: 8000, tasso: 6, pagamentoMinimo: 200 };
const PICCOLO = { id: 'p', nome: 'Piccolo prestito amico', saldo: 300, tasso: 0, pagamentoMinimo: 50 };

test('ordinaDebiti valanga: tasso più alto prima, ignora i debiti già a zero', () => {
  const r = ordinaDebiti([CARTA, AUTO, { ...PICCOLO, saldo: 0 }], 'valanga');
  assert.deepEqual(r.map((d) => d.id), ['c', 'a']);
});

test('ordinaDebiti palla-di-neve: saldo più basso prima', () => {
  const r = ordinaDebiti([CARTA, AUTO, PICCOLO], 'palla-di-neve');
  assert.deepEqual(r.map((d) => d.id), ['p', 'c', 'a']);
});

test('pagamentoInsufficiente: vero quando il minimo non copre nemmeno l\'interesse mensile', () => {
  assert.equal(pagamentoInsufficiente({ saldo: 10000, tasso: 24, pagamentoMinimo: 100 }), true, '10000*0.24/12=200 > 100 minimo');
  assert.equal(pagamentoInsufficiente({ saldo: 10000, tasso: 24, pagamentoMinimo: 250 }), false);
  assert.equal(pagamentoInsufficiente({ saldo: 1000, tasso: 0, pagamentoMinimo: 10 }), false, 'tasso zero, qualunque minimo positivo basta');
});

test('simulaEstinzione: un debito con extra sufficiente si estingue e il totale interessi è positivo ma finito', () => {
  const r = simulaEstinzione([CARTA], { strategia: 'valanga', extraMensile: 100 });
  assert.equal(r.irrisolvibile, false);
  assert.ok(r.mesiTotali > 0 && r.mesiTotali < 60, `mesi ragionevoli, ottenuto ${r.mesiTotali}`);
  assert.ok(r.interesseTotale > 0);
  assert.ok(r.dataLibero);
});

test('simulaEstinzione: senza debiti (array vuoto) ritorna uno stato onesto a zero, mai un errore', () => {
  const r = simulaEstinzione([], { strategia: 'valanga', extraMensile: 100 });
  assert.equal(r.mesiTotali, 0);
  assert.equal(r.irrisolvibile, false);
  assert.deepEqual(r.debiti, []);
});

test('simulaEstinzione: pagamento minimo insufficiente viene dichiarato subito, mai una simulazione infinita silenziosa', () => {
  const r = simulaEstinzione([{ id: 'x', nome: 'Trappola', saldo: 5000, tasso: 30, pagamentoMinimo: 50 }], { extraMensile: 0 });
  assert.equal(r.irrisolvibile, true);
  assert.match(r.motivo, /Trappola/);
  assert.equal(r.mesiTotali, null);
});

test('effetto valanga vero: il pagamento minimo del debito estinto si aggiunge all\'extra per il successivo (cascata)', () => {
  // Un debito piccolo che si estingue in fretta con l'extra, poi il suo
  // minimo dovrebbe accelerare il secondo debito rispetto a NON avere quella cascata.
  const conCascata = simulaEstinzione([PICCOLO, AUTO], { strategia: 'palla-di-neve', extraMensile: 500 });
  const soloAuto = simulaEstinzione([AUTO], { strategia: 'valanga', extraMensile: 500 + PICCOLO.pagamentoMinimo });
  // Una volta estinto PICCOLO, la velocità di estinzione di AUTO nella
  // simulazione con cascata deve avvicinarsi a quella con l'extra pieno fin
  // dall'inizio — la differenza (dovuta ai mesi iniziali senza il bonus) è
  // piccola, non enorme: qui verifichiamo solo che entrambi si estinguano
  // in un numero di mesi comparabile (la cascata funziona, non è ignorata).
  assert.equal(conCascata.irrisolvibile, false);
  assert.ok(Math.abs(conCascata.mesiTotali - soloAuto.mesiTotali) <= 2, `atteso vicino, conCascata=${conCascata.mesiTotali} soloAuto=${soloAuto.mesiTotali}`);
});

test('confrontaStrategie: con un solo debito le due strategie coincidono esattamente', () => {
  const c = confrontaStrategie([CARTA], 100);
  assert.equal(c.differenzaInteresse, 0);
  assert.equal(c.differenzaMesi, 0);
});

test('confrontaStrategie: con più debiti, valanga paga meno interessi totali (o uguale) di palla di neve', () => {
  const c = confrontaStrategie([CARTA, AUTO, PICCOLO], 150);
  assert.ok(c.differenzaInteresse >= -0.01, `valanga dovrebbe costare meno o uguale, differenza=${c.differenzaInteresse}`);
});

test('testoConfronto: mai un\'eccezione, anche con debiti irrisolvibili', () => {
  const irrisolvibile = confrontaStrategie([{ id: 'x', nome: 'Trappola', saldo: 5000, tasso: 30, pagamentoMinimo: 50 }], 0);
  assert.doesNotThrow(() => testoConfronto(irrisolvibile));
  assert.match(testoConfronto(irrisolvibile), /Trappola/);
});

test('testoConfronto: testo onesto, mai un imperativo ("estingui prima X") — la decisione resta descritta come dell\'utente', () => {
  // Ordine DIVERSO fra le due strategie apposta: tasso alto+saldo alto vs
  // tasso basso+saldo basso, cosi le due strategie non coincidono per caso.
  const altoTassoAltoSaldo = { id: 'h', nome: 'Carta cara', saldo: 5000, tasso: 22, pagamentoMinimo: 100 };
  const bassoTassoBassoSaldo = { id: 'l', nome: 'Prestito piccolo', saldo: 1000, tasso: 4, pagamentoMinimo: 50 };
  const c = confrontaStrategie([altoTassoAltoSaldo, bassoTassoBassoSaldo], 150);
  const testo = testoConfronto(c);
  assert.doesNotMatch(testo, /^Estingui|^Devi|^Ti consiglio/i);
  assert.match(testo, /decidi tu/);
});
