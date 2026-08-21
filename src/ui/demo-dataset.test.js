'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDemoTransactions, demoKeepCount, fadeDemo, mergeDemoForDisplay, demoStatus, DEMO_FADE_AT,
} from './demo-dataset.js';
// constants.js legge `window`/`navigator` a livello di modulo (isTouch): un
// `import` statico verrebbe issato PRIMA di questo stub (le import sono
// hoisted in ESM, l'ordine nel file non conta). Import dinamico dopo lo
// stub, stesso pattern di import/categorize.test.js.
globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };
const { ALL_CATS } = await import('../core/constants.js');

const NOW = new Date('2026-08-06T12:00:00Z');

test('generateDemoTransactions: deterministico — stesso seed, stesso identico dataset', () => {
  const a = generateDemoTransactions({ now: NOW });
  const b = generateDemoTransactions({ now: NOW });
  assert.deepEqual(a, b, 'i numeri non devono ballare ad ogni ricarica');
});

test('SICUREZZA: OGNI voce demo è marcata demo:true — nessuna può passare per vera', () => {
  const tx = generateDemoTransactions({ now: NOW });
  assert.ok(tx.length > 0);
  assert.ok(tx.every((t) => t.demo === true), 'una sola voce non marcata sarebbe un dato finto scambiato per reale');
});

test('generateDemoTransactions: vita riconoscibile — stipendio, affitto, spesa, caffè', () => {
  const tx = generateDemoTransactions({ now: NOW });
  const desc = tx.map((t) => t.description);
  assert.ok(desc.includes('Stipendio'));
  assert.ok(desc.includes('Affitto'));
  assert.ok(desc.includes('Esselunga'));
  assert.ok(desc.includes('Bar'));
  assert.ok(tx.some((t) => t.type === 'entrata'), 'senza entrate non sembrerebbe una vita vera');
});

test('generateDemoTransactions: ordinato nel tempo e dentro la finestra richiesta', () => {
  const tx = generateDemoTransactions({ now: NOW, weeks: 6 });
  for (let i = 1; i < tx.length; i++) {
    assert.ok(tx[i].date >= tx[i - 1].date, 'le date devono essere crescenti');
  }
  // Alcune voci ora portano anche l'ora (il caffè della mattina, la spesa del
  // sabato...), quindi il campo può essere un timestamp ISO completo e non
  // solo "YYYY-MM-DD" — il confronto sul CONFINE della finestra deve guardare
  // solo il giorno di calendario, non la stringa intera: altrimenti una spesa
  // delle 19:30 dell'ultimo giorno risulterebbe "oltre" un limite scritto
  // come sola data, pur essendo nello stesso identico giorno.
  const soloData = (s) => String(s).slice(0, 10);
  assert.ok(soloData(tx[0].date) >= '2026-06-25', 'non deve andare più indietro di ~6 settimane');
  assert.ok(soloData(tx[tx.length - 1].date) <= '2026-08-06');
});

test('generateDemoTransactions: nessun importo negativo o assurdo', () => {
  const tx = generateDemoTransactions({ now: NOW });
  assert.ok(tx.every((t) => t.amount > 0 && t.amount < 5000));
});

// ── LA DISSOLVENZA: il cuore del comportamento ──
test('demoKeepCount: a zero transazioni vere il demo è intero', () => {
  assert.equal(demoKeepCount(0, 40), 40);
});

test('demoKeepCount: raggiunta la soglia il demo è sparito del tutto', () => {
  assert.equal(demoKeepCount(DEMO_FADE_AT, 40), 0);
  assert.equal(demoKeepCount(DEMO_FADE_AT + 50, 40), 0);
});

test('demoKeepCount: scala DOLCEMENTE, mai un salto — nessun momento di schermo vuoto', () => {
  const tot = 40;
  let precedente = demoKeepCount(0, tot);
  for (let reali = 1; reali <= DEMO_FADE_AT; reali++) {
    const ora = demoKeepCount(reali, tot);
    assert.ok(ora <= precedente, 'non deve mai risalire');
    assert.ok(precedente - ora <= Math.ceil(tot / DEMO_FADE_AT) + 1, `salto troppo brusco a ${reali} reali`);
    precedente = ora;
  }
  assert.equal(precedente, 0);
});

