/** 后台管理：数据概览 / 内容 / 评论（模块、邀请码、账号见 admin-manage.js） */

import { t } from '../core/i18n.js';
import { icon, emptyState, loadingState, toastOk, toastErr, confirmDialog, avatarHtml } from '../core/ui.js';
import { esc, fromNow, formatDate, bytesText } from '../core/util.js';
import { errText } from '../data/index.js';
import { statCard, rankedItemHtml, moduleName, authorName, roleBadge, countChips } from '../components/widgets.js';
import { renderModulesTab, renderInvitesTab } from './admin-modules.js';
import { renderUsersTab } from './admin-users.js';

const TABS = [
  { key: 'overview', icon: 'dashboard', label: 'admin.overview' },
  { key: 'contents', icon: 'folder', label: 'admin.contents' },
  { key: 'comments', icon: 'comment', label: 'admin.comments' },
  { key: 'modules', icon: 'grid', label: 'admin.modules' },
  { key: 'invites', icon: 'ticket', label: 'admin.invites' },
  { key: 'users', icon: 'users', label: 'admin.users' },
];

export async function renderAdmin(ctx) {
  const { api, user, container } = ctx;
  if (!user || (user.role !== 'superadmin' && user.role !== 'owner')) {
    container.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(t('common.noPermission'))} · ${esc(t('admin.ownerCannot'))}</div></div>`;
    return;
  }
  const lang = document.documentElement.dataset.lang;
  const active = ctx.params.tab || 'overview';
  const isSuper = user.role === 'superadmin';

  container.innerHTML = `
    <div class="stack gap-2">
      <div class="row row--between row--wrap">
        <h1 style="font-size:22px" class="mb-0">${icon('shield', 18)} ${esc(t('admin.title'))}</h1>
        <span class="badge ${isSuper ? 'badge--accent' : 'badge--jade'}">${esc(t(`role.${user.role}`))}</span>
      </div>
      <div class="admin-shell">
        <nav class="admin-nav">
          ${TABS.map((tab) => `<button data-tab="${tab.key}" class="${tab.key === active ? 'is-active' : ''}">${icon(tab.icon, 15)} ${esc(t(tab.label))}${!isSuper && ['modules', 'invites', 'users'].includes(tab.key) ? ' 🔒' : ''}</button>`).join('')}
        </nav>
        <div data-role="panel">${loadingState()}</div>
      </div>
    </div>
  `;

  const panel = container.querySelector('[data-role="panel"]');

  container.querySelector('.admin-nav').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    ctx.navigate(`#/admin/${btn.dataset.tab}`);
  });

  const needSuper = ['modules', 'invites', 'users'].includes(active);
  if (needSuper && !isSuper) {
    panel.innerHTML = `<div class="banner banner--warn">${icon('alert', 17)}<div>${esc(t('admin.ownerCannot'))}</div></div>`;
    return;
  }

  if (active === 'overview') await renderOverview(ctx, panel);
  else if (active === 'contents') await renderContentsTab(ctx, panel);
  else if (active === 'comments') await renderCommentsTab(ctx, panel);
  else if (active === 'modules') await renderModulesTab(ctx, panel);
  else if (active === 'invites') await renderInvitesTab(ctx, panel);
  else if (active === 'users') await renderUsersTab(ctx, panel);
}

/* ------------------------------ 数据概览 ------------------------------ */

