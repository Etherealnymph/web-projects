/** Supabase：邀请码 / 授权 / 后台统计 / 媒体 */

import { CONFIG, rewriteSupabaseUrls, toUpstreamSupabaseUrl } from '../config.js';
import { fail, mapInvite, mapUser, mapContent, mapComment, serializeInvitePerms } from './sb-core.js';
import { randomCode, hotScore, formatDay } from '../core/util.js';

/** 数据库还没执行最新 schema.sql（缺 module_perms 列）时，退回到旧的全局权限行为 */
function isMissingPermColumn(error) {
  return Boolean(error && /module_perms/i.test(error.message || ''));
}

function warnMissingPermColumn() {
  console.warn('[insight-space] invites.module_perms 列不存在，已按旧版全局权限保存。请在 Supabase 重新执行 supabase/schema.sql。');
}

/** 规整前端传来的模块权限；allModules 为 undefined 时保持原样 */
function normalizePerms(list, allModules) {
  if (!Array.isArray(list) || !list.length) return [];
  const rows = list.map((p) => ({
    moduleId: !p.moduleId || p.moduleId === '*' ? '*' : p.moduleId,
    read: p.read !== false,
    write: Boolean(p.write),
    upload: Boolean(p.upload),
    readDays: p.readDays == null || p.readDays === '' ? null : Math.max(0, Number(p.readDays) || 0),
  }));
  if (allModules === true) return rows.filter((p) => p.moduleId === '*');
  if (allModules === false) return rows.filter((p) => p.moduleId !== '*');
  return rows;
}

