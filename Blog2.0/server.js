const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is required; do not put database credentials in source code.');
}

const mongoose = require('mongoose');
mongoose.connect(uri)
  .then(() => console.log('✅ MongoDB 连接成功！'))
  .catch(err => console.log('❌ 连接失败：', err));
const marked = require('marked')
// 明确禁用已弃用的选项，优先于插件注册，确保不会出现弃用警告
marked.setOptions({ mangle: false, headerIds: false, html: false })
// 使用社区插件为 marked 启用 mangle 与 gfm heading id 功能（可选）
try {
  const mangle = require('marked-mangle')
  const gfmHeading = require('marked-gfm-heading-id')
  marked.use(mangle())
  marked.use(gfmHeading())
} catch (e) {
  console.warn('可选 marked 插件未安装，若需启用 mangle/headerIds，请运行: npm install marked-mangle marked-gfm-heading-id')
}
const svgCaptcha = require('svg-captcha')
const session = require('express-session')
const bcrypt = require('bcryptjs')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const nodemailer = require('nodemailer')

// SMTP transporter（通过环境变量配置）
let mailer = null
if (process.env.SMTP_HOST) {
  try {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: (process.env.SMTP_SECURE === 'true'),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    })
    mailer.verify().then(() => console.log('SMTP transporter ready')).catch(e => console.warn('SMTP verify failed', e))
  } catch (e) {
    console.warn('SMTP setup failed', e)
    mailer = null
  }
}

const articleSchema = new mongoose.Schema({
  title: String,
  description: String,
  markdown: String,
  media: [String],
  // type: 'blog' | 'question'
  type: { type: String, default: 'blog' },
  authorId: mongoose.Schema.Types.ObjectId,
  authorNickname: String,
  authorRole: String,
  views: { type: Number, default: 0 },
  likes: [mongoose.Schema.Types.ObjectId],
  favorites: [mongoose.Schema.Types.ObjectId],
  createdAt: { type: Date, default: Date.now }
});
const article = mongoose.model('article', articleSchema);

// 评论模型
const commentSchema = new mongoose.Schema({
  articleId: mongoose.Schema.Types.ObjectId,
  authorId: mongoose.Schema.Types.ObjectId,
  authorNickname: String,
  text: String,
  likes: [mongoose.Schema.Types.ObjectId],
  createdAt: { type: Date, default: Date.now }
})
const Comment = mongoose.model('Comment', commentSchema);

// Answer model for Q&A answers
const answerSchema = new mongoose.Schema({
  articleId: mongoose.Schema.Types.ObjectId, // parent question id
  authorId: mongoose.Schema.Types.ObjectId,
  authorNickname: String,
  text: String,
  likes: [mongoose.Schema.Types.ObjectId],
  favorites: [mongoose.Schema.Types.ObjectId],
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
})
const Answer = mongoose.model('Answer', answerSchema);

// 用户模型，用于登录/注册
const userSchema = new mongoose.Schema({
  nickname: String,
  account: { type: String, unique: true },
  // optional unique email (sparse to allow existing docs without email)
  email: { type: String, unique: true, sparse: true },
  passwordHash: String,
  createdAt: { type: Date, default: Date.now },
  // role: 'user' | 'admin' | 'superadmin'
  role: { type: String, default: 'user' },
  // profile fields
  avatar: String,
  birthday: Date,
  age: Number,
  gender: String,
  mbti: String,
  signature: String
  ,favorites: [mongoose.Schema.Types.ObjectId]
});
const User = mongoose.model('User', userSchema);

// 邀请码模型（用于邀请码注册）
const inviteSchema = new mongoose.Schema({
  codeHash: { type: String, unique: true, required: true },
  used: { type: Boolean, default: false },
  usedBy: mongoose.Schema.Types.ObjectId,
  // persistent=true 表示此邀请码可重复使用、不在注册后标记为已用
  persistent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})
const Invitation = mongoose.model('Invitation', inviteSchema)
const hashInviteCode = code => crypto.createHash('sha256').update(code).digest('hex')
// 确保 uploads 目录存在并作为静态目录
const UPLOAD_DIR = path.join(__dirname, 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR)
// 使用绝对路径提供 public 静态文件（更可靠）
app.use(express.static(path.join(__dirname, 'public')))

