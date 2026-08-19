'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GIORNALIERO_LUNGO, DATE_LUNGO, META_LUNGO, N_GIORNI_LUNGO,
  GIORNI_LUNGO_DA, GIORNI_LUNGO_A, serieComplete, NOMI_LUNGO_GIORNI,
} from './daily-long.js';
import { drawdownEpisodes, recoveryBaseRates, CADENZE } from './market-cycles.js';

test('QUARANT\'ANNI di dati giornalieri, non cinque', () => {
  // Il motivo per cui questo archivio esiste: con 1253 giorni le osservazioni
  // indipendenti a 63 giorni erano CINQUE, e con cinque prove non si dimostra
  // niente per quanto grande sia l'effetto.
  assert.ok(N_GIORNI_LUNGO > 10000, `solo ${N_GIORNI_LUNGO} giorni`);
  assert.equal(DATE_LUNGO.length, N_GIORNI_LUNGO);
  assert.ok(GIORNI_LUNGO_DA < '1986-01-01', `inizia il ${GIORNI_LUNGO_DA}`);
  assert.ok(GIORNI_LUNGO_A > '2026-01-01');
});

test('le date sono ordinate e senza duplicati', () => {
  for (let i = 1; i < DATE_LUNGO.length; i++) {
    assert.ok(DATE_LUNGO[i] > DATE_LUNGO[i - 1], `data non crescente a ${i}: ${DATE_LUNGO[i - 1]} -> ${DATE_LUNGO[i]}`);
  }
});

test('ogni serie ha la stessa lunghezza del calendario: allineamento per DATA', () => {
  // Allineare per posizione invece che per data confronterebbe giorni diversi,
  // ed è l'errore che non si vede guardando il risultato.
  for (const [k, v] of Object.entries(GIORNALIERO_LUNGO)) {
    assert.equal(v.length, DATE_LUNGO.length, `${k} ha ${v.length} valori su ${DATE_LUNGO.length} date`);
  }
});

test('PRIMA CHE UNO STRUMENTO ESISTA il valore è null, mai zero', () => {
  // Riempire all'indietro sarebbe la peggior forma di sguardo al futuro: un
  // Bitcoin a rendimento zero nel 1985 renderebbe "stabile" una cosa che non
  // c'era.
  const btc = GIORNALIERO_LUNGO.bitcoin;
  assert.equal(btc[0], null, 'Bitcoin non esisteva nel 1985');
  const primoVero = btc.findIndex((x) => x !== null);
  assert.ok(DATE_LUNGO[primoVero] >= '2014-01-01', `Bitcoin inizia il ${DATE_LUNGO[primoVero]}`);
  // E l'oro (futures) non esiste prima del 2000 in questa fonte.
  assert.equal(GIORNALIERO_LUNGO.oro[0], null);
});

test('i rendimenti sono plausibili: nessuno sotto -100%, nessuno assurdo', () => {
  for (const [k, v] of Object.entries(GIORNALIERO_LUNGO)) {
    const validi = v.filter((x) => x !== null);
    assert.ok(validi.length > 100, `${k} ha solo ${validi.length} valori`);
    for (const x of validi) {
      assert.ok(x > -1, `${k}: rendimento ${x} sotto -100%`);
      assert.ok(x < 3, `${k}: rendimento ${x} implausibile`);
    }
  }
});

test('serieComplete esclude chi non copre il periodo richiesto', () => {
  // Mescolare una serie che inizia nel 2014 con una del 1985 su una finestra
  // del 1990 significa lavorare su una serie sola credendo di averne due.
  const dal1985 = serieComplete(0, 0.98);
  assert.ok(!('bitcoin' in dal1985), 'Bitcoin non può coprire il 1985');
  assert.ok(!('oro' in dal1985), 'i futures oro non coprono il 1985');
  assert.ok('azioniUsa' in dal1985);

  const i2000 = DATE_LUNGO.findIndex((d) => d >= '2000-09-01');
  const dal2000 = serieComplete(i2000, 0.98);
  assert.ok('oro' in dal2000, 'dal 2000 l\'oro c\'è');
  assert.ok(Object.keys(dal2000).length > Object.keys(dal1985).length);
});

