import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizza, estraiPeriodo, intentoMercato, rifiutoMotivato,
  chiediAlMercato, chiediAlMercatoSync, precarica, pronto,
  DOMANDE_SENZA_RISPOSTA,
} from './mercato-qa.js';

// I moduli pesanti si caricano una volta per tutto il file.
test('il precaricamento rende disponibili le risposte sincrone', async () => {
  assert.equal(pronto(), false, 'prima del precaricamento non deve essere pronto');
  await precarica();
  assert.equal(pronto(), true);
});

// ── Estrazione del periodo ──

test('riconosce le tre forme in cui una persona scrive una data', () => {
  assert.equal(estraiPeriodo('cosa è successo ad aprile 2025?').etichetta, 'aprile 2025');
  assert.equal(estraiPeriodo('com\'è andato il 2022?').etichetta, 'il 2022');
  assert.equal(estraiPeriodo('e nel 2025-04?').etichetta, '2025-04');
  assert.equal(estraiPeriodo('cosa protegge?'), null);
});

test('gli accenti non cambiano il significato di una domanda', () => {
  assert.equal(normalizza('Il mercato salirà?'), 'il mercato salira?');
  assert.equal(normalizza("cos'è successo"), 'cos e successo');
});

// ── I RIFIUTI, che sono la parte più importante ──

test('NON SI RISPONDE MAI a cosa comprare o dove va il mercato', () => {
  for (const d of ['cosa devo comprare?', 'su cosa investo?', 'è il momento di comprare?',
    'il mercato salirà?', 'dove va il mercato?', 'quanto scenderà la borsa?', 'cosa farà la Fed?']) {
    const r = chiediAlMercatoSync(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, 'mercato-non-si-puo', `"${d}" ha ricevuto ${r.intent}`);
  }
});

test('ogni rifiuto spiega il PERCHÉ e dice cosa si può chiedere invece', () => {
  for (const d of DOMANDE_SENZA_RISPOSTA) {
    assert.ok(d.risposta.length > 100, 'un rifiuto di una riga è una scusa, non una risposta');
    assert.ok(/perch|ragione|nessuno sa|non la so/i.test(d.risposta), `manca il perché: ${d.risposta}`);
  }
  const compra = rifiutoMotivato('cosa devo comprare?');
  assert.match(compra.answer, /nessuno sa cosa farà il mercato/);
  assert.match(compra.answer, /cosa è successo/);
});

test('il rifiuto ha la precedenza sulla risposta: non si aggira riformulando', () => {
  // "conviene comprare oro?" contiene 'oro' e 'convien', che farebbero scattare
  // l'intento sull'oro. Ma chiede cosa comprare, e quello viene prima.
  const r = chiediAlMercatoSync('conviene comprare oro adesso?');
  assert.equal(r.intent, 'mercato-non-si-puo');
});

// ── Le risposte che invece esistono ──

test('COSA È SUCCESSO in un periodo: fatto verificabile', async () => {
  const r = await chiediAlMercato('cosa è successo ad aprile 2025?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /2025-04/);
  assert.match(r.answer, /nel mezzo sono arrivate a perdere/);
});

test('un periodo fuori archivio riceve un no chiaro, non numeri inventati', async () => {
  const r = await chiediAlMercato('cosa è successo nel 1998?');
  assert.equal(r.intent, 'mercato-evento');
  assert.match(r.answer, /archivio dettagliato parte dal 2021/);
});

test('LE CRIPTO: risposta netta e con i numeri', async () => {
  const r = await chiediAlMercato('le cripto proteggono quando crolla la borsa?');
  assert.equal(r.intent, 'mercato-cripto');
  assert.match(r.answer, /^No\./);
  assert.match(r.answer, /amplificano/);
});

test('L\'ORO: si smonta il luogo comune con la misura, non con un\'opinione', async () => {
  const r = await chiediAlMercato('l\'oro protegge davvero?');
  assert.equal(r.intent, 'mercato-oro');
  assert.match(r.answer, /monetina/);
  assert.match(r.answer, /volte su 100/);
});

test('le altre domande con risposta arrivano tutte a destinazione', async () => {
  const attesi = {
    'cosa protegge quando crolla il mercato?': 'mercato-rifugi',
    'quali settori tengono nei crolli?': 'mercato-settori',
    'conviene diversificare nel mondo?': 'mercato-diversificazione',
    'sta arrivando una recessione?': 'mercato-recessione',
    'come sta il mercato adesso?': 'mercato-regime',
  };
  for (const [d, intent] of Object.entries(attesi)) {
    const r = await chiediAlMercato(d);
    assert.ok(r, `nessuna risposta per "${d}"`);
    assert.equal(r.intent, intent, `"${d}" -> ${r.intent}`);
    assert.ok(r.answer.length > 40, `risposta troppo corta per "${d}"`);
  }
});

// ── Cosa NON deve intercettare ──

test('le domande sui soldi PROPRI non finiscono in un\'analisi di borsa', () => {
  for (const d of ['quanto ho speso questo mese?', 'quando mi pagano?', 'quanto posso spendere oggi?',
    'quanto ho speso in bar?', 'a quanto ammonta il mio patrimonio?']) {
    assert.equal(intentoMercato(d), null, `"${d}" è stato scambiato per una domanda di mercato`);
    assert.equal(chiediAlMercatoSync(d), null);
  }
});

test('una domanda che non c\'entra niente non riceve una risposta di mercato', () => {
  assert.equal(chiediAlMercatoSync('quanto costa un caffè'), null);
  assert.equal(chiediAlMercatoSync(''), null);
  assert.equal(chiediAlMercatoSync(null), null);
});

// ── La regola di fondo ──

test('NESSUNA risposta suggerisce mai di comprare o vendere', async () => {
  const domande = [
    'cosa protegge quando crolla il mercato?', 'l\'oro protegge?',
    'le cripto proteggono?', 'quali settori tengono nei crolli?',
    'conviene diversificare nel mondo?', 'sta arrivando una recessione?',
    'come sta il mercato adesso?', 'cosa è successo ad aprile 2025?',
  ];
  for (const d of domande) {
    const r = await chiediAlMercato(d);
    assert.ok(!/dovresti comprare|ti conviene comprare|conviene vendere|compra ora|vendi ora/i.test(r.answer),
      `indicazione operativa in "${d}": ${r.answer}`);
  }
});

// ── L'innesto nel QA vero ──

test('INNESTO: il QA delle finanze personali consulta i mercati solo alla fine', async () => {
  globalThis.window = globalThis.window || {};
  globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.document = globalThis.document || { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
  const { answerQuestion } = await import('../ai/qa-engine.js');

  const ctx = { allTx: {}, referenceDate: new Date(), mercato: chiediAlMercatoSync };
  // Domanda di mercato: senza il ponte sarebbe 'unknown'.
  const mercato = answerQuestion('cosa protegge quando crolla il mercato?', ctx);
  assert.equal(mercato.intent, 'mercato-rifugi');
  // Senza il ponte, la stessa domanda resta senza risposta: la prova che
  // l'innesto sta davvero facendo qualcosa.
  const senza = answerQuestion('cosa protegge quando crolla il mercato?', { allTx: {}, referenceDate: new Date() });
  assert.equal(senza.intent, 'unknown');
});