test('fadeDemo: spegne le più VECCHIE, tiene il periodo vicino a oggi', () => {
  const demo = [
    { date: '2026-07-01', demo: true }, { date: '2026-07-15', demo: true },
    { date: '2026-08-01', demo: true }, { date: '2026-08-05', demo: true },
  ];
  const vive = fadeDemo(demo, 6, 12); // metà soglia -> ne restano ~2
  assert.equal(vive.length, 2);
  assert.equal(vive[0].date, '2026-08-01', 'devono restare le più recenti');
  assert.equal(vive[1].date, '2026-08-05');
});

// ── SICUREZZA: nessuna mutazione dei dati veri ──
test('SICUREZZA: mergeDemoForDisplay NON muta la mappa reale (una mutazione persisterebbe dati finti)', () => {
  const reale = { '2026-08': [{ date: '2026-08-02', amount: 10, type: 'uscita' }] };
  const copiaPrima = JSON.parse(JSON.stringify(reale));
  const demo = generateDemoTransactions({ now: NOW });
  mergeDemoForDisplay(reale, demo, 1);
  assert.deepEqual(reale, copiaPrima, 'l\'originale deve restare intatto: verrebbe salvato nel vault');
});

test('mergeDemoForDisplay: le voci finte compaiono nel mese giusto, insieme alle vere', () => {
  const reale = { '2026-08': [{ date: '2026-08-02', amount: 10, type: 'uscita' }] };
  const demo = [{ date: '2026-08-03', amount: 5, type: 'uscita', demo: true }];
  const fuso = mergeDemoForDisplay(reale, demo, 0);
  assert.equal(fuso['2026-08'].length, 2);
  assert.ok(fuso['2026-08'].some((t) => t.demo === true));
});

test('mergeDemoForDisplay: superata la soglia restituisce ESATTAMENTE la mappa reale', () => {
  const reale = { '2026-08': [{ date: '2026-08-02', amount: 10 }] };
  const demo = generateDemoTransactions({ now: NOW });
  const fuso = mergeDemoForDisplay(reale, demo, DEMO_FADE_AT);
  assert.equal(fuso, reale, 'niente demo: deve tornare lo stesso oggetto, zero lavoro inutile');
});

test('mergeDemoForDisplay: conta da sola le transazioni reali se non le passi', () => {
  const reale = { '2026-08': new Array(DEMO_FADE_AT).fill({ date: '2026-08-02', amount: 1 }) };
  const fuso = mergeDemoForDisplay(reale, generateDemoTransactions({ now: NOW }));
  assert.equal(fuso, reale, 'con 12 transazioni vere il demo è già sparito');
});

test('mergeDemoForDisplay: le righe di ogni mese restano ordinate per data', () => {
  const reale = { '2026-08': [{ date: '2026-08-20', amount: 1 }] };
  const demo = [{ date: '2026-08-02', amount: 5, demo: true }];
  const fuso = mergeDemoForDisplay(reale, demo, 0);
  assert.equal(fuso['2026-08'][0].date, '2026-08-02');
});

// ── ONESTÀ: l'utente deve sempre sapere che sta guardando un esempio ──
test('demoStatus: mentre è attivo dichiara che NON sono soldi veri e quanto manca', () => {
  const s = demoStatus(new Array(40).fill({ demo: true }), 3);
  assert.equal(s.attivo, true);
  assert.match(s.messaggio, /non i tuoi soldi/);
  assert.equal(s.realiMancanti, DEMO_FADE_AT - 3);
});

test('demoStatus: a demo concluso nessun messaggio residuo', () => {
  const s = demoStatus(new Array(40).fill({ demo: true }), DEMO_FADE_AT);
  assert.equal(s.attivo, false);
  assert.equal(s.messaggio, null);
  assert.equal(s.realiMancanti, 0);
});

