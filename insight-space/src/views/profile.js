/** 我的：资料、密码、模块权限、我的内容 / 收藏 / 评论、外观设置 */

import { t } from '../core/i18n.js';
import { icon, avatarHtml, toastOk, toastErr, loadingState, emptyState } from '../core/ui.js';
import { esc, formatDate, formatDay, fromNow, remainingText } from '../core/util.js';
import { errText } from '../data/index.js';
import { theme, lang } from '../core/theme.js';
import { emit } from '../core/store.js';
import { contentCardHtml, commentHtml, moduleName } from '../components/widgets.js';
import { resolveMediaUrls } from './home.js';

export async function renderProfile(ctx) {
  const { api, user, container } = ctx;
  if (!user) { container.innerHTML = emptyState(t('common.loginRequired'), '锁'); return; }
  const langNow = document.documentElement.dataset.lang;
  container.innerHTML = loadingState();

  const [modules, grants, mine, favorites, comments] = await Promise.all([
    api.modules.list(),
    api.grants.list(user.id).catch(() => []),
    api.contents.list({ authorId: user.id, sort: 'new' }),
    api.contents.list({ favoritesOf: user.id, sort: 'new' }),
    api.comments.mine(),
  ]);
  await resolveMediaUrls(api, mine.items);
  await resolveMediaUrls(api, favorites.items);

  const accessible = modules.filter((m) => m.access.visible);
  const ownContents = mine.items;
  const totalLikes = ownContents.reduce((sum, c) => sum + (c.counts?.like || 0), 0);
  const totalFavs = ownContents.reduce((sum, c) => sum + (c.counts?.favorite || 0), 0);

  container.innerHTML = `
    <div class="stack gap-3">
      <section class="profile-hero">
        ${avatarHtml(user, 'avatar--xl')}
        <div class="profile-hero__meta">
          <h1 class="mb-0" style="font-size:24px">${esc(user.nickname || user.username)}</h1>
          <div class="row row--wrap mt-1">
            <span class="badge badge--accent">${esc(t(`role.${user.role}`))}</span>
            <span class="tiny muted mono">@${esc(user.username)}</span>
            <span class="tiny muted">${esc(t('profile.joined'))} ${esc(formatDate(user.createdAt, langNow))}</span>
          </div>
          ${user.bio ? `<p class="muted mt-1 mb-0">${esc(user.bio)}</p>` : ''}
        </div>
        <div class="grid grid--stats" style="min-width:280px;flex:1">
          <div class="stat"><div class="stat__label">${esc(t('profile.statContent'))}</div><div class="stat__value">${ownContents.length}</div></div>
          <div class="stat"><div class="stat__label">${esc(t('profile.statComment'))}</div><div class="stat__value">${comments.length}</div></div>
          <div class="stat"><div class="stat__label">${esc(t('profile.statLike'))}</div><div class="stat__value">${totalLikes}</div></div>
          <div class="stat"><div class="stat__label">${esc(t('profile.statFavorite'))}</div><div class="stat__value">${totalFavs}</div></div>
        </div>
      </section>

      ${user.mustChangePassword ? `<div class="banner banner--warn">${icon('alert', 17)}<div>${esc(t('profile.mustChange'))}</div></div>` : ''}

      <div class="grid grid--2">
        <section class="panel">
          <div class="panel__head"><span class="panel__title">${icon('user', 15)} ${esc(t('profile.account'))}</span></div>
          <div class="panel__body stack gap-1">
            <div class="field">
              <label class="field__label">${esc(t('profile.nickname'))}</label>
              <input class="input" data-role="nickname" value="${esc(user.nickname || '')}" maxlength="30" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('profile.bio'))}</label>
              <textarea class="textarea" data-role="bio" rows="2" placeholder="${esc(t('profile.bioPh'))}" maxlength="300">${esc(user.bio || '')}</textarea>
            </div>
            <div class="field">
              <label class="field__label">${esc(t('profile.avatar'))}</label>
              <input class="input" data-role="avatar" value="${esc(user.avatar || '')}" placeholder="https://…" />
              <div class="field__hint">${esc(t('profile.avatarHint'))}</div>
            </div>
            <button class="btn btn--primary" data-role="save-profile">${esc(t('profile.save'))}</button>
          </div>
        </section>

        <section class="panel">
          <div class="panel__head"><span class="panel__title">${icon('shield', 15)} ${esc(t('profile.security'))}</span></div>
          <div class="panel__body stack gap-1">
            <div class="field">
              <label class="field__label">${esc(t('profile.oldPw'))}</label>
              <input class="input" type="password" data-role="old-pw" autocomplete="current-password" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('profile.newPw'))}</label>
              <input class="input" type="password" data-role="new-pw" autocomplete="new-password" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('profile.newPw2'))}</label>
              <input class="input" type="password" data-role="new-pw2" autocomplete="new-password" />
            </div>
            <div class="form-error" data-role="pw-error"></div>
            <button class="btn" data-role="change-pw">${esc(t('profile.changePw'))}</button>
            <div class="divider"></div>
            <div class="row row--between">
              <span class="small">${esc(t('settings.theme'))}</span>
              <div class="segmented" data-role="theme">
                <button data-value="light" class="${theme.current === 'light' ? 'is-active' : ''}">${esc(t('theme.light'))}</button>
                <button data-value="dark" class="${theme.current === 'dark' ? 'is-active' : ''}">${esc(t('theme.dark'))}</button>
                <button data-value="auto" class="${theme.current === 'auto' ? 'is-active' : ''}">${esc(t('theme.auto'))}</button>
              </div>
            </div>
            <div class="row row--between">
              <span class="small">${esc(t('settings.lang'))}</span>
              <div class="segmented" data-role="lang">
                <button data-value="zh" class="${lang.current === 'zh' ? 'is-active' : ''}">${esc(t('lang.zh'))}</button>
                <button data-value="en" class="${lang.current === 'en' ? 'is-active' : ''}">${esc(t('lang.en'))}</button>
              </div>
            </div>
            <button class="btn btn--danger mt-1" data-role="logout">${icon('logout', 15)} ${esc(t('profile.logout'))}</button>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel__head"><span class="panel__title">${icon('shield', 15)} ${esc(t('profile.grantTitle'))}</span></div>
        <div class="panel__body panel__body--flush">
          ${accessible.length ? accessible.map((m) => {
            const grant = grants.find((g) => g.moduleId === m.id || g.allModules);
            return `
              <div class="list-item">
                <div class="list-item__index">${esc(m.icon)}</div>
                <div class="grow">
                  <strong>${esc(moduleName(m, langNow))}</strong>
                  <div class="tiny muted">${esc(m.access.write ? t('common.write') : t('common.readonly'))}${grant?.expiresAt ? ` · ${esc(t('common.expires'))} ${esc(formatDay(grant.expiresAt))}（${esc(remainingText(grant.expiresAt, langNow))}）` : ` · ${esc(t('common.never'))}`}</div>
                </div>
                ${m.access.expiresAt ? `<span class="badge badge--warn">${esc(remainingText(m.access.expiresAt, langNow))}</span>` : '<span class="badge badge--ok">∞</span>'}
              </div>
            `;
          }).join('') : `<div class="empty">${esc(t('profile.noModule'))}</div>`}
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div class="tabs" data-role="tabs">
            <button class="is-active" data-tab="contents">${esc(t('profile.myContents'))} · ${ownContents.length}</button>
            <button data-tab="favorites">${esc(t('profile.myFavorites'))} · ${favorites.items.length}</button>
            <button data-tab="comments">${esc(t('profile.myComments'))} · ${comments.length}</button>
          </div>
        </div>
        <div class="panel__body">
          <div data-pane="contents" class="grid grid--cards">
            ${ownContents.length ? ownContents.map((item) => contentCardHtml(item)).join('') : emptyState(t('common.empty'), '文')}
          </div>
          <div data-pane="favorites" class="grid grid--cards hidden">
            ${favorites.items.length ? favorites.items.map((item) => contentCardHtml(item)).join('') : emptyState(t('common.empty'), '藏')}
          </div>
          <div data-pane="comments" class="hidden">
            ${comments.length ? comments.map((c) => `
              <div class="comment">
                <div class="comment__main">
                  <div class="comment__head">
                    <span class="tiny muted">${esc(fromNow(c.createdAt, langNow))}</span>
                    ${c.content ? `<a class="tiny" href="#/c/${esc(c.content.id)}">@ ${esc(c.content.title)}</a>` : ''}
                  </div>
                  <div class="comment__body">${esc(c.bodyMd)}</div>
                  <div class="comment__actions">${icon('like', 13)} ${c.counts?.like || 0}</div>
                </div>
              </div>
            `).join('') : emptyState(t('common.empty'), '评')}
          </div>
        </div>
      </section>
    </div>
  `;

  /* 资料保存 */
  container.querySelector('[data-role="save-profile"]').addEventListener('click', async () => {
    try {
      const updated = await api.auth.updateProfile({
        nickname: container.querySelector('[data-role="nickname"]').value,
        bio: container.querySelector('[data-role="bio"]').value,
        avatar: container.querySelector('[data-role="avatar"]').value,
      });
      toastOk(t('profile.saved'));
      emit('auth:changed', updated);
    } catch (error) { toastErr(errText(error)); }
  });

  /* 修改密码 */
  container.querySelector('[data-role="change-pw"]').addEventListener('click', async () => {
    const errorBox = container.querySelector('[data-role="pw-error"]');
    errorBox.textContent = '';
    const oldPw = container.querySelector('[data-role="old-pw"]').value;
    const newPw = container.querySelector('[data-role="new-pw"]').value;
    const newPw2 = container.querySelector('[data-role="new-pw2"]').value;
    if (newPw.length < 6) { errorBox.textContent = t('auth.errPwShort'); return; }
    if (newPw !== newPw2) { errorBox.textContent = t('auth.errPwMismatch'); return; }
    try {
      await api.auth.changePassword(oldPw, newPw);
      toastOk(t('profile.pwChanged'));
      container.querySelector('[data-role="old-pw"]').value = '';
      container.querySelector('[data-role="new-pw"]').value = '';
      container.querySelector('[data-role="new-pw2"]').value = '';
    } catch (error) { errorBox.textContent = errText(error); }
  });

  /* 主题 / 语言 */
  container.querySelector('[data-role="theme"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    theme.apply(btn.dataset.value);
    container.querySelectorAll('[data-role="theme"] [data-value]').forEach((node) => node.classList.toggle('is-active', node === btn));
  });
  container.querySelector('[data-role="lang"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    lang.apply(btn.dataset.value);
  });

  container.querySelector('[data-role="logout"]').addEventListener('click', async () => {
    await api.auth.logout();
    toastOk(t('auth.logoutOk'));
    emit('auth:changed');
    ctx.navigate('#/login');
  });

  /* 标签页 */
  container.querySelector('[data-role="tabs"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    container.querySelectorAll('[data-role="tabs"] [data-tab]').forEach((node) => node.classList.toggle('is-active', node === btn));
    container.querySelectorAll('[data-pane]').forEach((pane) => pane.classList.toggle('hidden', pane.dataset.pane !== btn.dataset.tab));
  });
}
