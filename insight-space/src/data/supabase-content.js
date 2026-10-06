/** Supabase：内容 / 评论 / 互动 */

import { purgeMedia } from './supabase-ops.js';
import { fail, mapContent, mapComment } from './sb-core.js';
import { sortContents } from '../core/util.js';

export function createContentsApi(sb, modulesApi) {
  const { client } = sb;

  const api = {
    async list(options = {}) {
      const all = await modulesApi.list();
      const visible = new Set(all.filter((m) => m.access.visible).map((m) => m.id));
      if (options.moduleId && !visible.has(options.moduleId)) throw fail('module.noAccess');
      if (!visible.size) return { items: [], total: 0 };

      let query = client.from('contents').select('*');
      query = options.moduleId ? query.eq('module_id', options.moduleId) : query.in('module_id', Array.from(visible));
      if (options.authorId) query = query.eq('author_id', options.authorId);
      if (options.q) query = query.or(`title.ilike.%${options.q}%,body_md.ilike.%${options.q}%`);
      const { data, error } = await query.limit(500);
      if (error) throw fail('msg.error');

      let items = (data || []).map(mapContent).filter((c) => (c.status === 'draft' ? c.authorId === sb.uid() : true));
      if (options.favoritesOf) {
        const { data: favRows } = await client.from('reactions').select('target_id')
          .eq('user_id', options.favoritesOf).eq('target_type', 'content').eq('kind', 'favorite');
        const favIds = new Set((favRows || []).map((r) => r.target_id));
        items = items.filter((c) => favIds.has(c.id));
      }
      items = await sb.attachCounts(items);
      const authors = await sb.attachAuthors(data || []);
      const moduleMap = new Map(all.map((m) => [m.id, m]));
      items = items.map((c) => ({ ...c, author: authors.get(c.authorId) || null, module: moduleMap.get(c.moduleId) || null }));
      const module = options.moduleId ? moduleMap.get(options.moduleId) : null;
      items = sortContents(items, options.sort || (module?.hot ? 'hot' : 'new'));
      const total = items.length;
      const offset = options.offset || 0;
      const limit = options.limit || 0;
      return { items: limit ? items.slice(offset, offset + limit) : items.slice(offset), total };
    },

    async get(id) {
      const { data, error } = await client.from('contents').select('*').eq('id', id).maybeSingle();
      if (error) throw fail('msg.error');
      if (!data) throw fail('content.notFound');
      const [decorated] = await sb.attachCounts([mapContent(data)]);
      const authors = await sb.attachAuthors([data]);
      const { data: moduleRow } = await client.from('modules').select('*').eq('id', data.module_id).maybeSingle();
      const all = await modulesApi.list();
      const module = all.find((m) => m.id === data.module_id) || null;
      return {
        ...decorated,
        author: authors.get(data.author_id) || null,
        module,
        access: module?.access || { visible: false, write: false, expiresAt: null },
      };
    },

    async create(payload) {
      sb.requireUser();
      if (!payload.moduleId) throw fail('content.noModule');
      if (!sb.accessFor(payload.moduleId).write) throw fail('common.noPermission');
      const { data, error } = await client.from('contents').insert({
        module_id: payload.moduleId,
        author_id: sb.uid(),
        title: String(payload.title || '').trim() || '(无标题)',
        body_md: payload.bodyMd || '',
        tags: payload.tags || [],
        media: payload.media || [],
        status: payload.status === 'draft' ? 'draft' : 'published',
      }).select().single();
      if (error) throw fail('msg.error');
      return mapContent(data);
    },

    async update(id, patch) {
      sb.requireUser();
      const row = {};
      if (patch.moduleId) row.module_id = patch.moduleId;
      if (patch.title != null) row.title = patch.title;
      if (patch.bodyMd != null) row.body_md = patch.bodyMd;
      if (patch.tags) row.tags = patch.tags;
      if (patch.media) row.media = patch.media;
      if (patch.status) row.status = patch.status;
      row.updated_at = new Date().toISOString();
      const { data, error } = await client.from('contents').update(row).eq('id', id).select().single();
      if (error) throw fail('msg.error');
      return mapContent(data);
    },

    async remove(id) {
      sb.requireUser();
      // 附件清单必须在删除前取出：内容被删时其评论会级联消失，那些评论的附件同样要回收
      const [contentRes, commentRes] = await Promise.all([
        client.from('contents').select('media').eq('id', id).maybeSingle(),
        client.from('comments').select('media').eq('content_id', id),
      ]);
      const { error } = await client.from('contents').delete().eq('id', id);
      if (error) throw fail('common.noPermission');
      await purgeMedia(sb, [
        ...(contentRes?.data?.media || []),
        ...(commentRes?.data || []).flatMap((row) => row.media || []),
      ]);
      return true;
    },

    async view(id) {
      try { await client.rpc('increment_view', { p_content_id: id }); } catch { /* 计数失败不影响阅读 */ }
      return true;
    },

    async listAll() {
      sb.requireAdmin();
      const { data, error } = await client.from('contents').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw fail('msg.error');
      let items = await sb.attachCounts((data || []).map(mapContent));
      const authors = await sb.attachAuthors(data || []);
      const all = await modulesApi.list();
      const moduleMap = new Map(all.map((m) => [m.id, m]));
      return items.map((c) => ({ ...c, author: authors.get(c.authorId) || null, module: moduleMap.get(c.moduleId) || null }));
    },

    async resolveBody(content) { return content?.bodyMd || ''; },
  };

  return api;
}

