import test from 'node:test';
import assert from 'node:assert/strict';
import {
  unprotectedValue, daysUntilAtRisk, backupRisk,
  placementQuality, recordPlacement, placeLabel,
} from './backup-health.js';

const NOW = new Date('2026-08-04T12:00:00Z');
const giorniFa = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function statoCon(n, { spalmatiSuGiorni = 30, lastProtectedAt = null } = {}) {
  const tx = Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    date: giorniFa(Math.floor((i / Math.max(n, 1)) * spalmatiSuGiorni)),
    amount: 10,
  }));
  return {
    transactions: { '2026-07': tx },
    ...(lastProtectedAt ? { backupHealth: { lastProtectedAt } } : {}),
  };
}

test('senza nessun movimento non si chiede niente a nessuno', () => {
  const r = backupRisk({ transactions: {} }, { now: NOW });
  assert.equal(r.level, 'ok');
  assert.equal(r.shouldPrompt, false);
});

test('conta solo i movimenti arrivati DOPO l ultima copia', () => {
  const stato = statoCon(20, { spalmatiSuGiorni: 40, lastProtectedAt: giorniFa(20) });
  const v = unprotectedValue(stato, { now: NOW });
  assert.ok(v.txCount > 0 && v.txCount < 20, `attesi alcuni non protetti, non tutti: ${v.txCount}`);
  assert.equal(v.totalTx, 20);
  assert.equal(v.everProtected, true);
});

test('chi non ha mai fatto una copia e ha poco lavoro dentro non viene disturbato', () => {
  const r = backupRisk(statoCon(4), { now: NOW });
  assert.equal(r.shouldPrompt, false);
  assert.match(r.headline, /solo su questo telefono/);
});

test('superata la soglia il promemoria parte, e dice il NUMERO non una frase generica', () => {
  const r = backupRisk(statoCon(22), { now: NOW });
  assert.equal(r.shouldPrompt, true);
  assert.equal(r.level, 'attenzione');
  assert.match(r.headline, /22 movimenti/);
});

test('molto lavoro non protetto diventa urgente', () => {
  const r = backupRisk(statoCon(60), { now: NOW });
  assert.equal(r.level, 'urgente');
  assert.equal(r.shouldPrompt, true);
});

test('previsione: al ritmo osservato dice fra quanti giorni servira la copia', () => {
  // 28 movimenti in 28 giorni = 1 al giorno; nessuno protetto ancora → mancano
  // pochi giorni alla soglia... anzi è già superata: deve dire 0.
  assert.equal(daysUntilAtRisk(statoCon(28, { spalmatiSuGiorni: 28 }), { now: NOW }), 0);
  // Ritmo lento e copia appena fatta: la previsione deve essere un numero > 0.
  const lento = statoCon(14, { spalmatiSuGiorni: 28, lastProtectedAt: giorniFa(0) });
  const d = daysUntilAtRisk(lento, { now: NOW });
  assert.ok(d !== null && d > 0, `attesa una previsione positiva, ricevuto ${d}`);
});

test('nessun ritmo osservato: nessuna previsione inventata', () => {
  const vecchi = { transactions: { '2020-01': [{ id: 'x', date: '2020-01-05T00:00:00Z', amount: 5 }] } };
  assert.equal(daysUntilAtRisk(vecchi, { now: NOW }), null);
});

test('tre pezzi tutti sullo stesso telefono NON sono una protezione', () => {
  let kit = { threshold: 2, total: 3, placements: [] };
  kit = recordPlacement(kit, 1, 'questoDispositivo', { now: NOW });
  kit = recordPlacement(kit, 2, 'questoDispositivo', { now: NOW });
  const q = placementQuality(kit);
  assert.equal(q.ok, false);
  assert.match(q.headline, /troppo vicini|da mettere via/);
});

test('due pezzi in due posti diversi bastano davvero, e l app lo dice', () => {
  let kit = { threshold: 2, total: 3, placements: [] };
  kit = recordPlacement(kit, 1, 'mail', { now: NOW });
  kit = recordPlacement(kit, 2, 'personaFidata', { now: NOW });
  const q = placementQuality(kit);
  assert.equal(q.ok, true);
  assert.equal(q.postiDistinti, 2);
  assert.match(q.headline, /anche se perdi questo telefono/);
  assert.deepEqual(q.mancanti, [3]);
});

test('due pezzi nello STESSO tipo di posto non contano per due', () => {
  let kit = { threshold: 2, total: 3, placements: [] };
  kit = recordPlacement(kit, 1, 'mail', { now: NOW });
  kit = recordPlacement(kit, 2, 'mail', { now: NOW });
  const q = placementQuality(kit);
  assert.equal(q.ok, false);
  assert.equal(q.postiDistinti, 1);
});

test('rimettere lo stesso pezzo altrove aggiorna, non duplica', () => {
  let kit = { threshold: 2, total: 3, placements: [] };
  kit = recordPlacement(kit, 1, 'questoDispositivo', { now: NOW });
  kit = recordPlacement(kit, 1, 'chiavetta', { now: NOW });
  assert.equal(kit.placements.length, 1);
  assert.equal(kit.placements[0].where, 'chiavetta');
});

test('ogni posto ha un nome che si capisce, mai un codice', () => {
  for (const w of ['mail', 'chiavetta', 'personaFidata', 'stampato', 'altroDispositivo']) {
    const l = placeLabel(w);
    assert.ok(l.length > 3 && l === l.toLowerCase().replace(/^./, (c) => c), `etichetta strana: ${l}`);
    assert.ok(!/[A-Z]{2,}|_/.test(l), `gergo nell'etichetta: ${l}`);
  }
});

test('i testi non contengono gergo tecnico', () => {
  const r = backupRisk(statoCon(60), { now: NOW });
  const testo = `${r.headline} ${r.detail}`;
  assert.ok(!/AES|GCM|cifrat|crittograf|passphrase|entropia|Shamir/i.test(testo), testo);
});
