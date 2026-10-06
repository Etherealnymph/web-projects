/** 列表 / 卡片 / 评论等可复用片段 */

import { t, tl } from '../core/i18n.js';
import { icon, iconFilled, avatarHtml, emptyState } from '../core/ui.js';
import { esc, fromNow, formatDate, hotScore, remainingText } from '../core/util.js';
import { excerpt, firstImage, renderMarkdown, stripMarkdown } from '../core/markdown.js';

export function moduleName(module, lang) {
  if (!module) return t('common.unknown');
  return lang === 'en' ? (module.nameEn || module.nameZh) : (module.nameZh || module.nameEn);
}

export function moduleDesc(module, lang) {
  if (!module) return '';
  return lang === 'en' ? (module.descEn || module.descZh) : (module.descZh || module.descEn);
}

export function authorName(user) {
  if (!user) return t('common.anonymous');
  return user.nickname || user.username;
}

export function roleBadge(user) {
  if (!user) return '';
  if (user.role === 'superadmin') return `<span class="badge badge--accent">${esc(t('role.short.superadmin'))}</span>`;
  if (user.role === 'owner') return `<span class="badge badge--jade">${esc(t('role.short.owner'))}</span>`;
  return '';
}

export function levelBadge(user) {
  if (!user) return '';
  const level = Number(user.level) || 1;
  return `<span class="badge badge--level" title="${esc(t('profile.level'))} ${level}">Lv ${level}</span>`;
}

/** 赞 / 踩 / 收藏 / 浏览 / 评论 */
export function reactBarHtml(targetType, entity, options = {}) {
  const counts = entity.counts || {};
  const mine = entity.mine || {};
  const id = esc(entity.id);
  const link = options.permalink ? `<a class="react react--count" href="#/c/${id}">${icon('comment', 16)}<span>${counts.comment || 0}</span></a>` : '';
  return `
    <div class="reactbar" data-reactbar data-target-type="${esc(targetType)}" data-target-id="${id}">
      <button type="button" class="react ${mine.like ? 'is-on' : ''}" data-react="like" title="${esc(t('react.like'))}">
        ${mine.like ? iconFilled('like', 16) : icon('like', 16)}<span data-count="like">${counts.like || 0}</span>
      </button>
      <button type="button" class="react ${mine.dislike ? 'is-on--down' : ''}" data-react="dislike" title="${esc(t('react.dislike'))}">
        ${mine.dislike ? iconFilled('dislike', 16) : icon('dislike', 16)}<span data-count="dislike">${counts.dislike || 0}</span>
      </button>
      <button type="button" class="react ${mine.favorite ? 'is-on--star' : ''}" data-react="favorite" title="${esc(t('react.favorite'))}">
        ${mine.favorite ? iconFilled('star', 16) : icon('star', 16)}<span data-count="favorite">${counts.favorite || 0}</span>
      </button>
      ${link || `<span class="react react--count">${icon('comment', 16)}<span data-count="comment">${counts.comment || 0}</span></span>`}
      ${options.views ? `<span class="react react--count" title="${esc(t('react.views'))}">${icon('eye', 16)}<span>${entity.views || 0}</span></span>` : ''}
      ${options.extra || ''}
    </div>
  `;
}

/** 网格卡片 */
export function contentCardHtml(item) {
  const cover = item.coverUrl || firstImage(item.bodyMd);
  const text = excerpt(item.bodyMd, 96);
  return `
    <a class="card card--link content-card" href="#/c/${esc(item.id)}">
      ${cover ? `<img class="content-card__cover" src="${esc(cover)}" alt="" loading="lazy" />` : ''}
      <div class="content-card__meta">
        <span class="badge">${esc(item.module?.icon || '')} ${esc(moduleName(item.module, document.documentElement.dataset.lang))}</span>
        <span class="tiny muted">${esc(fromNow(item.createdAt, document.documentElement.dataset.lang))}</span>
      </div>
      <h3 class="content-card__title">${esc(item.title)}</h3>
      ${text ? `<div class="content-card__excerpt clamp-2">${esc(text)}</div>` : ''}
      <div class="content-card__meta tiny muted">
        ${icon('like', 13)} ${item.counts?.like || 0}
        &nbsp;${icon('comment', 13)} ${item.counts?.comment || 0}
        &nbsp;${icon('star', 13)} ${item.counts?.favorite || 0}
        <span class="grow"></span>
        ${esc(authorName(item.author))}
      </div>
    </a>
  `;
}

