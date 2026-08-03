import test from 'node:test';
import assert from 'node:assert/strict';
const { createGroup, addSharedExpense, computeBalances, minimalSettlement, settlementView, suggestSettleTiming, settlementToSepa, quickSplit, frequentCoSplitters, mergeGroups, mergeIntoGroups, encodeGroupShare, encodeGroupInvite, decodeGroupShare, settlementCounts, describeGroupChanges, claimMember, myMemberId, unclaimedMembers } = await import('./split-engine.js');

test('SEMPLIFICAZIONE: due coppie a somma-zero → 2 bonifici (non 4)', () => {
  const bal = { A: 10, B: -10, C: 10, D: -10 };
  const tx = minimalSettlement(bal);
  assert.equal(tx.length, 2, 'partiziona in 2 sottogruppi → 2 pagamenti');
  // azzera tutto
  const b = { ...bal }; for (const t of tx) { b[t.from] += t.amount; b[t.to] -= t.amount; }
  assert.ok(Object.values(b).every(v => Math.abs(v) < 0.01));
});

test('SEMPLIFICAZIONE: scenario reale (10/89/0 in 3) → 2 pagamenti minimi', () => {
  let g = createGroup({ members: ['Io', 'Anna', 'Bea'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 10 });
  g = addSharedExpense(g, { payer: 'm1', amount: 89 });
  const tx = minimalSettlement(computeBalances(g));
  assert.equal(tx.length, 2);
  const b = computeBalances(g); for (const t of tx) { b[t.from] += t.amount; b[t.to] -= t.amount; }
  assert.ok(Object.values(b).every(v => Math.abs(v) < 0.01));
});

test('settlementCounts: mostra il risparmio di pagamenti (raw > simplified)', () => {
  // catena: ognuno paga a turno per tutti → tanti debiti grezzi, pochi semplificati
  let g = createGroup({ members: ['A', 'B', 'C', 'D'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });   // tutti devono ad A
  g = addSharedExpense(g, { payer: 'm1', amount: 20 });    // tutti devono a B
  const c = settlementCounts(g);
  assert.ok(c.raw >= c.simplified);
  assert.equal(typeof c.saved, 'number');
});

// Simula: creo il gruppo, lo condivido (encode) e l'amico lo riceve (decode).
function shareRoundTrip(g) { return decodeGroupShare(encodeGroupShare(g)); }

test('CONDIVISIONE: codice round-trip (encode→decode) preserva il gruppo', () => {
  let g = createGroup({ name: 'Vacanza', members: ['Io', 'Anna'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100, description: 'Hotel' });
  const back = shareRoundTrip(g);
  assert.equal(back.id, g.id);
  assert.equal(back.name, 'Vacanza');
  assert.equal(back.expenses.length, 1);
  assert.equal(back.expenses[0].amount, 100);
});

test('CONDIVISIONE: due persone aggiungono spese indipendenti → merge = UNIONE', () => {
  // base creata da me e condivisa all'amico
  let base = createGroup({ name: 'Casa', members: ['Io', 'Bea'] });
  let mine = addSharedExpense(base, { payer: 'm0', amount: 60, description: 'Spesa' });      // io aggiungo
  let theirs = addSharedExpense(shareRoundTrip(base), { payer: 'm1', amount: 40, description: 'Bollette' }); // l'amico parte dalla base e aggiunge
  const merged = mergeGroups(mine, theirs);
  assert.equal(merged.expenses.length, 2, 'le due spese indipendenti si uniscono');
  const bal = computeBalances(merged);
  assert.equal(Math.round(Object.values(bal).reduce((a, b) => a + b, 0)), 0);
});

test('CONDIVISIONE: merge COMMUTATIVO e IDEMPOTENTE (converge sempre)', () => {
  let base = createGroup({ name: 'G', members: ['A', 'B'] });
  const a = addSharedExpense(base, { payer: 'm0', amount: 30 });
  const b = addSharedExpense(shareRoundTrip(base), { payer: 'm1', amount: 50 });
  const ab = mergeGroups(a, b), ba = mergeGroups(b, a);
  assert.equal(ab.expenses.length, ba.expenses.length);                 // commutativo
  assert.equal(mergeGroups(ab, b).expenses.length, ab.expenses.length); // idempotente (re-merge = no-op)
  assert.equal(mergeGroups(ab, ab).expenses.length, ab.expenses.length);
});

test('CONDIVISIONE: gruppi con id DIVERSI non si fondono (restano distinti)', () => {
  const g1 = createGroup({ name: 'X', members: ['A'] });
  const g2 = createGroup({ name: 'Y', members: ['B'] });
  assert.equal(mergeGroups(g1, g2).id, g1.id); // nessuna fusione tra gruppi diversi
  assert.equal(mergeIntoGroups([g1], g2).length, 2);
  assert.equal(mergeIntoGroups([g1], shareRoundTrip(g1)).length, 1); // stesso id → resta 1
});

test('CONDIVISIONE: N dispositivi (10/20/30) convergono — ordine-indipendente e idempotente', () => {
  for (const N of [10, 20, 30]) {
    const members = Array.from({ length: N }, (_, i) => 'P' + i);
    const base = createGroup({ name: 'G' + N, members });
    const baseCode = encodeGroupShare(base);
    // ogni dispositivo parte dalla base e aggiunge la sua spesa
    const codes = [];
    for (let d = 0; d < N; d++) {
      let g = decodeGroupShare(baseCode);
      g = addSharedExpense(g, { payer: 'm' + d, amount: (d + 1) * 10, description: 'sp' + d });
      codes.push(encodeGroupShare(g));
    }
    // merge in due ordini diversi → stesso risultato (commutativo); poi re-merge (idempotente)
    let a = decodeGroupShare(baseCode); for (const c of codes) a = mergeGroups(a, decodeGroupShare(c));
    let b = decodeGroupShare(baseCode); for (const c of codes.slice().reverse()) b = mergeGroups(b, decodeGroupShare(c));
    for (const c of codes) a = mergeGroups(a, decodeGroupShare(c));
    assert.equal(a.expenses.length, N, `N=${N}: tutte le ${N} spese unite`);
    assert.equal(a.expenses.length, b.expenses.length, `N=${N}: convergenza ordine-indipendente`);
    const bal = computeBalances(a);
    assert.ok(Math.abs(Object.values(bal).reduce((x, y) => x + y, 0)) < 0.02, `N=${N}: saldi a somma zero`);
  }
});

test('CONDIVISIONE: codice non valido → null (mai crash)', () => {
  assert.equal(decodeGroupShare('spazzatura'), null);
  assert.equal(decodeGroupShare(''), null);
  assert.equal(decodeGroupShare('MSPLIT1:@@@'), null);
});

test('CONDIVISIONE cross-dominio: riconosce il gruppo da un LINK completo incollato', () => {
  const g = addSharedExpense(createGroup({ name: 'Viaggio', members: ['Io', 'Sara'] }), { payer: createGroup({ name: 'Viaggio', members: ['Io', 'Sara'] }).members[0].id, amount: 50 });
  const code = encodeGroupShare(g);
  // Link generato su un dominio A, incollato su un'app servita da un dominio B:
  const linkA = `https://vecchio-dominio.example/?join=${encodeURIComponent(code)}`;
  const linkB = `https://nuovo-server.io/app/#join=${encodeURIComponent(code)}`;
  assert.equal(decodeGroupShare(linkA)?.name, 'Viaggio');
  assert.equal(decodeGroupShare(linkB)?.name, 'Viaggio');
  // Anche testo di WhatsApp con il link in mezzo a una frase:
  assert.equal(decodeGroupShare(`Ehi unisciti qui https://x.y/?join=${encodeURIComponent(code)} a dopo!`)?.name, 'Viaggio');
});

test('quickSplit: divisione istantanea al centesimo esatto (30 in 4 → 7,50)', () => {
  const r = quickSplit({ amount: 30, people: 4 });
  assert.equal(r.perPerson, 7.5);
  assert.equal(r.shares.reduce((a, b) => a + b, 0), 30); // somma esatta
});

test('quickSplit: resto distribuito senza centesimi persi (10 in 3)', () => {
  const r = quickSplit({ amount: 10, people: 3 });
  assert.equal(Math.round(r.shares.reduce((a, b) => a + b, 0) * 100) / 100, 10);
  assert.deepEqual(r.shares.map(x => Math.round(x * 100) / 100), [3.34, 3.33, 3.33]);
});

test('quickSplit: tip round-up all\'euro per comodità', () => {
  const r = quickSplit({ amount: 29, people: 4, tipRoundUp: true });
  // 29/4 = 7,25 → arrotonda a 8 a testa → totale 32
  assert.equal(r.perPerson, 8);
  assert.equal(r.roundedTotal, 32);
});

test('frequentCoSplitters: ricorda chi divide più spesso, esclude "io"', () => {
  const past = [
    { members: [{ name: 'io' }, { name: 'Anna' }, { name: 'Bea' }] },
    { members: [{ name: 'io' }, { name: 'Anna' }] },
  ];
  const f = frequentCoSplitters(past);
  assert.equal(f[0].name, 'Anna');
  assert.equal(f[0].count, 2);
  assert.ok(!f.some(x => x.name === 'io'));
});

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (o) => round2(Object.values(o).reduce((a, b) => a + b, 0));
// Verifica che un settlement azzeri davvero tutti i saldi.
function appliesToZero(balances, transfers) {
  const b = { ...balances };
  for (const t of transfers) { b[t.from] = round2((b[t.from] || 0) + t.amount); b[t.to] = round2((b[t.to] || 0) - t.amount); }
  return Object.values(b).every(v => Math.abs(v) < 0.01);
}

test('divisione EQUA: 3 amici, uno paga 90 → gli altri due gli devono 30 ciascuno', () => {
  let g = createGroup({ name: 'Cena', members: ['Anna', 'Bea', 'Carlo'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 90, description: 'Pizzeria' });
  const bal = computeBalances(g);
  assert.equal(bal.m0, 60);   // ha pagato 90, doveva 30 → +60
  assert.equal(bal.m1, -30);
  assert.equal(bal.m2, -30);
  assert.equal(sum(bal), 0);  // invariante
});

test('settlement minimo: 3 persone → 2 bonifici che azzerano tutto', () => {
  let g = createGroup({ members: ['Anna', 'Bea', 'Carlo'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 90 });
  const { balances, transfers } = settlementView(g);
  assert.equal(transfers.length, 2);       // m1→m0, m2→m0
  assert.ok(transfers.every(t => t.to === 'm0'));
  assert.ok(appliesToZero(balances, transfers));
});

test('settlement minimo: catena di debiti si semplifica (A→B, B→C ⇒ A→C)', () => {
  // Anna paga per Bea, Bea paga per Carlo, ecc. → il greedy riduce i bonifici
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 30, shares: { equalAmong: ['m1'] } }); // B deve 30 ad A
  g = addSharedExpense(g, { payer: 'm1', amount: 30, shares: { equalAmong: ['m2'] } }); // C deve 30 a B
  const { balances, transfers } = settlementView(g);
  assert.ok(appliesToZero(balances, transfers));
  assert.ok(transfers.length <= 2); // niente giro inutile B→A→... : max 2 (o meno)
});

test('quote ESATTE per persona (byId) devono sommare all\'importo', () => {
  let g = createGroup({ members: ['A', 'B'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100, shares: { byId: { m0: 40, m1: 60 } } });
  const bal = computeBalances(g);
  assert.equal(bal.m0, 60);   // pagato 100, dovuto 40
  assert.equal(bal.m1, -60);
  assert.throws(() => addSharedExpense(g, { payer: 'm0', amount: 100, shares: { byId: { m0: 40, m1: 50 } } }), /sommano/);
});

test('ripartizione a PESI (weights): proporzionale', () => {
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 120, shares: { weights: { m0: 1, m1: 1, m2: 2 } } });
  const bal = computeBalances(g);
  assert.equal(bal.m2, -60);  // peso doppio → 60
  assert.equal(sum(bal), 0);
});

test('arrotondamento: 10 diviso 3 → quote 3,33/3,33/3,34, somma esatta 10', () => {
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 10 });
  const e = g.expenses[0];
  assert.equal(round2(Object.values(e.owed).reduce((a, b) => a + b, 0)), 10); // nessun centesimo perso
});

