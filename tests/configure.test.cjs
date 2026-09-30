const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-life-configure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  const script = path.join(root, 'scripts/configure.mjs');
  fs.copyFileSync(path.join(__dirname, '../scripts/configure.mjs'), script);
  const shared = path.join(root, 'project.config.json');
  const privateFile = path.join(root, 'project.private.config.json');
  fs.copyFileSync(path.join(__dirname, '../project.config.json'), shared);
  const original = fs.readFileSync(shared, 'utf8');
  return { root, shared, privateFile, original, run: appid => spawnSync(process.execPath, [script, appid], { encoding: 'utf8' }) };
}

test('configuring an AppID only writes the private file and leaves the shared placeholder unchanged', t => {
  const f = fixture(t);
  const appid = 'wx0123456789abcdef';
  const result = f.run(appid);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(f.privateFile, 'utf8')).appid, appid);
  assert.equal(fs.readFileSync(f.shared, 'utf8'), f.original);
  assert.equal(JSON.parse(f.original).appid, 'touristappid');
  assert.ok(!result.stdout.includes(appid));
});

test('updating a private AppID preserves developer tool settings and the public configuration', t => {
  const f = fixture(t);
  const existing = { appid: 'wx0000000000000000', projectname: '本机项目', setting: { compileHotReLoad: true } };
  fs.writeFileSync(f.privateFile, JSON.stringify(existing));
  const appid = 'wx0123456789abcdef';
  assert.equal(f.run(appid).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.privateFile, 'utf8')), { ...existing, appid });
  assert.equal(fs.readFileSync(f.shared, 'utf8'), f.original);
});

test('invalid identifiers cannot replace local settings or modify the shared project', t => {
  const f = fixture(t);
  const originalPrivate = JSON.stringify({ appid: 'wx0123456789abcdef', setting: { compileHotReLoad: true } });
  fs.writeFileSync(f.privateFile, originalPrivate);
  const invalid = 'not-an-appid-or-a-secret-to-print';
  const result = f.run(invalid);
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(f.privateFile, 'utf8'), originalPrivate);
  assert.equal(fs.readFileSync(f.shared, 'utf8'), f.original);
  assert.ok(!(result.stdout + result.stderr).includes(invalid));
});
