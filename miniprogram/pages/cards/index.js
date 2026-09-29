const content = require('../../utils/content');
const storage = require('../../utils/storage');
const { layout, presentEntry, openEntry } = require('../shared');

Page({
  data: { ...layout(), chapters: [], chapterId: 0, cards: [], current: 0, favorite: false },
  onLoad() {
    this.setData({ chapters: content.getCardChapters() });
    this.draw();
  },
  onShow() { this.refreshFavorite(); },
  draw() {
    const cards = content.randomEntries({ count: 5, chapterId: this.data.chapterId || undefined, excludeIds: this.data.cards.map(entry => entry.id) }).map(presentEntry);
    this.setData({ cards, current: 0, favorite: !!(cards[0] && storage.isFavorite(cards[0].id)) });
  },
  selectChapter(event) {
    const chapterId = Number(event.currentTarget.dataset.id) || 0;
    if (chapterId === this.data.chapterId) return;
    this.setData({ chapterId, cards: [], current: 0 });
    this.draw();
  },
  onCardChange(event) {
    this.setData({ current: event.detail.current });
    this.refreshFavorite();
  },
  previousCard() {
    if (this.data.current <= 0) return;
    this.setData({ current: this.data.current - 1 });
    this.refreshFavorite();
  },
  nextCard() {
    if (this.data.current >= this.data.cards.length - 1) return;
    this.setData({ current: this.data.current + 1 });
    this.refreshFavorite();
  },
  refreshFavorite() {
    const current = this.data.cards[this.data.current];
    this.setData({ favorite: !!(current && storage.isFavorite(current.id)) });
  },
  toggleFavorite() {
    const current = this.data.cards[this.data.current];
    if (!current) return;
    const before = storage.isFavorite(current.id);
    const favorite = storage.toggleFavorite(current.id);
    this.setData({ favorite });
    if (favorite !== before) wx.showToast({ title: favorite ? '已加入收藏' : '已取消收藏', icon: 'none' });
  },
  openCurrent() { const current = this.data.cards[this.data.current]; if (current) openEntry(current.id); },
  onShareAppMessage() {
    const entry = this.data.cards[this.data.current];
    return entry ? { title: `好好生活 · ${entry.title}`, path: `/pages/detail/index?id=${encodeURIComponent(entry.id)}` } : { title: '好好生活 · 抽几张生活灵感', path: '/pages/cards/index' };
  }
});
