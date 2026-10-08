/** 后台：模块管理、邀请码管理 */

import { t } from '../core/i18n.js';
import { icon, openModal, confirmDialog, toastOk, toastErr, emptyState } from '../core/ui.js';
import { esc, formatDay, randomCode, copyText, remainingText } from '../core/util.js';
import { errText } from '../data/index.js';
import { moduleName } from '../components/widgets.js';

/* -------------------------------- 模块 -------------------------------- */

export async function renderModulesTab(ctx, panel) {
  const { api } = ctx;
  let modules = await api.modules.list();

  const draw = () => {
    panel.innerHTML = `
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${esc(t('admin.modules'))} · ${modules.length}</span>
          <span class="grow"></span>
          <button class="btn btn--primary btn--sm" data-role="new">${icon('plus', 15)} ${esc(t('module.new'))}</button>
        </div>
        <div class="panel__body panel__body--flush">
          <div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>${esc(t('common.name'))}</th>
                <th>${esc(t('module.key'))}</th>
                <th>${esc(t('module.sort'))}</th>
                <th>${esc(t('common.content'))}</th>
                <th>${esc(t('common.actions'))}</th>
              </tr></thead>
              <tbody>
                ${modules.map((m) => `
                  <tr>
                    <td>
                      <div class="row" style="gap:8px">
                        <span style="font-size:20px">${esc(m.icon)}</span>
                        <div>
                          <strong>${esc(m.nameZh)}</strong>
                          <div class="tiny muted">${esc(m.nameEn || '')} ${m.hot ? `· <span class="badge badge--warn">${esc(t('module.hot'))}</span>` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td class="mono tiny">${esc(m.key)}</td>
                    <td>${m.sort ?? 99}</td>
                    <td>${m.counts?.contents ?? 0}</td>
                    <td>
                      <div class="row" style="gap:4px">
                        <button class="btn btn--xs" data-edit="${esc(m.id)}">${esc(t('common.edit'))}</button>
                        <button class="btn btn--xs btn--danger" data-delete="${esc(m.id)}">${esc(t('common.delete'))}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    panel.querySelector('[data-role="new"]').addEventListener('click', () => openModuleForm(ctx, panel, null));
    panel.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      openModuleForm(ctx, panel, modules.find((m) => m.id === btn.dataset.edit));
    }));
    panel.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ message: t('module.deleteConfirm'), danger: true, okText: t('common.delete') });
      if (!ok) return;
      try {
        await api.modules.remove(btn.dataset.delete);
        toastOk(t('module.deleted'));
        modules = await api.modules.list();
        draw();
      } catch (error) { toastErr(errText(error)); }
    }));
  };

  draw();
}

