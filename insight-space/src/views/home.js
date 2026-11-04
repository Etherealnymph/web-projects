/** 首页 / 模块页 / 排行榜 / 收藏 / 搜索 */

import { t, tl } from '../core/i18n.js';
import { icon, emptyState, loadingState } from '../core/ui.js';
import { esc, debounce } from '../core/util.js';
import { createContentFeed } from '../components/content-feed.js';
import {
  rankedItemHtml, sortControl, moduleName, moduleDesc,
} from '../components/widgets.js';
import {
  emptyFilters, toListOptions, filterBarHtml, fillFacetSelects, wireFilterBar, filtersActive,
} from '../components/filters.js';

export { resolveMediaUrls } from '../components/content-feed.js';

function attachFilters(ctx, filters, facets, feed, { baseline = '', extra = {} } = {}) {
  let scope = null;
  let version = 0;
  async function refreshFacets() {
    if (scope === filters.moduleId) return;
    scope = filters.moduleId;
    const request = ++version;
    try {
      const result = await ctx.api.contents.facets({ ...extra, ...(scope ? { moduleIds: [scope] } : {}) });
      if (request !== version || ctx.signal?.aborted) return;
      Object.assign(facets, result);
      fillFacetSelects(ctx.container, filters, facets);
    } catch (error) {
      if (!ctx.signal?.aborted) console.warn('[Insight] Filter choices could not load', error);
      scope = null;
    }
  }
  const cleanup = wireFilterBar(ctx.container, filters, () => {
    if (scope !== filters.moduleId) { filters.authorId = ''; filters.tag = ''; }
    return Promise.all([refreshFacets(), feed.load(true)]);
  }, baseline);
  ctx.onLeave(() => { version += 1; cleanup?.(); });
  return refreshFacets;
}

export function moduleNavHtml(modules, activeId) {
  return modules.map((m) => `
    <a class="navtab ${m.id === activeId ? 'is-active' : ''}" href="#/m/${esc(m.id)}">${esc(m.icon)} ${esc(moduleName(m, document.documentElement.dataset.lang))}</a>
  `).join('');
}

export async function renderHome(ctx) {
  const { api, user, container } = ctx;
  const lang = document.documentElement.dataset.lang;
  container.innerHTML = `<div class="stack gap-3">${loadingState()}</div>`;

  const modules = await api.modules.list();
  const accessible = modules.filter((m) => m.access.visible);
  const [hot, fresh] = await Promise.all([
    api.contents.list({ sort: 'hot', limit: 6 }),
    api.contents.list({ sort: 'new', limit: 6 }),
  ]);
  if (ctx.signal?.aborted) return;

  container.innerHTML = `
    <div class="stack gap-3">
      <section class="hero">
        <h1 class="hero__title">${esc(tl('体悟集 · 私人的体悟与收藏', 'Insight · a private collection'))}</h1>
        <p class="hero__sub">${esc(lang === 'en' ? 'Write with Markdown, attach photos, video, voice and stickers — then let heat decide what surfaces.' : '用 Markdown 记录，附上照片、视频、语音与表情包；让热度决定什么被看见。')}</p>
        <div class="row row--wrap mt-2">
          <a class="btn btn--primary" href="#/edit">${icon('plus', 16)} ${esc(t('content.new'))}</a>
          <a class="btn" href="#/rank">${icon('fire', 16)} ${esc(t('nav.ranking'))}</a>
          ${user && (user.role === 'superadmin' || user.role === 'owner') ? `<a class="btn" href="#/admin">${icon('dashboard', 16)} ${esc(t('nav.admin'))}</a>` : ''}
        </div>
      </section>

      <section>
        <div class="row row--between mb-2">
          <h2 class="mb-0" style="font-size:17px">${esc(t('nav.modules'))}</h2>
          <span class="tiny muted">${accessible.length} / ${modules.length}</span>
        </div>
        ${accessible.length ? `
          <div class="grid grid--cards">
            ${accessible.map((m) => `
              <a class="card card--link" href="#/m/${esc(m.id)}">
                <div class="row row--between">
                  <span style="font-size:26px">${esc(m.icon)}</span>
                  <span class="badge">${esc(m.counts?.contents ?? 0)} ${esc(t('common.content'))}</span>
                </div>
                <h3 class="card__title mt-2 mb-0">${esc(moduleName(m, lang))}</h3>
                <div class="small muted clamp-2">${esc(moduleDesc(m, lang))}</div>
                <div class="tiny muted mt-1">${m.access.write ? icon('edit', 12) + ' ' + esc(t('common.write')) : icon('eye', 12) + ' ' + esc(t('common.readonly'))}${m.access.expiresAt ? ` · ${esc(t('common.expires'))} ${esc(new Date(m.access.expiresAt).toLocaleDateString())}` : ''}</div>
              </a>
            `).join('')}
          </div>
        ` : `<div class="banner banner--warn">${icon('alert', 17)}<div>${esc(t('profile.noModule'))}</div></div>`}
      </section>

      ${hot.items.length ? `
        <section class="grid grid--2">
          <div class="panel">
            <div class="panel__head">
              <span class="panel__title">${icon('fire', 15)} ${esc(t('sort.hot'))}</span>
              <span class="grow"></span>
              <a class="tiny" href="#/rank">${esc(t('common.more'))}</a>
            </div>
            <div class="panel__body panel__body--flush">
              ${hot.items.slice(0, 5).map((item, index) => rankedItemHtml(item, index)).join('')}
            </div>
          </div>
          <div class="panel">
            <div class="panel__head">
              <span class="panel__title">${icon('clock', 15)} ${esc(t('sort.new'))}</span>
              <span class="grow"></span>
            </div>
            <div class="panel__body panel__body--flush">
              ${fresh.items.slice(0, 5).map((item, index) => rankedItemHtml(item, index)).join('') || emptyState(t('common.empty'), '新')}
            </div>
          </div>
        </section>
      ` : emptyState(t('common.empty'), '空')}
    </div>
  `;
}

