const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-life-web-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['web', 'miniprogram/utils', 'miniprogram/data', 'miniprogram/config']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'web', 'index.html'), 'index.html');
  fs.writeFileSync(path.join(root, 'web', '404.html'), '<main>custom-not-found</main>');
  fs.writeFileSync(path.join(root, 'web', 'app.js'), '/* app */');
  fs.writeFileSync(path.join(root, 'web', 'styles.css'), 'body {}');
  fs.writeFileSync(path.join(root, 'web', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(root, 'web', '.env'), 'secret-token');
  fs.writeFileSync(path.join(root, 'web', 'notes.txt'), 'private-notes');
  fs.mkdirSync(path.join(root, 'web', 'assets'));
  fs.writeFileSync(path.join(root, 'web', 'assets', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.symlinkSync(path.join(root, 'web', '.env'), path.join(root, 'web', 'assets', 'symlink.txt'));
  fs.writeFileSync(path.join(root, 'web', 'project.private.config.json'), '{"secret":"must-stay-local"}');
  fs.writeFileSync(path.join(root, 'project.private.config.json'), '{"appid":"wx0123456789abcdef"}');
  fs.writeFileSync(path.join(root, 'miniprogram/utils', 'content.js'), 'module.exports = require("../data/book");');
  fs.writeFileSync(path.join(root, 'miniprogram/data', 'book.js'), 'module.exports = { entries: [{ id: "1-1", title: "一条建议" }] };');
  fs.writeFileSync(path.join(root, 'miniprogram/config', 'release.js'), 'module.exports = {name: "匡子闲学"};');
  const { buildWeb } = await import('../scripts/build-web.mjs');
  return { root, build: () => buildWeb({ root }), output: path.join(root, 'dist') };
}

function loadBundle(bundle) {
  const context = { window: {} };
  vm.runInNewContext(bundle, context);
  const modules = context.window.EasyLifeModules;
  const cache = new Map();
  const requireModule = (id) => {
    if (cache.has(id)) return cache.get(id).exports;
    assert.equal(typeof modules[id], 'function', `Missing module: ${id}`);
    const module = { exports: {} };
    cache.set(id, module);
    modules[id]((specifier) => {
      let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier));
      if (!resolved.endsWith('.js')) resolved += '.js';
      return requireModule(resolved);
    }, module, module.exports);
    return module.exports;
  };
  return { modules, requireModule };
}

test('static export includes only public web assets and shared modules, and replaces stale output', async (t) => {
  const f = await fixture(t);
  fs.mkdirSync(f.output);
  fs.writeFileSync(path.join(f.output, 'old-private.txt'), 'stale');
  f.build();
  assert.deepEqual(fs.readdirSync(f.output).sort(), ['.nojekyll', '404.html', 'app.js', 'assets', 'bundle.js', 'favicon.svg', 'index.html', 'styles.css']);
  assert.deepEqual(fs.readdirSync(path.join(f.output, 'assets')), ['icon.svg']);
  const bundle = fs.readFileSync(path.join(f.output, 'bundle.js'), 'utf8');
  assert.ok(!bundle.includes('wx0123456789abcdef'));
  assert.ok(!bundle.includes('secret-token'));
  const { requireModule } = loadBundle(bundle);
  assert.equal(requireModule('miniprogram/utils/content.js').entries[0].title, '一条建议');
  assert.equal(requireModule('miniprogram/config/release.js').name, '匡子闲学');
});

test('failed dependency validation preserves the previous usable static export', async (t) => {
  const f = await fixture(t);
  f.build();
  const previous = fs.readFileSync(path.join(f.output, 'bundle.js'), 'utf8');
  fs.writeFileSync(path.join(f.root, 'miniprogram/utils/content.js'), 'module.exports = require("../missing-module");');
  assert.throws(f.build, /Missing browser module dependency/);
  assert.equal(fs.readFileSync(path.join(f.output, 'bundle.js'), 'utf8'), previous);
});

test('real shared content bundle preserves chapters, entries and sourced search without a WeChat runtime', async () => {
  const root = path.resolve(__dirname, '..');
  const froot = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-life-web-content-'));
  try {
    fs.mkdirSync(path.join(froot, 'web'));
    fs.writeFileSync(path.join(froot, 'web', 'index.html'), 'index.html');
    fs.writeFileSync(path.join(froot, 'web', 'app.js'), '/* app */');
    fs.writeFileSync(path.join(froot, 'web', 'styles.css'), 'body {}');
    for (const directory of ['utils', 'data', 'config']) fs.cpSync(path.join(root, 'miniprogram', directory), path.join(froot, 'miniprogram', directory), { recursive: true });
    const { buildWeb } = await import('../scripts/build-web.mjs');
    buildWeb({ root: froot });
    const { modules, requireModule } = loadBundle(fs.readFileSync(path.join(froot, 'dist/bundle.js'), 'utf8'));
    assert.deepEqual(Object.keys(modules).sort(), ['miniprogram/config/release.js', 'miniprogram/data/book.js', 'miniprogram/utils/content.js', 'miniprogram/utils/storage.js']);
    const content = requireModule('miniprogram/utils/content.js');
    assert.equal(content.getMeta().totalChapters, 34);
    assert.equal(content.getMeta().totalEntries, 630);
    const results = content.search('拖延怎么办');
    assert.ok(results.length > 0);
    assert.ok(results.every((result) => result.entry.sourceUrl.startsWith('https://github.com/eternity4719/HowToLiveBetter/blob/')));
    assert.equal(typeof requireModule('miniprogram/utils/storage.js').createStore, 'function');
  } finally { fs.rmSync(froot, { recursive: true, force: true }); }
});

function request(server, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: requestPath, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('preview server serves the static export and rejects private paths, traversal, symlinks and unsupported methods', async (t) => {
  const f = await fixture(t);
  f.build();
  fs.symlinkSync(path.join(f.root, 'project.private.config.json'), path.join(f.output, 'leak.txt'));
  const { createWebServer } = await import('../scripts/web-server.mjs');
  const server = createWebServer({ directory: f.output });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const home = await request(server, '/');
  assert.equal(home.status, 200);
  assert.equal(home.body, 'index.html');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.equal(home.headers['referrer-policy'], 'no-referrer');
  assert.match(home.headers['content-security-policy'], /script-src 'self'/);
  assert.match(home.headers['content-security-policy'], /connect-src 'none'/);
  assert.ok(!home.headers['content-security-policy'].includes('unsafe-inline'));
  assert.equal((await request(server, '/bundle.js')).status, 200);
  for (const pathname of ['/project.private.config.json', '/%2e%2e/project.private.config.json', '/web/app.js', '/.env', '/leak.txt', '/missing-page']) assert.equal((await request(server, pathname)).status, 404, pathname);
  assert.equal((await request(server, '/%ZZ')).status, 400);
  assert.equal((await request(server, '/%00')).status, 400);
  const missing = await request(server, '/missing-page');
  assert.equal(missing.status, 404);
  assert.match(missing.headers['content-type'], /^text\/html/);
  assert.ok(missing.body.includes('custom-not-found'));
  assert.equal((await request(server, '/', 'POST')).status, 405);
  const head = await request(server, '/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});
