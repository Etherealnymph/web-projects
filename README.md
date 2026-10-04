# 个人网页项目集合

这是一个本地网页项目集合，包含学习训练、交互实验、模拟工具、小游戏和应用页面。

## 总入口

推荐先打开项目目录页：

```text
D:\Project\html\index.html
```

也可以直接使用浏览器打开：

```text
file:///D:/Project/html/index.html
```

目录页提供：

- 所有项目的统一入口
- 每个项目的用途说明
- 按类别筛选
- 关键词搜索
- 适配电脑和手机浏览器

## 项目分类

### 学习训练

| 项目 | 入口 | 说明 |
|---|---|---|
| 股票训练场 | [股票训练场/股票训练场.html](./股票训练场/股票训练场.html) | 股票行情、模拟交易、持仓、交易记录和支出训练 |
| 词汇选择题刷题 | [词汇选择题180题刷题网页.html](./词汇选择题180题刷题网页.html) | 180 题英语词汇选择题练习 |
| 数感训练场 | [数感训练场.html](./数感训练场.html) | 数字直觉和心算训练 |
| 宇宙历史 | [宇宙历史.html](./宇宙历史.html) | 太阳系起源与演化互动教学 |
| 生态系统模拟器 | [生态系统模拟器.html](./生态系统模拟器.html) | 生态系统和环境变化模拟 |

### 实验工具

| 项目 | 入口 | 说明 |
|---|---|---|
| 傅里叶轮廓实验室 | [fourier-contour/index.html](./fourier-contour/index.html) | 图形轮廓的傅里叶分解与动画 |
| 傅里叶实验页面 | [Foulier.html](./Foulier.html) | 早期傅里叶实验页面 |
| PID 控制算法实验室 | [PID.html](./PID.html) | PID 参数和系统响应可视化 |
| 半导体器件虚拟实验室 | [PN.html](./PN.html) | PN 结器件动力学与参数分析 |
| 光的散射实验室 | [Light.html](./Light.html) | 瑞利散射、米氏散射和几何光学 |
| 数字存储示波器 | [DS-2000 DIGITAL STORAGE OSCILLOSCOPE.html](./DS-2000%20DIGITAL%20STORAGE%20OSCILLOSCOPE.html) | 示波器波形观察 |
| 数字示波器 FFT 版 | [DS-2000 DIGITAL STORAGE OSCILLOSCOPE - FFT.html](./DS-2000%20DIGITAL%20STORAGE%20OSCILLOSCOPE%20-%20FFT.html) | 示波器和 FFT 频谱分析 |
| WaveScope | [WaveScope.html](./WaveScope.html) | 数字波形观察工具 |
| EMC 滤波器实验室 | [共模差模.html](./共模差模.html) | 共模、差模信号和滤波器分析 |
| TSMC RF 器件计算器 | [SpiceTool.html](./SpiceTool.html) | 0.18µm RF 器件和 BSIM3v3 计算 |
| ESP32C3 控制面板 | [ESP32C3.html](./ESP32C3.html) | ESP32C3 交互控制页面 |

### 应用工具

| 项目 | 入口 | 说明 |
|---|---|---|
| 双语专业词典 | [bilingual-dictionary/index.html](./bilingual-dictionary/index.html) | 电子、电气和计算机专业词汇查询 |
| AI 工具大全 | [AI.html](./AI.html) | AI 工具和资源入口 |
| 作业 1 | [homework1.html](./homework1.html) | 课程或实验作业页面 |
| 作业 3 | [homework3.html](./homework3.html) | 课程或实验作业页面 |

### 游戏娱乐

| 项目 | 入口 | 说明 |
|---|---|---|
| 怒海争锋 | [seawar.html](./seawar.html) | 海域领地战游戏 |
| 铁血战线 | [WAR.html](./WAR.html) | 战争模拟和策略对抗 |
| 幸运老虎机 | [Tiger.html](./Tiger.html) | 轻量老虎机小游戏 |
| 猫咪互动页面 | [v3.0.html](./v3.0.html) | 猫咪主题互动页面 |


## 体悟集（私人站点）

`insight-space/` 是一个可部署到 GitHub Pages 的私人「体悟」网站，纯静态前端 + 可选 Supabase 后端，无需构建。

```text
insight-space/
├─ index.html
├─ README.md
├─ supabase/schema.sql
├─ assets/
└─ src/
```