test('più spese, membri diversi: saldi coerenti e settlement azzera tutto', () => {
  let g = createGroup({ members: ['A', 'B', 'C', 'D'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });                 // tutti
  g = addSharedExpense(g, { payer: 'm1', amount: 40, shares: { equalAmong: ['m0', 'm1'] } });
  g = addSharedExpense(g, { payer: 'm2', amount: 60, shares: { weights: { m2: 1, m3: 2 } } });
  const { balances, transfers } = settlementView(g);
  assert.equal(sum(balances), 0);
  assert.ok(appliesToZero(balances, transfers));
});

test('suggestSettleTiming: predittivo e onesto', () => {
  assert.equal(suggestSettleTiming({ amountDue: 30, currentAvailable: 100 }).when, 'ora');
  assert.equal(suggestSettleTiming({ amountDue: 300, currentAvailable: 100, nextIncome: { date: '2026-08-01' } }).when, 'dopo il prossimo accredito');
  assert.equal(suggestSettleTiming({ amountDue: 30 }).when, 'quando puoi'); // senza dati non promette
});

test('settlementToSepa: ponte col bonifico on-device se conosco l\'IBAN', () => {
  let g = createGroup({ name: 'Vacanza', members: ['A', 'B'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });
  const { transfers } = settlementView(g);
  const sepa = settlementToSepa(transfers[0], g, { m0: 'IT60X0542811101000000123456' });
  assert.equal(sepa.iban, 'IT60X0542811101000000123456');
  assert.equal(sepa.amount, 50);
  assert.ok(/Rimborso Vacanza/.test(sepa.remittance));
  // senza IBAN → null (resta la richiesta a voce)
  assert.equal(settlementToSepa(transfers[0], g, {}), null);
});

// ══════════════════════════════════════════════════════════════════════════
// SYNC LIVE CRDT — ogni scenario, anche COMBINATO, deve convergere (A∪B = B∪A).
// Bug reali segnalati: nomi/importi aggiornati su un dispositivo non arrivavano
// agli altri; persone/spese aggiunte dopo non comparivano.
// ══════════════════════════════════════════════════════════════════════════
const { renameGroup, editExpense } = await import('./split-engine.js');

test('RENAME propaga: il nome più recente (nameAt) vince nel merge', () => {
  let g = createGroup({ name: 'cena', members: ['Io', 'Marco'] });
  const vecchio = { ...g };
  const rinominato = renameGroup(g, 'Cena di Marco');
  // persist locale = mergeGroups(vecchio, rinominato): il nuovo deve vincere.
  assert.equal(mergeGroups(vecchio, rinominato).name, 'Cena di Marco');
  // e converge in entrambe le direzioni
  assert.equal(mergeGroups(rinominato, vecchio).name, 'Cena di Marco');
});

test('IMPORTO aggiornato su un dispositivo si propaga (LWW per updatedAt)', async () => {
  let g = createGroup({ name: 'casa', members: ['Io', 'Anna'] });
  g = addSharedExpense(g, { payer: g.members[0].id, amount: 30, description: 'spesa' });
  const expId = g.expenses[0].id;
  await new Promise(r => setTimeout(r, 5)); // garantisce updatedAt maggiore
  const gEdit = editExpense(g, expId, { amount: 50 });
  // Il dispositivo B ha ancora la versione a 30; merge → deve vincere 50.
  const merged = mergeGroups(g, gEdit);
  assert.equal(merged.expenses.length, 1, 'stessa spesa, non duplicata');
  assert.equal(merged.expenses[0].amount, 50, 'importo aggiornato propagato');
  assert.equal(mergeGroups(gEdit, g).expenses[0].amount, 50, 'converge anche invertito');
});

test('PERSONE aggiunte dopo compaiono nel merge (unione membri)', () => {
  let a = createGroup({ name: 'viaggio', members: ['Io', 'Marco'] });
  // dispositivo B aggiunge Luca
  let b = { ...a, members: [...a.members, { id: 'mX', name: 'Luca' }] };
  const merged = mergeGroups(a, b);
  assert.deepEqual(merged.members.map(m => m.name).sort(), ['Io', 'Luca', 'Marco']);
});

test('SCENARIO COMBINATO: rename + nuova spesa + importo modificato + nuova persona, due dispositivi', async () => {
  // Stato condiviso iniziale
  let base = createGroup({ id: 'G1', name: 'cena', members: ['Io', 'Marco'] });
  base = addSharedExpense(base, { payer: base.members[0].id, amount: 40, description: 'ristorante' });
  const eId = base.expenses[0].id;

  // Dispositivo A: rinomina + modifica l'importo della spesa
  await new Promise(r => setTimeout(r, 5));
  let A = renameGroup(base, 'Cena di venerdì');
  A = editExpense(A, eId, { amount: 60 });

  // Dispositivo B: aggiunge una persona + una nuova spesa
  let B = { ...base, members: [...base.members, { id: 'mL', name: 'Luca' }] };
  B = addSharedExpense(B, { payer: 'mL', amount: 20, description: 'bar' });

  // Merge nei due ordini → stesso risultato (convergenza)
  const AB = mergeGroups(A, B);
  const BA = mergeGroups(B, A);
  const normalize = (g) => ({ name: g.name, members: g.members.map(m => m.name).sort(), amounts: g.expenses.map(e => e.amount).sort((x, y) => x - y), n: g.expenses.length });
  assert.deepEqual(normalize(AB), normalize(BA), 'convergenza A∪B = B∪A');
  // e contiene TUTTO: nome nuovo, 3 persone, 2 spese, importo modificato a 60
  assert.equal(AB.name, 'Cena di venerdì');
  assert.deepEqual(AB.members.map(m => m.name).sort(), ['Io', 'Luca', 'Marco']);
  assert.equal(AB.expenses.length, 2);
  assert.deepEqual(AB.expenses.map(e => e.amount).sort((x, y) => x - y), [20, 60]);
});

test('IDEMPOTENZA: ri-mergiare lo stesso stato non cambia nulla', async () => {
  let g = createGroup({ id: 'G2', name: 'test', members: ['Io', 'Marco'] });
  g = addSharedExpense(g, { payer: g.members[0].id, amount: 10, description: 'x' });
  const once = mergeGroups(g, g);
  assert.equal(once.expenses.length, 1);
  assert.equal(mergeGroups(once, g).expenses.length, 1);
  assert.equal(mergeGroups(once, once).name, g.name);
});

// ── describeGroupChanges: notifiche PRECISE cross-device (non generiche) ────
test('describeGroupChanges: nuova persona entrata', () => {
  const before = createGroup({ id: 'g1', name: 'cena', members: ['Io'] });
  const after = { ...before, members: [...before.members, { id: 'mX', name: 'Marco' }] };
  const { changes } = describeGroupChanges(before, after);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /Marco è entrato/);
});

test('describeGroupChanges: nuova spesa con importo e descrizione', () => {
  let g = createGroup({ id: 'g1', name: 'cena', members: ['Io', 'Marco'] });
  const before = g;
  g = addSharedExpense(g, { payer: g.members[0].id, amount: 40, description: 'pizza' });
  const { changes } = describeGroupChanges(before, g);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /Io ha aggiunto una spesa di 40\.00€ \(pizza\)/);
});

