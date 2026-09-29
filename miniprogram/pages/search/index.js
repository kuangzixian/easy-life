const content = require('../../utils/content');
const { layout, presentEntry, openEntry } = require('../shared');

Page({
  data: { ...layout(), query: '', searchedQuery: '', hasSearched: false, results: [], searching: false, questions: ['如何改善睡眠？', '怎样养成运动习惯？', '如何减轻压力？', '怎么更好地学习？'], chips: ['睡眠', '运动', '饮食', '社交', '专注', '情绪'] },
  onInput(event) { this.setData({ query: event.detail.value }); },
  submit() { this.runSearch(this.data.query); },
  chooseQuestion(event) { const query = event.currentTarget.dataset.query; this.setData({ query }); this.runSearch(query); },
  clear() { this.setData({ query: '', searchedQuery: '', hasSearched: false, results: [] }); },
  runSearch(input) {
    const query = String(input || '').trim();
    if (!query) { this.clear(); return; }
    wx.hideKeyboard();
    this.setData({ searching: true, hasSearched: true, searchedQuery: query });
    try {
      const results = content.search(query).map(result => ({ ...presentEntry(result.entry), matchedTerms: (result.matchedTerms || []).slice(0, 4) }));
      this.setData({ results, searching: false });
    } catch (error) {
      this.setData({ results: [], searching: false });
      wx.showToast({ title: '检索暂时遇到问题，请再试一次', icon: 'none' });
    }
  },
  openEntry(event) { openEntry(event.currentTarget.dataset.id); },
  openLibrary() { getApp().globalData.libraryChapterId = 'all'; wx.switchTab({ url: '/pages/library/index' }); },
  onShareAppMessage() { return { title: '好好生活 · 让生活问题有出处可循', path: '/pages/search/index' }; }
});
