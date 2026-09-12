import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { simpleHash } from '../src/core/utils.js';
import { LATEST_WHATS_NEW_VERSION } from '../src/core/whats-new.js';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.MOMENTUM_PLAYWRIGHT_PATH ? pathToFileURL(process.env.MOMENTUM_PLAYWRIGHT_PATH).href : 'playwright');
const artifacts = resolve('ui-smoke-artifacts');
mkdirSync(artifacts, {recursive:true});
const root = resolve('dist');
const server = createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'})[extname(path)] || 'application/octet-stream'); res.end(readFileSync(path)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(4176,'127.0.0.1',r));
const browser = process.env.MOMENTUM_CDP
  ? await chromium.connectOverCDP(process.env.MOMENTUM_CDP)
  : await chromium.launch({ headless:true, ...(process.env.MOMENTUM_BROWSER_EXECUTABLE ? { executablePath:process.env.MOMENTUM_BROWSER_EXECUTABLE } : {}) });
const fixture = JSON.parse(readFileSync('src/core/fixtures/historical-backups.json')).states[0].state;
const date = new Date(), month = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
let prev = 'GENESIS';
const rows = Array.from({length:30}, (_,i) => {
  const tx={id:9000+i,amount:12.5,type:'uscita',category:'spesa',description:`Spesa di prova ${i+1}`,date:`${month}-${String(1+Math.floor(i/3)).padStart(2,'0')}T12:00:00`,prevHash:prev};
  tx.hash=simpleHash(tx.id+tx.amount+tx.category+tx.prevHash); prev=tx.hash; return tx;
});
const state={...fixture,isFirstLaunch:false,whatsNewSeen:LATEST_WHATS_NEW_VERSION,freshStartPrompted:true,currentDate:date.toISOString(),transactions:{[month]:rows},lastHash:prev,monthlyBudget:1500,budgetDeclined:false,customCategories:[],demoTransactions:{}};
try {
  for (const [width,height,touch] of [[393,852,true],[430,932,true],[768,1024,true],[1024,768,true],[1366,900,false]]) {
    const context = await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
    await context.addInitScript(s => localStorage.setItem('omega_core_db',JSON.stringify(s)),state);
    const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    try {
    await page.goto('http://127.0.0.1:4176/?lang=it');
    await page.waitForFunction(()=>typeof document.getElementById('mobile-add-btn')?.onclick === 'function');
    await page.locator('#transaction-list-container .tx-card').first().waitFor({state:'visible'});
    assert.equal(await page.locator('#transaction-list-container .tx-card').count(),8);
    const editCategory = page.locator('#transaction-list-container .tx-category-edit').first();
    await editCategory.waitFor({state:'visible'});
    assert.match(await editCategory.innerText(),/Cambia categoria/i);
    await editCategory.click();
    await page.locator('#modal-body button[onclick*="setTxCategory"]').first().waitFor({state:'visible'});
    await page.evaluate(()=>window.closeModal());
    await page.locator('[data-ledger-more]').click();
    assert.equal(await page.locator('#transaction-list-container .tx-card').count(),16);
    await page.locator('[data-ledger-less]').click();
    await page.locator('#mobile-add-btn:visible, #tablet-fab:visible').first().click();
    await page.locator('#modal-body #tx-amount-display').waitFor({state:'visible'});
    if(touch) assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'tx-amount-display');
    await page.locator('#modal-body #tx-amount-display').fill('1234567,89');
    const layout=await page.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      return {amount:box('#modal-body .command-amount-line'),impact:box('#modal-body #amount-impact'),content:box('#modal-content'),viewport:innerWidth};
    });
    assert(layout.impact.y>=layout.amount.bottom-1,JSON.stringify(layout));
    assert(layout.content.x>=-1 && layout.content.right<=width+1,JSON.stringify(layout));
    await page.locator('#modal-body [data-cat-id="spesa"]').click();
    await page.locator('#modal-body .command-edit-category').click();
    assert.equal(await page.locator('#new-cat-emoji-grid .new-cat-emoji span').count(),0);
    assert.ok(await page.locator('#new-cat-emoji-grid .new-cat-emoji').first().getAttribute('aria-label'));
    await page.locator('#new-cat-nome').fill('Spesa di casa');
    await page.locator('#new-cat-crea').click();
    assert.equal(await page.locator('#modal-body [data-cat-id="spesa"] .cat-chip-label').innerText(),'Spesa di casa');
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('omega_core_db')));
    assert.deepEqual(after.transactions,state.transactions);
    assert.equal(after.customCategories.filter(c=>c.id==='spesa').length,1);
    if(touch) {
      await page.evaluate(()=>{document.documentElement.style.setProperty('--modal-visible-height','440px');document.documentElement.style.setProperty('--modal-visible-top','40px');document.documentElement.classList.add('tastiera-aperta');});
      const bounds=await page.evaluate(()=>['#modal-content','#modal-footer'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};}));
      for(const b of bounds) assert(b.top>=39 && b.bottom<=481,JSON.stringify(bounds));
    }
    await page.screenshot({path:resolve(artifacts,`command-touch-${width}.png`)});
    console.log(JSON.stringify({width,height,touch,layout,errors}));
    assert.equal(errors.length,0);
    } catch (error) {
      await page.screenshot({path:resolve(artifacts,`failure-${width}.png`)});
      writeFileSync(resolve(artifacts,`failure-${width}.txt`), JSON.stringify({error:String(error),errors,body:await page.locator('body').innerText()},null,2));
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
