import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAmount, splitInputEdit, validSplitAmounts, buildSplitDraft } from './split-draft.js';
import { displayNames, computeBalances, myMemberId } from '../split/split-engine.js';
import { splitCopy, tSplit } from '../i18n/split-workspace.js';

test('split amounts reject partial numbers, negatives, infinity and fractions of cents', () => {
  for (const value of ['15abc', '-4', 'Infinity', 'NaN', '1e4', '2.999', '999999999999999']) assert.equal(splitAmount(value), null, value);
  assert.equal(splitAmount('12,30'), 12.3);
  assert.equal(splitAmount('12.'), 12);
  assert.equal(splitAmount(''), 0);
});
test('typing or pasting words cannot replace a valid amount; decimal keyboards and deletion work', () => {
  assert.deepEqual(splitInputEdit('words','12'),{value:'12',rejected:true});
  assert.deepEqual(splitInputEdit('12cats','12'),{value:'12',rejected:true});
  assert.deepEqual(splitInputEdit('-12','12'),{value:'12',rejected:true});
  assert.deepEqual(splitInputEdit(',5',''),{value:'0,5',rejected:false});
  assert.deepEqual(splitInputEdit('','12'),{value:'',rejected:false});
});
test('split validation sums cents and rejects invalid extra payers even with a positive total', () => {
  assert.equal(validSplitAmounts(['A', 'B'], { A: '10.10', B: '20.20' }, { A: '15.15', B: '15.15' }, 'custom'), true);
  assert.equal(validSplitAmounts(['A', 'B'], { A: '40', B: '-1' }, {}, 'equal'), false);
  assert.equal(validSplitAmounts(['A', 'B'], { A: '40' }, { A: '10', B: '29.99' }, 'custom'), false);
  assert.equal(validSplitAmounts(['A', 'B'], {}, {}, 'equal'), false);
});
test('every split workspace message has seven complete translations and matching placeholders', () => {
  for (const [key, row] of Object.entries(splitCopy)) {
    assert.equal(row.length, 7, key);
    const tokens = text => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    for (const text of row) { assert.ok(text.trim(), key); assert.deepEqual(tokens(text), tokens(row[0]), key); }
  }
  assert.equal(tSplit('iOwe', 'en', '€14', 'Anna'), 'You owe €14 to Anna');
});

test('ten people with two Marcos keep different IDs, payments, shares and the creator identity', () => {
  const members = Array.from({length:10}, (_, i) => ({id: i ? `p${i}` : 'Io', name: i === 1 || i === 2 ? 'Marco' : `Persona ${i}`}));
  const group = buildSplitDraft({members, paid:{Io:'120',p1:'45.50',p2:'34.50'}, name:'Cena',id:'test-group',deviceId:'device-a'});
  assert.equal(group.members.length,10);
  assert.equal(displayNames(group.members).p1,'Marco #1');
  assert.equal(displayNames(group.members).p2,'Marco #2');
  assert.equal(myMemberId(group,'device-a'),'Io');
  const balances = computeBalances(group);
  assert.equal(balances.Io,100); assert.equal(balances.p1,25.5); assert.equal(balances.p2,14.5);
  assert.equal(group.expenses.reduce((sum,e)=>sum+e.amount,0),200);
});

test('small sums and multiple payers never create negative shares or change explicit consumption', () => {
  const members = Array.from({length:10}, (_, i) => ({id:i ? `p${i}` : 'Io',name:`P${i}`}));
  for (let cents=1;cents<=110;cents++) {
    const paid={Io:(cents/100).toFixed(2),p1:'0.06',p2:'0.07'};
    const owed={Io:((cents+3)/100).toFixed(2),p1:'0.10'};
    for (const mode of ['equal','custom']) {
      const args={members,paid,owed,mode,name:'Test',id:'stable-group',deviceId:'device-a'};
      const group=buildSplitDraft(args);
      for (const expense of group.expenses) {
        assert.ok(Object.values(expense.owed).every(value=>value>=0));
        assert.equal(Object.values(expense.owed).reduce((sum,value)=>sum+Math.round(value*100),0),Math.round(expense.amount*100));
      }
      const shares=members.map(m=>group.expenses.reduce((sum,e)=>sum+Math.round((e.owed[m.id]||0)*100),0));
      assert.equal(shares.reduce((a,b)=>a+b,0),cents+13);
      if(mode==='custom') {assert.equal(shares[0],cents+3);assert.equal(shares[1],10);}
      else assert.ok(Math.max(...shares)-Math.min(...shares)<=1);
      assert.deepEqual(computeBalances(group),computeBalances(buildSplitDraft(args)));
    }
  }
});
