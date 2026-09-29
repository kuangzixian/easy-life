import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wxss': 'text/plain; charset=utf-8', '.wxml': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
}
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { res.writeHead(400); res.end('Invalid URL'); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/bundle.js') {
    const modules = walk(path.join(root, 'miniprogram')).filter((file) => file.endsWith('.js'));
    const bundle = 'window.nativeModules = {};\n' + modules.map((file) => `nativeModules[${JSON.stringify(path.relative(root, file).replaceAll(path.sep, '/'))}] = function(require,module,exports){\n${fs.readFileSync(file, 'utf8')}\n};`).join('\n');
    res.writeHead(200, { 'Content-Type': mime['.js'] }); res.end(bundle); return;
  }
  const mapped = pathname === '/' ? '/preview/index.html' : pathname;
  if (!mapped.startsWith('/preview/') && !mapped.startsWith('/miniprogram/')) { res.writeHead(404); res.end(); return; }
  const file = path.resolve(root, '.' + mapped);
  const allowed = path.join(root, mapped.startsWith('/preview/') ? 'preview' : 'miniprogram') + path.sep;
  if (!file.startsWith(allowed) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(allowed)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`设计与交互预览：http://127.0.0.1:${port}\n复用原生 WXML/WXSS 和页面逻辑；不是微信运行环境。Ctrl+C 结束。`));
