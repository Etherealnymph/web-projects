/** 登录 / 邀请码注册 / 首次初始化 */

import { CONFIG } from '../config.js';
import { t, tl } from '../core/i18n.js';
import { icon, toastOk, toastErr } from '../core/ui.js';
import { esc } from '../core/util.js';
import { emit } from '../core/store.js';
import { errText } from '../data/index.js';

export async function renderAuth(ctx) {
  const { api, container } = ctx;
  const state = await api.auth.bootstrapState();
  const lang = document.documentElement.dataset.lang;
  const boot = CONFIG.bootstrap;

  if (!state.hasUsers && !boot.autoCreate) {
    renderBootstrap(ctx);
    return;
  }

  const hint = boot.showCredentialHint && api.mode === 'local'
    ? `<div class="banner mt-2">
         <span>${icon('info', 17)}</span>
         <div>
           <strong>${esc(t('auth.hintTitle'))}</strong>
           <div class="tiny muted mt-1">${esc(t('auth.hintBody'))}</div>
         </div>
       </div>`
    : '';

  container.innerHTML = `
    <div class="auth-wrap">
      <aside class="auth-side">
        <div class="brand">
          <div class="brand__mark">体</div>
          <div>
            <div class="brand__text">${esc(tl(CONFIG.site.name.zh, CONFIG.site.name.en))}</div>
            <div class="brand__sub">${esc(tl(CONFIG.site.tagline.zh, CONFIG.site.tagline.en))}</div>
          </div>
        </div>
        <h1 class="auth-side__title">${esc(t('auth.private'))}</h1>
        <p class="auth-side__quote">${esc(lang === 'en' ? CONFIG.site.quote.en : CONFIG.site.quote.zh)}</p>
        <div class="feature-list">
          <div class="feature"><div class="feature__dot">✦</div><div><strong>${esc(t('sort.hot'))}</strong><div class="small muted">${esc(t('module.hotHint'))}</div></div></div>
          <div class="feature"><div class="feature__dot">❖</div><div><strong>Markdown</strong><div class="small muted">${esc(t('auth.tipQuote'))}</div></div></div>
          <div class="feature"><div class="feature__dot">✎</div><div><strong>${esc(t('invite.title'))}</strong><div class="small muted">${esc(t('invite.categoryHint'))}</div></div></div>
        </div>
        <div class="auth-side__deco">悟</div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-tabs">
            <button type="button" data-tab="login" class="is-active">${esc(t('auth.loginTitle'))}</button>
            <button type="button" data-tab="register">${esc(t('auth.registerTitle'))}</button>
          </div>

          <form data-form="login" class="stack gap-1">
            <div class="field">
              <label class="field__label">${esc(t('auth.username'))}</label>
              <input class="input" name="username" autocomplete="username" placeholder="${esc(t('auth.usernamePh'))}" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('auth.password'))}</label>
              <input class="input" name="password" type="password" autocomplete="current-password" placeholder="${esc(t('auth.passwordPh'))}" />
            </div>
            <div class="form-error" data-error></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit">${esc(t('auth.loginBtn'))}</button>
            ${hint}
          </form>

          <form data-form="register" class="stack gap-1 hidden">
            <div class="field">
              <label class="field__label">${esc(t('auth.inviteCode'))}</label>
              <input class="input" name="inviteCode" placeholder="${esc(t('auth.inviteCodePh'))}" style="text-transform:uppercase" />
              <div class="field__hint" data-invite-hint></div>
            </div>
            <div class="field">
              <label class="field__label">${esc(t('auth.username'))}</label>
              <input class="input" name="username" autocomplete="username" placeholder="${esc(t('auth.usernamePh'))}" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('auth.nickname'))}</label>
              <input class="input" name="nickname" placeholder="${esc(t('auth.nicknamePh'))}" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('auth.password'))}</label>
              <input class="input" name="password" type="password" autocomplete="new-password" placeholder="${esc(t('auth.passwordPh'))}" />
            </div>
            <div class="field">
              <label class="field__label">${esc(t('auth.password2'))}</label>
              <input class="input" name="password2" type="password" autocomplete="new-password" />
            </div>
            <div class="form-error" data-error></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit">${esc(t('auth.registerBtn'))}</button>
          </form>

          ${api.mode === 'local' ? `<div class="banner banner--warn mt-3"><span>${icon('alert', 17)}</span><div>${esc(t('app.localWarning'))}</div></div>` : ''}
        </div>
      </main>
    </div>
  `;

  /* 标签切换 */
  const tabs = Array.from(container.querySelectorAll('[data-tab]'));
  const forms = { login: container.querySelector('[data-form="login"]'), register: container.querySelector('[data-form="register"]') };
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    Object.entries(forms).forEach(([key, form]) => form.classList.toggle('hidden', key !== tab.dataset.tab));
  }));

  /* 邀请码即时校验 */
  const inviteInput = forms.register.elements.inviteCode;
  const inviteHint = container.querySelector('[data-invite-hint]');
  let inviteTimer = 0;
  inviteInput.addEventListener('input', () => {
    clearTimeout(inviteTimer);
    const code = inviteInput.value.trim();
    if (!code) { inviteHint.textContent = ''; return; }
    inviteTimer = setTimeout(async () => {
      try {
        const invite = await api.invites.validate(code);
        const names = invite.modules.includes('*')
          ? t('invite.allModules')
          : (await api.modules.list()).filter((m) => invite.modules.includes(m.id)).map((m) => m.nameZh).join('、');
        const remain = invite.expiresAt ? `${t('common.expires')}：${new Date(invite.expiresAt).toLocaleString()}` : t('common.never');
        inviteHint.innerHTML = `<span class="badge badge--ok">${icon('check', 12)} ${esc(invite.category || '邀请码')}</span> ${esc(names)} · ${esc(remain)}${invite.write ? ` · ${esc(t('common.write'))}` : ` · ${esc(t('common.readonly'))}`}`;
      } catch (error) {
        inviteHint.innerHTML = `<span class="badge badge--danger">${esc(errText(error))}</span>`;
      }
    }, 320);
  });

  /* 登录 */
  forms.login.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = forms.login.querySelector('[data-error]');
    errorBox.textContent = '';
    const username = forms.login.elements.username.value.trim();
    const password = forms.login.elements.password.value;
    if (!username || !password) { errorBox.textContent = t('auth.errEmpty'); return; }
    const button = forms.login.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api.auth.login(username, password);
      toastOk(t('auth.loginOk'));
      emit('auth:changed');
      ctx.navigate('#/');
    } catch (error) {
      errorBox.textContent = errText(error);
    } finally {
      button.disabled = false;
    }
  });

  /* 注册 */
  forms.register.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = forms.register.querySelector('[data-error]');
    errorBox.textContent = '';
    const data = {
      inviteCode: forms.register.elements.inviteCode.value.trim(),
      username: forms.register.elements.username.value.trim(),
      nickname: forms.register.elements.nickname.value.trim(),
      password: forms.register.elements.password.value,
    };
    const password2 = forms.register.elements.password2.value;
    if (!data.inviteCode) { errorBox.textContent = t('auth.inviteCodePh'); return; }
    if (!data.username || !data.password) { errorBox.textContent = t('auth.errEmpty'); return; }
    if (data.password.length < 6) { errorBox.textContent = t('auth.errPwShort'); return; }
    if (data.password !== password2) { errorBox.textContent = t('auth.errPwMismatch'); return; }
    const button = forms.register.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const user = await api.auth.register(data);
      toastOk(`${t('auth.registerOk')}，${user.nickname}`);
      emit('auth:changed');
      ctx.navigate('#/');
    } catch (error) {
      errorBox.textContent = errText(error);
    } finally {
      button.disabled = false;
    }
  });
}

