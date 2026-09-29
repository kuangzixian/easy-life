const KEY = 'easy-life:reading:v1';

function createStore(adapter) {
  const validId = (id) => typeof id === 'string' && /^\d{1,2}-\d{1,3}$/.test(id);
  function uniqueIds(value) {
    return Array.isArray(value) ? Array.from(new Set(value.filter(validId))).slice(0, 2000) : [];
  }
  function read() {
    let value;
    try { value = adapter.get(KEY); } catch (_) { value = null; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    return {
      favorites: uniqueIds(value.favorites),
      readIds: uniqueIds(value.readIds),
      lastId: validId(value.lastId) ? value.lastId : null
    };
  }
  function write(value) {
    try { adapter.set(KEY, value); return true; }
    catch (_) { if (adapter.onError) adapter.onError(); return false; }
  }
  return {
    getFavorites() { return read().favorites; },
    isFavorite(id) { return read().favorites.includes(id); },
    toggleFavorite(id) {
      const state = read();
      const before = state.favorites.includes(id);
      if (!validId(id)) return false;
      state.favorites = before ? state.favorites.filter((item) => item !== id) : state.favorites.concat(id);
      return write(state) ? !before : before;
    },
    getProgress() { const state = read(); return { lastId: state.lastId, readIds: state.readIds }; },
    markRead(id) {
      if (!validId(id)) return false;
      const state = read();
      state.lastId = id;
      if (!state.readIds.includes(id)) state.readIds.push(id);
      return write(state);
    },
    clearAll() {
      try { adapter.remove(KEY); return true; }
      catch (_) { if (adapter.onError) adapter.onError(); return false; }
    }
  };
}

const store = createStore({
  get: (key) => wx.getStorageSync(key),
  set: (key, value) => wx.setStorageSync(key, value),
  remove: (key) => wx.removeStorageSync(key),
  onError: () => wx.showToast({ title: '保存失败，请检查设备存储空间', icon: 'none' })
});
module.exports = Object.assign({ createStore, STORAGE_KEY: KEY }, store);
