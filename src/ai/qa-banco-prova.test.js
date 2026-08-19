'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valuta, confrontaRiconoscitori, BANCO_MERCATO, BANCO_PERSONALE } from './qa-banco-prova.js';
import { similaritaLessicale, tokenizza } from './similarita-lessicale.js';
import { intentoMercato, rifiutoMotivato, caricaBancoSemantico } from '../alpha/mercato-qa.js';

// Il riconoscitore reale, nelle due configurazioni che il progetto ha davvero.
const soloParole = (d) => {
  const rif = rifiutoMotivato(d);
  if (rif) return { intent: null, rifiuta: true };
  return intentoMercato(d);
};
const conSenso = (d) => {
  const rif = rifiutoMotivato(d, similaritaLessicale);
  if (rif) return { intent: null, rifiuta: true };
  return intentoMercato(d, similaritaLessicale);
};

test('il banco contiene domande DA RIFIUTARE e domande fuori dominio', () => {
  // Un banco di sole domande a cui si sa rispondere misura l'ottimismo di chi
  // l'ha scritto, non il sistema.
  assert.ok(BANCO_MERCATO.filter((c) => c.rifiuta).length >= 5);
  assert.ok(BANCO_MERCATO.filter((c) => c.atteso === null).length >= 2);
  assert.ok(BANCO_MERCATO.length >= 35);
});

test('NON CAPIRE e CAPIRE MALE sono contati separatamente', () => {
  // La distinzione che quasi nessun benchmark fa: una risposta sbagliata data
  // con sicurezza e' molto peggio di un "non ho capito".
  const banco = [{ d: 'x', atteso: 'alfa' }, { d: 'y', atteso: 'beta' }];
  const nonCapisce = valuta(banco, () => null);
  const capisceMale = valuta(banco, () => 'gamma');
  assert.equal(nonCapisce.nonCapite, 2);
  assert.equal(nonCapisce.sbagliate, 0);
  assert.equal(capisceMale.sbagliate, 2);
  assert.equal(capisceMale.nonCapite, 0);
  // Entrambi hanno copertura zero, ma non sono lo stesso sistema.
  assert.equal(nonCapisce.copertura, 0);
  assert.equal(capisceMale.copertura, 0);
  assert.equal(nonCapisce.tassoSbagliate, 0);
  assert.equal(capisceMale.tassoSbagliate, 100);
});

test('un rifiuto mancato e un guasto, un rifiuto di troppo e solo un fastidio', () => {
  const banco = [{ d: 'compro?', rifiuta: true }, { d: 'come va?', atteso: 'regime' }];
  const rispondeSempre = valuta(banco, () => 'regime');
  assert.equal(rispondeSempre.rifiutiMancati, 1);
  const rifiutaSempre = valuta(banco, () => ({ intent: null, rifiuta: true }));
  assert.equal(rifiutaSempre.rifiutiMancati, 0);
  assert.equal(rifiutaSempre.rifiutiDiTroppo, 1);
  assert.equal(rifiutaSempre.sicurezza, 100);
});

test('LA SICUREZZA HA DIRITTO DI VETO nel confronto fra due riconoscitori', () => {
  // Un aumento di copertura pagato con un rifiuto mancato NON e' un
  // miglioramento, e il codice deve dirlo invece di celebrare la copertura.
  const banco = [
    { d: 'compro?', rifiuta: true },
    { d: 'a', atteso: 'uno' }, { d: 'b', atteso: 'due' },
  ];
  const prudente = (d) => (d === 'compro?' ? { intent: null, rifiuta: true } : d === 'a' ? 'uno' : null);
  const spavaldo = (d) => (d === 'compro?' ? 'uno' : d === 'a' ? 'uno' : 'due');
  const c = confrontaRiconoscitori(banco, prudente, spavaldo);
  assert.ok(c.deltaCopertura > 0, 'lo spavaldo copre di piu');
  assert.equal(c.miglioramento, false, 'ma non e un miglioramento');
  assert.match(c.motivo, /rifiuti in piu/);
});

// ── LA MISURA SUL SISTEMA VERO ──
test('BASE (sole parole chiave): zero errori gravi e nessun rifiuto mancato', () => {
  // Questo test asseriva che qualche rifiuto DOVESSE sfuggire alle sole parole
  // chiave — era vero, ed e' stato corretto: provando l'app dal vivo si e'
  // scoperto che "dove investire" e altre formulazioni comunissime non erano
  // in elenco, e l'elenco e' stato allargato. Ora le parole chiave da sole
  // coprono tutti i rifiuti del banco.
  const r = valuta(BANCO_MERCATO, soloParole);
  // Zero domande capite MALE resta il risultato piu' importante: il sistema
  // non risponde con sicurezza alla domanda sbagliata.
  assert.equal(r.sbagliate, 0, `errori gravi: ${JSON.stringify(r.dettaglio.filter((x) => x.verdetto === 'sbagliata'))}`);
  assert.ok(r.copertura >= 70, `copertura ${r.copertura}%`);
  assert.equal(r.rifiutiMancati, 0, 'dopo l\'allargamento nessun rifiuto deve sfuggire');
  assert.equal(r.sicurezza, 100);
});

