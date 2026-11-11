# 图片转写任务说明（数学竞赛题目 OCR）

你的任务：把一批手机拍摄的数学竞赛辅导课照片，逐张转写成结构化 JSON。

## 输入

- 任务文件：`/sdcard/Download/DSH-GO/Image/work/spec_NN.json`，字段：
  - `batch`：批次号
  - `date`：拍摄日期
  - `files`：图片绝对路径数组（按拍摄时间顺序）
  - `ids`：每张图对应的编号数组（与 files 一一对应）

## 做法

1. 用 `read` 工具读取 spec 文件。
2. 对 `files` 里**每一张**图片调用 `read_image`，一张都不能跳过（漏一张就是漏题）。
3. 照片是投影屏幕或试卷，可能有：
   - 文字旋转 90°（横拍）：先在脑中转正再读；
   - 反光、模糊、边缘裁切：能辨认多少写多少；
   - 一页多题、或只有解答没有题干。
4. 逐张整理出一条记录。

## 输出

用 `write` 工具写出生一个 JSON 文件：`/sdcard/Download/DSH-GO/Image/work/ocr/batch_NN.json`（NN 与 spec 相同），结构：

```json
{
  "batch": 1,
  "date": "2026-03-29",
  "pages": [
    {
      "id": 1,
      "has_problem": true,
      "problems": [
        {
          "label": "6",
          "statement": "设 $f(x)>0$，且 $f(x)\\in C[0,1]$，证明 $$\\lim_{n\\to\\infty}\\sqrt[n]{\\sum_{i=1}^{n}\\left[f\\left(\\frac{i}{n}\\right)\\right]^n\\frac{1}{n}}=\\max_{x\\in[0,1]}f(x)$$",
          "answer": "",
          "note": ""
        }
      ],
      "has_solution": false,
      "solution": "",
      "summary": "第6题：证积分平均的 $n$ 次根极限等于最大值",
      "clarity": "good"
    }
  ]
}
```

字段规则：

- `id`：数字，来自 spec 的 `ids`。
- `has_problem`：页面是否能看清**题干原文**。
- `problems`：本页可见的每道题；没有题干时给空数组 `[]`。
  - `label`：题号原样（`"6"`、`"例3"`、`"二(2)"`、`"未编号"`）。
  - `statement`：题干**全文照抄**，中文原样，所有数学式子写成 LaTeX：行内用 `$...$`，独立公式用 `$$...$$`。条件（设……、已知……）、结论（求……、证明……）都要完整，不省略、不改写、不美化。
  - `answer`：图中若有答案，照抄（LaTeX）；没有写 `""`。
  - `note`：与本题相关的额外信息（"注："、分值、试卷标题、页码、图中标注）；没有写 `""`。
- `has_solution`：本页是否有解答/推导过程。
- `solution`：有解答时，用 2~6 句记下思路与关键式子（LaTeX）；否则 `""`。
- `summary`：不超过 30 字的中文一句话概括本页。
- `clarity`：`good` / `partial` / `unreadable`。

## 硬性要求

1. **只转录，不解题、不补题**。图里没有的结论、条件、数字一律不要加。即使你看出题目有笔误，也照原文转写，在 `note` 里写"疑为……"。
2. 看不清的单个字符写 `[?]`，不要用猜测填空。
3. 一页有多题就逐题列出；只有板书/解答时 `problems` 为空，正文写进 `solution`。
4. `pages` 的顺序按 spec 的 `ids` 升序，条数必须与 `ids` 条数**完全相同**。
5. 写完 JSON 后用 `read` 读回检查：确认是合法 JSON、条数正确、（如明显坏了就修正重写）。
6. 最后回复一行：`batch NN: 页数 X / 题目数 Y`，不要复述题目内容。
