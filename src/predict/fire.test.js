import test from 'node:test';
import assert from 'node:assert/strict';
import { fireTargetCapital, yearsToFire, coastFireCheck } from './fire.js';

test('fireTargetCapital: regola del 25x (4% di prelievo) di default', () => {
  assert.equal(fireTargetCapital(40000), 1_000_000);
});

test('fireTargetCapital: tasso di prelievo configurabile, non un dogma', () => {
  assert.equal(fireTargetCapital(40000, 0.05), 800_000);
});

test('fireTargetCapital: spese non valide → 0, mai un numero inventato', () => {
  assert.equal(fireTargetCapital(0), 0);
  assert.equal(fireTargetCapital(-100), 0);
});

test('yearsToFire: capitale già oltre il target → 0 anni', () => {
  const r = yearsToFire({ currentInvested: 1_100_000, targetCapital: 1_000_000 });
  assert.equal(r.years, 0);
  assert.equal(r.reachable, true);
});

test('yearsToFire: nessun capitale e nessun contributo → irraggiungibile, mai un numero inventato', () => {
  const r = yearsToFire({ currentInvested: 0, monthlyContribution: 0, targetCapital: 1_000_000 });
  assert.equal(r.years, null);
  assert.equal(r.reachable, false);
});

test('yearsToFire: la crescita composta accorcia gli anni rispetto a una divisione lineare', () => {
  // Lineare (vecchio calcolo main.js): (1M - 100k) / (500*12) = 150 anni.
  // Con crescita composta reale (9%/anno) sul capitale esistente, molto meno.
  const r = yearsToFire({ currentInvested: 100_000, monthlyContribution: 500, targetCapital: 1_000_000, expectedAnnualReturn: 0.09 });
  assert.ok(r.reachable);
  assert.ok(r.years < 50, `atteso <50 anni con crescita composta, trovato ${r.years}`);
});

test('yearsToFire: rendimento 0% → ricade sulla pura somma dei contributi (nessuna crescita fantasma)', () => {
  const r = yearsToFire({ currentInvested: 0, monthlyContribution: 1000, targetCapital: 120_000, expectedAnnualReturn: 0 });
  assert.equal(r.years, 10); // 1000*12*10 = 120.000, esatto senza rendimento
});

test('coastFireCheck: capitale esistente sufficiente a crescere da solo fino al target', () => {
  const r = coastFireCheck({ currentAge: 30, retirementAge: 65, currentInvested: 100_000, targetCapital: 1_000_000, expectedAnnualReturn: 0.09 });
  assert.equal(r.isCoastFire, true);
  assert.ok(r.projectedCapital >= 1_000_000);
});

test('coastFireCheck: capitale insufficiente a crescere da solo → false, mai un falso positivo', () => {
  const r = coastFireCheck({ currentAge: 60, retirementAge: 65, currentInvested: 10_000, targetCapital: 1_000_000, expectedAnnualReturn: 0.09 });
  assert.equal(r.isCoastFire, false);
});

test('coastFireCheck: già in età di pensionamento o oltre → nessuna crescita disponibile, mai un dato inventato', () => {
  const r = coastFireCheck({ currentAge: 65, retirementAge: 65, currentInvested: 500_000, targetCapital: 1_000_000 });
  assert.equal(r.isCoastFire, false);
  assert.equal(r.yearsAvailable, 0);
});
