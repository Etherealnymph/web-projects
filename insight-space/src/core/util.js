/** 通用工具函数 */

export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function nowIso() { return new Date().toISOString(); }

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export function debounce(fn, wait = 250) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function uniq(list) { return Array.from(new Set(list)); }

/** 经验值来源（与后端触发器保持一致） */
export const EXP = {
  content: 10,   // 发布内容（含提问）
  comment: 5,    // 回答 / 评论
  like: 2,       // 内容或回答被点赞
  favorite: 5,   // 内容或回答被收藏
};

/** 由经验值推导等级：Lv n 需要 20·(n-1)² 经验 */
export function expLevel(exp) {
  const e = Math.max(0, Math.floor(Number(exp) || 0));
  return Math.floor(Math.sqrt(e / 20)) + 1;
}

/** 等级进度：当前等级、距下一级所需经验、百分比 */
export function expProgress(exp) {
  const e = Math.max(0, Math.floor(Number(exp) || 0));
  const level = expLevel(e);
  const cur = 20 * (level - 1) * (level - 1);
  const next = 20 * level * level;
  const need = next - cur;
  const current = e - cur;
  return {
    level,
    exp: e,
    current,
    need,
    next,
    pct: Math.min(100, Math.max(0, Math.round((current / need) * 100))),
  };
}

/** 相对时间 */
export function fromNow(iso, lang = 'zh') {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const diff = Date.now() - then;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  const zh = lang === 'zh';
  if (diff < min) return zh ? '刚刚' : 'just now';
  if (diff < hour) return zh ? `${Math.floor(diff / min)} 分钟前` : `${Math.floor(diff / min)} min ago`;
  if (diff < day) return zh ? `${Math.floor(diff / hour)} 小时前` : `${Math.floor(diff / hour)} h ago`;
  if (diff < 30 * day) return zh ? `${Math.floor(diff / day)} 天前` : `${Math.floor(diff / day)} d ago`;
  return formatDate(iso, lang);
}

export function formatDate(iso, lang = 'zh') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return lang === 'zh' ? `${y}-${m}-${d} ${hh}:${mm}` : `${y}-${m}-${d} ${hh}:${mm}`;
}

export function formatDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 剩余时间描述 */
export function remainingText(expiresAt, lang = 'zh') {
  if (!expiresAt) return lang === 'zh' ? '永久' : 'never';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return lang === 'zh' ? '已过期' : 'expired';
  const day = Math.floor(diff / 86400000);
  const hour = Math.floor((diff % 86400000) / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  if (lang === 'zh') {
    if (day > 0) return `${day} 天 ${hour} 小时`;
    if (hour > 0) return `${hour} 小时 ${min} 分`;
    return `${min} 分钟`;
  }
  if (day > 0) return `${day}d ${hour}h`;
  if (hour > 0) return `${hour}h ${min}m`;
  return `${min}m`;
}

/** 综合热度：互动加权 + 时间衰减 */
export function hotScore(content) {
  const c = content.counts || {};
  const likes = c.like || 0;
  const dislikes = c.dislike || 0;
  const favorites = c.favorite || 0;
  const comments = c.comment || 0;
  const views = content.views || 0;
  const base = likes * 3 + favorites * 2.5 + comments * 2.5 - dislikes * 1.5 + views * 0.12;
  const hours = Math.max(0, (Date.now() - new Date(content.createdAt || Date.now()).getTime()) / 3600000);
  return base / Math.pow(hours + 2, 0.65);
}

export const SORTS = {
  hot: (a, b) => hotScore(b) - hotScore(a),
  new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  old: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  like: (a, b) => (b.counts?.like || 0) - (a.counts?.like || 0) || hotScore(b) - hotScore(a),
};

export function sortContents(list, mode = 'new') {
  const fn = SORTS[mode] || SORTS.new;
  return list.slice().sort(fn);
}

export function bytesText(size) {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name) {
  const text = String(name || '?').trim();
  if (!text) return '?';
  if (/[\u4e00-\u9fa5]/.test(text)) return text.slice(-2);
  return text.slice(0, 2).toUpperCase();
}

export function bytesToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 把图片等比缩放并居中裁剪成边长 maxSize 的方形图，返回 Blob。
 * PNG 保留透明通道，其余格式统一编码为 JPEG；解码失败时原样返回。
 */
export async function squareImage(file, maxSize = 256) {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('image.decodeFail'));
      node.src = source;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) return file;
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    canvas.getContext('2d').drawImage(
      image,
      (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
      0, 0, maxSize, maxSize,
    );
    const toPng = file.type === 'image/png';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, toPng ? 'image/png' : 'image/jpeg', 0.9));
    return blob || file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 回退方案 */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickText(obj, base) {
  if (!obj) return '';
  const lang = document.documentElement.dataset.lang || 'zh';
  const suffix = lang === 'zh' ? 'Zh' : 'En';
  return obj[`${base}${suffix}`] || obj[`${base}Zh`] || obj[base] || '';
}

export function randomCode(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** 简易 HTML 转义（与 markdown.js 保持一致） */
export function esc(input) {
  return String(input == null ? '' : input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function qs(root, selector) { return root ? root.querySelector(selector) : null; }
export function qsa(root, selector) { return root ? Array.from(root.querySelectorAll(selector)) : []; }

/** 创建元素 */
export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  if (html) node.innerHTML = html;
  return node;
}

/** 给日期分组（用于时间线） */
export function groupByDay(list, lang = 'zh') {
  const groups = new Map();
  for (const item of list) {
    const key = formatDay(item.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.entries());
}
