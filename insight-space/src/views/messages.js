/** 信息中心：好友、好友请求与私聊 */

import { t } from '../core/i18n.js';
import { icon, avatarHtml, emptyState, loadingState, toast, toastOk, toastErr, confirmDialog, openModal } from '../core/ui.js';
import { esc, fromNow } from '../core/util.js';
import { renderMarkdown } from '../core/markdown.js';
import { errText } from '../data/index.js';
import { emit } from '../core/store.js';
import { createComposer } from '../components/composer.js';
import { authorName, mediaGalleryHtml } from '../components/widgets.js';

export async function renderMessages(ctx) {
  const { container, params } = ctx;
  container.innerHTML = `
    <div class="stack gap-2">
      <div class="row row--between row--wrap">
        <div>
          <h1 style="font-size:22px" class="mb-0">${icon('chat', 18)} ${esc(t('msg.title'))}</h1>
          <div class="tiny muted">${esc(t('msg.subtitle'))}</div>
        </div>
        <button class="btn btn--sm btn--primary" data-role="add-friend">${icon('plus', 15)} ${esc(t('friend.add'))}</button>
      </div>
      <div class="card inbox" data-role="inbox"></div>
    </div>
  `;
  const inbox = createInbox(container.querySelector('[data-role="inbox"]'), ctx);
  container.querySelector('[data-role="add-friend"]')
    .addEventListener('click', () => openAddFriend(ctx, () => inbox.refresh(inbox.peerId)));
  await inbox.refresh(params.id || null);
}