主要能力：

- 推荐（按综合热度排序）、日记、诗歌、文案、评论等模块，超管可在后台自由增删改；
- 超管管理邀请码与账号；其他人用邀请码注册，邀请码停用 / 过期后对应模块访问立即失效；
- 内容支持图片 / 视频 / 文档上传、Markdown 正文、语音与表情包；
- 内容与评论都支持点赞 / 踩 / 收藏 / 评论（多级回复）；
- 个人主页可改昵称与密码，支持中英文切换与日间 / 夜间主题。

两种运行模式：

| 模式 | 数据位置 | 说明 |
|---|---|---|
| 本地模式（默认） | 浏览器 IndexedDB | 打开即用，适合单人 / 演示 |
| Supabase 模式 | Supabase 数据库 | 真实多人账号与权限，需按 `insight-space/README.md` 配置 |

本地打开：

```powershell
cd D:\Project\html
python -m http.server 8123 --bind 127.0.0.1
# http://127.0.0.1:8123/insight-space/
```

在线入口：<https://etherealnymph.github.io/web-projects/insight-space/>

详细说明（部署、Supabase 建表、邀请码与权限模型）见 [insight-space/README.md](./insight-space/README.md)。

## 股票训练场

股票训练场由静态前端和 FastAPI 后端组成：

```text
股票训练场/
├─ 股票训练场.html
├─ README.md
└─ backend/
   ├─ main.py
   ├─ requirements.txt
   └─ README.md
```

### 直接打开前端

双击：

```text
D:\Project\html\股票训练场\股票训练场.html
```

前端可以在没有后端的情况下运行，使用内置行情快照。

### 启动正式行情后端

在 PowerShell 中执行：

```powershell
cd D:\Project\html\股票训练场
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

启动后打开：

```text
http://127.0.0.1:8000/api/health
```

如果返回下面内容，说明后端正常：

```json
{"status":"ok","service":"a-share-quotes"}
```

然后打开股票训练场页面，点击“刷新行情”即可请求 AKShare 行情。

### 股票后端 API

| API | 作用 |
|---|---|
| `GET /api/health` | 检查服务状态 |
| `GET /api/stocks` | 获取支持的股票目录 |
| `GET /api/quotes?symbols=600519,000001` | 获取指定股票行情 |

行情服务使用 AKShare 的 `stock_zh_a_spot_em` 接口，底层数据来自东方财富公开行情。
服务带有 30 秒内存缓存。行情接口受交易时间、网络状态、访问频率和上游服务影响。

股票训练场仅用于学习和模拟训练，不连接真实券商，也不会产生真实订单，不构成投资建议。

## 其他独立项目

### `fourier-contour/`

傅里叶轮廓项目包含独立资源和工具：

```text
fourier-contour/
├─ index.html
├─ assets/
├─ examples/
├─ docs/
└─ tools/
```

### `bilingual-dictionary/`

双语词典项目包含词库数据文件和校验脚本：

```text
bilingual-dictionary/
├─ index.html
├─ data-*.js
├─ data-validator.js
└─ smoke-test.js
```

### `数感训练场.src/`

这是数感训练场的源代码目录，包含核心逻辑、界面和测试文件。正常使用时直接打开根目录的 [数感训练场.html](./数感训练场.html) 即可。

## 使用说明

- 大多数项目是纯 HTML 文件，可以直接双击打开。
- 如果浏览器限制本地文件访问资源，建议使用 VS Code 的 Live Server 或其他静态文件服务器。
- 股票训练场的正式行情功能需要单独启动 FastAPI 后端。
- 各项目的数据和状态可能保存在浏览器 `localStorage` 中。
- 请不要随意移动单个项目内部的资源文件，否则可能导致相对路径失效。

## 使用静态服务器打开

如果需要统一通过本地 HTTP 地址访问，可以在根目录启动一个静态服务器：

```powershell
cd D:\Project\html
python -m http.server 5500
```

然后打开：

```text
http://127.0.0.1:5500/index.html
```

注意：静态服务器只负责网页文件，不能替代股票训练场的 FastAPI 行情后端。股票训练场后端仍然需要单独运行在 `127.0.0.1:8000`。

## 项目维护

新增网页项目后，建议同步更新：

1. 根目录的 `index.html`
2. 本 README
3. 对应项目目录内的 README（如果项目包含多个文件或需要后端）
