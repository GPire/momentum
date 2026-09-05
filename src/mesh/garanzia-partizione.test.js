// ============================================================
// GARANZIA DI PARTIZIONE — la rete cade a metà, non tutta insieme
// ============================================================
// Le batterie esistenti (garanzia-rilascio.test.js, garanzia-trasporto.test.js)
// verificano dispositivi offline/online e messaggi corrotti, ma mai lo
// scenario più comune su una rete mesh reale: non "tutti giù" o "tutti su",
// ma il gruppo che si SPACCA in due bolle che continuano a lavorare separate
// (un tunnel, un Wi-Fi che cambia, un relay NAT che muore per metà dei peer)
// e poi si RISALDANO. Ognuna delle due bolle deve restare pienamente
// funzionante da sola — nessuna aspetta il permesso dell'altra per esistere —
// e quando tornano a vedersi nessuna operazione fatta da nessuna delle due
// parti deve sparire, duplicarsi, o dipendere da CHI si riconnette a chi.
//
// Stesso principio della batteria sorella: proprietà vere sempre, mai un
// valore scritto a mano.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.navigator = globalThis.navigator || { maxTouchPoints: 0 };

const {
  createGroup, addSharedExpense, computeBalances, claimMember, mergeGroups, editExpense,
  minimalSettlementDetailed,
} = await import('./../split/split-engine.js');
const { addMessage, contestExpense, isDisputed, groupForSettlement } = await import('./../split/group-chat.js');

const PERSONE = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena'];
const DEVICE = Object.fromEntries(PERSONE.map((p, i) => [p, `device-${i}-${p.toLowerCase()}`]));
const somma = (arr) => arr.reduce((s, x) => s + x, 0);
// "+ 0" alla fine: Math.round di un residuo negativo minuscolo può dare -0,
// che supererebbe un assert.equal(..., 0) in modalità strict (Object.is
// distingue -0 da 0) pur essendo numericamente zero — trovato proprio in
// uno degli scenari qui sotto. "-0 + 0" in JS dà sempre "0" per costruzione.
const r2 = (n) => Math.round(n * 100) / 100 + 0;
const idDi = (g, nome) => g.members.find(m => m.name === nome).id;

function gruppoBase() {
  let g = createGroup({ name: 'Weekend in baita', members: PERSONE, baseCurrency: 'EUR' });
  for (const m of g.members) g = claimMember(g, m.id, DEVICE[m.name]);
  g = addSharedExpense(g, { payer: idDi(g, 'Anna'), amount: 100, description: 'Legna e spesa comune' });
  return g;
}

// Fonde N stati divergenti in un ordine, usando fold sequenziale su mergeGroups
// (esattamente come farebbe un dispositivo che riceve gli aggiornamenti degli
// altri uno alla volta, in un ordine qualunque).
const fondiIn = (ordine, stati) => ordine.reduce((acc, i) => mergeGroups(acc, stati[i]), stati[ordine[0]]);

test('PARTIZIONE: due bolle isolate lavorano in parallelo, ognuna vede solo le proprie operazioni', () => {
  const base = gruppoBase();
  // La rete si spacca: {Anna, Bruno} restano connesse fra loro ma non vedono
  // {Carla, Dario, Elena}, e viceversa. Ogni bolla continua a operare da sola.
  let bollaA = addSharedExpense(base, { payer: idDi(base, 'Bruno'), amount: 40, description: 'Birre (bolla A)' });
  bollaA = addMessage(bollaA, { autore: 'Anna', testo: 'Ci pensiamo noi al ghiaccio' });

  let bollaB = addSharedExpense(base, { payer: idDi(base, 'Carla'), amount: 65, description: 'Benzina (bolla B)' });
  bollaB = addSharedExpense(bollaB, { payer: idDi(base, 'Dario'), amount: 22, description: 'Pane (bolla B)' });
  bollaB = addMessage(bollaB, { autore: 'Elena', testo: 'Arriviamo verso le 19' });

  // Prima della riconnessione: ognuna vede SOLO le proprie spese in più —
  // nessuna fuga di dati dall'altra bolla che non esiste ancora per lei.
  assert.equal(bollaA.expenses.length, base.expenses.length + 1);
  assert.equal(bollaB.expenses.length, base.expenses.length + 2);
  assert.ok(bollaA.expenses.every(e => e.description !== 'Benzina (bolla B)'));
  assert.ok(bollaB.expenses.every(e => e.description !== 'Birre (bolla A)'));
});