export function createInbox(root, ctx) {
  const { api } = ctx;
  let peerId = null;
  let tab = 'friends';
  let threads = [];
  let requests = [];
  let outgoing = [];
  let chat = null;

  root.innerHTML = `
    <aside class="inbox__side">
      <div class="inbox__tabs">
        <button type="button" data-tab="friends" class="is-active">${esc(t('friend.title'))}<span class="badge hidden" data-badge="friends"></span></button>
        <button type="button" data-tab="requests">${esc(t('friend.requests'))}<span class="badge hidden" data-badge="requests"></span></button>
      </div>
      <div class="inbox__list" data-role="list"></div>
    </aside>
    <section class="inbox__main" data-role="main"></section>
  `;
  const listEl = root.querySelector('[data-role="list"]');
  const mainEl = root.querySelector('[data-role="main"]');

  root.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    tab = btn.dataset.tab;
    root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('is-active', x === btn));
    renderList();
  }));

  function plain(md) {
    return String(md || '')
      .replace(/::(video|audio|file|sticker)\[[^\]]*\]/g, ' [媒体] ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' [图片] ')
      .replace(/[#*>`_~-]/g, '')
      .trim()
      .slice(0, 42);
  }

  /* ---------------- 列表 ---------------- */

  function threadRowHtml(item) {
    const preview = item.last
      ? `${item.last.fromId === ctx.user.id ? `${t('msg.you')}: ` : ''}${plain(item.last.bodyMd) || `[${t('content.attachments')}]`}`
      : t('msg.threadEmpty');
    return `<button type="button" class="friend-row${item.user.id === peerId ? ' is-active' : ''}" data-peer="${esc(item.user.id)}">
      ${avatarHtml(item.user, 'avatar--sm')}
      <span class="friend-row__body">
        <span class="friend-row__name">${esc(authorName(item.user))}</span>
        <span class="friend-row__preview">${esc(preview)}</span>
      </span>
      ${item.unread ? `<span class="badge badge--accent">${item.unread}</span>` : ''}
    </button>`;
  }

  function requestRowHtml(item) {
    return `<div class="friend-row friend-row--static">
      ${avatarHtml(item.user, 'avatar--sm')}
      <span class="friend-row__body">
        <span class="friend-row__name">${esc(authorName(item.user))}</span>
        <span class="friend-row__preview">${esc(item.note || fromNow(item.createdAt))}</span>
      </span>
      <button class="btn btn--xs btn--primary" data-accept="${esc(item.id)}">${esc(t('friend.accept'))}</button>
      <button class="btn btn--xs" data-decline="${esc(item.id)}">${esc(t('friend.decline'))}</button>
    </div>`;
  }

  function outgoingRowHtml(item) {
    return `<div class="friend-row friend-row--static">
      ${avatarHtml(item.user, 'avatar--sm')}
      <span class="friend-row__body">
        <span class="friend-row__name">${esc(authorName(item.user))}</span>
        <span class="friend-row__preview">${esc(t('friend.pendingOut'))}</span>
      </span>
    </div>`;
  }

  function renderList() {
    if (tab === 'requests') {
      const rows = [];
      if (requests.length) rows.push(`<div class="inbox__label">${esc(t('friend.requests'))}</div>`, ...requests.map(requestRowHtml));
      if (outgoing.length) rows.push(`<div class="inbox__label">${esc(t('friend.outgoing'))}</div>`, ...outgoing.map(outgoingRowHtml));
      listEl.innerHTML = rows.length ? rows.join('') : `<div class="tiny muted inbox__hint">${esc(t('friend.noRequests'))}</div>`;
      return;
    }
    listEl.innerHTML = threads.length
      ? threads.map(threadRowHtml).join('')
      : `<div class="tiny muted inbox__hint">${esc(t('friend.noFriends'))}</div>`;
  }

  /* ---------------- 事件 ---------------- */

  function setBadge(name, count) {
    const node = root.querySelector(`[data-badge="${name}"]`);
    if (!node) return;
    node.textContent = count > 99 ? '99+' : String(count);
    node.classList.toggle('hidden', !count);
  }

  listEl.addEventListener('click', async (event) => {
    const accept = event.target.closest('[data-accept]');
    if (accept) {
      accept.disabled = true;
      try {
        await api.friends.accept(accept.dataset.accept);
        toastOk(t('friend.accepted'));
        emit('social:changed');
        await refresh(peerId);
      } catch (error) { accept.disabled = false; toastErr(errText(error)); }
      return;
    }
    const decline = event.target.closest('[data-decline]');
    if (decline) {
      decline.disabled = true;
      try {
        await api.friends.decline(decline.dataset.decline);
        toastOk(t('friend.declined'));
        emit('social:changed');
        await refresh(peerId);
      } catch (error) { decline.disabled = false; toastErr(errText(error)); }
      return;
    }
    const peer = event.target.closest('[data-peer]');
    if (peer) await openChat(peer.dataset.peer);
  });

  /* ---------------- 会话 ---------------- */

  function renderMain() {
    if (!peerId) {
      mainEl.innerHTML = `<div class="inbox__placeholder">${emptyState(t('msg.pickPeer'), '✉')}</div>`;
      return;
    }
    const item = threads.find((x) => x.user.id === peerId);
    if (!item) {
      mainEl.innerHTML = `<div class="inbox__placeholder">${emptyState(t('msg.noFriend'), '✉')}</div>`;
      return;
    }
    const peer = item.user;
    mainEl.innerHTML = `
      <header class="chat__head">
        ${avatarHtml(peer, 'avatar--sm')}
        <div class="grow" style="min-width:0">
          <div class="friend-row__name">${esc(authorName(peer))}</div>
          <div class="tiny muted">@${esc(peer.username)}</div>
        </div>
        <button class="icon-btn" type="button" data-role="remove-friend" title="${esc(t('friend.remove'))}">${icon('trash', 16)}</button>
      </header>
      <div class="chat__body" data-role="messages"></div>
      <div class="chat__foot" data-role="composer"></div>
    `;
    mainEl.querySelector('[data-role="remove-friend"]').addEventListener('click', async () => {
      const ok = await confirmDialog({ message: t('friend.removeConfirm'), danger: true, okText: t('friend.remove') });
      if (!ok) return;
      try {
        await api.friends.remove(peerId);
        toastOk(t('friend.removed'));
        emit('social:changed');
        peerId = null;
        await refresh(null);
      } catch (error) { toastErr(errText(error)); }
    });

    chat = createComposer({ compact: true, placeholder: t('msg.placeholder') });
    mainEl.querySelector('[data-role="composer"]').appendChild(chat.root);
    chat.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'btn btn--primary btn--sm';
    sendBtn.innerHTML = `${icon('send', 15)} ${esc(t('msg.send'))}`;
    sendBtn.addEventListener('click', sendMessage);
    chat.root.appendChild(sendBtn);
    renderMessagesList();
  }

  async function renderMessagesList() {
    const box = mainEl.querySelector('[data-role="messages"]');
    if (!box) return;
    box.innerHTML = loadingState();
    let rows = [];
    try {
      rows = await api.messages.list(peerId, { limit: 200 });
    } catch (error) {
      box.innerHTML = `<div class="tiny muted inbox__hint">${esc(errText(error))}</div>`;
      return;
    }
    if (!rows.length) {
      box.innerHTML = `<div class="tiny muted inbox__hint">${esc(t('msg.threadEmpty'))}</div>`;
      return;
    }
    const parts = [];
    for (const message of rows) {
      const mine = message.fromId === ctx.user.id;
      const media = message.media || [];
      for (const item of media) item.displayUrl = await api.media.resolve(item);
      const body = message.bodyMd ? renderMarkdown(await api.media.resolveText(message.bodyMd)) : '';
      parts.push(`<div class="bubble ${mine ? 'bubble--mine' : ''}">
        <div class="bubble__body prose">${body}</div>
        ${mediaGalleryHtml(media)}
        <div class="bubble__meta tiny muted">${mine ? esc(t('msg.you')) : ''} ${esc(fromNow(message.createdAt))}</div>
      </div>`);
    }
    box.innerHTML = parts.join('');
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage() {
    if (!chat || !peerId) return;
    const bodyMd = chat.getValue().trim();
    const media = chat.media || [];
    if (!bodyMd && !media.length) { toastErr(t('msg.empty')); return; }
    const btn = chat.root.querySelector('button.btn--primary');
    if (btn) btn.disabled = true;
    try {
      await api.messages.send(peerId, { bodyMd, media });
      chat.setValue('');
      chat.media.length = 0;
      const item = threads.find((x) => x.user.id === peerId);
      if (item) item.last = { bodyMd, media: [], createdAt: new Date().toISOString(), fromId: ctx.user.id };
      emit('social:changed');
      await renderMessagesList();
      renderList();
    } catch (error) {
      toastErr(errText(error));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function openChat(id) {
    peerId = id;
    renderList();
    renderMain();
    try {
      await api.messages.markRead(id);
      const item = threads.find((x) => x.user.id === id);
      if (item) item.unread = 0;
      setBadge('friends', threads.reduce((sum, x) => sum + (x.unread || 0), 0));
      renderList();
      emit('social:changed');
    } catch { /* 标记已读失败不影响阅读 */ }
  }

  async function refresh(nextPeerId = null) {
    try {
      [threads, requests, outgoing] = await Promise.all([
        api.messages.threads(),
        api.friends.requests(),
        api.friends.outgoing(),
      ]);
    } catch (error) {
      listEl.innerHTML = `<div class="tiny muted inbox__hint">${esc(errText(error))}</div>`;
      return;
    }
    peerId = nextPeerId || (threads.some((x) => x.user.id === peerId) ? peerId : null);
    setBadge('friends', threads.reduce((sum, x) => sum + (x.unread || 0), 0));
    setBadge('requests', requests.length);
    renderList();
    renderMain();
    if (peerId) { try { await api.messages.markRead(peerId); } catch { /* ignore */ } }
  }

  return { refresh, get peerId() { return peerId; } };
}

/* ---------------- 加好友 ---------------- */

function searchRowHtml(row) {
  const user = row.user;
  let action = '';
  if (row.relation === 'none') action = `<button type="button" class="btn btn--xs btn--primary" data-send="${esc(user.id)}">${esc(t('friend.send'))}</button>`;
  else if (row.relation === 'pending_out') action = `<span class="tiny muted">${esc(t('friend.pendingOut'))}</span>`;
  else if (row.relation === 'pending_in') action = `<span class="tiny muted">${esc(t('friend.pendingIn'))}</span>`;
  else if (row.relation === 'accepted') action = `<a class="btn btn--xs" href="#/msg/${esc(user.id)}">${esc(t('friend.chat'))}</a>`;
  return `<div class="friend-row friend-row--static">
    ${avatarHtml(user, 'avatar--sm')}
    <span class="friend-row__body">
      <span class="friend-row__name">${esc(authorName(user))}</span>
      <span class="friend-row__preview">@${esc(user.username)}</span>
    </span>
    ${action}
  </div>`;
}

export function friendActionHtml(relation, userId) {
  const id = esc(userId);
  if (relation === 'accepted') return `<a class="btn btn--sm" href="#/msg/${id}">${icon('chat', 15)} ${esc(t('friend.chat'))}</a>`;
  if (relation === 'pending_out') return `<button type="button" class="btn btn--sm" disabled>${icon('clock', 15)} ${esc(t('friend.pendingOut'))}</button>`;
  if (relation === 'pending_in') return `<a class="btn btn--sm btn--primary" href="#/msg">${icon('check', 15)} ${esc(t('friend.accept'))}</a>`;
  return `<button type="button" class="btn btn--sm btn--primary" data-role="add-friend" data-user="${id}">${icon('plus', 15)} ${esc(t('friend.add'))}</button>`;
}

export async function openAddFriend(ctx, onChanged) {
  const handle = openModal({
    title: t('friend.addTitle'),
    body: `<div class="stack gap-1">
      <input class="input" data-role="q" placeholder="${esc(t('friend.searchPh'))}" />
      <div data-role="results"><div class="tiny muted">${esc(t('friend.searchPh'))}</div></div>
    </div>`,
  });
  const qEl = handle.body.querySelector('[data-role="q"]');
  const results = handle.body.querySelector('[data-role="results"]');
  let timer = 0;

  async function run() {
    const q = qEl.value.trim();
    if (!q) { results.innerHTML = `<div class="tiny muted">${esc(t('friend.searchPh'))}</div>`; return; }
    results.innerHTML = loadingState();
    try {
      const rows = await ctx.api.friends.search(q);
      results.innerHTML = rows.length
        ? `<div class="stack gap-1">${rows.map(searchRowHtml).join('')}</div>`
        : `<div class="tiny muted">${esc(t('friend.searchEmpty'))}</div>`;
    } catch (error) {
      results.innerHTML = `<div class="tiny muted">${esc(errText(error))}</div>`;
    }
  }

  qEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 280); });
  qEl.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); run(); } });

  results.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-send]');
    if (!btn) return;
    btn.disabled = true;
    try {
      const state = await ctx.api.friends.request(btn.dataset.send, '');
      toastOk(state === 'accepted' ? t('friend.accepted') : t('friend.requested'));
      emit('social:changed');
      if (onChanged) await onChanged();
      handle.close();
    } catch (error) {
      btn.disabled = false;
      toastErr(errText(error));
    }
  });
  qEl.focus();
}

