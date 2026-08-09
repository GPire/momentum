import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFingerprint, independentWitnesses, probeDisagreement, learningAgenda,
  routeQuestion, initAskBudget, askBudgetStatus, spendAsk, curiosityPlan, curiosityText,
  SOGLIA_DISACCORDO, MIN_TESTIMONI, DEFAULT_TETTO_DOMANDE,
} from './collective-curiosity.js';
import { buildDistillationDigest, PROBE_SET } from './federated-distillation.js';

// Un dispositivo che risponde `dist` su ogni sonda elencata.
const peer = (peerId, answers) => ({ peerId, digest: { kind: 'distillation', probeVersion: 1, answers } });
const sicuro = (cat) => ({ [cat]: 1 });

// ── Testimoni indipendenti: l'accordo non è prova se non è indipendente ──

test('due dispositivi con le stesse identiche risposte contano UNO', () => {
  const a = peer('a', { x: sicuro('spesa') });
  const b = peer('b', { x: sicuro('spesa') });
  const c = peer('c', { x: sicuro('svago') });
  const t = independentWitnesses([a, b, c]);
  assert.equal(t.totali, 3);
  assert.equal(t.indipendenti, 2, 'a e b sono lo stesso modello, non due opinioni');
  assert.deepEqual(t.cloni, [['a', 'b']]);
  assert.ok(t.diversita < 1);
});

test('LA CAMERA DELL\'ECO: otto dispositivi che hanno fuso lo stesso modello sono un testimone solo', () => {
  const identici = Array.from({ length: 8 }, (_, i) => peer(`d${i}`, { x: sicuro('spesa'), y: { casa: 0.6, svago: 0.4 } }));
  const t = independentWitnesses(identici);
  assert.equal(t.indipendenti, 1);
  assert.equal(t.diversita, 0.125);
});

test('l\'impronta è deterministica e non dipende dall\'ordine delle chiavi', () => {
  const uno = { answers: { x: { a: 0.6, b: 0.4 }, y: { c: 1 } } };
  const due = { answers: { y: { c: 1 }, x: { b: 0.4, a: 0.6 } } };
  assert.equal(answerFingerprint(uno), answerFingerprint(due));
  assert.notEqual(answerFingerprint(uno), answerFingerprint({ answers: { x: { a: 0.7, b: 0.3 } } }));
});

// ── Il disaccordo, misurato ──

test('tutti d\'accordo e sicuri: niente da imparare', () => {
  const d = probeDisagreement('x', [peer('a', { x: sicuro('spesa') }), peer('b', { x: sicuro('spesa') }), peer('c', { x: sicuro('spesa') })]);
  assert.equal(d.disaccordo, 0);
  assert.equal(d.consenso, 1);
  assert.equal(d.favorita, 'spesa');
});

test('la rete si spacca a metà: è il caso più interessante', () => {
  const d = probeDisagreement('x', [
    peer('a', { x: sicuro('spesa') }), peer('b', { x: sicuro('spesa') }),
    peer('c', { x: sicuro('svago') }), peer('d', { x: sicuro('svago') }),
  ]);
  assert.ok(d.divisione >= 0.5, `divisione ${d.divisione}`);
  assert.ok(d.disaccordo > SOGLIA_DISACCORDO, `disaccordo ${d.disaccordo}`);
});

test('concordi nel NON sapere pesa meno che essere divisi — sono due ignoranze diverse', () => {
  const piatti = [1, 2, 3].map((i) => peer(`p${i}`, { x: { spesa: 0.34, svago: 0.33, casa: 0.33 } }));
  const divisi = [
    peer('a', { x: sicuro('spesa') }), peer('b', { x: sicuro('svago') }), peer('c', { x: sicuro('casa') }),
  ];
  const dp = probeDisagreement('x', piatti), dd = probeDisagreement('x', divisi);
  assert.ok(dp.incertezza > 0.95, 'distribuzioni piatte: incertezza massima');
  assert.equal(dp.divisione, 0, 'ma nessuna divisione: puntano tutti sulla stessa');
  assert.ok(dd.disaccordo > dp.disaccordo, `divisi ${dd.disaccordo} deve superare concordi-ignoranti ${dp.disaccordo}`);
});

test('chi ha reputazione zero non vota', () => {
  const pesi = new Map([['a', 1], ['b', 1], ['bugiardo', 0]]);
  const d = probeDisagreement('x', [
    peer('a', { x: sicuro('spesa') }), peer('b', { x: sicuro('spesa') }),
    peer('bugiardo', { x: sicuro('cripto') }),
  ], { pesi });
  assert.equal(d.rispondenti, 2);
  assert.equal(d.disaccordo, 0, 'il voto escluso non deve creare un disaccordo finto');
});

