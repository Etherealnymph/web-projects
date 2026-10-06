# Supabase 反向代理

本项目**已在用**的代理：<https://insight-space-api.netlify.app>
（Netlify 项目 `insight-space-api`，规则见 [`netlify/_redirects`](./netlify/_redirects)）

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
# 2) 得到形如 https://xxxx.netlify.app 的域名，点 “Claim this site” 用 GitHub 登录认领。
#    ⚠ 认领后还要去 Project configuration → General → Visitor access → Edit visibility，
#      把 Production visibility 从 Private 改成 Public —— 新团队的默认值是 Private，
#      不改的话站点会一直 401 并跳转到 app.netlify.com/edge-access。
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

已实测（经 `https://insight-space-api.netlify.app` 代理，成都移动、无代理裸连）：

| 请求 | 结果 |
| --- | --- |
| `OPTIONS /storage/v1/object/media/*`（预检） | 200，`Access-Control-Allow-Methods` 含 `PUT`/`DELETE`，`Allow-Headers` 回显请求头 |
| `GET /` | 200（代理说明页） |
| `GET /rest/v1/contents` + `apikey` | 200，`[]`，`Access-Control-Allow-Origin: https://etherealnymph.github.io` |
| `HEAD /rest/v1/messages` + `Prefer: count=exact` | 200，`Content-Range` 可读（未读数轮询依赖它） |
| `GET /auth/v1/settings` + `apikey` | 200（对照：上游直连在同一台机器上是 `curl` exit 35，TLS 被重置） |
| `POST /rest/v1/contents`（匿名） | RLS 拒绝 `42501`（说明 POST body 与写路径透明） |
| `PUT /storage/v1/object/media/...` 19–20 MB | 请求体**完整送达**，被 storage RLS 拒绝（说明没有 6 MB 上限） |
| `PUT` 最大实测到 35 MB | 请求体完整送达 |
| `/definitely-not-proxied/x` | 404（不是开放代理） |

浏览器内的端到端验证（线上站点，真实 HTTP 栈，实测数据）：

| 场景 | 结果 |
| --- | --- |
| 5 / 10 / 15 / 20 / 25 / 30 MB `PUT` | 全部完整送达（耗时随体积线性增长 1.7 s → 12 s） |
| 邀请码注册 + 登录 | 成功（走代理） |
| 发布图文（含 12 MB 附件） | 成功，入库的是上游 `supabase.co` 地址 |
| 详情页渲染附件 | 地址被自动改写为代理域名，`GET` 回读 12 578 912 字节，与上传字节数一致 |
| 发评论 | 成功，评论数由 `评论 · 0` 变为 `评论 · 1` |
| 删除评论 / 删除帖子 | 成功 |

> 体积的补充说明：Netlify 官方文档里的 6 MB 上限只针对 Serverless Function，`_redirects` 的代理走
> CDN 不适用。用 `curl` 裸连做二进制大报文压测时成功率呈**非单调**波动（19、20、35 MB 通过，
> 10、15 MB 偶发空响应、`size_upload=0`、约 0.4 s 就返回），但**换成浏览器 `fetch`（也是线上真实路径）
> 后 5–30 MB 全部一次通过**。所以那是 `curl` 裸连国际链路的偶发中断被 Netlify 记为裸 400，
> 与本代理的配置无关。

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
