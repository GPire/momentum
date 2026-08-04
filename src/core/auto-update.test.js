import test from 'node:test';
import assert from 'node:assert/strict';
import { runUpdateCycle, cycleSummary, taxRulesSource, fatturaPaFormatSource } from './auto-update.js';

const NOW = new Date('2026-08-05T12:00:00Z').getTime();
const giorniFa = (n) => new Date(NOW - n * 86_400_000).toISOString();

function fonte(id, { checkFn, generatedAt = giorniFa(200), maxAgeDays = 90, priority = 0.5, dueInDays = null } = {}) {
  return { id, label: id, checkFn, generatedAt, maxAgeDays, priority, dueInDays };
}

// ── Scenario 1: utente che non apre l'app per mesi, torna, trova regole nuove ──
test('SCENARIO — utente assente per mesi: al primo controllo trova e adotta regole nuove', async () => {
  const applicate = [];
  const sources = [fonte('fisco', {
    checkFn: async () => ({ updated: true, version: '2026-09', rules: { aliquota: 0.15 } }),
  })];
  const r = await runUpdateCycle(sources, { now: NOW, onUpdated: async (id, esito) => applicate.push({ id, ...esito }) });
  assert.equal(r.risultati[0].esito, 'aggiornato');
  assert.equal(applicate.length, 1);
  assert.equal(applicate[0].version, '2026-09');
});

// ── Scenario 2: dati già a posto, nessuna azione inutile ──
test('SCENARIO — dati già aggiornati: nessuna scrittura, nessun allarme', async () => {
  let scritture = 0;
  const sources = [fonte('fisco', { checkFn: async () => ({ updated: false, reason: 'regole già aggiornate' }) })];
  const r = await runUpdateCycle(sources, { now: NOW, onUpdated: async () => { scritture++; } });
  assert.equal(r.risultati[0].esito, 'gia-aggiornato');
  assert.equal(scritture, 0);
});

// ── Scenario 3: rete assente (utente offline, aereo, zona senza campo) ──
test('SCENARIO — offline: il fallimento è dichiarato, mai un crash, backoff programmato', async () => {
  const sources = [fonte('fisco', { checkFn: async () => { throw new Error('rete non disponibile'); } })];
  const r = await runUpdateCycle(sources, { now: NOW });
  assert.equal(r.risultati[0].esito, 'fallito');
  assert.match(r.risultati[0].motivo, /rete non disponibile/);
  assert.ok(r.backoffState.fisco.riprovaDa > NOW, 'deve programmare un riprovo più avanti');
});

// ── Scenario 4: un payload contraffatto (attacco/errore server) viene RIFIUTATO ──
// Simula ciò che fetchRulesUpdate farebbe con un payload che fallisce
// validateRulesPayload: updated:false con motivo esplicito "anti-veleno".
test('SCENARIO — payload non valido (anti-veleno): rifiutato, mai adottato', async () => {
  const applicate = [];
  const sources = [fonte('fisco', {
    checkFn: async () => ({ updated: false, reason: 'dati NON adottati (anti-veleno): aliquota fuori range plausibile' }),
  })];
  const r = await runUpdateCycle(sources, { now: NOW, onUpdated: async (id, e) => applicate.push(e) });
  assert.equal(r.risultati[0].esito, 'gia-aggiornato'); // non è un "fallito" di rete: è un rifiuto di merito
  assert.match(r.risultati[0].motivo, /anti-veleno/);
  assert.equal(applicate.length, 0, 'un payload contraffatto non deve mai essere applicato');
});

// ── Scenario 5: dispositivo appena in carica dopo giorni, molte fonti vecchie insieme ──
test('SCENARIO — molte fonti vecchie insieme: il budget ne limita quante si controllano, per priorità', async () => {
  let chiamate = 0;
  const sources = Array.from({ length: 8 }, (_, i) => fonte(`f${i}`, {
    generatedAt: giorniFa(100 + i * 10), priority: 0.5,
    checkFn: async () => { chiamate++; return { updated: false, reason: 'già a posto' }; },
  }));
  const r = await runUpdateCycle(sources, { now: NOW, budget: 3 });
  assert.equal(chiamate, 3, 'con budget 3 non si devono chiamare più di 3 fonti');
  assert.equal(r.risultati.length, 3);
});

// ── Scenario 6: una fonte già in backoff non viene ricontrollata subito ──
test('SCENARIO — una fonte appena fallita non viene ripresa prima del suo turno di backoff', async () => {
  let chiamate = 0;
  const sources = [fonte('fisco', { checkFn: async () => { chiamate++; return { updated: false }; } })];
  const backoffState = { fisco: { tentativi: 2, riprovaDa: NOW + 3600_000 } }; // riprova tra un'ora
  const r = await runUpdateCycle(sources, { now: NOW, backoffState });
  assert.equal(chiamate, 0, 'non deve chiamare una fonte ancora in attesa');
  assert.equal(r.risultati[0].esito, 'in-attesa');
});

test('SCENARIO — passato il tempo di backoff, la fonte torna ad essere controllata', async () => {
  let chiamate = 0;
  const sources = [fonte('fisco', { checkFn: async () => { chiamate++; return { updated: false, reason: 'ok' }; } })];
  const backoffState = { fisco: { tentativi: 2, riprovaDa: NOW - 1000 } }; // già scaduto
  const r = await runUpdateCycle(sources, { now: NOW, backoffState });
  assert.equal(chiamate, 1);
  assert.equal(r.risultati[0].esito, 'gia-aggiornato');
  assert.ok(!('fisco' in r.backoffState), 'un controllo riuscito deve azzerare il backoff');
});

