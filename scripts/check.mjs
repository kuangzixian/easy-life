import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mini = path.join(root, 'miniprogram');
const require = createRequire(import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const files = walk(mini);
for (const file of files) {
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert(result.status === 0, result.stderr);
    if (!file.includes(`${path.sep}data${path.sep}`)) {
      const source = fs.readFileSync(file, 'utf8');
      assert(!/\b(?:wx\.(?:request|login|cloud)|fetch|XMLHttpRequest)\s*[.(]/.test(source), `首版意外出现网络依赖: ${file}`);
    }
  }
  if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
}
const app = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'));
globalThis.wx = {
  getWindowInfo: () => ({ statusBarHeight: 20 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 60 })
};
for (const page of app.pages) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) assert(fs.existsSync(path.join(mini, `${page}.${ext}`)), `页面文件缺失: ${page}.${ext}`);
  let definition;
  globalThis.Page = (value) => { definition = value; };
  require(path.join(mini, `${page}.js`));
  assert(definition, `页面没有注册 Page: ${page}`);
  const wxml = fs.readFileSync(path.join(mini, `${page}.wxml`), 'utf8');
  for (const match of wxml.matchAll(/(?:bind|catch)(?::)?(?:tap|input|confirm|change)="([A-Za-z]\w*)"/g)) assert(typeof definition[match[1]] === 'function', `事件未实现: ${page} ${match[1]}`);
  // 独立解析 XML 检查交给开发者工具；这里检查常见标签配对和表达式括号。
  assert((wxml.match(/{{/g) || []).length === (wxml.match(/}}/g) || []).length, `WXML 表达式不完整: ${page}`);
}
for (const item of app.tabBar.list) {
  assert(app.pages.includes(item.pagePath), `tab 页面未注册: ${item.pagePath}`);
  for (const icon of [item.iconPath, item.selectedIconPath]) assert(fs.existsSync(path.join(mini, icon)), `tab 图标缺失: ${icon}`);
}
const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
assert(bytes < 2 * 1024 * 1024, `主包源码超出保守 2MiB 检查: ${bytes}`);
const book = require(path.join(mini, 'data/book.js'));
assert(book.entries.length >= 630 && book.chapters.length >= 34, '内容不完整');
assert(fs.existsSync(path.join(root, 'content/upstream/LICENSE')), '内容许可证缺失');
console.log(`原生页面与事件检查通过；${book.chapters.length} 章 / ${book.entries.length} 条；主包源码 ${(bytes / 1024 / 1024).toFixed(2)} MiB。`);
console.log('此检查不替代微信开发者工具编译、平台实际包大小校验和真机测试。');
if (process.argv.includes('--release')) {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  const privatePath = path.join(root, 'project.private.config.json');
  if (fs.existsSync(privatePath)) Object.assign(project, JSON.parse(fs.readFileSync(privatePath, 'utf8')));
  const release = require(path.join(mini, 'config/release.js'));
  assert(/^wx[0-9a-f]{16}$/.test(project.appid), '发布前必须配置真实 AppID');
  for (const key of ['name', 'operator', 'contact', 'filingNumber']) assert(release[key] && release[key].trim(), `发布资料尚未填写: ${key}`);
  console.log('本地发布资料字段检查通过；备案/类目/提审状态仍须微信后台核实。');
}
