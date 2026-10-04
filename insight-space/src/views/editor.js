/** 新建 / 编辑内容 */

import { t } from '../core/i18n.js';
import { icon, toastOk, toastErr, emptyState } from '../core/ui.js';
import { esc, bytesText } from '../core/util.js';
import { errText } from '../data/index.js';
import { createComposer } from '../components/composer.js';
import { moduleName, moduleDesc } from '../components/widgets.js';

export async function renderEditor(ctx) {
  const { api, user, container, params } = ctx;
  const lang = document.documentElement.dataset.lang;

  if (!user) {
    container.innerHTML = emptyState(t('common.loginRequired'), '锁');
    return;
  }

  const modules = (await api.modules.list()).filter((m) => m.access.visible && m.access.write);
  if (!modules.length) {
    container.innerHTML = `<div class="banner banner--warn">${icon('alert', 17)}<div>${esc(t('common.noPermission'))} · ${esc(t('module.noAccessHint'))}</div></div>`;
    return;
  }

  let editing = null;
  if (params.id) {
    try {
      editing = await api.contents.get(params.id);
      if (!(user.role === 'superadmin' || user.role === 'owner' || editing.authorId === user.id)) throw new Error('content.onlyAuthor');
    } catch (error) {
      container.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
      return;
    }
  }

  const presetModule = params.module || editing?.moduleId || modules[0].id;
  const media = editing?.media ? editing.media.slice() : [];

  container.innerHTML = `
    <div class="stack gap-2">
      <div class="row row--between row--wrap">
        <h1 style="font-size:22px" class="mb-0">${esc(editing ? t('content.edit') : t('content.new'))}</h1>
        <a class="btn btn--ghost btn--sm" href="${editing ? `#/c/${esc(editing.id)}` : '#/'}">${icon('back', 15)} ${esc(t('common.cancel'))}</a>
      </div>

      <div class="card stack gap-2">
        <input class="input" data-role="title" placeholder="${esc(t('content.titlePh'))}" value="${esc(editing?.title || '')}"
               style="font-size:18px;font-weight:600;border:none;border-bottom:1px solid var(--line);border-radius:0;padding-left:0" />
        <div class="row row--wrap">
          <select class="select" data-role="module" style="max-width:220px">
            ${modules.map((m) => `<option value="${esc(m.id)}" ${m.id === presetModule ? 'selected' : ''}>${esc(m.icon)} ${esc(moduleName(m, lang))}</option>`).join('')}
          </select>
          <input class="input grow" data-role="tags" placeholder="${esc(t('content.tagsPh'))}" value="${esc((editing?.tags || []).join(', '))}" style="min-width:180px" />
        </div>
        <div data-role="composer"></div>
        <div class="field">
          <label class="field__label">${esc(t('content.attachments'))}</label>
          <div class="upload-drop" data-role="dropzone" tabindex="0" role="button" aria-label="${esc(t('content.dropHint'))}">
            <div class="upload-drop__icon">${icon('upload', 20)}</div>
            <div class="upload-drop__text">${esc(t('content.dropHint'))}</div>
            <div class="tiny muted">${esc(t('content.dropTypes'))}</div>
          </div>
          <div class="editor__uploads" data-role="uploads"></div>
        </div>
      </div>

      <div class="row row--wrap" style="position:sticky;bottom:12px;z-index:30">
        <div class="card row row--wrap" style="padding:10px 14px;box-shadow:var(--shadow-2)">
          <button class="btn btn--primary" data-role="publish">${icon('check', 16)} ${esc(t('content.publish'))}</button>
          <button class="btn" data-role="draft">${esc(t('content.saveDraft'))}</button>
          <span class="grow"></span>
          <span class="tiny muted" data-role="status"></span>
        </div>
      </div>
    </div>
  `;

  const composerHost = container.querySelector('[data-role="composer"]');
  const composer = createComposer({
    value: editing?.bodyMd || '',
    placeholder: t('content.bodyPh'),
    media,
  });
  composerHost.appendChild(composer.root);

  const uploadsBox = container.querySelector('[data-role="uploads"]');
  const statusBox = container.querySelector('[data-role="status"]');

  /* 附件拖拽 / 点击上传 */
  const dropzone = container.querySelector('[data-role="dropzone"]');
  const pickInput = document.createElement('input');
  pickInput.type = 'file';
  pickInput.multiple = true;
  pickInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,.rar,.7z';
  pickInput.style.display = 'none';
  container.appendChild(pickInput);

  let uploadBusy = false;
  async function addFiles(fileList) {
    if (uploadBusy) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    uploadBusy = true;
    dropzone.classList.add('is-busy');
    try {
      await composer.addFiles(files);
    } finally {
      uploadBusy = false;
      dropzone.classList.remove('is-busy');
      await renderUploads();
    }
  }

  dropzone.addEventListener('click', () => pickInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickInput.click(); }
  });
  pickInput.addEventListener('change', async () => {
    await addFiles(pickInput.files);
    pickInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-over');
  }));
  dropzone.addEventListener('dragleave', (event) => {
    if (dropzone.contains(event.relatedTarget)) return;
    dropzone.classList.remove('is-over');
  });
  dropzone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-over');
    await addFiles(event.dataTransfer?.files);
  });

  async function renderUploads() {
    if (!composer.media.length) {
      uploadsBox.innerHTML = '';
      return;
    }
    const rows = [];
    for (const item of composer.media) {
      const url = await api.media.resolve(item);
      const thumb = item.kind === 'image'
        ? `<img class="upload-item__thumb" src="${esc(url)}" alt="" />`
        : `<div class="upload-item__thumb center">${icon(item.kind === 'video' ? 'video' : item.kind === 'audio' ? 'mic' : 'file', 18)}</div>`;
      rows.push(`
        <div class="upload-item" data-media="${esc(item.url)}">
          ${thumb}
          <div class="grow">
            <div class="ellipsis">${esc(item.name || item.kind)}</div>
            <div class="tiny muted">${esc(item.kind)} · ${esc(bytesText(item.size))}</div>
          </div>
          <button class="icon-btn" type="button" data-remove="${esc(item.url)}" title="${esc(t('common.delete'))}">${icon('close', 16)}</button>
        </div>
      `);
    }
    uploadsBox.innerHTML = rows.join('');
  }

  uploadsBox.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-remove]');
    if (!btn) return;
    const index = composer.media.findIndex((m) => m.url === btn.dataset.remove);
    if (index >= 0) composer.media.splice(index, 1);
    renderUploads();
  });

  composer.root.addEventListener('media:added', renderUploads);
  await renderUploads();

  async function save(status) {
    const title = container.querySelector('[data-role="title"]').value.trim();
    const moduleId = container.querySelector('[data-role="module"]').value;
    const tags = container.querySelector('[data-role="tags"]').value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    const bodyMd = composer.getValue();
    if (!title) { toastErr(t('content.titleRequired')); return; }
    if (!bodyMd.trim() && !composer.media.length) { toastErr(t('content.bodyRequired')); return; }
    if (!moduleId) { toastErr(t('content.noModule')); return; }

    const buttons = container.querySelectorAll('[data-role="publish"], [data-role="draft"]');
    buttons.forEach((b) => { b.disabled = true; });
    statusBox.textContent = t('common.loading');
    try {
      const payload = { moduleId, title, bodyMd, tags, media: composer.media, status };
      const saved = editing
        ? await api.contents.update(editing.id, payload)
        : await api.contents.create(payload);
      toastOk(t('content.saved'));
      ctx.navigate(`#/c/${saved.id}`);
    } catch (error) {
      toastErr(errText(error));
      statusBox.textContent = '';
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  container.querySelector('[data-role="publish"]').addEventListener('click', () => save('published'));
  container.querySelector('[data-role="draft"]').addEventListener('click', () => save('draft'));

  /* Ctrl/Cmd + S 快捷保存 */
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save('published');
    }
  };
  document.addEventListener('keydown', onKey);
  ctx.onLeave(() => document.removeEventListener('keydown', onKey));
}
