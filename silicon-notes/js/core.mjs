import { renderMath, mathError, escapedAt, closingDelimiter, MATH_LIMITS } from './math.mjs';

export const FORMAT = 'silicon-notes';
export const VERSION = 1;
export const HANDOFF_KEY = 'ethereal.workspace.handoff.v1';
export const TYPES = {
  note: '学习札记',
  experiment: '实验记录',
  paper: '论文摘记',
  failure: '失效复盘',
  idea: '研究想法',
};
export const EVIDENCE = {
  idea: '待验证想法',
  derived: '解析推导',
  simulation: '仿真结果',
  measurement: '实测观察',
  literature: '文献报告',
};
export const COURSES = [
  '模拟集成电路',
  '器件与工艺',
  '信号与系统',
  '数字与混合信号',
  '测量与复现',
  '研究方法',
];
export const LIMITS = { records: 400, body: 80000, backup: 12 * 1024 * 1024, attachment: 750000 };

function fail(message) {
  throw new Error(message);
}
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}必须是对象`);
  return value;
}
function text(value, max, label, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.length > max) fail(`${label}需为不超过 ${max} 字符的文本`);
  return value;
}
function array(value, max, label) {
  if (!Array.isArray(value) || value.length > max) fail(`${label}数量超出限制`);
  return value;
}
function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) fail('记录 ID 无效');
  return value;
}
function timestamp(value, label) {
  if (typeof value !== 'string' || value.length > 32) fail(`${label}时间无效`);
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match || !Number.isFinite(Date.parse(value))) fail(`${label}时间必须为 ISO 日期`);
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59)
    fail(`${label}时间无效`);
  return new Date(value).toISOString();
}

export function uid(prefix = 'note') {
  const random =
    globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
export function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0020\u007f]/.test(value)) return '';
  if (/^#note=[a-zA-Z0-9_%.-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
export function normalizeNote(input) {
  const note = object(input, '笔记');
  const title = text(note.title, 160, '标题').trim();
  if (!title) fail('请填写标题');
  if (!Object.hasOwn(TYPES, note.type)) fail('笔记类型无效');
  if (!Object.hasOwn(EVIDENCE, note.evidence)) fail('证据类型无效');
  const sources = array(note.sources || [], 24, '来源').map((source) => {
    object(source, '来源');
    const url = text(source.url, 2000, '来源链接');
    if (url && !safeUrl(url)) fail('来源链接只接受 http/https 或本站笔记链接');
    return {
      id: identifier(source.id),
      label: text(source.label, 240, '来源名称'),
      url,
      scope: text(source.scope, 500, '阅读范围', true),
    };
  });
  if (new Set(sources.map((source) => source.id)).size !== sources.length) fail('来源 ID 重复');
  const observations = array(note.observations || [], 24, '结果').map((result) => {
    object(result, '结果');
    if (!Object.hasOwn(EVIDENCE, result.kind)) fail('结果证据类型无效');
    if (result.sourceId && !sources.some((source) => source.id === result.sourceId))
      fail('结果关联了不存在的来源');
    return {
      id: identifier(result.id),
      statement: text(result.statement, 4000, '结果内容'),
      kind: result.kind,
      sourceId: text(result.sourceId, 80, '来源 ID', true),
      conditions: text(result.conditions, 1000, '适用条件', true),
    };
  });
  if (new Set(observations.map((result) => result.id)).size !== observations.length) fail('结果 ID 重复');
  const attachments = array(note.attachments || [], 3, '图片附件').map((file) => {
    object(file, '附件');
    const data = text(file.data, LIMITS.attachment, '附件编码');
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))
      fail('附件仅支持 PNG、JPEG、WebP 图像');
    return {
      name: text(file.name, 160, '附件名称'),
      data,
      caption: text(file.caption, 500, '图片说明', true),
    };
  });
  return {
    id: identifier(note.id),
    title,
    type: note.type,
    evidence: note.evidence,
    course: text(note.course, 80, '课程'),
    summary: text(note.summary, 400, '摘要', true),
    body: text(note.body, LIMITS.body, '正文'),
    tags: [
      ...new Set(
        array(note.tags || [], 16, '标签')
          .map((tag) => text(tag, 40, '标签').trim())
          .filter(Boolean),
      ),
    ],
    question: text(note.question, 1500, '问题', true),
    claim: text(note.claim, 2000, '主张', true),
    limitation: text(note.limitation, 3000, '限制', true),
    nextStep: text(note.nextStep, 2000, '下一步', true),
    sources,
    observations,
    attachments,
    recall: {
      question: text(note.recall?.question, 1500, '复习问题', true),
      answer: text(note.recall?.answer, 4000, '复习答案', true),
    },
    parents: array(note.parents || [], 8, '关联笔记').map(identifier),
    example: note.example === true,
    createdAt: timestamp(note.createdAt, '创建'),
    updatedAt: timestamp(note.updatedAt, '修改'),
  };
}
export function normalizeCard(input) {
  object(input, '复习卡');
  if (!Number.isInteger(input.stage) || input.stage < 0 || input.stage > 8) fail('复习阶段无效');
  if (!Number.isInteger(input.reviews) || input.reviews < 0 || input.reviews > 100000) fail('复习次数无效');
  return {
    id: identifier(input.id),
    stage: input.stage,
    reviews: input.reviews,
    due: timestamp(input.due, '复习'),
    lastGrade: ['again', 'hard', 'good', 'easy', 'new'].includes(input.lastGrade) ? input.lastGrade : 'new',
  };
}
export function normalizeReflection(input) {
  object(input, '留白');
  return {
    id: identifier(input.id),
    body: text(input.body, 3000, '留白内容'),
    createdAt: timestamp(input.createdAt, '留白'),
  };
}
export function parseBundle(raw) {
  const value =
    typeof raw === 'string'
      ? raw.length > LIMITS.backup
        ? fail('备份超过 12 MB 限制')
        : JSON.parse(raw)
      : raw;
  object(value, '备份');
  if (value.format !== FORMAT || value.version !== VERSION) fail('不是支持的 Silicon Notes v1 文件');
  const result = { format: FORMAT, version: VERSION };
  for (const [key, validator] of [
    ['notes', normalizeNote],
    ['drafts', normalizeNote],
    ['cards', normalizeCard],
    ['reflections', normalizeReflection],
  ]) {
    result[key] = array(value[key] || [], LIMITS.records, key).map(validator);
    if (new Set(result[key].map((item) => item.id)).size !== result[key].length)
      fail(`${key} 中有重复 ID，未导入任何记录`);
  }
  return result;
}
export function bundle(data = {}) {
  return parseBundle({
    format: FORMAT,
    version: VERSION,
    notes: data.notes || [],
    drafts: data.drafts || [],
    cards: data.cards || [],
    reflections: data.reflections || [],
  });
}
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}
function inlineMarkdown(raw, budget) {
  const output = [];
  let cursor = 0;
  let plainStart = 0;
  const emit = (end, rendered) => {
    output.push(escapeHtml(raw.slice(plainStart, cursor)), rendered);
    cursor = end;
    plainStart = end;
  };
  while (cursor < raw.length) {
    // Code spans take priority over math and remain escaped literal text.
    if (raw[cursor] === '`') {
      const marker = raw.slice(cursor).match(/^`+/)[0];
      const end = raw.indexOf(marker, cursor + marker.length);
      if (end !== -1) {
        emit(end + marker.length, `<code>${escapeHtml(raw.slice(cursor + marker.length, end))}</code>`);
        continue;
      }
    }
    if (!escapedAt(raw, cursor)) {
      let opener = '';
      let closer = '';
      let display = false;
      if (raw.startsWith('$$', cursor)) {
        opener = closer = '$$';
        display = true;
      } else if (raw.startsWith('\\[', cursor)) {
        opener = '\\[';
        closer = '\\]';
        display = true;
      } else if (raw.startsWith('\\(', cursor)) {
        opener = '\\(';
        closer = '\\)';
      } else if (raw[cursor] === '$') opener = closer = '$';
      if (opener) {
        const end = closingDelimiter(raw, closer, cursor + opener.length);
        if (end !== -1) {
          emit(end + closer.length, renderMath(raw.slice(cursor + opener.length, end), display, budget));
          continue;
        }
      }
    }
    if (raw[cursor] === '[' || raw.startsWith('**', cursor)) {
      const match = raw
        .slice(cursor)
        .match(/^(\[\[[^\]\n]{1,160}\]\]|\[[^\]\n]{1,240}\]\([^\s)]+\)|\*\*[^*\n]+\*\*)/);
      if (match) {
        const token = match[0];
        let rendered;
        if (token.startsWith('[[')) {
          const target = token.slice(2, -2);
          rendered = `<a href="#wiki=${encodeURIComponent(target)}" class="wiki-link">${escapeHtml(target)}</a>`;
        } else if (token.startsWith('**'))
          rendered = `<strong>${inlineMarkdown(token.slice(2, -2), budget)}</strong>`;
        else {
          const separator = token.indexOf('](');
          const label = token.slice(1, separator);
          const url = safeUrl(token.slice(separator + 2, -1));
          rendered = url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
            : escapeHtml(token);
        }
        emit(cursor + token.length, rendered);
        continue;
      }
    }
    cursor++;
  }
  output.push(escapeHtml(raw.slice(plainStart)));
  return output.join('');
}
export function markdown(raw) {
  const source = String(raw).slice(0, LIMITS.body).replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const output = [];
  const budget = { remaining: MATH_LIMITS.expressions };
  let code = null;
  let list = false;
  const closeList = () => {
    if (list) output.push('</ul>');
    list = false;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (code !== null) {
      if (fence && fence[1][0] === code.marker && fence[1].length >= code.length && !fence[2].trim()) {
        output.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
        code = null;
      } else code.lines.push(line);
      continue;
    }
    if (fence) {
      closeList();
      code = { marker: fence[1][0], length: fence[1].length, lines: [] };
      continue;
    }
    const trimmed = line.trimStart();
    const block = trimmed.startsWith('$$') ? ['$$', '$$'] : trimmed.startsWith('\\[') ? ['\\[', '\\['] : null;
    if (block) {
      closeList();
      const marker = block[1];
      const closer = marker === '$$' ? '$$' : '\\]';
      let formula = line.trimStart().slice(marker.length);
      let end = closingDelimiter(formula, closer, 0);
      while (end === -1 && lineIndex + 1 < lines.length) {
        formula += '\n' + lines[++lineIndex];
        end = closingDelimiter(formula, closer, 0);
      }
      if (end === -1) output.push(mathError(formula, `缺少结束标记 ${closer}`, true));
      else {
        output.push(renderMath(formula.slice(0, end), true, budget));
        const trailing = formula.slice(end + closer.length).trim();
        if (trailing) output.push(`<p>${inlineMarkdown(trailing, budget)}</p>`);
      }
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      output.push(
        `<h${heading[1].length + 1}>${inlineMarkdown(heading[2], budget)}</h${heading[1].length + 1}>`,
      );
    } else if (/^[-*]\s/.test(line)) {
      if (!list) {
        output.push('<ul>');
        list = true;
      }
      output.push(`<li>${inlineMarkdown(line.slice(2), budget)}</li>`);
    } else if (/^>\s?/.test(line)) {
      closeList();
      output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''), budget)}</blockquote>`);
    } else if (/^---+$/.test(line.trim())) {
      closeList();
      output.push('<hr>');
    } else {
      closeList();
      output.push(`<p>${inlineMarkdown(line, budget)}</p>`);
    }
  }
  closeList();
  if (code !== null) output.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
  return output.join('\n');
}
export function wikiTargets(body) {
  return [...new Set([...body.matchAll(/\[\[([^\]\n]{1,160})\]\]/g)].map((match) => match[1]))];
}
export function linksFor(note, notes) {
  const targets = wikiTargets(note.body);
  const outgoing = notes.filter(
    (item) =>
      item.id !== note.id &&
      (targets.includes(item.title) || targets.includes(item.id) || note.parents.includes(item.id)),
  );
  const backlinks = notes.filter(
    (item) =>
      item.id !== note.id &&
      (wikiTargets(item.body).some((target) => target === note.title || target === note.id) ||
        item.parents.includes(note.id)),
  );
  return {
    outgoing,
    backlinks,
    unresolved: targets.filter(
      (target) => !notes.some((item) => item.title === target || item.id === target),
    ),
  };
}
export function searchNotes(notes, { query = '', course = '', tag = '', scope = 'all', type = '' } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return notes
    .filter((note) => {
      if (
        (course && note.course !== course) ||
        (tag && !note.tags.includes(tag)) ||
        (type && note.type !== type)
      )
        return false;
      if ((scope === 'local' && note.origin !== 'local') || (scope === 'public' && note.origin !== 'public'))
        return false;
      const haystack = [
        note.title,
        note.summary,
        note.body,
        note.course,
        ...note.tags,
        ...note.sources.map((source) => source.label),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
export function initialCard(note, now = Date.now()) {
  return { id: note.id, stage: 0, reviews: 0, due: new Date(now).toISOString(), lastGrade: 'new' };
}
export function schedule(card, grade, now = Date.now()) {
  normalizeCard(card);
  if (!['again', 'hard', 'good', 'easy'].includes(grade)) fail('未知复习评分');
  const intervals = [1, 3, 7, 14, 30, 60, 120, 180, 365];
  const stage =
    grade === 'again'
      ? 0
      : grade === 'hard'
        ? Math.max(0, card.stage - 1)
        : Math.min(8, card.stage + (grade === 'easy' ? 2 : 1));
  const minutes = grade === 'again' ? 10 : grade === 'hard' ? 1440 : intervals[Math.max(0, stage - 1)] * 1440;
  return {
    id: card.id,
    stage,
    reviews: card.reviews + 1,
    due: new Date(now + minutes * 60000).toISOString(),
    lastGrade: grade,
  };
}
export const TEMPLATES = {
  note: {
    title: '',
    body: '# 从一个问题出发\n\n## 推导路径\n\n## 哪一步还不确定\n\n用 [[笔记标题]] 连接已有记录。',
    question: '这个概念解释什么现象？',
    nextStep: '给出一个可检查的例子或反例。',
  },
  experiment: {
    title: '',
    body: '# 实验计划\n\n## 电路 / 网表\n\n```spice\n* 在这里保存网表与模型版本\n```\n\n## 固定条件\n- 电源：\n- 温度：\n- 模型与版本：\n- 扫描变量：\n\n## 结果与复现步骤\n\n尚未运行。',
    question: '在固定条件下，改变哪个变量会影响哪个指标？',
    nextStep: '先记录条件，再进行一次可复现运行。',
  },
  paper: {
    title: '',
    body: '# 文献阅读边界\n\n## 研究问题\n\n## 方法与证据\n\n## 可以迁移的条件\n\n## 未读 / 未核验部分\n\n先在来源栏写明 DOI、页码和全文/摘要范围。',
    question: '作者的哪一项结果与当前问题相关？',
    nextStep: '核对原文中的模型假设、图号和适用范围。',
  },
  failure: {
    title: '',
    body: '# 失败也值得归档\n\n## 预期行为\n\n## 实际观察\n\n## 最小复现\n\n## 已排除与未排除\n\n## 下一次只改变一个因素\n',
    question: '哪条具体观察否定了原先预期？',
    nextStep: '设计能区分两个解释的检查。',
  },
  idea: {
    title: '',
    body: '# 可以检验的想法\n\n## 动机\n\n## 假设\n\n## 最小验证\n\n## 否定条件\n\n想法不等于已验证结论。',
    question: '什么结果会使这个想法不成立？',
    nextStep: '先完成低成本的基线或反例检查。',
  },
};
export function newNote(type = 'note', now = new Date().toISOString()) {
  const template = TEMPLATES[type] || TEMPLATES.note;
  return {
    id: uid(),
    title: template.title,
    type,
    evidence: 'idea',
    course: COURSES[0],
    summary: '',
    body: template.body,
    tags: [],
    question: template.question,
    claim: '',
    limitation: '尚未验证；不应外推为工艺或硅后结论。',
    nextStep: template.nextStep,
    sources: [],
    observations: [],
    attachments: [],
    recall: { question: '', answer: '' },
    parents: [],
    example: false,
    createdAt: now,
    updatedAt: now,
  };
}
export function synthesize(left, right) {
  const shared = left.tags.filter((tag) => right.tags.includes(tag));
  const note = newNote('idea');
  note.title = `${left.title.slice(0, 36)} × ${right.title.slice(0, 36)}`;
  note.tags = [...new Set([...left.tags, ...right.tags])].slice(0, 16);
  note.parents = [left.id, right.id];
  note.summary = '由两条笔记的结构化字段组合而成的待验证研究提纲；没有推断或生成实验结果。';
  note.question =
    `能否在相同条件下比较「${left.question || left.title}」与「${right.question || right.title}」？`.slice(
      0,
      1500,
    );
  note.body = `# 交叉线索\n\n来自 [[${left.title}]] 与 [[${right.title}]]。\n\n## 共同标签\n\n${shared.join('、') || '暂无共同标签，请先检查是否有可比较的目标。'}\n\n## 线索 A\n\n${left.claim || left.summary || '尚未填写主张'}\n\n证据类型：${EVIDENCE[left.evidence]}。\n\n## 线索 B\n\n${right.claim || right.summary || '尚未填写主张'}\n\n证据类型：${EVIDENCE[right.evidence]}。\n\n## 待对齐条件\n- 输入、工作点、单位、模型版本是否相同？\n- 指标定义与测量窗口是否相同？\n- 哪个对照能区分两种解释？\n\n## 最小验证\n\n在此写出验证计划。上文仅整理已有字段，未证明两条线索相容或存在因果关系。`;
  note.sources = [
    {
      id: 'parent-a',
      label: left.title,
      url: `#note=${encodeURIComponent(left.id)}`,
      scope: `本机/公开笔记快照，修改时间 ${left.updatedAt}`,
    },
    {
      id: 'parent-b',
      label: right.title,
      url: `#note=${encodeURIComponent(right.id)}`,
      scope: `本机/公开笔记快照，修改时间 ${right.updatedAt}`,
    },
  ];
  note.limitation = `A：${left.limitation}\nB：${right.limitation}`.slice(0, 3000);
  return normalizeNote(note);
}
export function noteMarkdown(note) {
  const lines = [
    `# ${note.title}`,
    '',
    `> 类型：${TYPES[note.type]} · 证据：${EVIDENCE[note.evidence]} · ${note.example ? '示例记录' : '个人记录'}`,
    '',
    note.body,
    '',
    '## 问题与主张',
    '',
    note.question,
    '',
    note.claim,
    '',
    '## 结果与来源',
  ];
  for (const result of note.observations) {
    const source = note.sources.find((item) => item.id === result.sourceId);
    lines.push(
      '',
      `- ${result.statement}（${EVIDENCE[result.kind]}；条件：${result.conditions || '未填写'}；来源：${source?.label || '未关联'}）`,
    );
  }
  lines.push('', '## 边界与下一步', '', note.limitation, '', note.nextStep, '', '## 来源');
  for (const source of note.sources)
    lines.push('', `- ${source.url ? `[${source.label}](${source.url})` : source.label} — ${source.scope}`);
  lines.push('', '## 回忆卡', '', note.recall.question, '', note.recall.answer);
  if (note.attachments.length) lines.push('', '> 图片附件保存在 JSON 备份中，Markdown 未嵌入附件。');
  return lines.join('\n');
}
export function validateHandoff(raw) {
  const input =
    typeof raw === 'string' ? (raw.length > 180000 ? fail('跨工具内容过大') : JSON.parse(raw)) : raw;
  object(input, '跨工具内容');
  if (!['note', 'circuit'].includes(input.kind)) fail('不支持的跨工具类型');
  const result = {
    kind: input.kind,
    title: text(input.title, 160, '转交标题'),
    body: text(input.body, LIMITS.body, '转交正文'),
    netlist: text(input.netlist, 50000, '网表', true),
    source: text(input.source, 240, '来源工具'),
    createdAt: timestamp(input.createdAt, '转交'),
  };
  if (!result.title.trim()) fail('转交标题为空');
  return result;
}
export async function handoffDigest(handoff) {
  const encoded = new TextEncoder().encode(JSON.stringify(validateHandoff(handoff)));
  if (!globalThis.crypto?.subtle) fail('当前环境无法计算转交摘要，请通过 HTTP/HTTPS 打开');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