export function createInvitesApi(sb) {
  const { client } = sb;

  /** 按邀请码的模块权限生成注册用户应得的授权行 */
  const grantRowsFor = (inviteRow, perms) => {
    const fallbackExpiry = inviteRow.expires_at || null;
    if (perms.length) {
      return perms.map((p) => ({
        module_id: p.moduleId === '*' ? null : p.moduleId,
        read: p.read,
        write: p.write,
        upload: p.upload,
        read_days: p.readDays == null ? null : p.readDays,
        expires_at: fallbackExpiry,
      }));
    }
    const ids = inviteRow.all_modules ? [null] : (inviteRow.module_ids || []);
    return ids.map((moduleId) => ({
      module_id: moduleId,
      read: true,
      write: inviteRow.write !== false,
      upload: true,
      read_days: null,
      expires_at: fallbackExpiry,
    }));
  };

  /** 邀请码权限变了，已注册用户的授权同步刷新（与本地模式行为一致） */
  const syncMemberGrants = async (inviteRow, perms) => {
    const { data: members, error } = await client.from('profiles').select('id').eq('invite_id', inviteRow.id);
    if (error) throw fail('msg.error');
    const userIds = (members || []).map((m) => m.id);
    if (!userIds.length) return;
    const { error: delError } = await client.from('grants').delete().eq('invite_id', inviteRow.id);
    if (delError) throw fail('msg.error');
    const rows = grantRowsFor(inviteRow, perms);
    if (!rows.length) return;
    const payload = userIds.flatMap((userId) => rows.map((r) => ({ ...r, user_id: userId, invite_id: inviteRow.id })));
    const { error: insError } = await client.from('grants').insert(payload);
    if (insError) throw fail('msg.error');
  };

  const api = {
    async list() {
      sb.requireAdmin();
      const { data, error } = await client.from('invites').select('*').order('created_at', { ascending: false });
      if (error) throw fail('msg.error');
      return (data || []).map(mapInvite);
    },

    async create(patch) {
      const admin = sb.requireAdmin();
      let code = String(patch.code || '').trim().toUpperCase();
      if (code && !/^[A-Z0-9-]{4,24}$/.test(code)) throw fail('invite.errCodeFormat');
      if (!code) code = randomCode(10);
      const allModules = !patch.moduleIds || patch.moduleIds.length === 0 || patch.moduleIds.includes('*');
      const perms = normalizePerms(patch.modulePerms, allModules);
      let expiresAt = null;
      if (patch.expiresAt) expiresAt = new Date(patch.expiresAt).toISOString();
      else if (patch.durationDays) expiresAt = new Date(Date.now() + Number(patch.durationDays) * 86400000).toISOString();
      const row = {
        code,
        category: patch.category || '通用',
        module_ids: allModules ? null : patch.moduleIds,
        all_modules: allModules,
        write: patch.write !== false,
        expires_at: expiresAt,
        max_uses: patch.maxUses ? Number(patch.maxUses) : null,
        note: patch.note || '',
        active: patch.active !== false,
        created_by: admin.id,
      };
      if (perms.length) row.module_perms = serializeInvitePerms(perms);
      let { data, error } = await client.from('invites').insert(row).select().single();
      if (error && row.module_perms && isMissingPermColumn(error)) {
        delete row.module_perms;
        warnMissingPermColumn();
        ({ data, error } = await client.from('invites').insert(row).select().single());
      }
      if (error) throw fail(error.message?.includes('duplicate') ? 'invite.errCodeExists' : 'msg.error');
      return mapInvite(data);
    },

    async update(id, patch) {
      sb.requireAdmin();
      const row = {};
      if (patch.active != null) row.active = Boolean(patch.active);
      if (patch.note != null) row.note = patch.note;
      if (patch.category != null) row.category = patch.category;
      if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt || null;
      if (patch.write != null) row.write = Boolean(patch.write);
      if (patch.maxUses !== undefined) row.max_uses = patch.maxUses || null;
      if (patch.moduleIds) {
        const all = patch.moduleIds.includes('*');
        row.all_modules = all;
        row.module_ids = all ? null : patch.moduleIds;
      }
      const hasPerms = patch.modulePerms !== undefined;
      if (hasPerms) row.module_perms = serializeInvitePerms(normalizePerms(patch.modulePerms, undefined));
      let { data, error } = await client.from('invites').update(row).eq('id', id).select().single();
      if (error && hasPerms && isMissingPermColumn(error)) {
        delete row.module_perms;
        warnMissingPermColumn();
        ({ data, error } = await client.from('invites').update(row).eq('id', id).select().single());
      }
      if (error) throw fail('msg.error');
      if (hasPerms || patch.moduleIds) {
        try {
          await syncMemberGrants(data, mapInvite(data).modulePerms);
        } catch (e) {
          console.warn('[insight-space] 同步已注册用户授权失败：', e);
        }
      }
      return mapInvite(data);
    },

    async remove(id) {
      sb.requireAdmin();
      const { error } = await client.from('invites').delete().eq('id', id);
      if (error) throw fail('msg.error');
      return true;
    },

    async validate(code) {
      const normalized = String(code || '').trim().toUpperCase();
      const { data: rpcData, error: rpcError } = await client.rpc('validate_invite', { p_code: normalized });
      let data = rpcError ? null : (Array.isArray(rpcData) ? rpcData[0] : rpcData);
      if (rpcError) {
        const { data: fallback, error } = await client.from('invites').select('*').eq('code', normalized).maybeSingle();
        if (error) throw fail('msg.networkError');
        data = fallback;
      }
      if (!data) throw fail('auth.errInviteInvalid');
      const invite = mapInvite(data);
      if (invite.status === 'disabled') throw fail('auth.errInviteDisabled');
      if (invite.status === 'expired') throw fail('auth.errInviteExpired');
      if (invite.status === 'usedUp') throw fail('auth.errInviteUsedUp');
      const moduleIds = invite.allModules ? ['*'] : (invite.moduleIds || []);
      // 旧邀请码没有 module_perms，按全局 write 推导一份，前端展示更统一
      const modulePerms = invite.modulePerms.length
        ? invite.modulePerms
        : moduleIds.map((moduleId) => ({
            moduleId,
            read: true,
            write: invite.write !== false,
            upload: true,
            readDays: p.readDays,
            expiresAt: invite.expiresAt,
          }));
      return { ...invite, modulePerms, modules: moduleIds };
    },
  };

  return api;
}

