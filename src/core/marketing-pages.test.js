import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLanding, renderSitemap, renderAppBrand } from '../../scripts/generate-marketing.mjs';
import { previews } from '../../public/landing/landing-copy.js';

const template = readFileSync(new URL('../../scripts/templates/landing.html',import.meta.url),'utf8');
const brand = {name:'Momentum',wordmark:'momentum',origin:'https://momentum-finance.pages.dev'};
const languages = ['it','en','de','fr','es','nl','pt'];

test('each landing locale has its own readable page, canonical URL and working app link', () => {
  for (const code of languages) {
    const html = renderLanding(template,code,brand,'test-revision');
    const path = `/landing/${code === 'it' ? '' : code + '/'}`;
    assert.match(html,new RegExp(`<html lang="${code}">`));
    assert.ok(html.includes(`rel="canonical" href="${brand.origin + path}"`));
    assert.ok(html.includes(`href="/?lang=${code}"`));
    assert.ok(html.includes(`property="og:image" content="${brand.origin}/landing/orbit-social.png"`));
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
    assert.ok(html.includes('property="og:image:alt" content="'));
    if (code !== 'it') assert.ok(!html.includes('property="og:image:alt" content="Un pianeta'));
    assert.ok(html.includes(`id="current-language">${code.toUpperCase()}<`));
    assert.equal((html.match(/hreflang="/g) || []).length,8);
    assert.ok(!html.includes('{{ASSET_REV}}'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="heroLineOne">I tuoi soldi.'));
    assert.ok(html.includes(`id="partita-iva"`));
    assert.ok(html.includes('data-first-story data-active-step="0"'));
    assert.ok(html.includes('data-ways-story data-active-way="0"'));
    assert.ok(html.includes('class="ways-stage" aria-hidden="true"'));
    assert.equal((html.match(/class="way way-/g) || []).length,6);
    assert.ok(html.includes('data-fiscal-story data-active-step="0"'));
    for (const step of ['0','1','2','3']) assert.ok(html.includes(`data-fiscal-step="${step}"`));
    assert.ok(html.includes('data-i18n="fiscalDetailTwo"'));
    assert.ok(html.includes('data-i18n="fiscalDetailFour"'));
    assert.ok(html.includes(`data-i18n="wayTaxTitle"`));
    assert.ok(html.includes('id="intelligenza"'));
    assert.ok(html.includes('id="landing-orb-canvas"'));
    assert.ok(html.includes('class="site-nav-cta"'));
    assert.ok(html.includes('class="preview-stage"'));
    assert.ok(html.includes('class="preview-graphic-trip"'));
    assert.ok(html.includes('id="preview-tab-invoice"'));
    assert.equal((html.match(/role="tab" aria-controls="preview-panel"/g) || []).length,4);
    for (const mode of ['today','together','trip','invoice']) assert.equal(previews[code][mode].length,4);
    assert.ok(html.includes('class="intelligence-progress"'));
    assert.equal((html.match(/class="faq-index"/g) || []).length,4);
    assert.ok(html.includes('class="footer-nav"'));
    assert.ok(html.includes('data-i18n="intelligenceVoiceTitle"'));
    assert.ok(html.includes('data-i18n="intelligenceForecastTitle"'));
    assert.ok(html.includes('data-i18n="trustPrivacyLink"'));
    assert.ok(html.includes('data-trust-story data-active-step="0"'));
    for (const step of ['0','1','2']) assert.ok(html.includes(`data-trust-step="${step}"`));
    assert.ok(html.includes('id="in-pratica"'));
    assert.ok(html.includes('data-proof-story data-active-step="0"'));
    for (const step of ['0','1','2']) assert.ok(html.includes(`data-proof-step="${step}"`));
    assert.ok(html.includes('data-i18n="proofDemo"'));
    assert.ok(html.includes('data-i18n="proofSplitDispute"'));
    assert.ok(html.includes('data-i18n="proofTaxPending"'));
    assert.ok(html.includes('data-i18n="proofTaxBody"'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1] || 'null');
    assert.equal(schema.inLanguage,code);
    assert.equal(schema.featureList.length,6);
    assert.ok(schema.featureList.includes(html.match(/data-i18n="wayTogetherTitle">([^<]+)</)?.[1]));
    assert.equal((html.match(new RegExp(`href="/privacy\\.html\\?lang=${code}"`,'g')) || []).length,2);
    assert.ok(html.includes('landing.js?v=test-revision'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="intelligenceVoiceTitle">Dillo come ti viene.'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="fiscalTitle">Da una fattura'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="trustTwoBody">I movimenti partono dal tuo dispositivo.'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="proofTitle">Un gesto. Tutti i passi collegati.'));
    if (code !== 'it') assert.ok(!html.includes('data-i18n="proofTaxTitle">Una fattura,'));
  }
  assert.match(renderLanding(template,'en',brand,'rev'),/Your money\./);
  assert.match(renderLanding(template,'de',brand,'rev'),/Dein Geld\./);
});

test('shared landing image exists and metadata matches its dimensions', () => {
  const image = readFileSync(new URL('../../public/landing/orbit-social.png',import.meta.url));
  assert.equal(image.subarray(1,4).toString(),'PNG');
  const html = renderLanding(template,'it',brand,'rev');
  assert.ok(html.includes(`property="og:image:width" content="${image.readUInt32BE(16)}"`));
  assert.ok(html.includes(`property="og:image:height" content="${image.readUInt32BE(20)}"`));
});

test('landing modules use JavaScript assets served with a module-compatible MIME type', () => {
  const entry = readFileSync(new URL('../../public/landing/landing.js',import.meta.url),'utf8');
  for (const filename of ['landing-copy.js','landing-orb.js']) {
    assert.ok(entry.includes(`./${filename}?v=\${revision}`));
    assert.doesNotThrow(() => readFileSync(new URL(`../../public/landing/${filename}`,import.meta.url)));
  }
});

test('changing display identity updates marketing text and SEO without changing technical data IDs', () => {
  const changed = {name:'Orbit',wordmark:'orbit',origin:'https://orbit.example'};
  const html = renderLanding(template,'en',changed,'rev');
  assert.ok(html.includes('<title>Orbit — Your money, finally clear</title>'));
  assert.ok(html.includes('>orbit<span class="brand-point">'));
  assert.ok(html.includes('https://orbit.example/landing/en/'));
  assert.ok(html.includes('https://orbit.example/landing/orbit-social.png'));
  assert.ok(html.includes('"name":"Orbit"'));
  assert.ok(!html.includes('Momentum brings'));
  const sitemap = renderSitemap(changed,'2026-09-23');
  assert.equal((sitemap.match(/<loc>/g) || []).length,7);
  assert.ok(sitemap.includes('https://orbit.example/landing/pt/'));
});

test('brand text in HTML is escaped', () => {
  const html = renderLanding(template,'it',{...brand,name:'A&B <Demo>'},'rev');
  assert.ok(html.includes('A&amp;B &lt;Demo&gt;'));
  assert.ok(!html.includes('<Demo>'));
});

test('visible app wordmarks and accessibility names follow the display brand', () => {
  const app = readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const changed = renderAppBrand(app,{...brand,name:'Orbit'});
  assert.ok(changed.includes('<title data-brand-title>Orbit — Le tue finanze, più chiare</title>'));
  assert.ok(changed.includes('data-brand-text="vault">Orbit Vault</'));
  assert.ok(changed.includes('data-brand-aria="name" aria-label="Orbit"'));
  assert.ok(changed.includes('data-brand-alt="name" alt="Orbit"'));
  assert.ok(changed.includes('data-brand-text="name">Orbit</'));
});
