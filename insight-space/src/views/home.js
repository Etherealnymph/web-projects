/** 首页 / 模块页 / 排行榜 / 收藏 / 搜索 */

import { t, tl } from '../core/i18n.js';
import { icon, emptyState, loadingState, avatarHtml } from '../core/ui.js';
import { esc, fromNow } from '../core/util.js';
import { firstImage } from '../core/markdown.js';
import { emit } from '../core/store.js';
import { createInbox } from './messages.js';
import { errText } from '../data/index.js';
import {
  contentCardHtml, rankedItemHtml, sortControl, moduleName, moduleDesc, authorName, roleBadge,
} from '../components/widgets.js';
import {
  emptyFilters, toListOptions, filterBarHtml, fillFacetSelects, wireFilterBar, facetsOf, filtersActive,
} from '../components/filters.js';

export async function resolveMediaUrls(api, items) {
  for (const item of items) {
    const cover = firstImage(item.bodyMd);
    if (cover && cover.startsWith('idb://')) item.coverUrl = await api.media.resolve(cover);
    else if (cover) item.coverUrl = cover;
    for (const media of item.media || []) {
      if (!media.displayUrl) media.displayUrl = await api.media.resolve(media);
    }
  }
  return items;
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
  await resolveMediaUrls(api, hot.items);
  await resolveMediaUrls(api, fresh.items);

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

      ${user ? `<section class="panel" data-role="inbox-panel">
        <div class="panel__head">
          <span class="panel__title">${icon('chat', 15)} ${esc(t('nav.messages'))}</span>
          <span class="grow"></span>
          <a class="tiny" href="#/msg">${esc(t('common.more'))}</a>
        </div>
        <div class="inbox inbox--embed" data-role="home-inbox"></div>
      </section>` : ''}
    </div>
  `;

  const inboxHost = container.querySelector('[data-role="home-inbox"]');
  if (inboxHost) createInbox(inboxHost, ctx).refresh(null).catch(() => {});
}

export async function renderModule(ctx) {
  const { api, user, container, params } = ctx;
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
  let offset = 0;
  const pageSize = 12;
  let all = [];
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
            <input class="input" data-role="search" placeholder="${esc(t('nav.search'))}" value="${esc(query)}" style="min-width:200px" />
          </div>
        </div>
        ${filterBarHtml(filters, facets)}
      </section>
      <div data-role="list" class="grid grid--cards"></div>
      <div class="center" data-role="more"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const moreBox = container.querySelector('[data-role="more"]');

  async function load(reset = false) {
    if (reset) { offset = 0; all = []; }
    const result = await api.contents.list({ sort, q: query, ...toListOptions(filters), limit: pageSize, offset });
    await resolveMediaUrls(api, result.items);
    all = reset ? result.items : all.concat(result.items);
    offset = all.length;
    const narrowed = Boolean(query) || filtersActive(filters, module.id);
    listBox.innerHTML = all.length
      ? all.map((item) => contentCardHtml(item)).join('')
      : emptyState(narrowed ? t('msg.noResults') : t('module.empty'), module.icon);
    moreBox.innerHTML = all.length < result.total
      ? `<button class="btn" data-role="load-more">${esc(t('common.loadMore'))} (${all.length}/${result.total})</button>`
      : `<span class="tiny muted">${all.length ? `${all.length} / ${result.total}` : ''}</span>`;
  }

  let facetScope = null;
  async function refreshFacets() {
    const scope = filters.moduleId;
    if (scope === facetScope) return;
    facetScope = scope;
    const result = await api.contents.list(scope ? { moduleIds: [scope] } : {});
    Object.assign(facets, facetsOf(result.items));
    fillFacetSelects(container, filters, facets);
  }

  container.querySelector('[data-sort]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    sort = btn.dataset.value;
    container.querySelectorAll('[data-sort] [data-value]').forEach((node) => node.classList.toggle('is-active', node === btn));
    load(true);
  });

  let timer = 0;
  container.querySelector('[data-role="search"]').addEventListener('input', (event) => {
    clearTimeout(timer);
    query = event.target.value.trim();
    timer = setTimeout(() => load(true), 320);
  });

  moreBox.addEventListener('click', (event) => {
    if (event.target.closest('[data-role="load-more"]')) load(false);
  });

  wireFilterBar(container, filters, async () => {
    await refreshFacets();
    await load(true);
  }, module.id);

  await refreshFacets();
  await load(true);
}

export async function renderRanking(ctx) {
  const { api, container } = ctx;
  container.innerHTML = loadingState();
  const modules = await api.modules.list();
  const accessible = modules.filter((m) => m.access.visible).map((m) => m.id);
  let hot = { items: [], total: 0 };
  if (accessible.length) hot = await api.contents.list({ sort: 'hot', limit: 20 });
  await resolveMediaUrls(api, hot.items);
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
            ${ranking.slice().sort((a, b) => (b.counts?.like || 0) - (a.counts?.like || 0))
              .slice(0, 20).map((item, index) => rankedItemHtml(item, index)).join('') || emptyState(t('common.empty'), '榜')}
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
          <span class="tiny muted" data-role="count"></span>
        </div>
        <div class="panel__body">
          ${filterBarHtml(filters, facets)}
        </div>
      </section>
      <div data-role="list" class="grid grid--cards"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const countBox = container.querySelector('[data-role="count"]');

  async function load() {
    const result = await api.contents.list({ favoritesOf: user.id, sort: 'new', ...toListOptions(filters) });
    await resolveMediaUrls(api, result.items);
    countBox.textContent = t('filter.count', { n: result.total });
    listBox.innerHTML = result.items.length
      ? result.items.map((item) => contentCardHtml(item)).join('')
      : emptyState(filtersActive(filters) ? t('msg.noResults') : t('common.empty'), '藏');
  }

  let facetScope = null;
  async function refreshFacets() {
    if (filters.moduleId === facetScope) return;
    facetScope = filters.moduleId;
    const result = await api.contents.list({ favoritesOf: user.id, ...(filters.moduleId ? { moduleIds: [filters.moduleId] } : {}) });
    Object.assign(facets, facetsOf(result.items));
    fillFacetSelects(container, filters, facets);
  }

  wireFilterBar(container, filters, async () => {
    await refreshFacets();
    await load();
  });

  await refreshFacets();
  await load();
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
          <span class="tiny muted" data-role="count"></span>
        </div>
        <div class="panel__body">
          ${filterBarHtml(filters, facets)}
        </div>
      </section>
      <div data-role="list" class="grid grid--cards"></div>
    </div>
  `;

  const listBox = container.querySelector('[data-role="list"]');
  const countBox = container.querySelector('[data-role="count"]');

  async function load() {
    const result = await api.contents.list({ q: query, sort: 'hot', ...toListOptions(filters) });
    await resolveMediaUrls(api, result.items);
    countBox.textContent = t('filter.count', { n: result.total });
    listBox.innerHTML = result.items.length
      ? result.items.map((item) => contentCardHtml(item)).join('')
      : emptyState(t('msg.noResults'), '寻');
  }

  let facetScope = null;
  async function refreshFacets() {
    if (filters.moduleId === facetScope) return;
    facetScope = filters.moduleId;
    const result = await api.contents.list({ q: query, ...(filters.moduleId ? { moduleIds: [filters.moduleId] } : {}) });
    Object.assign(facets, facetsOf(result.items));
    fillFacetSelects(container, filters, facets);
  }

  wireFilterBar(container, filters, async () => {
    await refreshFacets();
    await load();
  });

  await refreshFacets();
  await load();
}