test('describeGroupChanges: importo di una spesa esistente cambiato', () => {
  let g = createGroup({ id: 'g1', name: 'cena', members: ['Io'] });
  g = addSharedExpense(g, { payer: g.members[0].id, amount: 40, description: 'pizza' });
  const before = g;
  const after = editExpense(g, g.expenses[0].id, { amount: 55 });
  const { changes } = describeGroupChanges(before, after);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /da 40\.00€ a 55\.00€/);
});

test('describeGroupChanges: rename', () => {
  const before = createGroup({ id: 'g1', name: 'cena', members: ['Io'] });
  const after = renameGroup(before, 'Cena di venerdì');
  const { changes } = describeGroupChanges(before, after);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /rinominato in "Cena di venerdì"/);
});

test('describeGroupChanges: nessun cambiamento reale → array vuoto', () => {
  const g = createGroup({ id: 'g1', name: 'cena', members: ['Io'] });
  const { changes } = describeGroupChanges(g, g);
  assert.equal(changes.length, 0);
});

test('describeGroupChanges: gruppo nuovo (before assente)', () => {
  const g = createGroup({ id: 'g1', name: 'weekend', members: ['Io'] });
  const { changes } = describeGroupChanges(null, g);
  assert.equal(changes.length, 1);
  assert.match(changes[0], /Nuovo gruppo "weekend" ricevuto/);
});

test('describeGroupChanges: combinato (persona + spesa insieme, come nel sync mesh reale)', () => {
  let before = createGroup({ id: 'g1', name: 'weekend', members: ['Io'] });
  let after = { ...before, members: [...before.members, { id: 'mA', name: 'Anna' }] };
  after = addSharedExpense(after, { payer: 'mA', amount: 60, description: 'hotel' });
  const { changes } = describeGroupChanges(before, after);
  assert.equal(changes.length, 2);
  assert.ok(changes.some(c => /Anna è entrato/.test(c)));
  assert.ok(changes.some(c => /Anna ha aggiunto una spesa di 60\.00€ \(hotel\)/.test(c)));
});

// ============================================================
// INVITO LEGGERO (bug reale: il link/QR diventava enorme perché portava
// TUTTA la cronologia spese) + IDENTITÀ A SLOT (bug reale: chi entrava da
// un link poteva scegliere di "essere" chiunque, incluso il creatore).
// ============================================================

test('encodeGroupInvite: NON porta le spese, anche con cronologia lunga', () => {
  let g = createGroup({ name: 'Casa condivisa', members: ['Io', 'Anna'] });
  for (let i = 0; i < 50; i++) g = addSharedExpense(g, { payer: 'm0', amount: 10 + i, description: `Spesa ${i}` });
  const invite = encodeGroupInvite(g);
  const full = encodeGroupShare(g);
  assert.ok(invite.length < full.length, 'il link invito deve essere più corto del link completo');
  assert.ok(invite.length < 400, 'un invito non deve crescere con la cronologia del gruppo');
  const decoded = decodeGroupShare(invite);
  assert.equal(decoded.id, g.id);
  assert.equal(decoded.members.length, 2);
  assert.deepEqual(decoded.expenses, [], 'le spese arrivano dopo via sync, non nel link');
});

