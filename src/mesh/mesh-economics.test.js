import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speedupCeiling, arithmeticIntensity, distributionVerdict, devicesWorthAsking,
  GUADAGNO_MINIMO, BANDA_PRUDENTE,
} from './mesh-economics.js';
import { initReliabilityState, recordComputeOutcome } from './compute-reliability.js';

const peer = (peerId, score) => ({ peerId, capability: { score, disponibile: true, motivi: [] }, minutiOnline: 30, signals: { charging: true, screenOn: true, batteryLevel: 0.9 } });
// Il caso buono per davvero: un Monte Carlo. Si manda un seme, si riportano
// tre numeri, in mezzo si simulano centomila percorsi.
const MONTECARLO = { msCalcoloPerUnita: 900, byteInviatiPerUnita: 64, byteRicevutiPerUnita: 64 };

// ── Il tetto di Amdahl: il muro che nessun dispositivo abbatte ──

test('con il 5% di lavoro non divisibile non si va oltre 20 volte, nemmeno con mille dispositivi', () => {
  const c = speedupCeiling(0.05, 1000);
  assert.equal(c.tetto, 20);
  assert.ok(c.conQuestiDispositivi < 20, `con mille dispositivi: ${c.conQuestiDispositivi}×, comunque sotto il tetto`);
  assert.match(c.motivo, /nemmeno con mille/);
});

test('il tetto dice anche oltre quanti dispositivi è inutile aggiungerne', () => {
  const c = speedupCeiling(0.1, 1000);
  assert.equal(c.tetto, 10);
  assert.ok(c.saturazioneA > 0 && c.saturazioneA < 200, `saturazione a ${c.saturazioneA} dispositivi`);
  // Verifica del conto: a quel numero si è davvero vicini al 90% del tetto.
  const a = speedupCeiling(0.1, c.saturazioneA).conQuestiDispositivi;
  assert.ok(a >= 0.9 * c.tetto, `${a} deve superare il 90% di ${c.tetto}`);
});

test('senza parte seriale il tetto è infinito, e viene dichiarato ottimistico', () => {
  const c = speedupCeiling(0);
  assert.equal(c.tetto, Infinity);
  assert.match(c.motivo, /ottimistico/);
});

// ── Intensità aritmetica: distribuibile PER NATURA oppure no ──

test('un Monte Carlo è il caso in cui la rete vale davvero', () => {
  const i = arithmeticIntensity({ ...MONTECARLO, banda: BANDA_PRUDENTE });
  assert.equal(i.distribuibilePerNatura, true);
  assert.ok(i.rapporto > 10, `rapporto calcolo/trasferimento ${i.rapporto}`);
  assert.match(i.motivo, /vale davvero/);
});

test('spedire un carico di dati per due moltiplicazioni è teatro, e viene bocciato', () => {
  const i = arithmeticIntensity({ msCalcoloPerUnita: 3, byteInviati: 400 * 1024, byteRicevuti: 200 * 1024 });
  assert.equal(i.distribuibilePerNatura, false);
  assert.match(i.motivo, /apparenza/);
});

test('il caso limite non viene spacciato per buono', () => {
  // Calcolo appena superiore al trasferimento.
  const byte = 20 * 1024;
  const ms = ((byte * 2) / BANDA_PRUDENTE) * 1000 * 1.2;
  const i = arithmeticIntensity({ msCalcoloPerUnita: ms, byteInviati: byte, byteRicevuti: byte });
  assert.equal(i.distribuibilePerNatura, true);
  assert.match(i.motivo, /solo con dispositivi veloci/);
});

// ── Il verdetto con i dispositivi che ci sono ──

test('senza altri dispositivi si calcola qui, e lo si dice senza girarci intorno', () => {
  const v = distributionVerdict({ unita: 100, ...MONTECARLO, peers: [] });
  assert.equal(v.conviene, false);
  assert.equal(v.tempoDistribuito, v.tempoLocale);
  assert.match(v.testo, /su questo dispositivo/);
});

test('IL CASO BUONO: molte unità pesanti e quattro dispositivi in carica', () => {
  const v = distributionVerdict({
    unita: 200, ...MONTECARLO, coreLocali: 4,
    peers: [peer('a', 16), peer('b', 8), peer('c', 8), peer('d', 4)],
  });
  assert.equal(v.conviene, true);
  assert.ok(v.guadagno >= GUADAGNO_MINIMO, `guadagno ${v.guadagno}`);
  assert.ok(v.tempoDistribuito < v.tempoLocale);
  assert.equal(v.colloDiBottiglia, 'nessuno: sta girando bene');
  assert.match(v.testo, /Divido il calcolo su 4 dispositivi/);
});

