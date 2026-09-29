#!/usr/bin/env node
/** Deterministic, offline import of the pinned HowToLiveBetter text. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPOSITORY = 'https://github.com/eternity4719/HowToLiveBetter';
const PINNED_COMMIT = 'e91118de217945dfb8e3561dddc74c97cc64a707';
const EXPECTED_CHAPTERS = 34;
const EXPECTED_ENTRIES = 630;
const FIELD_NAMES = {
  成本: 'cost', 说人话: 'summary', 收益: 'benefit', 证据等级: 'evidence', 来源: 'sourceText', 备注: 'notes',
};
const TAG_NAMES = { 钱: 'money', 时间: 'time', 毅力: 'effort', 收益: 'benefit', 口径: 'metric' };
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

function parseTags(line, location) {
  const match = line.match(/^<!-- 成本标签: (.+) -->$/);
  invariant(match, `${location}: missing or malformed cost tags`);
  const tags = {};
  for (const pair of match[1].split(/\s+/)) {
    const [name, value, extra] = pair.split('=');
    invariant(TAG_NAMES[name] && value && !extra, `${location}: unknown tag ${pair}`);
    invariant(!Object.hasOwn(tags, TAG_NAMES[name]), `${location}: duplicate tag ${name}`);
    tags[TAG_NAMES[name]] = value;
  }
  invariant(Object.keys(tags).length === Object.keys(TAG_NAMES).length, `${location}: incomplete tags`);
  return tags;
}

/** Source prose stays intact in sourceText; sources is only a convenient link index. */
export function parseSources(sourceText) {
  const results = [];
  const links = /<(https?:\/\/[^>\s]+)>|\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g;
  let previousEnd = 0;
  for (const match of sourceText.matchAll(links)) {
    const url = match[1] || match[3];
    // Quotes following a link belong to the previous citation. Prefer the final
    // semicolon-delimited citation label, while retaining all prose separately.
    let title = match[2] || sourceText.slice(previousEnd, match.index).split(/[;；]/).at(-1).trim();
    title = title.replace(/^[\s：:，,。]+/, '').split(/[「“]/)[0].trim();
    title = title.replace(/[：:]$/, '').trim();
    if (!title || /^[（(]/.test(title)) title = new URL(url).hostname;
    if (Array.from(title).length > 140) title = `${Array.from(title).slice(0, 139).join('')}…`;
    // URL validation does not request the resource or replace its original form.
    const parsed = new URL(url);
    invariant(['http:', 'https:'].includes(parsed.protocol), `Unsupported citation URL: ${url}`);
    results.push({ title, url });
    previousEnd = match.index + match[0].length;
  }
  const unparsed = sourceText.replace(links, '');
  invariant(!/https?:\/\//.test(unparsed), 'Unrecognized citation format; source import stopped without dropping links');
  return results;
}

export function parseChapter(markdown, filename, provenance) {
  const text = markdown.replace(/\r\n/g, '\n');
  const heading = text.match(/^# (\d+)\. (.+)$/m);
  invariant(heading, `${filename}: missing chapter heading`);
  const chapterId = Number(heading[1]);
  invariant(Number(filename.slice(0, 2)) === chapterId, `${filename}: chapter number mismatch`);
  const chapterTitle = heading[2].trim();
  const starts = [...text.matchAll(/^### (\d+)\. (.+)$/gm)];
  invariant(starts.length > 0, `${filename}: no entries`);
  const description = text.slice(heading.index + heading[0].length, starts[0].index).trim();
  invariant(!/^#{1,6} /m.test(description), `${filename}: unrecognized heading before entries`);
  const chapter = { id: chapterId, title: chapterTitle, description, count: starts.length, entryIds: [] };
  const entries = starts.map((start, index) => {
    const number = Number(start[1]);
    const id = `${chapterId}-${number}`;
    invariant(number === index + 1, `${filename}: entry numbering must be consecutive (${id})`);
    let body = text.slice(start.index + start[0].length, starts[index + 1]?.index ?? text.length).trim();
    // One chapter has its own license footer. Keep it as chapter-level prose.
    const footerIndex = body.search(/^## /m);
    if (footerIndex !== -1) {
      invariant(index === starts.length - 1, `${id}: section footer before final entry`);
      chapter.afterword = body.slice(footerIndex).trim();
      body = body.slice(0, footerIndex).trim();
    }
    const lines = body.split('\n');
    const tags = parseTags(lines.shift(), id);
    const fields = {};
    let activeField = null;
    for (const line of lines) {
      invariant(!/^#{1,6} |^<!--/.test(line), `${id}: unrecognized structure ${line}`);
      const field = line.match(/^- ([^：]+)：(.*)$/);
      if (field) {
        invariant(FIELD_NAMES[field[1]], `${id}: unknown field ${field[1]}`);
        activeField = FIELD_NAMES[field[1]];
        invariant(!Object.hasOwn(fields, activeField), `${id}: duplicate field ${field[1]}`);
        fields[activeField] = field[2];
      } else {
        invariant(activeField || !line.trim(), `${id}: text before first field`);
        if (activeField) fields[activeField] += `\n${line}`;
      }
    }
    for (const field of Object.values(FIELD_NAMES)) {
      invariant(Object.hasOwn(fields, field) && fields[field].trim(), `${id}: missing ${field}`);
      fields[field] = fields[field].trim();
    }
    invariant(/^[ABC](?:（.+）)?$/.test(fields.evidence), `${id}: unrecognized evidence grade`);
    const lineNumber = text.slice(0, start.index).split('\n').length;
    chapter.entryIds.push(id);
    return {
      id, chapterId, chapterTitle, number, title: start[2].trim(),
      summary: fields.summary, cost: fields.cost, benefit: fields.benefit,
      evidence: fields.evidence, evidenceGrade: fields.evidence[0], sourceText: fields.sourceText,
      sources: parseSources(fields.sourceText), notes: fields.notes, tags,
      sourceUrl: `${provenance.repository}/blob/${provenance.commit}/book/${filename}#L${lineNumber}`,
    };
  });
  return { chapter, entries };
}

function sourceBookFiles(readme) {
  const from = readme.indexOf('\n## 目录\n');
  const to = readme.indexOf('\n## 正文\n', from);
  invariant(from >= 0 && to > from, 'README is missing the table of contents');
  return [...new Set([...readme.slice(from, to).matchAll(/\]\((book\/[^)#]+\.md)\)/g)].map(match => match[1]))];
}

function readEditorial(root) {
  const file = 'content/editorial-overrides.json';
  const raw = read(resolve(root, file));
  const manifest = JSON.parse(raw);
  invariant(manifest.version === 1 && Array.isArray(manifest.overrides), 'Unsupported editorial override format');
  const records = new Set();
  for (const override of manifest.overrides) {
    invariant(override.entryId === '1-5' && override.field === 'notes', 'An editorial change outside the reviewed 1-5.notes scope requires importer review');
    invariant(!records.has(`${override.entryId}.${override.field}`), 'Duplicate editorial override');
    records.add(`${override.entryId}.${override.field}`);
    invariant(/^[a-f0-9]{64}$/.test(override.expectedOriginalSha256), 'Editorial override must identify its original text hash');
    invariant(override.replacement && override.editorialNote && override.editorialSources?.length, 'Editorial override must include replacement, notice, and sources');
    for (const source of override.editorialSources) {
      invariant(source.title && new URL(source.url).protocol === 'https:', 'Editorial source must include a title and an HTTPS URL');
    }
  }
  invariant(manifest.overrides.length === 1, 'Expected the single reviewed mushroom-poisoning editorial correction');
  return {
    manifest,
    provenance: {
      file, sha256: sha256(raw), updatedAt: manifest.updatedAt, summary: manifest.summary,
      patches: manifest.overrides.map(({ entryId, field, expectedOriginalSha256 }) => ({ entryId, field, expectedOriginalSha256 })),
    },
  };
}

function vendorSource(sourcePath) {
  const source = resolve(sourcePath);
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
  invariant(commit === PINNED_COMMIT, `Expected pinned upstream ${PINNED_COMMIT}, received ${commit}; review and update the pin explicitly first`);
  const status = execFileSync('git', ['status', '--porcelain', '--', 'README.md', 'LICENSE', 'book'], { cwd: source, encoding: 'utf8' });
  invariant(!status.trim(), 'Upstream content has uncommitted edits; refusing to label it as the pinned commit');
  const updatedAt = execFileSync('git', ['show', '-s', '--format=%cI', commit], { cwd: source, encoding: 'utf8' }).trim();
  const readme = read(resolve(source, 'README.md'));
  const bookFiles = sourceBookFiles(readme);
  invariant(bookFiles.length === EXPECTED_CHAPTERS, `Expected ${EXPECTED_CHAPTERS} chapters in upstream README`);
  const actualFiles = readdirSync(resolve(source, 'book')).filter(name => name.endsWith('.md')).map(name => `book/${name}`).sort();
  invariant(JSON.stringify([...bookFiles].sort()) === JSON.stringify(actualFiles), 'README chapters do not match book/ Markdown files');
  const vendor = resolve(ROOT, 'content/upstream');
  mkdirSync(vendor, { recursive: true });
  // This directory contains only importer-managed source snapshots.
  if (existsSync(resolve(vendor, 'book'))) rmSync(resolve(vendor, 'book'), { recursive: true });
  mkdirSync(resolve(vendor, 'book'), { recursive: true });
  const files = {};
  for (const name of ['README.md', 'LICENSE', ...bookFiles]) {
    const text = read(resolve(source, name));
    writeFileSync(resolve(vendor, name), text);
    files[name] = { sha256: sha256(text), bytes: Buffer.byteLength(text) };
  }
  const provenance = {
    title: '高性价比人生指南', author: 'eternity4719 及 HowToLiveBetter 贡献者',
    repository: REPOSITORY, commit, updatedAt,
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    expectedChapters: EXPECTED_CHAPTERS, expectedEntries: EXPECTED_ENTRIES,
    normalization: 'UTF-8; CRLF normalized to LF; all text otherwise unchanged',
    bookFiles, files, editorialOverrides: readEditorial(ROOT).provenance,
  };
  writeFileSync(resolve(ROOT, 'content/provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  return provenance;
}

export function buildBook(root = ROOT) {
  const provenance = JSON.parse(read(resolve(root, 'content/provenance.json')));
  const editorial = readEditorial(root);
  invariant(JSON.stringify(provenance.editorialOverrides) === JSON.stringify(editorial.provenance), 'Editorial metadata changed; run the content import to refresh its audit record');
  invariant(provenance.commit === PINNED_COMMIT, 'Vendored provenance does not match the reviewed upstream pin');
  const vendor = resolve(root, 'content/upstream');
  for (const [filename, record] of Object.entries(provenance.files)) {
    const text = read(resolve(vendor, filename));
    invariant(sha256(text) === record.sha256 && Buffer.byteLength(text) === record.bytes, `Vendored source differs from provenance: ${filename}`);
  }
  const book = {
    meta: {
      title: provenance.title, author: provenance.author, repository: provenance.repository,
      commit: provenance.commit, updatedAt: provenance.updatedAt, license: provenance.license,
      licenseUrl: provenance.licenseUrl, chapterCount: EXPECTED_CHAPTERS, entryCount: EXPECTED_ENTRIES,
      adaptation: '微信小程序阅读、检索与卡片展示；字段结构、来源链接索引及排版由本项目整理。证据等级沿用原书，未作独立认证。第 1 章第 5 条处置备注有明确标注的本项目修订，原始快照另行保留。',
      editorialUpdatedAt: editorial.manifest.updatedAt,
    },
    chapters: [], entries: [],
  };
  for (const path of provenance.bookFiles) {
    const parsed = parseChapter(read(resolve(vendor, path)), path.slice(5), provenance);
    book.chapters.push(parsed.chapter);
    book.entries.push(...parsed.entries);
  }
  invariant(book.chapters.length === EXPECTED_CHAPTERS, 'Chapter count changed');
  invariant(book.entries.length === EXPECTED_ENTRIES, 'Entry count changed');
  invariant(new Set(book.entries.map(entry => entry.id)).size === EXPECTED_ENTRIES, 'Duplicate entry IDs');
  for (const override of editorial.manifest.overrides) {
    const entry = book.entries.find(entry => entry.id === override.entryId);
    invariant(entry && sha256(entry[override.field]) === override.expectedOriginalSha256, `${override.entryId}: original text changed; editorial correction requires review`);
    entry[override.field] = override.replacement;
    entry.editorialNote = override.editorialNote;
    entry.editorialSources = override.editorialSources;
  }
  return book;
}

export function renderBook(book) {
  return `// Generated by scripts/import-content.mjs; edit source or explicit editorial records instead.\n// Text: CC BY 4.0, eternity4719 / HowToLiveBetter. See content/NOTICE.md.\nmodule.exports = ${JSON.stringify(book)};\n`;
}

function main() {
  const args = process.argv.slice(2);
  invariant(args.length === 0 || (args.length === 2 && args[0] === '--source'), 'Usage: node scripts/import-content.mjs [--source /path/to/pinned/upstream]');
  if (args.length) vendorSource(args[1]);
  const provenancePath = resolve(ROOT, 'content/provenance.json');
  const provenance = JSON.parse(read(provenancePath));
  provenance.editorialOverrides = readEditorial(ROOT).provenance;
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  const book = buildBook();
  const output = renderBook(book);
  const bytes = Buffer.byteLength(output);
  invariant(bytes < 2 * 1024 * 1024, `Generated book is ${bytes} bytes, over the 2 MiB data limit`);
  const outputPath = resolve(ROOT, 'miniprogram/data/book.js');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`Imported ${book.chapters.length} chapters, ${book.entries.length} entries, ${book.entries.reduce((n, e) => n + e.sources.length, 0)} citation links; ${bytes} bytes → ${relative(ROOT, outputPath).split(sep).join('/')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
