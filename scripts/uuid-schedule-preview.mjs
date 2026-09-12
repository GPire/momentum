// Isolated manual E2E fixture. Never include this server in a production build.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { simpleHash } from '../src/core/utils.js';
import { LATEST_WHATS_NEW_VERSION } from '../src/core/whats-new.js';

const root = resolve('dist');
const base = JSON.parse(readFileSync('src/core/fixtures/historical-backups.json')).states[0].state;
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const localDate = new Date(now.getFullYear(), now.getMonth(), 5);
const tx = { id: 'a92c7a00-62bd-4b31-b12d-159dcf75ef01', amount: 23.45, type: 'uscita', category: 'spesa',
  description: 'UUID test — palestra', date: localDate.toISOString(), prevHash: 'GENESIS' };
tx.hash = simpleHash(tx.id + tx.amount + tx.category + tx.prevHash);
const empty = { ...base, transactions: {}, demoTransactions: {}, demoDismissed: true, isFirstLaunch: false,
  freshStartPrompted: true, whatsNewSeen: LATEST_WHATS_NEW_VERSION, currentDate: now.toISOString(), lastHash: 'GENESIS',
  paymentDeclarations: [], paymentOverrides: {} };
const imported = { ...empty, transactions: { [month]: [tx] }, lastHash: tx.hash };
const driver = `
if (!sessionStorage.getItem('uuid-test-started')) {
  localStorage.setItem('omega_core_db', ${JSON.stringify(JSON.stringify(empty))});
  sessionStorage.setItem('uuid-test-started','1');
}
addEventListener('load', () => {
  const bar=document.createElement('div');
  bar.style.cssText='position:fixed;top:0;left:0;z-index:999999;background:white;color:black;padding:8px;font:14px sans-serif';
  const button=document.createElement('button'); button.textContent='Importa backup di prova UUID';
  button.onclick=()=>{
    const input=document.getElementById('backup-restore-input');
    const transfer=new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(JSON.stringify({ format: 'momentum-export-v1', data: imported }))}], 'uuid-test.momentum',{type:'application/json'}));
    input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); bar.remove();
  };
  const check=document.createElement('button'); check.textContent='Verifica integrità UUID';
  check.onclick=()=>{
    const state=JSON.parse(localStorage.getItem('omega_core_db'));
    const transactions=Object.values(state.transactions).flat();
    const original=${JSON.stringify(tx)};
    const plans=state.paymentDeclarations || [];
    const ok=transactions.length===1 && Object.entries(original).every(([key,value])=>transactions[0][key]===value)
      && plans.length===1 && plans[0].sourceTxId===original.id && plans[0].amount===original.amount
      && plans[0].date===${JSON.stringify(month + '-18')} && plans[0].endDate===${JSON.stringify(month + '-30')};
    const output=document.createElement('output'); output.textContent=ok ? 'PASS: storico intatto, UUID conservato, un solo piano aggiornato' : 'FAIL: controllare stato';
    bar.append(output);
  };
  bar.append(button,check); document.body.append(bar);
});`;
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/uuid-test-driver.js') { res.setHeader('Content-Type','text/javascript'); res.end(driver); return; }
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let body = readFileSync(path);
    if (path.endsWith('index.html')) body = body.toString().replace('<head>', '<head><script src="/uuid-test-driver.js"></script>');
    res.setHeader('Content-Type', ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' })[extname(path)] || 'application/octet-stream');
    // Synthetic financial fixtures must not leave this origin.
    res.setHeader('Content-Security-Policy', "connect-src 'self' blob: data:");
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
const port = Number(process.env.MOMENTUM_TEST_PORT || 4181);
server.listen(port, '127.0.0.1', () => console.log(`Isolated UUID import test: http://127.0.0.1:${port}/?lang=it`));
