/** Shared, bounded query options for the local and Supabase adapters. */
export function pageOptions(options = {}, defaultLimit = 24) {
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    limit: Math.min(100, Math.max(1, Math.floor(number(options.limit, defaultLimit) || defaultLimit))),
    offset: Math.max(0, Math.floor(number(options.offset, 0))),
  };
}

export function feedOptions(options = {}) {
  const { limit, offset } = pageOptions(options);
  return {
    module_id: options.moduleId || null,
    module_ids: Array.isArray(options.moduleIds) && options.moduleIds.length ? options.moduleIds : null,
    author_id: options.authorId || null,
    favorites_of: options.favoritesOf || null,
    q: String(options.q || '').trim().slice(0, 200),
    tag: options.tag || null,
    date_from: options.dateFrom || null,
    date_to: options.dateTo || null,
    sort: ['new', 'old', 'hot', 'like'].includes(options.sort) ? options.sort : 'new',
    limit,
    offset,
  };
}

/** Do not hide a missing migration behind an empty, apparently successful feed. */
export function queryError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new Error('数据库需要升级：请先运行 supabase/migrations/20261104_performance.sql，再刷新页面。');
  }
  if (error?.code === '42501' || /not_authenticated|forbidden/.test(error?.message || '')) {
    const denied = new Error('common.noPermission');
    denied.code = 'common.noPermission';
    return denied;
  }
  return new Error(error?.message || '数据请求失败，请稍后重试。');
}

export function facetsOf(items, authors) {
  const ids = new Set(items.map((item) => item.authorId));
  return {
    authors: [...ids].map((id) => {
      const user = authors.get(id);
      return { value: id, label: user?.nickname || user?.username || '未知用户', username: user?.username || '' };
    }).sort((a, b) => a.label.localeCompare(b.label)),
    tags: [...new Set(items.flatMap((item) => item.tags || []))].sort((a, b) => String(a).localeCompare(String(b))),
  };
}
