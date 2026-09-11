import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardActions} from './dashboard-actions.js';
test('unknown interests do not imply trading and split is always reachable',()=>assert.deepEqual(dashboardActions({}),['split','agenda']));
test('minor keeps goals and split, never inherits investing from stale preferences',()=>assert.deepEqual(dashboardActions({onboardingProfile:{isMinor:true},investmentPrefs:{invests:true}}),['split','goals']));
test('actual trips and explicit investing surface their tools with a bounded action count',()=>assert.deepEqual(dashboardActions({trips:[{}],investmentPrefs:{invests:true},savingsGoals:[{}]}),['split','agenda','trips','invest']));
test('a non-investor goal is reachable without opening analysis',()=>assert.deepEqual(dashboardActions({investmentPrefs:{invests:false},savingsGoals:[{}]}),['split','agenda','goals']));
