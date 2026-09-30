# A 股行情 FastAPI 后端

## 安装与启动

在 `backend` 目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

接口：

- `GET /api/health`：健康检查。
- `GET /api/stocks`：返回内置的 36 只常见 A 股代码和名称。
- `GET /api/quotes?symbols=600519,000001`：返回实时行情。

每条行情统一包含 `symbol`、`name`、`code`、`price`、`change`、`open`、
`high`、`low`、`turnover` 字段。代码支持 `600519`、`sh.600519` 等形式。

## 数据来源与限制

行情正式来源是 [AKShare](https://akshare.akfamily.xyz/) 的
`stock_zh_a_spot_em` 接口（底层为东方财富公开行情数据）。服务只在内存中
缓存完整快照，默认缓存 30 秒；缓存过期后才会再次请求 AKShare。首次请求、
接口超时或数据源不可用时，服务返回 HTTP 502 和明确错误，不会伪造价格。

AKShare/上游数据可能受交易时间、网络、访问频率、停牌状态和数据源变化影响；
本服务不构成投资建议。`/api/stocks` 是静态代码目录，价格字段为 `null`，
需要实时值请调用 `/api/quotes`。
