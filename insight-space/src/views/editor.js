/** 新建 / 编辑内容 */

import { t, tl } from '../core/i18n.js';
import { icon, toast, toastOk, toastErr, emptyState } from '../core/ui.js';
import { esc, bytesText, debounce, formatDate } from '../core/util.js';
import { editorDraftKey, readEditorDraft, writeEditorDraft } from '../core/drafts.js';
import { errText } from '../data/index.js';
import { createComposer } from '../components/composer.js';
import { moduleName } from '../components/widgets.js';

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
  let members = [];
  try { members = await api.auth.listMembers(); } catch { members = []; }
  if (ctx.signal?.aborted) return;

  const presetModule = params.module || editing?.moduleId || modules[0].id;
  const media = editing?.media ? editing.media.slice() : [];

  container.innerHTML = `
    <div class="stack gap-2">
      <div class="row row--between row--wrap">
        <h1 style="font-size:22px" class="mb-0">${esc(editing ? t('content.edit') : t('content.new'))}</h1>
        <a class="btn btn--ghost btn--sm" href="${editing ? `#/c/${esc(editing.id)}` : '#/'}">${icon('back', 15)} ${esc(t('common.cancel'))}</a>
      </div>
      <div data-role="draft-notice"></div>

      <div class="card stack gap-2">
        <input class="input" data-role="title" aria-label="${esc(t('common.title'))}" maxlength="200" placeholder="${esc(t('content.titlePh'))}" value="${esc(editing?.title || '')}"
               style="font-size:18px;font-weight:600;border:none;border-bottom:1px solid var(--line);border-radius:0;padding-left:0" />
        <div class="row row--wrap">
          <select class="select" data-role="module" aria-label="${esc(t('common.module'))}" style="max-width:220px">
            ${modules.map((m) => `<option value="${esc(m.id)}" ${m.id === presetModule ? 'selected' : ''}>${esc(m.icon)} ${esc(moduleName(m, lang))}</option>`).join('')}
          </select>
          <input class="input grow" data-role="tags" aria-label="${esc(t('common.tags'))}" placeholder="${esc(t('content.tagsPh'))}" value="${esc((editing?.tags || []).join(', '))}" style="min-width:180px" />
        </div>
        <div class="field">
          <label class="field__label">${esc(t('content.visibility'))}</label>
          <div class="segmented" data-role="visibility">
            <button type="button" data-visibility="public" class="${(editing?.visibility || 'private') === 'public' ? 'is-active' : ''}">${esc(t('content.visibilityPublic'))}</button>
            <button type="button" data-visibility="private" class="${(editing?.visibility || 'private') === 'private' ? 'is-active' : ''}">${esc(t('content.visibilityPrivate'))}</button>
            <button type="button" data-visibility="selected" class="${editing?.visibility === 'selected' ? 'is-active' : ''}">${esc(t('content.visibilitySelected'))}</button>
          </div>
          <div class="field__hint">${esc(t('content.visibilityHint'))}</div>
          <div class="row row--wrap mt-1 ${editing?.visibility === 'selected' ? '' : 'hidden'}" data-role="member-list">
            ${members.filter((member) => member.id !== user.id).map((member) => `
              <label class="checkbox chip">
                <input type="checkbox" data-visible-user="${esc(member.id)}" ${(editing?.visibleUserIds || []).includes(member.id) ? 'checked' : ''} />
                <span>${esc(member.nickname)} <span class="tiny muted">@${esc(member.username)}</span></span>
              </label>
            `).join('') || `<span class="tiny muted">${esc(t('content.noMembers'))}</span>`}
          </div>
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
          <span class="tiny muted" data-role="local-status" role="status"></span>
        </div>
      </div>
      <p class="tiny muted">${esc(tl('编辑时自动保存在此浏览器。⌘ / Ctrl + S：保存；新文章先存为草稿。', 'Changes are saved automatically in this browser. ⌘ / Ctrl + S saves new articles as drafts.'))}</p>
    </div>
  `;

  const composerHost = container.querySelector('[data-role="composer"]');
  const composer = createComposer({
    api,
    value: editing?.bodyMd || '',
    placeholder: t('content.bodyPh'),
    media,
    canUpload: () => {
      const selected = modules.find((m) => m.id === container.querySelector('[data-role="module"]').value);
      return selected?.access.upload !== false;
    },
  });
  composerHost.appendChild(composer.root);
  ctx.onLeave(() => composer.destroy());

  const uploadsBox = container.querySelector('[data-role="uploads"]');
  const statusBox = container.querySelector('[data-role="status"]');
  const visibilityBox = container.querySelector('[data-role="visibility"]');
  const memberList = container.querySelector('[data-role="member-list"]');
  let visibility = editing?.visibility || 'private';
  visibilityBox.querySelectorAll('[data-visibility]').forEach((button) => button.addEventListener('click', () => {
    visibility = button.dataset.visibility;
    visibilityBox.querySelectorAll('[data-visibility]').forEach((item) => item.classList.toggle('is-active', item === button));
    memberList.classList.toggle('hidden', visibility !== 'selected');
  }));

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
    const selected = modules.find((m) => m.id === container.querySelector('[data-role="module"]').value);
    if (selected && selected.access.upload === false) {
      toastErr(t('common.noUpload'));
      return;
    }
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
    container.dispatchEvent(new Event('input'));
  });

  composer.root.addEventListener('media:added', renderUploads);
  await renderUploads();
  if (ctx.signal?.aborted) return;

  /* Local recovery is separate from publishing. It never changes server visibility. */
  const draftKey = editorDraftKey(api.mode, user.id, editing?.id || 'new');
  const localStatus = container.querySelector('[data-role="local-status"]');
  const notice = container.querySelector('[data-role="draft-notice"]');
  let submitted = false;
  let localSaveFailed = false;
  let saving = false;
  let draftStorage = null;
  try { draftStorage = window.localStorage; } catch { /* storage can be unavailable */ }
  const snapshot = () => ({
    title: container.querySelector('[data-role="title"]').value,
    moduleId: container.querySelector('[data-role="module"]').value,
    tags: container.querySelector('[data-role="tags"]').value,
    bodyMd: composer.getValue(),
    visibility,
    visibleUserIds: [...container.querySelectorAll('[data-visible-user]:checked')].map((input) => input.dataset.visibleUser),
    media: composer.media.map(({ displayUrl, ...item }) => item),
  });
  const initial = JSON.stringify(snapshot());
  let lastLocal = initial;
  const recovery = draftStorage ? readEditorDraft(draftStorage, draftKey) : null;

  function persistDraft() {
    if (submitted) return;
    const next = snapshot();
    const encoded = JSON.stringify(next);
    if (encoded === lastLocal) return;
    try {
      if (!draftStorage) throw new Error('Local storage unavailable');
      const record = writeEditorDraft(draftStorage, draftKey, next);
      localStatus.textContent = tl(`已保存在此浏览器 · ${formatDate(record.updatedAt).slice(-5)}`, `Saved in this browser · ${formatDate(record.updatedAt).slice(-5)}`);
      lastLocal = encoded;
      localSaveFailed = false;
    } catch {
      localSaveFailed = true;
      localStatus.textContent = tl('本地草稿未能保存，请使用“保存草稿”。', 'Local draft could not be saved. Please use “Save draft”.');
    }
  }
  const autosave = debounce(persistDraft, 800);
  container.addEventListener('input', autosave);
  container.addEventListener('change', autosave);
  composer.root.addEventListener('media:added', autosave);
  visibilityBox.addEventListener('click', autosave);

  if (recovery && JSON.stringify(recovery.snapshot) !== initial) {
    notice.innerHTML = `<div class="banner"><span>${icon('file', 18)}</span><div class="grow">
      <strong>${esc(tl('找到未提交的草稿', 'An unsaved draft is available'))}</strong>
      <div class="tiny muted">${esc(formatDate(recovery.updatedAt, lang))} · ${esc(tl('只保存在此浏览器', 'Stored in this browser'))}</div>
      <div class="row row--wrap mt-1"><button class="btn btn--sm btn--primary" data-role="restore-draft">${esc(tl('恢复草稿', 'Restore draft'))}</button>
      <button class="btn btn--sm" data-role="discard-draft">${esc(tl('删除旧草稿', 'Delete old draft'))}</button></div></div></div>`;
    notice.querySelector('[data-role="restore-draft"]').addEventListener('click', () => {
      const draft = recovery.snapshot;
      container.querySelector('[data-role="title"]').value = draft.title;
      container.querySelector('[data-role="tags"]').value = typeof draft.tags === 'string' ? draft.tags : '';
      if (modules.some((module) => module.id === draft.moduleId)) container.querySelector('[data-role="module"]').value = draft.moduleId;
      visibility = ['public', 'private', 'selected'].includes(draft.visibility) ? draft.visibility : 'private';
      visibilityBox.querySelectorAll('[data-visibility]').forEach((button) => button.classList.toggle('is-active', button.dataset.visibility === visibility));
      memberList.classList.toggle('hidden', visibility !== 'selected');
      memberList.querySelectorAll('[data-visible-user]').forEach((input) => { input.checked = (draft.visibleUserIds || []).includes(input.dataset.visibleUser); });
      composer.media.splice(0, composer.media.length, ...(Array.isArray(draft.media) ? draft.media : []));
      composer.setValue(draft.bodyMd);
      renderUploads();
      notice.innerHTML = '';
      persistDraft();
      toastOk(tl('草稿已恢复，可以继续编辑。', 'Draft restored. Continue editing.'));
    });
    notice.querySelector('[data-role="discard-draft"]').addEventListener('click', () => {
      try { draftStorage?.removeItem(draftKey); } catch { /* ignore */ }
      notice.innerHTML = '';
      persistDraft();
    });
  }

  const beforeUnload = (event) => {
    persistDraft();
    if (composer.busy || (localSaveFailed && JSON.stringify(snapshot()) !== initial)) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  const onHidden = () => { if (document.hidden) persistDraft(); };
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('visibilitychange', onHidden);
  ctx.onLeave(() => {
    autosave.cancel();
    persistDraft();
    window.removeEventListener('beforeunload', beforeUnload);
    document.removeEventListener('visibilitychange', onHidden);
  });

  async function save(status) {
    if (saving) return;
    if (composer.busy || uploadBusy) {
      toast(tl('请等附件上传或录音结束后再保存。', 'Finish recording or uploading before saving.'), 'info');
      return;
    }
    const title = container.querySelector('[data-role="title"]').value.trim();
    const moduleId = container.querySelector('[data-role="module"]').value;
    const tags = container.querySelector('[data-role="tags"]').value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    const bodyMd = composer.getValue();
    if (!title) { toastErr(t('content.titleRequired')); return; }
    if (!bodyMd.trim() && !composer.media.length) { toastErr(t('content.bodyRequired')); return; }
    if (!moduleId) { toastErr(t('content.noModule')); return; }

    const buttons = container.querySelectorAll('[data-role="publish"], [data-role="draft"]');
    saving = true;
    const formControls = [...container.querySelectorAll('input,textarea,select,button')].map((node) => ({ node, disabled: node.disabled }));
    formControls.forEach(({ node }) => { node.disabled = true; });
    buttons.forEach((b) => { b.disabled = true; });
    statusBox.textContent = t('common.loading');
    try {
      const visibleUserIds = Array.from(container.querySelectorAll('[data-visible-user]:checked')).map((input) => input.dataset.visibleUser);
      const payload = { moduleId, title, bodyMd, tags, media: composer.media, status, visibility, visibleUserIds };
      const saved = editing
        ? await api.contents.update(editing.id, payload)
        : await api.contents.create(payload);
      submitted = true;
      autosave.cancel();
      try { draftStorage?.removeItem(draftKey); } catch { /* ignore */ }
      toastOk(t('content.saved'));
      ctx.navigate(`#/c/${saved.id}`);
    } catch (error) {
      toastErr(errText(error));
      statusBox.textContent = '';
    } finally {
      saving = false;
      formControls.forEach(({ node, disabled }) => { node.disabled = disabled; });
    }
  }

  container.querySelector('[data-role="publish"]').addEventListener('click', () => save('published'));
  container.querySelector('[data-role="draft"]').addEventListener('click', () => save('draft'));

  /* Ctrl/Cmd + S 快捷保存 */
  const onKey = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!event.isComposing) save(editing?.status === 'published' ? 'published' : 'draft');
    }
  };
  document.addEventListener('keydown', onKey);
  ctx.onLeave(() => document.removeEventListener('keydown', onKey));
}
