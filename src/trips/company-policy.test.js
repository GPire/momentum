import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompanyPolicy, applyCompanyPolicy } from './company-policy.js';
import { tripReviewSnapshot } from './review-fingerprint.js';
const policy = { companyId: 'a', companyName: 'Company', version: 2, rules: { currency: 'EUR', receiptThreshold: 25, expenseLimits: {}, dailyLimits: { vitto: 50 } } };
test('company policy loads only from same origin and is pinned without changing source data', async () => {
  const loaded = await loadCompanyPolicy('a', async (url, options) => { assert.equal(url,'/v1/companies/a/policies');assert.equal(options.redirect,'error');return Response.json(policy); });
  const original={id:'trip'}; const trip=applyCompanyPolicy(original, loaded);
  loaded.rules.dailyLimits.vitto=200;
  assert.equal(trip.receiptPolicy.dailyLimits.vitto,50);
  assert.equal(original.receiptPolicy,undefined);
  assert.equal(trip.companyPolicy.version,2);
  assert.notEqual(tripReviewSnapshot(trip,[]),tripReviewSnapshot({...trip,companyPolicy:{...trip.companyPolicy,companyId:'b'}},[]));
});
test('revoked access, mismatched company and malformed policy never create a local fallback', async () => {
  await assert.rejects(loadCompanyPolicy('a',async()=>new Response('',{status:403})));
  for(const data of [{...policy,companyId:'b'},{...policy,version:0},{...policy,rules:{...policy.rules,dailyLimits:{vitto:-1}}}]) await assert.rejects(loadCompanyPolicy('a',async()=>Response.json(data)));
});

test('company policy: perDiem/mileage sono opzionali — una policy senza di essi resta valida (retrocompatibile)', async () => {
  const loaded = await loadCompanyPolicy('a', async () => Response.json(policy));
  assert.equal(loaded.rules.perDiem, undefined);
  assert.equal(loaded.rules.mileage, undefined);
});

test('company policy: perDiem/mileage validi vengono propagati, mai scartati in silenzio come prima', async () => {
  const conDiaria = { ...policy, rules: { ...policy.rules, perDiem: { piena: 68, ridotta: 51 }, mileage: { tariffa: 0.725, unita: 'mi' } } };
  const loaded = await loadCompanyPolicy('a', async () => Response.json(conDiaria));
  assert.deepEqual(loaded.rules.perDiem, { piena: 68, ridotta: 51 });
  assert.deepEqual(loaded.rules.mileage, { tariffa: 0.725, unita: 'mi' });
  const trip = applyCompanyPolicy({ id: 'trip' }, loaded);
  assert.deepEqual(trip.receiptPolicy.perDiem, { piena: 68, ridotta: 51 });
  assert.deepEqual(trip.receiptPolicy.mileage, { tariffa: 0.725, unita: 'mi' });
});

test('company policy: perDiem con quota ridotta maggiore della piena non viene mai propagato, mai fidarsi ciecamente del server', async () => {
  const invalida = { ...policy, rules: { ...policy.rules, perDiem: { piena: 14, ridotta: 28 } } };
  const loaded = await loadCompanyPolicy('a', async () => Response.json(invalida));
  assert.equal(loaded.rules.perDiem, undefined);
});

test('company policy: mileage con unità sconosciuta non viene mai propagato', async () => {
  const invalida = { ...policy, rules: { ...policy.rules, mileage: { tariffa: 0.30, unita: 'furlong' } } };
  const loaded = await loadCompanyPolicy('a', async () => Response.json(invalida));
  assert.equal(loaded.rules.mileage, undefined);
});
