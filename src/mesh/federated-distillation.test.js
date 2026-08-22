import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROBE_SET, PROBE_VERSION,
  buildDistillationDigest, mergeDistillationDigests, previewOutgoing, roundContributions,
  initPrivacyBudget, budgetStatus, spendBudget,
  initLexiconPool, observeLexicon, eligibleLexicon, heldBackLexicon,
  buildLexiconDigest, mergeLexiconDigests, originTag, DEFAULT_K_ANONYMITY,
} from './federated-distillation.js';

// Un "modello" finto: classifica per parola chiave. Serve solo a produrre
// distribuzioni realistiche senza tirare dentro l'orchestratore vero.
const modello = (mappa, rumore = 0) => (testo) => {
  const cat = mappa[testo];
  if (!cat) return null;
  return rumore
    ? { [cat]: 1 - rumore, Altro: rumore }
    : { [cat]: 1 };
};

const MAPPA_SANA = { panetteria: 'Alimentari', farmacia: 'Salute', ristorante: 'Ristoranti', benzina: 'Trasporti' };

// ── Livello A: distillazione ──

test('il digest contiene SOLO risposte su sonde pubbliche, mai dati dell utente', () => {
  const d = buildDistillationDigest(modello(MAPPA_SANA));
  assert.equal(d.kind, 'distillation');
  assert.equal(d.probeVersion, PROBE_VERSION);
  for (const probe of Object.keys(d.answers)) {
    assert.ok(PROBE_SET.includes(probe), `"${probe}" non è una sonda pubblica`);
  }
  const serializzato = JSON.stringify(d);
  assert.ok(!/\d{2}[/,.]\d{2}/.test(serializzato), 'nessuna data deve comparire');
  assert.ok(!/€|EUR/.test(serializzato), 'nessun importo deve comparire');
});

test('le probabilità di ogni sonda sommano a 1 dopo il filtro', () => {
  const d = buildDistillationDigest((t) => (t === 'panetteria' ? { Alimentari: 0.6, Salute: 0.05, Altro: 0.35 } : null));
  const somma = Object.values(d.answers.panetteria).reduce((s, p) => s + p, 0);
  assert.ok(Math.abs(somma - 1) < 0.02, `somma ${somma}`);
  assert.ok(!('Salute' in d.answers.panetteria), 'le code trascurabili vanno tagliate');
});

test('un predittore che esplode non fa fallire il digest: quella sonda viene saltata', () => {
  const d = buildDistillationDigest((t) => {
    if (t === 'farmacia') throw new Error('modello rotto');
    return t === 'panetteria' ? { Alimentari: 1 } : null;
  });
  assert.ok('panetteria' in d.answers);
  assert.ok(!('farmacia' in d.answers));
});

test('l anteprima mostra le righe VERE che uscirebbero, e dichiara cosa non contengono', () => {
  const d = buildDistillationDigest(modello(MAPPA_SANA));
  const p = previewOutgoing(d);
  assert.ok(p.righe.length > 0);
  assert.match(p.righe[0], /→/);
  assert.equal(p.contieneImporti, false);
  assert.equal(p.contieneDate, false);
  assert.equal(p.contieneNomiTuoi, false);
});

test('la fusione richiede almeno due fonti: un parere solo non diventa consenso', () => {
  const solo = buildDistillationDigest(modello(MAPPA_SANA));
  const m = mergeDistillationDigests(solo, [], { minPeers: 2 });
  assert.deepEqual(m.answers, {}, 'con una fonte sola non deve uscire nessun consenso');
  assert.ok(m.stats.probeIgnorate > 0);
});

test('con più peer concordi il consenso si forma', () => {
  const locale = buildDistillationDigest(modello(MAPPA_SANA));
  const peers = ['p1', 'p2'].map((peerId) => ({ peerId, digest: buildDistillationDigest(modello(MAPPA_SANA)) }));
  const m = mergeDistillationDigests(locale, peers, { minPeers: 2 });
  assert.equal(m.answers.panetteria.Alimentari, 1);
  assert.equal(m.stats.peerAccettati, 2);
});

// IL test anti-avvelenamento: la mediana deve reggere anche con parecchi
// malintenzionati, dove la media sarebbe già stata spostata.
test('AVVELENAMENTO: peer malevoli non spostano la mediana finché sono minoranza', () => {
  const buoni = Array.from({ length: 5 }, (_, i) => ({
    peerId: `buono${i}`, digest: buildDistillationDigest(modello(MAPPA_SANA)),
  }));
  const cattivi = Array.from({ length: 4 }, (_, i) => ({
    peerId: `cattivo${i}`,
    digest: buildDistillationDigest(modello({ farmacia: 'Intrattenimento', panetteria: 'Intrattenimento' })),
  }));
  const m = mergeDistillationDigests(null, [...buoni, ...cattivi], { minPeers: 2 });
  const farmacia = m.answers.farmacia || {};
  const vincitore = Object.entries(farmacia).sort((a, b) => b[1] - a[1])[0];
  assert.equal(vincitore[0], 'Salute', `la categoria vincente doveva restare Salute, invece: ${JSON.stringify(farmacia)}`);
});

