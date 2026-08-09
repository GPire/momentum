import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng, simulateOnePath, forcedSaleRisk, sequenceRisk, simulaConSerie,
  bufferNeeded, riskText, bufferText,
} from './forced-sale-risk.js';

// Un libero professionista tipico: quasi tutto investito, poca cassa, quattro
// scadenze fiscali che arrivano comunque, e un reddito che varia di mese in
// mese come varia davvero quello di chi lavora in proprio.
const professionista = {
  liquidita: 4000,
  sigmaReddito: 0.35,
  contributoMensile: 2600,
  speseMensili: 2400,
  portafoglio: 30000,
  usciteProgrammate: { 5: 3200, 11: 2100, 17: 3200, 23: 2100 }, // acconti e saldi
  mu: 0.06, sigma: 0.18, mesi: 24,
};

// ── Il caso in cui non c'è nessun rischio, e va detto ──

test('chi ha cassa in abbondanza non viene allarmato', () => {
  const r = forcedSaleRisk({ ...professionista, liquidita: 60000 }, { percorsi: 800 });
  assert.ok(r.probabilita < 0.02, `probabilita ${r.probabilita}`);
  assert.match(riskText(r), /non saresti costretto a vendere/);
});

test('senza portafoglio non si può essere costretti a vendere niente', () => {
  const p = simulateOnePath({ ...professionista, portafoglio: 0, rng: makeRng(1) });
  assert.equal(p.costretto, false);
  assert.equal(p.vendite, 0);
});

// ── Il rischio, misurato ──

test('il professionista con poca cassa e scadenze fiscali È esposto, e di quanto si sa', () => {
  const r = forcedSaleRisk(professionista, { percorsi: 3000 });
  assert.ok(r.probabilita > 0.5, `atteso un rischio alto, misurato ${r.probabilita}`);
  assert.ok(r.costoMedio > 0, 'vendere durante un calo ha un costo, e va quantificato');
  assert.ok(r.meseTipico !== null && r.meseTipico >= 0);
  assert.match(riskText(r), /volte su 100 saresti costretto a vendere/);
});

test('la probabilità viene con il suo MARGINE: è una simulazione, non un oracolo', () => {
  const r = forcedSaleRisk(professionista, { percorsi: 2000 });
  assert.ok(r.margine > 0 && r.margine < 0.05, `margine ${r.margine}`);
  assert.ok(r.probabilita > 0.05 && r.probabilita < 0.95, `una probabilita' utile, non 0 o 1: ${r.probabilita}`);
  // Più percorsi = margine più stretto, come deve essere.
  const piu = forcedSaleRisk(professionista, { percorsi: 8000 });
  assert.ok(piu.margine < r.margine, `${piu.margine} deve essere sotto ${r.margine}`);
});

test('più cassa = meno rischio, in modo monotono', () => {
  const scala = [0, 3000, 8000, 20000].map((extra) =>
    forcedSaleRisk({ ...professionista, liquidita: professionista.liquidita + extra }, { percorsi: 1500 }).probabilita);
  for (let i = 1; i < scala.length; i++) {
    assert.ok(scala[i] <= scala[i - 1] + 0.02, `il rischio non deve salire aggiungendo cassa: ${JSON.stringify(scala)}`);
  }
  assert.ok(scala[3] < scala[0] / 2, `ventimila di cuscinetto devono dimezzare abbondantemente il rischio: ${JSON.stringify(scala)}`);
});

test('le scadenze fiscali sono metà del problema — toglierle cambia il quadro', () => {
  const conTasse = forcedSaleRisk(professionista, { percorsi: 2000 }).probabilita;
  const senzaTasse = forcedSaleRisk({ ...professionista, usciteProgrammate: {} }, { percorsi: 2000 }).probabilita;
  assert.ok(senzaTasse < conTasse, `${senzaTasse} deve essere sotto ${conTasse}`);
});

test('una volatilità più alta aumenta il costo di essere costretti, non solo la probabilità', () => {
  const calmo = forcedSaleRisk({ ...professionista, sigma: 0.08 }, { percorsi: 2500 });
  const mosso = forcedSaleRisk({ ...professionista, sigma: 0.35 }, { percorsi: 2500 });
  assert.ok(mosso.costoMedio > calmo.costoMedio, `${mosso.costoMedio} vs ${calmo.costoMedio}`);
});

