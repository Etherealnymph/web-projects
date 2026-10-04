/** 通用 UI 组件：图标、提示、模态框、气泡、灯箱 */

import { t } from './i18n.js';
import { el, esc } from './util.js';

/* ------------------------------ 图标 ------------------------------ */

const PATHS = {
  like: '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7 10.5 11.6 3a2 2 0 0 1 2.8.9l.3.7a4 4 0 0 1 .2 2.6L14 10h4.6a2 2 0 0 1 2 2.5l-1.5 6.5a2 2 0 0 1-2 1.5H7z"/>',
  dislike: '<path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z"/><path d="M17 13.5 12.4 21a2 2 0 0 1-2.8-.9l-.3-.7a4 4 0 0 1-.2-2.6L10 14H5.4a2 2 0 0 1-2-2.5L4.9 5a2 2 0 0 1 2-1.5H17z"/>',
  star: '<path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 0 1 13 4a8 8 0 0 1 8 8z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 22.4 11a2 2 0 1 1 0 4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 12 6-3.5v11L16 16z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9h.01M15 9h.01"/>',
  bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7z"/><path d="M7 12h7a4 4 0 0 1 0 8H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  strike: '<path d="M4 12h16"/><path d="M17.5 7A4.5 4.5 0 0 0 13 4h-1.5C9 4 7 5.8 7 8s1.6 3.4 4 4"/><path d="M6.5 17A4.5 4.5 0 0 0 11 20h1.5c2.5 0 4.5-1.8 4.5-4s-1.6-3.4-4-4"/>',
  h1: '<path d="M4 6v12M12 6v12M4 12h8"/><path d="M17 18v-7l-2 1.5"/>',
  h2: '<path d="M4 6v12M11 6v12M4 12h7"/><path d="M15 10a2 2 0 1 1 4 0c0 2-4 3-4 5h4"/>',
  quote: '<path d="M6 17h3l2-4V6H5v7h3z"/><path d="M16 17h3l2-4V6h-6v7h3z"/>',
  ul: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  ol: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5.5 5.5 5v4M3.5 18h2.2L4 19.6h2"/>',
  task: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="m4.5 7.5 1.5 1.5 3-3.5"/><path d="M14 7h7M14 17h7"/><rect x="3" y="13.5" width="7" height="7" rx="1.5"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 4.3l-1.5 1.5"/><path d="M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.5-1.5"/>',
  hr: '<path d="M4 12h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  back: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 21a6.4 6.4 0 0 0-2-4.7"/>',
  ticket: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/><path d="M13 5v14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  fire: '<path d="M12 22c4 0 6.5-2.7 6.5-6 0-4-3-6-5-8.5C12 6 11 4 11 2c-2 2.5-6.5 6-6.5 11 0 4 3 9 7.5 9z"/><path d="M12 22c-1.8 0-3-1.4-3-3 0-2 1.5-3 2-4.5.6 1.2 4 2.2 4 4.5 0 1.6-1.2 3-3 3z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  send: '<path d="M21 3 3 10.5l7 3 3 7z"/><path d="m10 13.5 11-10.5"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-2.8-.4L4 21l1.3-3.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  check: '<path d="m5 13 4.5 4.5L19 6.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
};

export function icon(name, size = 16, extraClass = '') {
  const path = PATHS[name] || PATHS.info;
  return `<svg class="${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function iconFilled(name, size = 16) {
  const path = PATHS[name] || PATHS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* ------------------------------ 提示条 ------------------------------ */

export function toast(message, type = 'info', timeout = 2600) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const mark = type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info';
  const node = el('div', { class: `toast toast--${type}` }, `${icon(mark, 17)}<span>${esc(message)}</span>`);
  host.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 220);
  }, timeout);
}

export const toastOk = (msg) => toast(msg, 'ok');
export const toastErr = (msg) => toast(msg, 'err');

/* ------------------------------ 模态框 ------------------------------ */

export function openModal({ title = '', body = '', footer = '', wide = false, full = false, onClose = null, className = '' } = {}) {
  const host = document.getElementById('modals');
  const backdrop = el('div', { class: 'modal-backdrop' });
  const sizeClass = full ? 'modal--full' : wide ? 'modal--wide' : '';
  const modal = el('div', { class: `modal ${sizeClass} ${className}`.trim(), role: 'dialog', 'aria-modal': 'true' });
  modal.innerHTML = `
    ${title ? `<div class="modal__head"><div class="modal__title">${esc(title)}</div><div class="grow"></div><button class="icon-btn" data-modal-close aria-label="${esc(t('common.close'))}">${icon('close', 18)}</button></div>` : ''}
    <div class="modal__body">${body}</div>
    ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
  `;
  host.appendChild(backdrop);
  host.appendChild(modal);
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    modal.classList.add('is-open');
  });

  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    backdrop.style.opacity = '0';
    modal.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); modal.remove(); }, 190);
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose(result);
  };
  const onKey = (event) => { if (event.key === 'Escape') close(null); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', () => close(null));
  modal.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', () => close(null)));
  return { root: modal, body: modal.querySelector('.modal__body'), footer: modal.querySelector('.modal__foot'), close };
}

export function confirmDialog({ title = t('msg.confirmTitle'), message = '', okText = t('common.confirm'), cancelText = t('common.cancel'), danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const handle = openModal({
      title,
      body: `<p style="margin:0">${esc(message)}</p>`,
      footer: `<button class="btn" data-role="cancel">${esc(cancelText)}</button><button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-role="ok">${esc(okText)}</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(false); } },
    });
    handle.footer.querySelector('[data-role="cancel"]').addEventListener('click', () => { settled = true; resolve(false); handle.close(); });
    handle.footer.querySelector('[data-role="ok"]').addEventListener('click', () => { settled = true; resolve(true); handle.close(); });
    setTimeout(() => handle.footer.querySelector('[data-role="ok"]')?.focus(), 60);
  });
}

