/**
 * Supabase 反向代理（用于绕开中国大陆对 *.supabase.co 的 SNI 阻断）
 *
 * 背景：实测显示 `*.supabase.co` 的 TLS ClientHello 会被运营商直接 RST
 * （DNS 正常、TCP 可连，握手即断），而托管站点所在的 `*.github.io` 可正常访问。
 * 因此把站点留在 GitHub Pages，另找一台大陆可达的主机把 API 请求转发给 Supabase。
 *
 * 只允许转发到 SUPABASE_ORIGIN 指定的单个上游，不构成开放代理。
 *
 * 刻意使用 `redirect: 'manual'`：3xx 直接交回浏览器并把它回写的 *.supabase.co 地址
 * 改写成代理自身地址，由浏览器带着正确的方法与 Cookie 重新请求代理。
 * 若让边缘节点自行 follow，一旦上游的重定向目标恰好不可达就会变成 502。
 */

/** 默认上游：本项目使用的 Supabase 项目地址 */
export const DEFAULT_SUPABASE_ORIGIN = 'https://gthztievqjovorlcwuwq.supabase.co';

/** 需要代理的 API 前缀 */
const PROXIED_PREFIXES = ['/auth/v1', '/rest/v1', '/storage/v1', '/functions/v1', '/realtime/v1'];

/** 逐跳头，不应透传给上游或客户端 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** 由 fetch 依据实际响应体重新生成，或因运行时自动解压而失真，必须剔除 */
const STRIP_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': '*',
  // 前端用 `{ count: 'exact', head: true }` 统计评论数与未读数，依赖 Content-Range，
  // 浏览器默认不把它暴露给 JS，必须显式放开。
  'access-control-expose-headers': '*',
  'access-control-max-age': '86400',
};

function normalizeOrigin(value) {
  const origin = String(value || '').trim().replace(/\/+$/, '');
  if (!origin) return DEFAULT_SUPABASE_ORIGIN;
  if (!/^https?:\/\//i.test(origin)) throw new Error(`上游地址必须是完整的 http(s) URL：${origin}`);
  return origin;
}

function withCors(headers) {
  const out = new Headers(headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) out.set(key, value);
  return out;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
  });
}

/** 把上游回写的绝对地址改写成代理自身的地址，避免浏览器再次直连被阻断的域名 */
function rewriteLocation(location, upstreamOrigin, proxyOrigin) {
  if (!location) return location;
  try {
    const parsed = new URL(location, upstreamOrigin);
    if (parsed.origin !== upstreamOrigin) return location;
    return proxyOrigin + parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return location;
  }
}

/**
 * @param {{ upstream?: string, fetchImpl?: typeof fetch }} [options]
 *   upstream  上游 Supabase 项目地址
 *   fetchImpl 可替换的 fetch 实现（供本地测试注入桩）
 * @returns {(request: Request) => Promise<Response>}
 */
export function createProxyHandler(options = {}) {
  const upstream = normalizeOrigin(options.upstream);
  const upstreamOrigin = new URL(upstream).origin;
  const fetchImpl = options.fetchImpl || fetch;

  return async function handleRequest(request) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, upstream, time: new Date().toISOString() });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors({}) });
    }

    if (!PROXIED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))) {
      return json({ error: 'not_found', message: `不支持的路径：${url.pathname}` }, 404);
    }

    const headers = new Headers();
    for (const [name, value] of request.headers) {
      const key = name.toLowerCase();
      // host / origin / referer 由运行时按目标地址重算，透传会破坏上游的路由与签名校验
      if (HOP_BY_HOP.has(key) || key === 'host' || key === 'origin' || key === 'referer') continue;
      headers.set(key, value);
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const init = { method: request.method, headers, redirect: 'manual' };
    if (hasBody) {
      init.body = request.body;
      init.duplex = 'half';
    }

    let upstreamResponse;
    try {
      upstreamResponse = await fetchImpl(new URL(url.pathname + url.search, upstream), init);
    } catch (error) {
      return json({ error: 'bad_gateway', message: String(error?.message || error) }, 502);
    }

    const outHeaders = new Headers();
    for (const [name, value] of upstreamResponse.headers) {
      const key = name.toLowerCase();
      if (HOP_BY_HOP.has(key) || STRIP_RESPONSE_HEADERS.has(key)) continue;
      outHeaders.set(key, value);
    }
    const location = outHeaders.get('location');
    if (location) outHeaders.set('location', rewriteLocation(location, upstreamOrigin, url.origin));

    const status = upstreamResponse.status;
    const bodyless = request.method === 'HEAD' || status === 204 || status === 205 || status === 304;
    return new Response(bodyless ? null : upstreamResponse.body, { status, headers: withCors(outHeaders) });
  };
}