test('IL COSTO NON SI NASCONDE: si dichiara quanto lavoro si sta chiedendo agli altri', () => {
  const v = distributionVerdict({
    unita: 200, ...MONTECARLO, peers: [peer('a', 16), peer('b', 16)],
  });
  assert.ok(v.secondiDiAltrui > 0, 'distribuire non riduce l\'energia totale: la sposta');
  assert.match(v.testo, /costa .*s di lavoro/);
});

test('un carico che trasferisce più di quanto calcola non si distribuisce, con qualunque rete', () => {
  const v = distributionVerdict({
    unita: 500, msCalcoloPerUnita: 2, byteInviatiPerUnita: 200 * 1024, byteRicevutiPerUnita: 100 * 1024,
    peers: [peer('a', 16), peer('b', 16), peer('c', 16), peer('d', 16), peer('e', 16)],
  });
  assert.equal(v.conviene, false);
  assert.equal(v.colloDiBottiglia, 'trasferimento');
});

test('un guadagno marginale non giustifica la batteria di altri', () => {
  // Poche unità leggere: la latenza di coordinamento si mangia il vantaggio.
  const v = distributionVerdict({ unita: 6, msCalcoloPerUnita: 40, peers: [peer('a', 4)] });
  assert.equal(v.conviene, false);
  assert.match(v.motivo, /non abbastanza/);
});

test('la parte che non si può dividere viene riconosciuta come collo di bottiglia', () => {
  const v = distributionVerdict({
    unita: 300, ...MONTECARLO, frazioneSeriale: 0.6, coreLocali: 2,
    peers: [peer('a', 16), peer('b', 16), peer('c', 16)],
  });
  assert.equal(v.colloDiBottiglia, 'la parte che non si può dividere');
  assert.ok(v.tetto.tetto < 2, `con il 60% seriale il tetto è ${v.tetto.tetto}×`);
});

test('i dispositivi che spariscono entrano nel conto PRIMA, non dopo', () => {
  let inaffidabile = initReliabilityState();
  for (let i = 0; i < 15; i++) inaffidabile = recordComputeOutcome(inaffidabile, 'b', { consegnato: false });
  const peers = [peer('a', 16), peer('b', 16)];
  const senza = distributionVerdict({ unita: 200, ...MONTECARLO, peers });
  const con = distributionVerdict({ unita: 200, ...MONTECARLO, peers, reliability: inaffidabile });
  assert.ok(con.guadagno < senza.guadagno, `chi sparisce non aggiunge capacità: ${con.guadagno} vs ${senza.guadagno}`);
  assert.ok(con.capacitaRete < senza.capacitaRete);
});

test('quando quasi tutta la fetta è a rischio il collo di bottiglia lo dice', () => {
  let scarsi = initReliabilityState();
  for (let i = 0; i < 15; i++) { scarsi = recordComputeOutcome(scarsi, 'a', { consegnato: i % 5 === 0 }); }
  const v = distributionVerdict({ unita: 400, ...MONTECARLO, coreLocali: 1, peers: [peer('a', 16)], reliability: scarsi });
  assert.equal(v.colloDiBottiglia, 'dispositivi che spariscono');
});

// ── Quanti dispositivi chiamare davvero ──

test('non si accendono venti telefoni quando ne bastano pochi', () => {
  const peers = Array.from({ length: 20 }, (_, i) => peer(`d${i}`, 16));
  const r = devicesWorthAsking({ unita: 60, ...MONTECARLO, coreLocali: 4, peers });
  assert.ok(r.quanti >= 1 && r.quanti < 20, `chiamati ${r.quanti} su 20`);
  assert.ok(r.inutili > 0);
  assert.match(r.motivo, /si appiattisce/);
});

test('se il carico è enorme, tutti i dispositivi servono davvero', () => {
  const peers = Array.from({ length: 4 }, (_, i) => peer(`d${i}`, 16));
  const r = devicesWorthAsking({ unita: 20000, ...MONTECARLO, coreLocali: 2, peers });
  assert.equal(r.quanti, 4);
  assert.match(r.motivo, /aggiungono qualcosa/);
});

test('il testo per la persona non contiene gergo da calcolo distribuito', () => {
  const v = distributionVerdict({ unita: 200, ...MONTECARLO, peers: [peer('a', 16), peer('b', 8)] });
  assert.ok(!/Amdahl|seriale|straggler|intensità|throughput|latenza|banda/i.test(v.testo), `gergo nel testo: ${v.testo}`);
});
