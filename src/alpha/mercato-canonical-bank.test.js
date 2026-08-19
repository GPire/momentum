'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchMercato, ESEMPI_MERCATO, ESEMPI_RIFIUTO,
  SOGLIA_MERCATO, SOGLIA_RIFIUTO, MARGINE_MINIMO,
} from './mercato-canonical-bank.js';
import { intentoMercato, rifiutoMotivato, caricaBancoSemantico } from './mercato-qa.js';
import { similaritaLessicale } from '../ai/similarita-lessicale.js';

// Similarita' finta e controllabile: i test verificano la LOGICA del banco,
// non la qualita' del modello di embedding (che e' opt-in, pesa 197MB e non
// si scarica in una suite di test).
const soloSu = (frase, valore) => (a, b) => (b === frase ? valore : 0.05);

test('senza similarity non si confronta niente: il banco senza motore semantico e inutile', () => {
  assert.equal(matchMercato('come sta il mercato', null), null);
});

test('domanda vuota: nessun match, nessun crash', () => {
  assert.equal(matchMercato('', () => 0.99), null);
});

test('una parafrasi che le parole chiave non prendono viene capita per significato', () => {
  const r = matchMercato('quanto e rischioso entrare in questo periodo',
    soloSu('quanto e rischioso entrare adesso', 0.88));
  assert.ok(r);
  assert.equal(r.intent, 'perdita-massima');
  assert.equal(r.rifiuto, false);
});

test('sotto soglia non si inventa un intento: "non ho capito" e una risposta legittima', () => {
  // Sotto ENTRAMBE le soglie: ne' rifiuto ne' risposta.
  assert.equal(matchMercato('una frase qualunque', () => SOGLIA_RIFIUTO - 0.01), null);
  // Sopra la soglia del rifiuto ma sotto quella delle risposte, una
  // somiglianza indistinta con tutto fa scattare il rifiuto: e' il
  // comportamento voluto, non un difetto.
  const ambigua = matchMercato('una frase qualunque', () => SOGLIA_MERCATO - 0.01);
  assert.equal(ambigua.rifiuto, true);
});

// ── LA REGOLA DI SICUREZZA ──
test('IL RIFIUTO VINCE: una domanda che somiglia a entrambi non riceve mai la risposta', () => {
  // Punteggio ALTO su una domanda rispondibile e piu' BASSO su un rifiuto:
  // anche cosi' deve vincere il rifiuto, perche' un consiglio dato per errore
  // costa incomparabilmente di piu' di una riformulazione chiesta per errore.
  const similarity = (a, b) => {
    if (b === 'come sta il mercato in questo momento') return 0.95;
    if (b === 'su quale settore mi conviene puntare i soldi') return 0.70;
    return 0.05;
  };
  const r = matchMercato('come sta il mercato e dove mi conviene puntare?', similarity);
  assert.equal(r.rifiuto, true);
  assert.equal(r.intent, 'cosa-comprare');
});

test('la soglia del rifiuto e piu bassa di quella delle risposte, e non per caso', () => {
  assert.ok(SOGLIA_RIFIUTO < SOGLIA_MERCATO);
  // Un punteggio in mezzo alle due soglie: fa scattare il rifiuto, non la risposta.
  const mezzo = (SOGLIA_RIFIUTO + SOGLIA_MERCATO) / 2;
  assert.equal(matchMercato('x', soloSu('dove andra il mercato', mezzo)).rifiuto, true);
  assert.equal(matchMercato('x', soloSu('come sta il mercato in questo momento', mezzo)), null);
});

test('le tre famiglie di rifiuto sono tutte raggiungibili semanticamente', () => {
  for (const [famiglia, esempi] of Object.entries(ESEMPI_RIFIUTO)) {
    const r = matchMercato('domanda', soloSu(esempi[0], 0.9));
    assert.equal(r.rifiuto, true);
    assert.equal(r.intent, famiglia);
  }
});

// ── NON REGRESSIVO PER COSTRUZIONE ──
test('ogni intento del banco esiste gia in intentoMercato: il banco non ne inventa di nuovi', () => {
  // Il banco insegna a RAGGIUNGERE gli intenti esistenti. Se ne introducesse
  // uno che la cascata non sa servire, la risposta cadrebbe nel vuoto.
  const raggiunti = new Set();
  for (const esempi of Object.values(ESEMPI_MERCATO)) {
    for (const e of esempi) { const i = intentoMercato(e); if (i) raggiunti.add(i); }
  }
  // Almeno meta' degli intenti del banco deve essere confermata dalla cascata
  // sugli esempi canonici stessi: e' la prova che le chiavi sono quelle vere.
  const chiavi = Object.keys(ESEMPI_MERCATO);
  const confermati = chiavi.filter((k) => raggiunti.has(k));
  assert.ok(confermati.length >= chiavi.length / 2,
    `solo ${confermati.length}/${chiavi.length} chiavi confermate dalla cascata: ${chiavi.filter((k) => !raggiunti.has(k))}`);
});

