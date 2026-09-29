const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const miniRoot = path.resolve(__dirname, '../miniprogram');
const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const tap = (dataset) => ({ currentTarget: { dataset } });
const input = (value) => ({ detail: { value } });

// Each test gets one app/storage/module graph, as separate pages in a real app do.
// Page code, content retrieval and persistence are real; only the WeChat host is mocked.
function createRuntime() {
  const disk = new Map();
  const events = [];
  const cache = new Map();
  const app = { globalData: { libraryChapterId: null } };
  const failures = { write: false, remove: false };
  const modal = { confirm: true };
  const navigation = { depth: 2 };
  let definition;
  const wx = {
    getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 390, windowHeight: 844 }),
    getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390, windowHeight: 844 }),
    getMenuButtonBoundingClientRect: () => ({ top: 30, bottom: 62, left: 280, right: 374, height: 32 }),
    getStorageSync: (key) => copy(disk.get(key)),
    setStorageSync(key, value) {
      if (failures.write) throw new Error('Device storage is full');
      disk.set(key, copy(value));
    },
    removeStorageSync(key) {
      if (failures.remove) throw new Error('Device storage removal failed');
      disk.delete(key);
    },
    showToast: (options) => events.push({ type: 'toast', ...copy(options) }),
    navigateTo: (options) => events.push({ type: 'navigate', ...copy(options) }),
    redirectTo: (options) => events.push({ type: 'redirect', ...copy(options) }),
    switchTab: (options) => events.push({ type: 'tab', ...copy(options) }),
    navigateBack: () => events.push({ type: 'back' }),
    pageScrollTo: (options) => events.push({ type: 'scroll', ...copy(options) }),
    hideKeyboard: () => events.push({ type: 'keyboard-hidden' }),
    vibrateShort: () => {},
    showModal(options) {
      events.push({ type: 'modal', title: options.title, content: options.content });
      if (options.success) options.success({ confirm: modal.confirm, cancel: !modal.confirm });
    },
    setClipboardData(options) {
      events.push({ type: 'clipboard', data: options.data });
      if (options.success) options.success();
    },
    setNavigationBarTitle: () => {}
  };
  const context = vm.createContext({
    wx, console, setTimeout, clearTimeout,
    Page: (page) => { definition = page; },
    getApp: () => app,
    getCurrentPages: () => Array.from({ length: navigation.depth }, () => ({}))
  });

  function load(filename) {
    let resolved = path.resolve(filename);
    if (!path.extname(resolved)) resolved += '.js';
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const factory = vm.runInContext(`(function(require, module, exports) {\n${fs.readFileSync(resolved, 'utf8')}\n})`, context, { filename: resolved });
    factory((request) => {
      assert.ok(request.startsWith('.'), `Unexpected platform dependency: ${request}`);
      return load(path.resolve(path.dirname(resolved), request));
    }, module, module.exports);
    return module.exports;
  }

  function page(name, options = {}) {
    const filename = path.join(miniRoot, 'pages', name, 'index.js');
    cache.delete(filename);
    definition = null;
    load(filename);
    assert.ok(definition, `${name} must register a Page`);
    const instance = { ...definition, data: copy(definition.data) };
    instance.setData = function setData(patch, callback) {
      for (const [key, value] of Object.entries(patch)) {
        const segments = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        let target = this.data;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = copy(value);
      }
      if (callback) callback();
    };
    if (instance.onLoad) instance.onLoad(options);
    if (instance.onShow) instance.onShow();
    return instance;
  }

  return { page, app, events, failures, modal, disk, navigation,
    content: load(path.join(miniRoot, 'utils/content.js')),
    storage: load(path.join(miniRoot, 'utils/storage.js'))
  };
}

test('home opens the first article initially and resumes the last article after returning', () => {
  const runtime = createRuntime();
  const home = runtime.page('home');
  assert.equal(home.data.progress, null);
  assert.ok(home.data.daily.id);
  home.read();
  assert.equal(runtime.events.at(-1).url, `/pages/detail/index?id=${runtime.content.getEntries()[0].id}`);
  runtime.storage.markRead('3-5');
  home.onShow();
  assert.equal(home.data.progress.id, '3-5');
  assert.equal(home.data.readCount, 1);
  home.read();
  assert.equal(runtime.events.at(-1).url, '/pages/detail/index?id=3-5');
});