/** 排行榜行 */
export function rankedItemHtml(item, index, options = {}) {
  const top = index < 3 ? 'list-item__index--top' : '';
  return `
    <div class="list-item">
      <div class="list-item__index ${top}">${index + 1}</div>
      <div class="grow">
        <a href="#/c/${esc(item.id)}" style="color:inherit"><strong>${esc(item.title)}</strong></a>
        <div class="tiny muted mt-1">
          ${esc(item.module ? moduleName(item.module, document.documentElement.dataset.lang) : '')}
          · ${esc(authorName(item.author))}
          · ${icon('like', 12)} ${item.counts?.like || 0}
          · ${icon('comment', 12)} ${item.counts?.comment || 0}
          · ${icon('star', 12)} ${item.counts?.favorite || 0}
          ${options.views ? ` · ${icon('eye', 12)} ${item.views || 0}` : ''}
        </div>
      </div>
      ${options.extra || ''}
    </div>
  `;
}

/** 评论（含二级回复） */
export function commentHtml(comment, options = {}) {
  const lang = document.documentElement.dataset.lang;
  const body = comment.bodyMd ? renderMarkdown(comment.bodyMd) : '';
  const isDeleted = comment.status === 'deleted';
  return `
    <div class="comment ${options.isReply ? 'comment--reply' : ''}" data-comment-id="${esc(comment.id)}">
      ${avatarHtml(comment.author, 'avatar--sm')}
      <div class="comment__main">
        <div class="comment__head">
          <span class="comment__author">${esc(authorName(comment.author))}</span>
          ${levelBadge(comment.author)} ${roleBadge(comment.author)}
          <span class="tiny muted">${esc(fromNow(comment.createdAt, lang))}</span>
        </div>
        ${isDeleted ? `<div class="comment__body muted">${esc(t('comment.authorDeleted'))}</div>` : `
          <div class="comment__body prose" style="font-size:14.5px">${body}</div>
          ${mediaGalleryHtml(comment.media, { compact: true })}
        `}
        <div class="comment__actions">
          ${isDeleted ? '' : reactBarHtml('comment', comment)}
          <button type="button" class="react" data-reply="${esc(comment.id)}">${icon('comment', 15)}<span>${esc(t('comment.reply'))}</span></button>
          ${options.canEdit && !isDeleted ? `<button type="button" class="react" data-edit-comment="${esc(comment.id)}">${icon('edit', 15)}<span>${esc(t('comment.edit'))}</span></button>` : ''}
          ${options.canDelete && !isDeleted ? `<button type="button" class="react" data-delete-comment="${esc(comment.id)}">${icon('trash', 15)}<span>${esc(t('comment.delete'))}</span></button>` : ''}
        </div>
        <div data-edit-slot="${esc(comment.id)}"></div>
        <div data-reply-slot="${esc(comment.id)}"></div>
      </div>
    </div>
  `;
}

export function commentTreeHtml(comments) {
  if (!comments.length) return emptyState(t('comment.empty'), '评');
  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map();
  for (const c of comments) {
    if (!c.parentId) continue;
    if (!replies.has(c.parentId)) replies.set(c.parentId, []);
    replies.get(c.parentId).push(c);
  }
  return roots.map((root) => `
    ${commentHtml(root, { canEdit: root.canEdit, canDelete: root.canDelete })}
    ${(replies.get(root.id) || []).map((reply) => commentHtml(reply, { isReply: true, canEdit: reply.canEdit, canDelete: reply.canDelete })).join('')}
  `).join('');
}

