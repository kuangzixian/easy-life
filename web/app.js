/* Browser UI. Content and search are shared with the native mini program. */
(() => {
  'use strict';
  const { escapeHTML: e, text, safeURL, parseRoute, resolveModule } = window.EasyLifeWeb;
  const cache = Object.create(null);
  function requireModule(id) {
    if (cache[id]) return cache[id].exports;
    const factory = window.EasyLifeModules[id];
    if (!factory) throw new Error('Missing content module: ' + id);
    const module = { exports: {} };
    cache[id] = module;
    factory(request => requireModule(resolveModule(id, request)), module, module.exports);
    return module.exports;
  }
  const content = requireModule('miniprogram/utils/content.js');
  const { createStore } = requireModule('miniprogram/utils/storage.js');
  const release = requireModule('miniprogram/config/release.js');
  const meta = content.getMeta();
  const chapters = content.getChapters();
  const main = document.querySelector('#main');
  const store = createStore({
    get: key => JSON.parse(localStorage.getItem(key)),
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    remove: key => localStorage.removeItem(key),
    onError: () => toast('浏览器未能保存，请检查存储空间或隐私模式')
  });
  let route = parseRoute(location.hash);
  let searchQuery = '', searchedQuery = '', searchResults = [], hasSearched = false;
  let cardChapter = 0, cards = [], cardIndex = 0, chapterFilter = '', toastTimer;
  let activeHash = location.hash || '#home';
  const scrollPositions = new Map();
  const icons = {
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    library: '<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    cards: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="m3 16-1-12 13-2M9 10h6m-6 4h4"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    share: '<path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
    leaf: '<path d="M20 3C7 2 2 8 6 16s15 4 14-13Z"/><path d="M4 21 15 10"/>'
  };
  function icon(name, extra = '') { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${icons[name] || icons.arrow}</svg>`; }
  function toast(message) {
    const element = document.querySelector('#toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 2600);
  }
  function external(url, label, className = '') {
    const safe = safeURL(url);
    return safe ? `<a href="${e(safe)}" target="_blank" rel="noopener noreferrer" class="${e(className)}">${label}</a>` : `<span class="${e(className)}">${label}</span>`;
  }
  function heading(eyebrow, title, description) {
    return `<div class="page-heading"><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1>${description ? `<p class="page-description">${e(description)}</p>` : ''}</div>`;
  }
  function entryLink(id) { return '#read/' + encodeURIComponent(id); }
  function empty(title, description, action = '去目录看看', href = '#library') {
    return `<div class="empty-state"><div class="empty-icon">${icon('leaf')}</div><h2>${e(title)}</h2><p>${e(description)}</p><a class="button secondary" href="${e(href)}">${e(action)} ${icon('arrow')}</a></div>`;
  }
  function favoriteButton(entry, className = 'button secondary') {
    const saved = store.isFavorite(entry.id);
    return `<button type="button" class="${e(className)} favorite-toggle ${saved ? 'saved' : ''}" data-action="favorite" data-id="${e(entry.id)}" aria-pressed="${saved}">${icon('star')}<span>${saved ? '已收藏' : '收藏这条'}</span></button>`;
  }
  function entryRows(entries, { results = false } = {}) {
    const read = new Set(store.getProgress().readIds), favorites = new Set(store.getFavorites());
    return `<div class="entry-list">${entries.map(item => {
      const entry = results ? item.entry : item;
      return `<a class="entry-row" href="${entryLink(entry.id)}"><span class="entry-number">${e(entry.id.replace('-', '.'))}</span><div class="entry-copy"><h2>${e(entry.title)}</h2><p>${e(text(entry.summary))}</p><div class="entry-meta"><span>${e(entry.chapterTitle)}</span>${results ? `<span>匹配：${e(item.matchedTerms.slice(0, 3).join(' · '))}</span>` : ''}${read.has(entry.id) ? '<span class="read-badge">已读</span>' : ''}${favorites.has(entry.id) ? '<span class="favorite-badge">★ 已收藏</span>' : ''}</div></div><span class="row-chevron">${icon('arrow')}</span></a>`;
    }).join('')}</div>`;
  }
  function renderNavigation() {
    const current = ['chapter', 'read', 'favorites'].includes(route.page) ? 'library' : route.page;
    const items = [['home', '今天'], ['library', '慢慢读'], ['search', '问一问'], ['cards', '抽张卡']];
    const links = items.map(([page, label]) => `<a href="#${page}" class="nav-link" ${current === page ? 'aria-current="page"' : ''}>${icon(page)}<span>${label}</span></a>`).join('');
    document.querySelector('.desktop-nav').innerHTML = links;
    document.querySelector('.mobile-nav').innerHTML = links;
  }
  function homePage() {
    const daily = content.getDailyEntry(), progress = store.getProgress();
    const last = content.getEntry(progress.lastId), first = content.getEntries()[0];
    const now = new Date();
    const date = `${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`;
    const themeDescriptions = { 3: '给注意力留一点空间', 4: '把时间还给重要的事', 5: '让每一笔花费更清楚', 14: '给账号与信息多一层保护', 22: '留一点时间，好好放松', 23: '找到值得学习的新技能' };
    return `<section class="home-grid">
      <div class="welcome-panel"><p class="eyebrow">A LITTLE BETTER, EVERY DAY</p><h1>让生活，<br>轻一点。</h1><p class="hero-copy">不急着成为更好的人。<br>先从一个有出处的小改变开始。</p><div class="hero-actions"><a class="button primary" href="${entryLink(last ? last.id : first.id)}">${last ? '继续上次阅读' : '从头慢慢读'} ${icon('arrow')}</a><a class="button secondary" href="#cards">抽张灵感卡 ${icon('cards')}</a></div><p class="hero-bottom">不用登录 · 免费阅读 · 收藏留在你的浏览器</p></div>
      <section class="daily-panel"><div class="panel-top"><span class="eyebrow">今天的一点灵感</span><span class="daily-date">${date}</span></div><div class="daily-decoration" aria-hidden="true">${icon('leaf')}</div><p class="daily-topic">${e(daily.chapterTitle)}</p><h2>${e(daily.title)}</h2><p class="daily-summary">${e(text(daily.summary))}</p><div class="daily-bottom"><span>每日一条，有据可循</span><a class="text-link" href="${entryLink(daily.id)}">读完整建议 ${icon('arrow')}</a></div></section>
    </section>
    <div class="stats-row"><div class="stat"><strong>${meta.totalChapters}</strong><span>个生活章节</span></div><div class="stat"><strong>${meta.totalEntries}</strong><span>条带出处的建议</span></div><div class="stat"><strong>${progress.readIds.length}</strong><span>条已读，慢慢积累</span></div></div>
    ${last ? `<section class="continue-panel"><div class="continue-copy"><p class="eyebrow">上次读到这里</p><h3>${e(last.title)}</h3><p>${e(last.chapterTitle)} · ${progress.readIds.length} / ${meta.totalEntries} 条已读</p></div><a class="button secondary" href="${entryLink(last.id)}">接着读 ${icon('arrow')}</a></section>` : ''}
    <div class="section-heading"><h2>从关心的事开始</h2><a class="text-link" href="#library">全部章节 ${icon('arrow')}</a></div>
    <div class="topic-grid">${chapters.filter(chapter => [3, 4, 5, 14, 22, 23].includes(chapter.id)).map((chapter, index) => `<a href="#chapter/${chapter.id}" class="topic-card"><span class="topic-number">0${index + 1}</span><h3>${e(chapter.title)}</h3><p>${e(themeDescriptions[chapter.id])}</p><div class="topic-footer"><span>${chapter.count} 条建议</span>${icon('arrow')}</div></a>`).join('')}</div>
    <section class="search-invitation"><div><p class="eyebrow">有个具体的问题？</p><h2>带着困惑，搜一搜。</h2><p>试试“睡不着”“学不进去”或“工资没发”。</p></div><a class="button secondary" href="#search">${icon('search')} 问一问</a></section>
    <p class="source-note">内容改编自 ${external(meta.repository, `《${e(meta.title)}》`)}<br>${e(meta.author)} · ${external(meta.licenseUrl, e(meta.license))}<br><a href="#about">来源、修订与隐私说明 ↗</a></p>`;
  }
  function libraryPage() {
    const favorites = store.getFavorites(), progress = store.getProgress();
    return `${heading('THE READING ROOM', '慢慢读', '一份生活指南，不必一次读完。按章节找，也可以从第一页开始。')}
      <div class="segmented"><a href="#library" aria-current="page">全部章节</a><a href="#favorites">我的收藏 <span>${favorites.length}</span></a></div>
      <div class="progress-summary"><span>已读 ${progress.readIds.length} / ${meta.totalEntries} 条</span><progress max="${meta.totalEntries}" value="${progress.readIds.length}" aria-label="阅读进度"></progress><a class="text-link" href="${entryLink(progress.lastId || content.getEntries()[0].id)}">${progress.lastId ? '继续阅读' : '从头开始'} ${icon('arrow')}</a></div>
      <label class="chapter-filter"><span class="sr-only">筛选章节</span>${icon('search')}<input id="chapter-filter" type="search" placeholder="找一个生活主题" value="${e(chapterFilter)}" maxlength="100"></label>
      <div id="chapter-results">${chapterCards()}</div>`;
  }
  function chapterCards() {
    const found = chapters.filter(chapter => `${chapter.title} ${text(chapter.description)}`.includes(chapterFilter.trim()));
    return found.length ? `<div class="chapter-grid">${found.map(chapter => `<a class="chapter-card" href="#chapter/${chapter.id}"><span class="chapter-number">${String(chapter.id).padStart(2, '0')}</span><div class="chapter-body"><h2>${e(chapter.title)}</h2><p>${e(text(chapter.description))}</p><div class="chapter-meta"><span>${chapter.count} 条建议</span>${icon('arrow')}</div></div></a>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">${icon('leaf')}</div><h2>没有找到这个主题</h2><p>换个关键词试试，或清空输入查看全部章节。</p><button type="button" class="button secondary" data-action="clear-chapter-filter">查看全部章节 ${icon('arrow')}</button></div>`;
  }
  function chapterPage(id) {
    const chapter = chapters.find(item => item.id === id);
    if (!chapter) return notFoundPage();
    return `<a class="back-link" href="#library">${icon('back')} 返回章节目录</a>${heading(`CHAPTER ${String(id).padStart(2, '0')} / ${chapter.count} 条建议`, chapter.title, text(chapter.description))}${entryRows(content.getEntries(id))}`;
  }
  function favoritesPage() {
    const favorites = new Set(store.getFavorites());
    const entries = content.getEntries().filter(entry => favorites.has(entry.id));
    return `${heading('KEEP WHAT HELPS', '我的收藏', '把有用的留在这里，想起时再读一遍。')}
      <div class="segmented"><a href="#library">全部章节</a><a href="#favorites" aria-current="page">我的收藏 <span>${entries.length}</span></a></div>
      ${entries.length ? entryRows(entries) : empty('还没有收藏', '读到喜欢的建议，点一下星星，它就会留在这里。')}
      <p class="local-note">收藏保存在当前浏览器，不会跨设备同步；清理浏览器数据会删除收藏。</p>`;
  }
  function searchPage() {
    return `${heading('A QUESTION, A PLACE TO START', '问一问', '带着问题来，找几条可以追溯出处的建议。')}
      <form class="search-form" id="search-form" role="search"><label class="sr-only" for="search-input">输入生活问题或关键词</label><div class="search-field">${icon('search')}<input id="search-input" type="search" enterkeyhint="search" placeholder="最近有什么小困惑？" maxlength="200" value="${e(searchQuery)}" autocomplete="off"><button type="button" id="clear-search" class="icon-button" data-action="clear-search" aria-label="清空搜索" ${searchQuery ? '' : 'hidden'}>${icon('close')}</button></div><button class="search-submit icon-button" type="submit" aria-label="搜索">${icon('search')}</button></form>
      <p class="search-help">检索现有资料，不生成回答。搜索词只在浏览器内处理。</p>
      <div class="chip-list">${['睡眠', '运动', '饮食', '社交', '专注', '情绪'].map(query => `<button type="button" class="chip" data-action="search" data-query="${e(query)}">${e(query)}</button>`).join('')}</div>
      <div id="search-results" aria-live="polite">${searchResultsHTML()}</div>`;
  }
  function searchResultsHTML() {
    if (!hasSearched) return `<div class="section-heading"><h2>也可以这样问</h2></div><div class="question-list">${['如何改善睡眠？', '怎样养成运动习惯？', '如何减轻压力？', '怎么更好地学习？'].map(query => `<button type="button" class="question" data-action="search" data-query="${e(query)}"><span>${e(query)}</span>${icon('arrow')}</button>`).join('')}</div><div class="search-bottom-note">每条建议都保留原项目与资料来源，<br>你可以看完整内容，再判断是否适合自己。</div>`;
    if (!searchResults.length) return empty('暂时没有找到合适的建议', searchedQuery.length < 2 ? '至少输入两个字，例如“睡眠”或“学习”。' : '试试更具体的词，例如“睡眠”“学习方法”或“劳动仲裁”。也可以去目录看看。');
    return `<div class="search-results-heading"><h2>与“${e(searchedQuery)}”相关</h2><span>${searchResults.length} 条建议</span></div>${entryRows(searchResults, { results: true })}<p class="local-note">按关键词与同义表达匹配排序，结果不代表个性化判断。</p>`;
  }
  function runSearch(query) {
    searchQuery = String(query || '').trim().slice(0, 200);
    searchedQuery = searchQuery;
    hasSearched = !!searchQuery;
    searchResults = hasSearched ? content.search(searchQuery) : [];
    document.querySelector('#search-input').value = searchQuery;
    document.querySelector('#clear-search').hidden = !searchQuery;
    document.querySelector('#search-results').innerHTML = searchResultsHTML();
    document.querySelector('#search-input').blur();
  }
  function drawCards() {
    cards = content.randomEntries({ count: 5, chapterId: cardChapter || undefined, excludeIds: cards.map(entry => entry.id) });
    cardIndex = 0;
  }
  function cardsPage() {
    if (!cards.length) drawCards();
    return `<div class="cards-layout"><div class="cards-intro">${heading('A SMALL SPARK', '抽张卡', '没有特别的问题？让一条小建议，给今天一点灵感。')}
      <label class="topic-label" for="card-topic">今天想读</label><select id="card-topic" class="topic-select"><option value="0">随便逛逛</option>${content.getCardChapters().map(chapter => `<option value="${chapter.id}" ${chapter.id === cardChapter ? 'selected' : ''}>${e(chapter.title)}</option>`).join('')}</select></div><div class="deck-section" id="deck-section">${deckHTML()}</div></div>`;
  }
  function deckHTML() {
    const entry = cards[cardIndex];
    if (!entry) return empty('这个主题暂时没有卡片', '换个主题看看。', '去慢慢读');
    return `<div class="advice-card" id="advice-card" tabindex="0" aria-label="灵感卡 ${cardIndex + 1}，共 ${cards.length} 张"><div class="card-top"><span class="eyebrow">${e(entry.chapterTitle)}</span><span class="card-counter">${String(cardIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}</span></div><div class="card-motif" aria-hidden="true">✳</div><h2>${e(entry.title)}</h2><p class="card-summary">${e(text(entry.summary))}</p><div class="card-bottom"><span>一张卡，一个小改变</span><span>匡子闲学</span></div></div>
      <div class="deck-controls"><button type="button" class="icon-button" data-action="previous-card" aria-label="上一张卡" ${cardIndex === 0 ? 'disabled' : ''}>${icon('back')}</button><div class="deck-dots" role="group" aria-label="选择卡片">${cards.map((_, index) => `<button type="button" data-action="choose-card" data-index="${index}" aria-label="第 ${index + 1} 张卡" ${index === cardIndex ? 'aria-current="true"' : ''}></button>`).join('')}</div><button type="button" class="icon-button" data-action="next-card" aria-label="下一张卡" ${cardIndex === cards.length - 1 ? 'disabled' : ''}>${icon('arrow')}</button></div><div class="card-actions">${favoriteButton(entry)}<a class="button primary" href="${entryLink(entry.id)}">读完整建议 ${icon('arrow')}</a></div><p class="card-note">想了解成本、限定条件和研究出处，点开完整建议。</p><div class="deck-footer"><p class="deck-caption">左右滑动，或用箭头切换。<br>每组最多 5 张日常建议。</p><button type="button" class="button secondary" data-action="draw-cards">${icon('refresh')} 换一组灵感</button></div>`;
  }
  function changeCard(index) {
    const next = Math.max(0, Math.min(cards.length - 1, index));
    if (next === cardIndex) return;
    cardIndex = next;
    renderDeck();
  }
  function renderDeck() {
    const focused = document.activeElement;
    const focusedCard = focused && focused.id === 'advice-card';
    const focusedAction = focused && focused.dataset.action;
    const focusedIndex = focused && focused.dataset.index;
    document.querySelector('#deck-section').innerHTML = deckHTML();
    bindCardGestures();
    if (focusedCard) document.querySelector('#advice-card').focus({ preventScroll: true });
    else if (focusedAction) {
      const candidates = Array.from(document.querySelectorAll('#deck-section [data-action]'));
      const next = candidates.find(element => element.dataset.action === focusedAction && element.dataset.index === focusedIndex && !element.disabled);
      (next || document.querySelector('#advice-card')).focus({ preventScroll: true });
    }
  }
  function bindCardGestures() {
    const card = document.querySelector('#advice-card');
    if (!card) return;
    let start = null;
    card.addEventListener('pointerdown', event => { if (event.isPrimary) start = { x: event.clientX, y: event.clientY }; });
    card.addEventListener('pointerup', event => {
      if (!start) return;
      const x = event.clientX - start.x, y = event.clientY - start.y;
      start = null;
      if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.5) changeCard(cardIndex + (x < 0 ? 1 : -1));
    });
    // Browsers may cancel pointer events when recognizing a touch pan.
    let touchStart = null;
    card.addEventListener('touchstart', event => {
      if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    card.addEventListener('touchend', event => {
      if (!touchStart || !event.changedTouches.length) return;
      const x = event.changedTouches[0].clientX - touchStart.x, y = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      // Pointer-up handles normal taps/mouse; canceled touch pans reach this path.
      if (start && Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.5) { start = null; changeCard(cardIndex + (x < 0 ? 1 : -1)); }
    }, { passive: true });
    card.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeCard(cardIndex + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
  }
  function readingPage(id) {
    const entry = content.getEntry(id);
    if (!entry) return notFoundPage();
    const { previous, next } = content.getNeighbors(id);
    const sections = [['01', '需要付出什么', entry.cost], ['02', '可能带来的帮助', entry.benefit]];
    return `<article class="reading-article"><div class="article-top"><a class="back-link" href="#chapter/${entry.chapterId}">${icon('back')} ${e(entry.chapterTitle)}</a><button type="button" class="icon-button" data-action="share" data-id="${e(entry.id)}" aria-label="分享这条建议">${icon('share')}</button></div><p class="article-code">LIFE NOTE / ${e(entry.id.replace('-', '.'))}</p><h1>${e(entry.title)}</h1><div class="article-meta">${entry.evidence ? `<span class="rating">原文评级 ${e(text(entry.evidence))}</span>` : ''}<span>HowToLiveBetter · 阅读参考</span></div><p class="article-lead">${e(text(entry.summary))}</p>
      ${entry.editorialNote ? `<section class="editorial-panel"><h2>编辑修订</h2><p>${e(text(entry.editorialNote))}</p>${(entry.editorialSources || []).map(source => external(source.url, `${e(source.title)} ↗`)).join('')}</section>` : ''}
      ${sections.filter(([, , value]) => text(value)).map(([index, title, value]) => `<section class="article-section"><div class="section-label"><span>${index}</span><h2>${e(title)}</h2></div><p>${e(text(value))}</p></section>`).join('')}
      ${text(entry.notes) ? `<aside class="notes-panel"><h2>也请留意</h2><p>${e(text(entry.notes))}</p></aside>` : ''}
      <section class="sources-section"><div class="section-heading"><h2>研究与资料出处</h2><span class="eyebrow">SOURCES</span></div><p class="source-help">点开链接，查看原始资料。外部页面在新标签中打开。</p><div class="source-list">${(entry.sources || []).map((source, index) => external(source.url, `<span class="source-number">${String(index + 1).padStart(2, '0')}</span><span class="source-title">${e(source.title)}</span><span class="source-arrow">↗</span>`, 'source-row')).join('')}</div>${text(entry.sourceText) ? `<details class="source-details"><summary>查看完整来源文字</summary><p>${e(text(entry.sourceText))}</p></details>` : ''}${external(entry.sourceUrl, '<span>查看原项目中的这条建议<small>HowToLiveBetter · 固定版本原文</small></span><span>↗</span>', 'original-link')}</section>
      <p class="reading-notice">评级沿用原项目，未经本站独立认证。本文供阅读参考；涉及医疗、法律或财务决策时，请核对最新权威资料并咨询相应专业人士。</p><div class="article-actions">${favoriteButton(entry)}<button type="button" class="button secondary" data-action="share" data-id="${e(entry.id)}">${icon('share')} 分享给朋友</button></div><button type="button" class="copy-share-link text-link" data-action="copy-link" data-id="${e(entry.id)}">或直接复制文章链接 ↗</button>
      <nav class="article-pagination" aria-label="顺序阅读">${previous ? `<a href="${entryLink(previous.id)}"><span class="pagination-label">← 上一条</span><p>${e(previous.title)}</p></a>` : '<div class="pagination-disabled">已经是第一条</div>'}${next ? `<a href="${entryLink(next.id)}"><span class="pagination-label">下一条 →</span><p>${e(next.title)}</p></a>` : '<div class="pagination-disabled">你已读到最后一条</div>'}</nav><p class="source-note"><a href="#about">内容署名、许可与隐私说明 ↗</a></p></article>`;
  }
  function aboutPage() {
    const progress = store.getProgress();
    return `<div class="about-layout">${heading('ABOUT THIS LITTLE PLACE', '匡子闲学', '把有出处的生活建议装进口袋。')}
      <section class="about-panel"><h2>内容从哪里来</h2><p>原作品：《${e(meta.title)}》<br>作者：${e(meta.author)}</p><p>${external(meta.repository, 'HowToLiveBetter 原项目 ↗')}<br>${external(meta.licenseUrl, `${e(meta.license)} 许可 ↗`)}</p><p>这是独立改编的阅读工具。本站整理了字段、引文链接和排版，并新增检索、卡片与收藏；没有声称得到原作者背书。第 1 章第 5 条的蘑菇中毒处置备注有明确标注的安全修订，原始快照保留在项目仓库。</p><dl class="about-facts"><div><dt>内容快照</dt><dd>${e(String(meta.updatedAt).slice(0, 10))}</dd></div><div><dt>固定版本</dt><dd>${external(meta.repository + '/tree/' + meta.commit, e(meta.commit.slice(0, 7)))}</dd></div><div><dt>章节与建议</dt><dd>${meta.totalChapters} 章 / ${meta.totalEntries} 条</dd></div></dl><p>内容不自动追踪法规或医学更新。原文证据评级沿用作者口径，未经本站独立认证。遇到医疗、法律或财务决策，请核对最新权威资料并咨询专业人士。</p></section>
      <section class="about-panel"><h2>你的数据留在哪里</h2><p>不用登录。收藏和阅读进度保存在当前浏览器，不会发送到本站服务器，也不会跨设备同步。清理浏览器数据或更换域名后，原来的记录不会自动出现。</p><p>搜索在浏览器中完成，搜索词不写入网址，不上传或记录。本站没有广告、产品埋点或第三方统计脚本。托管服务仍会按其规则处理常规网页访问请求；点击资料来源会访问相应的外部网站。</p><div class="data-actions"><span>${store.getFavorites().length} 条收藏 · ${progress.readIds.length} 条已读</span><button type="button" class="button secondary" data-action="clear-data">清除本浏览器数据</button></div></section>
      <section class="about-panel"><h2>一起把它做得更好</h2><p>发现错字、过时信息或不好用的地方，欢迎在项目仓库提出。本站代码使用 MIT 许可，内容遵循原作品的 CC BY 4.0 许可。</p><p>${external('https://github.com/kuangzixian/easy-life', '查看本站代码 ↗')}<br>${external('https://github.com/kuangzixian/easy-life/issues', '反馈问题 ↗')}</p><p class="version-note">网页版 ${e(release.version)}${release.operator ? ` · ${e(release.operator)}` : ''}</p>${release.contact ? `<p>联系：${e(release.contact)}</p>` : ''}</section></div>`;
  }
  function notFoundPage() { return empty('这页没有找到', '链接可能不完整，回到目录继续读读吧。'); }
  function render({ restore = false, focus = false, recordReading = true } = {}) {
    route = parseRoute(location.hash);
    if (recordReading && route.page === 'read' && content.getEntry(route.id)) store.markRead(route.id);
    renderNavigation();
    const titles = { home: '每天一个小改变', library: '慢慢读', chapter: '慢慢读', favorites: '我的收藏', search: '问一问', cards: '抽张卡', about: '关于与来源', read: '慢慢读' };
    let page;
    switch (route.page) {
      case 'home': page = homePage(); break;
      case 'library': page = libraryPage(); break;
      case 'chapter': page = chapterPage(route.id); break;
      case 'favorites': page = favoritesPage(); break;
      case 'search': page = searchPage(); break;
      case 'cards': page = cardsPage(); break;
      case 'read': page = readingPage(route.id); break;
      case 'about': page = aboutPage(); break;
      default: page = notFoundPage();
    }
    main.innerHTML = page;
    document.title = `${route.page === 'read' && content.getEntry(route.id) ? content.getEntry(route.id).title : titles[route.page] || '页面未找到'} · 匡子闲学`;
    if (route.page === 'cards') bindCardGestures();
    window.scrollTo(0, restore ? scrollPositions.get(activeHash) || 0 : 0);
    if (focus) main.focus({ preventScroll: true });
  }
  function entryShareData(id) {
    const entry = content.getEntry(id);
    if (!entry) return;
    const url = new URL(location.href);
    url.hash = entryLink(id).slice(1);
    return { title: `${entry.title} · 匡子闲学`, text: '一条有出处的生活建议', url: url.href };
  }
  async function shareEntry(id) {
    const data = entryShareData(id);
    if (!data) return;
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try { await navigator.share(data); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    await copyEntryLink(id);
  }
  async function copyEntryLink(id) {
    const data = entryShareData(id);
    if (!data) return;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(data.url);
      toast('分享链接已复制');
    } catch (_) {
      const field = document.querySelector('#copy-link');
      field.value = data.url;
      document.querySelector('#copy-dialog').showModal();
      field.focus(); field.select();
    }
  }
  document.querySelector('#copy-dialog-close').addEventListener('click', () => document.querySelector('#copy-dialog').close());
  document.addEventListener('click', event => {
    if (event.target.closest('.skip-link')) { event.preventDefault(); main.focus(); return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'search') runSearch(target.dataset.query);
    if (action === 'clear-chapter-filter') {
      chapterFilter = '';
      document.querySelector('#chapter-filter').value = '';
      document.querySelector('#chapter-results').innerHTML = chapterCards();
      document.querySelector('#chapter-filter').focus();
    }
    if (action === 'clear-search') {
      searchQuery = ''; searchedQuery = ''; searchResults = []; hasSearched = false;
      document.querySelector('#search-input').value = '';
      document.querySelector('#clear-search').hidden = true;
      document.querySelector('#search-results').innerHTML = searchResultsHTML();
      document.querySelector('#search-input').focus();
    }
    if (action === 'favorite') {
      const before = store.isFavorite(target.dataset.id), saved = store.toggleFavorite(target.dataset.id);
      if (saved === before) return;
      target.setAttribute('aria-pressed', String(saved));
      target.classList.toggle('saved', saved);
      target.innerHTML = icon('star') + `<span>${saved ? '已收藏' : '收藏这条'}</span>`;
      toast(saved ? '已加入收藏' : '已取消收藏');
    }
    if (action === 'previous-card') changeCard(cardIndex - 1);
    if (action === 'next-card') changeCard(cardIndex + 1);
    if (action === 'choose-card') changeCard(Number(target.dataset.index));
    if (action === 'draw-cards') { drawCards(); renderDeck(); }
    if (action === 'share') shareEntry(target.dataset.id);
    if (action === 'copy-link') copyEntryLink(target.dataset.id);
    if (action === 'clear-data' && window.confirm('清除当前浏览器里的所有收藏和阅读进度？清除后无法恢复。')) {
      if (store.clearAll()) { render(); toast('本浏览器的收藏和进度已清除'); }
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'search-input') {
      searchQuery = event.target.value;
      document.querySelector('#clear-search').hidden = !searchQuery;
    }
    if (event.target.id === 'chapter-filter') {
      chapterFilter = event.target.value;
      document.querySelector('#chapter-results').innerHTML = chapterCards();
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'search-form') return;
    event.preventDefault();
    runSearch(document.querySelector('#search-input').value);
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'card-topic') { cardChapter = Number(event.target.value) || 0; drawCards(); renderDeck(); }
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', () => {
    scrollPositions.set(activeHash, window.scrollY);
    activeHash = location.hash || '#home';
    render({ restore: true, focus: true });
  });
  window.addEventListener('storage', () => { scrollPositions.set(activeHash, window.scrollY); render({ restore: true, recordReading: false }); });
  render();
})();
