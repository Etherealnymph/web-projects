/** 后台：账号管理 */

import { t } from '../core/i18n.js';
import { icon, openModal, confirmDialog, toastOk, toastErr, avatarHtml } from '../core/ui.js';
import { esc, formatDay, formatDate, remainingText } from '../core/util.js';
import { errText } from '../data/index.js';
import { moduleName } from '../components/widgets.js';

export async function renderUsersTab(ctx, panel) {
  const { api, user } = ctx;
  const lang = document.documentElement.dataset.lang;
  let users = [];
  let modules = [];
  let requests = [];
  try {
    [users, modules] = await Promise.all([api.auth.listUsers(), api.modules.list()]);
    requests = api.permissionRequests ? await api.permissionRequests.list() : [];
  } catch (error) {
    panel.innerHTML = `<div class="banner banner--danger">${icon('alert', 17)}<div>${esc(errText(error))}</div></div>`;
    return;
  }
  const moduleMap = new Map(modules.map((m) => [m.id, m]));
  let query = '';

  const draw = () => {
    const filtered = query
      ? users.filter((u) => `${u.username} ${u.nickname}`.toLowerCase().includes(query.toLowerCase()))
      : users;
    panel.innerHTML = `
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${esc(t('admin.users'))} · ${filtered.length}</span>
          <span class="grow"></span>
          <input class="input" data-role="search" placeholder="${esc(t('admin.searchUser'))}" value="${esc(query)}" style="max-width:190px" />
          <button class="btn btn--primary btn--sm" data-role="new">${icon('plus', 15)} ${esc(t('admin.userNew'))}</button>
        </div>
        <div class="panel__body panel__body--flush">
          <div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>${esc(t('common.user'))}</th>
                <th>${esc(t('admin.userRole'))}</th>
                <th>${esc(t('profile.modules'))}</th>
                <th>${esc(t('common.content'))}</th>
                <th>${esc(t('admin.userSince'))}</th>
                <th>${esc(t('common.actions'))}</th>
              </tr></thead>
              <tbody>
                ${filtered.map((row) => {
                  const grants = row.grants || [];
                  const grantText = grants.length
                    ? grants.map((g) => {
                      const name = g.allModules ? t('invite.allModules') : (moduleMap.get(g.moduleId) ? moduleName(moduleMap.get(g.moduleId), lang) : '?');
                      const state = g.valid ? [g.read ? t('common.read') : t('common.noRead'), g.write ? t('common.write') : t('common.readonly'), g.upload ? t('common.upload') : t('common.noUpload')].join(' · ') : t('common.expired');
                      const exp = g.expiresAt ? `（${remainingText(g.expiresAt, lang)}）` : '';
                      return `<span class="badge ${g.valid ? 'badge--jade' : 'badge--danger'}">${esc(name)} · ${esc(state)}${esc(exp)}</span>`;
                    }).join(' ')
                    : `<span class="muted tiny">${esc(t('admin.noGrant'))}</span>`;
                  return `
                    <tr>
                      <td>
                        <div class="row" style="gap:8px">
                          ${avatarHtml(row, 'avatar--sm')}
                          <div>
                            <strong>${esc(row.nickname)}</strong> ${row.mustChangePassword ? `<span class="badge badge--warn">${esc(t('admin.mustChangePw'))}</span>` : ''}
                            <div class="tiny muted mono">@${esc(row.username)}${row.id === user.id ? ` · ${esc(t('common.you'))}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select class="select" data-role-select="${esc(row.id)}" ${row.id === user.id ? 'disabled' : ''} style="max-width:130px">
                          <option value="member" ${row.role === 'member' ? 'selected' : ''}>${esc(t('role.member'))}</option>
                          <option value="owner" ${row.role === 'owner' ? 'selected' : ''}>${esc(t('role.owner'))}</option>
                          <option value="superadmin" ${row.role === 'superadmin' ? 'selected' : ''}>${esc(t('role.superadmin'))}</option>
                        </select>
                      </td>
                      <td style="max-width:260px">${grantText}</td>
                      <td class="tiny nowrap">${row.stats.contents} 文 · ${row.stats.comments} 评<br />${icon('like', 11)} ${row.stats.likes}</td>
                      <td class="tiny nowrap">${esc(formatDay(row.createdAt))}</td>
                      <td>
                        <div class="row" style="gap:4px">
                          <button class="btn btn--xs" data-grant="${esc(row.id)}">${esc(t('profile.grantTitle'))}</button>
                          <button class="btn btn--xs" data-reset="${esc(row.id)}">${esc(t('admin.resetPw'))}</button>
                          ${row.id === user.id ? '' : `<button class="btn btn--xs btn--danger" data-delete="${esc(row.id)}">${esc(t('common.delete'))}</button>`}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      ${requests.filter((r) => r.status === 'pending').length ? `
      <section class="panel mt-2">
        <div class="panel__head"><span class="panel__title">${esc(t('admin.permissionRequests'))}</span></div>
        <div class="panel__body stack gap-1">
          ${requests.filter((r) => r.status === 'pending').map((r) => `
            <div class="row row--wrap">
              <span class="grow">${esc(r.user?.nickname || r.user?.username || r.userId)} · ${esc(moduleName(moduleMap.get(r.moduleId), lang))} · ${esc([r.read ? t('common.read') : t('common.noRead'), r.write ? t('common.write') : t('common.readonly'), r.upload ? t('common.upload') : t('common.noUpload')].join(' · '))}</span>
              <button class="btn btn--xs btn--primary" data-request-approve="${esc(r.id)}">${esc(t('common.approve'))}</button>
              <button class="btn btn--xs btn--danger" data-request-reject="${esc(r.id)}">${esc(t('common.reject'))}</button>
            </div>
          `).join('')}
        </div>
      </section>` : ''}
    `;

    let timer = 0;
    panel.querySelector('[data-role="search"]').addEventListener('input', (event) => {
      clearTimeout(timer);
      query = event.target.value.trim();
      timer = setTimeout(() => { draw(); panel.querySelector('[data-role="search"]')?.focus(); }, 260);
    });
    panel.querySelector('[data-role="new"]').addEventListener('click', () => openUserForm(ctx, panel, modules));

    panel.querySelectorAll('[data-role-select]').forEach((select) => select.addEventListener('change', async () => {
      try {
        await api.auth.updateUser(select.dataset.roleSelect, { role: select.value });
        toastOk(t('admin.roleChanged'));
      } catch (error) { toastErr(errText(error)); }
    }));

    panel.querySelectorAll('[data-reset]').forEach((btn) => btn.addEventListener('click', async () => {
      const password = await promptPassword();
      if (!password) return;
      try {
        await api.auth.resetPassword(btn.dataset.reset, password);
        toastOk(t('admin.pwReset'));
      } catch (error) { toastErr(errText(error)); }
    }));

    panel.querySelectorAll('[data-grant]').forEach((btn) => btn.addEventListener('click', () => {
      openGrantForm(ctx, panel, users.find((u) => u.id === btn.dataset.grant), modules);
    }));
    panel.querySelectorAll('[data-request-approve], [data-request-reject]').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await api.permissionRequests.decide(btn.dataset.requestApprove || btn.dataset.requestReject, btn.dataset.requestApprove ? 'approved' : 'rejected');
        toastOk(t('common.saved'));
        renderUsersTab(ctx, panel);
      } catch (error) { toastErr(errText(error)); }
    }));

    panel.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const target = users.find((u) => u.id === btn.dataset.delete);
      const ok = await confirmDialog({
        message: t('admin.userDeleteConfirm', { name: target?.nickname || target?.username || '' }),
        danger: true,
        okText: t('common.delete'),
      });
      if (!ok) return;
      try {
        await api.auth.removeUser(btn.dataset.delete);
        toastOk(t('admin.userDeleted'));
        users = await api.auth.listUsers();
        draw();
      } catch (error) { toastErr(errText(error)); }
    }));
  };

  draw();
}

