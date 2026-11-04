/** 体悟集 · 应用入口：路由、外壳与全局交互 */

import { CONFIG, APP_VERSION } from './config.js';
import { t, tl } from './core/i18n.js';
import { theme, lang, font } from './core/theme.js';
import { state, on, emit } from './core/store.js';
import { icon, toast, toastOk, toastErr, avatarHtml, emptyState, loadingState, lightbox, labelFields, closePopovers } from './core/ui.js';
import { esc } from './core/util.js';
import { parseRoute } from './core/route.js';
import { getApi, errText } from './data/index.js';

let api = null;
let leaveHooks = [];
let routeController = null;
let routeVersion = 0;
let badgesPending = null;
let booted = false;
let appearanceReady = false;
let booting = false;
let shellObserver = null;
const pendingReactions = new Set();

// A visit to the login/home page does not download the editor, inbox or admin UI.
const viewLoaders = {
  home: () => import('./views/home.js'),
  auth: () => import('./views/auth.js'),
  detail: () => import('./views/detail.js'),
  editor: () => import('./views/editor.js'),
  profile: () => import('./views/profile.js'),
  settings: () => import('./views/settings.js'),
  admin: () => import('./views/admin.js'),
  messages: () => import('./views/messages.js'),
};
const routes = {
  '': ['home', 'renderHome'], m: ['home', 'renderModule'],
  rank: ['home', 'renderRanking'], favorites: ['home', 'renderFavorites'],
  search: ['home', 'renderSearch'], login: ['auth', 'renderAuth'],
  c: ['detail', 'renderDetail'], edit: ['editor', 'renderEditor'],
  me: ['profile', 'renderProfile'], settings: ['settings', 'renderSettings'],
  admin: ['admin', 'renderAdmin'], msg: ['messages', 'renderMessages'],
};

/* ------------------------------ 路由 ------------------------------ */

function parseHash() {
  return parseRoute(window.location.hash);
}

function navigate(hash) {
  const next = hash.startsWith('#') ? hash : `#/${hash.replace(/^\//, '')}`;
  if (window.location.hash === next) renderView();
  else window.location.hash = next;
}

function runLeaveHooks() {
  routeController?.abort();
  closePopovers();
  const hooks = leaveHooks;
  leaveHooks = [];
  hooks.forEach((hook) => { try { hook(); } catch (error) { console.error(error); } });
}

function moduleNavHtml(modules, activeId) {
  const english = document.documentElement.dataset.lang === 'en';
  return modules.map((module) => `<a class="navtab ${module.id === activeId ? 'is-active' : ''}"
    ${module.id === activeId ? 'aria-current="page"' : ''} href="#/m/${encodeURIComponent(module.id)}">${esc(module.icon)} ${esc(english ? module.nameEn || module.nameZh : module.nameZh || module.nameEn)}</a>`).join('');
}

/* ------------------------------ 外壳 ------------------------------ */

