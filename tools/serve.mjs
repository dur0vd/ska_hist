// Локальный сервер для просмотра сайта: npm run serve -> http://localhost:8080
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeAttachmentName } from '../assets/content-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };

export function createServer(directory = root) {
  return http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('405'); }
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('400'); }
  if (/[\\\u0000]/.test(p) || p.split('/').includes('..')) { res.writeHead(404); return res.end('404'); }
  if (p === '/') p = '/index.html';
  const publicFile = /^\/[a-z0-9-]+\.html$/.test(p) || /^\/(assets|files|img)\//.test(p);
  if (!publicFile || (p.startsWith('/files/') && !safeAttachmentName(p))) { res.writeHead(404); return res.end('404'); }
  const file = path.resolve(directory, '.' + p);
  if (!file.startsWith(path.resolve(directory) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(8080, '127.0.0.1', () => console.log('http://127.0.0.1:8080'));
}