function openModuleForm(ctx, panel, module) {
  const { api } = ctx;
  const handle = openModal({
    title: module ? t('module.edit') : t('module.new'),
    body: `
      <div class="stack gap-1">
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('module.nameZh'))}</label>
            <input class="input" data-role="nameZh" value="${esc(module?.nameZh || '')}" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('module.nameEn'))}</label>
            <input class="input" data-role="nameEn" value="${esc(module?.nameEn || '')}" />
          </div>
        </div>
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('module.key'))}</label>
            <input class="input mono" data-role="key" value="${esc(module?.key || '')}" />
            <div class="field__hint">${esc(t('module.keyHint'))}</div>
          </div>
          <div class="field">
            <label class="field__label">${esc(t('module.icon'))}</label>
            <input class="input" data-role="icon" value="${esc(module?.icon || '❖')}" maxlength="2" />
          </div>
        </div>
        <div class="field">
          <label class="field__label">${esc(t('module.desc'))}</label>
          <input class="input" data-role="descZh" placeholder="中文描述" value="${esc(module?.descZh || '')}" />
          <input class="input mt-1" data-role="descEn" placeholder="English description" value="${esc(module?.descEn || '')}" />
        </div>
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('module.sort'))}</label>
            <input class="input" type="number" data-role="sort" value="${module?.sort ?? 99}" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('module.hot'))}</label>
            <label class="checkbox"><input type="checkbox" data-role="hot" ${module?.hot ? 'checked' : ''} /> <span class="small">${esc(t('module.hotHint'))}</span></label>
          </div>
        </div>
        <div class="form-error" data-role="error"></div>
      </div>
    `,
    footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="save">${esc(t('common.save'))}</button>`,
  });

  handle.footer.querySelector('[data-role="save"]').addEventListener('click', async () => {
    const errorBox = handle.body.querySelector('[data-role="error"]');
    errorBox.textContent = '';
    const payload = {
      nameZh: handle.body.querySelector('[data-role="nameZh"]').value.trim(),
      nameEn: handle.body.querySelector('[data-role="nameEn"]').value.trim(),
      key: handle.body.querySelector('[data-role="key"]').value.trim(),
      icon: handle.body.querySelector('[data-role="icon"]').value.trim(),
      descZh: handle.body.querySelector('[data-role="descZh"]').value.trim(),
      descEn: handle.body.querySelector('[data-role="descEn"]').value.trim(),
      sort: Number(handle.body.querySelector('[data-role="sort"]').value),
      hot: handle.body.querySelector('[data-role="hot"]').checked,
    };
    if (!payload.nameZh || !payload.key) { errorBox.textContent = t('common.required'); return; }
    try {
      if (module) await api.modules.update(module.id, payload);
      else await api.modules.create(payload);
      toastOk(t('module.saved'));
      handle.close();
      renderModulesTab(ctx, panel);
    } catch (error) { errorBox.textContent = errText(error); }
  });
}

/* ------------------------------- 邀请码 ------------------------------- */

const DURATIONS = [
  { value: '1', label: 'invite.duration1' },
  { value: '7', label: 'invite.duration7' },
  { value: '30', label: 'invite.duration30' },
  { value: '90', label: 'invite.duration90' },
  { value: '365', label: 'invite.duration365' },
  { value: 'forever', label: 'invite.durationForever' },
  { value: 'custom', label: 'invite.custom' },
];

export async function renderInvitesTab(ctx, panel) {
  const { api } = ctx;
  const lang = document.documentElement.dataset.lang;
  let invites = await api.invites.list();
  const modules = await api.modules.list();
  const moduleMap = new Map(modules.map((m) => [m.id, m]));

  const statusBadge = (invite) => {
    if (invite.status === 'active') return `<span class="badge badge--ok">${esc(t('invite.active'))}</span>`;
    if (invite.status === 'disabled') return `<span class="badge">${esc(t('invite.disabled'))}</span>`;
    if (invite.status === 'expired') return `<span class="badge badge--danger">${esc(t('invite.expired'))}</span>`;
    return `<span class="badge badge--warn">${esc(t('invite.usedUp'))}</span>`;
  };

  const draw = () => {
    panel.innerHTML = `
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${esc(t('admin.invites'))} · ${invites.length}</span>
          <span class="grow"></span>
          <button class="btn btn--primary btn--sm" data-role="new">${icon('plus', 15)} ${esc(t('invite.new'))}</button>
        </div>
        <div class="panel__body panel__body--flush">
          ${invites.length ? `
            <div class="table-wrap">
              <table class="table">
                <thead><tr>
                  <th>${esc(t('invite.code'))}</th>
                  <th>${esc(t('invite.category'))}</th>
                  <th>${esc(t('invite.modules'))}</th>
                  <th>${esc(t('invite.uses'))}</th>
                  <th>${esc(t('common.expires'))}</th>
                  <th>${esc(t('invite.status'))}</th>
                  <th>${esc(t('common.actions'))}</th>
                </tr></thead>
                <tbody>
                  ${invites.map((invite) => `
                    <tr>
                      <td>
                        <span class="code-chip" data-copy="${esc(invite.code)}" title="${esc(t('invite.copyLink'))}">${esc(invite.code)}</span>
                        ${invite.note ? `<div class="tiny muted">${esc(invite.note)}</div>` : ''}
                      </td>
                      <td><span class="badge">${esc(invite.category || '-')}</span></td>
                      <td class="tiny" style="max-width:230px">
                        ${invitePermsOf(invite).map((perm) => {
                          const name = perm.moduleId === '*'
                            ? t('invite.allModules')
                            : (moduleMap.get(perm.moduleId) ? moduleName(moduleMap.get(perm.moduleId), lang) : '?');
                          const flags = [perm.read !== false ? t('invite.permRead') : t('common.noRead')];
                          if (perm.write) flags.push(t('invite.permWrite'));
                          if (perm.upload) flags.push(t('invite.permUpload'));
                          if (perm.readDays > 0) flags.push(t('invite.readDaysValue', { n: perm.readDays }));
                          return `<div class="nowrap"><strong>${esc(name)}</strong> · ${esc(flags.join(' / '))}</div>`;
                        }).join('')}
                      </td>
                      <td class="tiny nowrap">${invite.usedCount || 0} / ${invite.maxUses || '∞'}</td>
                      <td class="tiny nowrap">
                        ${invite.expiresAt ? `${esc(formatDay(invite.expiresAt))}<div class="muted">${esc(remainingText(invite.expiresAt, lang))}</div>` : esc(t('common.never'))}
                      </td>
                      <td>${statusBadge(invite)}</td>
                      <td>
                        <div class="row" style="gap:4px">
                          <button class="btn btn--xs" data-edit="${esc(invite.id)}">${esc(t('common.edit'))}</button>
                          <button class="btn btn--xs" data-toggle="${esc(invite.id)}">${esc(invite.active ? t('common.disable') : t('common.enable'))}</button>
                          <button class="btn btn--xs btn--danger" data-delete="${esc(invite.id)}">${esc(t('common.delete'))}</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : emptyState(t('invite.empty'), '码')}
        </div>
      </section>
    `;

    panel.querySelector('[data-role="new"]').addEventListener('click', () => openInviteForm(ctx, panel, modules));
    panel.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      openInviteForm(ctx, panel, modules, invites.find((i) => i.id === btn.dataset.edit));
    }));
    panel.querySelectorAll('[data-copy]').forEach((node) => node.addEventListener('click', async () => {
      await copyText(node.dataset.copy);
      toastOk(t('common.copied'));
    }));
    panel.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
      const invite = invites.find((i) => i.id === btn.dataset.toggle);
      try {
        await api.invites.update(invite.id, { active: !invite.active });
        invites = await api.invites.list();
        draw();
      } catch (error) { toastErr(errText(error)); }
    }));
    panel.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ message: t('invite.deleteConfirm'), danger: true, okText: t('common.delete') });
      if (!ok) return;
      try {
        await api.invites.remove(btn.dataset.delete);
        toastOk(t('invite.deleted'));
        invites = await api.invites.list();
        draw();
      } catch (error) { toastErr(errText(error)); }
    }));
  };

  draw();
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 邀请码的模块权限；旧邀请码没有 modulePerms，按全局 write 推导一份用于展示 / 编辑 */
function invitePermsOf(invite) {
  if (Array.isArray(invite.modulePerms) && invite.modulePerms.length) return invite.modulePerms;
  const ids = invite.allModules ? ['*'] : (invite.moduleIds || []);
  return ids.map((moduleId) => ({
    moduleId,
    read: true,
    write: Boolean(invite.write),
    upload: true,
    readDays: null,
  }));
}

function openInviteForm(ctx, panel, modules, invite) {
  const { api } = ctx;
  const lang = document.documentElement.dataset.lang;
  const editing = Boolean(invite);
  const initialPerms = invite ? invitePermsOf(invite) : [];
  const scopeInit = editing && initialPerms.length && !initialPerms.some((p) => p.moduleId === '*') ? 'some' : 'all';
  const durationInit = !editing ? '30' : (invite.expiresAt ? 'custom' : 'forever');

  const permRow = (moduleId, glyph, label, pickable) => `
    <div class="perm-row" data-perm-row="${esc(moduleId)}">
      ${pickable
        ? `<label class="checkbox perm-row__pick"><input type="checkbox" data-role="pick" /> <span>${esc(glyph)} ${esc(label)}</span></label>`
        : `<span class="perm-row__title">${esc(glyph)} ${esc(label)}</span>`}
      <div class="perm-row__opts">
        <label class="checkbox"><input type="checkbox" data-perm="read" checked /> <span class="small">${esc(t('invite.permRead'))}</span></label>
        <label class="checkbox"><input type="checkbox" data-perm="write" /> <span class="small">${esc(t('invite.permWrite'))}</span></label>
        <label class="checkbox"><input type="checkbox" data-perm="upload" /> <span class="small">${esc(t('invite.permUpload'))}</span></label>
        <input class="input perm-row__days" type="number" min="0" data-perm="days" placeholder="0 = ${esc(t('invite.readDaysUnlimited'))}" title="${esc(t('invite.readDays'))}" />
      </div>
    </div>
  `;

  const handle = openModal({
    title: editing ? `${t('invite.edit')} · ${invite.code}` : t('invite.new'),
    wide: true,
    body: `
      <div class="stack gap-2">
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.code'))}</label>
            <div class="row">
              <input class="input mono" data-role="code" placeholder="${esc(t('invite.codeHint'))}" style="text-transform:uppercase" value="${esc(invite?.code || '')}" ${editing ? 'readonly' : ''} />
              ${editing ? '' : `<button class="btn btn--sm" type="button" data-role="random" title="${esc(t('common.random'))}">${icon('sparkles', 14)}</button>`}
            </div>
            ${editing ? `<div class="field__hint">${esc(t('invite.codeReadonly'))}</div>` : ''}
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.category'))}</label>
            <input class="input" data-role="category" placeholder="${esc(t('invite.categoryPh'))}" value="${esc(invite?.category || '朋友')}" />
            <div class="field__hint">${esc(t('invite.categoryHint'))}</div>
          </div>
        </div>

        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.duration'))}</label>
            <select class="select" data-role="duration">
              ${DURATIONS.map((d) => `<option value="${esc(d.value)}" ${d.value === durationInit ? 'selected' : ''}>${esc(t(d.label))}</option>`).join('')}
            </select>
          </div>
          <div class="field ${durationInit === 'custom' ? '' : 'hidden'}" data-role="custom-wrap">
            <label class="field__label">${esc(t('invite.custom'))}</label>
            <input class="input" type="datetime-local" data-role="custom" value="${esc(toLocalInput(invite?.expiresAt))}" />
          </div>
        </div>

        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.uses'))}</label>
            <input class="input" type="number" min="1" data-role="maxUses" placeholder="${esc(t('invite.usesHint'))}" value="${invite?.maxUses ?? ''}" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.note'))}</label>
            <input class="input" data-role="note" placeholder="${esc(t('invite.notePh'))}" value="${esc(invite?.note || '')}" />
          </div>
        </div>

        <div class="field">
          <label class="field__label">${esc(t('invite.perms'))}</label>
          <div class="segmented" data-role="scope">
            <button type="button" data-scope="all" class="${scopeInit === 'all' ? 'is-active' : ''}">${esc(t('invite.allModules'))}</button>
            <button type="button" data-scope="some" class="${scopeInit === 'some' ? 'is-active' : ''}">${esc(t('invite.pickModules'))}</button>
          </div>
          <div class="stack gap-1 mt-2" data-role="perm-list">
            ${permRow('*', '✦', t('invite.allModules'), false)}
            ${modules.map((m) => permRow(m.id, m.icon, moduleName(m, lang), true)).join('')}
          </div>
          <div class="field__hint">${esc(t('invite.permsHint'))}</div>
        </div>

        <div class="form-error" data-role="error"></div>
      </div>
    `,
    footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="save">${editing ? esc(t('common.save')) : esc(t('invite.new'))}</button>`,
  });

  const scopeBox = handle.body.querySelector('[data-role="scope"]');
  const rows = Array.from(handle.body.querySelectorAll('[data-perm-row]')).map((node) => ({
    moduleId: node.dataset.permRow,
    node,
    pick: node.querySelector('[data-role="pick"]'),
    read: node.querySelector('[data-perm="read"]'),
    write: node.querySelector('[data-perm="write"]'),
    upload: node.querySelector('[data-perm="upload"]'),
    days: node.querySelector('[data-perm="days"]'),
  }));
  const allRow = rows.find((r) => r.moduleId === '*');
  const pickRows = rows.filter((r) => r.moduleId !== '*');
  let scope = scopeInit;

  const applyState = () => {
    const all = scope === 'all';
    allRow.node.classList.toggle('hidden', !all);
    for (const input of [allRow.read, allRow.write, allRow.upload, allRow.days]) input.disabled = !all;
    for (const row of pickRows) {
      const on = all || row.pick.checked;
      row.node.classList.toggle('hidden', all);
      row.node.classList.toggle('is-on', on);
      for (const input of [row.read, row.write, row.upload, row.days]) input.disabled = !on;
    }
  };

  if (editing && initialPerms.length) {
    for (const perm of initialPerms) {
      const row = rows.find((r) => r.moduleId === perm.moduleId);
      if (!row) continue;
      if (row.pick) row.pick.checked = true;
      row.read.checked = perm.read !== false;
      row.write.checked = Boolean(perm.write);
      row.upload.checked = Boolean(perm.upload);
      row.days.value = perm.readDays ?? '';
    }
  } else if (!editing) {
    allRow.read.checked = true;
    allRow.write.checked = true;
    allRow.upload.checked = true;
  }
  applyState();

  scopeBox.querySelectorAll('[data-scope]').forEach((btn) => btn.addEventListener('click', () => {
    scope = btn.dataset.scope;
    scopeBox.querySelectorAll('[data-scope]').forEach((b) => b.classList.toggle('is-active', b === btn));
    applyState();
  }));
  for (const row of pickRows) {
    row.pick.addEventListener('change', () => {
      if (row.pick.checked) row.read.checked = true;
      applyState();
    });
  }
  handle.body.querySelector('[data-role="random"]')?.addEventListener('click', (event) => {
    event.currentTarget.closest('.row').querySelector('[data-role="code"]').value = randomCode(10);
  });
  const durationSelect = handle.body.querySelector('[data-role="duration"]');
  durationSelect.addEventListener('change', () => {
    handle.body.querySelector('[data-role="custom-wrap"]').classList.toggle('hidden', durationSelect.value !== 'custom');
  });

  const collectPerms = () => {
    if (scope === 'all') {
      return [{
        moduleId: '*',
        read: allRow.read.checked,
        write: allRow.write.checked,
        upload: allRow.upload.checked,
        readDays: allRow.days.value ? Number(allRow.days.value) : null,
      }];
    }
    return pickRows.filter((r) => r.pick.checked).map((r) => ({
      moduleId: r.moduleId,
      read: r.read.checked,
      write: r.write.checked,
      upload: r.upload.checked,
      readDays: r.days.value ? Number(r.days.value) : null,
    }));
  };

  handle.footer.querySelector('[data-role="save"]').addEventListener('click', async () => {
    const errorBox = handle.body.querySelector('[data-role="error"]');
    errorBox.textContent = '';
    const perms = collectPerms().filter((p) => p.read || p.write || p.upload);
    if (!perms.length) { errorBox.textContent = t('invite.errNoPerm'); return; }
    const duration = durationSelect.value;
    const payload = {
      code: handle.body.querySelector('[data-role="code"]').value.trim(),
      category: handle.body.querySelector('[data-role="category"]').value.trim(),
      note: handle.body.querySelector('[data-role="note"]').value.trim(),
      maxUses: handle.body.querySelector('[data-role="maxUses"]').value || null,
      modulePerms: perms,
      moduleIds: perms.map((p) => p.moduleId),
      write: perms.some((p) => p.write),
    };
    if (duration === 'custom') {
      const custom = handle.body.querySelector('[data-role="custom"]').value;
      if (!custom) { errorBox.textContent = t('common.required'); return; }
      payload.expiresAt = new Date(custom).toISOString();
    } else if (duration === 'forever') {
      payload.expiresAt = null;
    } else {
      payload.expiresAt = new Date(Date.now() + Number(duration) * 86400000).toISOString();
    }
    try {
      if (editing) {
        await api.invites.update(invite.id, payload);
        toastOk(t('invite.updated'));
      } else {
        await api.invites.create(payload);
        toastOk(t('invite.created'));
      }
      handle.close();
      renderInvitesTab(ctx, panel);
    } catch (error) { errorBox.textContent = errText(error); }
  });
}