function promptPassword() {
  return new Promise((resolve) => {
    let settled = false;
    const handle = openModal({
      title: t('admin.resetPw'),
      body: `<div class="field"><label class="field__label">${esc(t('admin.newPw'))}</label><input class="input" type="password" data-role="pw" autocomplete="new-password" /><div class="field__hint">${esc(t('auth.errPwShort'))}</div></div>`,
      footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="ok">${esc(t('common.confirm'))}</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(null); } },
    });
    const input = handle.body.querySelector('[data-role="pw"]');
    handle.footer.querySelector('[data-role="ok"]').addEventListener('click', () => {
      if (input.value.length < 6) { toastErr(t('auth.errPwShort')); return; }
      settled = true;
      resolve(input.value);
      handle.close();
    });
    setTimeout(() => input.focus(), 60);
  });
}

function openUserForm(ctx, panel, modules) {
  const { api } = ctx;
  const handle = openModal({
    title: t('admin.userNew'),
    wide: true,
    body: `
      <div class="stack gap-2">
        <div class="banner">${icon('info', 17)}<div>${esc(t('admin.userNewHint'))}</div></div>
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('auth.username'))}</label>
            <input class="input" data-role="username" placeholder="3-20 位字母数字下划线" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('auth.nickname'))}</label>
            <input class="input" data-role="nickname" />
          </div>
        </div>
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('auth.password'))}</label>
            <input class="input" type="password" data-role="password" autocomplete="new-password" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('admin.userRole'))}</label>
            <select class="select" data-role="role">
              <option value="member">${esc(t('role.member'))}</option>
              <option value="owner">${esc(t('role.owner'))}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field__label">${esc(t('invite.modules'))}</label>
          <label class="checkbox"><input type="checkbox" data-role="all" checked /> <span>${esc(t('invite.allModules'))}</span></label>
          <div class="row row--wrap mt-1">
            ${modules.map((m) => `<label class="checkbox chip"><input type="checkbox" value="${esc(m.id)}" disabled /> <span>${esc(m.icon)} ${esc(moduleName(m, document.documentElement.dataset.lang))}</span></label>`).join('')}
          </div>
        </div>
        <div class="grid grid--2">
          <div class="row row--wrap">
            <label class="checkbox"><input type="checkbox" data-role="read" checked /> <span>${esc(t('common.read'))}</span></label>
            <label class="checkbox"><input type="checkbox" data-role="write" checked /> <span>${esc(t('common.write'))}</span></label>
            <label class="checkbox"><input type="checkbox" data-role="upload" checked /> <span>${esc(t('common.upload'))}</span></label>
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.custom'))}（${esc(t('common.optional'))}）</label>
            <input class="input" type="datetime-local" data-role="expires" />
          </div>
        </div>
        <div class="form-error" data-role="error"></div>
      </div>
    `,
    footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="save">${esc(t('common.create'))}</button>`,
  });

  const allBox = handle.body.querySelector('[data-role="all"]');
  const boxes = Array.from(handle.body.querySelectorAll('.chip input'));
  allBox.addEventListener('change', () => {
    boxes.forEach((box) => { box.disabled = allBox.checked; if (allBox.checked) box.checked = false; });
  });

  handle.footer.querySelector('[data-role="save"]').addEventListener('click', async () => {
    const errorBox = handle.body.querySelector('[data-role="error"]');
    errorBox.textContent = '';
    const expires = handle.body.querySelector('[data-role="expires"]').value;
    const payload = {
      username: handle.body.querySelector('[data-role="username"]').value.trim(),
      nickname: handle.body.querySelector('[data-role="nickname"]').value.trim(),
      password: handle.body.querySelector('[data-role="password"]').value,
      role: handle.body.querySelector('[data-role="role"]').value,
      moduleIds: allBox.checked ? ['*'] : boxes.filter((b) => b.checked).map((b) => b.value),
      read: handle.body.querySelector('[data-role="read"]').checked,
      write: handle.body.querySelector('[data-role="write"]').checked,
      upload: handle.body.querySelector('[data-role="upload"]').checked,
      expiresAt: expires ? new Date(expires).toISOString() : null,
    };
    try {
      await api.auth.createUser(payload);
      toastOk(t('admin.userCreated'));
      handle.close();
      renderUsersTab(ctx, panel);
    } catch (error) { errorBox.textContent = errText(error); }
  });
}

function openGrantForm(ctx, panel, target, modules) {
  const { api } = ctx;
  const handle = openModal({
    title: `${t('profile.grantTitle')} · ${target.nickname}`,
    wide: true,
    body: `
      <div class="stack gap-2">
        ${(target.grants || []).length ? (target.grants || []).map((g) => `
          <div class="upload-item">
            <div class="grow">
              <strong>${esc(g.allModules ? t('invite.allModules') : (modules.find((m) => m.id === g.moduleId)?.nameZh || '?'))}</strong>
              <div class="tiny muted">${esc([g.read ? t('common.read') : t('common.noRead'), g.write ? t('common.write') : t('common.readonly'), g.upload ? t('common.upload') : t('common.noUpload')].join(' · '))} · ${g.expiresAt ? `${esc(formatDate(g.expiresAt, 'zh'))}（${esc(remainingText(g.expiresAt, 'zh'))}）` : esc(t('common.never'))}${g.inviteId ? ` · ${esc(t('admin.inviteBy'))}` : ''}</div>
            </div>
            <button class="btn btn--xs btn--danger" data-remove="${esc(g.allModules ? '*' : g.moduleId)}">${esc(t('common.delete'))}</button>
          </div>
        `).join('') : `<div class="muted small">${esc(t('admin.noGrant'))}</div>`}
        <div class="divider"></div>
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('common.module'))}</label>
            <select class="select" data-role="module">
              <option value="*">${esc(t('invite.allModules'))}</option>
              ${modules.map((m) => `<option value="${esc(m.id)}">${esc(m.icon)} ${esc(moduleName(m, document.documentElement.dataset.lang))}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.duration'))}</label>
            <select class="select" data-role="duration">
              <option value="forever">${esc(t('invite.durationForever'))}</option>
              <option value="1">${esc(t('invite.duration1'))}</option>
              <option value="7">${esc(t('invite.duration7'))}</option>
              <option value="30">${esc(t('invite.duration30'))}</option>
              <option value="90">${esc(t('invite.duration90'))}</option>
              <option value="365">${esc(t('invite.duration365'))}</option>
              <option value="custom">${esc(t('invite.custom'))}</option>
            </select>
            <input class="input mt-1 hidden" type="datetime-local" data-role="expires" />
          </div>
        </div>
        <div class="row row--wrap">
          <label class="checkbox"><input type="checkbox" data-role="read" checked /> <span>${esc(t('common.read'))}</span></label>
          <label class="checkbox"><input type="checkbox" data-role="write" checked /> <span>${esc(t('common.write'))}</span></label>
          <label class="checkbox"><input type="checkbox" data-role="upload" checked /> <span>${esc(t('common.upload'))}</span></label>
        </div>
        <div class="form-error" data-role="error"></div>
      </div>
    `,
    footer: `<button class="btn" data-modal-close>${esc(t('common.close'))}</button><button class="btn btn--primary" data-role="add">${esc(t('common.save'))}</button>`,
  });

  const duration = handle.body.querySelector('[data-role="duration"]');
  const expiresInput = handle.body.querySelector('[data-role="expires"]');
  duration.addEventListener('change', () => expiresInput.classList.toggle('hidden', duration.value !== 'custom'));
  handle.footer.querySelector('[data-role="add"]').addEventListener('click', async () => {
    const expires = duration.value === 'custom'
      ? expiresInput.value
      : duration.value === 'forever'
        ? ''
        : new Date(Date.now() + Number(duration.value) * 86400000).toISOString();
    try {
      await api.grants.set({
        userId: target.id,
        moduleId: handle.body.querySelector('[data-role="module"]').value,
        read: handle.body.querySelector('[data-role="read"]').checked,
        write: handle.body.querySelector('[data-role="write"]').checked,
        upload: handle.body.querySelector('[data-role="upload"]').checked,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      });
      toastOk(t('common.saved'));
      handle.close();
      renderUsersTab(ctx, panel);
    } catch (error) { toastErr(errText(error)); }
  });

  handle.body.querySelectorAll('[data-remove]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await api.grants.remove({ userId: target.id, moduleId: btn.dataset.remove });
      toastOk(t('common.saved'));
      handle.close();
      renderUsersTab(ctx, panel);
    } catch (error) { toastErr(errText(error)); }
  }));
}
