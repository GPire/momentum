'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateExchangeIdentity, sealFor, openSealed,
  acceptForCarry, bundlesFor, pruneExpired, carryStatus,
  MAX_CARRIED, DEFAULT_TTL_MS,
} from './store-forward.js';

test('il destinatario apre il pacchetto e ritrova il contenuto esatto', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatario = await generateExchangeIdentity();
  const payload = { tipo: 'spesa', importo: 42.5, descrizione: 'Cena' };
  const bundle = await sealFor(destinatario.publicKey, mittente, payload);
  assert.deepEqual(await openSealed(destinatario, bundle), payload);
});

// ── LA PROPRIETÀ CHE REGGE TUTTA L'ARCHITETTURA ──
test('CHI TRASPORTA NON PUÒ LEGGERE: il portatore non apre il pacchetto', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatario = await generateExchangeIdentity();
  const portatore = await generateExchangeIdentity(); // un dispositivo qualsiasi che fa da staffetta

  const bundle = await sealFor(destinatario.publicKey, mittente, { segreto: 'saldo 12.345€' });
  assert.equal(await openSealed(portatore, bundle), null,
    'se il portatore potesse leggere, l\'intera architettura sarebbe inutile');
});

test('il contenuto in chiaro non compare MAI nel pacchetto trasportato', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatario = await generateExchangeIdentity();
  const bundle = await sealFor(destinatario.publicKey, mittente, { iban: 'IT60X0542811101000000123456', importo: 9999 });
  const serializzato = JSON.stringify(bundle);
  assert.ok(!serializzato.includes('IT60X'), 'un IBAN in chiaro nel pacchetto sarebbe una fuga di dati');
  assert.ok(!serializzato.includes('9999'));
});

test('MANOMISSIONE RILEVATA: un portatore che altera un byte non consegna dati falsi', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatario = await generateExchangeIdentity();
  const bundle = await sealFor(destinatario.publicKey, mittente, { importo: 10 });
  // Il portatore prova a cambiare il contenuto cifrato
  const alterato = { ...bundle, ct: bundle.ct.slice(0, -4) + (bundle.ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA') };
  assert.equal(await openSealed(destinatario, alterato), null,
    'meglio nessun dato che un dato alterato: e\' cifratura autenticata, non solo cifratura');
});

test('un pacchetto per un ALTRO destinatario non si apre, e non e\' un errore', async () => {
  const mittente = await generateExchangeIdentity();
  const tizio = await generateExchangeIdentity();
  const caio = await generateExchangeIdentity();
  const bundle = await sealFor(tizio.publicKey, mittente, { x: 1 });
  assert.equal(await openSealed(caio, bundle), null);
});

test('un pacchetto SCADUTO non viene consegnato', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatario = await generateExchangeIdentity();
  const bundle = await sealFor(destinatario.publicKey, mittente, { x: 1 }, { ttlMs: 1000, now: 0 });
  assert.equal(await openSealed(destinatario, bundle, { now: 5000 }), null, 'scaduto da 4 secondi');
  assert.deepEqual(await openSealed(destinatario, bundle, { now: 500 }), { x: 1 }, 'ancora valido');
});

// ── IL SACCO DI CHI TRASPORTA: limiti contro l'abuso ──
test('sacco: non si accettano pacchetti gia\' scaduti', () => {
  const scaduto = { v: 1, to: 'x', ct: 'y', iv: 'z', exp: 100 };
  assert.equal(acceptForCarry([], scaduto, { now: 500 }).length, 0);
});

test('sacco: la capienza e\' LIMITATA — un relay non e\' un deposito gratuito infinito', () => {
  let sacco = [];
  for (let i = 0; i < MAX_CARRIED + 30; i++) {
    sacco = acceptForCarry(sacco, { v: 1, to: 'x', ct: 'c', iv: `iv${i}`, exp: Date.now() + 100000 + i });
  }
  assert.equal(sacco.length, MAX_CARRIED, 'oltre il limite non si accumula: sarebbe una via per riempire il disco altrui');
});

test('sacco: quando e\' pieno si tengono quelli che scadono PIU\' TARDI', () => {
  const base = Date.now() + 60_000;
  let sacco = [];
  for (let i = 0; i < MAX_CARRIED; i++) sacco = acceptForCarry(sacco, { v: 1, to: 'x', ct: 'c', iv: `a${i}`, exp: base + i });
  sacco = acceptForCarry(sacco, { v: 1, to: 'x', ct: 'c', iv: 'nuovo', exp: base + 999_999 });
  assert.ok(sacco.some((b) => b.iv === 'nuovo'), 'un pacchetto con piu\' vita davanti ha piu\' probabilita\' di arrivare');
});

