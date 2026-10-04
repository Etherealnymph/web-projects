/** 可复用的 Markdown 编辑器（正文 / 评论共用） */

import { t } from '../core/i18n.js';
import { icon, toast, toastErr, popover } from '../core/ui.js';
import { esc, debounce } from '../core/util.js';
import { renderMarkdown } from '../core/markdown.js';
import { getApi, errText } from '../data/index.js';
import { EMOJI_GROUPS, STICKERS } from './emoji.js';

const MAX_MB = 30;

function insertAt(textarea, before, after = '', placeholder = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = next;
  const cursor = start + before.length + selected.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

function prefixLines(textarea, prefix, numbered = false) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const next = lines.map((line, index) => (numbered ? `${index + 1}. ${line}` : `${prefix}${line}`)).join('\n');
  textarea.value = value.slice(0, lineStart) + next + value.slice(lineEnd);
  textarea.setSelectionRange(lineStart, lineStart + next.length);
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

export function createComposer(options = {}) {
  const {
    value = '',
    placeholder = '',
    compact = false,
    minHeight = compact ? 62 : 320,
    showPreview = !compact,
    media = [],
  } = options;

  const root = document.createElement('div');
  root.className = compact ? 'composer' : 'editor';
  root.innerHTML = `
    ${compact ? '<div class="avatar avatar--sm" data-role="avatar"></div>' : ''}
    <div class="${compact ? 'composer__box' : 'grow'}" style="min-width:0;display:flex;flex-direction:column;gap:8px">
      ${compact ? '' : '<div class="editor__toolbar" data-role="toolbar"></div>'}
      <div class="${compact ? '' : 'editor__split'}">
        <div class="${compact ? '' : 'editor__pane'}">
          <textarea class="${compact ? '' : 'editor__write'}" data-role="input" placeholder="${esc(placeholder)}" style="${compact ? '' : `min-height:${minHeight}px`}"></textarea>
        </div>
        <div class="${compact ? 'hidden' : 'editor__pane editor__preview prose'}" data-role="preview"></div>
      </div>
      ${compact ? `<div class="composer__foot" data-role="toolbar"></div>` : ''}
      ${compact ? '<div class="composer__preview prose hidden" data-role="preview"></div>' : ''}
    </div>
  `;

  const input = root.querySelector('[data-role="input"]');
  input.value = value;
  const preview = root.querySelector('[data-role="preview"]');
  const toolbar = root.querySelector('[data-role="toolbar"]');

  /* ------------------------------ 工具栏 ------------------------------ */

  const buttons = compact ? [
    { icon: 'smile', title: t('content.emoji'), act: 'emoji' },
    { icon: 'image', title: t('content.sticker'), act: 'sticker' },
    { icon: 'mic', title: t('content.record'), act: 'voice' },
    { icon: 'image', title: t('content.image'), act: 'image' },
    { icon: 'file', title: t('content.file'), act: 'file' },
    { icon: 'eye', title: t('common.preview'), act: 'preview' },
  ] : [
    { icon: 'bold', title: t('content.toolbar.bold'), act: 'bold' },
    { icon: 'italic', title: t('content.toolbar.italic'), act: 'italic' },
    { icon: 'strike', title: t('content.toolbar.strike'), act: 'strike' },
    { sep: true },
    { icon: 'h1', title: t('content.toolbar.h1'), act: 'h1' },
    { icon: 'h2', title: t('content.toolbar.h2'), act: 'h2' },
    { icon: 'quote', title: t('content.toolbar.quote'), act: 'quote' },
    { sep: true },
    { icon: 'ul', title: t('content.toolbar.ul'), act: 'ul' },
    { icon: 'ol', title: t('content.toolbar.ol'), act: 'ol' },
    { icon: 'task', title: t('content.toolbar.task'), act: 'task' },
    { sep: true },
    { icon: 'code', title: t('content.toolbar.code'), act: 'code' },
    { icon: 'link', title: t('content.toolbar.link'), act: 'link' },
    { icon: 'hr', title: t('content.toolbar.hr'), act: 'hr' },
    { sep: true },
    { icon: 'image', title: t('content.image'), act: 'image' },
    { icon: 'video', title: t('content.video'), act: 'video' },
    { icon: 'file', title: t('content.file'), act: 'file' },
    { icon: 'mic', title: t('content.voice'), act: 'voice' },
    { sep: true },
    { icon: 'smile', title: t('content.emoji'), act: 'emoji' },
    { icon: 'sparkles', title: t('content.sticker'), act: 'sticker' },
    { sep: true },
    { icon: 'eye', title: t('content.toolbar.preview'), act: 'preview' },
  ];

  toolbar.innerHTML = buttons.map((b) => (b.sep
    ? '<span class="editor__sep"></span>'
    : `<button type="button" class="editor__tb" data-act="${b.act}" title="${esc(b.title)}">${icon(b.icon, 16)}</button>`)).join('');

  toolbar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    handleAction(btn.dataset.act, btn);
  });

  /* ------------------------------ 预览 ------------------------------ */

  async function refreshPreview() {
    if (!preview) return;
    const text = input.value.trim();
    if (!text) { preview.innerHTML = `<p class="muted small">${esc(t('common.preview'))}…</p>`; return; }
    const api = getApiSync();
    const resolved = api ? await api.media.resolveText(text) : text;
    preview.innerHTML = renderMarkdown(resolved);
  }
  const debouncedPreview = debounce(refreshPreview, 220);
  input.addEventListener('input', () => { debouncedPreview(); });
  if (!compact) refreshPreview();

  /* ------------------------------ 动作 ------------------------------ */

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  root.appendChild(fileInput);

  function getApiSync() { return getApiInstance(); }

  async function uploadFiles(files, accept = '') {
    const api = await getApi();
    const list = Array.from(files || []);
    if (!list.length) return [];
    const added = [];
    for (const file of list) {
      if (file.size > MAX_MB * 1024 * 1024) { toastErr(t('content.tooLarge')); continue; }
      toast(t('content.uploading'), 'info', 1500);
      try {
        const ref = await api.media.upload(file);
        media.push(ref);
        added.push(ref);
        if (ref.kind === 'image') insertAt(input, `![${file.name || ''}](${ref.url})\n`);
        else if (ref.kind === 'video') insertAt(input, `::video[${ref.url}]\n`);
        else if (ref.kind === 'audio') insertAt(input, `::audio[${ref.url}]\n`);
        else insertAt(input, `::file[${ref.url}|${file.name || ''}]\n`);
      } catch (error) {
        toastErr(`${t('content.uploadFail')}：${errText(error)}`);
      }
    }
    if (added.length) root.dispatchEvent(new CustomEvent('media:added', { bubbles: true }));
    return added;
  }

  fileInput.addEventListener('change', async () => {
    if (fileInput.files?.length) await uploadFiles(Array.from(fileInput.files), fileInput.accept);
    fileInput.value = '';
  });

  let recorder = null;
  let chunks = [];

  async function toggleRecording(btn) {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { toastErr(t('msg.error')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        btn?.classList.remove('is-recording');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        await uploadFiles([file]);
      };
      recorder.start();
      btn?.classList.add('is-recording');
      toast(t('content.recording'), 'info', 2000);
    } catch {
      toastErr(t('msg.error'));
    }
  }

  function handleAction(act, btn) {
    switch (act) {
      case 'bold': insertAt(input, '**', '**', '粗体'); break;
      case 'italic': insertAt(input, '*', '*', '斜体'); break;
      case 'strike': insertAt(input, '~~', '~~', '删除线'); break;
      case 'h1': prefixLines(input, '# '); break;
      case 'h2': prefixLines(input, '## '); break;
      case 'quote': prefixLines(input, '> '); break;
      case 'ul': prefixLines(input, '- '); break;
      case 'ol': prefixLines(input, '', true); break;
      case 'task': prefixLines(input, '- [ ] '); break;
      case 'code': insertAt(input, '\n```\n', '\n```\n', '代码'); break;
      case 'link': insertAt(input, '[', '](https://)', '链接文字'); break;
      case 'hr': insertAt(input, '\n---\n'); break;
      case 'image': fileInput.accept = 'image/*'; fileInput.click(); break;
      case 'video': fileInput.accept = 'video/*'; fileInput.click(); break;
      case 'file': fileInput.accept = ''; fileInput.click(); break;
      case 'voice': toggleRecording(btn); break;
      case 'emoji': openEmojiPanel(btn); break;
      case 'sticker': openStickerPanel(btn); break;
      case 'preview': {
        if (compact) {
          preview.classList.toggle('hidden');
          if (!preview.classList.contains('hidden')) refreshPreview();
        } else {
          const pane = preview.closest('.editor__pane');
          pane.classList.toggle('hidden');
          const split = root.querySelector('.editor__split');
          if (split) split.style.gridTemplateColumns = pane.classList.contains('hidden') ? '1fr' : '';
        }
        break;
      }
      default: break;
    }
  }

  function openEmojiPanel(anchor) {
    const panel = document.createElement('div');
    const tabs = EMOJI_GROUPS.map((g, i) => `<button type="button" class="popover__tab ${i === 0 ? 'is-active' : ''}" data-group="${g.key}">${esc(g.label[document.documentElement.dataset.lang === 'en' ? 'en' : 'zh'])}</button>`).join('');
    panel.innerHTML = `<div class="popover__tabs">${tabs}</div><div class="emoji-grid" data-role="grid"></div>`;
    const grid = panel.querySelector('[data-role="grid"]');
    const draw = (key) => {
      const group = EMOJI_GROUPS.find((g) => g.key === key) || EMOJI_GROUPS[0];
      grid.innerHTML = group.items.map((item) => `<button type="button" data-emoji="${esc(item)}">${esc(item)}</button>`).join('');
    };
    draw(EMOJI_GROUPS[0].key);
    panel.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-group]');
      if (tab) {
        panel.querySelectorAll('.popover__tab').forEach((node) => node.classList.toggle('is-active', node === tab));
        draw(tab.dataset.group);
        return;
      }
      const item = event.target.closest('[data-emoji]');
      if (item) insertAt(input, item.dataset.emoji);
    });
    popover(anchor, panel);
  }

  function openStickerPanel(anchor) {
    const panel = document.createElement('div');
    panel.innerHTML = `<div class="popover__tabs"><span class="popover__tab is-active">${esc(t('content.sticker'))}</span></div>
      <div class="sticker-grid">${STICKERS.map((name) => `<button type="button" data-sticker="${esc(name)}"><img src="./assets/stickers/${esc(name)}.svg" alt="${esc(name)}" /></button>`).join('')}</div>
      <div class="field__hint mt-1">${esc(t('content.sticker'))} · <button type="button" class="btn btn--xs" data-role="upload">${esc(t('content.image'))}</button></div>`;
    panel.addEventListener('click', async (event) => {
      const item = event.target.closest('[data-sticker]');
      if (item) { insertAt(input, `::sticker[${item.dataset.sticker}]`); return; }
      if (event.target.closest('[data-role="upload"]')) {
        fileInput.accept = 'image/*';
        fileInput.onchange = async () => {
          const files = Array.from(fileInput.files || []);
          const api = await getApi();
          for (const file of files) {
            try {
              const ref = await api.media.upload(file);
              media.push(ref);
              insertAt(input, `::sticker[${ref.url}]`);
            } catch (error) { toastErr(errText(error)); }
          }
          fileInput.value = '';
          fileInput.onchange = null;
        };
        fileInput.click();
      }
    });
    popover(anchor, panel, { align: 'right' });
  }

  return {
    root,
    media,
    input,
    getValue: () => input.value,
    setValue: (next) => { input.value = next; refreshPreview(); },
    insert: (text) => insertAt(input, text),
    focus: () => input.focus(),
    refreshPreview,
    addFiles: (files) => uploadFiles(files),
    async resolveText() {
      const api = await getApi();
      return api.media.resolveText(input.value);
    },
  };
}

/** 由 main.js 注入，避免循环依赖 */
let apiInstance = null;
export function setApiInstance(api) { apiInstance = api; }
function getApiInstance() { return apiInstance; }