// 简单请求日志，帮助定位来自局域网的资源请求是否到达服务器
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.originalUrl}`)
  next()
})

// 基础安全中间件
app.set('trust proxy', 1)
// 禁用 Cross-Origin-Opener-Policy 和 Origin-Agent-Cluster，
// 因为使用非受信任的 HTTP IP 访问会导致浏览器忽略这些头并报错。
// 若改为通过 HTTPS 或使用 localhost 访问，可移除这些禁用项以开启更严格策略。
// 在通过 IP + HTTP 访问时关闭 HSTS 和与 origin-keying 相关的头，
// 避免浏览器将该 IP 强制升级到 HTTPS（导致 ERR_SSL_PROTOCOL_ERROR）。
app.use(helmet({
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  hsts: false
  // 禁用默认的 contentSecurityPolicy，避免自动将资源升级为 HTTPS（upgrade-insecure-requests）
  ,contentSecurityPolicy: false
}))

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next()
  return res.redirect('/login')
}

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10kb' }))

// 解析表单数据（用于处理表单 POST，包括 method-override）
app.use(express.urlencoded({ extended: false, limit: '10kb' }))
const methodOverride = require('method-override')
// 优先从 querystring 读取 `_method`（multipart/form-data 提交时 body 可能无法被解析）
app.use(methodOverride(function (req, res) {
  if (req.query && req.query._method) return req.query._method
  if (req.body && typeof req.body === 'object' && '_method' in req.body) return req.body._method
}))

// 全局速率限制（内存实现，生产请用 Redis 等分布式方案）
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 120, // 每 IP 每分钟 120 次请求
  standardHeaders: true,
  legacyHeaders: false
})
app.use(globalLimiter)

// session 中间件（简单演示用 MemoryStore；生产请用专用 store）
app.use(session({
  name: 'sid',
  secret: (() => {
    const secret = process.env.SESSION_SECRET
    if (!secret || secret.length < 32) {
      throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.')
    }
    return secret
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}))

app.use('/uploads', requireAuth, express.static(UPLOAD_DIR))

// expose current user info to templates
app.use((req, res, next) => {
  res.locals.currentUserId = req.session && req.session.userId ? String(req.session.userId) : null
  res.locals.currentNickname = req.session && req.session.nickname
  res.locals.currentUserRole = req.session && req.session.role
  // theme/brightness/lang stored in session for UI
  res.locals.theme = req.session && req.session.theme ? req.session.theme : 'dark'
  res.locals.brightness = req.session && req.session.brightness ? req.session.brightness : 1
  res.locals.lang = req.session && req.session.lang ? req.session.lang : 'zh-CN'
  res.locals.fontSize = req.session && req.session.fontSize ? req.session.fontSize : '100%'
  next()
})

// Simple i18n dictionary
const i18n = {
  'zh-CN': {
    New: '新建',
    Favorites: '收藏',
    Settings: '设置',
    Blog: '博客',
    Search: '搜索',
    Back: '返回',
    Comments: '评论',
    PostComment: '发表评论',
    PleaseLoginToComment: '请 登录 后发表评论。',
    Answers: '回答',
    SubmitAnswer: '提交回答',
    EditProfile: '编辑主页',
    MyFavorites: '我的收藏',
    Theme: '主题',
    Brightness: '亮度',
    Language: '语言',
    SaveUISettings: '保存界面设置',
    AccountSettings: '账号设置',
    Nickname: '昵称',
    Account: '账号',
    CurrentPassword: '当前密码（修改密码时填写）',
    NewPassword: '新密码',
    Password: '密码',
    SaveAccountSettings: '保存账号设置',
    Admin: '管理员',
    Superadmin: '超管',
    NoArticles: '还没有文章。',
    NoFavorites: '你还没有收藏任何文章。',
    ReadMore: '查看',
     Logout: '登出',
     Search: '搜索',
    RegisteredUsers: '注册用户',
    NoUsers: '暂无用户。',
    PromoteToAdmin: '设为管理员',
    DemoteAdmin: '取消管理员',
    DeleteUser: '删除用户',
    Dark: '深色',
    Light: '浅色',
    Chinese: '中文',
    English: 'English',
    Account: '账号',
    Role: '角色',
    Save: '保存',
    Cancel: '取消',
    Login: '登录',
    Register: '注册',
    SendCode: '发送验证码',
    OtherLogin: '切换登录方式',
    Submit: '提交',
    Unfavorite: '取消收藏',
    View: '查看',
    Home: '主页',
    Favorite: '收藏',
    Favorited: '已收藏',
    Like: '赞',
    Liked: '已赞',
    NoQna: '暂无问答',
    Recommended: '推荐',
    Gender: '性别',
    Age: '年龄',
    Signature: '个性签名',
    Birthday: '生日',
    TheirArticles: 'Ta 的文章',
    PublishedAt: '发布于',
    NotFilled: '未填写',
    None: '暂无',
    SearchResults: '搜索结果（按点赞数排序，最多10条）',
    FontSize: '字号',
    Preview: '预览',
    QandA: '问答',
    NoResults: '未找到相关文章。'
    ,Answer: '回答'
    ,AskedBy: '提问者'
    ,Anonymous: '匿名'
    ,Details: '详情'
    ,WriteYourComment: '写下你的评论...'
    ,WriteYourAnswer: '写下你的回答...'
    ,CommentOnAnswer: '在此评论该回答...'
    ,Delete: '删除'
    ,Title: '标题'
    ,Type: '类型'
    ,Question: '问答'
    ,UploadMedia: '上传图片/视频'
    ,EmailLogin: '邮箱登录'
    ,Email: '邮箱'
    ,EmailPlaceholder: '邮箱地址'
    ,EmailCodePlaceholder: '邮箱验证码'
    ,CaptchaPlaceholder: '输入图形验证码'
    ,EmailCodeInput: '输入邮箱验证码'
    ,Male: '男'
    ,Female: '女'
    ,Other: '其他'
    ,ConfirmPassword: '再输入一遍密码'
    ,OtherRegister: '其他注册方式'
    ,InviteCode: '邀请码'
    ,UseEmailRegister: '使用邮箱验证码注册'
    ,ToggleToEmail: '使用邮箱验证码登录'
    ,ToggleToCaptcha: '使用图片验证码登录'
  },
  'en-US': {
    New: 'New',
    Favorites: 'Favorites',
    Settings: 'Settings',
    Blog: 'Blog',
    Search: 'Search',
    Back: 'Back',
    Comments: 'Comments',
    PostComment: 'Post Comment',
    PleaseLoginToComment: 'Please log in to comment.',
    Answers: 'Answers',
    SubmitAnswer: 'Submit Answer',
    EditProfile: 'Edit Profile',
    MyFavorites: 'My Favorites',
    Theme: 'Theme',
    Brightness: 'Brightness',
    Language: 'Language',
    SaveUISettings: 'Save UI Settings',
    AccountSettings: 'Account Settings',
    Nickname: 'Nickname',
    Account: 'Account',
    CurrentPassword: 'Current password (required to change)',
    NewPassword: 'New password',
    Password: 'Password',
    SaveAccountSettings: 'Save Account Settings',
    Admin: 'Admin',
    Superadmin: 'Superadmin',
    NoArticles: 'No articles yet.',
    NoFavorites: 'You have not favorited any articles.',
    ReadMore: 'Read more',
    Logout: 'Logout',
    Search: 'Search',
    RegisteredUsers: 'Registered users',
    NoUsers: 'No users',
    PromoteToAdmin: 'Promote to admin',
    DemoteAdmin: 'Demote admin',
    DeleteUser: 'Delete user',
    Dark: 'Dark',
    Light: 'Light',
    Chinese: '中文',
    English: 'English',
    Account: 'Account',
    Role: 'Role',
    Save: 'Save',
    Cancel: 'Cancel',
    Login: 'Login',
    Register: 'Register',
    
    OtherLogin: 'Other login',
    Submit: 'Submit',
    Unfavorite: 'Unfavorite',
    View: 'View',
    Home: 'Home',
    Favorite: 'Favorite',
    Favorited: 'Favorited',
    Like: 'Like',
    Liked: 'Liked',
    NoQna: 'No Q&A',
    Recommended: 'Recommended',
    Gender: 'Gender',
    Age: 'Age',
    Signature: 'Signature',
    Birthday: 'Birthday',
    TheirArticles: 'Their articles',
    PublishedAt: 'Published at',
    NotFilled: 'Not filled',
    None: 'None',
    SearchResults: 'Search results (top 10 by likes)',
    FontSize: 'Font size',
    Preview: 'Preview',
    QandA: 'Q&A',
    NoResults: 'No results found.'
    ,Answer: 'Answer'
    ,AskedBy: 'Asked by'
    ,Anonymous: 'Anonymous'
    ,Details: 'Details'
    ,WriteYourComment: 'Write your comment...'
    ,WriteYourAnswer: 'Write your answer...'
    ,CommentOnAnswer: 'Comment on this answer...'
    ,Delete: 'Delete'
    ,Title: 'Title'
    ,Type: 'Type'
    ,Question: 'Question'
    ,UploadMedia: 'Upload photos / videos'

    ,Email: 'Email'
    ,EmailPlaceholder: 'Email address'
    ,EmailCodePlaceholder: 'Email code'
    ,CaptchaPlaceholder: 'Enter the image captcha'
    ,EmailCodeInput: 'Enter the email code'
    ,Male: 'Male'
    ,Female: 'Female'
    ,Other: 'Other'
    ,ConfirmPassword: 'Confirm password'
    ,OtherRegister: 'Other registration'
    ,InviteCode: 'Invite code'
    ,UseEmailRegister: 'Use email code to register'
    ,ToggleToEmail: 'Use email-code login'
    ,ToggleToCaptcha: 'Use image-captcha login'
  }
}

// expose translation helper to templates
app.use((req, res, next) => {
  res.locals.__ = (key) => {
    const lang = req.session && req.session.lang ? req.session.lang : 'zh-CN'
    return (i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key
  }
  next()
})

// 验证码路由：生成 SVG 并把文本存入 session
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 2,
    width: 150,
    height: 50,
    ignoreChars: '0Oo1ilI',
    color: true,
    background: '#f6f6f6'
  })
  req.session.captcha = captcha.text
  // 确保浏览器/中间代理不缓存验证码图片
  console.log(`[CAPTCHA] ${req.ip} -> ${captcha.text}`)
  res.type('svg')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  res.set('Surrogate-Control', 'no-store')
  res.status(200).send(captcha.data)
})

// 显式提供 three.min.js 路由以便调试（静态目录也会提供该文件）
app.get('/js/three.min.js', (req, res, next) => {
  const p = path.join(__dirname, 'public', 'js', 'three.min.js')
  console.log(`[FILE] serving ${p} for ${req.ip}`)
  res.sendFile(p, err => { if (err) next(err) })
})

// Multer 用于处理文件上传
const multer = require('multer')
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    cb(null, safe)
  }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 8 } })

// -- keep media in schema above --

app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  // 需要登录才能查看列表
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const q = (req.query.q || '').trim()
  // 搜索特殊处理：如果有 q，则返回与 q 匹配的文章并按点赞数降序取前 10
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matched = await article.find({ $or: [{ title: re }, { description: re }, { markdown: re }] }).lean()
    matched.forEach(m => { m.likesCount = (m.likes||[]).length })
    const top = matched.sort((a,b)=> (b.likesCount||0) - (a.likesCount||0)).slice(0,10)
    // enrich with author info
    const authorIds = [...new Set((top || []).map(a => a && a.authorId ? String(a.authorId) : null).filter(Boolean))]
    let roleMap = {}
    if (authorIds.length) {
      const users = await User.find({ _id: { $in: authorIds } }).select('_id role avatar nickname').lean()
      users.forEach(u => { roleMap[String(u._id)] = { role: u.role, avatar: u.avatar, nickname: u.nickname } })
    }
    const rendered = top.map(a => {
      const obj = a
      obj.renderedDescription = marked.parse(a.markdown || a.description || '')
      const uinfo = roleMap[String(obj.authorId)]
      if (uinfo) {
        obj.authorRole = uinfo.role || obj.authorRole || null
        obj.authorAvatar = uinfo.avatar || null
        obj.authorNickname = uinfo.nickname || obj.authorNickname
      }
      return obj
    })
    return res.render('all', { searchResults: rendered, query: q })
  }

  // 否则正常加载首页：分为 推荐 / Blog / Q&A
  const all = await article.find().sort({ createdAt: -1 }).lean()
  // 获取这些文章作者的当前角色，优先使用 users 表里的 role 字段
  const authorIds = [...new Set((all || []).map(a => a && a.authorId ? String(a.authorId) : null).filter(Boolean))]
  let roleMap = {}
  if (authorIds.length) {
    const users = await User.find({ _id: { $in: authorIds } }).select('_id role avatar nickname').lean()
    users.forEach(u => { roleMap[String(u._id)] = { role: u.role, avatar: u.avatar, nickname: u.nickname } })
  }
  // enrich and split
  const enriched = all.map(a => {
    const obj = a
    obj.renderedDescription = marked.parse(a.markdown || a.description || '')
    const uinfo = roleMap[String(obj.authorId)]
    if (uinfo) {
      obj.authorRole = uinfo.role || obj.authorRole || null
      obj.authorAvatar = uinfo.avatar || null
      obj.authorNickname = uinfo.nickname || obj.authorNickname
    }
    obj.likesCount = (obj.likes || []).length
    obj.favoritesCount = (obj.favorites || []).length
    return obj
  })
  // Recommended: top 5 by score
  const scored = enriched.map(a => ({ a, score: (a.likesCount||0)*3 + (a.favoritesCount||0)*4 + (a.views||0)*0.1 }))
  const recommended = scored.sort((x,y)=> y.score - x.score).slice(0,5).map(s=>s.a)
  const qna = enriched.filter(a => a.type === 'question')
  const blogs = enriched.filter(a => a.type !== 'question')
  res.render('all', { recommended, blogs, qna, query: q })
})

// 登录页
app.get('/login', (req, res) => {
  res.render('login', { error: null })
})

// show user's favorites
app.get('/favorites', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const uid = req.session.userId
  const user = await User.findOne({ _id: uid }).lean()
  if (!user) return res.redirect('/login')
  const favIds = (user.favorites || []).map(f=> f)
  console.log(`[FAV] uid=${uid} favCount=${(favIds||[]).length}`)
  const arts = favIds.length ? await article.find({ _id: { $in: favIds } }).lean() : []
  console.log(`[FAV] found articles count=${(arts||[]).length}`)
  // enrich author info
  const authorIds = [...new Set((arts || []).map(a => a && a.authorId ? String(a.authorId) : null).filter(Boolean))]
  let roleMap = {}
  if (authorIds.length) {
    const users = await User.find({ _id: { $in: authorIds } }).select('_id role avatar nickname').lean()
    users.forEach(u => { roleMap[String(u._id)] = { role: u.role, avatar: u.avatar, nickname: u.nickname } })
  }
  const enriched = (arts||[]).map(a => {
    const obj = a
    obj.renderedDescription = marked.parse(a.markdown || a.description || '')
    const uinfo = roleMap[String(obj.authorId)]
    if (uinfo) {
      obj.authorRole = uinfo.role || obj.authorRole || null
      obj.authorAvatar = uinfo.avatar || null
      obj.authorNickname = uinfo.nickname || obj.authorNickname
    }
    obj.likesCount = (obj.likes || []).length
    obj.favoritesCount = (obj.favorites || []).length
    return obj
  })
  res.render('favorites', { articles: enriched })
})

// 针对认证的更严格限流
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 每 IP 15 分钟最多 5 次登录/注册尝试
  standardHeaders: true,
  legacyHeaders: false
})

app.post('/login', authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const { nickname, account, password, captcha, email, emailCode } = req.body || {}
  // 支持两种登录方式：账号+密码+图形验证码，或 邮箱+邮箱验证码
  if (email && emailCode) {
    const lg = req.session && req.session.loginCode
    if (!lg || lg.email !== email || String(lg.code) !== String(emailCode) || (lg.expires && lg.expires < Date.now())) {
      return res.render('login', { error: '邮箱验证码错误或已过期' })
    }
    try { delete req.session.loginCode } catch (e) {}
    const user = await User.findOne({ email })
    if (!user) return res.render('login', { error: '该邮箱未注册' })
    req.session.userId = user._id
    req.session.nickname = user.nickname
    req.session.role = user.role
    return res.redirect('/')
  }

  if (!nickname || !account || !password) return res.render('login', { error: '请填写昵称、账号和密码' })
  // 验证码校验
  if (!captcha || captcha.toLowerCase() !== (req.session.captcha || '').toLowerCase()) {
    return res.render('login', { error: '验证码错误' })
  }
  // 清除已使用的验证码
  try { delete req.session.captcha } catch (e) {}

  const user = await User.findOne({ account })
  if (!user) return res.render('login', { error: '账号或密码错误' })
  const ok = await bcrypt.compare(password, user.passwordHash || '')
  if (!ok || user.nickname !== nickname) return res.render('login', { error: '昵称、账号或密码不匹配' })
  req.session.userId = user._id
  req.session.nickname = user.nickname
  req.session.role = user.role
  res.redirect('/')
})

// 注册页
app.get('/register', (req, res) => {
  res.render('register', { error: null })
})

// 发送注册邮箱验证码（演示：将验证码保存在 session 并打印到控制台；可替换为真实 SMTP 发送）
app.post('/send-register-code', express.json(), authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ ok: false, error: '缺少邮箱' })
    // 防止并发/重复请求：若已存在 3 分钟发送锁则拒绝
    const lock = req.session && req.session.registerSending
    if (lock && lock > Date.now()) {
      const retryAfter = Math.ceil((lock - Date.now()) / 1000)
      return res.status(429).json({ ok: false, error: '请勿频繁发送', retryAfterSec: retryAfter })
    }
    // 设置发送锁（3 分钟），同步写入 session 避免短时并发重复发送
    try { if (!req.session) req.session = {} } catch(e) {}
    req.session.registerSending = Date.now() + 3 * 60 * 1000
    // 检查是否已被注册
    const exists = await User.findOne({ email })
    if (exists) return res.status(400).json({ ok: false, error: '该邮箱已被注册' })
    const code = Math.floor(100000 + Math.random() * 900000)
    req.session.registerCode = { email, code, expires: Date.now() + 10 * 60 * 1000 }
    // 发送邮件（优先使用已配置的 SMTP），若未配置则打印到控制台以便调试
    if (mailer) {
      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@localhost',
          to: email,
          subject: '注册验证码',
          text: `您的注册验证码为 ${code}，有效期 10 分钟。请勿泄露。`
        })
        return res.json({ ok: true })
      } catch (e) {
        console.error('Failed to send register email', e)
        return res.status(500).json({ ok: false, error: '邮件发送失败' })
      }
    }
    console.log(`Register code for ${email}: ${code} (valid 10 minutes)`) 
    return res.json({ ok: true, note: 'smtp-not-configured', retryAfterSec: 3*60 })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: '服务器错误' })
  }
})

// 发送登录邮箱验证码（演示：将验证码保存在 session 并打印到控制台）
app.post('/send-login-code', express.json(), authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ ok: false, error: '缺少邮箱' })
    // 防止并发/重复请求：若已存在 3 分钟发送锁则拒绝
    const lock = req.session && req.session.loginSending
    if (lock && lock > Date.now()) {
      const retryAfter = Math.ceil((lock - Date.now()) / 1000)
      return res.status(429).json({ ok: false, error: '请勿频繁发送', retryAfterSec: retryAfter })
    }
    try { if (!req.session) req.session = {} } catch (e) {}
    req.session.loginSending = Date.now() + 3 * 60 * 1000
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ ok: false, error: '该邮箱尚未注册' })
    const code = Math.floor(100000 + Math.random() * 900000)
    req.session.loginCode = { email, code, expires: Date.now() + 10 * 60 * 1000 }
    if (mailer) {
      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@localhost',
          to: email,
          subject: '登录验证码',
          text: `您的登录验证码为 ${code}，有效期 10 分钟。请勿泄露。`
        })
        return res.json({ ok: true })
      } catch (e) {
        console.error('Failed to send login email', e)
        return res.status(500).json({ ok: false, error: '邮件发送失败' })
      }
    }
    console.log(`Login code for ${email}: ${code} (valid 10 minutes)`) 
    return res.json({ ok: true, note: 'smtp-not-configured', retryAfterSec: 3*60 })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: '服务器错误' })
  }
})

app.post('/register', authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const { nickname, account, password, password2, email, emailCode, inviteCode } = req.body || {}
  if (!nickname || !account || !password || !password2 || !email) return res.render('register', { error: '请填写昵称、账号、邮箱和两次密码' })
  if (password !== password2) return res.render('register', { error: '两次输入的密码不一致' })

  // Registration is invite-only. Email verification is not an access-control boundary.
  let usedInvite = null
  const code = String(inviteCode || '').trim()
  if (!code) return res.render('register', { error: 'Blog2.0 仅接受邀请码注册' })
  const inv = await Invitation.findOne({ codeHash: hashInviteCode(code) })
  if (!inv || (!inv.persistent && inv.used)) return res.render('register', { error: '邀请码无效或已被使用' })
  usedInvite = inv

  // 检查账号与邮箱唯一性
  const existsAcc = await User.findOne({ account })
  if (existsAcc) return res.render('register', { error: '该账号已被注册' })
  const existsEmail = await User.findOne({ email })
  if (existsEmail) return res.render('register', { error: '该邮箱已被注册' })

  const hash = await bcrypt.hash(password, 10)
  const u = new User({ nickname, account, email, passwordHash: hash, role: 'user' })
  await u.save()

  // 标记邀请已使用
  if (usedInvite && !usedInvite.persistent) {
    const consumed = await Invitation.findOneAndUpdate(
      { _id: usedInvite._id, used: false },
      { $set: { used: true, usedBy: u._id } },
      { new: true }
    )
    if (!consumed) {
      await User.deleteOne({ _id: u._id })
      return res.render('register', { error: '邀请码刚刚被使用，请重新获取邀请码' })
    }
  }

  res.redirect('/login')
})

app.get('/logout', (req, res) => {
  req.session && req.session.destroy && req.session.destroy(() => {})
  res.redirect('/login')
})

app.get('/new', requireAuth, (req, res) => {
  res.render('new');
})

// language switcher for unauthenticated pages (sets session.lang and redirects back)
app.get('/set-lang', (req, res) => {
  try {
    const l = req.query && req.query.lang === 'en-US' ? 'en-US' : 'zh-CN'
    if (req.session) req.session.lang = l
  } catch (e) {}
  const back = req.get('Referer') || '/'
  return res.redirect(back)
})

// settings page (GET shows form, POST updates)
app.get('/settings', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const u = await User.findOne({ _id: req.session.userId }).lean()
  console.log(`[SET] uid=${req.session.userId} user=${u ? u.account : 'null'}`)
  return res.render('settings', { theme: req.session.theme || 'dark', brightness: req.session.brightness || 1, lang: req.session.lang || 'zh-CN', fontSize: req.session.fontSize || '100%', currentNickname: u && u.nickname, currentAccount: u && u.account })
})

app.post('/settings', express.urlencoded({ extended: false }), async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  try {
    const section = req.body._section || 'ui'
    const uid = req.session.userId
    if (section === 'ui') {
      // save theme/brightness/lang to session
      req.session.theme = req.body.theme === 'light' ? 'light' : 'dark'
      req.session.brightness = parseFloat(req.body.brightness) || 1
      req.session.lang = req.body.lang === 'en-US' ? 'en-US' : 'zh-CN'
      // accept a small whitelist of relative font-size values (percentages)
      const allowed = ['90%','95%','100%','105%','110%','115%','120%']
      req.session.fontSize = allowed.includes(String(req.body.fontSize)) ? String(req.body.fontSize) : '100%'
      return res.redirect('/settings')
    }
    if (section === 'account') {
      const { nickname, account, currentPassword, newPassword } = req.body || {}
      const user = await User.findOne({ _id: uid })
      if (!user) return res.redirect('/login')
      // if changing password, verify currentPassword
      if (newPassword) {
        const ok = await bcrypt.compare(currentPassword || '', user.passwordHash || '')
        if (!ok) return res.render('settings', { theme: req.session.theme||'dark', brightness: req.session.brightness||1, lang: req.session.lang||'zh-CN', currentNickname: user.nickname, currentAccount: user.account, error: '当前密码错误' })
        user.passwordHash = await bcrypt.hash(newPassword, 10)
      }
      if (nickname) user.nickname = nickname
      if (account) user.account = account
      await user.save()
      req.session.nickname = user.nickname
      return res.redirect('/settings')
    }
  } catch (e) {
    console.error(e)
    return res.redirect('/settings')
  }
})

// Note: edit UI remains but link removed from listing by templates
app.get('/edit/:id', async (req, res) => {
    const one = await article.findOne({ _id: req.params.id });
    res.render('edit', { article: one })
})

// redirect to own profile
app.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  return res.redirect(`/user/${req.session.userId}`)
})

// view user profile by id
app.get('/user/:id', async (req, res) => {
  try {
    const uid = req.params.id
    const u = await User.findOne({ _id: uid })
    if (!u) return res.redirect('/')
    const arts = await article.find({ authorId: u._id }).sort({ createdAt: -1 })
    // 将文章的 authorRole 使用用户当前角色覆盖，保证显示一致
    const articlesWithRole = (arts || []).map(a => {
      const obj = (a && a.toObject) ? a.toObject() : a
      obj.authorRole = u.role || obj.authorRole || null
      obj.renderedDescription = marked.parse(a.markdown || a.description || '')
      return obj
    })
    return res.render('profile', { user: u, articles: articlesWithRole })
  } catch (e) {
    return res.redirect('/')
  }
})

// admin: list users (only superadmin)
function requireSuper(req, res, next) {
  if (req.session && req.session.role === 'superadmin') return next()
  return res.redirect('/')
}

app.post('/admin/invites', requireSuper, async (req, res) => {
  try {
    let code
    do {
      code = crypto.randomBytes(12).toString('base64url').toUpperCase()
    }     while (await Invitation.exists({ codeHash: hashInviteCode(code) }))
    await Invitation.create({ codeHash: hashInviteCode(code), persistent: false })
    return res.json({ ok: true, code })
  } catch (error) {
    console.error('Failed to create invite', error)
    return res.status(500).json({ ok: false, error: '无法生成邀请码' })
  }
})

function requireAdminOrSuper(req, res, next) {
  if (req.session && (req.session.role === 'admin' || req.session.role === 'superadmin')) return next()
  return res.redirect('/')
}

app.get('/admin/users', requireAdminOrSuper, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 })
  res.render('admin_users', { users })
})

app.post('/admin/user/:id/promote', requireAdminOrSuper, async (req, res) => {
  const u = await User.findOne({ _id: req.params.id })
  if (!u) return res.redirect('/admin/users')
  // 普通管理员不能修改超级管理员的角色
  if (u.role === 'superadmin' && req.session.role !== 'superadmin') return res.redirect('/admin/users')
  u.role = 'admin'
  await u.save()
  // update existing articles
  await article.updateMany({ authorId: u._id }, { authorRole: u.role })
  res.redirect('/admin/users')
})

app.post('/admin/user/:id/demote', requireAdminOrSuper, async (req, res) => {
  const u = await User.findOne({ _id: req.params.id })
  if (!u) return res.redirect('/admin/users')
  // 普通管理员不能修改超级管理员的角色
  if (u.role === 'superadmin' && req.session.role !== 'superadmin') return res.redirect('/admin/users')
  u.role = 'user'
  await u.save()
  await article.updateMany({ authorId: u._id }, { authorRole: u.role })
  res.redirect('/admin/users')
})

// superadmin can delete a registered user
app.delete('/admin/user/:id', requireSuper, async (req, res) => {
  const uid = req.params.id
  await User.deleteMany({ _id: uid })
  // optionally leave their articles or remove; here we keep articles but clear author info
  await article.updateMany({ authorId: uid }, { authorNickname: '已注销', authorId: null, authorRole: null })
  res.redirect('/admin/users')
})

// edit profile (only owner)
app.get('/user/:id/edit', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  if (String(req.session.userId) !== String(req.params.id)) return res.redirect(`/user/${req.params.id}`)
  const u = await User.findOne({ _id: req.params.id })
  if (!u) return res.redirect('/')
  res.render('profile_edit', { user: u })
})

// update profile
app.put('/user/:id', upload.single('avatar'), async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  if (String(req.session.userId) !== String(req.params.id)) return res.redirect(`/user/${req.params.id}`)
  const u = await User.findOne({ _id: req.params.id })
  if (!u) return res.redirect('/')
  if (req.file) {
    u.avatar = '/uploads/' + req.file.filename
  }
  if (req.body.birthday) u.birthday = req.body.birthday
  if (req.body.age) u.age = parseInt(req.body.age) || undefined
  if (req.body.gender) u.gender = req.body.gender
  if (req.body.mbti) u.mbti = req.body.mbti
  if (req.body.signature) u.signature = req.body.signature
  await u.save()
  // update session nickname if changed
    req.session.nickname = u.nickname
  // 保存后返回用户个人主页，显示更新后的信息
  res.redirect(`/user/${req.params.id}`)
})

// View single article (used by "Read more")
app.get('/article/:id', requireAuth, async (req, res) => {
  // increment views atomically
  const aid = req.params.id
  const userId = req.session && req.session.userId ? String(req.session.userId) : null
  await article.updateOne({ _id: aid }, { $inc: { views: 1 } })
  const one = await article.findOne({ _id: aid })
  if (!one) return res.redirect('/')
  const rendered = marked.parse(one.markdown || one.description || '')
  // prepare flags for current user
  const isLiked = userId && one.likes && one.likes.some(id => String(id) === String(userId))
  const isFavorited = userId && one.favorites && one.favorites.some(id => String(id) === String(userId))
  // fetch comments (if question sort by likes desc, else by newest)
  let comments = await Comment.find({ articleId: aid }).lean()
  if (one.type === 'question') {
    comments.sort((a,b) => (b.likes || []).length - (a.likes || []).length)
  } else {
    comments.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
  comments.forEach(c => {
    c.likesCount = (c.likes || []).length
    c.isLiked = userId && (c.likes || []).some(id => String(id) === String(userId))
  })
  const articleObj = (one && one.toObject) ? one.toObject() : one
  articleObj.likesCount = (one.likes || []).length
  articleObj.favoritesCount = (one.favorites || []).length
  articleObj.isLiked = !!isLiked
  articleObj.isFavorited = !!isFavorited
  // if question type, load answers and their comments
  let answers = []
  if (one.type === 'question') {
    const rawAnswers = await Answer.find({ articleId: aid }).lean()
    // enrich answers
    for (let a of rawAnswers) {
      a.likesCount = (a.likes || []).length
      a.favoritesCount = (a.favorites || []).length
      a.views = a.views || 0
      a.isLiked = userId && (a.likes || []).some(id => String(id) === String(userId))
      a.isFavorited = userId && (a.favorites || []).some(id => String(id) === String(userId))
      // load comments for this answer
      const aComments = await Comment.find({ articleId: a._id }).lean()
      aComments.forEach(c => {
        c.likesCount = (c.likes || []).length
        c.isLiked = userId && (c.likes || []).some(id => String(id) === String(userId))
      })
      a.comments = aComments
      answers.push(a)
    }
    // sort answers by likes desc
    answers.sort((x,y) => (y.likesCount||0) - (x.likesCount||0))
  }
  res.render('display', { article: articleObj, renderedMarkdown: rendered, comments, answers })
})

// 支持多文件上传，表单字段名为 media
app.post('/new', requireAuth, upload.array('media', 8), async (req,res) => {
  const files = (req.files || []).map(f => '/uploads/' + f.filename)
  console.log('Uploaded files:', files)
  one = new article({
    title: req.body.title,
    description: req.body.description,
    markdown: req.body.markdown || '',
    media: files,
    type: req.body.type || 'blog',
    authorId: req.session && req.session.userId,
    authorNickname: req.session && req.session.nickname,
    authorRole: req.session && req.session.role
  });
  await one.save();
  // redirect to the article page so GET /article/:id will load comments properly
  res.redirect(`/article/${one._id}`)
})

// Toggle like for article
app.post('/article/:id/like', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const aid = req.params.id
  const uid = req.session.userId
  const has = await article.findOne({ _id: aid, likes: uid })
  if (has) {
    await article.updateOne({ _id: aid }, { $pull: { likes: uid } })
  } else {
    await article.updateOne({ _id: aid }, { $addToSet: { likes: uid } })
  }
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const one = await article.findOne({ _id: aid }).lean()
    return res.json({ likesCount: (one.likes||[]).length, isLiked: !has })
  }
  res.redirect(`/article/${aid}`)
})

// Toggle favorite for article (tracks per-user favorites)
app.post('/article/:id/favorite', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const aid = req.params.id
  const uid = req.session.userId
  const user = await User.findOne({ _id: uid })
  if (!user) return res.redirect('/login')
  const has = (user.favorites || []).some(f => String(f) === String(aid))
  if (has) {
    await User.updateOne({ _id: uid }, { $pull: { favorites: aid } })
    await article.updateOne({ _id: aid }, { $pull: { favorites: uid } })
  } else {
    await User.updateOne({ _id: uid }, { $addToSet: { favorites: aid } })
    await article.updateOne({ _id: aid }, { $addToSet: { favorites: uid } })
  }
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const one = await article.findOne({ _id: aid }).lean()
    const user2 = await User.findOne({ _id: uid }).lean()
    return res.json({ favoritesCount: (one.favorites||[]).length, isFavorited: (user2.favorites||[]).some(f=>String(f)===String(aid)) })
  }
  res.redirect(`/article/${aid}`)
})

// Add comment
app.post('/article/:id/comments', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const aid = req.params.id
  const uid = req.session.userId
  const user = await User.findOne({ _id: uid })
  if (!user) return res.redirect('/login')
  const text = (req.body.text || '').trim()
  if (!text) return res.redirect(`/article/${aid}`)
  const c = new Comment({ articleId: aid, authorId: uid, authorNickname: user.nickname, text })
  await c.save()
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const saved = await Comment.findOne({ _id: c._id }).lean()
    return res.json({ ok: true, comment: saved })
  }
  res.redirect(`/article/${aid}`)
})

// create an answer for a question
app.post('/article/:id/answers', async (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ ok: false, error: '未登录' })
  const aid = req.params.id
  const user = await User.findOne({ _id: req.session.userId })
  if (!user) return res.status(401).json({ ok: false, error: '未登录' })
  const text = (req.body.text || '').trim()
  if (!text) return res.status(400).json({ ok: false, error: '内容不能为空' })
  const ans = new Answer({ articleId: aid, authorId: user._id, authorNickname: user.nickname, text })
  await ans.save()
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const saved = await Answer.findOne({ _id: ans._id }).lean()
    return res.json({ ok: true, answer: saved })
  }
  res.redirect(`/article/${aid}`)
})

// toggle like on an answer
app.post('/answer/:id/like', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const id = req.params.id
  const uid = req.session.userId
  const has = await Answer.findOne({ _id: id, likes: uid })
  if (has) await Answer.updateOne({ _id: id }, { $pull: { likes: uid } })
  else await Answer.updateOne({ _id: id }, { $addToSet: { likes: uid } })
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const a = await Answer.findOne({ _id: id }).lean()
    return res.json({ likesCount: (a.likes||[]).length, isLiked: !has })
  }
  return res.redirect(req.get('Referer') || '/')
})

// toggle favorite on an answer
app.post('/answer/:id/favorite', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const id = req.params.id
  const uid = req.session.userId
  const a = await Answer.findOne({ _id: id })
  if (!a) return res.redirect(req.get('Referer') || '/')
  const has = (a.favorites || []).some(f => String(f) === String(uid))
  if (has) await Answer.updateOne({ _id: id }, { $pull: { favorites: uid } })
  else await Answer.updateOne({ _id: id }, { $addToSet: { favorites: uid } })
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const anew = await Answer.findOne({ _id: id }).lean()
    return res.json({ favoritesCount: (anew.favorites||[]).length, isFavorited: (anew.favorites||[]).some(f=>String(f)===String(uid)) })
  }
  return res.redirect(req.get('Referer') || '/')
})

// add comment to an answer
app.post('/answer/:id/comments', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const id = req.params.id
  const uid = req.session.userId
  const user = await User.findOne({ _id: uid })
  if (!user) return res.redirect('/login')
  const text = (req.body.text || '').trim()
  if (!text) return res.redirect(req.get('Referer') || '/')
  const c = new Comment({ articleId: id, authorId: uid, authorNickname: user.nickname, text })
  await c.save()
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const saved = await Comment.findOne({ _id: c._id }).lean()
    return res.json({ ok: true, comment: saved })
  }
  // redirect back to question page if possible
  const parent = await Answer.findOne({ _id: id }).lean()
  if (parent && parent.articleId) return res.redirect(`/article/${parent.articleId}`)
  res.redirect('/')
})

// Toggle like for comment
app.post('/comment/:id/like', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login')
  const cid = req.params.id
  const uid = req.session.userId
  const com = await Comment.findOne({ _id: cid, likes: uid })
  if (com) {
    await Comment.updateOne({ _id: cid }, { $pull: { likes: uid } })
  } else {
    await Comment.updateOne({ _id: cid }, { $addToSet: { likes: uid } })
  }
  if (req.xhr || (req.get('Accept') && req.get('Accept').includes('application/json'))) {
    const cobj = await Comment.findOne({ _id: cid }).lean()
    return res.json({ likesCount: (cobj.likes||[]).length, isLiked: !com })
  }
  const cobj = await Comment.findOne({ _id: cid }).lean()
  if (cobj && cobj.articleId) return res.redirect(`/article/${cobj.articleId}`)
  res.redirect('/')
})

app.delete('/:id', async (req, res) => {
  const one = await article.findOne({ _id: req.params.id })
  if (!one) return res.redirect('/')
  const role = req.session && req.session.role
  const uid = req.session && req.session.userId

  // fetch the author's current role (if exists)
  let authorRole = null
  try {
    if (one.authorId) {
      const a = await User.findOne({ _id: one.authorId }).select('role').lean()
      if (a) authorRole = a.role
    }
  } catch (e) { authorRole = null }

  let allowed = false
  // superadmin can delete any post
  if (role === 'superadmin') allowed = true
  // admin can delete posts except those owned by admin or superadmin
  else if (role === 'admin') {
    if (authorRole !== 'admin' && authorRole !== 'superadmin') allowed = true
  }
  // normal user can delete their own posts
  else if (uid && one.authorId && String(one.authorId) === String(uid)) {
    allowed = true
  }

  if (allowed) {
    await article.deleteOne({ _id: req.params.id })
  }
  return res.redirect('/')
})

// 编辑也支持上传新媒体（会追加到现有 media 列表）
app.put('/:id', requireAuth, upload.array('media', 8), async (req, res) => {
  const files = (req.files || []).map(f => '/uploads/' + f.filename)
  console.log('PUT uploaded files:', files)

  var one = await article.findOne({ _id: req.params.id });
    if (one != null) {
    const isOwner = one.authorId && String(one.authorId) === String(req.session.userId)
    const isAdmin = req.session.role === 'admin' || req.session.role === 'superadmin'
    if (!isOwner && !isAdmin) return res.status(403).send('Forbidden')
    one.title = req.body.title
    one.description = req.body.description
    one.markdown = req.body.markdown || one.markdown
    if (!one.media) one.media = []
    one.media = one.media.concat(files)
    await one.save();       
      return res.redirect(`/article/${one._id}`)
  }

  // fallback if not found
    return res.redirect('/')
})

const HOST = process.env.HOST || '0.0.0.0'
const PORT = process.env.PORT || 12399

app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on http://${HOST}:${PORT}`)
})