test('sacco: lo stesso pacchetto non si duplica', () => {
  const b = { v: 1, to: 'x', ct: 'c', iv: 'unico', exp: Date.now() + 100000 };
  const sacco = acceptForCarry(acceptForCarry([], b), b);
  assert.equal(sacco.length, 1);
});

test('consegna: si consegna SOLO cio\' che e\' per quel dispositivo', () => {
  const exp = Date.now() + 100000;
  const sacco = [
    { v: 1, to: 'anna', ct: 'c', iv: '1', exp },
    { v: 1, to: 'bruno', ct: 'c', iv: '2', exp },
    { v: 1, to: 'anna', ct: 'c', iv: '3', exp },
  ];
  assert.equal(bundlesFor(sacco, 'anna').length, 2);
  assert.equal(bundlesFor(sacco, 'carla').length, 0);
});

test('igiene: gli scaduti si buttano, il sacco non diventa una discarica', () => {
  const sacco = [{ v: 1, to: 'x', iv: '1', exp: 100 }, { v: 1, to: 'x', iv: '2', exp: 999999 }];
  assert.equal(pruneExpired(sacco, { now: 500 }).length, 1);
});

test('onesta\': lo stato dice che stai portando roba altrui e che non puoi leggerla', () => {
  const s = carryStatus([{ v: 1, to: 'x', iv: '1', exp: Date.now() + 100000 }]);
  assert.equal(s.inTransito, 1);
  assert.match(s.messaggio, /[Nn]on puoi legger/);
  assert.equal(carryStatus([]).messaggio, null, 'niente da dire se non stai portando nulla');
});

test('SCENARIO COMPLETO: A manda a C passando da B, che non ha mai potuto leggere', async () => {
  const A = await generateExchangeIdentity();
  const B = await generateExchangeIdentity(); // la staffetta
  const C = await generateExchangeIdentity(); // offline quando A scrive

  // A sigilla per C e lo affida a B (che incontra A oggi)
  const bundle = await sealFor(C.publicKey, A, { spesa: 'Affitto', importo: 650 });
  let saccoB = acceptForCarry([], bundle);
  assert.equal(saccoB.length, 1);
  assert.equal(await openSealed(B, saccoB[0]), null, 'B trasporta alla cieca');

  // Domani B incontra C e gli consegna cio' che e' suo
  const perC = bundlesFor(saccoB, C.publicKey);
  assert.equal(perC.length, 1);
  assert.deepEqual(await openSealed(C, perC[0]), { spesa: 'Affitto', importo: 650 },
    'il dato arriva a destinazione senza che nessun server sia mai esistito');
});

// ══════════════════════════════════════════════════════════════
// SIMULAZIONI MULTI-DISPOSITIVO: non due, ma N — e con carichi diversi
// ══════════════════════════════════════════════════════════════

test('N DISPOSITIVI: uno manda a 5 destinatari diversi, ognuno apre SOLO il suo', async () => {
  const mittente = await generateExchangeIdentity();
  const destinatari = [];
  for (let i = 0; i < 5; i++) destinatari.push(await generateExchangeIdentity());

  let sacco = [];
  for (let i = 0; i < 5; i++) {
    sacco = acceptForCarry(sacco, await sealFor(destinatari[i].publicKey, mittente, { perChi: i, importo: 100 + i }));
  }
  assert.equal(sacco.length, 5);

  for (let i = 0; i < 5; i++) {
    const suoi = bundlesFor(sacco, destinatari[i].publicKey);
    assert.equal(suoi.length, 1, `il dispositivo ${i} deve ricevere esattamente il suo`);
    assert.deepEqual(await openSealed(destinatari[i], suoi[0]), { perChi: i, importo: 100 + i });
    // e non deve poter aprire quelli degli altri
    for (let j = 0; j < 5; j++) {
      if (i === j) continue;
      assert.equal(await openSealed(destinatari[i], bundlesFor(sacco, destinatari[j].publicKey)[0]), null);
    }
  }
});

test('CATENA LUNGA: 6 staffette in fila, nessuna legge, il dato arriva intatto', async () => {
  const mittente = await generateExchangeIdentity();
  const finale = await generateExchangeIdentity();
  const staffette = [];
  for (let i = 0; i < 6; i++) staffette.push(await generateExchangeIdentity());

  const payload = { spesa: 'Bolletta', importo: 87.4, data: '2026-08-07' };
  let inMano = [await sealFor(finale.publicKey, mittente, payload)];

  // Il pacchetto passa di mano in mano lungo tutta la catena
  for (const s of staffette) {
    const sacco = acceptForCarry([], inMano[0]);
    assert.equal(await openSealed(s, sacco[0]), null, 'nessuna staffetta della catena puo\' leggere');
    inMano = sacco; // lo passa al successivo, identico
  }
  assert.deepEqual(await openSealed(finale, inMano[0]), payload,
    'dopo 6 passaggi di mano il contenuto arriva identico');
});