test('una sonda a cui nessuno risponde non produce un numero inventato', () => {
  const d = probeDisagreement('mai-vista', [peer('a', { x: sicuro('spesa') })]);
  assert.equal(d.misurabile, false);
  assert.match(d.motivo, /nessuno ha risposto/);
});

// ── L'agenda ──

test('l\'agenda mette in cima ciò su cui la rete è più spaccata', () => {
  const digests = [
    peer('a', { facile: sicuro('spesa'), difficile: sicuro('casa') }),
    peer('b', { facile: sicuro('spesa'), difficile: sicuro('svago') }),
    peer('c', { facile: sicuro('spesa'), difficile: sicuro('cripto') }),
  ];
  const r = learningAgenda(digests);
  assert.equal(r.agenda[0].probe, 'difficile');
  assert.ok(!r.agenda.some((a) => a.probe === 'facile'), 'ciò su cui sono già d\'accordo non entra in agenda');
  assert.equal(r.giaConcordi, 1);
});

test('con pochi punti di vista davvero diversi l\'agenda esiste ma NON si dichiara affidabile', () => {
  const cloni = Array.from({ length: 6 }, (_, i) => peer(`c${i}`, { x: { spesa: 0.5, svago: 0.5 } }));
  const r = learningAgenda(cloni);
  assert.equal(r.affidabile, false);
  assert.match(r.motivo, /punti di vista/);
  assert.ok(r.testimoni.indipendenti < MIN_TESTIMONI);
});

test('imparare benissimo un caso che non incontri mai vale meno', () => {
  const digests = [
    peer('a', { raro: sicuro('casa'), comune: sicuro('casa') }),
    peer('b', { raro: sicuro('svago'), comune: sicuro('svago') }),
    peer('c', { raro: sicuro('cripto'), comune: sicuro('cripto') }),
  ];
  const r = learningAgenda(digests, { frequenzaLocale: { raro: 0.02, comune: 1 } });
  assert.equal(r.agenda[0].probe, 'comune');
  assert.ok(r.agenda[0].valore > r.agenda[1].valore * 5);
});

test('senza frequenza nota non si penalizza: la rete resterebbe cieca dove è cieca adesso', () => {
  const digests = [
    peer('a', { x: sicuro('casa') }), peer('b', { x: sicuro('svago') }), peer('c', { x: sicuro('cripto') }),
  ];
  assert.equal(learningAgenda(digests).agenda[0].rilevanza, 1);
});

// ── A chi si chiede: l'ordine che costa meno alla persona ──

test('se la rete sa già, non è una domanda: è una consegna mancata', () => {
  const analisi = probeDisagreement('x', [
    peer('a', { x: sicuro('cripto') }), peer('b', { x: sicuro('cripto') }),
    peer('c', { x: sicuro('cripto') }), peer('d', { x: sicuro('spesa') }),
  ]);
  const r = routeQuestion(analisi);
  assert.equal(r.a, 'rete');
  assert.equal(r.atteso, 'cripto');
  assert.match(r.perche, /75%/);
});

test('un fatto pubblico si va a prendere alla fonte, non si chiede all\'utente', () => {
  const analisi = probeDisagreement('tasso-bce', [
    peer('a', { 'tasso-bce': sicuro('alto') }), peer('b', { 'tasso-bce': sicuro('basso') }), peer('c', { 'tasso-bce': sicuro('medio') }),
  ]);
  const r = routeQuestion(analisi, { fattoPubblico: true });
  assert.equal(r.a, 'fonti');
  assert.match(r.perche, /incrocia/);
});

test('all\'utente si arriva per ultimi, e mai oltre il tetto', () => {
  const analisi = probeDisagreement('x', [
    peer('a', { x: sicuro('casa') }), peer('b', { x: sicuro('svago') }), peer('c', { x: sicuro('cripto') }),
  ]);
  assert.equal(routeQuestion(analisi).a, 'utente');
  const r = routeQuestion(analisi, { tettoRaggiunto: true });
  assert.equal(r.a, 'nessuno');
  assert.match(r.perche, /resta in agenda/);
});

// ── Il tetto alle domande ──

test('il tetto alle domande è contato davvero e si riapre col periodo', () => {
  let b = initAskBudget(0);
  assert.equal(askBudgetStatus(b, 0).rimaste, DEFAULT_TETTO_DOMANDE.quante);
  b = spendAsk(b, 0); b = spendAsk(b, 1000);
  assert.equal(askBudgetStatus(b, 1000).esaurito, true);
  // Oltre il tetto non si va nemmeno insistendo.
  b = spendAsk(b, 2000);
  assert.equal(b.fatte, DEFAULT_TETTO_DOMANDE.quante);
  // Passato il periodo si riparte.
  const dopo = DEFAULT_TETTO_DOMANDE.periodoMs + 1;
  assert.equal(askBudgetStatus(b, dopo).rimaste, DEFAULT_TETTO_DOMANDE.quante);
});

