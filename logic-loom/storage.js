import { validateGraph, validateModules } from './engine.js';
export const STORAGE_KEY = 'logicloom.workspace.v1';
export const blankWorkspace = () => ({
  version: 1,
  current: '01',
  records: {},
  modules: {},
  progress: {},
});
export function validateWorkspace(value, { imported = false } = {}) {
  if (
    !value ||
    value.version !== 1 ||
    !value.records ||
    typeof value.records !== 'object' ||
    Array.isArray(value.records)
  )
    throw Error('不是 Logic Loom v1 工程文件');
  const modules = value.modules || {};
  const moduleErrors = validateModules(modules);
  if (moduleErrors.length) throw Error(moduleErrors[0]);
  const result = blankWorkspace();
  result.modules = structuredClone(modules);
  result.current = /^(0[1-9]|1\d|20|sandbox)$/.test(value.current || '') ? value.current : '01';
  if (Object.keys(value.records).length > 21) throw Error('工程关卡数量无效');
  for (const [key, r] of Object.entries(value.records)) {
    if (!/^(0[1-9]|1\d|20|sandbox)$/.test(key) || !r || typeof r !== 'object')
      throw Error('关卡记录无效');
    const errors = validateGraph(r.graph, modules, { strict: false });
    if (errors.length) throw Error('关卡 ' + key + '：' + errors[0]);
    if (r.program !== undefined && (typeof r.program !== 'string' || r.program.length > 12000))
      throw Error('程序内容无效');
    result.records[key] = {
      graph: structuredClone(r.graph),
      assisted: imported || !!r.assisted,
      program: r.program || '',
    };
  }
  if (imported) {
    for (const m of Object.values(result.modules)) m.assisted = true;
  } else if (value.progress && typeof value.progress === 'object')
    for (const [key, p] of Object.entries(value.progress))
      if (/^(0[1-9]|1\d|20)$/.test(key) && p && ['independent', 'practice'].includes(p.kind))
        result.progress[key] = { kind: p.kind, date: typeof p.date === 'string' ? p.date : '' };
  return result;
}
export function parseImport(text) {
  if (typeof text !== 'string' || text.length > 1500000) throw Error('工程文件过大（上限 1.5 MB）');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw Error('JSON 格式损坏，原工程未改变');
  }
  return validateWorkspace(raw, { imported: true });
}
export function readWorkspace(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { data: raw ? validateWorkspace(JSON.parse(raw)) : blankWorkspace(), error: null };
  } catch (e) {
    return { data: blankWorkspace(), error: '本地工程读取失败：' + e.message };
  }
}
export function writeWorkspace(storage, data) {
  try {
    const payload = JSON.stringify(data);
    if (payload.length > 1500000) throw Error('工程超过 1.5 MB，请先导出备份');
    storage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '未能保存到本机：' + e.message };
  }
}
export function exportWorkspace(data) {
  return JSON.stringify(
    { version: 1, current: data.current, records: data.records, modules: data.modules },
    null,
    2,
  );
}
