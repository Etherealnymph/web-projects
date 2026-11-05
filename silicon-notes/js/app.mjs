import {
  TYPES,
  EVIDENCE,
  COURSES,
  HANDOFF_KEY,
  LIMITS,
  escapeHtml as html,
  markdown,
  normalizeNote,
  parseBundle,
  bundle,
  searchNotes,
  linksFor,
  newNote,
  uid,
  initialCard,
  schedule,
  synthesize,
  noteMarkdown,
  validateHandoff,
  handoffDigest,
} from './core.mjs';
import { openNotebook } from './store.mjs';

const $ = (selector) => document.querySelector(selector);
const state = {
  store: null,
  publicNotes: [],
  localNotes: [],
  drafts: [],
  cards: [],
  reflections: [],
  filter: { query: '', course: '', tag: '', scope: 'all', type: '' },
  view: 'library',
  editing: null,
  dirty: false,
  editorBusy: false,
  autoTimer: null,
  saveChain: Promise.resolve(),
  noticeTimer: null,
  compare: ['', ''],
  reviewShown: false,
  handoff: null,
  handoffError: '',
};
const DATE = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const date = (value) => DATE.format(new Date(value));
const evidence = (value) =>
  `<span class="evidence-pill ${value === 'idea' ? 'idea' : ''}">${html(EVIDENCE[value] || value)}</span>`;
const tags = (values) =>
  `<div class="tag-line">${values.map((value) => `<span class="tag">${html(value)}</span>`).join('')}</div>`;
const options = (values, selected) =>
  Object.entries(values)
    .map(
      ([key, label]) =>
        `<option value="${html(key)}"${key === selected ? ' selected' : ''}>${html(label)}</option>`,
    )
    .join('');

