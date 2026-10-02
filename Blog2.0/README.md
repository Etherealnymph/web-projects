# Blog2.0 部署与安全

Blog2.0 依赖 Node.js、Express、MongoDB 和服务端 session，不能直接部署到 GitHub Pages。
GitHub Pages 是公开静态文件托管，无法执行登录、邀请码或权限校验。请把后端部署到支持服务端
访问控制的主机；如需使用 `github.io` 作为入口，必须在前置身份网关后转发到后端。

复制 `.env.example` 为 `.env` 并填写真实值：

```text
MONGODB_URI=...
SESSION_SECRET=至少32位随机字符串
NODE_ENV=production
```

邀请码注册已强制启用。只有数据库中 `role=superadmin` 的账号可以调用
`POST /admin/invites` 生成一次性邀请码。邀请码不会自动在启动时生成，也不会写入公开目录。

## 本地运行

```powershell
npm ci
npm start
```

不要提交 `node_modules/`、`.env`、`uploads/` 或日志文件。

## 网络配置
server.js:
```
const HOST = process.env.HOST || '0.0.0.0'
const PORT = process.env.PORT || 12399
app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on http://${HOST}:${PORT}`)
})
```

查看localhost的值
```
hostname -I
//或者：
getent hosts
```

查看eth0
```
ip addr show
```

查看 12399 端口有没有被监听
```
ss -tulpn | grep 12399
```

配置 Windows 端口转发
```
# 把 Windows 的 12399 端口转发到 WSL 的 12399 端口
netsh interface portproxy add v4tov4 listenport=12399 listenaddress=0.0.0.0 connectport=12399 connectaddress=172.24.38.184
#其中 172.24.38.184 是你 WSL 的 IP，用 hostname -I 可以查到
```

关闭 Windows 防火墙拦截
```
# 放行 12399 端口
New-NetFirewallRule -DisplayName "Allow Port 12399" -Direction Inbound -LocalPort 12399 -Protocol TCP -Action Allow
```

查看局域网ip
```
ipconfig
```

邀请码获取
```
export INVITE_RECIPIENT=you@example.com
export SMTP_HOST=smtp.example.com
export SMTP_USER=smtp-user@example.com
export SMTP_PASS=your-smtp-pass
export SMTP_FROM="no-reply@example.com"
npm start
```