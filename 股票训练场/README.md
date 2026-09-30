# 股市训练场

这是一个“前端页面 + FastAPI 后端 + AKShare 行情适配”的股票模拟训练项目。

## 目录结构

```text
股票训练场/
├─ 股票训练场.html       # 模拟交易前端，可直接用浏览器打开
├─ README.md             # 项目使用说明
└─ backend/
   ├─ main.py            # FastAPI 服务和 AKShare 行情接口
   ├─ requirements.txt   # Python 依赖
   └─ README.md          # 后端接口说明
```

## 快速启动

### 1. 创建 Python 虚拟环境

在本目录打开 PowerShell：

```powershell
cd D:\Project\html\股票训练场
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

如果 PowerShell 禁止执行激活脚本，也可以不激活环境，直接使用：

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. 安装依赖

```powershell
python -m pip install -r .\backend\requirements.txt
```

### 3. 启动后端

```powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

看到下面的地址说明后端已启动：

```text
http://127.0.0.1:8000
```

### 4. 打开前端

保持后端窗口运行，然后双击打开：

```text
股票训练场.html
```

也可以在浏览器访问：

```text
file:///D:/Project/html/股票训练场/股票训练场.html
```

打开页面后点击“刷新行情”，前端会从本地 FastAPI 服务请求 AKShare 行情。

## API 地址

| 地址 | 作用 |
|---|---|
| `GET /api/health` | 检查服务是否正常 |
| `GET /api/stocks` | 获取支持的股票代码目录 |
| `GET /api/quotes?symbols=600519,000001` | 获取指定股票实时行情 |

例如：

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/stocks
http://127.0.0.1:8000/api/quotes?symbols=600519,000001
```

## 功能

- 36 只常见 A 股行情目录
- AKShare 正式行情接口
- 30 秒内存缓存，降低上游请求频率
- 模拟买入、卖出和持仓成本计算
- A 股 100 股一手规则
- 模拟佣金计算
- T+1 卖出限制
- 交易记录和日常支出记录
- 浏览器本地保存训练数据
- 后端暂时不可用时使用内置快照继续练习
- 侧边栏支持总览、交易练习、我的持仓、财务管理、新手课程、交易记录和设置页面切换

## 数据说明

行情由 AKShare 的 `stock_zh_a_spot_em` 接口获取，底层数据来自东方财富公开行情。
行情受交易时间、网络、接口限流和上游服务状态影响。后端请求失败时会返回明确错误，
前端会提示后端不可用并回退到内置快照。

本项目仅用于学习和模拟训练，不构成任何投资建议。模拟交易不会连接真实券商，也不会产生真实订单。

## 常见问题

### 页面显示“后端未连接”

确认后端启动命令仍在运行，并检查：

```text
http://127.0.0.1:8000/api/health
```

如果返回：

```json
{"status":"ok","service":"a-share-quotes"}
```

说明后端正常，刷新前端页面即可。

### AKShare 返回 502

这通常表示上游行情源暂时不可用、网络连接中断、非交易时段数据源异常或请求频率过高。
稍后重新点击“刷新行情”即可。项目不会在后端伪造实时价格。
