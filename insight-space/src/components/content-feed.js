/** Bounded pages, stale-response protection, and append-only list rendering. */
import { t, tl } from '../core/i18n.js';
import { esc, mapConcurrent } from '../core/util.js';
import { firstImage } from '../core/markdown.js';
import { emptyState, loadingState, icon } from '../core/ui.js';
import { errText } from '../data/index.js';
import { contentCardHtml } from './widgets.js';

export async function resolveMediaUrls(api, items) {
  // Cards need one cover only. Resolving every video/file here costs many signed-URL requests.
  await mapConcurrent(items, 4, async (item) => {
    const cover = item.coverUrl || firstImage(item.bodyMd) || item.media?.find((media) => media.kind === 'image');
    if (!cover) return;
    try { item.coverUrl = await api.media.resolve(cover); } catch { item.coverUrl = ''; }
  });
  return items;
}

export function createContentFeed({ ctx, list, more, count = null, options, emptyText = () => t('common.empty'), mark = '文', pageSize = 12, onResult = null, initialResult = null }) {
  let version = 0;
  let offset = 0;
  let busy = false;
  let ids = new Set();
  let retryReset = true;
  const alive = () => !ctx.signal?.aborted && (ctx.isCurrent?.() ?? true);
  ctx.onLeave(() => { version += 1; });

  async function load(reset = true) {
    if (!alive() || (!reset && busy)) return;
    const request = ++version;
    const from = reset ? 0 : offset;
    const query = { ...options(), limit: pageSize, offset: from };
    busy = true;
    retryReset = reset;
    list.setAttribute('aria-busy', 'true');
    if (!ids.size) list.innerHTML = loadingState();
    more.innerHTML = `<span class="tiny muted" role="status">${esc(t('common.loading'))}</span>`;
    try {
      const firstPage = reset && from === 0 ? initialResult : null;
      initialResult = null;
      const result = firstPage || await ctx.api.contents.list(query);
      if (request !== version || !alive()) return;
      await resolveMediaUrls(ctx.api, result.items);
      if (request !== version || !alive()) return;
      if (reset) { ids = new Set(); list.innerHTML = ''; }
      const fresh = result.items.filter((item) => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
      if (fresh.length) list.insertAdjacentHTML('beforeend', fresh.map(contentCardHtml).join(''));
      if (!ids.size) list.innerHTML = emptyState(emptyText(), mark);
      offset = from + result.items.length;
      if (count) count.textContent = t('filter.count', { n: result.total });
      const hasMore = (result.hasMore ?? offset < result.total) && result.items.length > 0;
      more.innerHTML = hasMore
        ? `<button class="btn" data-role="load-more">${esc(t('common.loadMore'))} <span class="tiny muted">${ids.size} / ${result.total}</span></button>`
        : `<span class="tiny muted">${ids.size ? `${ids.size} / ${result.total}` : ''}</span>`;
      onResult?.(result, reset);
    } catch (error) {
      if (request !== version || !alive()) return;
      if (!ids.size) list.innerHTML = '';
      more.innerHTML = `<div class="banner banner--danger" role="alert">${icon('alert', 16)}<div>${esc(errText(error))}
        <div class="mt-1"><button class="btn btn--sm" data-role="retry-list">${esc(tl('重试', 'Try again'))}</button></div></div></div>`;
    } finally {
      if (request === version) { busy = false; list.removeAttribute('aria-busy'); }
    }
  }
  more.addEventListener('click', (event) => {
    if (event.target.closest('[data-role="load-more"]')) load(false);
    else if (event.target.closest('[data-role="retry-list"]')) load(retryReset);
  });
  return { load };
}