function renderShell() {
  shellObserver?.disconnect();
  const app = document.getElementById('app');
  const user = state.user;
  const modules = state.modules.filter((m) => m.access.visible);
  const { segments } = parseHash();
  const activeModuleId = segments[0] === 'm' ? segments[1] : null;
  // 未登录时视图就是登录 / 注册页：顶栏只保留品牌与设置入口，
  // 不显示「首页 / 排行榜 / 留言」导航标签与全局搜索框。
  const bare = !user;

  const themeBtn = `<button class="icon-btn" data-role="theme" title="${esc(t('settings.theme'))}" aria-label="${esc(t('settings.theme'))}">${icon(theme.resolved === 'dark' ? 'sun' : 'moon', 17)}</button>`;
  const settingsBtn = `<a class="icon-btn" href="#/settings" title="${esc(t('settings.title'))}" aria-label="${esc(t('settings.title'))}">${icon('settings', 17)}</a>`;

  app.innerHTML = `
    <a class="skip-link" href="#view" data-role="skip">${esc(tl('跳到正文', 'Skip to content'))}</a>
    <header class="topbar">
      <div class="topbar__inner">
        <a class="brand" href="#/" style="color:inherit">
          <span class="brand__mark">体</span>
          <span>
            <span class="brand__text">${esc(tl(CONFIG.site.name.zh, CONFIG.site.name.en))}</span>
            <span class="brand__sub" style="display:block">Insight</span>
          </span>
        </a>
        ${bare ? '' : `<nav class="navtabs" aria-label="${esc(tl('主导航', 'Main navigation'))}">
          <a class="navtab ${segments.length === 0 ? 'is-active' : ''}" href="#/">${esc(t('nav.home'))}</a>
          ${moduleNavHtml(modules, activeModuleId)}
          <a class="navtab ${segments[0] === 'rank' ? 'is-active' : ''}" href="#/rank">${esc(t('nav.ranking'))}</a>
          <a class="navtab ${segments[0] === 'msg' ? 'is-active' : ''}" href="#/msg" style="display:inline-flex;align-items:center;gap:5px">${esc(t('nav.messages'))}<span class="badge badge--accent hidden" data-badge="nav-msg"></span></a>
        </nav>`}
        <div class="topbar__actions">
          ${bare ? `${themeBtn}${settingsBtn}` : `
          <form class="global-search" role="search" data-role="search-form">
            <label class="sr-only" for="global-search">${esc(t('nav.search'))}</label>
            <input id="global-search" class="input" type="search" enterkeyhint="search" data-role="global-search" placeholder="${esc(t('nav.search'))}" value="${esc(segments[0] === 'search' ? (parseHash().query.q || '') : '')}" maxlength="200" autocomplete="off" />
            <button class="icon-btn" type="submit" aria-label="${esc(t('common.search'))}">${icon('search', 15)}</button>
          </form>
          ${themeBtn}
          ${settingsBtn}
          <button class="icon-btn" data-role="commands" aria-label="${esc(tl('快速前往', 'Go to'))}" title="${esc(tl('快速前往', 'Go to'))} (⌘ / Ctrl K)">${icon('menu', 17)}</button>
          <button class="icon-btn" data-role="write" title="${esc(t('content.new'))}" aria-label="${esc(t('content.new'))}">${icon('plus', 18)}</button>
          <button class="icon-btn" data-role="user-menu" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('nav.profile'))}" style="padding:0">${avatarHtml(user, 'avatar--sm')}</button>
          `}
        </div>
      </div>
    </header>
    <div class="connection-status" data-role="connection-status" role="status" ${navigator.onLine ? 'hidden' : ''}>${esc(tl('当前网络已断开；编辑内容会继续保存在此浏览器。', 'You are offline. Editor changes remain saved in this browser.'))}</div>
    <main class="page" id="view" tabindex="-1">${loadingState()}</main>
    <footer style="border-top:1px solid var(--line);padding:18px;text-align:center" class="tiny muted">
      ${esc(t('app.footer'))} · v${esc(APP_VERSION)} ·
      <span title="${esc(api?.mode === 'supabase' ? t('app.cloudMode') : t('app.localMode'))}">${api?.mode === 'supabase' ? '☁︎' : '⌂'} ${esc(api?.mode === 'supabase' ? 'PostgreSQL' : t('app.localMode'))}</span>
    </footer>
  `;

  /* 顶栏交互 */
  app.querySelector('[data-role="skip"]').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('view')?.focus();
  });
  const searchInput = app.querySelector('[data-role="global-search"]');
  app.querySelector('[data-role="search-form"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (searchInput.value.trim()) navigate(`#/search?q=${encodeURIComponent(searchInput.value.trim())}`);
  });
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { searchInput.value = ''; searchInput.blur(); }
  });
  // 主题切换只改 data-theme 属性，按钮图标由 theme:change 事件更新；
  // 这里不能重建外壳——renderShell() 会把 #view 重置成「载入中」且不会重新渲染视图。
  app.querySelector('[data-role="theme"]').addEventListener('click', () => theme.toggle());
  app.querySelector('[data-role="write"]')?.addEventListener('click', () => navigate('#/edit'));
  app.querySelector('[data-role="commands"]')?.addEventListener('click', showCommands);
  const topbar = app.querySelector('.topbar');
  const updateOffset = () => document.documentElement.style.setProperty('--sticky-offset', `${topbar.offsetHeight}px`);
  if (typeof ResizeObserver === 'function') {
    shellObserver = new ResizeObserver(updateOffset);
    shellObserver.observe(topbar);
  }
  updateOffset();
  refreshBadges();

  const menuButton = app.querySelector('[data-role="user-menu"]');
  menuButton?.addEventListener('click', async () => {
    const { mountMenu } = await import('./core/ui.js');
    mountMenu(menuButton, [
      { label: `${state.user.nickname} · ${t(`role.short.${state.user.role}`)}`, icon: 'user', onClick: () => navigate('#/me') },
      { separator: true },
      { label: t('nav.profile'), icon: 'user', onClick: () => navigate('#/me') },
      { label: t('settings.title'), icon: 'settings', onClick: () => navigate('#/settings') },
      { label: t('nav.favorites'), icon: 'star', onClick: () => navigate('#/favorites') },
      { label: t('nav.messages'), icon: 'chat', onClick: () => navigate('#/msg') },
      ...(state.user.role === 'superadmin' || state.user.role === 'owner'
        ? [{ label: t('nav.admin'), icon: 'shield', onClick: () => navigate('#/admin') }] : []),
      { separator: true },
      { label: t('nav.logout'), icon: 'logout', danger: true, onClick: async () => {
        await api.auth.logout();
        toastOk(t('auth.logoutOk'));
        await refreshUser();
        navigate('#/login');
      } },
    ]);
  });
}

