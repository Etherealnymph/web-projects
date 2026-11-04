import { t, tl } from '../core/i18n.js';
import { esc, clamp, copyText, downloadText } from '../core/util.js';
import { stripMarkdown } from '../core/markdown.js';
import { icon, toastOk, toastErr } from '../core/ui.js';

export function readingMinutes(source) {
  const text = stripMarkdown(source);
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[\p{L}\p{N}]+/gu) || []).length;
  return Math.max(1, Math.ceil(cjk / 400 + words / 220));
}

export function mountReader(ctx, content) {
  const body = ctx.container.querySelector('[data-role="body"]');
  const tools = ctx.container.querySelector('[data-role="reader-tools"]');
  if (!body || !tools || ctx.signal?.aborted) return;
  const headings = [...body.querySelectorAll('h1,h2,h3')];
  headings.forEach((heading, index) => { heading.id = `article-section-${index + 1}`; heading.tabIndex = -1; });
  tools.innerHTML = `
    <div class="reader-toolbar">
      <span class="tiny muted">${icon('clock', 14)} ${esc(tl(`约 ${readingMinutes(content.bodyMd)} 分钟`, `About ${readingMinutes(content.bodyMd)} min`))}</span>
      <span class="grow"></span>
      <button class="btn btn--sm btn--ghost" type="button" data-reader="focus" aria-pressed="false">${icon('eye', 15)} <span>${esc(tl('专注阅读', 'Focus'))}</span></button>
      <button class="btn btn--sm btn--ghost" type="button" data-reader="copy">${icon('link', 15)} ${esc(tl('复制链接', 'Copy link'))}</button>
      <button class="btn btn--sm btn--ghost" type="button" data-reader="export">${icon('file', 15)} Markdown</button>
    </div>
    ${headings.length >= 2 ? `<details class="reader-toc"><summary>${icon('ul', 15)} ${esc(tl('文章目录', 'On this page'))}<span class="tiny muted">${headings.length}</span></summary>
      <nav aria-label="${esc(tl('文章目录', 'Table of contents'))}">${headings.map((heading, index) => `<button type="button" class="reader-toc__item reader-toc__item--${heading.tagName.toLowerCase()}" data-section="${index}">${esc(heading.textContent)}</button>`).join('')}</nav></details>` : ''}
  `;
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', tl('阅读进度', 'Reading progress'));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.innerHTML = '<span></span>';
  ctx.container.prepend(bar);

  tools.addEventListener('click', async (event) => {
    const section = event.target.closest('[data-section]');
    if (section) {
      const heading = headings[Number(section.dataset.section)];
      heading?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      heading?.focus({ preventScroll: true });
      return;
    }
    const button = event.target.closest('[data-reader]');
    if (!button) return;
    if (button.dataset.reader === 'focus') {
      const active = document.body.classList.toggle('reader-focus');
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('span').textContent = active ? tl('退出专注', 'Exit focus') : tl('专注阅读', 'Focus');
    } else if (button.dataset.reader === 'copy') {
      const copied = await copyText(window.location.href);
      if (copied) toastOk(t('common.copied')); else toastErr(tl('复制失败，请复制浏览器地址栏链接。', 'Copy failed. Please copy the address from your browser.'));
    } else if (button.dataset.reader === 'export') {
      const filename = String(content.title || 'insight').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 100);
      downloadText(`${filename}.md`, `# ${content.title}\n\n${content.bodyMd || ''}\n`, 'text/markdown;charset=utf-8');
    }
  });

  let frame = 0;
  let lastPercent = -1;
  const update = () => {
    frame = 0;
    if (ctx.signal?.aborted) return;
    const rect = body.getBoundingClientRect();
    const top = document.querySelector('.topbar')?.getBoundingClientRect().height || 60;
    const distance = Math.max(1, rect.height - window.innerHeight + top + 24);
    const percent = rect.height <= window.innerHeight - top ? 100 : Math.round(clamp((top + 24 - rect.top) / distance, 0, 1) * 100);
    if (percent !== lastPercent) {
      bar.firstElementChild.style.transform = `scaleX(${percent / 100})`;
      bar.setAttribute('aria-valuenow', String(percent));
      lastPercent = percent;
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(body);
  ctx.onLeave(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.body.classList.remove('reader-focus');
    bar.remove();
  });
  update();
}
