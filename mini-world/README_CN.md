<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open-2f6feb?style=flat-square)](https://etherealnymph.github.io/web-projects/mini-world/) [![Portal](https://img.shields.io/badge/Portal-All_Projects-6e7781?style=flat-square)](https://etherealnymph.github.io/web-projects/index.html#projects) ![Stack](https://img.shields.io/badge/Stack-Three.js%20%7C%20WebGL-000000?style=flat-square)

# 迷你世界 · 像素宇宙

**浏览器 3D 方块沙盒：探索十个世界，以 25 厘米精度建造，还能战斗、驾驶与飞行。**

[![English](https://img.shields.io/badge/English-README__EN-2f6feb?style=flat-square)](README_EN.md) [![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README__CN-d1492f?style=flat-square)](README_CN.md) [![README](https://img.shields.io/badge/README-index-6e7781?style=flat-square)](README.md)

[English](README_EN.md) · **简体中文** · [README 索引](README.md) · [全部项目](../README.md)

<a href="docs/screenshot.png"><img src="docs/screenshot.png" alt="迷你世界 · 像素宇宙 截图" width="880"></a>

</div>

## 项目简介

迷你世界是一个无需构建的 Three.js 沙盒。你可以走过北京、Washington、Tokyo、紫禁城等场景，用 0.25–1 米的小构件建造，再开出载具、环线列车、无人机与航母——全部在一个静态页面里。

## 功能

- 探索 / 建造 / 战斗，可走进多层建筑，含 20 厘米踏步楼梯与逐层呼叫电梯。
- 十个世界：北京、Washington、Tokyo、紫禁城、唐长安不夜城、电子科大校园，以及全球大陆远征。
- 0.25 / 0.5 / 1 米精细建造，含路灯、长椅、花园、市集与海港鱼市等微型构件。
- 载具、环线列车、无人机编队、防空拦截与航母甲板起飞。
- AI 对话建造、世界便签与留言板、天气与季节、士兵小队与海战。
- 世界 / 武器 / 人物模型可导入导出；仅依赖本地 Three.js r150，无构建步骤。

## 网页入口

| 入口 | 链接 |
| --- | --- |
| 项目总入口 | [etherealnymph.github.io/web-projects/index.html#projects](https://etherealnymph.github.io/web-projects/index.html#projects) |
| 直接页面 | [https://etherealnymph.github.io/web-projects/mini-world/](https://etherealnymph.github.io/web-projects/mini-world/) |
| 本地 | 运行 `python serve.py`，或在根目录起服务后打开 `http://127.0.0.1:8123/mini-world/`（模型与 AI 功能需要 HTTP 环境）。 |

## 项目结构

```text
mini-world/
├─ index.html
├─ css/ / js/                 # engine, world, player, combat, UI
├─ assets/                    # textures, menu art, screenshots source
├─ characters/ / weapons/     # model definitions
├─ worlds/                    # ten world definitions
├─ prompt/ / skills/          # AI builder prompts and rules
├─ tests/                     # node:test + model gallery
├─ vendor/three.min.js
├─ serve.py                   # tiny local server
├─ DATA_SOURCES.md
└─ docs/screenshot.png
```

原详细说明：[README_ORIGINAL.md](README_ORIGINAL.md)。

## 边界与说明

- 世界与地标是艺术化生成，不是真实世界的逐米复刻。WebGL 帧率取决于设备。

## 其他项目

| 项目 | README | 网页 |
| --- | --- | --- |
| **Analog Atlas** / 硅海图谱 | [README](../analog-atlas/README.md) | [打开](https://etherealnymph.github.io/web-projects/analog-atlas/) |
| **Bilingual Dictionary** / 中英双语词典 | [README](../bilingual-dictionary/README.md) | [打开](https://etherealnymph.github.io/web-projects/bilingual-dictionary/) |
| **Blog Platform** / 博客平台 | [README](../blog-platform/README.md) | — *(需服务端)* |
| **Circuit Lab** / 观澜电路 | [README](../circuit-lab/README.md) | [打开](https://etherealnymph.github.io/web-projects/circuit-lab/) |
| **Field Drift** / 场海 | [README](../field-drift/README.md) | [打开](https://etherealnymph.github.io/web-projects/field-drift/) |
| **Fourier Contour** / 圆上之圆 | [README](../fourier-contour/README.md) | [打开](https://etherealnymph.github.io/web-projects/fourier-contour/) |
| **GM/ID Studio** / GM/ID 设计工作台 | [README](../gm-id-studio/README.md) | [打开](https://etherealnymph.github.io/web-projects/gm-id-studio/dist/GM-ID-Studio.html) |
| **Insight Space** / 体悟集 | [README](../insight-space/README.md) | [打开](https://etherealnymph.github.io/web-projects/insight-space/) |
| **Life Guide** / 高性价比人生指南 | [README](../life-guide/README.md) | [打开](https://etherealnymph.github.io/web-projects/life-guide/) |
| **Logic Loom** / 逻辑织机 | [README](../logic-loom/README.md) | [打开](https://etherealnymph.github.io/web-projects/logic-loom/) |
| **Math Competition** / 大学生数学竞赛 | [README](../math-competition/README.md) | [打开](https://etherealnymph.github.io/web-projects/math-competition/web/) |
| **Number Sense Trainer** / 数感训练场 | [README](../number-sense-trainer.src/README.md) | [打开](https://etherealnymph.github.io/web-projects/number-sense-trainer.html) |
| **Semiconductor Devices** / 半导体物理与器件 | [README](../semiconductor-devices/README.md) | [打开](https://etherealnymph.github.io/web-projects/semiconductor-devices/) |
| **Silicon Notes** / 硅间札记 | [README](../silicon-notes/README.md) | [打开](https://etherealnymph.github.io/web-projects/silicon-notes/) |
| **Tidal Soundscape** / 潮汐声景 | [README](../soundscape/README.md) | [打开](https://etherealnymph.github.io/web-projects/soundscape/) |
| **SPICE RF Calculator** / TSMC RF 器件计算器 | [README](../spice-rf-calculator/README.md) | [打开](https://etherealnymph.github.io/web-projects/spice-rf-calculator/spice-rf-calculator.html) |
| **Stock Trading Simulator** / 股市训练场 | [README](../stock-trading-simulator/README.md) | [打开](https://etherealnymph.github.io/web-projects/stock-trading-simulator/stock-trading-simulator.html) |
| **Stock Quote API** / A 股行情后端 | [README](../stock-quote-api/README.md) | — *(需服务端)* |


更多单页实验、游戏与工具见[仓库根 README](../README.md)。

## 作者

**Etherealnymph** — [2115487769@qq.com](mailto:2115487769@qq.com)

更多项目：[web-projects](https://github.com/Etherealnymph/web-projects) · [项目总入口](https://etherealnymph.github.io/web-projects/index.html#projects)