test('CARICO PESANTE: 200 pacchetti per 20 dispositivi, il sacco resta entro i limiti', async () => {
  const mittente = await generateExchangeIdentity();
  const dispositivi = [];
  for (let i = 0; i < 20; i++) dispositivi.push(await generateExchangeIdentity());

  let sacco = [];
  const exp = Date.now() + 3600_000;
  for (let i = 0; i < 200; i++) {
    sacco = acceptForCarry(sacco, { v: 1, to: dispositivi[i % 20].publicKey, ct: 'c', iv: `iv-${i}`, exp: exp + i });
  }
  assert.equal(sacco.length, MAX_CARRIED, 'sotto carico il limite regge: nessuna crescita illimitata');
  // e la consegna resta corretta per chi c'e' ancora
  const totConsegnabili = dispositivi.reduce((n, d) => n + bundlesFor(sacco, d.publicKey).length, 0);
  assert.equal(totConsegnabili, sacco.length, 'ogni pacchetto in sacco ha un destinatario valido');
});

test('CARICHI DI DIMENSIONE DIVERSA: da poche decine di byte a decine di KB', async () => {
  const mittente = await generateExchangeIdentity();
  const dest = await generateExchangeIdentity();
  for (const n of [1, 50, 500, 1000]) {
    const payload = { righe: Array.from({ length: n }, (_, i) => ({ id: i, d: 'Spesa', a: i * 1.5 })) };
    const bundle = await sealFor(dest.publicKey, mittente, payload);
    const riaperto = await openSealed(dest, bundle);
    assert.equal(riaperto.righe.length, n, `carico da ${n} righe`);
    assert.equal(riaperto.righe[n - 1].a, (n - 1) * 1.5, 'nessuna perdita ai bordi del carico');
  }
});

test('CARICO OLTRE IL MASSIMO: rifiutato con un errore chiaro, non troncato in silenzio', async () => {
  const mittente = await generateExchangeIdentity();
  const dest = await generateExchangeIdentity();
  const enorme = { blob: 'x'.repeat(70 * 1024) };
  await assert.rejects(() => sealFor(dest.publicKey, mittente, enorme), /troppo grande/,
    'troncare un dato finanziario in silenzio sarebbe peggio che rifiutarlo');
});

test('SCENARIO REALE: famiglia con 4 dispositivi che non sono MAI accesi tutti insieme', async () => {
  // Nessun momento in cui padre e figlia sono online insieme. Il tablet di
  // casa fa da staffetta involontaria: incontra l'uno oggi, l'altra domani.
  const padre = await generateExchangeIdentity();
  const figlia = await generateExchangeIdentity();
  const tabletCasa = await generateExchangeIdentity();
  const portatile = await generateExchangeIdentity();

  // Lunedi': il padre affida al tablet una spesa destinata alla figlia
  const spesa = { descrizione: 'Spesa condivisa', importo: 74.2, quota: 37.1 };
  let saccoTablet = acceptForCarry([], await sealFor(figlia.publicKey, padre, spesa));

  // Martedi': il tablet incontra il portatile, che si offre di portarlo avanti
  let saccoPortatile = acceptForCarry([], saccoTablet[0]);
  assert.equal(await openSealed(portatile, saccoPortatile[0]), null, 'il portatile trasporta alla cieca');
  assert.equal(await openSealed(tabletCasa, saccoTablet[0]), null, 'e anche il tablet');

  // Mercoledi': il portatile incontra finalmente la figlia
  const perLei = bundlesFor(saccoPortatile, figlia.publicKey);
  assert.deepEqual(await openSealed(figlia, perLei[0]), spesa,
    'padre e figlia non sono mai stati online insieme, eppure il dato e\' arrivato');
});

test('SCENARIO AVVERSO: una staffetta malevola prova a leggere, alterare e reindirizzare', async () => {
  const mittente = await generateExchangeIdentity();
  const dest = await generateExchangeIdentity();
  const cattiva = await generateExchangeIdentity();
  const bundle = await sealFor(dest.publicKey, mittente, { saldo: 12345 });

  // 1) prova a leggere
  assert.equal(await openSealed(cattiva, bundle), null);
  // 2) prova a intestarselo cambiando il destinatario
  const dirottato = { ...bundle, to: cattiva.publicKey };
  assert.equal(await openSealed(cattiva, dirottato), null, 'cambiare l\'etichetta non da\' la chiave');
  // 3) prova a sostituire il contenuto con uno suo
  const suo = await sealFor(dest.publicKey, cattiva, { saldo: 1 });
  const ibrido = { ...bundle, ct: suo.ct, iv: suo.iv };
  assert.equal(await openSealed(dest, ibrido), null, 'mescolare pezzi di due pacchetti non produce un dato valido');
});