function notify(message) {
  const notice = $('#notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(state.noticeTimer);
  state.noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 4500);
}
function error(message) {
  const panel = $('#persistent-error');
  panel.replaceChildren();
  panel.hidden = false;
  panel.append(document.createTextNode(`未完成：${message}。编辑内容仍留在当前页面；可先导出 Markdown。`));
  const button = document.createElement('button');
  button.textContent = '已知悉';
  button.addEventListener('click', () => {
    panel.hidden = true;
  });
  panel.append(button);
}
async function attempt(action) {
  try {
    return await action();
  } catch (reason) {
    error(reason.message || String(reason));
    return null;
  }
}
function requireStore() {
  if (!state.store) throw new Error('本机书库不可用，没有保存任何内容');
  return state.store;
}
function allNotes() {
  const notes = new Map(state.publicNotes.map((note) => [note.id, { ...note, origin: 'public' }]));
  for (const note of state.localNotes) notes.set(note.id, { ...note, origin: 'local' });
  return [...notes.values()];
}
function findNote(id) {
  return allNotes().find((note) => note.id === id);
}
function recallQueue() {
  return allNotes()
    .filter((note) => note.recall.question.trim() && note.recall.answer.trim())
    .map((note) => ({ note, card: state.cards.find((card) => card.id === note.id) || initialCard(note) }))
    .filter((item) => Date.parse(item.card.due) <= Date.now())
    .sort((a, b) => a.card.due.localeCompare(b.card.due));
}
async function reloadLocal() {
  if (!state.store) return;
  const snapshot = await state.store.snapshot();
  state.localNotes = snapshot.notes;
  state.drafts = snapshot.drafts;
  state.cards = snapshot.cards;
  state.reflections = snapshot.reflections;
  renderSidebar();
}
function renderSidebar() {
  const notes = allNotes();
  const courses = [...new Set([...COURSES, ...notes.map((note) => note.course)])];
  $('#course-navigation').innerHTML =
    `<button class="course-button ${!state.filter.course ? 'active' : ''}" data-course=""><small>∑</small>全部札记<span class="count">${notes.length}</span></button>` +
    courses
      .map(
        (course, index) =>
          `<button class="course-button ${state.filter.course === course ? 'active' : ''}" data-course="${html(course)}"><small>${String(index + 1).padStart(2, '0')}</small>${html(course)}<span class="count">${notes.filter((note) => note.course === course).length}</span></button>`,
      )
      .join('');
  const tagCounts = new Map();
  for (const note of notes) for (const tag of note.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  const selectedTags = [...tagCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag);
  if (state.filter.tag && !selectedTags.includes(state.filter.tag)) selectedTags.push(state.filter.tag);
  $('#tag-navigation').innerHTML = selectedTags
    .map(
      (tag) =>
        `<button class="tag-button ${state.filter.tag === tag ? 'active' : ''}" data-tag="${html(tag)}">${html(tag)}</button>`,
    )
    .join('');
  $('#draft-count').textContent = state.drafts.length;
  $('#due-dot').hidden = recallQueue().length === 0;
  document
    .querySelectorAll('[data-scope]')
    .forEach((button) => button.classList.toggle('active', button.dataset.scope === state.filter.scope));
}
const wafer = `<div class="wafer" aria-hidden="true"><svg viewBox="0 0 250 240" fill="none"><defs><pattern id="die-grid" width="22" height="22" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="18" height="18" rx="1" stroke="currentColor" stroke-width=".5"/></pattern><clipPath id="wafer-cut"><circle cx="125" cy="108" r="86"/></clipPath></defs><circle cx="125" cy="108" r="98" stroke="currentColor" opacity=".18"/><circle cx="125" cy="108" r="86" stroke="currentColor" stroke-width=".8"/><rect x="35" y="18" width="180" height="180" fill="url(#die-grid)" clip-path="url(#wafer-cut)" opacity=".58"/><rect x="112" y="90" width="24" height="24" fill="currentColor" opacity=".75"/><path d="M124 102h50l36-26M71 155l-39 24M147 160v45" stroke="currentColor" stroke-width=".7"/><circle cx="124" cy="102" r="3" fill="#c18f61"/><path d="M6 108h28m182 0h28M125 0v16m0 184v17" stroke="currentColor" stroke-width=".5"/><text x="178" y="69" font-size="7" fill="currentColor" font-family="monospace">ONE GOOD QUESTION</text><text x="9" y="192" font-size="7" fill="currentColor" font-family="monospace">BEFORE THE SILICON</text><text x="151" y="215" font-size="7" fill="currentColor" font-family="monospace">Δ / OBSERVE</text></svg><span class="wafer-caption">A FIELD GUIDE TO THINKING IN CIRCUITS</span></div>`;
function handoffBanner() {
  if (state.handoffError)
    return `<div class="handoff-banner"><p>跨工具内容暂未接收：${html(state.handoffError)}</p><button class="button small secondary" data-action="dismiss-handoff">清除转交内容</button></div>`;
  if (!state.handoff) return '';
  return `<div class="handoff-banner"><p><strong>工作台来信</strong> · ${html(state.handoff.value.source)}<br>${html(state.handoff.value.title)}${state.handoff.accepted ? '（此内容已接收）' : ''}</p><button class="button small secondary" data-action="preview-handoff">预览转交内容 →</button></div>`;
}
function renderLibrary() {
  const notes = searchNotes(allNotes(), state.filter);
  const filterActive =
    state.filter.query ||
    state.filter.course ||
    state.filter.tag ||
    state.filter.type ||
    state.filter.scope !== 'all';
  $('#main').innerHTML =
    `${handoffBanner()}<section class="hero"><div><div class="issue-line"><span>FIELD NOTES / VOL. 01</span><span>电路 · 证据 · 灵感</span></div><h1>把电路的直觉，<br>写成可以复查的<em>证据</em>。</h1><p>读过的论文、做过的实验、尚未解开的疑问。<br>让每一个想法有出处，也让每一次失败有下一页。</p><div class="hero-actions"><button class="button" data-action="new">开始一页札记 <span>↗</span></button><a href="#ideas" class="text-button">去线索之间走走</a></div></div>${wafer}</section><div class="section-line"><div><h2>${html(state.filter.course || '案头新页')}</h2><p>${filterActive ? `筛选得到 ${notes.length} 篇` : '有出处的阅读，有边界的判断。'} ${state.filter.tag ? ' · #' + html(state.filter.tag) : ''}</p></div><div><select id="type-filter" aria-label="按笔记类型筛选"><option value="">所有记录类型</option>${options(TYPES, state.filter.type)}</select>${filterActive ? '<button class="text-button" data-action="clear-filter">清除筛选</button>' : ''}</div></div><div class="library-layout"><section class="note-list" aria-label="笔记列表">${notes.length ? notes.map((note, index) => `<button class="note-row" data-action="read" data-id="${html(note.id)}"><span class="note-index">${String(index + 1).padStart(2, '0')}</span><span><span class="note-meta"><span>${html(TYPES[note.type])}</span><span>${note.origin === 'public' ? '公开书架' : '本机书架'}${note.example ? ' · 示例' : ''}</span>${evidence(note.evidence)}</span><h3>${html(note.title)}</h3><p>${html(note.summary || note.question)}</p>${tags(note.tags.slice(0, 4))}</span><span class="arrow">↗</span></button>`).join('') : '<div class="empty"><h3>这一页还空着。</h3><p>试试另一组关键词，或从自己的一个问题开始。</p><button class="button secondary" data-action="new">写第一条记录</button></div>'}</section><aside class="library-aside"><div class="aside-card"><span class="eyebrow">FOLLOW A THREAD</span><h3>一条好的线索</h3><ul class="trace-list"><li>先把问题写清<small>对象、条件、比较与指标</small></li><li>给结论留出处<small>结果 → 来源 → 适用边界</small></li><li>为下一次验证留白<small>什么观察会改变判断？</small></li></ul><a class="text-button" href="#ideas">打开交叉线索 ↗</a></div><div class="aside-card"><span class="eyebrow">ON YOUR DESK</span><div class="count-pair"><div><strong>${state.drafts.length}</strong><span>本机草稿</span></div><div><strong>${recallQueue().length}</strong><span>待温故卡片</span></div></div><a class="text-button" href="#review">花几分钟，重新想一遍 →</a></div><p class="quote">“留下一页没被美化的过程，<br>比留下一个漂亮的数字<br>更接近理解。”<br><small class="eyebrow">— 本站写作约定</small></p></aside></div>`;
}
function renderReader(id) {
  const note = findNote(id);
  if (!note) {
    $('#main').innerHTML =
      '<div class="empty"><h3>没有找到这页札记。</h3><p>它可能是另一台设备上的本机记录，或尚未公开。</p><a class="button secondary" href="#library">回到书架</a></div>';
    return;
  }
  const links = linksFor(note, allNotes());
  $('#main').innerHTML =
    `<a href="#library" class="text-button">← 回到札记目录</a><header class="reader-header"><div class="note-meta">${html(note.course)} · ${html(TYPES[note.type])} · ${date(note.updatedAt)} ${evidence(note.evidence)}</div><h1>${html(note.title)}</h1><p class="page-lead">${html(note.summary)}</p>${tags(note.tags)}<div class="toolbar"><button class="button small" data-action="edit" data-id="${html(note.id)}">${note.origin === 'public' ? '复制到我的草稿' : '编辑本机记录'}</button><button class="button small secondary" data-action="export-md" data-id="${html(note.id)}">导出 Markdown</button><button class="text-button" data-action="compare-note" data-id="${html(note.id)}">加入并排比较</button>${note.origin === 'local' ? `<button class="text-button" data-action="delete-note" data-id="${html(note.id)}">删除本机记录</button>` : ''}</div></header>${note.example ? '<div class="example-note">示例记录 · 用于展示写作与证据组织方式，不是用户的真实设计经历。文献事实有来源；其余实验与想法不代表已经执行。</div>' : ''}<div class="reader-layout"><article><div class="prose">${markdown(note.body)}</div><section class="fact-block"><h3>结果与证据关联</h3>${
      note.observations.length
        ? note.observations
            .map((result) => {
              const source = note.sources.find((item) => item.id === result.sourceId);
              return `<div class="result-row">${evidence(result.kind)}<p>${html(result.statement)}</p><span class="inline-message">条件：${html(result.conditions || '未填写')}<br>来源：${source ? `<a href="${html(source.url || '#note=' + note.id)}" target="_blank" rel="noopener noreferrer">${html(source.label)}</a>` : '未关联来源'}</span></div>`;
            })
            .join('')
        : '<p class="inline-message">尚未记录结果。留空不等于已经完成验证。</p>'
    }</section>${note.sources.length ? `<section class="fact-block"><h3>来源与阅读范围</h3><ol class="source-list">${note.sources.map((source) => `<li>${source.url ? `<a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.label)}</a>` : html(source.label)}<small>${html(source.scope || '未说明阅读范围')}</small></li>`).join('')}</ol></section>` : ''}${note.attachments.length ? `<div class="image-grid">${note.attachments.map((file) => `<figure><img src="${html(file.data)}" alt="${html(file.caption || file.name)}"><figcaption>${html(file.caption || file.name)}</figcaption></figure>`).join('')}</div>` : ''}</article><aside class="reader-sidebar"><div class="aside-card"><span class="eyebrow">QUESTION FIRST</span><h3>这一页在问</h3><p>${html(note.question || '尚未填写问题')}</p><div class="fact-block"><h3>当前主张</h3><p>${html(note.claim || '尚未形成结论')}</p></div></div><div class="aside-card"><span class="eyebrow">BOUNDARIES</span><h3>结论到哪里为止</h3><p>${html(note.limitation || '尚未注明限制')}</p><div class="fact-block"><h3>下一步</h3><p>${html(note.nextStep || '尚未安排')}</p></div></div><div class="fact-block"><h3>相连的页</h3>${links.outgoing.map((link) => `<a class="linked-note" href="#note=${html(link.id)}">→ ${html(link.title)}</a>`).join('') || '<p class="inline-message">还没有链接。可用 [[标题]] 关联。</p>'}<h3 class="spaced">提到此页</h3>${links.backlinks.map((link) => `<a class="linked-note" href="#note=${html(link.id)}">← ${html(link.title)}</a>`).join('') || '<p class="inline-message">暂无反向链接。</p>'}${links.unresolved.length ? `<p class="inline-message">尚无对应笔记：${html(links.unresolved.join('、'))}</p>` : ''}</div></aside></div>`;
}
function field(label, name, value, kind = 'input', extra = '') {
  return `<label class="form-field ${extra}">${label}${kind === 'textarea' ? `<textarea name="${name}" rows="3">${html(value)}</textarea>` : `<input name="${name}" value="${html(value)}">`}</label>`;
}
function sourceRows(note) {
  return note.sources
    .map(
      (source, index) =>
        `<div class="record-row source-row" data-source-id="${html(source.id)}"><div class="form-grid two">${field('来源名称 / 文献标题', 'source-label', source.label)}${field('URL / DOI 链接', 'source-url', source.url)}${field('阅读范围、页码或版本', 'source-scope', source.scope, 'input', 'full')}</div><div class="row-tools"><span class="inline-message">来源 ${index + 1}</span><button type="button" class="text-button" data-action="remove-source" data-id="${html(source.id)}">移除来源</button></div></div>`,
    )
    .join('');
}
function resultRows(note) {
  return note.observations
    .map(
      (result, index) =>
        `<div class="record-row observation-row" data-result-id="${html(result.id)}"><div class="form-grid two">${field('观察或结果（保留单位与不确定性）', 'result-statement', result.statement, 'textarea', 'full')}<label class="form-field">证据类型<select name="result-kind">${options(EVIDENCE, result.kind)}</select></label><label class="form-field">关联来源<select name="result-source"><option value="">未关联</option>${note.sources.map((source) => `<option value="${html(source.id)}"${source.id === result.sourceId ? ' selected' : ''}>${html(source.label || '未命名来源')}</option>`).join('')}</select></label>${field('适用条件 / 分母 / 模型 / 版本', 'result-conditions', result.conditions, 'input', 'full')}</div><div class="row-tools"><span class="inline-message">记录 ${index + 1}</span><button type="button" class="text-button" data-action="remove-result" data-id="${html(result.id)}">移除此结果</button></div></div>`,
    )
    .join('');
}
function renderStudio() {
  if (!state.editing) {
    const recent = [...state.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    state.editing = recent ? structuredClone(recent) : newNote();
  }
  const note = state.editing;
  const courses = [...new Set([...COURSES, note.course])];
  $('#main').innerHTML =
    `<span class="eyebrow">THE WRITING DESK / PRIVATE BY DEFAULT</span><h1 class="page-title">写一页，留住一次推理。</h1><p class="page-lead">草稿自动保存在本机。“入本机书架”整理成正式记录，不会公开到互联网。公开阅读的内容请在备份与发布页单独选择。</p><div class="draft-strip"><label for="template-select">起笔模板</label><select id="template-select">${options(TYPES, note.type)}</select><button class="button small secondary" data-action="new-template">新建一页</button></div>${state.drafts.length ? `<div class="draft-strip"><label for="draft-select">草稿夹</label><select id="draft-select"><option value="">选择已有草稿…</option>${state.drafts.map((draft) => `<option value="${html(draft.id)}">${html(draft.title)} · ${date(draft.updatedAt)}</option>`).join('')}</select><button class="text-button" data-action="load-draft">打开</button>${state.drafts.some((draft) => draft.id === note.id) ? '<button class="text-button" data-action="delete-draft">删除当前草稿</button>' : ''}</div>` : ''}<form id="editor-form" class="editor-shell"><fieldset id="editor-fields"><input class="title-input" name="title" aria-label="笔记标题" placeholder="给这个问题一个名字" maxlength="160" value="${html(note.title)}"><div class="form-grid"><label class="form-field">记录类型<select name="type">${options(TYPES, note.type)}</select></label><label class="form-field">课程 / 领域<select name="course">${options(Object.fromEntries(courses.map((course) => [course, course])), note.course)}</select></label><label class="form-field">当前证据<select name="evidence">${options(EVIDENCE, note.evidence)}</select></label>${field('标签，以逗号分隔', 'tags', note.tags.join(', '), 'input', 'full')}${field('一段摘要', 'summary', note.summary, 'textarea', 'full')}</div><div class="editor-grid"><div><p class="editor-heading">MARKDOWN / $公式$ / [[双向链接]]</p><textarea id="editor-body" class="body-editor" name="body" aria-label="Markdown 正文" spellcheck="false">${html(note.body)}</textarea></div><div><p class="editor-heading">LIVE PREVIEW / 实时预览</p><div id="editor-preview" class="prose preview">${markdown(note.body)}</div></div></div><details class="details-panel" open><summary>问题、主张与适用边界</summary><div class="form-grid two">${field('研究 / 学习问题', 'question', note.question, 'textarea')}${field('当前主张；没有结果时可以留空', 'claim', note.claim, 'textarea')}${field('不确定性与外推边界', 'limitation', note.limitation, 'textarea')}${field('下一步可执行检查', 'nextStep', note.nextStep, 'textarea')}</div></details><details class="details-panel" open><summary>来源与结果：每一条结论都有落脚点</summary><div id="source-rows">${sourceRows(note)}</div><button type="button" class="text-button" data-action="add-source">＋ 添加来源</button><div id="result-rows">${resultRows(note)}</div><button type="button" class="text-button" data-action="add-result">＋ 添加结果 / 观察</button></details><details class="details-panel"><summary>温故卡片与图片附件</summary><div class="form-grid two">${field('闭卷回忆问题', 'recall-question', note.recall.question, 'textarea')}${field('核对答案', 'recall-answer', note.recall.answer, 'textarea')}</div><p class="inline-message">填写问题和答案后，入本机书架的记录会进入温故队列。每条记录 1 张卡片。</p><label class="form-field">图像附件（最多 3 张；每张原文件不超过 540 KB）<input type="file" id="attachment-file" accept="image/png,image/jpeg,image/webp"></label><div class="image-grid">${note.attachments.map((file, index) => `<figure><img src="${html(file.data)}" alt="${html(file.name)}"><figcaption>${html(file.name)} <button type="button" class="text-button" data-action="remove-attachment" data-index="${index}">移除</button></figcaption></figure>`).join('')}</div></details>${note.example ? '<div class="example-note">这份草稿来自示例。示例标记随副本保留，避免被误认为真实经历；可以新建空白记录填写自己的实际工作。</div>' : ''}</fieldset><div class="save-line"><span id="save-status" role="status">${state.dirty ? '尚有未保存修改' : '输入后自动保存草稿 · 仅在本机'}</span><div class="toolbar"><button type="button" class="button small secondary" data-action="save-draft">保存草稿</button><button type="button" class="button small secondary" data-action="export-working">导出 Markdown</button><button type="button" class="button small" data-action="publish-local">入本机书架 →</button></div></div></form>`;
}
function editorValue(name) {
  return $(`#editor-form [name="${name}"]`)?.value || '';
}
function captureEditor() {
  if (!$('#editor-form') || !state.editing) return state.editing;
  const note = { ...state.editing };
  for (const name of [
    'title',
    'type',
    'course',
    'evidence',
    'summary',
    'body',
    'question',
    'claim',
    'limitation',
    'nextStep',
  ])
    note[name] = editorValue(name);
  note.tags = editorValue('tags')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  note.recall = { question: editorValue('recall-question'), answer: editorValue('recall-answer') };
  note.sources = [...document.querySelectorAll('.source-row')].map((row) => ({
    id: row.dataset.sourceId,
    label: row.querySelector('[name="source-label"]').value,
    url: row.querySelector('[name="source-url"]').value,
    scope: row.querySelector('[name="source-scope"]').value,
  }));
  note.observations = [...document.querySelectorAll('.observation-row')].map((row) => ({
    id: row.dataset.resultId,
    statement: row.querySelector('[name="result-statement"]').value,
    kind: row.querySelector('[name="result-kind"]').value,
    sourceId: row.querySelector('[name="result-source"]').value,
    conditions: row.querySelector('[name="result-conditions"]').value,
  }));
  note.updatedAt = new Date().toISOString();
  state.editing = note;
  return note;
}
function markDirty() {
  state.dirty = true;
  const status = $('#save-status');
  if (status) status.textContent = '正在等待自动保存…';
  clearTimeout(state.autoTimer);
  state.autoTimer = setTimeout(() => attempt(() => saveDraft(false)), 700);
}
async function saveDraft(showMessage = true) {
  clearTimeout(state.autoTimer);
  const raw = captureEditor();
  if (!raw) return;
  const note = normalizeNote({ ...raw, title: raw.title.trim() || '未命名札记' });
  const version = raw.updatedAt;
  state.saveChain = state.saveChain.catch(() => {}).then(() => requireStore().put('drafts', note));
  await state.saveChain;
  if (state.editing?.id === note.id && state.editing.updatedAt === version) state.dirty = false;
  await reloadLocal();
  if ($('#save-status') && state.editing?.id === note.id)
    $('#save-status').textContent = state.dirty
      ? '仍有新修改等待保存…'
      : `草稿已存本机 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  if (showMessage) notify('草稿已保存，尚未加入书架。');
}
async function switchEditor(note) {
  if (state.dirty && state.editing) await saveDraft(false);
  clearTimeout(state.autoTimer);
  state.editing = structuredClone(note);
  state.dirty = false;
  if (location.hash === '#studio') renderStudio();
  else location.hash = '#studio';
}
async function createDraft(note) {
  if (state.dirty && state.editing) await saveDraft(false);
  const saved = await requireStore().put('drafts', normalizeNote(note));
  await reloadLocal();
  await switchEditor(saved);
  notify('已创建本机草稿，可继续补充与核对。');
}
async function publishLocal() {
  if (state.editorBusy) return;
  const note = normalizeNote(captureEditor());
  state.editorBusy = true;
  clearTimeout(state.autoTimer);
  $('#editor-fields').disabled = true;
  try {
    await state.saveChain.catch(() => {});
    await requireStore().publish(note);
    state.dirty = false;
    state.editing = null;
    await reloadLocal();
    notify('已加入本机书架。内容没有上传或公开。');
    location.hash = `#note=${encodeURIComponent(note.id)}`;
  } finally {
    state.editorBusy = false;
    if ($('#editor-fields')) $('#editor-fields').disabled = false;
  }
}
function comparisonCard(note, label) {
  if (!note) return '<div class="empty">选择一篇笔记开始。</div>';
  return `<article class="compare-card"><span class="eyebrow">THREAD ${label}</span><h2>${html(note.title)}</h2>${evidence(note.evidence)}${note.example ? '<p class="inline-message">示例记录</p>' : ''}<h3>问题</h3><p>${html(note.question || '未填写')}</p><h3>主张 / 线索</h3><p>${html(note.claim || note.summary || '尚未形成')}</p><h3>结果</h3>${note.observations.map((result) => `<p>${html(result.statement)}<br><small>${html(EVIDENCE[result.kind])} · ${html(result.conditions || '条件未填')}</small></p>`).join('') || '<p>尚无记录，不能推定已经验证。</p>'}<h3>限制</h3><p>${html(note.limitation)}</p><h3>来源</h3><p>${note.sources.length} 项 · <a class="text-button" href="#note=${html(note.id)}">回到原页核查 ↗</a></p>${tags(note.tags)}</article>`;
}
function renderIdeas() {
  const notes = allNotes();
  if (!findNote(state.compare[0])) state.compare[0] = notes[0]?.id || '';
  if (!findNote(state.compare[1]))
    state.compare[1] = notes.find((note) => note.id !== state.compare[0])?.id || '';
  const left = findNote(state.compare[0]),
    right = findNote(state.compare[1]);
  const noteOptions = Object.fromEntries(notes.map((note) => [note.id, note.title]));
  const common = left && right ? left.tags.filter((tag) => right.tags.includes(tag)) : [];
  $('#main').innerHTML =
    `<span class="eyebrow">THE SPACE BETWEEN / TRACEABLE SYNTHESIS</span><h1 class="page-title">在线索之间，留一个新问题。</h1><p class="page-lead">两页并读，把条件摊开。这里按规则整理现有字段，不调用 AI，不凭空推断实验结果。新提纲保留原页链接与修改时间。</p><div class="compare-selects"><select id="compare-left" aria-label="线索 A">${options(noteOptions, state.compare[0])}</select><span>×</span><select id="compare-right" aria-label="线索 B">${options(noteOptions, state.compare[1])}</select></div><div class="compare-grid">${comparisonCard(left, 'A')}${comparisonCard(right, 'B')}</div><div class="synthesis-panel"><h3>交叉前，先对齐。</h3><p>共同标签：${common.length ? html(common.join('、')) : '暂未发现；请先判断是否有值得比较的问题。'}<br>两条线索的模型、测量定义与证据类型并不自动等价。</p><button class="button" data-action="synthesize"${!left || !right || left.id === right.id ? ' disabled' : ''}>生成带出处的验证提纲 →</button><p class="inline-message">生成后进入草稿，由你完善问题、基线、约束和否定条件。</p></div>`;
}
function renderReview() {
  const queue = recallQueue();
  const total = allNotes().filter((note) => note.recall.question && note.recall.answer).length;
  const current = queue[0];
  $('#main').innerHTML =
    `<span class="eyebrow">RECALL, THEN RECONSIDER</span><h1 class="page-title">温故，不急着看答案。</h1><p class="page-lead">从笔记的“闭卷回忆问题”生成卡片。先想，再翻；评分会真实更新本机的下次复习时间。它是轻量间隔计划，不是学习效果评估。</p><div class="section-line"><p>${total} 张卡片 · 当前到期 ${queue.length} 张 · 本机复习 ${state.cards.reduce((sum, card) => sum + card.reviews, 0)} 次</p><button class="text-button" data-action="refresh-review">刷新到期队列</button></div>${current ? `<article class="review-card"><span class="eyebrow">${html(current.note.course)} / ${current.card.reviews ? 'REVISIT' : 'FIRST LOOK'}</span><h2>${html(current.note.recall.question)}</h2><p class="inline-message">来自 ${html(current.note.title)}${current.note.example ? ' · 示例' : ''}</p>${state.reviewShown ? `<div class="review-answer">${html(current.note.recall.answer)}</div><a class="text-button" href="#note=${html(current.note.id)}">回到原文与来源 ↗</a><div class="review-grades"><button data-action="grade" data-grade="again" data-id="${html(current.note.id)}">再想一次<small>10 分钟</small></button><button data-action="grade" data-grade="hard" data-id="${html(current.note.id)}">有些吃力<small>1 天</small></button><button data-action="grade" data-grade="good" data-id="${html(current.note.id)}">能够解释<small>${date(schedule(current.card, 'good').due)}</small></button><button data-action="grade" data-grade="easy" data-id="${html(current.note.id)}">很熟悉<small>${date(schedule(current.card, 'easy').due)}</small></button></div>` : '<button class="button secondary" data-action="reveal">翻开参考答案</button>'}</article>` : `<div class="empty"><h3>今天的页，已经翻过。</h3><p>${total ? '当前没有到期卡片。新计划已经保存在本机。' : '在笔记里填写回忆问题与答案，入本机书架后即可开始。'}</p><a class="button secondary" href="#studio">回到书写台</a></div>`}`;
}
function renderReflections() {
  const reflections = [...state.reflections].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#main').innerHTML =
    `<span class="eyebrow">MARGINALIA / A PRIVATE CORNER</span><h1 class="page-title">留白，也是一种记录。</h1><p class="page-lead">今天哪里想通了，哪里还不确定？留一句给下一次打开书本的自己。这里是本机私密随记，不是公开留言板，其他访客看不到，也不会收到消息。</p><form id="reflection-form" class="reflection-form"><label class="form-field">写给下次的自己<textarea id="reflection-body" maxlength="3000" placeholder="比如：下次比较之前，先确认两次仿真使用了同一份模型。"></textarea></label><div class="toolbar"><button class="button" type="submit">存入本机留白 →</button><span class="inline-message">不上传 · 可随备份迁移</span></div></form><div class="reflection-list">${reflections.length ? reflections.map((reflection) => `<article class="reflection"><p>${html(reflection.body)}</p><small>${date(reflection.createdAt)} · 仅本机</small><button class="text-button" data-action="delete-reflection" data-id="${html(reflection.id)}">删除</button></article>`).join('') : '<div class="empty">这一角留给尚未成篇的思考。</div>'}</div>`;
}
function renderData() {
  $('#main').innerHTML =
    `<span class="eyebrow">KEEP YOUR WORK / CHOOSE WHAT TO SHARE</span><h1 class="page-title">归档有副本，公开有选择。</h1><p class="page-lead">这是一页静态网站。公开内容来自 <code>data/library.json</code>；你的草稿、书架、温故进度和留白在此浏览器的 IndexedDB 里。清理网站数据、更换浏览器或私密模式可能失去本机内容，请定期导出。</p><div class="data-grid"><section class="data-card"><span class="eyebrow">01 / PRIVATE BACKUP</span><h2>把案头带走</h2><p>JSON 备份包含本机书架、草稿、图片、复习计划和留白。它可能含未公开内容，请自行妥善保存。</p><div class="toolbar"><button class="button" data-action="export-backup">导出本机 JSON</button><button class="button secondary" data-action="import">导入 JSON / Markdown</button></div><p class="inline-message">JSON 合并前先校验并预览；同 ID 记录会更新，失败则完整回滚。Markdown 只导入为草稿。</p><p>本机书架 ${state.localNotes.length} 篇 · 草稿 ${state.drafts.length} 篇 · 留白 ${state.reflections.length} 条</p><button class="text-button" data-action="request-persistence">请求浏览器保留本机存储</button></section><section class="data-card"><span class="eyebrow">02 / PUBLIC CATALOG</span><h2>挑选给访客的页</h2><p>只有你勾选的书架记录进入公开包，草稿、复习进度和留白不会被自动带出。公开文件会包含所选记录的正文、来源、结果、图片和回忆答案。</p><button class="button secondary" data-action="public-package">选择并预览公开目录 →</button><ol><li>导出名为 <code>library.json</code> 的目录文件。</li><li>检查内容与图片是否适合公开。</li><li>手动替换本站 <code>data/library.json</code>，再按仓库的 GitHub Pages 流程发布。</li></ol><p class="inline-message">此页面不会修改服务器文件，不会替你提交或部署。</p></section><section class="data-card"><span class="eyebrow">03 / WRITING CONTRACT</span><h2>对一条结论负责</h2><p>“想法、推导、仿真、实测、文献”表示不同证据来源，并非自动高低排名。结果应关联原始来源与条件，阴性结果和未完成步骤也有位置。</p><p>公开初始内容全部明确标注为示例；未提供用户本人经历，所以没有虚构个人设计、调试或流片故事。</p></section><section class="data-card"><span class="eyebrow">04 / NEIGHBOURING NOTEBOOKS</span><h2>借一束光，写自己的页</h2><p>参考了课程分层、学习札记和交流留白的组织思路；本站的私有实验记录、证据关联与交叉提纲为独立实现。</p><div class="sister-links"><a href="https://lossnotes.cc/CourseNotes/" target="_blank" rel="noopener noreferrer">LOSS's Notebook · 课程目录 ↗</a><a href="https://www.analog-life.com/message/" target="_blank" rel="noopener noreferrer">Analog-Life · 留言与学习交流 ↗</a><a href="https://rt2innocence.net/" target="_blank" rel="noopener noreferrer">rt2innocence · 参考入口 ↗</a></div><p class="inline-message">第三站本次访问超时，未据此编造栏目或复制内容。本站没有公开留言服务。</p></section></div>`;
}
function download(name, data, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 160);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function showModal(content, confirmAction = null) {
  $('#modal-content').innerHTML = content;
  $('#modal').showModal();
  if (confirmAction) $('#modal-confirm')?.addEventListener('click', () => attempt(confirmAction));
}
function askDelete(title, action) {
  showModal(
    `<span class="eyebrow">LOCAL RECORD</span><h2>删除${html(title)}？</h2><p>这只影响此浏览器中的记录。建议先导出备份；此操作不能在页面内撤销。</p><div class="toolbar"><button class="button secondary" id="modal-cancel">保留</button><button class="button" id="modal-confirm">确认删除</button></div>`,
    async () => {
      await action();
      $('#modal').close();
      await reloadLocal();
      route();
      notify('本机记录已删除。');
    },
  );
  $('#modal-cancel').addEventListener('click', () => $('#modal').close());
}
async function importFile(file) {
  if (!file) return;
  if (file.size > LIMITS.backup) throw new Error('导入文件超过 12 MB');
  const raw = await file.text();
  if (/\.(md|markdown)$/i.test(file.name)) {
    if (raw.length > LIMITS.body) throw new Error('Markdown 超过 80,000 字符');
    const note = newNote();
    note.title = (raw.match(/^#\s+(.+)$/m)?.[1] || file.name.replace(/\.[^.]+$/, '')).slice(0, 160);
    note.body = raw;
    showModal(
      `<h2>导入为一份私有草稿</h2><p>${html(note.title)} · ${raw.length} 字符。Markdown 的来源和结构化证据字段需在书写台补充；不会自动发布。</p><pre>${html(raw.slice(0, 2400))}${raw.length > 2400 ? '\n…（预览已截断，导入包含完整文本）' : ''}</pre><button class="button" id="modal-confirm">确认导入草稿</button>`,
      async () => {
        await requireStore().put('drafts', note);
        await reloadLocal();
        $('#modal').close();
        await switchEditor(note);
        notify('Markdown 已导入为本机草稿。');
      },
    );
    return;
  }
  const incoming = parseBundle(raw);
  const counts = ['notes', 'drafts', 'cards', 'reflections'].map((key) => incoming[key].length);
  const existing = await requireStore().snapshot();
  const conflicts = ['notes', 'drafts', 'cards', 'reflections'].reduce(
    (sum, key) =>
      sum + incoming[key].filter((record) => existing[key].some((old) => old.id === record.id)).length,
    0,
  );
  showModal(
    `<h2>合并前，核对这份备份</h2><p>书架 ${counts[0]} 篇 · 草稿 ${counts[1]} 篇 · 复习卡 ${counts[2]} 张 · 留白 ${counts[3]} 条</p><div class="publication-preview">${conflicts} 条同 ID 记录将被更新。未出现于备份的本机记录保留。四个分区在同一次事务中写入，失败会全部撤销。</div><p>文件内容通过格式、数量、来源关系与附件限制检查。此检查不验证科学结论的正确性。</p><button class="button" id="modal-confirm">确认合并到本机</button>`,
    async () => {
      await requireStore().importBundle(incoming);
      await reloadLocal();
      $('#modal').close();
      state.editing = null;
      state.dirty = false;
      route();
      notify('备份合并完成，没有公开到互联网。');
    },
  );
}
function publicPackage() {
  const notes = allNotes();
  showModal(
    `<span class="eyebrow">EXPLICIT PUBLICATION EXPORT</span><h2>选择准备公开的记录</h2><p>默认只勾选当前公开书架。勾选本机笔记会将完整正文、图片、来源、结果与回忆答案写入可分享的 JSON。草稿、留白和学习计划不包含在内。</p><div class="publish-list">${notes.map((note) => `<label class="publish-option"><input type="checkbox" name="public-note" value="${html(note.id)}"${note.origin === 'public' ? ' checked' : ''}><span>${html(note.title)}<small>${note.origin === 'public' ? '当前公开' : '本机私有'}${note.example ? ' · 示例' : ''} · ${note.attachments.length} 张图片</small></span></label>`).join('')}</div><button class="button" id="modal-confirm">预览选中内容</button>`,
    () => {
      const selectedIds = [...document.querySelectorAll('[name="public-note"]:checked')].map(
        (input) => input.value,
      );
      const selected = notes.filter((note) => selectedIds.includes(note.id));
      if (!selected.length) throw new Error('至少选择一条记录');
      const catalog = bundle({ notes: selected });
      const serialized = JSON.stringify(catalog, null, 2);
      showModal(
        `<h2>公开包预览</h2><div class="publication-preview">${selected.length} 篇 · ${(new Blob([serialized]).size / 1024).toFixed(1)} KB。下载后仍需手动替换网站 data/library.json 并发布；本页不会部署。</div><pre>${html(selected.map((note) => `${note.title}\n  ${note.summary}\n  ${note.sources.length} 个来源 · ${note.observations.length} 项结果 · ${note.attachments.length} 张图片`).join('\n\n'))}</pre><button class="button" id="modal-confirm">确认导出 library.json</button>`,
        () => {
          download('library.json', serialized);
          $('#modal').close();
          notify('公开目录已导出。请检查文件后再手动发布。');
        },
      );
    },
  );
}
async function inspectHandoff() {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return;
    const value = validateHandoff(raw);
    const digest = await handoffDigest(value);
    state.handoff = { value, digest, accepted: state.store ? await state.store.accepted(digest) : false };
  } catch (reason) {
    state.handoffError = reason.message;
  }
}
function previewHandoff() {
  if (!state.handoff) return;
  const { value, digest, accepted } = state.handoff;
  showModal(
    `<span class="eyebrow">CROSS-WORKSPACE HANDOFF / PREVIEW</span><h2>${html(value.title)}</h2><p>来自 ${html(value.source)} · ${date(value.createdAt)} · ${value.kind === 'circuit' ? '电路记录' : '札记'}</p><pre>${html(value.body)}${value.netlist ? '\n\n--- 网表 ---\n' + html(value.netlist) : ''}</pre><p>转交内容尚未成为本站笔记。确认后仅保存为本机草稿；SHA-256 摘要用于防止此浏览器重复接收。</p>${accepted ? '<div class="publication-preview">这份内容已经接收，不会再次创建草稿。</div>' : `<button class="button" id="modal-confirm"${!state.store ? ' disabled' : ''}>确认接收为草稿</button>`}`,
    accepted
      ? null
      : async () => {
          const note = newNote(value.kind === 'circuit' ? 'experiment' : 'note');
          note.title = value.title;
          // A source cannot inject raw HTML through Markdown. Fence breaking remains
          // harmless because the preview renderer always escapes plain text.
          note.body = `${value.body}${value.netlist ? '\n\n## 转交网表\n\n```spice\n' + value.netlist + '\n```' : ''}`;
          if (note.body.length > LIMITS.body)
            throw new Error('正文与网表合并后超过 80,000 字符；请先缩短内容再转交');
          note.summary = `来自 ${value.source} 的待核验记录，尚未确认运行结果。`;
          note.limitation = `转交时间 ${value.createdAt}。来源工具：${value.source}。需要核对模型、输入与运行条件。`;
          const saved = await requireStore().acceptHandoff(note, digest);
          state.handoff.accepted = true;
          $('#modal').close();
          await reloadLocal();
          if (saved) {
            await switchEditor(note);
            notify('已接收为本机草稿。不会重复接收同一内容。');
          } else notify('这份转交已接收，没有新建重复草稿。');
        },
  );
}
async function addAttachment(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('仅接受 PNG、JPEG、WebP 图片');
  if (file.size > 540000) throw new Error('图片超过 540 KB，请先压缩');
  captureEditor();
  const targetId = state.editing.id;
  if (state.editing.attachments.length >= 3) throw new Error('每篇最多 3 张图片');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (state.view !== 'studio' || state.editing?.id !== targetId)
    throw new Error('编辑页已切换，附件没有加入另一篇笔记');
  state.editing.attachments.push({ name: file.name.slice(0, 160), data, caption: '' });
  normalizeNote({ ...state.editing, title: state.editing.title || '未命名札记' });
  renderStudio();
  markDirty();
}
function route() {
  const fragment = location.hash.slice(1) || 'library';
  let view = fragment.split('=')[0];
  if (view === 'wiki') {
    let target;
    try {
      target = decodeURIComponent(fragment.slice(5));
    } catch {
      target = '';
    }
    const matched = allNotes().find((note) => note.id === target || note.title === target);
    if (matched) {
      location.hash = `#note=${encodeURIComponent(matched.id)}`;
      return;
    }
    state.filter.query = target;
    $('#search').value = target;
    location.hash = '#library';
    notify('尚未找到对应笔记；已按链接文本搜索。');
    return;
  }
  if (!['library', 'note', 'studio', 'ideas', 'review', 'reflections', 'data'].includes(view))
    view = 'library';
  state.view = view;
  document
    .querySelectorAll('[data-view]')
    .forEach((link) =>
      link.classList.toggle('active', link.dataset.view === (view === 'note' ? 'library' : view)),
    );
  if (view === 'note') {
    let id;
    try {
      id = decodeURIComponent(fragment.slice(5));
    } catch {
      id = '';
    }
    renderReader(id);
  } else if (view === 'studio') renderStudio();
  else if (view === 'ideas') renderIdeas();
  else if (view === 'review') renderReview();
  else if (view === 'reflections') renderReflections();
  else if (view === 'data') renderData();
  else renderLibrary();
  renderSidebar();
}
const actions = {
  new: () => switchEditor(newNote()),
  read: (button) => {
    location.hash = `#note=${encodeURIComponent(button.dataset.id)}`;
  },
  edit: (button) => {
    const original = findNote(button.dataset.id);
    if (!original) return;
    const note = structuredClone(original);
    if (original.origin === 'public') {
      note.id = uid();
      note.parents = [original.id];
      note.createdAt = new Date().toISOString();
      note.title = `${original.title} · 我的副本`.slice(0, 160);
    }
    return original.origin === 'public' ? createDraft(note) : switchEditor(note);
  },
  'clear-filter': () => {
    state.filter = { query: '', course: '', tag: '', scope: 'all', type: '' };
    $('#search').value = '';
    route();
  },
  'new-template': () => switchEditor(newNote($('#template-select').value)),
  'load-draft': () => {
    const note = state.drafts.find((draft) => draft.id === $('#draft-select').value);
    if (note) return switchEditor(note);
  },
  'save-draft': () => saveDraft(),
  'publish-local': publishLocal,
  'export-working': () => {
    const note = captureEditor();
    download(
      `${note.title || '未命名札记'}.md`,
      noteMarkdown({ ...note, title: note.title || '未命名札记' }),
      'text/markdown;charset=utf-8',
    );
  },
  'export-md': (button) => {
    const note = findNote(button.dataset.id);
    if (note) download(`${note.title}.md`, noteMarkdown(note), 'text/markdown;charset=utf-8');
  },
  'add-source': () => {
    captureEditor();
    if (state.editing.sources.length >= 24) throw new Error('最多 24 个来源');
    state.editing.sources.push({ id: uid('src'), label: '', url: '', scope: '' });
    renderStudio();
    markDirty();
  },
  'remove-source': (button) => {
    captureEditor();
    state.editing.sources = state.editing.sources.filter((source) => source.id !== button.dataset.id);
    for (const result of state.editing.observations)
      if (result.sourceId === button.dataset.id) result.sourceId = '';
    renderStudio();
    markDirty();
  },
  'add-result': () => {
    captureEditor();
    if (state.editing.observations.length >= 24) throw new Error('最多 24 项结果');
    state.editing.observations.push({
      id: uid('result'),
      statement: '',
      kind: state.editing.evidence,
      sourceId: '',
      conditions: '',
    });
    renderStudio();
    markDirty();
  },
  'remove-result': (button) => {
    captureEditor();
    state.editing.observations = state.editing.observations.filter(
      (result) => result.id !== button.dataset.id,
    );
    renderStudio();
    markDirty();
  },
  'remove-attachment': (button) => {
    captureEditor();
    state.editing.attachments.splice(Number(button.dataset.index), 1);
    renderStudio();
    markDirty();
  },
  'compare-note': (button) => {
    state.compare[0] = button.dataset.id;
    if (state.compare[1] === button.dataset.id) state.compare[1] = '';
    location.hash = '#ideas';
  },
  synthesize: () => createDraft(synthesize(findNote(state.compare[0]), findNote(state.compare[1]))),
  reveal: () => {
    state.reviewShown = true;
    renderReview();
  },
  'refresh-review': () => {
    state.reviewShown = false;
    renderReview();
  },
  grade: async (button) => {
    if (!state.reviewShown) return;
    const note = findNote(button.dataset.id);
    if (!note) return;
    const card = state.cards.find((item) => item.id === note.id) || initialCard(note);
    await requireStore().put('cards', schedule(card, button.dataset.grade));
    state.reviewShown = false;
    await reloadLocal();
    renderReview();
    notify('复习评分已保存，下次时间已更新。');
  },
  'delete-note': (button) =>
    askDelete('这篇本机笔记', async () => {
      await requireStore().remove('notes', button.dataset.id);
      location.hash = '#library';
    }),
  'delete-draft': () =>
    askDelete('当前草稿', async () => {
      clearTimeout(state.autoTimer);
      await state.saveChain.catch(() => {});
      await requireStore().remove('drafts', state.editing.id);
      state.editing = null;
      state.dirty = false;
    }),
  'delete-reflection': (button) =>
    askDelete('这条留白', () => requireStore().remove('reflections', button.dataset.id)),
  'export-backup': async () => {
    if (state.dirty && state.editing) await saveDraft(false);
    const snapshot = await requireStore().snapshot();
    download(
      `silicon-notes-private-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot, null, 2),
    );
    notify('已导出私有备份，请妥善保存。');
  },
  import: async () => {
    if (state.dirty && state.editing) await saveDraft(false);
    $('#import-file').click();
  },
  'public-package': publicPackage,
  'request-persistence': async () => {
    const granted = await navigator.storage?.persist?.();
    notify(
      granted
        ? '浏览器已允许持久保留。仍建议导出备份。'
        : '浏览器未授予持久保留，或不支持此功能。请定期备份。',
    );
  },
  'preview-handoff': previewHandoff,
  'dismiss-handoff': () => {
    localStorage.removeItem(HANDOFF_KEY);
    state.handoff = null;
    state.handoffError = '';
    route();
  },
};

$('#main').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled || state.editorBusy) return;
  event.preventDefault();
  if (actions[button.dataset.action]) attempt(() => actions[button.dataset.action](button));
});
$('#main').addEventListener('input', (event) => {
  if (!event.target.closest('#editor-form')) return;
  captureEditor();
  if (event.target.name === 'body') $('#editor-preview').innerHTML = markdown(state.editing.body);
  markDirty();
});
$('#main').addEventListener('change', (event) => {
  if (event.target.id === 'type-filter') {
    state.filter.type = event.target.value;
    renderLibrary();
  } else if (event.target.id === 'compare-left' || event.target.id === 'compare-right') {
    state.compare[event.target.id === 'compare-left' ? 0 : 1] = event.target.value;
    renderIdeas();
  } else if (event.target.id === 'attachment-file') attempt(() => addAttachment(event.target.files[0]));
});
$('#main').addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'reflection-form')
    attempt(async () => {
      const body = $('#reflection-body').value.trim();
      if (!body) throw new Error('请先写下一句话');
      await requireStore().put('reflections', {
        id: uid('reflection'),
        body,
        createdAt: new Date().toISOString(),
      });
      await reloadLocal();
      renderReflections();
      notify('已存入本机留白，其他访客看不到。');
    });
});
$('.sidebar').addEventListener('click', (event) => {
  const course = event.target.closest('[data-course]');
  const tag = event.target.closest('[data-tag]');
  const scope = event.target.closest('[data-scope]');
  if (course) state.filter.course = course.dataset.course;
  else if (tag) state.filter.tag = state.filter.tag === tag.dataset.tag ? '' : tag.dataset.tag;
  else if (scope) state.filter.scope = scope.dataset.scope;
  else return;
  if (location.hash === '#library' || !location.hash) route();
  else location.hash = '#library';
});
$('#search').addEventListener('input', (event) => {
  state.filter.query = event.target.value;
  if (location.hash === '#library' || !location.hash) renderLibrary();
  else location.hash = '#library';
});
$('#sidebar-toggle').addEventListener('click', () => {
  const expanded = $('#sidebar-content').classList.toggle('expanded');
  $('#sidebar-toggle').setAttribute('aria-expanded', String(expanded));
  $('#sidebar-toggle').textContent = expanded ? '收起目录 −' : '展开目录 ＋';
});
$('#theme-button').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('silicon-notes.theme', next);
  } catch {
    notify('主题已切换；浏览器不允许保存偏好。');
  }
});
$('#import-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  attempt(() => importFile(file));
});
window.addEventListener('hashchange', () => {
  route();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('beforeunload', (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === HANDOFF_KEY)
    attempt(async () => {
      state.handoff = null;
      state.handoffError = '';
      await inspectHandoff();
      if (state.view === 'library') renderLibrary();
    });
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $('#sidebar-content').classList.add('expanded');
    $('#sidebar-toggle').setAttribute('aria-expanded', 'true');
    $('#search').focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && state.view === 'studio') {
    event.preventDefault();
    attempt(() => saveDraft());
  }
});

async function initialize() {
  try {
    const theme = localStorage.getItem('silicon-notes.theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  } catch {
    /* Reading public notes does not require localStorage. */
  }
  const results = await Promise.allSettled([
    fetch('data/library.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`公开目录请求失败 (${response.status})`);
        return response.text();
      })
      .then((raw) => {
        state.publicNotes = parseBundle(raw).notes;
      }),
    openNotebook().then(async (store) => {
      state.store = store;
      await reloadLocal();
      $('#storage-status').textContent = '本机书库已就绪 · 请定期导出';
    }),
  ]);
  for (const result of results) if (result.status === 'rejected') error(result.reason.message);
  if (!state.store) $('#storage-status').textContent = '本机保存不可用 · 请导出编辑内容';
  await inspectHandoff();
  route();
}
initialize().catch((reason) => error(reason.message));
