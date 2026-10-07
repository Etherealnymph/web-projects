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

let authorListSeq = 0;

/** 作者候选项：value 供输入框联想匹配（显示名），data-id 为真正的作者 id */
function authorOptionsHtml(authors) {
  return authors.map((a) => `<option value="${esc(a.label)}" data-id="${esc(a.value)}"${a.username ? ` data-username="${esc(a.username)}"` : ''}></option>`).join('');
}

/**
 * 把作者搜索框的文字解析成作者 id：优先精确匹配显示名或用户名，其次唯一/首个包含匹配。
 * 命中后把文字规范成该作者的显示名，让"看到什么就是筛了什么"。
 */
function resolveAuthor(input, bar) {
  const text = input.value.trim();
  if (!text) { input.value = ''; return ''; }
  const options = Array.from(bar.querySelectorAll('datalist[data-role="f-author-list"] option'));
  const q = text.toLowerCase();
  const name = (o) => o.value.toLowerCase();
  const user = (o) => (o.dataset.username || '').toLowerCase();
  const hit = options.find((o) => name(o) === q || user(o) === q)
    || options.find((o) => name(o).includes(q) || user(o).includes(q));
  if (!hit) { input.value = ''; return ''; }
  input.value = hit.value;
  return hit.dataset.id || '';
}

/** facets: { modules: [{value,label}], authors: [{value,label,username}], tags: [string] } */
export function filterBarHtml(state, facets) {
  const dateOptions = DATE_PRESETS.map((preset) => ({ value: preset, label: t(`date.${preset}`) }));
  const tagOptions = facets.tags.map((tag) => ({ value: tag, label: `#${tag}` }));
  const authorListId = `f-author-list-${++authorListSeq}`;
  const authorLabel = facets.authors.find((a) => a.value === state.authorId)?.label || '';
  return `
    <div class="filters" data-role="filters" role="group" aria-label="${esc(t('filter.title'))}">
      <label class="filter">
        <span class="filter__label">${icon('folder', 13)} ${esc(t('common.module'))}</span>
        <select class="select" data-role="f-module">${optionsHtml([{ value: '', label: t('filter.allModules') }, ...facets.modules], state.moduleId)}</select>
      </label>
      <label class="filter">
        <span class="filter__label">${icon('user', 13)} ${esc(t('common.author'))}</span>
        <input class="input" type="text" data-role="f-author" list="${authorListId}" autocomplete="off"
               placeholder="${esc(t('filter.searchAuthor'))}" value="${esc(authorLabel)}" />
      </label>
      <datalist id="${authorListId}" data-role="f-author-list">${authorOptionsHtml(facets.authors)}</datalist>
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

/** 重写作者 / 标签候选项（模块作用域变化后调用），失效的选择会被清空 */
export function fillFacetSelects(root, state, facets) {
  const bar = root.querySelector('[data-role="filters"]');
  if (!bar) return;
  const authorInput = bar.querySelector('[data-role="f-author"]');
  const authorList = bar.querySelector('datalist[data-role="f-author-list"]');
  if (authorInput && authorList) {
    if (state.authorId && !facets.authors.some((a) => a.value === state.authorId)) state.authorId = '';
    authorList.innerHTML = authorOptionsHtml(facets.authors);
    authorInput.value = facets.authors.find((a) => a.value === state.authorId)?.label || '';
  }
  const tagOptions = facets.tags.map((tag) => ({ value: tag, label: `#${tag}` }));
  const node = bar.querySelector('[data-role="f-tag"]');
  if (node) {
    if (state.tag && !tagOptions.some((o) => o.value === state.tag)) state.tag = '';
    node.innerHTML = optionsHtml([{ value: '', label: t('filter.allTags') }, ...tagOptions], state.tag);
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
    state.authorId = resolveAuthor(bar.querySelector('[data-role="f-author"]'), bar);
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

  // 作者是文本输入框，回车即确认；未在表单内，需阻止默认行为并让 change 事件接手
  bar.querySelector('[data-role="f-author"]').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.target.blur();
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
    if (item.author) {
      authors.set(item.author.id, {
        value: item.author.id,
        label: item.author.nickname || item.author.username || '',
        username: item.author.username || '',
      });
    }
    for (const tag of item.tags || []) tags.add(tag);
  }
  return {
    authors: Array.from(authors.values()).sort((a, b) => a.label.localeCompare(b.label)),
    tags: Array.from(tags).sort((a, b) => a.localeCompare(b)),
  };
}
