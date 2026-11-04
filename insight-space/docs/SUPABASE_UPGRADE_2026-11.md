# Insight Space · Supabase 升级与部署指南

更新日期：2026-11-04

这次升级把文章筛选、排序、分页和统计移到数据库完成，同时保留原有账号、文章、评论、收藏、权限和私信。前端仍是静态 ES Module，可直接放在 GitHub Pages 上。

**推荐顺序：备份 → 数据库增量升级 → 验证 → 发布完整前端 → 更新 Edge Function → 登录验收。**

交付中包含迁移脚本和本地数据库测试；没有替你运行线上 Supabase SQL、发布 Edge Function 或修改线上账号。

## 1. 本次需要哪些文件

| 文件 | 用途 | 何时使用 |
| --- | --- | --- |
| [supabase/schema.sql](../supabase/schema.sql) | 原有表、权限、注册函数与 Storage 基础结构 | 全新项目；或旧数据库尚未具备当前基础结构时 |
| [20261104_performance.sql](../supabase/migrations/20261104_performance.sql) | 本次正式增量迁移 | 已有项目和新项目都需要 |
| [20261104_verify.sql](../supabase/operations/20261104_verify.sql) | 只读检查函数、索引、RLS 与记录数 | 迁移后 |
| [20261104_performance_rollback.sql](../supabase/operations/20261104_performance_rollback.sql) | 撤销本次新增 API 与索引 | 先回退前端，再按需运行 |
| [admin-auth/index.ts](../supabase/functions/admin-auth/index.ts) | 超管重置密码、删除账号 | 更新后，停用的超管也会被服务端拒绝 |
| [vendor/manifest.json](../vendor/manifest.json) | 随站点部署的固定版本客户端与校验值 | 随完整前端一起上传 |

回滚和检查脚本特意放在 operations/，不会被当作正常的前向迁移自动执行。这个仓库原来的数据库以 schema.sql 管理，**不要对现有项目直接运行 CLI 的 db push 或 db reset**；本指南采用 SQL Editor 的明确执行顺序。

## 2. 已有 Supabase 项目怎么升级

### 第一步：确认项目并保留恢复点

在 Supabase Dashboard 打开网站实际使用的项目。用 src/config.js 中的 supabaseUrl 核对项目引用，代理网址不等于项目引用。

保留当前前端版本或 Git 提交。数据库优先使用项目可用的备份/恢复能力，或由管理员导出数据库。Storage 中的图片、音视频等文件也需要另行保留；仅导出数据库记录不等于备份媒体文件。网站后台原有“导出”功能不是完整的 Supabase 备份，它不包含 Auth 密码、全部授权、私信和媒体二进制。

在 SQL Editor 保存以下基线记录数，便于升级后比较：

~~~sql
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.contents) as contents,
  (select count(*) from public.comments) as comments,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.reactions) as reactions;
~~~

迁移脚本不插入演示文章，不改账号角色，不删除业务记录。

### 第二步：运行增量迁移

在 SQL Editor 点击 New query，打开 **supabase/migrations/20261104_performance.sql**，全文复制后一次执行。

脚本会：

1. 检查 PostgreSQL 至少为 15，并确认基础表/函数已存在。
2. 启用 pg_trgm，建立 12 个本项目命名的索引。
3. 创建 11 个用于分页、筛选、统计、互动、私信的函数。
4. 让原有互动统计视图遵守调用者的 RLS；给浏览计数加上内容可读性检查。
5. 撤销匿名用户对新增 API 的执行权，仅允许登录用户调用；通知 PostgREST 刷新 schema。

所有步骤在一个事务里执行。遇到错误会整体回滚；修复原因后可重复运行完整脚本。

若提示“Run the current supabase/schema.sql before this migration”，说明线上基础结构与当前仓库不一致。先检查/补齐仓库里的 schema.sql，再运行本次增量迁移。增量脚本不能单独用来安装一份全新数据库。

脚本设置了 5 秒锁等待和 120 秒语句超时。若索引创建因数据量或其他事务超时，不要只跳过报错语句；在访问较少的时间重新运行，必要时由数据库管理员调整超时或拆成并发建索引流程。

### 第三步：检查升级结果

运行 **supabase/operations/20261104_verify.sql**。预期：

| 检查项 | 预期结果 |
| --- | --- |
| 新增函数 | 11 行，security_definer 全部为 false |
| 新函数 authenticated_can_execute | 全部为 true |
| 新函数 anon_can_execute | 全部为 false |
| 新增索引 | 12 行，valid 全部为 true |
| content_stats / comment_stats | reloptions 包含 security_invoker=true |
| 原有用户数据表 | relrowsecurity 全部为 true |
| 核心记录数 | 与升级前一致；期间有人发文/聊天时应结合实际操作核对 |

SQL Editor 通常使用能绕过 RLS 的 postgres 管理角色。**在 SQL Editor 查到文章不能证明普通账号也能读到它**；账号之间的隔离需要用实际登录会话验收，或运行第八节的隔离测试。

### 第四步：发布前端

