const content = require('../../utils/content');
const storage = require('../../utils/storage');
const release = require('../../config/release');
const { layout, back } = require('../shared');

Page({
  data: { ...layout(), release, meta: {}, sourceDate: '', shortCommit: '', favoriteCount: 0, readCount: 0 },
  onLoad() {
    const meta = content.getMeta();
    this.setData({ meta, sourceDate: String(meta.updatedAt || '').slice(0, 10), shortCommit: String(meta.commit || '').slice(0, 7) });
    this.refreshCounts();
  },
  onShow() { this.refreshCounts(); },
  back,
  refreshCounts() { this.setData({ favoriteCount: storage.getFavorites().length, readCount: storage.getProgress().readIds.length }); },
  copyLink(event) {
    const url = event.currentTarget.dataset.url;
    if (!/^https?:\/\//.test(url || '')) return;
    wx.setClipboardData({ data: url });
  },
  copyContact() { if (release.contact) wx.setClipboardData({ data: release.contact }); },
  clearData() {
    wx.showModal({
      title: '清除本机阅读数据？',
      content: '将清除所有收藏和阅读进度，清除后无法恢复。',
      confirmText: '确认清除',
      confirmColor: '#183F35',
      success: result => {
        if (!result.confirm) return;
        if (storage.clearAll()) {
          this.refreshCounts();
          wx.showToast({ title: '本机阅读数据已清除', icon: 'none' });
        }
      }
    });
  }
});
