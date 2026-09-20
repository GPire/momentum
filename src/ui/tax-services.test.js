import test from 'node:test';
import assert from 'node:assert/strict';
import { taxServices, taxServiceGuide } from './tax-services.js';
import {socialTaxGuide} from './tax-social-handoff.js';
import {evidenceTaxGuide} from './tax-evidence-handoff.js';

test('percorsi di riscontro non cambiano stato fiscale e rispettano Paese e territorio',()=>{
  for(const lang of ['it','en','de','fr','es','nl','pt']) for(const [country,id] of [['it','conservation'],['ch','afc-confirmation'],['es','aeat-cotejo'],['it','professional-review'],['ch','professional-review'],['es','professional-review']]) {
    const guide=taxServiceGuide(country,id,lang);
    assert.ok(taxServices(country,lang).tasks.some(t=>t.id===id));
    assert.deepEqual(Object.keys(guide).sort(),['bodies','help','name','url']);
    assert.equal(guide.bodies.length,4);
    if(id!=='professional-review') for(const other of ['it','ch','es'].filter(c=>c!==country))assert.equal(taxServiceGuide(other,id,lang),null);
  }
  assert.equal(taxServiceGuide('es','aeat-cotejo','it','navarra'),null);
  assert.equal(evidenceTaxGuide('__proto__','conservation'),null);
  assert.deepEqual(evidenceTaxGuide('ch','afc-confirmation','xx'),evidenceTaxGuide('ch','afc-confirmation','en'));
});

test('guide previdenziali collegate solo alla nazione corretta e alle fonti ufficiali',()=>{
  for(const [country,task,host] of [['it','inps','www.inps.it'],['ch','avs','www.ahv-iv.ch'],['es','importass','portal.seg-social.gob.es']]){
    for(const lang of ['it','en','de','fr','es','nl','pt']){
      assert.ok(taxServices(country,lang).tasks.some(t=>t.id===task));
      const guide=taxServiceGuide(country,task,lang);assert.equal(new URL(guide.url).hostname,host);assert.equal(guide.bodies.length,4);
      for(const other of ['it','ch','es'].filter(c=>c!==country))assert.equal(taxServiceGuide(other,task,lang),null);
    }
  }
  assert.equal(socialTaxGuide('it','__proto__'),null);
});
test('servizi localizzati solo nei Paesi pertinenti', () => {
  for (const lang of ['it','en','de','fr','es','nl','pt']) {
    for (const country of ['it','es','ch']) {
      const service = taxServices(country,lang);
      assert.ok(service.title && service.hint && service.exportHint);
      for (const task of service.tasks.filter(t => t.id !== 'documents')) {
        const guide = taxServiceGuide(country,task.id,lang);
        assert.equal(guide.bodies.length,4);
        assert.ok(guide.bodies.every(t => typeof t === 'string' && t.length > 20));
        assert.equal(new URL(guide.url).protocol,'https:');
        assert.equal(new URL(guide.url).search,'');
      }
    }
    assert.equal(taxServiceGuide('it','modelo130',lang),null);
    assert.equal(taxServiceGuide('ch','f24',lang),null);
  }
});
test('territori forali e sconosciuti non vengono instradati agli adempimenti comuni', () => {
  for (const territory of ['pais_vasco','navarra','unknown']) {
    assert.deepEqual(taxServices('es','it',territory).tasks.map(t=>t.id),territory==='unknown'?[]:[territory]);
    assert.ok(taxServices('es','it',territory).regional);
    assert.equal(taxServiceGuide('es','modelo303','it',territory),null);
  }
  assert.equal(taxServices('US'),null);
  assert.equal(taxServiceGuide('it','__proto__'),null);
});

test('cantoni e territori forali hanno guide specifiche senza modelli AEAT comuni',()=>{
  for(const lang of ['it','en','de','fr','es','nl','pt']){
    const ch=taxServiceGuide('ch','cantonal',lang);assert.equal(new URL(ch.url).hostname,'www.ssk-csi.ch');assert.equal(ch.bodies.length,4);
    for(const territory of ['navarra','pais_vasco']){
      const guide=taxServiceGuide('es',territory,lang,territory);assert.ok(guide);assert.equal(guide.bodies.length,4);
      assert.equal(taxServiceGuide('es',territory,lang,'comun'),null);
      assert.equal(taxServiceGuide('es','modelo130',lang,territory),null);
      assert.equal(taxServiceGuide('it',territory,lang,territory),null);
    }
  }
});
