/**
 * 体悟集 · 全局配置
 *
 * 想让它「真正支持多人 + 密码安全」，请填写下面的 supabase 配置，
 * 并按 supabase/schema.sql 在 Supabase 建表（详见 README.md）。
 *
 * 留空则自动运行在「本地模式」：数据保存在当前浏览器（IndexedDB），
 * 无需任何服务器，适合单人使用/演示；换设备或清缓存数据不会同步。
 */

export const CONFIG = {
  /** Supabase 项目地址，形如 https://abcdefg.supabase.co */
  supabaseUrl: 'https://gthztievqjovorlcwuwq.supabase.co',
  /**
   * Supabase 反向代理地址（中国大陆用户必填）。
   *
   * 实测中国大陆运营商对 *.supabase.co 做了基于 SNI 的 TLS 阻断：DNS 能解析、TCP 能连上，
   * 但 TLS 握手立刻被重置，因此直连必然失败。把 proxy/ 里的代理部署到一台大陆可达的
   * 主机后（推荐 Netlify，见 proxy/README.md），把它的地址填在这里，
   * 所有 /auth/v1、/rest/v1、/storage/v1、/functions/v1 请求都会改走该代理。
   *
   * 例：supabaseProxyUrl: 'https://insight-space-api.netlify.app'（本项目当前使用）
   *
   * 留空则直连 supabaseUrl（境外访问正常）。
   */
  supabaseProxyUrl: 'https://insight-space-api.netlify.app',
  /** Supabase publishable/anon public key（公开密钥，可安全放在前端） */
  supabaseAnonKey: 'sb_publishable_lM1FncNduX2y0PXDowgiQA_bvnbQE0q',
  /** 媒体存储桶名称（需要是 public bucket） */
  storageBucket: 'media',

  /** 单文件上传体积上限（MB） */
  maxUploadMB: 30,

  /**
   * 初始化设置。出于安全考虑，这里【不预置任何账号或密码】：
   * 首次打开站点会显示「初始化」表单，由你亲自设置超管的用户名与密码；
   * 站长（owner）账号请在登录后到「后台 → 账号管理」自行创建并设为「站长」。
   */
  bootstrap: {
    autoCreate: false,
    showCredentialHint: false,
    superadmin: { username: 'superadmin', nickname: '超管' },
    owner: { username: 'owner', nickname: '我' },
  },

  /** 站点信息 */
  site: {
    name: { zh: '体悟集', en: 'Insight' },
    tagline: { zh: '私人的体悟与收藏', en: 'A private collection of insights' },
    quote: { zh: '万物静观皆自得，四时佳兴与人同。', en: 'In quiet observation, everything reveals itself.' },
    footer: { zh: '体悟集 · 私人空间', en: 'Insight · private space' },
  },

  /** 新建模块时的默认项（也可以之后在后台改） */
  defaultModules: [
    { key: 'recommend', icon: '✦', nameZh: '推荐', nameEn: 'Featured', descZh: '按综合热度排序的精选内容', descEn: 'Highlights ranked by overall heat', sort: 0, hot: true },
    { key: 'diary', icon: '❀', nameZh: '日记', nameEn: 'Diary', descZh: '日常记录与随想', descEn: 'Daily notes', sort: 1 },
    { key: 'poem', icon: '❖', nameZh: '诗歌', nameEn: 'Poetry', descZh: '分行写下的句子', descEn: 'Lines and verses', sort: 2 },
    { key: 'copy', icon: '✎', nameZh: '文案', nameEn: 'Copywriting', descZh: '值得收藏的表达', descEn: 'Words worth keeping', sort: 3 },
    { key: 'review', icon: '☰', nameZh: '评论', nameEn: 'Reviews', descZh: '书、影、事、物的评论', descEn: 'Reviews and critiques', sort: 4 },
    { key: 'qa', icon: '❓', nameZh: '问答', nameEn: 'Q&A', descZh: '提出问题，分享回答', descEn: 'Ask questions, share answers', sort: 5, kind: 'qa' },
  ],
};

export const APP_VERSION = '1.0.0';

/** 去掉结尾多余的斜杠 */
function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/** 实际使用的 Supabase 基地址：配置了反向代理时优先走代理 */
export function resolveSupabaseUrl() {
  return trimSlash(CONFIG.supabaseProxyUrl) || trimSlash(CONFIG.supabaseUrl);
}

/**
 * 把指向 supabaseUrl（被阻断的域名）的绝对地址改写到当前使用的基地址。
 * 历史记录里的图片/视频地址是入库时写死的绝对地址，换了域名会全部裂图，必须重写。
 */
export function rewriteSupabaseUrls(value) {
  const from = trimSlash(CONFIG.supabaseUrl);
  const to = resolveSupabaseUrl();
  const source = String(value ?? '');
  if (!from || from === to || !source.includes(from)) return source;
  return source.split(from).join(to);
}

/** rewriteSupabaseUrls 的逆操作：入库前把代理地址还原成上游地址，保证数据与域名无关 */
export function toUpstreamSupabaseUrl(value) {
  const upstream = trimSlash(CONFIG.supabaseUrl);
  const proxy = resolveSupabaseUrl();
  const source = String(value ?? '');
  if (!upstream || upstream === proxy || !source.startsWith(proxy)) return source;
  return upstream + source.slice(proxy.length);
}
