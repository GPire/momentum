import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  keyTokens, predictCoSplitters, predictShares, netAcrossGroups, verifiedPairNetting, parseSplitLine, learnFromSplit,
  settlementIntelligence, settleAdvice,
} from './split-predictor.js';
import { createGroup, claimMember, addSharedExpense } from './split-engine.js';
import { contestExpense } from './group-chat.js';

// Helper: costruisce un gruppo salvato con una spesa.
function grp(name, members, { payer, amount, date, shares } = {}) {
  let g = createGroup({ name, members });
  if (amount) {
    const payerId = g.members[members.indexOf(payer)]?.id || g.members[0].id;
    let sh;
    if (shares) { sh = { byId: {} }; members.forEach((m, i) => { if (shares[m] != null) sh.byId[g.members[i].id] = shares[m]; }); }
    g = addSharedExpense(g, { payer: payerId, amount, description: name, date, shares: sh });
  }
  return { ...g, date: date || '2026-07-01' };
}

test('keyTokens estrae i token significativi, scarta stop-word e cifre corte', () => {
  assert.deepEqual(keyTokens('Cena pizzeria con Marco'), ['cena', 'pizzeria', 'marco']);
  assert.deepEqual(keyTokens('la spesa di casa'), ['casa']); // "spesa","la","di" stop
  assert.deepEqual(keyTokens(''), []);
});

test('predictCoSplitters tace senza dati e senza inventare nomi', () => {
  assert.deepEqual(predictCoSplitters([], { description: 'cena' }), []);
});

test('predictCoSplitters mette in cima chi divide QUESTO tipo di spesa', () => {
  const past = [
    grp('Cena fuori', ['Io', 'Marco'], { payer: 'Io', amount: 40 }),
    grp('Cena pizzeria', ['Io', 'Marco'], { payer: 'Io', amount: 30 }),
    grp('Casa affitto', ['Io', 'Anna'], { payer: 'Io', amount: 800 }),
  ];
  const res = predictCoSplitters(past, { description: 'Cena di stasera', date: new Date('2026-07-10') });
  assert.equal(res[0].name, 'Marco'); // Marco è legato alle "cene"
  assert.ok(res.find(r => r.name === 'Marco').reason); // spiega il perché
});

test('predictShares tace se la divisione è sempre equa', () => {
  const past = [
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 40 }), // equa 20/20
    grp('Cena2', ['Io', 'Marco'], { payer: 'Io', amount: 60 }), // equa 30/30
  ];
  assert.equal(predictShares(past, ['Io', 'Marco']), null);
});

test('predictShares predice una quota ricorrente NON equa (affitto 25/75)', () => {
  const past = [
    grp('Casa', ['Io', 'Anna'], { payer: 'Io', amount: 1000, shares: { Io: 250, Anna: 750 } }),
    grp('Casa', ['Io', 'Anna'], { payer: 'Io', amount: 1000, shares: { Io: 250, Anna: 750 } }),
  ];
  const res = predictShares(past, ['Io', 'Anna']);
  assert.ok(res && res.confident);
  assert.ok(Math.abs(res.shares['Io'] - 0.25) < 0.02);
  assert.ok(Math.abs(res.shares['Anna'] - 0.75) < 0.02);
});

test('netAcrossGroups compensa i debiti tra gruppi diversi con la stessa persona', () => {
  // In "casa" IO pago 100 per me+Marco → Marco mi deve 50.
  // In "viaggio" MARCO paga 100 per me+Marco → io devo 50 a Marco.
  // Netto: in pari.
  const past = [
    grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 }),
    grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 100 }),
  ];
  const linked = past.map(g => claimMember(claimMember(g, 'm0', 'device-io'), 'm1', 'device-marco'));
  const net = netAcrossGroups(linked, { deviceId: 'device-io' });
  assert.equal(net.length, 0); // si compensano → nessuna posizione aperta
});

test('netAcrossGroups mostra il netto reale quando NON si compensa del tutto', () => {
  const past = [
    grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 }),   // Marco -50
    grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 40 }), // Io -20
  ];
  const linked = past.map(g => claimMember(claimMember(g, 'm0', 'device-io'), 'm1', 'device-marco'));
  const net = netAcrossGroups(linked, { deviceId: 'device-io' });
  assert.equal(net.length, 1);
  assert.equal(net[0].name, 'Marco');
  assert.ok(Math.abs(net[0].net - 30) < 0.01); // Marco mi deve 30 netti
  assert.equal(net[0].groups, 2);
});

