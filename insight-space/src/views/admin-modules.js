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
                      <td class="tiny" style="max-width:210px">
                        ${invite.allModules ? esc(t('invite.allModules')) : (invite.moduleIds || []).map((id) => esc(moduleMap.get(id) ? moduleName(moduleMap.get(id), lang) : '?')).join('、')}
                        <div class="mt-1">${invite.write ? `<span class="badge badge--jade">${esc(t('common.write'))}</span>` : `<span class="badge">${esc(t('common.readonly'))}</span>`}</div>
                      </td>
                      <td class="tiny nowrap">${invite.usedCount || 0} / ${invite.maxUses || '∞'}</td>
                      <td class="tiny nowrap">
                        ${invite.expiresAt ? `${esc(formatDay(invite.expiresAt))}<div class="muted">${esc(remainingText(invite.expiresAt, lang))}</div>` : esc(t('common.never'))}
                      </td>
                      <td>${statusBadge(invite)}</td>
                      <td>
                        <div class="row" style="gap:4px">
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

function openInviteForm(ctx, panel, modules) {
  const { api } = ctx;
  const handle = openModal({
    title: t('invite.new'),
    wide: true,
    body: `
      <div class="stack gap-2">
        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.code'))}</label>
            <div class="row">
              <input class="input mono" data-role="code" placeholder="${esc(t('invite.codeHint'))}" style="text-transform:uppercase" />
              <button class="btn btn--sm" type="button" data-role="random" title="随机">${icon('sparkles', 14)}</button>
            </div>
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.category'))}</label>
            <input class="input" data-role="category" placeholder="${esc(t('invite.categoryPh'))}" value="朋友" />
            <div class="field__hint">${esc(t('invite.categoryHint'))}</div>
          </div>
        </div>

        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.duration'))}</label>
            <select class="select" data-role="duration">
              ${DURATIONS.map((d, index) => `<option value="${esc(d.value)}" ${index === 2 ? 'selected' : ''}>${esc(t(d.label))}</option>`).join('')}
            </select>
          </div>
          <div class="field hidden" data-role="custom-wrap">
            <label class="field__label">${esc(t('invite.custom'))}</label>
            <input class="input" type="datetime-local" data-role="custom" />
          </div>
        </div>

        <div class="grid grid--2">
          <div class="field">
            <label class="field__label">${esc(t('invite.uses'))}</label>
            <input class="input" type="number" min="1" data-role="maxUses" placeholder="${esc(t('invite.usesHint'))}" />
          </div>
          <div class="field">
            <label class="field__label">${esc(t('invite.note'))}</label>
            <input class="input" data-role="note" placeholder="${esc(t('invite.notePh'))}" />
          </div>
        </div>

        <div class="field">
          <label class="field__label">${esc(t('invite.modules'))}</label>
          <label class="checkbox"><input type="checkbox" data-role="all" checked /> <span>${esc(t('invite.allModules'))}</span></label>
          <div class="row row--wrap mt-1" data-role="module-list">
            ${modules.map((m) => `<label class="checkbox chip"><input type="checkbox" value="${esc(m.id)}" disabled /> <span>${esc(m.icon)} ${esc(moduleName(m, document.documentElement.dataset.lang))}</span></label>`).join('')}
          </div>
        </div>

        <label class="checkbox"><input type="checkbox" data-role="write" checked /> <span>${esc(t('invite.write'))} · <span class="muted small">${esc(t('invite.writeHint'))}</span></span></label>
        <div class="form-error" data-role="error"></div>
      </div>
    `,
    footer: `<button class="btn" data-modal-close>${esc(t('common.cancel'))}</button><button class="btn btn--primary" data-role="save">${esc(t('invite.new'))}</button>`,
  });

  const allBox = handle.body.querySelector('[data-role="all"]');
  const moduleBoxes = Array.from(handle.body.querySelectorAll('[data-role="module-list"] input'));
  allBox.addEventListener('change', () => {
    moduleBoxes.forEach((box) => { box.disabled = allBox.checked; if (allBox.checked) box.checked = false; });
  });
  handle.body.querySelector('[data-role="random"]').addEventListener('click', () => {
    handle.body.querySelector('[data-role="code"]').value = randomCode(10);
  });
  const durationSelect = handle.body.querySelector('[data-role="duration"]');
  durationSelect.addEventListener('change', () => {
    handle.body.querySelector('[data-role="custom-wrap"]').classList.toggle('hidden', durationSelect.value !== 'custom');
  });

  handle.footer.querySelector('[data-role="save"]').addEventListener('click', async () => {
    const errorBox = handle.body.querySelector('[data-role="error"]');
    errorBox.textContent = '';
    const duration = durationSelect.value;
    const payload = {
      code: handle.body.querySelector('[data-role="code"]').value.trim(),
      category: handle.body.querySelector('[data-role="category"]').value.trim(),
      note: handle.body.querySelector('[data-role="note"]').value.trim(),
      maxUses: handle.body.querySelector('[data-role="maxUses"]').value || null,
      moduleIds: allBox.checked ? ['*'] : moduleBoxes.filter((b) => b.checked).map((b) => b.value),
      write: handle.body.querySelector('[data-role="write"]').checked,
    };
    if (duration === 'custom') {
      const custom = handle.body.querySelector('[data-role="custom"]').value;
      if (!custom) { errorBox.textContent = t('common.required'); return; }
      payload.expiresAt = new Date(custom).toISOString();
    } else if (duration !== 'forever') {
      payload.durationDays = Number(duration);
    }
    if (!payload.moduleIds.length) { errorBox.textContent = t('invite.errNoModule'); return; }
    try {
      await api.invites.create(payload);
      toastOk(t('invite.created'));
      handle.close();
      renderInvitesTab(ctx, panel);
    } catch (error) { errorBox.textContent = errText(error); }
  });
}
