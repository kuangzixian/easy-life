const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHTML, safeURL, parseRoute, resolveModule } = require('../web/core.js');

test('web content is escaped and citations cannot inject active protocols', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)"> &'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;');
  for (const url of ['javascript:alert(1)', 'data:text/html,foo', '/local', 'https://user:pass@example.com']) assert.equal(safeURL(url), '');
  assert.equal(safeURL('https://doi.org/10.1037/xhp0000100'), 'https://doi.org/10.1037/xhp0000100');
});

test('web deep links validate IDs and handle malformed URLs', () => {
  assert.deepEqual(parseRoute(''), { page: 'home' });
  assert.deepEqual(parseRoute('#chapter/34'), { page: 'chapter', id: 34 });
  assert.deepEqual(parseRoute('#read/3-1'), { page: 'read', id: '3-1' });
  assert.deepEqual(parseRoute('#favorites'), { page: 'favorites' });
  for (const value of ['#%E0%A4%A', '#chapter/0', '#read/../../secret', '#read/3-1/extra', '#<script>']) assert.deepEqual(parseRoute(value), { page: 'not-found' });
  assert.equal(resolveModule('miniprogram/utils/content.js', '../data/book'), 'miniprogram/data/book.js');
});