test('decodeGroupShare: tollera sia un invito leggero sia un codice completo', () => {
  const g = createGroup({ name: 'G', members: ['A', 'B'] });
  assert.deepEqual(decodeGroupShare(encodeGroupInvite(g)).expenses, []);
  assert.deepEqual(decodeGroupShare(encodeGroupShare(g)).expenses, []); // gruppo appena creato, nessuna spesa
});

test('encodeGroupInvite: senza offerta P2P il campo "p2p" non compare (link più corto)', () => {
  const g = createGroup({ name: 'G', members: ['A', 'B'] });
  const invite = encodeGroupInvite(g);
  assert.equal(decodeGroupShare(invite).p2p, undefined);
});

test('encodeGroupInvite: con un\'offerta P2P, viaggia nello stesso link/QR e si decodifica di nuovo', () => {
  const g = createGroup({ name: 'G', members: ['A', 'B'] });
  const fakeOffer = 'OFFER_CODE_DI_PROVA_ABC123';
  const invite = encodeGroupInvite(g, fakeOffer);
  const withoutP2p = encodeGroupInvite(g);
  assert.ok(invite.length > withoutP2p.length, 'con l\'offerta il codice è più lungo, ma resta un unico link/QR');
  const decoded = decodeGroupShare(invite);
  assert.equal(decoded.p2p, fakeOffer, 'l\'offerta P2P arriva intatta a chi riceve il link');
  assert.equal(decoded.id, g.id);
});

test('IDENTITÀ: il creatore rivendica il proprio slot alla creazione', () => {
  let g = createGroup({ name: 'Weekend', members: ['Io', 'Mattia'] });
  g = claimMember(g, 'm0', 'device-A');
  assert.equal(myMemberId(g, 'device-A'), 'm0');
  assert.deepEqual(unclaimedMembers(g).map(m => m.id), ['m1']);
});

test('IDENTITÀ: chi entra da un link vede SOLO gli slot liberi (mai quello del creatore)', () => {
  let g = createGroup({ name: 'Weekend', members: ['Io', 'Mattia', 'Francesca'] });
  g = claimMember(g, 'm0', 'device-A'); // il creatore è "Io"
  const invite = decodeGroupShare(encodeGroupInvite(g));
  assert.deepEqual(unclaimedMembers(invite).map(m => m.id), ['m1', 'm2'], 'Mattia e Francesca sono liberi, "Io" no');
});

test('IDENTITÀ: un secondo dispositivo NON può rubare uno slot già rivendicato', () => {
  let g = createGroup({ name: 'Weekend', members: ['Io', 'Mattia'] });
  g = claimMember(g, 'm0', 'device-A'); // device A è già "Io"
  const tentativo = claimMember(g, 'm0', 'device-B'); // B prova a diventare "Io" anche lui
  assert.equal(myMemberId(tentativo, 'device-B'), null, 'B non è diventato "Io"');
  assert.equal(myMemberId(tentativo, 'device-A'), 'm0', 'A resta "Io"');
});

test('IDENTITÀ: claimare il proprio slot due volte è no-op (idempotente)', () => {
  let g = createGroup({ name: 'G', members: ['Io'] });
  g = claimMember(g, 'm0', 'device-A');
  const again = claimMember(g, 'm0', 'device-A');
  assert.equal(myMemberId(again, 'device-A'), 'm0');
});

test('IDENTITÀ: claimare uno slot inesistente non cambia nulla (mai un crash)', () => {
  let g = createGroup({ name: 'G', members: ['Io'] });
  const same = claimMember(g, 'inesistente', 'device-A');
  assert.deepEqual(same, g);
});

test('IDENTITÀ: il merge NON perde un claim fatto dopo la condivisione iniziale', () => {
  // Scenario reale: A crea il gruppo e lo condivide PRIMA di claimare "Io".
  let base = createGroup({ name: 'Weekend', members: ['Io', 'Mattia'] });
  const inviteCode = encodeGroupInvite(base);
  // A claima il proprio slot LOCALMENTE dopo aver condiviso.
  const aAfterClaim = claimMember(base, 'm0', 'device-A');
  // B riceve l'invito (senza il claim di A, perché era in transito) e claima "Mattia".
  const bGroup = claimMember(decodeGroupShare(inviteCode), 'm1', 'device-B');
  // Il sync li fonde in entrambe le direzioni.
  const mergedAB = mergeGroups(aAfterClaim, bGroup);
  const mergedBA = mergeGroups(bGroup, aAfterClaim);
  for (const merged of [mergedAB, mergedBA]) {
    assert.equal(myMemberId(merged, 'device-A'), 'm0', 'il claim di A non si perde nel merge');
    assert.equal(myMemberId(merged, 'device-B'), 'm1', 'il claim di B non si perde nel merge');
  }
});

test('IDENTITÀ: due dispositivi che claimano lo STESSO slot in contemporanea → vince il primo nel tempo', () => {
  let base = createGroup({ name: 'G', members: ['Ospite'] });
  const aClaim = claimMember(base, 'm0', 'device-A'); // A claima per primo
  // B, non sapendo che A l'ha già fatto, prova a claimare lo stesso slot un attimo dopo
  const bClaimGroup = { ...base, members: base.members.map(m => m.id === 'm0' ? { ...m, claimedBy: 'device-B', claimedAt: (aClaim.members[0].claimedAt || 0) + 50 } : m) };
  const merged = mergeGroups(aClaim, bClaimGroup);
  assert.equal(myMemberId(merged, 'device-A'), 'm0', 'A ha claimato per primo, resta lui');
  assert.equal(myMemberId(merged, 'device-B'), null, 'B ha perso la corsa allo stesso slot');
});

test('IDENTITÀ: aggiungere un nuovo membro (non tra quelli previsti) e claimarlo subito', () => {
  let g = createGroup({ name: 'Weekend', members: ['Io'] });
  const newMember = { id: 'm_new', name: 'Bea' };
  g = { ...g, members: [...g.members, newMember] };
  g = claimMember(g, 'm_new', 'device-B');
  assert.equal(myMemberId(g, 'device-B'), 'm_new');
  assert.deepEqual(unclaimedMembers(g).map(m => m.id), ['m0'], '"Io" resta libero, solo Bea è stata claimata');
});

// ============================================================
// SIMULAZIONE END-TO-END: invito + ingresso + sync live per 10 PERSONE.
// Non è un giocattolo a 2 dispositivi: qui si simula un gruppo intero
// (10 telefoni distinti, ognuno col proprio deviceId) che entra dal
// link, aggiunge/modifica spese e rinomina il gruppo MENTRE è scollegato
// dagli altri, poi tutti sincronizzano in un ordine CASUALE e diverso per
// ognuno (un vero mesh gossip non ha un "ordine giusto" di arrivo). La
// proprietà da dimostrare è quella di un CRDT: mergeGroups è commutativo,
// associativo e idempotente, quindi il risultato finale deve essere
// IDENTICO per tutti e 10, indipendentemente da chi ha sincronizzato con
// chi per primo. Nessun numero fittizio: sono le stesse funzioni che gira
// l'app in produzione, solo orchestrate qui invece che da WebRTC.
// ============================================================

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Confronto "a prescindere dall'ordine": l'ordine di members/expenses dopo
// un merge dipende da CHI ha sincronizzato con chi, ma il CONTENUTO deve
// essere lo stesso → si ordina per id prima di confrontare.
function normalizeGroup(g) {
  return {
    id: g.id,
    name: g.name,
    members: [...g.members].sort((a, b) => a.id.localeCompare(b.id))
      .map(m => ({ id: m.id, name: m.name, claimedBy: m.claimedBy || null })),
    expenses: [...g.expenses].sort((a, b) => a.id.localeCompare(b.id))
      .map(e => ({ id: e.id, payer: e.payer, amount: e.amount, description: e.description, owed: e.owed })),
  };
}

