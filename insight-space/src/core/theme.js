/** 主题（日间 / 夜间）与语言（中文 / 英文）切换 */

const THEME_KEY = 'tiwu.theme';
const LANG_KEY = 'tiwu.lang';

export const theme = {
  current: 'light',
  apply(mode) {
    const next = mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    this.current = mode;
    this.resolved = next;
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent('theme:change', { detail: { mode, resolved: next } }));
  },
  toggle() {
    const resolved = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    this.apply(resolved);
    return resolved;
  },
  init() {
    let saved = 'light';
    try { saved = localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { /* ignore */ }
    this.apply(saved);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.current === 'auto') this.apply('auto');
    });
  },
};

export const lang = {
  current: 'zh',
  apply(next) {
    this.current = next === 'en' ? 'en' : 'zh';
    document.documentElement.dataset.lang = this.current;
    document.documentElement.lang = this.current === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem(LANG_KEY, this.current); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent('lang:change', { detail: { lang: this.current } }));
  },
  toggle() {
    this.apply(this.current === 'zh' ? 'en' : 'zh');
    return this.current;
  },
  init() {
    let saved = 'zh';
    try {
      saved = localStorage.getItem(LANG_KEY)
        || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh');
    } catch { /* ignore */ }
    this.apply(saved);
  },
};
