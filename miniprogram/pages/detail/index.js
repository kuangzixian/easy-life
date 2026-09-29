const content = require('../../utils/content');
const storage = require('../../utils/storage');
const { layout, presentEntry, back } = require('../shared');

Page({
  data: { ...layout(), entry: null, previous: null, next: null, favorite: false, notFound: false, sourceExpanded: false },
  onLoad(options) {
    const entry = content.getEntry(options && options.id);
    if (!entry) { this.setData({ notFound: true }); return; }
    const neighbors = content.getNeighbors(entry.id);
    this.setData({ entry: presentEntry(entry), previous: neighbors.previous, next: neighbors.next, favorite: storage.isFavorite(entry.id) });
    storage.markRead(entry.id);
  },
  onShow() { if (this.data.entry) this.setData({ favorite: storage.isFavorite(this.data.entry.id) }); },
  back,
  toggleFavorite() {
    if (!this.data.entry) return;
    const before = storage.isFavorite(this.data.entry.id);
    const favorite = storage.toggleFavorite(this.data.entry.id);
    this.setData({ favorite });
    if (favorite !== before) wx.showToast({ title: favorite ? '已加入收藏' : '已取消收藏', icon: 'none' });
  },
  navigateEntry(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.redirectTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}` });
  },
  openChapter() {
    if (!this.data.entry) return;
    getApp().globalData.libraryChapterId = this.data.entry.chapterId;
    wx.switchTab({ url: '/pages/library/index' });
  },
  toggleSources() { this.setData({ sourceExpanded: !this.data.sourceExpanded }); },
  copyLink(event) {
    const url = event.currentTarget.dataset.url;
    if (!/^https?:\/\//.test(url || '')) return;
    wx.setClipboardData({ data: url, fail() { wx.showToast({ title: '复制失败，请长按来源文本复制', icon: 'none' }); } });
  },
  openAbout() { wx.navigateTo({ url: '/pages/about/index' }); },
  onShareAppMessage() {
    const entry = this.data.entry;
    return entry ? { title: `好好生活 · ${entry.title}`, path: `/pages/detail/index?id=${encodeURIComponent(entry.id)}` } : { title: '好好生活 · 每天一个小改变', path: '/pages/home/index' };
  }
});