export function createGrantsApi(sb) {
  const { client } = sb;

  const api = {
    async list(userId) {
      if (userId !== sb.uid()) sb.requireAdmin();
      const { data, error } = await client.from('grants').select('*').eq('user_id', userId);
      if (error) throw fail('msg.error');
      const { data: moduleRows } = await client.from('modules').select('*');
      return (data || []).map((g) => ({
        id: g.id,
        moduleId: g.module_id,
        module: g.module_id ? (moduleRows || []).find((m) => m.id === g.module_id) || null : null,
        allModules: g.module_id === null,
        read: g.read !== false,
        write: Boolean(g.write),
        upload: g.upload !== false,
        readDays: g.read_days == null ? null : Number(g.read_days),
        valid: !g.invite_id || !g.expires_at || new Date(g.expires_at) > new Date(),
        inviteId: g.invite_id,
      }));
    },

    async set({ userId, moduleId, read = true, write = true, upload = true, readDays = null }) {
      sb.requireAdmin();
      const payload = {
        user_id: userId,
        module_id: moduleId === '*' ? null : moduleId,
        read: Boolean(read),
        write: Boolean(write),
        upload: Boolean(upload),
        read_days: readDays == null ? null : Number(readDays),
        invite_id: null,
      };
      const existing = await client.from('grants').select('id').eq('user_id', userId);
      const match = (existing.data || []).find((g) => (moduleId === '*' ? g.module_id === null : g.module_id === moduleId));
      const { error } = match
        ? await client.from('grants').update(payload).eq('id', match.id)
        : await client.from('grants').insert(payload);
      if (error) throw fail('msg.error');
      return api.list(userId);
    },

    async remove({ userId, moduleId }) {
      sb.requireAdmin();
      const existing = await client.from('grants').select('id, module_id').eq('user_id', userId);
      const match = (existing.data || []).find((g) => (moduleId === '*' ? g.module_id === null : g.module_id === moduleId));
      if (match) {
        const { error } = await client.from('grants').delete().eq('id', match.id);
        if (error) throw fail('msg.error');
      }

      return api.list(userId);
    },
  };

  return api;
}

export function createPermissionRequestsApi(sb) {
  const { client } = sb;
  return {
    async list() {
      sb.requireUser();
      const { data, error } = await client.from('permission_requests').select('*').order('created_at', { ascending: false });
      if (error) throw fail('msg.error');
      return (data || []).map((r) => ({ id: r.id, userId: r.user_id, moduleId: r.module_id, read: r.read, write: r.write, upload: r.upload, readDays: r.read_days == null ? null : Number(r.read_days), status: r.status, createdAt: r.created_at }));
    },
    async create({ moduleId, read = true, write = false, upload = false, readDays = null }) {
      const user = sb.requireUser();
      const { data, error } = await client.from('permission_requests').insert({ user_id: user.id, module_id: moduleId, read, write, upload, read_days: readDays == null ? null : Number(readDays) }).select().single();
      if (error) throw fail('msg.error');
      return data;
    },
    async decide(id, status) {
      sb.requireAdmin();
      const { data, error } = await client.from('permission_requests').update({ status: status === 'approved' ? 'approved' : 'rejected' }).eq('id', id).select().single();
      if (error) throw fail('msg.error');
      if (status === 'approved') {
        const { data: row } = await client.from('permission_requests').select('*').eq('id', id).single();
        await createGrantsApi(sb).set({ userId: row.user_id, moduleId: row.module_id, read: row.read, write: row.write, upload: row.upload, readDays: row.read_days });
      }
      return data;
    },
  };
}

