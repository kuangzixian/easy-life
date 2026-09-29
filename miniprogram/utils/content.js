const book = require('../data/book');
const byId = new Map(book.entries.map((entry) => [entry.id, entry]));
const positions = new Map(book.entries.map((entry, index) => [entry.id, index]));

// 随机推荐有意只选日常行动；专业/紧急主题留给用户主动查阅。
const CARD_IDS = [
  '3-1', '3-5', '3-6', '3-7', '3-8', '3-10', '3-12', '3-16', '3-17', '3-21',
  '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7', '4-8', '4-9', '4-10', '4-12', '4-15', '4-16', '4-17',
  '14-1', '14-2', '14-6', '22-1', '22-2', '22-10', '22-11',
  '23-8', '23-10', '23-12', '23-14', '23-15', '23-16', '23-17', '23-18', '23-19'
];
const cardPool = CARD_IDS.map((id) => byId.get(id)).filter(Boolean);
const SYNONYMS = [
  ['睡不着', '失眠', '睡不好', '睡眠', '熬夜'],
  ['被裁', '裁员', '辞退', '离职', '失业', '失业金', '失业保险', '经济补偿'],
  ['欠薪', '工资没发', '拖欠工资', '劳动仲裁'],
  ['拖延', '不想做', '没动力', '子任务', '截止'],
  ['总被打断', '注意力', '专注', '通知', '打断'],
  ['租房', '租房押金', '房东', '押金', '租赁'],
  ['学不进去', '记不住', '学习方法', '自测', '分散练习', '学法'],
  ['二次验证', '两步验证', '2fa', '账号安全'],
  ['压力', '焦虑', '减压', '放松'],
  ['医保', '报销', '就医', '医疗保险'],
  ['担保', '替朋友担保', '连带责任', '保证人'],
  ['省钱', '乱花钱', '订阅', '预付款', '预算'],
  ['手机丢了', '手机被偷', '远程锁定', '挂失'],
  ['养老', '老人', '监护', '遗嘱'],
  ['被骗', '诈骗', '反诈', '止付']
];
const STOP_WORDS = new Set(['怎么', '如何', '什么', '时候', '哪些', '怎样', '可以', '应该', '能够', '能不', '不能', '不要', '一下', '有没有', '为什么', '怎么办', '好的', '我的', '一个', '这个', '那个', '现在', '总是', '的时', '问题', '建议', '事情', '需要', '想要', '是否', '还是', '有什', '么办', '该怎', '候怎']);
const normalize = (value) => String(value || '').toLowerCase().replace(/[\s\u200b]+/g, '').slice(0, 200);
const documents = book.entries.map((entry) => ({
  entry,
  title: entry.title.toLowerCase(),
  summary: entry.summary.toLowerCase(),
  text: [entry.cost, entry.benefit, entry.notes].join(' ').toLowerCase()
}));
const frequencies = new Map();

function queryTerms(raw) {
  const query = normalize(raw);
  if (!query) return [];
  const terms = new Map();
  function add(term, boost) {
    if (term.length < 2 || STOP_WORDS.has(term) || (term.length === 2 && /[的了着吗呢啊]/.test(term))) return;
    terms.set(term, Math.max(terms.get(term) || 0, boost));
  }
  const matchedGroups = SYNONYMS.filter((group) => group.some((term) => query.includes(term)));
  // 完整意图命中时，不再用“不进”“进去”这类跨词双字淹没真正的学习/欠薪意图。
  let remaining = query;
  matchedGroups.forEach((group) => group.filter((term) => query.includes(term)).sort((a, b) => b.length - a.length).forEach((term) => { remaining = remaining.split(term).join(' '); }));
  remaining = remaining.replace(/怎么办|有没有|有什么|如何|怎么|怎样|哪些|什么|建议|应该/g, ' ');
  const chunks = remaining.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];
  chunks.forEach((chunk) => {
    if (chunk.length <= 12) add(chunk, 2);
    if (/^[a-z0-9]+$/.test(chunk)) return;
    for (let i = 0; i < chunk.length - 1; i += 1) add(chunk.slice(i, i + 2), 1);
  });
  matchedGroups.forEach((group) => {
    group.forEach((term) => add(term, query.includes(term) ? 2.5 : 1.2));
  });
  return Array.from(terms, ([term, boost]) => {
    if (!frequencies.has(term)) frequencies.set(term, documents.filter((doc) => (doc.title + doc.summary + doc.text).includes(term)).length);
    const df = frequencies.get(term);
    return { term, boost, idf: Math.log(1 + documents.length / (df + 1)) };
  }).filter((item) => frequencies.get(item.term) > 0 && frequencies.get(item.term) < documents.length * 0.45);
}

function search(raw, options) {
  const query = normalize(raw);
  if (query.length < 2) return [];
  const terms = queryTerms(raw);
  if (!terms.length) return [];
  const limit = Math.max(1, Math.min(Number(options && options.limit) || 30, 100));
  return documents.map((doc) => {
    let score = 0;
    let directMatch = false;
    const matchedTerms = [];
    terms.forEach(({ term, boost, idf }) => {
      const title = doc.title.includes(term);
      const summary = doc.summary.includes(term);
      const body = doc.text.includes(term);
      if (!title && !summary && !body) return;
      if (boost >= 1 && (title || summary || term.length >= 3)) directMatch = true;
      score += (title ? 5 : summary ? 2.5 : 0.7) * boost * idf;
      matchedTerms.push(term);
    });
    if (doc.title.includes(query)) score += 30;
    return { entry: doc.entry, score, matchedTerms, directMatch };
  }).filter((item) => item.directMatch && item.score >= 6)
    .sort((a, b) => b.score - a.score || positions.get(a.entry.id) - positions.get(b.entry.id))
    .slice(0, limit)
    .map(({ entry, score, matchedTerms }) => ({ entry, score: Math.round(score * 100) / 100, matchedTerms }));
}

function randomEntries(options) {
  const opts = options || {};
  const count = Math.max(0, Math.min(50, Number.isFinite(opts.count) ? Math.floor(opts.count) : 5));
  const pool = cardPool.filter((entry) => !opts.chapterId || entry.chapterId === Number(opts.chapterId));
  const excluded = new Set(opts.excludeIds || []);
  const fresh = pool.filter((entry) => !excluded.has(entry.id));
  const old = pool.filter((entry) => excluded.has(entry.id));
  const shuffle = (items) => {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return shuffle(fresh).concat(shuffle(old)).slice(0, count);
}

function getDailyEntry(date) {
  const value = date instanceof Date ? date : new Date();
  const key = typeof date === 'string' ? date : `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return cardPool[(hash >>> 0) % cardPool.length];
}

module.exports = {
  getMeta: () => Object.assign({}, book.meta, { totalEntries: book.entries.length, totalChapters: book.chapters.length }),
  getChapters: () => book.chapters.slice(),
  getCardChapters: () => book.chapters.filter((chapter) => cardPool.some((entry) => entry.chapterId === chapter.id)),
  getEntries: (chapterId) => chapterId ? book.entries.filter((entry) => entry.chapterId === Number(chapterId)) : book.entries.slice(),
  getEntry: (id) => byId.get(id) || null,
  getNeighbors(id) {
    const index = positions.get(id);
    return index === undefined ? { previous: null, next: null } : { previous: book.entries[index - 1] || null, next: book.entries[index + 1] || null };
  },
  search, randomEntries, getDailyEntry, CARD_IDS
};
