# Skills

这些技能文档同时会作为大模型系统提示词（`skills/world-build.md` 在游戏启动时载入）。

- [world-build.md](world-build.md) — 把自然语言需求翻译成方块建造指令（fill / ring / tree / lamp / clear）。
- [weapon-switch.md](weapon-switch.md) — 武器栏、口径、换弹与载具武器的数据规则。
- [model-craft.md](model-craft.md) — 武器与人物模型的 JSON 结构、导入导出与 AI 生成约束。

## 本地结构图谱

不配置 API Key 时，`js/architect.js` 会使用内置模板即时生成建筑：

宝塔 · 宫殿 · 城堡 · 石拱桥 · 金字塔 · 小屋 · 喷泉 · 体育场 · 现代楼 · 摩天楼 · 城墙 · 公园 · 雕像 · 战舰 · 园林

## 提示词建议

- 说明风格：“中式 / 现代 / 赛博 / 木屋”。
- 说明位置：“在我前面的广场中央” —— 系统会自动把地基放在玩家前方 20 格。
- 说明用途：“带门、窗、屋顶，可以走进去”。
- 不要要求超过 3500 个方块，否则模型输出会被截断。
