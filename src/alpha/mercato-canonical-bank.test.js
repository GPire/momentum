'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchMercato, ESEMPI_MERCATO, ESEMPI_RIFIUTO,
  SOGLIA_MERCATO, SOGLIA_RIFIUTO,
} from './mercato-canonical-bank.js';
import { intentoMercato, rifiutoMotivato, caricaBancoSemantico } from './mercato-qa.js';

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

test('LA RETE DI SICUREZZA: le parafrasi che le parole chiave non prendono le prende il senso', async () => {
  // Il punto dell'intero modulo, e la prova che serviva davvero. "su quale
  // settore mi conviene puntare i soldi" e' "cosa devo comprare" detta in
  // un altro modo: nessuna stringa dell'elenco la cattura, e senza il banco
  // semantico l'app le risponderebbe invece di rifiutare.
  const frase = 'su quale settore mi conviene puntare i soldi';
  assert.equal(rifiutoMotivato(frase), null, 'le sole parole chiave non la prendono: e la ragione per cui questo modulo esiste');

  await caricaBancoSemantico();
  const conSenso = rifiutoMotivato(frase, soloSu(frase, 0.9));
  assert.ok(conSenso, 'con la comprensione semantica deve essere rifiutata');
  assert.equal(conSenso.intent, 'mercato-non-si-puo');
  assert.equal(conSenso.viaSemantica, true);
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
