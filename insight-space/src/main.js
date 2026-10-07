/** 体悟集 · 应用入口：路由、外壳与全局交互 */

import { CONFIG, APP_VERSION } from './config.js';
import { t, tl } from './core/i18n.js';
import { theme, lang, font } from './core/theme.js';
import { state, setState, on, emit } from './core/store.js';
import { icon, toast, toastOk, toastErr, avatarHtml, emptyState, loadingState, lightbox } from './core/ui.js';
import { esc, debounce } from './core/util.js';
import { getApi, errText } from './data/index.js';
import { setApiInstance } from './components/composer.js';
import { moduleName } from './components/widgets.js';

import { renderAuth } from './views/auth.js';
import { renderHome, renderModule, renderRanking, renderFavorites, renderSearch, moduleNavHtml } from './views/home.js';
import { renderDetail } from './views/detail.js';
import { renderEditor } from './views/editor.js';
import { renderProfile } from './views/profile.js';
import { renderSettings } from './views/settings.js';
import { renderAdmin } from './views/admin.js';
import { renderMessages } from './views/messages.js';

let api = null;
let leaveHooks = [];

/* ------------------------------ 路由 ------------------------------ */

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { segments, query };
}

function navigate(hash) {
  const next = hash.startsWith('#') ? hash : `#/${hash.replace(/^\//, '')}`;
  if (window.location.hash === next) renderView();
  else window.location.hash = next;
}

function runLeaveHooks() {
  const hooks = leaveHooks;
  leaveHooks = [];
  hooks.forEach((hook) => { try { hook(); } catch (error) { console.error(error); } });
}

/* ------------------------------ 外壳 ------------------------------ */

function renderShell() {
  const app = document.getElementById('app');
  const user = state.user;
  const modules = state.modules.filter((m) => m.access.visible);
  const { segments } = parseHash();
  const activeModuleId = segments[0] === 'm' ? segments[1] : null;
  // 未登录时视图就是登录 / 注册页：顶栏只保留品牌与设置入口，
  // 不显示「首页 / 排行榜 / 留言」导航标签与全局搜索框。
  const bare = !user;

  const themeBtn = `<button class="icon-btn" data-role="theme" title="${esc(t('settings.theme'))}">${icon(theme.current === 'dark' ? 'sun' : 'moon', 17)}</button>`;
  const settingsBtn = `<a class="icon-btn" href="#/settings" title="${esc(t('settings.title'))}" aria-label="${esc(t('settings.title'))}">${icon('settings', 17)}</a>`;

  app.innerHTML = `
    <header class="topbar">
      <div class="topbar__inner">
        <a class="brand" href="#/" style="color:inherit">
          <span class="brand__mark">体</span>
          <span>
            <span class="brand__text">${esc(tl(CONFIG.site.name.zh, CONFIG.site.name.en))}</span>
            <span class="brand__sub" style="display:block">Insight</span>
          </span>
        </a>
        ${bare ? '' : `<nav class="navtabs">
          <a class="navtab ${segments.length === 0 ? 'is-active' : ''}" href="#/">${esc(t('nav.home'))}</a>
          ${moduleNavHtml(modules, activeModuleId)}
          <a class="navtab ${segments[0] === 'rank' ? 'is-active' : ''}" href="#/rank">${esc(t('nav.ranking'))}</a>
          <a class="navtab ${segments[0] === 'msg' ? 'is-active' : ''}" href="#/msg" style="display:inline-flex;align-items:center;gap:5px">${esc(t('nav.messages'))}<span class="badge badge--accent hidden" data-badge="nav-msg"></span></a>
        </nav>`}
        <div class="topbar__actions">
          ${bare ? `${themeBtn}${settingsBtn}` : `
          <input class="input" data-role="global-search" placeholder="${esc(t('nav.search'))}" value="${esc(segments[0] === 'search' ? (parseHash().query.q || '') : '')}"
                 style="width:170px;height:34px;padding:4px 10px" />
          ${themeBtn}
          ${settingsBtn}
          <button class="icon-btn" data-role="write" title="${esc(t('content.new'))}">${icon('plus', 18)}</button>
          <button class="icon-btn" data-role="user-menu" style="padding:0">${avatarHtml(user, 'avatar--sm')}</button>
          `}
        </div>
      </div>
    </header>
    <main class="page" id="view">${loadingState()}</main>
    <footer style="border-top:1px solid var(--line);padding:18px;text-align:center" class="tiny muted">
      ${esc(t('app.footer'))} · v${esc(APP_VERSION)} ·
      <span title="${esc(api?.mode === 'supabase' ? t('app.cloudMode') : t('app.localMode'))}">${api?.mode === 'supabase' ? '☁︎' : '⌂'} ${esc(api?.mode === 'supabase' ? 'PostgreSQL' : t('app.localMode'))}</span>
    </footer>
  `;

  /* 顶栏交互 */
  const searchInput = app.querySelector('[data-role="global-search"]');
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && searchInput.value.trim()) navigate(`#/search?q=${encodeURIComponent(searchInput.value.trim())}`);
  });
  // 主题切换只改 data-theme 属性，按钮图标由 theme:change 事件更新；
  // 这里不能重建外壳——renderShell() 会把 #view 重置成「载入中」且不会重新渲染视图。
  app.querySelector('[data-role="theme"]').addEventListener('click', () => theme.toggle());
  app.querySelector('[data-role="write"]')?.addEventListener('click', () => navigate('#/edit'));
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