test('PARTIZIONE: al ripristino, ogni operazione di ENTRAMBE le bolle sopravvive, nessuna duplicata', () => {
  const base = gruppoBase();
  let bollaA = addSharedExpense(base, { payer: idDi(base, 'Bruno'), amount: 40, description: 'Birre (bolla A)' });
  bollaA = addMessage(bollaA, { autore: 'Anna', testo: 'Ci pensiamo noi al ghiaccio' });

  let bollaB = addSharedExpense(base, { payer: idDi(base, 'Carla'), amount: 65, description: 'Benzina (bolla B)' });
  bollaB = addSharedExpense(bollaB, { payer: idDi(base, 'Dario'), amount: 22, description: 'Pane (bolla B)' });
  bollaB = addMessage(bollaB, { autore: 'Elena', testo: 'Arriviamo verso le 19' });

  // La rete torna: entrambe le direzioni di riconnessione devono convergere
  // allo STESSO stato finale (proprietà di commutatività del merge).
  const fusoAB = mergeGroups(bollaA, bollaB);
  const fusoBA = mergeGroups(bollaB, bollaA);

  for (const fuso of [fusoAB, fusoBA]) {
    assert.equal(fuso.expenses.length, base.expenses.length + 3, 'tutte e 3 le spese nuove devono esserci, nessuna persa e nessuna duplicata');
    assert.ok(fuso.expenses.some(e => e.description === 'Birre (bolla A)'));
    assert.ok(fuso.expenses.some(e => e.description === 'Benzina (bolla B)'));
    assert.ok(fuso.expenses.some(e => e.description === 'Pane (bolla B)'));
    assert.equal(fuso.chat?.length ?? 0, 2, 'i messaggi di entrambe le bolle devono arrivare');
    assert.equal(r2(somma(Object.values(computeBalances(fuso)))), 0, 'i saldi tornano sempre a zero');
  }
  assert.deepEqual(
    fusoAB.expenses.map(e => e.id).sort(),
    fusoBA.expenses.map(e => e.id).sort(),
    'la direzione della riconnessione non deve cambiare il risultato',
  );
});

test('PARTIZIONE: una contestazione nata in UNA bolla sospende la spesa anche per chi era nell\'altra', () => {
  const base = gruppoBase();
  const spesaContestata = base.expenses[0].id;

  // Bolla A: nessuno la tocca. Bolla B: qualcuno la contesta mentre è isolata.
  const bollaA = addSharedExpense(base, { payer: idDi(base, 'Bruno'), amount: 15, description: 'Ghiaccio' });
  const bollaB = contestExpense(base, { autore: 'Carla', expenseId: spesaContestata, motivo: 'importo sbagliato, ricontrolliamo' });

  const fuso = mergeGroups(bollaA, bollaB);
  assert.ok(isDisputed(fuso, spesaContestata), 'la contestazione nata offline deve propagarsi al ripristino');
  const perSaldo = groupForSettlement(fuso);
  assert.ok(!perSaldo.expenses.some(e => e.id === spesaContestata), 'la spesa contestata resta esclusa dal saldo anche dopo il merge');
});

