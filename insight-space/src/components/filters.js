/** 列表筛选条：模块 / 作者 / 日期 / 标签 */

import { t } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { icon } from '../core/ui.js';

const DATE_PRESETS = ['all', 'today', 'week', 'month', 'year', 'custom'];
const DATE_MS = 24 * 60 * 60 * 1000;

/** 空筛选状态；moduleId 为空字符串表示「全部模块」 */
export function emptyFilters(moduleId = '') {
  return { moduleId, authorId: '', datePreset: 'all', dateFrom: '', dateTo: '', tag: '' };
}

/** 日期预设 → 时间区间（ISO 字符串，null 表示不限） */
export function dateRange(preset, from = '', to = '') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let begin = null;
  let end = null;
  if (preset === 'today') begin = today;
  else if (preset === 'week') begin = new Date(today.getTime() - 6 * DATE_MS);
  else if (preset === 'month') begin = new Date(today.getTime() - 29 * DATE_MS);
  else if (preset === 'year') begin = new Date(today.getFullYear(), 0, 1);
  else if (preset === 'custom') {
    begin = from ? new Date(`${from}T00:00:00`) : null;
    end = to ? new Date(`${to}T23:59:59.999`) : null;
  }
  return { dateFrom: begin ? begin.toISOString() : null, dateTo: end ? end.toISOString() : null };
}

/** 筛选状态 → api.contents.list() 参数 */
export function toListOptions(state) {
  const options = {
    authorId: state.authorId || undefined,
    tag: state.tag || undefined,
    ...dateRange(state.datePreset, state.dateFrom, state.dateTo),
  };
  if (state.moduleId) options.moduleIds = [state.moduleId];
  return options;
}

/** 除模块限定外是否还有生效的筛选条件 */
export function filtersActive(state, baselineModuleId = '') {
  const dated = state.datePreset !== 'all'
    && (state.datePreset !== 'custom' || Boolean(state.dateFrom || state.dateTo));
  return Boolean(state.authorId || state.tag || dated
    || (state.moduleId && state.moduleId !== baselineModuleId));
}

function optionsHtml(options, value) {
  return options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}

/** facets: { modules: [{value,label}], authors: [{value,label}], tags: [string] } */
export function filterBarHtml(state, facets) {
  const dateOptions = DATE_PRESETS.map((preset) => ({ value: preset, label: t(`date.${preset}`) }));
  const tagOptions = facets.tags.map((tag) => ({ value: tag, label: `#${tag}` }));
  return `
    <div class="filters" data-role="filters" role="group" aria-label="${esc(t('filter.title'))}">
      <label class="filter">
        <span class="filter__label">${icon('folder', 13)} ${esc(t('common.module'))}</span>
        <select class="select" data-role="f-module">${optionsHtml([{ value: '', label: t('filter.allModules') }, ...facets.modules], state.moduleId)}</select>
      </label>
      <label class="filter">
        <span class="filter__label">${icon('user', 13)} ${esc(t('common.author'))}</span>
        <select class="select" data-role="f-author">${optionsHtml([{ value: '', label: t('filter.allAuthors') }, ...facets.authors], state.authorId)}</select>
      </label>
      <label class="filter">
        <span class="filter__label">${icon('calendar', 13)} ${esc(t('common.time'))}</span>
        <select class="select" data-role="f-date">${optionsHtml(dateOptions, state.datePreset)}</select>
      </label>
      <span class="filter" data-role="f-range">
        <input class="input" type="date" data-role="f-from" value="${esc(state.dateFrom)}" />
        <span class="muted">–</span>
        <input class="input" type="date" data-role="f-to" value="${esc(state.dateTo)}" />
      </span>
      <label class="filter">
        <span class="filter__label">${icon('bookmark', 13)} ${esc(t('common.tags'))}</span>
        <select class="select" data-role="f-tag">${optionsHtml([{ value: '', label: t('filter.allTags') }, ...tagOptions], state.tag)}</select>
      </label>
      <span class="grow"></span>
      <button type="button" class="btn btn--ghost btn--sm" data-role="f-reset">${icon('close', 14)} ${esc(t('filter.reset'))}</button>
    </div>
  `;
}

/** 重写作者 / 标签下拉项（模块作用域变化后调用），失效的选择会被清空 */
export function fillFacetSelects(root, state, facets) {
  const bar = root.querySelector('[data-role="filters"]');
  if (!bar) return;
  const tagOptions = facets.tags.map((tag) => ({ value: tag, label: `#${tag}` }));
  const pairs = [
    ['f-author', t('filter.allAuthors'), facets.authors, 'authorId'],
    ['f-tag', t('filter.allTags'), tagOptions, 'tag'],
  ];
  for (const [role, allLabel, options, key] of pairs) {
    const node = bar.querySelector(`[data-role="${role}"]`);
    if (!node) continue;
    if (state[key] && !options.some((o) => o.value === state[key])) state[key] = '';
    node.innerHTML = optionsHtml([{ value: '', label: allLabel }, ...options], state[key]);
  }
}

/** 绑定筛选交互；onChange 在筛选变化后调用（日期输入有防抖） */
export function wireFilterBar(root, state, onChange, baselineModuleId = '') {
  const bar = root.querySelector('[data-role="filters"]');
  if (!bar) return;
  const fromNode = bar.querySelector('[data-role="f-from"]');
  const toNode = bar.querySelector('[data-role="f-to"]');
  const rangeNode = bar.querySelector('[data-role="f-range"]');
  const resetNode = bar.querySelector('[data-role="f-reset"]');

  const sync = () => {
    rangeNode.classList.toggle('is-open', state.datePreset === 'custom');
    resetNode.hidden = !filtersActive(state, baselineModuleId);
  };

  const read = () => {
    state.moduleId = bar.querySelector('[data-role="f-module"]').value;
    state.authorId = bar.querySelector('[data-role="f-author"]').value;
    state.datePreset = bar.querySelector('[data-role="f-date"]').value;
    state.dateFrom = fromNode.value;
    state.dateTo = toNode.value;
    state.tag = bar.querySelector('[data-role="f-tag"]').value;
  };

  let timer = 0;
  const commit = (immediate) => {
    read();
    sync();
    clearTimeout(timer);
    if (immediate) onChange();
    else timer = setTimeout(onChange, 320);
  };

  bar.addEventListener('change', (event) => {
    commit(event.target !== fromNode && event.target !== toNode);
  });

  resetNode.addEventListener('click', () => {
    Object.assign(state, emptyFilters(baselineModuleId));
    bar.querySelector('[data-role="f-module"]').value = state.moduleId;
    bar.querySelector('[data-role="f-author"]').value = '';
    bar.querySelector('[data-role="f-date"]').value = 'all';
    bar.querySelector('[data-role="f-tag"]').value = '';
    fromNode.value = '';
    toNode.value = '';
    sync();
    onChange();
  });

  sync();
}

/** 从内容列表提取作者与标签候选（用于筛选下拉） */
export function facetsOf(items) {
  const authors = new Map();
  const tags = new Set();
  for (const item of items || []) {
    if (item.author) authors.set(item.author.id, item.author.nickname || item.author.username || '');
    for (const tag of item.tags || []) tags.add(tag);
  }
  return {
    authors: Array.from(authors, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
  };
}