test('un peer a reputazione zero non vota affatto', () => {
  const buono = { peerId: 'buono', digest: buildDistillationDigest(modello(MAPPA_SANA)) };
  const bandito = { peerId: 'bandito', digest: buildDistillationDigest(modello({ farmacia: 'Intrattenimento' })) };
  const reputationWeightFn = (_l, peerId) => (peerId === 'bandito' ? 0 : 1);
  const m = mergeDistillationDigests(null, [buono, bandito], { reputationWeightFn, minPeers: 1 });
  assert.equal(m.stats.peerAccettati, 1);
  assert.ok(!('Intrattenimento' in (m.answers.farmacia || {})));
});

test('digest di una versione diversa delle sonde vengono scartati, non fusi a forza', () => {
  const vecchio = { peerId: 'vecchio', digest: { kind: 'distillation', probeVersion: 99, answers: { panetteria: { Altro: 1 } } } };
  const nuovo = { peerId: 'nuovo', digest: buildDistillationDigest(modello(MAPPA_SANA)) };
  const m = mergeDistillationDigests(null, [vecchio, nuovo], { minPeers: 1 });
  assert.equal(m.stats.scartatePerVersione, 1);
  assert.ok(!('Altro' in (m.answers.panetteria || {})));
});

// ── Il segnale per contribution-drift.js (CUSUM sulla persistenza) ──

test('roundContributions: un peer concorde col locale su tutte le sonde comuni ottiene ~1', () => {
  const locale = buildDistillationDigest(modello(MAPPA_SANA));
  const stesso = { peerId: 'gemello', digest: buildDistillationDigest(modello(MAPPA_SANA)) };
  const c = roundContributions(locale, [stesso]);
  assert.ok(c.gemello > 0.99, `atteso ~1, avuto ${c.gemello}`);
});

test('roundContributions: un peer che discorda su tutto ottiene ~0', () => {
  const locale = buildDistillationDigest(modello(MAPPA_SANA));
  const mappaOpposta = { panetteria: 'Trasporti', farmacia: 'Alimentari', ristorante: 'Salute', benzina: 'Ristoranti' };
  const discorde = { peerId: 'discorde', digest: buildDistillationDigest(modello(mappaOpposta)) };
  const c = roundContributions(locale, [discorde]);
  assert.ok(c.discorde < 0.01, `atteso ~0, avuto ${c.discorde}`);
});

test('roundContributions: meno di 3 sonde in comune non produce un giudizio (troppo poco per un confronto)', () => {
  const mappaMinima = { panetteria: 'Alimentari' };
  const locale = buildDistillationDigest(modello(mappaMinima));
  const peer = { peerId: 'p', digest: buildDistillationDigest(modello(mappaMinima)) };
  const c = roundContributions(locale, [peer]);
  assert.equal(c.p, undefined);
});

test('roundContributions: digest di versione diversa vengono ignorati, non producono un falso 0', () => {
  const locale = buildDistillationDigest(modello(MAPPA_SANA));
  const vecchio = { peerId: 'vecchio', digest: { kind: 'distillation', probeVersion: 99, answers: { panetteria: { Alimentari: 1 } } } };
  const c = roundContributions(locale, [vecchio]);
  assert.equal(c.vecchio, undefined);
});

test('roundContributions: senza digest locale non produce contributi (nessun riferimento per confrontare)', () => {
  const peer = { peerId: 'p', digest: buildDistillationDigest(modello(MAPPA_SANA)) };
  const c = roundContributions(null, [peer]);
  assert.deepEqual(c, {});
});

// ── Budget di privacy ──

test('il budget si consuma e blocca i contributi quando finisce', () => {
  let b = initPrivacyBudget(0, { perPeriod: 2, periodMs: 1000 });
  assert.equal(budgetStatus(b, 0).rimasti, 2);
  ({ budget: b } = spendBudget(b, 0));
  ({ budget: b } = spendBudget(b, 0));
  assert.equal(budgetStatus(b, 0).puoContribuire, false);
  const terzo = spendBudget(b, 0);
  assert.equal(terzo.ok, false, 'oltre il budget il rilascio deve essere rifiutato');
});

test('il budget si rinnova al periodo successivo', () => {
  let b = initPrivacyBudget(0, { perPeriod: 1, periodMs: 1000 });
  ({ budget: b } = spendBudget(b, 0));
  assert.equal(budgetStatus(b, 500).puoContribuire, false);
  assert.equal(budgetStatus(b, 1500).puoContribuire, true, 'passato il periodo deve rinnovarsi');
  const dopo = spendBudget(b, 1500);
  assert.equal(dopo.ok, true);
  assert.equal(dopo.budget.spent, 1);
});

// ── Livello B: lessico con soglia k-anonima ──

test('un token visto da un solo dispositivo NON esce mai', () => {
  let pool = initLexiconPool();
  pool = observeLexicon(pool, { token: 'Panificio Da Gino', category: 'Alimentari', deviceId: 'dev-1' });
  assert.deepEqual(eligibleLexicon(pool), []);
  assert.equal(buildLexiconDigest(pool).entries.length, 0);
  const trattenuti = heldBackLexicon(pool);
  assert.equal(trattenuti.length, 1);
  assert.equal(trattenuti[0].mancano, DEFAULT_K_ANONYMITY - 1);
});