// ── La correlazione che tutti ignorano ──

test('IGNORARE che il calo e l\'ammanco arrivano INSIEME sottostima il rischio', () => {
  const conShock = { ...professionista, shockRedditoImporto: 4000, shockRedditoProb: 0.05 };
  const indipendente = forcedSaleRisk({ ...conShock, correlazioneRedditoMercato: 0 }, { percorsi: 4000 });
  const correlato = forcedSaleRisk({ ...conShock, correlazioneRedditoMercato: 0.6 }, { percorsi: 4000 });
  assert.ok(correlato.costoMedio > indipendente.costoMedio,
    `con la correlazione il danno deve risultare maggiore: ${correlato.costoMedio} vs ${indipendente.costoMedio}`);
});

// ── IL RISCHIO DI SEQUENZA, isolato ──

test('STESSI RENDIMENTI, ORDINE DIVERSO: su dieci anni si va da zero a tutto', () => {
  // Dieci anni con le scadenze fiscali di ogni anno. Il multiinsieme dei
  // rendimenti e' IDENTICO in tutte le mescolate: stessa media, stessa
  // volatilita', stessi identici numeri. L'unica cosa che cambia e' l'ordine.
  const usc = {};
  for (let anno = 0; anno < 10; anno++) { usc[anno * 12 + 5] = 3200; usc[anno * 12 + 11] = 2100; }
  const decennio = { ...professionista, usciteProgrammate: usc, mesi: 120 };
  const s = sequenceRisk(decennio, { mescolate: 400, seed: 4242 });

  assert.ok(s.migliore > s.tipico && s.tipico >= s.peggiore);
  // Il divario dovuto al SOLO ordine e' dello stesso ordine di grandezza del
  // risultato: chi prende i cali all'inizio finisce a zero, chi li prende alla
  // fine si tiene tutto. E' il numero che il "rendimento medio annuo" nasconde
  // per costruzione, ed e' il motivo per cui questo modulo esiste.
  assert.ok(s.divarioDaOrdine > s.tipico * 0.5,
    `divario da solo ordine ${s.divarioDaOrdine} contro un risultato tipico di ${s.tipico}`);
  assert.equal(s.peggiore, 0, 'nella coda peggiore il portafoglio si azzera: stessi rendimenti, ordine sfortunato');
});

test('il rischio di sequenza cresce con l\'orizzonte: due anni non sono dieci', () => {
  const usc = {};
  for (let anno = 0; anno < 10; anno++) { usc[anno * 12 + 5] = 3200; usc[anno * 12 + 11] = 2100; }
  const breve = sequenceRisk(professionista, { mescolate: 250, seed: 11 });
  const lungo = sequenceRisk({ ...professionista, usciteProgrammate: usc, mesi: 120 }, { mescolate: 250, seed: 11 });
  assert.ok(lungo.divarioDaOrdine > breve.divarioDaOrdine * 3,
    `${lungo.divarioDaOrdine} deve superare di molto ${breve.divarioDaOrdine}`);
});

test('SENZA prelievi l\'ordine NON conta: è la prova che la misura è quella giusta', () => {
  // Moltiplicazione commutativa: senza flussi in mezzo, l'ordine dei
  // rendimenti non può cambiare il risultato finale. Se questo test fallisse,
  // il divario misurato sopra non sarebbe rischio di sequenza ma un bug.
  const serie = [0.05, -0.10, 0.03, 0.08, -0.02, 0.06];
  const a = simulaConSerie({ portafoglio: 10000, liquidita: 5000, contributoMensile: 0, speseMensili: 0 }, serie);
  const b = simulaConSerie({ portafoglio: 10000, liquidita: 5000, contributoMensile: 0, speseMensili: 0 }, [...serie].reverse());
  assert.ok(Math.abs(a.valoreFinale - b.valoreFinale) < 1e-6, `${a.valoreFinale} vs ${b.valoreFinale}`);
  assert.equal(a.costretto, false);
});

