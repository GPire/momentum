// Isolated synthetic receipt preview. Never runs against the user's app origin.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, sep, extname } from 'node:path';
import { simpleHash } from '../src/core/utils.js';
import { LATEST_WHATS_NEW_VERSION } from '../src/core/whats-new.js';
import { buildTripArchive } from '../src/trips/trip-archive.js';
import { readReviewArchive } from '../src/trips/review-archive.js';

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
const driver = `localStorage.setItem('omega_core_db', new URLSearchParams(location.search).has('preflight') ? ${JSON.stringify(JSON.stringify(preflightState))} : ${JSON.stringify(JSON.stringify(state))});
addEventListener('load', () => {
  const button = document.createElement('button'); button.textContent = 'Apri trasferta di prova';
  button.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;background:white;color:black;padding:12px';
  button.onclick = () => { const params = new URLSearchParams(location.search); if (params.has('history')) window.openTripReviewHistory(); else if (params.has('review')) window.openTripReviewScreen(${JSON.stringify(review)}); else window.openBusinessTrip('trip-test'); button.remove(); };
  document.body.append(button);
});`;
createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
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