/* ------------------------------ 视图 ------------------------------ */

async function renderView() {
  runLeaveHooks();
  const view = document.getElementById('view');
  if (!view) return;
  const { segments, query } = parseHash();
  const [first, second] = segments;
  const user = state.user;

  const needsAuth = !(first === 'login' || first === 'settings');
  if (!user && needsAuth) {
    renderAuthView();
    return;
  }

  const ctx = {
    api,
    user,
    container: view,
    // 路由参数：优先取路径段（#/c/:id），其次取查询串（#/edit?id=…），
    // 这样「编辑」链接带上的 id 才不会被 undefined 覆盖掉。
    params: { ...query, id: second || query.id, tab: second },
    navigate,
    onLeave: (hook) => leaveHooks.push(hook),
  };

  view.scrollTop = 0;
  window.scrollTo({ top: 0 });

  try {
    if (!first) await renderHome(ctx);
    else if (first === 'login') await renderAuthView();
    else if (first === 'm') await renderModule(ctx);
    else if (first === 'c') await renderDetail(ctx);
    else if (first === 'edit') await renderEditor(ctx);
    else if (first === 'rank') await renderRanking(ctx);
    else if (first === 'me') await renderProfile(ctx);
    else if (first === 'favorites') await renderFavorites(ctx);
    else if (first === 'search') await renderSearch(ctx);
    else if (first === 'admin') await renderAdmin(ctx);
    else if (first === 'msg') await renderMessages(ctx);
    else if (first === 'settings') await renderSettings(ctx);
    else view.innerHTML = emptyState(t('content.notFound'), '迷');
  } catch (error) {
    console.error('[体悟集] 视图渲染失败', error);
    view.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
  }
}

function renderAuthView() {
  const view = document.getElementById('view');
  if (view) view.classList.remove('page');
  renderAuth({ api, container: view || document.getElementById('app'), navigate });
}

async function refreshUser() {
  state.user = await api.auth.current();
  state.modules = await api.modules.list();
  emit('state', state);
}

async function refreshBadges() {
  if (!state.user) return;
  try {
    const [unread, pending] = await Promise.all([api.messages.unreadTotal(), api.friends.pendingCount()]);
    const total = (unread || 0) + (pending || 0);
    document.querySelectorAll('[data-badge="nav-msg"]').forEach((node) => {
      node.textContent = total > 99 ? '99+' : String(total);
      node.classList.toggle('hidden', !total);
    });
  } catch { /* 角标失败不影响使用 */ }
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
    try {
      const result = await api.reactions.toggle({ targetType, targetId, kind });
      updateReactBars(targetType, targetId, result[targetId]);
    } catch (error) {
      toastErr(errText(error));
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
  theme.init();
  lang.init();
  font.init();

  const app = document.getElementById('app');
  app.innerHTML = '<div class="boot-screen"><div class="boot-mark">体</div><div class="boot-text">正在载入体悟集…</div></div>';

  try {
    api = await getApi();
    setApiInstance(api);
    state.mode = api.mode;
    state.user = await api.auth.current();
    state.modules = await api.modules.list();
    state.ready = true;
  } catch (error) {
    console.error(error);
    app.innerHTML = `<div class="banner banner--danger" style="margin:40px">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }

  renderShell();
  await renderView();

  window.addEventListener('hashchange', () => { renderShell(); renderView(); });
  on('auth:changed', async () => {
    await refreshUser();
    renderShell();
    await renderView();
  });
  on('social:changed', () => { refreshBadges(); });
  document.addEventListener('lang:change', () => { renderShell(); renderView(); });
  document.addEventListener('theme:change', () => {
    const btn = document.querySelector('[data-role="theme"]');
    if (btn) btn.innerHTML = icon(theme.current === 'dark' ? 'sun' : 'moon', 17);
  });

  wireReactions();
  wireLightbox();
  wireAddFriend();

  /* 快捷键：/ 聚焦搜索，n 新建，Esc 清空搜索 */
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
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

  if (!CONFIG.supabaseUrl && state.user) {
    const seen = sessionStorage.getItem('tiwu.localwarn');
    if (!seen) {
      sessionStorage.setItem('tiwu.localwarn', '1');
      toast(t('app.localWarning'), 'info', 5200);
    }
  }
}

boot();
