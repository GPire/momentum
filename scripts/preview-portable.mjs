import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { handleMarketFilings } from '../functions/api/market-filings.js';
import { handleMarketHeadlines } from '../functions/api/market-headlines.js';
import { handleMarketCryptoNews } from '../functions/api/market-crypto-news.js';
import { handleMarketPolicyNews } from '../functions/api/market-policy-news.js';
import { handleMarketQuarter } from '../functions/api/market-quarter.js';

const root = resolve('dist');
const host = '127.0.0.1';
const port = Number(process.argv[2] || 4180);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.xml': 'application/xml; charset=utf-8',
};
const marketRoutes = new Map([
  ['/api/market-filings', handleMarketFilings],
  ['/api/market-headlines', handleMarketHeadlines],
  ['/api/market-crypto-news', handleMarketCryptoNews],
  ['/api/market-policy-news', handleMarketPolicyNews],
  ['/api/market-quarter', handleMarketQuarter],
]);

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    if (marketRoutes.has(pathname)) {
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      const result = await marketRoutes.get(pathname)(new Request(url));
      response.writeHead(result.status, Object.fromEntries(result.headers)).end(await result.text());
      return;
    }
    const filename = resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    let target = filename;
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = resolve(target, 'index.html');
    const content = await readFile(target);
    const extension = target.slice(target.lastIndexOf('.'));
    response.writeHead(200, { 'content-type': mime[extension] || 'application/octet-stream', 'cache-control': 'no-store' }).end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, host, () => process.stdout.write(`Portable preview: http://${host}:${port}/\n`));
