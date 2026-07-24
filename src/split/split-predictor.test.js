import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  keyTokens, predictCoSplitters, predictShares, netAcrossGroups, parseSplitLine, learnFromSplit,
  settlementIntelligence, settleAdvice,
} from './split-predictor.js';
import { createGroup, addSharedExpense, simplifyAcrossGroups } from './split-engine.js';

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
  const net = netAcrossGroups(past);
  assert.equal(net.length, 0); // si compensano → nessuna posizione aperta
});

test('netAcrossGroups mostra il netto reale quando NON si compensa del tutto', () => {
  const past = [
    grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 }),   // Marco -50
    grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 40 }), // Io -20
  ];
  const net = netAcrossGroups(past);
  assert.equal(net.length, 1);
  assert.equal(net[0].name, 'Marco');
  assert.ok(Math.abs(net[0].net - 30) < 0.01); // Marco mi deve 30 netti
  assert.equal(net[0].groups, 2);
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

test('simplifyAcrossGroups: meno pagamenti reali che saldando gruppo per gruppo', () => {
  // Due gruppi Io-Marco che nella vita reale si compensano quasi del tutto.
  const past = [
    grp('Casa', ['Io', 'Marco'], { payer: 'Io', amount: 100 }),    // Marco mi deve 50
    grp('Viaggio', ['Io', 'Marco'], { payer: 'Marco', amount: 90 }), // io devo 45
  ];
  const res = simplifyAcrossGroups(past);
  // Per gruppo: 1 + 1 = 2 pagamenti. Cross-gruppo: 1 solo (Marco→Io 5).
  assert.equal(res.perGroup, 2);
  assert.equal(res.transfers.length, 1);
  assert.equal(res.saved, 1);
  assert.ok(Math.abs(res.transfers[0].amount - 5) < 0.01);
});

test('simplifyAcrossGroups è vuoto senza gruppi (onesto)', () => {
  assert.deepEqual(simplifyAcrossGroups([]), { transfers: [], perGroup: 0, saved: 0 });
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

test('settleAdvice: debito piccolo + dividete spesso → aspetta (si compensa)', () => {
  const past = [
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-01' }),
    grp('Cena', ['Io', 'Marco'], { payer: 'Io', amount: 20, date: '2026-07-08' }),
  ];
  const intel = settlementIntelligence(past, { date: new Date('2026-07-09') });
  const adv = settleAdvice(intel, 'Marco', 3);
  assert.equal(adv.tone, 'wait');
  assert.match(adv.label, /si compenserà/);
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
