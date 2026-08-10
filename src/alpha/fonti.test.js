import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGISTRO, LICENZE, prendi, rischioFonti, fontiText,
  leggiCsvSemplice, leggiCsvBce, leggiJsonFrankfurter, leggiJsonYahoo,
} from './fonti.js';

// ── I lettori, uno per formato, senza fidarsi ──

test('il CSV di FRED: i buchi dichiarati con "." si saltano, non diventano zeri', () => {
  const p = leggiCsvSemplice('observation_date,DGS10\n2026-08-01,4.5\n2026-08-02,.\n2026-08-03,4.6\n');
  assert.deepEqual(p, [{ data: '2026-08-01', valore: 4.5 }, { data: '2026-08-03', valore: 4.6 }]);
});

test('il CSV della BCE si legge per NOME di colonna, non per posizione', () => {
  // Se la BCE aggiunge una colonna in mezzo, leggere per indice si romperebbe
  // in silenzio restituendo numeri sbagliati invece di nessun numero.
  const csv = 'KEY,FREQ,TIME_PERIOD,OBS_VALUE,OBS_STATUS\nYC.X,B,2026-08-03,3.1854,A\nYC.X,B,2026-08-04,3.1462,A\n';
  const p = leggiCsvBce(csv);
  assert.equal(p.length, 2);
  assert.equal(p[0].data, '2026-08-03');
  assert.ok(Math.abs(p[0].valore - 3.1854) < 1e-6);
  // Colonne in ordine diverso: deve funzionare lo stesso.
  const altro = 'OBS_VALUE,TIME_PERIOD\n2.5,2026-01-01\n';
  assert.deepEqual(leggiCsvBce(altro), [{ data: '2026-01-01', valore: 2.5 }]);
  // Intestazione senza le colonne attese: nessun dato inventato.
  assert.deepEqual(leggiCsvBce('A,B\n1,2\n'), []);
});

test('i JSON di Frankfurter e Yahoo, e la spazzatura che non deve passare', () => {
  const fr = leggiJsonFrankfurter('{"rates":{"2024-01-02":{"USD":1.09},"2024-01-01":{"USD":1.10}}}');
  assert.equal(fr.length, 2);
  assert.equal(fr[0].data, '2024-01-01', 'devono uscire ordinati per data');
  const ya = leggiJsonYahoo(JSON.stringify({ chart: { result: [{ timestamp: [1700000000], indicators: { quote: [{ close: [450.5] }] } }] } }));
  assert.equal(ya.length, 1);
  assert.equal(ya[0].valore, 450.5);
  for (const lettore of [leggiJsonFrankfurter, leggiJsonYahoo]) {
    assert.deepEqual(lettore('non json'), []);
    assert.deepEqual(lettore(''), []);
    assert.deepEqual(lettore('{}'), []);
  }
});

// ── LA RICADUTA: è la ragione d'essere del modulo ──

test('LA RICADUTA FUNZIONA: se la prima fonte cade, si passa alla seconda e lo si dichiara', async () => {
  const chiamate = [];
  const finto = async (url) => {
    chiamate.push(url);
    if (chiamate.length === 1) return { ok: false, status: 503, text: async () => '' };
    return { ok: true, text: async () => 'KEY,TIME_PERIOD,OBS_VALUE\nX,2026-08-01,3.2\n' };
  };
  const r = await prendi('tassoDecennaleAreaEuro', { fetchImpl: finto });
  assert.equal(r.riuscito, true);
  assert.equal(r.ricaduta, true, 'deve dichiarare di aver usato la ricaduta');
  assert.equal(r.tentativi.length, 2);
  assert.equal(r.tentativi[0].esito, 'risposta 503');
  assert.match(fontiText(r), /ho usato la seconda/);
});

test('quando la prima fonte risponde, la seconda non viene nemmeno chiamata', async () => {
  let chiamate = 0;
  const finto = async () => { chiamate++; return { ok: true, text: async () => 'a,b\n2026-01-01,4.2\n' }; };
  const r = await prendi('tassoDecennaleUsa', { fetchImpl: finto });
  assert.equal(r.riuscito, true);
  assert.equal(r.ricaduta, false);
  assert.equal(chiamate, 1, 'nessuna chiamata inutile');
});