test('netAcrossGroups non confonde omonimi o gruppi senza identità collegata', () => {
  const first = claimMember(claimMember(grp('A', ['Io', 'Marco'], { payer: 'Io', amount: 100 }), 'm0', 'device-io'), 'm1', 'marco-a');
  const second = claimMember(claimMember(grp('B', ['Io', 'Marco'], { payer: 'Marco', amount: 100 }), 'm0', 'device-io'), 'm1', 'marco-b');
  assert.deepEqual(netAcrossGroups([first, second]), []);
  const rows = netAcrossGroups([first, second], { deviceId: 'device-io' });
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map(row => row.identity)), new Set(['marco-a', 'marco-b']));
  assert.deepEqual(rows.map(row => row.net).sort((a, b) => a - b), [-50, 50]);
});

test('parseSplitLine: una riga → importo, descrizione, persone', () => {
  const r = parseSplitLine('60 cena io marco luca');
  assert.equal(r.amount, 60);
  assert.equal(r.description, 'cena');
  assert.deepEqual(r.people, ['Io', 'Marco', 'Luca']);
});

test('parseSplitLine gestisce virgola decimale, € e ordine libero', () => {
  const r = parseSplitLine('cena con Marco e Anna 45,50€');
  assert.equal(r.amount, 45.5);
  assert.ok(r.people.includes('Marco') && r.people.includes('Anna'));
  assert.ok(r.people.includes('Io')); // ci sei sempre tu
});

test('parseSplitLine ritorna null se non c\'è un importo (non indovina)', () => {
  assert.equal(parseSplitLine('cena con gli amici'), null);
  assert.equal(parseSplitLine(''), null);
});

test('learnFromSplit chiama il categorizzatore e ritorna la categoria', () => {
  const fakeOrch = { classify: (desc) => ({ category: desc.includes('cena') ? 'ristorazione' : 'altro' }) };
  const r = learnFromSplit(fakeOrch, { description: 'cena pizzeria', myShare: 15 });
  assert.equal(r.category, 'ristorazione');
  assert.equal(r.mine, 15);
});

test('learnFromSplit è un no-op onesto senza orchestratore', () => {
  const r = learnFromSplit(null, { description: 'cena', myShare: 10 });
  assert.equal(r.category, 'altro');
  assert.equal(r.mine, 10);
});

test('verifiedPairNetting: due saldi collegati si compensano al centesimo, senza cambiare i gruppi', () => {
  // Due gruppi Io-Marco che nella vita reale si compensano quasi del tutto.
  const past = [
    grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 }),    // Marco mi deve 50
    grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 90 }), // io devo 45
  ];
  const linked = past.map(g => claimMember(claimMember(g, 'm0', 'device-io'), 'm1', 'device-marco'));
  const original = JSON.stringify(linked);
  const [res] = verifiedPairNetting(linked, { deviceId: 'device-io' });
  assert.equal(res.before, 2);
  assert.equal(res.after, 1);
  assert.equal(res.saved, 1);
  assert.equal(res.net, 5);
  assert.equal(JSON.stringify(linked), original);
});

test('verifiedPairNetting si astiene senza identità e con gruppi non verificabili', () => {
  const first = grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 });
  const second = grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 90 });
  assert.deepEqual(verifiedPairNetting([first, second], { deviceId: 'device-io' }), []);
  const linked = [first, second].map(g => claimMember(claimMember(g, 'm0', 'device-io'), 'm1', 'device-marco'));
  const disputed = contestExpense(linked[1], { autore: 'Marco', expenseId: linked[1].expenses[0].id });
  assert.deepEqual(verifiedPairNetting([linked[0], disputed], { deviceId: 'device-io' }), []);
  const broken = { ...linked[1], expenses: [{ ...linked[1].expenses[0], owed: { m0: 1, m1: 1 } }] };
  assert.deepEqual(verifiedPairNetting([linked[0], broken], { deviceId: 'device-io' }), []);
  assert.deepEqual(verifiedPairNetting([linked[0], linked[0]], { deviceId: 'device-io' }), []);
  assert.deepEqual(verifiedPairNetting([]), []);
});