export async function renderModule(ctx) {
  const { api, container, params } = ctx;
  const lang = document.documentElement.dataset.lang;
  container.innerHTML = loadingState();
  const modules = await api.modules.list();
  const module = modules.find((m) => m.id === params.id || m.key === params.id);
  if (!module) {
    container.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(t('content.notFound'))}</div></div>`;
    return;
  }
  if (!module.access.visible) {
    container.innerHTML = `
      <div class="card center" style="padding:40px">
        <div style="font-size:34px">${icon('shield', 40)}</div>
        <h2 class="mt-2">${esc(t('module.noAccess'))}</h2>
        <p class="muted">${esc(t('module.noAccessHint'))}</p>
        <a class="btn" href="#/">${esc(t('common.back'))}</a>
      </div>`;
    return;
  }

  let sort = module.hot ? 'hot' : 'new';
  let query = '';
  const filters = emptyFilters(module.id);
  const facets = {
    modules: modules.filter((m) => m.access.visible).map((m) => ({ value: m.id, label: moduleName(m, lang) })),
    authors: [],
    tags: [],
  };

  container.innerHTML = `
    <div class="stack gap-2">
      <section class="card">
        <div class="row row--between row--wrap">
          <div class="row">
            <span style="font-size:30px">${esc(module.icon)}</span>
            <div>
              <h1 class="mb-0" style="font-size:22px">${esc(moduleName(module, lang))}</h1>
              <div class="small muted">${esc(moduleDesc(module, lang))}</div>
            </div>
          </div>
          <div class="row row--wrap">
            ${module.access.write ? `<a class="btn btn--primary" href="#/edit?module=${esc(module.id)}">${icon('plus', 16)} ${esc(t('content.new'))}</a>` : ''}
          </div>
        </div>
        <div class="row row--wrap mt-2">
          ${sortControl(sort)}
          <div class="grow"></div>
          <div class="row" style="min-width:220px">
            <input class="input" type="search" data-role="search" aria-label="${esc(t('nav.search'))}" placeholder="${esc(t('nav.search'))}" value="${esc(query)}" maxlength="200" style="min-width:200px" />
          </div>
        </div>
        ${filterBarHtml(filters, facets)}
      </section>
      <div class="tiny muted" data-role="count" role="status"></div>
      <div data-role="list" class="grid grid--cards"></div>
      <div class="center" data-role="more"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const moreBox = container.querySelector('[data-role="more"]');

  const feed = createContentFeed({
    ctx, list: listBox, more: moreBox, count: container.querySelector('[data-role="count"]'),
    options: () => ({ sort, q: query, ...toListOptions(filters) }),
    emptyText: () => Boolean(query) || filtersActive(filters, module.id) ? t('msg.noResults') : t('module.empty'),
    mark: module.icon,
  });

  container.querySelector('[data-sort]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    sort = btn.dataset.value;
    container.querySelectorAll('[data-sort] [data-value]').forEach((node) => node.classList.toggle('is-active', node === btn));
    feed.load(true);
  });

  const search = debounce(() => feed.load(true), 320);
  container.querySelector('[data-role="search"]').addEventListener('input', (event) => {
    query = event.target.value.trim();
    if (!event.isComposing) search();
  });
  container.querySelector('[data-role="search"]').addEventListener('compositionend', (event) => {
    query = event.target.value.trim();
    search();
  });
  ctx.onLeave(search.cancel);
  const refreshFacets = attachFilters(ctx, filters, facets, feed, { baseline: module.id });
  await Promise.all([refreshFacets(), feed.load(true)]);
}