test('LA MISURA CHE HA DECISO IL DISEGNO: la somiglianza lessicale chiude il buco di sicurezza', async () => {
  // Nessun modello, nessun download: solo sovrapposizione di parole. Eppure
  // recupera i rifiuti mancati, ed e' la ragione per cui questa rete va
  // attivata su OGNI dispositivo, non solo su quelli che regggono 113MB.
  await caricaBancoSemantico();
  const c = confrontaRiconoscitori(BANCO_MERCATO, soloParole, conSenso, { nomeA: 'parole', nomeB: 'lessicale' });
  assert.equal(c.lessicale.rifiutiMancati, 0, 'tutti i rifiuti devono essere coperti');
  assert.equal(c.lessicale.sicurezza, 100);
  // La sicurezza non deve MAI peggiorare aggiungendo la somiglianza: e' la
  // garanzia che rende l'aggiunta non regressiva. (Non piu' "migliorare":
  // dopo l'allargamento delle parole chiave partono gia' da 100.)
  assert.ok(c.peggioramentiSicurezza <= 0, 'la sicurezza non deve peggiorare');
  assert.ok(c.deltaCopertura >= 0, 'e la copertura non deve peggiorare');
  assert.equal(c.deltaSbagliate, 0, 'senza introdurre errori gravi');
});

test('il banco personale ha un intento atteso per ogni voce del banco canonico', async () => {
  const { ESEMPI_CANONICI } = await import('./qa-canonical-bank.js');
  const attesi = new Set(BANCO_PERSONALE.map((c) => c.atteso));
  for (const intento of Object.keys(ESEMPI_CANONICI)) {
    assert.ok(attesi.has(intento), `nessuna domanda di prova per l'intento "${intento}"`);
  }
});

// ── La somiglianza lessicale ──
test('tokenizza ignora accenti, punteggiatura e parole troppo brevi', () => {
  const t = tokenizza('Perché è così? Il mercato!');
  assert.ok(t.has('perche'));
  assert.ok(t.has('cosi'));
  assert.ok(t.has('mercato'));
  assert.ok(!t.has('il'));
  assert.ok(!t.has('e'));
});

test('similaritaLessicale: identiche = 1, senza parole comuni = 0, e mai NaN', () => {
  assert.equal(similaritaLessicale('come va il mercato', 'come va il mercato'), 1);
  assert.equal(similaritaLessicale('mercato azioni', 'carbonara ricetta'), 0);
  assert.equal(similaritaLessicale('', 'qualcosa'), 0);
  assert.equal(similaritaLessicale('ab', 'ab'), 0); // sotto la lunghezza minima
  assert.ok(Number.isFinite(similaritaLessicale('a', '')));
});

test('similaritaDisponibile preferisce la semantica ma non lascia mai a mani vuote', async () => {
  const { similaritaDisponibile } = await import('./similarita-lessicale.js');
  const finta = () => 0.42;
  assert.equal(similaritaDisponibile({ semantica: finta }), finta);
  assert.equal(similaritaDisponibile({}), similaritaLessicale);
  assert.equal(similaritaDisponibile({ semantica: null }), similaritaLessicale);
});

test('LA DISTINZIONE SOTTILE: "quanto posso investire" è legittima, "dove investire" no', async () => {
  // Trovata provando l'app dal vivo. Le due domande si somigliano molto ma
  // sono opposte: la prima chiede un conto sui PROPRI soldi (quanto avanza),
  // la seconda chiede un consiglio su strumenti finanziari — attività
  // riservata in diversi Paesi. Una rete di sicurezza che le confonde è
  // inutile in un verso o dannosa nell'altro.
  await caricaBancoSemantico();
  const rifiutata = (d) => !!rifiutoMotivato(d, similaritaLessicale);

  for (const d of ['dimmi tu dove investire adesso', 'secondo te su quale azienda dovrei puntare i risparmi?',
    'dove metto i soldi?', 'in cosa investire ora?', 'su quale settore mi conviene puntare i soldi?']) {
    assert.equal(rifiutata(d), true, `"${d}" doveva essere rifiutata`);
  }
  for (const d of ['quanto posso investire?', 'quanto posso spendere oggi?', 'come sta il mercato?',
    'quanto ho risparmiato?', 'dove spendo di piu?']) {
    assert.equal(rifiutata(d), false, `"${d}" NON doveva essere rifiutata`);
  }
});