export function createAdminApi(sb, modulesApi) {
  const { client } = sb;

  return {
    async stats() {
      sb.requireAdmin();
      const [profilesRes, contentsRes, commentsRes, reactionsRes, invitesRes, statsRes, commentStatsRes] = await Promise.all([
        client.from('profiles').select('*'),
        client.from('contents').select('*'),
        client.from('comments').select('*'),
        client.from('reactions').select('id'),
        client.from('invites').select('*'),
        client.from('content_stats').select('*'),
        client.from('comment_stats').select('*'),
      ]);
      const profileRows = profilesRes.data || [];
      const contentRows = contentsRes.data || [];
      const commentRows = commentsRes.data || [];
      const inviteRows = invitesRes.data || [];
      const statMap = new Map((statsRes.data || []).map((s) => [s.content_id, s]));
      const commentStatMap = new Map((commentStatsRes.data || []).map((s) => [s.comment_id, s]));
      const userMap = new Map(profileRows.map((p) => [p.id, mapUser(p)]));
      const moduleRows = await modulesApi.list();
      const moduleMap = new Map(moduleRows.map((m) => [m.id, m]));
      const today = formatDay(new Date().toISOString());
      const isToday = (iso) => formatDay(iso) === today;

      const contents = contentRows.map((row) => {
        const stat = statMap.get(row.id) || {};
        const created = commentRows.filter((c) => c.content_id === row.id).length;
        return {
          ...mapContent(row),
          counts: { like: stat.like_count || 0, dislike: stat.dislike_count || 0, favorite: stat.favorite_count || 0, comment: created },
        };
      });

      const comments = commentRows.map((row) => {
        const stat = commentStatMap.get(row.id) || {};
        return {
          ...mapComment(row),
          counts: { like: stat.like_count || 0, dislike: stat.dislike_count || 0, favorite: stat.favorite_count || 0, comment: 0 },
          author: userMap.get(row.author_id) || null,
          content: contents.find((c) => c.id === row.content_id) || null,
        };
      });

      const series = [];
      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(Date.now() - i * 86400000);
        const day = formatDay(date.toISOString());
        series.push({
          day,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          contents: contentRows.filter((c) => formatDay(c.created_at) === day).length,
          comments: commentRows.filter((c) => formatDay(c.created_at) === day).length,
        });
      }

      const byModule = moduleRows.map((m) => {
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

      return {
        totals: {
          users: profileRows.length,
          contents: contentRows.length,
          comments: commentRows.length,
          reactions: (reactionsRes.data || []).length,
          invites: inviteRows.length,
          activeInvites: inviteRows.map(mapInvite).filter((i) => i.status === 'active').length,
          views: contentRows.reduce((s, c) => s + (c.views || 0), 0),
          drafts: contentRows.filter((c) => c.status === 'draft').length,
        },
        today: {
          contents: contentRows.filter((c) => isToday(c.created_at)).length,
          comments: commentRows.filter((c) => isToday(c.created_at)).length,
          users: profileRows.filter((u) => isToday(u.created_at)).length,
        },
        series,
        byModule,
        topContents: contents.slice().sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 8)
          .map((c) => ({ ...c, author: userMap.get(c.authorId) || null, module: moduleMap.get(c.moduleId) || null })),
        topComments: comments.slice().sort((a, b) => (b.counts.like || 0) - (a.counts.like || 0)).slice(0, 8),
        contributors: profileRows.map((p) => {
          const own = contents.filter((c) => c.authorId === p.id);
          return {
            user: mapUser(p),
            contents: own.length,
            comments: commentRows.filter((c) => c.author_id === p.id).length,
            likes: own.reduce((s, c) => s + (c.counts.like || 0), 0),
            views: own.reduce((s, c) => s + (c.views || 0), 0),
          };
        }).sort((a, b) => (b.contents + b.comments) - (a.contents + a.comments)).slice(0, 6),
        recent: [
          ...contentRows.map((c) => ({ type: 'content', at: c.created_at, title: c.title, author: userMap.get(c.author_id) || null, contentId: c.id, moduleId: c.module_id })),
          ...commentRows.map((c) => ({ type: 'comment', at: c.created_at, title: (c.body_md || '').slice(0, 60), author: userMap.get(c.author_id) || null, contentId: c.content_id, moduleId: null })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12),
        invites: inviteRows.map(mapInvite),
      };
    },

    async allComments() {
      sb.requireAdmin();
      const { data, error } = await client.from('comments').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw fail('msg.error');
      const rows = (data || []).map(mapComment);
      const ids = rows.map((r) => r.id);
      const stats = ids.length ? await client.from('comment_stats').select('*').in('comment_id', ids) : { data: [] };
      const statMap = new Map((stats.data || []).map((s) => [s.comment_id, s]));
      const authors = await sb.attachAuthors(data || []);
      const contentIds = Array.from(new Set(rows.map((r) => r.contentId)));
      const contentRes = contentIds.length ? await client.from('contents').select('id,title,module_id').in('id', contentIds) : { data: [] };
      const contentMap = new Map((contentRes.data || []).map((c) => [c.id, c]));
      return rows.map((row) => {
        const stat = statMap.get(row.id) || {};
        return {
          ...row,
          counts: { like: stat.like_count || 0, dislike: stat.dislike_count || 0, favorite: stat.favorite_count || 0, comment: 0 },
          author: authors.get(row.authorId) || null,
          content: contentMap.get(row.contentId) || null,
        };
      });
    },
  };
}

/** 从附件引用（`{id,url}` 或裸 URL）解析出存储路径；认不出就返回 null，避免误删 */
export function mediaPathOf(ref) {
  if (!ref) return null;
  const url = typeof ref === 'string' ? ref : ref.url || '';
  const id = (typeof ref === 'string' ? null : ref.id) || (url ? url.split(`/${CONFIG.storageBucket}/`).pop() : '');
  const path = String(id || '').split(/[?#]/)[0];
  return path && !/^https?:/i.test(path) ? path : null;
}

/**
 * 批量回收存储对象（100 个一批），尽力而为：
 * 他人上传的附件会被 storage 的 `media_delete` 策略拒绝（只有上传者本人能删），
 * 且 SDK 在删除成功时也可能抛 TypeError，因此一律不向上抛，只记一条警告。
 */
export async function purgeMedia(sb, refs) {
  const paths = Array.from(new Set((refs || []).map(mediaPathOf).filter(Boolean)));
  if (!paths.length) return 0;
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    try {
      const { error } = await sb.client.storage.from(CONFIG.storageBucket).remove(chunk);
      if (error) console.warn('[media] 回收附件失败', chunk, error.message || error);
      else removed += chunk.length;
    } catch (error) {
      console.warn('[media] 回收附件异常（可能已成功）', chunk, error?.message || error);
    }
  }
  return removed;
}

export function createMediaApi(sb) {
  const { client } = sb;

  return {
    async upload(file, kind = null) {
      sb.requireUser();
      const ext = (file.name || '').split('.').pop() || 'bin';
      const path = `${sb.uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await client.storage.from(CONFIG.storageBucket)
        .upload(path, file, { cacheControl: '31536000', upsert: false });
      if (error) throw fail('content.uploadFail');
      const { data } = client.storage.from(CONFIG.storageBucket).getPublicUrl(path);
      // 入库的是 SDK 按当前基地址生成的绝对地址；这里还原成上游地址，
      // 这样以后更换代理域名不需要迁移历史数据（读取时再统一重写）。
      return { id: path, kind, name: file.name, size: file.size, type: file.type, url: toUpstreamSupabaseUrl(data.publicUrl) };
    },
    async resolve(ref) {
      const url = typeof ref === 'string' ? ref : ref?.url || '';
      return rewriteSupabaseUrls(url);
    },
    async resolveText(text) { return rewriteSupabaseUrls(text); },
    async remove(ref) {
      const path = mediaPathOf(ref);
      if (path) await purgeMedia(sb, [path]);
    },
  };
}
