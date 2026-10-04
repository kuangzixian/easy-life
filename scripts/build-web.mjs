import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.webmanifest', '.txt', '.woff', '.woff2']);
const publicEntries = new Set(['index.html', '404.html', 'app.js', 'core.js', 'styles.css', 'favicon.svg', 'favicon.ico', 'manifest.webmanifest', 'robots.txt', '_headers']);

function filesIn(directory) {
  if (!fs.lstatSync(directory).isDirectory()) throw new Error(`Public source must be a regular directory: ${directory}`);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    // Public assets never follow symlinks or include local editor and secret files.
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function moduleBundle(root) {
  const moduleFiles = filesIn(path.join(root, 'miniprogram/utils')).filter((file) => path.extname(file) === '.js');
  moduleFiles.push(path.join(root, 'miniprogram/data/book.js'), path.join(root, 'miniprogram/config/release.js'));
  const sources = new Map(moduleFiles.map((file) => {
    if (!fs.lstatSync(file).isFile()) throw new Error(`Module must be a regular file: ${path.relative(root, file)}`);
    const relativeReal = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    if (relativeReal.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReal)) throw new Error('Browser modules cannot link outside the project.');
    return [path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')];
  }));
  for (const [id, source] of sources) {
    for (const match of source.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g)) {
      const specifier = match[2];
      if (!specifier.startsWith('.')) throw new Error(`Unsupported browser module dependency in ${id}: ${specifier}`);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier));
      if (!sources.has(resolved) && !sources.has(`${resolved}.js`)) throw new Error(`Missing browser module dependency in ${id}: ${specifier}`);
    }
  }
  const bundle = [
    '/* Generated static browser bundle. Code: MIT. Text: CC BY 4.0, eternity4719 / HowToLiveBetter. */',
    'window.EasyLifeModules = Object.create(null);',
    ...Array.from(sources, ([id, source]) => `window.EasyLifeModules[${JSON.stringify(id)}] = function(require, module, exports) {\n${source}\n};`),
    ''
  ].join('\n');
  new Script(bundle, { filename: 'bundle.js' });
  return { bundle, moduleCount: sources.size };
}

export function buildWeb(options = {}) {
  const root = path.resolve(options.root || projectRoot);
  const source = path.join(root, 'web');
  // Keep the deletion target fixed to the generated directory, never a source path.
  const destination = path.join(root, 'dist');
  for (const entry of ['index.html', 'app.js', 'styles.css']) {
    const file = path.join(source, entry);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error(`Web entry file is missing: web/${entry}`);
  }
  const publicFiles = filesIn(source).filter((file) => {
    const relative = path.relative(source, file).split(path.sep).join('/');
    return publicEntries.has(relative) || (relative.startsWith('assets/') && publicExtensions.has(path.extname(file).toLowerCase()));
  });
  if (fs.existsSync(path.join(source, 'bundle.js'))) throw new Error('web/bundle.js is reserved for the generated content bundle.');
  for (const file of publicFiles.filter((file) => path.extname(file) === '.js')) new Script(fs.readFileSync(file, 'utf8'), { filename: path.relative(root, file) });
  const { bundle, moduleCount } = moduleBundle(root);
  const staging = fs.mkdtempSync(path.join(root, '.web-build-'));
  try {
    for (const file of publicFiles) {
      const output = path.join(staging, path.relative(source, file));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(file, output);
    }
    fs.writeFileSync(path.join(staging, 'bundle.js'), bundle);
    // Disable GitHub Pages' Jekyll processing; Cloudflare simply serves this file.
    fs.writeFileSync(path.join(staging, '.nojekyll'), '');
    fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(staging, destination);
    return { outputDir: destination, fileCount: publicFiles.length + 2, moduleCount, bundleBytes: Buffer.byteLength(bundle) };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildWeb();
    console.log(`网页版已构建到 dist/：${result.fileCount} 个公开文件，${result.moduleCount} 个共享模块，内容包 ${(result.bundleBytes / 1024 / 1024).toFixed(2)} MiB。`);
  } catch (error) {
    console.error(`Web build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
