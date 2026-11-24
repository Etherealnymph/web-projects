const databaseName = 'opencircuit-workbench-v3';
const validText = (value) => typeof value === 'string';

export function filePath(value) {
  if (!validText(value) || !value.trim()) throw Error('请填写工程内的相对文件名。');
  const path = value.trim().replaceAll('\\', '/');
  if (
    path.length > 360 ||
    /[\x00-\x1f]/.test(path) ||
    path.split('/').some((part) => ['', '.', '..'].includes(part))
  )
    throw Error('文件路径需使用有效的相对目录。');
  return path;
}

export function readProject(data, fallback = '导入工程') {
  if (!data || typeof data !== 'object') throw Error('无效的工程 JSON。');
  if (data.schemaVersion && typeof data.schemaVersion === 'number' && data.schemaVersion > 3)
    throw Error('此工程需要较新的工作台版本。');
  const list = Array.isArray(data.files) ? data.files : validText(data.content) ? [data] : [];
  if (!list.length) throw Error('工程缺少源文件。');
  const files = list.map((f) => {
    if (!validText(f?.content)) throw Error('文件缺少文本内容。');
    return { path: filePath(f.path || f.name), content: f.content };
  });
  if (new Set(files.map((f) => f.path)).size !== files.length) throw Error('工程内有重名文件。');
  const entry = data.entry || files[0].path;
  if (!files.some((f) => f.path === entry)) throw Error('工程入口文件不存在。');
  return {
    id: crypto.randomUUID(),
    title: String(data.title || data.folder || fallback),
    entry,
    active: files.some((f) => f.path === data.active) ? data.active : entry,
    configMode: data.configMode === 'auto' || !data.config ? 'auto' : 'manual',
    config: data.config && typeof data.config === 'object' ? { ...data.config } : null,
    custom: Array.isArray(data.custom) ? data.custom : [],
    files,
    revision: 0,
  };
}

export function projectJson(project) {
  const { title, entry, active, config, configMode, custom, files } = project;
  return {
    schemaVersion: 3,
    title,
    entry,
    active,
    config,
    configMode,
    custom,
    files: files.map(({ path, content }) => ({ path, content })),
  };
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openStore() {
  const open = indexedDB.open(databaseName, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    db.createObjectStore('projects', { keyPath: 'id' });
    db.createObjectStore('files', { keyPath: ['project', 'path'] }).createIndex(
      'project',
      'project',
    );
  };
  const db = await request(open);
  db.onversionchange = () => db.close();
  return {
    async list() {
      return (await request(db.transaction('projects').objectStore('projects').getAll())).sort(
        (a, b) => b.updated - a.updated,
      );
    },
    async load(id) {
      const tx = db.transaction(['projects', 'files']);
      const [p, records] = await Promise.all([
        request(tx.objectStore('projects').get(id)),
        request(tx.objectStore('files').index('project').getAll(id)),
      ]);
      if (!p) return null;
      const byPath = new Map(records.map((f) => [f.path, f.content]));
      return { ...p, files: p.order.map((path) => ({ path, content: byPath.get(path) })) };
    },
    async remove(id, revision) {
      const tx = db.transaction(['projects', 'files'], 'readwrite'),
        projects = tx.objectStore('projects'),
        files = tx.objectStore('files');
      return new Promise((resolve, reject) => {
        const read = projects.get(id);
        read.onsuccess = () => {
          if (read.result?.revision !== revision) {
            tx.abort();
            return;
          }
          for (const path of read.result.order) files.delete([id, path]);
          projects.delete(id);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () =>
          reject(Error('工程已在其他标签页中修改或删除，请先重新打开。'));
      });
    },
    async save(p, changed, removed) {
      const tx = db.transaction(['projects', 'files'], 'readwrite');
      const projects = tx.objectStore('projects'),
        files = tx.objectStore('files');
      const revision = p.revision + 1;
      const { id, title, entry, active, config, configMode, custom } = p;
      const order = p.files.map((f) => f.path);
      const updates = p.files
        .filter((f) => changed.has(f.path))
        .map((f) => ({ project: id, path: f.path, content: f.content }));
      return new Promise((resolve, reject) => {
        let conflict = false;
        const get = projects.get(id);
        get.onsuccess = () => {
          if ((get.result?.revision || 0) !== p.revision) {
            conflict = true;
            tx.abort();
            return;
          }
          for (const path of removed) files.delete([id, path]);
          for (const f of updates) files.put(f);
          projects.put({
            id,
            title,
            entry,
            active,
            config,
            configMode,
            custom,
            order,
            revision,
            updated: Date.now(),
          });
        };
        tx.oncomplete = () => resolve(revision);
        tx.onabort = tx.onerror = () =>
          reject(
            Error(
              conflict
                ? '其他标签页更新了本工程。请先导出当前工程副本，再重新打开。'
                : tx.error?.message || '工程存储失败，请导出备份。',
            ),
          );
      });
    },
  };
}
