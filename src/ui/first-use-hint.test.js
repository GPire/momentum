import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowAddHint } from './first-use-hint.js';
test('first-use hint respects prior display, existing records and invitation intent', () => {
 assert.equal(shouldShowAddHint(),true);
 assert.equal(shouldShowAddHint({isFirstLaunch:true}),false);
 assert.equal(shouldShowAddHint({addHintShownCount:1}),false);
 assert.equal(shouldShowAddHint({addHintShownCount:2}),false);
 assert.equal(shouldShowAddHint({activatedLite:true}),false);
 assert.equal(shouldShowAddHint({transactions:[{id:'real',amount:1}]}),false);
});

test('first-use hint reads the Vault monthly transaction map', () => {
 assert.equal(shouldShowAddHint({transactions:{}}),true);
 assert.equal(shouldShowAddHint({transactions:{'2026-09':[]}}),true);
 assert.equal(shouldShowAddHint({transactions:{'2026-08':[{isDemo:true}], '2026-09':[{isSeed:true}]}}),true);
 assert.equal(shouldShowAddHint({transactions:{'2026-08':[{id:'real',amount:5}], '2026-09':[]}}),false);
});
