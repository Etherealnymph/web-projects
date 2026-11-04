/** Synthetic-only integration harness. No auth, remote clients, or real records. */
import { renderHome, renderModule, renderSearch, renderFavorites, renderRanking } from '../src/views/home.js';
import { renderDetail } from '../src/views/detail.js';
import { renderEditor } from '../src/views/editor.js';
import { renderProfile } from '../src/views/profile.js';
import { renderMessages } from '../src/views/messages.js';
import { parseRoute } from '../src/core/route.js';
import { state } from '../src/core/store.js';
import { sortContents, esc } from '../src/core/util.js';
import { lightbox, labelFields, loadingState } from '../src/core/ui.js';

const user = { id: 'synthetic-user', username: 'synthetic', nickname: '示例作者', role: 'member', createdAt: '2026-01-01T00:00:00Z', level: 3, exp: 100, bio: '这是一份完全独立的合成测试资料。' };
const friend = { ...user, id: 'demo-friend', username: 'synthetic_friend', nickname: '示例朋友' };
const modules = [
  { id: 'diary', key: 'diary', icon: '❀', nameZh: '日记', nameEn: 'Diary', descZh: '把日常的片段认真收藏', descEn: 'Notes from everyday life' },
  { id: 'poem', key: 'poem', icon: '❖', nameZh: '诗歌', nameEn: 'Poetry', descZh: '在文字里留一片安静', descEn: 'A quiet space in words' },
  { id: 'qa', key: 'qa', kind: 'qa', icon: '？', nameZh: '问答', nameEn: 'Q&A', descZh: '提问、理解与交流', descEn: 'Questions and conversations' },
].map((module) => ({ ...module, access: { visible: true, read: true, write: true, upload: true }, counts: { contents: 10 } }));
const imageUrl = new URL('../assets/stickers/tea.svg', import.meta.url).href;
const longBody = `## 今天的记录\n\n这是用于界面验收的合成文章。我们想在忙碌的日常里，留下一点能重新读到的文字。\n\n![一杯茶](${imageUrl})\n\n## 从一个问题开始\n\n${'把想法分成几个清楚的段落，先说观察，再写感受。页面的字体、间距与目录应该帮助阅读。\n\n'.repeat(7)}\n## 做一个小实验\n\n- 写下最重要的一件事\n- 为读者留出思考的空白\n- 保存，然后再回来修改\n\n\`\`\`r\nmean(c(1, 2, 3, 4))\n\`\`\`\n\n## 下次继续\n\n${'这段文字只用于测试文章目录、阅读进度和专注模式，不包含真实的个人资料。\n\n'.repeat(9)}`;
let contents = Array.from({ length: 32 }, (_, index) => ({
  id: `demo-${index + 1}`, moduleId: modules[index % modules.length].id, module: modules[index % modules.length],
  title: index === 0 ? '留一盏灯，给日常的片段' : `合成记录 ${String(index + 1).padStart(2, '0')} · ${['一杯茶的时间', '沿着河岸散步', '关于今天的一个问题'][index % 3]}`,
  bodyMd: index === 0 ? longBody : `## 一个片段\n\n这里是一段用于测试分页、搜索和卡片排版的合成文字。第 ${index + 1} 条记录。\n\n## 继续记录\n\n把平常的一天写下来。`,
  authorId: user.id, author: user, status: 'published', visibility: 'private', visibleUserIds: [], tags: [index % 2 ? '随想' : '日常', '合成示例'],
  media: index === 0 ? [{ id: 'demo-media', kind: 'image', url: imageUrl, name: '合成图片' }] : [],
  createdAt: new Date(Date.UTC(2026, 10, 4, 8) - index * 86400000).toISOString(), updatedAt: null, views: 18 + index,
  counts: { like: index % 11, dislike: 0, favorite: index % 7, comment: index === 0 ? 2 : 0 },
  mine: { like: false, dislike: false, favorite: index % 4 === 0 }, access: { visible: true, upload: true },
}));
modules.forEach((module) => { module.counts.contents = contents.filter((item) => item.moduleId === module.id).length; });
let comments = [
  { id: 'demo-comment-1', contentId: 'demo-1', bodyMd: '合成评论：试试回复、编辑，以及展开回答。', parentId: null, author: user, authorId: user.id, createdAt: '2026-11-04T09:00:00Z', status: 'published', media: [], counts: {}, mine: {}, canEdit: true, canDelete: true },
  { id: 'demo-comment-2', contentId: 'demo-1', bodyMd: '合成回复：页面应该能用键盘顺畅访问。', parentId: 'demo-comment-1', author: friend, authorId: friend.id, createdAt: '2026-11-04T09:05:00Z', status: 'published', media: [], counts: {}, mine: {}, canEdit: false, canDelete: true },
];
let messages = Array.from({ length: 120 }, (_, index) => ({
  id: `message-${String(index + 1).padStart(3, '0')}`, fromId: index % 2 ? user.id : friend.id, toId: index % 2 ? friend.id : user.id,
  bodyMd: `合成聊天记录 ${index + 1}：这段消息用于检查向上加载和输入体验。`, media: [], createdAt: new Date(Date.UTC(2026, 10, 4, 7) + index * 60000).toISOString(),
}));
const clone = (value) => structuredClone(value);
function filtered(options = {}) {
  let rows = contents.filter((item) => !options.moduleIds?.length || options.moduleIds.includes(item.moduleId));
  if (options.authorId) rows = rows.filter((item) => item.authorId === options.authorId);
  if (options.favoritesOf) rows = rows.filter((item) => item.mine.favorite);
  if (options.tag) rows = rows.filter((item) => item.tags.includes(options.tag));
  if (options.q) rows = rows.filter((item) => `${item.title} ${item.bodyMd} ${item.tags.join(' ')}`.toLowerCase().includes(options.q.toLowerCase()));
  if (options.dateFrom) rows = rows.filter((item) => item.createdAt >= options.dateFrom);
  if (options.dateTo) rows = rows.filter((item) => item.createdAt <= options.dateTo);
  return sortContents(rows, options.sort || 'new');
}
const api = {
  mode: 'synthetic-fixture',
  auth: {
    current: async () => clone(user), listMembers: async () => clone([user, friend]),
    updateProfile: async (patch) => Object.assign(user, patch), changePassword: async () => { throw new Error('合成测试页没有真实密码'); },
    logout: async () => { throw new Error('合成测试页没有登录会话'); },
  },
  modules: { list: async () => clone(modules) },
  grants: { list: async () => [] },
  contents: {
    list: async (options = {}) => {
      const rows = filtered(options); const offset = options.offset || 0; const limit = options.limit || 24;
      return clone({ items: rows.slice(offset, offset + limit), total: rows.length, hasMore: offset + limit < rows.length });
    },
    facets: async (options = {}) => ({ authors: [{ value: user.id, label: user.nickname, username: user.username }], tags: [...new Set(filtered(options).flatMap((item) => item.tags))] }),
    summary: async (options = {}) => {
      const rows = filtered(options);
      return { total: rows.length, likes: rows.reduce((sum, item) => sum + item.counts.like, 0), favorites: rows.reduce((sum, item) => sum + item.counts.favorite, 0) };
    },
    get: async (id) => { const value = contents.find((item) => item.id === id); if (!value) throw new Error('合成文章不存在'); return clone(value); },
    view: async () => {},
    create: async (payload) => {
      const item = { ...clone(contents[0]), ...clone(payload), id: `created-${Date.now()}`, module: modules.find((module) => module.id === payload.moduleId), createdAt: new Date().toISOString(), counts: { like: 0, dislike: 0, favorite: 0, comment: 0 }, mine: {}, views: 0 };
      contents.unshift(item); return clone(item);
    },
    update: async (id, patch) => { const value = contents.find((item) => item.id === id); Object.assign(value, clone(patch), { updatedAt: new Date().toISOString() }); return clone(value); },
    remove: async (id) => { contents = contents.filter((item) => item.id !== id); },
  },
  media: {
    resolve: async (reference) => typeof reference === 'string' ? reference : reference.url,
    resolveText: async (value) => value || '',
    upload: async () => { throw new Error('合成测试页不上传文件，也不连接真实存储。'); }, remove: async () => {},
  },
  comments: {
    list: async (id) => clone(comments.filter((comment) => comment.contentId === id)),
    mine: async () => clone(comments.filter((comment) => comment.authorId === user.id)),
    create: async (payload) => { const value = { ...clone(comments[0]), ...clone(payload), id: `comment-${Date.now()}`, createdAt: new Date().toISOString() }; comments.push(value); return clone(value); },
    update: async (id, patch) => { Object.assign(comments.find((comment) => comment.id === id), clone(patch)); },
    remove: async (id) => { comments = comments.filter((comment) => comment.id !== id && comment.parentId !== id); },
  },
  friends: { relation: async () => 'accepted', pendingCount: async () => 0, requests: async () => [], outgoing: async () => [], remove: async () => {}, search: async () => [] },
  messages: {
    threads: async () => [{ user: clone(friend), last: clone(messages.at(-1)), unread: 0 }], unreadTotal: async () => 0, markRead: async () => {},
    list: async (_peerId, { limit = 50, before } = {}) => clone(messages.filter((message) => !before || message.createdAt < before.createdAt || (message.createdAt === before.createdAt && message.id < before.id)).slice(-limit)),
    send: async (_peerId, payload) => { messages.push({ id: `sent-${Date.now()}`, ...clone(payload), fromId: user.id, toId: friend.id, createdAt: new Date().toISOString() }); },
  },
  permissionRequests: { create: async () => {} },
};
Object.assign(state, { user, modules, ready: true, mode: api.mode });
let cleanups = [];
let controller = null;
let generation = 0;
const navigate = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
async function render() {
  controller?.abort();
  cleanups.forEach((cleanup) => cleanup()); cleanups = [];
  controller = new AbortController();
  const signal = controller.signal;
  const version = ++generation;
  const old = document.getElementById('view');
  const container = old.cloneNode(false); old.replaceWith(container);
  container.innerHTML = loadingState();
  const { segments, query } = parseRoute(location.hash);
  const ctx = { api, user, container, signal, params: { ...query, id: segments[1] || query.id }, navigate,
    isCurrent: () => version === generation && !signal.aborted,
    onLeave: (cleanup) => { if (signal.aborted) cleanup(); else cleanups.push(cleanup); } };
  const routes = { '': renderHome, m: renderModule, c: renderDetail, edit: renderEditor, search: renderSearch, rank: renderRanking, favorites: renderFavorites, me: renderProfile, msg: renderMessages };
  try {
    await (routes[segments[0] || ''] || renderHome)(ctx);
    labelFields(container);
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="banner banner--danger" role="alert">${esc(error.message)}</div>`;
  }
}
window.addEventListener('hashchange', render);
document.getElementById('fixture-search').addEventListener('submit', (event) => {
  event.preventDefault(); navigate(`#/search?q=${encodeURIComponent(new FormData(event.target).get('q') || '')}`);
});
document.getElementById('fixture-theme').addEventListener('click', () => {
  const root = document.documentElement; root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
});
document.addEventListener('click', (event) => {
  const media = event.target.closest('[data-open-media]');
  if (media) { event.preventDefault(); lightbox(media.dataset.openMedia, media.dataset.mediaKind); }
  const react = event.target.closest('[data-react]');
  if (react) {
    const bar = react.closest('[data-reactbar]');
    const source = bar.dataset.targetType === 'content' ? contents : comments;
    const value = source.find((item) => item.id === bar.dataset.targetId);
    const key = react.dataset.react;
    if (value) {
      value.mine[key] = !value.mine[key]; value.counts[key] = Math.max(0, (value.counts[key] || 0) + (value.mine[key] ? 1 : -1));
      react.setAttribute('aria-pressed', String(value.mine[key]));
      react.classList.toggle(key === 'favorite' ? 'is-on--star' : key === 'dislike' ? 'is-on--down' : 'is-on', value.mine[key]);
      react.querySelector('[data-count]').textContent = value.counts[key];
    }
  }
});
const topbar = document.querySelector('.topbar');
if (typeof ResizeObserver === 'function') new ResizeObserver(() => document.documentElement.style.setProperty('--sticky-offset', `${topbar.offsetHeight}px`)).observe(topbar);
render();