function renderBootstrap(ctx) {
  const { api, container } = ctx;
  container.innerHTML = `
    <div class="auth-main" style="min-height:100vh">
      <div class="auth-card">
        <div class="brand mb-3">
          <div class="brand__mark">体</div>
          <div><div class="brand__text">${esc(t('app.name'))}</div><div class="brand__sub">${esc(t('auth.bootstrapTitle'))}</div></div>
        </div>
        <p class="muted">${esc(t('auth.bootstrapBody'))}</p>
        <form class="stack gap-1 mt-2">
          <div class="field">
            <label class="field__label">${esc(t('auth.username'))}</label>
            <input class="input" name="username" value="superadmin" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('auth.nickname'))}</label>
            <input class="input" name="nickname" value="超管" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('auth.password'))}</label>
            <input class="input" name="password" type="password" autocomplete="new-password" />
            <div class="field__hint">${esc(t('auth.errPwShort'))}</div>
          </div>
          <div class="form-error" data-error></div>
          <button class="btn btn--primary btn--lg btn--block" type="submit">${esc(t('auth.bootstrapBtn'))}</button>
        </form>
      </div>
    </div>
  `;
  const form = container.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = form.querySelector('[data-error]');
    errorBox.textContent = '';
    try {
      await api.auth.createInitialSuperadmin({
        username: form.elements.username.value.trim(),
        nickname: form.elements.nickname.value.trim(),
        password: form.elements.password.value,
      });
      toastOk(t('auth.registerOk'));
      emit('auth:changed');
      ctx.navigate('#/');
    } catch (error) {
      errorBox.textContent = errText(error);
    }
  });
}
