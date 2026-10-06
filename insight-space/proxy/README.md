# Supabase 反向代理

## 为什么需要它

中国大陆运营商对 `*.supabase.co` 做了**基于 SNI 的 TLS 阻断**：DNS 能解析、TCP 三次握手能成功，
但 TLS ClientHello 一发出去就被重置（`curl` 表现为 `HTTP 000`，浏览器表现为 `ERR_CONNECTION_RESET`）。

实测对比（成都 · 中国移动 · 无代理裸连）：

| 域名 | 结果 |
| --- | --- |
| `*.supabase.co`（含本项目子域） | **000，TLS 被重置** |
| `supabase.com` / `api.supabase.com` | 200 / 404（通） |
| `etherealnymph.github.io` | 200（通） |
| `*.netlify.app` | 200（通） |
| `*.deno.dev` | 200（通） |
| `dash.deno.com` / `api.deno.com` | **000（被阻断，无法从大陆管理）** |
| `*.vercel.app` / `*.pages.dev` / `*.workers.dev` | 000（被阻断） |

所以：**站点本身在大陆是能打开的，打不开的只有 Supabase 的 API 域名。**
把 Supabase 的 API 套一层大陆可达的域名即可，不需要换掉 Supabase。

> 为什么不用国内云？CloudBase / 微信云托管等都需要**实名认证 + ICP 备案域名**，而且数据库是文档型，
> 没有 PostgREST 兼容层，等于要把数据、认证、存储三层全部重写。LeanCloud 已公告 2027-01-12 全面关停。
> Cloudflare 中国网络需要 Enterprise 套餐 + ICP 备案。因此「保留 Supabase + 反向代理」是成本最低的方案。

---

## 方案 A（推荐）：Netlify 纯 CDN 代理，零代码

Netlify 的 `_redirects` 支持「外部 URL + 状态码 200」的原样转发。它跑在 Netlify 的 CDN 边缘，
**不经过 Serverless Function**，因此没有 6 MB 的请求体限制，30 MB 的媒体上传也能过。

```powershell
# 1) 把 proxy\netlify 目录拖到 https://app.netlify.com/drop
#    （或先压成 zip 再上传：Compress-Archive -Path proxy\netlify\* -DestinationPath proxy.zip）
# 2) 得到形如 https://xxxx.netlify.app 的域名，点 “Claim this site” 用 GitHub 登录认领，
#    认领后才会永久保留，并且会去掉临时密码保护。
# 3) 把域名填进 src/config.js：
#      supabaseProxyUrl: 'https://xxxx.netlify.app',
```

规则文件是 [`netlify/_redirects`](./netlify/_redirects)，只转发这五个前缀，且目标写死为同一个项目，
所以它**不是开放代理**，其他路径一律 404：

```
/rest/v1/*      https://<ref>.supabase.co/rest/v1/:splat      200
/auth/v1/*      https://<ref>.supabase.co/auth/v1/:splat      200
/storage/v1/*   https://<ref>.supabase.co/storage/v1/:splat   200
/functions/v1/* https://<ref>.supabase.co/functions/v1/:splat 200
/realtime/v1/*  https://<ref>.supabase.co/realtime/v1/:splat  200
```

不需要自己写 CORS：Supabase 会针对请求里的 `Origin` 回 `Access-Control-Allow-Origin`，并在
`Access-Control-Expose-Headers` 里带上 `Content-Range`（未读数的 `count: 'exact'` 依赖它），
Netlify 会把响应头原样透传。

已实测（经 `xxxx.netlify.app` 代理）：

| 请求 | 结果 |
| --- | --- |
| `GET /rest/v1/contents` + `apikey` | 200 |
| `HEAD /rest/v1/contents` + `Prefer: count=exact` | 200，`content-range: */0` |
| `GET /auth/v1/settings` | 200 |
| `POST /auth/v1/token`（错误密码） | 400 `invalid_credentials`（说明 POST body 正确到达 GoTrue） |
| `POST /rest/v1/contents`（匿名） | 401 `42501` RLS 拒绝（说明写路径透明） |
| 12 MB 请求体上传 | 403（被 storage RLS 拒绝，而非体积限制） |
| `/definitely-not-proxied/x` | 404（不是开放代理） |

---

## 方案 B：自带 Serverless（Deno Deploy 等）

`supabase-proxy.js`（Web 标准 `Request`/`Response`，无运行时依赖）+ `main.js`（Deno 入口）：

```powershell
# 本地自测（Node 18+，零依赖，默认 8787）
node proxy\dev.mjs
curl.exe --noproxy '*' http://127.0.0.1:8787/health
```

部署到 Deno Deploy：新建项目，入口填 `proxy/main.js`，可选环境变量 `SUPABASE_ORIGIN` 覆盖上游。

> 注意：`dash.deno.com` 与 `api.deno.com` 在大陆被阻断，运行时域名 `*.deno.dev` 却可达。
> 也就是说部署后大陆用户能用，但你在大陆**无法登录控制台管理或重新部署**。因此大陆用户建议用方案 A。

---

## 前端是怎么配合的

`src/config.js` 末尾提供了三个助手：

- `resolveSupabaseUrl()` — 有 `supabaseProxyUrl` 就返回代理地址，否则返回 `supabaseUrl`。`createClient` 用它。
- `rewriteSupabaseUrls(text)` — 把历史数据里写死的 `https://<ref>.supabase.co/...` 图片/视频地址改写为当前基地址，避免换域名后集体裂图。
- `toUpstreamSupabaseUrl(url)` — 上传时把 `getPublicUrl()` 返回的代理地址**还原成上游地址**再入库，让数据与域名解耦。将来换代理域名不需要迁移数据。

另外 `src/data/supabase-sdk.js` 对 SDK 本体做了多 CDN 顺序回退（jsDelivr → unpkg → esm.sh）。
`cdn.jsdelivr.net` 在大陆经常被干扰，一旦它挂了整个应用会起不来，回退是必要的防线。
`index.html` 里的 `importmap` 已移除，动态 import 由该模块承担。
