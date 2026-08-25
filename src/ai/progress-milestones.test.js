'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valutaTraguardi, TRAGUARDI, valutaLivelli, LIVELLI } from './progress-milestones.js';

test('senza segnali, nessun traguardo è raggiunto', () => {
  const r = valutaTraguardi({});
  assert.equal(r.raggiunti, 0);
  assert.equal(r.totali, TRAGUARDI.length);
  assert.deepEqual(r.nuovi, []);
  assert.ok(r.tutti.every((t) => t.raggiunto === false));
});

test('prima_categorizzazione: soglia esatta a 5 categorie, non prima', () => {
  assert.equal(valutaTraguardi({ categorieUsate: 4 }).tutti.find((t) => t.id === 'prima_categorizzazione').raggiunto, false);
  assert.equal(valutaTraguardi({ categorieUsate: 5 }).tutti.find((t) => t.id === 'prima_categorizzazione').raggiunto, true);
});

test('pattern_settimanale richiede ENTRAMBI transazioni e giorni di storico, non uno solo', () => {
  assert.equal(valutaTraguardi({ transazioni: 100, giorniStorico: 2 }).tutti.find((t) => t.id === 'pattern_settimanale').raggiunto, false, 'tante transazioni ma pochi giorni non basta');
  assert.equal(valutaTraguardi({ transazioni: 10, giorniStorico: 30 }).tutti.find((t) => t.id === 'pattern_settimanale').raggiunto, false, 'tanti giorni ma poche transazioni non basta');
  assert.equal(valutaTraguardi({ transazioni: 50, giorniStorico: 7 }).tutti.find((t) => t.id === 'pattern_settimanale').raggiunto, true);
});

test('un traguardo raggiunto resta in `tutti` anche se già in giaMostrati (non sparisce mai)', () => {
  const r = valutaTraguardi({ categorieUsate: 5 }, ['prima_categorizzazione']);
  assert.equal(r.tutti.find((t) => t.id === 'prima_categorizzazione').raggiunto, true);
  assert.deepEqual(r.nuovi, [], 'già notificato in passato: non è più "nuovo"');
});

test('`nuovi` contiene solo i traguardi appena raggiunti, non quelli già mostrati', () => {
  const r = valutaTraguardi({ categorieUsate: 5, sentimentCalcolati: 1 }, ['prima_categorizzazione']);
  assert.deepEqual(r.nuovi, ['sentiment_locale']);
});

test('sottotesto legge i numeri reali passati, non un testo statico', () => {
  const r = valutaTraguardi({ categorieUsate: 7 });
  assert.match(r.tutti.find((t) => t.id === 'prima_categorizzazione').sottotesto, /7 categorie/);
});

test('mai un\'eccezione con segnali parziali o assenti (stato reale di un utente nuovo)', () => {
  assert.doesNotThrow(() => valutaTraguardi(undefined));
  assert.doesNotThrow(() => valutaTraguardi({}, undefined));
});

test('ogni traguardo ha un id univoco e un testo non vuoto', () => {
  const ids = TRAGUARDI.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TRAGUARDI) assert.ok(t.testo && t.testo.length > 0);
});

test('raggiunti/totali sono coerenti con `tutti`', () => {
  const r = valutaTraguardi({ categorieUsate: 5, transazioni: 50, giorniStorico: 7, legamiCausali: 1 });
  assert.equal(r.raggiunti, r.tutti.filter((t) => t.raggiunto).length);
  assert.equal(r.totali, r.tutti.length);
});

// ── Livelli ──

test('ogni traguardo appartiene a esattamente un livello, nessuno escluso o duplicato', () => {
  const idsNeiLivelli = LIVELLI.flatMap((l) => l.ids);
  assert.equal(idsNeiLivelli.length, TRAGUARDI.length);
  assert.equal(new Set(idsNeiLivelli).size, TRAGUARDI.length);
  for (const t of TRAGUARDI) assert.ok(idsNeiLivelli.includes(t.id), `${t.id} non è in nessun livello`);
});

test('senza segnali, livello corrente è 1 e nessun livello è completo', () => {
  const r = valutaLivelli({});
  assert.equal(r.livelloCorrente, 1);
  assert.equal(r.tuttoCompleto, false);
  assert.ok(r.livelli.every((l) => !l.completo));
});

test('un livello si completa SOLO quando entrambi i suoi traguardi sono raggiunti, non uno solo', () => {
  const soloUno = valutaLivelli({ categorieUsate: 5 }); // solo prima_categorizzazione, non sentiment_locale
  assert.equal(soloUno.livelli[0].completo, false);
  assert.equal(soloUno.livelli[0].raggiunti, 1);
  const entrambi = valutaLivelli({ categorieUsate: 5, sentimentCalcolati: 1 });
  assert.equal(entrambi.livelli[0].completo, true);
  assert.equal(entrambi.livelloCorrente, 2, 'con livello 1 completo, il corrente passa al 2');
});

test('livelloCompletatoOra è valorizzato solo nel preciso controllo in cui il livello si completa, mai dopo', () => {
  const primaVolta = valutaLivelli({ categorieUsate: 5, sentimentCalcolati: 1 }, []);
  assert.equal(primaVolta.livelloCompletatoOra, 1);
  assert.equal(primaVolta.nomeLivelloCompletatoOra, 'Le basi');
  // Stesso stato, ma i traguardi erano già stati mostrati in passato: non è più "ora".
  const dopo = valutaLivelli({ categorieUsate: 5, sentimentCalcolati: 1 }, ['prima_categorizzazione', 'sentiment_locale']);
  assert.equal(dopo.livelloCompletatoOra, null);
});

test('con tutti gli 8 traguardi raggiunti, tuttoCompleto è true e livelloCorrente supera l\'ultimo livello', () => {
  const tutto = { categorieUsate: 5, transazioni: 50, giorniStorico: 7, legamiCausali: 1, sentimentCalcolati: 1, sentimentRicevutiViaMesh: 1, percentileSettoreVisto: true, gruppiCondivisi: 1, chatSpesaUsata: true };
  const r = valutaLivelli(tutto);
  assert.equal(r.tuttoCompleto, true);
  assert.equal(r.livelloCorrente, r.totaleLivelli + 1);
  assert.ok(r.livelli.every((l) => l.completo));
});
