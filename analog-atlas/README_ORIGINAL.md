# 硅海图谱 / Analog Atlas

一个无构建步骤的模拟电路设计空间浏览器。通过 HTTP 打开 `analog-atlas/index.html`；浏览器使用原生 ES modules。全部计算与设计快照保存在本地浏览器。字体加载失败会使用系统字体。

## 已实现

- 9 个解析模型：CMOS 环振、电流饥饿环振、交叉耦合 LC、恒流张弛、带隙、PTAT、CTAT、β 倍增参考和 Type-II 电荷泵 PLL。
- 拓扑搜索、类别筛选、最多 4 项对比、原创拓扑示意图、参数滑块、带单位输入、目标反算、81 点真实重算扫描、权衡与局部敏感性图。
- PLL：C₁∥(R+C₂) 无源滤波器合成、开环增益和相位、闭环相位传递、RK4 小信号相位阶跃与超调 / 2% 稳定时间。Kvco 输入为 MHz/V，内部转换为 Hz/V，正确抵消 PFD 与 VCO 的 2π。
- 自定义迁移率、电容、电阻和供电倍率。这些是用户情景，不是 foundry corners、统计分布或良率。
- 设计快照恢复 / JSON 导入导出、扫描 CSV、SPICE 下载、明暗主题、键盘图表读数和手机布局。
- 通过同源 localStorage `ethereal.workspace.handoff.v1` 将通用教学网表交给 `../circuit-lab/`，不向外部服务上传资料。

## 工艺与模型边界

**没有载入 TSMC PDK。** `tsmc180nmrf` 只是用户指定的未来接入目标。默认的供电、μnCox、阈值与温度系数是人为教学参数，不表示任何代工厂数据。

`examples/process-teaching.json` 是完整配置示例；`process.schema.json` 记录结构，`validateProcess()` 执行输入与网表映射检查。`mode: user-supplied` 只表示用户提供配置，不代表已验证授权或工艺正确性。

后续收到有权使用的 PDK 后：

1. 记录参数来源与适用条件。将本机模型库路径填入 `spice.libraryPath`，若采用 `.lib`，同时填写 `section`。
2. 填写 `devices.nmos/pmos.model`，选择原生 `M` 或四端子电路 `X`，显式确认 `pinOrder`。`M` 固定为 D/G/S/B；此适配层暂不支持五端或更多端子器件。
3. 检查电压、温度、尺寸范围、模型语法及参数名。导出的工艺连接模板只提供 CMOS 环振，不含已验证器件尺寸或启动设计；始终标为 **UNVALIDATED**。
4. 使用合适仿真器运行器件 / 工作点 / 瞬态，再校准解析参数。工艺角、失配、噪声、版图寄生与可靠性须按真实模型单独验证。

### 教学网表

`examples/*-teaching.cir` 与网页导出一致，全部使用通用行为 / 等效器件。环振不是 MOS 晶体管级模型；参考源仅复现温度函数；PLL 输出是相位而非真实 RF 电压。

- 饥饿环振导出使用 0.5VDD 接收阈值；网页允许其他有效行程用于解析敏感性研究，导出会提示此差别。
- 张弛导出采用零比较器延时与理想迟滞开关；网页解析式允许显式比较器延时与静态电流。
- LC 导出使用立方限幅负导纳，是等效差分谐振端口；不代表真实振幅、相位噪声或器件可靠性。
- β 倍增模型只计算非零解，未验证启动；所有参考源缺少失调、失配、PSRR 与负载调节。
- PLL 连续时间线性模型仅用于已锁定附近的小扰动，不用于声明捕获范围或非线性锁定时间。

## 验证

从仓库根目录运行：

```sh
node --test analog-atlas/tests/models.test.mjs analog-atlas/tests/chart-scale.test.mjs
node --test analog-atlas/tests/spice.test.mjs
```

第二组依赖相邻 `circuit-lab/js/engine.mjs` 与其 ngspice 46 WASM。它会重建 `examples/` 中的 9 个教学网表。

- 14 个解析测试覆盖 SI 量纲、预期数值、非法输入、参数缩放、温漂抵消、目标反算、PLL 交越增益 / 相位裕度及积分响应。
- 5 个绘图测试覆盖近常量显示、非负坐标下界、带符号灵敏度与刻度去重。
- 9 个 ngspice 测试检查有限输出和实际响应：四振荡器的稳定过阈频率；四参考源温度曲线与解析式；PLL 相位响应终值和超调与独立 RK4 积分。
- 振荡器频率相对容差预先设定为环振 15%、饥饿环振 10%、LC 与理想张弛 1%，反映行为模型与一阶解析近似差异。参考源容差为相对 1e-6；PLL 超调绝对差 <0.005。为满足数值精度，网表使用 reltol=1e-8。
- 已在真实 Chromium 页面检查所有 9 个模型、参数与图表；1440px 和 390px 布局截图在仓库根目录 `output/playwright/analog-atlas-*.png`。工程 / 数值验证不等于 PDK、版图或流片验证。

## 文件职责

`models.mjs` 纯数值核心；`catalog.mjs` 参数、说明、来源与原创示意图；`netlists.mjs` 行为网表 / 工艺模板；`app.mjs` 交互和本地状态；`style.css` 响应式视觉。

主要原始资料在每个拓扑的“原理与假设”内提供直接链接：TI SNAA106C、TI SNOA998A、Analog Devices 电压参考教程、Georgia Tech VCO 讲义及大学公开教程。界面参考 Analog Copilot 的浏览思想，未复制其设计资产、模型或数据。