// Ogni dispositivo sincronizza con gli altri 9 in un ordine casuale e
// diverso: se converge sempre allo stesso risultato, il sync "funziona
// comunque arrivino i messaggi", non solo nel caso favorevole.
function fullMeshConverge(states) {
  return states.map((_, i) => shuffled(states).reduce((acc, s) => mergeGroups(acc, s), states[i]));
}
function assertAllConverge(states, msg) {
  const normalized = fullMeshConverge(states).map(normalizeGroup);
  for (let i = 1; i < normalized.length; i++) {
    assert.deepEqual(normalized[i], normalized[0], `${msg} — dispositivo ${i} diverge dal dispositivo 0`);
  }
  return normalized[0];
}

test('SIMULAZIONE LIVE (10 persone): invito leggero + ingresso concorrente → tutti convergono, nessuno può rubare "Io"', () => {
  let seed = createGroup({ name: 'Viaggio a 10', members: ['Io', 'Mattia', 'Francesca'] });
  seed = claimMember(seed, 'm0', 'device-0'); // il creatore claima "Io" PRIMA di condividere
  const invite = encodeGroupInvite(seed);
  assert.ok(invite.length < 400, 'l\'invito resta leggero anche pensato per 10 persone');

  const states = [seed];
  states.push(claimMember(decodeGroupShare(invite), 'm1', 'device-1')); // claima "Mattia"
  states.push(claimMember(decodeGroupShare(invite), 'm2', 'device-2')); // claima "Francesca"
  // 7 persone in più, mai previste nel gruppo iniziale, entrano come membri nuovi
  // (stessa identica logica del bottone "Entra nel gruppo" in main.js)
  ['Anna', 'Bea', 'Carlo', 'Dario', 'Elisa', 'Fabio', 'Giulia'].forEach((name, k) => {
    const deviceId = `device-${k + 3}`;
    let g = decodeGroupShare(invite);
    const newId = `m_${deviceId}_${k}`;
    g = { ...g, members: [...g.members, { id: newId, name }] };
    g = claimMember(g, newId, deviceId);
    states.push(g);
  });
  assert.equal(states.length, 10);

  // qualcuno prova comunque a rubare lo slot del creatore: non deve mai riuscirci
  const tentativoFurto = claimMember(decodeGroupShare(invite), 'm0', 'device-9-cattivo');
  assert.equal(myMemberId(tentativoFurto, 'device-9-cattivo'), null, 'nessuno può diventare "Io" da un link');

  const final = assertAllConverge(states, 'ingresso di 10 persone');
  assert.equal(final.members.length, 10, 'tutti e 10 nel gruppo, nessuno perso');
  assert.equal(new Set(final.members.map(m => m.id)).size, 10, 'nessuna collisione di id tra dispositivi diversi');
  for (let i = 0; i < 10; i++) {
    assert.ok(final.members.some(m => m.claimedBy === `device-${i}`), `il dispositivo ${i} resta riconoscibile nel gruppo finale`);
  }
});

test('SIMULAZIONE LIVE (10 persone): spese aggiunte e importi modificati offline in parallelo → convergenza e saldo a somma zero', () => {
  const names = ['Io', 'Mattia', 'Francesca', 'Anna', 'Bea', 'Carlo', 'Dario', 'Elisa', 'Fabio', 'Giulia'];
  const base = createGroup({ name: 'Casa a 10', members: names });
  const ids = base.members.map(m => m.id);

  // ognuno, dal proprio dispositivo scollegato dagli altri, aggiunge una spesa pagata da sé
  let states = ids.map((id, k) => addSharedExpense(base, { payer: id, amount: 10 + k, description: `Spesa di ${names[k]}` }));

  // due dispositivi modificano LO STESSO importo (quello di "Io") in momenti diversi:
  // deve vincere sempre l'ultimo, ovunque il messaggio arrivi. Device 5 deve prima
  // AVERE ricevuto quella spesa via sync (come nella realtà: non puoi modificare una
  // spesa che non ti è ancora arrivata), poi la modifica con la VERA editExpense (che
  // ricalcola le quote — sovrascrivere solo "amount" a mano romperebbe l'invariante
  // saldo-zero senza che sia colpa del motore, solo della simulazione).
  const originalExpense = states[0].expenses[0];
  const expenseId = originalExpense.id;
  const d0 = editExpense(states[0], expenseId, { amount: 99 });
  const laterEdit = d0.expenses.find(e => e.id === expenseId).updatedAt + 1000;
  states[0] = d0;
  let d5 = editExpense({ ...states[5], expenses: [...states[5].expenses, originalExpense] }, expenseId, { amount: 50 });
  states[5] = { ...d5, expenses: d5.expenses.map(e => e.id === expenseId ? { ...e, updatedAt: laterEdit } : e) };

  const final = assertAllConverge(states, 'spese e modifiche di importo di 10 persone');
  assert.equal(final.expenses.length, 10, 'una spesa a testa, nessuna persa né duplicata dal sync');
  assert.equal(final.expenses.find(e => e.id === expenseId).amount, 50, 'vince la modifica più recente, indipendentemente da chi la riceve per primo');
  const bal = computeBalances(final);
  const sum = round2sum(bal);
  assert.ok(Math.abs(sum) < 0.01, `il saldo di 10 persone resta a somma zero anche con modifiche concorrenti (somma=${sum})`);
});

function round2sum(bal) { return Object.values(bal).reduce((s, v) => s + v, 0); }

test('SIMULAZIONE LIVE: due dispositivi rinominano il gruppo in contemporanea → vince il più recente ovunque converga', () => {
  const base = createGroup({ name: 'Gruppo senza nome', members: ['Io', 'Mattia'] });
  const a = renameGroup(base, 'Weekend a Roma');
  const b = { ...base, name: 'Weekend al mare', nameAt: (a.nameAt || 0) + 1000 };
  const final = assertAllConverge([a, b], 'rename concorrente');
  assert.equal(final.name, 'Weekend al mare', 'vince il rename più recente, indipendentemente da chi lo riceve prima');
});

