import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClarity, featureVisibili } from './profilo-feature.js';

test('clarity defaults do not stereotype age or financial circumstances', () => {
  for (const ageBracket of ['under18', '18-25', '26-45', '46-65', '65+', null]) {
    for (const riskProfile of ['conservativo', 'aggressivo']) {
      const state = { onboardingProfile: { ageBracket, riskProfile } };
      assert.equal(resolveClarity(state), 'essenziale');
      assert.equal(resolveClarity({ ...state, uiComplexity: 'completo' }), 'completo');
    }
  }
});

test('detail preference never grants access to restricted or unwanted features', () => {
  assert.equal(featureVisibili({ uiComplexity: 'completo', onboardingProfile: { isMinor: true } }).analisiTensor, false);
  assert.equal(featureVisibili({ uiComplexity: 'completo', investmentPrefs: { invests: false } }).analisiTensor, false);
  assert.equal(resolveClarity({ uiComplexity: 'invalid' }), 'essenziale');
});
