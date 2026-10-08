# 体悟集 · Insight

一个可以部署在 **GitHub Pages** 上的私人「体悟」站点：推荐 / 日记 / 诗歌 / 文案 / 评论等模块，邀请码注册、超管后台、图文音视频 + Markdown、点赞收藏评论、综合热度排序。

纯静态前端（原生 ES Module，无需构建），支持两种数据后端：

| 模式 | 说明 | 适用 |
|---|---|---|
| **本地模式**（默认） | 数据存在浏览器 IndexedDB 里，无需服务器 | 单人使用 / 演示 |
| **Supabase 模式** | 真实多人账号、密码登录、跨设备同步 | 正式部署 |

> 本地模式不需要任何配置，打开即可用；但它只是「一个人一台浏览器」的数据，**换设备 / 清缓存都会丢**，且没有真正的服务端权限校验。需要多人邀请码与后台，请按下文配置 Supabase。

---

## 一、本地运行

```powershell
cd D:\Project\html
python -m http.server 8123 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8123/insight-space/
```

首次打开会展示「初始化」或登录页。内置账号（`src/config.js` 中 `CONFIG.bootstrap`）：
首次打开会展示「初始化」表单。**出于安全考虑，前端不预置任何账号或密码**，由你现场设置：

1. 在「初始化」表单里填写你想要的超管用户名与密码（至少 6 位），提交后即成为超级管理员。
2. 登录后进入「后台 → 账号管理」，新建一个账号并把角色设为「站长」，这就是「你本人」的账号；
   站长拥有全部模块内容的增删改查权限，但没有邀请码 / 账号管理权限。
3. 随时可在「我的 → 修改密码」更换密码。

权限对照：

| 角色 | 谁能拥有 | 权限 |
|---|---|---|
| 超级管理员 | 你自己（初始化时创建） | 邀请码 / 账号 / 模块 / 全部内容 + 后台监控 |
| 站长 | 你本人的日常账号 | 全部模块内容增删改查 + 好友与私信 |
| 成员 | 持邀请码注册的人 | 被授权模块的读写 + 互动 + 好友与私信 |

---

## 二、部署到 GitHub Pages

本仓库已启用 Pages（站点根为仓库 `main` 分支）。把 `insight-space/` 整个目录提交推送即可访问：

```
https://etherealnymph.github.io/web-projects/insight-space/
```

要点：