export function createCommentsApi(sb) {
  const { client } = sb;

  return {
    async list(contentId) {
      const { data, error } = await client.from('comments').select('*').eq('content_id', contentId).order('created_at', { ascending: true });
      if (error) throw fail('msg.error');
      const rows = (data || []).map(mapComment);
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const [stats, mine] = await Promise.all([
          client.from('comment_stats').select('*').in('comment_id', ids),
          sb.uid()
            ? client.from('reactions').select('target_id, kind').eq('user_id', sb.uid()).eq('target_type', 'comment').in('target_id', ids)
            : Promise.resolve({ data: [] }),
        ]);
        const statMap = new Map((stats.data || []).map((s) => [s.comment_id, s]));
        const mineMap = new Map();
        for (const row of mine.data || []) {
          if (!mineMap.has(row.target_id)) mineMap.set(row.target_id, { like: false, dislike: false, favorite: false });
          mineMap.get(row.target_id)[row.kind] = true;
        }
        for (const row of rows) {
          const stat = statMap.get(row.id) || {};
          row.counts = { like: stat.like_count || 0, dislike: stat.dislike_count || 0, favorite: stat.favorite_count || 0, comment: 0 };
          row.mine = mineMap.get(row.id) || { like: false, dislike: false, favorite: false };
        }
      }
      const authors = await sb.attachAuthors(data || []);
      return rows.map((row) => {
        const canEdit = Boolean(sb.profile && (sb.profile.id === row.authorId || sb.isStaff()));
        return {
          ...row,
          author: authors.get(row.authorId) || null,
          canEdit,
          canDelete: canEdit,
        };
      });
    },

    async count(contentId) {
      const { count } = await client.from('comments').select('id', { count: 'exact', head: true }).eq('content_id', contentId);
      return count || 0;
    },

    /** 我发表过的评论 */
    async mine() {
      if (!sb.uid()) return [];
      const { data, error } = await client.from('comments').select('*').eq('author_id', sb.uid()).order('created_at', { ascending: false }).limit(200);
      if (error) throw fail('msg.error');
      const rows = (data || []).map(mapComment);
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const stats = await client.from('comment_stats').select('*').in('comment_id', ids);
        const statMap = new Map((stats.data || []).map((s) => [s.comment_id, s]));
        for (const row of rows) {
          const stat = statMap.get(row.id) || {};
          row.counts = { like: stat.like_count || 0, dislike: stat.dislike_count || 0, favorite: stat.favorite_count || 0, comment: 0 };
        }
      }
      const authors = await sb.attachAuthors(data || []);
      const contentIds = Array.from(new Set(rows.map((r) => r.contentId)));
      const contentRes = contentIds.length ? await client.from('contents').select('id,title,module_id').in('id', contentIds) : { data: [] };
      const contentMap = new Map((contentRes.data || []).map((c) => [c.id, c]));
      return rows.map((row) => ({ ...row, author: authors.get(row.authorId) || null, content: contentMap.get(row.contentId) || null }));
    },

    async create({ contentId, parentId = null, bodyMd = '', media = [] }) {
      sb.requireUser();
      const { data, error } = await client.from('comments').insert({
        content_id: contentId,
        parent_id: parentId,
        author_id: sb.uid(),
        body_md: String(bodyMd || '').slice(0, 4000),
        media: media || [],
      }).select().single();
      if (error) throw fail('msg.error');
      return mapComment(data);
    },

    async update(id, { bodyMd }) {
      sb.requireUser();
      const { data, error } = await client.from('comments')
        .update({ body_md: String(bodyMd || '').slice(0, 4000) })
        .eq('id', id)
        .select()
        .single();
      if (error) throw fail('common.noPermission');
      return mapComment(data);
    },

    async remove(id) {
      sb.requireUser();
      // 二级回复会随 parent_id 级联删除，先取出两者（含本条）的附件
      const [ownRes, replyRes] = await Promise.all([
        client.from('comments').select('media').eq('id', id).maybeSingle(),
        client.from('comments').select('media').eq('parent_id', id),
      ]);
      const { error } = await client.from('comments').delete().eq('id', id);
      if (error) throw fail('common.noPermission');
      await purgeMedia(sb, [
        ...(ownRes?.data?.media || []),
        ...(replyRes?.data || []).flatMap((row) => row.media || []),
      ]);
      return true;
    },
  };
}

