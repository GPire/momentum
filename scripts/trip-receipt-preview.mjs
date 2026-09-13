import { companyFileFixture } from './company-file-fixture.mjs';
// Isolated synthetic receipt preview. Never runs against the user's app origin.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, sep, extname } from 'node:path';
import { simpleHash } from '../src/core/utils.js';
import { LATEST_WHATS_NEW_VERSION } from '../src/core/whats-new.js';
import { buildTripArchive } from '../src/trips/trip-archive.js';
import { readReviewArchive } from '../src/trips/review-archive.js';

const fileFixture=process.argv.includes('--company-files')?companyFileFixture('http://127.0.0.1:'+process.argv[2]):null;
const root = resolve('dist');
const base = JSON.parse(readFileSync('src/core/fixtures/historical-backups.json')).states[0].state;
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const tx = { id: 'receipt-uuid-fixture', amount: 15, type: 'uscita', category: 'spesa',
  description: 'Ricevuta di prova', date: now.toISOString(), businessTripId: 'trip-test', tripCategory: 'vitto',
  receiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6RZkAAAAASUVORK5CYII=', prevHash: 'GENESIS' };
tx.hash = simpleHash(tx.id + tx.amount + tx.category + tx.prevHash);
const state = { ...base, transactions: { [month]: [tx] }, demoTransactions: {}, demoDismissed: true,
  isFirstLaunch: false, freshStartPrompted: true, whatsNewSeen: LATEST_WHATS_NEW_VERSION,
  currentDate: now.toISOString(), lastHash: tx.hash,
  businessTrips: [{ id: 'trip-test', name: 'Trasferta di prova', createdAt: Date.now(), offeredItems: [] }] };
const review = await readReviewArchive(JSON.stringify(buildTripArchive({ ...state.businessTrips[0], offeredItems: [{ amount: 80, date: now.toISOString(), tripCategory: 'alloggio', description: 'Hotel pagato dall’azienda' }] }, [{ ...tx, tripRevisionConflict: true }])));
state.tripReviewHistory = Array.from({ length: 35 }, (_, i) => ({ review: { ...review, tripId: 'fixture-' + i, tripName: 'Trasferta ' + (i + 1), mittente: i % 2 ? 'José' : 'Marta' }, savedAt: Date.now() - i * 1000, decision: i % 2 ? { state: 'modifiche', note: 'Verificare la ricevuta dell’albergo', reviewer: 'Responsabile di prova' } : null }));
const preflightState = JSON.parse(JSON.stringify(state));
const preflightExpense = preflightState.transactions[month][0];
preflightExpense.amount = 30; preflightExpense.receiptImage = null;
preflightExpense.hash = simpleHash(preflightExpense.id + preflightExpense.amount + preflightExpense.category + preflightExpense.prevHash);
preflightState.lastHash = preflightExpense.hash;
const companyState=structuredClone(state);
companyState.businessTrips[0].companyPolicy={companyId:'demo',version:3,companyName:'Demo'};
companyState.businessTrips[0].receiptPolicy={currency:'EUR',receiptThreshold:0,expenseLimits:{},dailyLimits:{}};
const companyReview=await readReviewArchive(JSON.stringify(buildTripArchive(companyState.businessTrips[0],[tx])));
companyState.businessTrips[0].companySubmission={reportId:'fixture-report',revision:1,fingerprint:companyReview.reportFingerprint};
const driver = `localStorage.setItem('omega_core_db', new URLSearchParams(location.search).has('preflight') ? ${JSON.stringify(JSON.stringify(preflightState))} : ${JSON.stringify(JSON.stringify(state))});
if(new URLSearchParams(location.search).has('company-send')){const value=JSON.parse(localStorage.getItem('omega_core_db'));value.businessTrips[0].companyPolicy={companyId:'demo',version:3,companyName:'Azienda di prova'};value.businessTrips[0].receiptPolicy={currency:'EUR',receiptThreshold:0,expenseLimits:{},dailyLimits:{}};localStorage.setItem('omega_core_db',JSON.stringify(value));}
if(new URLSearchParams(location.search).has('company-status'))localStorage.setItem('omega_core_db',${JSON.stringify(JSON.stringify(companyState))});
if(new URLSearchParams(location.search).has('clarity')){const value=JSON.parse(localStorage.getItem('omega_core_db'));value.investmentPrefs={...value.investmentPrefs,invests:false};value.uiComplexity='essenziale';value.uiComplexitySetByUser=true;localStorage.setItem('omega_core_db',JSON.stringify(value));}
if(new URLSearchParams(location.search).has('company-files')){const value=${JSON.stringify(companyState)};delete value.businessTrips[0].companySubmission;Object.values(value.transactions)[0][0].receiptImage+=' '.repeat(300000);localStorage.setItem('omega_core_db',JSON.stringify(value));}
addEventListener('load', () => {
  const button = document.createElement('button'); button.textContent = 'Apri trasferta di prova';
  button.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;background:white;color:black;padding:12px';
  button.onclick = () => { const params = new URLSearchParams(location.search); if(params.has('clarity')) window.openAppearancePreferences(); else if(params.has('company-send')||params.has('company-status')||params.has('company-files')) window.openTripReviewShare('trip-test'); else if (params.has('company')) { window.openBusinessTrips(); document.getElementById('trip-newname').value='Milano - prova aziendale'; } else if (params.has('history')) window.openTripReviewHistory(); else if (params.has('review')) window.openTripReviewScreen(${JSON.stringify(review)}); else window.openBusinessTrip('trip-test'); button.remove(); };
  document.body.append(button);
});`;
createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if(fileFixture&&pathname.startsWith('/v1/companies/demo/')){try{const parts=[];for await(const part of req)parts.push(part);const response=await fileFixture(new Request('http://127.0.0.1:'+process.argv[2]+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(parts)})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch{res.writeHead(503).end('{}')}return;}
  if (pathname === '/v1/companies/demo/policies') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({companyId:'demo',companyName:'Azienda di prova',version:3,rules:{currency:'EUR',receiptThreshold:0,expenseLimits:{vitto:30},dailyLimits:{vitto:60}}})); return; }
  if (pathname === '/v1/companies/demo/reports') { res.writeHead(503,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'service_unavailable'})); return; }
  if(pathname==='/v1/companies/demo/reports/fixture-report'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'fixture-report',company_id:'demo',trip_id:'trip-test',revision:1,fingerprint:companyReview.reportFingerprint,decision:'changes_requested',note:'Verificare la ricevuta del pranzo.',superseded:false,policyStale:false}));return;}
  if (pathname === '/receipt-driver.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(driver); return; }
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let body = readFileSync(path);
    if (path.endsWith('index.html')) body = body.toString().replace('<head>', '<head><script src="/receipt-driver.js"></script>');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "connect-src 'self' blob: data:");
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(Number(process.argv[2]) || 4184, '127.0.0.1', () => console.log('Receipt fixture ready'));
