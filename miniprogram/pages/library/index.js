const content = require('../../utils/content');
const storage = require('../../utils/storage');
const { layout, presentListEntry, openEntry, text } = require('../shared');

Page({
  data: { ...layout(), mode: 'chapters', chapters: [], visibleChapters: [], entries: [], selectedChapter: null, filter: '', favoriteCount: 0, readCount: 0, totalCount: 0 },
  onLoad() {
    const chapters = content.getChapters().map((chapter, index) => Object.assign({}, chapter, { displayNumber: String(index + 1).padStart(2, '0'), descriptionText: text(chapter.description) }));
    this.setData({ chapters, visibleChapters: chapters, totalCount: content.getEntries().length });
  },
  onShow() {
    const id = getApp().globalData.libraryChapterId;
    if (id) {
      getApp().globalData.libraryChapterId = null;
      if (id === 'all') { this.setData({ mode: 'chapters' }); this.showChapters(); }
      else this.selectChapter(id);
    } else if (this.data.mode === 'favorites') this.loadFavorites();
    else if (this.data.selectedChapter) this.selectChapter(this.data.selectedChapter.id);
    this.setData({ favoriteCount: storage.getFavorites().length, readCount: storage.getProgress().readIds.length });
  },
  changeMode(event) {
    const mode = event.currentTarget.dataset.mode;
    this.setData({ mode, filter: '', selectedChapter: null, visibleChapters: this.data.chapters });
    if (mode === 'favorites') this.loadFavorites();
  },
  loadFavorites() {
    const favorites = storage.getFavorites();
    const readIds = storage.getProgress().readIds;
    this.setData({ entries: content.getEntries().filter(entry => favorites.includes(entry.id)).map(entry => ({ ...presentListEntry(entry, favorites), read: readIds.includes(entry.id) })), favoriteCount: favorites.length });
  },
  filterChapters(event) {
    const filter = event.detail.value.trim();
    this.setData({ filter, visibleChapters: this.data.chapters.filter(chapter => `${chapter.title} ${chapter.descriptionText}`.includes(filter)) });
  },
  chooseChapter(event) { this.selectChapter(event.currentTarget.dataset.id); },
  selectChapter(id) {
    const selectedChapter = this.data.chapters.find(chapter => String(chapter.id) === String(id));
    if (!selectedChapter) return;
    const readIds = storage.getProgress().readIds;
    const favorites = storage.getFavorites();
    this.setData({ mode: 'chapters', selectedChapter, entries: content.getEntries(selectedChapter.id).map(entry => ({ ...presentListEntry(entry, favorites), read: readIds.includes(entry.id) })) });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  showChapters() { this.setData({ selectedChapter: null, filter: '', visibleChapters: this.data.chapters }); },
  openEntry(event) { openEntry(event.currentTarget.dataset.id); },
  onShareAppMessage() { return { title: '匡子闲学 · 按章节读一份生活指南', path: '/pages/library/index' }; }
});