test('PARTIZIONE: una correzione fatta OFFLINE in una bolla non viene persa se l\'altra bolla nel frattempo ha solo aggiunte', () => {
  const base = gruppoBase();
  const spesaId = base.expenses[0].id;

  // Bolla A corregge un importo mentre è isolata.
  const bollaA = editExpense(base, spesaId, { amount: 130 });
  // Bolla B, ignara, continua ad aggiungere altre spese nel frattempo.
  let bollaB = addSharedExpense(base, { payer: idDi(base, 'Elena'), amount: 18, description: 'Caffè' });
  bollaB = addSharedExpense(bollaB, { payer: idDi(base, 'Dario'), amount: 9, description: 'Giornali' });

  const fuso = mergeGroups(bollaA, bollaB);
  const dopo = fuso.expenses.find(e => e.id === spesaId);
  assert.equal(dopo.amount, 130, 'la correzione fatta offline non deve tornare indietro solo perché l\'altra bolla aveva più aggiornamenti');
  assert.equal(fuso.expenses.length, base.expenses.length + 2, 'le due aggiunte della bolla B restano entrambe');
});

test('PARTIZIONE RIPETUTA: la rete cade e torna più volte, il risultato finale non dipende da quante volte è successo', () => {
  // Rete instabile reale: non una sola caduta e un solo ripristino, ma un
  // ciclo di 3 partizioni consecutive con ricombinazioni diverse ogni volta —
  // il tipo di instabilità che descrive davvero una connessione mobile debole.
  let base = gruppoBase();

  // Ciclo 1: {Anna,Bruno} vs {Carla,Dario,Elena}
  let a1 = addSharedExpense(base, { payer: idDi(base, 'Anna'), amount: 12, description: 'Ciclo1-A' });
  let b1 = addSharedExpense(base, { payer: idDi(base, 'Carla'), amount: 8, description: 'Ciclo1-B' });
  const dopoCiclo1 = mergeGroups(a1, b1);

  // Ciclo 2: si riparte da uno stato comune, la rete si rispacca con un'altra
  // geometria (stavolta Elena è isolata da sola).
  let a2 = addSharedExpense(dopoCiclo1, { payer: idDi(dopoCiclo1, 'Bruno'), amount: 20, description: 'Ciclo2-A' });
  let b2 = addMessage(dopoCiclo1, { autore: 'Elena', testo: 'Sono rimasta senza rete un\'ora' });
  const dopoCiclo2Ordine1 = mergeGroups(a2, b2);
  const dopoCiclo2Ordine2 = mergeGroups(b2, a2);

  // Ciclo 3: ultima caduta e ultimo ripristino, con un'ulteriore modifica.
  let a3 = editExpense(dopoCiclo2Ordine1, base.expenses[0].id, { amount: 111 });
  let b3 = addSharedExpense(dopoCiclo2Ordine2, { payer: idDi(base, 'Dario'), amount: 5, description: 'Ciclo3-B' });
  const finaleOrdine1 = mergeGroups(a3, b3);
  const finaleOrdine2 = mergeGroups(b3, a3);

  for (const finale of [finaleOrdine1, finaleOrdine2]) {
    assert.equal(r2(somma(Object.values(computeBalances(finale)))), 0);
    assert.ok(finale.expenses.some(e => e.description === 'Ciclo1-A'));
    assert.ok(finale.expenses.some(e => e.description === 'Ciclo1-B'));
    assert.ok(finale.expenses.some(e => e.description === 'Ciclo2-A'));
    assert.ok(finale.expenses.some(e => e.description === 'Ciclo3-B'));
    assert.equal(finale.expenses.find(e => e.id === base.expenses[0].id).amount, 111, 'la correzione dell\'ultimo ciclo deve vincere, essendo la più recente');
    assert.ok(finale.chat.some(m => m.testo.includes('senza rete')));
  }
  assert.equal(
    JSON.stringify(finaleOrdine1.expenses.map(e => e.id).sort()),
    JSON.stringify(finaleOrdine2.expenses.map(e => e.id).sort()),
    'tre partizioni in sequenza convergono allo stesso risultato indipendentemente dall\'ordine di ricombinazione finale',
  );
});

