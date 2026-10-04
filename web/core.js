(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EasyLifeWeb = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function text(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
    if (typeof value === 'object') return text(value.text || value.description || value.value || value.label || value.grade || '');
    return String(value).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  }
  function safeURL(value) {
    try {
      const url = new URL(String(value));
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function parseRoute(hash) {
    let value;
    try { value = decodeURIComponent(String(hash || '').replace(/^#\/?/, '')); }
    catch (_) { return { page: 'not-found' }; }
    if (!value || value === 'home') return { page: 'home' };
    if (['library', 'search', 'cards', 'favorites', 'about'].includes(value)) return { page: value };
    const chapter = value.match(/^chapter\/(\d{1,2})$/);
    if (chapter && Number(chapter[1]) > 0) return { page: 'chapter', id: Number(chapter[1]) };
    const entry = value.match(/^read\/(\d{1,2}-\d{1,3})$/);
    if (entry) return { page: 'read', id: entry[1] };
    return { page: 'not-found' };
  }
  function resolveModule(base, request) {
    const parts = (request.startsWith('.') ? base.split('/').slice(0, -1).join('/') + '/' + request : request).split('/');
    const result = [];
    for (const part of parts) {
      if (part === '..') result.pop();
      else if (part !== '.' && part) result.push(part);
    }
    return result.join('/').replace(/\.js$/, '') + '.js';
  }
  return { escapeHTML, text, safeURL, parseRoute, resolveModule };
});
