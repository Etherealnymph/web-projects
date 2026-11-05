const key = 'ethereal.portal.v1';
const cards = [...document.querySelectorAll('.card')];
const entries = new Map();
for (const card of cards) {
  const anchor = card.querySelector('a.entry');
  if (!anchor) continue;
  const href = anchor.getAttribute('href');
  if (!entries.has(href))
    entries.set(href, {
      href,
      title: card.querySelector('h2')?.textContent || href,
      description: card.querySelector('p')?.textContent || '',
      search: card.dataset.search,
    });
}
let state = { favorites: [], recent: [], visited: [] };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved)
    for (const field of Object.keys(state))
      state[field] = Array.isArray(saved[field])
        ? saved[field].filter((href) => entries.has(href)).slice(0, 100)
        : [];
} catch {}
const save = () => {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    document.getElementById('recent-shelf').textContent = '浏览器未能保存记录，本次会话仍可使用。';
  }
};
function record(href) {
  state.recent = [href, ...state.recent.filter((value) => value !== href)].slice(0, 8);
  if (!state.visited.includes(href)) state.visited.push(href);
  save();
  renderShelves();
  renderPaths();
}
for (const card of cards) {
  const anchor = card.querySelector('a.entry');
  if (!anchor) continue;
  const href = anchor.getAttribute('href'),
    button = document.createElement('button');
  button.className = 'pin-button';
  button.type = 'button';
  button.textContent = '☆';
  button.setAttribute('aria-label', '收藏 ' + entries.get(href).title);
  button.addEventListener('click', () => {
    state.favorites = state.favorites.includes(href)
      ? state.favorites.filter((v) => v !== href)
      : [href, ...state.favorites];
    save();
    refreshPins();
    renderShelves();
    window.apply?.(false);
  });
  card.querySelector('.card-top').append(button);
  anchor.addEventListener('click', () => record(href));
}
function refreshPins() {
  for (const card of cards) {
    const href = card.querySelector('a.entry')?.getAttribute('href'),
      pinned = state.favorites.includes(href),
      button = card.querySelector('.pin-button');
    card.dataset.pinned = String(pinned);
    if (button) {
      button.textContent = pinned ? '★' : '☆';
      button.setAttribute('aria-pressed', String(pinned));
    }
  }
}
function link(href) {
  const entry = entries.get(href),
    a = document.createElement('a');
  a.href = href;
  a.textContent = entry.title;
  if (/^https?:/.test(href)) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  a.addEventListener('click', () => record(href));
  return a;
}
function renderShelves() {
  for (const [id, field, hint] of [
    ['favorite-shelf', 'favorites', '点击卡片上的 ☆，把常用工具放到这里。'],
    ['recent-shelf', 'recent', '打开一个项目，下次从这里接着做。'],
  ]) {
    const host = document.getElementById(id);
    host.replaceChildren();
    for (const href of state[field].slice(0, 8)) host.append(link(href));
    if (!host.children.length) {
      const p = document.createElement('p');
      p.textContent = hint;
      host.append(p);
    }
  }
}
const paths = [
  {
    name: '从直觉到电路',
    about: '观察 → 建模 → 测量 → 留下证据',
    steps: ['field-drift/', 'PN.html', 'circuit-lab/', 'silicon-notes/'],
  },
  {
    name: '做一块自己的 CPU',
    about: '从逻辑门、复用模块，到程序执行',
    steps: ['logic-loom/', 'WaveScope.html', 'silicon-notes/'],
  },
  {
    name: '模拟芯片设计台',
    about: '选拓扑 → 仿真 → 比较 → 复盘',
    steps: ['analog-atlas/', 'circuit-lab/', 'silicon-notes/'],
  },
];
function renderPaths() {
  const host = document.getElementById('learning-paths');
  host.replaceChildren();
  for (const path of paths) {
    const card = document.createElement('article');
    card.className = 'learning-path';
    const title = document.createElement('h3');
    title.textContent = path.name;
    const p = document.createElement('p');
    p.textContent = path.about;
    card.append(title, p);
    for (const [i, href] of path.steps.entries()) {
      if (!entries.has(href)) continue;
      const a = link(href);
      a.className = 'path-step';
      a.textContent = `${String(i + 1).padStart(2, '0')} ${entries.get(href).title}`;
      const status = document.createElement('span');
      status.textContent = state.visited.includes(href) ? '已打开' : '→';
      a.append(status);
      card.append(a);
    }
    host.append(card);
  }
}
document.getElementById('favorites-only').addEventListener('change', (event) => {
  window.portalFavoritesOnly = event.target.checked;
  window.apply?.(false);
});
document.getElementById('portal-random').addEventListener('click', () => {
  const local = [...entries.values()].filter((e) => !/^https?:/.test(e.href));
  const entry = local[Math.floor(Math.random() * local.length)];
  record(entry.href);
  location.href = entry.href;
});
const dialog = document.createElement('dialog');
dialog.className = 'portal-palette';
dialog.setAttribute('aria-label', '快速前往项目');
const close = document.createElement('button');
close.textContent = '关闭 Esc';
close.className = 'palette-close';
close.addEventListener('click', () => dialog.close());
const input = document.createElement('input');
input.placeholder = '输入项目名、关键词…';
input.setAttribute('aria-label', '快速前往搜索');
const list = document.createElement('div');
list.className = 'palette-results';
dialog.append(close, input, list);
document.body.append(dialog);
function searchPalette() {
  list.replaceChildren();
  const q = input.value.trim().toLowerCase();
  for (const entry of [...entries.values()]
    .filter((e) => `${e.title} ${e.search}`.toLowerCase().includes(q))
    .slice(0, 16)) {
    const a = link(entry.href),
      small = document.createElement('small');
    small.textContent = entry.description;
    a.append(small);
    list.append(a);
  }
}
function open() {
  searchPalette();
  dialog.showModal();
  input.focus();
}
input.addEventListener('input', searchPalette);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    list.querySelector('a')?.click();
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    list.querySelector('a')?.focus();
  }
});
document.getElementById('portal-palette-button').addEventListener('click', open);
window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (dialog.open) dialog.close();
    else open();
  }
  if (event.key === '/' && !event.target.closest('input,textarea')) {
    event.preventDefault();
    document.getElementById('search').focus();
  }
});
refreshPins();
renderShelves();
renderPaths();
