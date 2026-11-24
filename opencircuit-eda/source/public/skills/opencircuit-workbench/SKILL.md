---
name: opencircuit-workbench
description: 在已打开的 OpenCircuit EDA 3 工作台中，使用页面内 API 调试电路，加载工程、定位实例及 PDK 模型、运行 ngspice、读取波形并导出图层或工程。
---

# 调试 OpenCircuit 工作台

通过已获授权的浏览器自动化工具，在工作台标签页中执行下列 JavaScript。接口位于页面主上下文。首次进入页面时等待 window.OpenCircuitEDA 存在，或监听 opencircuit:ready 事件。

先读取 state()。project.entry 是网表入口，project.active 是编辑器当前文件，layer 是当前图层 ID。需要保留原工程时，用 createProject({title,entry,files:[{path,content}],config}) 创建独立副本。相对路径须保留目录结构，便于解析 .include 和 .lib。

## 观察与定位

- readFile(path) 读源码。inspectLayer(id) 返回元件与连接。组件的 source 是实例文件和行号，definition 是解析到的模型或子电路出处，targetLayerId 指向可进入的定义层。图层和元件 ID 使用接口返回的原值。
- selectLayer(id)、selectComponent(id)、openFile(path,line) 可将页面定位到证据。查看 state().diagnostics 判断结构解析覆盖。HDL 文件支持结构图。
- writeFile(path,content) 写入当前工程。setEntry(path) 切换解析和仿真入口。components() 列出元件模板；registerComponent(def) 和 place(id,{name,nodes,value}) 将定义和器件写入工程。save() 返回本机存储操作的 Promise。

modelControls() 返回入口数值变量和库文件实际声明的工艺角。将选中记录的 kind、name、line 与新 value 传给 setModelControl({kind,name,line,value}) 会改写对应源行。重新运行即可比较参数或工艺角改变后的电压和电流。

## 数值调试

下面的示例会创建一个独立分压器实验工程并执行真实工作点求解。

~~~js
(async () => {
const eda = window.OpenCircuitEDA;
const result = await eda.runExperiment('divider');
const output = result.traces.find(t => t.name.toLowerCase() === 'v(out)');
const current = result.traces.find(t => t.name.toLowerCase() === 'i(vsense)');
return {volts: output.values[0], amps: current.values[0], engine: result.engine};
})()
~~~

预期电压约 3.333333 V，电流约 +0.001666667 A。已有工程调用 await eda.run(config) 或 await eda.run()。支持配置如下。

| type | 参数 |
| --- | --- |
| op | 无额外参数 |
| dc | source，start，end，step |
| ac | scale 取 dec、oct 或 lin，points，start，end |
| tran | step，stop，可选 begin、maxStep、uic |

结果含 analysis、points、x、traces、dependencies 和 logs。x.values 是横轴，traces[].values 是实数采样，交流结果还含 imag。幅值取 Math.hypot(re,im)，相位取 Math.atan2(im,re)。零伏串联电压源的正端到负端定义电流正方向。模型缺失和不支持的语法会抛出异常，可从原始文件和求解日志定位。编辑后重新运行。cancel() 停止当前任务。

showInstrument(tab) 打开 scope、spectrum、meters、generator 或 experiments。experiments() 列出内置实验和预期结果。result() 读取最近一次有效结果，默认不返回过期数据。

## 导出

await eda.exportArtifact(format) 返回 {name,blob}，由调用者决定是否写入文件。在浏览器与宿主边界传输时，可用 blob.text() 读取文本或用 blob.arrayBuffer() 读取二进制。project 导出工程 JSON，native 导出入口原文，spice 导出展开工艺库并保留当前分析卡的 SPICE 网表，bom 导出本层物料表，svg、png 导出当前层，all-png 导出逐层 PNG 的 ZIP，pdf 导出逐层矢量 PDF，kicad 和 kicad-xml 导出当前层的 KiCad 原理图和网表，csv 导出仿真数据。交付前核对文件名、Blob 大小与预期页数或图层数。
