# 网页项目提交与部署指南

本文说明以后如何把本目录的修改同步到 GitHub 和 Gitee，并通过 GitHub Pages 访问网页。

## 当前项目地址

- GitHub 仓库：<https://github.com/Etherealnymph/web-projects>
- GitHub Pages：<https://etherealnymph.github.io/web-projects/index.html>
- Gitee 仓库：<https://gitee.com/AloneLvYi/web-projects>

GitHub Pages 使用 `main` 分支的根目录发布。只要把修改推送到 `main`，GitHub 会自动重新部署。

## 一、第一次在新电脑上使用

### 1. 安装 Git

Windows 下载并安装：

<https://git-scm.com/download/win>

安装完成后，在 PowerShell 检查：

```powershell
git --version
```

### 2. 克隆 GitHub 仓库

建议以后以 GitHub 仓库为主要工作副本：

```powershell
cd D:\Project
git clone https://github.com/Etherealnymph/web-projects.git html
cd D:\Project\html
```

如果目标目录已经存在且里面有文件，不要直接执行 `git clone` 覆盖目录。可以使用下面的方式：

```powershell
cd D:\Project\html
git init
git remote add github https://github.com/Etherealnymph/web-projects.git
git fetch github
git checkout -B main github/main
```

### 3. 设置 Git 用户信息

只需在本机设置一次：

```powershell
git config --global user.name "Etherealnymph"
git config --global user.email "你的 GitHub 邮箱"
```

## 二、日常修改和部署到 GitHub

以后每次修改网页后，在项目根目录执行：

```powershell
cd D:\Project\html

# 查看修改了哪些文件
git status

# 查看具体差异
git diff

# 暂存全部修改
git add -A

# 提交修改，提交说明要写清楚
git commit -m "更新网页内容"

# 推送到 GitHub，触发 GitHub Pages 自动部署
git push github main
```

如果远程仓库名称是 `origin`，最后一条命令改为：

```powershell
git push origin main
```

推送后通常等待几十秒到几分钟，网页就会更新：

<https://etherealnymph.github.io/web-projects/index.html>

### 推荐的日常完整流程

在开始修改前，先拉取远程最新内容，避免覆盖其他设备的修改：

```powershell
cd D:\Project\html
git pull github main
```

修改并测试后：

```powershell
git add -A
git commit -m "说明本次修改"
git push github main
```

## 三、同步部署到 Gitee

如果希望 GitHub 和 Gitee 都同步，可以给同一个本地仓库配置两个远程地址。

### 1. 查看远程地址

```powershell
git remote -v
```

### 2. 添加 GitHub 远程地址

当前项目原来的 `origin` 是 Gitee。如果还没有 `github` 远程地址，执行：

```powershell
git remote add github https://github.com/Etherealnymph/web-projects.git
```

如果提示 `remote github already exists`，说明已经配置过，不需要重复添加。

### 3. 同时推送到两个平台

```powershell
cd D:\Project\html
git add -A
git commit -m "同步更新网页项目"

git push github main
git push origin master
```

注意：

- GitHub 使用 `main` 分支。
- 当前 Gitee 仓库使用 `master` 分支。
- 如果本地当前分支是 `master`，也可以使用下面的命令推送到 GitHub 的 `main`：

```powershell
git push github master:main
```

查看当前分支：

```powershell
git branch --show-current
```

## 四、推荐的分支整理方式

为了以后命令统一，建议本地同时保留一个 `main` 分支，并让两个平台都使用 `main`。

如果确认本地已有修改并且远程内容已经同步，可以执行：

```powershell
cd D:\Project\html
git branch -M main
git push -u github main
git push origin main
```

如果 Gitee 仍然需要 `master` 作为 Pages 发布分支，则不要执行最后的 Gitee 命令，而使用：

```powershell
git push origin main:master
```

## 五、如何确认部署成功

### 检查 GitHub 仓库

打开：

<https://github.com/Etherealnymph/web-projects>

确认最新提交时间已经更新，并且能看到修改后的文件。

### 检查 GitHub Pages

打开：

<https://github.com/Etherealnymph/web-projects/settings/pages>