async function showCommands() {
  if (document.querySelector('[role="dialog"]')) return;
  try {
    const { openCommandPalette } = await import('./components/command-palette.js');
    if (!document.querySelector('[role="dialog"]')) openCommandPalette({ user: state.user, modules: state.modules, navigate });
  } catch { document.querySelector('[data-role="global-search"]')?.focus(); }
}

/* ------------------------------ 视图 ------------------------------ */

async function renderView() {
  runLeaveHooks();
  const previous = document.getElementById('view');
  if (!previous) return;
  // A slow previous renderer may finish, but can only write into its detached root.
  const view = previous.cloneNode(false);
  view.className = 'page';
  view.setAttribute('aria-busy', 'true');
  view.innerHTML = loadingState();
  previous.replaceWith(view);
  const version = ++routeVersion;
  const controller = new AbortController();
  routeController = controller;
  const hooks = [];
  leaveHooks = hooks;
  const isCurrent = () => version === routeVersion && !controller.signal.aborted;
  const { segments, query } = parseHash();
  const [first, second] = segments;
  const user = state.user;

  const needsAuth = !(first === 'login' || first === 'settings');
  const selectedRoute = !user && needsAuth ? routes.login : routes[first || ''];

  const ctx = {
    api,
    user,
    container: view,
    // 路由参数：优先取路径段（#/c/:id），其次取查询串（#/edit?id=…），
    // 这样「编辑」链接带上的 id 才不会被 undefined 覆盖掉。
    params: { ...query, id: second || query.id, tab: second },
    navigate: (hash) => { if (isCurrent()) navigate(hash); },
    signal: controller.signal,
    isCurrent,
    onLeave: (hook) => { if (isCurrent()) hooks.push(hook); else hook(); },
  };

  view.scrollTop = 0;
  window.scrollTo({ top: 0 });

  try {
    if (!selectedRoute) { view.innerHTML = emptyState(t('content.notFound'), '迷'); return; }
    const [module, entry] = selectedRoute;
    const loaded = await viewLoaders[module]();
    if (!isCurrent()) return;
    if (module === 'auth') view.classList.remove('page');
    await loaded[entry](ctx);
    if (!isCurrent()) return;
    labelFields(view);
    const title = view.querySelector('h1')?.textContent?.trim();
    document.title = title ? `${title} · ${tl(CONFIG.site.name.zh, CONFIG.site.name.en)}` : '体悟集 · Insight';
  } catch (error) {
    if (!isCurrent()) return;
    console.error('[体悟集] 视图渲染失败', error);
    view.innerHTML = `<div class="banner banner--danger" role="alert">${icon('alert', 17)}<div>${esc(errText(error))}<div class="mt-1"><button class="btn btn--sm" data-role="retry-view">${esc(tl('重新加载', 'Try again'))}</button></div></div></div>`;
    view.querySelector('[data-role="retry-view"]').addEventListener('click', renderView);
  } finally {
    if (isCurrent()) view.removeAttribute('aria-busy');
  }
}

async function refreshUser() {
  state.user = await api.auth.current();
  state.modules = await api.modules.list();
  emit('state', state);
}

async function refreshBadges() {
  if (!state.user || document.hidden || badgesPending) return;
  const userId = state.user.id;
  badgesPending = true;
  try {
    const [unread, pending] = await Promise.all([api.messages.unreadTotal(), api.friends.pendingCount()]);
    const total = (unread || 0) + (pending || 0);
    if (state.user?.id !== userId) return;
    document.querySelectorAll('[data-badge="nav-msg"]').forEach((node) => {
      node.textContent = total > 99 ? '99+' : String(total);
      node.classList.toggle('hidden', !total);
    });
  } catch { /* 角标失败不影响使用 */ }
  finally { badgesPending = false; }
}

/* ------------------------------ 全局交互 ------------------------------ */

/** 赞 / 踩 / 收藏（内容与评论通用） */
function wireReactions() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-react]');
    if (!btn) return;
    const bar = btn.closest('[data-reactbar]');
    if (!bar) return;
    if (!state.user) {
      toast(t('common.loginRequired'), 'info');
      navigate('#/login');
      return;
    }
    const targetType = bar.dataset.targetType;
    const targetId = bar.dataset.targetId;
    const kind = btn.dataset.react;
    const key = `${targetType}:${targetId}`;
    if (pendingReactions.has(key)) return;
    pendingReactions.add(key);
    bar.querySelectorAll('[data-react]').forEach((button) => { button.disabled = true; });
    try {
      const result = await api.reactions.toggle({ targetType, targetId, kind });
      updateReactBars(targetType, targetId, result[targetId]);
    } catch (error) {
      toastErr(errText(error));
    } finally {
      pendingReactions.delete(key);
      bar.querySelectorAll('[data-react]').forEach((button) => { button.disabled = false; });
    }
  });
}