// ── Il piano completo ──

test('IL PIANO: la maggior parte delle risposte NON arriva dall\'utente', () => {
  const digests = [
    // Sonda 1: la rete sa (tre su quattro concordi) → si tira dalla rete.
    // Sonda 2: fatto pubblico su cui sono divisi → alle fonti.
    // Sonda 3 e 4: divisi e privati → all'utente, ma il tetto è due.
    peer('a', { s1: sicuro('cripto'), s2: sicuro('alto'), s3: sicuro('casa'), s4: sicuro('casa') }),
    peer('b', { s1: sicuro('cripto'), s2: sicuro('basso'), s3: sicuro('svago'), s4: sicuro('svago') }),
    peer('c', { s1: sicuro('cripto'), s2: sicuro('medio'), s3: sicuro('cripto'), s4: sicuro('cripto') }),
    peer('d', { s1: sicuro('spesa'), s2: sicuro('alto'), s3: sicuro('spesa'), s4: sicuro('spesa') }),
  ];
  const piano = curiosityPlan(digests, { fattiPubblici: { s2: true }, budget: initAskBudget(0), now: 0 });
  assert.equal(piano.affidabile, true);
  assert.equal(piano.allaRete, 1);
  assert.equal(piano.alleFonti, 1);
  assert.ok(piano.allUtente <= DEFAULT_TETTO_DOMANDE.quante, `all'utente ${piano.allUtente}`);
  assert.ok(piano.allaRete + piano.alleFonti >= piano.allUtente,
    'se la maggior parte finisse all\'utente il disegno avrebbe fallito');
});

test('il piano rispetta un tetto già esaurito: niente domande, restano in agenda', () => {
  const digests = [
    peer('a', { s3: sicuro('casa'), s4: sicuro('casa') }),
    peer('b', { s3: sicuro('svago'), s4: sicuro('svago') }),
    peer('c', { s3: sicuro('cripto'), s4: sicuro('cripto') }),
  ];
  let b = initAskBudget(0); b = spendAsk(b, 0); b = spendAsk(b, 0);
  const piano = curiosityPlan(digests, { budget: b, now: 0 });
  assert.equal(piano.allUtente, 0);
  assert.ok(piano.azioni.every((a) => a.a === 'nessuno'));
});

test('quando i dispositivi sono d\'accordo su tutto il piano è vuoto e lo dice bene', () => {
  const digests = ['a', 'b', 'c'].map((id, i) => peer(id, { x: { spesa: 1 - i * 0.01, svago: i * 0.01 } }));
  const piano = curiosityPlan(digests);
  assert.equal(piano.azioni.length, 0);
  assert.match(curiosityText(piano), /d'accordo su tutto/);
});

test('il testo per la persona non contiene gergo da machine learning', () => {
  const digests = [
    peer('a', { s1: sicuro('cripto'), s3: sicuro('casa') }),
    peer('b', { s1: sicuro('cripto'), s3: sicuro('svago') }),
    peer('c', { s1: sicuro('cripto'), s3: sicuro('cripto') }),
    peer('d', { s1: sicuro('spesa'), s3: sicuro('spesa') }),
  ];
  const t = curiosityText(curiosityPlan(digests, { budget: initAskBudget(0), now: 0 }));
  assert.ok(!/entropia|comitato|disaccordo|modello|inferenza|peer|nodo/i.test(t), `gergo nel testo: ${t}`);
  assert.match(t, /non vanno d'accordo/);
});

// ── L'innesto: le sonde sono quelle vere già scambiate dalla mesh ──

test('INNESTO: funziona sui digest veri di federated-distillation, senza cambiare il protocollo', () => {
  // Tre modelli locali diversi che rispondono alle SONDE PUBBLICHE reali.
  const modelli = [
    (t) => ({ [t.length % 2 ? 'spesa' : 'casa']: 0.9, svago: 0.1 }),
    (t) => ({ [t.length % 3 ? 'svago' : 'casa']: 0.8, spesa: 0.2 }),
    (t) => ({ casa: 0.55, spesa: 0.45 }),
  ];
  const digests = modelli.map((m, i) => ({ peerId: `m${i}`, digest: buildDistillationDigest(m) }));
  const piano = curiosityPlan(digests, { budget: initAskBudget(0), now: 0 });

  assert.equal(piano.testimoni.indipendenti, 3, 'tre modelli diversi = tre testimoni');
  assert.ok(piano.azioni.length > 0, 'su sonde pubbliche reali qualche disaccordo deve emergere');
  // Nessuna sonda inventata: tutto ciò di cui si parla è già pubblico.
  for (const a of piano.azioni) assert.ok(PROBE_SET.includes(a.probe), `sonda fuori dall'elenco pubblico: ${a.probe}`);
});
