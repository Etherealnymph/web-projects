/** 主题（日间 / 夜间）与语言（中文 / 英文）切换 */

const THEME_KEY = 'tiwu.theme';
const LANG_KEY = 'tiwu.lang';
const FONT_KEY = 'tiwu.fontScale';

/** 界面字号档位（整站等比缩放，由 CSS 变量 --font-scale 驱动） */
export const FONT_STEPS = ['0.9', '1', '1.125', '1.25'];

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

export const font = {
  current: '1',
  steps: FONT_STEPS,
  apply(scale) {
    const next = FONT_STEPS.includes(String(scale)) ? String(scale) : '1';
    this.current = next;
    document.documentElement.style.setProperty('--font-scale', next);
    try { localStorage.setItem(FONT_KEY, next); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent('font:change', { detail: { scale: next } }));
  },
  init() {
    let saved = '1';
    try { saved = localStorage.getItem(FONT_KEY) || '1'; } catch { /* ignore */ }
    // 初始化时不派发事件，避免启动阶段多一次渲染
    this.current = FONT_STEPS.includes(saved) ? saved : '1';
    document.documentElement.style.setProperty('--font-scale', this.current);
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