test('home chapter shortcuts select the requested library chapter once, including from favorites', () => {
  const runtime = createRuntime();
  const library = runtime.page('library');
  library.changeMode(tap({ mode: 'favorites' }));
  runtime.page('home').openChapter(tap({ id: 4 }));
  assert.equal(runtime.events.at(-1).url, '/pages/library/index');
  library.onShow();
  assert.equal(library.data.mode, 'chapters');
  assert.equal(library.data.selectedChapter.id, 4);
  assert.ok(library.data.entries.length > 0);
  assert.ok(library.data.entries.every((entry) => runtime.content.getEntry(entry.id).chapterId === 4));
  assert.equal(runtime.app.globalData.libraryChapterId, null);
  library.showChapters();
  library.onShow();
  assert.equal(library.data.selectedChapter, null, 'a consumed shortcut must not reopen on a later visit');
});

test('library refreshes favorites and read state after another page changes local storage', () => {
  const runtime = createRuntime();
  const library = runtime.page('library');
  library.changeMode(tap({ mode: 'favorites' }));
  assert.deepEqual(library.data.entries, []);
  runtime.storage.toggleFavorite('3-5');
  runtime.storage.markRead('3-5');
  library.onShow();
  assert.equal(library.data.favoriteCount, 1);
  assert.deepEqual(library.data.entries.map((entry) => entry.id), ['3-5']);
  assert.equal(library.data.entries[0].read, true);
  runtime.storage.toggleFavorite('3-5');
  library.onShow();
  assert.equal(library.data.favoriteCount, 0);
  assert.deepEqual(library.data.entries, []);
  library.chooseChapter(tap({ id: 3 }));
  assert.equal(library.data.entries.find((entry) => entry.id === '3-5').favorite, false);
  assert.equal(library.data.entries.find((entry) => entry.id === '3-5').read, true);
});

test('library directory filtering can reach and recover from an empty result', () => {
  const runtime = createRuntime();
  const library = runtime.page('library');
  library.filterChapters(input('zz-no-such-chapter-993'));
  assert.deepEqual(library.data.visibleChapters, []);
  library.filterChapters(input('   '));
  assert.equal(library.data.visibleChapters.length, runtime.content.getChapters().length);
});

test('search input, submitted query, empty results and clearing stay coherent', () => {
  const runtime = createRuntime();
  const search = runtime.page('search');
  search.onInput(input('  手机丢了  '));
  assert.equal(search.data.hasSearched, false, 'typing alone should not replace the welcome state');
  search.submit();
  assert.equal(search.data.searchedQuery, '手机丢了');
  assert.equal(search.data.hasSearched, true);
  assert.equal(search.data.searching, false);
  assert.ok(search.data.results.some((entry) => entry.id === '14-4'));
  const first = search.data.results[0];
  search.openEntry(tap({ id: first.id }));
  assert.equal(runtime.events.at(-1).url, `/pages/detail/index?id=${first.id}`);
  search.chooseQuestion(tap({ query: 'zz-no-such-content-998732' }));
  assert.equal(search.data.hasSearched, true);
  assert.equal(search.data.searching, false);
  assert.deepEqual(search.data.results, []);
  search.clear();
  assert.equal(search.data.query, '');
  assert.equal(search.data.searchedQuery, '');
  assert.equal(search.data.hasSearched, false);
  assert.deepEqual(search.data.results, []);
  search.onInput(input(' \n '));
  search.submit();
  assert.equal(search.data.hasSearched, false);
});

test('search failures release the loading state and do not retain results from a previous question', () => {
  const runtime = createRuntime();
  const search = runtime.page('search');
  search.chooseQuestion(tap({ query: '手机丢了' }));
  assert.ok(search.data.results.length);
  runtime.content.search = () => { throw new Error('Simulated retrieval failure'); };
  search.chooseQuestion(tap({ query: '新的问题' }));
  assert.equal(search.data.searching, false);
  assert.deepEqual(search.data.results, []);
  assert.ok(runtime.events.some((event) => event.type === 'toast' && /检索.*问题/.test(event.title)));
});