export function promptDialog({ title = '', label = '', value = '', placeholder = '', type = 'text', okText = t('common.confirm'), hint = '' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const handle = openModal({
      title,
      body: `<div class="field"><label class="field__label">${esc(label)}</label><input class="input" data-role="value" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" />${hint ? `<div class="field__hint">${esc(hint)}</div>` : ''}</div>`,
      footer: `<button class="btn" data-role="cancel">${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="ok">${esc(okText)}</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(null); } },
    });
    const input = handle.body.querySelector('[data-role="value"]');
    const submit = () => { settled = true; resolve(input.value.trim()); handle.close(); };
    handle.footer.querySelector('[data-role="cancel"]').addEventListener('click', () => handle.close());
    handle.footer.querySelector('[data-role="ok"]').addEventListener('click', submit);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
    setTimeout(() => input.focus(), 60);
  });
}

/* ------------------------------ 灯箱 ------------------------------ */

export function lightbox(src, type = 'image') {
  const node = el('div', { class: 'lightbox' });
  node.innerHTML = type === 'video'
    ? `<video src="${esc(src)}" controls autoplay playsinline></video>`
    : `<img src="${esc(src)}" alt="" />`;
  const close = () => { node.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  node.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(node);
}

/* ------------------------------ 浮动面板 ------------------------------ */

export function popover(anchor, contentNode, { align = 'left', onClose = null } = {}) {
  const existing = document.querySelector('.popover');
  if (existing) existing.remove();
  const node = el('div', { class: 'popover' });
  node.appendChild(contentNode);
  anchor.parentElement.style.position = 'relative';
  anchor.parentElement.appendChild(node);
  const rect = anchor.getBoundingClientRect();
  const width = node.offsetWidth;
  node.style.left = align === 'right' ? 'auto' : '0';
  node.style.right = align === 'right' ? '0' : 'auto';
  node.style.marginTop = '6px';
  node.style.bottom = 'auto';
  if (rect.bottom + node.offsetHeight + 20 > window.innerHeight) {
    node.style.top = 'auto';
    node.style.bottom = '100%';
  } else {
    node.style.top = '100%';
  }
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    node.remove();
    document.removeEventListener('mousedown', onOutside, true);
    if (onClose) onClose();
  };
  const onOutside = (event) => { if (!node.contains(event.target) && !anchor.contains(event.target)) close(); };
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  return { node, close, width };
}

/* ------------------------------ 小部件 ------------------------------ */

export function emptyState(text = t('common.empty'), mark = '空') {
  return `<div class="empty"><div class="empty__mark">${esc(mark)}</div><div>${esc(text)}</div></div>`;
}

export function loadingState(text = t('common.loading')) {
  return `<div class="empty"><div class="spinner" style="margin:0 auto 10px"></div><div class="small">${esc(text)}</div></div>`;
}

export function avatarHtml(user, size = '') {
  const cls = `avatar ${size}`.trim();
  const name = user?.nickname || user?.username || '?';
  if (user?.avatar) return `<div class="${cls}"><img src="${esc(user.avatar)}" alt="" /></div>`;
  const text = /[\u4e00-\u9fa5]/.test(name) ? name.slice(-2) : name.slice(0, 2).toUpperCase();
  return `<div class="${cls}">${esc(text)}</div>`;
}

export function segmented(items, active, dataAttr = 'data-value') {
  return `<div class="segmented">${items.map((item) => `<button ${dataAttr}="${esc(item.value)}" class="${item.value === active ? 'is-active' : ''}">${esc(item.label)}</button>`).join('')}</div>`;
}

export function mountMenu(anchor, items) {
  const content = el('div');
  items.forEach((item) => {
    if (item.separator) { content.appendChild(el('div', { class: 'menu__sep' })); return; }
    const btn = el('button', { class: `menu__item ${item.danger ? 'menu__item--danger' : ''}` }, `${item.icon ? icon(item.icon, 15) : ''}<span>${esc(item.label)}</span>`);
    btn.addEventListener('click', () => { handle.close(); item.onClick?.(); });
    content.appendChild(btn);
  });
  const handle = popover(anchor, content, { align: 'right' });
  return handle;
}
