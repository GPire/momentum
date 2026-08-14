import test from 'node:test';
import assert from 'node:assert/strict';

const mv = await import('./mercato-vivo.js');

const csv = (righe) => 'DATE,SP500\n' + righe.map(([d, v]) => `${d},${v}`).join('\n');
const fetchFinto = (testo, { ok = true, status = 200 } = {}) => async () => ({ ok, status, text: async () => testo });

test('rendimentiMensiliDaGiornalieri: usa la CHIUSURA del mese (ultima osservazione), non la prima', () => {
  const r = mv.rendimentiMensiliDaGiornalieri([
    { data: '2026-06-01', valore: 100 }, { data: '2026-06-30', valore: 200 },
    { data: '2026-07-31', valore: 220 },
  ], { meseCorrente: '2026-08' });
  assert.equal(r.length, 1);
  assert.equal(r[0].mese, '2026-07');
  assert.equal(r[0].rendimento, 0.1); // 220/200, non 220/100
});

test('rendimentiMensiliDaGiornalieri: SCARTA il mese in corso, mai un mese non chiuso spacciato per chiuso', () => {
  const r = mv.rendimentiMensiliDaGiornalieri([
    { data: '2026-06-30', valore: 100 },
    { data: '2026-07-31', valore: 110 },
    { data: '2026-08-14', valore: 130 }, // mese in corso
  ], { meseCorrente: '2026-08' });
  assert.equal(r.length, 1);
  assert.equal(r[0].mese, '2026-07');
});

test('rendimentiMensiliDaGiornalieri: i buchi dichiarati dalla fonte non diventano zeri', () => {
  const punti = mv.rendimentiMensiliDaGiornalieri([
    { data: '2026-06-30', valore: 100 }, { data: '2026-07-31', valore: NaN }, { data: '2026-07-30', valore: 110 },
  ], { meseCorrente: '2026-08' });
  assert.equal(punti[0].rendimento, 0.1);
});

test('urlCoda: parte da UN MESE PRIMA (serve il prezzo di partenza per la prima variazione)', () => {
  assert.match(mv.urlCoda('2026-08'), /cosd=2026-07-01/);
  assert.match(mv.urlCoda('2026-01'), /cosd=2025-12-01/, 'deve scavallare l anno');
});

test('mercatoVivo: senza coda è ESATTAMENTE la base di prima (nessuna regressione offline)', () => {
  const m = mv.mercatoVivo(null);
  const base = mv.mercatoBase();
  assert.equal(m.valori.length, base.length);
  assert.equal(m.mesiCoda, 0);
  assert.equal(m.a, mv.BASE_A);
  assert.equal(m.approssimazione, null);
  assert.deepEqual(m.valori, base);
});

test('mercatoVivo: con la coda i mesi si aggiungono in fondo e la data di fine avanza', () => {
  const coda = { punti: [{ mese: '2026-08', rendimento: 0.02 }, { mese: '2026-09', rendimento: -0.01 }], approssimazione: 'x' };
  const m = mv.mercatoVivo(coda);
  assert.equal(m.mesiCoda, 2);
  assert.equal(m.valori.length, m.mesiBase + 2);
  assert.equal(m.a, '2026-09');
  assert.equal(m.valori[m.valori.length - 1], -0.01);
  assert.ok(m.fonteCoda);
});

test('mercatoVivo: l APPROSSIMAZIONE è sempre dichiarata quando si usa la coda', () => {
  const coda = { punti: [{ mese: '2026-08', rendimento: 0.02 }], approssimazione: 'indice invece della media dei settori' };
  assert.ok(mv.mercatoVivo(coda).approssimazione);
});

test('statoMercato: senza coda e a distanza di anni si dichiara VECCHIO (il difetto che si voleva evitare)', () => {
  const s = mv.statoMercato(null, { adesso: new Date('2029-08-14').getTime() });
  assert.equal(s.vecchio, true);
  assert.ok(s.mesiIndietro > 30);
  assert.match(s.avviso, /si fermano a/);
});

test('statoMercato: appena dopo la fine del pannello NON è vecchio, e non allarma senza motivo', () => {
  const s = mv.statoMercato(null, { adesso: new Date('2026-08-14').getTime() });
  assert.equal(s.vecchio, false);
  assert.equal(s.avviso, null);
});

test('statoMercato: la coda RIPORTA il pannello nel presente e toglie l avviso', () => {
  const adesso = new Date('2026-11-10').getTime();
  const senza = mv.statoMercato(null, { adesso });
  const con = mv.statoMercato({ punti: [
    { mese: '2026-08', rendimento: 0.01 }, { mese: '2026-09', rendimento: 0.01 }, { mese: '2026-10', rendimento: 0.01 },
  ] }, { adesso });
  assert.equal(senza.vecchio, true, 'senza coda a novembre deve risultare vecchio');
  assert.equal(con.vecchio, false, 'con la coda deve tornare fresco');
  assert.match(con.testo, /aggiornati dal vivo/);
});

test('scaricaCoda: prende solo i mesi successivi a quelli che ho già', async () => {
  const r = await mv.scaricaCoda({
    daMese: '2026-07',
    adesso: new Date('2026-10-05').getTime(),
    fetchImpl: fetchFinto(csv([
      ['2026-06-30', '100'], ['2026-07-31', '110'], ['2026-08-31', '121'], ['2026-09-30', '121'],
    ])),
  });
  assert.equal(r.riuscito, true);
  assert.equal(r.punti.length, 2, 'agosto e settembre, non luglio che ho già');
  assert.equal(r.punti[0].mese, '2026-08');
  assert.equal(r.ultimo, '2026-09');
  assert.ok(r.approssimazione, 'deve dichiarare che la coda usa un indice diverso');
});

test('scaricaCoda: se non c è ancora un mese chiuso nuovo, lo dice invece di inventare', async () => {
  const r = await mv.scaricaCoda({
    daMese: '2026-07', adesso: new Date('2026-08-14').getTime(), fetchImpl: fetchFinto(csv([['2026-08-01', '100']])),
  });
  assert.equal(r.riuscito, false);
  assert.match(r.motivo, /nessun mese chiuso/);
});

test('scaricaCoda: la fonte che non risponde non rompe niente e viene dichiarata', async () => {
  const r = await mv.scaricaCoda({
    daMese: '2026-07', adesso: new Date('2026-10-05').getTime(), fetchImpl: fetchFinto('', { ok: false, status: 503 }),
  });
  assert.equal(r.riuscito, false);
  assert.match(r.motivo, /503/);
  // E il mercato resta utilizzabile: si torna alla base.
  assert.equal(mv.mercatoVivo(r).mesiCoda, 0);
});

test('scaricaCoda: un errore di rete viene catturato, mai propagato come crash', async () => {
  const r = await mv.scaricaCoda({
    daMese: '2026-07', adesso: new Date('2026-10-05').getTime(),
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(r.riuscito, false);
  assert.match(r.motivo, /offline/);
});
