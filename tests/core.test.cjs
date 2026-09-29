const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../miniprogram/utils/content');
const { createStore, STORAGE_KEY } = require('../miniprogram/utils/storage');

test('reading order spans chapters and handles both ends and unknown links', () => {
  const entries = content.getEntries();
  assert.equal(content.getNeighbors(entries[0].id).previous, null);
  assert.equal(content.getNeighbors(entries.at(-1).id).next, null);
  for (let i = 1; i < entries.length; i++) assert.equal(content.getNeighbors(entries[i - 1].id).next.id, entries[i].id);
  assert.deepEqual(content.getNeighbors('missing'), { previous: null, next: null });
  assert.equal(content.getEntry('missing'), null);
});

test('natural language retrieval finds relevant original passages and citations', () => {
  for (const [query, pattern] of [
    ['被裁员了该怎么办', /失业|补偿|离职|裁员/],
    ['房东不退押金怎么办', /押金|房东/],
    ['总被消息打断，怎么集中注意力', /打断|通知|消息/],
    ['想改掉拖延的习惯', /拖延|习惯|子任务/],
    ['睡不好怎么办', /睡|咖啡|起床/],
    ['学不进去', /学完|学法|学习|自测|几天/],
    ['工资没发', /欠薪|拖欠|仲裁/],
    ['替朋友担保签不签', /担保|保证/]
  ]) {
    const result = content.search(query);
    assert.ok(result.length, query);
    assert.ok(result.slice(0, 5).some(({ entry }) => pattern.test(entry.title + entry.summary)), query);
    assert.ok(result.every(({ entry }) => entry.sourceUrl && entry.sourceText && Array.isArray(entry.sources)));
  }
});

test('empty, unsupported, short and non-string queries are safe', () => {
  for (const query of ['', ' ', '我', null, undefined, '量子引力的张量场方程', 'zxqv939393', '有什么建议', '怎么做']) {
    assert.equal(content.search(query).length, 0, String(query));
  }
  assert.doesNotThrow(() => content.search({}));
  assert.ok(content.search('密码').length);
});

test('random packs are distinct and rotate before repeating, including small categories', () => {
  const first = content.randomEntries({ count: 5 });
  const next = content.randomEntries({ count: 5, excludeIds: first.map((entry) => entry.id) });
  assert.equal(first.length, 5);
  assert.equal(new Set(first.concat(next).map((entry) => entry.id)).size, 10);
  const few = content.randomEntries({ count: 5, chapterId: 14 });
  assert.equal(few.length, 3);
  assert.equal(new Set(few.map((entry) => entry.id)).size, few.length);
  assert.deepEqual(content.randomEntries({ count: 0 }), []);
  assert.deepEqual(content.randomEntries({ chapterId: 999 }), []);
  assert.equal(content.getDailyEntry('2026-09-30').id, content.getDailyEntry('2026-09-30').id);
  assert.equal(content.CARD_IDS.length, content.randomEntries({ count: 50 }).length);
  assert.ok(content.randomEntries({ count: 50 }).every((entry) => [3, 4, 14, 22, 23].includes(entry.chapterId)));
});

test('favorites and progress persist; reset only removes this application key', () => {
  const disk = { unrelated: 1 };
  const store = createStore({ get: (key) => disk[key], set: (key, value) => { disk[key] = JSON.parse(JSON.stringify(value)); }, remove: (key) => { delete disk[key]; } });
  assert.equal(store.toggleFavorite('1-1'), true);
  store.markRead('1-1'); store.markRead('1-1'); store.markRead('1-2');
  assert.deepEqual(store.getFavorites(), ['1-1']);
  assert.deepEqual(store.getProgress(), { lastId: '1-2', readIds: ['1-1', '1-2'] });
  assert.equal(store.toggleFavorite('1-1'), false);
  assert.equal(store.clearAll(), true);
  assert.deepEqual(disk, { unrelated: 1 });
});

test('corrupted local storage and failed writes do not fabricate successful saves', () => {
  let value = { favorites: ['1-1', '1-1', {}, null], lastId: {}, readIds: 'broken' };
  let errors = 0;
  const store = createStore({ get: () => value, set: () => { throw new Error('quota'); }, remove: () => { throw new Error('quota'); }, onError: () => errors++ });
  assert.deepEqual(store.getFavorites(), ['1-1']);
  assert.equal(store.toggleFavorite('1-2'), false);
  assert.equal(store.toggleFavorite('1-1'), true);
  assert.equal(store.clearAll(), false);
  assert.equal(errors, 3);
  value = null;
  assert.deepEqual(store.getProgress(), { lastId: null, readIds: [] });
  assert.equal(store.toggleFavorite('__proto__'), false);
  assert.equal(STORAGE_KEY, 'easy-life:reading:v1');
});