export async function renderRanking(ctx) {
  const { api, container } = ctx;
  container.innerHTML = loadingState();
  const modules = await api.modules.list();
  const accessible = modules.filter((m) => m.access.visible).map((m) => m.id);
  let hot = { items: [], total: 0 };
  let liked = { items: [], total: 0 };
  if (accessible.length) [hot, liked] = await Promise.all([
    api.contents.list({ sort: 'hot', limit: 20 }),
    api.contents.list({ sort: 'like', limit: 20 }),
  ]);
  const ranking = hot.items.slice();

  container.innerHTML = `
    <div class="stack gap-3">
      <section class="hero">
        <h1 class="hero__title">${esc(t('nav.ranking'))}</h1>
      </section>

      <div class="grid grid--2">
        <div class="panel">
          <div class="panel__head"><span class="panel__title">${icon('fire', 15)} ${esc(t('sort.hot'))}</span></div>
          <div class="panel__body panel__body--flush">
            ${ranking.length ? ranking.map((item, index) => rankedItemHtml(item, index, { views: true })).join('') : emptyState(t('common.empty'), '榜')}
          </div>
        </div>
        <div class="panel">
          <div class="panel__head"><span class="panel__title">${icon('like', 15)} ${esc(t('sort.like'))}</span></div>
          <div class="panel__body panel__body--flush">
            ${liked.items.map((item, index) => rankedItemHtml(item, index)).join('') || emptyState(t('common.empty'), '榜')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function renderFavorites(ctx) {
  const { api, user, container } = ctx;
  const lang = document.documentElement.dataset.lang;
  container.innerHTML = loadingState();
  if (!user) { container.innerHTML = emptyState(t('common.loginRequired'), '锁'); return; }

  const modules = await api.modules.list();
  const filters = emptyFilters('');
  const facets = {
    modules: modules.filter((m) => m.access.visible).map((m) => ({ value: m.id, label: moduleName(m, lang) })),
    authors: [],
    tags: [],
  };

  container.innerHTML = `
    <div class="stack gap-2">
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${icon('star', 15)} ${esc(t('profile.myFavorites'))}</span>
          <span class="grow"></span>
          <span class="tiny muted" data-role="count" role="status"></span>
        </div>
        <div class="panel__body">
          ${filterBarHtml(filters, facets)}
        </div>
      </section>
      <div data-role="list" class="grid grid--cards"></div>
      <div class="center" data-role="more"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const countBox = container.querySelector('[data-role="count"]');

  const feed = createContentFeed({
    ctx, list: listBox, more: container.querySelector('[data-role="more"]'), count: countBox,
    options: () => ({ favoritesOf: user.id, sort: 'new', ...toListOptions(filters) }),
    emptyText: () => filtersActive(filters) ? t('msg.noResults') : t('common.empty'), mark: '藏',
  });
  const refreshFacets = attachFilters(ctx, filters, facets, feed, { extra: { favoritesOf: user.id } });
  await Promise.all([refreshFacets(), feed.load(true)]);
}

export async function renderSearch(ctx) {
  const { api, container, params } = ctx;
  const lang = document.documentElement.dataset.lang;
  const query = params.q || '';
  container.innerHTML = loadingState();

  const modules = await api.modules.list();
  const filters = emptyFilters('');
  const facets = {
    modules: modules.filter((m) => m.access.visible).map((m) => ({ value: m.id, label: moduleName(m, lang) })),
    authors: [],
    tags: [],
  };

  container.innerHTML = `
    <div class="stack gap-2">
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${icon('search', 15)} ${esc(t('common.search'))} · ${esc(query || '-')}</span>
          <span class="grow"></span>
          <span class="tiny muted" data-role="count" role="status"></span>
        </div>
        <div class="panel__body">
          ${filterBarHtml(filters, facets)}
        </div>
      </section>
      <div data-role="list" class="grid grid--cards"></div>
      <div class="center" data-role="more"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const countBox = container.querySelector('[data-role="count"]');

  const feed = createContentFeed({
    ctx, list: listBox, more: container.querySelector('[data-role="more"]'), count: countBox,
    options: () => ({ q: query, sort: 'hot', ...toListOptions(filters) }),
    emptyText: () => t('msg.noResults'), mark: '寻',
  });
  const refreshFacets = attachFilters(ctx, filters, facets, feed, { extra: { q: query } });
  await Promise.all([refreshFacets(), feed.load(true)]);
}
