'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODICI_TRIBUTO, righeF24Iva, righeF24Imposte, f24Riepilogo } from './f24.js';

test('CODICI_TRIBUTO: codici verificati presenti e nel formato reale (numerici o alfanumerici a 4 caratteri)', () => {
  assert.equal(CODICI_TRIBUTO.forfettario.primoAcconto, '1790');
  assert.equal(CODICI_TRIBUTO.forfettario.secondoAcconto, '1791');
  assert.equal(CODICI_TRIBUTO.forfettario.saldo, '1792');
  assert.equal(CODICI_TRIBUTO.ordinario.primoAcconto, '4033');
  assert.equal(CODICI_TRIBUTO.ordinario.secondoAcconto, '4034');
  assert.equal(CODICI_TRIBUTO.ordinario.saldo, '4001');
  assert.equal(CODICI_TRIBUTO.ivaMensile(1), '6001');
  assert.equal(CODICI_TRIBUTO.ivaMensile(12), '6012');
  assert.equal(CODICI_TRIBUTO.ivaTrimestrale[1], '6031');
  assert.equal(CODICI_TRIBUTO.ivaTrimestrale[4], '6034');
  assert.equal(CODICI_TRIBUTO.inpsGestioneSeparataSenzaCassa, 'P10');
});

test('righeF24Iva: una riga Erario per periodo con qualcosa da versare, codice mensile corretto', () => {
  const periodi = [
    { mese: 3, periodo: '03/2026', totaleDaVersare: 220, scadenza: '2026-04-16', ivaCreditoNota: 'nota' },
    { mese: 4, periodo: '04/2026', totaleDaVersare: 0, scadenza: '2026-05-16', ivaCreditoNota: 'nota' },
  ];
  const righe = righeF24Iva(periodi, { anno: 2026, periodicita: 'mensile' });
  assert.equal(righe.length, 1);
  assert.equal(righe[0].codiceTributo, '6003');
  assert.equal(righe[0].sezione, 'Erario');
  assert.equal(righe[0].importo, 220);
});

test('righeF24Iva: periodicità trimestrale usa i codici 603X', () => {
  const periodi = [{ trimestre: 2, periodo: 'T2 2026', totaleDaVersare: 500, scadenza: '2026-08-20', ivaCreditoNota: 'nota' }];
  const righe = righeF24Iva(periodi, { anno: 2026, periodicita: 'trimestrale' });
  assert.equal(righe[0].codiceTributo, '6032');
});

test('righeF24Imposte: forfettario — le righe imposta+INPS sommano esattamente all\'importo della scadenza', () => {
  const deadlines = [{ id: 'saldo-primo-acconto-2026', label: 'Saldo + primo acconto', date: '2026-06-30', importo: 5000 }];
  const righe = righeF24Imposte(deadlines, { regime: 'forfettario', annualizedRevenue: 40000 });
  assert.equal(righe.length, 2);
  const imposta = righe.find((r) => r.codiceTributo === '1790');
  const inps = righe.find((r) => r.codiceTributo === 'P10');
  assert.ok(imposta);
  assert.ok(inps);
  assert.equal(imposta.sezione, 'Erario');
  assert.equal(inps.sezione, 'INPS');
  assert.equal(+(imposta.importo + inps.importo).toFixed(2), 5000);
});

test('righeF24Imposte: la scadenza di novembre usa il codice del secondo acconto, senza la nota sul saldo', () => {
  const deadlines = [{ id: 'secondo-acconto-2026', label: 'Secondo acconto', date: '2026-11-30', importo: 2000 }];
  const righe = righeF24Imposte(deadlines, { regime: 'forfettario', annualizedRevenue: 40000 });
  const imposta = righe.find((r) => r.sezione === 'Erario');
  assert.equal(imposta.codiceTributo, '1791');
  assert.equal(imposta.nota, null);
});

test('righeF24Imposte: la scadenza di giugno avvisa onestamente che il saldo dell\'anno precedente non è coperto', () => {
  const deadlines = [{ id: 'saldo-primo-acconto-2026', label: 'Saldo + primo acconto', date: '2026-06-30', importo: 3000 }];
  const righe = righeF24Imposte(deadlines, { regime: 'forfettario', annualizedRevenue: 40000 });
  const imposta = righe.find((r) => r.sezione === 'Erario');
  assert.match(imposta.nota, /saldo dell'anno precedente/);
  assert.match(imposta.nota, /1792/);
});

test('righeF24Imposte: regime ordinario usa i codici IRPEF 4033/4034, non quelli forfettari', () => {
  const deadlines = [{ id: 'saldo-primo-acconto-2026', label: 'Saldo + primo acconto', date: '2026-06-30', importo: 4000 }];
  const righe = righeF24Imposte(deadlines, { regime: 'ordinario', annualizedRevenue: 60000 });
  const imposta = righe.find((r) => r.sezione === 'Erario');
  assert.equal(imposta.codiceTributo, '4033');
});

test('righeF24Imposte: cassa propria -> zero righe INPS (i contributi vanno alla cassa, non a P10)', () => {
  const deadlines = [{ id: 'saldo-primo-acconto-2026', label: 'Saldo + primo acconto', date: '2026-06-30', importo: 3000 }];
  const righe = righeF24Imposte(deadlines, { regime: 'forfettario', annualizedRevenue: 40000, opts: { cassaPropria: 'inarcassa' } });
  assert.ok(righe.every((r) => r.sezione !== 'INPS'));
  const imposta = righe.find((r) => r.sezione === 'Erario');
  assert.equal(+imposta.importo, 3000); // tutto l'importo va all'imposta, niente da frazionare con l'INPS
});

test('righeF24Imposte: nessuna scadenza -> nessuna riga, mai un crash', () => {
  assert.deepEqual(righeF24Imposte([], { regime: 'forfettario', annualizedRevenue: 40000 }), []);
});

test('f24Riepilogo: somma corretta e "pronto" solo se ci sono righe', () => {
  assert.deepEqual(f24Riepilogo([]), { righe: [], totale: 0, pronto: false });
  const r = f24Riepilogo([{ importo: 10 }, { importo: 20.5 }]);
  assert.equal(r.totale, 30.5);
  assert.equal(r.pronto, true);
});
