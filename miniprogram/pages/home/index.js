const content = require('../../utils/content');
const storage = require('../../utils/storage');
const { layout, presentEntry, openEntry } = require('../shared');

Page({
  data: { ...layout(), daily: null, chapters: [], progress: null, dateLabel: '', dayLabel: '', meta: {} },
  onLoad() {
    const now = new Date();
    this.setData({ dateLabel: `${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`, dayLabel: `星期${'日一二三四五六'[now.getDay()]}`, chapters: content.getChapters().filter(chapter => [3, 4, 5, 14, 22, 23].includes(chapter.id)), meta: content.getMeta() });
  },
  onShow() {
    const now = new Date();
    const progress = storage.getProgress();
    this.setData({ dateLabel: `${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`, dayLabel: `星期${'日一二三四五六'[now.getDay()]}`, daily: presentEntry(content.getDailyEntry()), progress: progress.lastId ? presentEntry(content.getEntry(progress.lastId)) : null, readCount: progress.readIds.length });
  },
  openDaily() { openEntry(this.data.daily && this.data.daily.id); },
  read() {
    const entry = this.data.progress || content.getEntries()[0];
    if (entry) openEntry(entry.id);
  },
  openChapter(event) { getApp().globalData.libraryChapterId = event.currentTarget.dataset.id; wx.switchTab({ url: '/pages/library/index' }); },
  openLibrary() { getApp().globalData.libraryChapterId = 'all'; wx.switchTab({ url: '/pages/library/index' }); },
  openSearch() { wx.switchTab({ url: '/pages/search/index' }); },
  openAbout() { wx.navigateTo({ url: '/pages/about/index' }); },
  onShareAppMessage() { return { title: '好好生活 · 每天一个小改变', path: '/pages/home/index' }; }
});