test('lo stesso dispositivo che osserva mille volte conta comunque UNO', () => {
  let pool = initLexiconPool();
  for (let i = 0; i < 1000; i++) {
    pool = observeLexicon(pool, { token: 'bar sport', category: 'Ristoranti', deviceId: 'dev-1' });
  }
  assert.deepEqual(eligibleLexicon(pool), [], 'un dispositivo solo non può auto-autorizzarsi');
});

test('raggiunta la soglia di dispositivi indipendenti, il token diventa condivisibile', () => {
  let pool = initLexiconPool();
  for (const dev of ['dev-1', 'dev-2', 'dev-3']) {
    pool = observeLexicon(pool, { token: 'bar sport', category: 'Ristoranti', deviceId: dev });
  }
  const ok = eligibleLexicon(pool);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].token, 'bar sport');
  assert.equal(ok[0].fonti, 3);
});

test('il pacchetto in uscita non contiene i tag di origine: servivano solo a contare', () => {
  let pool = initLexiconPool();
  for (const dev of ['a', 'b', 'c']) pool = observeLexicon(pool, { token: 'x', category: 'C', deviceId: dev });
  const d = buildLexiconDigest(pool);
  assert.deepEqual(Object.keys(d.entries[0]).sort(), ['category', 'token']);
  assert.ok(!JSON.stringify(d).includes('origins'));
});

test('il tag di origine è deterministico per dispositivo ma diverso tra dispositivi', () => {
  assert.equal(originTag('dev-1', 'tok'), originTag('dev-1', 'tok'));
  assert.notEqual(originTag('dev-1', 'tok'), originTag('dev-2', 'tok'));
  assert.notEqual(originTag('dev-1', 'tok'), originTag('dev-1', 'altro'));
});

test('la fusione lessicale usa il voto di peer DISTINTI, non i conteggi', () => {
  const digest = (entries) => ({ kind: 'lexicon', version: 1, entries });
  const r = mergeLexiconDigests([
    { peerId: 'p1', digest: digest([{ token: 'gino', category: 'Alimentari' }]) },
    { peerId: 'p2', digest: digest([{ token: 'gino', category: 'Alimentari' }]) },
    { peerId: 'p3', digest: digest([{ token: 'gino', category: 'Salute' }]) },
  ], { minVoti: 2 });
  assert.equal(r.accettati.length, 1);
  assert.equal(r.accettati[0].category, 'Alimentari');
  assert.equal(r.accettati[0].voti, 2);
});

test('in caso di PARITÀ non si sceglie: decide il modello locale, che ne sa di più', () => {
  const digest = (entries) => ({ kind: 'lexicon', version: 1, entries });
  const r = mergeLexiconDigests([
    { peerId: 'p1', digest: digest([{ token: 'ambiguo', category: 'A' }]) },
    { peerId: 'p2', digest: digest([{ token: 'ambiguo', category: 'A' }]) },
    { peerId: 'p3', digest: digest([{ token: 'ambiguo', category: 'B' }]) },
    { peerId: 'p4', digest: digest([{ token: 'ambiguo', category: 'B' }]) },
  ], { minVoti: 2 });
  assert.deepEqual(r.accettati, []);
  assert.equal(r.inParita.length, 1);
  assert.deepEqual(r.inParita[0].opzioni.sort(), ['A', 'B']);
});

test('un pacchetto di tipo sbagliato viene ignorato senza far crollare la fusione', () => {
  const r = mergeLexiconDigests([
    { peerId: 'p1', digest: { kind: 'distillation', answers: {} } },
    { peerId: 'p2', digest: null },
  ]);
  assert.deepEqual(r.accettati, []);
});

// Simulazione d'insieme: 200 dispositivi sparsi, di cui una parte malevola,
// per verificare che il sistema regga alla scala che il piano promette.
test('SIMULAZIONE: 200 dispositivi, 30 malevoli — il consenso resta corretto', () => {
  const buoni = Array.from({ length: 170 }, (_, i) => ({
    peerId: `b${i}`, digest: buildDistillationDigest(modello(MAPPA_SANA, 0.1)),
  }));
  const cattivi = Array.from({ length: 30 }, (_, i) => ({
    peerId: `m${i}`,
    digest: buildDistillationDigest(modello({ farmacia: 'Intrattenimento', panetteria: 'Intrattenimento', ristorante: 'Intrattenimento' })),
  }));
  const m = mergeDistillationDigests(null, [...buoni, ...cattivi], { minPeers: 5 });
  for (const [probe, attesa] of Object.entries(MAPPA_SANA)) {
    const dist = m.answers[probe];
    if (!dist) continue;
    const vincitore = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
    assert.equal(vincitore, attesa, `${probe}: atteso ${attesa}, ottenuto ${vincitore}`);
  }
  assert.equal(m.stats.peerAccettati, 200);
});
