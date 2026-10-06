/** 本地模式的数据引擎：存储、访问控制、统计 */

import { CONFIG } from '../config.js';
import { uid, nowIso, hotScore, expLevel } from '../core/util.js';
import { readDb, writeDb, putFile, getFile, deleteFile, hashPassword } from './storage.js';

/* ------------------------------- 数据库 ------------------------------- */

export function emptyDb() {
  return {
    version: 1,
    users: [],
    modules: [],
    contents: [],
    comments: [],
    reactions: [],
    invites: [],
    grants: [],
    friendships: [],
    messages: [],
    permissionRequests: [],
    meta: { createdAt: nowIso(), seeded: false },
  };
}

let cache = null;

export async function loadDb() {
  if (cache) return cache;
  const stored = await readDb();
  cache = stored && stored.users ? stored : emptyDb();
  if (!Array.isArray(cache.friendships)) cache.friendships = [];
  if (!Array.isArray(cache.messages)) cache.messages = [];
  if (!Array.isArray(cache.permissionRequests)) cache.permissionRequests = [];
  for (const m of cache.modules || []) if (!m.kind) m.kind = 'content';
  for (const u of cache.users || []) if (u.exp == null) u.exp = 0;
  await ensureSeed(cache);
  return cache;
}

export async function saveDb(db = cache) {
  cache = db;
  await writeDb(db);
  return db;
}

/** 首次运行：写入默认模块与内置账号 */
export async function ensureSeed(db) {
  let changed = false;
  if (!db.modules.length) {
    db.modules = CONFIG.defaultModules.map((m) => ({
      id: uid('mod'),
      key: m.key,
      nameZh: m.nameZh,
      nameEn: m.nameEn,
      descZh: m.descZh || '',
      descEn: m.descEn || '',
      icon: m.icon || '❖',
      sort: m.sort ?? 99,
      hot: Boolean(m.hot),
      kind: m.kind || 'content',
      createdAt: nowIso(),
    }));
    changed = true;
  }
  if (CONFIG.bootstrap.autoCreate && !db.users.length) {
    const { superadmin, owner } = CONFIG.bootstrap;
    db.users.push(await makeUser({ username: superadmin.username, password: superadmin.password, nickname: superadmin.nickname, role: 'superadmin' }));
    db.users.push(await makeUser({ username: owner.username, password: owner.password, nickname: owner.nickname, role: 'owner' }));
    changed = true;
  }
  if (!db.meta.seeded) { db.meta.seeded = true; changed = true; }
  if (changed) await saveDb(db);
  return db;
}

export async function makeUser({ username, password, nickname, role = 'member', inviteId = null, mustChangePassword = false }) {
  const secret = await hashPassword(password);
  return {
    id: uid('u'),
    username: String(username).trim(),
    nickname: String(nickname || username).trim(),
    role,
    bio: '',
    avatar: '',
    status: 'active',
    inviteId,
    secret,
    exp: 0,
    mustChangePassword,
    createdAt: nowIso(),
  };
}

/** 对外暴露的用户信息（去掉口令） */
export function publicUser(user) {
  if (!user) return null;
  const { secret, ...rest } = user;
  rest.exp = Math.max(0, Number(rest.exp) || 0);
  rest.level = expLevel(rest.exp);
  return rest;
}

/** 给用户增减经验（调用方负责 saveDb） */
export function awardExp(db, userId, delta) {
  if (!delta) return;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;
  user.exp = Math.max(0, (Number(user.exp) || 0) + delta);
}

/* ----------------------------- 访问控制 ----------------------------- */

export const ROLE_LEVEL = { superadmin: 3, owner: 2, member: 1 };

export function isAdmin(user) { return user?.role === 'superadmin'; }
export function isOwner(user) { return user?.role === 'owner'; }
export function canManageSystem(user) { return isAdmin(user); }

/** 解析一条授权记录是否仍然有效（会跟随邀请码的停用 / 过期实时失效） */
export function resolveGrant(db, grant) {
  const now = Date.now();
  if (grant.inviteId) {
    const invite = db.invites.find((i) => i.id === grant.inviteId);
    if (!invite) return null;
    if (invite.active === false) return null;
    const expiresAt = invite.expiresAt || null;
    if (expiresAt && new Date(expiresAt).getTime() <= now) return null;
    return {
      ...grant,
      read: grant.read !== false,
      write: Boolean(invite.write) && grant.write !== false,
      upload: grant.upload !== false,
      expiresAt,
      invite,
    };
  }
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= now) return null;
  return { ...grant, read: grant.read !== false, write: grant.write !== false, upload: grant.upload !== false, expiresAt: grant.expiresAt || null, invite: null };
}

/** 某个用户对某个模块的访问权限 */
export function accessFor(db, user, module) {
  if (!user || !module) return { visible: false, write: false, expiresAt: null };
  if (user.role === 'superadmin' || user.role === 'owner') {
    return { visible: true, write: true, expiresAt: null, role: user.role };
  }
  const candidates = db.grants
    .filter((g) => g.userId === user.id && (g.moduleId === module.id || g.moduleId === '*'))
    .map((g) => resolveGrant(db, g))
    .filter(Boolean);
  if (!candidates.length) return { visible: false, write: false, expiresAt: null };
  // 超管直接配置的授权（inviteId 为空）优先于邀请码授权。
  const effective = candidates.some((g) => !g.inviteId) ? candidates.filter((g) => !g.inviteId) : candidates;
  const visible = effective.some((g) => g.read !== false);
  const write = effective.some((g) => g.write && g.read !== false);
  const upload = effective.some((g) => g.upload && g.read !== false);
  const expiries = effective.map((g) => (g.expiresAt ? new Date(g.expiresAt).getTime() : Infinity));
  const best = Math.max(...expiries);
  return {
    visible,
    write,
    upload,
    expiresAt: best === Infinity ? null : new Date(best).toISOString(),
    grantId: effective[0]?.id,
    inviteId: effective[0]?.inviteId,
  };
}

