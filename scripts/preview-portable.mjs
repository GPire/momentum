import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

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

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
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