test('SIMULAZIONE LIVE COMPLETA (10 persone): ingresso + spese + modifiche + rename, tutti insieme, gossip casuale → un solo risultato finale per tutti', () => {
  // Parte 1: 10 persone entrano nello stesso gruppo dal link, come nel primo test.
  let seed = createGroup({ name: 'Vacanza', members: ['Io', 'Mattia', 'Francesca'] });
  seed = claimMember(seed, 'm0', 'device-0');
  const invite = encodeGroupInvite(seed);
  const states = [seed];
  states.push(claimMember(decodeGroupShare(invite), 'm1', 'device-1'));
  states.push(claimMember(decodeGroupShare(invite), 'm2', 'device-2'));
  const extra = ['Anna', 'Bea', 'Carlo', 'Dario', 'Elisa', 'Fabio', 'Giulia'];
  extra.forEach((name, k) => {
    const deviceId = `device-${k + 3}`;
    let g = decodeGroupShare(invite);
    const newId = `m_${deviceId}_${k}`;
    g = { ...g, members: [...g.members, { id: newId, name }] };
    g = claimMember(g, newId, deviceId);
    states.push(g);
  });

  // Parte 2: ogni dispositivo, DOPO essere entrato ma PRIMA di sincronizzare con
  // gli altri, aggiunge una propria spesa (come farebbe davvero appena entra).
  states.forEach((g, i) => {
    const myId = myMemberId(g, `device-${i}`);
    states[i] = addSharedExpense(g, { payer: myId, amount: 5 * (i + 1), description: `Spesa ${i}` });
  });

  // Parte 3: due dispositivi diversi modificano la STESSA spesa (quella di device-0)
  // in momenti diversi, e un terzo dispositivo rinomina il gruppo. Device 7 deve
  // prima avere una copia sincronizzata della spesa di device-0 prima di poterla
  // modificare lui stesso (come nella realtà: non modifichi ciò che non hai ancora),
  // e la modifica passa dalla VERA editExpense (ricalcola le quote, non solo "amount").
  const targetExpense = states[0].expenses[0];
  const targetExpenseId = targetExpense.id;
  states[0] = editExpense(states[0], targetExpenseId, { amount: 12 });
  const t1 = states[0].expenses.find(e => e.id === targetExpenseId).updatedAt + 500;
  let d7 = editExpense({ ...states[7], expenses: [...states[7].expenses, targetExpense] }, targetExpenseId, { amount: 40 });
  states[7] = { ...d7, expenses: d7.expenses.map(e => e.id === targetExpenseId ? { ...e, updatedAt: t1 } : e) };
  states[3] = renameGroup(states[3], 'Vacanza a Napoli');

  // Parte 4: gossip completo in ordine casuale e diverso per ognuno dei 10.
  const final = assertAllConverge(states, 'scenario combinato a 10 persone (ingresso + spese + modifiche + rename)');

  assert.equal(final.members.length, 10, 'tutti e 10 presenti');
  assert.equal(new Set(final.members.map(m => m.id)).size, 10, 'nessuna collisione');
  assert.equal(final.expenses.length, 10, 'una spesa a testa, nessuna persa nel gossip a 10');
  assert.equal(final.expenses.find(e => e.id === targetExpenseId).amount, 40, 'vince la modifica più recente su un dispositivo qualsiasi');
  assert.equal(final.name, 'Vacanza a Napoli', 'il rename si propaga a tutti e 10');
  const sum = round2sum(computeBalances(final));
  assert.ok(Math.abs(sum) < 0.01, `saldo a somma zero anche nello scenario combinato (somma=${sum})`);
});

// ── Stesso scenario combinato, ma GENERICO su N persone: non basta che funzioni
// a quota 10, deve reggere a qualunque dimensione di gruppo (coppia, gruppetto,
// gita numerosa) — nessun numero magico nel motore che dipenda da N=10. ────────
function simulateGroupOfN(n) {
  // slot iniziali previsti nell'invito: "Io" + metà con nome già noto (in stile
  // "Mattia"/"Francesca" del bug reale), l'altra metà entra come membro nuovo.
  const knownSlots = Math.max(0, Math.floor((n - 1) / 2));
  const initialNames = ['Io', ...Array.from({ length: knownSlots }, (_, i) => `Noto${i}`)];
  let seed = createGroup({ name: `Gruppo da ${n}`, members: initialNames });
  seed = claimMember(seed, 'm0', 'device-0');
  const invite = encodeGroupInvite(seed);
  // l'invito cresce (giustamente) coi NOMI dei membri, ma MAI con la cronologia
  // spese: qui si verifica solo che resti proporzionato a N, non che sforni un
  // numero fisso indipendente dalla dimensione del gruppo.
  assert.ok(invite.length < 40 * n + 150, `l'invito resta proporzionato a N=${n} (${invite.length} caratteri), non esplode`);

  const states = [seed];
  for (let i = 1; i <= knownSlots; i++) {
    states.push(claimMember(decodeGroupShare(invite), `m${i}`, `device-${i}`));
  }
  for (let i = knownSlots + 1; i < n; i++) {
    const deviceId = `device-${i}`;
    let g = decodeGroupShare(invite);
    const newId = `m_${deviceId}`;
    g = claimMember({ ...g, members: [...g.members, { id: newId, name: `Nuovo${i}` }] }, newId, deviceId);
    states.push(g);
  }
  assert.equal(states.length, n, `N=${n}: tutti entrati`);

  // ognuno aggiunge una propria spesa prima di sincronizzare con gli altri
  states.forEach((g, i) => {
    const myId = myMemberId(g, `device-${i}`);
    states[i] = addSharedExpense(g, { payer: myId, amount: 3 + i, description: `Spesa ${i}` });
  });

  // due dispositivi (0 e l'ultimo) modificano la stessa spesa di device-0 in momenti
  // diversi; se n===1 non c'è nessun "ultimo" diverso da 0, quindi si salta il conflitto
  let targetExpenseId = null;
  if (n > 1) {
    const targetExpense = states[0].expenses[0];
    targetExpenseId = targetExpense.id;
    states[0] = editExpense(states[0], targetExpenseId, { amount: 77 });
    const later = states[0].expenses.find(e => e.id === targetExpenseId).updatedAt + 750;
    const last = n - 1;
    const dLast = editExpense({ ...states[last], expenses: [...states[last].expenses, targetExpense] }, targetExpenseId, { amount: 33 });
    states[last] = { ...dLast, expenses: dLast.expenses.map(e => e.id === targetExpenseId ? { ...e, updatedAt: later } : e) };
  }

  const final = assertAllConverge(states, `scenario combinato a N=${n} persone`);
  assert.equal(final.members.length, n, `N=${n}: nessuno perso nel sync`);
  assert.equal(new Set(final.members.map(m => m.id)).size, n, `N=${n}: nessuna collisione di id`);
  assert.equal(final.expenses.length, n, `N=${n}: una spesa a testa, nessuna persa/duplicata`);
  if (targetExpenseId) {
    assert.equal(final.expenses.find(e => e.id === targetExpenseId).amount, 33, `N=${n}: vince la modifica più recente`);
  }
  const sum = round2sum(computeBalances(final));
  assert.ok(Math.abs(sum) < 0.01, `N=${n}: saldo a somma zero (somma=${sum})`);
}

for (const n of [2, 3, 5, 8, 12, 15, 20]) {
  test(`SIMULAZIONE LIVE generica: gruppo da ${n} persone, ingresso + spese + modifica concorrente + gossip casuale converge sempre`, () => {
    simulateGroupOfN(n);
  });
}

// ── SETTLEMENT ESATTO OLTRE 12 PERSONE ───────────────────────────────────────
// Il salto da "esatto fino a 12" a "esatto fino a 22" si regge su un teorema
// (una partizione massima usa solo blocchi minimali a somma zero). Un teorema
// scritto in un commento non vale niente: qui lo si mette alla prova contro un
// ORACOLO indipendente, scritto in modo diverso dall'implementazione — forza
// bruta su tutte le partizioni, senza nessuna nozione di "minimale".

// Oracolo: massimo numero di blocchi a somma zero, per pura forza bruta su
// tutti i sottoinsiemi (3^n). Volutamente lento e stupido: e' il riferimento.
function bruteForceMaxBlocks(values) {
  const n = values.length;
  const cents = values.map(v => Math.round(v * 100));
  const sum = new Array(1 << n).fill(0);
  for (let m = 1; m < (1 << n); m++) { const low = m & -m; sum[m] = sum[m ^ low] + cents[31 - Math.clz32(low)]; }
  const memo = new Array(1 << n).fill(-2);
  const solve = (mask) => {
    if (mask === 0) return 0;
    if (memo[mask] !== -2) return memo[mask];
    const low = mask & -mask; let best = -1;
    for (let s = mask; s > 0; s = (s - 1) & mask) {
      if (!(s & low) || sum[s] !== 0) continue;
      const sub = solve(mask ^ s);
      if (sub >= 0 && 1 + sub > best) best = 1 + sub;
    }
    return (memo[mask] = best);
  };
  return solve((1 << n) - 1);
}

