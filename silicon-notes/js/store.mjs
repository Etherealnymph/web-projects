import { bundle, normalizeNote, normalizeCard, normalizeReflection, parseBundle, LIMITS } from './core.mjs';

export const DATABASE = 'silicon-notes-v1';
const COLLECTIONS = ['notes', 'drafts', 'cards', 'reflections', 'meta'];
const validators = {
  notes: normalizeNote,
  drafts: normalizeNote,
  cards: normalizeCard,
  reflections: normalizeReflection,
};

export function openNotebook(factory = globalThis.indexedDB, name = DATABASE) {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new Error('当前浏览器不提供 IndexedDB。公开书架可阅读；请导出正在编辑的内容。'));
      return;
    }
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      for (const collection of COLLECTIONS) {
        if (!request.result.objectStoreNames.contains(collection))
          request.result.createObjectStore(collection, { keyPath: 'id' });
      }
    };
    request.onerror = () => reject(request.error || new Error('无法打开本机书库'));
    request.onblocked = () => reject(new Error('书库升级被另一个标签页阻挡，请关闭旧标签页后重新载入。'));
    request.onsuccess = () => resolve(new NotebookStore(request.result));
  });
}

export class NotebookStore {
  constructor(database) {
    this.database = database;
    this.database.onversionchange = () => this.database.close();
  }

  all(collection) {
    if (!COLLECTIONS.includes(collection)) return Promise.reject(new Error('未知数据分区'));
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(collection, 'readonly');
      const request = transaction.objectStore(collection).getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('读取中止'));
    });
  }

  async snapshot() {
    const [notes, drafts, cards, reflections] = await Promise.all(
      ['notes', 'drafts', 'cards', 'reflections'].map((name) => this.all(name)),
    );
    return bundle({ notes, drafts, cards, reflections });
  }

  transaction(collections, enqueue) {
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = this.database.transaction(collections, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('写入失败'));
        transaction.onabort = () =>
          reject(transaction.error || new Error('写入已撤销；容量上限或浏览器限制可能阻止保存'));
        enqueue(transaction);
      } catch (error) {
        try {
          transaction?.abort();
        } catch {
          /* Transaction may already be closed. */
        }
        reject(error);
      }
    });
  }

  async put(collection, input) {
    if (!validators[collection]) throw new Error('此分区不接受直接写入');
    const value = validators[collection](input);
    await this.transaction([collection], (transaction) => {
      const target = transaction.objectStore(collection);
      const count = target.count();
      count.onsuccess = () => {
        const existing = target.get(value.id);
        existing.onsuccess = () => {
          if (!existing.result && count.result >= LIMITS.records) {
            transaction.abort();
            return;
          }
          target.put(value);
        };
      };
    });
    return value;
  }

  async publish(note) {
    const value = normalizeNote(note);
    await this.transaction(['notes', 'drafts'], (transaction) => {
      const target = transaction.objectStore('notes');
      const count = target.count();
      count.onsuccess = () => {
        const existing = target.get(value.id);
        existing.onsuccess = () => {
          if (!existing.result && count.result >= LIMITS.records) {
            transaction.abort();
            return;
          }
          target.put(value);
          transaction.objectStore('drafts').delete(value.id);
        };
      };
    });
    return value;
  }

  async remove(collection, id) {
    if (!validators[collection]) throw new Error('此分区不可直接删除');
    const collections = collection === 'notes' ? ['notes', 'cards'] : [collection];
    await this.transaction(collections, (transaction) => {
      transaction.objectStore(collection).delete(id);
      if (collection === 'notes') transaction.objectStore('cards').delete(id);
    });
  }

  async importBundle(input) {
    // Validation happens before writes. All four stores share one transaction.
    const incoming = parseBundle(input);
    const collections = ['notes', 'drafts', 'cards', 'reflections'];
    await this.transaction(collections, (transaction) => {
      let checked = 0;
      for (const collection of collections) {
        const target = transaction.objectStore(collection);
        const keys = target.getAllKeys();
        keys.onsuccess = () => {
          const combined = new Set([...keys.result, ...incoming[collection].map((record) => record.id)]);
          if (combined.size > LIMITS.records) {
            transaction.abort();
            return;
          }
          checked++;
          if (checked === collections.length) {
            for (const name of collections)
              for (const record of incoming[name]) transaction.objectStore(name).put(record);
          }
        };
      }
    });
    return incoming;
  }

  async accepted(digest) {
    const receipts = await this.all('meta');
    return receipts.some((receipt) => receipt.id === `handoff-${digest}`);
  }

  async acceptHandoff(input, digest) {
    const note = normalizeNote(input);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('转交摘要无效');
    let accepted = false;
    await this.transaction(['drafts', 'meta'], (transaction) => {
      const metadata = transaction.objectStore('meta');
      const request = metadata.get(`handoff-${digest}`);
      request.onsuccess = () => {
        if (request.result) return;
        const drafts = transaction.objectStore('drafts');
        const count = drafts.count();
        count.onsuccess = () => {
          if (count.result >= LIMITS.records) {
            transaction.abort();
            return;
          }
          drafts.put(note);
          metadata.put({ id: `handoff-${digest}`, noteId: note.id, createdAt: new Date().toISOString() });
          accepted = true;
        };
      };
    });
    return accepted;
  }

  close() {
    this.database.close();
  }
}
