/** 设置：主题、界面字号、语言 */

import { t } from '../core/i18n.js';
import { icon, segmented } from '../core/ui.js';
import { esc } from '../core/util.js';
import { theme, lang, font, FONT_STEPS } from '../core/theme.js';

const FONT_LABELS = { '0.9': 'settings.font-s', '1': 'settings.font-m', '1.125': 'settings.font-l', '1.25': 'settings.font-xl' };

export async function renderSettings(ctx) {
  const { container } = ctx;

  const themeItems = [
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
    { value: 'auto', label: t('theme.auto') },
  ];
  const fontItems = FONT_STEPS.map((value) => ({ value, label: t(FONT_LABELS[value]) }));
  const langItems = [
    { value: 'zh', label: t('lang.zh') },
    { value: 'en', label: t('lang.en') },
  ];

  container.innerHTML = `
    <div class="settings">
      <section class="panel">
        <div class="panel__head">
          <span class="panel__title">${icon('settings', 16)} ${esc(t('settings.title'))}</span>
          <span class="tiny muted grow">${esc(t('settings.subtitle'))}</span>
        </div>
      </section>

      <div class="grid grid--2 mt-2">
        <section class="panel">
          <div class="panel__head"><span class="panel__title">${esc(t('settings.appearance'))}</span></div>
          <div class="panel__body stack gap-2">
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>${esc(t('settings.theme'))}</strong>
                <span class="tiny muted">${esc(t('settings.themeHint'))}</span>
              </div>
              <div data-role="theme">${segmented(themeItems, theme.current)}</div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>${esc(t('settings.font'))}</strong>
                <span class="tiny muted">${esc(t('settings.fontHint'))}</span>
              </div>
              <div data-role="font">${segmented(fontItems, font.current)}</div>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>${esc(t('settings.lang'))}</strong>
                <span class="tiny muted">${esc(t('settings.langHint'))}</span>
              </div>
              <div data-role="lang">${segmented(langItems, lang.current)}</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel__head"><span class="panel__title">${esc(t('settings.preview'))}</span></div>
          <div class="panel__body">
            <h3 class="card__title">${esc(t('app.name'))}</h3>
            <p class="muted">${esc(t('settings.previewText'))}</p>
            <div class="row row--wrap">
              <button class="btn btn--primary btn--sm" type="button">${icon('plus', 14)} ${esc(t('content.new'))}</button>
              <span class="badge badge--accent">${esc(t('nav.ranking'))}</span>
              <span class="badge badge--jade">Markdown</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  const mark = (role, value) => {
    container.querySelectorAll(`[data-role="${role}"] [data-value]`)
      .forEach((node) => node.classList.toggle('is-active', node.dataset.value === value));
  };

  container.querySelector('[data-role="theme"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    theme.apply(btn.dataset.value);
    mark('theme', btn.dataset.value);
  });

  container.querySelector('[data-role="font"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    font.apply(btn.dataset.value);
    mark('font', btn.dataset.value);
  });

  container.querySelector('[data-role="lang"]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-value]');
    if (!btn) return;
    lang.apply(btn.dataset.value); // lang:change 会重建外壳与视图
  });
}
