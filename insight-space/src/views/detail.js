/** 内容详情：正文、附件、互动与评论 */

import { t } from '../core/i18n.js';
import { icon, avatarHtml, emptyState, loadingState, toastOk, toastErr, confirmDialog, lightbox } from '../core/ui.js';
import { esc, fromNow, formatDate } from '../core/util.js';
import { renderMarkdown } from '../core/markdown.js';
import { errText } from '../data/index.js';
import { createComposer } from '../components/composer.js';
import { mountReader } from '../components/reader.js';
import { friendActionHtml } from './messages.js';
import { reactBarHtml, commentTreeHtml, answerTreeHtml, mediaGalleryHtml, moduleName, authorName, roleBadge, levelBadge } from '../components/widgets.js';

const viewed = new Set();

export async function renderDetail(ctx) {
  const { api, user, container, params } = ctx;
  const lang = document.documentElement.dataset.lang;
  container.innerHTML = loadingState();

  let content;
  try {
    content = await api.contents.get(params.id);
  } catch (error) {
    container.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }

  if (!viewed.has(content.id)) {
    viewed.add(content.id);
    if (viewed.size > 512) viewed.delete(viewed.values().next().value);
    api.contents.view(content.id).catch(() => {});
  }

  const [resolvedBody] = await Promise.all([
    api.media.resolveText(content.bodyMd),
    Promise.all((content.media || []).map(async (media) => { media.displayUrl = await api.media.resolve(media); })),
  ]);
  if (ctx.signal?.aborted) return;
  const bodyHtml = renderMarkdown(resolvedBody);
  const canEdit = Boolean(user && (user.id === content.authorId || user.role === 'superadmin' || user.role === 'owner'));
  const canComment = content.access?.visible !== false;
  const isQA = content.module?.kind === 'qa';

  container.innerHTML = `
    <div class="stack gap-2">
      <a class="btn btn--ghost btn--sm" href="#/m/${esc(content.moduleId)}">${icon('back', 15)} ${esc(content.module ? moduleName(content.module, lang) : t('common.back'))}</a>

      <article class="card detail-article">
        <header class="stack gap-1">
          <div class="row row--wrap">
            <span class="badge badge--accent">${esc(content.module?.icon || '')} ${esc(content.module ? moduleName(content.module, lang) : '')}</span>
            ${content.status === 'draft' ? `<span class="badge badge--warn">${esc(t('common.draft'))}</span>` : ''}
            <span class="badge">${esc(t(`content.visibility${content.visibility === 'public' ? 'Public' : content.visibility === 'selected' ? 'Selected' : 'Private'}`))}</span>
            ${(content.tags || []).map((tag) => `<a class="badge" href="#/search?q=${encodeURIComponent(tag)}">#${esc(tag)}</a>`).join('')}
          </div>
          <h1 style="font-size:clamp(20px,2.6vw,28px)" class="mb-0">${esc(content.title)}</h1>
          <div class="row row--wrap">
            ${avatarHtml(content.author, 'avatar--sm')}
            <span class="small">${esc(authorName(content.author))}</span>
            ${levelBadge(content.author)} ${roleBadge(content.author)}
            ${user && content.author && user.id !== content.authorId ? '<span data-role="friend-slot"></span>' : ''}
            <span class="tiny muted">${esc(formatDate(content.createdAt, lang))}${content.updatedAt && content.updatedAt !== content.createdAt ? ` · ${esc(t('content.updatedAt'))} ${esc(fromNow(content.updatedAt, lang))}` : ''}</span>
            <span class="tiny muted">${icon('eye', 12)} ${content.views || 0}</span>
            <span class="grow"></span>
            ${canEdit ? `
              <a class="btn btn--sm" href="#/edit?id=${esc(content.id)}">${icon('edit', 15)} ${esc(t('common.edit'))}</a>
              <button class="btn btn--sm btn--danger" data-role="delete-content">${icon('trash', 15)} ${esc(t('common.delete'))}</button>
            ` : ''}
          </div>
        </header>
        <div class="divider"></div>
        <div data-role="reader-tools"></div>
        <div class="prose" data-role="body">${bodyHtml || `<p class="muted">${esc('(空)')}</p>`}</div>
        ${mediaGalleryHtml(content.media)}
        <div class="divider"></div>
        ${reactBarHtml('content', content, { views: true })}
      </article>

      <section class="card detail-comments">
        <h2 class="card__title">${icon(isQA ? 'chat' : 'comment', 16)} ${esc(t(isQA ? 'answer.title' : 'comment.title'))} <span class="muted small" data-role="comment-count"></span></h2>
        <div data-role="composer-slot"></div>
        <div data-role="comments"></div>
      </section>
    </div>
  `;
  mountReader(ctx, content);

  const composers = new Map();
  const registerComposer = (slot, composer) => {
    composers.get(slot)?.destroy();
    composers.set(slot, composer);
    return composer;
  };
  const clearComposer = (slot) => { composers.get(slot)?.destroy(); composers.delete(slot); slot.innerHTML = ''; };
  ctx.onLeave(() => { composers.forEach((composer) => composer.destroy()); composers.clear(); });

  /* 媒体点击放大 */
  /* 作者好友状态 */
  const friendSlot = container.querySelector('[data-role="friend-slot"]');
  if (friendSlot) {
    api.friends.relation(content.authorId).then((relation) => {
      if (!ctx.signal?.aborted) friendSlot.innerHTML = friendActionHtml(relation, content.authorId);
    }).catch(() => {});
  }

  /* 正文内的图片 / 视频点击放大 */
  container.querySelector('[data-role="body"]')?.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (img) { lightbox(img.src, 'image'); return; }
    const video = event.target.closest('video');
    if (video && !video.hasAttribute('controls')) lightbox(video.src, 'video');
  });

  /* 删除内容 */
  container.querySelector('[data-role="delete-content"]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ message: t('content.confirmDelete'), danger: true, okText: t('common.delete') });
    if (!ok) return;
    try {
      await api.contents.remove(content.id);
      toastOk(t('content.deleted'));
      ctx.navigate(`#/m/${content.moduleId}`);
    } catch (error) { toastErr(errText(error)); }
  });

  /* 评论 */
  const commentsBox = container.querySelector('[data-role="comments"]');
  const composerSlot = container.querySelector('[data-role="composer-slot"]');
  const countBox = container.querySelector('[data-role="comment-count"]');
  let commentVersion = 0;

  async function reloadComments() {
    const request = ++commentVersion;
    try {
      const comments = await api.comments.list(content.id);
      if (ctx.signal?.aborted || request !== commentVersion) return;
      for (const [slot, composer] of composers) {
        if (commentsBox.contains(slot)) { composer.destroy(); composers.delete(slot); }
      }
      countBox.textContent = `· ${comments.length}`;
      commentsBox.innerHTML = isQA ? answerTreeHtml(comments) : commentTreeHtml(comments);
      bindCommentActions(comments);
    } catch (error) {
      if (!ctx.signal?.aborted && request === commentVersion) commentsBox.innerHTML = `<div class="banner banner--danger" role="alert">${esc(errText(error))}</div>`;
    }
  }

  function bindCommentActions(comments) {
    commentsBox.querySelectorAll('[data-reply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.reply;
        const slot = commentsBox.querySelector(`[data-reply-slot="${id}"]`);
        if (!slot) return;
        if (slot.dataset.open === '1') { clearComposer(slot); slot.dataset.open = '0'; return; }
        slot.dataset.open = '1';
        slot.innerHTML = '';
        const target = comments.find((c) => c.id === id);
        mountCommentComposer(slot, {
          parentId: target?.parentId || id,
          placeholder: `${t('comment.replyTo')} ${authorName(target?.author)}…`,
          focus: true,
        });
      });
    });
    commentsBox.querySelectorAll('[data-delete-comment]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ message: t('comment.confirmDelete'), danger: true, okText: t('common.delete') });
        if (!ok) return;
        try {
          await api.comments.remove(btn.dataset.deleteComment);
          toastOk(t('comment.deleted'));
          reloadComments();
        } catch (error) { toastErr(errText(error)); }
      });
    });
    commentsBox.querySelectorAll('[data-edit-comment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editComment;
        const slot = commentsBox.querySelector(`[data-edit-slot="${id}"]`);
        if (!slot) return;
        if (slot.dataset.open === '1') { clearComposer(slot); slot.dataset.open = '0'; return; }
        const target = comments.find((c) => c.id === id);
        if (!target) return;
        slot.dataset.open = '1';
        slot.innerHTML = '';
        mountCommentEditor(slot, target);
      });
    });
    commentsBox.querySelectorAll('[data-toggle-answer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggleAnswer;
        const wrap = commentsBox.querySelector(`[data-answer-id="${id}"]`);
        if (!wrap) return;
        const preview = wrap.querySelector('[data-answer-preview]');
        const body = wrap.querySelector('[data-answer-body]');
        const expanded = !body.hidden;
        body.hidden = expanded;
        if (preview) preview.hidden = !expanded;
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = t(expanded ? 'answer.expand' : 'answer.collapse');
      });
    });
  }

  function mountCommentEditor(slot, comment) {
    const composer = registerComposer(slot, createComposer({
      api,
      compact: true,
      placeholder: t('comment.editPh'),
      minHeight: 62,
      value: comment.bodyMd || '',
      media: (comment.media || []).slice(),
      canUpload: () => content.access?.upload !== false,
    }));
    composer.root.querySelector('[data-role="avatar"]').outerHTML = avatarHtml(user, 'avatar--sm');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary btn--sm';
    saveBtn.type = 'button';
    saveBtn.textContent = t('comment.save');
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost btn--sm';
    cancelBtn.type = 'button';
    cancelBtn.textContent = t('comment.cancelEdit');
    composer.root.querySelector('[data-role="toolbar"]').appendChild(cancelBtn);
    composer.root.querySelector('[data-role="toolbar"]').appendChild(saveBtn);
    saveBtn.addEventListener('click', async () => {
      const text = composer.getValue().trim();
      if ((!text && !composer.media.length) || composer.busy || saveBtn.disabled) return;
      saveBtn.disabled = true;
      try {
        await api.comments.update(comment.id, { bodyMd: text, media: composer.media });
        toastOk(t('comment.updated'));
        clearComposer(slot);
        slot.dataset.open = '0';
        reloadComments();
      } catch (error) {
        toastErr(errText(error));
      } finally {
        saveBtn.disabled = false;
      }
    });
    cancelBtn.addEventListener('click', () => {
      clearComposer(slot);
      slot.dataset.open = '0';
    });
    slot.appendChild(composer.root);
    composer.focus();
  }

  function mountCommentComposer(slot, options = {}) {
    const composer = registerComposer(slot, createComposer({
      api,
      compact: true,
      placeholder: options.placeholder || t(isQA ? 'answer.ph' : 'comment.ph'),
      minHeight: 62,
      canUpload: () => content.access?.upload !== false,
    }));
    composer.root.querySelector('[data-role="avatar"]').outerHTML = avatarHtml(user, 'avatar--sm');
    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn--primary btn--sm';
    sendBtn.type = 'button';
    sendBtn.textContent = t(isQA ? 'answer.send' : 'comment.send');
    composer.root.querySelector('[data-role="toolbar"]').appendChild(sendBtn);
    sendBtn.addEventListener('click', async () => {
      const text = composer.getValue().trim();
      if ((!text && !composer.media.length) || composer.busy || sendBtn.disabled) return;
      sendBtn.disabled = true;
      try {
        await api.comments.create({ contentId: content.id, parentId: options.parentId || null, bodyMd: text, media: composer.media });
        toastOk(t(isQA ? 'answer.sendOk' : 'comment.sendOk'));
        if (options.onDone) options.onDone();
        else if (options.parentId) clearComposer(slot);
        else { clearComposer(composerSlot); mountCommentComposer(composerSlot); }
        reloadComments();
      } catch (error) {
        toastErr(errText(error));
      } finally {
        sendBtn.disabled = false;
      }
    });
    slot.appendChild(composer.root);
    if (options.focus) composer.focus();
  }

  if (!user) {
    composerSlot.innerHTML = `<div class="banner"><span>${icon('info', 17)}</span><div>${esc(t('comment.mustLogin'))} <a href="#/login">${esc(t('nav.login'))}</a></div></div>`;
  } else if (canComment) {
    mountCommentComposer(composerSlot);
  } else {
    composerSlot.innerHTML = `<div class="banner banner--warn"><span>${icon('alert', 17)}</span><div>${esc(t('module.noAccess'))}</div></div>`;
  }

  await reloadComments();
}