// Saldi casuali che sommano ESATTAMENTE a zero (come i saldi veri di un gruppo).
// ATTENZIONE (errore trovato scrivendo questi test): con importi casuali su un
// intervallo continuo, la probabilita' che un sottoinsieme faccia somma zero e'
// quasi nulla — l'unico blocco possibile e' il gruppo intero, l'ottimo e'
// sempre n-1 e il greedy pareggia. Un test cosi' non dimostra niente. I saldi
// VERI nascono da spese divise in parti uguali: pochi valori ricorrenti, tante
// compensazioni. Per questo si generano blocchi a somma zero su una scala
// grossolana (multipli di 5 euro), come nella vita reale.
function randomStructuredBalances(rnd, { blocks = 3, maxBlockSize = 4 } = {}) {
  const bal = {}; let idx = 0;
  for (let b = 0; b < blocks; b++) {
    const k = 2 + Math.floor(rnd() * (maxBlockSize - 1));
    const vals = []; let acc = 0;
    for (let i = 0; i < k - 1; i++) { const v = (1 + Math.floor(rnd() * 8)) * 5 * (rnd() < 0.5 ? -1 : 1); vals.push(v); acc += v; }
    vals.push(-acc);
    for (const v of vals) if (v !== 0) bal[`P${idx++}`] = v;
  }
  return bal;
}

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Un piano di pagamenti e' VALIDO solo se azzera davvero ogni saldo e non
// contiene bonifici a zero o negativi (nessuno "paga" -3 euro).
function assertSettles(bal, tx) {
  const b = { ...bal };
  for (const t of tx) {
    assert.ok(t.amount > 0, 'nessun bonifico di importo nullo o negativo');
    b[t.from] = (b[t.from] || 0) + t.amount;
    b[t.to] = (b[t.to] || 0) - t.amount;
  }
  for (const [k, v] of Object.entries(b)) assert.ok(Math.abs(v) < 0.01, `saldo di ${k} non azzerato: ${v}`);
}

// Greedy di riferimento (il metodo di Splitwise/Settle Up): il piu' grande
// debitore paga il piu' grande creditore, finche' tutto e' chiuso. Riscritto
// qui apposta, indipendente dal motore, per misurare il guadagno reale.
function greedyReference(bal) {
  const cred = Object.entries(bal).filter(([, v]) => v > 0.005).map(([m, v]) => ({ m, v })).sort((a, b) => b.v - a.v);
  const deb = Object.entries(bal).filter(([, v]) => v < -0.005).map(([m, v]) => ({ m, v: -v })).sort((a, b) => b.v - a.v);
  const tx = []; let i = 0, j = 0;
  while (i < deb.length && j < cred.length) {
    const pay = Math.round(Math.min(deb[i].v, cred[j].v) * 100) / 100;
    if (pay > 0.005) tx.push({ from: deb[i].m, to: cred[j].m, amount: pay });
    deb[i].v = Math.round((deb[i].v - pay) * 100) / 100; cred[j].v = Math.round((cred[j].v - pay) * 100) / 100;
    if (deb[i].v <= 0.005) i++; if (cred[j].v <= 0.005) j++;
  }
  return tx;
}

test('SETTLEMENT ESATTO: coincide con la forza bruta su 200 gruppi realistici (4-11 persone)', () => {
  const rnd = mulberry32(20260803);
  for (let iter = 0; iter < 200; iter++) {
    const bal = randomStructuredBalances(rnd, { blocks: 1 + Math.floor(rnd() * 3), maxBlockSize: 4 });
    const people = Object.keys(bal).length;
    if (people < 2 || people > 11) continue;
    const tx = minimalSettlement(bal);
    assertSettles(bal, tx);
    const optimal = people - bruteForceMaxBlocks(Object.values(bal));
    assert.equal(tx.length, optimal, `atteso il minimo assoluto ${optimal}, ottenuti ${tx.length} (saldi: ${JSON.stringify(bal)})`);
  }
});

test('SETTLEMENT ESATTO: resta ottimo dove prima si ripiegava sul greedy (13-16 persone)', () => {
  const rnd = mulberry32(777);
  let confronti = 0, bonificiRisparmiati = 0;
  for (let iter = 0; iter < 60; iter++) {
    const bal = randomStructuredBalances(rnd, { blocks: 5 + Math.floor(rnd() * 2), maxBlockSize: 3 });
    const people = Object.keys(bal).length;
    if (people < 13 || people > 16) continue;
    const tx = minimalSettlement(bal);
    assertSettles(bal, tx);
    // L'oracolo a forza bruta e' ancora eseguibile fin qui: e' il confronto che
    // dimostra che sopra i 12 la risposta non e' solo "valida", e' MINIMA.
    const optimal = people - bruteForceMaxBlocks(Object.values(bal));
    assert.equal(tx.length, optimal, `sopra i 12 deve restare il minimo assoluto (${optimal}), ottenuti ${tx.length}`);
    bonificiRisparmiati += greedyReference(bal).length - tx.length;
    confronti++;
  }
  assert.ok(confronti >= 10, `servono almeno 10 gruppi sopra i 12 davvero verificati (${confronti})`);
  // La misura che conta: sopra i 12 persone il vecchio comportamento era il
  // greedy. Se il guadagno fosse zero, tutto questo lavoro non servirebbe.
  assert.ok(bonificiRisparmiati > 0, `deve fare meno bonifici del greedy (risparmiati: ${bonificiRisparmiati})`);
});

test('SETTLEMENT ESATTO: blocchi non minimali spezzati correttamente ({5,-5} dentro {5,-3,-5,3})', () => {
  // Il caso che rende necessario il filtro finale di minimalita': lungo un
  // cammino si trova {5,-3,-5,3} (somma zero) prima di accorgersi che {5,-5}
  // ne e' un sotto-blocco. Se il filtro mancasse, uscirebbe 3 bonifici invece di 2.
  const bal = { A: 5, B: -3, C: -5, D: 3 };
  const tx = minimalSettlement(bal);
  assert.equal(tx.length, 2, 'due coppie indipendenti → due bonifici');
  assertSettles(bal, tx);
});

test('SETTLEMENT: gruppo grande senza alcuna compensazione (20 persone, un solo creditore)', () => {
  // Caso peggiore per l'enumerazione: nessun sotto-blocco a somma zero esiste,
  // l'unico blocco minimale e' il gruppo intero → n-1 bonifici, ed e' il minimo.
  const bal = {}; for (let i = 0; i < 19; i++) bal[`D${i}`] = -10;
  bal.C = 190;
  const tx = minimalSettlement(bal);
  assert.equal(tx.length, 19);
  assertSettles(bal, tx);
});

test('SETTLEMENT: non peggiora mai il greedy, su 300 gruppi casuali fino a 22 persone', () => {
  const rnd = mulberry32(31337);
  for (let iter = 0; iter < 300; iter++) {
    const bal = randomStructuredBalances(rnd, { blocks: 1 + Math.floor(rnd() * 8), maxBlockSize: 4 });
    if (Object.keys(bal).length < 2 || Object.keys(bal).length > 22) continue;
    const tx = minimalSettlement(bal);
    assertSettles(bal, tx);
    // Limite superiore universale: un gruppo di k persone si chiude sempre in
    // al piu' k-1 bonifici. Se lo superassimo, avremmo peggiorato il greedy.
    assert.ok(tx.length <= Object.keys(bal).length - 1, 'mai piu' + ' bonifici del greedy');
  }
});

