const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const book = require('../miniprogram/data/book');
const importer = import(pathToFileURL(path.join(root, 'scripts/import-content.mjs')));

test('the pinned snapshot retains all 34 chapters and 630 uniquely ordered entries', () => {
  assert.equal(book.chapters.length, 34);
  assert.equal(book.entries.length, 630);
  assert.equal(new Set(book.entries.map(entry => entry.id)).size, 630);
  assert.equal(book.meta.commit, 'e91118de217945dfb8e3561dddc74c97cc64a707');
  for (const [index, chapter] of book.chapters.entries()) {
    assert.equal(chapter.id, index + 1);
    const entries = book.entries.filter(entry => entry.chapterId === chapter.id);
    assert.equal(entries.length, chapter.count);
    assert.deepEqual(chapter.entryIds, entries.map(entry => entry.id));
    assert.ok(chapter.description);
    for (const [index, entry] of entries.entries()) {
      assert.equal(entry.id, `${chapter.id}-${index + 1}`);
      assert.equal(entry.number, index + 1);
      assert.equal(entry.chapterTitle, chapter.title);
      for (const field of ['title', 'summary', 'cost', 'benefit', 'evidence', 'sourceText', 'notes', 'sourceUrl']) assert.ok(entry[field], `${entry.id}: ${field}`);
      assert.match(entry.evidence, /^[ABC](?:（.+）)?$/);
      assert.equal(entry.evidenceGrade, entry.evidence[0]);
      assert.deepEqual(Object.keys(entry.tags).sort(), ['benefit', 'effort', 'metric', 'money', 'time']);
    }
  }
});

test('all citation links remain indexed, including DOI URLs with parentheses and HTTP sources', () => {
  let count = 0;
  for (const entry of book.entries) {
    let unparsed = entry.sourceText;
    for (const source of entry.sources) {
      assert.ok(source.title);
      assert.ok(entry.sourceText.includes(source.url));
      assert.match(source.url, /^https?:\/\//);
      unparsed = unparsed.replace(source.url, '');
      count++;
    }
    assert.ok(!/https?:\/\//.test(unparsed), `${entry.id}: unindexed citation`);
    assert.match(entry.sourceUrl, /\/blob\/e91118de217945dfb8e3561dddc74c97cc64a707\/book\/.+#L\d+$/);
  }
  assert.ok(count > 1000, `Only ${count} links survived`);
  assert.ok(book.entries.some(entry => entry.sources.some(source => source.url.includes('S2215-0366(16)30030-X'))));
  assert.ok(book.entries.some(entry => entry.sources.some(source => source.url.startsWith('http://'))));
});

test('offline rebuild verifies source hashes and produces byte-identical data under 2 MiB', async () => {
  const { buildBook, renderBook } = await importer;
  const generated = renderBook(buildBook(root));
  const saved = fs.readFileSync(path.join(root, 'miniprogram/data/book.js'), 'utf8');
  assert.equal(generated, saved);
  assert.ok(Buffer.byteLength(saved) < 2 * 1024 * 1024);
  assert.match(fs.readFileSync(path.join(root, 'content/upstream/LICENSE'), 'utf8'), /Attribution 4\.0 International/);
});

test('source fields are retained in full and the chapter footer is not attached to the final note', () => {
  const raw = fs.readFileSync(path.join(root, 'content/upstream/book/01-不要早死.md'), 'utf8');
  const first = book.entries[0];
  assert.ok(raw.includes(`- 说人话：${first.summary}\n`));
  assert.ok(raw.includes(`- 来源：${first.sourceText}\n`));
  assert.ok(raw.includes(`- 备注：${first.notes}\n`));
  assert.match(book.chapters[25].afterword, /^## 许可/);
  assert.ok(!book.entries.find(entry => entry.id === '26-11').notes.includes('## 许可'));
});

test('multiline fields survive, while unknown fields and unsupported citations fail explicitly', async () => {
  const { parseChapter, parseSources } = await importer;
  const markdown = '# 1. 示例\n\n章介绍。\n\n### 1. 建议\n<!-- 成本标签: 钱=0 时间=少 毅力=否 收益=中 口径=时间 -->\n- 成本：第一行\n第二行\n\n第三行\n- 说人话：摘要\n- 收益：收益\n- 证据等级：B\n- 来源：文献 <https://example.com/a(1)>\n- 备注：备注\n继续备注\n';
  const parsed = parseChapter(markdown, '01-示例.md', { repository: 'https://example.com', commit: 'abc' });
  assert.equal(parsed.entries[0].cost, '第一行\n第二行\n\n第三行');
  assert.equal(parsed.entries[0].notes, '备注\n继续备注');
  assert.equal(parsed.entries[0].sources[0].url, 'https://example.com/a(1)');
  assert.throws(() => parseChapter(markdown.replace('- 成本：', '- 新字段：'), '01-示例.md', {}), /unknown field/);
  assert.throws(() => parseSources('文献 https://example.com/unsupported'), /Unrecognized citation format/);
});

test('the explicit medical correction is applied without changing the pinned source or any other note', async () => {
  const { parseChapter } = await importer;
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'content/provenance.json'), 'utf8'));
  const manifestText = fs.readFileSync(path.join(root, 'content/editorial-overrides.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(provenance.editorialOverrides.sha256, createHash('sha256').update(manifestText).digest('hex'));
  assert.equal(manifest.overrides.length, 1);
  const correction = manifest.overrides[0];
  const corrected = book.entries.find(entry => entry.id === '1-5');
  assert.equal(corrected.notes, correction.replacement);
  assert.equal(corrected.editorialNote, correction.editorialNote);
  assert.deepEqual(corrected.editorialSources, correction.editorialSources);
  assert.ok(corrected.notes.includes('不要自行催吐'));
  assert.ok(!fs.readFileSync(path.join(root, 'miniprogram/data/book.js'), 'utf8').includes('吃错了就立刻催吐'));
  for (const filename of provenance.bookFiles) {
    const raw = fs.readFileSync(path.join(root, 'content/upstream', filename), 'utf8');
    assert.equal(createHash('sha256').update(raw).digest('hex'), provenance.files[filename].sha256);
    const parsed = parseChapter(raw, filename.slice(5), provenance);
    for (const original of parsed.entries) {
      const entry = book.entries.find(entry => entry.id === original.id);
      if (entry.id === '1-5') {
        assert.ok(original.notes.includes('吃错了就立刻催吐'));
        assert.equal(createHash('sha256').update(original.notes).digest('hex'), correction.expectedOriginalSha256);
      } else {
        assert.equal(entry.notes, original.notes, `Unexpected note edit: ${entry.id}`);
        assert.equal(entry.editorialNote, undefined);
      }
    }
  }
});