/** 当前用户可访问的模块（附带权限信息） */
export function visibleModules(db, user) {
  return db.modules
    .slice()
    .sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99) || new Date(a.createdAt) - new Date(b.createdAt))
    .map((m) => ({ ...m, access: accessFor(db, user, m) }))
    .filter((m) => m.access.visible);
}

export function canWriteModule(db, user, moduleId) {
  const module = db.modules.find((m) => m.id === moduleId);
  return accessFor(db, user, module).write;
}

export function canEditContent(db, user, content) {
  if (!user || !content) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'owner') return true;
  if (content.authorId !== user.id) return false;
  return canWriteModule(db, user, content.moduleId);
}

/* ------------------------------ 好友关系 ------------------------------ */

/** 我与某人的关系：self / none / pending_out / pending_in / accepted */
export function relationOf(db, meId, otherId) {
  if (!meId || !otherId) return 'none';
  if (meId === otherId) return 'self';
  const row = (db.friendships || []).find((f) => (
    (f.requesterId === meId && f.addresseeId === otherId)
    || (f.requesterId === otherId && f.addresseeId === meId)
  ));
  if (!row) return 'none';
  if (row.status === 'accepted') return 'accepted';
  if (row.status !== 'pending') return 'none';
  return row.requesterId === meId ? 'pending_out' : 'pending_in';
}

export function areFriends(db, a, b) {
  return relationOf(db, a, b) === 'accepted';
}

/* ------------------------------ 计数与装饰 ------------------------------ */

export function buildIndex(db) {
  const reactions = new Map();
  for (const r of db.reactions) {
    const key = `${r.targetType}:${r.targetId}`;
    if (!reactions.has(key)) reactions.set(key, { like: 0, dislike: 0, favorite: 0, mine: {} });
    const bucket = reactions.get(key);
    bucket[r.kind] = (bucket[r.kind] || 0) + 1;
  }
  const commentCounts = new Map();
  for (const c of db.comments) {
    if (c.status === 'deleted') continue;
    commentCounts.set(c.contentId, (commentCounts.get(c.contentId) || 0) + 1);
  }
  return { reactions, commentCounts };
}

export function countsOf(index, targetType, targetId, userId = null) {
  const bucket = index.reactions.get(`${targetType}:${targetId}`) || { like: 0, dislike: 0, favorite: 0 };
  const mine = { like: false, dislike: false, favorite: false };
  return { like: bucket.like || 0, dislike: bucket.dislike || 0, favorite: bucket.favorite || 0, mine, comment: 0 };
}

/** 当前用户对一批目标的反应状态 */
export function myReactions(db, userId, targetType, ids) {
  const set = new Set(ids);
  const out = new Map();
  for (const id of ids) out.set(id, { like: false, dislike: false, favorite: false });
  if (!userId) return out;
  for (const r of db.reactions) {
    if (r.userId !== userId || r.targetType !== targetType || !set.has(r.targetId)) continue;
    out.get(r.targetId)[r.kind] = true;
  }
  return out;
}

export function decorateContent(db, index, content) {
  const counts = countsOf(index, 'content', content.id);
  counts.comment = index.commentCounts.get(content.id) || 0;
  return { ...content, counts };
}

export function decorateComment(db, index, comment, authorMap) {
  const counts = countsOf(index, 'comment', comment.id);
  return { ...comment, counts, author: authorMap.get(comment.authorId) || null };
}

export function authorMapOf(db) {
  const map = new Map();
  for (const u of db.users) map.set(u.id, publicUser(u));
  return map;
}

/* -------------------------------- 媒体 -------------------------------- */

const objectUrls = new Map();

export function guessKind(mime = '', name = '') {
  const type = String(mime).toLowerCase();
  const ext = String(name).toLowerCase().split('.').pop();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'].includes(ext)) return 'audio';
  return 'file';
}

export async function uploadFile(file, kind = null) {
  const id = uid('med');
  const resolvedKind = kind || guessKind(file.type, file.name);
  const ok = await putFile(id, file);
  return {
    id,
    kind: resolvedKind,
    name: file.name || `${resolvedKind}-${id}`,
    size: file.size,
    type: file.type || '',
    url: `idb://${id}`,
    stored: ok,
  };
}

export async function resolveRef(ref) {
  if (!ref) return '';
  const url = typeof ref === 'string' ? ref : ref.url;
  if (!url) return '';
  if (!url.startsWith('idb://')) return url;
  const id = url.slice(6);
  if (objectUrls.has(id)) return objectUrls.get(id);
  const blob = await getFile(id);
  if (!blob) return '';
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(id, objectUrl);
  return objectUrl;
}

export async function removeRef(ref) {
  const url = typeof ref === 'string' ? ref : ref?.url;
  if (!url || !url.startsWith('idb://')) return;
  const id = url.slice(6);
  const cached = objectUrls.get(id);
  if (cached) { URL.revokeObjectURL(cached); objectUrls.delete(id); }
  await deleteFile(id);
}

/** 把正文里的 idb:// 地址替换成可显示的 blob 地址 */
export async function resolveText(text) {
  const source = String(text || '');
  if (!source.includes('idb://')) return source;
  const ids = Array.from(new Set(source.match(/idb:\/\/[A-Za-z0-9_]+/g) || []));
  let out = source;
  for (const token of ids) {
    const url = await resolveRef(token);
    out = out.split(token).join(url || '#');
  }
  return out;
}

export function resetCache() { cache = null; }
