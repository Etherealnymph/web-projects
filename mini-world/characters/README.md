# 人物模型

人物由方块组件构成，可通过调色 JSON 自定义，并在第三人称模式生效。

- `traveler.character.json` — 默认旅行者
- `soldier.character.json` — 联合士兵外观

## 格式

```json
{
  "format": "miniworld-character",
  "version": 1,
  "name": "霓虹旅人",
  "skin": "#e0b48a",
  "shirt": "#1d3f4a",
  "pants": "#14232b",
  "hair": "#0f2b33",
  "accent": "#5eead4",
  "helmet": "#50603c"
}
```

- `skin` 皮肤、`shirt` 上衣、`pants` 裤子、`hair` 头发、`accent` 围巾/细节。
- `helmet` 可选；不填则不戴头盔。
- 颜色支持 `#rrggbb`。

## 使用

按 `O` → 人物建模 → 导入人物 JSON → 应用此皮肤。皮肤会保存到浏览器，下次进入游戏仍然生效。