export async function openFriendRequest(ctx, userId, onChanged) {
  const relation = await ctx.api.friends.relation(userId).catch(() => 'none');
  if (relation === 'accepted') { ctx.navigate(`#/msg/${userId}`); return; }
  if (relation === 'pending_in') { ctx.navigate('#/msg'); return; }
  if (relation === 'pending_out') { toast(t('friend.pendingOut'), 'info'); return; }
  const handle = openModal({
    title: t('friend.addTitle'),
    body: `<div class="stack gap-1">
      <label class="field__label">${esc(t('friend.addNote'))}</label>
      <input class="input" data-role="note" placeholder="${esc(t('friend.notePh'))}" />
      <div class="form-error" data-role="error"></div>
    </div>`,
    footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="send">${esc(t('friend.send'))}</button>`,
  });
  const noteEl = handle.body.querySelector('[data-role="note"]');
  const errorBox = handle.body.querySelector('[data-role="error"]');
  const sendBtn = handle.footer.querySelector('[data-role="send"]');
  noteEl.focus();
  sendBtn.addEventListener('click', async () => {
    errorBox.textContent = '';
    sendBtn.disabled = true;
    try {
      const result = await ctx.api.friends.request(userId, noteEl.value.trim());
      toastOk(result === 'accepted' ? t('friend.accepted') : t('friend.requested'));
      emit('social:changed');
      if (onChanged) await onChanged();
      handle.close();
    } catch (error) {
      errorBox.textContent = errText(error);
      sendBtn.disabled = false;
    }
  });
}