test('PARTIZIONE ASIMMETRICA: un solo dispositivo isolato a lungo contro un gruppo molto più attivo non perde la propria unica operazione', () => {
  // Il caso più insidioso: un dispositivo resta offline MOLTO più a lungo
  // degli altri (batteria scarica, aereo, zona senza campo) e nel frattempo
  // il resto del gruppo accumula molte più modifiche di lui. Il timestamp più
  // vecchio del dispositivo isolato non deve fargli perdere l'unica cosa che
  // ha fatto mentre era via.
  const base = gruppoBase();
  const isolato = addSharedExpense(base, { payer: idDi(base, 'Elena'), amount: 7, description: 'Panino (isolato)' });

  let gruppoAttivo = base;
  for (let i = 0; i < 15; i++) {
    gruppoAttivo = addSharedExpense(gruppoAttivo, { payer: idDi(base, PERSONE[i % PERSONE.length]), amount: 3 + i, description: `Spesa attiva ${i}` });
  }

  const fuso = mergeGroups(gruppoAttivo, isolato);
  assert.ok(fuso.expenses.some(e => e.description === 'Panino (isolato)'), 'la spesa del dispositivo isolato a lungo non deve sparire per il volume di attività altrui');
  assert.equal(fuso.expenses.length, base.expenses.length + 15 + 1);
  assert.equal(r2(somma(Object.values(computeBalances(fuso)))), 0);
});

test('PARTIZIONE A SCALA: 100 persone, partizione a metà gruppo, il settlement non si blocca mai e i saldi tornano a zero', () => {
  // EXACT_MAX_N in split-engine.js è 22: oltre, l'ottimizzatore esatto del
  // settlement passa al greedy (dichiarato, non nascosto). Qui si verifica
  // che il passaggio avvenga DAVVERO e in fretta anche a scala reale (un
  // grande evento, una gita di classe, un torneo) — mai un tempo che cresce
  // fuori controllo, mai un saldo che smette di tornare a zero.
  const n = 100;
  const nomi = Array.from({ length: n }, (_, i) => `P${i}`);
  let g = createGroup({ name: `Evento da ${n}`, members: nomi });
  for (const m of g.members) g = claimMember(g, m.id, `device-${m.name}`);
  for (let i = 0; i < n; i++) {
    const weights = {};
    for (let k = 0; k < 3 + (i % 5); k++) weights[g.members[(i + k) % n].id] = 1;
    g = addSharedExpense(g, { payer: g.members[i].id, amount: 10 + (i % 7), description: `Spesa ${i}`, shares: { weights } });
  }

  // Partizione a metà evento: metà dei partecipanti isolata dall'altra metà,
  // ognuna continua ad aggiungere spese, poi la rete torna.
  const meta = Math.floor(n / 2);
  let bollaA = g, bollaB = g;
  for (let i = 0; i < meta; i++) bollaA = addSharedExpense(bollaA, { payer: g.members[i].id, amount: 5, description: `A-extra-${i}` });
  for (let i = meta; i < n; i++) bollaB = addSharedExpense(bollaB, { payer: g.members[i].id, amount: 5, description: `B-extra-${i}` });
  const fuso = mergeGroups(bollaA, bollaB);

  assert.equal(fuso.expenses.length, g.expenses.length + n, 'nessuna delle 100 spese aggiuntive va persa nel merge a scala');

  const bal = computeBalances(fuso);
  assert.equal(r2(somma(Object.values(bal))), 0, 'a 100 persone la somma dei saldi resta zero');

  const t0 = Date.now();
  const { transfers, method } = minimalSettlementDetailed(bal);
  const durata = Date.now() - t0;
  assert.equal(method, 'greedy', 'oltre EXACT_MAX_N il fallback greedy deve attivarsi, dichiarato, non un tentativo esatto silenzioso');
  assert.ok(durata < 2000, `il settlement a 100 persone deve restare rapido, mai un blocco: ${durata}ms`);
  const sommaTrasferimenti = r2(somma(transfers.map(t => t.amount)));
  const debitoNetto = r2(somma(Object.values(bal).filter(v => v < 0).map(v => -v)));
  assert.ok(Math.abs(sommaTrasferimenti - debitoNetto) < 0.5, `i trasferimenti proposti devono coprire tutto il debito netto: trasferimenti=${sommaTrasferimenti} debito=${debitoNetto}`);
});
