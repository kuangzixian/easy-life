/* Local-only rendering adapter. It exercises our actual WXML/WXSS/Page modules;
 * it does not emulate the WeChat engine, permissions, networking or sharing. */
(() => {
  const screen = document.querySelector('#screen');
  const viewport = document.querySelector('#viewport');
  const cache = {};
  let app, activePage, registeredPage, config, route, routeStack = [], template, loading = false, toastTimer, navigationId = 0;
  const pageAssets = {};
  const tabPages = {};
  function resolve(base, request) {
    const parts = (request.startsWith('.') ? base.split('/').slice(0, -1).join('/') + '/' + request : request).split('/');
    const result = [];
    parts.forEach((part) => { if (part === '..') result.pop(); else if (part !== '.') result.push(part); });
    return result.join('/').replace(/\.js$/, '') + '.js';
  }
  function requireModule(id) {
    if (cache[id]) return cache[id].exports;
    if (!window.nativeModules[id]) throw new Error('Module missing: ' + id);
    const module = { exports: {} }; cache[id] = module;
    window.nativeModules[id]((request) => requireModule(resolve(id, request)), module, module.exports);
    return module.exports;
  }
  function toast(title) {
    const box = document.querySelector('#toast'); box.textContent = title; box.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('visible'), 2200);
  }
  window.addEventListener('unhandledrejection', (event) => { console.error(event.reason); toast('预览错误：' + event.reason.message); });
  const getInfo = () => ({ statusBarHeight: window.innerWidth <= 740 ? 12 : 38, windowWidth: document.querySelector('#device').clientWidth, windowHeight: document.querySelector('#device').clientHeight, safeArea: { bottom: 790 }, screenHeight: 844 });
  window.wx = {
    getWindowInfo: getInfo, getSystemInfoSync: getInfo,
    getMenuButtonBoundingClientRect: () => ({ top: getInfo().statusBarHeight + 7, bottom: getInfo().statusBarHeight + 37, height: 30, width: 86 }),
    getStorageSync: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } },
    setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    removeStorageSync: (key) => localStorage.removeItem(key),
    navigateTo: ({ url }) => navigate(url),
    redirectTo: ({ url }) => navigate(url, 'replace'),
    switchTab: ({ url }) => navigate(url, 'tab'),
    navigateBack: () => { routeStack.pop(); navigate(routeStack.pop() || '/pages/home/index', 'back'); },
    setNavigationBarTitle: () => {}, showShareMenu: () => {}, hideShareMenu: () => {}, hideKeyboard: () => {},
    showToast: ({ title }) => toast(title),
    showModal: ({ title, content, showCancel, success }) => { const confirm = showCancel === false ? (window.alert(title + '\n\n' + content), true) : window.confirm(title + '\n\n' + content); if (success) success({ confirm, cancel: !confirm }); },
    setClipboardData: ({ data, success, fail }) => navigator.clipboard.writeText(data).then(() => { toast('已复制'); if (success) success({}); }).catch((error) => { toast('浏览器未允许复制'); if (fail) fail(error); }),
    pageScrollTo: ({ scrollTop }) => { viewport.scrollTop = scrollTop; },
    vibrateShort: () => {}, stopPullDownRefresh: () => {},
    nextTick: (fn) => queueMicrotask(fn)
  };
  window.App = (definition) => { app = definition; };
  window.Page = (definition) => { registeredPage = definition; };
  window.getApp = () => app;
  window.getCurrentPages = () => routeStack.map((item) => ({ route: item }));
  function evaluate(source, scope) {
    // Only developer-authored WXML expressions are evaluated; book strings remain text nodes.
    try { return Function('scope', 'with(scope){return (' + source + ')}')(scope); }
    catch (error) { console.error('WXML expression:', source, error); return ''; }
  }
  function interpolate(value, scope) {
    const full = value.match(/^{{([\s\S]*?)}}$/);
    if (full && !full[1].includes('}}')) return evaluate(full[1], scope);
    return value.replace(/{{([\s\S]*?)}}/g, (_, expression) => String(evaluate(expression, scope) ?? ''));
  }
  function css(value) { return value.replace(/([\d.]+)rpx/g, 'calc($1 * var(--rpx))').replace(/(^|[}\n])\s*page\s*\{/g, '$1#screen {'); }
  function children(parent, scope) {
    const fragment = document.createDocumentFragment();
    let conditional = false, matched = false;
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) { if (node.textContent.trim()) fragment.append(document.createTextNode(interpolate(node.textContent, scope))); continue; }
      if (node.nodeType !== 1) continue;
      if (node.hasAttribute('wx:if')) { conditional = true; matched = Boolean(interpolate(node.getAttribute('wx:if'), scope)); if (!matched) continue; }
      else if (node.hasAttribute('wx:elif')) { if (!conditional || matched) continue; matched = Boolean(interpolate(node.getAttribute('wx:elif'), scope)); if (!matched) continue; }
      else if (node.hasAttribute('wx:else')) { if (!conditional || matched) continue; matched = true; }
      else { conditional = false; matched = false; }
      fragment.append(renderNode(node, scope));
    }
    return fragment;
  }
  function renderNode(node, scope, iteration) {
    if (node.hasAttribute('wx:for') && !iteration) {
      const fragment = document.createDocumentFragment();
      const values = interpolate(node.getAttribute('wx:for'), scope) || [];
      Array.from(values).forEach((item, index) => fragment.append(renderNode(node, Object.assign({}, scope, { [node.getAttribute('wx:for-item') || 'item']: item, [node.getAttribute('wx:for-index') || 'index']: index }), true)));
      return fragment;
    }
    if (node.tagName === 'block') return children(node, scope);
    const element = document.createElement(node.tagName === 'image' ? 'img' : node.tagName);
    for (const attribute of node.attributes) {
      const name = attribute.name;
      if (name.startsWith('wx:')) continue;
      const value = interpolate(attribute.value, scope);
      if (/^(bind|catch):?/.test(name)) {
        const eventName = name.replace(/^(bind|catch):?/, '');
        const invoke = (event, detail) => {
          if (name.startsWith('catch')) event.stopPropagation();
          const handler = activePage[value];
          if (handler) handler.call(activePage, { type: eventName, detail: detail || { value: event.target.value }, currentTarget: { dataset: Object.assign({}, element.dataset) }, target: { dataset: Object.assign({}, event.target.dataset) } });
        };
        if (eventName === 'confirm') element.addEventListener('keydown', (event) => { if (event.key === 'Enter') invoke(event); });
        else if (eventName === 'change' && node.tagName === 'swiper') element.addEventListener('swipechange', (event) => invoke(event, event.detail));
        else element.addEventListener(eventName === 'tap' ? 'click' : eventName, invoke);
        continue;
      }
      if (name === 'style') element.setAttribute(name, css(String(value)));
      else if (name === 'disabled') element.disabled = Boolean(value);
      else if (name === 'value') element.value = value || '';
      else if (name === 'src') element.src = value.startsWith('/') ? '/miniprogram' + value : value;
      else if (value !== false && value != null) element.setAttribute(name, String(value));
    }
    element.append(children(node, scope));
    if (node.tagName === 'swiper') {
      const items = Array.from(element.querySelectorAll(':scope > swiper-item'));
      let current = Number(element.getAttribute('current')) || 0;
      items.forEach((item, index) => { item.style.display = index === current ? 'block' : 'none'; });
      let startX;
      element.addEventListener('pointerdown', (event) => { startX = event.clientX; });
      element.addEventListener('pointerup', (event) => {
        if (startX == null || Math.abs(event.clientX - startX) < 35) return;
        current = Math.max(0, Math.min(items.length - 1, current + (event.clientX < startX ? 1 : -1)));
        element.dispatchEvent(new CustomEvent('swipechange', { detail: { current } })); startX = null;
      });
    }
    if (element.getAttribute('open-type') === 'share') element.addEventListener('click', () => toast('微信分享请在真机体验版中验证'));
    return element;
  }
  function render() {
    if (loading || !template || !activePage) return;
    const inputIndex = Array.from(screen.querySelectorAll('input')).indexOf(document.activeElement);
    const start = inputIndex >= 0 ? document.activeElement.selectionStart : 0;
    const scrollPositions = Array.from(screen.querySelectorAll('scroll-view')).map((view) => [view.scrollLeft, view.scrollTop]);
    screen.replaceChildren(children(template.documentElement, activePage.data));
    Array.from(screen.querySelectorAll('scroll-view')).forEach((view, i) => { if (scrollPositions[i]) { view.scrollLeft = scrollPositions[i][0]; view.scrollTop = scrollPositions[i][1]; } });
    if (inputIndex >= 0) { const field = screen.querySelectorAll('input')[inputIndex]; if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(start, start); } }
  }
  async function navigate(url, mode) {
    const currentNavigation = ++navigationId;
    loading = true;
    const [pathname, query] = url.split('?');
    const targetRoute = pathname.replace(/^\//, '');
    const base = '/miniprogram/' + targetRoute;
    if (!pageAssets[targetRoute]) {
      const [wxml, wxss] = await Promise.all([fetch(base + '.wxml').then((res) => res.text()), fetch(base + '.wxss').then((res) => res.text())]);
      const xml = new DOMParser().parseFromString('<root xmlns:wx="urn:wechat">' + wxml.replace(/\b(wx:else|scroll-x|scroll-y|selectable|show-scrollbar|enhanced)(?=[\s/>])(?!\s*=)/g, '$1="true"').replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, '&amp;') + '</root>', 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error(xml.querySelector('parsererror').textContent);
      pageAssets[targetRoute] = { xml, wxss };
    }
    if (currentNavigation !== navigationId) return;
    if (activePage && activePage.onHide) activePage.onHide();
    if (activePage && !activePage.__isTab && activePage.onUnload) activePage.onUnload();
    route = targetRoute;
    if (mode === 'tab') routeStack = [];
    if (mode === 'replace') routeStack.pop();
    routeStack.push(url);
    template = pageAssets[route].xml;
    document.querySelector('#page-style').textContent = css(pageAssets[route].wxss);
    const isTab = config.tabBar.list.some((tab) => tab.pagePath === route);
    if (isTab && tabPages[route]) activePage = tabPages[route];
    else {
      delete cache['miniprogram/' + route + '.js'];
      requireModule('miniprogram/' + route + '.js');
      activePage = Object.assign({}, registeredPage, { __isTab: isTab, data: JSON.parse(JSON.stringify(registeredPage.data || {})), setData(patch, callback) { Object.assign(this.data, patch); if (this === activePage) render(); if (callback) callback(); } });
      if (isTab) tabPages[route] = activePage;
      if (activePage.onLoad) activePage.onLoad(Object.fromEntries(new URLSearchParams(query)));
    }
    if (activePage.onShow) activePage.onShow();
    loading = false; render(); viewport.scrollTop = 0;
    const tabBar = document.querySelector('#tabs');
    tabBar.style.display = isTab ? 'flex' : 'none'; viewport.style.paddingBottom = isTab ? '74px' : '0';
    tabBar.replaceChildren(...config.tabBar.list.map((tab) => {
      const button = document.createElement('button'); button.className = route === tab.pagePath ? 'active' : '';
      const icon = document.createElement('img'); icon.src = '/miniprogram/' + (route === tab.pagePath ? tab.selectedIconPath : tab.iconPath); icon.alt = '';
      button.append(icon, document.createTextNode(tab.text)); button.onclick = () => navigate('/' + tab.pagePath, 'tab'); return button;
    }));
  }
  new ResizeObserver(() => document.querySelector('#device').style.setProperty('--rpx', document.querySelector('#device').clientWidth / 750 + 'px')).observe(document.querySelector('#device'));
  Promise.all([fetch('/miniprogram/app.json').then((res) => res.json()), fetch('/miniprogram/app.wxss').then((res) => res.text())]).then(([appConfig, style]) => {
    config = appConfig; document.querySelector('#native-style').textContent = css(style); requireModule('miniprogram/app.js'); navigate('/pages/home/index', 'tab');
  }).catch((error) => { screen.textContent = '预览错误：' + error.message; console.error(error); });
})();
