/**
 * 轻量、安全的 Markdown 渲染器（无第三方依赖）。
 *
 * 设计目标：
 * 1. 先转义 HTML，再生成标签 —— 用户输入无法注入脚本；
 * 2. 支持链接、图片、粗体、斜体、删除线、行内代码、代码块、标题、
 *    引用、有序/无序列表、任务列表、表格、分割线；
 * 3. 额外支持体悟集自定义指令（用于媒体与表情包）：
 *      ::video[url]            视频
 *      ::audio[url]            音频 / 语音
 *      ::file[url|文件名]       文档附件
 *      ::sticker[名字或url]     表情包
 */

const BLOCK_PLACEHOLDER = '\u0000B';
const INLINE_PLACEHOLDER = '\u0000I';

/** HTML 转义 */
export function escapeHtml(input) {
  return String(input == null ? '' : input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 反转义（用于取回指令参数里的原始 url） */
function unescapeHtml(input) {
  return String(input)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const SAFE_SCHEME = /^(https?:|mailto:|tel:|data:(image|audio|video)\/|blob:|idb:|\.\/|\.\.\/|\/|#)/i;

/** 过滤危险协议，返回可安全放入 href/src 的地址 */
export function safeUrl(raw) {
  const url = unescapeHtml(String(raw == null ? '' : raw)).trim().replace(/^<|>$/g, '');
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return SAFE_SCHEME.test(url) ? url : '';
  }
  if (url.startsWith('//')) return '';
  return url;
}

export const BUILTIN_STICKERS = ['tea', 'moon', 'star', 'cloud', 'leaf', 'heart', 'pen', 'sparkle', 'rocket', 'coffee-cat'];

/** 把 ::sticker[x] 的参数解析成图片地址 */
export function stickerUrl(token) {
  const value = unescapeHtml(String(token || '').trim());
  if (!value) return '';
  if (/^[a-z0-9-]+$/i.test(value)) return `./assets/stickers/${value}.svg`;
  return safeUrl(value);
}

function renderDirective(name, payload) {
  const [rawTarget, ...rest] = String(payload).split('|');
  const caption = rest.join('|').trim();
  switch (name) {
    case 'video': {
      const src = safeUrl(rawTarget);
      if (!src) return '';
      const cap = caption ? `<figcaption>${caption}</figcaption>` : '';
      return `</p><figure class="media-figure"><video class="media-video" controls preload="metadata" src="${escapeHtml(src)}"></video>${cap}</figure><p>`;
    }
    case 'audio': {
      const src = safeUrl(rawTarget);
      if (!src) return '';
      return `</p><p><span class="voice-bubble"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"/></svg><audio class="media-audio" controls preload="metadata" src="${escapeHtml(src)}"></audio></span></p><p>`;
    }
    case 'file': {
      const src = safeUrl(rawTarget);
      if (!src) return '';
      const name = caption || decodeURIComponent(src.split('/').pop() || 'document');
      return `<a class="file-chip" href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg><span class="file-chip__name">${escapeHtml(name)}</span></a>`;
    }
    case 'sticker': {
      const src = stickerUrl(rawTarget);
      if (!src) return '';
      return `<img class="sticker" src="${escapeHtml(src)}" alt="sticker" loading="lazy" />`;
    }
    default:
      return '';
  }
}

const URL_PART = '([^()\\s]*(?:\\([^()\\s]*\\)[^()\\s]*)*)';

/** 行内解析：先转义，再生成标签（输入是原始文本） */
function renderInline(text, ctx) {
  let out = escapeHtml(text);

  // 行内代码
  out = out.replace(/`([^`\n]+)`/g, (m, code) => ctx.inline(`<code>${code}</code>`));
  // 图片
  out = out.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${URL_PART}(?:\\s+&quot;([^&]*)&quot;)?\\)`, 'g'), (m, alt, url, title) => {
    const src = safeUrl(url);
    if (!src) return m;
    const t = title ? ` title="${title}"` : '';
    return ctx.inline(`<img src="${escapeHtml(src)}" alt="${alt}"${t} loading="lazy" />`);
  });
  // 链接
  out = out.replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_PART}(?:\\s+&quot;([^&]*)&quot;)?\\)`, 'g'), (m, label, url, title) => {
    const href = safeUrl(url);
    if (!href) return label;
    const t = title ? ` title="${title}"` : '';
    return ctx.inline(`<a href="${escapeHtml(href)}"${t} target="_blank" rel="noopener noreferrer">${label}</a>`);
  });
  // 自定义指令
  out = out.replace(/::(video|audio|file|sticker)\[([^\]]*)\]/g, (m, name, payload) => ctx.block(renderDirective(name, payload), true));
  // 加粗 / 斜体 / 删除线
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(（])__([^_\n]+)__(?=[\s)）.,!?，。！？]|$)/g, '$1<strong>$2</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  // 自动链接
  out = out.replace(/(^|[\s(（])(https?:\/\/[^\s<]+)/g, (m, pre, url) => `${pre}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  return out;
}

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim());
}

