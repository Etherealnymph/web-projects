/** 本地模式 API：无需服务器即可完整运行（数据保存在浏览器） */

import { CONFIG } from '../config.js';
import { uid, nowIso, formatDay, sortContents, hotScore, randomCode } from '../core/util.js';
import { verifyPassword, hashPassword } from './storage.js';
import {
  loadDb, saveDb, makeUser, publicUser, accessFor, isAdmin, canManageSystem,
  buildIndex, decorateContent, authorMapOf, resolveGrant, myReactions,
  uploadFile, resolveRef, resolveText, removeRef, countsOf,
} from './local-core.js';
import { createContentsApi, createCommentsApi, createReactionsApi, fail } from './local-content.js';

const SESSION_KEY = 'tiwu.session';

function readSession() {
  try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
}

function writeSession(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

export async function createLocalApi() {
  let currentUserId = readSession();

  const ctx = {
    async db() { return loadDb(); },
    async save() { const db = await loadDb(); await saveDb(db); },
    user() {
      if (!currentUserId) return null;
      return loadDbCache()?.users.find((u) => u.id === currentUserId) || null;
    },
    async removeMedia(ref) { await removeRef(ref); },
  };

  // 用户查询走内存缓存，保证同步可用
  let dbCache = null;
  function loadDbCache() {
    if (!dbCache) return null;
    return dbCache;
  }

  async function refresh() {
    dbCache = await loadDb();
    return dbCache;
  }
  await refresh();
  ctx.save = async () => { await saveDb(dbCache); };

  const requireUser = () => {
    const user = ctx.user();
    if (!user) throw fail('common.loginRequired');
    return user;
  };
  const requireAdmin = () => {
    const user = requireUser();
    if (!canManageSystem(user)) throw fail('common.noPermission');
    return user;
  };

  /* ------------------------------- 账号 ------------------------------- */

  const auth = {
    async bootstrapState() {
      const db = await refresh();
      return {
        hasUsers: db.users.length > 0,
        hasSuperadmin: db.users.some((u) => u.role === 'superadmin'),
        autoCreate: CONFIG.bootstrap.autoCreate && db.users.length > 0,
      };
    },

    async createInitialSuperadmin({ username, password, nickname }) {
      const db = await refresh();
      if (db.users.length) throw fail('common.noPermission');
      const user = await makeUser({ username, password, nickname: nickname || username, role: 'superadmin' });
      db.users.push(user);
      await saveDb(db);
      currentUserId = user.id;
      writeSession(user.id);
      return publicUser(user);
    },

    async login(username, password) {
      const db = await refresh();
      const name = String(username || '').trim();
      const user = db.users.find((u) => u.username.toLowerCase() === name.toLowerCase());
      if (!user) throw fail('auth.errBad');
      if (user.status === 'disabled') throw fail('common.noPermission');
      const ok = await verifyPassword(password, user.secret);
      if (!ok) throw fail('auth.errBad');
      currentUserId = user.id;
      writeSession(user.id);
      return publicUser(user);
    },

    async register({ username, password, nickname, inviteCode }) {
      const db = await refresh();
      const name = String(username || '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw fail('auth.errUserLen');
      if (String(password || '').length < 6) throw fail('auth.errPwShort');
      if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) throw fail('auth.errExists');

      const code = String(inviteCode || '').trim();
      const invite = findInvite(db, code);
      if (!invite) throw fail('auth.errInviteInvalid');
      validateInvite(invite);

      const user = await makeUser({ username: name, password, nickname: nickname || name, role: 'member', inviteId: invite.id });
      db.users.push(user);
      const moduleIds = invite.allModules ? ['*'] : invite.moduleIds;
      for (const moduleId of moduleIds) {
        db.grants.push({
          id: uid('g'), userId: user.id, inviteId: invite.id, moduleId,
          read: true, write: Boolean(invite.write), upload: true, expiresAt: null, createdAt: nowIso(),
        });
      }
      invite.usedCount = (invite.usedCount || 0) + 1;
      invite.usedBy = [...(invite.usedBy || []), { userId: user.id, username: user.username, at: nowIso() }];
      await saveDb(db);
      currentUserId = user.id;
      writeSession(user.id);
      return publicUser(user);
    },

    async logout() {
      currentUserId = null;
      writeSession(null);
      return true;
    },

    async current() {
      await refresh();
      const user = ctx.user();
      return user ? publicUser(user) : null;
    },

    async refresh() {
      await refresh();
      const user = ctx.user();
      return user ? publicUser(user) : null;
    },

    async updateProfile(patch) {
      const db = await refresh();
      const user = requireUser();
      const record = db.users.find((u) => u.id === user.id);
      if (patch.nickname != null) record.nickname = String(patch.nickname).trim().slice(0, 30) || record.username;
      if (patch.bio != null) record.bio = String(patch.bio).slice(0, 300);
      // 本地模式的上传接口不可用，头像直接存成 data URL，因此上限放宽到 1MB 文本
      if (patch.avatar != null) record.avatar = String(patch.avatar).trim().slice(0, 1000000);
      await saveDb(db);
      return publicUser(record);
    },

    async changePassword(oldPassword, newPassword) {
      const db = await refresh();
      const user = requireUser();
      if (String(newPassword || '').length < 6) throw fail('auth.errPwShort');
      const record = db.users.find((u) => u.id === user.id);
      const ok = await verifyPassword(oldPassword, record.secret);
      if (!ok) throw fail('profile.errOldPw');
      record.secret = await hashPassword(newPassword);
      record.mustChangePassword = false;
      await saveDb(db);
      return true;
    },

    /* ---------------------------- 超管：账号管理 ---------------------------- */

    async listUsers() {
      const db = await refresh();
      requireAdmin();
      const index = buildIndex(db);
      return db.users.map((u) => {
        const contents = db.contents.filter((c) => c.authorId === u.id);
        const likes = contents.reduce((sum, c) => sum + (countsOf(index, 'content', c.id).like || 0), 0);
        return {
          ...publicUser(u),
          stats: {
            contents: contents.length,
            comments: db.comments.filter((c) => c.authorId === u.id).length,
            likes,
          },
          grants: grantsFor(db, u.id),
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async createUser({ username, password, nickname, role = 'member', moduleIds = [], read = true, write = true, upload = true, expiresAt = null }) {
      const db = await refresh();
      requireAdmin();
      const name = String(username || '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw fail('auth.errUserLen');
      if (String(password || '').length < 6) throw fail('auth.errPwShort');
      if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) throw fail('auth.errExists');
      const user = await makeUser({ username: name, password, nickname: nickname || name, role, mustChangePassword: true });
      db.users.push(user);
      const list = moduleIds.includes('*') ? ['*'] : moduleIds;
      for (const moduleId of list) {
        db.grants.push({ id: uid('g'), userId: user.id, inviteId: null, moduleId, read: Boolean(read), write: Boolean(write), upload: Boolean(upload), expiresAt: expiresAt || null, createdAt: nowIso() });
      }
      await saveDb(db);
      return publicUser(user);
    },

    async updateUser(id, patch) {
      const db = await refresh();
      const admin = requireAdmin();
      const record = db.users.find((u) => u.id === id);
      if (!record) throw fail('content.notFound');
      if (patch.role) {
        if (record.id === admin.id && patch.role !== 'superadmin') throw fail('admin.selfDelete');
        record.role = ['superadmin', 'owner', 'member'].includes(patch.role) ? patch.role : record.role;
      }
      if (patch.nickname != null) record.nickname = String(patch.nickname).trim().slice(0, 30) || record.username;
      if (patch.status) record.status = patch.status === 'disabled' ? 'disabled' : 'active';
      if (patch.mustChangePassword != null) record.mustChangePassword = Boolean(patch.mustChangePassword);
      await saveDb(db);
      return publicUser(record);
    },

    async resetPassword(id, newPassword) {
      const db = await refresh();
      requireAdmin();
      if (String(newPassword || '').length < 6) throw fail('auth.errPwShort');
      const record = db.users.find((u) => u.id === id);
      if (!record) throw fail('content.notFound');
      record.secret = await hashPassword(newPassword);
      record.mustChangePassword = true;
      await saveDb(db);
      return true;
    },

    async removeUser(id) {
      const db = await refresh();
      const admin = requireAdmin();
      if (admin.id === id) throw fail('admin.selfDelete');
      const record = db.users.find((u) => u.id === id);
      if (!record) throw fail('content.notFound');
      const contentIds = db.contents.filter((c) => c.authorId === id).map((c) => c.id);
      const commentIds = db.comments.filter((c) => c.authorId === id).map((c) => c.id);
      for (const content of db.contents.filter((c) => c.authorId === id)) {
        for (const media of content.media || []) await removeRef(media);
      }
      db.users = db.users.filter((u) => u.id !== id);
      db.contents = db.contents.filter((c) => c.authorId !== id);
      db.comments = db.comments.filter((c) => c.authorId !== id && !contentIds.includes(c.contentId));
      db.reactions = db.reactions.filter((r) => r.userId !== id
        && !(r.targetType === 'content' && contentIds.includes(r.targetId))
        && !(r.targetType === 'comment' && commentIds.includes(r.targetId)));
      db.grants = db.grants.filter((g) => g.userId !== id);
      await saveDb(db);
      return true;
    },
  };

  /* ------------------------------- 模块 ------------------------------- */

  const modules = {
    async list() {
      const db = await refresh();
      const user = ctx.user();
      return db.modules
        .slice()
        .sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99) || new Date(a.createdAt) - new Date(b.createdAt))
        .map((m) => ({
          ...m,
          access: accessFor(db, user, m),
          counts: { contents: db.contents.filter((c) => c.moduleId === m.id && c.status !== 'draft').length },
        }));
    },

    async accessible() {
      const all = await this.list();
      return all.filter((m) => m.access.visible);
    },

    async create(patch) {
      const db = await refresh();
      requireAdmin();
      const key = String(patch.key || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!key) throw fail('module.keyExists');
      if (db.modules.some((m) => m.key === key)) throw fail('module.keyExists');
      const module = {
        id: uid('mod'),
        key,
        nameZh: String(patch.nameZh || key).trim(),
        nameEn: String(patch.nameEn || patch.nameZh || key).trim(),
        descZh: String(patch.descZh || '').trim(),
        descEn: String(patch.descEn || '').trim(),
        icon: String(patch.icon || '❖').slice(0, 2),
        sort: Number.isFinite(Number(patch.sort)) ? Number(patch.sort) : 99,
        hot: Boolean(patch.hot),
        kind: patch.kind === 'qa' ? 'qa' : 'content',
        createdAt: nowIso(),
      };
      db.modules.push(module);
      await saveDb(db);
      return module;
    },

    async update(id, patch) {
      const db = await refresh();
      requireAdmin();
      const module = db.modules.find((m) => m.id === id);
      if (!module) throw fail('content.notFound');
      if (patch.key != null) {
        const key = String(patch.key).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (key && db.modules.some((m) => m.key === key && m.id !== id)) throw fail('module.keyExists');
        if (key) module.key = key;
      }
      for (const field of ['nameZh', 'nameEn', 'descZh', 'descEn']) if (patch[field] != null) module[field] = String(patch[field]);
      if (patch.icon != null) module.icon = String(patch.icon).slice(0, 2);
      if (patch.sort != null) module.sort = Number(patch.sort) || 0;
      if (patch.hot != null) module.hot = Boolean(patch.hot);
      if (patch.kind != null) module.kind = patch.kind === 'qa' ? 'qa' : 'content';
      await saveDb(db);
      return module;
    },

    async remove(id) {
      const db = await refresh();
      requireAdmin();
      const contentIds = db.contents.filter((c) => c.moduleId === id).map((c) => c.id);
      const commentIds = db.comments.filter((c) => contentIds.includes(c.contentId)).map((c) => c.id);
      db.modules = db.modules.filter((m) => m.id !== id);
      db.contents = db.contents.filter((c) => c.moduleId !== id);
      db.comments = db.comments.filter((c) => !contentIds.includes(c.contentId));
      db.reactions = db.reactions.filter((r) => !(r.targetType === 'content' && contentIds.includes(r.targetId))
        && !(r.targetType === 'comment' && commentIds.includes(r.targetId)));
      db.grants = db.grants.filter((g) => g.moduleId !== id);
      await saveDb(db);
      return true;
    },
  };

  /* ------------------------------ 邀请码 ------------------------------ */

  function findInvite(db, code) {
    const needle = String(code || '').trim().toUpperCase();
    if (!needle) return null;
    return db.invites.find((i) => i.code.toUpperCase() === needle) || null;
  }

  function validateInvite(invite) {
    if (!invite) throw fail('auth.errInviteInvalid');
    if (invite.active === false) throw fail('auth.errInviteDisabled');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) throw fail('auth.errInviteExpired');
    if (invite.maxUses && (invite.usedCount || 0) >= invite.maxUses) throw fail('auth.errInviteUsedUp');
    return true;
  }

  function inviteStatus(invite) {
    if (invite.active === false) return 'disabled';
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return 'expired';
    if (invite.maxUses && (invite.usedCount || 0) >= invite.maxUses) return 'usedUp';
    return 'active';
  }

  const invites = {
    async list() {
      const db = await refresh();
      requireAdmin();
      return db.invites
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((i) => ({ ...i, status: inviteStatus(i), modules: i.allModules ? ['*'] : i.moduleIds }));
    },

    async create(patch) {
      const db = await refresh();
      const admin = requireAdmin();
      let code = String(patch.code || '').trim().toUpperCase();
      if (code && !/^[A-Z0-9-]{4,24}$/.test(code)) throw fail('invite.errCodeFormat');
      if (!code) {
        do { code = randomCode(10); } while (findInvite(db, code));
      }
      if (findInvite(db, code)) throw fail('invite.errCodeExists');
      const allModules = !patch.moduleIds || patch.moduleIds.includes('*') || patch.moduleIds.length === 0;
      if (!allModules && !patch.moduleIds.length) throw fail('invite.errNoModule');
      let expiresAt = null;
      if (patch.expiresAt) expiresAt = new Date(patch.expiresAt).toISOString();
      else if (patch.durationDays) expiresAt = new Date(Date.now() + Number(patch.durationDays) * 86400000).toISOString();
      const invite = {
        id: uid('inv'),
        code,
        category: String(patch.category || '通用').trim().slice(0, 20),
        moduleIds: allModules ? [] : patch.moduleIds,
        allModules,
        write: patch.write !== false,
        expiresAt,
        maxUses: patch.maxUses ? Number(patch.maxUses) : null,
        usedCount: 0,
        usedBy: [],
        note: String(patch.note || '').slice(0, 120),
        active: patch.active !== false,
        createdBy: admin.id,
        createdAt: nowIso(),
      };
      db.invites.push(invite);
      await saveDb(db);
      return { ...invite, status: inviteStatus(invite) };
    },

    async update(id, patch) {
      const db = await refresh();
      requireAdmin();
      const invite = db.invites.find((i) => i.id === id);
      if (!invite) throw fail('content.notFound');
      if (patch.active != null) invite.active = Boolean(patch.active);
      if (patch.note != null) invite.note = String(patch.note).slice(0, 120);
      if (patch.category != null) invite.category = String(patch.category).slice(0, 20);
      if (patch.expiresAt !== undefined) invite.expiresAt = patch.expiresAt ? new Date(patch.expiresAt).toISOString() : null;
      if (patch.write != null) invite.write = Boolean(patch.write);
      if (patch.maxUses !== undefined) invite.maxUses = patch.maxUses ? Number(patch.maxUses) : null;
      if (patch.moduleIds) {
        invite.allModules = patch.moduleIds.includes('*');
        invite.moduleIds = invite.allModules ? [] : patch.moduleIds;
        // 同步已注册用户的授权范围（邀请码变了，权限随之变化）
        for (const grant of db.grants.filter((g) => g.inviteId === invite.id)) {
          db.grants = db.grants.filter((g) => g !== grant);
          const list = invite.allModules ? ['*'] : invite.moduleIds;
          for (const moduleId of list) {
            db.grants.push({ ...grant, id: uid('g'), moduleId });
          }
        }
      }
      await saveDb(db);
      return { ...invite, status: inviteStatus(invite) };
    },

    async remove(id) {
      const db = await refresh();
      requireAdmin();
      db.invites = db.invites.filter((i) => i.id !== id);
      // 失效授权（用户保留，但失去模块权限）
      db.grants = db.grants.filter((g) => g.inviteId !== id);
      await saveDb(db);
      return true;
    },

    async validate(code) {
      const db = await refresh();
      const invite = findInvite(db, code);
      validateInvite(invite);
      return {
        code: invite.code,
        category: invite.category,
        modules: invite.allModules ? ['*'] : invite.moduleIds,
        write: invite.write,
        expiresAt: invite.expiresAt,
      };
    },
  };

  /* ------------------------------ 模块授权 ------------------------------ */

  function grantsFor(db, userId) {
    return db.grants
      .filter((g) => g.userId === userId)
      .map((g) => {
        const resolved = resolveGrant(db, g);
        const module = g.moduleId === '*' ? null : db.modules.find((m) => m.id === g.moduleId);
        return {
          id: g.id,
          moduleId: g.moduleId,
          module,
          allModules: g.moduleId === '*',
          read: resolved ? resolved.read !== false : false,
          write: resolved ? resolved.write : false,
          upload: resolved ? resolved.upload !== false : false,
          expiresAt: resolved ? resolved.expiresAt : null,
          valid: Boolean(resolved),
          inviteId: g.inviteId,
        };
      });
  }

  const grants = {
    async list(userId) {
      const db = await refresh();
      const user = ctx.user();
      if (!user) throw fail('common.loginRequired');
      if (user.id !== userId && !canManageSystem(user)) throw fail('common.noPermission');
      return grantsFor(db, userId);
    },

    async set({ userId, moduleId, read = true, write = true, upload = true, expiresAt = null }) {
      const db = await refresh();
      requireAdmin();
      const existing = db.grants.find((g) => g.userId === userId && g.moduleId === moduleId);
      if (existing) {
        existing.write = Boolean(write);
        existing.read = Boolean(read);
        existing.upload = Boolean(upload);
        existing.expiresAt = expiresAt || null;
        existing.inviteId = null;
      } else {
        db.grants.push({ id: uid('g'), userId, moduleId, read: Boolean(read), write: Boolean(write), upload: Boolean(upload), expiresAt: expiresAt || null, inviteId: null, createdAt: nowIso() });
      }
      await saveDb(db);
      return grantsFor(db, userId);
    },

    async remove({ userId, moduleId }) {
      const db = await refresh();
      requireAdmin();
      db.grants = db.grants.filter((g) => !(g.userId === userId && g.moduleId === moduleId));
      await saveDb(db);
      return grantsFor(db, userId);
    },
  };

  /* ------------------------------- 后台 ------------------------------- */

  const admin = {
    async stats() {
      const db = await refresh();
      requireAdmin();
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const modulesById = new Map(db.modules.map((m) => [m.id, m]));
      const today = formatDay(new Date().toISOString());
      const isToday = (iso) => formatDay(iso) === today;
      const contents = db.contents.map((c) => decorateContent(db, index, c));
      const comments = db.comments.map((c) => ({ ...c, counts: countsOf(index, 'comment', c.id), author: map.get(c.authorId) || null }));

      const series = [];
      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(Date.now() - i * 86400000);
        const day = formatDay(date.toISOString());
        series.push({
          day,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          contents: db.contents.filter((c) => formatDay(c.createdAt) === day).length,
          comments: db.comments.filter((c) => formatDay(c.createdAt) === day).length,
        });
      }

      const byModule = db.modules.map((m) => {
        const list = contents.filter((c) => c.moduleId === m.id);
        return {
          id: m.id,
          icon: m.icon,
          nameZh: m.nameZh,
          nameEn: m.nameEn,
          count: list.length,
          views: list.reduce((s, c) => s + (c.views || 0), 0),
          likes: list.reduce((s, c) => s + (c.counts.like || 0), 0),
          favorites: list.reduce((s, c) => s + (c.counts.favorite || 0), 0),
          comments: list.reduce((s, c) => s + (c.counts.comment || 0), 0),
        };
      });

      const topContents = contents
        .slice()
        .sort((a, b) => hotScore(b) - hotScore(a))
        .slice(0, 8)
        .map((c) => ({ ...c, author: map.get(c.authorId) || null, module: modulesById.get(c.moduleId) || null }));

      const topComments = comments
        .slice()
        .sort((a, b) => (b.counts.like || 0) - (a.counts.like || 0) || new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8);

      const contributors = db.users.map((u) => {
        const own = contents.filter((c) => c.authorId === u.id);
        return {
          user: publicUser(u),
          contents: own.length,
          comments: comments.filter((c) => c.authorId === u.id).length,
          likes: own.reduce((s, c) => s + (c.counts.like || 0), 0),
          views: own.reduce((s, c) => s + (c.views || 0), 0),
        };
      }).sort((a, b) => (b.contents + b.comments) - (a.contents + a.comments)).slice(0, 6);

      const recent = [
        ...db.contents.map((c) => ({ type: 'content', at: c.createdAt, title: c.title, author: map.get(c.authorId) || null, contentId: c.id, moduleId: c.moduleId })),
        ...db.comments.map((c) => ({ type: 'comment', at: c.createdAt, title: c.bodyMd.slice(0, 60), author: map.get(c.authorId) || null, contentId: c.contentId, moduleId: null })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);

      return {
        totals: {
          users: db.users.length,
          contents: db.contents.length,
          comments: db.comments.length,
          reactions: db.reactions.length,
          invites: db.invites.length,
          activeInvites: db.invites.filter((i) => inviteStatus(i) === 'active').length,
          views: db.contents.reduce((s, c) => s + (c.views || 0), 0),
          drafts: db.contents.filter((c) => c.status === 'draft').length,
        },
        today: {
          contents: db.contents.filter((c) => isToday(c.createdAt)).length,
          comments: db.comments.filter((c) => isToday(c.createdAt)).length,
          users: db.users.filter((u) => isToday(u.createdAt)).length,
        },
        series,
        byModule,
        topContents,
        topComments,
        contributors,
        recent,
        invites: db.invites
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((i) => ({ ...i, status: inviteStatus(i) })),
      };
    },

    async allComments() {
      const db = await refresh();
      requireAdmin();
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const contentsById = new Map(db.contents.map((c) => [c.id, c]));
      return db.comments
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((c) => ({ ...c, counts: countsOf(index, 'comment', c.id), author: map.get(c.authorId) || null, content: contentsById.get(c.contentId) || null }));
    },
  };

  /* ------------------------------- 媒体 ------------------------------- */

  const media = {
    async upload(file) { return uploadFile(file); },
    async resolve(ref) { return resolveRef(ref); },
    async resolveText(text) { return resolveText(text); },
    async remove(ref) { return removeRef(ref); },
  };

  const permissionRequests = {
    async list() {
      const db = await refresh();
      const user = requireUser();
      const rows = db.permissionRequests.filter((r) => r.userId === user.id || canManageSystem(user));
      return rows.map((r) => ({ ...r, user: publicUser(db.users.find((u) => u.id === r.userId)) }));
    },
    async create({ moduleId, read = true, write = false, upload = false, expiresAt = null }) {
      const db = await refresh();
      const user = requireUser();
      if (user.role !== 'member') throw fail('common.noPermission');
      const row = { id: uid('pr'), userId: user.id, moduleId, read: Boolean(read), write: Boolean(write), upload: Boolean(upload), expiresAt: expiresAt || null, status: 'pending', createdAt: nowIso() };
      db.permissionRequests.unshift(row);
      await saveDb(db);
      return row;
    },
    async decide(id, status) {
      const db = await refresh();
      requireAdmin();
      const row = db.permissionRequests.find((r) => r.id === id);
      if (!row) throw fail('content.notFound');
      row.status = status === 'approved' ? 'approved' : 'rejected';
      if (row.status === 'approved') {
        const existing = db.grants.find((g) => g.userId === row.userId && g.moduleId === row.moduleId && !g.inviteId);
        if (existing) Object.assign(existing, { read: row.read, write: row.write, upload: row.upload, expiresAt: row.expiresAt });
        else db.grants.push({ id: uid('g'), userId: row.userId, moduleId: row.moduleId, read: row.read, write: row.write, upload: row.upload, expiresAt: row.expiresAt, inviteId: null, createdAt: nowIso() });
      }
      await saveDb(db);
      return row;
    },
  };

  return {
    mode: 'local',
    async init() { await refresh(); return true; },
    auth,
    modules,
    invites,
    grants,
    admin,
    media,
    permissionRequests,
    contents: createContentsApi(ctx),
    comments: createCommentsApi(ctx),
    reactions: createReactionsApi(ctx),
    friends: createFriendsApi(ctx),
    messages: createMessagesApi(ctx),
  };
}
import { createFriendsApi, createMessagesApi } from './local-social.js';
