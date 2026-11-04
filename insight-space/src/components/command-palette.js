import { t, tl } from '../core/i18n.js';
import { esc } from '../core/util.js';
import { icon, openModal } from '../core/ui.js';

/** Small, lazy-loaded keyboard launcher; it never prefetches private content. */
export function openCommandPalette({ user, modules, navigate }) {
  const commands = [
    { label: t('nav.home'), route: '#/', icon: 'grid' },
    ...(user ? [
      { label: t('content.new'), route: '#/edit', icon: 'edit' },
      { label: t('nav.favorites'), route: '#/favorites', icon: 'bookmark' },
      { label: t('nav.messages'), route: '#/msg', icon: 'chat' },
      { label: t('nav.profile'), route: '#/me', icon: 'user' },
      { label: t('nav.ranking'), route: '#/rank', icon: 'fire' },
      ...modules.filter((module) => module.access.visible).map((module) => ({
        label: tl(module.nameZh, module.nameEn || module.nameZh), route: `#/m/${encodeURIComponent(module.id)}`, icon: 'folder',
      })),
      ...(['owner', 'superadmin'].includes(user.role) ? [{ label: t('nav.admin'), route: '#/admin', icon: 'shield' }] : []),
    ] : [{ label: t('nav.login'), route: '#/login', icon: 'user' }]),
    { label: t('settings.title'), route: '#/settings', icon: 'settings' },
  ];
  const handle = openModal({
    title: tl('快速前往', 'Go to'),
    className: 'command-palette',
    body: `<label class="sr-only" for="command-input">${esc(tl('搜索内容或页面', 'Find content or a page'))}</label>
      <input class="input" id="command-input" data-role="command-input" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-options" placeholder="${esc(tl('搜索内容，或输入页面名称…', 'Search content, or enter a page name…'))}" autocomplete="off" maxlength="200" />
      <div class="command-options" id="command-options" role="listbox" aria-label="${esc(tl('可执行操作', 'Actions'))}"></div>
      <div class="tiny muted">↑ ↓ ${esc(tl('选择', 'Choose'))} · Enter ${esc(tl('打开', 'Open'))} · Esc ${esc(t('common.close'))}</div>`,
  });
  const input = handle.body.querySelector('input');
  const list = handle.body.querySelector('[role="listbox"]');
  let matches = [];
  let selected = 0;
  const go = (index) => {
    const command = matches[index];
    if (!command) return;
    handle.close();
    navigate(command.route);
  };
  function select(index) {
    selected = matches.length ? (index + matches.length) % matches.length : 0;
    [...list.children].forEach((node, i) => node.setAttribute('aria-selected', String(i === selected)));
    const node = list.children[selected];
    if (node) {
      input.setAttribute('aria-activedescendant', node.id);
      node.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function draw() {
    const query = input.value.trim();
    matches = commands.filter((command) => command.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (query && user) matches.unshift({ label: `${t('common.search')} “${query}”`, route: `#/search?q=${encodeURIComponent(query)}`, icon: 'search' });
    list.innerHTML = matches.map((command, i) => `<button type="button" role="option" tabindex="-1" aria-selected="${i === 0}" id="command-${i}" data-index="${i}">${icon(command.icon, 17)}<span>${esc(command.label)}</span></button>`).join('');
    select(0);
  }
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(selected + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') { event.preventDefault(); go(selected); }
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (button) go(Number(button.dataset.index));
  });
  draw();
  return handle;
}
