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

---

## 三、接入 Supabase（真正的多人 + 邀请码）

1. 在 [supabase.com](https://supabase.com) 新建一个项目。
2. 打开 **SQL Editor**，把 [`supabase/schema.sql`](./supabase/schema.sql) 全文粘贴执行一次（可重复执行）。
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

- **超管**在「后台 → 邀请码」新增 / 停用 / 删除邀请码，可指定：
  - 分类、备注、自定义码（或自动生成）；
  - 有效期（按天或指定到期时间）；
  - 可注册次数上限；
  - 授权的模块范围（全部模块，或指定模块）与是否可写。
- 其他人用邀请码注册账号密码；注册时把邀请码的模块范围写成 **授权记录（grant）**，并关联邀请码。
- **邀请码一旦被停用或过期，授权立即失效**：前端导航与直链访问都会在读取时按邀请码当前状态重新判定，数据库 RLS 亦同步校验。
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
├─ index.html              入口（importmap / 样式 / 启动脚本）
├─ supabase/
│  ├─ schema.sql           数据库结构（表 / RLS / 函数 / 存储桶）
│  └─ functions/admin-auth/index.ts  超管重置密码 / 删除账号（Edge Function）
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