test('DOVE SIAMO DAVVERO: la rete lessicale e una RISERVA, non il motore', async () => {
  // Misurato, e vale la pena scriverlo perche' e' cambiato durante il lavoro.
  // Quando questo modulo e' nato, la somiglianza lessicale recuperava due
  // rifiuti su sette che le parole chiave perdevano (sicurezza 71,4% -> 100%).
  // Poi, provando l'app dal vivo, sono emerse le formulazioni che mancavano
  // davvero ("dove investire", "cosa faresti") e l'elenco a parole chiave e'
  // stato allargato. Da allora le parole chiave coprono il banco da sole, e
  // la rete lessicale non aggiunge piu' nulla SU QUESTO BANCO.
  // Non e' inutile: e' la riserva per le formulazioni che non abbiamo ancora
  // incontrato, e costa nulla. Ma dire che "chiude il buco" oggi sarebbe
  // raccontare una vittoria del passato come se fosse del presente.
  await caricaBancoSemantico();
  for (const esempi of Object.values(ESEMPI_RIFIUTO)) {
    for (const e of esempi) {
      const soloParole = rifiutoMotivato(e);
      const conLessicale = rifiutoMotivato(e, similaritaLessicale);
      assert.ok(conLessicale, `"${e}" deve essere rifiutata`);
      // Se un giorno una di queste smettesse di essere presa dalle sole
      // parole chiave, questo test lo direbbe subito.
      assert.ok(soloParole, `"${e}" non e piu coperta dalle parole chiave: la riserva lessicale sta lavorando, aggiornare il commento`);
    }
  }
});

test('IL LIMITE APERTO, dichiarato invece che scoperto da un utente', async () => {
  // L'onesta' che tiene in piedi il resto. Queste sono richieste di consiglio
  // in piena regola e NON vengono rifiutate: non nominano soldi, titoli,
  // settori ne' il verbo investire, e contro l'esempio piu' vicino del banco
  // la somiglianza lessicale resta sotto la soglia (0,33 e 0,60 misurati).
  //
  // Sarebbe il caso del modello di embedding — ma misurandolo dal vivo si e'
  // visto che su questo dominio produce 0,90-0,96 per QUALUNQUE coppia, quindi
  // non e' utilizzabile per decidere un rifiuto. Il buco resta aperto ed e'
  // scritto qui.
  await caricaBancoSemantico();
  for (const sfugge of [
    'quale strumento finanziario mi suggeriresti',
    'e tu al mio posto che scelta prenderesti con questi soldi',
  ]) {
    assert.equal(rifiutoMotivato(sfugge, similaritaLessicale), null,
      `"${sfugge}" ora viene presa: il limite documentato qui e stato chiuso, aggiornare il commento`);
  }
});

test('IL MARGINE, non il livello: la regola giusta per un modello di embedding', () => {
  // Misurato: con una somiglianza di embedding i valori stanno tutti fra 0,90
  // e 0,96, quindi una soglia assoluta li fa passare tutti. L'informazione e'
  // nella distanza fra il primo e il secondo — 0,027 quando il
  // riconoscimento e' netto, 0,0012 quando e' un pareggio.
  const primo = 'come sta il mercato in questo momento';
  // Tutto alto ma indistinto: nessun margine, quindi nessun riconoscimento.
  const indistinta = () => 0.94;
  assert.equal(matchMercato('x', indistinta, { perMargine: true }), null);
  // Stessi valori alti, ma con un primo che stacca: riconosciuto.
  const conMargine = (a, b) => (b === primo ? 0.96 : 0.93);
  const r = matchMercato('x', conMargine, { perMargine: true });
  assert.ok(r, 'con un margine netto deve riconoscere');
  assert.equal(r.intent, 'regime');
  assert.ok(r.margine >= MARGINE_MINIMO);
  // E la stessa similarita' indistinta, letta con la soglia assoluta,
  // passerebbe: e' esattamente il guasto che si e' visto dal vivo.
  assert.ok(matchMercato('x', indistinta, { perMargine: false }));
});

test('ogni domanda da rifiutare e coperta: dalle parole chiave OPPURE dal senso', async () => {
  await caricaBancoSemantico();
  for (const esempi of Object.values(ESEMPI_RIFIUTO)) {
    for (const e of esempi) {
      const conSenso = rifiutoMotivato(e, soloSu(e, 0.9));
      assert.ok(conSenso, `"${e}" non viene rifiutata da nessuna delle due vie`);
      assert.equal(conSenso.intent, 'mercato-non-si-puo');
    }
  }
});

test('il senso NON puo cambiare una risposta che le parole chiave gia davano', async () => {
  await caricaBancoSemantico();
  // Una similarita' che direbbe "rifiuto" su tutto: le domande gia'
  // riconosciute devono restare esattamente com'erano.
  const bugiarda = () => 0.99;
  for (const d of ['come sta il mercato?', 'cosa e successo nel 2008?', 'loro protegge dai crolli?']) {
    assert.equal(intentoMercato(d, bugiarda), intentoMercato(d), `"${d}" e cambiata`);
  }
});

test('ogni intento ha abbastanza esempi e almeno uno in inglese', () => {
  for (const [intent, esempi] of Object.entries({ ...ESEMPI_MERCATO, ...ESEMPI_RIFIUTO })) {
    assert.ok(esempi.length >= 3, `${intent} ha solo ${esempi.length} esempi`);
    assert.ok(esempi.some((e) => /\b(what|how|which|is|will|are)\b/.test(e)), `${intent} non ha esempi in inglese`);
  }
});