function updateReactBars(targetType, targetId, payload) {
  if (!payload) return;
  document.querySelectorAll(`[data-reactbar][data-target-type="${targetType}"][data-target-id="${targetId}"]`).forEach((bar) => {
    ['like', 'dislike', 'favorite'].forEach((kind) => {
      const button = bar.querySelector(`[data-react="${kind}"]`);
      if (!button) return;
      const active = Boolean(payload.mine?.[kind]);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-on', kind === 'like' && active);
      button.classList.toggle('is-on--down', kind === 'dislike' && active);
      button.classList.toggle('is-on--star', kind === 'favorite' && active);
      const count = button.querySelector('[data-count]');
      if (count) count.textContent = payload[kind] ?? 0;
      const iconName = kind === 'like' ? 'like' : kind === 'dislike' ? 'dislike' : 'star';
      const svg = button.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', active ? 'currentColor' : 'none');
        svg.style.opacity = active ? '1' : '';
      }
      void iconName;
    });
  });
}

/** 图片 / 视频点击放大 */
/** 「加好友」按钮（内容详情 / 卡片通用） */
function wireAddFriend() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-role="add-friend"][data-user]');
    if (!btn) return;
    event.preventDefault();
    if (!state.user) {
      toast(t('common.loginRequired'), 'info');
      navigate('#/login');
      return;
    }
    const { openFriendRequest } = await import('./views/messages.js');
    await openFriendRequest({ api, user: state.user, navigate }, btn.dataset.user, () => renderView());
  });
}

function wireLightbox() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-open-media]');
    if (!target) return;
    event.preventDefault();
    lightbox(target.dataset.openMedia, target.dataset.mediaKind);
  });
}

/* ------------------------------ 启动 ------------------------------ */

async function boot() {
  if (booting || booted) return;
  booting = true;
  if (!appearanceReady) {
    theme.init();
    lang.init();
    font.init();
    appearanceReady = true;
  }

  const app = document.getElementById('app');
  app.innerHTML = '<div class="boot-screen"><div class="boot-mark">体</div><div class="boot-text">正在载入体悟集…</div></div>';

  try {
    api = await getApi();
    state.mode = api.mode;
    state.user = await api.auth.current();
    state.modules = await api.modules.list();
    state.ready = true;
  } catch (error) {
    console.error(error);
    app.innerHTML = `<main class="page page--narrow"><section class="card stack gap-2" style="margin-top:12vh" role="alert">
      <h1 style="font-size:22px">${esc(tl('暂时无法连接到体悟集', 'Insight could not connect'))}</h1>
      <p class="muted mb-0">${esc(errText(error))}</p>
      <div><button class="btn btn--primary" data-role="retry-boot">${esc(tl('重试连接', 'Try again'))}</button></div>
    </section></main>`;
    booting = false;
    app.querySelector('[data-role="retry-boot"]').addEventListener('click', boot, { once: true });
    return;
  }

  renderShell();
  await renderView();
  booted = true;
  booting = false;

  window.addEventListener('hashchange', () => { renderShell(); renderView(); });
  on('auth:changed', async () => {
    try {
      await refreshUser();
      renderShell();
      await renderView();
    } catch (error) { toastErr(errText(error)); }
  });
  on('social:changed', () => { refreshBadges(); });
  document.addEventListener('lang:change', () => { renderShell(); renderView(); });
  document.addEventListener('theme:change', () => {
    const btn = document.querySelector('[data-role="theme"]');
    if (btn) btn.innerHTML = icon(theme.resolved === 'dark' ? 'sun' : 'moon', 17);
  });

  wireReactions();
  wireLightbox();
  wireAddFriend();

  /* 快捷键：/ 聚焦搜索，n 新建，Esc 清空搜索 */
  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      showCommands();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('[role="dialog"]')) return;
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if (typing) return;
    if (event.key === '/') {
      event.preventDefault();
      document.querySelector('[data-role="global-search"]')?.focus();
    }
    if (event.key.toLowerCase() === 'n' && state.user) {
      event.preventDefault();
      navigate('#/edit');
    }
  });

  const updateConnection = () => {
    const banner = document.querySelector('[data-role="connection-status"]');
    if (banner) banner.hidden = navigator.onLine;
    if (navigator.onLine) refreshBadges();
  };
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBadges(); });
  setInterval(refreshBadges, 60000);

  if (!CONFIG.supabaseUrl && state.user) {
    const seen = sessionStorage.getItem('tiwu.localwarn');
    if (!seen) {
      sessionStorage.setItem('tiwu.localwarn', '1');
      toast(t('app.localWarning'), 'info', 5200);
    }
  }
}

boot();