test('se cade TUTTA la catena si dichiara, senza inventare un valore', async () => {
  const rotto = async () => { throw new Error('offline'); };
  const r = await prendi('tassoDecennaleAreaEuro', { fetchImpl: rotto });
  assert.equal(r.riuscito, false);
  assert.match(r.motivo, /nessuna fonte della catena/);
  assert.equal(r.tentativi.length, 2, 'deve aver provato entrambe prima di arrendersi');
});

test('una risposta che arriva ma è vuota non conta come successo', async () => {
  let n = 0;
  const finto = async () => { n++; return { ok: true, text: async () => (n === 1 ? 'solo,intestazione\n' : 'a,b\n2026-01-01,3.0\n') }; };
  const r = await prendi('condizioniFinanziarie', { fetchImpl: finto });
  assert.equal(r.riuscito, true);
  assert.equal(r.tentativi[0].esito, 'nessuna osservazione utile');
  assert.equal(r.ricaduta, true);
});

test('una grandezza sconosciuta non inventa un indirizzo', async () => {
  const r = await prendi('inventata', { fetchImpl: async () => ({ ok: true, text: async () => '' }) });
  assert.equal(r.riuscito, false);
  assert.match(r.motivo, /grandezza sconosciuta/);
});

// ── LA PROVENIENZA viaggia col dato ──

test('ogni dato porta la sua fonte e la sua licenza: un numero senza provenienza è una voce', async () => {
  const finto = async () => ({ ok: true, text: async () => 'a,b\n2026-01-01,4.2\n' });
  const r = await prendi('tassoDecennaleUsa', { fetchImpl: finto });
  assert.ok(r.fonte, 'manca la fonte');
  assert.ok(r.licenza?.nome, 'manca la licenza');
  assert.equal(typeof r.licenza.commerciale, 'boolean');
  assert.match(fontiText(r), /da FRED/);
});

// ── IL RISCHIO-FONTE: è quello che guarda chi investe ──

test('LE FONTI CON LICENZA PULITA VENGONO PRIMA di quelle comode', () => {
  // L'area euro: la BCE (licenza esplicita per l'uso commerciale) precede FRED.
  assert.equal(REGISTRO.tassoDecennaleAreaEuro.catena[0].fonte, 'bce');
  // I cambi: Frankfurter, che ridistribuisce dati BCE gia' liberi.
  assert.equal(REGISTRO.cambioEuroDollaro.catena[0].fonte, 'frankfurter');
  for (const f of ['bce', 'fred', 'eurostat', 'cftc', 'frankfurter']) {
    assert.equal(LICENZE[f].pulita, true, `${f} doveva essere fra le licenze pulite`);
  }
});

test('LE DUE FONTI A RISCHIO sono dichiarate, non nascoste', () => {
  assert.equal(LICENZE.yahoo.commerciale, false);
  assert.match(LICENZE.yahoo.nota, /nessuna API ufficiale dal 2017/);
  assert.equal(LICENZE.worldbank.commerciale, null, 'area grigia: ne\' si\' ne\' no');
  assert.match(LICENZE.worldbank.nota, /AREA GRIGIA/);
});

test('LA DIAGNOSI dice quali grandezze reggerebbero la morte della loro fonte', () => {
  const r = rischioFonti();
  assert.ok(r.grandezze.length >= 5);
  assert.ok(r.coperturaConRicaduta > 0.5 && r.coperturaConRicaduta < 1,
    `copertura ${r.coperturaConRicaduta}: se fosse 1 il modulo mentirebbe, se fosse 0 sarebbe inutile`);
  // I prezzi azionari sono l'anello debole, e va detto invece che nascosto.
  assert.ok(r.puntiUnici.some((x) => /azioni/i.test(x)), `punti unici: ${JSON.stringify(r.puntiUnici)}`);
  assert.match(r.verdetto, /dipendono da una fonte sola/);
});

test('la diagnosi elenca anche le fonti da chiarire legalmente', () => {
  const r = rischioFonti();
  assert.ok(r.daChiarireLegalmente.includes('yahoo'),
    'il rischio contrattuale su Yahoo deve comparire nella diagnosi');
  const azioni = r.grandezze.find((g) => g.chiave === 'azioniUsa');
  assert.ok(azioni.avviso, 'la grandezza senza ricaduta deve portare il suo avviso');
  assert.match(azioni.avviso, /se Yahoo chiude/);
});
