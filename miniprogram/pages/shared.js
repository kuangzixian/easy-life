const { getFavorites } = require('../utils/storage');

function text(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  if (typeof value === 'object') return text(value.text || value.description || value.value || value.label || value.grade || '');
  return String(value).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
}

function presentEntry(entry) {
  if (!entry) return null;
  const summaryText = text(entry.summary);
  return Object.assign({}, entry, {
    summaryText,
    coverSummary: summaryText.length > 140 ? `${summaryText.slice(0, 138)}…` : summaryText,
    costText: text(entry.cost),
    benefitText: text(entry.benefit),
    notesText: text(entry.notes),
    sourceBody: text(entry.sourceText),
    evidenceText: text(entry.evidence),
    favorite: getFavorites().includes(entry.id),
    chapterLabel: entry.chapterTitle || '生活建议',
    codeLabel: String(entry.id || entry.number || '').replace(/-/g, '.'),
    tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 3) : [],
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    editorialNote: text(entry.editorialNote),
    editorialSources: Array.isArray(entry.editorialSources) ? entry.editorialSources : []
  });
}

function presentListEntry(entry, favorites) {
  const summary = text(entry.summary);
  return {
    id: entry.id,
    title: entry.title,
    summaryText: summary.length > 140 ? `${summary.slice(0, 138)}…` : summary,
    chapterLabel: entry.chapterTitle || '生活建议',
    codeLabel: String(entry.id || entry.number || '').replace(/-/g, '.'),
    evidenceText: text(entry.evidence),
    favorite: (favorites || getFavorites()).includes(entry.id)
  };
}

function layout() {
  const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const capsule = wx.getMenuButtonBoundingClientRect();
  const statusBarHeight = info.statusBarHeight || 20;
  return { statusBarHeight, navHeight: Math.max(44, capsule.bottom + 8 - statusBarHeight) };
}

function openEntry(id) {
  if (id) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}` });
}

function back() {
  if (getCurrentPages().length > 1) wx.navigateBack();
  else wx.switchTab({ url: '/pages/home/index' });
}

module.exports = { text, presentEntry, presentListEntry, layout, openEntry, back };
