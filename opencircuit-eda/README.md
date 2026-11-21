# OpenCircuit EDA v2.1.0

浏览器内直接运行的开源 Spice 风格 EDA 工作台，已作为静态站点部署在本仓库中：

- 在线访问：<https://etherealnymph.github.io/web-projects/opencircuit-eda/>
- 站点入口：首页「精选入口」、`projects.html`（本地项目）、`eda.html`（电子设计）

## 功能

- 原理图绘制：正交自动布线、移动岛、旋转 / 镜像 / 对齐、复制粘贴、自定义快捷键
- 网表解析：Spectre / SPICE / Verilog / VHDL 与 `.scs`、`.cir`、`.sp` 工程文件
- 仿真引擎：MNA 直流工作点、瞬态（Tran）、直流扫描（DC）、交流频响（AC）
- 观测工具：示波器、频谱仪、DC 工作点报表、终端
- 工艺与层次：PDK 工艺库管理、子电路固化、Corner / 蒙特卡洛分析
- AI 电路助手：配置 OpenAI / DeepSeek 兼容接口后可直接对话生成与排查电路

## 部署说明

本目录中的 `index.html` 与 `assets/` 是 `vite build` 产物，已使用相对路径（`base: './'`），
不依赖服务器根路径，因此可以直接放在 GitHub Pages 的任意子目录下访问。

更新应用时：

```bash
cd opencircuit-eda/source
npm install
npm run build
# 将 dist/index.html 与 dist/assets/ 覆盖到上级目录
cp -r dist/index.html dist/assets ..
```

## 源码

`source/` 保留了可重新构建的源码（`src/`、`tests/`、Electron 桌面端入口等）：

```bash
cd opencircuit-eda/source
npm install
npm test        # vitest
npm run build   # 生成 dist/
```

桌面端打包（需在本地安装 Electron Builder 依赖）：

```bash
npm run electron:win    # Windows portable + nsis
npm run electron:mac    # macOS dmg + zip
npm run electron:linux  # Linux AppImage + deb
```

## 说明

- 所有数据默认保存在浏览器 `localStorage`；打开文件夹、保存工程等能力使用
  File System Access API，需要 Chrome / Edge 等支持该 API 的浏览器。
- AI 接口 Key 仅保存在本机浏览器中，不会上传到本仓库。
