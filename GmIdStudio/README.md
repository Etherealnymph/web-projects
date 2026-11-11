# GM/ID Studio

基于 `C:\Users\21154\Desktop\rf018.scs`（TSMC 0.18 µm RF、BSIM3v3.24）的交互式 CMOS gm/Id 设计工作台。

**直接打开：** 双击 `dist\GM-ID-Studio.html`，或双击 `启动.bat`。无需安装 Python、Node 或任何服务；页面为单文件离线版。

---

## 功能

- **VGS → GM/ID**：固定 VDS 扫描栅压，左轴 gm/Id，右轴 ID，按截止 / 亚阈值 / 线性 / 饱和着色。
- **GM/ID → GM·RO**：固定 L、W、VDS，观察本征增益与反型程度的关系；点颜色表示工作区。
- **L 扫描**：同一 W / VDS 下绘制多条 L 曲线，查看本征增益随沟道长度的变化。
- **GM/ID → ID/W**：对数纵轴的电流密度设计图，可直接读取单位宽度电流。
- **曲线库**：ID–VGS、gm–VGS、gds–VGS、fT–GM/ID、ID–VDS 输出族、GM/ID–VOV 六组辅助曲线。
- **自定义**：任选 X / Y 指标、L 或 VDS 曲线族，并支持 Y 表达式（如 `gm/Id*1e3`、`gm*ro`）。
- **工作点探针**：点击曲线锁定工作点，显示横纵坐标、VTH、VOV、VDSAT、ID、gm、gds、ID/W、SS、fT；十字线与区域图同步。
- **模型卡检查器**：查看当前 L/W 自动匹配的 BSIM3 BIN、全部 16 个 BIN、原始模型来源与 SHA-256。
- **导出**：PNG、CSV、Spectre DC 测试台、工作点 JSON。

## 模型与仿真方法

页面内嵌原始 `rf018.scs` 的 gzip 数据（SHA-256 `b4092aa94e82163d65264158b9baaef3f16a7363d6f0701ebd4e674a728ded3`），启动时由浏览器解压并解析：

- Spectre `section` / `endsection`
- `parameters` 表达式（逐个求值，支持 `sqrt`、`exp` 等）
- `include "rf018.scs" section=mos` 对应的 binned model card
- `model nch/pch/nch3/pch3 bsim3v3 { 1: ... }`

提取的关键参数包括 `VTH0`、`K1`、`K2`、`TOX`、`U0`、`VSAT`、`RDSW`、`PCLM`、`PDIBLC2`、`CGDO/CGSO`、`DLC`、`WINT` 等，然后用 EKV 型前向电荷 + α-power 饱和 + 串联电阻 + DIBL/CLM 的快速模型计算 ID，gm / gds 由中心差分得到。

> 这是设计空间探索工具，不等同于完整 BSIM3 直流求解。温度、版图寄生、噪声、栅漏电流与高阶短沟道效应未包含。最终签核请用「导出 → Spectre 测试台」在同源 `rf018.scs` 上复核。
>
> 单文件版内嵌了 PDK 模型参数；如需对外分发，请先确认 PDK 授权。

## 操作提示

- 左侧选择工艺角、NMOS/PMOS、1.8 V/3.3 V，设置 L、W、VGS、VDS、VSB。
- 点击任意曲线点锁定工作点；点击「解除锁定」回到实时偏置。
- 滚轮缩放，双击复位；工具栏可切换 LOG X / LOG Y / 网格。
- 右上角「模型卡」可重新载入 / 校验 `.scs` 文件。
- PMOS 使用 `|VGS|`、`|VDS|`、`VSB` 正值坐标；内部按 PMOS 模型卡计算。
- 3.3 V 域使用 `nch3` / `pch3` 模型卡，L 最小 0.35 µm。

## 文件结构

```text
GmIdStudio/
├─ dist/
│  └─ GM-ID-Studio.html      # 单文件离线版（推荐直接用）
├─ src/
│  ├─ index.html             # 开发入口
│  ├─ styles.css
│  ├─ app.js
│  ├─ engine.js              # 参数化 gm/Id 引擎
│  ├─ model-parser.js        # Spectre / BSIM3 binned model 解析器
│  └─ model-b64.js           # 内嵌 rf018.scs（gzip + base64）
├─ vendor/
│  └─ plotly.min.js
├─ tools/
│  ├─ build_single.py        # 重新生成 dist 单文件
│  ├─ extract_model.py       # Python 侧模型参数提取 / 校验
│  └─ test_*.js              # 解析器与引擎自测
└─ 启动.bat
```

## 重新构建单文件

```powershell
python tools\build_single.py
```

会生成 `dist\GM-ID-Studio.html`。开发时可直接用 Chrome/Edge 打开 `src\index.html`（需要保留 `vendor`、`src` 目录结构）。

## 浏览器要求

Chrome / Edge 80+（需要 `DecompressionStream`、Canvas、SVG）。页面不依赖网络。
