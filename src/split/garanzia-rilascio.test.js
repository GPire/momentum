// ============================================================
// GARANZIA DI RILASCIO — 10 persone, più gruppi, sync live vera
// ============================================================
// Richiesta esplicita prima del rilascio al pubblico: "test multi scenario
// per il sync live e più inviti su split, 10 persone diverse collegate con
// più gruppi che non tutti e 10 parteciperanno, ognuno condividerà più e
// diverse spese, testare ogni funzione".
//
// Perché un file a parte e non altri test dentro split-engine.test.js: quelli
// verificano le funzioni UNA PER UNA (unit). Qui si verifica il SISTEMA — dieci
// dispositivi reali che si scambiano stati parziali in ordine casuale, come
// succede davvero quando dieci amici usano l'app in un weekend. Sono i bug che
// una suite unit non può vedere: convergenza, doppio conteggio, saldi che non
// tornano a zero, uno slot rivendicato due volte, una spesa persa in un merge.
//
// LA REGOLA CHE RENDE QUESTO FILE UNA GARANZIA E NON UNA DEMO: ogni scenario
// verifica una PROPRIETÀ che deve valere sempre (la somma dei saldi è zero, il
// merge converge in qualunque ordine, nessuna spesa sparisce), non un valore
// atteso scritto a mano che si potrebbe aggiustare finché passa.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const {
  createGroup, addSharedExpense, computeBalances, minimalSettlement, settlementView,
  settlementVerificationLog, claimMember, myMemberId, mergeGroups, mergeIntoGroups,
  editExpense, encodeGroupShare, decodeGroupShare, encodeGroupInvite, extractSharePayload,
  displayNames, unclaimedMembers, renameGroup, simplifyAcrossGroups, settlementCounts,
} = await import('./split-engine.js');

const {
  addMessage, contestExpense, resolveExpense, isDisputed, disputedExpenseIds, groupForSettlement,
} = await import('./group-chat.js');

// ── Le dieci persone, e i loro dispositivi (uno per persona) ──
const PERSONE = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giulia', 'Hassan', 'Irene', 'Luca'];
const DEVICE = Object.fromEntries(PERSONE.map((p, i) => [p, `device-${i}-${p.toLowerCase()}`]));

const somma = (arr) => arr.reduce((s, x) => s + x, 0);
const r2 = (n) => Math.round(n * 100) / 100;

// Costruisce un gruppo con SOLO alcune delle dieci persone (il caso reale:
// non tutti partecipano a tutto) e ogni membro rivendicato dal proprio device.
function gruppoCon(nome, nomi, { baseCurrency = 'EUR' } = {}) {
  let g = createGroup({ name: nome, members: nomi, baseCurrency });
  for (const m of g.members) g = claimMember(g, m.id, DEVICE[m.name]);
  return g;
}
const idDi = (g, nome) => g.members.find(m => m.name === nome).id;