test('cards rotate a full group without repeats and every offered category remains usable', () => {
  const runtime = createRuntime();
  const cards = runtime.page('cards');
  const firstIds = cards.data.cards.map((entry) => entry.id);
  assert.equal(firstIds.length, 5);
  cards.onCardChange({ detail: { current: 3 } });
  cards.draw();
  assert.equal(cards.data.current, 0);
  assert.equal(cards.data.cards.length, 5);
  assert.ok(cards.data.cards.every((entry) => !firstIds.includes(entry.id)));
  for (const chapter of cards.data.chapters) {
    cards.selectChapter(tap({ id: String(chapter.id) }));
    for (let pass = 0; pass < 2; pass++) {
      assert.ok(cards.data.cards.length > 0, `chapter ${chapter.id} cannot be empty`);
      assert.ok(cards.data.cards.length <= 5);
      assert.equal(new Set(cards.data.cards.map((entry) => entry.id)).size, cards.data.cards.length);
      assert.ok(cards.data.cards.every((entry) => entry.chapterId === chapter.id));
      cards.draw();
    }
  }
});

test('favoriting the visible card updates library after returning and follows swiper selection', () => {
  const runtime = createRuntime();
  const library = runtime.page('library');
  library.changeMode(tap({ mode: 'favorites' }));
  const cards = runtime.page('cards');
  cards.onCardChange({ detail: { current: 1 } });
  const chosen = cards.data.cards[1];
  cards.toggleFavorite();
  assert.equal(cards.data.favorite, true);
  library.onShow();
  assert.deepEqual(library.data.entries.map((entry) => entry.id), [chosen.id]);
  cards.openCurrent();
  assert.equal(runtime.events.at(-1).url, `/pages/detail/index?id=${chosen.id}`);
  assert.equal(cards.onShareAppMessage().path, `/pages/detail/index?id=${chosen.id}`);
  cards.onCardChange({ detail: { current: 0 } });
  assert.equal(cards.data.favorite, false);
  cards.onCardChange({ detail: { current: 1 } });
  cards.toggleFavorite();
  library.onShow();
  assert.deepEqual(library.data.entries, []);
});

test('a failed card save does not display a successful favorite or silently change persisted data', () => {
  const runtime = createRuntime();
  const cards = runtime.page('cards');
  runtime.failures.write = true;
  runtime.events.length = 0;
  cards.toggleFavorite();
  assert.equal(cards.data.favorite, false);
  assert.deepEqual(copy(runtime.storage.getFavorites()), []);
  const toasts = runtime.events.filter((event) => event.type === 'toast');
  assert.ok(toasts.some((event) => /失败/.test(event.title)));
  assert.ok(toasts.every((event) => !/已加入|已取消|成功/.test(event.title)));
});

test('detail follows reading order across chapter boundaries without growing the page stack', () => {
  const runtime = createRuntime();
  const chapter = runtime.content.getChapters()[0];
  const lastInChapter = runtime.content.getEntries(chapter.id).at(-1);
  const detail = runtime.page('detail', { id: lastInChapter.id });
  assert.equal(detail.data.notFound, false);
  assert.equal(detail.data.entry.id, lastInChapter.id);
  assert.equal(detail.data.next.chapterId, chapter.id + 1);
  assert.equal(runtime.storage.getProgress().lastId, lastInChapter.id);
  detail.navigateEntry(tap({ id: detail.data.next.id }));
  assert.equal(runtime.events.at(-1).type, 'redirect', 'next should replace the detail page, not exhaust WeChat navigation depth');
  assert.equal(runtime.events.at(-1).url, `/pages/detail/index?id=${detail.data.next.id}`);
  detail.navigateEntry(tap({ id: detail.data.previous.id }));
  assert.equal(runtime.events.at(-1).url, `/pages/detail/index?id=${detail.data.previous.id}`);
  const all = runtime.content.getEntries();
  const first = runtime.page('detail', { id: all[0].id });
  assert.equal(first.data.previous, null);
  const last = runtime.page('detail', { id: all.at(-1).id });
  assert.equal(last.data.next, null);
  const eventCount = runtime.events.length;
  last.navigateEntry(tap({ id: null }));
  assert.equal(runtime.events.length, eventCount, 'the missing neighbor must not trigger a broken URL');
});

test('an invalid detail deep link has a recoverable empty state and does not overwrite reading progress', () => {
  const runtime = createRuntime();
  runtime.storage.markRead('3-5');
  const detail = runtime.page('detail', { id: '99-999' });
  assert.equal(detail.data.notFound, true);
  assert.equal(detail.data.entry, null);
  assert.equal(detail.data.previous, null);
  assert.equal(detail.data.next, null);
  assert.equal(runtime.storage.getProgress().lastId, '3-5');
  detail.toggleFavorite();
  assert.deepEqual(copy(runtime.storage.getFavorites()), []);
  assert.equal(detail.onShareAppMessage().path, '/pages/home/index');
  detail.back();
  assert.equal(runtime.events.at(-1).type, 'back');
  runtime.navigation.depth = 1;
  detail.back();
  assert.equal(runtime.events.at(-1).type, 'tab');
  assert.equal(runtime.events.at(-1).url, '/pages/home/index', 'a directly opened invalid link must still have a way home');
});

