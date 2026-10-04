import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

export function createWebServer(options = {}) {
  const directory = path.resolve(options.directory || path.join(projectRoot, 'dist'));
  if (!fs.existsSync(path.join(directory, 'index.html'))) throw new Error('请先运行 npm run build:web，生成 dist/。');
  const realDirectory = fs.realpathSync(directory);
  return http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
    }
    let pathname;
    try {
      const rawPath = (req.url || '/').split('?')[0];
      pathname = decodeURIComponent(rawPath);
      if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
    } catch (_) {
      res.writeHead(400); res.end('Invalid URL'); return;
    }
    // Do not expose hidden files, project sources or private configuration.
    if (pathname.split('/').some((part) => part.startsWith('.'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const file = path.resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    let exists = false;
    try { exists = inside(directory, file) && fs.statSync(file).isFile() && inside(realDirectory, fs.realpathSync(file)); } catch (_) { /* A missing path is a normal 404. */ }
    if (!exists) {
      const notFoundFile = path.join(directory, '404.html');
      try {
        if (fs.lstatSync(notFoundFile).isFile() && inside(realDirectory, fs.realpathSync(notFoundFile))) {
          res.writeHead(404, { 'Content-Type': mime['.html'], 'Content-Length': fs.statSync(notFoundFile).size });
          if (req.method === 'HEAD') res.end();
          else fs.createReadStream(notFoundFile).on('error', () => res.destroy()).pipe(res);
          return;
        }
      } catch (_) { /* The generated 404 page is optional. */ }
      res.writeHead(404); res.end('Not found'); return;
    }
    const stat = fs.statSync(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
    const server = createWebServer();
    server.on('error', (error) => { console.error(`Web server failed: ${error.message}`); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`匡子闲学网页版：http://${host}:${port}/\n仅提供 dist/ 中的公开静态文件。Ctrl+C 结束。`));
  } catch (error) {
    console.error(`Web server failed: ${error.message}`);
    process.exitCode = 1;
  }
}