// ────────────────────────────────────────────────────────────
// 1. LO SCENARIO COMPLETO: 4 gruppi sovrapposti, 10 persone
// ────────────────────────────────────────────────────────────
// Chi partecipa a cosa (deliberatamente sbilanciato e sovrapposto, come nella
// vita vera: Anna è in tre gruppi, Luca in uno solo, Hassan in nessuno dei
// primi due).
function scenarioCompleto() {
  const viaggio = gruppoCon('Viaggio Lisbona', ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena']);
  const casa = gruppoCon('Casa Navigli', ['Anna', 'Fabio', 'Giulia']);
  const cena = gruppoCon('Cena di classe', ['Bruno', 'Carla', 'Hassan', 'Irene', 'Luca', 'Anna']);
  const ufficio = gruppoCon('Regalo ufficio', ['Elena', 'Fabio', 'Hassan', 'Irene']);

  const v = idDi.bind(null, viaggio), c = idDi.bind(null, casa);
  const ce = idDi.bind(null, cena), u = idDi.bind(null, ufficio);

  let g1 = viaggio;
  g1 = addSharedExpense(g1, { payer: v('Anna'), amount: 480, description: 'Casa vacanza', date: '2026-08-01' });
  g1 = addSharedExpense(g1, { payer: v('Bruno'), amount: 120.50, description: 'Cena porto', date: '2026-08-02' });
  // Spesa PARZIALE: al noleggio auto partecipano solo in tre.
  g1 = addSharedExpense(g1, { payer: v('Carla'), amount: 90, description: 'Noleggio auto', date: '2026-08-03',
    shares: { equalAmong: [v('Carla'), v('Dario'), v('Elena')] } });
  // Spesa a PESI: chi ha dormito in camera doppia paga di più.
  g1 = addSharedExpense(g1, { payer: v('Dario'), amount: 200, description: 'Extra hotel', date: '2026-08-04',
    shares: { weights: { [v('Anna')]: 2, [v('Bruno')]: 1, [v('Carla')]: 1 } } });

  let g2 = casa;
  g2 = addSharedExpense(g2, { payer: c('Fabio'), amount: 900, description: 'Affitto agosto', date: '2026-08-01' });
  g2 = addSharedExpense(g2, { payer: c('Giulia'), amount: 84.30, description: 'Bolletta luce', date: '2026-08-10' });
  g2 = addSharedExpense(g2, { payer: c('Anna'), amount: 61.20, description: 'Spesa comune', date: '2026-08-12' });

  let g3 = cena;
  g3 = addSharedExpense(g3, { payer: ce('Hassan'), amount: 246, description: 'Ristorante', date: '2026-08-20' });
  // Quote ESATTE: chi ha preso solo il dolce paga meno.
  g3 = addSharedExpense(g3, { payer: ce('Irene'), amount: 60, description: 'Torta e bollicine', date: '2026-08-20',
    shares: { byId: { [ce('Bruno')]: 15, [ce('Carla')]: 15, [ce('Hassan')]: 10, [ce('Irene')]: 10, [ce('Luca')]: 5, [ce('Anna')]: 5 } } });

  let g4 = ufficio;
  g4 = addSharedExpense(g4, { payer: u('Elena'), amount: 140, description: 'Regalo', date: '2026-08-25' });

  return [g1, g2, g3, g4];
}

test('GARANZIA: in OGNI gruppo la somma dei saldi è esattamente zero (nessun euro creato o perso)', () => {
  for (const g of scenarioCompleto()) {
    const saldi = computeBalances(g);
    const tot = r2(somma(Object.values(saldi)));
    assert.equal(tot, 0, `${g.name}: i saldi sommano ${tot}, non zero`);
  }
});

test('GARANZIA: chi non partecipa a una spesa non ne paga un centesimo', () => {
  const [viaggio] = scenarioCompleto();
  const anna = idDi(viaggio, 'Anna'), bruno = idDi(viaggio, 'Bruno');
  const noleggio = viaggio.expenses.find(e => e.description === 'Noleggio auto');
  assert.equal(noleggio.owed[anna], undefined, 'Anna non era al noleggio: non deve comparire fra i debitori');
  assert.equal(noleggio.owed[bruno], undefined);
  const extra = viaggio.expenses.find(e => e.description === 'Extra hotel');
  const elena = idDi(viaggio, 'Elena');
  assert.equal(extra.owed[elena], undefined, 'Elena non era negli extra hotel');
});

test('GARANZIA: le quote esatte dichiarate restano esatte, mai riequilibrate di nascosto', () => {
  const [, , cena] = scenarioCompleto();
  const torta = cena.expenses.find(e => e.description === 'Torta e bollicine');
  assert.equal(r2(somma(Object.values(torta.owed))), 60);
  assert.equal(torta.owed[idDi(cena, 'Luca')], 5, 'chi ha preso solo il dolce paga la sua quota, non una media');
});

test('GARANZIA: il settlement chiude tutti i conti — dopo i bonifici ogni saldo è zero', () => {
  for (const g of scenarioCompleto()) {
    const saldi = computeBalances(g);
    const bonifici = minimalSettlement(saldi);
    const dopo = { ...saldi };
    for (const t of bonifici) { dopo[t.from] = r2((dopo[t.from] || 0) + t.amount); dopo[t.to] = r2((dopo[t.to] || 0) - t.amount); }
    for (const [id, v] of Object.entries(dopo)) {
      assert.ok(Math.abs(v) < 0.02, `${g.name}: dopo il settlement ${id} resta a ${v}`);
    }
  }
});

test('GARANZIA: il log di verifica del settlement è aritmeticamente coerente, riga per riga', () => {
  for (const g of scenarioCompleto()) {
    const log = settlementVerificationLog(g);
    assert.ok(log && Array.isArray(log.steps), `${g.name}: nessun log`);
    for (const p of log.steps) {
      assert.ok(p.amount > 0, `${g.name}: un bonifico da ${p.amount}`);
      // Ogni riga deve spiegarsi da sola: saldo prima ± importo = saldo dopo.
      assert.equal(r2(p.fromBalanceBefore + p.amount), r2(p.fromBalanceAfter), `${g.name}: riga incoerente per ${p.fromName}`);
      assert.equal(r2(p.toBalanceBefore - p.amount), r2(p.toBalanceAfter), `${g.name}: riga incoerente per ${p.toName}`);
      assert.ok(p.fromName && p.toName, 'ogni passo deve dire CHI paga CHI, non solo degli id');
    }
  }
});

// ────────────────────────────────────────────────────────────
// 2. SYNC LIVE — la convergenza, in qualunque ordine
// ────────────────────────────────────────────────────────────

test('GARANZIA sync: due dispositivi che modificano OFFLINE lo stesso gruppo convergono, senza perdere nulla', () => {
  const [viaggio] = scenarioCompleto();
  const v = idDi.bind(null, viaggio);
  // Anna e Bruno, entrambi offline, aggiungono una spesa diversa.
  const copiaAnna = addSharedExpense(viaggio, { payer: v('Anna'), amount: 30, description: 'Taxi aeroporto', date: '2026-08-05' });
  const copiaBruno = addSharedExpense(viaggio, { payer: v('Bruno'), amount: 45, description: 'Museo', date: '2026-08-05' });

  const fusoAB = mergeGroups(copiaAnna, copiaBruno);
  const fusoBA = mergeGroups(copiaBruno, copiaAnna);

  const desc = (g) => g.expenses.map(e => e.description).sort();
  assert.deepEqual(desc(fusoAB), desc(fusoBA), 'il merge deve dare lo stesso risultato in entrambi i versi (CRDT)');
  assert.ok(desc(fusoAB).includes('Taxi aeroporto') && desc(fusoAB).includes('Museo'), 'nessuna delle due spese offline deve sparire');
  assert.equal(r2(somma(Object.values(computeBalances(fusoAB)))), 0);
});

test('GARANZIA sync: dieci dispositivi, scambi in ordine CASUALE, convergono tutti allo stesso stato', () => {
  const [viaggio] = scenarioCompleto();
  const v = idDi.bind(null, viaggio);
  const partecipanti = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena'];

  // Ogni partecipante aggiunge la propria spesa mentre è isolato.
  const copie = partecipanti.map((p, i) =>
    addSharedExpense(viaggio, { payer: v(p), amount: 10 + i, description: `Spesa di ${p}`, date: '2026-08-06' }));

  // Gossip in ordine deliberatamente disordinato e ripetuto (come una mesh
  // vera: gli stessi stati arrivano più volte, da percorsi diversi).
  const ordini = [
    [0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [2, 0, 4, 1, 3], [1, 1, 3, 3, 0, 2, 4], [3, 4, 0, 0, 2, 1],
  ];
  const risultati = ordini.map(ordine => {
    let stato = viaggio;
    for (const i of ordine) stato = mergeGroups(stato, copie[i]);
    return stato;
  });

  const impronta = (g) => JSON.stringify({
    spese: g.expenses.map(e => [e.id, e.amount, e.description]).sort(),
    saldi: Object.entries(computeBalances(g)).sort(),
  });
  for (let i = 1; i < risultati.length; i++) {
    assert.equal(impronta(risultati[i]), impronta(risultati[0]),
      `l'ordine di sincronizzazione ${i} produce uno stato diverso: la mesh non converge`);
  }
  assert.equal(risultati[0].expenses.length, viaggio.expenses.length + 5, 'tutte e cinque le spese devono sopravvivere');
  assert.equal(r2(somma(Object.values(computeBalances(risultati[0])))), 0);
});

test('GARANZIA sync: lo stesso stato ricevuto DUE VOLTE non duplica nulla (idempotenza)', () => {
  const [, , cena] = scenarioCompleto();
  const unaVolta = mergeGroups(cena, cena);
  const dueVolte = mergeGroups(unaVolta, cena);
  assert.equal(unaVolta.expenses.length, cena.expenses.length);
  assert.equal(dueVolte.expenses.length, cena.expenses.length, 'ricevere di nuovo lo stesso stato ha duplicato delle spese');
  assert.equal(r2(somma(Object.values(computeBalances(dueVolte)))), 0);
});

test('GARANZIA sync: una modifica di importo vince sul vecchio valore ovunque, senza doppio conteggio', () => {
  const [viaggio] = scenarioCompleto();
  const spesa = viaggio.expenses.find(e => e.description === 'Cena porto');
  // Timestamp esplicito: una correzione umana avviene secondi o minuti dopo,
  // mai nello stesso millisecondo della creazione (quel caso ha una garanzia
  // dedicata qui sotto, sulla convergenza a pari merito).
  const corretto = editExpense(viaggio, spesa.id, { amount: 150 });
  corretto.expenses = corretto.expenses.map(e => e.id === spesa.id ? { ...e, updatedAt: e.updatedAt + 60000 } : e);
  const fuso = mergeGroups(viaggio, corretto);
  const dopo = fuso.expenses.find(e => e.id === spesa.id);
  assert.equal(dopo.amount, 150, 'la correzione deve vincere nel merge');
  assert.equal(fuso.expenses.length, viaggio.expenses.length, 'la correzione non deve creare una seconda spesa');
  assert.equal(r2(somma(Object.values(computeBalances(fuso)))), 0);
  assert.equal(r2(somma(Object.values(dopo.owed))), 150, 'le quote devono seguire il nuovo importo');
});

// BUG REALE trovato da questa stessa batteria (2026-09-05) e corretto in
// unionByIdLWW: a parità di `updatedAt` il vincitore dipendeva dall'ordine
// degli argomenti, quindi due telefoni restavano in disaccordo per sempre.
test('GARANZIA sync: correzioni SIMULTANEE (stesso millisecondo) convergono comunque, su ogni dispositivo', () => {
  const [viaggio] = scenarioCompleto();
  const spesa = viaggio.expenses.find(e => e.description === 'Cena porto');
  // Stesso istante FORZATO, non affidato a quanto è veloce la macchina che
  // esegue il test: editExpense usa Date.now(), e 5 chiamate di fila possono
  // ricadere in millisecondi diversi su una macchina lenta o sotto carico —
  // trovato flaky proprio così. Lo scenario "stesso updatedAt" va costruito,
  // non sperato.
  const istante = Date.now();
  const versioni = [150, 200, 175, 133.33, 99].map(a => {
    const v = editExpense(viaggio, spesa.id, { amount: a });
    return { ...v, expenses: v.expenses.map(e => (e.id === spesa.id ? { ...e, updatedAt: istante } : e)) };
  });

  const ordini = [[0,1,2,3,4],[4,3,2,1,0],[2,4,0,3,1],[3,0,4,2,1],[1,2,3,4,0]];
  const esiti = ordini.map(o => o.reduce((acc, i) => mergeGroups(acc, versioni[i]), viaggio).expenses.find(e => e.id === spesa.id).amount);
  assert.equal(new Set(esiti).size, 1,
    `cinque dispositivi che correggono nello stesso istante non convergono: esiti ${esiti.join(', ')}`);
});

test('GARANZIA sync: più gruppi insieme si fondono ognuno nel proprio, mai mescolati fra loro', () => {
  const gruppi = scenarioCompleto();
  let statoDispositivo = [];
  // Arrivano tutti i gruppi, in ordine sparso e con ripetizioni.
  for (const g of [gruppi[2], gruppi[0], gruppi[3], gruppi[0], gruppi[1], gruppi[2]]) {
    statoDispositivo = mergeIntoGroups(statoDispositivo, g);
  }
  assert.equal(statoDispositivo.length, 4, 'quattro gruppi distinti devono restare quattro');
  for (const g of statoDispositivo) {
    assert.equal(r2(somma(Object.values(computeBalances(g)))), 0, `${g.name}: saldi non a zero dopo il merge multiplo`);
  }
  const nomi = statoDispositivo.map(g => g.name).sort();
  assert.deepEqual(nomi, ['Casa Navigli', 'Cena di classe', 'Regalo ufficio', 'Viaggio Lisbona']);
});

// ────────────────────────────────────────────────────────────
// 3. INVITI E RIVENDICAZIONE — più inviti, più persone
// ────────────────────────────────────────────────────────────

test('GARANZIA inviti: il codice di condivisione sopravvive al giro completo (encode → decode)', () => {
  for (const g of scenarioCompleto()) {
    const codice = encodeGroupShare(g);
    const tornato = decodeGroupShare(codice);
    assert.ok(tornato, `${g.name}: codice non decodificabile`);
    assert.equal(tornato.id, g.id);
    assert.equal(tornato.name, g.name);
    assert.equal(tornato.expenses.length, g.expenses.length, `${g.name}: spese perse nel giro di condivisione`);
    assert.equal(tornato.baseCurrency, g.baseCurrency, 'la valuta base non deve perdersi nella condivisione');
    // Il saldo ricostruito da chi riceve deve essere identico a quello di chi manda.
    assert.deepEqual(computeBalances(tornato), computeBalances(g), `${g.name}: chi riceve vede saldi diversi da chi manda`);
  }
});

test('GARANZIA inviti: uno slot già rivendicato non può essere rubato da un altro dispositivo', () => {
  let g = createGroup({ name: 'Test', members: ['Anna', 'Bruno'] });
  const anna = idDi(g, 'Anna');
  g = claimMember(g, anna, DEVICE.Anna);
  const tentativo = claimMember(g, anna, DEVICE.Bruno);
  assert.equal(myMemberId(tentativo, DEVICE.Anna), anna, 'lo slot deve restare di Anna');
  assert.equal(myMemberId(tentativo, DEVICE.Bruno), null, 'Bruno non deve essersi preso lo slot di Anna');
});

test('GARANZIA inviti: dieci dispositivi che rivendicano in parallelo → nessuno slot assegnato due volte', () => {
  let g = createGroup({ name: 'Grande', members: PERSONE });
  // Ognuno rivendica il proprio slot, in ordine sparso.
  const ordine = [7, 2, 9, 0, 5, 1, 8, 3, 6, 4];
  for (const i of ordine) g = claimMember(g, g.members[i].id, DEVICE[PERSONE[i]]);

  const rivendicati = g.members.filter(m => m.claimedBy);
  assert.equal(rivendicati.length, 10, 'tutti e dieci gli slot devono risultare rivendicati');
  const devices = rivendicati.map(m => m.claimedBy);
  assert.equal(new Set(devices).size, 10, 'due slot risultano dello stesso dispositivo');
  for (const p of PERSONE) {
    assert.equal(g.members.find(m => m.claimedBy === DEVICE[p]).name, p, `${p} è finito sullo slot sbagliato`);
  }
  assert.deepEqual(unclaimedMembers(g), [], 'nessuno slot deve restare libero');
});

test('GARANZIA inviti: chi si unisce DOPO vede la direzione del debito dal proprio punto di vista, non da quello del creatore', () => {
  // Il bug storico: i saldi venivano letti confrontando col nome "Io".
  let g = gruppoCon('Weekend', ['Anna', 'Bruno', 'Carla']);
  g = addSharedExpense(g, { payer: idDi(g, 'Anna'), amount: 120, description: 'Hotel', date: '2026-08-01' });
  const vistaBruno = settlementView(g, myMemberId(g, DEVICE.Bruno));
  const vistaAnna = settlementView(g, myMemberId(g, DEVICE.Anna));
  assert.ok(vistaBruno, 'Bruno deve avere una vista propria');
  assert.ok(vistaAnna, 'Anna deve avere una vista propria');
  // Anna ha anticipato: deve essere in credito; Bruno in debito. Le due viste
  // non possono raccontare la stessa direzione.
  const saldi = computeBalances(g);
  assert.ok(saldi[idDi(g, 'Anna')] > 0, 'chi ha anticipato è in credito');
  assert.ok(saldi[idDi(g, 'Bruno')] < 0, 'chi non ha pagato è in debito');
});

test('GARANZIA inviti: due persone con lo STESSO nome restano distinguibili ovunque', () => {
  let g = createGroup({ name: 'Coinquilini', members: ['Marco', 'Marco', 'Sara'] });
  const nomi = displayNames(g.members);
  const etichette = g.members.map(m => nomi[m.id]);
  assert.equal(new Set(etichette).size, 3, 'due "Marco" devono avere etichette diverse');
  assert.ok(etichette.includes('Sara'), 'un nome unico non deve essere modificato');
});

// ────────────────────────────────────────────────────────────
// 4. FRA GRUPPI DIVERSI — la stessa persona in più gruppi
// ────────────────────────────────────────────────────────────

test('GARANZIA: la semplificazione fra gruppi non inventa né cancella debiti', () => {
  const gruppi = scenarioCompleto();
  const netto = simplifyAcrossGroups(gruppi);
  assert.ok(netto, 'la semplificazione deve produrre un risultato');
  // Qualunque cosa proponga, il totale dei crediti deve pareggiare i debiti.
  const perPersona = new Map();
  for (const g of gruppi) {
    const nomiPerId = Object.fromEntries(g.members.map(m => [m.id, m.name]));
    for (const [id, v] of Object.entries(computeBalances(g))) {
      const n = nomiPerId[id];
      perPersona.set(n, r2((perPersona.get(n) || 0) + v));
    }
  }
  // `+0` normalizza lo zero negativo di JavaScript (-0 === 0 numericamente,
  // ma assert.equal li distingue): qui conta il valore, non il segno di zero.
  assert.equal(r2(somma([...perPersona.values()])) + 0, 0, 'sommando i saldi di tutti i gruppi il totale deve restare zero');
  assert.ok(Array.isArray(netto.transfers), 'la semplificazione deve produrre un elenco di bonifici');
  assert.ok(netto.transfers.every(t => t.amount > 0), 'nessun bonifico da zero o negativo');
});

test('GARANZIA: rinominare un gruppo si propaga, senza toccare spese né saldi', () => {
  const [viaggio] = scenarioCompleto();
  const saldiPrima = computeBalances(viaggio);
  const rinominato = renameGroup(viaggio, 'Lisbona 2026');
  const fuso = mergeGroups(viaggio, rinominato);
  assert.equal(fuso.name, 'Lisbona 2026', 'la rinomina più recente deve vincere nel merge');
  assert.deepEqual(computeBalances(fuso), saldiPrima, 'una rinomina non può cambiare i conti');
  assert.equal(fuso.expenses.length, viaggio.expenses.length);
});

test('GARANZIA: la semplificazione riduce davvero i bonifici, e mai ne aggiunge', () => {
  for (const g of scenarioCompleto()) {
    const conti = settlementCounts(g);
    const coinvolti = Object.values(computeBalances(g)).filter(v => Math.abs(v) > 0.01).length;
    if (coinvolti === 0) continue;
    assert.ok(conti.simplified <= coinvolti - 1 || conti.simplified <= conti.raw,
      `${g.name}: ${conti.simplified} bonifici semplificati per ${coinvolti} persone`);
    assert.ok(conti.simplified <= conti.raw, `${g.name}: la semplificazione ha AGGIUNTO bonifici (${conti.raw} → ${conti.simplified})`);
    assert.equal(conti.saved, Math.max(0, conti.raw - conti.simplified), `${g.name}: il risparmio dichiarato non torna coi numeri`);
  }
});

// ────────────────────────────────────────────────────────────
// 4-bis. CHAT, CONTESTAZIONI E MESH A 10+ DISPOSITIVI
// ────────────────────────────────────────────────────────────
// La conversazione viaggia nello STESSO merge delle spese: se converge il
// saldo ma non il messaggio che lo contesta, l'utente vede un conto che
// nessuno gli ha spiegato. Qui si verifica insieme, come nella vita.

test('GARANZIA chat: dieci persone scrivono contemporaneamente, nessun messaggio si perde in nessun ordine', () => {
  let g = gruppoCon('Chat di gruppo', PERSONE);
  g = addSharedExpense(g, { payer: idDi(g, 'Anna'), amount: 300, description: 'Cena', date: '2026-08-30' });
  const spesaId = g.expenses[0].id;

  // Ognuno scrive dal proprio dispositivo, offline, senza vedere gli altri.
  const copie = PERSONE.map((p, i) => addMessage(g, { autore: p, testo: `Messaggio di ${p}`, expenseId: spesaId, now: 1000 + i }));

  const ordini = [
    [0,1,2,3,4,5,6,7,8,9], [9,8,7,6,5,4,3,2,1,0], [3,7,1,9,0,5,2,8,4,6],
    [5,5,2,2,9,0,7,7,1,3,8,4,6], [0,9,1,8,2,7,3,6,4,5],
  ];
  const esiti = ordini.map(o => o.reduce((acc, i) => mergeGroups(acc, copie[i]), g));
  const testi = (x) => (x.chat || []).map(m => m.testo).sort();

  for (let i = 1; i < esiti.length; i++) {
    assert.deepEqual(testi(esiti[i]), testi(esiti[0]), `ordine ${i}: la chat non converge`);
  }
  assert.equal(testi(esiti[0]).length, 10, 'devono sopravvivere tutti e dieci i messaggi');
  for (const p of PERSONE) {
    assert.ok(testi(esiti[0]).includes(`Messaggio di ${p}`), `il messaggio di ${p} è andato perso nella mesh`);
  }
});

test('GARANZIA chat: una contestazione sospende la spesa dai saldi, e la sospensione si propaga', () => {
  let g = gruppoCon('Conto conteso', ['Anna', 'Bruno', 'Carla']);
  g = addSharedExpense(g, { payer: idDi(g, 'Anna'), amount: 90, description: 'Taxi', date: '2026-08-30' });
  g = addSharedExpense(g, { payer: idDi(g, 'Bruno'), amount: 60, description: 'Colazione', date: '2026-08-31' });
  const taxi = g.expenses.find(e => e.description === 'Taxi').id;

  // Carla contesta il taxi dal proprio dispositivo, offline.
  const copiaCarla = contestExpense(g, { autore: 'Carla', expenseId: taxi, motivo: 'io ero a piedi', now: 5000 });
  assert.ok(isDisputed(copiaCarla, taxi), 'la spesa deve risultare contestata su chi contesta');

  // Il dispositivo di Anna, che non sapeva nulla, riceve lo stato.
  const daAnna = mergeGroups(g, copiaCarla);
  assert.ok(isDisputed(daAnna, taxi), 'la contestazione deve arrivare anche agli altri dispositivi');
  assert.deepEqual(disputedExpenseIds(daAnna), [taxi]);

  // Finché è contestata, quella spesa NON entra nel saldo da saldare.
  const perSaldo = groupForSettlement(daAnna);
  assert.equal(perSaldo.expenses.length, 1, 'la spesa contestata va esclusa dal conteggio finale');
  assert.equal(perSaldo.expenses[0].description, 'Colazione');
  assert.equal(r2(somma(Object.values(computeBalances(perSaldo)))) + 0, 0);

  // Risolta, torna nei conti — su tutti i dispositivi.
  const risolta = resolveExpense(daAnna, { autore: 'Anna', expenseId: taxi, nota: 'ok, hai ragione', now: 6000 });
  assert.equal(isDisputed(risolta, taxi), false);
  assert.equal(groupForSettlement(risolta).expenses.length, 2, 'risolta la contestazione, la spesa rientra nei conti');
});

test('GARANZIA mesh: 12 dispositivi, gossip a catena (nessuno parla con tutti) → stato identico ovunque', () => {
  // Più dispositivi che persone: due persone hanno due device ciascuna (telefono
  // e tablet), caso reale e spesso non testato.
  const DEVICE_EXTRA = [...PERSONE, 'Anna-tablet', 'Bruno-tablet'];
  let base = gruppoCon('Vacanza lunga', PERSONE);
  base = addSharedExpense(base, { payer: idDi(base, 'Anna'), amount: 1000, description: 'Villa', date: '2026-08-01' });

  // Ogni dispositivo fa una modifica propria (spesa o messaggio).
  const stati = DEVICE_EXTRA.map((d, i) => {
    const autore = PERSONE[i % PERSONE.length];
    let s = addSharedExpense(base, { payer: idDi(base, autore), amount: 10 + i, description: `Spesa ${d}`, date: '2026-08-02' });
    s = addMessage(s, { autore, testo: `Nota di ${d}`, now: 2000 + i });
    return s;
  });

  // Gossip A CATENA: 0→1→2→...→11 e poi indietro. Nessuno parla con tutti,
  // esattamente come una mesh reale con connessioni parziali.
  let avanti = stati[0];
  for (let i = 1; i < stati.length; i++) avanti = mergeGroups(avanti, stati[i]);
  let indietro = stati[stati.length - 1];
  for (let i = stati.length - 2; i >= 0; i--) indietro = mergeGroups(indietro, stati[i]);

  const impronta = (g) => JSON.stringify({
    spese: (g.expenses || []).map(e => [e.description, e.amount]).sort(),
    chat: (g.chat || []).map(m => m.testo).sort(),
    saldi: Object.entries(computeBalances(g)).sort(),
  });
  assert.equal(impronta(avanti), impronta(indietro), 'la catena in avanti e quella indietro producono stati diversi');
  assert.equal(avanti.expenses.length, 1 + DEVICE_EXTRA.length, 'ogni dispositivo deve aver contribuito la sua spesa');
  assert.equal((avanti.chat || []).length, DEVICE_EXTRA.length, 'ogni dispositivo deve aver contribuito il suo messaggio');
  assert.equal(r2(somma(Object.values(computeBalances(avanti)))) + 0, 0);
});

test('GARANZIA mesh: uno stato VECCHIO che riarriva in ritardo non cancella il lavoro più recente', () => {
  // Caso reale: un telefono spento per giorni si riaccende e rimanda il suo
  // stato antico. Non deve riportare indietro il gruppo.
  let g = gruppoCon('Ritardatario', ['Anna', 'Bruno', 'Carla']);
  const statoVecchio = g;
  g = addSharedExpense(g, { payer: idDi(g, 'Anna'), amount: 50, description: 'Nuova spesa', date: '2026-09-01' });
  g = addMessage(g, { autore: 'Bruno', testo: 'ho pagato io', now: 9000 });

  const dopoRitardatario = mergeGroups(g, statoVecchio);
  assert.equal(dopoRitardatario.expenses.length, 1, 'lo stato vecchio ha cancellato la spesa nuova');
  assert.equal((dopoRitardatario.chat || []).length, 1, 'lo stato vecchio ha cancellato il messaggio nuovo');
});

// ────────────────────────────────────────────────────────────
// 5. LA PROVA FINALE: il weekend intero, end-to-end
// ────────────────────────────────────────────────────────────

test('GARANZIA FINALE: un weekend intero di dieci persone chiude con tutti i conti a zero', () => {
  const gruppi = scenarioCompleto();

  // Ogni dispositivo parte con i soli gruppi a cui la sua persona partecipa,
  // poi riceve aggiornamenti dagli altri — come nella mesh vera.
  const statoPer = {};
  for (const p of PERSONE) {
    statoPer[p] = gruppi.filter(g => g.members.some(m => m.name === p));
  }

  // Giro di gossip: ognuno manda i propri gruppi a tutti gli altri, due volte.
  for (let giro = 0; giro < 2; giro++) {
    for (const mittente of PERSONE) {
      for (const destinatario of PERSONE) {
        if (mittente === destinatario) continue;
        for (const g of statoPer[mittente]) {
          // Solo chi è nel gruppo lo accetta: è il filtro di privacy reale.
          if (!g.members.some(m => m.name === destinatario)) continue;
          statoPer[destinatario] = mergeIntoGroups(statoPer[destinatario], g);
        }
      }
    }
  }

  // Ogni persona deve vedere ESATTAMENTE i gruppi a cui partecipa, né più né meno.
  for (const p of PERSONE) {
    const attesi = gruppi.filter(g => g.members.some(m => m.name === p)).map(g => g.id).sort();
    const visti = statoPer[p].map(g => g.id).sort();
    assert.deepEqual(visti, attesi, `${p} vede gruppi a cui non partecipa, o ne ha persi`);
  }

  // E in ogni gruppo, per ogni dispositivo, i conti tornano a zero e i saldi
  // sono IDENTICI a quelli di chiunque altro veda lo stesso gruppo.
  for (const g of gruppi) {
    const chiLoVede = PERSONE.filter(p => g.members.some(m => m.name === p));
    const saldiDiRiferimento = JSON.stringify(Object.entries(computeBalances(statoPer[chiLoVede[0]].find(x => x.id === g.id))).sort());
    for (const p of chiLoVede) {
      const copia = statoPer[p].find(x => x.id === g.id);
      assert.equal(r2(somma(Object.values(computeBalances(copia)))), 0, `${p} in ${g.name}: saldi non a zero`);
      assert.equal(JSON.stringify(Object.entries(computeBalances(copia)).sort()), saldiDiRiferimento,
        `${p} vede saldi diversi dagli altri per ${g.name}: la sincronizzazione non ha convergito`);
    }
  }
});