- 只需要静态文件，**不需要构建步骤**；`.nojekyll` 已就位，避免下划线目录被 Jekyll 忽略。
- 使用相对路径（`./src/...`），放在任意子目录都能跑。
- GitHub Pages 是纯静态托管，**没有后端**；因此多账号必须依赖 Supabase（见下）。
- 中国大陆打不开站点时请先看[第八节](#八中国大陆访问反向代理)；实测站点本身可达，被阻断的是 Supabase 的 API 域名。

---

## 三、接入 Supabase（真正的多人 + 邀请码）

1. 在 [supabase.com](https://supabase.com) 新建一个项目。
2. 打开 **SQL Editor**，把 [`supabase/schema.sql`](./supabase/schema.sql) 全文粘贴执行一次（可重复执行）。
   > **已经接入过 Supabase 的站点请重新执行一次**：新增了 `invites.module_perms`（邀请码的按模块权限）、`contents.visibility` / `contents.visible_user_ids`（内容可见范围），并更新了 `register_with_invite`（按权限写授权记录）与内容 RLS。脚本可重复执行，只补列与函数，不会清空数据。
   > 未执行时前端仍可运行，只是邀请码保存会忽略按模块权限并降级为旧的全局权限（控制台会打印一条 `module_perms` 相关的警告）。
3. **Authentication → Providers → Email**：关闭 `Confirm email`。
   本站把用户名映射成 `用户名@tiwu.local` 的合成邮箱，无法收信，必须关闭邮箱确认。
4. **Project Settings → API**：复制 `Project URL` 与 `anon public` key。
5. 填入 `src/config.js`：

```js
export const CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
  storageBucket: 'media',
  // ...
};
```

6. 部署超管账号管理的 Edge Function（用于「重置密码」和「删除账号」，这两个操作无法再用 SQL 直接改 `auth.users`）：

```bash
# 本地安装 Supabase CLI 并登录（首次）
npm i -g supabase
supabase login
# 关联到你的项目，然后部署（项目引用 ID 见 Project Settings → General）
supabase link --project-ref <你的项目ID>
supabase functions deploy admin-auth --no-verify-jwt
```

   - 该函数代码在 [`supabase/functions/admin-auth/index.ts`](./supabase/functions/admin-auth/index.ts)。
   - `--no-verify-jwt`：函数在内部自行校验调用者是否为已登录超管（依赖 Supabase 自动注入的 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`）。
   - 部署成功后，后台「重置密码 / 删除账号」即通过此函数调用 Auth Admin API，不会再 403。

7. 重新打开站点，用首页的「初始化」表单创建第一位超管（该入口只在系统还没有超管时出现）。

`schema.sql` 会自动：建表、开启 RLS、建 `media` 公共存储桶、写入 5 个默认模块、注册触发器（新用户自动建资料）。若你的 Supabase 版本限制了向 `auth.users` 写入，可改在 **Authentication → Users → Add user** 手动建号（邮箱填 `用户名@tiwu.local`），再执行：

```sql
update public.profiles set role = 'superadmin' where username = '你的用户名';
```

---

## 四、邀请码与权限模型

- **超管**在「后台 → 邀请码」新增 / 停用 / 删除 / **编辑**邀请码，可指定：
  - 分类、备注、自定义码（或自动生成）；
  - 有效期（按天或指定到期时间）；
  - 可注册次数上限；
  - **按模块的权限**：可勾选「全部模块」或逐个模块指定 —— 每个模块可单独设置 **可读 / 可写 / 可上传图片**，以及可查看从当前时间向前发布的最近多少天内容（0 或留空表示不限制）。
  - 邀请码本身仍支持设置整体有效期；模块的内容可读时间范围不会使授权失效。账号管理中的成员授权也支持设置相同的内容时间范围。
- 编辑已有邀请码时，码本身只读（已被使用过，改动会让人对不上号），其余项随时可改；**保存后立即对已注册的成员生效**。
- 其他人用邀请码注册账号密码；注册时把邀请码的模块权限写成 **授权记录（grant）**，并关联邀请码。
- **邀请码一旦被停用或过期，授权立即失效**：前端导航与直链访问都会在读取时按邀请码当前状态重新判定，数据库 RLS 亦同步校验；同理，改小邀请码的权限也会立刻收回对应成员的可写 / 可上传权。
- 编辑内容时可选择 **公开、私密（仅自己）或指定成员**；公开内容仍受模块访问权限制，指定成员由内容作者勾选，数据库 RLS 与本地模式都会过滤不可见内容。
- 超管可随时新增 / 重置密码 / 停用 / 删除账号；站长账号（`owner`）覆盖全部模块的内容管理。

权限对照：

| 能力 | 超管 | 站长 | 普通成员 |
|---|---|---|---|
| 邀请码 / 账号管理 / 后台监控 | ✅ | — | — |
| 模块增删改 | ✅ | — | — |
| 任意模块内容增删改 | ✅ | ✅ | 仅自己且有写权限时 |
| 点赞 / 踩 / 收藏 / 评论（内容与评论） | ✅ | ✅ | 有模块访问权时 |
| 修改本人昵称 / 密码 | ✅ | ✅ | ✅ |
| 申请加好友 / 私聊 | ✅ | ✅ | ✅（成为好友后） |

---

## 五、功能清单

- **模块**：推荐（按综合热度排序）、日记、诗歌、文案、评论，可在后台自由增删改。
- **内容**：标题 + Markdown 正文（实时预览、任务列表、表格、代码块等），可上传图片 / 视频 / 文档，可插入语音与表情包 / 颜文字。
- **附件回收**：删除内容或评论时会一并回收其名下的附件。因为外键是级联删除，删除帖子时其下所有评论、删除根评论时其二级回复都会被一并清掉，它们的附件也在回收范围内。
  - 存储策略只允许**本人**删除自己上传的文件（`media_delete` 校验路径首段 = `auth.uid()`），所以站长 / 超管删除他人帖子时，附件会被策略拒绝而留下。这属于**尽力而为**：回收失败只记警告，绝不会影响正文删除本身。若将来需要彻底回收，可加一个用 `service_role` 收尾的 Edge Function。
- **互动**：内容与评论都支持 点赞 / 踩 / 收藏 / 评论，评论支持多级回复。
- **好友与私信**：在帖子页点「加好友」即可向作者发送申请（可附言），对方同意后按钮变为「发消息」，也可随时回到「信息」里私聊；支持表情包、语音、图片、文件与 Markdown，未读角标实时提示，可删除好友（同时清空会话）。
- **热度**：`点赞×3 + 收藏×2.5 + 评论×2.5 − 踩×1.5 + 浏览×0.12`，并随时间衰减，用于「推荐」排序与后台排行。
- **个人主页**：修改昵称 / 简介 / 头像 / 密码，查看自己发表的内容、评论与收藏。
- **后台**：总量统计、近 7 天发布曲线、各模块分布、内容 / 评论 / 贡献者排行榜、最近动态、邀请码管理、账号管理。
- **其它**：日间 / 夜间 / 跟随系统主题，中文 / English 切换，全局搜索，键盘快捷键，移动端适配。

---

## 六、安全说明

**凭证与敏感信息**

- 前端**不含任何预置账号或密码**：`src/config.js` 只保留站点信息与后端地址，首次使用的超管账号由你在页面上现场设置。
- 源仓库与文档中不记录任何口令；请勿把 `src/config.js` 之外的密钥、口令或私人内容写进代码或提交信息。
- 本地模式下密码经 **PBKDF2(SHA-256，15 万次迭代 + 随机盐)** 哈希后存储，登录会话只保存用户 id，不保存口令。
- Supabase 模式下密码由 Supabase Auth（bcrypt）托管，前端永远拿不到明文口令。

**权限边界**

- Supabase 模式启用 RLS：模块访问、内容读写、评论、互动、好友关系与私信全部由数据库策略二次校验，邀请码停用 / 过期会立即收回模块访问权。
- 私信仅限「已成为好友」的两人之间读写，第三方无法读取。
- `anon` key 是设计上可公开的前端密钥，可安全放入 `src/config.js`；**切勿**把 `service_role` key 放进前端。

**其它**

- 本地模式的所有校验都在浏览器内，只防「明文可见」，**不构成真正的安全边界**，请勿存放高度敏感的内容。
- 邀请码校验函数对匿名开放，存在被暴力尝试的理论风险；建议使用默认的 10 位随机码，并设置有效期与使用次数上限。

---

## 七、目录结构

```text
insight-space/
├─ index.html              入口（样式 / 启动脚本）
├─ supabase/
│  ├─ schema.sql           数据库结构（表 / RLS / 函数 / 存储桶）
│  └─ functions/admin-auth/index.ts  超管重置密码 / 删除账号（Edge Function）
├─ proxy/                  中国大陆反向代理（见第八节）
│  ├─ README.md            为什么需要、Netlify / Deno 两种部署方式
│  ├─ netlify/             方案 A：_redirects 纯 CDN 转发（推荐）
│  ├─ supabase-proxy.js    方案 B：Web 标准处理器
│  ├─ main.js              方案 B：Deno Deploy 入口
│  └─ dev.mjs              方案 B：本地调试服务器
├─ assets/
│  ├─ css/{base,components,views}.css
│  ├─ icon.svg
│  └─ stickers/*.svg       内置表情包
└─ src/
   ├─ config.js            站点与 Supabase 配置（改这里）
   ├─ main.js              路由、顶栏、全局交互
   ├─ core/                util / markdown / i18n / theme / store / ui
   ├─ components/          emoji / composer（编辑器）/ widgets
   ├─ data/                local.js（IndexedDB）与 supabase*.js（云端）
   └─ views/               auth / home / detail / editor / profile / messages（信息）/ admin*
```

数据层对两种后端暴露**完全一致**的 API（`auth / modules / contents / comments / reactions / invites / grants / admin / media / friends / messages`），因此切换模式无需改动界面代码。

---

## 八、中国大陆访问（反向代理）

### 现象与根因

在大陆打开 `https://etherealnymph.github.io/web-projects/insight-space/` 时，页面能加载，
但登录、发帖等操作全部失败，或者应用静默退化成「本地模式」而看不到云端数据。

实测（成都 · 中国移动 · **无代理裸连**）表明**站点没有被墙**，被阻断的是 Supabase 的 API 域名：

| 域名 | 结果 |
| --- | --- |
| `etherealnymph.github.io` | 200（正常） |
| `*.supabase.co`（含本项目） | **HTTP 000，TLS 握手被重置** |
| `supabase.com` / `api.supabase.com` | 200 / 404（正常） |

只封 `*.supabase.co` 而不封 `supabase.com`，说明这是**基于 SNI 的定向 TLS 阻断**：
DNS 能解析、TCP 能建连，ClientHello 一发出去就被 RST。

> 因此失败时的表现是「数据为空」而不是报错 —— `src/data/index.js` 的 `isCloudConfigured()`
> 发现 Supabase 初始化失败会自动回退到 IndexedDB 本地模式。

### 解决：给 Supabase 套一层大陆可达的域名

不用换掉 Supabase，把 API 走一个大陆能访问的反向代理即可。**本项目已在用**
`https://insight-space-api.netlify.app`，规则与实测数据见 [`proxy/README.md`](./proxy/README.md)。

`src/config.js` 里对应的配置就是这一行：

```js
export const CONFIG = {
  supabaseUrl: 'https://gthztievqjovorlcwuwq.supabase.co',
  supabaseProxyUrl: 'https://insight-space-api.netlify.app',
  // ...
};
```

**重建代理的方法**（换 Supabase 项目、或想换一个域名时）：

1. 打开 <https://app.netlify.com/drop>，把 [`proxy/netlify/`](./proxy/netlify) 目录（或它压成的 zip）拖进去。
2. 点 **Claim this site**，用 GitHub 登录认领 —— 认领前站点只有 1 小时生命且带临时密码。
3. ⚠ **认领后必须再做一步**：Project configuration → General → Visitor access → **Edit visibility**，
   把 `Production visibility` 从 `Private` 改成 `Public`。Netlify 新团队的默认值是 Private，
   不改的话站点会一直返回 401 并跳转到 `app.netlify.com/edge-access`，浏览器里表现为「打不开」。
4. 把域名回填到 `src/config.js` 的 `supabaseProxyUrl`，并在 [`proxy/netlify/_redirects`](./proxy/netlify/_redirects)
   里确认上游项目域名正确，然后提交推送、等 Pages 重新构建。

为什么选 Netlify：

- `_redirects` 的 `200` 重写跑在 CDN 边缘，**不经过 Serverless Function**，因此没有约 6 MB 的请求体上限。
  实测 19、20、35 MB 的请求体都能完整送达（被 storage RLS 拒绝而不是体积错误），
  [`src/components/composer.js`](./src/components/composer.js) 的 `MAX_MB = 30` 才有意义。
- `app.netlify.com` / `api.netlify.com` 在大陆可达，能自己登录维护；`dash.deno.com`、`api.deno.com`
  在大陆被阻断，部署完就再也回不去控制台了。
- Supabase 会针对请求的 `Origin` 自行回 CORS 头（`Access-Control-Allow-Origin` 回显 origin，
  并在 `Access-Control-Expose-Headers` 里带 `Content-Range`），CDN 原样透传即可，无需额外适配。

### 本地验证

```powershell
# 起一个本机代理（Node 18+，零依赖）
node proxy\dev.mjs
# 另开一个窗口服务站点，再临时把 supabaseProxyUrl 设成 http://127.0.0.1:8787
```

代理与站点必须**跨域**（不同端口即可），否则测不出 CORS 问题。验证时注意清掉本机的
`HTTP_PROXY` / `HTTPS_PROXY`，并用 `curl.exe --noproxy '*'`，否则会得到「通」的假结论。

### 其它说明

- SDK 本体（esm.sh / jsDelivr）在大陆不稳定，[`src/data/supabase-sdk.js`](./src/data/supabase-sdk.js)
  做了 jsDelivr → unpkg → esm.sh 的顺序回退；`index.html` 里的 `importmap` 已移除，改由该模块动态 import。
- 历史数据里图片/视频是入库时写死的 `https://<ref>.supabase.co/...` 绝对地址，
  `rewriteSupabaseUrls()` 在渲染时改写、`toUpstreamSupabaseUrl()` 在入库时还原，
  换代理域名**不需要迁移数据**。
- 认证只有用户名/密码（合成邮箱 `xxx@tiwu.local`），没有 OAuth 与魔术链接，
  因此 **Supabase 的 Redirect URLs 白名单不需要改**。
- 代理地址必须是 `https://`；站点是 HTTPS，混合内容会被浏览器拦截。
- 代理只转发本项目的五个 Supabase 前缀，其它路径一律 404，不构成开放代理。