确认：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`

部署状态可以在仓库的 **Actions** 页面查看：

<https://github.com/Etherealnymph/web-projects/actions>

### 直接访问网页

```text
https://etherealnymph.github.io/web-projects/index.html
```

如果浏览器仍然显示旧内容，可以尝试强制刷新：

- Windows：`Ctrl + F5`
- Chrome/Edge：打开开发者工具后长按刷新按钮，选择“清空缓存并硬性重新加载”

## 六、常见问题

### `nothing to commit, working tree clean`

表示没有检测到新的文件修改，不需要重复提交。

### `rejected` 或 `fetch first`

表示远程仓库比本地更新。先拉取再推送：

```powershell
git pull --rebase github main
git push github main
```

如果出现冲突，解决冲突后执行：

```powershell
git add -A
git rebase --continue
git push github main
```

### 推送时要求登录

GitHub 不再接受普通账号密码进行 Git HTTPS 推送。可以选择：

1. 使用 GitHub CLI 登录；
2. 使用 Personal Access Token 作为密码；
3. 配置 SSH key。

推荐使用 GitHub CLI：

```powershell
gh auth login
```

然后按提示选择：

- GitHub.com
- HTTPS
- Login with a web browser

### Pages 显示 404

按顺序检查：

1. `index.html` 是否位于仓库根目录；
2. Pages 是否选择了 `main` 分支；
3. Pages 是否选择 `/ (root)`；
4. Actions 中的 Pages 部署任务是否成功；
5. 等待几分钟后再刷新。

### `.venv` 不应提交

本项目已经通过 [.gitignore](./.gitignore) 排除了：

- `.venv/`
- `.venv-1/`
- `__pycache__/`
- Python 缓存文件

不要使用下面的命令强行添加被忽略的虚拟环境：

```powershell
git add -f .venv
```

## 七、安全注意事项

- 不要把 GitHub Token、Gitee Token、密码、API key 写进 HTML、JavaScript、README 或提交记录。
- Token 只在需要时临时使用，完成后建议在平台设置中撤销或重新生成。
- 如果 Token 曾经发到聊天、截图、代码或公开仓库中，应立即撤销并重新生成。
- 公共 GitHub Pages 适合部署静态网页，不适合部署需要保密的后端服务。
- GitHub Pages 不能运行 FastAPI。`股票训练场/backend/` 只能在本地或单独的服务器上运行。

### Blog2.0 的隐私边界（必须阅读）

`Blog2.0` 是 Express + MongoDB 应用，不是静态网页。GitHub Pages 只会把仓库文件原样公开，不会运行
`server.js`、Express session、MongoDB、邀请码校验或权限中间件。因此，不能把 `Blog2.0/` 放入当前
GitHub Pages 的发布目录来实现“只有本人或邀请码用户可访问”；任何放进去的 HTML、JavaScript、EJS、
上传文件和源码都可能通过 URL 直接下载，前端登录框也不能提供真正的保密性。

正确部署方式是：

1. GitHub Pages 只发布不含 Blog2.0 数据和后端源码的公开静态内容。
2. 把 `Blog2.0` 部署到支持 Node.js、HTTPS、环境变量和持久化 MongoDB 的服务。
3. 在服务端设置 `MONGODB_URI` 和至少 32 位随机 `SESSION_SECRET`，绝不提交 `.env`。
4. 只通过已登录的 superadmin 会话调用 `POST /admin/invites` 生成邀请码；不要把邀请码写入
   `uploads/`、日志或 Git 仓库。
5. 如果必须使用 `github.io` 域名，使用反向代理/身份网关（例如 Cloudflare Access）保护后端域名，
   并确认网关在请求到达应用前拒绝未授权用户。仅设置仓库为 private 不能推断出公开 Pages URL
   一定受保护。

### Blog2.0 傻瓜式部署方案

如果目标是“让 Blog2.0 真正在线并能登录”，不要把它部署到 GitHub Pages。最简单的组合是：

- GitHub：保存源码；
- Render Web Service：运行 Node.js/Express；
- MongoDB Atlas：保存用户、文章和评论数据。

按下面顺序操作：

1. 把本目录推送到 GitHub（本项目的仓库地址是 `https://github.com/Etherealnymph/web-projects`）。
2. 注册并登录 <https://www.mongodb.com/atlas>，创建一个免费的数据库集群，创建数据库用户，并把网络访问设置为允许 Render 连接。复制 MongoDB 连接字符串。
3. 注册并登录 <https://render.com>，选择 **New > Web Service**，连接上面的 GitHub 仓库。
4. 在 Render 中填写：
   - **Root Directory**：`Blog2.0`
   - **Runtime**：`Node`
   - **Build Command**：`npm ci`
   - **Start Command**：`npm start`
5. 在 Render 的 **Environment Variables** 中新增：
   - `MONGODB_URI`：MongoDB Atlas 的连接字符串；
   - `SESSION_SECRET`：至少 32 位的随机字符串，例如用 PowerShell 生成：
     `-join ((1..48) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 127) })`
   - `NODE_ENV`：`production`
   - `HOST`：`0.0.0.0`
   - `PORT`：不要填写，Render 会自动提供。
6. 点击 **Create Web Service**，等待部署完成。Render 会给出一个 `https://你的服务名.onrender.com` 地址；打开它应先看到登录页。
7. 第一个管理员账号和邀请码必须按项目的管理员脚本/数据库流程创建，不能把邀请码写进 GitHub。部署成功后再根据
   `Blog2.0/README.md` 中的说明创建 `superadmin`，登录后通过管理接口生成邀请码。

注意：Render 免费服务可能会休眠，第一次打开需要等待几十秒；MongoDB Atlas 的数据库用户密码不能提交到仓库。
如果只想发布本项目中的普通静态 HTML 页面，仍然使用本文件前面的 GitHub Pages 地址即可。

## 八、最常用的五条命令

以后大多数时候只需要：

```powershell
cd D:\Project\html
git pull --rebase github main
git add -A
git commit -m "更新网页"
git push github main
```

推送完成后访问：

<https://etherealnymph.github.io/web-projects/index.html>
