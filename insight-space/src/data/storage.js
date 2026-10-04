/**
 * 本地持久化：IndexedDB（不可用时回退到 localStorage / 内存）。
 * - kv 存储：整个数据库对象
 * - files 存储：媒体二进制（图片 / 视频 / 语音 / 文档）
 */

const DB_NAME = 'tiwu-insight';
const DB_VERSION = 1;
const KV = 'kv';
const FILES = 'files';

let dbPromise = null;
const memory = { kv: new Map(), files: new Map() };

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let tx;
    try { tx = db.transaction(name, mode); } catch { resolve(null); return; }
    const store = tx.objectStore(name);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/* --------------------------- 键值（整个数据库） --------------------------- */

export async function readDb() {
  const raw = await withStore(KV, 'readonly', (store) => store.get('db'));
  if (raw) return raw;
  // 回退：localStorage
  try {
    const text = localStorage.getItem('tiwu.db');
    if (text) return JSON.parse(text);
  } catch { /* ignore */ }
  return memory.kv.get('db') || null;
}

export async function writeDb(db) {
  const ok = await withStore(KV, 'readwrite', (store) => store.put(db, 'db'));
  memory.kv.set('db', db);
  if (ok === null) {
    try { localStorage.setItem('tiwu.db', JSON.stringify(db)); } catch { /* 超出配额时忽略 */ }
  } else {
    try { localStorage.removeItem('tiwu.db'); } catch { /* ignore */ }
  }
  return true;
}

/* ------------------------------- 媒体文件 ------------------------------- */

export async function putFile(id, blob) {
  memory.files.set(id, blob);
  const ok = await withStore(FILES, 'readwrite', (store) => store.put(blob, id));
  return ok !== null;
}

export async function getFile(id) {
  const blob = await withStore(FILES, 'readonly', (store) => store.get(id));
  return blob || memory.files.get(id) || null;
}

export async function deleteFile(id) {
  memory.files.delete(id);
  await withStore(FILES, 'readwrite', (store) => store.delete(id));
}

export async function clearAll() {
  await withStore(KV, 'readwrite', (store) => store.clear());
  await withStore(FILES, 'readwrite', (store) => store.clear());
  memory.kv.clear();
  memory.files.clear();
  try { localStorage.removeItem('tiwu.db'); } catch { /* ignore */ }
}

/* -------------------------- 轻量口令哈希 -------------------------- */

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 纯 JS SHA-256（当 crypto.subtle 不可用时使用） */
function sha256Hex(text) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(text);
  const l = bytes.length;
  const withPad = new Uint8Array((((l + 9) >> 6) + 1) << 6);
  withPad.set(bytes);
  withPad[l] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, l * 8, false);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j += 1) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j += 1) {
      const s0 = (w[j - 15] >>> 7 | w[j - 15] << 25) ^ (w[j - 15] >>> 18 | w[j - 15] << 14) ^ (w[j - 15] >>> 3);
      const s1 = (w[j - 2] >>> 17 | w[j - 2] << 15) ^ (w[j - 2] >>> 19 | w[j - 2] << 13) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let j = 0; j < 64; j += 1) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

const ITERATIONS = 60000;

/** 生成盐 + 口令哈希 */
export async function hashPassword(password, salt = null) {
  const useSalt = salt || toHex(crypto.getRandomValues(new Uint8Array(16)));
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(useSalt), iterations: ITERATIONS, hash: 'SHA-256' },
        key,
        256,
      );
      return { salt: useSalt, hash: toHex(bits), algo: `pbkdf2-sha256:${ITERATIONS}` };
    } catch { /* 继续使用回退算法 */ }
  }
  let digest = `${useSalt}:${password}`;
  for (let i = 0; i < 2000; i += 1) digest = sha256Hex(`${digest}:${i}`);
  return { salt: useSalt, hash: digest, algo: 'js-sha256:2000' };
}

export async function verifyPassword(password, record) {
  if (!record || !record.hash) return false;
  const { hash } = await hashPassword(password, record.salt);
  return hash === record.hash;
}