// ── Scenario 7: fonti miste — una si aggiorna, una fallisce, una è già ok ──
test('SCENARIO — mix realistico: il referto distingue ogni fonte, nessuna nasconde le altre', async () => {
  const sources = [
    fonte('fisco', { checkFn: async () => ({ updated: true, version: '2026-09' }) }),
    fonte('xml', { checkFn: async () => { throw new Error('timeout'); } }),
    fonte('mercato', { checkFn: async () => ({ updated: false, reason: 'già aggiornato' }) }),
  ];
  const r = await runUpdateCycle(sources, { now: NOW, budget: 5 });
  const esiti = Object.fromEntries(r.risultati.map((x) => [x.id, x.esito]));
  assert.deepEqual(esiti, { fisco: 'aggiornato', xml: 'fallito', mercato: 'gia-aggiornato' });
});

// ── Scenario 8: nessuna fonte configurata (sviluppo/test) ──
test('SCENARIO — nessuna fonte: nessun crash, referto vuoto e onesto', async () => {
  const r = await runUpdateCycle([], { now: NOW });
  assert.deepEqual(r.risultati, []);
  assert.match(cycleSummary(r), /Nessun controllo/);
});

// ── Scenario 9: una fonte dichiarata ma senza checkFn (mal configurata) ──
test('SCENARIO — fonte senza funzione di controllo collegata: segnalato, non un crash', async () => {
  const r = await runUpdateCycle([fonte('rotta', { checkFn: undefined })], { now: NOW });
  assert.equal(r.risultati[0].esito, 'non-verificabile');
});

// ── Riassunto leggibile ──
test('cycleSummary distingue aggiornati, falliti e già a posto in una frase sola', async () => {
  const sources = [
    fonte('a', { checkFn: async () => ({ updated: true, version: 'v2' }) }),
    fonte('b', { checkFn: async () => { throw new Error('no'); } }),
    fonte('c', { checkFn: async () => ({ updated: false }) }),
  ];
  const r = await runUpdateCycle(sources, { now: NOW, budget: 5 });
  const s = cycleSummary(r);
  assert.match(s, /1 aggiornato/);
  assert.match(s, /1 non raggiungibile/);
  assert.match(s, /1 già a posto/);
});

// ── Integrazione con gli adattatori reali (tax-rules.js / fatturapa-format.js) ──
// Usa un fetchImpl finto (nessuna vera richiesta di rete) MA passa dal path
// VERO di fetchRulesUpdate — verifica che l'adattatore sia collegato bene al
// contratto reale, non a un'invenzione.
// Forma REALE del payload (verificata su validateRulesPayload in
// tax-rules.js, non indovinata): `rules` è keyed per ANNO a 4 cifre, e i
// campi sono forfettarioCeiling/impostaStd/impostaStartup/inpsGestioneSeparata.
test('INTEGRAZIONE — taxRulesSource chiama davvero fetchRulesUpdate con un payload valido', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      version: '2099-01', // futuro: sicuramente "più recente" di qualunque versione inclusa
      rules: { 2027: { forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.26 } },
    }),
  });
  const src = taxRulesSource({ url: 'https://esempio.test/rules.json', fetchImpl, currentVersion: '2020-01' });
  const esito = await src.checkFn();
  assert.equal(esito.updated, true, JSON.stringify(esito));
  assert.equal(esito.version, '2099-01');
});

test('INTEGRAZIONE — taxRulesSource con un payload FALSO (aliquota assurda) viene rifiutato dal validatore reale', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ version: '2099-01', rules: { 2027: { forfettarioCeiling: 85000, impostaStd: 5, impostaStartup: 0.05, inpsGestioneSeparata: 0.26 } } }), // impostaStd=5 = 500%, assurdo
  });
  const src = taxRulesSource({ url: 'https://esempio.test/rules.json', fetchImpl, currentVersion: '2020-01' });
  const esito = await src.checkFn();
  assert.equal(esito.updated, false);
  assert.match(esito.reason, /anti-veleno|NON adottat|implausibile/);
});

test('INTEGRAZIONE — fatturaPaFormatSource senza URL configurato non fa nulla (mai un dato inventato)', async () => {
  const src = fatturaPaFormatSource({ url: null, fetchImpl: async () => ({}) });
  const esito = await src.checkFn();
  assert.equal(esito.updated, false);
  assert.match(esito.reason, /nessuna fonte/);
});

// ── Ciclo end-to-end con gli adattatori reali dentro runUpdateCycle ──
test('SCENARIO END-TO-END — ciclo autonomo su due fonti reali, una si aggiorna una no', async () => {
  const fetchRules = async () => ({
    ok: true,
    json: async () => ({ version: '2099-01', rules: { 2027: { forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.26 } } }),
  });
  const fetchFormat = async () => ({ ok: false, status: 503 }); // fonte temporaneamente giù, non un attacco

  const sources = [
    taxRulesSource({ url: 'https://x/rules.json', fetchImpl: fetchRules, currentVersion: '2020-01', generatedAt: giorniFa(200) }),
    fatturaPaFormatSource({ url: 'https://x/format.json', fetchImpl: fetchFormat, currentVersion: '2020-01', generatedAt: giorniFa(400) }),
  ];
  const applicate = [];
  const r = await runUpdateCycle(sources, { now: NOW, budget: 5, onUpdated: async (id, e) => applicate.push({ id, ...e }) });
  const esiti = Object.fromEntries(r.risultati.map((x) => [x.id, x.esito]));
  assert.equal(esiti['tax-rules'], 'aggiornato');
  assert.equal(esiti['fatturapa-format'], 'gia-aggiornato'); // 503 -> updated:false con motivo, non un'eccezione
  assert.equal(applicate.length, 1);
  assert.equal(applicate[0].id, 'tax-rules');
});
