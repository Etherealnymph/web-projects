# 自定义 SPICE 元件

将一个 JSON 对象粘入元件库的自定义元件输入框。下面的分压器使用 SPICE 子电路，可直接用于 OP、DC、TRAN 和 AC 分析。

```json
{
  "id": "divider10k",
  "label": "双 10 kΩ 分压器",
  "prefix": "X",
  "pins": ["IN", "OUT", "REF"],
  "value": "DIV10K",
  "definition": ".subckt DIV10K IN OUT REF\nR1 IN OUT 10k\nR2 OUT REF 10k\n.ends DIV10K"
}
```

放置时填写位号 `X1` 和节点 `vin mid 0`。生成的实例行为 `X1 vin mid 0 DIV10K`。子电路的端口顺序与 `pins` 一致，同一份定义在文件内只需要一份。已有 PDK 提供模型时可省略 `definition`，用 `.include` 或 `.lib` 关联相应模型文件与工艺角。

| 字段 | 内容 |
|---|---|
| id | 以英文字母开头，可包含英文字母、数字、下划线、短横线，最多 64 字符 |
| label | 在元件库中显示的名称 |
| prefix | SPICE 实例前缀，如 R、C、V、M、Q、X |
| pins | 按 SPICE 定义顺序列出的唯一引脚名称 |
| value | 位于节点列表之后的一行 SPICE 文本，可包含模型名与实例参数 |
| definition | 可选的 SPICE 模型卡或子电路定义，多行以 JSON 的换行转义表示 |

模拟器根据源文件里的网表与模型求解。内置通用模型适合电路教学和功能检查。制造工艺分析请导入目标工艺库与模型角。当前绘图支持最常用的 SPICE 器件、结构化 Spectre 实例、Verilog 模块与 VHDL 实体，在诊断中注明未展开的行为过程或连接表达式。图层表示电路定义，重复调用的定义共享一个图层。

原生导出保存当前入口的完整源码。每层 PNG 使用独立文件名打入 ZIP。PDF 将各层绘制为独立矢量页。KiCad 导出当前层的原理图或该层的 XML 中间网表；子电路实例保留其引脚边界。电气引脚序号源于源网表，制作 PCB 时需按所选封装核对引脚映射。

PDF 会按图中文字装入思源黑体 CN 字形子集，包含工作台常用文字、拉丁字符、常见希腊字母、电气符号及 GB 2312 简体中文。范围外的字符由 PDF 阅读器的 CJK 回退字体显示。
