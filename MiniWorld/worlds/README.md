# 世界文件

## 案例世界

五个案例世界由 `js/worldgen.js` 程序化生成，不在这里存放大文件：

- 紫禁城 `forbidden`
- 唐长安 · 不夜城 `changan`
- 电子科大 · 清水河 `uestc`
- 珠海一中 `zh1z`
- 台湾 · 海峡战线 `taiwan`

## 示例文件

- `sample-island.miniworld.json`：8700 个方块的像素小岛，含小屋、树、码头与据点。可在主菜单点击「示例世界」加载。

## 格式

```json
{
  "format": "miniworld-world",
  "version": 1,
  "name": "世界名",
  "meta": {
    "bounds": 80,
    "spawn": [0, 5, 10],
    "waterLevel": 4,
    "sky": "day",
    "weather": "clear",
    "season": "summer",
    "objective": "目标文本",
    "killTarget": 12,
    "zones": [{ "name": "据点", "x": 0, "z": 0, "r": 10, "enemy": true }],
    "vehicles": [{ "type": "tank", "x": 5, "z": 5, "name": "坦克" }],
    "enemyShips": [{ "x": 30, "z": 30 }],
    "pickups": [{ "item": "rifle", "x": 2, "z": 2 }]
  },
  "blocks": [[x, y, z, color, type], "..."],
  "notes": []
}
```

- `color`：24 位整数（例如 `0xd8a531` = 14198065）。
- `type`：`0` 实心、`1` 发光、`2` 装饰（可穿过）、`3` 水、`4` 树叶（实心，季节切换时自动换色）。
- 坐标原点为世界中心，方块占据 `[x, x+1]`；玩家脚底站在方块顶部 `y+1`。
- `waterLevel` 为水面高度；有海的世界会自动创建动态水面。

## 导入 / 导出

- 游戏内：`Esc` → 设置 → 导出当前世界 / 导入世界文件。
- 导出文件会包含全部方块、元数据与当前世界的便签。
- 导入后在浏览器中重建，并作为 `custom` 世界继续游玩；导出的文件可以再次导入。
