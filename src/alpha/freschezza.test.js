import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fineDi, eta, giudizio, statoDeiDati, leggiCsvFred, aggiorna,
  applicaCoda, freschezzaText, TOLLERANZE, FONTI_AGGIORNABILI,
} from './freschezza.js';

const G = 86400000;

// ── Le date, che sono la parte che si sbaglia in silenzio ──

test('un mese si data alla sua FINE, non al suo inizio', () => {
  // Un pannello che arriva a "2026-07" contiene tutto luglio: datarlo al primo
  // del mese lo farebbe risultare un mese piu' vecchio di quanto e'.
  assert.equal(new Date(fineDi('2026-07')).toISOString().slice(0, 10), '2026-07-31');
  assert.equal(new Date(fineDi('2026-02')).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(new Date(fineDi('2024-02')).toISOString().slice(0, 10), '2024-02-29', 'anno bisestile');
  assert.equal(new Date(fineDi('2026-08-07')).toISOString().slice(0, 10), '2026-08-07');
});

test('una data illeggibile non produce un\'età inventata', () => {
  assert.equal(eta('non-una-data'), null);
  assert.equal(giudizio({ nome: 'x', ultimaData: 'boh' }).valutabile, false);
});

// ── I tre gradi, invece di "affidabile / non affidabile" ──

test('TRE GRADI: un avviso che grida sempre viene ignorato sempre', () => {
  const base = { nome: 'prezzi', ultimaData: '2026-08-07', tipo: 'giornaliero' };
  const adesso = Date.UTC(2026, 7, 10);
  assert.equal(giudizio(base, { adesso }).stato, 'fresco');
  assert.equal(giudizio(base, { adesso: adesso + 20 * G }).stato, 'invecchiato');
  assert.equal(giudizio(base, { adesso: adesso + 60 * G }).stato, 'vecchio');
});

test('ogni tipo di dato ha la sua tolleranza: un archivio storico non invecchia come i prezzi di ieri', () => {
  const adesso = Date.UTC(2026, 11, 31);
  const giorn = giudizio({ nome: 'p', ultimaData: '2026-08', tipo: 'giornaliero' }, { adesso });
  const stor = giudizio({ nome: 's', ultimaData: '2026-08', tipo: 'storico' }, { adesso });
  assert.equal(giorn.stato, 'vecchio');
  assert.equal(stor.stato, 'fresco', 'a un archivio di trent\'anni non cambia niente se manca un trimestre');
  assert.ok(TOLLERANZE.storico.fresco > TOLLERANZE.giornaliero.fresco * 10);
});

test('LA DISTINZIONE CHE CONTA: la storia resta valida anche quando il presente non lo è', () => {
  const g = giudizio({ nome: 'x', ultimaData: '2020-01', tipo: 'mensile' }, { adesso: Date.UTC(2026, 7, 1) });
  assert.equal(g.stato, 'vecchio');
  assert.equal(g.presenteAffidabile, false);
  assert.equal(g.storiaAncoraValida, true,
    'trent\'anni di storia non diventano falsi perche\' manca l\'ultimo mese');
  assert.match(g.avviso, /sul PRESENTE potrebbe non valere/);
});

test('quando è tutto fresco non si dice niente: nessun rumore inutile', () => {
  const g = giudizio({ nome: 'x', ultimaData: '2026-08-07', tipo: 'giornaliero' }, { adesso: Date.UTC(2026, 7, 9) });
  assert.equal(g.avviso, null);
  assert.equal(freschezzaText({ pannelli: [g], tuttoFresco: true }), null);
});

// ── Lo stato reale dei pannelli ──

test('legge le date DAI PANNELLI VERI, non da una lista scritta a mano', async () => {
  const s = await statoDeiDati();
  assert.ok(s.pannelli.length >= 4, `pannelli trovati: ${s.pannelli.length}`);
  for (const p of s.pannelli) {
    assert.equal(p.valutabile, true, `${p.nome} non valutabile`);
    assert.match(p.ultimaData, /^\d{4}-\d{2}/);
  }
  const nomi = s.pannelli.map((p) => p.nome);
  assert.ok(nomi.includes('prezzi giornalieri') && nomi.includes('macro e tassi'));
});

test('oggi i dati risultano freschi: se questo test fallisce, vanno rigenerati', async () => {
  const s = await statoDeiDati();
  const vecchi = s.pannelli.filter((p) => p.stato === 'vecchio');
  assert.equal(vecchi.length, 0,
    `pannelli da rigenerare: ${vecchi.map((v) => `${v.nome} (fermo a ${v.ultimaData})`).join(', ')}`);
});

// ── La lettura del CSV, senza fidarsi ──

test('i buchi dichiarati dalla fonte si saltano, non diventano zeri', () => {
  const csv = 'observation_date,NFCI\n2026-07-01,-0.52\n2026-07-08,.\n2026-07-15,\n2026-07-22,-0.48\n';
  const p = leggiCsvFred(csv);
  assert.equal(p.length, 2, 'due osservazioni valide su quattro righe');
  assert.deepEqual(p.map((x) => x.valore), [-0.52, -0.48]);
});

test('un CSV vuoto o spazzatura non produce dati inventati', () => {
  assert.deepEqual(leggiCsvFred(''), []);
  assert.deepEqual(leggiCsvFred('solo intestazione'), []);
  assert.deepEqual(leggiCsvFred('a,b\nx,non-un-numero'), []);
});

// ── L'aggiornamento: nessuna rete nei test ──

test('AGGIORNAMENTO: scarica solo il nuovo e lo tiene da parte, senza toccare il pannello', async () => {
  const chiamate = [];
  const finto = async (url) => {
    chiamate.push(url);
    return { ok: true, text: async () => 'observation_date,NFCI\n2026-08-01,-0.51\n2026-08-08,-0.49\n' };
  };
  const r = await aggiorna(['nfci'], { daDate: { nfci: '2026-07-31' }, fetchImpl: finto });
  assert.equal(r.riuscito, true);
  assert.equal(r.code.length, 1);
  assert.equal(r.code[0].punti.length, 2);
  assert.equal(r.code[0].ultimo.data, '2026-08-08');
  assert.match(chiamate[0], /cosd=2026-07-31/, 'deve chiedere solo le osservazioni successive');
});

test('SENZA RETE non si rompe niente e lo si dichiara', async () => {
  const rotto = async () => { throw new Error('offline'); };
  const r = await aggiorna(['nfci', 'curva'], { fetchImpl: rotto });
  assert.equal(r.riuscito, false);
  assert.equal(r.code.length, 0);
  assert.equal(r.falliti.length, 2);
  assert.match(r.motivo, /resto sui dati che ho gia/);
});

test('una risposta non valida viene scartata invece che usata', async () => {
  const cattivo = async () => ({ ok: false, status: 503, text: async () => '' });
  const r = await aggiorna(['nfci'], { fetchImpl: cattivo });
  assert.equal(r.riuscito, false);
  assert.match(r.falliti[0].motivo, /503/);
});

test('una fonte sconosciuta non inventa un indirizzo', async () => {
  const r = await aggiorna(['inventata'], { fetchImpl: async () => ({ ok: true, text: async () => '' }) });
  assert.equal(r.falliti[0].motivo, 'fonte sconosciuta');
  assert.ok(Object.keys(FONTI_AGGIORNABILI).length >= 3);
});

// ── La coda: additiva, come ogni cosa in questo progetto ──

test('la coda si APPENDE ai dati incorporati, non li sostituisce', () => {
  const base = [1, 2, 3];
  const coda = { code: [{ chiave: 'nfci', punti: [{ data: '2026-08-01', valore: 4 }, { data: '2026-08-08', valore: 5 }], ultimo: { data: '2026-08-08' } }] };
  const r = applicaCoda(base, coda, { chiave: 'nfci' });
  assert.deepEqual(r.valori, [1, 2, 3, 4, 5]);
  assert.equal(r.aggiunti, 2);
  assert.equal(r.ultimaData, '2026-08-08');
  assert.match(r.fonte, /incorporati \+ aggiornamento/);
  assert.deepEqual(base, [1, 2, 3], 'i dati incorporati non vengono mutati');
});

test('senza coda tutto funziona come prima: additivo per davvero', () => {
  const base = [1, 2, 3];
  for (const c of [null, undefined, {}, { code: [] }, { code: [{ chiave: 'altro', punti: [] }] }]) {
    const r = applicaCoda(base, c, { chiave: 'nfci' });
    assert.deepEqual(r.valori, base);
    assert.equal(r.aggiunti, 0);
    assert.equal(r.fonte, 'incorporati');
  }
});

test('INNESTO: le risposte sul PRESENTE portano l\'avviso, quelle storiche no', async () => {
  // Si simula un pannello vecchio per verificare il comportamento, perche' oggi
  // i dati sono freschi e l'avviso — giustamente — non compare.
  const vecchio = giudizio({ nome: 'macro e tassi', ultimaData: '2020-01', tipo: 'mensile' }, { adesso: Date.UTC(2026, 7, 1) });
  const stato = { pannelli: [vecchio], tuttoFresco: false, daAggiornare: ['macro e tassi'], avviso: vecchio.avviso };
  const t = freschezzaText(stato);
  assert.ok(t, 'con un pannello vecchio deve esserci un avviso');
  assert.match(t, /PRESENTE/);
});

test('l\'avviso distingue sempre passato e presente, mai un allarme generico', () => {
  const vecchio = giudizio({ nome: 'x', ultimaData: '2019-01', tipo: 'mensile' }, { adesso: Date.UTC(2026, 7, 1) });
  assert.match(vecchio.avviso, /sul PRESENTE potrebbe non valere/);
  assert.ok(!/inaffidabil|non fidarti|errato/i.test(vecchio.avviso),
    'un dato vecchio non e\' un dato sbagliato, e dirlo cosi\' sarebbe falso');
});

test('L\'AGGIORNAMENTO USA LA CATENA: se la prima fonte cade, prova la seconda', async () => {
  const { aggiornaConRicaduta } = await import('./freschezza.js');
  let n = 0;
  const finto = async () => {
    n++;
    // La prima chiamata (BCE) fallisce, la seconda (FRED) risponde.
    if (n === 1) return { ok: false, status: 500, text: async () => '' };
    return { ok: true, text: async () => 'a,b\n2026-08-01,3.1\n2026-08-02,3.2\n' };
  };
  const r = await aggiornaConRicaduta(['tassoEuro'], { fetchImpl: finto });
  assert.equal(r.riuscito, true);
  assert.deepEqual(r.conRicaduta, ['tassoEuro']);
  assert.equal(r.code[0].punti.length, 2);
  assert.ok(r.code[0].fonte, 'la coda deve conservare da dove viene il dato');
  assert.ok(r.code[0].licenza, 'e con quale licenza');
});

test('senza rete l\'aggiornamento con ricaduta fallisce in modo pulito', async () => {
  const { aggiornaConRicaduta } = await import('./freschezza.js');
  const r = await aggiornaConRicaduta(['nfci'], { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(r.riuscito, false);
  assert.equal(r.code.length, 0);
  assert.ok(r.falliti[0].tentativi.length >= 1, 'deve registrare cosa ha provato');
});