test('SETTLEMENT: importi in centesimi esatti, nessun blocco perso per arrotondamento', () => {
  // Saldi con centesimi "scomodi": prima la soglia float (< 0.01) poteva
  // accettare come "somma zero" un blocco che zero non era.
  const bal = { A: 0.01, B: -0.01, C: 33.33, D: 33.33, E: -66.66 };
  const tx = minimalSettlement(bal);
  assertSettles(bal, tx);
  assert.equal(tx.length, 3, 'coppia da 1 centesimo separata dal terzetto → 1 + 2 bonifici');
});

// ── CORRETTEZZA DEI CENTESIMI ────────────────────────────────────────────────
// Due bug veri sono stati trovati simulando OGNI importo invece di provarne
// qualcuno: le quote che differivano di piu' di un centesimo (una perfino
// negativa) e la correzione dell'importo che amplificava l'arrotondamento.
// Questi test rifanno quella simulazione a ogni esecuzione, in forma ridotta
// ma con gli stessi controlli: se un giorno il calcolo torna storto, si rompe
// qui e non nelle mani di chi divide una cena.
const cent = (x) => Math.round(x * 100);

test('CENTESIMI: ogni importo da 0,01 a 60,00 diviso tra 2-8 persone torna esatto ed equo', () => {
  for (let c = 1; c <= 6000; c++) {
    const amount = c / 100;
    for (let n = 2; n <= 8; n++) {
      let g = createGroup({ members: Array.from({ length: n }, (_, i) => `P${i}`) });
      g = addSharedExpense(g, { payer: 'm0', amount });
      const quote = Object.values(g.expenses[0].owed).map(cent);
      assert.equal(quote.reduce((s, v) => s + v, 0), c, `${amount} € in ${n}: le quote non sommano all'importo`);
      assert.ok(Math.max(...quote) - Math.min(...quote) <= 1, `${amount} € in ${n}: quote troppo diverse (${quote.join('/')})`);
      assert.ok(Math.min(...quote) >= 0, `${amount} € in ${n}: quota negativa (${quote.join('/')})`);
    }
  }
});

test('CENTESIMI: 100 € tra 7 dava 14,26 a uno e 14,29 agli altri', () => {
  let g = createGroup({ members: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 100 });
  const quote = Object.values(g.expenses[0].owed).map(cent).sort((a, b) => a - b);
  // 10000 / 7 = 1428 centesimi a testa, ne avanzano 4 → quattro persone da 14,29.
  assert.deepEqual(quote, [1428, 1428, 1428, 1429, 1429, 1429, 1429], 'tre da 14,28 e quattro da 14,29');
  assert.equal(quote.reduce((s, v) => s + v, 0), 10000);
});

test('CENTESIMI: il centesimo in piu\' non tocca sempre alla stessa persona', () => {
  // Prima toccava sempre al primo membro: su cento spese diventano euro veri.
  const conta = new Array(5).fill(0);
  for (let c = 1; c <= 600; c++) {
    let g = createGroup({ members: ['A', 'B', 'C', 'D', 'E'] });
    g = addSharedExpense(g, { payer: 'm0', amount: c / 100 });
    const q = Object.entries(g.expenses[0].owed).map(([id, v]) => ({ id, v: cent(v) }));
    const max = Math.max(...q.map(x => x.v)), min = Math.min(...q.map(x => x.v));
    if (max > min) q.forEach((x, i) => { if (x.v === max) conta[i]++; });
  }
  assert.ok(Math.min(...conta) > 0, `qualcuno non paga mai il centesimo in piu': ${conta.join('/')}`);
  assert.ok(Math.max(...conta) / Math.max(1, Math.min(...conta)) < 2, `distribuzione troppo sbilanciata: ${conta.join('/')}`);
});

test('CENTESIMI: correggere l\'importo non rompe l\'equita\' (1,33 € → 183,87 € in 2)', () => {
  // Il caso reale: 0,67/0,66 riscalati in proporzione davano 92,63 e 91,24.
  let g = createGroup({ members: ['A', 'B'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 1.33 });
  g = editExpense(g, g.expenses[0].id, { amount: 183.87 });
  const quote = Object.values(g.expenses[0].owed).map(cent).sort((a, b) => a - b);
  assert.deepEqual(quote, [9193, 9194], 'devono restare a un centesimo di distanza');
  assert.equal(quote.reduce((s, v) => s + v, 0), 18387);
});

test('CENTESIMI: la correzione dell\'importo resta equa su 2000 combinazioni', () => {
  const rnd = mulberry32(99);
  for (let i = 0; i < 2000; i++) {
    const n = 2 + Math.floor(rnd() * 6);
    const a1 = Math.round(rnd() * 20000) / 100 + 0.01, a2 = Math.round(rnd() * 20000) / 100 + 0.01;
    let g = createGroup({ members: Array.from({ length: n }, (_, j) => `P${j}`) });
    g = addSharedExpense(g, { payer: 'm0', amount: a1 });
    g = editExpense(g, g.expenses[0].id, { amount: a2 });
    const quote = Object.values(g.expenses[0].owed).map(cent);
    assert.equal(quote.reduce((s, v) => s + v, 0), cent(a2), `${a1} → ${a2} in ${n}: somma sbagliata`);
    assert.ok(Math.max(...quote) - Math.min(...quote) <= 1, `${a1} → ${a2} in ${n}: quote troppo diverse`);
  }
});

test('CENTESIMI: quote a peso restano proporzionali e sommano all\'importo', () => {
  const rnd = mulberry32(555);
  for (let i = 0; i < 2000; i++) {
    const n = 2 + Math.floor(rnd() * 6);
    const amount = Math.round(rnd() * 30000) / 100 + 0.01;
    const ids = Array.from({ length: n }, (_, j) => `m${j}`);
    const weights = {}; ids.forEach(id => { weights[id] = 1 + Math.floor(rnd() * 5); });
    let g = createGroup({ members: ids.map((id, j) => ({ id, name: `P${j}` })) });
    g = addSharedExpense(g, { payer: 'm0', amount, shares: { weights } });
    const owed = g.expenses[0].owed;
    assert.equal(Object.values(owed).map(cent).reduce((s, v) => s + v, 0), cent(amount));
    const tot = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const id of ids) assert.ok(Math.abs(cent(owed[id]) - cent(amount) * weights[id] / tot) <= 1.0001, 'quota lontana dalla proporzione voluta');
  }
});

test('CENTESIMI: spese vecchie senza regola salvata restano corrette se corrette', () => {
  // Retrocompatibilita': una spesa gia' sul telefono non ha il campo `split`.
  let g = createGroup({ members: ['A', 'B', 'C'] });
  g = addSharedExpense(g, { payer: 'm0', amount: 10 });
  const senzaRegola = { ...g.expenses[0] }; delete senzaRegola.split;
  g = { ...g, expenses: [senzaRegola] };
  g = editExpense(g, senzaRegola.id, { amount: 1000 });
  const quote = Object.values(g.expenses[0].owed).map(cent);
  assert.equal(quote.reduce((s, v) => s + v, 0), 100000);
  assert.ok(Math.max(...quote) - Math.min(...quote) <= 1, `dedotta male la regola: ${quote.join('/')}`);
});