async function renderOverview(ctx, panel) {
  const { api } = ctx;
  const lang = document.documentElement.dataset.lang;
  let stats;
  try {
    stats = await api.admin.stats();
  } catch (error) {
    panel.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }
  const { totals, today, series, byModule, topContents, topComments, contributors, recent } = stats;
  const maxSeries = Math.max(1, ...series.map((s) => s.contents + s.comments));
  const maxModule = Math.max(1, ...byModule.map((m) => m.count));
  const totalInteractions = totals.contents ? ((totals.reactions) / totals.contents).toFixed(1) : '0';

  panel.innerHTML = `
    <div class="stack gap-2">
      <div class="grid grid--stats">
        ${statCard(t('admin.statUsers'), totals.users, `+${today.users} ${t('admin.statToday')}`)}
        ${statCard(t('admin.statContents'), totals.contents, `+${today.contents} ${t('admin.statToday')}`)}
        ${statCard(t('admin.statComments'), totals.comments, `+${today.comments} ${t('admin.statToday')}`)}
        ${statCard(t('admin.statReacts'), totals.reactions, `${t('admin.avgPerContent')} ${totalInteractions}`)}
        ${statCard(t('react.views'), totals.views, `📄 ${totals.drafts} ${t('common.draft')}`)}
        ${statCard(t('admin.statInvites'), `${totals.activeInvites}/${totals.invites}`, t('invite.active'))}
      </div>

      <section class="panel">
        <div class="panel__head"><span class="panel__title">${icon('clock', 15)} ${esc(t('admin.last7'))}</span></div>
        <div class="panel__body">
          <div class="row" style="align-items:flex-end;gap:6px;height:120px">
            ${series.map((s) => {
              const total = s.contents + s.comments;
              const height = Math.round((total / maxSeries) * 100);
              return `
                <div class="grow center" style="flex-direction:column;gap:4px">
                  <div class="tiny muted">${total || ''}</div>
                  <div style="width:100%;height:${Math.max(4, height)}%;background:linear-gradient(180deg,var(--accent),var(--jade));border-radius:6px 6px 0 0;min-height:4px" title="${esc(s.day)} · ${s.contents} 内容 / ${s.comments} 评论"></div>
                  <div class="tiny muted">${esc(s.label)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </section>

      <div class="grid grid--2">
        <section class="panel">
          <div class="panel__head"><span class="panel__title">${icon('grid', 15)} ${esc(t('admin.byModule'))}</span></div>
          <div class="panel__body stack gap-1">
            ${byModule.map((m) => `
              <div class="bar-row">
                <span class="ellipsis">${esc(m.icon)} ${esc(lang === 'en' ? m.nameEn : m.nameZh)}</span>
                <div class="meter"><div class="meter__fill" style="width:${Math.round((m.count / maxModule) * 100)}%"></div></div>
                <span class="tiny muted nowrap" title="${esc(`${m.likes} 赞 / ${m.comments} 评 / ${m.views} 浏览`)}">${m.count}</span>
              </div>
            `).join('') || `<div class="muted small">${esc(t('admin.noData'))}</div>`}
          </div>
        </section>

        <section class="panel">
          <div class="panel__head"><span class="panel__title">${icon('users', 15)} ${esc(t('admin.topContributors'))}</span></div>
          <div class="panel__body panel__body--flush">
            ${contributors.map((c) => `
              <div class="list-item">
                ${avatarHtml(c.user, 'avatar--sm')}
                <div class="grow">
                  <div class="row" style="gap:6px"><strong>${esc(authorName(c.user))}</strong>${roleBadge(c.user)}</div>
                  <div class="tiny muted">${c.contents} 内容 · ${c.comments} 评论 · ${countChips([['like', c.likes || 0], ['eye', c.views || 0]], 11)}</div>
                </div>
              </div>
            `).join('') || `<div class="empty">${esc(t('admin.noData'))}</div>`}
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel__head"><span class="panel__title">${icon('fire', 15)} ${esc(t('admin.topContents'))}</span></div>
        <div class="panel__body panel__body--flush">
          ${topContents.length ? topContents.map((item, index) => `
            <div class="list-item">
              <div class="list-item__index ${index < 3 ? 'list-item__index--top' : ''}">${index + 1}</div>
              <div class="grow">
                <a href="#/c/${esc(item.id)}" style="color:inherit"><strong>${esc(item.title)}</strong></a>
                <div class="tiny muted mt-1">
                  ${esc(item.module ? moduleName(item.module, lang) : '')} · ${esc(authorName(item.author))} ·
                  ${countChips([
                    ['like', item.counts.like],
                    ['comment', item.counts.comment],
                    ['star', item.counts.favorite],
                    ['eye', item.views || 0],
                  ])} ·
                  ${esc(fromNow(item.createdAt, lang))}
                </div>
              </div>
            </div>
          `).join('') : `<div class="empty">${esc(t('admin.noData'))}</div>`}
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><span class="panel__title">${icon('like', 15)} ${esc(t('admin.topComments'))}</span></div>
        <div class="panel__body panel__body--flush">
          ${topComments.length ? topComments.map((c) => `
            <div class="list-item">
              ${avatarHtml(c.author, 'avatar--sm')}
              <div class="grow">
                <div class="comment__body clamp-2">${esc(c.bodyMd)}</div>
                <div class="tiny muted mt-1">
                  ${esc(authorName(c.author))} · ${icon('like', 12)} ${c.counts.like}
                  ${c.content ? ` · <a href="#/c/${esc(c.contentId)}">${esc(c.content?.title || '')}</a>` : ''}
                </div>
              </div>
            </div>
          `).join('') : `<div class="empty">${esc(t('admin.noData'))}</div>`}
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><span class="panel__title">${icon('clock', 15)} ${esc(t('admin.recent'))}</span></div>
        <div class="panel__body panel__body--flush">
          ${recent.map((item) => `
            <div class="list-item">
              <div class="list-item__index">${item.type === 'content' ? icon('folder', 16) : icon('comment', 16)}</div>
              <div class="grow">
                <div class="ellipsis">${item.type === 'content' ? `<a href="#/c/${esc(item.contentId)}">${esc(item.title)}</a>` : `<a href="#/c/${esc(item.contentId)}">${esc(item.title)}</a>`}</div>
                <div class="tiny muted">${esc(authorName(item.author))} · ${esc(fromNow(item.at, lang))}</div>
              </div>
            </div>
          `).join('') || `<div class="empty">${esc(t('admin.noData'))}</div>`}
        </div>
      </section>
    </div>
  `;
}

/* ------------------------------ 内容管理 ------------------------------ */

async function renderContentsTab(ctx, panel) {
  const { api } = ctx;
  const lang = document.documentElement.dataset.lang;
  let items = [];
  try {
    items = await api.contents.listAll();
  } catch (error) {
    panel.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }
  let query = '';

  const draw = () => {
    const filtered = query
      ? items.filter((c) => `${c.title} ${c.bodyMd}`.toLowerCase().includes(query.toLowerCase()))
      : items;
    panel.innerHTML = `
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${esc(t('admin.contents'))} · ${filtered.length}</span>
          <span class="grow"></span>
          <input class="input" data-role="search" placeholder="${esc(t('admin.searchContent'))}" style="max-width:240px" value="${esc(query)}" />
        </div>
        <div class="panel__body panel__body--flush">
          ${filtered.length ? `
            <div class="table-wrap">
              <table class="table">
                <thead><tr>
                  <th>${esc(t('common.title'))}</th>
                  <th>${esc(t('common.module'))}</th>
                  <th>${esc(t('common.author'))}</th>
                  <th>${esc(t('admin.statReacts'))}</th>
                  <th>${esc(t('common.time'))}</th>
                  <th>${esc(t('common.actions'))}</th>
                </tr></thead>
                <tbody>
                  ${filtered.map((item) => `
                    <tr>
                      <td style="max-width:280px">
                        <a href="#/c/${esc(item.id)}" class="ellipsis" style="display:block;color:inherit"><strong>${esc(item.title)}</strong></a>
                        <div class="tiny muted">${item.status === 'draft' ? esc(t('common.draft')) : esc(t('common.published'))} · ${esc(bytesText((item.media || []).reduce((s, m) => s + (m.size || 0), 0)) || '')}</div>
                      </td>
                      <td>${esc(item.module ? moduleName(item.module, lang) : '-')}</td>
                      <td>${esc(authorName(item.author))}</td>
                      <td class="tiny nowrap">${icon('like', 12)} ${item.counts.like} · ${icon('comment', 12)} ${item.counts.comment} · ${icon('star', 12)} ${item.counts.favorite}</td>
                      <td class="tiny nowrap">${esc(fromNow(item.createdAt, lang))}</td>
                      <td>
                        <div class="row" style="gap:4px">
                          <a class="btn btn--xs" href="#/edit?id=${esc(item.id)}">${esc(t('common.edit'))}</a>
                          <button class="btn btn--xs btn--danger" data-delete="${esc(item.id)}">${esc(t('common.delete'))}</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : emptyState(t('admin.noData'), '文')}
        </div>
      </section>
    `;

    let timer = 0;
    panel.querySelector('[data-role="search"]')?.addEventListener('input', (event) => {
      clearTimeout(timer);
      query = event.target.value.trim();
      timer = setTimeout(() => { draw(); panel.querySelector('[data-role="search"]')?.focus(); }, 280);
    });

    panel.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ message: t('content.confirmDelete'), danger: true, okText: t('common.delete') });
        if (!ok) return;
        try {
          await api.contents.remove(btn.dataset.delete);
          items = items.filter((c) => c.id !== btn.dataset.delete);
          toastOk(t('content.deleted'));
          draw();
        } catch (error) { toastErr(errText(error)); }
      });
    });
  };

  draw();
}

/* ------------------------------ 评论管理 ------------------------------ */

async function renderCommentsTab(ctx, panel) {
  const { api } = ctx;
  const lang = document.documentElement.dataset.lang;
  let items = [];
  try {
    items = await api.admin.allComments();
  } catch (error) {
    panel.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }

  const draw = () => {
    panel.innerHTML = `
      <section class="panel">
        <div class="panel__head"><span class="panel__title">${esc(t('admin.comments'))} · ${items.length}</span></div>
        <div class="panel__body panel__body--flush">
          ${items.length ? `
            <div class="table-wrap">
              <table class="table">
                <thead><tr>
                  <th>${esc(t('common.comment'))}</th>
                  <th>${esc(t('common.author'))}</th>
                  <th>${esc(t('common.content'))}</th>
                  <th>${esc(t('react.like'))}</th>
                  <th>${esc(t('common.time'))}</th>
                  <th>${esc(t('common.actions'))}</th>
                </tr></thead>
                <tbody>
                  ${items.map((c) => `
                    <tr>
                      <td style="max-width:320px"><div class="clamp-2">${esc(c.bodyMd)}</div></td>
                      <td class="nowrap">${esc(authorName(c.author))}</td>
                      <td style="max-width:200px"><a href="#/c/${esc(c.contentId)}" class="ellipsis" style="display:block">${esc(c.content?.title || '-')}</a></td>
                      <td class="nowrap">${icon('like', 12)} ${c.counts.like}</td>
                      <td class="tiny nowrap">${esc(fromNow(c.createdAt, lang))}</td>
                      <td><button class="btn btn--xs btn--danger" data-delete="${esc(c.id)}">${esc(t('common.delete'))}</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : emptyState(t('admin.noData'), '评')}
        </div>
      </section>
    `;
    panel.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ message: t('comment.confirmDelete'), danger: true, okText: t('common.delete') });
        if (!ok) return;
        try {
          await api.comments.remove(btn.dataset.delete);
          items = items.filter((c) => c.id !== btn.dataset.delete);
          toastOk(t('comment.deleted'));
          draw();
        } catch (error) { toastErr(errText(error)); }
      });
    });
  };

  draw();
}
