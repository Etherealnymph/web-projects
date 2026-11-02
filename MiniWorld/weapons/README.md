# 武器模型

内置武器定义在 `js/data.js` 的 `MW.WEAPONS`。这里放可直接导入模型工坊的示例：

- `ak47.weapon.json` — AK-47 突击步枪
- `awm.weapon.json` — AWM 狙击枪
- `rpg7.weapon.json` — RPG-7 火箭筒
- `missile.weapon.json` — FGM-148 标枪导弹（制导）

## 导入

游戏内按 `O` 打开模型工坊 → 导入武器 JSON。导入后可以立即装备到武器栏。

## 格式

```json
{
  "format": "miniworld-weapon",
  "id": "custom_laser",
  "name": "ZX-9 激光枪",
  "desc": "实验型定向能武器",
  "dmg": 58,
  "rpm": 170,
  "mag": 24,
  "spread": 0.0,
  "range": 150,
  "ammo": "light",
  "color": "#2b6f78",
  "view": [
    { "p": [0, 0, -0.3], "s": [0.1, 0.14, 0.6], "c": "#2d3f4a" },
    { "p": [0, 0.02, -0.76], "s": [0.02, 0.02, 0.28], "c": "#64f0ff", "glow": true }
  ],
  "muzzle": [0, 0.02, -0.92]
}
```

- 零件 `p`：相对握把的位置；枪口朝 `-Z`。
- `s`：长宽高（米）。
- `c`：颜色，支持 `#rrggbb` 或整数。
- `glow: true`：发光材质。
- `ammo`：`light` / `heavy` / `shell` / `rocket`。
- `muzzle`：枪口位置，用于生成曳光与枪口火光。