test('detail, cards and library converge on the same favorite after navigating back', () => {
  const runtime = createRuntime();
  const cards = runtime.page('cards');
  const chosen = cards.data.cards[0];
  const detail = runtime.page('detail', { id: chosen.id });
  const library = runtime.page('library');
  library.changeMode(tap({ mode: 'favorites' }));
  detail.toggleFavorite();
  assert.equal(detail.data.favorite, true);
  cards.onShow();
  library.onShow();
  assert.equal(cards.data.favorite, true);
  assert.deepEqual(library.data.entries.map((entry) => entry.id), [chosen.id]);
  cards.toggleFavorite();
  detail.onShow();
  library.onShow();
  assert.equal(detail.data.favorite, false);
  assert.deepEqual(library.data.entries, []);
  detail.openChapter();
  library.onShow();
  assert.equal(library.data.selectedChapter.id, chosen.chapterId);
  assert.equal(runtime.app.globalData.libraryChapterId, null);
});

test('all-chapters shortcuts reset an existing chapter or favorites tab instead of reopening old content', () => {
  const runtime = createRuntime();
  const library = runtime.page('library');
  for (const origin of ['home', 'search']) {
    library.chooseChapter(tap({ id: 4 }));
    library.changeMode(tap({ mode: 'favorites' }));
    runtime.page(origin).openLibrary();
    library.onShow();
    assert.equal(library.data.mode, 'chapters');
    assert.equal(library.data.selectedChapter, null);
    assert.equal(library.data.visibleChapters.length, runtime.content.getChapters().length);
    assert.equal(runtime.app.globalData.libraryChapterId, null);
  }
});

test('about does not claim successful clearing when device storage removal fails', () => {
  const runtime = createRuntime();
  runtime.storage.toggleFavorite('3-5');
  runtime.storage.markRead('3-5');
  const about = runtime.page('about');
  assert.equal(about.data.favoriteCount, 1);
  assert.equal(about.data.readCount, 1);
  runtime.failures.remove = true;
  runtime.events.length = 0;
  about.clearData();
  assert.deepEqual(copy(runtime.storage.getFavorites()), ['3-5']);
  assert.equal(runtime.storage.getProgress().lastId, '3-5');
  assert.equal(about.data.favoriteCount, 1);
  assert.equal(about.data.readCount, 1);
  const toasts = runtime.events.filter((event) => event.type === 'toast');
  assert.ok(toasts.some((event) => /失败/.test(event.title)));
  assert.ok(toasts.every((event) => !/已清除|清除成功|成功/.test(event.title)));
});

test('canceling clear preserves data, while confirmed clear refreshes all pages and only removes this app key', () => {
  const runtime = createRuntime();
  runtime.disk.set('unrelated-app-data', { keep: true });
  runtime.storage.toggleFavorite('3-5');
  runtime.storage.markRead('3-5');
  const about = runtime.page('about');
  const home = runtime.page('home');
  const library = runtime.page('library');
  library.changeMode(tap({ mode: 'favorites' }));
  runtime.modal.confirm = false;
  about.clearData();
  assert.deepEqual(copy(runtime.storage.getFavorites()), ['3-5']);
  assert.equal(about.data.favoriteCount, 1);
  runtime.modal.confirm = true;
  about.clearData();
  assert.equal(about.data.favoriteCount, 0);
  assert.equal(about.data.readCount, 0);
  assert.deepEqual(runtime.disk.get('unrelated-app-data'), { keep: true });
  assert.equal(runtime.disk.has(runtime.storage.STORAGE_KEY), false);
  home.onShow();
  library.onShow();
  assert.equal(home.data.progress, null);
  assert.equal(home.data.readCount, 0);
  assert.deepEqual(library.data.entries, []);
  assert.equal(library.data.favoriteCount, 0);
  assert.equal(library.data.readCount, 0);
  assert.ok(runtime.events.some((event) => event.type === 'toast' && /已清除/.test(event.title)));
});