test('demoStatus: input vuoti -> nessun crash, nessun messaggio inventato', () => {
  const s = demoStatus([], 0);
  assert.equal(s.attivo, false);
  assert.equal(s.messaggio, null);
});

test('le categorie del demo sono ID VERI, non etichette inventate', async () => {
  // Bug trovato guardando la lista dei movimenti nel browser: ogni riga del
  // demo mostrava "Altro" con la stessa icona grigia, perché qui c'erano nomi
  // ('Casa', 'Svago') e l'app cerca gli id di constants.js. Il demo esiste per
  // far vedere l'app viva e la faceva vedere spenta.
  //
  // L'insieme valido viene da ALL_CATS, non da un elenco scritto qui a mano:
  // un elenco duplicato si disallinea silenziosamente ad ogni categoria nuova
  // (e' successo davvero: questo stesso test aveva ancora le 9 categorie
  // vecchie quando 'casa'/'bollette'/'salute'/'istruzione'/'viaggi'/'svago'
  // erano gia' state aggiunte a constants.js).
  const VALIDI = new Set(ALL_CATS.map((c) => c.id));
  const tx = generateDemoTransactions({ now: new Date(2026, 7, 10) });
  assert.ok(tx.length > 50);
  for (const t of tx) {
    assert.ok(VALIDI.has(t.category), `categoria inesistente: "${t.category}" su "${t.description}"`);
  }
  // E il contrario: le nuove categorie devono comparire davvero nel demo,
  // non solo esistere come id validi in astratto — altrimenti il fix
  // sarebbe invisibile a chi guarda l'app.
  const usate = new Set(tx.map((t) => t.category));
  for (const id of ['casa', 'bollette', 'salute', 'svago']) {
    assert.ok(usate.has(id), `il demo non usa mai la categoria "${id}"`);
  }
  // E devono essercene DIVERSE: se fossero tutte uguali la lista sarebbe
  // ugualmente indistinta, solo con un'altra icona.
  const distinte = new Set(tx.map((t) => t.category));
  assert.ok(distinte.size >= 4, `solo ${distinte.size} categorie diverse`);
});

test('generateDemoTransactions: le abitudini portano un ORARIO vero, non solo una data', () => {
  // Bug che avrebbe reso muto il motore delle abitudini per fascia oraria
  // (src/predict/context-predictor.js): prima ogni transazione demo aveva
  // solo "YYYY-MM-DD", che equivale a mezzanotte UTC per costruzione — tutte
  // nella stessa fascia oraria, nessun pattern rilevabile nemmeno nella demo
  // pensata apposta per mostrare l'app viva.
  const tx = generateDemoTransactions({ now: NOW, weeks: 14 });
  const caffe = tx.filter((t) => t.description === 'Bar');
  assert.ok(caffe.length >= 10, `pochi caffè per verificare un pattern: ${caffe.length}`);
  const ore = caffe.map((t) => new Date(t.date).getHours());
  // Il caffè del mattino deve cadere davvero al mattino, non a mezzanotte.
  for (const h of ore) assert.ok(h >= 6 && h <= 10, `ora fuori dalla fascia mattutina: ${h}`);
  // E non sono tutte identiche: una vita vera ha variazione dentro la fascia,
  // non lo stesso minuto ripetuto — altrimenti sarebbe un pattern troppo
  // perfetto per essere credibile.
  assert.ok(new Set(ore).size > 1, 'tutti i caffè alla stessa identica ora: non sembra vita vera');

  const spesa = tx.filter((t) => t.description === 'Esselunga');
  const oreSpesa = spesa.map((t) => new Date(t.date).getHours());
  for (const h of oreSpesa) assert.ok(h >= 9 && h <= 13, `spesa del sabato fuori orario: ${h}`);
  // E il giorno resta quello giusto: aggiungere l'ora non deve spostare la
  // spesa fuori dal sabato per cui esiste questa regola.
  for (const t of spesa) assert.equal(new Date(t.date).getDay(), 6, `spesa non di sabato: ${t.date}`);
});