const RE = {
  heading: /^(#{1,6})\s+(.*)$/,
  hr: /^\s*(-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^\s*>\s?(.*)$/,
  ul: /^(\s*)[-*+]\s+(.*)$/,
  ol: /^(\s*)\d+[.)]\s+(.*)$/,
  task: /^\[([ xX])\]\s+(.*)$/,
  tableSep: /^\s*\|?[\s:|-]+\|[\s:|-]*$/,
};

/** 渲染 Markdown 为 HTML 字符串 */
export function renderMarkdown(source) {
  const ctx = { n: 0, blocks: [], inlines: [] };
  ctx.block = (html, isInline) => {
    if (isInline) { ctx.inlines.push(html); return `${INLINE_PLACEHOLDER}${ctx.inlines.length - 1}\u0000`; }
    ctx.blocks.push(html);
    return `${BLOCK_PLACEHOLDER}${ctx.blocks.length - 1}\u0000`;
  };
  ctx.inline = (html) => {
    ctx.inlines.push(html);
    return `${INLINE_PLACEHOLDER}${ctx.inlines.length - 1}\u0000`;
  };

  const src = String(source == null ? '' : source).replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const out = [];

  const flushParagraph = (buffer) => {
    if (!buffer.length) return;
    const joined = buffer.map((l) => renderInline(l.trim(), ctx)).join('<br />');
    out.push(`<p>${joined}</p>`);
    buffer.length = 0;
  };

  const paragraph = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 代码块
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flushParagraph(paragraph);
      const lang = fence[1].trim();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i += 1; }
      const cls = lang ? ` class="language-${escapeHtml(lang.replace(/[^\w-]/g, ''))}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) { flushParagraph(paragraph); continue; }
    if (/^\s*$/.test(line) || RE.hr.test(line)) {
      if (RE.hr.test(line)) { flushParagraph(paragraph); out.push('<hr />'); continue; }
    }

    const heading = line.match(RE.heading);
    if (heading) {
      flushParagraph(paragraph);
      const level = Math.min(heading[1].length, 6);
      out.push(`<h${level}>${renderInline(heading[2].trim(), ctx)}</h${level}>`);
      continue;
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('|')) {
      flushParagraph(paragraph);
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(splitRow(lines[i])); i += 1; }
      i -= 1;
      const th = head.map((c) => `<th>${renderInline(c, ctx)}</th>`).join('');
      const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c, ctx)}</td>`).join('')}</tr>`).join('');
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`);
      continue;
    }

    // 引用
    if (RE.quote.test(line)) {
      flushParagraph(paragraph);
      const buf = [];
      while (i < lines.length && RE.quote.test(lines[i])) { buf.push(lines[i].match(RE.quote)[1]); i += 1; }
      i -= 1;
      out.push(`<blockquote>${buf.map((l) => renderInline(l, ctx)).join('<br />')}</blockquote>`);
      continue;
    }

    // 无序列表 / 任务列表
    if (RE.ul.test(line)) {
      flushParagraph(paragraph);
      const items = [];
      while (i < lines.length && RE.ul.test(lines[i])) {
        let content = lines[i].match(RE.ul)[2];
        const task = content.match(RE.task);
        if (task) {
          const checked = task[1].toLowerCase() === 'x' ? ' checked disabled' : ' disabled';
          content = `<input type="checkbox"${checked} /> ${renderInline(task[2], ctx)}`;
          items.push(`<li class="task-item">${content}</li>`);
        } else {
          items.push(`<li>${renderInline(content, ctx)}</li>`);
        }
        i += 1;
      }
      i -= 1;
      out.push(`<ul${items.some((x) => x.includes('task-item')) ? ' class="task-list"' : ''}>${items.join('')}</ul>`);
      continue;
    }

    // 有序列表
    if (RE.ol.test(line)) {
      flushParagraph(paragraph);
      const items = [];
      while (i < lines.length && RE.ol.test(lines[i])) { items.push(`<li>${renderInline(lines[i].match(RE.ol)[2], ctx)}</li>`); i += 1; }
      i -= 1;
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    paragraph.push(line);
  }
  flushParagraph(paragraph);

  let html = out.join('\n');
  // 还原行内 / 媒体占位
  html = html.replace(new RegExp(`${INLINE_PLACEHOLDER}(\\d+)\\u0000`, 'g'), (m, idx) => ctx.inlines[Number(idx)] || '');
  html = html.replace(new RegExp(`${BLOCK_PLACEHOLDER}(\\d+)\\u0000`, 'g'), (m, idx) => ctx.blocks[Number(idx)] || '');
  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '').replace(/<\/p>\s*<p>/g, '</p><p>');
  return html.trim();
}

/** 去掉 Markdown 标记，得到纯文本（用于摘要 / 搜索） */
export function stripMarkdown(source) {
  return String(source == null ? '' : source)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/::(video|audio|file|sticker)\[[^\]]*\]/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 生成摘要 */
export function excerpt(source, length = 110) {
  const text = stripMarkdown(source);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/** 从 Markdown 中找出第一张图片，用于封面 */
export function firstImage(source) {
  const match = String(source || '').match(/!\[[^\]]*\]\(([^)\s]+)/);
  return match ? safeUrl(match[1]) : '';
}