/** 问答模块的回答：默认折叠，点击展开全文 */
export function answerHtml(comment, options = {}) {
  const lang = document.documentElement.dataset.lang;
  const body = comment.bodyMd ? renderMarkdown(comment.bodyMd) : '';
  const short = excerpt(comment.bodyMd || '', 110);
  const isDeleted = comment.status === 'deleted';
  return `
    <div class="comment ${options.isReply ? 'comment--reply' : ''}" data-answer-id="${esc(comment.id)}">
      ${avatarHtml(comment.author, 'avatar--sm')}
      <div class="comment__main">
        <div class="comment__head">
          <span class="comment__author">${esc(authorName(comment.author))}</span>
          ${levelBadge(comment.author)} ${roleBadge(comment.author)}
          <span class="tiny muted">${esc(fromNow(comment.createdAt, lang))}</span>
        </div>
        ${isDeleted ? `<div class="comment__body muted">${esc(t('comment.authorDeleted'))}</div>` : `
          <div class="answer__preview muted" data-answer-preview>${esc(short) || esc(t('answer.noPreview'))}</div>
          <div class="answer__body prose" data-answer-body hidden>${body}${mediaGalleryHtml(comment.media, { compact: true })}</div>
          <button type="button" class="link tiny" data-toggle-answer="${esc(comment.id)}">${esc(t('answer.expand'))}</button>
        `}
        <div class="comment__actions" ${isDeleted ? 'hidden' : ''}>
          ${reactBarHtml('comment', comment)}
          <button type="button" class="react" data-reply="${esc(comment.id)}">${icon('comment', 15)}<span>${esc(t('comment.reply'))}</span></button>
          ${options.canEdit && !isDeleted ? `<button type="button" class="react" data-edit-comment="${esc(comment.id)}">${icon('edit', 15)}<span>${esc(t('comment.edit'))}</span></button>` : ''}
          ${options.canDelete && !isDeleted ? `<button type="button" class="react" data-delete-comment="${esc(comment.id)}">${icon('trash', 15)}<span>${esc(t('comment.delete'))}</span></button>` : ''}
        </div>
        <div data-edit-slot="${esc(comment.id)}"></div>
        <div data-reply-slot="${esc(comment.id)}"></div>
      </div>
    </div>
  `;
}

export function answerTreeHtml(comments) {
  if (!comments.length) return emptyState(t('answer.empty'), '答');
  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map();
  for (const c of comments) {
    if (!c.parentId) continue;
    if (!replies.has(c.parentId)) replies.set(c.parentId, []);
    replies.get(c.parentId).push(c);
  }
  return roots.map((root) => `
    ${answerHtml(root, { canEdit: root.canEdit, canDelete: root.canDelete })}
    ${(replies.get(root.id) || []).map((reply) => commentHtml(reply, { isReply: true, canEdit: reply.canEdit, canDelete: reply.canDelete })).join('')}
  `).join('');
}

/** 媒体画廊 */
export function mediaGalleryHtml(media, options = {}) {
  if (!media || !media.length) return '';
  const showUnresolved = options.showUnresolved ?? false;
  const items = media.map((item, index) => {
    if (item.kind === 'image') {
      return `<div class="gallery__item" data-open-media="${esc(item.url)}" data-media-kind="image"><img src="${esc(item.displayUrl || item.url)}" alt="${esc(item.name || '')}" loading="lazy" /></div>`;
    }
    if (item.kind === 'video') {
      return `<div class="gallery__item" data-open-media="${esc(item.url)}" data-media-kind="video" style="position:relative"><video src="${esc(item.displayUrl || item.url)}" muted preload="metadata"></video><span style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;background:rgba(0,0,0,.25)">${icon('play', 22)}</span></div>`;
    }
    if (item.kind === 'audio') {
      return `<div class="upload-item" style="width:100%">${icon('mic', 16)}<span class="grow ellipsis">${esc(item.name || t('content.voice'))}</span><audio class="media-audio" controls src="${esc(item.displayUrl || item.url)}"></audio></div>`;
    }
    return `<a class="file-chip" href="${esc(item.displayUrl || item.url)}" target="_blank" rel="noopener noreferrer" download>${icon('file', 17)}<span class="file-chip__name">${esc(item.name || 'file')}</span></a>`;
  }).filter(Boolean);
  if (!items.length) return '';
  return `<div class="gallery mt-2" data-gallery>${items.join('')}</div>`;
}

/** 分段排序控件 */
export function sortControl(active, options = {}) {
  const items = [
    { value: 'hot', label: t('sort.hot') },
    { value: 'new', label: t('sort.new') },
    { value: 'like', label: t('sort.like') },
    { value: 'old', label: t('sort.old') },
  ];
  return `<div class="segmented" data-sort>${items.map((item) => `<button type="button" data-value="${item.value}" class="${item.value === active ? 'is-active' : ''}">${esc(item.label)}</button>`).join('')}</div>`;
}

export function statCard(label, value, sub = '') {
  return `<div class="stat"><div class="stat__label">${esc(label)}</div><div class="stat__value">${esc(value)}</div>${sub ? `<div class="stat__sub">${esc(sub)}</div>` : ''}</div>`;
}

export function heatBadge(item) {
  const score = hotScore(item);
  if (score <= 0) return '';
  return `<span class="badge badge--warn">${icon('fire', 12)} ${score.toFixed(1)}</span>`;
}
