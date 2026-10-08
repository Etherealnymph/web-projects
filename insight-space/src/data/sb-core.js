/** Supabase 适配层：公共上下文与数据映射 */

import { expLevel } from '../core/util.js';
import { rewriteSupabaseUrls } from '../config.js';

const EMAIL_DOMAIN = 'tiwu.local'; // 用户名 → 合成邮箱

export function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function usernameToEmail(username) {
  const safe = String(username || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${safe}@${EMAIL_DOMAIN}`;
}

export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname || row.username,
    role: row.role,
    bio: row.bio || '',
    avatar: rewriteSupabaseUrls(row.avatar),
    status: row.status || 'active',
    inviteId: row.invite_id || null,
    mustChangePassword: Boolean(row.must_change_password),
    exp: Math.max(0, Number(row.exp) || 0),
    level: expLevel(row.exp),
    createdAt: row.created_at,
  };
}

export function mapModule(row, access, counts) {
  return {
    id: row.id,
    key: row.key,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    descZh: row.desc_zh || '',
    descEn: row.desc_en || '',
    icon: row.icon || '❖',
    sort: row.sort ?? 99,
    hot: Boolean(row.hot),
    kind: row.kind || 'content',
    createdAt: row.created_at,
    access: access || { visible: true, write: true, expiresAt: null },
    counts: counts || { contents: 0 },
  };
}

export function mapContent(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    authorId: row.author_id,
    title: row.title,
    bodyMd: row.body_md || '',
    tags: row.tags || [],
    media: row.media || [],
    status: row.status || 'published',
    visibility: row.visibility || 'public',
    visibleUserIds: row.visible_user_ids || [],
    views: row.views || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    counts: { like: 0, dislike: 0, favorite: 0, comment: 0 },
  };
}

export function mapComment(row) {
  return {
    id: row.id,
    contentId: row.content_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    bodyMd: row.body_md || '',
    media: row.media || [],
    status: row.status || 'active',
    createdAt: row.created_at,
    counts: { like: 0, dislike: 0, favorite: 0, comment: 0 },
    mine: { like: false, dislike: false, favorite: false },
  };
}

export function inviteStatusOf(row) {
  if (!row.active) return 'disabled';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'expired';
  if (row.max_uses && (row.used_count || 0) >= row.max_uses) return 'usedUp';
  return 'active';
}

/** jsonb → 前端结构：module_id 为 null 时用 '*' 表示「全部模块」 */
export function mapInvitePerms(list) {
  return (list || []).map((p) => ({
    moduleId: p.module_id || '*',
    read: p.read !== false,
    write: Boolean(p.write),
    upload: Boolean(p.upload),
    expiresAt: p.expires_at || null,
  }));
}

/** 前端结构 → jsonb：'*' 还原为 null（数据库里 module_id 必须是 uuid） */
export function serializeInvitePerms(list) {
  return (list || []).map((p) => ({
    module_id: !p.moduleId || p.moduleId === '*' ? null : p.moduleId,
    read: p.read !== false,
    write: Boolean(p.write),
    upload: Boolean(p.upload),
    expires_at: p.expiresAt || null,
  }));
}

/** 找出邀请码针对某模块（或「全部模块」）配置的权限 */
export function invitePermFor(perms, moduleId) {
  if (!Array.isArray(perms) || !perms.length) return null;
  const key = (p) => p.module_id || '*';
  return perms.find((p) => key(p) === moduleId) || perms.find((p) => key(p) === '*') || null;
}

export function mapInvite(row) {
  return {
    id: row.id,
    code: row.code,
    category: row.category || '',
    moduleIds: row.module_ids || [],
    allModules: Boolean(row.all_modules),
    modulePerms: mapInvitePerms(row.module_perms),
    write: Boolean(row.write),
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count || 0,
    usedBy: row.used_by || [],
    note: row.note || '',
    active: row.active !== false,
    createdAt: row.created_at,
    status: inviteStatusOf(row),
  };
}

/** 创建共享上下文：登录用户、权限、统计与作者信息 */
export function createContext(client) {
  const sb = {
    client,
    profile: null,
    grants: [],
    invites: [],
  };

  sb.uid = () => sb.profile?.id || null;
  sb.isStaff = () => sb.profile?.role === 'superadmin' || sb.profile?.role === 'owner';
  sb.isAdmin = () => sb.profile?.role === 'superadmin';

  sb.requireUser = () => {
    if (!sb.profile) throw fail('common.loginRequired');
    return sb.profile;
  };
  sb.requireAdmin = () => {
    sb.requireUser();
    if (!sb.isAdmin()) throw fail('common.noPermission');
    return sb.profile;
  };

  sb.loadProfile = async () => {
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) { sb.profile = null; sb.grants = []; sb.invites = []; return null; }
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw fail('msg.networkError');
    sb.profile = mapUser(data);
    sb.grants = [];
    sb.invites = [];
    if (sb.profile) {
      const { data: grantRows } = await client.from('grants').select('*').eq('user_id', user.id);
      sb.grants = grantRows || [];
      const ids = Array.from(new Set(sb.grants.map((g) => g.invite_id).filter(Boolean)));
      if (ids.length) {
        const { data: inviteRows } = await client.from('invites').select('*').in('id', ids);
        sb.invites = inviteRows || [];
      }
    }
    return sb.profile;
  };

  /** 模块访问权限（与数据库 RLS 规则保持一致；邀请码被停用 / 过期会立即失效） */
  sb.accessFor = (moduleId) => {
    if (!sb.profile) return { visible: false, write: false, expiresAt: null };
    if (sb.isStaff()) return { visible: true, write: true, expiresAt: null, role: sb.profile.role };
    const now = Date.now();
    const inviteMap = new Map((sb.invites || []).map((i) => [i.id, i]));
    const valid = sb.grants
      .filter((g) => g.module_id === null || g.module_id === moduleId)
      .map((g) => {
        let read = g.read !== false;
        let write = Boolean(g.write);
        let upload = g.upload !== false;
        let expiry = g.expires_at ? new Date(g.expires_at).getTime() : Infinity;
        if (g.invite_id) {
          const invite = inviteMap.get(g.invite_id);
          if (!invite || invite.active === false) return null;
          if (invite.expires_at) expiry = Math.min(expiry, new Date(invite.expires_at).getTime());
          // 邀请码配置了模块权限时，实时跟随邀请码的最新权限（旧邀请码没有该字段，回落到全局 write）
          const perm = invitePermFor(invite.module_perms, moduleId);
          if (perm) {
            read = perm.read !== false;
            write = read && perm.write === true;
            upload = read && perm.upload === true;
            if (perm.expires_at) expiry = Math.min(expiry, new Date(perm.expires_at).getTime());
          } else if (invite.write === false) {
            write = false;
          }
        }
        return { read, write, upload, expiry, direct: !g.invite_id };
      })
      .filter((g) => g && g.expiry > now);
    if (!valid.length) return { visible: false, write: false, expiresAt: null };
    const effective = valid.some((g) => g.direct) ? valid.filter((g) => g.direct) : valid;
    const visible = effective.some((g) => g.read);
    const write = effective.some((g) => g.write && g.read);
    const upload = effective.some((g) => g.upload && g.read);
    const best = Math.max(...effective.map((g) => g.expiry));
    return { visible, write, upload, expiresAt: best === Infinity ? null : new Date(best).toISOString() };
  };

  sb.attachCounts = async (contents) => {
    if (!contents.length) return contents;
    const ids = contents.map((c) => c.id);
    const [stats, comments, mine] = await Promise.all([
      client.from('content_stats').select('*').in('content_id', ids),
      client.from('comments').select('content_id').in('content_id', ids),
      sb.uid() ? client.from('reactions').select('target_id, kind').eq('user_id', sb.uid()).eq('target_type', 'content').in('target_id', ids) : Promise.resolve({ data: [] }),
    ]);
    const statMap = new Map((stats.data || []).map((s) => [s.content_id, s]));
    const commentMap = new Map();
    for (const row of comments.data || []) commentMap.set(row.content_id, (commentMap.get(row.content_id) || 0) + 1);
    const mineMap = new Map();
    for (const row of mine.data || []) {
      if (!mineMap.has(row.target_id)) mineMap.set(row.target_id, { like: false, dislike: false, favorite: false });
      mineMap.get(row.target_id)[row.kind] = true;
    }
    return contents.map((c) => {
      const stat = statMap.get(c.id) || {};
      return {
        ...c,
        counts: {
          like: stat.like_count || 0,
          dislike: stat.dislike_count || 0,
          favorite: stat.favorite_count || 0,
          comment: commentMap.get(c.id) || 0,
        },
        mine: mineMap.get(c.id) || { like: false, dislike: false, favorite: false },
      };
    });
  };

  sb.attachAuthors = async (rows, key = 'author_id') => {
    const ids = Array.from(new Set(rows.map((r) => r[key]).filter(Boolean)));
    if (!ids.length) return new Map();
    const { data } = await client.from('profiles').select('*').in('id', ids);
    return new Map((data || []).map((p) => [p.id, mapUser(p)]));
  };

  return sb;
}