test('i metadati dichiarano simbolo, inizio reale e salti', () => {
  for (const [k, m] of Object.entries(META_LUNGO)) {
    assert.ok(m.simbolo && m.nome, `${k} senza simbolo o nome`);
    assert.ok(m.da && m.a, `${k} senza intervallo dichiarato`);
    assert.ok(Number.isFinite(m.osservazioni));
    assert.equal(NOMI_LUNGO_GIORNI[k], m.nome);
  }
});

// ── I CALI E I PICCHI, sui 41 anni ──
test('I NOVE CROLLI VERI dal 1985, con date e profondità storicamente corrette', () => {
  // Il controllo che dimostra che l'archivio è reale e allineato: se le date
  // dei crolli noti non cadessero dove devono, tutto il resto sarebbe rumore
  // ben formattato.
  const r = GIORNALIERO_LUNGO.azioniUsa.map((x) => (x === null ? 0 : x));
  const closes = [100];
  for (const x of r) closes.push(closes[closes.length - 1] * (1 + x));
  const ep = drawdownEpisodes(closes, { minDepthPct: 15 });

  const perFondo = Object.fromEntries(ep.map((e) => [DATE_LUNGO[e.troughIdx].slice(0, 7), e]));
  // Lunedì nero 1987
  assert.ok(perFondo['1987-12'], 'manca il crollo del 1987');
  assert.ok(perFondo['1987-12'].depthPct > 30);
  // Bolla tecnologica
  assert.ok(perFondo['2002-10'], 'manca il crollo dot-com');
  assert.ok(perFondo['2002-10'].depthPct > 45);
  // Crisi finanziaria: il più profondo dell'archivio
  assert.ok(perFondo['2009-03'], 'manca la crisi del 2008');
  assert.ok(perFondo['2009-03'].depthPct > 50);
  // Covid
  assert.ok(perFondo['2020-03'], 'manca il covid');
  assert.ok(perFondo['2020-03'].depthPct > 30);
  assert.ok(ep.length >= 8, `solo ${ep.length} episodi`);
});

test('IL BUG DELL\'UNITÀ: "mesi" contava indici, e coi giornalieri diventava assurdo', () => {
  // Con dati giornalieri il vecchio campo dava 1093 "mesi" — 91 anni — per un
  // recupero che è di poco più di quattro. Nessun errore, nessun crash: solo
  // un'unità sbagliata, il modo più silenzioso di mentire con un numero
  // giusto.
  const r = GIORNALIERO_LUNGO.azioniUsa.map((x) => (x === null ? 0 : x));
  const closes = [100];
  for (const x of r) closes.push(closes[closes.length - 1] * (1 + x));

  const g = recoveryBaseRates(closes, { minDepthPct: 15, cadenza: 'giornaliera' });
  assert.equal(g.unita, 'giorni di borsa');
  const profondi = g.rows.find((x) => x.band === '35%+');
  assert.ok(profondi.medianaPeriodi > 500, 'in giorni di borsa deve essere un numero grande');
  // E in ANNI il numero torna a essere leggibile e verificabile.
  assert.ok(profondi.medianaAnni > 3 && profondi.medianaAnni < 6, `mediana ${profondi.medianaAnni} anni`);

  // I nomi storici restano, per non rompere i chiamanti che passano mensili.
  assert.equal(profondi.medianRecoveryMonths, profondi.medianaPeriodi);
  assert.equal(CADENZE.mensile.perAnno, 12);
  assert.equal(CADENZE.giornaliera.perAnno, 252);
});

test('cali più profondi richiedono recuperi più lunghi: l\'asimmetria di Munger', () => {
  const r = GIORNALIERO_LUNGO.azioniUsa.map((x) => (x === null ? 0 : x));
  const closes = [100];
  for (const x of r) closes.push(closes[closes.length - 1] * (1 + x));
  const g = recoveryBaseRates(closes, { minDepthPct: 15, cadenza: 'giornaliera' });
  const perFascia = Object.fromEntries(g.rows.map((x) => [x.band, x.medianaAnni]));
  assert.ok(perFascia['35%+'] > perFascia['20-35%'], 'i cali profondi devono recuperare più lentamente');
  assert.ok(perFascia['20-35%'] > perFascia['10-20%']);
});