把更新后的 **insight-space/** 完整部署到原来的位置。尤其不要漏掉新增的 vendor/、src/components/、src/data/query.js 等文件。

不需要 npm build，也不需要部署 Node 服务。vendor/ 已有固定版本 Supabase SDK，它和网页从同一站点加载，启动时不再依次等待三家公网 CDN。

保留 src/config.js 的实际项目配置：

~~~js
export const CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseProxyUrl: '', // 已有可用代理时保留原地址
  supabaseAnonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  storageBucket: 'media',
  // 其余原有配置继续保留
};
~~~

前端只放 publishable/anon 公钥。service_role 或 secret key 只在服务端使用。

已配置云端时，连接失败会显示错误与重试入口，不会再自动打开一个空的本地数据库。若明确要使用单机本地模式，需要把 supabaseUrl、supabaseAnonKey 留空；本地模式不读取也不覆盖云端数据。

发布后若看到“数据库需要升级”，确认 SQL 执行的是同一个项目，并确认 API 代理指向该项目。必要时在 SQL Editor 执行：

~~~sql
notify pgrst, 'reload schema';
~~~

### 第五步：更新超管 Edge Function

本次 admin-auth 新增账号必须为 active 的检查，并固定 Supabase SDK 版本。要让这个服务端改动生效，需要重新部署函数。

Mac 上尚未安装 Supabase CLI 时，可按[官方 CLI 安装指南](https://supabase.com/docs/guides/local-development/cli/getting-started)选择 Homebrew。已有 CLI 可直接使用：

~~~bash
cd /你的仓库路径/web-projects/insight-space
supabase login
supabase functions deploy admin-auth --project-ref YOUR_PROJECT_REF --no-verify-jwt
~~~

使用 npm 项目依赖安装方式时，将命令写成 npx supabase。不要使用旧说明中的 npm i -g supabase。本次 SQL 升级不要求执行 CLI 初始化或 db push。

保留 --no-verify-jwt，是因为函数内部调用 Auth 校验 Bearer token，并核实调用者的超级管理员角色和 active 状态。SUPABASE_SERVICE_ROLE_KEY 只由函数运行环境提供，不能填入网站配置。

## 3. 全新 Supabase 项目怎么安装

1. 新建 Supabase 项目。
2. 在 SQL Editor 全文运行 supabase/schema.sql。
3. 接着全文运行 supabase/migrations/20261104_performance.sql。
4. 运行 operations/20261104_verify.sql 检查结构。
5. 当前应用使用“用户名@tiwu.local”的合成邮箱登录；在 Authentication 的 Email 设置里关闭 Confirm email。改成真实邮箱注册时，需另行改造注册和找回密码流程。
6. 将项目 URL、公钥和可选代理地址填入 src/config.js。
7. 按上一节部署 admin-auth，发布完整前端。
8. 打开网站初始化页面，创建首位超级管理员，再创建日常使用的站长/成员。

初始化、邀请码和资料修改继续使用原来的业务规则，本次没有创建任何预置账号。

## 4. 每项数据库改动解决什么问题

| 改动 | 原来的问题 | 升级后的行为 |
| --- | --- | --- |
| insight_content_page | 先随意取 500 条，再在浏览器排序/分页 | 在全部符合权限与筛选条件的记录上排序，只返回当前页和真实总数 |
| insight_content_facets | 为作者/标签下拉框下载全部正文和统计 | 只返回作者选项和标签字符串 |
| insight_content_summary | 个人主页用已加载文章计算累计赞/收藏 | 在相同授权范围内聚合真实总数，不受分页影响 |
| insight_content_metrics | 拉评论 ID 再计数，受 API 返回行数限制 | 数据库计数；每次最多处理 200 个可读目标 |
| insight_modules | 每次导航把文章 ID 拉到浏览器计算数量 | 返回模块、访问标志和数据库聚合数量 |
| insight_toggle_reaction | 删除旧反应与插入新反应分属多个请求 | 一个事务里切换，对同一用户/目标串行处理，失败会反馈 |
| insight_search_members | 每条搜索结果再请求一次关系，输入拼入过滤表达式 | 一次返回成员与关系，参数按字面含义处理 |
| insight_message_page | 云端 limit 取最早消息，本地取最新 | 两端统一取最新页，支持按时间+ID读取更早消息 |
| insight_threads | 只看最近 500 条消息，遗漏会话或低估未读 | 每个好友查询最后一条与完整未读数 |
| insight_active / insight_matching_content | 多处重复账号/筛选判断 | 数据库内复用登录状态和可见内容筛选 |
| 统计视图与 increment_view | 统计可能绕过目标文章 RLS，浏览计数未校验目标 | 统计只针对可读目标，计数前验证权限 |

新增索引覆盖文章的全局/模块/作者分页、标签、字面搜索、收藏、评论关联、未读私信。pg_trgm 支持 ILIKE 搜索；很短的查询（例如单字）不保证能有效利用该索引，最终是否走索引由 PostgreSQL 规划器决定。

搜索同时检查标题、正文、标签；百分号、下划线、括号等不会被当成用户自定义 PostgREST 过滤语法。这是字面子串搜索，不是中文语义搜索或自动分词搜索。

## 5. 功能验收

建议使用一个站长账号和两个普通成员账号：

| 操作 | 应看到的结果 |
| --- | --- |
| “加载更多”超过旧版 500 条边界 | 旧文章仍能出现，总数不是当前页条数 |
| 收藏很早以前的文章，再看收藏页 | 能找到文章 |
| 切换“最新 / 最早 / 最热 / 获赞” | 排序作用于全部可见结果，获赞榜按赞数排序 |
| 搜索含 %、_、括号的标题 | 按真实字符匹配，不报过滤语法错误 |
| 私密内容、指定成员内容、草稿 | 未获允许的普通账号在列表、搜索、筛选项和统计里都看不到 |
| 连续切换点赞/点踩 | 同一账号不会同时保留赞和踩；失败会反馈 |
| 长会话点击“更早消息” | 初次显示最新消息，继续可向前读取 |
| 有超过 500 条历史未读消息 | 未读统计不会因为旧版抓取上限而变小 |
| 切换标签页、退出后再登录 | 不因 Auth 回调持续等待，旧请求不能恢复已退出账号 |
| 临时阻断 API、刷新页面 | 显示连接失败/重试，不静默进入空白本地模式 |

没有模块权限的成员应看不到该模块内容。取消邀请码或更改权限后也要重新检查访问。本次测试覆盖新增 API 及依赖的内容隔离，不代表已审计历史系统的每一条 RLS 策略。

## 6. 回滚

1. 先发布升级前的前端。新前端依赖新增 RPC，不能先删除数据库函数。
2. 如需撤销数据库功能，全文执行 operations/20261104_performance_rollback.sql。
3. 核对业务记录数并检查登录、发文和阅读。

回滚删除本次新增函数和索引，不删除文章、账号、授权、私信、媒体。它保留统计视图遵守 RLS、浏览计数检查权限两处修正。pg_trgm 也保留，因为其他应用可能同时依赖该扩展。

若仅前端出现问题，可以先回退前端、保留新增函数/索引；旧 API 仍然存在。再次升级时可重新运行正式增量迁移。

## 7. 性能边界

这是有针对性的性能和正确性升级，没有给出未经线上测量的提速百分比。普通列表的网络响应现在随页大小增长；筛选项不再携带所有正文，SDK 无公网 CDN 瀑布请求。

热度排序仍需计算符合条件文章的动态时间衰减，总数统计也有数据库成本。后续若达到百万级内容或高并发，应依据实际 Query Performance 决定是否维护预聚合计数/排行榜、改成游标分页或增加搜索服务。

本次文章列表使用稳定排序的 offset 分页；分页期间有人新增/修改文章时，结果会随实时数据变化，页面会去重，刷新可重新取当前排序。

## 8. 测试与复现

需要 Node.js 22 或更新版本。应用正常部署不需要测试依赖。

~~~bash
cd /你的仓库路径/web-projects
node --test insight-space/tests/data.test.mjs
~~~

数据库测试在隔离 PGlite PostgreSQL 中运行真实基础 schema、升级、重复升级、回滚和重放。它不会读取 src/config.js 的线上项目，也不会连接生产数据库：

~~~bash
npm install --prefix /tmp/insight-db-tests @electric-sql/pglite@0.5.15 --ignore-scripts --no-audit --no-fund
INSIGHT_PGLITE_PACKAGE=/tmp/insight-db-tests/node_modules/@electric-sql/pglite \
  node --test insight-space/tests/database.test.mjs
~~~

测试数据包含 622 条普通成员可见内容、1105 条评论、620 条未读消息，以及私密/指定成员内容、草稿、无授权账号和被停用账号。PGlite 模拟 Supabase 的 Auth/Storage 接口并运行原 RLS；它验证 SQL 与权限逻辑，不能替代线上 PostgREST、网关、Auth/Storage 服务端到端验收。

## 9. SDK 如何维护

前端附带 @supabase/supabase-js 2.118.0 的浏览器 ESM 包，约 223 KB（文件体积），仅在云端模式初始化时按需加载。实际 gzip/Brotli 传输量取决于静态托管服务。

许可证在 vendor/THIRD_PARTY_NOTICES.md，版本、体积和 SHA-256 在 vendor/manifest.json。维护者重新打包：

~~~bash
cd insight-space/tools/vendor
npm ci
npm run build
~~~

这只生成 vendor 文件；普通部署直接上传生成好的目录即可。修改 SDK 版本时，同时更新工具 package.json、锁文件、构建脚本版本校验、supabase-sdk.js 导入路径，并重新运行数据与页面测试。

## 10. 官方参考

以下资料用于核对实现，查阅日期为 2026-11-04：

- [Supabase：数据库函数与 SECURITY INVOKER / DEFINER](https://supabase.com/docs/guides/database/functions)
- [Supabase：RLS 与 PostgreSQL 15 的 security_invoker 视图](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase：Auth 状态事件](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase：CLI 安装与调用方式](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase：数据库扩展](https://supabase.com/docs/guides/database/extensions)
- [PostgreSQL：pg_trgm 索引和 LIKE / ILIKE 的支持范围](https://www.postgresql.org/docs/17/pgtrgm.html)
