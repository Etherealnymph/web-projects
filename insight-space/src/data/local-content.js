/** 本地模式：内容 / 评论 / 互动的读写 */

import { uid, nowIso, sortContents, EXP } from '../core/util.js';
import {
  buildIndex, countsOf, decorateContent, decorateComment, authorMapOf,
  visibleModules, accessFor, canEditContent, canWriteModule, myReactions, resolveText,
  awardExp,
} from './local-core.js';

export function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/** 当前用户对模块的访问表 */
function accessTable(db, user) {
  const map = new Map();
  for (const m of db.modules) map.set(m.id, accessFor(db, user, m));
  return map;
}

function matchQuery(content, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return `${content.title || ''} ${content.bodyMd || ''} ${(content.tags || []).join(' ')}`.toLowerCase().includes(needle);
}

export function createContentsApi(ctx) {
  const sortFor = (module, requested) => {
    if (requested) return requested;
    return module?.hot ? 'hot' : 'new';
  };

  return {
    async list(options = {}) {
      const db = await ctx.db();
      const user = ctx.user();
      const index = buildIndex(db);
      const access = accessTable(db, user);
      const module = options.moduleId ? db.modules.find((m) => m.id === options.moduleId) : null;
      if (options.moduleId && module && !access.get(module.id)?.visible) throw fail('module.noAccess');

      let items = db.contents.filter((c) => access.get(c.moduleId)?.visible);
      if (options.moduleId) items = items.filter((c) => c.moduleId === options.moduleId);
      items = items.filter((c) => (c.status === 'draft' ? c.authorId === user?.id : true));
      if (options.authorId) items = items.filter((c) => c.authorId === options.authorId);
      if (options.includeDrafts) items = items.filter((c) => c.status !== 'draft' || c.authorId === user?.id);
      if (options.q) items = items.filter((c) => matchQuery(c, options.q));
      if (options.tag) items = items.filter((c) => (c.tags || []).includes(options.tag));
      if (options.favoritesOf) {
        const ids = new Set(db.reactions.filter((r) => r.userId === options.favoritesOf && r.kind === 'favorite' && r.targetType === 'content').map((r) => r.targetId));
        items = items.filter((c) => ids.has(c.id));
      }
      const authors = authorMapOf(db);
      const modulesById = new Map(db.modules.map((m) => [m.id, m]));
      items = items.map((c) => ({ ...decorateContent(db, index, c), author: authors.get(c.authorId) || null, module: modulesById.get(c.moduleId) || null }));
      items = sortContents(items, sortFor(module, options.sort));
      const total = items.length;
      const offset = options.offset || 0;
      const limit = options.limit || 0;
      return { items: limit ? items.slice(offset, offset + limit) : items.slice(offset), total };
    },

    async get(id) {
      const db = await ctx.db();
      const user = ctx.user();
      const content = db.contents.find((c) => c.id === id);
      if (!content) throw fail('content.notFound');
      const module = db.modules.find((m) => m.id === content.moduleId);
      const access = accessFor(db, user, module);
      if (content.status === 'draft' && content.authorId !== user?.id && user?.role !== 'superadmin' && user?.role !== 'owner') {
        throw fail('content.notFound');
      }
      if (!access.visible && content.authorId !== user?.id) throw fail('module.noAccess');
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const author = map.get(content.authorId) || null;
      return { ...decorateContent(db, index, content), author, module, access, mine: myReactions(db, user?.id, 'content', [id]).get(id) };
    },

    async create(data) {
      const db = await ctx.db();
      const user = ctx.user();
      if (!user) throw fail('common.loginRequired');
      if (!data.moduleId) throw fail('content.noModule');
      const module = db.modules.find((m) => m.id === data.moduleId);
      if (!module) throw fail('content.noModule');
      const access = accessFor(db, user, module);
      if (!access.visible) throw fail('module.noAccess');
      if (!access.write) throw fail('common.noPermission');
      const content = {
        id: uid('c'),
        moduleId: data.moduleId,
        authorId: user.id,
        title: String(data.title || '').trim() || '(无标题)',
        bodyMd: String(data.bodyMd || ''),
        tags: (data.tags || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12),
        media: data.media || [],
        status: data.status === 'draft' ? 'draft' : 'published',
        views: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.contents.unshift(content);
      awardExp(db, user.id, EXP.content);
      await ctx.save();
      return content;
    },

    async update(id, patch) {
      const db = await ctx.db();
      const user = ctx.user();
      const content = db.contents.find((c) => c.id === id);
      if (!content) throw fail('content.notFound');
      if (!canEditContent(db, user, content)) throw fail('content.onlyAuthor');
      if (patch.moduleId && patch.moduleId !== content.moduleId) {
        if (!canWriteModule(db, user, patch.moduleId)) throw fail('common.noPermission');
        content.moduleId = patch.moduleId;
      }
      if (patch.title != null) content.title = String(patch.title).trim() || content.title;
      if (patch.bodyMd != null) content.bodyMd = String(patch.bodyMd);
      if (patch.tags) content.tags = patch.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
      if (patch.media) {
        const keep = new Set((patch.media || []).map((m) => m.url));
        for (const old of content.media || []) if (!keep.has(old.url)) await ctx.removeMedia(old);
        content.media = patch.media;
      }
      if (patch.status) content.status = patch.status === 'draft' ? 'draft' : 'published';
      content.updatedAt = nowIso();
      await ctx.save();
      return content;
    },

    async remove(id) {
      const db = await ctx.db();
      const user = ctx.user();
      const content = db.contents.find((c) => c.id === id);
      if (!content) throw fail('content.notFound');
      if (!canEditContent(db, user, content) && user?.role !== 'owner' && user?.role !== 'superadmin') throw fail('common.noPermission');
      for (const media of content.media || []) await ctx.removeMedia(media);
      const commentIds = db.comments.filter((c) => c.contentId === id).map((c) => c.id);
      db.contents = db.contents.filter((c) => c.id !== id);
      db.comments = db.comments.filter((c) => c.contentId !== id);
      db.reactions = db.reactions.filter((r) => {
        if (r.targetType === 'content') return r.targetId !== id;
        return !commentIds.includes(r.targetId);
      });
      awardExp(db, content.authorId, -EXP.content);
      await ctx.save();
      return true;
    },

    async view(id) {
      const db = await ctx.db();
      const content = db.contents.find((c) => c.id === id);
      if (!content) return false;
      content.views = (content.views || 0) + 1;
      await ctx.save();
      return true;
    },

    /** 后台：所有内容（含草稿） */
    async listAll() {
      const db = await ctx.db();
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const modules = new Map(db.modules.map((m) => [m.id, m]));
      return db.contents
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((c) => ({ ...decorateContent(db, index, c), author: map.get(c.authorId) || null, module: modules.get(c.moduleId) || null }));
    },

    async resolveBody(content) {
      return resolveText(content?.bodyMd || '');
    },
  };
}

export function createCommentsApi(ctx) {
  return {
    async list(contentId) {
      const db = await ctx.db();
      const user = ctx.user();
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const mine = myReactions(db, user?.id, 'comment', db.comments.filter((c) => c.contentId === contentId).map((c) => c.id));
      const all = db.comments
        .filter((c) => c.contentId === contentId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((c) => {
          const decorated = decorateComment(db, index, c, map);
          const canEdit = Boolean(user && (user.id === c.authorId || user.role === 'superadmin' || user.role === 'owner'));
          return { ...decorated, mine: mine.get(c.id), canEdit, canDelete: canEdit };
        });
      return all;
    },

    async count(contentId) {
      const db = await ctx.db();
      return db.comments.filter((c) => c.contentId === contentId).length;
    },

    /** 我发表过的评论 */
    async mine() {
      const db = await ctx.db();
      const user = ctx.user();
      if (!user) return [];
      const index = buildIndex(db);
      const map = authorMapOf(db);
      const contentsById = new Map(db.contents.map((c) => [c.id, c]));
      return db.comments
        .filter((c) => c.authorId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((c) => ({
          ...decorateComment(db, index, c, map),
          mine: myReactions(db, user.id, 'comment', [c.id]).get(c.id),
          content: contentsById.get(c.contentId) ? { id: c.contentId, title: contentsById.get(c.contentId).title } : null,
        }));
    },

    async create({ contentId, parentId = null, bodyMd = '', media = [] }) {
      const db = await ctx.db();
      const user = ctx.user();
      if (!user) throw fail('common.loginRequired');
      const content = db.contents.find((c) => c.id === contentId);
      if (!content) throw fail('content.notFound');
      const module = db.modules.find((m) => m.id === content.moduleId);
      if (!accessFor(db, user, module).visible) throw fail('module.noAccess');
      let parent = parentId;
      if (parent) {
        const target = db.comments.find((c) => c.id === parent);
        if (target?.parentId) parent = target.parentId;
      }
      const comment = {
        id: uid('cm'),
        contentId,
        parentId: parent || null,
        authorId: user.id,
        bodyMd: String(bodyMd || '').slice(0, 4000),
        media: media || [],
        status: 'active',
        createdAt: nowIso(),
      };
      db.comments.push(comment);
      awardExp(db, user.id, EXP.comment);
      await ctx.save();
      return comment;
    },

    async update(id, { bodyMd }) {
      const db = await ctx.db();
      const user = ctx.user();
      if (!user) throw fail('common.loginRequired');
      const comment = db.comments.find((c) => c.id === id);
      if (!comment) throw fail('content.notFound');
      if (user.id !== comment.authorId && user.role !== 'superadmin' && user.role !== 'owner') throw fail('common.noPermission');
      comment.bodyMd = String(bodyMd || '').slice(0, 4000);
      await ctx.save();
      return comment;
    },

    async remove(id) {
      const db = await ctx.db();
      const user = ctx.user();
      const comment = db.comments.find((c) => c.id === id);
      if (!comment) throw fail('content.notFound');
      if (!user || (user.id !== comment.authorId && user.role !== 'superadmin' && user.role !== 'owner')) throw fail('common.noPermission');
      for (const media of comment.media || []) await ctx.removeMedia(media);
      const removeIds = [id, ...db.comments.filter((c) => c.parentId === id).map((c) => c.id)];
      db.comments = db.comments.filter((c) => !removeIds.includes(c.id));
      db.reactions = db.reactions.filter((r) => !(r.targetType === 'comment' && removeIds.includes(r.targetId)));
      awardExp(db, comment.authorId, -EXP.comment);
      await ctx.save();
      return true;
    },
  };
}

export function createReactionsApi(ctx) {
  return {
    /** 切换某个反应；赞 / 踩互斥 */
    async toggle({ targetType, targetId, kind }) {
      const db = await ctx.db();
      const user = ctx.user();
      if (!user) throw fail('common.loginRequired');
      if (!['content', 'comment'].includes(targetType) || !['like', 'dislike', 'favorite'].includes(kind)) throw fail('common.noPermission');
      const targetAuthorId = targetType === 'content'
        ? db.contents.find((c) => c.id === targetId)?.authorId
        : db.comments.find((c) => c.id === targetId)?.authorId;
      const expFor = (k) => (k === 'like' ? EXP.like : k === 'favorite' ? EXP.favorite : 0);
      let delta = 0;
      const existing = db.reactions.find((r) => r.userId === user.id && r.targetType === targetType && r.targetId === targetId && r.kind === kind);
      if (existing) {
        db.reactions = db.reactions.filter((r) => r !== existing);
        delta -= expFor(kind);
      } else {
        if (kind === 'like' || kind === 'dislike') {
          const opposite = kind === 'like' ? 'dislike' : 'like';
          const hadOpposite = db.reactions.some((r) => r.userId === user.id && r.targetType === targetType && r.targetId === targetId && r.kind === opposite);
          if (hadOpposite) delta -= expFor(opposite);
          db.reactions = db.reactions.filter((r) => !(r.userId === user.id && r.targetType === targetType && r.targetId === targetId && r.kind === opposite));
        }
        db.reactions.push({ id: uid('rx'), userId: user.id, targetType, targetId, kind, createdAt: nowIso() });
        delta += expFor(kind);
      }
      if (targetAuthorId && targetAuthorId !== user.id) awardExp(db, targetAuthorId, delta);
      await ctx.save();
      return this.state(targetType, [targetId]);
    },

    /** 当前用户对一批目标的反应状态 */
    async state(targetType, ids) {
      const db = await ctx.db();
      const user = ctx.user();
      const mine = myReactions(db, user?.id, targetType, ids);
      const index = buildIndex(db);
      const out = {};
      for (const id of ids) {
        const counts = countsOf(index, targetType, id);
        out[id] = { ...counts, mine: mine.get(id) || { like: false, dislike: false, favorite: false } };
      }
      return out;
    },
  };
}