export function createReactionsApi(sb) {
  const { client } = sb;

  const api = {
    async toggle({ targetType, targetId, kind }) {
      sb.requireUser();
      const { data: existing } = await client.from('reactions').select('id')
        .eq('user_id', sb.uid()).eq('target_type', targetType).eq('target_id', targetId).eq('kind', kind).maybeSingle();
      if (existing) {
        await client.from('reactions').delete().eq('id', existing.id);
      } else {
        if (kind !== 'favorite') {
          const opposite = kind === 'like' ? 'dislike' : 'like';
          await client.from('reactions').delete()
            .eq('user_id', sb.uid()).eq('target_type', targetType).eq('target_id', targetId).eq('kind', opposite);
        }
        await client.from('reactions').insert({ user_id: sb.uid(), target_type: targetType, target_id: targetId, kind });
      }
      return api.state(targetType, [targetId]);
    },

    async state(targetType, ids) {
      if (!ids.length) return {};
      const table = targetType === 'content' ? 'content_stats' : 'comment_stats';
      const key = targetType === 'content' ? 'content_id' : 'comment_id';
      const [stats, mine] = await Promise.all([
        client.from(table).select('*').in(key, ids),
        sb.uid()
          ? client.from('reactions').select('target_id, kind').eq('user_id', sb.uid()).eq('target_type', targetType).in('target_id', ids)
          : Promise.resolve({ data: [] }),
      ]);
      const out = {};
      for (const id of ids) out[id] = { like: 0, dislike: 0, favorite: 0, comment: 0, mine: { like: false, dislike: false, favorite: false } };
      for (const row of stats.data || []) {
        const id = row[key];
        out[id] = { ...out[id], like: row.like_count || 0, dislike: row.dislike_count || 0, favorite: row.favorite_count || 0 };
      }
      for (const row of mine.data || []) out[row.target_id].mine[row.kind] = true;
      return out;
    },
  };

  return api;
}