test('verifiedPairNetting non fonde omonimi o valute diverse', () => {
  const first = claimMember(claimMember(grp('A', ['Io', 'Marco'], { payer: 'Io', amount: 100 }), 'm0', 'device-io'), 'm1', 'marco-a');
  const second = claimMember(claimMember(grp('B', ['Io', 'Marco'], { payer: 'Marco', amount: 90 }), 'm0', 'device-io'), 'm1', 'marco-b');
  assert.deepEqual(verifiedPairNetting([first, second], { deviceId: 'device-io' }), []);
  assert.deepEqual(verifiedPairNetting([first, { ...second, members: second.members.map(m => m.id === 'm1' ? { ...m, claimedBy: 'marco-a' } : m), baseCurrency: 'CHF' }], { deviceId: 'device-io' }), []);
});

test('verifiedPairNetting non spaccia due crediti nella stessa direzione per compensazione', () => {
  const linked = [
    grp('A', ['Io', 'Marco'], { payer: 'Io', amount: 30 }),
    grp('B', ['Io', 'Marco'], { payer: 'Io', amount: 20 }),
  ].map(g => claimMember(claimMember(g, 'm0', 'device-io'), 'm1', 'device-marco'));
  assert.deepEqual(verifiedPairNetting(linked, { deviceId: 'device-io' }), []);
});

test('verifiedPairNetting: dieci persone, omonimi e nove saldi indipendenti', () => {
  const groups = [];
  for (let i = 1; i <= 9; i++) {
    for (const [payer, amount] of [['Io', 20 + i * 2], ['Marco', 10 + i * 2]]) {
      const group = grp(`Gruppo ${i}`, ['Io', 'Marco'], { payer, amount });
      groups.push(claimMember(claimMember(group, 'm0', 'device-io'), 'm1', `device-${i}`));
    }
  }
  const results = verifiedPairNetting(groups, { deviceId: 'device-io' });
  assert.equal(results.length, 9);
  assert.equal(new Set(results.map(row => row.identity)).size, 9);
  assert.ok(results.every(row => row.net === 5 && row.before === 2 && row.after === 1));
  const broken = { ...groups[0], expenses: [{ ...groups[0].expenses[0], owed: { m0: 0 } }] };
  const after = verifiedPairNetting([broken, ...groups.slice(1)], { deviceId: 'device-io' });
  assert.equal(after.length, 8);
  assert.ok(after.every(row => row.identity !== 'device-1'));
});

test('settlementIntelligence misura la cadenza (ogni ~7 giorni con Marco)', () => {
  const past = [
    { ...grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-01' }) },
    { ...grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-08' }) },
    { ...grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-15' }) },
  ];
  const intel = settlementIntelligence(past, { date: new Date('2026-07-16') });
  const info = intel.get('Marco');
  assert.equal(info.cadence, 7);
  assert.equal(info.count, 3);
});

test('settleAdvice: la frequenza non promette di compensare un debito reale', () => {
  const past = [
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-01' }),
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-08' }),
  ];
  const intel = settlementIntelligence(past, { date: new Date('2026-07-09') });
  const adv = settleAdvice(intel, 'Marco', 3);
  assert.equal(adv.tone, 'now');
  assert.equal(adv.label, null);
});

test('settleAdvice: debito grande → salda adesso anche se dividete spesso', () => {
  const past = [
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-01' }),
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-08' }),
  ];
  const intel = settlementIntelligence(past, { date: new Date('2026-07-09') });
  assert.equal(settleAdvice(intel, 'Marco', 85).tone, 'now');
});

test('settleAdvice è neutro (now) senza storico di cadenza', () => {
  const intel = settlementIntelligence([], {});
  assert.equal(settleAdvice(intel, 'Sconosciuto', 3).tone, 'now');
});

// ── parseSplitLine robustezza: articoli/possessivi NON sono nomi ──
test('parseSplitLine: "spesa 25 con mia sorella" → Sorella (non "Mia")', () => {
  const r = parseSplitLine('spesa 25 con mia sorella');
  assert.deepEqual(r.people, ['Io', 'Sorella']);
  assert.equal(r.amount, 25);
});
test('parseSplitLine: "birra 15 io e i ragazzi" → Ragazzi (non "I")', () => {
  const r = parseSplitLine('birra 15 io e i ragazzi');
  assert.deepEqual(r.people, ['Io', 'Ragazzi']);
});
test('parseSplitLine: formati misti danno lo stesso gruppo', () => {
  const a = parseSplitLine('60 cena io Marco Luca');
  const b = parseSplitLine('cena 60 con Marco e Luca');
  assert.deepEqual(a.people, b.people);
  assert.equal(a.amount, b.amount);
});