test('CON prelievi lo stesso identico insieme di rendimenti dà esiti diversi', () => {
  const serie = [0.05, -0.25, 0.03, 0.30, -0.02, 0.06];
  const base = { portafoglio: 10000, liquidita: 0, contributoMensile: 0, speseMensili: 900 };
  const caliPrima = simulaConSerie(base, [-0.25, -0.02, 0.03, 0.05, 0.06, 0.30]);
  const caliDopo = simulaConSerie(base, [0.30, 0.06, 0.05, 0.03, -0.02, -0.25]);
  assert.ok(Math.abs(caliPrima.valoreFinale - caliDopo.valoreFinale) > 100,
    `prendere i cali all'inizio deve fare differenza: ${caliPrima.valoreFinale} vs ${caliDopo.valoreFinale}`);
  assert.ok(caliPrima.perditaRealizzata > caliDopo.perditaRealizzata,
    'chi incassa i cali all\'inizio realizza più perdite');
  // Stesso multiinsieme di rendimenti in entrambi i casi: la differenza non
  // viene dal mercato.
  assert.deepEqual([...serie].sort(), [-0.25, -0.02, 0.03, 0.05, 0.06, 0.30].sort());
});

// ── La risposta su cui si può agire ──

test('IL NUMERO UTILE: quanto tenere da parte perché il rischio scenda dove vuoi', () => {
  const b = bufferNeeded(professionista, { obiettivo: 0.1, percorsi: 1200 });
  assert.equal(b.raggiungibile, true);
  assert.ok(b.serve > 0);
  assert.ok(b.rischioDopo <= 0.12, `dopo il cuscinetto il rischio deve essere sceso: ${b.rischioDopo}`);
  assert.ok(b.rischioDopo < b.rischioAttuale);
  assert.match(bufferText(b), /il rischio di dover vendere in perdita scende dal/);
  // Cifra arrotondata: una da ricordare, non da contabile.
  assert.equal(b.serve % 50, 0);
});

test('chi è già al sicuro non riceve un compito da fare', () => {
  const b = bufferNeeded({ ...professionista, liquidita: 60000 }, { obiettivo: 0.05, percorsi: 800 });
  assert.equal(b.serve, 0);
  assert.match(bufferText(b), /sei già sotto la soglia/);
});

test('quando il cuscinetto NON basta lo dice, invece di consigliare l\'impossibile', () => {
  const disperato = { ...professionista, speseMensili: 6000, contributoMensile: 1200, liquidita: 0 };
  const b = bufferNeeded(disperato, { obiettivo: 0.01, massimo: 2000, percorsi: 600 });
  assert.equal(b.raggiungibile, false);
  assert.match(b.motivo, /il problema non è il cuscinetto/);
});

// ── Onestà e riproducibilità ──

test('lo stesso scenario dà lo stesso numero: due schermate non devono dire due cose', () => {
  const a = forcedSaleRisk(professionista, { percorsi: 1000, seed: 7 });
  const b = forcedSaleRisk(professionista, { percorsi: 1000, seed: 7 });
  assert.deepEqual(a, b);
});

test('il testo non contiene gergo finanziario', () => {
  const t = riskText(forcedSaleRisk(professionista, { percorsi: 800 }));
  assert.ok(!/volatilit|drawdown|sequenza|Monte Carlo|percentile|sigma/i.test(t), `gergo: ${t}`);
});

test('il valore del portafoglio non può diventare negativo, mai', () => {
  const r = makeRng(99);
  for (let i = 0; i < 200; i++) {
    const p = simulateOnePath({ ...professionista, sigma: 0.9, speseMensili: 5000, rng: r });
    assert.ok(p.valoreFinale >= -1e-9, `valore negativo: ${p.valoreFinale}`);
  }
});

test('chi resta a secco ANCHE dopo aver venduto tutto viene contato a parte', () => {
  const r = forcedSaleRisk({ ...professionista, portafoglio: 2000, speseMensili: 5000 }, { percorsi: 800 });
  assert.ok(r.probabilitaRestareASecco > 0, 'vendere tutto e non bastare è un esito diverso, e va distinto');
});
