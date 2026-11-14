"""FastAPI backend for the local stock practice pages.

Market data is fetched from AKShare's East Money A-share spot endpoint.  This
module deliberately does not provide fallback or fabricated quote values.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import akshare as ak
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


DEFAULT_CACHE_SECONDS = 30

# A small, stable catalogue used by the UI.  Values are names only; prices
# always come from AKShare.
STOCK_CATALOG: tuple[tuple[str, str], ...] = (
    ("600519", "贵州茅台"), ("601318", "中国平安"), ("600036", "招商银行"),
    ("601166", "兴业银行"), ("600900", "长江电力"), ("601012", "隆基绿能"),
    ("600276", "恒瑞医药"), ("600309", "万华化学"), ("601888", "中国中免"),
    ("600887", "伊利股份"), ("601398", "工商银行"), ("601288", "农业银行"),
    ("601939", "建设银行"), ("601988", "中国银行"), ("601857", "中国石油"),
    ("601088", "中国神华"), ("601668", "中国建筑"), ("601816", "京沪高铁"),
    ("600028", "中国石化"), ("600030", "中信证券"), ("600585", "海螺水泥"),
    ("601601", "中国太保"), ("600050", "中国联通"), ("600000", "浦发银行"),
    ("000001", "平安银行"), ("000333", "美的集团"), ("000651", "格力电器"),
    ("000858", "五粮液"), ("000568", "泸州老窖"), ("002594", "比亚迪"),
    ("300750", "宁德时代"), ("300059", "东方财富"), ("000002", "万科A"),
    ("002475", "立讯精密"), ("002415", "海康威视"), ("600690", "海尔智家"),
)

CATALOG_NAMES = dict(STOCK_CATALOG)


class Quote(BaseModel):
    symbol: str
    name: str
    code: str
    price: float | None = None
    change: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    turnover: float | None = None


app = FastAPI(title="A-share Quotes API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "null",  # file:// pages send the browser Origin as "null"
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache_lock = threading.Lock()
_spot_cache: tuple[float, dict[str, dict[str, Any]]] | None = None


def _normalise_code(value: str) -> str:
    """Accept 600519, SH600519, sh.600519, or 600519.SH."""
    cleaned = value.strip().upper().replace(".", "").replace("-", "")
    if cleaned.startswith(("SH", "SZ", "BJ")):
        cleaned = cleaned[2:]
    elif cleaned.endswith(("SH", "SZ", "BJ")):
        cleaned = cleaned[:-2]
    if len(cleaned) != 6 or not cleaned.isdigit():
        raise ValueError(f"无效股票代码: {value}")
    return cleaned


def _symbol_for(code: str) -> str:
    return ("sh." if code.startswith(("6", "68")) else "sz.") + code


def _number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        # AKShare may return "-" or NaN for suspended/unavailable fields.
        result = float(value)
        return result if result == result else None
    except (TypeError, ValueError):
        return None


def _fetch_spot() -> dict[str, dict[str, Any]]:
    """Fetch and map one complete AKShare spot snapshot."""
    global _spot_cache
    now = time.monotonic()
    with _cache_lock:
        if _spot_cache is not None and now - _spot_cache[0] < DEFAULT_CACHE_SECONDS:
            return _spot_cache[1]
        try:
            frame = ak.stock_zh_a_spot_em()
            records = frame.to_dict(orient="records")
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"AKShare 行情请求失败: {type(exc).__name__}: {exc}",
            ) from exc

        mapped: dict[str, dict[str, Any]] = {}
        for row in records:
            raw_code = row.get("代码")
            try:
                code = _normalise_code(str(raw_code))
            except ValueError:
                continue
            mapped[code] = {
                "symbol": _symbol_for(code),
                "name": str(row.get("名称") or CATALOG_NAMES.get(code, "")),
                "code": code,
                "price": _number(row.get("最新价")),
                "change": _number(row.get("涨跌幅")),
                "open": _number(row.get("今开")),
                "high": _number(row.get("最高")),
                "low": _number(row.get("最低")),
                "turnover": _number(row.get("换手率")),
            }
        if not mapped:
            raise HTTPException(status_code=502, detail="AKShare 返回了空的行情数据")
        _spot_cache = (now, mapped)
        return mapped


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "a-share-quotes"}


@app.get("/api/stocks", response_model=list[Quote])
def stocks() -> list[Quote]:
    """Return the supported catalogue; quote values are intentionally null."""
    return [
        Quote(symbol=_symbol_for(code), name=name, code=code)
        for code, name in STOCK_CATALOG
    ]


@app.get("/api/quotes", response_model=list[Quote])
def quotes(
    symbols: str = Query(..., description="Comma-separated codes, e.g. 600519,000001"),
) -> list[Quote]:
    requested: list[str] = []
    for item in symbols.split(","):
        try:
            code = _normalise_code(item)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if code not in requested:
            requested.append(code)
    if not requested:
        raise HTTPException(status_code=400, detail="symbols 不能为空")

    snapshot = _fetch_spot()
    missing = [code for code in requested if code not in snapshot]
    if missing:
        raise HTTPException(
            status_code=502,
            detail=f"AKShare 未返回请求的股票行情: {', '.join(missing)}",
        )
    return [Quote(**snapshot[code]) for code in requested]
