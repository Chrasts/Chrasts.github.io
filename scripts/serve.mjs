import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = normalize(join(root, requested));
  const insideRoot = relative(root, file);
  if (insideRoot.startsWith('..') || resolve(file) === root) {
    response.writeHead(404).end('Not found');
    return;
  }

  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, { 'Content-Type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});

const address = 'http://127.0.0.1:4173/';
server.listen(4173, '127.0.0.1', () => {
  console.log(`Local portfolio server is ready at ${address}`);
  console.log('Press Ctrl+C to stop the server.');
  if (process.env.OPEN_BROWSER !== '1') return;
  if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', address]);
  else if (process.platform === 'darwin') execFile('open', [address]);
  else execFile('xdg-open', [address]);
});

server.on('error', error => {
  const message = error?.code === 'EADDRINUSE'
    ? `Port 4173 is already in use. Open ${address} or stop the existing server first.`
    : `Local portfolio server could not start: ${error.message}`;
  console.error(message);
  process.exitCode = 1;
});
